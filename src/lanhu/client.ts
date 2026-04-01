import {
  type FetchLike,
  type LanhuApiEnvelope,
  type LanhuClientOptions,
  type LanhuDocumentInfo,
  type LanhuProjectMultiInfoPayload,
  type LanhuSchemaRevisionPayload,
  type LanhuUrlKind,
  type LanhuUrlParams,
  type UnknownRecord,
} from "../shared/types.js";

const DEFAULT_BASE_URL = "https://lanhuapp.com";
const DEFAULT_DDS_BASE_URL = "https://dds.lanhuapp.com";

type RequestParamValue = string | number | boolean | null | undefined;

type RequestParams = Record<string, RequestParamValue>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asNonEmptyString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function buildBaseHeaders(cookie?: string): Record<string, string> {
  return {
    "User-Agent":
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
    Referer: "https://lanhuapp.com/web/",
    Accept: "application/json, text/plain, */*",
    ...(cookie ? { Cookie: cookie } : {}),
    "sec-ch-ua":
      '"Chromium";v="142", "Google Chrome";v="142", "Not_A Brand";v="99"',
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-platform": '"macOS"',
    "request-from": "web",
    "real-path": "/item/project/product",
  };
}

export function createLanhuFetch(options: {
  cookie?: string;
  ddsCookie?: string;
  fetchImpl?: FetchLike;
} = {}): FetchLike {
  const fetchImpl = options.fetchImpl ?? fetch;

  return async (input, init) => {
    const url = input instanceof Request ? new URL(input.url) : new URL(String(input));
    const isDds = url.origin === DEFAULT_DDS_BASE_URL;
    const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
    const baseHeaders = isDds ? buildDdsHeaders(options.ddsCookie) : buildBaseHeaders(options.cookie);

    for (const [key, value] of Object.entries(baseHeaders)) {
      if (!headers.has(key)) {
        headers.set(key, value);
      }
    }

    return fetchImpl(input as string | URL | Request, {
      ...init,
      headers,
    });
  };
}

function buildDdsHeaders(cookie?: string): Record<string, string> {
  return {
    "User-Agent":
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
    Accept: "application/json, text/plain, */*",
    Referer: "https://dds.lanhuapp.com/",
    Authorization: "Basic dW5kZWZpbmVkOg==",
    ...(cookie ? { Cookie: cookie } : {}),
  };
}

function detectUrlKind(route?: string): LanhuUrlKind {
  if (!route) {
    return "unknown";
  }
  if (route.includes("/invite")) {
    return "invite";
  }
  if (route.includes("/stage") || route.includes("/detailDetach")) {
    return "design";
  }
  if (route.includes("/product")) {
    return "prototype";
  }
  return "unknown";
}

export function isLanhuSuccessCode(code: unknown): boolean {
  return code === 0 || code === "0" || code === "00000";
}

export function parseLanhuUrl(input: string): LanhuUrlParams {
  const rawUrl = input.trim();
  if (!rawUrl) {
    throw new Error("Lanhu URL is required");
  }

  let route: string | undefined;
  let queryString = rawUrl;

  if (/^https?:\/\//i.test(rawUrl)) {
    const parsed = new URL(rawUrl);
    const fragment = parsed.hash.startsWith("#") ? parsed.hash.slice(1) : parsed.hash;

    if (fragment) {
      const [fragmentRoute, fragmentQuery = ""] = fragment.split("?", 2);
      route = fragmentRoute || undefined;
      queryString = fragmentQuery || "";
    } else {
      route = parsed.pathname || undefined;
      queryString = parsed.search.startsWith("?") ? parsed.search.slice(1) : parsed.search;
    }
  } else if (rawUrl.startsWith("?")) {
    queryString = rawUrl.slice(1);
  } else if (rawUrl.includes("?")) {
    const [inlineRoute, inlineQuery = ""] = rawUrl.split("?", 2);
    route = inlineRoute || undefined;
    queryString = inlineQuery;
  }

  const searchParams = new URLSearchParams(queryString);
  const rawParams = Object.fromEntries(searchParams.entries());
  const teamId = rawParams.tid ?? rawParams.teamId ?? rawParams.team_id;
  const projectId = rawParams.pid ?? rawParams.project_id;
  const docId = rawParams.docId ?? rawParams.image_id;
  const versionId = rawParams.versionId;

  if (!projectId) {
    throw new Error("URL parsing failed: missing required param pid (project_id)");
  }
  if (!teamId) {
    throw new Error("URL parsing failed: missing required param tid (team_id)");
  }

  return {
    rawUrl,
    route,
    kind: detectUrlKind(route),
    teamId,
    projectId,
    docId,
    imageId: docId,
    versionId,
    rawParams,
  };
}

export class LanhuApiError extends Error {
  readonly code?: string | number;
  readonly requestUrl?: string;

  constructor(message: string, options: { code?: string | number; requestUrl?: string } = {}) {
    super(message);
    this.name = "LanhuApiError";
    this.code = options.code;
    this.requestUrl = options.requestUrl;
  }
}

export class LanhuClient {
  readonly baseUrl: string;
  readonly ddsBaseUrl: string;

  private readonly cookie?: string;
  private readonly ddsCookie?: string;
  private readonly fetchImpl: FetchLike;

  constructor(options: LanhuClientOptions = {}) {
    this.baseUrl = options.baseUrl ?? DEFAULT_BASE_URL;
    this.ddsBaseUrl = options.ddsBaseUrl ?? DEFAULT_DDS_BASE_URL;
    this.cookie = options.cookie;
    this.ddsCookie = options.ddsCookie;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async getLanhuPayload<T extends UnknownRecord>(
    resource: string,
    params?: RequestParams,
    dds = false,
  ): Promise<T> {
    const envelope = await this.requestJson<LanhuApiEnvelope<T>>(resource, { params, dds });

    if (!isLanhuSuccessCode(envelope.code)) {
      throw new LanhuApiError(`Lanhu API Error: ${envelope.msg ?? "unknown error"}`, {
        code: envelope.code,
        requestUrl: this.toUrl(resource, params, dds).toString(),
      });
    }

    const payload = envelope.data ?? envelope.result;
    if (!isRecord(payload)) {
      throw new LanhuApiError("Lanhu API returned an empty payload", {
        code: envelope.code,
        requestUrl: this.toUrl(resource, params, dds).toString(),
      });
    }

    return payload as T;
  }

  async getJson<T>(resource: string, options: { dds?: boolean; params?: RequestParams } = {}): Promise<T> {
    return this.requestJson<T>(resource, options);
  }

  async getDocumentInfo(projectId: string, docId: string): Promise<LanhuDocumentInfo> {
    return this.getLanhuPayload<LanhuDocumentInfo>("/api/project/image", {
      pid: projectId,
      image_id: docId,
    });
  }

  async getDesignDocument(
    imageId: string,
    teamId: string,
    projectId: string,
  ): Promise<LanhuDocumentInfo> {
    return this.getLanhuPayload<LanhuDocumentInfo>("/api/project/image", {
      dds_status: 1,
      image_id: imageId,
      team_id: teamId,
      project_id: projectId,
    });
  }

  async getProjectMultiInfo(
    projectId: string,
    teamId: string,
    extraParams: RequestParams = {},
  ): Promise<LanhuProjectMultiInfoPayload> {
    return this.getLanhuPayload<LanhuProjectMultiInfoPayload>("/api/project/multi_info", {
      project_id: projectId,
      team_id: teamId,
      ...extraParams,
    });
  }

  async getDdsSchemaRevision(versionId: string): Promise<LanhuSchemaRevisionPayload> {
    return this.getLanhuPayload<LanhuSchemaRevisionPayload>("/api/dds/image/store_schema_revise", {
      version_id: versionId,
    }, true);
  }

  private toUrl(resource: string, params?: RequestParams, dds = false): URL {
    const url = resource.startsWith("http://") || resource.startsWith("https://")
      ? new URL(resource)
      : new URL(resource, dds ? this.ddsBaseUrl : this.baseUrl);

    for (const [key, value] of Object.entries(params ?? {})) {
      if (value === undefined || value === null) {
        continue;
      }
      url.searchParams.set(key, String(value));
    }

    return url;
  }

  private async requestJson<T>(
    resource: string,
    options: { params?: RequestParams; dds?: boolean } = {},
  ): Promise<T> {
    const url = this.toUrl(resource, options.params, options.dds);
    const response = await this.fetchImpl(url, {
      headers: options.dds ? buildDdsHeaders(this.ddsCookie) : buildBaseHeaders(this.cookie),
    });

    if (!response.ok) {
      throw new LanhuApiError(`Request failed with status ${response.status}`, {
        requestUrl: url.toString(),
      });
    }

    return response.json() as Promise<T>;
  }
}

export function pickNestedString(
  value: unknown,
  keys: readonly string[],
  maxDepth = 3,
): string | undefined {
  const visited = new Set<unknown>();

  function walk(current: unknown, depth: number): string | undefined {
    if (!isRecord(current) || depth > maxDepth || visited.has(current)) {
      return undefined;
    }
    visited.add(current);

    for (const key of keys) {
      const candidate = asNonEmptyString(current[key]);
      if (candidate) {
        return candidate;
      }
    }

    for (const nested of Object.values(current)) {
      const found = walk(nested, depth + 1);
      if (found) {
        return found;
      }
    }

    return undefined;
  }

  return walk(value, 0);
}
