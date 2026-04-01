const HTML_ENTITY_MAP: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

export function escapeHtml(input: string): string {
  return input.replace(/[&<>"']/g, (character) => HTML_ENTITY_MAP[character] ?? character);
}

export function minifyHtml(input: string): string {
  return input.replace(/\s+/g, " ").replace(/>\s+</g, "><").trim();
}

export function stripHtml(input: string): string {
  return input.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}
