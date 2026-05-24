# TBOX 虚拟机准生产部署 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在本 Ubuntu 虚拟机上，以 `/srv/tbox/ragflow` 为唯一正式根目录，完成 Docker 全栈 + **tbox-console（5180）** 准生产部署，支持局域网多用户按 permissions 使用，并为后续 HTTPS/systemd 预留路径。

**Architecture:** `~/ragflow` 开发并 push GitHub → `/srv/tbox/ragflow` 干净 clone → `download_deps` + `Dockerfile.deps` + `ragflow-tbox:local` + `ragflow-tbox-console:local` → `start-tbox-ragflow.sh --console` 一条命令启动；用户仅访问 `http://<VM-LAN-IP>:5180`。

**Tech Stack:** Docker Compose v2、RAGFlow Quart API、web-tbox 静态构建、Nginx（tbox-console 容器）、MySQL/ES/Redis/MinIO。

**Spec:** `docs/superpowers/specs/2026-05-21-tbox-vm-quasi-production-design.md`

---

## File Structure（本计划创建/修改）

| 文件 | 职责 |
|------|------|
| `/srv/tbox/ragflow/` | 准生产 Git clone（运行时目录，不在开发仓库内） |
| `/srv/tbox/ragflow/docker/.env` | 密码、镜像名、`TBOX_CONSOLE=1` |
| `docs/tbox-feedback/README.md` | 问题记录模板与路径说明（新建） |
| `docs/TBOX_DEPLOY_FROM_GITHUB.md` | 增加「虚拟机准生产 + console」小节 |
| `docs/superpowers/specs/2026-05-21-tbox-vm-quasi-production-design.md` | 状态改为已批准 |

**不修改：** `~/ragflow` 仅用于开发 push；`/opt/ragflow/ragflow` 废弃。

---

## Task 0: 开发仓库 push 到 GitHub

**Files:**
- Verify: `~/ragflow/api/apps/tbox_app.py`
- Verify: `~/ragflow/scripts/start-tbox-ragflow.sh`
- Verify: `~/ragflow/docker/Dockerfile.tbox-console`

- [ ] **Step 1: 确认 TBOX 与部署脚本存在**

```bash
cd ~/ragflow
test -f api/apps/tbox_app.py && test -f scripts/deploy-on-new-server.sh && test -f docker/Dockerfile.tbox-console
echo "OK: TBOX deploy tree present"
```

- [ ] **Step 2: 本地自检（可选）**

```bash
cd ~/ragflow
bash scripts/verify-docker-build-prereqs.sh || true   # 未构建过会失败，可忽略
git status
```

- [ ] **Step 3: Push 到远程（替换为你的 remote/branch）**

```bash
cd ~/ragflow
git remote -v
git push origin main
```

Expected: `Everything up-to-date` 或 push 成功，无 rejected。

---

## Task 1: 虚拟机前置检查

**Files:** 无（仅命令）

- [ ] **Step 1: Docker 与磁盘**

```bash
docker compose version
df -h /
docker system df
```

Expected: Compose v2.x；根分区可用空间 **≥ 40GB**（构建 HF 模型 + 镜像层）。

- [ ] **Step 2: 修复 Docker Hub 镜像站（若曾出现 USTC DNS 失败）**

```bash
cd ~/ragflow
sudo bash scripts/fix-docker-registry-mirrors.sh
```

Expected: `docker pull hello-world` 或 `docker pull infiniflow/ragflow_deps:latest` 不再报 `no such host`。

- [ ] **Step 3: 记录局域网 IP**

```bash
hostname -I | awk '{print $1}'
```

记下 `<VM-LAN-IP>`，供 Task 8 使用。

---

## Task 2: 创建 `/srv/tbox/ragflow` 并 clone

**Files:**
- Create: `/srv/tbox/ragflow/`（Git 工作树）

- [ ] **Step 1: 创建目录**

```bash
sudo mkdir -p /srv/tbox
sudo chown "$USER":"$USER" /srv/tbox
```

- [ ] **Step 2: Clone（替换 URL）**

```bash
git clone git@github.com:<YOUR_ORG>/<YOUR_REPO>.git /srv/tbox/ragflow
cd /srv/tbox/ragflow
git log -1 --oneline
test -f api/apps/tbox_app.py && echo "OK: TBOX in clone"
```

Expected: commit 与 GitHub `main` 一致，含 `tbox_app.py`。

---

## Task 3: 配置 `docker/.env`

**Files:**
- Create: `/srv/tbox/ragflow/docker/.env`

- [ ] **Step 1: 从模板生成**

```bash
cd /srv/tbox/ragflow/docker
cp .env.example .env
```

- [ ] **Step 2: 写入准生产必选项**

在 `docker/.env` 中确认或追加（密码必须改掉默认值）：

```bash
RAGFLOW_IMAGE=ragflow-tbox:local
TBOX_CONSOLE=1
TBOX_CONSOLE_PORT=5180
DOC_ENGINE=elasticsearch
DEVICE=cpu
SVR_HTTP_PORT=9380
# 国内构建建议：
# TBOX_CHINA_DOWNLOAD=1
# RAGFLOW_BASE_IMAGE=docker.m.daocloud.io/library/ubuntu:24.04
# NEED_MIRROR=1
```

- [ ] **Step 3: 修改敏感项**

编辑 `MYSQL_PASSWORD`、`REDIS_PASSWORD`、`MINIO_*`、`SECRET_KEY` 等为强密码。

Expected: `grep -E '^RAGFLOW_IMAGE=|^TBOX_CONSOLE=' docker/.env` 输出上述两行。

---

## Task 4: 下载构建依赖（步骤 1）

**Files:**
- Create: `/srv/tbox/ragflow/tika-server-standard-*.jar`
- Create: `/srv/tbox/ragflow/huggingface.co/InfiniFlow/deepdoc/det.onnx`
- Create: `/srv/tbox/ragflow/nltk_data/`

- [ ] **Step 1: 分步下载（国内网络）**

```bash
cd /srv/tbox/ragflow
export TBOX_CHINA_DOWNLOAD=1
export NO_CHROME_DOWNLOAD=1
bash scripts/tbox-deps-step-by-step.sh 1
```

若报 `unrecognized arguments: --skip-chrome`：去掉 `NO_CHROME_DOWNLOAD`，仅保留 `TBOX_CHINA_DOWNLOAD=1` 重跑；或先 `git pull` 获取新版 `download_deps.py`。

Expected: 末尾无 traceback；存在 `huggingface.co/InfiniFlow/deepdoc/det.onnx`。

- [ ] **Step 2: 验证关键文件**

```bash
cd /srv/tbox/ragflow
ls -lh tika-server-standard-*.jar
test -f huggingface.co/InfiniFlow/deepdoc/det.onnx && echo "OK: deepdoc"
```

---

## Task 5: 构建 `infiniflow/ragflow_deps:latest`（步骤 2）

**Files:** Docker 镜像 `infiniflow/ragflow_deps:latest`

- [ ] **Step 1: 构建 deps 镜像**

```bash
cd /srv/tbox/ragflow
bash scripts/tbox-deps-step-by-step.sh 2
```

Expected: `OK: infiniflow/ragflow_deps:latest`

- [ ] **Step 2: 验证**

```bash
docker run --rm infiniflow/ragflow_deps:latest ls / | grep tika
```

---

## Task 6: 构建 API 镜像 `ragflow-tbox:local`（步骤 3）

**Files:** Docker 镜像 `ragflow-tbox:local`

- [ ] **Step 1: Compose build**

```bash
cd /srv/tbox/ragflow
export TBOX_CHINA_DOWNLOAD=1
bash scripts/tbox-deps-step-by-step.sh 3
```

Expected: `Image ragflow-tbox:local Built` 或 build 成功无 ERROR。

- [ ] **Step 2: 若磁盘满**

```bash
docker builder prune -f
docker system prune -f
# 然后重跑 Step 1
```

---

## Task 7: 构建 console 镜像 `ragflow-tbox-console:local`

**Files:**
- Build: `docker/Dockerfile.tbox-console` → `ragflow-tbox-console:local`

- [ ] **Step 1: 构建 tbox-console**

```bash
cd /srv/tbox/ragflow/docker
docker compose -f docker-compose.yml --profile tbox-console build tbox-console
```

Expected: `ragflow-tbox-console:local` 出现在 `docker images`。

- [ ] **Step 2: 确认镜像**

```bash
docker image inspect ragflow-tbox-console:local -f '{{.Id}}'
```

---

## Task 8: （可选）初始化管理员

**Files:**
- Modify: `/srv/tbox/ragflow/docker/docker-compose.yml` — `ragflow-cpu` 的 `command`

- [ ] **Step 1: 若库中尚无用户，在 `command` 增加 `--init-superuser`**

```yaml
command:
  - --enable-adminserver
  - --init-superuser
```

- [ ] **Step 2: 仅首次重建 ragflow-cpu**

```bash
cd /srv/tbox/ragflow/docker
docker compose -f docker-compose.yml --profile cpu up -d --force-recreate ragflow-cpu
```

默认账号：`admin@ragflow.io` / `admin`（登录后改密）。

若用户已存在，**不要**重复 init。

---

## Task 9: 防火墙放行 5180

**Files:** 无（ufw 或 iptables）

- [ ] **Step 1: UFW 示例（若启用 ufw）**

```bash
sudo ufw allow 5180/tcp comment 'TBOX console LAN'
sudo ufw status
```

Expected: 5180 ALLOW；**不要**对 LAN 开放 9380/5455/1200。

---

## Task 10: 首次启动全栈

**Files:** 无

- [ ] **Step 1: 一条命令启动**

```bash
cd /srv/tbox/ragflow
bash scripts/start-tbox-ragflow.sh --console
```

Expected 输出含：

```text
OK: RAGFlow HTTP responds.
OK: TBOX is active
Done.
TBOX console: http://127.0.0.1:5180/
```

- [ ] **Step 2: 容器状态**

```bash
cd /srv/tbox/ragflow/docker
docker compose -f docker-compose.yml --profile cpu --profile tbox-console ps
```

Expected: `ragflow-cpu`、`tbox-console`、mysql、redis、minio、es 等为 Up/Healthy。

---

## Task 11: 本机冒烟测试

**Files:** 无

- [ ] **Step 1: API 与 TBOX**

```bash
curl -sf http://127.0.0.1:9380/api/v1/auth/login/channels | head -c 80
curl -sf http://127.0.0.1:9380/v1/tbox/health | python3 -m json.tool
curl -sf -o /dev/null -w '%{http_code}\n' http://127.0.0.1:5180/login
```

Expected: 前两行 JSON `code:0`；最后一行 `200`。

- [ ] **Step 2: 浏览器本机**

打开 `http://127.0.0.1:5180/login`，用 admin 登录，确认主壳与侧栏加载。

---

## Task 12: 局域网验收 + 多用户权限

**Files:** 无

- [ ] **Step 1: 另一台内网设备访问**

浏览器打开：`http://<VM-LAN-IP>:5180/login`

- [ ] **Step 2: 准备第二个账号**

通过 `/users`（admin）创建低权限用户，或 `POST /api/v1/users`（若 `REGISTER_ENABLED=1`）。

- [ ] **Step 3: 对比 permissions**

分别登录 admin 与低权限用户，确认侧栏差异（如 `crawl.manage`、`doc.upload` 等）符合 `TBOX_UI_DESIGN_DETAIL.md`。

勾选 spec §1.2 全部验收项。

---

## Task 13: 文档与问题记录闭环

**Files:**
- Create: `docs/tbox-feedback/README.md`
- Modify: `docs/TBOX_DEPLOY_FROM_GITHUB.md`
- Modify: `docs/superpowers/specs/2026-05-21-tbox-vm-quasi-production-design.md`

- [ ] **Step 1: 创建问题记录说明**

在 `docs/tbox-feedback/README.md` 写入 spec §7.2 表格模板，并说明：问题在 `~/ragflow` 修复 → push → `/srv/tbox/ragflow` 执行 Task 14 更新流程。

- [ ] **Step 2: 部署手册增加准生产小节**

在 `docs/TBOX_DEPLOY_FROM_GITHUB.md` 增加链接到 spec，并摘要：

- 正式路径 `/srv/tbox/ragflow`
- `bash scripts/start-tbox-ragflow.sh --console`
- LAN URL `http://<IP>:5180`

- [ ] **Step 3: 更新 spec 状态**

将 `2026-05-21-tbox-vm-quasi-production-design.md` 首行状态改为 **已批准 / 已部署（日期）**。

---

## Task 14: 日常运维备忘（无代码）

- [ ] **Step 1: 写入运维卡片（可贴在团队 Wiki）**

```text
启动:  cd /srv/tbox/ragflow && bash scripts/start-tbox-ragflow.sh --console
停止:  cd /srv/tbox/ragflow/docker && docker compose -f docker-compose.yml --profile cpu --profile tbox-console down
更新:  cd /srv/tbox/ragflow && git pull && TBOX_BUILD_RAGFLOW=1 TBOX_CONSOLE=1 bash docker/tbox-compose-up.sh
日志:  docker compose -f docker-compose.yml logs --tail 100 ragflow-cpu
入口:  http://<VM-LAN-IP>:5180/login
```

- [ ] **Step 2: 标记废弃路径**

确认不再使用 `/opt/ragflow/ragflow` 启动生产栈；可选停止其容器：

```bash
cd /opt/ragflow/ragflow/docker 2>/dev/null && docker compose -f docker-compose.yml --profile cpu down || true
```

---

## Task 15: （第二阶段，稳定 1–2 周后）systemd 开机自启

**Files:**
- Create: `scripts/install-tbox-systemd.sh`（可选，本阶段 **不执行**）

- [ ] **Step 1: 创建 unit（实现时再写脚本）**

`/etc/systemd/system/tbox-ragflow.service`：

```ini
[Unit]
Description=TBOX RAGFlow stack (console)
After=docker.service
Requires=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=/srv/tbox/ragflow
ExecStart=/srv/tbox/ragflow/scripts/start-tbox-ragflow.sh --console
ExecStop=/bin/bash -c 'cd /srv/tbox/ragflow/docker && docker compose -f docker-compose.yml --profile cpu --profile tbox-console down'
User=root

[Install]
WantedBy=multi-user.target
```

- [ ] **Step 2: 启用（仅稳定后）**

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now tbox-ragflow.service
journalctl -u tbox-ragflow -n 50
```

---

## Spec Coverage Self-Review

| Spec 要求 | 对应 Task |
|-----------|-----------|
| `/srv/tbox/ragflow` 唯一正式目录 | Task 2 |
| GitHub clone 来源 | Task 0, 2 |
| tbox-console 5180 | Task 3, 7, 10 |
| 一条命令启动 | Task 10, 14 |
| 手动启动阶段 C | Task 10（systemd 在 Task 15 延后） |
| 局域网 + 权限 | Task 9, 12 |
| HTTPS 预留 | 不在本计划（spec §8） |
| 问题发现闭环 | Task 13 |
| 验收清单 §1.2 | Task 11, 12 |

---

## Plan complete

**Plan saved to:** `docs/superpowers/plans/2026-05-21-tbox-vm-quasi-production.md`

**Two execution options:**

1. **Subagent-Driven（推荐）** — 按 Task 0→14 分派子任务，每步完成后核对 Expected 输出
2. **Inline Execution** — 在本会话中逐步执行命令，遇错即停并修复

**Which approach?**
