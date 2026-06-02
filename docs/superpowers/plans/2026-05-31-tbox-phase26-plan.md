# TBOX 阶段 26（Phase 16–17 手测链 + bundle 单测）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement task-by-task.

**Goal:** 5180 Phase 16–17 手测一键提示；`tbox_console_bundle_smoke.py` 单测；post-merge 跳过 console 重建时仍校验 bundle。

**Architecture:** `tbox_phase16_17_handtest.sh` = bundle smoke + 检查清单；pytest 覆盖纯函数；post-merge else 分支跑 bundle smoke。

**Tech Stack:** bash、pytest、Markdown。

---

## Task 87: 手测辅助脚本

**Files:**
- Create: `scripts/tbox_phase16_17_handtest.sh`
- Modify: `scripts/tbox_record_vm_acceptance.sh`
- Modify: `docs/TBOX_CONSOLE_REBUILD.md`

- [x] `TBOX_PHASE16_17_HANDTEST_DONE=1` 写入 §5 草稿

---

## Task 88: bundle smoke 单测

**Files:**
- Create: `test/unit_test/scripts/test_tbox_console_bundle_smoke.py`

- [x] `script_urls` / `check_bundle` / 跨 bundle 合并 marker

---

## Task 89: post-merge bundle 校验

**Files:**
- Modify: `scripts/tbox_post_upstream_merge.sh`
- Modify: `docs/TBOX_UPSTREAM_MERGE_RUNBOOK.md` §3

- [x] 未 force-recreate 时仍跑 bundle smoke

---

## Task 90: 文档 + S6 §5

**Files:**
- Modify: `docs/TBOX_KB_DELIVERY_HARNESS.md` §9.0
- Modify: `docs/TBOX_VM_PRODUCTION_ACCEPTANCE.md`
- Modify: `docs/TBOX_UPSTREAM_MERGE_RUNBOOK.md` §5

- [ ] Phase 26 行；漂移 `--fetch`

---

## 验收

```bash
bash scripts/tbox_phase16_17_handtest.sh
uv run pytest test/unit_test/scripts/test_tbox_console_bundle_smoke.py -q
bash scripts/tbox_console_bundle_smoke.sh
```

**Plan saved to:** `docs/superpowers/plans/2026-05-31-tbox-phase26-plan.md`
