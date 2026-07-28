#!/usr/bin/env bash
# 检测 web-tbox/ 是否在 git 范围内有变更（post-merge console 重建触发）
#
# Usage:
#   bash scripts/tbox_web_tbox_git_changed.sh          # exit 0 = changed, 1 = unchanged
#   bash scripts/tbox_web_tbox_git_changed.sh --quiet
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

QUIET=0
[[ "${1:-}" == "--quiet" ]] && QUIET=1

BASE="${TBOX_GIT_DIFF_BASE:-}"
if [[ -z "$BASE" ]]; then
  UP="${TBOX_UPSTREAM_REMOTE:-origin}/${TBOX_UPSTREAM_REF:-main}"
  if git rev-parse --verify "$UP" >/dev/null 2>&1; then
    BASE="$(git merge-base HEAD "$UP" 2>/dev/null || true)"
  fi
  BASE="${BASE:-HEAD~1}"
fi

if ! git rev-parse --verify "$BASE" >/dev/null 2>&1; then
  echo "WARN: invalid diff base: ${BASE}" >&2
  exit 1
fi

if git diff --name-only "${BASE}..HEAD" -- web-tbox/ | grep -q .; then
  [[ "$QUIET" -eq 0 ]] && echo "web-tbox changed: ${BASE}..HEAD"
  exit 0
fi

[[ "$QUIET" -eq 0 ]] && echo "web-tbox unchanged: ${BASE}..HEAD"
exit 1
