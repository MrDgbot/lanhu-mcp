import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { registerAnalyzeDesignsTool } from "./analyze-designs.js";
import { registerAnalyzePagesTool } from "./analyze-pages.js";
import { registerGetSlicesTool } from "./get-slices.js";
import { registerListDesignsTool } from "./list-designs.js";
import { registerListPagesTool } from "./list-pages.js";
import { registerResolveInviteTool } from "./resolve-invite.js";

export {
  registerAnalyzeDesignsTool,
  registerAnalyzePagesTool,
  registerGetSlicesTool,
  registerListDesignsTool,
  registerListPagesTool,
  registerResolveInviteTool,
};

const toolRegistrations = [
  registerResolveInviteTool,
  registerListPagesTool,
  registerAnalyzePagesTool,
  registerListDesignsTool,
  registerAnalyzeDesignsTool,
  registerGetSlicesTool,
] as const;

export function registerAllTools(server: McpServer): void {
  for (const registerTool of toolRegistrations) {
    registerTool(server);
  }
}
