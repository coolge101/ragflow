#!/usr/bin/env bash
# Verify repo-root files match root Dockerfile / Dockerfile.deps before docker build.
# Run from repo root:  bash scripts/verify-docker-build-prereqs.sh
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

fail=0
warn() { echo "WARN: $*" >&2; }
die() { echo "ERROR: $*" >&2; fail=1; }
ok() { echo "OK: $*"; }

if [[ ! -f Dockerfile ]]; then
  die "Missing Dockerfile (run from RAGFlow repo root)"
fi
if [[ ! -f Dockerfile.deps ]]; then
  die "Missing Dockerfile.deps"
fi
if [[ ! -f api/apps/tbox_app.py ]]; then
  die "Missing api/apps/tbox_app.py — clone the TBOX-enabled fork/branch, not stock upstream without TBOX"
fi
if [[ ! -f docker/tbox-compose-up.sh ]]; then
  die "Missing docker/tbox-compose-up.sh"
fi

TIKA_VER="$(grep -oE 'tika-server-standard-[0-9]+\.[0-9]+\.[0-9]+\.jar' Dockerfile | head -1 | sed 's/tika-server-standard-//;s/\.jar//')"
if [[ -z "$TIKA_VER" ]]; then
  die "Could not parse Tika version from Dockerfile"
fi

TIKA_JAR="tika-server-standard-${TIKA_VER}.jar"
TIKA_MD5="tika-server-standard-${TIKA_VER}.jar.md5"

if [[ -f "$TIKA_JAR" && -f "$TIKA_MD5" ]]; then
  ok "Tika $TIKA_VER present in repo root"
else
  die "Missing $TIKA_JAR (and/or .md5). Run: bash scripts/tbox-deps-step-by-step.sh 1"
fi

if [[ -f huggingface.co/InfiniFlow/deepdoc/det.onnx ]]; then
  ok "deepdoc/det.onnx present"
else
  die "Missing huggingface.co/InfiniFlow/deepdoc/det.onnx — run step 1 (download_deps)"
fi

if [[ -d nltk_data ]]; then
  ok "nltk_data/ present"
else
  warn "nltk_data/ missing — step 1 may still be required"
  fail=1
fi

if docker image inspect infiniflow/ragflow_deps:latest >/dev/null 2>&1; then
  ok "infiniflow/ragflow_deps:latest present"
  if [[ -f "$TIKA_JAR" ]]; then
    jar_ts=$(stat -c %Y "$TIKA_JAR" 2>/dev/null || stat -f %m "$TIKA_JAR")
    img_ts=$(docker image inspect infiniflow/ragflow_deps:latest -f '{{.Created}}' | xargs -I{} date -d "{}" +%s 2>/dev/null || echo 0)
    if [[ "$jar_ts" -gt "$img_ts" && "$img_ts" != 0 ]]; then
      warn "Repo ${TIKA_JAR} is newer than ragflow_deps image — rerun: bash scripts/tbox-deps-step-by-step.sh 2"
      fail=1
    fi
  fi
else
  warn "infiniflow/ragflow_deps:latest not built — run: bash scripts/tbox-deps-step-by-step.sh 2"
  fail=1
fi

if [[ "$fail" -ne 0 ]]; then
  echo "" >&2
  echo "Fix: TBOX_CHINA_DOWNLOAD=1 NO_CHROME_DOWNLOAD=1 bash scripts/tbox-deps-step-by-step.sh 1" >&2
  echo "     bash scripts/tbox-deps-step-by-step.sh 2" >&2
  exit 1
fi

echo "All docker build prerequisites look good (Tika ${TIKA_VER}, deepdoc, deps image)."
