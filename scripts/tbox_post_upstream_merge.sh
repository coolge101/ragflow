#!/usr/bin/env bash
# S6 merge 后标准收尾：重建镜像 → 探活 → release smoke（Harness Runbook §3）
#
# Usage (repo root):
#   bash scripts/tbox_post_upstream_merge.sh
#   TBOX_CHINA_DOWNLOAD=1 bash scripts/tbox_post_upstream_merge.sh   # 国内网络
#   TBOX_SKIP_BUILD=1 bash scripts/tbox_post_upstream_merge.sh       # 仅 smoke（镜像已重建）
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

CONTAINER="${TBOX_SMOKE_CONTAINER:-docker-ragflow-cpu-1}"
API_PORT="${SVR_HTTP_PORT:-9380}"

echo "==> TBOX post-upstream-merge @ $(git rev-parse --short HEAD)"
bash scripts/tbox_upstream_divergence.sh || true
echo ""

if [[ "${TBOX_SKIP_BUILD:-0}" != "1" ]]; then
  echo "==> Rebuild ragflow + tbox-console (TBOX_BUILD_RAGFLOW=1 TBOX_CONSOLE=1)"
  export TBOX_BUILD_RAGFLOW=1
  export TBOX_CONSOLE=1
  # Shell RAGFLOW_IMAGE overrides docker/.env — force local TBOX image unless stock explicitly requested.
  if [[ "${TBOX_USE_STOCK_RAGFLOW_IMAGE:-0}" != "1" ]]; then
    export RAGFLOW_IMAGE="${RAGFLOW_IMAGE:-ragflow-tbox:local}"
    if [[ "$RAGFLOW_IMAGE" == *infiniflow/ragflow* ]]; then
      export RAGFLOW_IMAGE=ragflow-tbox:local
      echo "    (overrode stock RAGFLOW_IMAGE → ragflow-tbox:local; set TBOX_USE_STOCK_RAGFLOW_IMAGE=1 to keep Hub image)"
    fi
  fi
  bash docker/tbox-compose-up.sh
  echo ""
fi

echo "==> web-tbox typecheck + build (host)"
(cd web-tbox && npm run typecheck && npm run build)
echo ""

echo "==> Release smoke (docker runner — avoids host uv/spacy when GitHub times out)"
export TBOX_SMOKE_RUNNER=docker
export TBOX_SMOKE_CONTAINER="$CONTAINER"
export TBOX_SMOKE_BASE_URL="http://127.0.0.1:${API_PORT}"
bash scripts/tbox_release_smoke.sh

echo ""
echo "==> Verify API image + bundled scripts"
bash scripts/tbox_verify_stack_image.sh
docker exec "$CONTAINER" test -f /ragflow/scripts/tbox_release_smoke.sh
echo "OK: /ragflow/scripts in container"

echo ""
echo "==> VM production acceptance"
bash scripts/tbox_vm_production_acceptance.sh

echo ""
echo "==> POST-MERGE OK — see docs/TBOX_UPSTREAM_MERGE_RUNBOOK.md §3–4"
echo "    Optional UI checklist: docs/TBOX_VM_PRODUCTION_ACCEPTANCE.md §3–4 (5180)"
