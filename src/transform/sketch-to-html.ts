import type { UnknownRecord } from "../shared/types.js";
import { minifyHtml } from "../shared/html.js";
import {
  getSketchLayerFrame,
  getSketchLayerType,
  hasVisibleSketchLayerData,
  resolveSketchStructure,
} from "./sketch-structure.js";
import {
  collectSketchTextWarnings,
  normalizeSketchTextLayer,
  sketchColorToCss,
  type SketchTextSource,
} from "./sketch-text.js";

export interface LayerAnnotation {
  name: string;
  type: string;
  css: Record<string, string>;
  text?: string;
  text_source?: SketchTextSource;
  slice_url?: string;
}

export interface SketchToHtmlResult {
  html: string;
  imageUrlMapping: Record<string, string>;
  layerAnnotations: LayerAnnotation[];
  warnings: string[];
}

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function px(value: unknown, scale: number): number {
  if (value == null) return 0;
  return Math.round((Number(value) / scale) * 10) / 10;
}

function colorCss(c: unknown, opacity = 100): string | null {
  return isRecord(c) ? sketchColorToCss(c, opacity) ?? null : null;
}

function getOpacity(layer: UnknownRecord): number {
  const bo = isRecord(layer.blendOptions) ? layer.blendOptions : {};
  if ("opacity" in bo) {
    const op = bo.opacity;
    return isRecord(op) ? Number(op.value ?? 100) : Number(op ?? 100);
  }
  return 100;
}

function extractBorderRadius(layer: UnknownRecord, scale: number): string | null {
  const path = isRecord(layer.path) ? layer.path : {};
  const comps = Array.isArray(path.pathComponents) ? path.pathComponents : [];
  if (comps.length === 0) return null;
  const origin = isRecord(comps[0]) && isRecord(comps[0].origin) ? comps[0].origin : {};
  const radii = Array.isArray(origin.radii) ? origin.radii : null;
  if (!radii) return null;
  const r = radii.map((v: unknown) => px(v, scale));
  if (new Set(r).size === 1 && r[0] > 0) return `${r[0]}px`;
  if (r.some((v: number) => v > 0)) return `${r[0]}px ${r[1]}px ${r[2]}px ${r[3]}px`;
  return null;
}

function extractShadow(effects: UnknownRecord, scale: number): string | null {
  const shadows: string[] = [];
  for (const key of ["dropShadow", "innerShadow"] as const) {
    const fx = isRecord(effects[key]) ? effects[key] : null;
    if (!fx || !(fx as UnknownRecord).enabled) continue;
    const fxRec = fx as UnknownRecord;
    const c = isRecord(fxRec.color) ? fxRec.color : {};
    let color = colorCss(c);
    if (!color) continue;

    const opObj = fxRec.opacity;
    const opVal = isRecord(opObj) ? Number(opObj.value ?? 100) : 100;
    if (opVal < 100) {
      const r = Math.round(Number(c.red ?? c.r ?? 0));
      const g = Math.round(Number(c.green ?? c.g ?? 0));
      const b = Math.round(Number(c.blue ?? c.b ?? 0));
      color = `rgba(${r},${g},${b},${Math.round((opVal / 100) * 100) / 100})`;
    }

    const angleObj = fxRec.localLightingAngle;
    const angleDeg = isRecord(angleObj) ? Number(angleObj.value ?? 90) : 90;
    const angleRad = (angleDeg * Math.PI) / 180;
    const dist = px(fxRec.distance ?? 0, scale);
    const blur = px(fxRec.blur ?? 0, scale);
    const spread = px(fxRec.chokeMatte ?? 0, scale);
    const ox = Math.round(-dist * Math.cos(angleRad) * 10) / 10;
    const oy = Math.round(dist * Math.sin(angleRad) * 10) / 10;

    const inset = key === "innerShadow" ? "inset " : "";
    const spreadStr = spread ? ` ${spread}px` : "";
    shadows.push(`${inset}${ox}px ${oy}px ${blur}px${spreadStr} ${color}`);
  }
  return shadows.length > 0 ? shadows.join(",") : null;
}

function extractBorder(effects: UnknownRecord, scale: number): string | null {
  const stroke = isRecord(effects.frameFX)
    ? effects.frameFX
    : isRecord(effects.solidFill)
      ? effects.solidFill
      : null;
  if (!stroke || !(stroke as UnknownRecord).enabled) return null;
  const s = stroke as UnknownRecord;
  const size = px(s.size ?? 1, scale);
  const c = isRecord(s.color) ? s.color : {};
  const color = colorCss(c);
  return color ? `${size}px solid ${color}` : null;
}

function safeAttr(text: string): string {
  return text.replace(/"/g, "&quot;");
}

function safeContent(text: string): string {
  return text.replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\r/g, "\n");
}

interface FlatLayer extends UnknownRecord {
  __visible: true;
}

function flattenLayers(rawLayers: unknown[], scale: number): FlatLayer[] {
  const result: FlatLayer[] = [];

  const flatten = (layer: unknown): void => {
    if (!isRecord(layer)) return;
    if (layer.visible === false) return;

    const w = Number(layer.width ?? 0) || 0;
    const h = Number(layer.height ?? 0) || 0;
    if (w === 0 && h === 0) {
      const children = Array.isArray(layer.layers) ? layer.layers : [];
      for (let i = children.length - 1; i >= 0; i--) flatten(children[i]);
      return;
    }

    const ltype = String(layer.type ?? "");
    if (ltype === "layerSection") {
      const images = isRecord(layer.images) ? layer.images : {};
      if (images.png_xxxhd || images.svg) {
        result.push(layer as FlatLayer);
      } else {
        const children = Array.isArray(layer.layers) ? layer.layers : [];
        for (let i = children.length - 1; i >= 0; i--) flatten(children[i]);
      }
      return;
    }

    result.push(layer as FlatLayer);
  };

  for (let i = rawLayers.length - 1; i >= 0; i--) {
    flatten(rawLayers[i]);
  }
  return result;
}

function flattenArtboardLayers(rawLayers: unknown[], scale: number): FlatLayer[] {
  const result: FlatLayer[] = [];

  const flatten = (layer: unknown): void => {
    if (!isRecord(layer)) return;
    if (layer.visible === false || layer.isVisible === false) return;

    const frame = isRecord(layer.frame) ? layer.frame : {};
    const w = Number(frame.width ?? 0) || 0;
    const h = Number(frame.height ?? 0) || 0;
    if (w === 0 && h === 0) {
      const children = Array.isArray(layer.layers) ? layer.layers : [];
      for (let i = children.length - 1; i >= 0; i--) flatten(children[i]);
      return;
    }

    // Artboard layers use frame.left/top or frame.x/y for coordinates
    const frameX = frame.left ?? frame.x ?? 0;
    const frameY = frame.top ?? frame.y ?? 0;

    const ltype = String(layer.type ?? "");
    if (ltype === "groupLayer" || ltype === "symbolInstence") {
      const imageData = isRecord(layer.image) ? layer.image : {};
      if (imageData.imageUrl || imageData.svgUrl) {
        result.push({
          ...layer,
          left: frameX,
          top: frameY,
          width: frame.width ?? 0,
          height: frame.height ?? 0,
          __visible: true,
        } as FlatLayer);
      } else {
        const children = Array.isArray(layer.layers) ? layer.layers : [];
        for (let i = children.length - 1; i >= 0; i--) flatten(children[i]);
      }
      return;
    }

    const mapped: UnknownRecord = {
      ...layer,
      left: frameX,
      top: frameY,
      width: frame.width ?? 0,
      height: frame.height ?? 0,
      __visible: true,
    };

    result.push(mapped as FlatLayer);
  };

  for (let i = rawLayers.length - 1; i >= 0; i--) {
    flatten(rawLayers[i]);
  }
  return result;
}

function flattenLegacyInfoLayers(rawLayers: unknown[]): FlatLayer[] {
  const result: FlatLayer[] = [];

  const flatten = (layer: unknown): void => {
    if (!isRecord(layer) || layer.visible === false || layer.isVisible === false) return;

    const frame = getSketchLayerFrame(layer);
    const type = getSketchLayerType(layer);
    const children = Array.isArray(layer.layers) ? layer.layers : [];
    const ddsImage = isRecord(layer.ddsImage) ? layer.ddsImage : {};
    const image = isRecord(layer.image) ? layer.image : {};
    const imageUrl = String(
      ddsImage.imageUrl ?? ddsImage.svgUrl ?? image.imageUrl ?? image.svgUrl ?? "",
    );

    if (["groupLayer", "layerSection", "symbolInstence"].includes(type) && !imageUrl) {
      for (let index = children.length - 1; index >= 0; index--) flatten(children[index]);
      return;
    }
    if (frame.width === 0 && frame.height === 0 && !imageUrl) {
      for (let index = children.length - 1; index >= 0; index--) flatten(children[index]);
      return;
    }

    const mapped: UnknownRecord = {
      ...layer,
      type,
      left: frame.x,
      top: frame.y,
      width: frame.width,
      height: frame.height,
      __visible: true,
    };

    if (imageUrl) {
      mapped.images = {
        ...(isRecord(layer.images) ? layer.images : {}),
        [imageUrl.endsWith(".svg") ? "svg" : "png_xxxhd"]: imageUrl,
      };
    }

    if (!isRecord(mapped.fill)) {
      const style = isRecord(layer.style) ? layer.style : {};
      const fills = Array.isArray(layer.fills)
        ? layer.fills.filter(isRecord)
        : Array.isArray(style.fills)
          ? style.fills.filter(isRecord)
          : [];
      const fill = fills.find((entry) => entry.isEnabled !== false);
      if (fill && isRecord(fill.color)) mapped.fill = { color: fill.color };
    }

    result.push(mapped as FlatLayer);
  };

  for (let index = rawLayers.length - 1; index >= 0; index--) flatten(rawLayers[index]);
  return result;
}

function analyzeSketch(
  sketchData: UnknownRecord,
  designScale = 2.0,
  designImgUrl = "",
  renderHtml = true,
): SketchToHtmlResult {
  const scale = designScale || 2.0;
  const structure = resolveSketchStructure(sketchData);
  const boardW = px(structure.width || 750, scale);
  const boardH = px(structure.height || 1334, scale);
  const layers = structure.kind === "board"
    ? flattenLayers(structure.layers, scale)
    : structure.kind === "artboard"
      ? flattenArtboardLayers(structure.layers, scale)
      : flattenLegacyInfoLayers(structure.layers);

  if (hasVisibleSketchLayerData(structure.layers) && layers.length === 0) {
    throw new Error(
      `Unsupported Sketch ${structure.kind} layer structure: ` +
      "found visible layer data but no renderable layers.",
    );
  }

  const cssRules: string[] = [];
  const htmlParts: string[] = [];
  const imageUrlMapping: Record<string, string> = {};
  const layerAnnotations: LayerAnnotation[] = [];
  const warnings = collectSketchTextWarnings(sketchData);
  const textOptions = { allowLegacyLayerName: structure.kind === "info" };

  for (let idx = 0; idx < layers.length; idx++) {
    const L = layers[idx];
    const cls = `el${idx + 1}`;
    const ltype = String(L.type ?? "");
    const name = String(L.name ?? "");
    const left = px(L.left ?? 0, scale);
    const top = px(L.top ?? 0, scale);
    const w = px(L.width ?? 0, scale);
    const h = px(L.height ?? 0, scale);

    const opacity = getOpacity(L);
    const effects = isRecord(L.layerEffects) ? L.layerEffects : {};

    const annot: LayerAnnotation = {
      name,
      type: ltype,
      css: {
        position: "absolute",
        left: `${left}px`,
        top: `${top}px`,
        width: `${w}px`,
        height: `${h}px`,
      },
    };

    const props: string[] = [
      "position:absolute",
      `left:${left}px`,
      `top:${top}px`,
      `width:${w}px`,
      `height:${h}px`,
    ];

    if (opacity < 100) {
      const opCss = Math.round((opacity / 100) * 100) / 100;
      props.push(`opacity:${opCss}`);
      annot.css.opacity = String(opCss);
    }

    const br = extractBorderRadius(L, scale);
    if (br) {
      props.push(`border-radius:${br}`);
      props.push("overflow:hidden");
      annot.css["border-radius"] = br;
    }

    const shadow = extractShadow(effects, scale);
    if (shadow) {
      annot.css["box-shadow"] = shadow;
    }

    const border = extractBorder(effects, scale);
    if (border) {
      annot.css.border = border;
    }

    let textContent = "";
    let isSlice = false;
    let sliceUrl = "";

    const images = isRecord(L.images) ? L.images : {};
    if (images.png_xxxhd || images.svg) {
      isSlice = true;
      sliceUrl = String(images.png_xxxhd ?? images.svg ?? "");
      const localName = `${name.replace(/\//g, "_").replace(/ /g, "_")}.png`;
      const localPath = `./assets/slices/${localName}`;
      imageUrlMapping[localPath] = sliceUrl;
      annot.slice_url = sliceUrl;
    }

    if (ltype === "textLayer") {
      const normalized = normalizeSketchTextLayer(L, textOptions).value;
      const textStyle = normalized?.style ?? {};
      textContent = normalized?.text ?? "";
      if (normalized) {
        annot.text = textContent;
        annot.text_source = normalized.source;
      }
      props.push("z-index:10");
      const textColor = colorCss(textStyle.color, opacity);
      if (textColor) {
        props.push(`color:${textColor}`);
        annot.css.color = textColor;
      }
      const fontSize = px(textStyle.fontSize ?? 0, scale);
      if (fontSize) {
        props.push(`font-size:${fontSize}px`);
        annot.css["font-size"] = `${fontSize}px`;
      }
      const fontName = normalized?.fontName ?? "";
      if (fontName) {
        props.push(
          `font-family:"${fontName}","PingFang SC","Microsoft YaHei","Hiragino Sans GB",sans-serif`,
        );
        annot.css["font-family"] = fontName;
      }
      if (textStyle.fontWeight !== undefined) {
        const fontWeight = String(textStyle.fontWeight);
        props.push(`font-weight:${fontWeight}`);
        annot.css["font-weight"] = fontWeight;
      }
      if (textStyle.italic) {
        props.push("font-style:italic");
        annot.css["font-style"] = "italic";
      }
      const just = textStyle.alignment ?? "left";
      if (just !== "left") {
        props.push(`text-align:${just}`);
        annot.css["text-align"] = just;
      }
      const normalizedLineHeight = px(textStyle.lineHeight ?? 0, scale);
      const letterSpacing = px(textStyle.letterSpacing ?? 0, scale);
      if (letterSpacing) {
        props.push(`letter-spacing:${letterSpacing}px`);
        annot.css["letter-spacing"] = `${letterSpacing}px`;
      }
      const lines = textContent.split(/\r\n|\r|\n/).filter(Boolean);
      const lineCount = Math.max(lines.length, 1);
      if (normalizedLineHeight) {
        props.push(`line-height:${normalizedLineHeight}px`);
        annot.css["line-height"] = `${normalizedLineHeight}px`;
      } else if (lineCount > 1 && h > 0 && fontSize > 0) {
        const lh = Math.round((h / lineCount) * 10) / 10;
        props.push(`line-height:${lh}px`);
        annot.css["line-height"] = `${lh}px`;
      } else {
        props.push("line-height:1");
        annot.css["line-height"] = "1";
      }
      props.push("white-space:pre-wrap");
      props.push("overflow:hidden");
      props.push("word-break:break-all");
    } else if (isSlice) {
      props.push("z-index:5");
    } else {
      const fill = isRecord(L.fill) ? L.fill : {};
      const fillColor = colorCss(isRecord(fill.color) ? fill.color : null, opacity);
      if (fillColor) {
        annot.css["background-color"] = fillColor;
      }
    }

    if (renderHtml) {
      cssRules.push(`.${cls}{${props.join(";")}}`);

      const safeName = safeAttr(name);
      const cssData = Object.entries(annot.css)
        .map(([k, v]) => `${k}: ${v}`)
        .join("; ");
      const safeCss = safeAttr(cssData);

      if (textContent) {
        htmlParts.push(
          `<div class="${cls}" title="${safeName}" data-css="${safeCss}">${safeContent(textContent)}</div>`,
        );
      } else if (isSlice) {
        htmlParts.push(
          `<img class="${cls}" title="${safeName}" data-css="${safeCss}" src="${sliceUrl}" referrerpolicy="no-referrer" />`,
        );
      } else {
        htmlParts.push(`<div class="${cls}" title="${safeName}" data-css="${safeCss}"></div>`);
      }
    }

    layerAnnotations.push(annot);
  }

  const bgStyle = designImgUrl
    ? `;background:url(${designImgUrl}) no-repeat;background-size:${boardW}px ${boardH}px`
    : "";

  const html = renderHtml
    ? `<!DOCTYPE html><html><head><meta charset="UTF-8">` +
      `<meta name="referrer" content="no-referrer">` +
      `<meta name="viewport" content="width=device-width,initial-scale=1.0">` +
      `<title>Design</title><style>` +
      `*{margin:0;padding:0;box-sizing:border-box}img{display:block}` +
      `.design{position:relative;width:${boardW}px;height:${boardH}px;overflow:hidden;margin:0 auto${bgStyle}}\n` +
      cssRules.join("\n") +
      `</style></head><body><div class="design">\n` +
      htmlParts.join("\n") +
      `\n</div></body></html>`
    : "";

  return { html, imageUrlMapping, layerAnnotations, warnings };
}

export function extractSketchLayerAnalysis(
  sketchData: UnknownRecord,
  designScale = 2.0,
): SketchToHtmlResult {
  return analyzeSketch(sketchData, designScale, "", false);
}

export function extractSketchLayerAnnotations(
  sketchData: UnknownRecord,
  designScale = 2.0,
): LayerAnnotation[] {
  return extractSketchLayerAnalysis(sketchData, designScale).layerAnnotations;
}

export function convertSketchToHtml(
  sketchData: UnknownRecord,
  designScale = 2.0,
  designImgUrl = "",
): SketchToHtmlResult {
  return analyzeSketch(sketchData, designScale, designImgUrl);
}

export function convertSketchToHtmlMinified(
  sketchData: UnknownRecord,
  designScale = 2.0,
  designImgUrl = "",
): SketchToHtmlResult {
  const result = convertSketchToHtml(sketchData, designScale, designImgUrl);
  return { ...result, html: minifyHtml(result.html) };
}

export function inferDesignScale(deviceString: string): number {
  if (deviceString.includes("@3x")) return 3.0;
  if (deviceString.includes("@1x")) return 1.0;
  return 2.0;
}
