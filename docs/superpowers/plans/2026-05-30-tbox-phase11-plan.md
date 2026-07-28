# TBOX 阶段 11（运维硬化：镜像验收 + 磁盘）开发计划

> **前置**：Phase 10 @ `964b310f1`；API 镜像已重建含 `scripts/`。
> **Spec**：Runbook §3、VM 验收 §2

**Goal：** merge/重建后可重复验证镜像内容；大镜像 build 后磁盘不足有 documented  recovery。

---

## Task 38: post-merge / 重建后校验链

**Files:**
- Modify: `scripts/tbox_post_upstream_merge.sh` — 校验容器内 `scripts/` + `tbox_verify_stack_image` + VM 验收

- [x] 一条命令完成 rebuild → scripts 在容器内 → smoke

---

## Task 39: Docker build 磁盘 recovery

**Files:**
- Modify: `docs/TBOX_UPSTREAM_MERGE_RUNBOOK.md` §3.1
- Modify: `docs/TBOX_QUICKSTART.md` §1.2

- [x] 镜像 export 成功但 compose 元数据失败时的 recovery 步骤

---

## Task 40: Phase 10 闭环

- [x] phase10 plan：`scripts/tbox_release_smoke.sh` 在容器内 ✅

---

## 验收

- [x] `docker exec docker-ragflow-cpu-1 test -f /ragflow/scripts/tbox_release_smoke.sh`
- [x] `bash scripts/tbox_vm_production_acceptance.sh`

**Plan saved to:** `docs/superpowers/plans/2026-05-30-tbox-phase11-plan.md`

**后续：** [`2026-05-30-tbox-phase12-plan.md`](./2026-05-30-tbox-phase12-plan.md)（5180 产品验收闭环）
