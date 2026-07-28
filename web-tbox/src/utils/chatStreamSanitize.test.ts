import { describe, expect, it } from "vitest";
import { sanitizeChatFinal } from "./chatStreamSanitize";

describe("sanitizeChatFinal", () => {
  it("removes retrieving tag blocks", () => {
    const raw = "结论如下。\n<retrieving>query foo</retrieving>\n要点 A。";
    expect(sanitizeChatFinal(raw)).toBe("结论如下。\n\n要点 A。");
  });

  it("removes English debug lines", () => {
    const raw = "Searching by keyword TBOX\n答案正文。\nRetrieval 3 results found";
    expect(sanitizeChatFinal(raw)).toBe("答案正文。");
  });

  it("collapses excessive blank lines", () => {
    const raw = "a\n\n\n\n\nb";
    expect(sanitizeChatFinal(raw)).toBe("a\n\nb");
  });

  it("preserves normal user-visible prose", () => {
    const raw = "根据知识库，TBOX 是车载终端。\n\n1. 联网\n2. 定位";
    expect(sanitizeChatFinal(raw)).toBe(raw);
  });

  it("removes standalone orphan tags", () => {
    const raw = "<search/>正文</search>";
    expect(sanitizeChatFinal(raw)).toBe("正文");
  });

  it("is idempotent", () => {
    const once = sanitizeChatFinal("<retrieving>x</retrieving>可见");
    expect(sanitizeChatFinal(once)).toBe(once);
  });
});
