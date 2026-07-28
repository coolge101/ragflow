import { describe, expect, it } from "vitest";

import { withUtf8Charset } from "./documentOriginal";

describe("withUtf8Charset", () => {
  it("adds charset to text/html", () => {
    expect(withUtf8Charset("text/html")).toBe("text/html;charset=utf-8");
  });

  it("adds charset to text/plain", () => {
    expect(withUtf8Charset("text/plain")).toBe("text/plain;charset=utf-8");
  });

  it("leaves existing charset unchanged", () => {
    expect(withUtf8Charset("text/html; charset=gbk")).toBe("text/html; charset=gbk");
  });

  it("does not change binary types", () => {
    expect(withUtf8Charset("application/pdf")).toBe("application/pdf");
  });
});
