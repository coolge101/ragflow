#!/usr/bin/env bash
# 若 user 表中存在多条相同 admin@ragflow.io，登录可能命中错误行，出现 "Email and password do not match!"。
# 本脚本保留最早创建的一条，将其余同邮箱行改名为 dup+<id>@local.invalid（不删行，避免外键问题）。
#
# 用法（仓库根）:  ./scripts/tbox-dedupe-admin-email.sh
# 依赖: docker, 运行中的 docker-mysql-1，与 docker/.env 中 MYSQL_PASSWORD 一致（默认 infini_rag_flow）。
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck disable=SC1091
set -a
[[ -f "$ROOT/docker/.env" ]] && source "$ROOT/docker/.env"
set +a
PW="${MYSQL_PASSWORD:-infini_rag_flow}"
DB="${MYSQL_DBNAME:-rag_flow}"

echo "==> Rows with email admin@ragflow.io:"
docker exec docker-mysql-1 mysql -uroot -p"$PW" "$DB" -e "SELECT id, email, create_time FROM user WHERE email='admin@ragflow.io' ORDER BY create_time ASC, id ASC;" 2>/dev/null | sed '/Using a password/d'

CNT=$(docker exec docker-mysql-1 mysql -uroot -p"$PW" -N -e "SELECT COUNT(*) FROM ${DB}.user WHERE email='admin@ragflow.io';" 2>/dev/null | tail -1 | tr -d '[:space:]')
if [[ "${CNT:-0}" -le 1 ]]; then
  echo "==> Only one (or zero) admin@ragflow.io row — nothing to rename."
  exit 0
fi

echo "==> Renaming duplicate admin@ragflow.io rows (keeping earliest create_time / id)..."
docker exec docker-mysql-1 mysql -uroot -p"$PW" "$DB" -e "
UPDATE user SET email = CONCAT('dup+', id, '@local.invalid')
WHERE email = 'admin@ragflow.io'
AND id NOT IN (
  SELECT keep_id FROM (
    SELECT id AS keep_id FROM user WHERE email = 'admin@ragflow.io' ORDER BY create_time ASC, id ASC LIMIT 1
  ) z
);
" 2>/dev/null | sed '/Using a password/d'

echo "==> After:"
docker exec docker-mysql-1 mysql -uroot -p"$PW" "$DB" -e "SELECT id, email, create_time FROM user WHERE email LIKE 'admin%' OR email LIKE 'dup+%' ORDER BY email;" 2>/dev/null | sed '/Using a password/d'
echo "==> Done. Retry web-tbox login: admin@ragflow.io / admin"
