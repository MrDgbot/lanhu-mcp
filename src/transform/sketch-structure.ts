import type { UnknownRecord } from "../shared/types.js";

export type SketchStructureKind = "board" | "artboard" | "info";

export interface SketchLayerFrame {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface SketchStructure {
  kind: SketchStructureKind;
  name: string;
  width: number;
  height: number;
  layers: UnknownRecord[];
}

export function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function firstNumber(...values: unknown[]): number | undefined {
  for (const value of values) {
    const number = asNumber(value);
    if (number !== undefined) return number;
  }
  return undefined;
}

function firstPositiveNumber(...values: unknown[]): number | undefined {
  for (const value of values) {
    const number = asNumber(value);
    if (number !== undefined && number > 0) return number;
  }
  return undefined;
}

function parseImageSize(layer: UnknownRecord): { width?: number; height?: number } {
  const image = isRecord(layer.ddsImage)
    ? layer.ddsImage
    : isRecord(layer.image)
      ? layer.image
      : {};
  const size = asString(image.size);
  const match = size?.match(/^\s*(\d+(?:\.\d+)?)\s*[xXx]\s*(\d+(?:\.\d+)?)\s*$/);
  return match ? { width: Number(match[1]), height: Number(match[2]) } : {};
}

export function getSketchLayerFrame(layer: UnknownRecord): SketchLayerFrame {
  const frames = [layer.ddsOriginFrame, layer.layerOriginFrame, layer.frame, layer.bounds]
    .filter(isRecord);
  const imageSize = parseImageSize(layer);
  return {
    x: firstNumber(...frames.flatMap((frame) => [frame.x, frame.left]), layer.left) ?? 0,
    y: firstNumber(...frames.flatMap((frame) => [frame.y, frame.top]), layer.top) ?? 0,
    width: firstNumber(...frames.map((frame) => frame.width), layer.width, imageSize.width) ?? 0,
    height: firstNumber(...frames.map((frame) => frame.height), layer.height, imageSize.height) ?? 0,
  };
}

export function getSketchLayerType(layer: UnknownRecord): string {
  const raw = asString(layer.type) ?? asString(layer.ddsType) ?? asString(layer.layerType) ?? "?";
  const normalized = raw.toLowerCase();
  if (normalized.includes("text")) return "textLayer";
  if (normalized.includes("shape")) return "shapeLayer";
  if (normalized.includes("bitmap")) return "bitmapLayer";
  if (normalized === "image" || normalized === "imagelayer") return "layer";
  if (normalized.includes("group")) return "groupLayer";
  return raw;
}

export function isSketchLayerVisible(layer: UnknownRecord): boolean {
  return layer.visible !== false && layer.isVisible !== false;
}

export function hasVisibleSketchLayerData(layers: UnknownRecord[]): boolean {
  const visited = new Set<UnknownRecord>();
  const walk = (layer: UnknownRecord): boolean => {
    if (visited.has(layer) || !isSketchLayerVisible(layer)) return false;
    visited.add(layer);
    return true;
  };
  return layers.some(walk);
}

function inferCanvasSize(layers: UnknownRecord[]): { width: number; height: number } {
  let minX = 0;
  let minY = 0;
  let maxX = 0;
  let maxY = 0;
  const visited = new Set<UnknownRecord>();

  const walk = (layer: UnknownRecord): void => {
    if (visited.has(layer) || !isSketchLayerVisible(layer)) return;
    visited.add(layer);
    const frame = getSketchLayerFrame(layer);
    if (frame.width > 0 || frame.height > 0) {
      minX = Math.min(minX, frame.x);
      minY = Math.min(minY, frame.y);
      maxX = Math.max(maxX, frame.x + frame.width);
      maxY = Math.max(maxY, frame.y + frame.height);
    }
    const children = Array.isArray(layer.layers) ? layer.layers.filter(isRecord) : [];
    for (const child of children) walk(child);
  };

  for (const layer of layers) walk(layer);
  return { width: maxX - minX, height: maxY - minY };
}

function createStructure(
  kind: SketchStructureKind,
  sketch: UnknownRecord,
  root: UnknownRecord,
  layersValue: unknown[],
): SketchStructure {
  const layers = layersValue.filter(isRecord);
  if (layersValue.length > 0 && layers.length === 0) {
    throw new Error(`Unsupported Sketch ${kind} structure: layer entries must be objects.`);
  }
  const inferred = inferCanvasSize(layers);
  const frame = getSketchLayerFrame(root);
  const width = firstPositiveNumber(root.width, frame.width, sketch.width, sketch.canvasWidth) ?? inferred.width;
  const height = firstPositiveNumber(root.height, frame.height, sketch.height, sketch.canvasHeight) ?? inferred.height;
  const name = asString(root.name) ?? asString(sketch.psdName) ?? asString(sketch.name) ?? "Untitled";
  return { kind, name, width, height, layers };
}

export function resolveSketchStructure(sketch: UnknownRecord): SketchStructure {
  const board = isRecord(sketch.board) ? sketch.board : undefined;
  const artboard = isRecord(sketch.artboard) ? sketch.artboard : undefined;
  const boardLayers = board && Array.isArray(board.layers) ? board.layers : undefined;
  const artboardLayers = artboard && Array.isArray(artboard.layers) ? artboard.layers : undefined;
  const infoLayers = Array.isArray(sketch.info) ? sketch.info : undefined;

  if (board && boardLayers && boardLayers.length > 0) {
    return createStructure("board", sketch, board, boardLayers);
  }
  if (artboard && artboardLayers && artboardLayers.length > 0) {
    return createStructure("artboard", sketch, artboard, artboardLayers);
  }
  if (infoLayers && infoLayers.length > 0) {
    return createStructure("info", sketch, sketch, infoLayers);
  }

  if (board && boardLayers) return createStructure("board", sketch, board, boardLayers);
  if (artboard && artboardLayers) {
    return createStructure("artboard", sketch, artboard, artboardLayers);
  }
  if (infoLayers) return createStructure("info", sketch, sketch, infoLayers);

  const malformedRoot = board
    ? "board.layers must be an array"
    : artboard
      ? "artboard.layers must be an array"
      : "expected board.layers, artboard.layers, or info array";
  throw new Error(`Unsupported Sketch structure: ${malformedRoot}.`);
}
