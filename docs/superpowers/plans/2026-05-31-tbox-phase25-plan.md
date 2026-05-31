# TBOX 阶段 25（Console Bundle 冒烟）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement task-by-task.

**Goal:** 自动化检测 5180 静态 bundle 是否含 Phase 16–17（Citation / ChunkListPanel）代码；纳入 VM 验收与 console 重建链。

**Architecture:** curl index.html → 拉取 `assets/*.js` → 匹配 minified 特征串；失败提示 `tbox_rebuild_console.sh`。

**Tech Stack:** bash、Python3。

---

## Task 84: Console bundle smoke

**Files:**
- Create: `scripts/tbox_console_bundle_smoke.py`
- Create: `scripts/tbox_console_bundle_smoke.sh`

- [x] 检测 `kind:"cite"`、`scrollIntoView`、`[(?:ID:)?` 等同源 marker

---

## Task 85: 纳入验收链

**Files:**
- Modify: `scripts/tbox_rebuild_console.sh`
- Modify: `scripts/tbox_vm_production_acceptance.sh`
- Modify: `scripts/tbox_record_vm_acceptance.sh`

- [x] 重建后 / VM [3/7] 跑 bundle smoke

---

## Task 86: 文档

**Files:**
- Modify: `docs/TBOX_CONSOLE_REBUILD.md`
- Modify: `docs/TBOX_VM_PRODUCTION_ACCEPTANCE.md`
- Modify: `docs/TBOX_KB_DELIVERY_HARNESS.md` §9.0

- [x] Phase 25 行

---

## 验收

```bash
bash scripts/tbox_console_bundle_smoke.sh          # 旧镜像应 FAIL
bash scripts/tbox_rebuild_console.sh               # 重建后应 PASS
bash scripts/tbox_web_tbox_check.sh
```

**Plan saved to:** `docs/superpowers/plans/2026-05-31-tbox-phase25-plan.md`
