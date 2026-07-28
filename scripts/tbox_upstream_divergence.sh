#!/usr/bin/env bash
# S6 上游差异快照：相对 origin/main（infiniflow/ragflow）的 ahead/behind 计数。
#
# Usage:
#   bash scripts/tbox_upstream_divergence.sh
#   bash scripts/tbox_upstream_divergence.sh --fetch   # 先 git fetch origin main
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

UPSTREAM_REMOTE="${TBOX_UPSTREAM_REMOTE:-origin}"
UPSTREAM_REF="${TBOX_UPSTREAM_REF:-main}"
FULL_REF="${UPSTREAM_REMOTE}/${UPSTREAM_REF}"

if [[ "${1:-}" == "--fetch" ]]; then
  echo "==> git fetch ${UPSTREAM_REMOTE} ${UPSTREAM_REF}"
  git fetch "${UPSTREAM_REMOTE}" "${UPSTREAM_REF}"
fi

if ! git rev-parse --verify "${FULL_REF}" >/dev/null 2>&1; then
  echo "ERROR: ${FULL_REF} not found. Run: git fetch ${UPSTREAM_REMOTE} ${UPSTREAM_REF}" >&2
  exit 1
fi

HEAD_SHA="$(git rev-parse HEAD)"
UP_SHA="$(git rev-parse "${FULL_REF}")"
BEHIND="$(git rev-list --count "HEAD..${FULL_REF}")"
AHEAD="$(git rev-list --count "${FULL_REF}..HEAD")"
MERGE_BASE="$(git merge-base HEAD "${FULL_REF}")"

echo "TBOX upstream divergence snapshot"
echo "  branch:        $(git branch --show-current)"
echo "  HEAD:          ${HEAD_SHA} ($(git log -1 --oneline HEAD))"
echo "  upstream:      ${FULL_REF} @ ${UP_SHA}"
echo "  upstream tip:  $(git log -1 --oneline "${FULL_REF}")"
echo "  merge-base:    ${MERGE_BASE} ($(git log -1 --oneline "${MERGE_BASE}"))"
echo "  behind main:   ${BEHIND} commits"
echo "  ahead of main: ${AHEAD} commits"
echo ""
if [[ "${BEHIND}" -eq 0 ]]; then
  echo "OK: no commits on ${FULL_REF} missing from current branch."
else
  echo "ACTION: merge or rebase ${FULL_REF} (${BEHIND} commits behind)."
fi
