import { describe, expect, it } from "vitest";
import { canAccessAdmin, resolveUserHomePath } from "./adminAccess";

describe("canAccessAdmin", () => {
  it("false for search/chat/doc only", () => {
    expect(canAccessAdmin(["chat.use", "search.use", "doc.view"], { user_id: "u1" })).toBe(false);
  });
  it("true for crawl.manage", () => {
    expect(canAccessAdmin(["crawl.manage"], { user_id: "u1" })).toBe(true);
  });
  it("true for workspace owner without user.manage", () => {
    expect(
      canAccessAdmin(["chat.use"], {
        user_id: "u1",
        tenants: [{ tenant_id: "t1", role: "owner" }],
      }),
    ).toBe(true);
  });
});

describe("resolveUserHomePath", () => {
  it("prefers chat", () => {
    expect(resolveUserHomePath(["chat.use", "search.use"], { user_id: "u1" })).toBe("/");
  });
  it("falls back to search", () => {
    expect(resolveUserHomePath(["search.use"], { user_id: "u1" })).toBe("/search");
  });
  it("falls back to admin when only admin perms", () => {
    expect(resolveUserHomePath(["audit.read"], { user_id: "u1" })).toBe("/admin");
  });
  it("no-permission otherwise", () => {
    expect(resolveUserHomePath(["doc.view"], { user_id: "u1" })).toBe("/no-permission");
  });
});
