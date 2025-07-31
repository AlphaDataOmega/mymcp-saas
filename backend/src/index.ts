#!/usr/bin/env node
import type { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { program } from "commander";

import { appConfig } from "./shared/config.js";

import type { Resource } from "./resources/resource.js";
import { createServerWithTools } from "./server.js";
import * as common from "./tools/common.js";
import * as custom from "./tools/custom.js";
import * as snapshot from "./tools/snapshot.js";
import type { Tool } from "./tools/tool.js";

import packageJSON from "../package.json";

function setupExitWatchdog(server: Server) {
  process.stdin.on("close", async () => {
    setTimeout(() => process.exit(0), 15000);
    await server.close();
    process.exit(0);
  });
}

const commonTools: Tool[] = [common.pressKey, common.wait];

const customTools: Tool[] = [custom.getConsoleLogs, custom.screenshot];

const snapshotTools: Tool[] = [
  common.navigate(true),
  common.goBack(true),
  common.goForward(true),
  snapshot.snapshot,
  snapshot.click,
  snapshot.hover,
  snapshot.type,
  snapshot.selectOption,
  ...commonTools,
  ...customTools,
];

const resources: Resource[] = [];

async function createServer(): Promise<Server> {
  return createServerWithTools({
    name: appConfig.name,
    version: packageJSON.version,
    tools: snapshotTools,
    resources,
  });
}

/**
 * Note: Tools must be defined *before* calling `createServer` because only declarations are hoisted, not the initializations
 */
program
  .version("Version " + packageJSON.version)
  .name(packageJSON.name)
  .option("--api-only", "Start only the API server")
  .option("--mcp-only", "Start only the MCP server")
  .action(async (options) => {
    const { apiOnly, mcpOnly } = options;

    if (apiOnly) {
      // Start only the API server
      await import("./api.js");
      return;
    }

    if (mcpOnly || (!apiOnly && !mcpOnly)) {
      // Start the MCP server (default behavior)
      const server = await createServer();
      setupExitWatchdog(server);

      const transport = new StdioServerTransport();
      await server.connect(transport);
    }
  });
program.parse(process.argv);
