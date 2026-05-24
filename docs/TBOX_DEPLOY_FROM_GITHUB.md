# 通过 GitHub 在新服务器部署 TBOX — 已验证部署手册

> **重要前提**：本文中的 TBOX 脚本与 `api/apps/tbox_app.py` 等改动，必须先存在于 **GitHub 上你实际 `git clone` 的分支**里。
> 若服务器上执行 `bash scripts/deploy-on-new-server.sh` 报 **No such file or directory**，说明当前 clone 的仍是 **InfiniFlow 上游 `main`**（或尚未 push 的本地分支），**不是**含 TBOX 的部署分支。
> 请先完成 **§0.1 把 TBOX 代码推到 GitHub**，或在服务器上用 **§0.2 rsync** 从已改好的开发机同步整份仓库，再执行下文步骤。

本文基于**含 TBOX 扩展的仓库树**整理部署路径：**`git clone` → 本地下载依赖 → 本地构建 `ragflow_deps` → 构建 API 镜像 → 启动栈 → 前端**。
请勿跳过 **「本地 deps」** 步骤；**仅 `docker pull infiniflow/ragflow_deps:latest` 再 `docker build` 是错误流程**。

**相关文档**：[`TBOX_SYSTEM_USER_MANUAL.md`](./TBOX_SYSTEM_USER_MANUAL.md)、[`TBOX_QUICKSTART.md`](./TBOX_QUICKSTART.md)、[`TBOX_DEPLOY_RUNBOOK.md`](./TBOX_DEPLOY_RUNBOOK.md)。

---

## 0. 部署前必读

### 0.1 先把 TBOX 代码推到 GitHub（推荐）

在**已含 TBOX 改动的开发机**上（须能 `ls api/apps/tbox_app.py docker/tbox-compose-up.sh`）：

```bash
cd /path/to/ragflow
git checkout -b tbox-deploy    # 或你们约定分支名
git add api/apps/tbox_app.py docker/tbox-compose-up.sh scripts/ web-tbox/ docs/TBOX_*.md
git status                     # 确认将要提交的文件
git commit -m "Add TBOX extension and deployment scripts"
git push -u origin tbox-deploy # 推到你的 GitHub 仓库
```

在**新服务器**上克隆**同一分支**：

```bash
git clone -b tbox-deploy https://github.com/<your-org>/ragflow.git /opt/ragflow/ragflow
cd /opt/ragflow/ragflow
test -f scripts/deploy-on-new-server.sh && test -f docker/tbox-compose-up.sh && echo "OK"
```

### 0.2 暂不 push 时：从开发机 rsync 到服务器

在**开发机**执行（把 `SERVER` 换成服务器 IP 或主机名）：

```bash
rsync -av --delete \
  --exclude '.git' --exclude 'node_modules' --exclude '.venv' --exclude 'huggingface.co' \
  /home/vboxuser/ragflow/  vboxuser@SERVER:/opt/ragflow/ragflow/
```

然后在服务器上确认：

```bash
ls /opt/ragflow/ragflow/scripts/deploy-on-new-server.sh
ls /opt/ragflow/ragflow/docker/tbox-compose-up.sh
```

### 0.3 常见误区

| 误区 | 正确做法 |
|------|----------|
| 克隆 **InfiniFlow 官方 `infiniflow/ragflow`** 且无 TBOX 代码 | 克隆 **含 TBOX 的仓库/分支**（须存在 `api/apps/tbox_app.py`、`docker/tbox-compose-up.sh`） |
| `docker pull infiniflow/ragflow_deps:latest` 后直接 `docker build` | **必须先**在本仓库根目录跑 **`download_deps.py`**，再 **`docker build -f Dockerfile.deps`**，使 deps 与当前 **`Dockerfile` 中 Tika/HF 版本一致 |
| 仅 `docker compose build` 报 **`No services to build`** | 使用下文 **§4 步骤 3** 或 **`scripts/tbox-deps-step-by-step.sh 3`**（会 `source docker/.env` 并指定 profile） |
| web-tbox 登录 **`Not Found: /v1/user/login`** | **不要**设置 `VITE_AUTH_LOGIN_PATH=/v1/user/login`；默认 **`POST /api/v1/auth/login`** |
| `tbox-compose-up.sh` 报 9380 超时但日志里已在监听 | 健康检查路径已改为 **`/api/v1/auth/login/channels`**；请使用**本仓库最新**的 `docker/tbox-compose-up.sh` |

**典型错误示例**（Fork 与 Hub deps 版本不一致）：

```text
cp: cannot stat '/deps/tika-server-standard-3.2.3.jar': No such file or directory
```

原因：当前 **`Dockerfile` 要求 3.2.3**，而 Hub 上 **`ragflow_deps:latest` 可能是 3.3.0**（或相反）。**唯一可靠做法**：用**本仓库**的 `download_deps.py` + `Dockerfile.deps` **本地重建** deps 镜像。

---

## 1. 服务器要求

- **OS**：Linux x86_64
- **软件**：Docker Engine、Docker Compose v2、`curl`、`git`
- **工具**：**`uv`**（脚本可自动安装，用于 `download_deps.py`）
- **资源**：建议 **≥16GB RAM**、**≥50GB** 可用磁盘（含模型与 Docker 层）
- **网络**：可访问 GitHub；构建阶段需拉 Maven/HF/Docker Hub（国内见 **§3 环境变量**）

---

## 2. 从 GitHub 克隆（含 TBOX 的仓库）

```bash
sudo mkdir -p /opt/ragflow && sudo chown "$USER":"$USER" /opt/ragflow
cd /opt/ragflow

# 替换为你们实际含 TBOX 的仓库 URL（HTTPS 或 SSH）
git clone https://github.com/<your-org>/ragflow.git ragflow
cd ragflow

# 确认 TBOX 文件存在（缺一不可）
test -f api/apps/tbox_app.py && test -f docker/tbox-compose-up.sh && echo "OK: TBOX tree"

git fetch --tags
git checkout main    # 或你们约定的发布分支/标签
```

**私有仓库**：使用 Deploy Key 或 PAT，见 GitHub 文档；勿将 Token 提交到仓库。

---

## 3. 配置 `docker/.env`

```bash
cd /opt/ragflow/ragflow/docker
test ! -f .env && cp .env.example .env
nano .env
```

**至少确认/修改**：

```bash
RAGFLOW_IMAGE=ragflow-tbox:local
DOC_ENGINE=elasticsearch          # 或 infinity，与 profile 一致
SVR_HTTP_PORT=9380
# 修改所有默认密码：MYSQL_PASSWORD、REDIS_PASSWORD、MINIO_* 等
```

**国内构建建议**（写入 `.env` 或在命令前 export）：

```bash
# docker/.env 或 export：
TBOX_CHINA_DOWNLOAD=1
RAGFLOW_BASE_IMAGE=docker.m.daocloud.io/library/ubuntu:24.04
NEED_MIRROR=1
NO_CHROME_DOWNLOAD=1              # Chrome 大包常超时；跳过则镜像内无浏览器自动化
# RAGFLOW_DISABLE_TEXT_CONCAT_XGB=1   # HF 上 text_concat 拉不下来时可开
```

**Docker Hub 镜像站 DNS 失败**（如 `docker.mirrors.ustc.edu.cn: no such host`）：

```bash
sudo bash scripts/fix-docker-registry-mirrors.sh
```

---

## 4. 构建与启动（推荐：一键脚本）

在**仓库根目录**：

```bash
cd /opt/ragflow/ragflow

export TBOX_CHINA_DOWNLOAD=1
export NO_CHROME_DOWNLOAD=1

bash scripts/deploy-on-new-server.sh
```

脚本会依次：

1. 检查 TBOX 源码、`uv`、创建/补全 `docker/.env`
2. **`download_deps.py`**（仅下载）
3. **`docker build -f Dockerfile.deps -t infiniflow/ragflow_deps:latest .`**
4. **`docker compose build ragflow-cpu`**（或 `.env` 中 `DEVICE` 对应 profile）
5. **`bash docker/tbox-compose-up.sh`** 启动依赖 + API

成功标志：

```text
OK: RAGFlow HTTP responds.
OK: TBOX is active
Done.
```

**仅构建不启动**：`bash scripts/deploy-on-new-server.sh --build-only`
**镜像已存在只启动**：`bash scripts/deploy-on-new-server.sh --up-only`

---

## 5. 分步执行（网络不稳时推荐）

与一键脚本等价，便于中断续跑：

```bash
cd /opt/ragflow/ragflow

# 步骤 1 — 下载到仓库根（Tika、NLTK、HF 模型等，耗时长）
TBOX_CHINA_DOWNLOAD=1 NO_CHROME_DOWNLOAD=1 \
  bash scripts/tbox-deps-step-by-step.sh 1

# 步骤 2 — 构建 deps 镜像（快，约 1–3 分钟，依赖步骤 1 的文件）
bash scripts/tbox-deps-step-by-step.sh 2

# 步骤 3 — 构建主 API 镜像 ragflow-tbox:local（耗时长，10–40+ 分钟）
TBOX_CHINA_DOWNLOAD=1 bash scripts/tbox-deps-step-by-step.sh 3

# 启动
cd docker && bash tbox-compose-up.sh
```

**构建前自检**（可选）：

```bash
bash scripts/verify-docker-build-prereqs.sh
```

---

## 6. 验收

```bash
API=http://127.0.0.1:9380

curl -sf "$API/api/v1/auth/login/channels" | head -c 200; echo
curl -sf "$API/v1/tbox/health" | python3 -m json.tool
```

期望：

- `login/channels` → `"code":0`
- `tbox/health` → `"status":"ok"` 且含 `tbox_api_contract_version`

---

## 7. web-tbox 前端

```bash
cd /opt/ragflow/ragflow/web-tbox
cp -n .env.example .env
# VITE_RAGFLOW_API_ORIGIN=http://<服务器IP>:9380  （浏览器能访问到的 API 地址）
# 不要设置 VITE_AUTH_LOGIN_PATH=/v1/user/login

npm ci
npm run dev -- --host 0.0.0.0 --port 5174
```

浏览器打开 **http://&lt;服务器IP&gt;:5174/login**。

**默认管理员**（若已在 compose 中启用 `--init-superuser` 且库中已创建）：

- 邮箱：`admin@ragflow.io`
- 密码：`admin`（登录后请修改）

---

## 8. 日常更新

```bash
cd /opt/ragflow/ragflow
git pull --ff-only

# 若 Dockerfile / download_deps 有变，重新 1→2→3；否则仅重建 API：
TBOX_BUILD_RAGFLOW=1 bash docker/tbox-compose-up.sh
```

---

## 9. 常见问题

### 9.0 `download_deps.py: error: unrecognized arguments: --skip-chrome`

**原因**：服务器上的 **`download_deps.py` 较旧**（只有 `--china-mirrors`），而部署脚本按新版传了 **`--skip-chrome`**（通常因设置了 **`NO_CHROME_DOWNLOAD=1`**）。

**处理**：

```bash
cd /opt/ragflow/ragflow
git pull   # 拉取含「自动跳过不支持参数」的 scripts/pull-local-deps-for-docker.sh
export TBOX_CHINA_DOWNLOAD=1
unset NO_CHROME_DOWNLOAD SKIP_CHROME_DEPS
bash scripts/deploy-on-new-server.sh
```

或暂不跑全量下载，仅构建 API（Hub 上已有 **`ragflow_deps:latest`** 且 **`Dockerfile` 已支持 `tika-server-standard-*.jar`**）：

```bash
cd /opt/ragflow/ragflow/docker
docker compose -f docker-compose.yml --profile cpu build ragflow-cpu
cd .. && bash docker/tbox-compose-up.sh
```

### 9.1 `tika-server-standard-*.jar` 找不到（如 `cannot stat .../3.2.3.jar`）

**原因**：`Dockerfile` 里写死的 Tika 版本与 Hub 上 **`infiniflow/ragflow_deps:latest`** 内实际文件不一致（例如代码要 **3.2.3**、镜像里是 **3.3.0**）。

**处理（任选其一）**：

1. **拉取含兼容 Dockerfile 的代码**（本仓库已改为自动匹配 `tika-server-standard-*.jar`），再构建：
   `git pull && docker build -f Dockerfile -t ragflow-tbox:local .`
2. **推荐新服务器**：`bash scripts/deploy-on-new-server.sh`（先 `download_deps` 再本地 **`Dockerfile.deps`** 构建 deps，与主 Dockerfile 一致）。
3. 查看 Hub deps 里有什么：
   `docker run --rm infiniflow/ragflow_deps:latest ls / | grep tika`

### 9.2 `docker compose build` → `No services to build`

→ 在仓库根用 **`bash scripts/tbox-deps-step-by-step.sh 3`**，或确认 `docker/docker-compose.yml` 中 `ragflow-cpu` 含 **`build:`** 段且已 **`source docker/.env`**。

### 9.3 `no space left on device`（构建末尾）

→ `docker system prune -f`、`docker builder prune -f`，或扩容磁盘后再构建。

### 9.4 `/v1/tbox/health` 404

→ 运行中的镜像不是本仓库构建的 TBOX 镜像；检查 **`RAGFLOW_IMAGE=ragflow-tbox:local`** 并重新 **步骤 3**。

### 9.5 登录 `Email and password do not match`

→ 未 `--init-superuser` 或库中邮箱重复；见 [`TBOX_QUICKSTART.md`](./TBOX_QUICKSTART.md) §3.0、`scripts/tbox-dedupe-admin-email.sh`。

---

## 10. 离线 / 第二台内网服务器

在**第一台联网机**完成 **§5 全部步骤** 后：

```bash
# 打包镜像
docker save infiniflow/ragflow_deps:latest ragflow-tbox:local -o /tmp/ragflow-tbox-images.tar

# 连同仓库目录（含 huggingface.co/、tika*.jar 等）拷贝到内网机
```

内网机：

```bash
docker load -i /tmp/ragflow-tbox-images.tar
cd /opt/ragflow/ragflow/docker
# .env 中: TBOX_COMPOSE_PULL=never
bash ../docker/tbox-compose-up.sh
```

---

## 11. 命令速查

| 目的 | 命令 |
|------|------|
| 新服务器一键部署 | `TBOX_CHINA_DOWNLOAD=1 NO_CHROME_DOWNLOAD=1 bash scripts/deploy-on-new-server.sh` |
| 只下载依赖 | `bash scripts/tbox-deps-step-by-step.sh 1` |
| 只打 deps 镜像 | `bash scripts/tbox-deps-step-by-step.sh 2` |
| 只打 API 镜像 | `bash scripts/tbox-deps-step-by-step.sh 3` |
| 启动栈 | `bash docker/tbox-compose-up.sh` |
| 构建前检查 | `bash scripts/verify-docker-build-prereqs.sh` |
| 修复 Docker 镜像站 | `sudo bash scripts/fix-docker-registry-mirrors.sh` |

---

## 12. 文档索引

| 文档 | 内容 |
|------|------|
| [`TBOX_SYSTEM_USER_MANUAL.md`](./TBOX_SYSTEM_USER_MANUAL.md) | 功能菜单、登录、排障 |
| [`TBOX_DEPLOY_RUNBOOK.md`](./TBOX_DEPLOY_RUNBOOK.md) | Nginx 同源、Worker、详细冒烟 |
| [`TBOX_QUICKSTART.md`](./TBOX_QUICKSTART.md) | 开发联调、权限、账号 |

---

*本手册假设部署分支包含 TBOX 扩展与 `scripts/deploy-on-new-server.sh`。若与 `Dockerfile` / `.env.example` 不一致，以仓库内文件为准。*
