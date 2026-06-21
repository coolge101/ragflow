# TBOX 本机 ↔ 远端同步指南

> 适用：**Linux 开发机** ↔ **Windows Docker Desktop**（或 Linux 服务器）。
> 代码走 **GitHub**；知识库/文档走 **备份包 + rsync**（含 MySQL、MinIO、Elasticsearch/Infinity 卷）。

相关脚本：`scripts/tbox_sync_*.sh`、`scripts/tbox_sync_pull.ps1`
首次部署仍见 [`TBOX_DEPLOY_FROM_GITHUB.md`](./TBOX_DEPLOY_FROM_GITHUB.md)。

---

## 1. 一次性配置

```bash
cd ~/ragflow
cp scripts/tbox_sync.env.example scripts/tbox_sync.env
# 编辑 scripts/tbox_sync.env（勿提交）
```

| 变量 | 本机示例 | 说明 |
|------|----------|------|
| `TBOX_SYNC_GIT_REMOTE` | `myrepo` | `git remote` 名 |
| `TBOX_SYNC_GIT_BRANCH` | `tbox-deploy` | 同步分支 |
| `TBOX_SYNC_REMOTE` | `Administrator@192.168.1.50` | Windows OpenSSH 或 WSL |
| `TBOX_SYNC_REMOTE_BACKUP_DIR` | `/c/ragflow/backups` | Git Bash/rsync 路径；或 `/cygdrive/c/ragflow/backups` |
| `TBOX_SYNC_REMOTE_REPO` | `/c/ragflow/ragflow` | 远端仓库根（用于 rsync `.env`） |

Windows 需：**Docker Desktop**、**Git for Windows**（含 bash）、可选 **OpenSSH Server**。

---

## 2. 本机 → 远端（推送）

### 2.1 仅代码（已 commit）

```bash
git push myrepo tbox-deploy
```

远端：

```powershell
cd C:\ragflow\ragflow
git pull origin tbox-deploy   # 或 myrepo，视 remote 名而定
```

### 2.2 代码 + 知识库数据（推荐）

```bash
bash scripts/tbox_sync_push.sh
```

流程：

1. `git push`（若 `TBOX_SYNC_GIT_PUSH=1`）
2. `tbox_sync_backup.sh` → `backups/tbox-sync-YYYYMMDD-HHMMSS/`
3. `rsync` 备份目录到远端 `TBOX_SYNC_REMOTE_BACKUP_DIR`

仅本地打包、不 rsync：

```bash
bash scripts/tbox_sync_backup.sh
# 或
bash scripts/tbox_sync_push.sh --backup-only
```

### 2.3 备份包内容

| 文件 | 说明 |
|------|------|
| `rag_flow.sql` | MySQL |
| `minio_data.tar.gz` | 文档原文 / 对象存储 |
| `doc_engine_data.tar.gz` | ES 或 Infinity 卷 |
| `docker.env.local` | `docker/.env` 副本（**勿 push Git**） |
| `MANIFEST.json` | 引擎类型、卷名、git commit |

---

## 3. 远端 ← 本机（拉取）

### 3.1 Windows（PowerShell + Git Bash）

先将备份拷到 `C:\ragflow\backups\tbox-sync-...`（或由 rsync 推送）。

```powershell
cd C:\ragflow\ragflow
git clone -b tbox-deploy https://github.com/coolge101/ragflow.git .   # 首次
.\scripts\tbox_sync_pull.ps1 -BackupName "tbox-sync-20260621-075600"
```

或指定目录：

```powershell
.\scripts\tbox_sync_pull.ps1 -BackupDir "C:\ragflow\backups\tbox-sync-20260621-075600"
```

### 3.2 Linux / Git Bash

```bash
bash scripts/tbox_sync_pull.sh tbox-sync-20260621-075600
```

等价于：`git pull` + `tbox_sync_restore.sh`。

### 3.3 恢复后启动栈

```bash
bash docker/tbox-compose-up.sh
# 或 Windows Git Bash 下同命令
# 首次 Windows 仍可能需要：bash scripts/deploy-on-new-server.sh
```

验证：`http://127.0.0.1:5180`、知识库与文档列表。

---

## 4. 日常同步节奏

| 场景 | 本机 | 远端 |
|------|------|------|
| 只改代码 | `git push` | `git pull` + 重建 `tbox-console` / `ragflow-cpu` 镜像（若需） |
| 改了 KB/文档 | `bash scripts/tbox_sync_push.sh` | `tbox_sync_pull.ps1` 或 `tbox_sync_pull.sh` |
| 远端改完要回灌本机 | 远端跑 `tbox_sync_backup.sh` 拷回 | 本机 `tbox_sync_restore.sh` |

---

## 5. 注意

- **不要** `docker compose down -v`（会删卷）。
- **`docker/.env`** 含密码：用备份包或 `scp`/`rsync` 单独同步，勿提交 GitHub。
- Redis 未打包；不影响 KB 正文。
- 搜狐等 **robots.txt** 站点与同步无关；采集策略见采集页配置。
- 若 `DOC_ENGINE=infinity`，备份/恢复自动用 `infinity_data` 卷（见 `MANIFEST.json`）。

---

## 6. 故障排查

| 现象 | 处理 |
|------|------|
| `allowed_domains skipped` | 允许域名只填 host，不要 `https://` |
| `blocked by robots.txt` | 换源或勿爬该站；与 sync 无关 |
| rsync 连不上 Windows | 开 OpenSSH；路径用 `/c/...` 或 `/cygdrive/c/...` |
| restore 后 ES 起不来 | 确认 `.env` 中 `DOC_ENGINE` / `STACK_VERSION` 与源机一致 |
| `Everything up-to-date` 但本机有改动 | 先 `git add` + `git commit` 再 push |

---

## 7. 脚本索引

| 脚本 | 作用 |
|------|------|
| `tbox_sync_backup.sh` | 本机打数据包 |
| `tbox_sync_restore.sh` | 从数据包恢复卷 + 导入 MySQL |
| `tbox_sync_push.sh` | push + 备份 + rsync 到远端 |
| `tbox_sync_pull.sh` | pull + restore（bash） |
| `tbox_sync_pull.ps1` | pull + restore（Windows） |
| `tbox_sync.env.example` | 配置模板 |
