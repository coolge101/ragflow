#!/usr/bin/env bash
# 可选加载 scripts/tbox_smoke.env（由 smoke 脚本 source）
#
# Usage:
#   source scripts/tbox_load_smoke_env.sh
#   _tbox_load_smoke_env "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

_tbox_load_smoke_env() {
  local root="${1:?repo root required}"
  local f="${root}/scripts/tbox_smoke.env"
  if [[ -f "$f" ]]; then
    set -a
    # shellcheck disable=SC1090
    source "$f"
    set +a
    echo "==> loaded smoke env: ${f}" >&2
  fi
}

_tbox_smoke_docker_exec_env() {
  # 追加 docker exec -e 参数（仅非空变量）
  local -n _out=$1
  _out+=(-e "PYTHONPATH=/ragflow")
  _out+=(-e "TBOX_SMOKE_BASE_URL=${TBOX_SMOKE_BASE_URL:-http://127.0.0.1:9380}")
  local key val
  for key in TBOX_SMOKE_EMAIL TBOX_SMOKE_PASSWORD TBOX_SMOKE_NORMAL_EMAIL TBOX_SMOKE_NORMAL_PASSWORD TBOX_SMOKE_DEEPSEEK_API_KEY; do
    val="${!key:-}"
    if [[ -n "$val" ]]; then
      _out+=(-e "${key}=${val}")
    fi
  done
}
