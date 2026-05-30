# TBOX 阶段 12（5180 产品验收闭环）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement task-by-task.

**Goal:** 补齐准生产 5180 验收文档与记录工具，使自动化 + 手测清单可一次性填表归档。

**Architecture:** 自动化部分沿用 `tbox_vm_production_acceptance.sh`；新增 `tbox_record_vm_acceptance.sh` 生成 §5 记录草稿；Walkthrough 步骤 Q 与 Harness/journeySteps 对齐。手测 §3–4 由人在浏览器完成。

**Tech Stack:** bash、现有 smoke 脚本、Markdown 文档、`web-tbox` journeySteps。

---

## Task 41: VM 验收记录脚本

**Files:**
- Create: `scripts/tbox_record_vm_acceptance.sh`

- [x] 运行自动化验收并输出 §5 可粘贴 Markdown（HEAD、LAN IP、smoke pass/fail）
- [x] 链到 `TBOX_VM_PRODUCTION_ACCEPTANCE.md` §2、§5

---

## Task 42: 文档 / Harness 回写

**Files:**
- Modify: `docs/TBOX_VM_PRODUCTION_ACCEPTANCE.md` §5–6
- Modify: `docs/TBOX_UI_ACCEPTANCE_WALKTHROUGH.md` 步骤 Q
- Modify: `web-tbox/src/review/journeySteps.ts`
- Modify: `docs/TBOX_KB_DELIVERY_HARNESS.md` §9.0
- Modify: `docs/superpowers/specs/2026-05-24-tbox-capability-matrix-design.md` §6

- [x] Phase 12 行与 phase11 → phase12 链

---

## Task 43: Cursor 规则入仓

**Files:**
- Add: `.cursor/rules/disk-layout.mdc`、`.cursor/rules/file-del.mdc`

- [x] commit（团队共享 VM 磁盘与 DB 删除约束）

---

## Task 44: 手测（人工，Agent 不可代劳）

- [ ] §3 A–D：5180 登录、内网、双账号侧栏
- [ ] §4 + Walkthrough Q：G1 向导、L–P 抽样
- [ ] 将 `tbox_record_vm_acceptance.sh` 输出填入 §5

---

## 验收

- [x] `bash scripts/tbox_record_vm_acceptance.sh` 输出完整草稿
- [x] `bash scripts/tbox_vm_production_acceptance.sh` 退出码 0
- [ ] §5 记录表已填（手测完成后）

**Plan saved to:** `docs/superpowers/plans/2026-05-30-tbox-phase12-plan.md`
