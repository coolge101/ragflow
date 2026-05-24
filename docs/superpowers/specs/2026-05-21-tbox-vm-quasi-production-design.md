# TBOX 虚拟机准生产部署 — 设计说明

**状态**：已批准（2026-05-21）
**Implementation plan:** [`docs/superpowers/plans/2026-05-21-tbox-vm-quasi-production.md`](../plans/2026-05-21-tbox-vm-quasi-production.md)
**范围**：在本 Ubuntu 虚拟机上，以 `/srv/tbox/ragflow` 为唯一正式根目录，完成可内网访问、多用户权限隔离的准生产部署；通过真实使用发现问题并驱动后续改进。

---

## 1. 目标与成功标准

### 1.1 目标

| 维度 | 要求 |
|------|------|
| 部署形态 | **准生产**：非 `npm run dev`，使用 Docker 全栈 + 生产静态 UI |
| 访问 | **局域网**内单一 URL 登录；不同用户 **permissions** 不同、操作不同 |
| 演进 | **阶段 D**：先内网 HTTP，架构预留 **HTTPS + 域名**（宿主机 Nginx） |
| 代码来源 | **`~/ragflow` push → GitHub → `/srv/tbox/ragflow` 干净 clone** |
| 启动 | **阶段 C**：重启 VM 后 **手动一条命令** 启动；稳定后再 **systemd 开机自启** |
| 改进闭环 | 实际业务使用 → 记录问题 → 在 `~/ragflow` 开发 → push → 在 `/srv` 更新部署 |

### 1.2 验收标准（第一阶段）

- [ ] `bash scripts/start-tbox-ragflow.sh --console` 一次成功拉起依赖 + API + tbox-console
- [ ] 内网另一台设备可访问 `http://<VM-LAN-IP>:5180/login` 并登录
- [ ] `curl -sf http://127.0.0.1:9380/v1/tbox/health` 返回 `tbox_api_contract_version`
- [ ] 至少两个账号（如 admin + 普通用户）登录后 **侧栏/功能可见性** 符合 permissions
- [ ] 部署与运维步骤写入运维备忘（本文 + 现有 Runbook 链接）

---

## 2. 架构概览

```text
局域网客户端浏览器
        │
        ▼
http://<VM-IP>:5180  ──►  [tbox-console 容器]
        │                      Nginx: 静态 web-tbox/dist
        │                      反代 /api、/v1 → RAGFlow API
        ▼
host.docker.internal:9380  ──►  [ragflow-cpu 容器]
        │                      Quart API + /v1/tbox/*
        ▼
[docker-compose-base]  MySQL · Redis · MinIO · ES/Infinity
```

### 2.1 组件职责

| 单元 | 职责 | 依赖 |
|------|------|------|
| **docker-compose-base** | 数据与检索依赖 | `docker/.env` |
| **ragflow-cpu** | RAG + TBOX API（`ragflow-tbox:local`） | deps 镜像、MySQL healthy |
| **tbox-console** | 对内网提供 **唯一 Web 入口**（5180） | API 可达、`ragflow-tbox-console:local` |
| **Git 仓库 `/srv/tbox/ragflow`** | 配置、Compose、脚本、构建上下文 | GitHub 远程 |

### 2.2 端口（默认）

| 服务 | 端口 | 对内/对外 |
|------|------|-----------|
| tbox-console | **5180** | **局域网开放**（防火墙放行） |
| RAGFlow API | 9380 | 建议 **仅本机/容器**；用户不直连 |
| MySQL/ES 等 | `.env` 定义 | **不对 LAN 开放** |

### 2.3 不采用的方案（第一阶段）

- **`npm run dev`（5174）**：仅开发联调，不作准生产入口
- **宿主机 Nginx（80/443）**：第二阶段 HTTPS 时再上，反代 5180 或替代 console 容器

---

## 3. 目录与代码流

### 3.1 目录约定

| 路径 | 角色 |
|------|------|
| **`~/ragflow`** | 开发工作区：改代码、测试、push GitHub |
| **`/srv/tbox/ragflow`** | **唯一准生产 clone**：只 pull/build/up，不在此直接改业务代码 |
| **`/opt/ragflow/ragflow`** | 废弃或只读参考；**不**作为正式环境 |

### 3.2 首次部署流水线

1. **开发机** `~/ragflow`：确认含 `api/apps/tbox_app.py`、TBOX 部署脚本、`Dockerfile` Tika 兼容、`tbox-compose-up.sh` 健康检查等 → **push 到 GitHub**
2. **虚拟机**：
   ```bash
   sudo mkdir -p /srv/tbox && sudo chown "$USER":"$USER" /srv/tbox
   git clone git@github.com:<org>/<repo>.git /srv/tbox/ragflow
   cd /srv/tbox/ragflow
   cp docker/.env.example docker/.env   # 编辑密码、RAGFLOW_IMAGE 等
   ```
3. **构建 deps + API + console 镜像**（二选一）：
   - 推荐：`TBOX_CHINA_DOWNLOAD=1 NO_CHROME_DOWNLOAD=1 bash scripts/deploy-on-new-server.sh --build-only`（需远程含新版 `download_deps.py`；否则见 Runbook 分步命令）
   - 或：`pull-local-deps-for-docker.sh` 分步 + `docker compose build`
4. **`docker/.env` 必设**：
   ```bash
   RAGFLOW_IMAGE=ragflow-tbox:local
   TBOX_CONSOLE=1
   TBOX_CONSOLE_PORT=5180
   ```
5. **初始化管理员（可选）**：compose 中 `ragflow-cpu` 增加 `--init-superuser`，重建一次

### 3.3 日常更新

```bash
cd /srv/tbox/ragflow
git pull --ff-only
TBOX_BUILD_RAGFLOW=1 TBOX_CONSOLE=1 bash docker/tbox-compose-up.sh
# 若 web-tbox 或 Dockerfile.tbox-console 有变，需 rebuild console 镜像
```

---

## 4. 运维：一条命令启动（阶段 C）

### 4.1 标准启动命令

```bash
cd /srv/tbox/ragflow
bash scripts/start-tbox-ragflow.sh --console
```

等价于：`TBOX_CONSOLE=1 bash docker/tbox-compose-up.sh`（构建策略见脚本内 `TBOX_BUILD_RAGFLOW`）。

### 4.2 停止

```bash
cd /srv/tbox/ragflow/docker
docker compose -f docker-compose.yml --profile cpu --profile tbox-console down
docker compose -f docker-compose-base.yml --profile elasticsearch down
```

（`DOC_ENGINE` profile 与 `.env` 一致。）

### 4.3 阶段 C → 开机自启（后续）

稳定运行 **1–2 周** 后增加 **systemd unit**（设计预留，本阶段不实现）：

- `After=docker.service`
- `ExecStart=/srv/tbox/ragflow/scripts/start-tbox-ragflow.sh --console`
- `WorkingDirectory=/srv/tbox/ragflow`
- 日志：`journalctl -u tbox-ragflow`

---

## 5. 局域网访问与安全基线

### 5.1 客户端 URL

- 登录页：`http://<VM-局域网-IP>:5180/login`
- **勿**设置 `VITE_AUTH_LOGIN_PATH=/v1/user/login`（console 镜像构建时已用生产配置）

### 5.2 防火墙

- 放行：**5180/tcp**（内网网段若可限定则限定）
- 不放行：9380、5455、1200 等依赖端口对 LAN

### 5.3 准生产最低安全

- 修改 `docker/.env` 全部默认密码
- 首次 `admin@ragflow.io` 登录后改密
- `.env` 不入 Git

---

## 6. 用户与权限

- 认证：**`POST /api/v1/auth/login`**（RSA 密码）
- 授权：**`GET /v1/tbox/me` → permissions**（见 `TBOX_UI_DESIGN_DETAIL.md`）
- 用户管理：**`/users`**（需相应权限；托管用户走 `/v1/tbox/workspaces/.../managed-users`）
- **验收**：准备 admin + 至少一个低权限账号，对比侧栏与写操作（上传、采集、用户管理等）

---

## 7. 问题发现与改进闭环

### 7.1 使用场景建议（驱动改进）

按优先级在内网真实操作并记录：

1. 登录 / 退出 / 权限边界
2. 知识库创建、文档上传、解析状态
3. 检索、对话（含引用展示）
4. 用户与权限管理
5. 采集任务（若启用 worker）

### 7.2 问题记录模板

| 字段 | 说明 |
|------|------|
| 日期 / 操作者 | |
| 页面或 API | 如 `/documents`、POST `/api/v1/...` |
| 期望 | |
| 实际 | 截图 / 日志片段 |
| 环境 | `/srv/tbox/ragflow` commit、`docker compose ps` |
| 严重性 | blocker / major / minor |

存放建议：团队 Issue 或 `docs/tbox-feedback/` 下按日期 markdown（实现阶段再定）。

### 7.3 日志排查

```bash
cd /srv/tbox/ragflow/docker
docker compose -f docker-compose.yml logs --tail 100 ragflow-cpu
docker compose -f docker-compose.yml logs --tail 50 tbox-console
```

---

## 8. 第二阶段（HTTPS / 域名）预留

1. 申请域名 DNS → VM 内网 IP 或公网 IP
2. 宿主机安装 Nginx + Certbot
3. `443` → 反代 `127.0.0.1:5180`（或合并静态与 API 到 443 单入口）
4. 可选：关闭对 LAN 的 5180 直连，仅走 443

**不在第一阶段实施**，避免与「先跑通、先发现问题」冲突。

---

## 9. 风险与缓解

| 风险 | 缓解 |
|------|------|
| GitHub 与 `/srv` 代码不一致 | 仅 `/srv` 部署；开发只在 `~/ragflow` |
| deps/镜像构建失败（网络、磁盘） | `deploy-on-new-server.sh`、国内镜像、`docker builder prune` |
| 双路径遗留 `/opt`、`~/` 混淆 | 文档明确废弃；可选删除旧 clone |
| console 未重建导致 UI 旧 | 更新 web-tbox 后 rebuild `ragflow-tbox-console:local` |

---

## 10. 相关文档

- [`TBOX_DEPLOY_FROM_GITHUB.md`](../../TBOX_DEPLOY_FROM_GITHUB.md)
- [`TBOX_DEPLOY_RUNBOOK.md`](../../TBOX_DEPLOY_RUNBOOK.md)
- [`TBOX_SYSTEM_USER_MANUAL.md`](../../TBOX_SYSTEM_USER_MANUAL.md)
- [`TBOX_QUICKSTART.md`](../../TBOX_QUICKSTART.md)

---

## 11. 待实现项（设计批准后）

本设计 **不包含** 立即写代码；批准后可由 **implementation plan** 覆盖：

1. （可选）`scripts/install-tbox-systemd.sh` — 阶段 C 完成后启用
2. （可选）`/srv` 专用 `docs/tbox-feedback/README.md` 问题记录说明
3. 将本文 **操作摘要** 合并进 `TBOX_DEPLOY_FROM_GITHUB.md` 的「虚拟机准生产 + console」小节

---

**请审阅本文**。Spec 已批准；执行见 implementation plan。
