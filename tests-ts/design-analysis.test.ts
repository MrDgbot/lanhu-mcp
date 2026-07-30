import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getDesignSchemaJson: vi.fn(),
  getSketchJson: vi.fn(),
  getSlices: vi.fn(),
  listDesigns: vi.fn(),
  minifyHtml: vi.fn((html: string) => html.replace(/\s+/g, " ").trim()),
}));

vi.mock("../src/lanhu/client.js", () => ({
  LanhuClient: class MockLanhuClient {},
  createLanhuFetch: vi.fn(() => vi.fn()),
  parseLanhuUrl: vi.fn(() => ({ projectId: "project-1", teamId: "team-1" })),
}));

vi.mock("../src/lanhu/designs.js", () => ({
  getDesignSchemaJson: mocks.getDesignSchemaJson,
  getSketchJson: mocks.getSketchJson,
  getSlices: mocks.getSlices,
  listDesigns: mocks.listDesigns,
}));

vi.mock("../src/shared/html.js", () => ({
  minifyHtml: mocks.minifyHtml,
}));

import { registerDesignTool } from "../src/tools/design.js";

const schemaFixture = {
  type: "div",
  props: {
    className: "screen",
    style: { width: 375, height: 812, display: "flex", flexDirection: "column" },
  },
  children: [],
};

const sketchFixture = {
  device: "iPhone 12 @2x",
  artboard: {
    name: "Home",
    frame: { width: 750, height: 1624 },
    layers: [
      {
        type: "textLayer",
        name: "Title",
        visible: true,
        frame: { x: 32, y: 100, width: 400, height: 48 },
        style: {},
        text: {
          value: "Hello",
          style: {
            color: { value: "rgba(0,0,0,1)" },
            font: { name: "PingFang SC", type: "Medium", size: 32 },
          },
        },
      },
    ],
  },
};

const projectDesign = {
  index: 1,
  id: "design-1",
  name: "Home",
  source: "projectImages",
  raw: {},
};

function mockDesignList(source: "projectImages" | "detailDetach" = "projectImages"): void {
  mocks.listDesigns.mockResolvedValue({
    totalDesigns: 1,
    projectName: "Example project",
    designs: [{ ...projectDesign, source }],
    params: {
      projectId: "project-1",
      teamId: source === "detailDetach" ? undefined : "team-1",
    },
  });
}

function getToolHandler(): (args: Record<string, unknown>) => Promise<Record<string, unknown>> {
  let handler: ((args: Record<string, unknown>) => Promise<Record<string, unknown>>) | undefined;
  const server = {
    registerTool: (
      _name: string,
      _definition: unknown,
      callback: (args: Record<string, unknown>) => Promise<Record<string, unknown>>,
    ) => {
      handler = callback;
    },
  };
  registerDesignTool(server as unknown as McpServer);
  if (!handler) throw new Error("lanhu_design handler was not registered");
  return handler;
}

async function analyze(include: string[], extra: Record<string, unknown> = {}) {
  return getToolHandler()({
    url: "https://lanhuapp.com/web/#/item/project/stage?pid=project-1&tid=team-1",
    mode: "analyze",
    design_names: "all",
    include,
    ...extra,
  });
}

function getStructured(result: Record<string, unknown>): Record<string, any> {
  return result.structuredContent as Record<string, any>;
}

function getText(result: Record<string, unknown>): string {
  return (result.content as Array<{ type: string; text?: string }>)[0]?.text ?? "";
}

describe("lanhu_design analyze output status", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDesignList();
    mocks.getDesignSchemaJson.mockResolvedValue({ schema: schemaFixture });
    mocks.getSketchJson.mockResolvedValue({ sketch: sketchFixture, documentInfo: {} });
    mocks.getSlices.mockResolvedValue({
      designId: "design-1",
      designName: "Home",
      canvasSize: {},
      totalSlices: 0,
      slices: [],
    });
    mocks.minifyHtml.mockImplementation((html: string) => html.replace(/\s+/g, " ").trim());
  });

  it("computes layout without requesting HTML or Sketch", async () => {
    const result = await analyze(["layout"]);
    const structured = getStructured(result);

    expect(structured.status).toBe("success");
    expect(structured.designs[0]).toMatchObject({
      status: "success",
      layout_source: "schema",
    });
    expect(structured.designs[0].layout_summary).toContain(".screen");
    expect(mocks.getDesignSchemaJson).toHaveBeenCalledOnce();
    expect(mocks.getSketchJson).not.toHaveBeenCalled();
  });

  it("returns layers and structured annotations without requesting HTML", async () => {
    const result = await analyze(["layers"]);
    const design = getStructured(result).designs[0];

    expect(design.status).toBe("success");
    expect(design.html_code).toBeNull();
    expect(design.layer_tree).toContain("textLayer: Title");
    expect(design.layer_annotations).toEqual([
      expect.objectContaining({ name: "Title", type: "textLayer" }),
    ]);
    expect(mocks.getDesignSchemaJson).not.toHaveBeenCalled();
    expect(mocks.getSketchJson).toHaveBeenCalledOnce();
  });

  it("computes layout and layers independently in the same request", async () => {
    const result = await analyze(["layout", "layers"]);
    const design = getStructured(result).designs[0];

    expect(design.status).toBe("success");
    expect(design.outputs).toEqual({
      layout: { status: "success" },
      layers: { status: "success" },
    });
    expect(design.layout_source).toBe("schema");
    expect(design.layer_annotations).toHaveLength(1);
  });

  it("returns partial_success when layers succeed but HTML fallback fails", async () => {
    mocks.getDesignSchemaJson.mockRejectedValue(new Error("schema unavailable"));
    mocks.minifyHtml.mockImplementationOnce(() => {
      throw new Error("HTML minification failed");
    });

    const result = await analyze(["html", "layers"]);
    const structured = getStructured(result);
    const design = structured.designs[0];

    expect(structured.status).toBe("partial_success");
    expect(result.isError).toBeUndefined();
    expect(design.status).toBe("partial_success");
    expect(design.outputs.layers.status).toBe("success");
    expect(design.outputs.html).toEqual({
      status: "error",
      error: "DDS Schema: schema unavailable; Sketch fallback: HTML minification failed",
    });
  });

  it("uses Sketch-derived layout for detailDetach designs", async () => {
    mockDesignList("detailDetach");

    const result = await analyze(["layout"]);
    const design = getStructured(result).designs[0];

    expect(design.status).toBe("success");
    expect(design.layout_source).toBe("sketch");
    expect(design.layout_summary).toContain("[textLayer]");
    expect(mocks.getDesignSchemaJson).not.toHaveBeenCalled();
    expect(mocks.getSketchJson).toHaveBeenCalledOnce();
  });

  it("returns the complete tree when layer_depth is all", async () => {
    const nestedLayer = (depth: number): Record<string, unknown> => ({
      type: depth === 0 ? "shapeLayer" : "groupLayer",
      name: `level-${depth}`,
      visible: true,
      frame: { x: depth, y: depth, width: 100, height: 100 },
      layers: depth === 0 ? [] : [nestedLayer(depth - 1)],
    });
    mocks.getSketchJson.mockResolvedValue({
      sketch: {
        artboard: {
          name: "Deep",
          frame: { width: 375, height: 812 },
          layers: [nestedLayer(6)],
        },
      },
      documentInfo: {},
    });

    const result = await analyze(["layers"], { layer_depth: "all" });
    const design = getStructured(result).designs[0];

    expect(design.status).toBe("success");
    expect(design.layer_depth).toBe("all");
    expect(design.layer_tree_truncated).toBe(false);
    expect(design.layer_tree).toContain("level-0");
  });

  it("preserves operation-specific errors and never renders Failed: Unknown", async () => {
    mocks.getDesignSchemaJson.mockRejectedValue(new Error("schema exploded"));
    mocks.getSketchJson.mockRejectedValue(new Error("sketch exploded"));

    const result = await analyze(["layout", "layers"]);
    const structured = getStructured(result);
    const text = getText(result);

    expect(structured.status).toBe("error");
    expect(result.isError).toBe(true);
    expect(structured.designs[0].errors).toEqual({
      layout: "DDS Schema: schema exploded; Sketch fallback: sketch exploded",
      layers: "sketch exploded",
    });
    expect(text).toContain("Layout failed: DDS Schema: schema exploded; Sketch fallback: sketch exploded");
    expect(text).toContain("Layers failed: sketch exploded");
    expect(text).not.toContain("Failed: Unknown");
  });

  it("processes slices when requested from analyze mode", async () => {
    const result = await analyze(["slices"]);
    const design = getStructured(result).designs[0];

    expect(design.status).toBe("success");
    expect(design.slices.totalSlices).toBe(0);
    expect(mocks.getSlices).toHaveBeenCalledOnce();
  });
});
