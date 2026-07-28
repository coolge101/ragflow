#!/usr/bin/env bash
# Remove Docker Hub mirrors that fail DNS (e.g. docker.mirrors.ustc.edu.cn) and
# set a sensible default list with DaoCloud first. Run on the Docker host:
#   sudo bash scripts/fix-docker-registry-mirrors.sh
set -euo pipefail

DAEMON_JSON="${1:-/etc/docker/daemon.json}"

if [[ "$(id -u)" != "0" ]]; then
  echo "Run as root:  sudo bash $0" >&2
  exit 1
fi

if ! command -v python3 >/dev/null 2>&1; then
  echo "python3 is required." >&2
  exit 1
fi

stamp=$(date +%Y%m%d%H%M%S)
if [[ -f "$DAEMON_JSON" ]]; then
  cp -a "$DAEMON_JSON" "${DAEMON_JSON}.bak.${stamp}"
  echo "Backed up to ${DAEMON_JSON}.bak.${stamp}"
fi

python3 - "$DAEMON_JSON" <<'PY'
import json
import os
import sys

path = sys.argv[1]

defaults = [
    "https://docker.m.daocloud.io",
    "https://hub-mirror.c.163.com",
    "https://mirror.baidubce.com",
]


def bad(m: str) -> bool:
    u = m.lower()
    return "docker.mirrors.ustc.edu.cn" in u or "mirrors.ustc.edu.cn" in u


data: dict = {}
if os.path.isfile(path):
    try:
        raw = open(path, encoding="utf-8").read().strip()
        if raw:
            data = json.loads(raw)
    except json.JSONDecodeError as e:
        print(f"ERROR: invalid JSON in {path}: {e}", file=sys.stderr)
        sys.exit(1)

existing = data.get("registry-mirrors") or []
if not isinstance(existing, list):
    existing = []

clean = [m.strip() for m in existing if isinstance(m, str) and m.strip() and not bad(m.strip())]

combined = defaults + [m for m in clean if m not in defaults]

out: list[str] = []
seen: set[str] = set()
for m in combined:
    if m in seen:
        continue
    seen.add(m)
    out.append(m)

data["registry-mirrors"] = out
os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
with open(path, "w", encoding="utf-8") as f:
    json.dump(data, f, indent=2)
    f.write("\n")
print("Wrote", path)
print("registry-mirrors:", json.dumps(out, indent=2))
PY

if command -v systemctl >/dev/null 2>&1; then
  systemctl restart docker
  echo "Restarted docker.service"
else
  echo "systemctl not found; restart Docker manually." >&2
fi

echo "Smoke test: docker pull infiniflow/ragflow_deps:latest"
docker pull infiniflow/ragflow_deps:latest
