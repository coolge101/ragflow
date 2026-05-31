# TBOX 上游合并 Runbook（S6）

**目的**：落实 Harness **§9.1 S6**——每 **2～4 周**从 `infiniflow/ragflow` **main** 合并到本 fork，控制漂移。
**分支约定**：功能开发在 **`tbox-deploy`**（或团队集成分支）；**不在 upstream `main` 直开 TBOX 功能**（见 Harness §5）。

---

## 1. 合并前

| 步骤 | 动作 |
|------|------|
| 1 | 确认本 fork **工作区干净**或改动已 commit |
| 2 | 记录当前 **`HEAD`** → 更新 **`docs/TBOX_ENV_AND_VERSIONS.md`** §2（合并后） |
| 3 | `git fetch upstream`（remote 名以团队为准，示例 `upstream` → `infiniflow/ragflow`） |
| 4 | 浏览 upstream **`main` 变更摘要**（release notes / 大文件冲突预判） |

---

## 2. 合并执行

```bash
git checkout tbox-deploy
git pull myrepo tbox-deploy          # 同步远程集成分支
git merge upstream/main              # 或：git rebase upstream/main（团队择一，需统一）
```

**高冲突目录（优先人工审查）**：

| 路径 | TBOX 关注点 |
|------|-------------|
| `api/apps/tbox_app.py` | **勿被 upstream 覆盖**；冲突时保留 TBOX 扩展 |
| `web-tbox/` | TBOX 产品 UI，通常仅本 fork 存在 |
| `docker/entrypoint.sh`、`docker-compose*.yml` | TBOX worker / console profile |
| `common/tbox_crawl_*` | 爬取扩展 |
| `rag/app/picture.py` 等 | 若 TBOX 有 fork 补丁，合并后复跑 G1 冒烟 |

---

## 3. 合并后验证

```bash
# 推荐：重建镜像 + smoke（见 scripts/tbox_post_upstream_merge.sh）
TBOX_BUILD_RAGFLOW=1 TBOX_CONSOLE=1 bash docker/tbox-compose-up.sh
cd web-tbox && npm run typecheck && npm test && npm run build

# API 冒烟（Docker 栈运行中）
curl -sf http://127.0.0.1:9380/v1/tbox/health
# 宿主机 uv 因 spacy/GitHub 超时时：
TBOX_SMOKE_RUNNER=docker bash scripts/tbox_release_smoke.sh
# 或完整 post-merge（含 web-tbox check、console 重建、pre_release VM+§5）：
bash scripts/tbox_post_upstream_merge.sh
# 准生产须双账号 permissions：TBOX_REQUIRE_DUAL_ACCOUNT=1 bash scripts/tbox_post_upstream_merge.sh
# post-merge 在 web-tbox/ 有变更时自动 force-recreate 5180（TBOX_REBUILD_CONSOLE=auto，默认）
# 未重建时仍会跑 bundle smoke 防 stale 5180
# 强制/跳过：TBOX_REBUILD_CONSOLE=1 | TBOX_REBUILD_CONSOLE=0

# Python 单测（需 Python 3.13+ 且 uv sync 成功）
uv run pytest test/unit_test/common/test_tbox_crawl_strategy.py -q
uv run pytest test/unit_test/api/apps/tbox_app_isolated -m tbox_app_isolated -q
```

### 3.1 Docker build 后磁盘不足

大镜像 `docker compose build ragflow-cpu` 可能在 **export/unpack 已成功** 后，因 `/` 空间不足导致 compose 元数据写入失败（exit 1）。Recovery：

```bash
docker run --rm --entrypoint test ragflow-tbox:local -f /ragflow/scripts/tbox_release_smoke.sh && echo image_ok
docker builder prune -af
cd docker && export RAGFLOW_IMAGE=ragflow-tbox:local
docker compose -f docker-compose.yml --profile cpu up -d --force-recreate ragflow-cpu
bash ../scripts/tbox_verify_stack_image.sh
```

### 3.2 Phase 16–17 手测（post-merge / pre_release 后）

`post_upstream_merge` / `pre_release` 后 §5 自动化可能已通过，但 **Phase 16–17 UI 仍为 ☐**。与 **`tbox_post_upstream_merge.sh`** 收尾、**`tbox_print_release_next_steps.sh`**、VM 验收 **§5** 文案一致：

| 顺序 | 操作 | 说明 |
|------|------|------|
| 1 | `bash scripts/tbox_phase16_17_handtest.sh` | bundle + C/D 清单 |
| 2 | 浏览器 Walkthrough **C §7 + D** on 5180 | Citation + 检索高亮 |
| 2b（可选） | **`/review/step/phase16-17`** | 确认页 |
| 3 | `bash scripts/tbox_phase16_17_finish.sh --archive` | 写 VM §5 ☑ |

```bash
bash scripts/tbox_phase16_17_handtest.sh
# 5180：Walkthrough 步骤 C §7 + D；可选 /review/step/phase16-17
bash scripts/tbox_phase16_17_finish.sh --archive
```

详 **[`TBOX_DEPLOY_RUNBOOK.md`](./TBOX_DEPLOY_RUNBOOK.md)** §8.1 · **[`TBOX_SMOKE_SCRIPTS.md`](./TBOX_SMOKE_SCRIPTS.md)** · **[`TBOX_SMOKE_ENV.md`](./TBOX_SMOKE_ENV.md)**。

---

## 4. 合并记录

### 2026-05-30 — S6 首次大 merge（460 commits）

| 字段 | 值 |
|------|-----|
| 日期 | 2026-05-30 |
| 操作人 | Cursor Agent |
| upstream 范围 | `origin/main` @ `cd18cfab7` |
| 本 fork 合并前 | `7f70d1244`（Phase 9） |
| 合并后 HEAD | `f9bd37fdd` |
| 冲突文件 | `api/apps/__init__.py`、`api/db/db_models.py`、`api/db/init_data.py`、`docker/README.md` |
| 验证 | health ✅ · web-tbox typecheck/build ✅ · pytest/G1/G3 smoke ⚠️ 本地 `uv sync` 需 Python 3.13+ 且 spacy 模型下载（网络） |
| 备注 | 保留 TBOX：`tbox_app` 注册日志、`fix_empty_tenant_model_id`、SDK url_prefix；采纳 upstream `get_secret_key()` 与 TenantModel* 表 |

**Post-fix（同日）**：`RAGFLOW_IMAGE=ragflow-tbox:local` + `TBOX_SMOKE_RUNNER=docker` → release/VM smoke ✅（`7ea81bec7`）。

---

## 5. 差异快照（合并前例行）

无需立即 merge 时，可先跑差异脚本确认 **behind/ahead**：

```bash
bash scripts/tbox_upstream_divergence.sh
# 网络可用时刷新 upstream tip（推荐 S6 例行）：
bash scripts/tbox_s6_preflight.sh
# 或写入 Runbook §5 快照：
bash scripts/tbox_s6_preflight.sh --write-runbook
# 低层等价：
bash scripts/tbox_upstream_divergence.sh --fetch
bash scripts/tbox_record_upstream_drift.sh --fetch --write-runbook
```

### 2026-05-31 快照（`--fetch` 后）（`tbox-deploy` @ `c9a47d2a1`）

| 项 | 值 |
|----|-----|
| HEAD | `c9a47d2a1` — docs: pin Phase 21 HEAD in TBOX_ENV_AND_VERSIONS |
| upstream | `origin/main` @ `cd18cfab7` |
| merge-base | `cd18cfab7` |
| behind | **0** |
| ahead | **124** |
| 结论 | behind 0；无缺失 upstream commit；下次 merge 前再 `--fetch` |

生成：`bash scripts/tbox_record_upstream_drift.sh --fetch`
### 2026-05-31 快照（`--fetch` 后）（`tbox-deploy` @ `9d2961fb6`）

| 项 | 值 |
|----|-----|
| HEAD | `9d2961fb6` — TBOX Phase 52: ENV §6 CI parity, Walkthrough §6 feedback VM align |
| upstream | `origin/main` @ `cd18cfab79578bc0e2797b2614afde44f1e0a411` |
| merge-base | `cd18cfab79578bc0e2797b2614afde44f1e0a411` |
| behind | **0** |
| ahead | **184** |
| 结论 | behind 0；无缺失 upstream commit；下次 merge 前再 `--fetch` |

生成：`bash scripts/tbox_s6_preflight.sh --write-runbook`
### 2026-05-31 快照（`--fetch` 后）（`tbox-deploy` @ `50b9c6476`）

| 项 | 值 |
|----|-----|
| HEAD | `50b9c6476` — TBOX Phase 51: QUICKSTART §6 phase16-17 chain, Harness §9 milestone |
| upstream | `origin/main` @ `cd18cfab79578bc0e2797b2614afde44f1e0a411` |
| merge-base | `cd18cfab79578bc0e2797b2614afde44f1e0a411` |
| behind | **0** |
| ahead | **183** |
| 结论 | behind 0；无缺失 upstream commit；下次 merge 前再 `--fetch` |

生成：`bash scripts/tbox_s6_preflight.sh --write-runbook`
### 2026-05-31 快照（`--fetch` 后）（`tbox-deploy` @ `49d8ecfde`）

| 项 | 值 |
|----|-----|
| HEAD | `49d8ecfde` — TBOX Phase 50: UPSTREAM Runbook §3.2, helper SMOKE doc links |
| upstream | `origin/main` @ `cd18cfab79578bc0e2797b2614afde44f1e0a411` |
| merge-base | `cd18cfab79578bc0e2797b2614afde44f1e0a411` |
| behind | **0** |
| ahead | **182** |
| 结论 | behind 0；无缺失 upstream commit；下次 merge 前再 `--fetch` |

生成：`bash scripts/tbox_s6_preflight.sh --write-runbook`
### 2026-05-31 快照（`--fetch` 后）（`tbox-deploy` @ `a29337809`）

| 项 | 值 |
|----|-----|
| HEAD | `a29337809` — TBOX Phase 49: post-merge phase16-17 hints, Runbook §8.1 smoke cross-refs |
| upstream | `origin/main` @ `cd18cfab79578bc0e2797b2614afde44f1e0a411` |
| merge-base | `cd18cfab79578bc0e2797b2614afde44f1e0a411` |
| behind | **0** |
| ahead | **181** |
| 结论 | behind 0；无缺失 upstream commit；下次 merge 前再 `--fetch` |

生成：`bash scripts/tbox_s6_preflight.sh --write-runbook`
### 2026-05-31 快照（`--fetch` 后）（`tbox-deploy` @ `ac6db5451`）

| 项 | 值 |
|----|-----|
| HEAD | `ac6db5451` — TBOX Phase 48: SMOKE_ENV phase16-17 section, pre_release help chain |
| upstream | `origin/main` @ `cd18cfab79578bc0e2797b2614afde44f1e0a411` |
| merge-base | `cd18cfab79578bc0e2797b2614afde44f1e0a411` |
| behind | **0** |
| ahead | **180** |
| 结论 | behind 0；无缺失 upstream commit；下次 merge 前再 `--fetch` |

生成：`bash scripts/tbox_s6_preflight.sh --write-runbook`
### 2026-05-31 快照（`--fetch` 后）（`tbox-deploy` @ `e7b1b7ae6`）

| 项 | 值 |
|----|-----|
| HEAD | `e7b1b7ae6` — TBOX Phase 47: SMOKE_SCRIPTS phase16-17 section, Walkthrough §2.1 VM align |
| upstream | `origin/main` @ `cd18cfab79578bc0e2797b2614afde44f1e0a411` |
| merge-base | `cd18cfab79578bc0e2797b2614afde44f1e0a411` |
| behind | **0** |
| ahead | **179** |
| 结论 | behind 0；无缺失 upstream commit；下次 merge 前再 `--fetch` |

生成：`bash scripts/tbox_s6_preflight.sh --write-runbook`
### 2026-05-31 快照（`--fetch` 后）（`tbox-deploy` @ `913e956e5`）

| 项 | 值 |
|----|-----|
| HEAD | `913e956e5` — TBOX Phase 46: phase16-17 script hints, fix finish syntax, unify VM §5 |
| upstream | `origin/main` @ `cd18cfab79578bc0e2797b2614afde44f1e0a411` |
| merge-base | `cd18cfab79578bc0e2797b2614afde44f1e0a411` |
| behind | **0** |
| ahead | **178** |
| 结论 | behind 0；无缺失 upstream commit；下次 merge 前再 `--fetch` |

生成：`bash scripts/tbox_s6_preflight.sh --write-runbook`
### 2026-05-31 快照（`--fetch` 后）（`tbox-deploy` @ `c39814286`）

| 项 | 值 |
|----|-----|
| HEAD | `c39814286` — TBOX Phase 45: CONSOLE_REBUILD helper chain, setup_smoke_env hints |
| upstream | `origin/main` @ `cd18cfab79578bc0e2797b2614afde44f1e0a411` |
| merge-base | `cd18cfab79578bc0e2797b2614afde44f1e0a411` |
| behind | **0** |
| ahead | **177** |
| 结论 | behind 0；无缺失 upstream commit；下次 merge 前再 `--fetch` |

生成：`bash scripts/tbox_s6_preflight.sh --write-runbook`
### 2026-05-31 快照（`--fetch` 后）（`tbox-deploy` @ `8e11c21a5`）

| 项 | 值 |
|----|-----|
| HEAD | `8e11c21a5` — TBOX Phase 44: DEPLOY_FROM_GITHUB §6, smoke example phase16-17 chain |
| upstream | `origin/main` @ `cd18cfab79578bc0e2797b2614afde44f1e0a411` |
| merge-base | `cd18cfab79578bc0e2797b2614afde44f1e0a411` |
| behind | **0** |
| ahead | **176** |
| 结论 | behind 0；无缺失 upstream commit；下次 merge 前再 `--fetch` |

生成：`bash scripts/tbox_s6_preflight.sh --write-runbook`
### 2026-05-31 快照（`--fetch` 后）（`tbox-deploy` @ `667923f61`）

| 项 | 值 |
|----|-----|
| HEAD | `667923f61` — TBOX Phase 43: helper unit test, QUICKSTART §1.3, manual §5.4 |
| upstream | `origin/main` @ `cd18cfab79578bc0e2797b2614afde44f1e0a411` |
| merge-base | `cd18cfab79578bc0e2797b2614afde44f1e0a411` |
| behind | **0** |
| ahead | **175** |
| 结论 | behind 0；无缺失 upstream commit；下次 merge 前再 `--fetch` |

生成：`bash scripts/tbox_s6_preflight.sh --write-runbook`
### 2026-05-31 快照（`--fetch` 后）（`tbox-deploy` @ `ea9a21086`）

| 项 | 值 |
|----|-----|
| HEAD | `ea9a21086` — TBOX Phase 42: release next-steps helper, Runbook §3.1.3, phase16-17 journey |
| upstream | `origin/main` @ `cd18cfab79578bc0e2797b2614afde44f1e0a411` |
| merge-base | `cd18cfab79578bc0e2797b2614afde44f1e0a411` |
| behind | **0** |
| ahead | **174** |
| 结论 | behind 0；无缺失 upstream commit；下次 merge 前再 `--fetch` |

生成：`bash scripts/tbox_s6_preflight.sh --write-runbook`
### 2026-05-31 快照（`--fetch` 后）（`tbox-deploy` @ `86257c4b2`）

| 项 | 值 |
|----|-----|
| HEAD | `86257c4b2` — 86257c4b2 TBOX Phase 41: tbox-up hints, QUICKSTART §1.2, journey global hand-test |
| upstream | `origin/main` @ `cd18cfab79578bc0e2797b2614afde44f1e0a411` |
| merge-base | `cd18cfab79578bc0e2797b2614afde44f1e0a411` |
| behind | **0** |
| ahead | **173** |
| 结论 | behind 0；无缺失 upstream commit；下次 merge 前再 `--fetch` |

生成：`bash scripts/tbox_s6_preflight.sh --write-runbook`
### 2026-05-31 快照（`--fetch` 后）（`tbox-deploy` @ `08dbc3041`）

| 项 | 值 |
|----|-----|
| HEAD | `08dbc3041` — 08dbc3041 TBOX Phase 40: start-tbox console hints, Walkthrough §6 Q, G5-MATRIX pin |
| upstream | `origin/main` @ `cd18cfab79578bc0e2797b2614afde44f1e0a411` |
| merge-base | `cd18cfab79578bc0e2797b2614afde44f1e0a411` |
| behind | **0** |
| ahead | **170** |
| 结论 | behind 0；无缺失 upstream commit；下次 merge 前再 `--fetch` |

生成：`bash scripts/tbox_s6_preflight.sh --write-runbook`
### 2026-05-31 快照（`--fetch` 后）（`tbox-deploy` @ `fa6e34457`）

| 项 | 值 |
|----|-----|
| HEAD | `fa6e34457` — fa6e34457 TBOX Phase 39: deploy pre_release hints, Walkthrough Q, matrix §6 |
| upstream | `origin/main` @ `cd18cfab79578bc0e2797b2614afde44f1e0a411` |
| merge-base | `cd18cfab79578bc0e2797b2614afde44f1e0a411` |
| behind | **0** |
| ahead | **167** |
| 结论 | behind 0；无缺失 upstream commit；下次 merge 前再 `--fetch` |

生成：`bash scripts/tbox_s6_preflight.sh --write-runbook`
### 2026-05-31 快照（`--fetch` 后）（`tbox-deploy` @ `616691c75`）

| 项 | 值 |
|----|-----|
| HEAD | `616691c75` — 616691c75 TBOX Phase 38: README, GitHub deploy release chain, journey L-P |
| upstream | `origin/main` @ `cd18cfab79578bc0e2797b2614afde44f1e0a411` |
| merge-base | `cd18cfab79578bc0e2797b2614afde44f1e0a411` |
| behind | **0** |
| ahead | **164** |
| 结论 | behind 0；无缺失 upstream commit；下次 merge 前再 `--fetch` |

生成：`bash scripts/tbox_s6_preflight.sh --write-runbook`
### 2026-05-31 快照（`--fetch` 后）（`tbox-deploy` @ `1db774b47`）

| 项 | 值 |
|----|-----|
| HEAD | `1db774b47` — 1db774b47 TBOX Phase 37: review mapping, manual release section, smoke example |
| upstream | `origin/main` @ `cd18cfab79578bc0e2797b2614afde44f1e0a411` |
| merge-base | `cd18cfab79578bc0e2797b2614afde44f1e0a411` |
| behind | **0** |
| ahead | **161** |
| 结论 | behind 0；无缺失 upstream commit；下次 merge 前再 `--fetch` |

生成：`bash scripts/tbox_s6_preflight.sh --write-runbook`
### 2026-05-31 快照（`--fetch` 后）（`tbox-deploy` @ `ac24bf5a3`）

| 项 | 值 |
|----|-----|
| HEAD | `ac24bf5a3` — ac24bf5a3 TBOX Phase 36: unify release docs and Walkthrough Phase 16-17 |
| upstream | `origin/main` @ `cd18cfab79578bc0e2797b2614afde44f1e0a411` |
| merge-base | `cd18cfab79578bc0e2797b2614afde44f1e0a411` |
| behind | **0** |
| ahead | **158** |
| 结论 | behind 0；无缺失 upstream commit；下次 merge 前再 `--fetch` |

生成：`bash scripts/tbox_s6_preflight.sh --write-runbook`
### 2026-05-31 快照（`--fetch` 后）（`tbox-deploy` @ `8da18b8b3`）

| 项 | 值 |
|----|-----|
| HEAD | `8da18b8b3` — 8da18b8b3 TBOX Phase 35: pre_release mode matrix and CI local parity docs |
| upstream | `origin/main` @ `cd18cfab79578bc0e2797b2614afde44f1e0a411` |
| merge-base | `cd18cfab79578bc0e2797b2614afde44f1e0a411` |
| behind | **0** |
| ahead | **155** |
| 结论 | behind 0；无缺失 upstream commit；下次 merge 前再 `--fetch` |

生成：`bash scripts/tbox_s6_preflight.sh --write-runbook`
### 2026-05-31 快照（`--fetch` 后）（`tbox-deploy` @ `a345701fc`）

| 项 | 值 |
|----|-----|
| HEAD | `a345701fc` — a345701fc TBOX Phase 34: gate unit tests and Phase 16-17 finish chain |
| upstream | `origin/main` @ `cd18cfab79578bc0e2797b2614afde44f1e0a411` |
| merge-base | `cd18cfab79578bc0e2797b2614afde44f1e0a411` |
| behind | **0** |
| ahead | **152** |
| 结论 | behind 0；无缺失 upstream commit；下次 merge 前再 `--fetch` |

生成：`bash scripts/tbox_s6_preflight.sh --write-runbook`
### 2026-05-31 快照（`--fetch` 后）（`tbox-deploy` @ `3ea471c83`）

| 项 | 值 |
|----|-----|
| HEAD | `3ea471c83` — 3ea471c83 TBOX Phase 33: dual-account gate chain and S6 preflight |
| upstream | `origin/main` @ `cd18cfab79578bc0e2797b2614afde44f1e0a411` |
| merge-base | `cd18cfab79578bc0e2797b2614afde44f1e0a411` |
| behind | **0** |
| ahead | **149** |
| 结论 | behind 0；无缺失 upstream commit；下次 merge 前再 `--fetch` |

生成：`bash scripts/tbox_s6_preflight.sh --write-runbook`

### 2026-05-30 快照（`--fetch` 后）（`tbox-deploy` @ `373f5e1fe`）

| 项 | 值 |
|----|-----|
| HEAD | `373f5e1fe` — docs: fix Phase 16 full HEAD hash in TBOX_ENV_AND_VERSIONS |
| upstream | `origin/main` @ `cd18cfab7` |
| merge-base | `cd18cfab7` |
| behind | **0** |
| ahead | **114** |
| 结论 | behind 0；无缺失 upstream commit；下次 merge 前再 `--fetch` |

生成：`bash scripts/tbox_record_upstream_drift.sh --fetch`

### 2026-05-30 快照（`--fetch` 后）（`tbox-deploy` @ `a461ea64d`）

| 项 | 值 |
|----|-----|
| HEAD | `a461ea64d` — Phase 12/13 验收记录与登录 JWT 修复 |
| upstream | `origin/main` @ `cd18cfab7` |
| merge-base | `cd18cfab7` |
| behind | **0** |
| ahead | **103** |
| 结论 | behind 0；无缺失 upstream commit；下次 merge 前再 `--fetch` |

生成：`bash scripts/tbox_record_upstream_drift.sh --fetch`

### 2026-05-31 快照（Phase 32 后 `--fetch`）（`tbox-deploy` @ `817d2ac94`）

| 项 | 值 |
|----|-----|
| HEAD | `817d2ac94` — Phase 32 host check + smoke env setup |
| upstream | `origin/main` @ `cd18cfab7` |
| merge-base | `cd18cfab7` |
| behind | **0** |
| ahead | **145** |
| 结论 | behind 0；无缺失 upstream commit；下次 merge 前再 `--fetch` |

### 2026-05-31 快照（Phase 32 前 `--fetch`）（`tbox-deploy` @ `ef17c062d`）

| 项 | 值 |
|----|-----|
| HEAD | `ef17c062d` — Phase 31 scripts unit + §5 preserve |
| upstream | `origin/main` @ `cd18cfab7` |
| merge-base | `cd18cfab7` |
| behind | **0** |
| ahead | **144** |
| 结论 | behind 0；无缺失 upstream commit；下次 merge 前再 `--fetch` |

### 2026-05-31 快照（Phase 31 前 `--fetch`）（`tbox-deploy` @ `657aa19cd`）

| 项 | 值 |
|----|-----|
| HEAD | `657aa19cd` — Phase 30 post-merge consolidate |
| upstream | `origin/main` @ `cd18cfab7` |
| merge-base | `cd18cfab7` |
| behind | **0** |
| ahead | **142** |
| 结论 | behind 0；无缺失 upstream commit；下次 merge 前再 `--fetch` |

### 2026-05-31 快照（Phase 30 前 `--fetch`）（`tbox-deploy` @ `51ca57892`）

| 项 | 值 |
|----|-----|
| HEAD | `51ca57892` — Phase 29 pre-release gate |
| upstream | `origin/main` @ `cd18cfab7` |
| merge-base | `cd18cfab7` |
| behind | **0** |
| ahead | **140** |
| 结论 | behind 0；无缺失 upstream commit；下次 merge 前再 `--fetch` |

### 2026-05-31 快照（Phase 29 前 `--fetch`）（`tbox-deploy` @ `1b0da8c8d`）

| 项 | 值 |
|----|-----|
| HEAD | `1b0da8c8d` — Phase 28 §5 auto-write |
| upstream | `origin/main` @ `cd18cfab7` |
| merge-base | `cd18cfab7` |
| behind | **0** |
| ahead | **138** |
| 结论 | behind 0；无缺失 upstream commit；下次 merge 前再 `--fetch` |

### 2026-05-31 快照（Phase 28 前 `--fetch`）（`tbox-deploy` @ `32e50c876`）

| 项 | 值 |
|----|-----|
| HEAD | `32e50c876` — Phase 27 smoke suite |
| upstream | `origin/main` @ `cd18cfab7` |
| merge-base | `cd18cfab7` |
| behind | **0** |
| ahead | **136** |
| 结论 | behind 0；无缺失 upstream commit；下次 merge 前再 `--fetch` |

### 2026-05-31 快照（Phase 27 前 `--fetch`）（`tbox-deploy` @ `faf77913b`）

| 项 | 值 |
|----|-----|
| HEAD | `faf77913b` — Phase 26 handtest helper + bundle unit tests |
| upstream | `origin/main` @ `cd18cfab7` |
| merge-base | `cd18cfab7` |
| behind | **0** |
| ahead | **134** |
| 结论 | behind 0；无缺失 upstream commit；下次 merge 前再 `--fetch` |

### 2026-05-31 快照（Phase 26 前 `--fetch`）（`tbox-deploy` @ `a5cbfd66d`）

| 项 | 值 |
|----|-----|
| HEAD | `a5cbfd66d` — Phase 25 console bundle smoke |
| upstream | `origin/main` @ `cd18cfab7` |
| merge-base | `cd18cfab7` |
| behind | **0** |
| ahead | **132** |
| 结论 | behind 0；无缺失 upstream commit；下次 merge 前再 `--fetch` |

### 2026-05-31 快照（`--fetch` 后）（`tbox-deploy` @ Phase 24 前 `e84ed501d`）

| 项 | 值 |
|----|-----|
| HEAD | `e84ed501d` — Phase 23 console rebuild + dual-account env validation |
| upstream | `origin/main` @ `cd18cfab7` |
| merge-base | `cd18cfab7` |
| behind | **0** |
| ahead | **128** |
| 结论 | behind 0；无缺失 upstream commit；下次 merge 前再 `--fetch` |

### 2026-05-30 合并后（`tbox-deploy` @ `f9bd37fdd`）

| 项 | 值 |
|----|-----|
| upstream | `origin/main` @ `cd18cfab7` |
| merge-base | `cd18cfab7`（与 upstream tip 一致） |
| behind | **0** |
| ahead | **90** |
| 结论 | S6 merge 完成；下次 merge 前再 `--fetch` 查漂移 |

### 2026-05-30 快照（`tbox-deploy` @ `af77e6b85`，`--fetch` 后）

| 项 | 值 |
|----|-----|
| upstream | `origin/main` @ `cd18cfab7` |
| merge-base | `24af0875e` |
| behind | **460** |
| ahead | **85** |
| 结论 | upstream 已前进；须按 §2 规划 merge/rebase（勿长期漂移） |

### 2026-05-24 快照（`tbox-deploy` @ `363d28341`，未 fetch）

| 项 | 值 |
|----|-----|
| upstream | `origin/main` @ `24af0875e`（本地缓存） |
| behind | **0** |
| ahead | **84** |
| 结论 | 本地 `origin/main` 过期；须 `bash scripts/tbox_upstream_divergence.sh --fetch` 再决策 |

---

## 6. 相关文档

- Harness §5、§7.2、§9.1 S6：`docs/TBOX_KB_DELIVERY_HARNESS.md`
- 环境与基线 commit：`docs/TBOX_ENV_AND_VERSIONS.md`
- Phase 8 plan：`docs/superpowers/plans/2026-05-24-tbox-phase8-plan.md`
