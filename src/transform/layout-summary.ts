import type { UnknownRecord } from "../shared/types.js";

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function formatValue(value: unknown): string {
  if (typeof value === "number" && Number.isInteger(value)) {
    return String(value);
  }
  return String(value ?? "");
}

function padString(top: unknown, right: unknown, bottom: unknown, left: unknown): string {
  const values = [top ?? 0, right ?? 0, bottom ?? 0, left ?? 0].map(formatValue);
  if (values.every((value) => value === "0")) {
    return "";
  }
  if (values[0] === values[1] && values[1] === values[2] && values[2] === values[3]) {
    return `${values[0]}px`;
  }
  if (values[0] === values[2] && values[1] === values[3]) {
    return `${values[0]}px ${values[1]}px`;
  }
  return `${values[0]}px ${values[1]}px ${values[2]}px ${values[3]}px`;
}

export function extractLayoutSummary(schema: UnknownRecord): string {
  const lines: string[] = [];

  const walk = (node: UnknownRecord, depth = 0): void => {
    const props = isRecord(node.props) ? node.props : {};
    const style = isRecord(props.style) ? props.style : {};
    const className = typeof props.className === "string" ? props.className : "";
    const nodeType = typeof node.type === "string" ? node.type : "div";
    const parts: string[] = [];

    if (style.width != null && style.height != null) {
      parts.push(`w:${formatValue(style.width)} h:${formatValue(style.height)}`);
    } else if (style.width != null) {
      parts.push(`w:${formatValue(style.width)}`);
    } else if (style.height != null) {
      parts.push(`h:${formatValue(style.height)}`);
    }

    if (style.fontSize != null) {
      let fontValue = `font:${formatValue(style.fontSize)}px`;
      if (style.lineHeight != null) {
        fontValue += `/${formatValue(style.lineHeight)}px`;
      }
      parts.push(fontValue);
    }

    if (style.fontWeight != null && !["normal", "400"].includes(String(style.fontWeight))) {
      parts.push(String(style.fontWeight));
    }
    if (style.color) {
      parts.push(String(style.color));
    }
    if (style.letterSpacing != null && Number(style.letterSpacing) !== 0) {
      parts.push(`ls:${formatValue(style.letterSpacing)}`);
    }

    if (style.display === "flex") {
      parts.push(style.flexDirection === "column" ? "flex-col" : "flex-row");
    }
    if (style.justifyContent && style.justifyContent !== "flex-start") {
      parts.push(`justify:${String(style.justifyContent)}`);
    }
    if (style.alignItems && style.alignItems !== "flex-start") {
      parts.push(`align:${String(style.alignItems)}`);
    }
    const gap = style.gap ?? style.rowGap ?? style.columnGap;
    if (gap != null) {
      parts.push(`gap:${formatValue(gap)}`);
    }

    const padding = padString(style.paddingTop, style.paddingRight, style.paddingBottom, style.paddingLeft);
    if (padding) {
      parts.push(`pad:${padding}`);
    }
    const margin = padString(style.marginTop, style.marginRight, style.marginBottom, style.marginLeft);
    if (margin) {
      parts.push(`margin:${margin}`);
    }
    if (style.borderRadius) {
      parts.push(`radius:${formatValue(style.borderRadius)}`);
    }
    if (style.position && !["static", "relative"].includes(String(style.position))) {
      if (style.left != null && style.top != null) {
        parts.push(`${String(style.position)}(${formatValue(style.left)},${formatValue(style.top)})`);
      } else {
        parts.push(String(style.position));
      }
    }

    if (parts.length > 0 && className) {
      let textValue = "";
      if (nodeType === "lanhutext") {
        const data = isRecord(node.data) ? node.data : {};
        const raw = String(data.value ?? props.text ?? "").trim();
        if (raw && !raw.startsWith("this.item.")) {
          textValue = raw.length <= 24 ? ` "${raw}"` : ` "${raw.slice(0, 24)}..."`;
        }
      }
      lines.push(`${"  ".repeat(depth)}[${nodeType}]${textValue} .${className} ${parts.join(" ")}`.trimEnd());
    }

    const children = Array.isArray(node.children) ? node.children.filter(isRecord) : [];
    for (const child of children) {
      walk(child, depth + 1);
    }
  };

  walk(schema);
  return lines.join("\n");
}
