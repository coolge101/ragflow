# TBOX 阶段 61（VM §5 ↔ SMOKE_SCRIPTS + smoke.env.example 三步链）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement task-by-task.

**Goal:** **`TBOX_VM_PRODUCTION_ACCEPTANCE.md` §5** 与 **SMOKE_SCRIPTS** 专节对齐；**`tbox_smoke.env.example`** 注释补 Phase 16–17 三步链。

**Architecture:** Markdown 文案 + example 注释 + Harness/矩阵 + 单测扩展。

**Tech Stack:** Markdown、bash env example、Python unittest。

---

## Task 202: VM §5 模板对齐

**Files:**
- Modify: `docs/TBOX_VM_PRODUCTION_ACCEPTANCE.md`

- [x] 步骤 D + QUICKSTART §1.3 + SMOKE_SCRIPTS/SMOKE_ENV 交叉引用

---

## Task 203: smoke.env.example 三步链

**Files:**
- Modify: `scripts/tbox_smoke.env.example`

- [x] handtest → C §7 + D → finish；QUICKSTART §1.3

---

## Task 204: Harness §9 Phase 61

**Files:**
- Modify: `docs/TBOX_KB_DELIVERY_HARNESS.md`

- [x] 修订记录 + Phase 61 行 + 里程碑 0–61

---

## Task 205: 单测

**Files:**
- Modify: `test/unit_test/scripts/test_tbox_smoke_env_example.py`
- Create: `test/unit_test/scripts/test_tbox_vm_acceptance_doc.py`

- [x] example 与 VM §5 含步骤 D / §1.3

---

## 验收

```bash
grep -q "步骤 D" docs/TBOX_VM_PRODUCTION_ACCEPTANCE.md
grep -q "QUICKSTART" scripts/tbox_smoke.env.example
grep -q "Phase 61" docs/TBOX_KB_DELIVERY_HARNESS.md
bash scripts/tbox_scripts_unit_check.sh
```

**Plan saved to:** `docs/superpowers/plans/2026-05-31-tbox-phase61-plan.md`
