#!/usr/bin/env bash
# 校验运行中 ragflow-cpu 使用 TBOX 本地镜像（merge 后勿误用 Hub stock 镜像）
#
# Usage:
#   bash scripts/tbox_verify_stack_image.sh
#   TBOX_ALLOW_STOCK_IMAGE=1 bash scripts/tbox_verify_stack_image.sh
set -euo pipefail

CONTAINER="${TBOX_SMOKE_CONTAINER:-docker-ragflow-cpu-1}"
EXPECTED="${TBOX_EXPECTED_RAGFLOW_IMAGE:-ragflow-tbox:local}"

if ! docker ps --format '{{.Names}}' | grep -qx "$CONTAINER"; then
  echo "FAIL: container ${CONTAINER} not running" >&2
  exit 1
fi

actual="$(docker inspect "$CONTAINER" --format '{{.Config.Image}}')"
if [[ "$actual" == *infiniflow/ragflow* ]] && [[ "${TBOX_ALLOW_STOCK_IMAGE:-0}" != "1" ]]; then
  echo "FAIL: ${CONTAINER} uses stock image ${actual}" >&2
  echo "      Fix: set RAGFLOW_IMAGE=ragflow-tbox:local in docker/.env, unset shell RAGFLOW_IMAGE," >&2
  echo "      then: export RAGFLOW_IMAGE=ragflow-tbox:local && docker compose ... up -d --force-recreate ragflow-cpu" >&2
  echo "      Or: bash docker/tbox-compose-up.sh" >&2
  exit 1
fi

if [[ "$actual" != "$EXPECTED" ]] && [[ "${TBOX_ALLOW_STOCK_IMAGE:-0}" != "1" ]]; then
  echo "WARN: image is ${actual}, expected ${EXPECTED}" >&2
  exit 1
fi

echo "OK: ${CONTAINER} image=${actual}"
