import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod/v4";

import { config } from "../config.js";
import { LanhuClient, createLanhuFetch, parseLanhuUrl } from "../lanhu/client.js";
import { getDesignSchemaJson, getSketchJson, listDesigns } from "../lanhu/designs.js";
import { createToolResult } from "../shared/errors.js";
import { minifyHtml } from "../shared/html.js";
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
  designs: Awaited<ReturnType<typeof listDesigns>>["designs"],
  parsedUrl: ReturnType<typeof parseLanhuUrl>,
  designNames: string | string[],
) {
  if (typeof designNames === "string" && designNames.toLowerCase() === "all") {
    return designs;
  }

  const requested = normalizeDesignNames(designNames);
  const selected: typeof designs = [];
  const seen = new Set<string>();

  for (const name of requested) {
    const trimmed = name.trim();
    const lower = trimmed.toLowerCase();
    const target = /^\d+$/.test(trimmed)
      ? designs.find((design) => design.index === Number(trimmed))
      : designs.find((design) => design.id.toLowerCase() === lower) ??
        designs.find((design) => design.name === trimmed);
    if (target && !seen.has(target.id)) {
      seen.add(target.id);
      selected.push(target);
    }
  }

  if (selected.length === 0 && parsedUrl.docId) {
    const docIdLower = parsedUrl.docId.toLowerCase();
    const byImageId = designs.find((design) => design.id.toLowerCase() === docIdLower);
    if (byImageId) {
      selected.push(byImageId);
    }
  }

  return selected;
}

/**
 * Per-design result accumulated during processing.
 * Mirrors the Python html_results dict structure.
 */
interface DesignHtmlResult {
  success: boolean;
  designName: string;
  htmlCode?: string;
  imageUrlMapping?: Record<string, string>;
  layoutSummary?: string;
  layerTree?: string;
  designTokens?: string;
  error?: string;
  // Sketch fallback fields (populated when schema path fails)
  sketchHtml?: string;
  sketchAnnotations?: string;
  layerCssAnnotations?: LayerAnnotation[];
}

export function registerAnalyzeDesignsTool(server: McpServer): void {
  server.registerTool(
    "lanhu_analyze_designs",
    {
      description:
        "Analyze Lanhu UI design images, returning screenshots, HTML+CSS code, and design tokens.\n\n" +
        "Call lanhu_list_designs first to get the design list.\n" +
        "If the URL is a detailDetach link (contains image_id), skip lanhu_list_designs and pass the URL directly with design_names='all'.\n\n" +
        "Returns:\n" +
        "    - Summary text with HTML+CSS code for each design (CSS values from original design data)\n" +
        "    - Design images in order (image N = design N)\n" +
        "    - Image asset download mapping (local_path <- remote_url)\n" +
        "    - Design tokens (colors, fonts, gradients, shadows) extracted from Sketch data",
      inputSchema: {
        url: z
          .string()
          .min(1)
          .describe(
            "Lanhu project URL (UI design). Example: https://lanhuapp.com/web/#/item/project/stage?tid=xxx&pid=xxx. " +
            "Also accepts detailDetach URLs with image_id — only that single design will be analyzed.",
          ),
        design_names: z
          .union([z.string(), z.array(z.string())])
          .describe(
            "Design name(s) or index number(s). 'all' = all designs. Number (e.g. 6) = the 6th item in lanhu_list_designs list (by 'index' field), NOT by name prefix. Exact name (e.g. '6_friend页_挂件墙') = match by full name. Get names/index from lanhu_list_designs first.",
          ),
      },
    },
    async ({ url, design_names }) => {
      try {
        const client = new LanhuClient({
          cookie: config.lanhuCookie,
          ddsCookie: config.ddsCookie,
        });
        const cdnFetch = createLanhuFetch({
          cookie: config.lanhuCookie,
          ddsCookie: config.ddsCookie,
        });
        const parsed = parseLanhuUrl(url);
        const designsResult = await listDesigns(client, url);
        const targetDesigns = pickTargetDesigns(designsResult.designs, parsed, design_names);

        if (targetDesigns.length === 0) {
          return createToolResult(
            "No matching design found.",
            {
              status: "error",
              available_designs: designsResult.designs.map((design) => design.name),
            } as unknown as import("../shared/types.js").JsonObject,
            true,
          );
        }

        const content: import("../shared/types.js").ToolContent[] = [];
        const imageResults: Array<{ success: boolean; designName: string; bytes?: number }> = [];
        const htmlResults: DesignHtmlResult[] = [];

        for (const design of targetDesigns) {
          // ===== 1. Download cover image =====
          if (design.url) {
            try {
              const response = await cdnFetch(design.url.split("?")[0]);
              if (response.ok) {
                const bytes = Buffer.from(await response.arrayBuffer());
                content.push({
                  type: "image",
                  data: bytes.toString("base64"),
                  mimeType: inferMimeType(design.url),
                });
                imageResults.push({ success: true, designName: design.name, bytes: bytes.length });
              } else {
                imageResults.push({ success: false, designName: design.name });
              }
            } catch {
              imageResults.push({ success: false, designName: design.name });
            }
          }

          // ===== 2. Schema → HTML =====
          const htmlEntry: DesignHtmlResult = { success: false, designName: design.name };
          try {
            const schemaResult = await getDesignSchemaJson(
              client,
              design.id,
              designsResult.params.teamId,
              designsResult.params.projectId,
            );
            const rawHtml = convertSchemaToHtml(schemaResult.schema);
            const localized = localizeImageUrls(rawHtml);
            const layoutSummary = extractLayoutSummary(schemaResult.schema);

            htmlEntry.success = true;
            htmlEntry.htmlCode = localized.htmlCode;
            htmlEntry.imageUrlMapping = localized.imageUrlMapping;
            htmlEntry.layoutSummary = layoutSummary;
          } catch (error) {
            htmlEntry.error = error instanceof Error ? error.message : String(error);
          }
          htmlResults.push(htmlEntry);

          // ===== 3. Sketch JSON → tokens / layer tree / fallback =====
          try {
            const sketchResult = await getSketchJson(
              client,
              design.id,
              designsResult.params.teamId,
              designsResult.params.projectId,
            );
            const sketch = sketchResult.sketch;
            const designTokens = extractDesignTokens(sketch);
            const layerTree = extractLayerTree(sketch);

            if (htmlEntry.success) {
              if (layerTree) htmlEntry.layerTree = layerTree;
              if (designTokens) htmlEntry.designTokens = designTokens;
            } else {
              // Schema failed → full sketch fallback (matches Python behavior)
              const deviceStr = String(sketch.device ?? "");
              const designScale = inferDesignScale(deviceStr);
              const designImgUrl = design.url?.split("?")[0] ?? "";

              const sketchConversion = convertSketchToHtml(sketch, designScale, designImgUrl);
              sketchConversion.imageUrlMapping["./assets/designs/design.png"] = designImgUrl;

              htmlEntry.sketchHtml = minifyHtml(sketchConversion.html);
              htmlEntry.imageUrlMapping = sketchConversion.imageUrlMapping;
              htmlEntry.layerCssAnnotations = sketchConversion.layerAnnotations;
              htmlEntry.sketchAnnotations = extractFullAnnotationsFromSketch(sketch, designScale);
              if (designTokens) htmlEntry.designTokens = designTokens;
              if (layerTree) htmlEntry.layerTree = layerTree;
            }
          } catch {
            // Sketch extraction is best-effort; Python also catches all exceptions here
          }
        }

        // ===== Build summary text (matches Python output structure) =====
        const successImageCount = imageResults.filter((r) => r.success).length;
        const htmlSuccessCount = htmlResults.filter((r) => r.success).length;
        const sketchFallbackCount = htmlResults.filter(
          (r) => !r.success && r.sketchHtml,
        ).length;

        const summarySections: string[] = [];
        summarySections.push("📊 Design Analysis Results");
        summarySections.push(`📁 Project: ${designsResult.projectName ?? "Unknown"}`);
        summarySections.push(`✓ ${successImageCount}/${imageResults.length} images downloaded`);
        summarySections.push(`✓ ${htmlSuccessCount}/${htmlResults.length} HTML codes generated`);
        if (sketchFallbackCount > 0) {
          summarySections.push(
            `✓ ${sketchFallbackCount} design(s) using Sketch annotation fallback (标注模式)`,
          );
        }
        summarySections.push("");

        for (let idx = 0; idx < htmlResults.length; idx++) {
          const hr = htmlResults[idx];
          summarySections.push(`\n--- 设计图 ${idx + 1}：${hr.designName} ---`);

          if (hr.success && hr.htmlCode) {
            // Schema success path
            summarySections.push("   📄 完整代码（图片已替换为本地路径）:");
            summarySections.push("   ```html");
            summarySections.push(hr.htmlCode);
            summarySections.push("   ```");

            if (hr.layoutSummary) {
              summarySections.push("");
              summarySections.push("   --- Layout Summary (布局/字体/间距速览) ---");
              summarySections.push(hr.layoutSummary);
              summarySections.push("   --- End Layout Summary ---");
            }

            const mapping = hr.imageUrlMapping ?? {};
            if (Object.keys(mapping).length > 0) {
              summarySections.push("");
              summarySections.push(
                `   📥 图片资源下载映射（共 ${Object.keys(mapping).length} 个，必须全部下载到项目本地）:`,
              );
              for (const [localPath, remoteUrl] of Object.entries(mapping)) {
                summarySections.push(`     ${localPath} ← ${remoteUrl}`);
              }
            }

            if (hr.layerTree) {
              summarySections.push("");
              summarySections.push("   --- Layer Structure (设计层级结构) ---");
              summarySections.push(hr.layerTree);
              summarySections.push("   --- End Layer Structure ---");
            }

            if (hr.designTokens) {
              summarySections.push("");
              summarySections.push("   --- Design Tokens (高风险元素，权威参考) ---");
              summarySections.push(hr.designTokens);
              summarySections.push("   --- End Design Tokens ---");
            }
          } else if (hr.sketchHtml || hr.sketchAnnotations) {
            // Sketch fallback path
            summarySections.push(
              `\n   ⚠️ DDS Schema 不可用（${hr.error ?? "未知"}），已使用「设计原图底图 + 真实文字 + CSS 标注」方案生成 HTML。`,
            );

            if (hr.sketchHtml) {
              summarySections.push("   📄 HTML+CSS 代码:");
              summarySections.push("   ```html");
              summarySections.push(hr.sketchHtml);
              summarySections.push("   ```");
            }

            const fbMapping = hr.imageUrlMapping ?? {};
            if (Object.keys(fbMapping).length > 0) {
              summarySections.push("");
              summarySections.push(
                `   📥 资源下载映射（共 ${Object.keys(fbMapping).length} 个，请全部下载到项目本地后替换 HTML 中的 URL）:`,
              );
              for (const [localPath, remoteUrl] of Object.entries(fbMapping)) {
                summarySections.push(`     ${localPath} ← ${remoteUrl}`);
              }
            }

            if (hr.layerCssAnnotations && hr.layerCssAnnotations.length > 0) {
              summarySections.push("");
              summarySections.push(
                `   📐 图层精确 CSS 标注（共 ${hr.layerCssAnnotations.length} 个图层）:`,
              );
              for (const la of hr.layerCssAnnotations) {
                const cssStr = Object.entries(la.css)
                  .map(([k, v]) => `${k}: ${v}`)
                  .join("; ");
                let line = `     [${la.type}] ${la.name}: ${cssStr}`;
                if (la.text) line += ` | text="${la.text.slice(0, 50)}"`;
                if (la.slice_url) line += ` | slice=${la.slice_url}`;
                summarySections.push(line);
              }
            }

            if (hr.sketchAnnotations) {
              summarySections.push("   --- 设计标注详情（参考补充） ---");
              summarySections.push(hr.sketchAnnotations);
              summarySections.push("   --- End 设计标注 ---");
            }

            if (hr.designTokens) {
              summarySections.push("");
              summarySections.push("   --- Design Tokens (高风险元素补充) ---");
              summarySections.push(hr.designTokens);
              summarySections.push("   --- End Design Tokens ---");
            }
          } else {
            summarySections.push(
              `   ❌ Failed (no fallback available): ${hr.error ?? "Unknown"}`,
            );
          }
        }

        const failedImages = imageResults.filter((r) => !r.success);
        const failedHtmlNoFallback = htmlResults.filter(
          (r) => !r.success && !r.sketchHtml && !r.sketchAnnotations,
        );
        if (failedImages.length > 0) {
          summarySections.push("");
          summarySections.push(`⚠️ Failed to download ${failedImages.length} images`);
        }
        if (failedHtmlNoFallback.length > 0) {
          summarySections.push("");
          summarySections.push(
            `⚠️ Failed to generate ${failedHtmlNoFallback.length} HTML codes (no fallback available)`,
          );
        }

        content.unshift({
          type: "text",
          text: summarySections.join("\n").trim(),
        });

        // COMPATIBILITY_MATRIX:
        // Python returns List[Union[str, Image]]; TS returns MCP ToolResult with content[] + structuredContent.
        // Python accumulates image_results and html_results dicts, text summary is a single string.
        // TS structuredContent provides a JSON-friendly view; Python does not use structuredContent.
        // Semantic output (HTML code, image mappings, annotations, tokens) is equivalent.
        const structuredDesigns = htmlResults.map((hr) => ({
          name: hr.designName,
          success: hr.success,
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
          } as unknown as import("../shared/types.js").JsonObject,
        };
      } catch (error) {
        return createToolResult(
          `Failed to analyze designs: ${error instanceof Error ? error.message : String(error)}`,
          { status: "error", url },
          true,
        );
      }
    },
  );
}
