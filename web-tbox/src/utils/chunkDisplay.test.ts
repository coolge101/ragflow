import { describe, expect, it } from "vitest";
import {
  chunkRowToDisplayItem,
  chunksFromReference,
  formatChunkSnippet,
  formatSimilaritySuffix,
} from "./chunkDisplay";

describe("chunkRowToDisplayItem", () => {
  it("prefers document_keyword and content_with_weight", () => {
    const item = chunkRowToDisplayItem(
      {
        chunk_id: "c1",
        document_keyword: "手册.pdf",
        content_with_weight: "正文段落",
        similarity: 0.8765,
      },
      0,
    );
    expect(item.key).toBe("c1");
    expect(item.doc).toBe("手册.pdf");
    expect(item.text).toBe("正文段落");
    expect(item.similarity).toBeCloseTo(0.8765);
  });

  it("falls back to index label when doc fields missing", () => {
    const item = chunkRowToDisplayItem({ id: 9 }, 2);
    expect(item.doc).toBe("片段 3");
    expect(item.key).toBe("9");
  });
});

describe("chunksFromReference", () => {
  it("returns empty for invalid reference", () => {
    expect(chunksFromReference(null)).toEqual([]);
    expect(chunksFromReference({})).toEqual([]);
  });

  it("maps reference.chunks", () => {
    const items = chunksFromReference({
      chunks: [{ document_id: "d1", content: "hello" }],
    });
    expect(items).toHaveLength(1);
    expect(items[0]?.doc).toBe("d1");
    expect(items[0]?.text).toBe("hello");
  });
});

describe("formatSimilaritySuffix", () => {
  it("formats three decimals", () => {
    expect(formatSimilaritySuffix(0.5)).toBe(" · 0.500");
    expect(formatSimilaritySuffix(null)).toBe("");
  });
});

describe("formatChunkSnippet", () => {
  it("joins doc, similarity and truncated text", () => {
    const snippet = formatChunkSnippet(
      {
        key: "1",
        doc: "A.doc",
        text: "x".repeat(600),
        similarity: 0.123,
      },
      500,
    );
    expect(snippet).toContain("【A.doc】");
    expect(snippet).toContain("相似度 0.123");
    expect(snippet).toContain("x".repeat(500));
    expect(snippet).not.toContain("x".repeat(501));
  });
});
