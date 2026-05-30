# TBOX 阶段 20（Citation/chunk 单元测试 + VM §5 更新）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement task-by-task.

**Goal:** 为 Phase 16–19 核心纯函数添加 Vitest 回归；更新 VM 验收 §5 钉扎 Phase 14–19 自动化项。

**Architecture:** `vitest.config.ts` + `src/utils/*.test.ts`；无 React 测试依赖。

**Tech Stack:** Vitest、TypeScript、`web-tbox`。

---

## Task 69: Vitest 与 chunk/citation 测试

**Files:**
- Create: `web-tbox/vitest.config.ts`
- Create: `chunkDisplay.test.ts`、`citationUtils.test.ts`
- Modify: `web-tbox/package.json`（`npm test`）

- [x] `npm test` 全绿

---

## Task 70: VM §5 与文档

**Files:**
- Modify: `docs/TBOX_VM_PRODUCTION_ACCEPTANCE.md` §5、§6
- Modify: `web-tbox/README.md`
- Modify: `docs/TBOX_KB_DELIVERY_HARNESS.md` §9.0

- [x] HEAD 与 Phase 14–19 smoke 行

---

## 验收

```bash
cd web-tbox && npm test && npm run typecheck
```

**Plan saved to:** `docs/superpowers/plans/2026-05-30-tbox-phase20-plan.md`
