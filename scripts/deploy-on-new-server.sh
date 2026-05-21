#!/usr/bin/env bash
# End-to-end deploy on a fresh Linux server after `git clone` of the TBOX-enabled repo.
#
# Usage (from repo root):
#   bash scripts/deploy-on-new-server.sh
#   TBOX_CHINA_DOWNLOAD=1 NO_CHROME_DOWNLOAD=1 bash scripts/deploy-on-new-server.sh
#   bash scripts/deploy-on-new-server.sh --build-only    # skip compose up
#   bash scripts/deploy-on-new-server.sh --up-only       # skip download/build (image must exist)
#
# Do NOT rely on `docker pull infiniflow/ragflow_deps:latest` alone — it may not match this
# repo's Dockerfile (Tika / HF layout). This script always builds deps from download_deps.py output.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

BUILD_ONLY=0
UP_ONLY=0
while [[ "${1:-}" == --* ]]; do
  case "$1" in
    --build-only) BUILD_ONLY=1; shift ;;
    --up-only) UP_ONLY=1; shift ;;
    *)
      echo "Unknown option: $1" >&2
      exit 1
      ;;
  esac
done

echo "==> TBOX server deploy (repo: $ROOT)"

if ! command -v docker >/dev/null 2>&1; then
  echo "docker not found" >&2
  exit 1
fi
if ! docker compose version >/dev/null 2>&1; then
  echo "docker compose v2 not found" >&2
  exit 1
fi

if [[ ! -f api/apps/tbox_app.py ]]; then
  echo "ERROR: This tree is not a TBOX-enabled RAGFlow clone (missing api/apps/tbox_app.py)." >&2
  echo "Clone your fork that contains TBOX, e.g. the team deployment branch — not bare upstream without TBOX files." >&2
  exit 1
fi

if ! command -v uv >/dev/null 2>&1; then
  echo "==> Installing uv (required for download_deps.py)..."
  curl -LsSf https://astral.sh/uv/install.sh | sh
  export PATH="${HOME}/.local/bin:${PATH}"
fi

if [[ ! -f docker/.env ]]; then
  echo "==> Creating docker/.env from .env.example"
  cp docker/.env.example docker/.env
fi

# Ensure TBOX image name is set (append if missing)
if ! grep -q '^RAGFLOW_IMAGE=' docker/.env 2>/dev/null; then
  echo "RAGFLOW_IMAGE=ragflow-tbox:local" >> docker/.env
  echo "==> Appended RAGFLOW_IMAGE=ragflow-tbox:local to docker/.env"
fi

if [[ "$UP_ONLY" -eq 1 ]]; then
  echo "==> --up-only: starting stack only"
  bash docker/tbox-compose-up.sh
  exit 0
fi

DEPS_FLAGS=()
[[ "${TBOX_CHINA_DOWNLOAD:-0}" == "1" ]] && DEPS_FLAGS+=(--china-mirrors)
[[ "${NO_CHROME_DOWNLOAD:-0}" == "1" || "${SKIP_CHROME_DEPS:-0}" == "1" ]] && DEPS_FLAGS+=(--skip-chrome)
[[ "${RAGFLOW_DISABLE_TEXT_CONCAT_XGB:-0}" == "1" || "${SKIP_TEXT_CONCAT_XGB_DOWNLOAD:-0}" == "1" ]] && DEPS_FLAGS+=(--disable-text-concat-xgb)

if bash scripts/verify-docker-build-prereqs.sh 2>/dev/null; then
  echo "==> Prerequisites already satisfied; skipping download + deps build"
else
  echo "==> Step 1/3: download_deps.py ${DEPS_FLAGS[*]:-<default>}"
  if [[ ${#DEPS_FLAGS[@]} -eq 0 ]]; then
    bash scripts/pull-local-deps-for-docker.sh --download-only
  else
    bash scripts/pull-local-deps-for-docker.sh --download-only "${DEPS_FLAGS[@]}"
  fi

  echo "==> Step 2/3: docker build Dockerfile.deps → infiniflow/ragflow_deps:latest"
  bash scripts/pull-local-deps-for-docker.sh --docker-deps-only

  bash scripts/verify-docker-build-prereqs.sh
fi

echo "==> Step 3/3: build ragflow-tbox API image (docker compose)"
export TBOX_CHINA_DOWNLOAD="${TBOX_CHINA_DOWNLOAD:-1}"
bash scripts/tbox-deps-step-by-step.sh 3

if [[ "$BUILD_ONLY" -eq 1 ]]; then
  echo "==> --build-only: done. Start with: bash docker/tbox-compose-up.sh"
  exit 0
fi

echo "==> Starting Docker stack"
export TBOX_BUILD_RAGFLOW=0
bash docker/tbox-compose-up.sh

echo ""
echo "==> Deploy complete. Smoke tests:"
echo "    curl -sf http://127.0.0.1:\${SVR_HTTP_PORT:-9380}/api/v1/auth/login/channels"
echo "    curl -sf http://127.0.0.1:\${SVR_HTTP_PORT:-9380}/v1/tbox/health"
echo ""
echo "==> Frontend (optional):"
echo "    cd web-tbox && cp -n .env.example .env && npm ci && npm run dev"
echo "    Login uses POST /api/v1/auth/login — do NOT set VITE_AUTH_LOGIN_PATH=/v1/user/login"
