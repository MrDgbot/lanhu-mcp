import { mkdtempSync, mkdirSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";

import { isDirectExecution } from "../src/server.js";

describe("isDirectExecution", () => {
  it("treats npm .bin symlinks as direct execution", () => {
    const tempDir = mkdtempSync(path.join(os.tmpdir(), "lanhu-mcp-"));
    const realEntry = path.join(tempDir, "node_modules", "mcp-lanhu", "dist", "server.js");
    const binEntry = path.join(tempDir, "node_modules", ".bin", "mcp-lanhu");

    mkdirSync(path.dirname(realEntry), { recursive: true });
    mkdirSync(path.dirname(binEntry), { recursive: true });
    writeFileSync(realEntry, "");
    symlinkSync("../mcp-lanhu/dist/server.js", binEntry);

    try {
      expect(isDirectExecution(binEntry, pathToFileURL(realpathSync(realEntry)).href)).toBe(true);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("returns false when the entrypoint does not resolve to the current module", () => {
    expect(
      isDirectExecution("/tmp/does-not-match.js", "file:///tmp/another-entry.js"),
    ).toBe(false);
  });
});
