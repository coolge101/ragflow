#!/usr/bin/env bash
# Shared helpers for TBOX local ↔ remote sync scripts.
set -euo pipefail

tbox_sync_repo_root() {
  local here
  here="$(cd "$(dirname "${BASH_SOURCE[1]:-${BASH_SOURCE[0]}}")/.." && pwd)"
  echo "$here"
}

tbox_sync_load_docker_env() {
  local root="$1"
  local env_file="$root/docker/.env"
  if [[ ! -f "$env_file" ]]; then
    echo "ERROR: missing $env_file" >&2
    return 1
  fi
  # shellcheck disable=SC1090
  set -a
  source "$env_file"
  set +a
  DOC_ENGINE="${DOC_ENGINE:-elasticsearch}"
  MYSQL_DBNAME="${MYSQL_DBNAME:-rag_flow}"
  COMPOSE_PROJECT_NAME="${COMPOSE_PROJECT_NAME:-docker}"
}

tbox_sync_compose_dir() {
  echo "$(tbox_sync_repo_root)/docker"
}

tbox_sync_volume_name() {
  local suffix="$1"
  local project="${COMPOSE_PROJECT_NAME:-docker}"
  echo "${project}_${suffix}"
}

tbox_sync_doc_engine_volume_suffix() {
  case "${DOC_ENGINE:-elasticsearch}" in
    infinity) echo "infinity_data" ;;
    opensearch) echo "osdata01" ;;
    *) echo "esdata01" ;;
  esac
}

tbox_sync_mysql_container() {
  local name
  name="$(docker ps --format '{{.Names}}' | grep -E 'mysql-1$' | head -1 || true)"
  if [[ -z "$name" ]]; then
    echo "ERROR: MySQL container not running (start docker compose base stack first)" >&2
    return 1
  fi
  echo "$name"
}

tbox_sync_require_docker() {
  command -v docker >/dev/null 2>&1 || {
    echo "ERROR: docker not found" >&2
    exit 1
  }
}

tbox_sync_alpine_run() {
  docker run --rm alpine:3.20 "$@"
}

tbox_sync_ensure_alpine() {
  docker image inspect alpine:3.20 >/dev/null 2>&1 || docker pull alpine:3.20
}
