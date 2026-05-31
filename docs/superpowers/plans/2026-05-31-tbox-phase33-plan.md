# TBOX 阶段 33（双账号门禁链 + S6 preflight）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement task-by-task.

**Goal:** 统一 `TBOX_REQUIRE_DUAL_ACCOUNT` 门禁；VM/suite 入口链入 `tbox_setup_smoke_env`；S6 merge 前 `--fetch` 例行脚本。

**Architecture:** `tbox_require_dual_account_gate.sh` 单点校验；`tbox_s6_preflight.sh` 包装 drift `--fetch` + 可选写 Runbook §5。

**Tech Stack:** bash、Markdown。

---

## Task 112: 双账号门禁链

**Files:**
- Create: `scripts/tbox_require_dual_account_gate.sh`
- Modify: `scripts/tbox_vm_production_acceptance.sh`
- Modify: `scripts/tbox_smoke_suite.sh`
- Modify: `scripts/tbox_pre_release.sh`

- [x] `TBOX_REQUIRE_DUAL_ACCOUNT=1` 时 setup --check-only + dual check

---

## Task 113: S6 preflight 例行

**Files:**
- Create: `scripts/tbox_s6_preflight.sh`
- Modify: `scripts/tbox_record_upstream_drift.sh`（`--write-runbook`）
- Modify: `scripts/tbox_post_upstream_merge.sh`

- [x] merge 前 `--fetch`；post-merge 改用 preflight

---

## Task 114: 文档 + ENV/§5

**Files:**
- Modify: `docs/TBOX_SMOKE_ENV.md`
- Modify: `docs/TBOX_SMOKE_SCRIPTS.md`
- Modify: `docs/TBOX_KB_DELIVERY_HARNESS.md`
- Modify: `docs/TBOX_UPSTREAM_MERGE_RUNBOOK.md` §5

- [x] Phase 33 行 + 双账号矩阵

---

## 验收

```bash
bash scripts/tbox_require_dual_account_gate.sh                    # exit 0
TBOX_REQUIRE_DUAL_ACCOUNT=1 bash scripts/tbox_require_dual_account_gate.sh  # exit 1 if unset
bash scripts/tbox_s6_preflight.sh
TBOX_SKIP_HOST_CHECK=1 bash scripts/tbox_pre_release.sh
```

**Plan saved to:** `docs/superpowers/plans/2026-05-31-tbox-phase33-plan.md`
