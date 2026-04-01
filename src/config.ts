import path from "node:path";

import { ConfigurationError } from "./shared/errors.js";
import type { AppConfig } from "./shared/types.js";

const DEFAULT_TIMEOUT_MS = 20_000;
const DEFAULT_DATA_DIR = "data/ts";

function readPositiveInteger(rawValue: string | undefined, fallback: number, key: string): number {
  if (rawValue == null || rawValue.trim() === "") {
    return fallback;
  }

  const parsed = Number.parseInt(rawValue, 10);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new ConfigurationError(`${key} must be a positive integer.`, {
      key,
      rawValue,
    });
  }

  return parsed;
}

function readLogLevel(rawValue: string | undefined): AppConfig["logLevel"] {
  switch (rawValue) {
    case undefined:
    case "":
      return "info";
    case "info":
    case "debug":
    case "warn":
    case "error":
      return rawValue;
    default:
      throw new ConfigurationError("LOG_LEVEL must be one of debug/info/warn/error.", {
        key: "LOG_LEVEL",
        rawValue,
      });
  }
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  return {
    serverName: env.MCP_SERVER_NAME ?? "lanhu-mcp-ts",
    serverVersion: env.MCP_SERVER_VERSION ?? "0.1.0",
    lanhuBaseUrl: env.LANHU_BASE_URL ?? "https://lanhuapp.com",
    dataDir: path.resolve(process.cwd(), env.LANHU_DATA_DIR ?? DEFAULT_DATA_DIR),
    requestTimeoutMs: readPositiveInteger(env.LANHU_REQUEST_TIMEOUT_MS, DEFAULT_TIMEOUT_MS, "LANHU_REQUEST_TIMEOUT_MS"),
    logLevel: readLogLevel(env.LOG_LEVEL),
    lanhuCookie: env.LANHU_COOKIE,
    ddsCookie: env.DDS_COOKIE ?? env.LANHU_COOKIE,
  };
}

export const config = loadConfig();
