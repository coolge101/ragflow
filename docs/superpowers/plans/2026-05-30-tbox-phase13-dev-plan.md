# TBOX 阶段 13 开发（运维自动化 + P2 回归）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement task-by-task.

**Goal:** 固化镜像重建后的验收链（5180 登录 + P2 API 回归 + 上游漂移记录），减轻 Phase 12/13 手测以外的重复劳动。

**Architecture:** 在现有 `tbox_vm_production_acceptance.sh` / `tbox_release_smoke.sh` 上串联 `tbox_login_smoke.sh` 与新建 `tbox_p2_regression_smoke.sh`；漂移记录脚本输出 Runbook §5 可粘贴 Markdown。P2 UI 已在 Phase 3 交付，本阶段只做 **API/单测回归**。

**Tech Stack:** bash、Docker 内 Python、`curl`/RSA 登录脚本。

---

## Task 48: 上游漂移记录脚本

**Files:**
- Create: `scripts/tbox_record_upstream_drift.sh`
- Modify: `docs/TBOX_UPSTREAM_MERGE_RUNBOOK.md` §5

- [x] 封装 `tbox_upstream_divergence.sh [--fetch]`，输出 §5 Markdown 表
- [x] 写入 2026-05-30 `--fetch` 快照（behind 0 / ahead 103 @ `a461ea64d`）

---

## Task 49: VM 验收链补全

**Files:**
- Modify: `scripts/tbox_vm_production_acceptance.sh`
- Modify: `docs/TBOX_VM_PRODUCTION_ACCEPTANCE.md` §2

- [x] `[4/5] tbox_login_smoke.sh`、`[5/5] release + P2`
- [x] 文档 §2 列出 P2 / 漂移脚本

---

## Task 50: P2 API 回归冒烟

**Files:**
- Create: `scripts/tbox_p2_regression_smoke.sh`
- Modify: `scripts/tbox_release_smoke.sh`

- [x] G2 crawl auth profile 解析 + G5 ingestions API
- [x] 纳入 release / VM acceptance 链

---

## Task 51: Harness / plan 回写

**Files:**
- Modify: `docs/superpowers/plans/2026-05-30-tbox-phase13-plan.md`
- Modify: `docs/TBOX_KB_DELIVERY_HARNESS.md` §9.0

- [x] Phase 13 Task 46/47 状态更新

---

## 验收

```bash
bash scripts/tbox_record_upstream_drift.sh --fetch
bash scripts/tbox_p2_regression_smoke.sh
bash scripts/tbox_vm_production_acceptance.sh
```

- [x] 上述命令退出码 0

**Plan saved to:** `docs/superpowers/plans/2026-05-30-tbox-phase13-dev-plan.md`
