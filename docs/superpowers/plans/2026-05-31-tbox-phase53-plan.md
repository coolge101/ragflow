# TBOX 阶段 53（web-tbox README + 手册 §5.4 ↔ ENV §6）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement task-by-task.

**Goal:** `web-tbox/README` PR 门禁与 **`TBOX_ENV_AND_VERSIONS.md` §6.1** 对齐；**`TBOX_SYSTEM_USER_MANUAL` §5.4** 补 ENV §6 / 三步链交叉引用。

**Architecture:** README 命令块 + 手册表格/说明；文档单测。

**Tech Stack:** Markdown、Python unittest。

---

## Task 172: web-tbox README

**Files:**
- Modify: `web-tbox/README.md`

- [x] host_check / scripts unit / phase16-17 与 ENV §6.1 一致

---

## Task 173: SYSTEM_USER_MANUAL §5.4

**Files:**
- Modify: `docs/TBOX_SYSTEM_USER_MANUAL.md` §5.4

- [x] ENV §6 / QUICKSTART §6 + VM §5 三步文案

---

## Task 174: README/手册 单测

**Files:**
- Create: `test/unit_test/scripts/test_tbox_web_tbox_readme_doc.py`

- [x] README 与 §5.4 含 scripts unit / phase16-17

---

## 验收

```bash
grep -q "tbox_scripts_unit_check" web-tbox/README.md
grep -q "TBOX_ENV_AND_VERSIONS" docs/TBOX_SYSTEM_USER_MANUAL.md
bash scripts/tbox_scripts_unit_check.sh
```

**Plan saved to:** `docs/superpowers/plans/2026-05-31-tbox-phase53-plan.md`
