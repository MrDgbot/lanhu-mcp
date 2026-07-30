import { describe, expect, it } from "vitest";

import { normalizeSketchTextLayer } from "../src/transform/sketch-text.js";

describe("normalizeSketchTextLayer", () => {
  it("normalizes object textInfo used by board layers", () => {
    const result = normalizeSketchTextLayer({
      type: "textLayer",
      name: "title",
      textInfo: {
        text: "Object text",
        color: { red: 10, green: 20, blue: 30 },
        size: 28,
        fontName: "PingFang SC",
        fontPostScriptName: "PingFangSC-Medium",
        fontStyleName: "Medium",
        italic: false,
        justification: "right",
        leading: 36,
        tracking: 1.5,
      },
    });

    expect(result.warnings).toEqual([]);
    expect(result.value).toMatchObject({
      text: "Object text",
      fontName: "PingFangSC-Medium",
      source: "textInfo-object",
      style: {
        color: { red: 10, green: 20, blue: 30 },
        fontSize: 28,
        fontFamily: "PingFang SC",
        fontPostScriptName: "PingFangSC-Medium",
        fontWeight: 500,
        italic: false,
        alignment: "right",
        lineHeight: 36,
        letterSpacing: 1.5,
      },
    });
  });

  it("joins textInfo runs and preserves per-run styles", () => {
    const result = normalizeSketchTextLayer({
      ddsType: "textLayer",
      name: "loan status",
      textInfo: [
        {
          text: "Your loan ",
          color: { value: "rgba(20,30,40,1)" },
          font: {
            name: "SF Pro Display",
            postScriptName: "SFProDisplay-Regular",
            type: "Regular",
            size: 30,
            weight: 400,
            align: "center",
            lineHeight: { value: 38 },
            letterSpacing: { value: 0.5 },
          },
        },
        {
          text: "is ready",
          color: { value: "rgba(0,120,80,1)" },
          font: {
            name: "SF Pro Display",
            postScriptName: "SFProDisplay-SemiboldItalic",
            type: "Semibold Italic",
            size: 30,
            weight: 600,
            italic: true,
          },
        },
      ],
    });

    expect(result.warnings).toEqual([]);
    expect(result.value?.text).toBe("Your loan is ready");
    expect(result.value?.fontName).toBe("SF Pro Display");
    expect(result.value?.source).toBe("textInfo-array");
    expect(result.value?.runs).toEqual([
      expect.objectContaining({
        text: "Your loan ",
        fontFamily: "SF Pro Display",
        fontPostScriptName: "SFProDisplay-Regular",
        fontSize: 30,
        fontWeight: 400,
        alignment: "center",
        lineHeight: 38,
        letterSpacing: 0.5,
      }),
      expect.objectContaining({
        text: "is ready",
        color: { value: "rgba(0,120,80,1)" },
        fontPostScriptName: "SFProDisplay-SemiboldItalic",
        fontWeight: 600,
        italic: true,
      }),
    ]);
  });

  it("normalizes the existing artboard layer.text value and style format", () => {
    const result = normalizeSketchTextLayer({
      type: "textLayer",
      name: "artboard title",
      text: {
        value: "Artboard text",
        style: {
          color: { value: "#123456" },
          font: {
            name: "Inter-Regular",
            postScriptName: "Inter-Regular",
            type: "Regular",
            size: 24,
            align: "left",
            lineHeight: { value: 32 },
            letterSpacing: { value: 0.25 },
          },
        },
      },
    });

    expect(result.warnings).toEqual([]);
    expect(result.value).toMatchObject({
      text: "Artboard text",
      fontName: "Inter-Regular",
      source: "layer-text",
      style: {
        color: { value: "#123456" },
        fontSize: 24,
        fontFamily: "Inter-Regular",
        fontPostScriptName: "Inter-Regular",
        fontWeight: 400,
        italic: false,
        alignment: "left",
        lineHeight: 32,
        letterSpacing: 0.25,
      },
    });
  });

  it("distinguishes an explicit empty string from an unrecognized visible text layer", () => {
    const empty = normalizeSketchTextLayer({
      ddsType: "textLayer",
      name: "empty text",
      textInfo: [{ text: "", font: { size: 20 } }],
    });
    const unsupported = normalizeSketchTextLayer({
      ddsType: "textLayer",
      name: "Layer name is not content",
      textInfo: [{ font: { size: 20 } }],
    });

    expect(empty.value?.text).toBe("");
    expect(empty.warnings).toEqual([]);
    expect(unsupported.value).toBeUndefined();
    expect(unsupported.warnings).toEqual([
      "Unsupported visible textLayer \"Layer name is not content\": " +
        "textInfo array contains no string text values.",
    ]);
  });

  it("marks a generic legacy layer.name as heuristic even with complete text styles", () => {
    const layer = {
      ddsType: "textLayer",
      name: "Time",
      color: { value: "rgba(0,0,0,1)" },
      size: 15,
      justification: "center",
      visible: true,
      layerOriginFrame: { x: 21.3, y: 14, width: 54, height: 20 },
    };

    const withoutLegacyContext = normalizeSketchTextLayer(layer);
    const legacy = normalizeSketchTextLayer(layer, { allowLegacyLayerName: true });

    expect(withoutLegacyContext.value).toBeUndefined();
    expect(legacy.value).toMatchObject({
      text: "Time",
      source: "legacy-layer-name",
      runs: [{
        text: "Time",
        color: { value: "rgba(0,0,0,1)" },
        fontSize: 15,
        alignment: "center",
      }],
    });
    expect(legacy.warnings).toEqual([
      'Legacy info textLayer "Time": Text was recovered heuristically from layer.name and may be ' +
        "truncated or differ from rendered content.",
    ]);
    expect(legacy.tokenWarnings).toEqual([]);
  });

  it("marks a truncated legacy layer.name as heuristic instead of exact content", () => {
    const result = normalizeSketchTextLayer({
      ddsType: "textLayer",
      name: "Your loan amount is",
      color: { value: "rgba(51,51,51,1)" },
      size: 12,
      justification: "left",
      visible: true,
      layerOriginFrame: { x: 34, y: 254, width: 307, height: 14 },
    }, { allowLegacyLayerName: true });

    expect(result.value).toMatchObject({
      text: "Your loan amount is",
      source: "legacy-layer-name",
    });
    expect(result.warnings).toEqual([
      'Legacy info textLayer "Your loan amount is": Text was recovered heuristically from ' +
        "layer.name and may be truncated or differ from rendered content.",
    ]);
    expect(result.tokenWarnings).toEqual([]);
  });

  it("does not hide malformed textInfo behind the legacy layer.name fallback", () => {
    const result = normalizeSketchTextLayer({
      ddsType: "textLayer",
      name: "Layer name is not content",
      textInfo: [{ font: { size: 20 } }],
    }, { allowLegacyLayerName: true });

    expect(result.value).toBeUndefined();
    expect(result.warnings).toEqual([
      'Unsupported visible textLayer "Layer name is not content": ' +
        "textInfo array contains no string text values.",
    ]);
  });

  it("preserves an explicit empty string instead of replacing it with layer.name", () => {
    const result = normalizeSketchTextLayer({
      ddsType: "textLayer",
      name: "Decorative placeholder",
      textInfo: [{ text: "", font: { size: 20 } }],
    }, { allowLegacyLayerName: true });

    expect(result.value?.text).toBe("");
    expect(result.value?.source).toBe("textInfo-array");
    expect(result.warnings).toEqual([]);
  });
});
