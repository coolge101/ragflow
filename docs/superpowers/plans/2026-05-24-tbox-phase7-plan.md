# TBOX 阶段 7（S7 实测 + 部署闭环）开发计划

> **前置**：[`2026-05-24-tbox-phase6-plan.md`](./2026-05-24-tbox-phase6-plan.md) 已 commit/push。
> **Spec**：[`2026-05-24-tbox-capability-matrix-design.md`](../specs/2026-05-24-tbox-capability-matrix-design.md)

**Goal：** 执行并记录 S7 对抗冒烟；将 `tbox_release_smoke.sh` 接入新服部署；补 Docker 重建说明。

---

## Task 25: S7 对抗冒烟实测（Harness §7.6）

**Files:**
- Create: `docs/TBOX_S7_ADVERSARIAL_SMOKE.md`
- Modify: `docs/TBOX_KB_DELIVERY_HARNESS.md` §9.0

- [x] 运行 `RAGFLOW_ADVERSARIAL_TESTS=1 pytest test/adversarial_tests.py` 并填表

---

## Task 26: 新服部署接入发版冒烟

**Files:**
- Modify: `scripts/deploy-on-new-server.sh`
- Modify: `docs/TBOX_DEPLOY_FROM_GITHUB.md`

- [x] 栈启动后可选 `bash scripts/tbox_release_smoke.sh`（`TBOX_SKIP_RELEASE_SMOKE=1` 跳过）

---

## Task 27: Docker 镜像重建说明（picture.py 等 fork 补丁）

**Files:**
- Modify: `docs/TBOX_DEPLOY_RUNBOOK.md` §3.4

- [x] 说明：`docker cp` 仅临时；发版须 `docker build` / `tbox-compose-up.sh` 重建

---

## Task 28: 矩阵 G3 闭环

**Files:**
- Modify: `docs/superpowers/specs/2026-05-24-tbox-capability-matrix-design.md`

- [x] `G3-MODEL-DEEPSEEK` web-tbox → ✅（API 冒烟已通过）

---

## 验收

- [x] `RAGFLOW_ADVERSARIAL_TESTS=1 uv run pytest test/adversarial_tests.py -q`
- [x] `bash scripts/tbox_release_smoke.sh`

**Plan saved to:** `docs/superpowers/plans/2026-05-24-tbox-phase7-plan.md`
