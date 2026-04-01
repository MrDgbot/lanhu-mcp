import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

import {
  extractPageContentFromFile,
  type ExtractedPageContent,
} from '../transform/page-static-extractor.js';

const BASE_URL = 'https://lanhuapp.com';
const CDN_URL = 'https://axure-file.lanhuapp.com';
const CACHE_META_FILE = '.lanhu-page-cache.json';

type JsonRecord = Record<string, unknown>;

export interface LanhuUrlParams {
  team_id: string;
  project_id: string;
  doc_id?: string;
  version_id?: string;
}

export interface LanhuPageEntry {
  index: number;
  name: string;
  filename: string;
  id: string;
  type: string;
  level: number;
  folder: string;
  path: string;
  has_children: boolean;
}

export interface LanhuPagesListResult extends JsonRecord {
  document_id?: string;
  document_name: string;
  document_type: string;
  total_pages: number;
  max_level: number;
  pages_with_children: number;
  folder_statistics: Record<string, number>;
  pages: LanhuPageEntry[];
}

export interface DownloadResourcesResult {
  status: 'downloaded' | 'cached';
  version_id: string;
  reason: 'first_download' | 'version_changed' | 'up_to_date' | 'files_missing';
  output_dir: string;
}

export interface AnalyzeLocalPageResult {
  page_name: string;
  success: boolean;
  page_text?: string;
  page_design_info?: ExtractedPageContent['designInfo'];
  title?: string;
  text_lines?: string[];
  error?: string;
}

export interface FetchLike {
  (input: string | URL, init?: RequestInit): Promise<Response>;
}

interface CacheMeta extends JsonRecord {
  version_id?: string;
  document_id?: string;
  document_name?: string;
  download_time?: string;
  pages?: string[];
  total_files?: number;
}

function isJsonRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function toStringValue(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function toRecord(value: unknown): JsonRecord {
  return isJsonRecord(value) ? value : {};
}

function buildUrl(url: string, params?: Record<string, string | number | undefined>): string {
  if (!params) {
    return url;
  }

  const built = new URL(url);
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') {
      continue;
    }

    built.searchParams.set(key, String(value));
  }

  return built.toString();
}

async function fetchJson(
  fetchImpl: FetchLike,
  url: string,
  params?: Record<string, string | number | undefined>,
): Promise<JsonRecord> {
  const response = await fetchImpl(buildUrl(url, params));
  if (!response.ok) {
    throw new Error(`Request failed: ${response.status} ${response.statusText}`);
  }

  const payload = await response.json();
  return toRecord(payload);
}

async function fetchText(fetchImpl: FetchLike, url: string): Promise<string> {
  const response = await fetchImpl(url);
  if (!response.ok) {
    throw new Error(`Request failed: ${response.status} ${response.statusText}`);
  }

  return response.text();
}

async function fetchBytes(fetchImpl: FetchLike, url: string): Promise<Uint8Array> {
  const response = await fetchImpl(url);
  if (!response.ok) {
    throw new Error(`Request failed: ${response.status} ${response.statusText}`);
  }

  return new Uint8Array(await response.arrayBuffer());
}

function isSuccessCode(code: unknown): boolean {
  return code === 0 || code === '0' || code === '00000';
}

function normalizeAssetUrl(signMd5: string): string {
  return signMd5.startsWith('http://') || signMd5.startsWith('https://')
    ? signMd5
    : `${CDN_URL}/${signMd5}`;
}

export function parseLanhuPageUrl(url: string): LanhuUrlParams {
  let parsedInput = url.trim();
  if (parsedInput.startsWith('http')) {
    const parsedUrl = new URL(parsedInput);
    if (!parsedUrl.hash) {
      throw new Error('Invalid Lanhu URL: missing fragment part');
    }

    const fragment = parsedUrl.hash.startsWith('#') ? parsedUrl.hash.slice(1) : parsedUrl.hash;
    parsedInput = fragment.includes('?') ? fragment.split('?', 2)[1] : fragment;
  }

  if (parsedInput.startsWith('?')) {
    parsedInput = parsedInput.slice(1);
  }

  const searchParams = new URLSearchParams(parsedInput);
  const teamId = searchParams.get('tid') ?? searchParams.get('teamId') ?? searchParams.get('team_id');
  const projectId = searchParams.get('pid') ?? searchParams.get('project_id');
  const docId = searchParams.get('docId') ?? searchParams.get('image_id') ?? undefined;
  const versionId = searchParams.get('versionId') ?? undefined;

  if (!projectId) {
    throw new Error('URL parsing failed: missing required param pid (project_id)');
  }

  if (!teamId) {
    throw new Error('URL parsing failed: missing required param tid (team_id)');
  }

  return {
    team_id: teamId,
    project_id: projectId,
    doc_id: docId,
    version_id: versionId,
  };
}

export async function getDocumentInfo(
  fetchImpl: FetchLike,
  projectId: string,
  docId?: string,
): Promise<JsonRecord> {
  const payload = await fetchJson(fetchImpl, `${BASE_URL}/api/project/image`, {
    pid: projectId,
    image_id: docId,
  });

  const code = payload.code;
  if (!isSuccessCode(code)) {
    throw new Error(`API Error: ${String(payload.msg ?? 'unknown error')} (code=${String(code)})`);
  }

  return toRecord(payload.data ?? payload.result);
}

function extractPagesFromSitemap(rootNodes: unknown): LanhuPageEntry[] {
  const pages: LanhuPageEntry[] = [];

  const visit = (
    nodes: unknown,
    parentPath = '',
    level = 0,
    parentFolder: string | undefined = undefined,
  ): void => {
    if (!Array.isArray(nodes)) {
      return;
    }

    for (const node of nodes) {
      const record = toRecord(node);
      const pageName = toStringValue(record.pageName);
      const filename = toStringValue(record.url);
      const nodeType = toStringValue(record.type) || 'Wireframe';
      const nodeId = toStringValue(record.id);
      const children = Array.isArray(record.children) ? record.children : [];
      const currentPath = parentPath ? `${parentPath}/${pageName}` : pageName;
      const isPureFolder = nodeType === 'Folder' && !filename;

      if (pageName && filename) {
        pages.push({
          index: pages.length + 1,
          name: pageName,
          filename,
          id: nodeId,
          type: nodeType,
          level,
          folder: parentFolder ?? 'root',
          path: currentPath,
          has_children: children.length > 0,
        });
      }

      if (children.length > 0) {
        visit(children, currentPath, level + 1, isPureFolder ? pageName : parentFolder);
      }
    }
  };

  visit(rootNodes);
  return pages;
}

function formatChinaTime(value: unknown): string | undefined {
  if (typeof value !== 'string' || !value) {
    return undefined;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  const formatter = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Shanghai',
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  return formatter.format(date);
}

export async function listPages(fetchImpl: FetchLike, url: string): Promise<LanhuPagesListResult> {
  const params = parseLanhuPageUrl(url);
  const docInfo = await getDocumentInfo(fetchImpl, params.project_id, params.doc_id);

  let projectInfo: JsonRecord | undefined;
  try {
    const payload = await fetchJson(fetchImpl, `${BASE_URL}/api/project/multi_info`, {
      project_id: params.project_id,
      team_id: params.team_id,
      doc_info: 1,
    });
    if (payload.code === '00000') {
      projectInfo = toRecord(payload.result);
    }
  } catch {
    projectInfo = undefined;
  }

  const versions = Array.isArray(docInfo.versions) ? docInfo.versions : [];
  if (versions.length === 0) {
    throw new Error('Document version info not found');
  }

  const latestVersion = toRecord(versions[0]);
  const jsonUrl = toStringValue(latestVersion.json_url);
  if (!jsonUrl) {
    throw new Error('Mapping JSON URL not found');
  }

  const projectMapping = await fetchJson(fetchImpl, jsonUrl);
  const sitemap = toRecord(projectMapping.sitemap);
  const pages = extractPagesFromSitemap(sitemap.rootNodes);

  const folderStatistics: Record<string, number> = {};
  let maxLevel = 0;
  let pagesWithChildren = 0;

  for (const page of pages) {
    folderStatistics[page.folder] = (folderStatistics[page.folder] ?? 0) + 1;
    maxLevel = Math.max(maxLevel, page.level);
    if (page.has_children) {
      pagesWithChildren += 1;
    }
  }

  const result: LanhuPagesListResult = {
    document_id: params.doc_id,
    document_name: toStringValue(docInfo.name) || 'Unknown',
    document_type: toStringValue(docInfo.type) || 'axure',
    total_pages: pages.length,
    max_level: maxLevel,
    pages_with_children: pagesWithChildren,
    folder_statistics: folderStatistics,
    pages,
  };

  const createTime = formatChinaTime(docInfo.create_time);
  if (createTime) {
    result.create_time = createTime;
  }

  const updateTime = formatChinaTime(docInfo.update_time);
  if (updateTime) {
    result.update_time = updateTime;
  }

  result.total_versions = versions.length;
  const latestVersionInfo = latestVersion.version_info;
  if (latestVersionInfo !== undefined) {
    result.latest_version = latestVersionInfo;
  }

  if (projectInfo) {
    if (projectInfo.creator_name !== undefined) {
      result.creator_name = projectInfo.creator_name;
    }
    if (projectInfo.folder_name !== undefined) {
      result.folder_name = projectInfo.folder_name;
    }
    if (projectInfo.save_path !== undefined) {
      result.project_path = projectInfo.save_path;
    }
    if (projectInfo.member_cnt !== undefined) {
      result.member_count = projectInfo.member_cnt;
    }
  }

  return result;
}

async function ensureParentDir(filePath: string): Promise<void> {
  await mkdir(dirname(filePath), { recursive: true });
}

async function saveJson(filePath: string, payload: unknown): Promise<void> {
  await ensureParentDir(filePath);
  await writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

async function loadCacheMeta(outputDir: string): Promise<CacheMeta> {
  const metaPath = join(outputDir, CACHE_META_FILE);
  if (!existsSync(metaPath)) {
    return {};
  }

  try {
    const content = await readFile(metaPath, 'utf8');
    const parsed = JSON.parse(content);
    return isJsonRecord(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

async function saveCacheMeta(outputDir: string, meta: CacheMeta): Promise<void> {
  await saveJson(join(outputDir, CACHE_META_FILE), meta);
}

function collectExpectedFiles(projectMapping: JsonRecord): string[] {
  const pages = toRecord(projectMapping.pages);
  const expected = new Set<string>();

  for (const htmlFilename of Object.keys(pages)) {
    expected.add(htmlFilename);
  }

  for (const directory of ['data', 'resources', 'files', 'images']) {
    expected.add(directory);
  }

  return Array.from(expected);
}

function shouldUpdateCache(outputDir: string, projectMapping: JsonRecord): {
  needUpdate: boolean;
  reason: DownloadResourcesResult['reason'];
  missingFiles: string[];
} {
  const metaPath = join(outputDir, CACHE_META_FILE);
  if (!existsSync(metaPath)) {
    return { needUpdate: true, reason: 'first_download', missingFiles: [] };
  }

  const expectedFiles = collectExpectedFiles(projectMapping);
  const missingFiles = expectedFiles.filter((relativePath) => !existsSync(join(outputDir, relativePath)));

  return {
    needUpdate: missingFiles.length > 0,
    reason: missingFiles.length > 0 ? 'files_missing' : 'up_to_date',
    missingFiles,
  };
}

async function downloadFile(fetchImpl: FetchLike, url: string, localPath: string): Promise<void> {
  try {
    const bytes = await fetchBytes(fetchImpl, url);
    await ensureParentDir(localPath);
    await writeFile(localPath, bytes);
  } catch {
    // Keep parity with Python: best effort resource download.
  }
}

async function downloadPageResources(
  fetchImpl: FetchLike,
  pageMapping: JsonRecord,
  outputDir: string,
  skipDocumentJs: boolean,
): Promise<void> {
  const tasks: Promise<void>[] = [];

  const scheduleGroup = (groupName: 'styles' | 'scripts' | 'images'): void => {
    const group = toRecord(pageMapping[groupName]);
    for (const [localPath, info] of Object.entries(group)) {
      const asset = toRecord(info);
      if (groupName === 'scripts' && skipDocumentJs && localPath === 'data/document.js') {
        continue;
      }

      const signMd5 = toStringValue(asset.sign_md5);
      if (!signMd5) {
        continue;
      }

      tasks.push(downloadFile(fetchImpl, normalizeAssetUrl(signMd5), join(outputDir, localPath)));
    }
  };

  scheduleGroup('styles');
  scheduleGroup('scripts');
  scheduleGroup('images');

  await Promise.all(tasks);
}

export async function downloadResources(
  fetchImpl: FetchLike,
  url: string,
  outputDir: string,
  forceUpdate = false,
): Promise<DownloadResourcesResult> {
  const params = parseLanhuPageUrl(url);
  const docInfo = await getDocumentInfo(fetchImpl, params.project_id, params.doc_id);
  const versions = Array.isArray(docInfo.versions) ? docInfo.versions : [];

  if (versions.length === 0) {
    throw new Error('Document version info not found');
  }

  const versionInfo = toRecord(versions[0]);
  const versionId = toStringValue(versionInfo.id);
  const jsonUrl = toStringValue(versionInfo.json_url);
  if (!jsonUrl) {
    throw new Error('Mapping JSON URL not found');
  }
  const projectMapping = await fetchJson(fetchImpl, jsonUrl);
  const outputExisted = existsSync(outputDir);

  if (!forceUpdate && outputExisted) {
    const cacheMeta = await loadCacheMeta(outputDir);
    if (cacheMeta.version_id === versionId) {
      const cacheState = shouldUpdateCache(outputDir, projectMapping);
      if (!cacheState.needUpdate) {
        return {
          status: 'cached',
          version_id: versionId,
          reason: cacheState.reason,
          output_dir: outputDir,
        };
      }
    }
  }

  await mkdir(outputDir, { recursive: true });

  const pages = toRecord(projectMapping.pages);
  let isFirstPage = true;
  const downloadedFiles: string[] = [];

  for (const [htmlFilename, pageInfo] of Object.entries(pages)) {
    const pageRecord = toRecord(pageInfo);
    const htmlData = toRecord(pageRecord.html);
    const htmlFileWithMd5 = toStringValue(htmlData.sign_md5);
    const pageMappingMd5 = toStringValue(pageRecord.mapping_md5);

    if (!htmlFileWithMd5) {
      continue;
    }

    const htmlContent = await fetchText(fetchImpl, normalizeAssetUrl(htmlFileWithMd5));
    if (pageMappingMd5) {
      const pageMapping = await fetchJson(fetchImpl, normalizeAssetUrl(pageMappingMd5));
      await downloadPageResources(fetchImpl, pageMapping, outputDir, !isFirstPage);
      isFirstPage = false;
    }

    await ensureParentDir(join(outputDir, htmlFilename));
    await writeFile(join(outputDir, htmlFilename), htmlContent, 'utf8');
    downloadedFiles.push(htmlFilename);
  }

  await saveCacheMeta(outputDir, {
    version_id: versionId,
    document_id: params.doc_id,
    document_name: toStringValue(docInfo.name) || 'Unknown',
    download_time: new Date().toISOString(),
    pages: Object.keys(pages),
    total_files: downloadedFiles.length,
  });

  return {
    status: 'downloaded',
    version_id: versionId,
    reason: outputExisted ? 'version_changed' : 'first_download',
    output_dir: outputDir,
  };
}

export async function analyzeLocalPage(
  resourceDir: string,
  pageName: string,
): Promise<AnalyzeLocalPageResult> {
  const htmlPath = join(resourceDir, `${pageName}.html`);
  if (!existsSync(htmlPath)) {
    return {
      page_name: pageName,
      success: false,
      error: `Page ${pageName} does not exist`,
    };
  }

  try {
    const extracted = extractPageContentFromFile(htmlPath, { resourceDir });
    return {
      page_name: pageName,
      success: true,
      page_text: extracted.pageText,
      page_design_info: extracted.designInfo,
      title: extracted.title,
      text_lines: extracted.textLines,
    };
  } catch (error) {
    return {
      page_name: pageName,
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
