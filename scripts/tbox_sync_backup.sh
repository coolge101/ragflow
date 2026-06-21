#!/usr/bin/env bash
# 打包 TBOX 运行数据（MySQL + MinIO + 文档引擎卷）供远端恢复。
#
# Usage:
#   bash scripts/tbox_sync_backup.sh
#   TBOX_SYNC_BACKUP_DIR=/path/to/dir bash scripts/tbox_sync_backup.sh
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=scripts/tbox_sync_lib.sh
source "$ROOT/scripts/tbox_sync_lib.sh"

tbox_sync_require_docker
tbox_sync_load_docker_env "$ROOT"
tbox_sync_ensure_alpine

STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP_DIR="${TBOX_SYNC_BACKUP_DIR:-$ROOT/backups/tbox-sync-$STAMP}"
mkdir -p "$BACKUP_DIR"

MYSQL_CTN="$(tbox_sync_mysql_container)"
MINIO_VOL="$(tbox_sync_volume_name minio_data)"
DOC_VOL="$(tbox_sync_volume_name "$(tbox_sync_doc_engine_volume_suffix)")"

echo "==> TBOX backup → $BACKUP_DIR"
echo "    DOC_ENGINE=$DOC_ENGINE  mysql=$MYSQL_CTN  minio_vol=$MINIO_VOL  doc_vol=$DOC_VOL"

echo "==> MySQL dump ($MYSQL_DBNAME)..."
docker exec "$MYSQL_CTN" mysqldump -uroot -p"${MYSQL_PASSWORD}" \
  --single-transaction --routines --triggers "$MYSQL_DBNAME" \
  >"$BACKUP_DIR/rag_flow.sql"

echo "==> MinIO volume..."
docker run --rm -v "${MINIO_VOL}:/data:ro" -v "$BACKUP_DIR:/backup" alpine:3.20 \
  sh -c 'tar czf /backup/minio_data.tar.gz -C /data .'

DOC_ARCHIVE="doc_engine_data.tar.gz"
echo "==> Document engine volume ($DOC_VOL)..."
docker run --rm -v "${DOC_VOL}:/data:ro" -v "$BACKUP_DIR:/backup" alpine:3.20 \
  sh -c "tar czf /backup/${DOC_ARCHIVE} -C /data ."

cp "$ROOT/docker/.env" "$BACKUP_DIR/docker.env.local"
git -C "$ROOT" rev-parse HEAD >"$BACKUP_DIR/git_commit.txt" 2>/dev/null || echo unknown >"$BACKUP_DIR/git_commit.txt"
git -C "$ROOT" rev-parse --abbrev-ref HEAD >"$BACKUP_DIR/git_branch.txt" 2>/dev/null || echo unknown >"$BACKUP_DIR/git_branch.txt"

cat >"$BACKUP_DIR/MANIFEST.json" <<EOF
{
  "created_at": "$(date -Iseconds)",
  "doc_engine": "${DOC_ENGINE}",
  "doc_volume_suffix": "$(tbox_sync_doc_engine_volume_suffix)",
  "doc_archive": "${DOC_ARCHIVE}",
  "mysql_dbname": "${MYSQL_DBNAME}",
  "compose_project": "${COMPOSE_PROJECT_NAME:-docker}",
  "git_commit": "$(tr -d '\n' <"$BACKUP_DIR/git_commit.txt")",
  "git_branch": "$(tr -d '\n' <"$BACKUP_DIR/git_branch.txt")"
}
EOF

cp "$ROOT/docs/TBOX_SYNC_LOCAL_REMOTE.md" "$BACKUP_DIR/SYNC_README.md" 2>/dev/null || \
  cp "$ROOT/backups/tbox-migration-20260621/RESTORE_WINDOWS.md" "$BACKUP_DIR/RESTORE_WINDOWS.md" 2>/dev/null || true

ln -sfn "$BACKUP_DIR" "$ROOT/backups/tbox-sync-latest" 2>/dev/null || true

echo "==> Done."
ls -lh "$BACKUP_DIR"
echo ""
echo "BACKUP_DIR=$BACKUP_DIR"
echo "Restore on target: bash scripts/tbox_sync_restore.sh $BACKUP_DIR"
