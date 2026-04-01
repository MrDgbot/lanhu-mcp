import { describe, expect, it } from "vitest";

import { extractLayoutSummary } from "../src/transform/layout-summary.js";
import { convertSchemaToHtml, localizeImageUrls } from "../src/transform/schema-to-html.js";

const sampleSchema = {
  type: "div",
  props: {
    className: "screen",
    style: {
      width: 375,
      height: 812,
      display: "flex",
      flexDirection: "column",
      paddingTop: 16,
      paddingRight: 16,
      paddingBottom: 16,
      paddingLeft: 16,
    },
  },
  children: [
    {
      type: "lanhutext",
      props: {
        className: "title",
        style: {
          fontSize: 18,
          lineHeight: 26,
          fontWeight: 600,
          color: "#111111",
        },
      },
      data: {
        value: "待发车详情",
      },
      children: [],
    },
    {
      type: "lanhuimage",
      props: {
        className: "hero",
        style: {
          width: 120,
          height: 80,
        },
      },
      data: {
        value: "https://assets.lanhuapp.com/demo.png",
      },
      children: [],
    },
  ],
} as const;

describe("design transforms", () => {
  it("converts schema into html and localizes remote images", () => {
    const html = convertSchemaToHtml(sampleSchema);
    expect(html).toContain('<span class="title">待发车详情</span>');
    expect(html).toContain('src="https://assets.lanhuapp.com/demo.png"');

    const localized = localizeImageUrls(html);
    expect(localized.htmlCode).toContain("./assets/slices/img_1.png");
    expect(localized.imageUrlMapping["./assets/slices/img_1.png"]).toBe(
      "https://assets.lanhuapp.com/demo.png",
    );
  });

  it("extracts layout summary from schema nodes", () => {
    const summary = extractLayoutSummary(sampleSchema);
    expect(summary).toContain("[div] .screen w:375 h:812 flex-col pad:16px");
    expect(summary).toContain('[lanhutext] "待发车详情" .title font:18px/26px 600 #111111');
  });
});
