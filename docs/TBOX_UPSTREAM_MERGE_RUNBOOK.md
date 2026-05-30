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
# Python 单测（节选）
uv run pytest test/unit_test/common/test_tbox_crawl_strategy.py -q
uv run pytest test/unit_test/api/apps/tbox_app_isolated -m tbox_app_isolated -q

# 前端
cd web-tbox && npm run typecheck && npm run build

# API 冒烟（Docker 栈运行中）
curl -sf http://127.0.0.1:9380/v1/tbox/health
uv run python3 scripts/tbox_g1_ingest_format_smoke.py
uv run python3 scripts/tbox_g3_deepseek_smoke.py
```

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

---

## 5. 差异快照（合并前例行）

无需立即 merge 时，可先跑差异脚本确认 **behind/ahead**：

```bash
bash scripts/tbox_upstream_divergence.sh
# 网络可用时刷新 upstream tip：
bash scripts/tbox_upstream_divergence.sh --fetch
```

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
