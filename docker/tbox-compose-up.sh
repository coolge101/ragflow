#!/usr/bin/env bash
# Bring up RAGFlow dependencies + API from THIS repo (includes TBOX /v1/tbox/*).
#
# How to invoke (pick one):
#   - From repo root (the directory that contains both `docker/` and `Dockerfile`):
#       bash docker/tbox-compose-up.sh
#   - From repo root, wrapper that finds this script by path:
#       bash scripts/tbox-up.sh
#   - From any cwd, use absolute path (no "cd" needed):
#       bash /path/to/ragflow/docker/tbox-compose-up.sh
#
# If you see "No such file or directory", your shell cwd is not the repo root and you used a
# relative path `docker/...` — `cd` to the clone root first, or use an absolute path as above.
#
# Stock Hub images (infiniflow/ragflow:*) do not ship tbox_app.py — this script defaults
# RAGFLOW_IMAGE to ragflow-tbox:local and builds it from ../Dockerfile unless you set
# TBOX_USE_STOCK_RAGFLOW_IMAGE=1.
#
# Requires: Docker Engine, docker compose v2, docker/.env (see docker/.env.example).
#
# Network: if docker pull / build times out, try TBOX_CHINA_DOWNLOAD=1 (uses download_deps.py --china-mirrors).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$SCRIPT_DIR"

if [[ ! -f .env ]]; then
  echo "Missing docker/.env — copy template:  cp .env.example .env" >&2
  exit 1
fi

set -a
# shellcheck disable=SC1091
source ./.env
set +a

# Docker Hub base image for root Dockerfile (FROM). CN users often hit registry-1.docker.io timeouts.
if [[ "${TBOX_CHINA_DOWNLOAD:-0}" == "1" && -z "${RAGFLOW_BASE_IMAGE:-}" ]]; then
  export RAGFLOW_BASE_IMAGE="docker.m.daocloud.io/library/ubuntu:24.04"
  echo "==> TBOX_CHINA_DOWNLOAD=1: RAGFLOW_BASE_IMAGE unset → using ${RAGFLOW_BASE_IMAGE} (set in docker/.env to override or pin)."
fi

# Dockerfile clones infiniflow/resource for Infinity; pass NEED_MIRROR=1 to use Gitee first (compose build-arg).
if [[ "${TBOX_CHINA_DOWNLOAD:-0}" == "1" ]] && [[ -z "${NEED_MIRROR:-}" ]]; then
  export NEED_MIRROR=1
  echo "==> TBOX_CHINA_DOWNLOAD=1: NEED_MIRROR unset → NEED_MIRROR=1 (Gitee-first resource clone in docker build). Set NEED_MIRROR=0 in docker/.env to force GitHub-only."
fi

DOC_ENGINE="${DOC_ENGINE:-elasticsearch}"
DEVICE="${DEVICE:-cpu}"
PULL_POLICY="${TBOX_COMPOSE_PULL:-missing}"
# TBOX_BUILD_RAGFLOW: 1 = always build, 0 = never, auto (default) = build only if ${RAGFLOW_IMAGE} is missing locally.
TBOX_BUILD="${TBOX_BUILD_RAGFLOW:-auto}"

# Prefer a locally built image so /v1/tbox/me exists (docker-compose.yml defines build: .. / Dockerfile).
if [[ "${TBOX_USE_STOCK_RAGFLOW_IMAGE:-0}" != "1" ]]; then
  img="${RAGFLOW_IMAGE:-}"
  if [[ "$img" == ragflow-tbox:* ]]; then
    :
  elif [[ -z "$img" || "$img" == *infiniflow/ragflow* ]]; then
    export RAGFLOW_IMAGE="ragflow-tbox:local"
    echo "==> RAGFLOW_IMAGE set to ${RAGFLOW_IMAGE} (paths matching *infiniflow/ragflow* omit TBOX in upstream builds)."
    echo "    Persist: add to docker/.env  RAGFLOW_IMAGE=ragflow-tbox:local"
    echo "    To force the value in docker/.env:  export TBOX_USE_STOCK_RAGFLOW_IMAGE=1"
  fi
fi

need_build=0
if [[ "$TBOX_BUILD" == "1" || "$TBOX_BUILD" == "yes" ]]; then
  need_build=1
elif [[ "$TBOX_BUILD" == "0" || "$TBOX_BUILD" == "no" ]]; then
  need_build=0
else
  if ! docker image inspect "${RAGFLOW_IMAGE}" >/dev/null 2>&1; then
    need_build=1
  fi
fi

# Rebuild API image when local deps image was rebuilt after the API image (common miss: deps OK but ragflow-tbox still old → 9380 timeout).
if [[ "$need_build" != "1" ]] && [[ "$TBOX_BUILD" != "0" && "$TBOX_BUILD" != "no" ]]; then
  if docker image inspect infiniflow/ragflow_deps:latest >/dev/null 2>&1 && docker image inspect "${RAGFLOW_IMAGE}" >/dev/null 2>&1; then
    deps_c=$(docker image inspect infiniflow/ragflow_deps:latest -f '{{.Created}}')
    api_c=$(docker image inspect "${RAGFLOW_IMAGE}" -f '{{.Created}}')
    if deps_sec=$(date -u -d "$deps_c" +%s 2>/dev/null) && api_sec=$(date -u -d "$api_c" +%s 2>/dev/null) && [[ "$deps_sec" -gt "$api_sec" ]]; then
      need_build=1
      echo "==> infiniflow/ragflow_deps:latest is newer than ${RAGFLOW_IMAGE} — rebuilding API image so bundled models / Dockerfile stages match deps."
    fi
  fi
fi

if [[ "$need_build" == "1" ]]; then
  if ! docker image inspect infiniflow/ragflow_deps:latest >/dev/null 2>&1; then
    echo "==> Image infiniflow/ragflow_deps:latest not found (required by root Dockerfile)."
    DEPS_PULL_OK=0
    for attempt in 1 2 3; do
      echo "==> docker pull infiniflow/ragflow_deps:latest (try ${attempt}/3)…"
      if docker pull infiniflow/ragflow_deps:latest; then
        DEPS_PULL_OK=1
        echo "OK: pulled infiniflow/ragflow_deps:latest"
        break
      fi
      if [[ "$attempt" -lt 3 ]]; then
        sleep 15
      fi
    done
    if [[ "$DEPS_PULL_OK" != "1" ]]; then
      echo ""
      echo "---- 无法从 Docker Hub 拉取 infiniflow/ragflow_deps（常见于 registry 443 超时）----"
      echo "  可选: 配置 Docker registry-mirrors 后执行  docker pull infiniflow/ragflow_deps:latest"
      echo "  可选: 在外网机器 docker pull … && docker save … 再本机 docker load"
      echo "  当前: 从仓库执行 download_deps.py + Dockerfile.deps 本地构建该镜像（体积大、需网络）"
      echo "  若 Maven/Google/NLTK 也超时，可组合环境变量后重跑:"
      echo "    TBOX_CHINA_DOWNLOAD=1 NO_CHROME_DOWNLOAD=1 bash scripts/tbox-up.sh"
      echo "  或分步:  bash scripts/tbox-deps-step-by-step.sh help"
      echo "  NLTK 仍卡住可（不推荐）:  SKIP_NLTK_DOWNLOAD=1"
      echo "----------------------------------------------------------------"
      PULL_FLAGS=()
      [[ "${TBOX_CHINA_DOWNLOAD:-0}" == "1" ]] && PULL_FLAGS+=(--china-mirrors)
      [[ "${NO_CHROME_DOWNLOAD:-0}" == "1" || "${SKIP_CHROME_DEPS:-0}" == "1" ]] && PULL_FLAGS+=(--skip-chrome)
      [[ "${SKIP_NLTK_DOWNLOAD:-0}" == "1" ]] && PULL_FLAGS+=(--skip-nltk)
      [[ "${SKIP_HUGGINGFACE_DOWNLOAD:-0}" == "1" ]] && PULL_FLAGS+=(--skip-huggingface)
      [[ "${RAGFLOW_DISABLE_TEXT_CONCAT_XGB:-0}" == "1" || "${SKIP_TEXT_CONCAT_XGB_DOWNLOAD:-0}" == "1" ]] && PULL_FLAGS+=(--disable-text-concat-xgb)
      (cd "$REPO_ROOT" && bash scripts/pull-local-deps-for-docker.sh "${PULL_FLAGS[@]}") || {
        echo "pull-local-deps-for-docker.sh failed." >&2
        exit 1
      }
    fi
  fi

  echo "==> Building API image ${RAGFLOW_IMAGE} (includes TBOX, may take several minutes)…"
  docker compose -f docker-compose.yml --profile "${DEVICE}" build "ragflow-${DEVICE}"
elif [[ "${TBOX_BUILD:-}" != "0" && "${TBOX_BUILD:-}" != "no" ]]; then
  echo "==> Skip API image build (found ${RAGFLOW_IMAGE}). Rebuild: TBOX_BUILD_RAGFLOW=1 bash docker/tbox-compose-up.sh"
fi

echo "==> Starting dependencies (profile: ${DOC_ENGINE}, pull: ${PULL_POLICY})"
docker compose -f docker-compose-base.yml --profile "${DOC_ENGINE}" up -d --pull "${PULL_POLICY}"

COMPOSE_EXTRA=(--profile "${DEVICE}")
if [[ "${TBOX_CONSOLE:-0}" == "1" ]]; then
  COMPOSE_EXTRA+=(--profile tbox-console)
  echo "==> Also starting tbox-console (profile tbox-console, host port ${TBOX_CONSOLE_PORT:-5180})"
fi

echo "==> Starting RAGFlow (${DEVICE}, image: ${RAGFLOW_IMAGE:-unset}, pull: ${PULL_POLICY})"
docker compose -f docker-compose.yml "${COMPOSE_EXTRA[@]}" up -d --pull "${PULL_POLICY}"

API_PORT="${SVR_HTTP_PORT:-9380}"
# Quart REST lives under /api/v1/... (see api/apps/__init__.register_page). Go hybrid used /v1/user/... — probe both.
ragflow_http_ready() {
  curl -sf -m 3 "http://127.0.0.1:${API_PORT}/api/v1/auth/login/channels" >/dev/null 2>&1 \
    || curl -sf -m 3 "http://127.0.0.1:${API_PORT}/v1/user/login/channels" >/dev/null 2>&1
}
echo "==> Waiting for API on port ${API_PORT} (max ~180s; GET /api/v1/auth/login/channels or legacy /v1/user/login/channels)"
for i in $(seq 1 90); do
  if ragflow_http_ready; then
    echo "OK: RAGFlow HTTP responds."
    break
  fi
  if [[ "$i" -eq 90 ]]; then
    echo "Timeout: API did not become ready." >&2
    echo "---- Last 60 lines: docker compose -f docker-compose.yml logs ragflow-${DEVICE} ----" >&2
    docker compose -f docker-compose.yml logs --tail 60 "ragflow-${DEVICE}" 2>/dev/null || true
    echo "----" >&2
    echo "Typical fix after updating huggingface.co or Dockerfile: rebuild API image, then re-run this script." >&2
    echo "  cd \"${SCRIPT_DIR}\" && TBOX_BUILD_RAGFLOW=1 bash tbox-compose-up.sh" >&2
    echo "  or:  docker compose -f docker-compose.yml --profile ${DEVICE} build --no-cache ragflow-${DEVICE}" >&2
    exit 1
  fi
  sleep 2
done

echo "==> TBOX extension probe: GET /v1/tbox/health"
if curl -sf -m 5 "http://127.0.0.1:${API_PORT}/v1/tbox/health" | grep -q tbox_api_contract_version; then
  echo "OK: TBOX is active — web-tbox can use /v1/tbox/me and managed-users APIs."
else
  echo "WARN: /v1/tbox/health missing or unexpected — image may not include this repo's api/apps/tbox_app.py."
  echo "      Re-run with TBOX_BUILD_RAGFLOW=1 (default) after fixing build errors:  docker compose -f docker-compose.yml build ragflow-${DEVICE}"
fi

if [[ "${TBOX_CONSOLE:-0}" == "1" ]]; then
  CPORT="${TBOX_CONSOLE_PORT:-5180}"
  echo "TBOX console: http://127.0.0.1:${CPORT}/  (ensure TBOX_CONSOLE_RAGFLOW_UPSTREAM matches host SVR_HTTP_PORT)"
fi

echo "Done."
