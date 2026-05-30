#!/usr/bin/env bash
# TBOX 磁盘清理（不删除 Docker volumes / 数据库数据）
#
# Usage:
#   bash scripts/tbox_disk_cleanup.sh           # 预览 + 执行安全清理
#   bash scripts/tbox_disk_cleanup.sh --dry-run
#
# 数据库 volume（mysql_data 等）默认不碰。删除 volume 须维护者两次确认后再单独操作。
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DRY=0
[[ "${1:-}" == "--dry-run" ]] && DRY=1

run() {
  if [[ "$DRY" -eq 1 ]]; then
    echo "[dry-run] $*"
  else
    "$@"
  fi
}

echo "==> Disk before"
df -h / /data 2>/dev/null || df -h /
echo ""
docker system df 2>/dev/null || true
echo ""

echo "==> Remove dangling Docker images (not volumes)"
run docker image prune -f

echo "==> Remove unused Hub ragflow images (keep ragflow-tbox:local in use)"
while read -r repo tag id; do
  [[ -z "$repo" ]] && continue
  if [[ "$repo" == "infiniflow/ragflow" ]] || [[ "$repo" == "<none>" ]]; then
    if docker ps -a --filter "ancestor=${id}" --format '{{.ID}}' | grep -q .; then
      echo "skip in-use image ${repo}:${tag}"
    else
      echo "remove ${repo}:${tag} (${id})"
      run docker rmi "$id" 2>/dev/null || run docker rmi "${repo}:${tag}" 2>/dev/null || true
    fi
  fi
done < <(docker images --format '{{.Repository}} {{.Tag}} {{.ID}}')

echo "==> Docker builder cache"
run docker builder prune -af

echo "==> uv cache (host; safe to rebuild)"
if command -v uv >/dev/null 2>&1; then
  run uv cache clean
fi

echo "==> Ensure build temp on /data/tbox (avoid filling /)"
mkdir -p /data/tbox/tmp 2>/dev/null || true
if [[ "$DRY" -eq 0 ]] && [[ -d /data/tbox/tmp ]]; then
  chmod 1777 /data/tbox/tmp 2>/dev/null || true
fi

echo ""
echo "==> Disk after"
df -h / /data 2>/dev/null || df -h /
echo ""
echo "Tip: large docker build → export TMPDIR=/data/tbox/tmp DOCKER_TMPDIR=/data/tbox/tmp"
echo "     Docker data-root: $(docker info 2>/dev/null | grep 'Docker Root Dir' | awk -F: '{print $2}' | xargs)"
