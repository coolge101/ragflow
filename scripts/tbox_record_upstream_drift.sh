#!/usr/bin/env bash
# 生成 TBOX_UPSTREAM_MERGE_RUNBOOK.md §5 漂移快照 Markdown（可粘贴）
#
# Usage:
#   bash scripts/tbox_record_upstream_drift.sh
#   bash scripts/tbox_record_upstream_drift.sh --fetch
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

FETCH=0
[[ "${1:-}" == "--fetch" ]] && FETCH=1

TMP="$(mktemp)"
trap 'rm -f "$TMP"' EXIT

if [[ "$FETCH" -eq 1 ]]; then
  bash scripts/tbox_upstream_divergence.sh --fetch >"$TMP"
else
  bash scripts/tbox_upstream_divergence.sh >"$TMP"
fi

HEAD_SHORT="$(git rev-parse --short HEAD)"
HEAD_ONELINE="$(git log -1 --oneline HEAD | sed 's/|/\\|/g')"
DATE="$(date +%Y-%m-%d)"
BRANCH="$(git branch --show-current)"
UPSTREAM_REF="${TBOX_UPSTREAM_REF:-main}"
FULL_REF="${TBOX_UPSTREAM_REMOTE:-origin}/${UPSTREAM_REF}"

UP_SHA="$(grep 'upstream:' "$TMP" | head -1 | sed 's/.*@ //' | awk '{print $1}')"
MERGE_BASE="$(grep 'merge-base:' "$TMP" | awk '{print $2}')"
BEHIND="$(grep 'behind main:' "$TMP" | awk '{print $3}')"
AHEAD="$(grep 'ahead of main:' "$TMP" | awk '{print $4}')"

if [[ "${BEHIND:-0}" -eq 0 ]]; then
  CONCLUSION="behind 0；无缺失 upstream commit；下次 merge 前再 \`--fetch\`"
else
  CONCLUSION="behind ${BEHIND}；须按 Runbook §2 规划 merge/rebase"
fi

FETCH_NOTE=$([[ "$FETCH" -eq 1 ]] && echo "（\`--fetch\` 后）" || echo "（未 fetch，upstream tip 为本地缓存）")

cat <<EOF
# 粘贴到 docs/TBOX_UPSTREAM_MERGE_RUNBOOK.md §5

### ${DATE} 快照${FETCH_NOTE}（\`${BRANCH}\` @ \`${HEAD_SHORT}\`）

| 项 | 值 |
|----|-----|
| HEAD | \`${HEAD_SHORT}\` — ${HEAD_ONELINE} |
| upstream | \`${FULL_REF}\` @ \`${UP_SHA}\` |
| merge-base | \`${MERGE_BASE}\` |
| behind | **${BEHIND}** |
| ahead | **${AHEAD}** |
| 结论 | ${CONCLUSION} |

生成命令：\`bash scripts/tbox_record_upstream_drift.sh$([[ "$FETCH" -eq 1 ]] && echo ' --fetch' || echo '')\`
EOF
