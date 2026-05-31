# TBOX 准生产 VM 验收清单

**目的**：在 **Docker + tbox-console（5180）** 准生产栈上完成内网可访问、权限隔离与产品冒烟验收。
**设计规格**：[`2026-05-21-tbox-vm-quasi-production-design.md`](./superpowers/specs/2026-05-21-tbox-vm-quasi-production-design.md)
**自动化**：`bash scripts/tbox_vm_production_acceptance.sh`

---

## 1. 环境准备

| 项 | 要求 |
|----|------|
| 部署根 | 推荐 `/srv/tbox/ragflow` clone（或本机 `~/ragflow` 联调） |
| 启动 | `bash scripts/start-tbox-ragflow.sh --console` 或 `bash scripts/deploy-on-new-server.sh` + `TBOX_CONSOLE=1` |
| 端口 | API **9380**（建议不对 LAN 开放）；Console **5180**（对内网开放） |
| 镜像 | `ragflow-tbox:local` 须含 TBOX 代码（**勿**用未含 `tbox_app.py` 的上游 Hub 镜像） |

```bash
cd <REPO>
bash scripts/start-tbox-ragflow.sh --console
# 或准生产路径：
# cd /srv/tbox/ragflow && TBOX_CONSOLE=1 bash scripts/deploy-on-new-server.sh --up-only
```

---

## 2. 自动化验收（必跑）

```bash
cd <REPO>
# 发版前（推荐；模式矩阵：bash scripts/tbox_pre_release.sh --help）
bash scripts/tbox_pre_release.sh
# 完整 VM + §5：TBOX_PRE_RELEASE_VM=1 bash scripts/tbox_pre_release.sh
# 双账号：TBOX_REQUIRE_DUAL_ACCOUNT=1 bash scripts/tbox_pre_release.sh
# 一键套件（不含 §5）：bash scripts/tbox_smoke_suite.sh
bash scripts/tbox_smoke_suite.sh
bash scripts/tbox_vm_production_acceptance.sh
# 生成 §5 记录草稿（含 HEAD / LAN IP）：
bash scripts/tbox_record_vm_acceptance.sh
# 写入 §5 锚点（自动化钉扎）：
bash scripts/tbox_record_vm_acceptance.sh --write-section5
# 含完整 smoke：
bash scripts/tbox_record_vm_acceptance.sh --run-smoke
# 上游漂移快照（Runbook §5）：
bash scripts/tbox_record_upstream_drift.sh --fetch
# P2 API 回归（crawl auth + audit ingestions）：
bash scripts/tbox_p2_regression_smoke.sh
# G3 对话应用 CRUD：
bash scripts/tbox_chat_apps_smoke.sh
# G5 权限 API（admin 必测；双账号见 docs/TBOX_SMOKE_ENV.md）：
bash scripts/tbox_permissions_smoke.sh
# Phase 16–17 UI 变更后重建 5180 console：
bash scripts/tbox_rebuild_console.sh
# 验证 bundle 含 Citation / 高亮代码（不重建时通常 FAIL）：
bash scripts/tbox_console_bundle_smoke.sh
# Phase 16–17 手测（Walkthrough 步骤 D 5180 准生产前置 + C §7 + D）：
bash scripts/tbox_phase16_17_handtest.sh
# 确认页 /review/step/phase16-17 通过后归档 §5：
bash scripts/tbox_phase16_17_finish.sh --archive
```

**通过标准**：退出码 **0**（Docker 容器、5180/login、**console bundle**、health、**web-tbox check**、release smoke 7 步）。

可选跳过：`TBOX_SKIP_WEB_TBOX_CHECK=1`；`TBOX_SKIP_CONSOLE_BUNDLE_SMOKE=1`（仅 API 栈验收时）

强制双账号 permissions（须 `scripts/tbox_smoke.env` 含 `TBOX_SMOKE_NORMAL_*`）：`TBOX_REQUIRE_DUAL_ACCOUNT=1 bash scripts/tbox_vm_production_acceptance.sh`（入口调用 **`tbox_require_dual_account_gate.sh`**）

Post-merge 在 `web-tbox/` 变更时自动重建 5180：见 `scripts/tbox_post_upstream_merge.sh`（`TBOX_REBUILD_CONSOLE=auto`）。

---

## 3. 内网与双账号（手测）

| 步骤 | 操作 | 通过 |
|------|------|------|
| A | 本机打开 `http://127.0.0.1:5180/login`，admin 登录 | ☑ |
| B | 内网另一设备 `http://<VM-LAN-IP>:5180/login` 可登录 | ☑ |
| C | `curl -sf http://127.0.0.1:9380/v1/tbox/health` 含 `tbox_api_contract_version` | ☑ |
| D | 普通用户 vs admin：**侧栏菜单** 随 `permissions` 不同 | ☑ |

LAN IP：`hostname -I | awk '{print $1}'`

---

## 4. 产品动线（手测，5180）

按 [`TBOX_UI_ACCEPTANCE_WALKTHROUGH.md`](./TBOX_UI_ACCEPTANCE_WALKTHROUGH.md) 步骤 A–P，**基址改为 5180**：

| 步骤 | 路径 | 要点 | 通过 |
|------|------|------|------|
| 文档 + G1 向导 | `/documents` | **G1 多格式入库向导**；Excel/图片分块提示 | ☑ |
| 对话 / DeepSeek | `/`、`/kb`、`/apps` | Quickstart §3.2；对话应用 CRUD | ☑ |
| 发版能力 | `/search`、`/crawl`、`/audit` | Walkthrough L–P（Office/ZIP/审计筛选） | ☑ |

---

## 5. 记录模板

**Phase 16–17 UI**（Citation + `/search` 高亮）须 **5180 浏览器手测** 后归档，勿在未手测前设 `TBOX_PHASE16_17_HANDTEST_DONE=1`：

1. `bash scripts/tbox_phase16_17_handtest.sh` — bundle + 清单（Walkthrough **步骤 D**「5180 准生产前置」与 **C §7** 共用）
2. 浏览器完成 Walkthrough **步骤 C §7 + D**；可选确认页 **`/review/step/phase16-17`**
3. `bash scripts/tbox_phase16_17_finish.sh --archive` — 写 §5 ☑

发版链：**`bash scripts/tbox_print_release_next_steps.sh`**（Runbook §3.1.3 · QUICKSTART **§1.3**）。同一链见 **[`TBOX_SMOKE_SCRIPTS.md`](./TBOX_SMOKE_SCRIPTS.md)** · **[`TBOX_SMOKE_ENV.md`](./TBOX_SMOKE_ENV.md)** · **`docs/TBOX_CONSOLE_REBUILD.md`**。

<!-- tbox-vm-section5:start -->
| 项 | 值 |
|----|-----|
| 日期 | 2026-05-31 |
| VM / LAN IP | 10.40.92.240 |
| Console | http://10.40.92.240:5180/login |
| Git HEAD | `f9c3e44f3` |
| `tbox_smoke_suite.sh` | pass |
| `tbox_vm_production_acceptance.sh` | suite ok (see tbox_smoke_suite.sh) |
| `tbox_web_tbox_check.sh` | skipped |
| `tbox_login_smoke.sh` | pass (via suite) |
| `tbox_console_bundle_smoke.sh` | pass (via suite) |
| `tbox_permissions_smoke.sh` | pass (via suite) |
| `tbox_dual_account_check.sh` | not configured (optional) |
| §3 内网与双账号 A–D | ☑ 手测 2026-05-31 |
| §4 产品动线 Walkthrough | ☑ 手测 2026-05-31 |
| Phase 16–17 UI | ☐ handtest → /review/step/phase16-17 → `bash scripts/tbox_phase16_17_finish.sh --archive` |
| 备注 | release smoke 含 P2/chat apps；双账号见 `docs/TBOX_SMOKE_ENV.md` |
<!-- tbox-vm-section5:end -->

自动刷新：`bash scripts/tbox_record_vm_acceptance.sh --write-section5`（可选 `--run-suite` / `--run-smoke`）。

---

## 6. 相关文档

- Runbook：`docs/TBOX_DEPLOY_RUNBOOK.md`
- 从 GitHub 部署：`docs/TBOX_DEPLOY_FROM_GITHUB.md`
- Phase 9 plan：`docs/superpowers/plans/2026-05-24-tbox-phase9-plan.md`
- Phase 12 plan：`docs/superpowers/plans/2026-05-30-tbox-phase12-plan.md`
- Phase 13 plan：`docs/superpowers/plans/2026-05-30-tbox-phase13-plan.md`
- Phase 14 plan：`docs/superpowers/plans/2026-05-30-tbox-phase14-plan.md`
- Phase 15 plan：`docs/superpowers/plans/2026-05-30-tbox-phase15-plan.md`
- Phase 16–46 plans：`docs/superpowers/plans/2026-05-30-tbox-phase16-plan.md` … `phase46-plan.md`
- 冒烟脚本索引：`docs/TBOX_SMOKE_SCRIPTS.md`
- Console 重建：`docs/TBOX_CONSOLE_REBUILD.md`
