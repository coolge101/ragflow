import { describe, expect, it } from "vitest";
import { formatCrawlLastErrorDisplay, parseCrawlTickStats } from "./crawlLastError";

describe("parseCrawlTickStats", () => {
  it("parses Phase 70 discover rank counters", () => {
    const stats = parseCrawlTickStats(
      "discovered=12 discover_hits=12 discover_rank_kept=5 skipped_serp_rank=7 ingested=3",
    );
    expect(stats).toEqual({
      discovered: 12,
      discover_hits: 12,
      discover_rank_kept: 5,
      skipped_serp_rank: 7,
      ingested: 3,
    });
  });
});

describe("formatCrawlLastErrorDisplay", () => {
  it("shows Chinese tick summary for TICK_OK", () => {
    const out = formatCrawlLastErrorDisplay(
      "[tbox:TICK_OK] discovered=12 discover_hits=12 discover_rank_kept=5 skipped_serp_rank=7 ingested=3",
      120,
    );
    expect(out).toContain("最近 tick");
    expect(out).toContain("SERP命中12");
    expect(out).toContain("SERP过滤7");
    expect(out).toContain("rank保留5");
    expect(out).toContain("入库3");
  });
});
