# TBOX 阶段 13（收尾与例行运维）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement task-by-task.

**Goal:** 完成 Phase 12 剩余手测项归档；建立 S6 上游漂移例行检查；为下一迭代 P2 功能择一打底。

**Architecture:** 手测沿用 `TBOX_VM_PRODUCTION_ACCEPTANCE.md` §3–4；漂移检查用 `tbox_upstream_divergence.sh --fetch`；P2 以能力矩阵 §3 为准。

**Tech Stack:** bash 脚本、Markdown 验收文档、现有 smoke 链。

---

## Task 45: VM 手测收尾（人工 + 记录）

**Files:**
- Modify: `docs/TBOX_VM_PRODUCTION_ACCEPTANCE.md` §3–5

- [ ] §3 B：内网另一设备访问 `http://<LAN-IP>:5180/login`
- [ ] §3 D：普通用户 vs admin 侧栏差异
- [ ] §4：`/documents` G1 向导 + Walkthrough L–P 抽样
- [ ] 运行 `bash scripts/tbox_record_vm_acceptance.sh --run-smoke` 更新 §5

---

## Task 46: S6 上游漂移例行化

**Files:**
- Modify: `docs/TBOX_UPSTREAM_MERGE_RUNBOOK.md`（§3.1 例行窗口）
- Script: `scripts/tbox_upstream_divergence.sh`（已有 `--fetch`）

- [x] 2026-05-30 快照：behind 0 / ahead 102 @ `94afbe047`
- [ ] 每 2～4 周：`bash scripts/tbox_upstream_divergence.sh --fetch` 并记录于 Runbook §4

---

## Task 47: P2 择一（下一迭代）

能力矩阵 P2 候选（择一启动）：

| ID | 能力 | 说明 |
|----|------|------|
| G1-KB-ZIP | 整库 ZIP 导入/导出 | 浏览器 ZIP + 官方 REST |
| G2-CRAWL-AUTH | 需登录站点爬取 | env headers profile |
| G5-UI-AUDIT | 审计筛选增强 | 已有基础 `/audit` |

- [ ] 产品确认 P2 优先级后写入 phase14 plan

---

## 验收

- [x] `bash scripts/tbox_vm_production_acceptance.sh` 退出码 0
- [x] `bash scripts/tbox_login_smoke.sh` 退出码 0
- [ ] §3 B/D + §4 手测勾选完成
- [ ] 首次 `--fetch` 漂移记录写入 Runbook

**Plan saved to:** `docs/superpowers/plans/2026-05-30-tbox-phase13-plan.md`
