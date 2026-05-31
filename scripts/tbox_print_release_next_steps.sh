#!/usr/bin/env bash
# 打印 5180 准生产 + pre_release 下一步（tbox-up / start-tbox / deploy-on-new-server 共用）
#
# Usage:
#   bash scripts/tbox_print_release_next_steps.sh
#   bash scripts/tbox_print_release_next_steps.sh --with-compose-hint
#   TBOX_RELEASE_STEPS_PREFIX="[start-tbox-ragflow]" bash scripts/tbox_print_release_next_steps.sh
set -euo pipefail

WITH_COMPOSE=0
for arg in "$@"; do
  case "$arg" in
    --with-compose-hint) WITH_COMPOSE=1 ;;
  esac
done

PREFIX="${TBOX_RELEASE_STEPS_PREFIX:-}"
if [[ -n "$PREFIX" ]]; then
  PREFIX="${PREFIX} "
fi

echo ""
echo "==> ${PREFIX}Quasi-production (5180 console + pre_release):"
echo "    Console: http://127.0.0.1:\${TBOX_CONSOLE_PORT:-5180}/login"
if [[ "$WITH_COMPOSE" -eq 1 ]]; then
  echo "    TBOX_CONSOLE=1 bash docker/tbox-compose-up.sh"
fi
echo "    bash scripts/tbox_setup_smoke_env.sh"
echo "    bash scripts/tbox_pre_release.sh --help"
echo "    bash scripts/tbox_pre_release.sh"
echo "    bash scripts/tbox_vm_production_acceptance.sh"
echo ""
echo "    Phase 16–17 browser (VM §5 may still be ☐ after pre_release):"
echo "    bash scripts/tbox_phase16_17_handtest.sh"
echo "    # Walkthrough step D 5180 准生产前置 + C §7 + D (optional /review/step/phase16-17)"
echo "    bash scripts/tbox_phase16_17_finish.sh --archive"
echo ""
echo "    Same chain: bash scripts/tbox_host_check.sh · bash scripts/tbox_pre_release.sh --help"
echo "    CI parity: docs/TBOX_ENV_AND_VERSIONS.md §6.1 · web-tbox/README"
echo "    Walkthrough: docs/TBOX_UI_ACCEPTANCE_WALKTHROUGH.md (step D handtest)"
echo ""
echo "    S6 post-merge: bash scripts/tbox_post_upstream_merge.sh"
echo "    Doc: docs/TBOX_DEPLOY_RUNBOOK.md §8.1"
echo "         docs/TBOX_SMOKE_SCRIPTS.md · docs/TBOX_SMOKE_ENV.md"
echo "         docs/TBOX_VM_PRODUCTION_ACCEPTANCE.md · docs/TBOX_UPSTREAM_MERGE_RUNBOOK.md §3.2"
