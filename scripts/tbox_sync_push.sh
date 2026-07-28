#!/usr/bin/env bash
# 本机 → 远端：git push（可选）+ 数据备份 + rsync 到远端。
#
# Setup:
#   cp scripts/tbox_sync.env.example scripts/tbox_sync.env
#   编辑 TBOX_SYNC_REMOTE、TBOX_SYNC_REMOTE_BACKUP_DIR
#
# Usage:
#   bash scripts/tbox_sync_push.sh
#   bash scripts/tbox_sync_push.sh --no-git
#   bash scripts/tbox_sync_push.sh --backup-only
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$ROOT/scripts/tbox_sync.env"
if [[ -f "$ENV_FILE" ]]; then
  # shellcheck disable=SC1090
  set -a
  source "$ENV_FILE"
  set +a
fi

GIT_PUSH=1
RSYNC=1
REMOTE_RESTORE="${TBOX_SYNC_REMOTE_RESTORE:-0}"
for arg in "$@"; do
  case "$arg" in
    --no-git) GIT_PUSH=0 ;;
    --backup-only) RSYNC=0; REMOTE_RESTORE=0 ;;
    --with-restore) REMOTE_RESTORE=1 ;;
  esac
done

REMOTE="${TBOX_SYNC_REMOTE:-}"
REMOTE_BACKUP="${TBOX_SYNC_REMOTE_BACKUP_DIR:-}"
GIT_REMOTE="${TBOX_SYNC_GIT_REMOTE:-myrepo}"
GIT_BRANCH="${TBOX_SYNC_GIT_BRANCH:-tbox-deploy}"

if [[ "$GIT_PUSH" -eq 1 && "${TBOX_SYNC_GIT_PUSH:-1}" -eq 1 ]]; then
  echo "==> Git push ($GIT_REMOTE $GIT_BRANCH)..."
  if ! git -C "$ROOT" diff --quiet || ! git -C "$ROOT" diff --cached --quiet; then
    echo "WARNING: 工作区有未提交改动，仅 push 已 commit 的内容。" >&2
    git -C "$ROOT" status -sb >&2 || true
  fi
  git -C "$ROOT" push "$GIT_REMOTE" "$GIT_BRANCH"
fi

echo "==> Data backup..."
BACKUP_OUT="$(bash "$ROOT/scripts/tbox_sync_backup.sh")"
echo "$BACKUP_OUT"
BACKUP_DIR="$(echo "$BACKUP_OUT" | sed -n 's/^BACKUP_DIR=//p' | tail -1)"
if [[ -z "$BACKUP_DIR" || ! -d "$BACKUP_DIR" ]]; then
  BACKUP_DIR="$(readlink -f "$ROOT/backups/tbox-sync-latest" 2>/dev/null || ls -td "$ROOT"/backups/tbox-sync-* 2>/dev/null | head -1)"
fi

if [[ "$RSYNC" -eq 0 ]]; then
  echo "==> --backup-only: skip rsync. Backup at $BACKUP_DIR"
  exit 0
fi

if [[ -z "$REMOTE" || -z "$REMOTE_BACKUP" ]]; then
  echo "ERROR: 请配置 scripts/tbox_sync.env 中 TBOX_SYNC_REMOTE 与 TBOX_SYNC_REMOTE_BACKUP_DIR" >&2
  echo "  或仅本地备份: bash scripts/tbox_sync_backup.sh" >&2
  exit 1
fi

echo "==> rsync backup → ${REMOTE}:${REMOTE_BACKUP}/"
ssh "$REMOTE" "mkdir -p '$REMOTE_BACKUP'"
rsync -av --progress "$BACKUP_DIR/" "${REMOTE}:${REMOTE_BACKUP}/$(basename "$BACKUP_DIR")/"

echo "==> rsync docker.env.local (secrets, not in git)..."
rsync -av "$ROOT/docker/.env" "${REMOTE}:${TBOX_SYNC_REMOTE_REPO:-}/docker/.env" 2>/dev/null || \
  echo "NOTE: 跳过 .env rsync（请配置 TBOX_SYNC_REMOTE_REPO 或远端手动 copy docker.env.local）"

if [[ "$REMOTE_RESTORE" -eq 1 ]]; then
  REMOTE_REPO="${TBOX_SYNC_REMOTE_REPO:-}"
  if [[ -z "$REMOTE_REPO" ]]; then
    echo "ERROR: TBOX_SYNC_REMOTE_RESTORE=1 需要 TBOX_SYNC_REMOTE_REPO" >&2
    exit 1
  fi
  echo "==> Remote git pull + restore..."
  ssh "$REMOTE" "cd '$REMOTE_REPO' && git fetch $GIT_REMOTE $GIT_BRANCH && git checkout $GIT_BRANCH && git pull $GIT_REMOTE $GIT_BRANCH && bash scripts/tbox_sync_restore.sh '$REMOTE_BACKUP/$(basename "$BACKUP_DIR")'"
fi

echo "==> Push done."
echo "    Backup: $BACKUP_DIR"
echo "    Remote: ${REMOTE}:${REMOTE_BACKUP}/$(basename "$BACKUP_DIR")"
echo "    On remote: bash scripts/tbox_sync_pull.sh $(basename "$BACKUP_DIR")"
