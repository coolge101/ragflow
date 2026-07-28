#!/usr/bin/env bash
# 远端（或本机）：git pull + 从备份目录恢复 KB 数据。
#
# Usage:
#   bash scripts/tbox_sync_pull.sh
#   bash scripts/tbox_sync_pull.sh tbox-sync-20260621-120000
#   TBOX_SYNC_BACKUP_NAME=tbox-sync-20260621-120000 bash scripts/tbox_sync_pull.sh
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$ROOT/scripts/tbox_sync.env"
if [[ -f "$ENV_FILE" ]]; then
  # shellcheck disable=SC1090
  set -a
  source "$ENV_FILE"
  set +a
fi

GIT_REMOTE="${TBOX_SYNC_GIT_REMOTE:-myrepo}"
GIT_BRANCH="${TBOX_SYNC_GIT_BRANCH:-tbox-deploy}"
BACKUP_ROOT="${TBOX_SYNC_LOCAL_BACKUP_ROOT:-$ROOT/backups}"
BACKUP_NAME="${1:-${TBOX_SYNC_BACKUP_NAME:-}}"

if [[ -z "$BACKUP_NAME" && -L "$BACKUP_ROOT/tbox-sync-latest" ]]; then
  BACKUP_DIR="$(readlink -f "$BACKUP_ROOT/tbox-sync-latest")"
elif [[ -n "$BACKUP_NAME" ]]; then
  BACKUP_DIR="$BACKUP_ROOT/$BACKUP_NAME"
else
  BACKUP_DIR="$(ls -td "$BACKUP_ROOT"/tbox-sync-* 2>/dev/null | head -1 || true)"
fi

if [[ -z "$BACKUP_DIR" || ! -d "$BACKUP_DIR" ]]; then
  echo "ERROR: 找不到备份目录。用法: bash scripts/tbox_sync_pull.sh <backup-dir-name>" >&2
  exit 1
fi

echo "==> Git pull ($GIT_REMOTE $GIT_BRANCH)..."
git -C "$ROOT" fetch "$GIT_REMOTE" "$GIT_BRANCH"
git -C "$ROOT" checkout "$GIT_BRANCH"
git -C "$ROOT" pull "$GIT_REMOTE" "$GIT_BRANCH"

COMMIT="$(tr -d '\n' <"$BACKUP_DIR/git_commit.txt" 2>/dev/null || echo "")"
if [[ -n "$COMMIT" && "$COMMIT" != unknown ]]; then
  echo "==> Backup git commit: $COMMIT (optional checkout)"
  git -C "$ROOT" checkout "$COMMIT" 2>/dev/null || echo "NOTE: 保持分支 HEAD，未强制 checkout 备份 commit"
fi

echo "==> Restore data from $BACKUP_DIR"
bash "$ROOT/scripts/tbox_sync_restore.sh" "$BACKUP_DIR"

echo "==> Pull sync done. Verify: http://127.0.0.1:5180"
