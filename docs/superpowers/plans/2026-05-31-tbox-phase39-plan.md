# TBOX 阶段 39（步骤 Q + deploy 发版提示 + 矩阵 §6）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement task-by-task.

**Goal:** Walkthrough 步骤 Q 与 `vm-5180` / pre_release 链对齐；`deploy-on-new-server.sh` 收尾提示发版链；能力矩阵 §6 补 Phase 24–39。

**Architecture:** 文档 + deploy 脚本 echo；矩阵摘要行与 Harness 对齐。

**Tech Stack:** bash、Markdown。

---

## Task 130: 步骤 Q ↔ vm-5180

**Files:**
- Modify: `docs/TBOX_UI_ACCEPTANCE_WALKTHROUGH.md` 步骤 Q
- Modify: `web-tbox/src/review/journeySteps.ts` `vm-5180`

- [x] pre_release / finish / §5 与 §2.2 一致

---

## Task 131: deploy-on-new-server 发版提示

**Files:**
- Modify: `scripts/deploy-on-new-server.sh`

- [x] 5180 + setup + pre_release 下一步 echo

---

## Task 132: 能力矩阵 §6

**Files:**
- Modify: `docs/superpowers/specs/2026-05-24-tbox-capability-matrix-design.md` §6

- [x] Phase 24–39 摘要行

---

## 验收

```bash
grep -q "pre_release.sh" scripts/deploy-on-new-server.sh
grep -q "Phase 39" docs/superpowers/specs/2026-05-24-tbox-capability-matrix-design.md
grep -q "finish.sh --archive" docs/TBOX_UI_ACCEPTANCE_WALKTHROUGH.md
```

**Plan saved to:** `docs/superpowers/plans/2026-05-31-tbox-phase39-plan.md`
