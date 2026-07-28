import { describe, expect, it } from "vitest";

import { resolveSourceReadUrl } from "./sourceUrl";

describe("resolveSourceReadUrl", () => {
  it("prefers source_read_url", () => {
    expect(
      resolveSourceReadUrl({
        source_url: "https://example.invalid/a",
        source_read_url: "https://example.invalid/b",
      }),
    ).toBe("https://example.invalid/b");
  });

  it("accepts http(s) source_url", () => {
    expect(
      resolveSourceReadUrl({
        source_url: "https://arxiv.org/abs/2403.34567",
      }),
    ).toBe("https://arxiv.org/abs/2403.34567");
  });

  it("rejects fixture and internal schemes", () => {
    expect(resolveSourceReadUrl({ source_url: "fixture://sample.html" })).toBeNull();
    expect(resolveSourceReadUrl({ source_url: "internal://doc/1" })).toBeNull();
  });
});
