import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod/v4";

import { config } from "../config.js";
import { LanhuClient } from "../lanhu/client.js";
import { listDesigns } from "../lanhu/designs.js";
import { createToolResult } from "../shared/errors.js";

export function registerListDesignsTool(server: McpServer): void {
  server.registerTool(
    "lanhu_list_designs",
    {
      description: "Get UI design image list from a Lanhu project. Call before lanhu_analyze_designs.",
      inputSchema: {
        url: z
          .string()
          .min(1)
          .describe(
            "Lanhu project URL (UI design). Example: https://lanhuapp.com/web/#/item/project/stage?tid=xxx&pid=xxx. " +
            "Also accepts detailDetach URLs with image_id — returns only that single design.",
          ),
      },
    },
    async ({ url }) => {
      try {
        const client = new LanhuClient({
          cookie: config.lanhuCookie,
          ddsCookie: config.ddsCookie,
        });
        const result = await listDesigns(client, url);

        return createToolResult(
          `Loaded ${result.totalDesigns} design(s)${result.projectName ? ` from ${result.projectName}` : ""}.`,
          result as unknown as import("../shared/types.js").JsonObject,
        );
      } catch (error) {
        return createToolResult(
          `Failed to list designs: ${error instanceof Error ? error.message : String(error)}`,
          { status: "error", url },
          true,
        );
      }
    },
  );
}
