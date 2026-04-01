import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod/v4";

import { config } from "../config.js";
import { createLanhuFetch } from "../lanhu/client.js";
import { listPages } from "../lanhu/pages.js";
import { createToolResult } from "../shared/errors.js";

export function registerListPagesTool(server: McpServer): void {
  server.registerTool(
    "lanhu_list_pages",
    {
      description: "Get page list from a Lanhu PRD/Axure prototype document. Call before lanhu_analyze_pages.",
      inputSchema: {
        url: z
          .string()
          .min(1)
          .describe(
            "Lanhu project URL with docId (PRD/prototype). Example: https://lanhuapp.com/web/#/item/project/product?tid=xxx&pid=xxx&docId=xxx",
          ),
      },
    },
    async ({ url }) => {
      try {
        const fetchImpl = createLanhuFetch({
          cookie: config.lanhuCookie,
          ddsCookie: config.ddsCookie,
        });
        const result = await listPages(fetchImpl, url);
        return createToolResult(
          `Loaded ${result.total_pages} prototype page(s) from ${result.document_name}.`,
          result as unknown as import("../shared/types.js").JsonObject,
        );
      } catch (error) {
        return createToolResult(
          `Failed to list prototype pages: ${error instanceof Error ? error.message : String(error)}`,
          { status: "error", url },
          true,
        );
      }
    },
  );
}
