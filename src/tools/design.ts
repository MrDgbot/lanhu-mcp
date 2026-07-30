import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod/v4";

import { config } from "../config.js";
import { LanhuClient, createLanhuFetch, parseLanhuUrl } from "../lanhu/client.js";
import {
  createSlicesResultFromSketch,
  getDesignSchemaJson,
  getSketchJson,
  getSlices,
  listDesigns,
} from "../lanhu/designs.js";
import { mapConcurrent, withRetry } from "../shared/concurrency.js";
import { createToolResult } from "../shared/errors.js";
import { minifyHtml } from "../shared/html.js";
import type {
  JsonObject,
  LanhuDesignSummary,
  LanhuSketchJsonResult,
  LanhuSlicesResult,
  ToolContent,
  UnknownRecord,
} from "../shared/types.js";
import {
  extractDesignTokens,
  extractDesignTokensResult,
  extractLayerTreeResult,
  type LayerDepth,
} from "../transform/design-tokens.js";
import { extractLayoutSummary, extractSketchLayoutSummary } from "../transform/layout-summary.js";
import { convertSchemaToHtml, localizeImageUrls } from "../transform/schema-to-html.js";
import { extractFullAnnotationsFromSketch } from "../transform/sketch-annotations.js";
import {
  convertSketchToHtml,
  extractSketchLayerAnalysis,
  inferDesignScale,
} from "../transform/sketch-to-html.js";
import type { LayerAnnotation } from "../transform/sketch-to-html.js";

function inferMimeType(url: string): string {
  const lower = url.toLowerCase();
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".gif")) return "image/gif";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".svg")) return "image/svg+xml";
  return "image/png";
}

function normalizeDesignNames(designNames: string | string[]): string[] {
  return Array.isArray(designNames) ? designNames.map(String) : [String(designNames)];
}

export function pickTargetDesigns(
  designs: LanhuDesignSummary[],
  parsedUrl: ReturnType<typeof parseLanhuUrl>,
  designNames: string | string[],
) {
  if (typeof designNames === "string" && designNames.toLowerCase() === "all") {
    return designs;
  }

  const requested = normalizeDesignNames(designNames);
  const selected: LanhuDesignSummary[] = [];
  const seen = new Set<string>();

  for (const name of requested) {
    const trimmed = name.trim();
    const lower = trimmed.toLowerCase();
    const target = /^\d+$/.test(trimmed)
      ? designs.find((d) => d.index === Number(trimmed))
      : designs.find((d) => d.id.toLowerCase() === lower) ??
        designs.find((d) => d.name === trimmed);
    if (target && !seen.has(target.id)) {
      seen.add(target.id);
      selected.push(target);
    }
  }

  if (selected.length === 0 && parsedUrl.docId) {
    const docIdLower = parsedUrl.docId.toLowerCase();
    const byImageId = designs.find((d) => d.id.toLowerCase() === docIdLower);
    if (byImageId) selected.push(byImageId);
  }

  return selected;
}

type IncludeOption = "html" | "image" | "tokens" | "layout" | "layers" | "slices";

type AnalysisStatus = "success" | "partial_success" | "error";

interface DesignAnalysisResult {
  designName: string;
  succeededOutputs: Set<IncludeOption>;
  degradedOutputs: Set<IncludeOption>;
  errors: Partial<Record<IncludeOption, string>>;
  warnings: Partial<Record<IncludeOption, string>>;
  htmlCode?: string;
  htmlSource?: "schema" | "sketch";
  imageUrlMapping?: Record<string, string>;
  imageBytes?: number;
  layoutSummary?: string;
  layoutSource?: "schema" | "sketch";
  layerTree?: string;
  layerTreeTruncated?: boolean;
  layerDepth?: LayerDepth;
  designTokens?: string;
  sketchAnnotations?: string;
  layerCssAnnotations?: LayerAnnotation[];
  slices?: LanhuSlicesResult;
}

const DEFAULT_INCLUDE = ["html", "tokens", "layers", "image"] as const;

function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  const message = String(error).trim();
  return message && message !== "[object Object]"
    ? message
    : "Operation failed without an error message.";
}

function combineFallbackErrors(primary: string | undefined, fallback: string): string {
  return primary ? `DDS Schema: ${primary}; Sketch fallback: ${fallback}` : fallback;
}

function getAnalysisStatus(
  result: Pick<DesignAnalysisResult, "succeededOutputs" | "degradedOutputs">,
  requestedOutputs: ReadonlySet<IncludeOption>,
): AnalysisStatus {
  const succeeded = [...requestedOutputs].filter((output) => result.succeededOutputs.has(output)).length;
  const degraded = [...requestedOutputs].some((output) => result.degradedOutputs.has(output));
  if (succeeded === requestedOutputs.size && !degraded) return "success";
  return succeeded > 0 ? "partial_success" : "error";
}

export function registerDesignTool(server: McpServer): void {
  server.registerTool(
    "lanhu_design",
    {
      description:
        "Unified Lanhu design tool. Supports listing, analyzing, extracting tokens, and getting slices.\n\n" +
        "Modes:\n" +
        "  - list: List all designs in the project\n" +
        "  - analyze: Full design analysis with HTML+CSS, tokens, layers, and image (default)\n" +
        "  - slices: Extract slice/asset info for download\n" +
        "  - tokens: Extract design tokens only (fonts, colors, shadows, etc.)\n\n" +
        "For detailDetach URLs (contains image_id), pass design_names='all'.",
      inputSchema: {
        url: z.string().min(1).describe(
          "Lanhu project URL. Supports stage and detailDetach formats.",
        ),
        mode: z.enum(["list", "analyze", "slices", "tokens"]).default("analyze").describe(
          "Operation mode. Default: analyze.",
        ),
        design_names: z.union([z.string(), z.array(z.string())]).optional().describe(
          "Design name(s), index, or 'all'. Required for analyze/slices/tokens. " +
          "Number = index from list, exact string = match by name or id.",
        ),
        include: z.array(z.enum(["html", "image", "tokens", "layout", "layers", "slices"])).optional().describe(
          "Content to include in analyze mode. Default: ['html', 'tokens', 'layers', 'image']. " +
          "Options: html, image (base64), tokens, layout, layers, slices.",
        ),
        layer_depth: z.union([z.number().int().min(0), z.literal("all")]).optional().describe(
          "Maximum nested layer depth for analyze mode. 0 returns top-level layers only; " +
          "use 'all' for the complete tree. Default: 4.",
        ),
      },
    },
    async ({ url, mode, design_names, include, layer_depth }) => {
      try {
        const client = new LanhuClient({
          cookie: config.lanhuCookie,
          ddsCookie: config.ddsCookie,
        });
        const parsed = parseLanhuUrl(url);
        const designsResult = await listDesigns(client, url);

        // === LIST MODE ===
        if (mode === "list") {
          return createToolResult(
            `Loaded ${designsResult.totalDesigns} design(s)${designsResult.projectName ? ` from ${designsResult.projectName}` : ""}.`,
            designsResult as unknown as JsonObject,
          );
        }

        // All other modes require design_names
        if (!design_names) {
          return createToolResult(
            "design_names is required for analyze/slices/tokens mode.",
            { status: "error", hint: "Pass design_names='all' or a specific name/index." },
            true,
          );
        }

        const targetDesigns = pickTargetDesigns(designsResult.designs, parsed, design_names);
        if (targetDesigns.length === 0) {
          return createToolResult(
            "No matching design found.",
            {
              status: "error",
              available_designs: designsResult.designs.map((d) => d.name),
            } as unknown as JsonObject,
            true,
          );
        }
        const teamId = designsResult.params.teamId;

        // === SLICES MODE ===
        if (mode === "slices") {
          if (!teamId && targetDesigns[0].source !== "detailDetach") {
            return createToolResult(
              "team_id is required for slices mode.",
              { status: "error", hint: "Use a Lanhu URL that includes tid/team_id." },
              true,
            );
          }
          const target = targetDesigns[0];
          const slicesResult = await getSlices(
            client,
            target.id,
            teamId,
            designsResult.params.projectId,
            true,
          );
          return createToolResult(
            `Loaded ${slicesResult.totalSlices} slice(s) for ${target.name}.`,
            slicesResult as unknown as JsonObject,
          );
        }

        // === TOKENS MODE ===
        if (mode === "tokens") {
          if (!teamId && targetDesigns.some((design) => design.source !== "detailDetach")) {
            return createToolResult(
              "team_id is required for tokens mode.",
              { status: "error", hint: "Use a Lanhu URL that includes tid/team_id." },
              true,
            );
          }
          const tokenResults = await mapConcurrent(
            targetDesigns,
            async (design) => {
              const sketchResult = await withRetry(
                () => getSketchJson(client, design.id, teamId, designsResult.params.projectId),
              );
              return {
                name: design.name,
                tokens: extractDesignTokens(sketchResult.sketch),
              };
            },
            5,
          );

          const sections: string[] = [];
          for (let i = 0; i < tokenResults.length; i++) {
            const r = tokenResults[i];
            if (r.status === "fulfilled") {
              sections.push(`--- ${r.value.name} ---`);
              sections.push(r.value.tokens || "(no tokens found)");
              sections.push("");
            } else {
              sections.push(`--- ${targetDesigns[i].name} ---`);
              sections.push(`Error: ${r.reason instanceof Error ? r.reason.message : String(r.reason)}`);
              sections.push("");
            }
          }
          return createToolResult(sections.join("\n").trim(), { status: "success" });
        }

        // === ANALYZE MODE ===
        const includeSet = new Set<IncludeOption>(
          (include as IncludeOption[] | undefined) ?? [...DEFAULT_INCLUDE],
        );
        const requestedLayerDepth = (layer_depth ?? 4) as LayerDepth;
        const cdnFetch = createLanhuFetch({
          cookie: config.lanhuCookie,
          ddsCookie: config.ddsCookie,
        });

        const content: ToolContent[] = [];
        const analysisResults: DesignAnalysisResult[] = [];

        const processDesign = async (design: LanhuDesignSummary): Promise<{
          analysisResult: DesignAnalysisResult;
          imageContent?: ToolContent;
        }> => {
          const analysisResult: DesignAnalysisResult = {
            designName: design.name,
            succeededOutputs: new Set<IncludeOption>(),
            degradedOutputs: new Set<IncludeOption>(),
            errors: {},
            warnings: {},
          };
          let imageContent: ToolContent | undefined;
          const markSuccess = (output: IncludeOption): void => {
            analysisResult.succeededOutputs.add(output);
            delete analysisResult.errors[output];
          };
          const markError = (output: IncludeOption, message: string): void => {
            if (!analysisResult.succeededOutputs.has(output)) {
              analysisResult.errors[output] = message;
            }
          };
          const addWarning = (output: IncludeOption, message: string): void => {
            const current = analysisResult.warnings[output];
            analysisResult.warnings[output] = current ? `${current} ${message}` : message;
          };
          const addTextWarnings = (output: IncludeOption, warnings: string[]): void => {
            if (warnings.length > 0) {
              addWarning(output, `Sketch text warnings: ${warnings.join(" ")}`);
              analysisResult.degradedOutputs.add(output);
            }
          };

          // Download cover image (only if requested)
          if (includeSet.has("image")) {
            if (!design.url) {
              markError("image", "Design image URL is unavailable.");
            } else {
              const designUrl = design.url;
              try {
                const response = await withRetry(() => cdnFetch(designUrl.split("?")[0]));
                if (!response.ok) {
                  throw new Error(`Image download failed with HTTP ${response.status}.`);
                }
                const bytes = Buffer.from(await response.arrayBuffer());
                imageContent = {
                  type: "image",
                  data: bytes.toString("base64"),
                  mimeType: inferMimeType(designUrl),
                };
                analysisResult.imageBytes = bytes.length;
                markSuccess("image");
              } catch (error) {
                markError("image", errorMessage(error));
              }
            }
          }

          const needsSchema = includeSet.has("html") || includeSet.has("layout");
          let schema: UnknownRecord | undefined;
          let schemaError: string | undefined;
          if (needsSchema) {
            if (design.source === "detailDetach") {
              schemaError = "DDS Schema is unavailable for detailDetach designs.";
            } else if (!teamId) {
              schemaError = "team_id is required for DDS Schema extraction.";
            } else {
              try {
                const schemaResult = await getDesignSchemaJson(
                  client, design.id, teamId, designsResult.params.projectId,
                );
                schema = schemaResult.schema;
              } catch (error) {
                schemaError = errorMessage(error);
              }
            }
          }

          if (includeSet.has("html")) {
            if (schema) {
              try {
                const rawHtml = convertSchemaToHtml(schema);
                const localized = localizeImageUrls(rawHtml);
                analysisResult.htmlCode = localized.htmlCode;
                analysisResult.htmlSource = "schema";
                analysisResult.imageUrlMapping = localized.imageUrlMapping;
                markSuccess("html");
              } catch (error) {
                markError("html", errorMessage(error));
              }
            } else {
              markError("html", schemaError ?? "DDS Schema extraction produced no data.");
            }
          }

          if (includeSet.has("layout")) {
            if (schema) {
              try {
                analysisResult.layoutSummary = extractLayoutSummary(schema);
                analysisResult.layoutSource = "schema";
                markSuccess("layout");
              } catch (error) {
                markError("layout", errorMessage(error));
              }
            } else {
              markError("layout", schemaError ?? "DDS Schema extraction produced no data.");
            }
          }

          const needsSketch = includeSet.has("tokens") ||
            includeSet.has("layers") ||
            includeSet.has("slices") ||
            (includeSet.has("html") && !analysisResult.succeededOutputs.has("html")) ||
            (includeSet.has("layout") && !analysisResult.succeededOutputs.has("layout"));

          let loadedSketchResult: LanhuSketchJsonResult | undefined;
          let sketch: UnknownRecord | undefined;
          let sketchError: string | undefined;
          if (needsSketch) {
            if (!teamId && design.source !== "detailDetach") {
              sketchError = "team_id is required for Sketch extraction.";
            } else {
              try {
                loadedSketchResult = await withRetry(
                  () => getSketchJson(client, design.id, teamId, designsResult.params.projectId),
                );
                sketch = loadedSketchResult.sketch;
              } catch (error) {
                sketchError = errorMessage(error);
              }
            }
          }
          if (needsSketch && !sketch && !sketchError) {
            sketchError = "Sketch extraction produced no data.";
          }

          if (sketch) {
            const designScale = inferDesignScale(String(sketch.device ?? ""));
            const designImgUrl = design.url?.split("?")[0] ?? "";
            let sketchConversion: ReturnType<typeof convertSketchToHtml> | undefined;
            let sketchLayerAnalysis: ReturnType<typeof extractSketchLayerAnalysis> | undefined;
            const getSketchConversion = (): ReturnType<typeof convertSketchToHtml> => {
              sketchConversion ??= convertSketchToHtml(sketch, designScale, designImgUrl);
              return sketchConversion;
            };
            const getLayerAnalysis = (): ReturnType<typeof extractSketchLayerAnalysis> => {
              if (sketchConversion) return sketchConversion;
              sketchLayerAnalysis ??= extractSketchLayerAnalysis(sketch, designScale);
              return sketchLayerAnalysis;
            };
            const getLayerAnnotations = (): LayerAnnotation[] => {
              return getLayerAnalysis().layerAnnotations;
            };

            if (includeSet.has("tokens")) {
              try {
                const tokenResult = extractDesignTokensResult(sketch);
                analysisResult.designTokens = tokenResult.tokens;
                markSuccess("tokens");
                addTextWarnings("tokens", tokenResult.warnings);
              } catch (error) {
                markError("tokens", errorMessage(error));
              }
            }

            if (includeSet.has("html") && !analysisResult.succeededOutputs.has("html")) {
              const fallbackReason = analysisResult.errors.html;
              try {
                const conversion = getSketchConversion();
                analysisResult.htmlCode = minifyHtml(conversion.html);
                analysisResult.htmlSource = "sketch";
                analysisResult.imageUrlMapping = conversion.imageUrlMapping;
                analysisResult.layerCssAnnotations = conversion.layerAnnotations;
                analysisResult.sketchAnnotations = extractFullAnnotationsFromSketch(sketch, designScale);
                if (designImgUrl) {
                  analysisResult.imageUrlMapping["./assets/designs/design.png"] = designImgUrl;
                }
                markSuccess("html");
                if (fallbackReason) {
                  addWarning("html", `DDS Schema failed: ${fallbackReason}; used Sketch fallback.`);
                }
                addTextWarnings("html", conversion.warnings);
              } catch (error) {
                markError(
                  "html",
                  combineFallbackErrors(analysisResult.errors.html, errorMessage(error)),
                );
              }
            }

            if (includeSet.has("layers")) {
              try {
                const layerTree = extractLayerTreeResult(sketch, requestedLayerDepth);
                analysisResult.layerTree = layerTree.tree;
                analysisResult.layerTreeTruncated = layerTree.truncated;
                analysisResult.layerDepth = layerTree.depth;
                analysisResult.layerCssAnnotations = getLayerAnnotations();
                analysisResult.sketchAnnotations = extractFullAnnotationsFromSketch(sketch, designScale);
                markSuccess("layers");
                addTextWarnings("layers", getLayerAnalysis().warnings);
              } catch (error) {
                markError("layers", errorMessage(error));
              }
            }

            if (includeSet.has("layout") && !analysisResult.succeededOutputs.has("layout")) {
              const fallbackReason = analysisResult.errors.layout;
              try {
                const layerAnalysis = getLayerAnalysis();
                analysisResult.layoutSummary = extractSketchLayoutSummary(layerAnalysis.layerAnnotations);
                analysisResult.layoutSource = "sketch";
                markSuccess("layout");
                if (fallbackReason) {
                  addWarning("layout", `DDS Schema failed: ${fallbackReason}; used Sketch fallback.`);
                }
                addTextWarnings("layout", layerAnalysis.warnings);
              } catch (error) {
                markError(
                  "layout",
                  combineFallbackErrors(analysisResult.errors.layout, errorMessage(error)),
                );
              }
            }
          } else if (sketchError) {
            if (includeSet.has("tokens")) {
              markError("tokens", sketchError);
            }
            if (includeSet.has("layers")) {
              markError("layers", sketchError);
            }
            if (includeSet.has("slices")) {
              markError("slices", sketchError);
            }
            if (includeSet.has("layout") && !analysisResult.succeededOutputs.has("layout")) {
              markError("layout", combineFallbackErrors(analysisResult.errors.layout, sketchError));
            }
            if (includeSet.has("html") && !analysisResult.succeededOutputs.has("html")) {
              markError("html", combineFallbackErrors(analysisResult.errors.html, sketchError));
            }
          }

          if (includeSet.has("slices") && loadedSketchResult) {
            try {
              analysisResult.slices = createSlicesResultFromSketch(loadedSketchResult, true);
              markSuccess("slices");
            } catch (error) {
              markError("slices", errorMessage(error));
            }
          }

          return { analysisResult, imageContent };
        };

        // Process designs concurrently
        const results = await mapConcurrent(targetDesigns, processDesign, 5);

        for (let index = 0; index < results.length; index++) {
          const r = results[index];
          if (r.status === "fulfilled") {
            if (r.value.imageContent) content.push(r.value.imageContent);
            analysisResults.push(r.value.analysisResult);
          } else {
            const message = errorMessage(r.reason);
            analysisResults.push({
              designName: targetDesigns[index]?.name ?? "Unnamed design",
              succeededOutputs: new Set<IncludeOption>(),
              degradedOutputs: new Set<IncludeOption>(),
              warnings: {},
              errors: Object.fromEntries(
                [...includeSet].map((output) => [output, `Design processing failed: ${message}`]),
              ),
            });
          }
        }

        // Build summary text
        const totalRequestedOutputs = analysisResults.length * includeSet.size;
        const totalSucceededOutputs = analysisResults.reduce(
          (sum, result) => sum + result.succeededOutputs.size,
          0,
        );
        const hasDegradedOutput = analysisResults.some((result) => result.degradedOutputs.size > 0);
        const overallStatus: AnalysisStatus =
          totalSucceededOutputs === totalRequestedOutputs && !hasDegradedOutput
          ? "success"
          : totalSucceededOutputs > 0
            ? "partial_success"
            : "error";
        const htmlSuccessCount = analysisResults.filter((result) =>
          result.succeededOutputs.has("html")
        ).length;
        const sketchFallbackCount = analysisResults.filter((result) =>
          result.htmlSource === "sketch"
        ).length;
        const summarySections: string[] = [];

        summarySections.push("Design Analysis Results");
        summarySections.push(`Project: ${designsResult.projectName ?? "Unknown"}`);
        summarySections.push(`Status: ${overallStatus}`);
        if (includeSet.has("html")) {
          summarySections.push(`${htmlSuccessCount}/${analysisResults.length} HTML codes generated`);
          if (sketchFallbackCount > 0) {
            summarySections.push(`${sketchFallbackCount} design(s) using Sketch fallback`);
          }
        }
        summarySections.push("");

        for (const result of analysisResults) {
          const designStatus = getAnalysisStatus(result, includeSet);
          summarySections.push(`\n--- ${result.designName} ---`);
          summarySections.push(`Status: ${designStatus}`);

          if (includeSet.has("html")) {
            if (result.succeededOutputs.has("html")) {
              if (result.htmlSource === "sketch") {
                summarySections.push(
                  result.warnings.html
                    ? `Using Sketch fallback for HTML. ${result.warnings.html}`
                    : "Using Sketch fallback for HTML.",
                );
              }
              summarySections.push("```html");
              summarySections.push(result.htmlCode ?? "");
              summarySections.push("```");
              const mapping = result.imageUrlMapping ?? {};
              if (Object.keys(mapping).length > 0) {
                summarySections.push(`\nImage assets (${Object.keys(mapping).length}):`);
                for (const [localPath, remoteUrl] of Object.entries(mapping)) {
                  summarySections.push(`  ${localPath} <- ${remoteUrl}`);
                }
              }
            } else {
              summarySections.push(`HTML failed: ${result.errors.html}`);
            }
          }

          if (includeSet.has("layout")) {
            if (result.succeededOutputs.has("layout")) {
              summarySections.push(`\n--- Layout Summary (${result.layoutSource}) ---`);
              summarySections.push(result.layoutSummary || "(no layout entries found)");
              if (result.warnings.layout) {
                summarySections.push(`Layout warning: ${result.warnings.layout}`);
              }
            } else {
              summarySections.push(`Layout failed: ${result.errors.layout}`);
            }
          }

          if (includeSet.has("layers")) {
            if (result.succeededOutputs.has("layers")) {
              summarySections.push("\n--- Layer Structure ---");
              summarySections.push(result.layerTree || "(no layers found)");
              if (result.layerCssAnnotations && result.layerCssAnnotations.length > 0) {
                summarySections.push(`\nCSS annotations (${result.layerCssAnnotations.length} layers):`);
                for (const annotation of result.layerCssAnnotations) {
                  const css = Object.entries(annotation.css)
                    .map(([property, value]) => `${property}: ${value}`)
                    .join("; ");
                  let line = `  [${annotation.type}] ${annotation.name}: ${css}`;
                  if (annotation.text) line += ` | text="${annotation.text.slice(0, 50)}"`;
                  if (annotation.slice_url) line += ` | slice=${annotation.slice_url}`;
                  summarySections.push(line);
                }
              }
              if (result.sketchAnnotations) {
                summarySections.push("\n--- Sketch Annotations ---");
                summarySections.push(result.sketchAnnotations);
              }
              if (result.warnings.layers) {
                summarySections.push(`Layers warning: ${result.warnings.layers}`);
              }
            } else {
              summarySections.push(`Layers failed: ${result.errors.layers}`);
            }
          }

          if (includeSet.has("tokens")) {
            if (result.succeededOutputs.has("tokens")) {
              summarySections.push("\n--- Design Tokens ---");
              summarySections.push(result.designTokens || "(no tokens found)");
              if (result.warnings.tokens) {
                summarySections.push(`Tokens warning: ${result.warnings.tokens}`);
              }
            } else {
              summarySections.push(`Tokens failed: ${result.errors.tokens}`);
            }
          }

          if (includeSet.has("image")) {
            if (result.succeededOutputs.has("image")) {
              summarySections.push(`Image downloaded: ${result.imageBytes ?? 0} bytes`);
            } else {
              summarySections.push(`Image failed: ${result.errors.image}`);
            }
          }

          if (includeSet.has("slices")) {
            if (result.succeededOutputs.has("slices")) {
              summarySections.push(`Slices extracted: ${result.slices?.totalSlices ?? 0}`);
            } else {
              summarySections.push(`Slices failed: ${result.errors.slices}`);
            }
          }
        }

        content.unshift({ type: "text", text: summarySections.join("\n").trim() });

        const structuredDesigns = analysisResults.map((result) => {
          const status = getAnalysisStatus(result, includeSet);
          return {
            name: result.designName,
            status,
            success: status === "success",
            outputs: Object.fromEntries([...includeSet].map((output) => [
              output,
              result.succeededOutputs.has(output)
                ? {
                    status: result.degradedOutputs.has(output) ? "partial_success" : "success",
                    ...(result.warnings[output] ? { warning: result.warnings[output] } : {}),
                  }
                : { status: "error", error: result.errors[output] },
            ])),
            errors: result.errors,
            warnings: result.warnings,
            html_code: result.htmlCode ?? null,
            html_source: result.htmlSource ?? null,
            image_url_mapping: result.imageUrlMapping ?? null,
            image_bytes: result.imageBytes ?? null,
            layout_summary: result.layoutSummary ?? null,
            layout_source: result.layoutSource ?? null,
            layer_tree: result.layerTree ?? null,
            layer_tree_truncated: result.layerTreeTruncated ?? null,
            layer_depth: result.layerDepth ?? null,
            layer_annotations: result.layerCssAnnotations ?? null,
            design_tokens: result.designTokens ?? null,
            sketch_annotations: result.sketchAnnotations ?? null,
            slices: result.slices ?? null,
            fallback_mode: result.htmlSource === "sketch" ? "sketch" : null,
          };
        });

        return {
          content,
          structuredContent: {
            status: overallStatus,
            project_name: designsResult.projectName ?? null,
            total_designs: targetDesigns.length,
            designs: structuredDesigns,
          } as unknown as JsonObject,
          ...(overallStatus === "error" ? { isError: true } : {}),
        };
      } catch (error) {
        return createToolResult(
          `Failed: ${error instanceof Error ? error.message : String(error)}`,
          { status: "error", url },
          true,
        );
      }
    },
  );
}
