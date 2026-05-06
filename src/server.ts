#!/usr/bin/env node
import { realpathSync } from "node:fs";
import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import path from "node:path";
import { pathToFileURL } from "node:url";
import * as z from "zod/v4";

import { config } from "./config.js";
import { LanhuClient } from "./lanhu/client.js";
import { listDesigns } from "./lanhu/designs.js";
import { registerAllTools } from "./tools/index.js";

export function createServer(): McpServer {
  const server = new McpServer({
    name: config.serverName,
    version: config.serverVersion,
  });

  registerAllTools(server);

  // === Resources ===
  server.resource(
    "project-designs",
    new ResourceTemplate("lanhu://project/{pid}/designs?tid={tid}", { list: undefined }),
    { description: "List all design images in a Lanhu project" },
    async (_uri, { pid, tid }) => {
      const client = new LanhuClient({
        cookie: config.lanhuCookie,
        ddsCookie: config.ddsCookie,
      });
      const url = `https://lanhuapp.com/web/#/item/project/stage?pid=${pid}&tid=${tid}`;
      const result = await listDesigns(client, url);
      return {
        contents: [{
          uri: _uri.href,
          mimeType: "application/json",
          text: JSON.stringify({
            projectName: result.projectName,
            totalDesigns: result.totalDesigns,
            designs: result.designs.map((d) => ({
              index: d.index,
              id: d.id,
              name: d.name,
              width: d.width,
              height: d.height,
            })),
          }, null, 2),
        }],
      };
    },
  );

  // === Prompts ===
  server.prompt(
    "frontend-dev",
    "Analyze a Lanhu design and generate pixel-accurate frontend code",
    { url: z.string(), design_name: z.string().optional() },
    ({ url, design_name }) => ({
      messages: [{
        role: "user" as const,
        content: {
          type: "text" as const,
          text: `Analyze the Lanhu design at ${url}${design_name ? ` (design: "${design_name}")` : ""} and generate pixel-accurate frontend code.\n\nRequirements:\n1. Use exact fonts, sizes, colors, and spacing from the design\n2. Download all image assets to local paths\n3. Match the layout precisely`,
        },
      }],
    }),
  );

  server.prompt(
    "design-review",
    "Review a Lanhu design for consistency and implementation feasibility",
    { url: z.string() },
    ({ url }) => ({
      messages: [{
        role: "user" as const,
        content: {
          type: "text" as const,
          text: `Review the Lanhu design at ${url} for consistency:\n1. Check font usage consistency (families, sizes, weights)\n2. Verify color palette is within a design system\n3. Check spacing and border-radius patterns\n4. Flag potential implementation issues`,
        },
      }],
    }),
  );

  return server;
}

export async function main(): Promise<void> {
  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

export function isDirectExecution(
  entrypoint = process.argv[1],
  moduleUrl = import.meta.url,
): boolean {
  if (entrypoint == null) {
    return false;
  }

  try {
    return moduleUrl === pathToFileURL(realpathSync(path.resolve(entrypoint))).href;
  } catch {
    return false;
  }
}

if (isDirectExecution()) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error(`Lanhu MCP TypeScript scaffold failed to start: ${message}`);
    process.exitCode = 1;
  });
}
