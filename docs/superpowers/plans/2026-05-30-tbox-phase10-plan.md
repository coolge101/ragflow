# TBOX 阶段 10（S6 merge 后栈加固）开发计划

> **前置**：Phase 9 + S6 merge + post-merge smoke 修复已 push（`7ea81bec7`）。
> **Spec**：Harness §9.0、Runbook §3–4

**Goal：** merge 后运行栈可重复验收；避免误用 Hub 镜像；冒烟脚本随 API 镜像分发。

---

## Task 35: API 镜像内置 TBOX 冒烟脚本

**Files:**
- Modify: `Dockerfile` — `COPY scripts scripts`

- [x] 容器内 `/ragflow/scripts/tbox_*` 可执行，无需 `docker cp`（须 `TBOX_BUILD_RAGFLOW=1` 重建后生效）

---

## Task 36: 栈镜像校验

**Files:**
- Create: `scripts/tbox_verify_stack_image.sh`
- Modify: `scripts/tbox_vm_production_acceptance.sh` — 启动时校验镜像
- Modify: `scripts/deploy-on-new-server.sh` — `.env` 中 stock 镜像改为 local

- [x] 运行中 `ragflow-cpu` 须为 `ragflow-tbox:local`（或显式 `TBOX_USE_STOCK_RAGFLOW_IMAGE=1`）

---

## Task 37: 文档 / 基线

- [x] `TBOX_ENV_AND_VERSIONS.md` §2 → `7ea81bec7`、ahead **93**
- [x] Harness §9.0 Phase 10 行；phase9 → phase10 链
- [x] Runbook §4 补 post-fix 验收记录

---

## 验收

- [x] `bash scripts/tbox_verify_stack_image.sh`
- [x] `bash scripts/tbox_vm_production_acceptance.sh`
- [x] `docker exec docker-ragflow-cpu-1 test -f /ragflow/scripts/tbox_release_smoke.sh`（`TBOX_BUILD_RAGFLOW=1` 重建后，2026-05-30 验证）

**Plan saved to:** `docs/superpowers/plans/2026-05-30-tbox-phase10-plan.md`

**后续：** [`2026-05-30-tbox-phase11-plan.md`](./2026-05-30-tbox-phase11-plan.md)
