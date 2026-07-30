import type { UnknownRecord } from "../shared/types.js";

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

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
  const frame = isRecord(obj.ddsOriginFrame)
    ? obj.ddsOriginFrame
    : isRecord(obj.layerOriginFrame)
      ? obj.layerOriginFrame
      : isRecord(obj.frame)
        ? obj.frame
        : {};
  return {
    x: asNumber(frame.x ?? obj.left),
    y: asNumber(frame.y ?? obj.top),
    w: asNumber(frame.width ?? obj.width),
    h: asNumber(frame.height ?? obj.height),
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
  const artboard = isRecord(sketch.artboard) ? sketch.artboard : undefined;
  const board = isRecord(sketch.board) ? sketch.board : undefined;
  const root = artboard ?? board;
  if (!root) {
    return { tree: "", truncated: false, depth: maxDepth };
  }

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
    if (layer.visible === false || layer.isVisible === false) {
      return;
    }
    if (maxDepth !== "all" && depth > maxDepth) {
      truncated = true;
      return;
    }
    const dimensions = getDimensions(layer);
    const type = asString(layer.type) || "?";
    const name = asString(layer.name) || "?";
    const sublayers = Array.isArray(layer.layers) ? layer.layers.filter(isRecord) : [];
    const style = isRecord(layer.style) ? layer.style : {};
    let line = `${"  ".repeat(depth)}${type}: ${name} (${Math.round(dimensions.w)}x${Math.round(dimensions.h)} @${Math.round(dimensions.x)},${Math.round(dimensions.y)})`;

    if (type === "textLayer") {
      const text = isRecord(layer.text) ? layer.text : {};
      const rawValue = asString(text.value);
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

  const dimensions = getDimensions(root);
  const rootType = artboard ? "Artboard" : "Board";
  lines.push(`${rootType}: ${asString(root.name) || "?"} (${Math.round(dimensions.w)}x${Math.round(dimensions.h)})`);
  lines.push(`Total layers: ${Array.isArray(root.layers) ? root.layers.length : 0}`);
  lines.push("");

  const layers = Array.isArray(root.layers) ? root.layers.filter(isRecord) : [];
  for (const layer of layers) {
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

export function extractDesignTokens(sketch: UnknownRecord): string {
  const colors = new Map<string, number>();
  const fonts = new Map<string, number>();
  const gradients = new Map<string, number>();
  const shadows = new Map<string, number>();
  const radii = new Map<string, number>();
  const borders = new Map<string, number>();

  const addTo = (map: Map<string, number>, key: string): void => {
    map.set(key, (map.get(key) ?? 0) + 1);
  };

  const collectColor = (colorObj: unknown): void => {
    if (!isRecord(colorObj)) return;
    const v = asString(colorObj.value);
    if (v && !v.includes("undefined") && !v.includes("NaN")) addTo(colors, v);
  };

  const collectFont = (fontObj: unknown): void => {
    if (!isRecord(fontObj)) return;
    const name = asString(fontObj.name);
    const type = asString(fontObj.type);
    const size = asNumber(fontObj.size);
    if (!name && !size) return;
    const parts: string[] = [];
    if (name) parts.push(name);
    if (type) parts.push(type);
    if (size) parts.push(`${size}px`);
    addTo(fonts, parts.join(" / "));
  };

  const walk = (layer: UnknownRecord): void => {
    if (layer.visible === false || layer.isVisible === false) return;

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

    // Collect font and text color from artboard textLayer format
    if (asString(layer.type) === "textLayer") {
      const text = isRecord(layer.text) ? layer.text : {};
      const textStyle = isRecord(text.style) ? text.style : {};
      if (isRecord(textStyle.color)) collectColor(textStyle.color);
      if (isRecord(textStyle.font)) collectFont(textStyle.font);

      // Board format: textInfo array
      const textInfoList = Array.isArray(layer.textInfo) ? layer.textInfo.filter(isRecord) : [];
      for (const ti of textInfoList) {
        if (isRecord(ti.color)) collectColor(ti.color);
        if (isRecord(ti.font)) collectFont(ti.font);
      }
    }

    const children = Array.isArray(layer.layers) ? layer.layers.filter(isRecord) : [];
    for (const child of children) walk(child);
  };

  // Entry points: artboard.layers, board.layers, info[]
  const artboard = isRecord(sketch.artboard) ? sketch.artboard : undefined;
  const board = isRecord(sketch.board) ? sketch.board : undefined;
  if (artboard && Array.isArray(artboard.layers)) {
    for (const layer of artboard.layers.filter(isRecord)) walk(layer);
  }
  if (board && Array.isArray(board.layers)) {
    for (const layer of board.layers.filter(isRecord)) walk(layer);
  }
  if (Array.isArray(sketch.info)) {
    for (const item of sketch.info.filter(isRecord)) walk(item);
  }

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

  if (sections.length === 0) return "";
  return `=== Design Tokens ===\n\n${sections.join("\n\n")}`;
}
