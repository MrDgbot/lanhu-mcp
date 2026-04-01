import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export type StyleCounterEntry = [value: string, count: number];

export interface ExtractedPageImage {
  src: string;
  type: 'bg' | 'img';
  w: string;
  h: string;
}

export interface PageDesignInfo {
  textColors: StyleCounterEntry[];
  bgColors: StyleCounterEntry[];
  fontSpecs: StyleCounterEntry[];
  images: ExtractedPageImage[];
}

export interface ExtractedPageContent {
  title: string;
  textLines: string[];
  pageText: string;
  designInfo: PageDesignInfo;
}

export interface ExtractPageContentOptions {
  resourceDir?: string;
  maxTextLineLength?: number;
  maxTextColors?: number;
  maxBgColors?: number;
  maxFontSpecs?: number;
  maxImages?: number;
}

type CounterMap = Map<string, number>;

const IGNORED_BLOCKS_PATTERN = /<\s*(script|style|noscript)\b[\s\S]*?<\s*\/\s*\1\s*>/gi;
const COMMENTS_PATTERN = /<!--[\s\S]*?-->/g;
const HEAD_PATTERN = /<head\b[\s\S]*?<\/head>/gi;
const TITLE_PATTERN = /<title\b[^>]*>([\s\S]*?)<\/title>/i;
const TAG_PATTERN = /<([a-zA-Z][\w:-]*)([^<>]*)>/g;
const GENERIC_TAG_PATTERN = /<[^>]+>/g;
const BLOCK_BREAK_PATTERN =
  /<\/?(address|article|aside|blockquote|br|button|caption|dd|div|dl|dt|fieldset|figcaption|figure|footer|form|h[1-6]|header|hr|label|li|main|nav|ol|p|section|table|td|th|tr|ul)\b[^>]*>/gi;
const ATTRIBUTE_PATTERN =
  /([^\s"'=<>\/`]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
const BACKGROUND_URL_PATTERN = /url\((['"]?)([^'")]+)\1\)/i;

const DEFAULT_OPTIONS: Required<ExtractPageContentOptions> = {
  resourceDir: '',
  maxTextLineLength: 200,
  maxTextColors: 15,
  maxBgColors: 10,
  maxFontSpecs: 15,
  maxImages: 30,
};

const HTML_ENTITY_MAP: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
};

function decodeHtmlEntities(input: string): string {
  return input.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (_, entity: string) => {
    if (entity.startsWith('#x') || entity.startsWith('#X')) {
      const codePoint = Number.parseInt(entity.slice(2), 16);
      return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : _;
    }

    if (entity.startsWith('#')) {
      const codePoint = Number.parseInt(entity.slice(1), 10);
      return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : _;
    }

    return HTML_ENTITY_MAP[entity] ?? _;
  });
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function incrementCounter(counter: CounterMap, key: string): void {
  counter.set(key, (counter.get(key) ?? 0) + 1);
}

function toMostCommon(counter: CounterMap, limit: number): StyleCounterEntry[] {
  return Array.from(counter.entries())
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, limit);
}

export function parseInlineStyle(styleText: string): Record<string, string> {
  const styles: Record<string, string> = {};
  if (!styleText) {
    return styles;
  }

  for (const part of styleText.split(';')) {
    const separatorIndex = part.indexOf(':');
    if (separatorIndex === -1) {
      continue;
    }

    const key = part.slice(0, separatorIndex).trim().toLowerCase();
    const value = part.slice(separatorIndex + 1).trim();
    if (!key || !value) {
      continue;
    }

    styles[key] = value;
  }

  return styles;
}

function parseAttributes(rawAttributes: string): Record<string, string> {
  const attributes: Record<string, string> = {};

  for (const match of rawAttributes.matchAll(ATTRIBUTE_PATTERN)) {
    const name = match[1]?.toLowerCase();
    if (!name) {
      continue;
    }

    const value = match[2] ?? match[3] ?? match[4] ?? '';
    attributes[name] = value;
  }

  return attributes;
}

function stripIgnoredBlocks(html: string): string {
  return html.replace(COMMENTS_PATTERN, '').replace(IGNORED_BLOCKS_PATTERN, '');
}

function extractTitle(html: string): string {
  const titleMatch = html.match(TITLE_PATTERN);
  if (!titleMatch?.[1]) {
    return '';
  }

  return normalizeWhitespace(decodeHtmlEntities(titleMatch[1].replace(GENERIC_TAG_PATTERN, ' ')));
}

function collectTextLines(html: string, maxLineLength: number): string[] {
  const withoutHead = html.replace(HEAD_PATTERN, ' ');
  const withLineBreaks = withoutHead.replace(BLOCK_BREAK_PATTERN, '\n');
  const plainText = decodeHtmlEntities(withLineBreaks.replace(GENERIC_TAG_PATTERN, ' '));

  const lines: string[] = [];
  const seen = new Set<string>();

  for (const candidate of plainText.split(/\n+/)) {
    const normalized = normalizeWhitespace(candidate);
    if (!normalized || normalized.length > maxLineLength || seen.has(normalized)) {
      continue;
    }

    seen.add(normalized);
    lines.push(normalized);
  }

  return lines;
}

function normalizeRecordedImageSource(src: string, resourceDir: string): string {
  const normalized = src.trim();
  if (!normalized || !resourceDir || normalized.startsWith('http://') || normalized.startsWith('https://')) {
    return normalized;
  }

  const localRelativePath = normalized.replace(/^\/+/, '');
  const localFile = resolve(resourceDir, localRelativePath);
  return existsSync(localFile) ? localRelativePath : normalized;
}

function recordImage(
  images: ExtractedPageImage[],
  seenImages: Set<string>,
  src: string,
  type: 'bg' | 'img',
  resourceDir: string,
  width = '?',
  height = '?',
): void {
  const normalized = src.trim();
  if (!normalized || normalized.startsWith('data:') || seenImages.has(normalized)) {
    return;
  }

  seenImages.add(normalized);
  images.push({
    src: normalizeRecordedImageSource(normalized, resourceDir),
    type,
    w: width || '?',
    h: height || '?',
  });
}

function collectStyleSummary(
  html: string,
  resourceDir: string,
  options: Required<ExtractPageContentOptions>,
): PageDesignInfo {
  const textColors: CounterMap = new Map();
  const bgColors: CounterMap = new Map();
  const fontSpecs: CounterMap = new Map();
  const images: ExtractedPageImage[] = [];
  const seenImages = new Set<string>();

  for (const match of html.matchAll(TAG_PATTERN)) {
    const tagName = (match[1] ?? '').toLowerCase();
    const attributes = parseAttributes(match[2] ?? '');
    const styles = parseInlineStyle(attributes.style ?? '');

    const color = styles.color;
    if (color) {
      incrementCounter(textColors, color);
    }

    const backgroundColor = styles['background-color'];
    if (backgroundColor && backgroundColor !== 'transparent' && backgroundColor !== 'rgba(0, 0, 0, 0)') {
      incrementCounter(bgColors, backgroundColor);
    }

    const fontSize = styles['font-size'];
    const fontWeight = styles['font-weight'];
    if (fontSize || fontWeight || color) {
      incrementCounter(fontSpecs, `${fontSize ?? '?'}|${fontWeight ?? '?'}|${color ?? '?'}`);
    }

    const backgroundImage = styles['background-image'] ?? styles.background ?? '';
    const backgroundMatch = backgroundImage.match(BACKGROUND_URL_PATTERN);
    if (backgroundMatch?.[2]) {
      recordImage(images, seenImages, backgroundMatch[2], 'bg', resourceDir);
    }

    if (tagName === 'img') {
      recordImage(
        images,
        seenImages,
        attributes.src ?? attributes['data-src'] ?? '',
        'img',
        resourceDir,
        attributes.width ?? '?',
        attributes.height ?? '?',
      );
    }
  }

  return {
    textColors: toMostCommon(textColors, options.maxTextColors),
    bgColors: toMostCommon(bgColors, options.maxBgColors),
    fontSpecs: toMostCommon(fontSpecs, options.maxFontSpecs),
    images: images.slice(0, options.maxImages),
  };
}

export function extractPageContentFromHtml(
  html: string,
  options: ExtractPageContentOptions = {},
): ExtractedPageContent {
  const mergedOptions = { ...DEFAULT_OPTIONS, ...options };
  const cleanedHtml = stripIgnoredBlocks(html);
  const title = extractTitle(cleanedHtml);
  const textLines = collectTextLines(cleanedHtml, mergedOptions.maxTextLineLength);
  const bodyText = textLines.join('\n').trim();
  const pageText = bodyText
    ? `[Full Page Text]\n${bodyText}`
    : 'WARNING: Page text is empty';
  const fullPageText = title ? `[Page Title]\n${title}\n\n${pageText}` : pageText;

  return {
    title,
    textLines,
    pageText: fullPageText,
    designInfo: collectStyleSummary(cleanedHtml, mergedOptions.resourceDir, mergedOptions),
  };
}

export function extractPageContentFromFile(
  htmlPath: string,
  options: ExtractPageContentOptions = {},
): ExtractedPageContent {
  const html = readFileSync(htmlPath, 'utf8');
  return extractPageContentFromHtml(html, options);
}
