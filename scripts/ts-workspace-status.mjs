#!/usr/bin/env node

import { spawnSync } from "node:child_process";

const args = process.argv.slice(2);
const runIndex = args.indexOf("--run");
const requestedScript = runIndex >= 0 ? args[runIndex + 1] : null;
const wantsInstall = args.includes("--install");
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";

function printStatus() {
  console.log("TypeScript workspace status: ready");
  console.log("Workspace location: repository root");
  console.log("Current default runtime: Python (lanhu_mcp_server.py)");
  console.log("TypeScript scaffold is available through package.json scripts.");
}

function runNpm(argsToRun) {
  const result = spawnSync(npmCommand, argsToRun, { stdio: "inherit" });
  process.exit(result.status ?? 1);
}

printStatus();

if (wantsInstall) {
  runNpm(["install"]);
}

if (requestedScript) {
  runNpm(["run", requestedScript]);
}
