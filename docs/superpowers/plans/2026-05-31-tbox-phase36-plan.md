# TBOX 阶段 36（SMOKE_ENV 交叉引用 + Runbook 发版节 + Walkthrough D）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement task-by-task.

**Goal:** `TBOX_SMOKE_ENV.md` 与 pre_release 矩阵交叉引用；`TBOX_DEPLOY_RUNBOOK.md` 统一发版脚本链；Walkthrough 步骤 D/C 补 Phase 16–17 手测要点。

**Architecture:** 纯文档对齐；`tbox_phase16_17_handtest.sh` 指向 Walkthrough 锚点。

**Tech Stack:** Markdown、bash 注释。

---

## Task 121: SMOKE_ENV ↔ pre_release

**Files:**
- Modify: `docs/TBOX_SMOKE_ENV.md`

- [x] 发版 env 表 + 链到 `--help` / SMOKE_SCRIPTS

---

## Task 122: DEPLOY_RUNBOOK 发版节

**Files:**
- Modify: `docs/TBOX_DEPLOY_RUNBOOK.md` §8

- [x] 统一 pre_release / suite / VM / finish 链

---

## Task 123: Walkthrough Phase 16–17

**Files:**
- Modify: `docs/TBOX_UI_ACCEPTANCE_WALKTHROUGH.md`（步骤 C/D + §2.1）
- Modify: `scripts/tbox_phase16_17_handtest.sh`

- [x] 与 handtest 清单一致；归档命令

---

## 验收

```bash
bash scripts/tbox_pre_release.sh --help
bash scripts/tbox_phase16_17_handtest.sh   # 5180 栈运行时
grep -q "pre_release.sh --help" docs/TBOX_SMOKE_ENV.md docs/TBOX_DEPLOY_RUNBOOK.md
```

**Plan saved to:** `docs/superpowers/plans/2026-05-31-tbox-phase36-plan.md`
