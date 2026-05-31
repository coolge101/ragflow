# TBOX 冒烟脚本索引

与 **[`TBOX_SMOKE_ENV.md`](./TBOX_SMOKE_ENV.md)**（环境变量）、**[`TBOX_VM_PRODUCTION_ACCEPTANCE.md`](./TBOX_VM_PRODUCTION_ACCEPTANCE.md)**（准生产验收）配合使用。

---

## 一键入口

| 脚本 | 用途 |
|------|------|
| **`scripts/tbox_pre_release.sh`** | 发版前：**host check** → **smoke suite** → **§5 钉扎**（`--help` 见模式矩阵） |

### `tbox_pre_release.sh` 模式矩阵

```bash
bash scripts/tbox_pre_release.sh --help
```

| 模式 | 命令 | 步骤 [1/2] | 步骤 [2/2] | 双账号 |
|------|------|-------------|------------|--------|
| **默认** | `bash scripts/tbox_pre_release.sh` | host check | smoke suite + §5 | 可选 |
| **完整 VM** | `TBOX_PRE_RELEASE_VM=1 bash scripts/tbox_pre_release.sh` | host check | VM 7 步 + §5 | 可选 |
| **跳过 host** | `TBOX_SKIP_HOST_CHECK=1 bash scripts/tbox_pre_release.sh` | skip | smoke suite + §5 | 可选 |
| **强制双账号** | `TBOX_REQUIRE_DUAL_ACCOUNT=1 bash scripts/tbox_pre_release.sh` | host check | suite + §5 | **必填** |
| **post-merge** | `TBOX_SKIP_WEB_TBOX_CHECK=1 TBOX_PRE_RELEASE_VM=1 …` | （merge 已跑 host） | VM + §5 | 可选 |

本地 CI 对号：**`bash scripts/tbox_host_check.sh`**（= web-tbox.yml + `scripts_smoke` 矩阵格，见 **`TBOX_QUICKSTART.md`** §6）。

| 脚本 | 用途 |
|------|------|
| **`scripts/tbox_host_check.sh`** | 宿主机：**web-tbox check** + **scripts unit** |
| **`scripts/tbox_setup_smoke_env.sh`** | 从 example 创建 `tbox_smoke.env` 并校验双账号 |
| **`scripts/tbox_require_dual_account_gate.sh`** | `TBOX_REQUIRE_DUAL_ACCOUNT=1` 时统一校验 smoke env + 双账号 |
| **`scripts/tbox_s6_preflight.sh`** | S6 merge 前：`--fetch` 漂移快照（可选 `--write-runbook`） |
| **`scripts/tbox_smoke_suite.sh`** | **bundle** → **login** → **release smoke** |
| **`scripts/tbox_vm_production_acceptance.sh`** | 准生产 **7 步**（Docker + 5180 + web-tbox + release） |
| **`scripts/tbox_post_upstream_merge.sh`** | S6 merge 后：重建 → **pre_release (VM+§5)** |
| **`scripts/tbox_phase16_17_finish.sh`** | 手测清单 → 可选 **`--archive`** 写 §5 |
| **`scripts/tbox_print_release_next_steps.sh`** | 5180 + pre_release 下一步（`tbox-up` / `start-tbox` / `deploy` 共用） |
| **`scripts/tbox_archive_phase16_17_handtest.sh`** | Phase 16–17 手测完成后写 §5（须 **`--confirm`**） |

---

## 5180 Console

| 脚本 | 用途 |
|------|------|
| **`tbox_rebuild_console.sh`** | UI 变更后重建 5180 镜像 |
| **`tbox_console_bundle_smoke.sh`** | 检测 5180 JS 含 Phase 16–17 markers |
| **`tbox_phase16_17_handtest.sh`** | bundle 通过后打印 Citation / 检索高亮手测清单 |
| **`tbox_phase16_17_finish.sh`** | 手测清单 + 可选 **`--archive`** 链（内部 **`--confirm`**） |
| **`tbox_archive_phase16_17_handtest.sh`** | 手测完成后归档 §5（须 **`--confirm`**；先跑 bundle smoke） |

---

## Phase 16–17 浏览器手测（5180）

与 VM 验收 **§5**、Walkthrough **§2.1 / §2.2** 文案一致。勿在未手测前设 **`TBOX_PHASE16_17_HANDTEST_DONE=1`**。

| 顺序 | 命令 / 路径 | 说明 |
|------|-------------|------|
| 0（UI 变更后） | `bash scripts/tbox_rebuild_console.sh` | 重建 5180 静态页 |
| 1 | `bash scripts/tbox_phase16_17_handtest.sh` | bundle smoke + 打印 C/D 清单 |
| 2 | 浏览器 Walkthrough **步骤 C §7 + D** | Citation（`/`）+ 检索高亮（`/search`） |
| 2b（可选） | **`/review/step/phase16-17`** | 确认页勾选（journey **`phase16-17`**） |
| 3 | `bash scripts/tbox_phase16_17_finish.sh --archive` | **`--confirm`** 写 VM §5 ☑ |

等价：`bash scripts/tbox_archive_phase16_17_handtest.sh --confirm`（须先完成浏览器步骤）。

**发版链（栈就绪后）**：三脚本共用 **`bash scripts/tbox_print_release_next_steps.sh`**（Runbook **§3.1.3** · QUICKSTART **§1.3**）。

详 **`docs/TBOX_CONSOLE_REBUILD.md`** · **`docs/TBOX_VM_PRODUCTION_ACCEPTANCE.md`** §5。

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

Phase 14–54：`docs/superpowers/plans/2026-05-30-tbox-phase14-plan.md` … `phase54-plan.md`
