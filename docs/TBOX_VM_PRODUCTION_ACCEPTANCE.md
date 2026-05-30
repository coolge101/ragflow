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
bash scripts/tbox_vm_production_acceptance.sh
# 生成 §5 记录草稿（含 HEAD / LAN IP）：
bash scripts/tbox_record_vm_acceptance.sh
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
```

**通过标准**：退出码 **0**（Docker 容器、5180/login、health、release smoke）。

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

| 项 | 值 |
|----|-----|
| 日期 | 2026-05-30 |
| VM / LAN IP | 10.40.92.240 |
| Console | http://10.40.92.240:5180/login |
| Git HEAD | `e1efa0025` |
| `tbox_vm_production_acceptance.sh` | ☑ pass |
| `tbox_login_smoke.sh` | ☑ pass |
| `tbox_p2_regression_smoke.sh` | ☑ pass |
| `tbox_chat_apps_smoke.sh` | ☑ pass |
| `tbox_permissions_smoke.sh` | ☑ pass（admin） |
| §3 内网与双账号 A–D | ☑ 手测 2026-05-30 |
| §4 产品动线 Walkthrough | ☑ 手测 2026-05-30 |
| 备注 | Phase 13–17 归档 ✅；双账号 API：`cp scripts/tbox_smoke.env.example scripts/tbox_smoke.env` — **`docs/TBOX_SMOKE_ENV.md`** |

---

## 6. 相关文档

- Runbook：`docs/TBOX_DEPLOY_RUNBOOK.md`
- 从 GitHub 部署：`docs/TBOX_DEPLOY_FROM_GITHUB.md`
- Phase 9 plan：`docs/superpowers/plans/2026-05-24-tbox-phase9-plan.md`
- Phase 12 plan：`docs/superpowers/plans/2026-05-30-tbox-phase12-plan.md`
- Phase 13 plan：`docs/superpowers/plans/2026-05-30-tbox-phase13-plan.md`
- Phase 14 plan：`docs/superpowers/plans/2026-05-30-tbox-phase14-plan.md`
- Phase 15 plan：`docs/superpowers/plans/2026-05-30-tbox-phase15-plan.md`
