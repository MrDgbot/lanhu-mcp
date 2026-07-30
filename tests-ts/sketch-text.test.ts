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

  it("uses layer.name only for legacy info textLayers without text fields", () => {
    const layer = {
      ddsType: "textLayer",
      name: "15s",
      visible: true,
      layerOriginFrame: { x: 32, y: 96, width: 360, height: 48 },
    };

    const withoutLegacyContext = normalizeSketchTextLayer(layer);
    const legacy = normalizeSketchTextLayer(layer, { allowLegacyLayerName: true });

    expect(withoutLegacyContext.value).toBeUndefined();
    expect(legacy.value).toMatchObject({
      text: "15s",
      source: "legacy-layer-name",
      runs: [{ text: "15s" }],
    });
    expect(legacy.warnings).toEqual([
      'Legacy info textLayer "15s" recovered text from layer.name but has no recognizable font or color style fields.',
    ]);
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
