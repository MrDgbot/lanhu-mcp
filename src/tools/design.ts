import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod/v4";

import { config } from "../config.js";
import { LanhuClient, createLanhuFetch, parseLanhuUrl } from "../lanhu/client.js";
import { getDesignSchemaJson, getSketchJson, getSlices, listDesigns } from "../lanhu/designs.js";
import { mapConcurrent, withRetry } from "../shared/concurrency.js";
import { createToolResult } from "../shared/errors.js";
import { minifyHtml } from "../shared/html.js";
import type { JsonObject, LanhuDesignSummary, ToolContent } from "../shared/types.js";
import { extractDesignTokens, extractLayerTree } from "../transform/design-tokens.js";
import { extractLayoutSummary } from "../transform/layout-summary.js";
import { convertSchemaToHtml, localizeImageUrls } from "../transform/schema-to-html.js";
import { extractFullAnnotationsFromSketch } from "../transform/sketch-annotations.js";
import { convertSketchToHtml, inferDesignScale } from "../transform/sketch-to-html.js";
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

interface DesignHtmlResult {
  success: boolean;
  designName: string;
  htmlCode?: string;
  imageUrlMapping?: Record<string, string>;
  layoutSummary?: string;
  layerTree?: string;
  designTokens?: string;
  error?: string;
  sketchHtml?: string;
  sketchAnnotations?: string;
  layerCssAnnotations?: LayerAnnotation[];
}

const DEFAULT_INCLUDE = ["html", "tokens", "layers", "image"] as const;

type IncludeOption = "html" | "image" | "tokens" | "layout" | "layers" | "slices";

export function registerDesignTool(server: McpServer): void {
  server.registerTool(
    "lanhu_design",
    {
      description:
        "Unified Lanhu design tool. Supports listing, analyzing, extracting tokens, and getting slices.\n\n" +
        "Modes:\n" +
        "  - list: List all designs in the project\n" +
        "  - analyze: Full design analysis with HTML+CSS, tokens, layout (default)\n" +
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
      },
    },
    async ({ url, mode, design_names, include }) => {
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
        const cdnFetch = createLanhuFetch({
          cookie: config.lanhuCookie,
          ddsCookie: config.ddsCookie,
        });

        const content: ToolContent[] = [];
        const htmlResults: DesignHtmlResult[] = [];

        const processDesign = async (design: LanhuDesignSummary): Promise<{
          imageResult?: { success: boolean; designName: string; bytes?: number };
          htmlResult: DesignHtmlResult;
          imageContent?: ToolContent;
        }> => {
          let imageResult: { success: boolean; designName: string; bytes?: number } | undefined;
          let imageContent: ToolContent | undefined;

          // Download cover image (only if requested)
          if (includeSet.has("image") && design.url) {
            try {
              const response = await withRetry(() => cdnFetch(design.url!.split("?")[0]));
              if (response.ok) {
                const bytes = Buffer.from(await response.arrayBuffer());
                imageContent = {
                  type: "image",
                  data: bytes.toString("base64"),
                  mimeType: inferMimeType(design.url),
                };
                imageResult = { success: true, designName: design.name, bytes: bytes.length };
              } else {
                imageResult = { success: false, designName: design.name };
              }
            } catch {
              imageResult = { success: false, designName: design.name };
            }
          }

          // Schema -> HTML
          const htmlEntry: DesignHtmlResult = { success: false, designName: design.name };

          if (includeSet.has("html")) {
            try {
              if (design.source === "detailDetach") {
                throw new Error("Using Sketch JSON flow for detailDetach.");
              }
              if (!teamId) {
                throw new Error("team_id is required for HTML extraction; image preview is still available.");
              }
              const schemaResult = await getDesignSchemaJson(
                client, design.id, teamId, designsResult.params.projectId,
              );
              const rawHtml = convertSchemaToHtml(schemaResult.schema);
              const localized = localizeImageUrls(rawHtml);
              htmlEntry.success = true;
              htmlEntry.htmlCode = localized.htmlCode;
              htmlEntry.imageUrlMapping = localized.imageUrlMapping;
              if (includeSet.has("layout")) {
                htmlEntry.layoutSummary = extractLayoutSummary(schemaResult.schema);
              }
            } catch (error) {
              htmlEntry.error = error instanceof Error ? error.message : String(error);
            }
          }

          const needsSketch = includeSet.has("tokens") || includeSet.has("layers") || includeSet.has("html");
          if (needsSketch) {
            // Sketch JSON -> tokens / layers / fallback
            try {
              if (!teamId && design.source !== "detailDetach") {
                throw new Error("team_id is required for Sketch extraction; image preview is still available.");
              }
              const sketchResult = await withRetry(
                () => getSketchJson(client, design.id, teamId, designsResult.params.projectId),
              );
              const sketch = sketchResult.sketch;

              if (includeSet.has("tokens")) {
                htmlEntry.designTokens = extractDesignTokens(sketch);
              }
              if (includeSet.has("layers")) {
                htmlEntry.layerTree = extractLayerTree(sketch);
              }

              // Sketch fallback when schema failed
              if (!htmlEntry.success && includeSet.has("html")) {
                const deviceStr = String(sketch.device ?? "");
                const designScale = inferDesignScale(deviceStr);
                const designImgUrl = design.url?.split("?")[0] ?? "";
                const sketchConversion = convertSketchToHtml(sketch, designScale, designImgUrl);
                sketchConversion.imageUrlMapping["./assets/designs/design.png"] = designImgUrl;

                htmlEntry.sketchHtml = minifyHtml(sketchConversion.html);
                htmlEntry.imageUrlMapping = sketchConversion.imageUrlMapping;
                htmlEntry.layerCssAnnotations = sketchConversion.layerAnnotations;
                htmlEntry.sketchAnnotations = extractFullAnnotationsFromSketch(sketch, designScale);
              }
            } catch (sketchError) {
              // Sketch extraction is best-effort
              if (!htmlEntry.error) {
                htmlEntry.error = sketchError instanceof Error ? sketchError.message : String(sketchError);
              }
            }
          }

          return { imageResult, htmlResult: htmlEntry, imageContent };
        };

        // Process designs concurrently
        const results = await mapConcurrent(targetDesigns, processDesign, 5);

        for (const r of results) {
          if (r.status === "fulfilled") {
            if (r.value.imageContent) content.push(r.value.imageContent);
            htmlResults.push(r.value.htmlResult);
          } else {
            htmlResults.push({
              success: false,
              designName: "unknown",
              error: r.reason instanceof Error ? r.reason.message : String(r.reason),
            });
          }
        }

        // Build summary text
        const htmlSuccessCount = htmlResults.filter((r) => r.success || r.sketchHtml).length;
        const sketchFallbackCount = htmlResults.filter((r) => !r.success && r.sketchHtml).length;
        const summarySections: string[] = [];

        summarySections.push("Design Analysis Results");
        summarySections.push(`Project: ${designsResult.projectName ?? "Unknown"}`);
        if (includeSet.has("html")) {
          summarySections.push(`${htmlSuccessCount}/${htmlResults.length} HTML codes generated`);
          if (sketchFallbackCount > 0) {
            summarySections.push(`${sketchFallbackCount} design(s) using Sketch fallback`);
          }
        }
        summarySections.push("");

        for (let idx = 0; idx < htmlResults.length; idx++) {
          const hr = htmlResults[idx];
          summarySections.push(`\n--- ${hr.designName} ---`);

          if (hr.success && hr.htmlCode) {
            summarySections.push("```html");
            summarySections.push(hr.htmlCode);
            summarySections.push("```");

            if (hr.layoutSummary) {
              summarySections.push("\n--- Layout Summary ---");
              summarySections.push(hr.layoutSummary);
            }

            const mapping = hr.imageUrlMapping ?? {};
            if (Object.keys(mapping).length > 0) {
              summarySections.push(`\nImage assets (${Object.keys(mapping).length}):`);
              for (const [localPath, remoteUrl] of Object.entries(mapping)) {
                summarySections.push(`  ${localPath} <- ${remoteUrl}`);
              }
            }
          } else if (hr.sketchHtml || hr.sketchAnnotations) {
            const isSketchJsonFlow = hr.error?.includes("Sketch JSON flow");
            summarySections.push(
              isSketchJsonFlow
                ? "Using Sketch JSON flow for detailDetach."
                : `DDS Schema unavailable (${hr.error ?? "unknown"}), using Sketch fallback.`,
            );

            if (hr.sketchHtml) {
              summarySections.push("```html");
              summarySections.push(hr.sketchHtml);
              summarySections.push("```");
            }

            const fbMapping = hr.imageUrlMapping ?? {};
            if (Object.keys(fbMapping).length > 0) {
              summarySections.push(`\nImage assets (${Object.keys(fbMapping).length}):`);
              for (const [localPath, remoteUrl] of Object.entries(fbMapping)) {
                summarySections.push(`  ${localPath} <- ${remoteUrl}`);
              }
            }

            if (hr.layerCssAnnotations && hr.layerCssAnnotations.length > 0) {
              summarySections.push(`\nCSS annotations (${hr.layerCssAnnotations.length} layers):`);
              for (const la of hr.layerCssAnnotations) {
                const cssStr = Object.entries(la.css).map(([k, v]) => `${k}: ${v}`).join("; ");
                let line = `  [${la.type}] ${la.name}: ${cssStr}`;
                if (la.text) line += ` | text="${la.text.slice(0, 50)}"`;
                if (la.slice_url) line += ` | slice=${la.slice_url}`;
                summarySections.push(line);
              }
            }

            if (hr.sketchAnnotations) {
              summarySections.push("\n--- Sketch Annotations ---");
              summarySections.push(hr.sketchAnnotations);
            }
          } else {
            summarySections.push(`Failed: ${hr.error ?? "Unknown"}`);
          }

          if (hr.layerTree) {
            summarySections.push("\n--- Layer Structure ---");
            summarySections.push(hr.layerTree);
          }

          if (hr.designTokens) {
            summarySections.push("\n--- Design Tokens ---");
            summarySections.push(hr.designTokens);
          }
        }

        content.unshift({ type: "text", text: summarySections.join("\n").trim() });

        const structuredDesigns = htmlResults.map((hr) => ({
          name: hr.designName,
          success: hr.success || Boolean(hr.sketchHtml),
          html_code: hr.htmlCode ?? hr.sketchHtml ?? null,
          image_url_mapping: hr.imageUrlMapping ?? null,
          layout_summary: hr.layoutSummary ?? null,
          layer_tree: hr.layerTree ?? null,
          design_tokens: hr.designTokens ?? null,
          sketch_annotations: hr.sketchAnnotations ?? null,
          fallback_mode: hr.sketchHtml ? "sketch" : undefined,
        }));

        return {
          content,
          structuredContent: {
            status: "success",
            project_name: designsResult.projectName ?? null,
            total_designs: targetDesigns.length,
            designs: structuredDesigns,
          } as unknown as JsonObject,
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
