import {
  LanhuClient,
  parseLanhuUrl,
  pickNestedString,
} from "./client.js";
import {
  type LanhuDesignListResult,
  type LanhuDesignSchemaJsonResult,
  type LanhuDesignSummary,
  type LanhuDocumentInfo,
  type LanhuProjectImageInfo,
  type LanhuProjectImagesPayload,
  type LanhuProjectMultiInfoImage,
  type LanhuProjectMultiInfoPayload,
  type LanhuSketchJsonResult,
  type LanhuSliceInfo,
  type LanhuSliceMetadata,
  type LanhuSlicesResult,
  type LanhuUrlParams,
  type LanhuVersionInfo,
  type UnknownRecord,
} from "../shared/types.js";

const DETAIL_COVER_KEYS = [
  "XDCoverPNGORG",
  "XDCover",
  "url",
  "cb_src",
  "cover_url",
  "coverUrl",
  "imageUrl",
  "image_url",
] as const;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function asNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function asBoolean(value: unknown): boolean {
  return value === true || value === 1 || value === "1";
}

function isDetailDetachUrl(params: LanhuUrlParams): boolean {
  return params.route?.includes("detailDetach") ?? false;
}

function getLatestVersionInfo(documentInfo: LanhuDocumentInfo): LanhuVersionInfo | undefined {
  return Array.isArray(documentInfo.versions) ? documentInfo.versions[0] : undefined;
}

function getProjectName(value: UnknownRecord): string | undefined {
  return asString(value.project_name) ?? asString(value.projectName) ?? asString(value.name);
}

function pickDesignCoverUrl(documentInfo: LanhuDocumentInfo): string | undefined {
  return pickNestedString(documentInfo, DETAIL_COVER_KEYS, 2);
}

function mapProjectImageToDesignSummary(
  image: LanhuProjectImageInfo,
  index: number,
): LanhuDesignSummary {
  const designId = asString(image.id);
  if (!designId) {
    throw new Error(`Design item at index ${index} is missing id`);
  }

  return {
    index,
    id: designId,
    name: asString(image.name) ?? `design-${designId}`,
    width: asNumber(image.width),
    height: asNumber(image.height),
    url: asString(image.url),
    hasComment: asBoolean(image.has_comment),
    updateTime: asString(image.update_time),
    source: "projectImages",
    raw: image,
  };
}

function mapDetachedDesign(documentInfo: LanhuDocumentInfo, params: LanhuUrlParams): LanhuDesignSummary {
  const designId = asString(documentInfo.id) ?? params.docId ?? params.imageId;
  if (!designId) {
    throw new Error("Single design extraction failed: missing image id");
  }

  return {
    index: 1,
    id: designId,
    name: asString(documentInfo.name) ?? `design-${designId}`,
    width: asNumber(documentInfo.width),
    height: asNumber(documentInfo.height),
    url: pickDesignCoverUrl(documentInfo),
    hasComment: asBoolean(documentInfo.has_comment),
    updateTime: asString(documentInfo.update_time),
    source: "detailDetach",
    raw: documentInfo,
  };
}

function collectMetadata(node: UnknownRecord): LanhuSliceMetadata | undefined {
  const metadata: LanhuSliceMetadata = {};

  if (Array.isArray(node.fills)) {
    metadata.fills = node.fills;
  }

  if (Array.isArray(node.borders)) {
    metadata.borders = node.borders;
  } else if (Array.isArray(node.strokes)) {
    metadata.borders = node.strokes;
  }

  const opacity = asNumber(node.opacity);
  if (opacity !== undefined) {
    metadata.opacity = opacity;
  }

  const rotation = asNumber(node.rotation);
  if (rotation !== undefined) {
    metadata.rotation = rotation;
  }

  if (node.textStyle !== undefined) {
    metadata.text_style = node.textStyle;
  }

  if (Array.isArray(node.shadows)) {
    metadata.shadows = node.shadows;
  }

  if (node.radius !== undefined) {
    metadata.border_radius = node.radius;
  } else if (node.cornerRadius !== undefined) {
    metadata.border_radius = node.cornerRadius;
  }

  return Object.keys(metadata).length > 0 ? metadata : undefined;
}

function buildSliceInfo(
  node: UnknownRecord,
  currentName: string,
  currentPath: string,
  parentName: string,
  includeMetadata: boolean,
): LanhuSliceInfo | undefined {
  const imageData = isRecord(node.image) ? node.image : undefined;
  if (imageData) {
    const downloadUrl = asString(imageData.imageUrl) ?? asString(imageData.svgUrl);
    if (downloadUrl) {
      const frame = isRecord(node.frame) ? node.frame : isRecord(node.bounds) ? node.bounds : {};
      const width = asNumber(frame.width);
      const height = asNumber(frame.height);
      const x = asNumber(frame.x) ?? asNumber(frame.left) ?? 0;
      const y = asNumber(frame.y) ?? asNumber(frame.top) ?? 0;

      return {
        id: asString(node.id),
        name: currentName,
        type: asString(node.type) ?? asString(node.layerType) ?? "bitmap",
        downloadUrl,
        size: width !== undefined && height !== undefined ? `${Math.trunc(width)}x${Math.trunc(height)}` : "unknown",
        format: asString(imageData.imageUrl) ? "png" : "svg",
        position: { x: Math.trunc(x), y: Math.trunc(y) },
        parentName: parentName || undefined,
        layerPath: currentPath,
        ...(includeMetadata ? { metadata: collectMetadata(node) } : {}),
      };
    }
  }

  const legacyImage = isRecord(node.ddsImage) ? node.ddsImage : undefined;
  const downloadUrl = legacyImage ? asString(legacyImage.imageUrl) : undefined;
  if (!legacyImage || !downloadUrl) {
    return undefined;
  }

  const left = asNumber(node.left) ?? 0;
  const top = asNumber(node.top) ?? 0;
  return {
    id: asString(node.id),
    name: currentName,
    type: asString(node.type) ?? asString(node.ddsType),
    downloadUrl,
    size: asString(legacyImage.size) ?? "unknown",
    format: "png",
    position: { x: Math.trunc(left), y: Math.trunc(top) },
    parentName: parentName || undefined,
    layerPath: currentPath,
    ...(includeMetadata ? { metadata: collectMetadata(node) } : {}),
  };
}

function extractSlicesFromSketch(sketch: UnknownRecord, includeMetadata: boolean): LanhuSliceInfo[] {
  const slices: LanhuSliceInfo[] = [];
  const visited = new Set<unknown>();

  const walk = (node: unknown, parentName = "", layerPath = ""): void => {
    if (!isRecord(node) || visited.has(node)) {
      return;
    }
    visited.add(node);

    const currentName = asString(node.name) ?? "";
    const currentPath = layerPath ? `${layerPath}/${currentName}` : currentName;
    const sliceInfo = buildSliceInfo(node, currentName, currentPath, parentName, includeMetadata);
    if (sliceInfo) {
      slices.push(sliceInfo);
    }

    const layers = Array.isArray(node.layers) ? node.layers : [];
    for (const layer of layers) {
      walk(layer, currentName, currentPath);
    }

    for (const value of Object.values(node)) {
      if (isRecord(value)) {
        walk(value, parentName, layerPath);
      } else if (Array.isArray(value)) {
        for (const item of value) {
          if (isRecord(item)) {
            walk(item, parentName, layerPath);
          }
        }
      }
    }
  };

  const artboard = isRecord(sketch.artboard) ? sketch.artboard : undefined;
  if (artboard && Array.isArray(artboard.layers)) {
    for (const layer of artboard.layers) {
      walk(layer);
    }
    return slices;
  }

  const legacyRoot = Array.isArray(sketch.info) ? sketch.info : [];
  for (const item of legacyRoot) {
    walk(item);
  }

  return slices;
}

function requireVersionId(images: LanhuProjectMultiInfoImage[], imageId: string): string {
  for (const image of images) {
    if (asString(image.id) !== imageId) {
      continue;
    }

    const versionId = asString(image.latest_version);
    if (!versionId) {
      throw new Error(`Design ${imageId} is missing latest_version`);
    }

    return versionId;
  }

  throw new Error(`Unable to find design image_id=${imageId} in multi_info response`);
}

export async function listDesigns(
  client: LanhuClient,
  input: string | LanhuUrlParams,
): Promise<LanhuDesignListResult> {
  const params = typeof input === "string" ? parseLanhuUrl(input) : input;

  if (params.docId && isDetailDetachUrl(params)) {
    const documentInfo = await client.getDocumentInfo(params.projectId, params.docId);
    return {
      status: "success",
      projectName: getProjectName(documentInfo),
      totalDesigns: 1,
      designs: [mapDetachedDesign(documentInfo, params)],
      source: "detailDetach",
      params,
    };
  }

  const payload = await client.getLanhuPayload<LanhuProjectImagesPayload>("/api/project/images", {
    project_id: params.projectId,
    team_id: params.teamId,
    dds_status: 1,
    position: 1,
    show_cb_src: 1,
    comment: 1,
  });

  const images = Array.isArray(payload.images) ? payload.images : [];
  return {
    status: "success",
    projectName: asString(payload.name),
    totalDesigns: images.length,
    designs: images.map((image, index) => mapProjectImageToDesignSummary(image, index + 1)),
    source: "projectImages",
    params,
  };
}

export async function getDesignSchemaJson(
  client: LanhuClient,
  imageId: string,
  teamId: string,
  projectId: string,
): Promise<LanhuDesignSchemaJsonResult> {
  const multiInfo = await client.getProjectMultiInfo(projectId, teamId, {
    img_limit: 500,
    detach: 1,
  });
  const images = Array.isArray(multiInfo.images) ? multiInfo.images : [];
  const versionId = requireVersionId(images, imageId);
  const revision = await client.getDdsSchemaRevision(versionId);
  const schemaUrl = asString(revision.data_resource_url);

  if (!schemaUrl) {
    throw new Error("store_schema_revise did not return data_resource_url");
  }

  const schema = await client.getJson<UnknownRecord>(schemaUrl, { dds: true });
  if (!isRecord(schema)) {
    throw new Error("Schema JSON payload is not an object");
  }

  return {
    imageId,
    versionId,
    schemaUrl,
    schema,
  };
}

export async function getSketchJson(
  client: LanhuClient,
  imageId: string,
  teamId: string,
  projectId: string,
): Promise<LanhuSketchJsonResult> {
  const documentInfo = await client.getDesignDocument(imageId, teamId, projectId);
  const latestVersion = getLatestVersionInfo(documentInfo);
  const jsonUrl = asString(latestVersion?.json_url);

  if (!jsonUrl) {
    throw new Error(`Design ${imageId} is missing versions[0].json_url`);
  }

  const sketch = await client.getJson<UnknownRecord>(jsonUrl);
  if (!isRecord(sketch)) {
    throw new Error("Sketch JSON payload is not an object");
  }

  return {
    imageId,
    versionId: asString(latestVersion?.id),
    jsonUrl,
    documentInfo,
    sketch,
  };
}

export async function getSlices(
  client: LanhuClient,
  imageId: string,
  teamId: string,
  projectId: string,
  includeMetadata = true,
): Promise<LanhuSlicesResult> {
  const sketchResult = await getSketchJson(client, imageId, teamId, projectId);
  const latestVersion = getLatestVersionInfo(sketchResult.documentInfo);
  const slices = extractSlicesFromSketch(sketchResult.sketch, includeMetadata);

  return {
    designId: imageId,
    designName: asString(sketchResult.documentInfo.name) ?? `design-${imageId}`,
    version: asString(latestVersion?.version_info),
    canvasSize: {
      width: asNumber(sketchResult.documentInfo.width),
      height: asNumber(sketchResult.documentInfo.height),
    },
    totalSlices: slices.length,
    slices,
  };
}
