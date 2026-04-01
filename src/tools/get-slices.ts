import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod/v4";

import { config } from "../config.js";
import { LanhuClient } from "../lanhu/client.js";
import { getSlices, listDesigns } from "../lanhu/designs.js";
import { createToolResult } from "../shared/errors.js";

export function registerGetSlicesTool(server: McpServer): void {
  server.registerTool(
    "lanhu_get_slices",
    {
      description:
        "Get slice/asset info (icons, images) from a specific Lanhu design for download. Call lanhu_list_designs first.",
      inputSchema: {
        url: z
          .string()
          .min(1)
          .describe(
            "Lanhu project URL without docId (UI design). Example: https://lanhuapp.com/web/#/item/project/stage?tid=xxx&pid=xxx",
          ),
        design_name: z
          .string()
          .min(1)
          .describe(
            "Exact design name (single design only, NOT 'all'). Example: '首页设计', '登录页'. Must match exactly with name from lanhu_list_designs result!",
          ),
        include_metadata: z.boolean().default(true).describe("Include color, opacity, shadow info"),
      },
    },
    async ({ url, design_name, include_metadata }) => {
      try {
        const client = new LanhuClient({
          cookie: config.lanhuCookie,
          ddsCookie: config.ddsCookie,
        });
        const designsResult = await listDesigns(client, url);
        const target = designsResult.designs.find((item) => item.name === design_name);

        if (!target) {
          return createToolResult(
            `Design ${design_name} was not found.`,
            {
              status: "error",
              url,
              design_name,
              available_designs: designsResult.designs.map((item) => item.name),
            } as unknown as import("../shared/types.js").JsonObject,
            true,
          );
        }

        const slices = await getSlices(
          client,
          target.id,
          designsResult.params.teamId,
          designsResult.params.projectId,
          include_metadata,
        );

        return createToolResult(
          `Loaded ${slices.totalSlices} slice(s) for ${design_name}.`,
          slices as unknown as import("../shared/types.js").JsonObject,
        );
      } catch (error) {
        return createToolResult(
          `Failed to get slices: ${error instanceof Error ? error.message : String(error)}`,
          { status: "error", url, design_name },
          true,
        );
      }
    },
  );
}
