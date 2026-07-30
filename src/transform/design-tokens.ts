import type { UnknownRecord } from "../shared/types.js";
import {
  getSketchLayerFrame,
  getSketchLayerType,
  isRecord,
  isSketchLayerVisible,
  resolveSketchStructure,
} from "./sketch-structure.js";
import {
  normalizeSketchTextLayer,
  sketchColorToCss,
  type NormalizedSketchTextStyle,
} from "./sketch-text.js";

function asNumber(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function getDimensions(obj: UnknownRecord): { x: number; y: number; w: number; h: number } {
  const frame = getSketchLayerFrame(obj);
  return {
    x: frame.x,
    y: frame.y,
    w: frame.width,
    h: frame.height,
  };
}

function simplifyFill(fill: UnknownRecord): string | undefined {
  if (fill.isEnabled === false) {
    return undefined;
  }
  const fillType = asNumber(fill.fillType);
  if (fillType === 0) {
    const color = isRecord(fill.color) ? fill.color : {};
    return `solid(${asString(color.value) || "unknown"})`;
  }
  if (fillType === 1) {
    const gradient = isRecord(fill.gradient) ? fill.gradient : {};
    const stops = Array.isArray(gradient.colorStops) ? gradient.colorStops.filter(isRecord) : [];
    const from = isRecord(gradient.from) ? gradient.from : {};
    const to = isRecord(gradient.to) ? gradient.to : {};
    const dx = asNumber(to.x, 0.5) - asNumber(from.x, 0.5);
    const dy = asNumber(to.y, 0) - asNumber(from.y, 0);
    const angle = ((Math.round((Math.atan2(dx, dy) * 180) / Math.PI) % 360) + 360) % 360;
    const parts = stops.map((stop) => {
      const color = isRecord(stop.color) ? stop.color : {};
      return `${asString(color.value) || "unknown"} ${Math.round(asNumber(stop.position) * 100)}%`;
    });
    return `linear-gradient(${angle}deg, ${parts.join(", ")})`;
  }
  return undefined;
}

function simplifyBorder(border: UnknownRecord): string | undefined {
  if (border.isEnabled === false) {
    return undefined;
  }
  const color = isRecord(border.color) ? border.color : {};
  const positionMap: Record<string, string> = { 内边框: "inside", 外边框: "outside", 中心边框: "center" };
  return `${asNumber(border.thickness, 1)}px ${positionMap[asString(border.position)] ?? (asString(border.position) || "center")} ${asString(color.value) || "unknown"}`;
}

function simplifyShadow(shadow: UnknownRecord): string | undefined {
  if (shadow.isEnabled === false) {
    return undefined;
  }
  const color = isRecord(shadow.color) ? shadow.color : {};
  return `${asString(color.value) || "unknown"} ${asNumber(shadow.offsetX)}px ${asNumber(shadow.offsetY)}px ${asNumber(shadow.blurRadius)}px ${asNumber(shadow.spread)}px`;
}

export type LayerDepth = number | "all";

export interface LayerTreeResult {
  tree: string;
  truncated: boolean;
  depth: LayerDepth;
}

export function extractLayerTreeResult(
  sketch: UnknownRecord,
  maxDepth: LayerDepth = 4,
): LayerTreeResult {
  const structure = resolveSketchStructure(sketch);
  const textOptions = { allowLegacyLayerName: structure.kind === "info" };

  const lines: string[] = [];
  let truncated = false;

  const formatStyleBrief = (style: UnknownRecord): string => {
    const parts: string[] = [];
    const fills = Array.isArray(style.fills) ? style.fills.filter(isRecord) : [];
    for (const fill of fills) {
      if (fill.isEnabled === false) continue;
      const color = isRecord(fill.color) ? fill.color : {};
      if (Object.keys(color).length > 0) {
        parts.push(`fill:${asString(color.value) || "rgba(?)"}`);
      }
      if (fill.gradient) {
        parts.push(`gradient:${asString(isRecord(fill.gradient) ? fill.gradient.type : undefined) || "linear"}`);
      }
    }
    const borders = Array.isArray(style.borders) ? style.borders.filter(isRecord) : [];
    if (borders.some((border) => border.isEnabled !== false)) {
      parts.push(`border:${borders.length}`);
    }
    const shadows = Array.isArray(style.shadows) ? style.shadows.filter(isRecord) : [];
    if (shadows.some((shadow) => shadow.isEnabled !== false)) {
      parts.push(`shadow:${shadows.length}`);
    }
    return parts.join(" ");
  };

  const walk = (layer: UnknownRecord, depth = 0): void => {
    if (!isSketchLayerVisible(layer)) {
      return;
    }
    if (maxDepth !== "all" && depth > maxDepth) {
      truncated = true;
      return;
    }
    const dimensions = getDimensions(layer);
    const type = getSketchLayerType(layer);
    const name = asString(layer.name) || "?";
    const sublayers = Array.isArray(layer.layers) ? layer.layers.filter(isRecord) : [];
    const style = isRecord(layer.style) ? layer.style : {};
    let line = `${"  ".repeat(depth)}${type}: ${name} (${Math.round(dimensions.w)}x${Math.round(dimensions.h)} @${Math.round(dimensions.x)},${Math.round(dimensions.y)})`;

    if (type === "textLayer") {
      const rawValue = normalizeSketchTextLayer(layer, textOptions).value?.text ?? "";
      const clipped = rawValue.length > 40 ? `${rawValue.slice(0, 40)}...` : rawValue;
      if (clipped) {
        line += ` "${clipped}"`;
      }
    }

    const styleBrief = formatStyleBrief(style);
    if (styleBrief) {
      line += ` [${styleBrief}]`;
    }
    if (sublayers.length > 0) {
      line += ` (${sublayers.length} children)`;
    }
    lines.push(line);

    for (const child of sublayers) {
      walk(child, depth + 1);
    }
  };

  const rootType = structure.kind === "artboard"
    ? "Artboard"
    : structure.kind === "board"
      ? "Board"
      : "Legacy Sketch";
  lines.push(`${rootType}: ${structure.name} (${Math.round(structure.width)}x${Math.round(structure.height)})`);
  lines.push(`Total layers: ${structure.layers.length}`);
  lines.push("");

  for (const layer of structure.layers) {
    walk(layer);
  }
  if (truncated) {
    lines.push("");
    lines.push(`[Layer tree truncated at depth ${maxDepth}; pass layer_depth: "all" for the complete tree.]`);
  }
  return { tree: lines.join("\n"), truncated, depth: maxDepth };
}

export function extractLayerTree(sketch: UnknownRecord, maxDepth: LayerDepth = 4): string {
  return extractLayerTreeResult(sketch, maxDepth).tree;
}

export interface DesignTokensResult {
  tokens: string;
  warnings: string[];
}

export function extractDesignTokensResult(sketch: UnknownRecord): DesignTokensResult {
  const structure = resolveSketchStructure(sketch);
  const textOptions = { allowLegacyLayerName: structure.kind === "info" };
  const colors = new Map<string, number>();
  const fonts = new Map<string, number>();
  const gradients = new Map<string, number>();
  const shadows = new Map<string, number>();
  const radii = new Map<string, number>();
  const borders = new Map<string, number>();
  const warnings = new Set<string>();

  const addTo = (map: Map<string, number>, key: string): void => {
    map.set(key, (map.get(key) ?? 0) + 1);
  };

  const collectColor = (colorObj: unknown): void => {
    if (!isRecord(colorObj)) return;
    const value = sketchColorToCss(colorObj);
    if (value && !value.includes("undefined") && !value.includes("NaN")) addTo(colors, value);
  };

  const collectFont = (style: NormalizedSketchTextStyle): void => {
    const name = style.fontFamily ?? style.fontPostScriptName ?? "";
    const weight = style.fontWeight;
    const size = style.fontSize ?? 0;
    if (!name && !size) return;
    const parts: string[] = [];
    if (name) parts.push(name);
    if (weight !== undefined) parts.push(String(weight));
    if (size) parts.push(`${size}px`);
    addTo(fonts, parts.join(" / "));
  };

  const walk = (layer: UnknownRecord): void => {
    if (!isSketchLayerVisible(layer)) return;

    const style = isRecord(layer.style) ? layer.style : {};
    const fills = Array.isArray(style.fills) ? style.fills.filter(isRecord) : [];
    const borderList = Array.isArray(style.borders) ? style.borders.filter(isRecord) : [];
    const shadowList = Array.isArray(style.shadows) ? style.shadows.filter(isRecord) : [];

    // Collect fill colors and gradients
    for (const fill of fills) {
      if (fill.isEnabled === false) continue;
      const fillType = asNumber(fill.fillType);
      if (fillType === 1) {
        const simplified = simplifyFill(fill);
        if (simplified) addTo(gradients, simplified);
      } else {
        if (isRecord(fill.color)) collectColor(fill.color);
      }
    }

    // Collect border colors
    for (const border of borderList) {
      if (border.isEnabled === false) continue;
      const simplified = simplifyBorder(border);
      if (simplified) addTo(borders, simplified);
    }

    // Collect shadow tokens
    for (const shadow of shadowList) {
      if (shadow.isEnabled === false) continue;
      const simplified = simplifyShadow(shadow);
      if (simplified) addTo(shadows, simplified);
    }

    // Collect border radius
    if (Array.isArray(layer.radius) && layer.radius.length > 0) {
      const vals = (layer.radius as unknown[]).map((v) => asNumber(v));
      const unique = [...new Set(vals)];
      if (unique.length === 1) {
        if (unique[0] !== 0) addTo(radii, `${unique[0]}px`);
      } else {
        addTo(radii, vals.map((v) => `${v}px`).join(" "));
      }
    } else if (typeof layer.radius === "number" && layer.radius !== 0) {
      addTo(radii, `${layer.radius}px`);
    }

    if (getSketchLayerType(layer) === "textLayer") {
      const normalized = normalizeSketchTextLayer(layer, textOptions);
      for (const warning of normalized.tokenWarnings) warnings.add(warning);
      if (normalized.value) {
        for (const run of normalized.value.runs) {
          collectColor(run.color);
          collectFont(run);
        }
      }
    }

    const children = Array.isArray(layer.layers) ? layer.layers.filter(isRecord) : [];
    for (const child of children) walk(child);
  };

  for (const layer of structure.layers) walk(layer);

  const sortedEntries = (map: Map<string, number>): [string, number][] =>
    [...map.entries()].sort((a, b) => b[1] - a[1]);

  const formatSection = (title: string, map: Map<string, number>): string => {
    if (map.size === 0) return "";
    const lines = [`${title} (${map.size} unique):`];
    for (const [key, count] of sortedEntries(map)) {
      lines.push(`  ${key} x${count}`);
    }
    return lines.join("\n");
  };

  const sections = [
    formatSection("Colors", colors),
    formatSection("Fonts", fonts),
    formatSection("Gradients", gradients),
    formatSection("Shadows", shadows),
    formatSection("Borders", borders),
    formatSection("Border Radius", radii),
  ].filter(Boolean);

  const tokens = sections.length === 0
    ? ""
    : `=== Design Tokens ===\n\n${sections.join("\n\n")}`;
  return { tokens, warnings: [...warnings] };
}

export function extractDesignTokens(sketch: UnknownRecord): string {
  return extractDesignTokensResult(sketch).tokens;
}
