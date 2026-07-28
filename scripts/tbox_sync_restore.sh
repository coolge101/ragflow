#!/usr/bin/env bash
# 从 tbox_sync_backup.sh 生成的目录恢复 KB 数据（覆盖远端/本机 Docker 卷）。
#
# Usage:
#   bash scripts/tbox_sync_restore.sh /path/to/backups/tbox-sync-YYYYMMDD-HHMMSS
#   bash scripts/tbox_sync_restore.sh backups/tbox-sync-latest
set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: bash scripts/tbox_sync_restore.sh <backup-dir>" >&2
  exit 1
fi

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=scripts/tbox_sync_lib.sh
source "$ROOT/scripts/tbox_sync_lib.sh"

BACKUP_DIR="$(cd "$1" && pwd)"
if [[ ! -f "$BACKUP_DIR/rag_flow.sql" ]]; then
  echo "ERROR: not a TBOX backup dir (missing rag_flow.sql): $BACKUP_DIR" >&2
  exit 1
fi

tbox_sync_require_docker
tbox_sync_ensure_alpine

COMPOSE_DIR="$(tbox_sync_compose_dir)"
cd "$COMPOSE_DIR"

if [[ -f "$BACKUP_DIR/docker.env.local" ]]; then
  echo "==> Installing docker/.env from backup (existing file → docker/.env.bak)"
  cp -a .env .env.bak 2>/dev/null || true
  cp "$BACKUP_DIR/docker.env.local" .env
fi

tbox_sync_load_docker_env "$ROOT"

DOC_ARCHIVE="doc_engine_data.tar.gz"
if [[ -f "$BACKUP_DIR/MANIFEST.json" ]] && command -v python3 >/dev/null 2>&1; then
  DOC_ARCHIVE="$(python3 -c "import json; print(json.load(open('$BACKUP_DIR/MANIFEST.json'))['doc_archive'])")"
fi

MINIO_VOL="$(tbox_sync_volume_name minio_data)"
DOC_VOL="$(tbox_sync_volume_name "$(tbox_sync_doc_engine_volume_suffix)")"

echo "==> Restore from $BACKUP_DIR"
echo "    DOC_ENGINE=$DOC_ENGINE  minio_vol=$MINIO_VOL  doc_vol=$DOC_VOL"

case "${DOC_ENGINE}" in
  infinity)
    DOC_SVC="infinity"
    PROFILE=(--profile infinity)
    ;;
  opensearch)
    DOC_SVC="opensearch01"
    PROFILE=(--profile opensearch)
    ;;
  *)
    DOC_SVC="es01"
    PROFILE=(--profile elasticsearch)
    ;;
esac

echo "==> Starting base services (empty volumes if first run)..."
docker compose -f docker-compose-base.yml up -d mysql minio redis
docker compose -f docker-compose-base.yml "${PROFILE[@]}" up -d "$DOC_SVC"

echo "==> Waiting for MySQL..."
for _ in $(seq 1 60); do
  if docker compose -f docker-compose-base.yml exec -T mysql mysqladmin ping -uroot -p"${MYSQL_PASSWORD}" --silent 2>/dev/null; then
    break
  fi
  sleep 2
done

echo "==> Stop writers before volume restore..."
docker compose -f docker-compose-base.yml stop minio "$DOC_SVC" 2>/dev/null || true

echo "==> MySQL import..."
docker compose -f docker-compose-base.yml start mysql
sleep 3
docker compose -f docker-compose-base.yml exec -T mysql \
  mysql -uroot -p"${MYSQL_PASSWORD}" -e "CREATE DATABASE IF NOT EXISTS \`${MYSQL_DBNAME}\`;"
docker compose -f docker-compose-base.yml exec -T mysql \
  mysql -uroot -p"${MYSQL_PASSWORD}" "$MYSQL_DBNAME" <"$BACKUP_DIR/rag_flow.sql"

echo "==> MinIO volume restore..."
docker run --rm -v "${MINIO_VOL}:/data" -v "$BACKUP_DIR:/backup:ro" alpine:3.20 \
  sh -c 'rm -rf /data/* /data/.[!.]* 2>/dev/null; tar xzf /backup/minio_data.tar.gz -C /data'

echo "==> Document engine volume restore ($DOC_ARCHIVE)..."
docker run --rm -v "${DOC_VOL}:/data" -v "$BACKUP_DIR:/backup:ro" alpine:3.20 \
  sh -c "rm -rf /data/* /data/.[!.]* 2>/dev/null; tar xzf /backup/${DOC_ARCHIVE} -C /data"

docker compose -f docker-compose-base.yml start minio
docker compose -f docker-compose-base.yml "${PROFILE[@]}" start "$DOC_SVC"

echo "==> Restore complete. Start full stack:"
echo "    cd $ROOT && bash docker/tbox-compose-up.sh"
