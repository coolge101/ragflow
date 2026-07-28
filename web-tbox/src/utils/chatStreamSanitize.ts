/** Strip internal retrieval / agent debug markers from user-visible chat text (Phase 70.0). */

const TAG_BLOCK_RE =
  /<(retrieving|search|thinking|reasoning|tool_call|action)(?:\s[^>]*)?(?<!\/)>[\s\S]*?<\/\1>/gi;

const STANDALONE_TAG_RE =
  /<\/?(?:retrieving|search|thinking|reasoning|tool_call|action)[^>]*\/?>/gi;

const LINE_DEBUG_RES: RegExp[] = [
  /^\s*Searching by\b[^\n]*$/gim,
  /^\s*Retrieval \d+ results\b[^\n]*$/gim,
  /^\s*Next step is to search\b[^\n]*$/gim,
  /^\s*I need to search\b[^\n]*$/gim,
  /^\s*Let me search\b[^\n]*$/gim,
];

export function sanitizeChatFinal(text: string): string {
  let out = text.replace(TAG_BLOCK_RE, "").replace(STANDALONE_TAG_RE, "");
  for (const re of LINE_DEBUG_RES) {
    out = out.replace(re, "");
  }
  out = out.replace(/\n{3,}/g, "\n\n").replace(/^\n+/, "").replace(/\n+$/, "");
  return out;
}
