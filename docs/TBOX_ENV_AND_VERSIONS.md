# TBOX 知识库：环境与版本基线（S0）

本文档钉扎**本 fork**开发与 CI 所假设的运行时，便于对齐 `docs/TBOX_KB_DELIVERY_HARNESS.md` §5、§7。上游合并后应复查并更新「基线 commit」。

## 1. 语言与运行时

| 组件 | 版本要求 | 来源 |
|------|-----------|------|
| Python | **3.13–3.14**（与 `pyproject.toml` 中 `requires-python` 一致；S6 merge 后自 3.12 升级） | 仓库根 `pyproject.toml` |
| Node（官方 `web/` 与 **web-tbox**） | **>= 18.20.4**（与 `web/package.json` engines 对齐；推荐 **20 LTS**） | `web/package.json` |
| 操作系统（交付） | **Linux**，架构 **linux/amd64**（§7.2） | 交付约束 |

## 2. 本 fork 基线 commit（请维护者填写）

| 字段 | 值 |
|------|-----|
| 记录日期 | 2026-05-30 |
| 本 fork 工作区 `HEAD`（文档更新时钉扎） | `f9bd37fdd285b0e130311c0c61c216008ac8faeb` |
| 备注 | **S6 merge** @ `f9bd37fdd`（upstream `cd18cfab7`）。相对 `origin/main`：**ahead 90 / behind 0** — `bash scripts/tbox_upstream_divergence.sh`。 |

## 3. 常用端口（默认本地开发）

以 `docker/.env` 中变量为准；下表为常见默认（以你本地 `.env` 为准）：

| 用途 | 典型宿主端口 | 说明 |
|------|----------------|------|
| RAGFlow HTTP API | `9380`（`SVR_HTTP_PORT`） | 后端 Quart；`/v1/*`、`/api/v1/*` |
| TBOX 扩展 API | 同上 | 路径前缀 **`/v1/tbox/*`**（见 `api/apps/tbox_app.py`） |
| 官方 Web（`web/`） | 随 Vite 配置 | 与仓库 `web/` 开发指引一致 |
| **TBOX 独立前端（`web-tbox/`）** | **5174**（建议） | `npm run dev` 见 `web-tbox/README.md` |

## 4. TBOX HTTP 契约版本（与 `/v1/tbox/me` 对齐）

| 字段 | 当前值 | 说明 |
|------|--------|------|
| `TBOX_API_CONTRACT_VERSION`（后端常量） | **5** | `api/apps/tbox_app.py`；**`GET /v1/tbox/contract`** 与已鉴权 **`GET /v1/tbox/me`** 的 JSON 中 **`tbox_api_contract_version`** 与此一致。 |
| 客户端建议 | 读取 `tbox_api_contract_version`，**≥4** 时识别 **`crawl.manage`** 等扩展权限键 | 权限全集与语义见 **`docs/TBOX_API_BOUNDARY.md`**。 |
| 采集任务表 | **`tbox_crawl_task`** | 由 `init_database_tables` 创建；HTTP 见 **`docs/TBOX_API_BOUNDARY.md`** §1.2。 |

## 5. Pytest 对抗用例（`test/adversarial_tests.py`）

| 变量 | 作用 |
|------|------|
| `RAGFLOW_ADVERSARIAL_TESTS` 或 `TBOX_RUN_ADVERSARIAL` | 置为 `1` / `true` / `yes` / `on` 时，**启用**带 `@pytest.mark.adversarial` 的 **live HTTP** 用例（默认 **跳过**，避免 `pytest test/` 误连本机 API）。 |
| `RAGFLOW_ADVERSARIAL_URL` | 可选；未设置时 live 用例默认对 **`http://127.0.0.1:9380`** 发请求。 |

CI 中的重型对抗流程仍可通过 `python test/adversarial_tests.py --target …` 生成报告（见 `harness_engineering` workflow）。

## 6. PR 轻量 CI（GitHub `ubuntu-latest`）

| Workflow | 触发路径（节选） | 作用 |
|----------|------------------|------|
| **`web-tbox.yml`** | `web-tbox/**` | `npm ci` + **`npm run typecheck`** + **`npm run build`** |
| **`harness-monitor-unit.yml`** | `common/harness_monitor.py`、`test/test_harness_monitor.py`、`test/adversarial_tests.py`、`pyproject.toml`、`uv.lock` 等 | **`uv sync --group test --frozen`** + **`pytest`** `test/test_harness_monitor.py` 与 **`test/adversarial_tests.py`**（后者 **live** 用例默认 **skip**，见 §5） |
| **`tbox-python-unit.yml`** | 上述四套 Python 单测所涉路径之**并集**（见 workflow 内 **`on.pull_request.paths`**）；**`dorny/paths-filter@v3`** 将 diff 分到 **`app_routes`** / **`crawl_worker`** / **`task_service`** / **`crawl_common`** | **`strategy.matrix`** 四格并行；**`job.if`** 仅对命中路径的格执行 **`uv sync --group test --frozen`** + **`pytest`**：**`tbox_app_isolated`** **`-m tbox_app_isolated`**（子 marker 见 **`pyproject.toml`** / 包 **`conftest.py`**）；**`test_tbox_crawl_worker`**；**`test_tbox_crawl_task_service`**；**`test_tbox_crawl_*.py`** + **`test_ssrf_guard`**（与旧四套 workflow 命令一致）。**`pyproject.toml`** / **`uv.lock`** / 本 workflow 变更时四套均可能运行 |

与上表等价的 **本地对号命令** 见 **`docs/TBOX_QUICKSTART.md`** §6。

## 7. 相关文档

- 总纲与分期：`docs/TBOX_KB_DELIVERY_HARNESS.md`
- API 边界：`docs/TBOX_API_BOUNDARY.md`
- 快速起服务：`docs/TBOX_QUICKSTART.md`
