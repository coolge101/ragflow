#!/usr/bin/env bash
# Download RAGFlow Docker build-time artifacts into the repo root and build
# infiniflow/ragflow_deps:latest (see Dockerfile.deps + root Dockerfile --mount).
#
# Run from repo root:
#   bash scripts/pull-local-deps-for-docker.sh
#   bash scripts/pull-local-deps-for-docker.sh --china-mirrors --skip-chrome
#
# Environment (merged with CLI flags; CLI wins for duplicates):
#   TBOX_CHINA_DOWNLOAD=1       add --china-mirrors
#   NO_CHROME_DOWNLOAD=1       add --skip-chrome
#   SKIP_NLTK_DOWNLOAD=1       add --skip-nltk
#   SKIP_HUGGINGFACE_DOWNLOAD=1  add --skip-huggingface
#   RAGFLOW_DISABLE_TEXT_CONCAT_XGB=1  add --disable-text-concat-xgb (skip text_concat_xgb Hub repo; set same in docker/.env at runtime)
#   TBOX_HF_ENDPOINTS=https://a.com,https://b.com  override Hugging Face API mirror order (download_deps.py)
#   TBOX_NLTK_PACKAGES_ROOTS=https://...,https://...  comma-separated roots ending in .../packages/ (NLTK zip mirrors)
#
# Split runs (large downloads / debug):
#   bash scripts/pull-local-deps-for-docker.sh --download-only --china-mirrors --skip-chrome
#   bash scripts/pull-local-deps-for-docker.sh --docker-deps-only
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if ! command -v uv >/dev/null 2>&1; then
  echo "uv not found; install uv or use: python3 download_deps.py (with huggingface-hub)" >&2
  exit 1
fi

DOWNLOAD_ONLY=0
DOCKER_DEPS_ONLY=0
DEPS_ARGS=()

_have_flag() {
  local want="$1"
  local a
  for a in "${DEPS_ARGS[@]}"; do
    if [[ "$a" == "$want" ]]; then
      return 0
    fi
  done
  return 1
}

while [[ "${1:-}" == -* ]]; do
  case "$1" in
    --china-mirrors) DEPS_ARGS+=(--china-mirrors); shift ;;
    --skip-chrome) DEPS_ARGS+=(--skip-chrome); shift ;;
    --skip-nltk) DEPS_ARGS+=(--skip-nltk); shift ;;
    --skip-huggingface) DEPS_ARGS+=(--skip-huggingface); shift ;;
    --disable-text-concat-xgb) DEPS_ARGS+=(--disable-text-concat-xgb); shift ;;
    --download-only) DOWNLOAD_ONLY=1; shift ;;
    --docker-deps-only) DOCKER_DEPS_ONLY=1; shift ;;
    *)
      echo "Unknown option: $1" >&2
      exit 1
      ;;
  esac
done

if [[ "${TBOX_CHINA_DOWNLOAD:-0}" == "1" ]] && ! _have_flag --china-mirrors; then
  DEPS_ARGS+=(--china-mirrors)
fi
if [[ "${NO_CHROME_DOWNLOAD:-0}" == "1" || "${SKIP_CHROME_DEPS:-0}" == "1" ]] && ! _have_flag --skip-chrome; then
  DEPS_ARGS+=(--skip-chrome)
fi
if [[ "${SKIP_NLTK_DOWNLOAD:-0}" == "1" ]] && ! _have_flag --skip-nltk; then
  DEPS_ARGS+=(--skip-nltk)
fi
if [[ "${SKIP_HUGGINGFACE_DOWNLOAD:-0}" == "1" ]] && ! _have_flag --skip-huggingface; then
  DEPS_ARGS+=(--skip-huggingface)
fi
if [[ "${RAGFLOW_DISABLE_TEXT_CONCAT_XGB:-0}" == "1" || "${SKIP_TEXT_CONCAT_XGB_DOWNLOAD:-0}" == "1" ]] && ! _have_flag --disable-text-concat-xgb; then
  DEPS_ARGS+=(--disable-text-concat-xgb)
fi

if [[ "$DOWNLOAD_ONLY" -eq 1 && "$DOCKER_DEPS_ONLY" -eq 1 ]]; then
  echo "Use only one of --download-only or --docker-deps-only" >&2
  exit 1
fi

if [[ "$DOCKER_DEPS_ONLY" -eq 1 ]]; then
  echo "==> docker build -f Dockerfile.deps -t infiniflow/ragflow_deps:latest ."
  docker build -f Dockerfile.deps -t infiniflow/ragflow_deps:latest .
  echo "OK: infiniflow/ragflow_deps:latest"
  exit 0
fi

if [[ ${#DEPS_ARGS[@]} -eq 0 ]]; then
  echo "==> download_deps.py"
else
  echo "==> download_deps.py ${DEPS_ARGS[*]}"
fi
uv run python download_deps.py "${DEPS_ARGS[@]}"

if [[ "$DOWNLOAD_ONLY" -eq 1 ]]; then
  echo "OK: download_deps finished (--download-only). Next:"
  echo "    bash scripts/pull-local-deps-for-docker.sh --docker-deps-only"
  exit 0
fi

echo "==> docker build -f Dockerfile.deps -t infiniflow/ragflow_deps:latest ."
docker build -f Dockerfile.deps -t infiniflow/ragflow_deps:latest .

echo "OK: infiniflow/ragflow_deps:latest built. Main image:"
echo "    docker build --platform linux/amd64 -f Dockerfile -t ragflow-tbox:local ."
echo "Optional: TBOX_CONSOLE=1 with docker/tbox-compose-up.sh builds the TBOX static UI image."
