import { describe, expect, it } from "vitest";

import { extractFullAnnotationsFromSketch } from "../src/transform/sketch-annotations.js";
import {
  convertSketchToHtml,
  convertSketchToHtmlMinified,
  inferDesignScale,
} from "../src/transform/sketch-to-html.js";

const minimalSketch = {
  device: "iPhone 12 @2x",
  psdName: "test_design.psd",
  board: {
    width: 750,
    height: 1334,
    fill: { color: { red: 255, green: 255, blue: 255 } },
    layers: [
      {
        type: "textLayer",
        name: "title",
        visible: true,
        left: 30,
        top: 100,
        width: 200,
        height: 40,
        textInfo: {
          text: "Hello World",
          color: { red: 51, green: 51, blue: 51 },
          size: 32,
          fontPostScriptName: "PingFangSC-Medium",
          fontStyleName: "Medium 500",
          bold: false,
          italic: false,
          justification: "left",
        },
        blendOptions: {},
        layerEffects: {},
      },
      {
        type: "shapeLayer",
        name: "bg_rect",
        visible: true,
        left: 0,
        top: 0,
        width: 750,
        height: 200,
        fill: { color: { red: 245, green: 245, blue: 245 } },
        blendOptions: {},
        layerEffects: {},
        path: {
          pathComponents: [{ origin: { radii: [20, 20, 0, 0] } }],
        },
      },
      {
        type: "layerSection",
        name: "icon_group",
        visible: true,
        left: 600,
        top: 50,
        width: 48,
        height: 48,
        images: {
          png_xxxhd: "https://cdn.lanhuapp.com/slices/icon.png",
        },
        blendOptions: {},
        layerEffects: {},
      },
      {
        type: "layer",
        name: "bg_image",
        visible: true,
        left: 0,
        top: 200,
        width: 750,
        height: 400,
        blendOptions: { opacity: { value: 80 } },
        layerEffects: {},
      },
      {
        type: "shapeLayer",
        name: "invisible_shape",
        visible: false,
        left: 0,
        top: 0,
        width: 100,
        height: 100,
        fill: {},
        blendOptions: {},
        layerEffects: {},
      },
    ],
  },
};

describe("convertSketchToHtml", () => {
  it("produces valid HTML with correct board dimensions at @2x", () => {
    const result = convertSketchToHtml(minimalSketch, 2.0, "https://cdn.example.com/design.png");

    expect(result.html).toContain("<!DOCTYPE html>");
    expect(result.html).toContain("width:375px");
    expect(result.html).toContain("height:667px");
    expect(result.html).toContain("background:url(https://cdn.example.com/design.png)");
  });

  it("renders text layers with correct CSS properties", () => {
    const result = convertSketchToHtml(minimalSketch, 2.0);

    expect(result.html).toContain("Hello World");
    expect(result.html).toContain("font-size:16px");
    expect(result.html).toContain('font-family:"PingFangSC-Medium"');
    expect(result.html).toContain("font-weight:500");
    expect(result.html).toContain("z-index:10");
  });

  it("extracts slice images into imageUrlMapping", () => {
    const result = convertSketchToHtml(minimalSketch, 2.0);

    expect(Object.keys(result.imageUrlMapping)).toHaveLength(1);
    const sliceEntry = Object.entries(result.imageUrlMapping)[0];
    expect(sliceEntry[0]).toContain("./assets/slices/");
    expect(sliceEntry[1]).toBe("https://cdn.lanhuapp.com/slices/icon.png");
  });

  it("generates layer annotations matching Python structure", () => {
    const result = convertSketchToHtml(minimalSketch, 2.0);

    expect(result.layerAnnotations.length).toBe(4);

    // Python uses reversed() iteration so layers appear bottom-to-top
    const textAnnot = result.layerAnnotations.find((a) => a.name === "title")!;
    expect(textAnnot.type).toBe("textLayer");
    expect(textAnnot.text).toBe("Hello World");
    expect(textAnnot.css.color).toBe("rgb(51,51,51)");
    expect(textAnnot.css["font-size"]).toBe("16px");

    const shapeAnnot = result.layerAnnotations.find((a) => a.name === "bg_rect")!;
    expect(shapeAnnot.css["border-radius"]).toBe("10px 10px 0px 0px");
    expect(shapeAnnot.css["background-color"]).toBe("rgb(245,245,245)");

    const sliceAnnot = result.layerAnnotations.find((a) => a.name === "icon_group")!;
    expect(sliceAnnot.slice_url).toBe("https://cdn.lanhuapp.com/slices/icon.png");
  });

  it("skips invisible layers", () => {
    const result = convertSketchToHtml(minimalSketch, 2.0);
    const names = result.layerAnnotations.map((a) => a.name);
    expect(names).not.toContain("invisible_shape");
  });

  it("applies opacity from blendOptions", () => {
    const result = convertSketchToHtml(minimalSketch, 2.0);
    const imgLayer = result.layerAnnotations.find((a) => a.name === "bg_image");
    expect(imgLayer?.css.opacity).toBe("0.8");
  });

  it("renders slice layers as <img> tags", () => {
    const result = convertSketchToHtml(minimalSketch, 2.0);
    expect(result.html).toMatch(/<img class="el\d+"/);
    expect(result.html).toContain('referrerpolicy="no-referrer"');
  });

  it("applies @3x scale correctly", () => {
    const result = convertSketchToHtml(minimalSketch, 3.0);
    expect(result.html).toContain("width:250px");
    expect(result.html).toContain("height:444.7px");
  });
});

describe("convertSketchToHtmlMinified", () => {
  it("returns minified HTML", () => {
    const result = convertSketchToHtmlMinified(minimalSketch, 2.0);
    expect(result.html).not.toContain("\n");
  });
});

describe("inferDesignScale", () => {
  it("returns 3.0 for @3x device strings", () => {
    expect(inferDesignScale("iPhone 14 Pro Max @3x")).toBe(3.0);
  });

  it("returns 1.0 for @1x device strings", () => {
    expect(inferDesignScale("Web @1x")).toBe(1.0);
  });

  it("defaults to 2.0 for unrecognized strings", () => {
    expect(inferDesignScale("iPhone 12")).toBe(2.0);
    expect(inferDesignScale("")).toBe(2.0);
  });
});

describe("extractFullAnnotationsFromSketch", () => {
  it("produces structured annotation text", () => {
    const annotations = extractFullAnnotationsFromSketch(minimalSketch, 2.0);

    expect(annotations).toContain("设计标注信息");
    expect(annotations).toContain("test_design.psd");
    expect(annotations).toContain("@2x");
    expect(annotations).toContain("375x667");
  });

  it("includes text layer details", () => {
    const annotations = extractFullAnnotationsFromSketch(minimalSketch, 2.0);

    expect(annotations).toContain("📝 文本图层:");
    expect(annotations).toContain('"Hello World"');
    expect(annotations).toContain("font-size: 16px");
    expect(annotations).toContain("font-family: PingFangSC-Medium");
  });

  it("includes shape layer details", () => {
    const annotations = extractFullAnnotationsFromSketch(minimalSketch, 2.0);

    expect(annotations).toContain("🔷 形状图层:");
    expect(annotations).toContain('"bg_rect"');
    expect(annotations).toContain("fill: rgb(245,245,245)");
  });

  it("includes image layer details", () => {
    const annotations = extractFullAnnotationsFromSketch(minimalSketch, 2.0);

    expect(annotations).toContain("🖼️ 图片/位图图层");
    expect(annotations).toContain('"bg_image"');
    expect(annotations).toContain("opacity: 80%");
  });

  it("includes design summary section", () => {
    const annotations = extractFullAnnotationsFromSketch(minimalSketch, 2.0);

    expect(annotations).toContain("🎨 设计汇总:");
    expect(annotations).toContain("使用颜色:");
    expect(annotations).toContain("字体/字号:");
  });

  it("skips invisible layers", () => {
    const annotations = extractFullAnnotationsFromSketch(minimalSketch, 2.0);
    expect(annotations).not.toContain("invisible_shape");
  });
});

describe("sketch with shadows and borders", () => {
  const sketchWithEffects = {
    device: "iPhone @2x",
    board: {
      width: 750,
      height: 1334,
      layers: [
        {
          type: "shapeLayer",
          name: "card",
          visible: true,
          left: 30,
          top: 200,
          width: 690,
          height: 300,
          fill: { color: { red: 255, green: 255, blue: 255 } },
          blendOptions: {},
          layerEffects: {
            dropShadow: {
              enabled: true,
              color: { red: 0, green: 0, blue: 0 },
              opacity: { value: 20 },
              distance: 4,
              blur: 12,
              chokeMatte: 0,
              localLightingAngle: { value: 90 },
            },
            frameFX: {
              enabled: true,
              size: 2,
              color: { red: 200, green: 200, blue: 200 },
            },
          },
          path: {
            pathComponents: [{ origin: { radii: [16, 16, 16, 16] } }],
          },
        },
      ],
    },
  };

  it("extracts shadow CSS", () => {
    const result = convertSketchToHtml(sketchWithEffects, 2.0);
    const annot = result.layerAnnotations[0];
    expect(annot.css["box-shadow"]).toContain("rgba(0,0,0,0.2)");
  });

  it("extracts border CSS", () => {
    const result = convertSketchToHtml(sketchWithEffects, 2.0);
    const annot = result.layerAnnotations[0];
    expect(annot.css.border).toContain("solid");
    expect(annot.css.border).toContain("rgb(200,200,200)");
  });

  it("extracts uniform border-radius", () => {
    const result = convertSketchToHtml(sketchWithEffects, 2.0);
    const annot = result.layerAnnotations[0];
    expect(annot.css["border-radius"]).toBe("8px");
  });
});

describe("edge cases", () => {
  it("handles empty board", () => {
    const result = convertSketchToHtml({ board: { layers: [] } }, 2.0);
    expect(result.html).toContain("<!DOCTYPE html>");
    expect(result.layerAnnotations).toHaveLength(0);
    expect(Object.keys(result.imageUrlMapping)).toHaveLength(0);
  });

  it("handles missing board", () => {
    const result = convertSketchToHtml({}, 2.0);
    expect(result.html).toContain("<!DOCTYPE html>");
    expect(result.layerAnnotations).toHaveLength(0);
  });

  it("handles zero-sized layers by flattening children", () => {
    const sketch = {
      board: {
        width: 750,
        height: 1334,
        layers: [
          {
            type: "layerSection",
            name: "wrapper",
            visible: true,
            width: 0,
            height: 0,
            layers: [
              {
                type: "textLayer",
                name: "nested_text",
                visible: true,
                left: 10,
                top: 10,
                width: 100,
                height: 30,
                textInfo: { text: "Nested", size: 28 },
                blendOptions: {},
                layerEffects: {},
              },
            ],
          },
        ],
      },
    };

    const result = convertSketchToHtml(sketch, 2.0);
    expect(result.layerAnnotations).toHaveLength(1);
    expect(result.layerAnnotations[0].name).toBe("nested_text");
    expect(result.layerAnnotations[0].text).toBe("Nested");
  });

  it("annotations handle missing board gracefully", () => {
    const annotations = extractFullAnnotationsFromSketch({}, 2.0);
    expect(annotations).toContain("设计标注信息");
    expect(annotations).toContain("0x0");
  });
});
