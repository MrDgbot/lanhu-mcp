import { describe, expect, it } from "vitest";
import {
  extractDesignTokens,
  extractDesignTokensResult,
  extractLayerTree,
  extractLayerTreeResult,
} from "../src/transform/design-tokens.js";
import {
  legacyInfoSketch,
  unstyledLegacyInfoSketch,
} from "./fixtures/legacy-sketch.js";

const artboardSketch = {
  artboard: {
    name: "首页",
    frame: { width: 375, height: 812 },
    layers: [
      {
        type: "textLayer",
        name: "标题",
        visible: true,
        frame: { x: 16, y: 50, width: 200, height: 24 },
        style: {
          fills: [
            { color: { r: 38, g: 38, b: 38, a: 1, value: "rgba(38,38,38,1)" }, isEnabled: true },
          ],
          borders: [],
          shadows: [],
        },
        text: {
          value: "首页标题",
          style: {
            color: { r: 38, g: 38, b: 38, a: 1, value: "rgba(38,38,38,1)" },
            font: {
              postScriptName: "PingFang SC-Medium",
              name: "PingFang SC",
              type: "Medium",
              size: 18,
              bold: false,
              italic: false,
              lineHeight: { value: 24, unit: "pixels" },
              letterSpacing: { value: 0, unit: "pixels" },
            },
          },
        },
      },
      {
        type: "textLayer",
        name: "副标题",
        visible: true,
        frame: { x: 16, y: 80, width: 200, height: 18 },
        style: {
          fills: [
            { color: { r: 140, g: 140, b: 140, a: 1, value: "rgba(140,140,140,1)" }, isEnabled: true },
          ],
          borders: [],
          shadows: [],
        },
        text: {
          value: "副标题文字",
          style: {
            color: { r: 140, g: 140, b: 140, a: 1, value: "rgba(140,140,140,1)" },
            font: {
              postScriptName: "PingFang SC-Regular",
              name: "PingFang SC",
              type: "Regular",
              size: 14,
              bold: false,
              italic: false,
              lineHeight: { value: 18, unit: "pixels" },
              letterSpacing: { value: 0, unit: "pixels" },
            },
          },
        },
      },
      {
        type: "shapeLayer",
        name: "卡片背景",
        visible: true,
        frame: { x: 16, y: 120, width: 343, height: 200 },
        style: {
          fills: [{ color: { r: 255, g: 255, b: 255, a: 1, value: "rgba(255,255,255,1)" }, isEnabled: true }],
          borders: [{ color: { r: 230, g: 230, b: 230, a: 1, value: "rgba(230,230,230,1)" }, isEnabled: true, thickness: 1 }],
          shadows: [{ color: { r: 0, g: 0, b: 0, a: 0.08, value: "rgba(0,0,0,0.08)" }, isEnabled: true, offsetX: 0, offsetY: 2, blurRadius: 8, spread: 0 }],
        },
        radius: [8, 8, 8, 8],
        layers: [],
      },
    ],
  },
};

describe("extractDesignTokens (refactored)", () => {
  it("extracts font tokens from artboard text layers", () => {
    const tokens = extractDesignTokens(artboardSketch);
    expect(tokens).toContain("Fonts");
    expect(tokens).toContain("PingFang SC");
    expect(tokens).toContain("18px");
    expect(tokens).toContain("14px");
  });

  it("extracts color tokens from fills", () => {
    const tokens = extractDesignTokens(artboardSketch);
    expect(tokens).toContain("Colors");
    expect(tokens).toContain("rgba(38,38,38,1)");
    expect(tokens).toContain("rgba(140,140,140,1)");
    expect(tokens).toContain("rgba(255,255,255,1)");
  });

  it("extracts shadow tokens", () => {
    const tokens = extractDesignTokens(artboardSketch);
    expect(tokens).toContain("Shadows");
    expect(tokens).toContain("rgba(0,0,0,0.08)");
  });

  it("extracts border radius tokens", () => {
    const tokens = extractDesignTokens(artboardSketch);
    expect(tokens).toContain("Border Radius");
    expect(tokens).toContain("8px");
  });

  it("extracts border tokens", () => {
    const tokens = extractDesignTokens(artboardSketch);
    expect(tokens).toContain("Borders");
    expect(tokens).toContain("rgba(230,230,230,1)");
  });

  it("returns empty string for empty sketch", () => {
    const tokens = extractDesignTokens({ board: { layers: [] } });
    expect(tokens).toBe("");
  });

  it("rejects an unknown Sketch root", () => {
    expect(() => extractDesignTokens({ unexpected: [] })).toThrow(
      "Unsupported Sketch structure: expected board.layers, artboard.layers, or info array.",
    );
  });

  it("extracts complete legacy styles without degrading tokens for heuristic text", () => {
    const result = extractDesignTokensResult(legacyInfoSketch);

    expect(result.tokens).toContain("Colors (5 unique)");
    expect(result.tokens).toContain("Fonts (5 unique)");
    expect(result.tokens).toContain("rgba(16,128,61,1)");
    expect(result.tokens).toContain("40px");
    expect(result.warnings).toEqual([]);
  });

  it("reports missing styles independently from legacy text provenance", () => {
    const result = extractDesignTokensResult(unstyledLegacyInfoSketch);

    expect(result.tokens).not.toContain("Fonts");
    expect(result.tokens).not.toContain("Colors");
    expect(result.warnings).toEqual([
      'Legacy info textLayer "Your loan amount is" has no recognizable font or color style fields.',
    ]);
  });

  it("extracts font and text color tokens when legacy textInfo runs provide them", () => {
    const tokens = extractDesignTokens({
      info: [{
        ddsType: "textLayer",
        name: "Styled text",
        visible: true,
        textInfo: [{
          text: "Styled text",
          color: { value: "rgba(30,30,30,1)" },
          font: { name: "SF Pro Display", type: "Semibold", size: 32, weight: 600 },
        }],
      }],
    });

    expect(tokens).toContain("Fonts");
    expect(tokens).toContain("SF Pro Display");
    expect(tokens).toContain("600");
    expect(tokens).toContain("32px");
    expect(tokens).toContain("Colors");
    expect(tokens).toContain("rgba(30,30,30,1)");
  });
});

describe("extractLayerTree", () => {
  it("still works with artboard format", () => {
    const tree = extractLayerTree(artboardSketch);
    expect(tree).toContain("Artboard: 首页");
    expect(tree).toContain("textLayer: 标题");
    expect(tree).toContain("textLayer: 副标题");
    expect(tree).toContain("shapeLayer: 卡片背景");
  });

  it("reports truncation at the default depth and supports the complete tree", () => {
    const nestedLayer = (depth: number): Record<string, unknown> => ({
      type: depth === 0 ? "shapeLayer" : "groupLayer",
      name: `level-${depth}`,
      visible: true,
      frame: { x: depth, y: depth, width: 100, height: 100 },
      layers: depth === 0 ? [] : [nestedLayer(depth - 1)],
    });
    const deepSketch = {
      artboard: {
        name: "Deep",
        frame: { width: 375, height: 812 },
        layers: [nestedLayer(6)],
      },
    };

    const limited = extractLayerTreeResult(deepSketch);
    expect(limited.truncated).toBe(true);
    expect(limited.tree).not.toContain("level-0");
    expect(limited.tree).toContain("Layer tree truncated at depth 4");

    const complete = extractLayerTreeResult(deepSketch, "all");
    expect(complete.truncated).toBe(false);
    expect(complete.tree).toContain("level-0");
    expect(complete.tree).not.toContain("Layer tree truncated");
  });

  it("supports board-format Sketch data", () => {
    const result = extractLayerTreeResult({
      board: {
        name: "Detached",
        width: 750,
        height: 1334,
        layers: [
          {
            type: "shapeLayer",
            name: "Background",
            visible: true,
            left: 0,
            top: 0,
            width: 750,
            height: 1334,
          },
        ],
      },
    });

    expect(result.tree).toContain("Board: Detached (750x1334)");
    expect(result.tree).toContain("shapeLayer: Background");
  });

  it("supports legacy info-format Sketch data", () => {
    const result = extractLayerTreeResult(legacyInfoSketch);

    expect(result.tree).toContain("Legacy Sketch: Untitled (375x667)");
    expect(result.tree).toContain('textLayer: 15s');
    expect(result.tree).toContain('"15s"');
    expect(result.tree).toContain('"Your loan amount is"');
  });

  it("returns all production-shaped top-level legacy layers at depth 0", () => {
    const result = extractLayerTreeResult(legacyInfoSketch, 0);

    expect(result.tree).toContain('textLayer: 15s (64x49 @155,94) "15s"');
    expect(result.tree).toContain('textLayer: Your loan amount is (307x14 @34,254) "Your loan amount is"');
    expect(result.truncated).toBe(false);
  });
});
