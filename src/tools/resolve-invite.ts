import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod/v4";

import { config } from "../config.js";
import { createLanhuFetch, parseLanhuUrl } from "../lanhu/client.js";
import { createToolResult } from "../shared/errors.js";

const REDIRECT_PATTERNS = [
  /window\.location\.href\s*=\s*["']([^"']+)["']/,
  /location\.replace\s*\(\s*["']([^"']+)["']/,
  /window\.location\s*=\s*["']([^"']+)["']/,
];

export function registerResolveInviteTool(server: McpServer): void {
  server.registerTool(
    "lanhu_resolve_invite_link",
    {
      description: "Resolve Lanhu invite/share link to actual project URL with tid/pid/docId parameters.",
      inputSchema: {
        invite_url: z
          .string()
          .min(1)
          .describe("Lanhu invite link. Example: https://lanhuapp.com/link/#/invite?sid=xxx"),
      },
    },
    async ({ invite_url }) => {
      const fetchImpl = createLanhuFetch({
        cookie: config.lanhuCookie,
        ddsCookie: config.ddsCookie,
      });

      try {
        const response = await fetchImpl(invite_url);
        let finalUrl = response.url;

        if (finalUrl.includes("invite") && response.ok) {
          const htmlText = await response.text();
          for (const pattern of REDIRECT_PATTERNS) {
            const match = htmlText.match(pattern);
            if (match?.[1]) {
              finalUrl = match[1].startsWith("http")
                ? match[1]
                : `${config.lanhuBaseUrl}${match[1]}`;
              break;
            }
          }
        }

        try {
          const parsedParams = parseLanhuUrl(finalUrl);
          return createToolResult(
            `Resolved invite link to ${finalUrl}`,
            {
              status: "success",
              invite_url,
              resolved_url: finalUrl,
              parsed_params: parsedParams as unknown as Record<string, never>,
            } as unknown as import("../shared/types.js").JsonObject,
          );
        } catch (error) {
          return createToolResult(
            `Resolved invite link to ${finalUrl}, but parameter parsing failed.`,
            {
              status: "partial_success",
              invite_url,
              resolved_url: finalUrl,
              parse_error: error instanceof Error ? error.message : String(error),
            } as unknown as import("../shared/types.js").JsonObject,
          );
        }
      } catch (error) {
        return createToolResult(
          `Failed to resolve invite link: ${error instanceof Error ? error.message : String(error)}`,
          {
            status: "error",
            invite_url,
          },
          true,
        );
      }
    },
  );
}
