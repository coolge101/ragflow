import { describe, expect, it } from "vitest";
import {
  chunkCount,
  normalizeCitationDigits,
  parseCitationIndex,
  splitCitationMarkers,
} from "./citationUtils";

describe("normalizeCitationDigits", () => {
  it("converts Arabic-Indic digits inside markers", () => {
    expect(normalizeCitationDigits("[ID:١]")).toBe("[ID:1]");
  });
});

describe("parseCitationIndex", () => {
  it("parses [ID:n] and bare digits", () => {
    expect(parseCitationIndex("[ID:0]")).toBe(0);
    expect(parseCitationIndex("[ID:12]")).toBe(12);
    expect(parseCitationIndex("3")).toBe(3);
  });

  it("returns NaN for invalid input", () => {
    expect(Number.isNaN(parseCitationIndex("foo"))).toBe(true);
  });
});

describe("splitCitationMarkers", () => {
  it("splits text and citation parts", () => {
    const parts = splitCitationMarkers("答案在此 [ID:0] 以及 [ID:2] 结束");
    expect(parts).toEqual([
      { kind: "text", value: "答案在此 " },
      { kind: "cite", value: "[ID:0]", chunkIndex: 0 },
      { kind: "text", value: " 以及 " },
      { kind: "cite", value: "[ID:2]", chunkIndex: 2 },
      { kind: "text", value: " 结束" },
    ]);
  });

  it("returns empty for empty string", () => {
    expect(splitCitationMarkers("")).toEqual([]);
  });
});

describe("chunkCount", () => {
  it("counts reference.chunks length", () => {
    expect(chunkCount({ chunks: [{}, {}] })).toBe(2);
    expect(chunkCount(null)).toBe(0);
  });
});
