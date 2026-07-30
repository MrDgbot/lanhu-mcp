import type { UnknownRecord } from "../shared/types.js";
import {
  getSketchLayerType,
  isRecord,
  isSketchLayerVisible,
  resolveSketchStructure,
} from "./sketch-structure.js";

export interface NormalizedSketchTextStyle {
  color?: UnknownRecord;
  fontSize?: number;
  fontFamily?: string;
  fontPostScriptName?: string;
  fontWeight?: string | number;
  italic?: boolean;
  alignment?: string;
  lineHeight?: number;
  letterSpacing?: number;
}

export interface NormalizedSketchTextRun extends NormalizedSketchTextStyle {
  text: string;
}

export type SketchTextSource =
  | "textInfo-array"
  | "textInfo-object"
  | "layer-text"
  | "legacy-layer-name";

export interface NormalizedSketchText {
  text: string;
  runs: NormalizedSketchTextRun[];
  style: NormalizedSketchTextStyle;
  fontName?: string;
  source: SketchTextSource;
}

export interface SketchTextNormalizationResult {
  value?: NormalizedSketchText;
  warnings: string[];
  tokenWarnings: string[];
}

export interface SketchTextNormalizationOptions {
  allowLegacyLayerName?: boolean;
}

function hasOwn(record: UnknownRecord, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(record, key);
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function asNumber(value: unknown): number | undefined {
  const raw = isRecord(value) ? value.value : value;
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  if (typeof raw === "string" && raw.trim()) {
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function asBoolean(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

function normalizeFontWeight(
  value: unknown,
  styleName: string | undefined,
  bold: boolean | undefined,
): string | number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) return value.trim();

  const normalized = styleName?.toLowerCase() ?? "";
  const numeric = normalized.match(/\b([1-9]00)\b/);
  if (numeric) return Number(numeric[1]);
  if (normalized.includes("black") || normalized.includes("heavy")) return 900;
  if (normalized.includes("extra bold") || normalized.includes("extrabold")) return 800;
  if (normalized.includes("semi bold") || normalized.includes("semibold")) return 600;
  if (normalized.includes("bold")) return 700;
  if (normalized.includes("medium")) return 500;
  if (normalized.includes("regular") || normalized.includes("normal")) return 400;
  return bold === true ? 700 : undefined;
}

function normalizeStyle(source: UnknownRecord, nestedFont?: UnknownRecord): NormalizedSketchTextStyle {
  const font = nestedFont ?? (isRecord(source.font) ? source.font : {});
  const styleName = asString(source.fontStyleName) ?? asString(font.type) ?? asString(font.style);
  const bold = asBoolean(source.bold) ?? asBoolean(font.bold);
  const explicitItalic = asBoolean(source.italic) ?? asBoolean(font.italic);
  const italic = explicitItalic ??
    (styleName ? styleName.toLowerCase().includes("italic") : undefined);
  const color = isRecord(source.color)
    ? source.color
    : isRecord(font.color)
      ? font.color
      : undefined;

  return {
    color,
    fontSize: asNumber(source.size) ?? asNumber(source.fontSize) ?? asNumber(font.size),
    fontFamily: asString(source.fontName) ?? asString(source.fontFamily) ?? asString(font.name),
    fontPostScriptName: asString(source.fontPostScriptName) ??
      asString(source.postScriptName) ??
      asString(font.postScriptName) ??
      asString(font.fontPostScriptName),
    fontWeight: normalizeFontWeight(
      source.fontWeight ?? source.weight ?? font.fontWeight ?? font.weight,
      styleName,
      bold,
    ),
    italic,
    alignment: asString(source.justification) ??
      asString(source.alignment) ??
      asString(source.align) ??
      asString(font.align),
    lineHeight: asNumber(source.leading) ?? asNumber(source.lineHeight) ?? asNumber(font.lineHeight),
    letterSpacing: asNumber(source.tracking) ??
      asNumber(source.letterSpacing) ??
      asNumber(font.letterSpacing),
  };
}

function mergeStyles(runs: NormalizedSketchTextRun[]): NormalizedSketchTextStyle {
  const merged: NormalizedSketchTextStyle = {};
  const keys: Array<keyof NormalizedSketchTextStyle> = [
    "color",
    "fontSize",
    "fontFamily",
    "fontPostScriptName",
    "fontWeight",
    "italic",
    "alignment",
    "lineHeight",
    "letterSpacing",
  ];
  for (const run of runs) {
    for (const key of keys) {
      if (merged[key] === undefined && run[key] !== undefined) {
        Object.assign(merged, { [key]: run[key] });
      }
    }
  }
  return merged;
}

function textValue(record: UnknownRecord, key: "text" | "value"): string | undefined {
  return hasOwn(record, key) ? asString(record[key]) : undefined;
}

function warningPrefix(layer: UnknownRecord): string {
  return `Unsupported visible textLayer "${String(layer.name ?? "?")}"`;
}

function missingLegacyStyleFields(style: NormalizedSketchTextStyle): string[] {
  const missing: string[] = [];
  const hasFont = style.fontFamily !== undefined ||
    style.fontPostScriptName !== undefined ||
    style.fontSize !== undefined ||
    style.fontWeight !== undefined;
  if (!hasFont) missing.push("font");
  if (style.color === undefined) missing.push("color");
  return missing;
}

export function normalizeSketchTextLayer(
  layer: UnknownRecord,
  options: SketchTextNormalizationOptions = {},
): SketchTextNormalizationResult {
  const warnings: string[] = [];
  const textInfo = layer.textInfo;

  if (Array.isArray(textInfo)) {
    const runs: NormalizedSketchTextRun[] = [];
    let recognizedText = false;
    for (let index = 0; index < textInfo.length; index++) {
      const item = textInfo[index];
      if (!isRecord(item)) {
        warnings.push(`${warningPrefix(layer)}: textInfo[${index}] must be an object.`);
        continue;
      }
      const text = textValue(item, "text") ?? textValue(item, "value");
      if (text !== undefined) recognizedText = true;
      runs.push({ text: text ?? "", ...normalizeStyle(item) });
    }
    if (recognizedText) {
      const style = mergeStyles(runs);
      return {
        value: {
          text: runs.map((run) => run.text).join(""),
          runs,
          style,
          fontName: style.fontFamily ?? style.fontPostScriptName,
          source: "textInfo-array",
        },
        warnings,
        tokenWarnings: warnings,
      };
    }
  } else if (isRecord(textInfo)) {
    const text = textValue(textInfo, "text") ?? textValue(textInfo, "value");
    if (text !== undefined) {
      const style = normalizeStyle(textInfo);
      const run = { text, ...style };
      return {
        value: {
          text,
          runs: [run],
          style,
          fontName: style.fontPostScriptName ?? style.fontFamily,
          source: "textInfo-object",
        },
        warnings,
        tokenWarnings: warnings,
      };
    }
  }

  const text = isRecord(layer.text) ? layer.text : undefined;
  const modernValue = text ? textValue(text, "value") ?? textValue(text, "text") : undefined;
  if (text && modernValue !== undefined) {
    const textStyle = isRecord(text.style) ? text.style : {};
    const font = isRecord(textStyle.font) ? textStyle.font : {};
    const style = normalizeStyle({ ...font, color: textStyle.color }, font);
    const run = { text: modernValue, ...style };
    return {
      value: {
        text: modernValue,
        runs: [run],
        style,
        fontName: style.fontFamily ?? style.fontPostScriptName,
        source: "layer-text",
      },
      warnings,
      tokenWarnings: warnings,
    };
  }

  const layerName = asString(layer.name);
  const canUseLegacyName = options.allowLegacyLayerName === true &&
    !hasOwn(layer, "textInfo") &&
    !hasOwn(layer, "text") &&
    layerName !== undefined &&
    layerName.trim().length > 0;
  if (canUseLegacyName) {
    const style = normalizeStyle(layer);
    const missingStyle = missingLegacyStyleFields(style);
    const run = { text: layerName, ...style };
    const heuristicWarning =
      `Legacy info textLayer "${layerName}": Text was recovered heuristically from ` +
      "layer.name and may be truncated or differ from rendered content.";
    const styleWarnings = missingStyle.length > 0
      ? [
          `Legacy info textLayer "${layerName}" has no recognizable ` +
          `${missingStyle.join(" or ")} style fields.`,
        ]
      : [];
    return {
      value: {
        text: layerName,
        runs: [run],
        style,
        fontName: style.fontFamily ?? style.fontPostScriptName,
        source: "legacy-layer-name",
      },
      warnings: [heuristicWarning, ...styleWarnings],
      tokenWarnings: styleWarnings,
    };
  }

  const reason = Array.isArray(textInfo)
    ? "textInfo array contains no string text values"
    : isRecord(textInfo)
      ? "textInfo object contains no string text value"
      : textInfo === undefined
        ? "expected textInfo object/array or text.value"
        : "textInfo must be an object or array, or text.value must be present";
  warnings.push(`${warningPrefix(layer)}: ${reason}.`);
  return { warnings, tokenWarnings: warnings };
}

export function collectSketchTextWarnings(sketch: UnknownRecord): string[] {
  const structure = resolveSketchStructure(sketch);
  const options = { allowLegacyLayerName: structure.kind === "info" };
  const warnings = new Set<string>();
  const visited = new Set<UnknownRecord>();

  const walk = (layer: UnknownRecord): void => {
    if (visited.has(layer) || !isSketchLayerVisible(layer)) return;
    visited.add(layer);
    if (getSketchLayerType(layer) === "textLayer") {
      for (const warning of normalizeSketchTextLayer(layer, options).warnings) warnings.add(warning);
    }
    const children = Array.isArray(layer.layers) ? layer.layers.filter(isRecord) : [];
    for (const child of children) walk(child);
  };

  for (const layer of structure.layers) walk(layer);
  return [...warnings];
}

export function sketchColorToCss(color: UnknownRecord | undefined, opacity = 100): string | undefined {
  if (!color) return undefined;
  if (typeof color.value === "string" && color.value.trim()) return color.value;
  const hasChannels = ["red", "r", "green", "g", "blue", "b"].some((key) => key in color);
  if (!hasChannels) return undefined;
  const r = Math.round(asNumber(color.red ?? color.r) ?? 0);
  const g = Math.round(asNumber(color.green ?? color.g) ?? 0);
  const b = Math.round(asNumber(color.blue ?? color.b) ?? 0);
  const rawAlpha = asNumber(color.alpha ?? color.a) ?? 1;
  const alpha = Math.max(0, Math.min(1, rawAlpha > 1 ? rawAlpha / 255 : rawAlpha)) *
    Math.max(0, Math.min(1, opacity / 100));
  const roundedAlpha = Math.round(alpha * 1000) / 1000;
  return roundedAlpha < 1
    ? `rgba(${r},${g},${b},${roundedAlpha})`
    : `rgb(${r},${g},${b})`;
}
