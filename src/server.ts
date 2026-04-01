#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { config } from "./config.js";
import { registerAllTools } from "./tools/index.js";

export function createServer(): McpServer {
  const server = new McpServer({
    name: config.serverName,
    version: config.serverVersion,
  });

  registerAllTools(server);

  return server;
}

export async function main(): Promise<void> {
  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

const entrypoint = process.argv[1];
const resolvedEntry = entrypoint != null ? fs.realpathSync(path.resolve(entrypoint)) : null;
const isDirectExecution =
  resolvedEntry != null && import.meta.url === pathToFileURL(resolvedEntry).href;

if (isDirectExecution) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error(`Lanhu MCP TypeScript scaffold failed to start: ${message}`);
    process.exitCode = 1;
  });
}
