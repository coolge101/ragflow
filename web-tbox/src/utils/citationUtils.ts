/** 与主 fork `web/src/utils/citation-utils.ts` 对齐的引用标记解析 */

export function normalizeCitationDigits(text: string): string {
  if (!text) return text;
  return text.replace(/[٠-٩۰-۹]/g, (char) => {
    const code = char.charCodeAt(0);
    if (code >= 0x0660 && code <= 0x0669) {
      return String.fromCharCode(code - 0x0660 + 0x30);
    }
    if (code >= 0x06f0 && code <= 0x06f9) {
      return String.fromCharCode(code - 0x06f0 + 0x30);
    }
    return char;
  });
}

export function parseCitationIndex(value: string): number {
  const normalized = normalizeCitationDigits(value);
  const markerMatch = normalized.match(/\[(?:ID:)?(\d+)\]/);
  if (markerMatch) return Number(markerMatch[1]);
  if (/^\d+$/.test(normalized)) return Number(normalized);
  return Number.NaN;
}

export const citationMarkerReg =
  /\[(?:ID:)?([0-9\u0660-\u0669\u06F0-\u06F9]+)\]/g;

export type CitationPart =
  | { kind: "text"; value: string }
  | { kind: "cite"; value: string; chunkIndex: number };

export function splitCitationMarkers(content: string): CitationPart[] {
  if (!content) return [];
  const parts: CitationPart[] = [];
  let last = 0;
  const re = new RegExp(citationMarkerReg.source, "g");
  let match: RegExpExecArray | null;
  while ((match = re.exec(content)) !== null) {
    if (match.index > last) {
      parts.push({ kind: "text", value: content.slice(last, match.index) });
    }
    const chunkIndex = parseCitationIndex(match[0]);
    parts.push({ kind: "cite", value: match[0], chunkIndex });
    last = match.index + match[0].length;
  }
  if (last < content.length) {
    parts.push({ kind: "text", value: content.slice(last) });
  }
  return parts;
}

export function chunkCount(reference: unknown): number {
  if (!reference || typeof reference !== "object") return 0;
  const chunks = (reference as { chunks?: unknown }).chunks;
  return Array.isArray(chunks) ? chunks.length : 0;
}
