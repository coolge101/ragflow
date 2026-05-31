# TBOX 冒烟脚本索引

与 **[`TBOX_SMOKE_ENV.md`](./TBOX_SMOKE_ENV.md)**（环境变量）、**[`TBOX_VM_PRODUCTION_ACCEPTANCE.md`](./TBOX_VM_PRODUCTION_ACCEPTANCE.md)**（准生产验收）配合使用。

---

## 一键入口

| 脚本 | 用途 |
|------|------|
| **`scripts/tbox_pre_release.sh`** | 发版前：**host check** → **smoke suite** → **§5 钉扎**（可选 `TBOX_PRE_RELEASE_VM=1`） |
| **`scripts/tbox_host_check.sh`** | 宿主机：**web-tbox check** + **scripts unit** |
| **`scripts/tbox_setup_smoke_env.sh`** | 从 example 创建 `tbox_smoke.env` 并校验双账号 |
| **`scripts/tbox_require_dual_account_gate.sh`** | `TBOX_REQUIRE_DUAL_ACCOUNT=1` 时统一校验 smoke env + 双账号 |
| **`scripts/tbox_s6_preflight.sh`** | S6 merge 前：`--fetch` 漂移快照（可选 `--write-runbook`） |
| **`scripts/tbox_smoke_suite.sh`** | **bundle** → **login** → **release smoke** |
| **`scripts/tbox_vm_production_acceptance.sh`** | 准生产 **7 步**（Docker + 5180 + web-tbox + release） |
| **`scripts/tbox_post_upstream_merge.sh`** | S6 merge 后：重建 → **pre_release (VM+§5)** |
| **`scripts/tbox_phase16_17_finish.sh`** | 手测清单 → 可选 **`--archive`** 写 §5 |
| **`scripts/tbox_archive_phase16_17_handtest.sh`** | Phase 16–17 手测完成后写 §5（须 **`--confirm`**） |

---

## 5180 Console

| 脚本 | 用途 |
|------|------|
| **`tbox_rebuild_console.sh`** | UI 变更后重建 5180 镜像 |
| **`tbox_console_bundle_smoke.sh`** | 检测 5180 JS 含 Phase 16–17 markers |
| **`tbox_phase16_17_handtest.sh`** | bundle 通过后打印 Citation / 检索高亮手测清单 |
| **`tbox_phase16_17_finish.sh`** | 手测清单 + 可选 **`--archive --confirm`** 链 |
| **`tbox_archive_phase16_17_handtest.sh`** | 手测完成后归档 §5（须 **`--confirm`**；先跑 bundle smoke） |

---

## API / 权限

| 脚本 | 用途 |
|------|------|
| **`tbox_release_smoke.sh`** | health + G1 + G3 + chat apps + P2 + permissions |
| **`tbox_login_smoke.sh`** | 5180 代理登录 + `/v1/tbox/me` |
| **`tbox_permissions_smoke.sh`** | admin / 可选双账号 permissions |
| **`tbox_dual_account_check.sh`** | 检查 `scripts/tbox_smoke.env` 双账号是否完整 |
| **`tbox_p2_regression_smoke.sh`** | crawl auth + audit ingestions |
| **`tbox_chat_apps_smoke.sh`** | G3 对话应用 CRUD |

---

## 前端 / 记录

| 脚本 | 用途 |
|------|------|
| **`tbox_web_tbox_check.sh`** | typecheck + Vitest + build |
| **`tbox_scripts_unit_check.sh`** | console bundle smoke 纯 Python 单测 |
| **`tbox_record_vm_acceptance.sh`** | 生成 / **`--write-section5`** 钉扎 §5；**`--run-suite`** / **`--run-smoke`**；**`--no-probe`** 保留已有 pass 行 |
| **`tbox_record_upstream_drift.sh`** | Runbook §5 上游漂移快照 |

---

## 相关 Plan

Phase 14–34：`docs/superpowers/plans/2026-05-30-tbox-phase14-plan.md` … `phase34-plan.md`
