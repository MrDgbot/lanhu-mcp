import { describe, expect, it } from "vitest";

import { LanhuClient, parseLanhuUrl } from "../src/lanhu/client.js";
import { getSketchJson, listDesigns } from "../src/lanhu/designs.js";

function createJsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: {
      "content-type": "application/json",
    },
  });
}

describe("parseLanhuUrl", () => {
  it("parses detailDetach URLs with image_id", () => {
    const parsed = parseLanhuUrl(
      "https://lanhuapp.com/web/#/item/project/detailDetach?tid=team-1&pid=project-1&image_id=image-1",
    );

    expect(parsed.kind).toBe("design");
    expect(parsed.route).toBe("/item/project/detailDetach");
    expect(parsed.teamId).toBe("team-1");
    expect(parsed.projectId).toBe("project-1");
    expect(parsed.docId).toBe("image-1");
    expect(parsed.imageId).toBe("image-1");
  });

  it("allows detailDetach URLs without team id", () => {
    const parsed = parseLanhuUrl(
      "https://lanhuapp.com/web/#/item/project/detailDetach?pid=project-1&image_id=image-1",
    );

    expect(parsed.kind).toBe("design");
    expect(parsed.teamId).toBeUndefined();
    expect(parsed.projectId).toBe("project-1");
    expect(parsed.docId).toBe("image-1");
  });
});

describe("listDesigns", () => {
  it("uses HAR detail flow for detailDetach single-image links with team id", async () => {
    const seenRequests: string[] = [];
    const client = new LanhuClient({
      fetchImpl: async (input) => {
        const url = input instanceof Request ? new URL(input.url) : new URL(String(input));
        seenRequests.push(url.toString());

        if (url.pathname === "/api/project/multi_info") {
          expect(url.searchParams.get("project_id")).toBe("project-1");
          expect(url.searchParams.get("team_id")).toBe("team-1");
          expect(url.searchParams.get("img_limit")).toBe("1");
          expect(url.searchParams.get("detach")).toBe("1");

          return createJsonResponse({
            code: "00000",
            result: {
              name: "订单项目",
            },
          });
        }

        expect(url.pathname).toBe("/api/project/image");
        expect(url.searchParams.get("dds_status")).toBe("1");
        expect(url.searchParams.get("image_id")).toBe("image-1");
        expect(url.searchParams.get("team_id")).toBe("team-1");
        expect(url.searchParams.get("project_id")).toBe("project-1");
        expect(url.searchParams.get("all_versions")).toBe("0");

        return createJsonResponse({
          code: "00000",
          result: {
            id: "image-1",
            name: "详情页首图",
            width: 375,
            height: 812,
            url: "https://img.lanhuapp.com/XDCoverPNGORG/demo.png",
            update_time: "2026-03-31T10:00:00Z",
          },
        });
      },
    });

    const result = await listDesigns(
      client,
      "https://lanhuapp.com/web/#/item/project/detailDetach?tid=team-1&pid=project-1&image_id=image-1",
    );

    expect(seenRequests.map((requestUrl) => new URL(requestUrl).pathname)).toEqual([
      "/api/project/multi_info",
      "/api/project/image",
    ]);
    expect(result.source).toBe("detailDetach");
    expect(result.projectName).toBe("订单项目");
    expect(result.totalDesigns).toBe(1);
    expect(result.designs[0]).toMatchObject({
      id: "image-1",
      name: "详情页首图",
      width: 375,
      height: 812,
      url: "https://img.lanhuapp.com/XDCoverPNGORG/demo.png",
      source: "detailDetach",
    });
  });

  it("uses document detail flow for detailDetach links without team id", async () => {
    const client = new LanhuClient({
      fetchImpl: async (input) => {
        const url = input instanceof Request ? new URL(input.url) : new URL(String(input));

        expect(url.pathname).toBe("/api/project/image");
        expect(url.searchParams.get("pid")).toBe("project-1");
        expect(url.searchParams.get("image_id")).toBe("image-1");
        expect(url.searchParams.has("team_id")).toBe(false);

        return createJsonResponse({
          code: "00000",
          result: {
            id: "image-1",
            name: "详情页首图",
            url: "https://img.lanhuapp.com/XDCoverPNGORG/demo.png",
          },
        });
      },
    });

    const result = await listDesigns(
      client,
      "https://lanhuapp.com/web/#/item/project/detailDetach?pid=project-1&image_id=image-1",
    );

    expect(result.source).toBe("detailDetach");
    expect(result.params.teamId).toBeUndefined();
    expect(result.designs[0].url).toBe("https://img.lanhuapp.com/XDCoverPNGORG/demo.png");
  });

  it("maps /api/project/images into ordered design summaries", async () => {
    const client = new LanhuClient({
      fetchImpl: async (input) => {
        const url = input instanceof Request ? new URL(input.url) : new URL(String(input));

        expect(url.pathname).toBe("/api/project/images");
        expect(url.searchParams.get("project_id")).toBe("project-2");
        expect(url.searchParams.get("team_id")).toBe("team-2");
        expect(url.searchParams.get("dds_status")).toBe("1");
        expect(url.searchParams.get("position")).toBe("1");
        expect(url.searchParams.get("show_cb_src")).toBe("1");
        expect(url.searchParams.get("comment")).toBe("1");

        return createJsonResponse({
          code: "00000",
          data: {
            name: "订单设计稿",
            images: [
              {
                id: "image-a",
                name: "首页",
                width: 375,
                height: 812,
                url: "https://img.lanhuapp.com/home.png",
                has_comment: true,
                update_time: "2026-03-31T10:00:00Z",
              },
              {
                id: "image-b",
                name: "详情页",
                width: 390,
                height: 844,
                url: "https://img.lanhuapp.com/detail.png",
                has_comment: false,
                update_time: "2026-03-31T10:05:00Z",
              },
            ],
          },
        });
      },
    });

    const result = await listDesigns(
      client,
      "https://lanhuapp.com/web/#/item/project/stage?tid=team-2&pid=project-2",
    );

    expect(result.source).toBe("projectImages");
    expect(result.projectName).toBe("订单设计稿");
    expect(result.totalDesigns).toBe(2);
    expect(result.designs.map((design) => ({ index: design.index, id: design.id, name: design.name }))).toEqual([
      { index: 1, id: "image-a", name: "首页" },
      { index: 2, id: "image-b", name: "详情页" },
    ]);
  });
});

describe("getSketchJson", () => {
  it("loads Sketch JSON from detailDetach document info without team id", async () => {
    const seenPaths: string[] = [];
    const client = new LanhuClient({
      fetchImpl: async (input) => {
        const url = input instanceof Request ? new URL(input.url) : new URL(String(input));
        seenPaths.push(url.pathname);

        if (url.pathname === "/api/project/image") {
          expect(url.searchParams.get("pid")).toBe("project-1");
          expect(url.searchParams.get("image_id")).toBe("image-1");
          expect(url.searchParams.has("team_id")).toBe(false);

          return createJsonResponse({
            code: "00000",
            result: {
              id: "image-1",
              name: "首页",
              versions: [{
                id: "version-1",
                json_url: "https://assets.lanhuapp.com/XDJSON/demo.json",
              }],
            },
          });
        }

        expect(url.toString()).toBe("https://assets.lanhuapp.com/XDJSON/demo.json");
        return createJsonResponse({
          device: "iPhone",
          artboard: { layers: [] },
        });
      },
    });

    const result = await getSketchJson(client, "image-1", undefined, "project-1");

    expect(seenPaths).toEqual(["/api/project/image", "/XDJSON/demo.json"]);
    expect(result.versionId).toBe("version-1");
    expect(result.sketch).toMatchObject({ device: "iPhone" });
  });
});
