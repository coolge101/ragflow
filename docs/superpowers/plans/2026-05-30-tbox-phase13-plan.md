# TBOX 阶段 13（收尾与例行运维）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement task-by-task.

**Goal:** 完成 Phase 12 剩余手测项归档；建立 S6 上游漂移例行检查；P2 能力 API 回归纳入发版链。

**Architecture:** 手测沿用 `TBOX_VM_PRODUCTION_ACCEPTANCE.md` §3–4；漂移检查用 `tbox_record_upstream_drift.sh --fetch`；P2 UI 已在 Phase 3 交付，Phase 13 开发见 [`2026-05-30-tbox-phase13-dev-plan.md`](./2026-05-30-tbox-phase13-dev-plan.md)。

**Tech Stack:** bash 脚本、Markdown 验收文档、现有 smoke 链。

---

## Task 45: VM 手测收尾（人工 + 记录）

**Files:**
- Modify: `docs/TBOX_VM_PRODUCTION_ACCEPTANCE.md` §3–5

- [x] §3 A/C：本机登录 + health（2026-05-30）
- [ ] §3 B：内网另一设备访问 `http://<LAN-IP>:5180/login`
- [ ] §3 D：普通用户 vs admin 侧栏差异
- [ ] §4：`/documents` G1 向导 + Walkthrough L–P 抽样
- [ ] 手测完成后更新 §5 勾选

---

## Task 46: S6 上游漂移例行化

**Files:**
- Modify: `docs/TBOX_UPSTREAM_MERGE_RUNBOOK.md` §5
- Create: `scripts/tbox_record_upstream_drift.sh`

- [x] 2026-05-30 `--fetch` 快照：behind 0 / ahead 103 @ `a461ea64d`
- [x] 记录脚本输出 Runbook §5 Markdown

---

## Task 47: P2 回归（Phase 3 已交付 UI）

- [x] `tbox_p2_regression_smoke.sh`（G2 crawl auth + G5 ingestions API）
- [x] 纳入 `tbox_release_smoke.sh` / `tbox_vm_production_acceptance.sh`
- [ ] 手测 Walkthrough L–P（ZIP/审计 UI）由 Task 45 覆盖

---

## 验收

- [x] `bash scripts/tbox_vm_production_acceptance.sh` 退出码 0
- [x] `bash scripts/tbox_p2_regression_smoke.sh` 退出码 0
- [x] `bash scripts/tbox_record_upstream_drift.sh --fetch` 输出完整
- [ ] §3 B/D + §4 手测勾选完成

**Plan saved to:** `docs/superpowers/plans/2026-05-30-tbox-phase13-plan.md`

**开发明细：** [`2026-05-30-tbox-phase13-dev-plan.md`](./2026-05-30-tbox-phase13-dev-plan.md)
