import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import * as z from "zod/v4";

import { config } from "../config.js";
import { createLanhuFetch } from "../lanhu/client.js";
import {
  analyzeLocalPage,
  downloadResources,
  listPages,
  parseLanhuPageUrl,
} from "../lanhu/pages.js";
import { createToolResult } from "../shared/errors.js";

export function registerAnalyzePagesTool(server: McpServer): void {
  server.registerTool(
    "lanhu_analyze_pages",
    {
      description:
        "Analyze Lanhu PRD/Axure pages with the current static extraction route. Skeleton only for the TS rewrite stage.",
      inputSchema: {
        url: z
          .string()
          .min(1)
          .describe(
            "Lanhu project URL with docId (PRD/prototype). Example: https://lanhuapp.com/web/#/item/project/product?tid=xxx&pid=xxx&docId=xxx",
          ),
        page_names: z
          .union([z.string(), z.array(z.string())])
          .describe(
            "Page name(s) to analyze. Use 'all' for all pages, single name like '退款流程', or list like ['退款流程', '用户中心']. Get exact names from lanhu_list_pages first!",
          ),
        mode: z
          .enum(["text_only", "full"])
          .default("full")
          .describe("Analysis mode: 'text_only' or 'full'. Default: 'full'."),
        analysis_mode: z
          .enum(["developer", "tester", "explorer"])
          .default("developer")
          .describe(
            "Analysis perspective: 'developer' (detailed for coding), 'tester' (test scenarios/validation), 'explorer' (quick overview for review).",
          ),
      },
    },
    async ({ url, page_names, mode, analysis_mode }) => {
      try {
        const fetchImpl = createLanhuFetch({
          cookie: config.lanhuCookie,
          ddsCookie: config.ddsCookie,
        });
        const params = parseLanhuPageUrl(url);
        const resourceDir = path.join(config.dataDir, `axure_extract_${(params.doc_id ?? "unknown").slice(0, 8)}`);
        await mkdir(resourceDir, { recursive: true });

        const downloadResult = await downloadResources(fetchImpl, url, resourceDir);
        const pagesResult = await listPages(fetchImpl, url);
        const pageMap = new Map(
          pagesResult.pages.map((page) => [page.name, page.filename.replace(/\.html$/i, "")]),
        );

        const requested = Array.isArray(page_names) ? page_names : [page_names];
        const targetPages =
          requested.length === 1 && requested[0]?.toLowerCase() === "all"
            ? pagesResult.pages.map((page) => page.filename.replace(/\.html$/i, ""))
            : requested.map((name) => pageMap.get(name) ?? name);

        const results = await Promise.all(targetPages.map((page) => analyzeLocalPage(resourceDir, page)));
        const successful = results.filter((item) => item.success);

        const summaryText = [
          `Mode: ${mode}`,
          `Perspective: ${analysis_mode}`,
          `Document: ${pagesResult.document_name}`,
          `Requested pages: ${targetPages.length}`,
          `Successful pages: ${successful.length}`,
          `Version: ${downloadResult.version_id}`,
        ].join("\n");

        return createToolResult(
          summaryText,
          {
            status: "success",
            mode,
            analysis_mode,
            document: pagesResult,
            download: downloadResult,
            results,
          } as unknown as import("../shared/types.js").JsonObject,
        );
      } catch (error) {
        return createToolResult(
          `Failed to analyze prototype pages: ${error instanceof Error ? error.message : String(error)}`,
          { status: "error", url, mode, analysis_mode },
          true,
        );
      }
    },
  );
}
