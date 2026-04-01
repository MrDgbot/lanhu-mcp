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

export function extractLayerTree(sketch: UnknownRecord, maxDepth = 4): string {
  const artboard = isRecord(sketch.artboard) ? sketch.artboard : undefined;
  if (!artboard) {
    return "";
  }

  const lines: string[] = [];

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
    if (depth > maxDepth || layer.visible === false) {
      return;
    }
    const frame = isRecord(layer.frame) ? layer.frame : {};
    const w = asNumber(frame.width);
    const h = asNumber(frame.height);
    const x = asNumber(frame.x);
    const y = asNumber(frame.y);
    const type = asString(layer.type) || "?";
    const name = asString(layer.name) || "?";
    const sublayers = Array.isArray(layer.layers) ? layer.layers.filter(isRecord) : [];
    const style = isRecord(layer.style) ? layer.style : {};
    let line = `${"  ".repeat(depth)}${type}: ${name} (${Math.round(w)}x${Math.round(h)} @${Math.round(x)},${Math.round(y)})`;

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

  const frame = isRecord(artboard.frame) ? artboard.frame : {};
  lines.push(`Artboard: ${asString(artboard.name) || "?"} (${Math.round(asNumber(frame.width))}x${Math.round(asNumber(frame.height))})`);
  lines.push(`Total layers: ${Array.isArray(artboard.layers) ? artboard.layers.length : 0}`);
  lines.push("");

  const layers = Array.isArray(artboard.layers) ? artboard.layers.filter(isRecord) : [];
  for (const layer of layers) {
    walk(layer);
  }
  return lines.join("\n");
}

export function extractDesignTokens(sketch: UnknownRecord): string {
  const tokens: string[] = [];

  const walk = (obj: UnknownRecord, parentPath = ""): void => {
    if (obj.isVisible === false) {
      return;
    }
    const name = asString(obj.name);
    const currentPath = parentPath ? `${parentPath}/${name}` : name;
    const dims = getDimensions(obj);
    if (dims.w < 2 && dims.h < 2) {
      return;
    }

    const lines: string[] = [];
    const fills = Array.isArray(obj.fills) ? obj.fills.filter(isRecord) : [];
    const borders = Array.isArray(obj.borders) ? obj.borders.filter(isRecord) : [];
    const shadows = Array.isArray(obj.shadows) ? obj.shadows.filter(isRecord) : [];
    const radius = obj.radius;
    const opacity = typeof obj.opacity === "number" ? obj.opacity : undefined;

    const hasGradient = fills.some((fill) => asNumber(fill.fillType) === 1 && fill.isEnabled !== false);
    const hasBorder = borders.some((border) => border.isEnabled !== false);
    const hasShadow = shadows.some((shadow) => shadow.isEnabled !== false);
    const unevenRadius = Array.isArray(radius) && new Set(radius).size > 1;
    const reducedOpacity = opacity != null && opacity < 100;

    if (!(hasGradient || hasBorder || hasShadow || unevenRadius || reducedOpacity)) {
      const children = Array.isArray(obj.layers) ? obj.layers.filter(isRecord) : [];
      for (const child of children) {
        walk(child, currentPath);
      }
      return;
    }

    lines.push(`[${asString(obj.type) || asString(obj.ddsType) || "unknown"}] "${name}" @(${Math.round(dims.x)},${Math.round(dims.y)}) ${Math.round(dims.w)}x${Math.round(dims.h)}${parentPath ? `  path: ${currentPath}` : ""}`);

    if (radius != null) {
      lines.push(`  radius: ${Array.isArray(radius) ? JSON.stringify(radius) : String(radius)}`);
    }
    for (const fill of fills) {
      const simplified = simplifyFill(fill);
      if (simplified) lines.push(`  fill: ${simplified}`);
    }
    for (const border of borders) {
      const simplified = simplifyBorder(border);
      if (simplified) lines.push(`  border: ${simplified}`);
    }
    if (reducedOpacity) {
      lines.push(`  opacity: ${opacity}%`);
    }
    for (const shadow of shadows) {
      const simplified = simplifyShadow(shadow);
      if (simplified) lines.push(`  shadow: ${simplified}`);
    }
    tokens.push(lines.join("\n"));

    const children = Array.isArray(obj.layers) ? obj.layers.filter(isRecord) : [];
    for (const child of children) {
      walk(child, currentPath);
    }
  };

  const artboard = isRecord(sketch.artboard) ? sketch.artboard : undefined;
  if (artboard && Array.isArray(artboard.layers)) {
    for (const layer of artboard.layers.filter(isRecord)) {
      walk(layer);
    }
  } else if (Array.isArray(sketch.info)) {
    for (const item of sketch.info.filter(isRecord)) {
      walk(item);
    }
  }

  return tokens.join("\n\n");
}
