import { escapeHtml, minifyHtml } from "../shared/html.js";
import type { UnknownRecord } from "../shared/types.js";

const UNITLESS_PROPERTIES = new Set([
  "zIndex",
  "fontWeight",
  "opacity",
  "flex",
  "flexGrow",
  "flexShrink",
  "order",
]);

const COMMON_CSS_FOR_DESIGN = `
body * { box-sizing: border-box; flex-shrink: 0; }
body { font-family: PingFangSC-Regular, Roboto, Helvetica Neue, Helvetica, Tahoma, Arial, PingFang SC-Light, Microsoft YaHei; }
input { background-color: transparent; border: 0; }
button { margin: 0; padding: 0; border: 1px solid transparent; outline: none; background-color: transparent; }
button:active { opacity: 0.6; }
.flex-col { display: flex; flex-direction: column; }
.flex-row { display: flex; flex-direction: row; }
.justify-start { display: flex; justify-content: flex-start; }
.justify-center { display: flex; justify-content: center; }
.justify-end { display: flex; justify-content: flex-end; }
.justify-evenly { display: flex; justify-content: space-evenly; }
.justify-around { display: flex; justify-content: space-around; }
.justify-between { display: flex; justify-content: space-between; }
.align-start { display: flex; align-items: flex-start; }
.align-center { display: flex; align-items: center; }
.align-end { display: flex; align-items: flex-end; }
`;

type JsonLike = UnknownRecord;

function isRecord(value: unknown): value is JsonLike {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toStringValue(value: unknown): string {
  return value == null ? "" : String(value);
}

function camelToKebab(input: string): string {
  return input.replace(/([A-Z])/g, (_, char: string) => `-${char.toLowerCase()}`);
}

function formatCssValue(key: string, value: unknown): string {
  if (value == null) {
    return "";
  }
  if (typeof value === "number") {
    if (value === 0) {
      return "0";
    }
    return UNITLESS_PROPERTIES.has(key) ? String(value) : `${value}px`;
  }
  if (typeof value === "string") {
    if (/^\d+$/.test(value) && !UNITLESS_PROPERTIES.has(key)) {
      return value === "0" ? "0" : `${value}px`;
    }
    return value.replace(
      /rgba\(([\d.]+),\s*([\d.]+),\s*([\d.]+),\s*([\d.]+)\)/g,
      (_, r: string, g: string, b: string, a: string) => `rgba(${r}, ${g}, ${b}, ${Number(a)})`,
    );
  }
  return String(value);
}

function mergeBoxShorthand(
  styles: Record<string, unknown>,
  keys: [string, string, string, string],
  target: string,
): void {
  const [topKey, rightKey, bottomKey, leftKey] = keys;
  const values = [styles[topKey], styles[rightKey], styles[bottomKey], styles[leftKey]];
  if (values.some((value) => value == null)) {
    return;
  }

  const normalized = values.map((value) => Number(value ?? 0));
  if (normalized[0] === normalized[2] && normalized[1] === normalized[3]) {
    styles[target] =
      normalized[0] === normalized[1]
        ? `${normalized[0]}px`
        : `${normalized[0]}px ${normalized[1]}px`;
  } else {
    styles[target] = `${normalized[0]}px ${normalized[1]}px ${normalized[2]}px ${normalized[3]}px`;
  }

  for (const key of keys) {
    delete styles[key];
  }
}

function shouldUseFlex(node: JsonLike): boolean {
  const style = isRecord(node.style) ? node.style : {};
  const props = isRecord(node.props) ? node.props : {};
  const propsStyle = isRecord(props.style) ? props.style : {};
  const merged = { ...style, ...propsStyle };
  return merged.display === "flex" || merged.flexDirection != null;
}

function getFlexClasses(node: JsonLike): string[] {
  if (!shouldUseFlex(node)) {
    return [];
  }

  const style = isRecord(node.style) ? node.style : {};
  const props = isRecord(node.props) ? node.props : {};
  const propsStyle = isRecord(props.style) ? props.style : {};
  const merged = { ...style, ...propsStyle };
  const className = toStringValue(props.className);
  const classes: string[] = [];

  const flexDirection = merged.flexDirection;
  if (flexDirection === "column" || className.includes("flex-col")) {
    classes.push("flex-col");
  } else if (flexDirection === "row" || className.includes("flex-row")) {
    classes.push("flex-row");
  }

  const justify = (isRecord(node.alignJustify) ? node.alignJustify.justifyContent : undefined) ?? merged.justifyContent;
  const align = (isRecord(node.alignJustify) ? node.alignJustify.alignItems : undefined) ?? merged.alignItems;
  const justifyMap: Record<string, string> = {
    "space-between": "justify-between",
    center: "justify-center",
    "flex-end": "justify-end",
    "flex-start": "justify-start",
    "space-around": "justify-around",
    "space-evenly": "justify-evenly",
  };
  const alignMap: Record<string, string> = {
    "flex-start": "align-start",
    center: "align-center",
    "flex-end": "align-end",
  };

  if (typeof justify === "string" && justifyMap[justify]) {
    classes.push(justifyMap[justify]);
  }
  if (typeof align === "string" && alignMap[align]) {
    classes.push(alignMap[align]);
  }
  return classes;
}

function cleanStyles(node: JsonLike, flexClasses: string[]): Record<string, unknown> {
  const props = isRecord(node.props) ? node.props : {};
  const propsStyle = isRecord(props.style) ? { ...props.style } : {};
  const styles: Record<string, unknown> = {};
  const standardJustify = new Set(["flex-start", "center", "flex-end", "space-between", "space-around", "space-evenly"]);
  const standardAlign = new Set(["flex-start", "center", "flex-end"]);

  for (const [key, value] of Object.entries(propsStyle)) {
    if ((key === "display" || key === "flexDirection") && flexClasses.length > 0) {
      continue;
    }
    if (key === "justifyContent" && flexClasses.length > 0 && standardJustify.has(String(value))) {
      continue;
    }
    if (key === "alignItems" && flexClasses.length > 0 && standardAlign.has(String(value))) {
      continue;
    }
    if (key === "position" && value === "static") {
      continue;
    }
    if (key === "overflow" && value === "visible") {
      continue;
    }
    styles[key] = value;
  }

  mergeBoxShorthand(styles, ["paddingTop", "paddingRight", "paddingBottom", "paddingLeft"], "padding");
  mergeBoxShorthand(styles, ["marginTop", "marginRight", "marginBottom", "marginLeft"], "margin");
  return styles;
}

function getLoopArray(node: JsonLike): unknown[] {
  const value = node.loop ?? node.loopData;
  return Array.isArray(value) ? value : [];
}

function resolveLoopPlaceholder(value: string, loopItem: JsonLike | undefined): string {
  if (!loopItem) {
    return value;
  }
  const match = value.trim().match(/^this\.item\.(\w+)$/);
  if (!match) {
    return value;
  }
  return toStringValue(loopItem[match[1]]);
}

function generateCss(node: JsonLike, cssRules: Record<string, string>, loopSuffixes?: string[]): void {
  const loopArray = node.loopType ? getLoopArray(node) : [];
  const derivedSuffixes = loopArray.length > 0 && !loopSuffixes ? loopArray.map((_, index) => String(index)) : loopSuffixes;

  const props = isRecord(node.props) ? node.props : {};
  const className = toStringValue(props.className);
  if (className) {
    const flexClasses = getFlexClasses(node);
    const styles = cleanStyles(node, flexClasses);
    const cssProps = Object.entries(styles)
      .map(([key, value]) => {
        const cssValue = formatCssValue(key, value);
        return cssValue ? `  ${camelToKebab(key)}: ${cssValue};` : "";
      })
      .filter(Boolean)
      .join("\n");

    if (derivedSuffixes && derivedSuffixes.length > 0) {
      for (const suffix of derivedSuffixes) {
        cssRules[`${className}-${suffix}`] = cssProps;
      }
    } else {
      cssRules[className] = cssProps;
    }
  }

  const children = Array.isArray(node.children) ? node.children.filter(isRecord) : [];
  for (const child of children) {
    generateCss(child, cssRules, derivedSuffixes);
  }
}

function generateHtml(node: JsonLike, indent = 2, loopContext?: { items: JsonLike[]; index: number }): string {
  const spaces = " ".repeat(indent);
  const props = isRecord(node.props) ? node.props : {};
  const baseClassName = toStringValue(props.className);
  const className = loopContext && baseClassName ? `${baseClassName}-${loopContext.index}` : baseClassName;
  const allClasses = [className, ...getFlexClasses(node)].filter(Boolean).join(" ");
  const nodeType = toStringValue(node.type);

  if (nodeType === "lanhutext") {
    const rawText = toStringValue(isRecord(node.data) ? node.data.value : undefined) || toStringValue(props.text);
    const text = rawText.startsWith("this.item.") ? resolveLoopPlaceholder(rawText, loopContext?.items[loopContext.index]) : rawText;
    return `${spaces}<span class="${allClasses}">${escapeHtml(text)}</span>`;
  }

  if (nodeType === "lanhuimage") {
    const rawSrc = toStringValue(isRecord(node.data) ? node.data.value : undefined) || toStringValue(props.src);
    const src = rawSrc.startsWith("this.item.") ? resolveLoopPlaceholder(rawSrc, loopContext?.items[loopContext.index]) : rawSrc;
    return `${spaces}<img class="${allClasses}" referrerpolicy="no-referrer" src="${escapeHtml(src)}" />`;
  }

  const children = Array.isArray(node.children) ? node.children.filter(isRecord) : [];
  const loopArray = node.loopType ? getLoopArray(node).filter(isRecord) : [];

  if (loopArray.length > 0 && !loopContext) {
    const content = loopArray
      .map((_, index) => children.map((child) => generateHtml(child, indent + 2, { items: loopArray as JsonLike[], index })).join("\n"))
      .filter(Boolean)
      .join("\n");
    return `${spaces}<div class="${allClasses}">\n${content}\n${spaces}</div>`;
  }

  const tag = nodeType === "lanhubutton" ? "button" : "div";
  if (children.length > 0) {
    const content = children.map((child) => generateHtml(child, indent + 2, loopContext)).join("\n");
    return `${spaces}<${tag} class="${allClasses}">\n${content}\n${spaces}</${tag}>`;
  }
  return `${spaces}<${tag} class="${allClasses}"></${tag}>`;
}

export function convertSchemaToHtml(schema: UnknownRecord): string {
  const cssRules: Record<string, string> = {};
  generateCss(schema, cssRules);

  const cssString = Object.entries(cssRules)
    .map(([className, props]) => `.${className} {\n${props}\n}`)
    .join("\n\n")
    .concat(COMMON_CSS_FOR_DESIGN);

  const html = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Document</title>
    <style>
${cssString}
    </style>
  </head>
  <body>
${generateHtml(schema, 4)}
  </body>
</html>`;

  return minifyHtml(html);
}

export function localizeImageUrls(htmlCode: string): { htmlCode: string; imageUrlMapping: Record<string, string> } {
  const imageUrlMapping: Record<string, string> = {};
  let counter = 0;

  const makeLocalName = (remoteUrl: string): string => {
    const pathname = new URL(remoteUrl).pathname;
    const lastSegment = pathname.split("/").pop() ?? "";
    const ext = /\.(png|jpg|jpeg|gif|svg|webp)$/i.test(lastSegment)
      ? `.${lastSegment.split(".").pop()?.toLowerCase()}`
      : ".png";
    counter += 1;
    return `img_${counter}${ext}`;
  };

  const replaceUrl = (rawUrl: string): string => {
    if (!rawUrl.startsWith("http://") && !rawUrl.startsWith("https://")) {
      return rawUrl;
    }
    const localPath = `./assets/slices/${makeLocalName(rawUrl)}`;
    imageUrlMapping[localPath] = rawUrl;
    return localPath;
  };

  let result = htmlCode.replace(/src="(https?:\/\/[^"]+)"/g, (_, url: string) => `src="${replaceUrl(url)}"`);
  result = result.replace(/src='(https?:\/\/[^']+)'/g, (_, url: string) => `src='${replaceUrl(url)}'`);
  result = result.replace(/url\((['"]?)(https?:\/\/[^'")]+)\1\)/g, (_, quote: string, url: string) => {
    const localPath = replaceUrl(url);
    return `url('${quote ? localPath : localPath}')`;
  });

  return { htmlCode: result, imageUrlMapping };
}
