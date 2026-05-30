#!/usr/bin/env bash
# Smoke-test web-tbox login path: RSA encrypt + POST /api/v1/auth/login via 5180 proxy.
# Exit 0 when JSON includes access_token or proxy exposes X-Ragflow-Authorization.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

EMAIL="${TBOX_LOGIN_EMAIL:-admin@ragflow.io}"
PASSWORD="${TBOX_LOGIN_PASSWORD:-admin}"
BASE="${TBOX_CONSOLE_URL:-http://127.0.0.1:5180}"

ENC=$(docker exec docker-ragflow-cpu-1 python3 -c "
import base64, sys
from pathlib import Path
from Crypto.PublicKey import RSA
from Crypto.Cipher import PKCS1_v1_5
pem = Path('/ragflow/conf/public.pem').read_text()
key = RSA.importKey(pem, 'Welcome')
cipher = PKCS1_v1_5.new(key)
plain = sys.argv[1]
print(base64.b64encode(cipher.encrypt(base64.b64encode(plain.encode()).decode().encode())).decode())
" "$PASSWORD")

HDR_FILE=$(mktemp)
BODY_FILE=$(mktemp)
trap 'rm -f "$HDR_FILE" "$BODY_FILE"' EXIT

HTTP=$(curl -sS -D "$HDR_FILE" -o "$BODY_FILE" -w '%{http_code}' -X POST "${BASE}/api/v1/auth/login" \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"${EMAIL}\",\"password\":\"${ENC}\"}")

CODE=$(python3 -c "import json; d=json.load(open('$BODY_FILE')); print(d.get('code',''))")
MSG=$(python3 -c "import json; d=json.load(open('$BODY_FILE')); print(d.get('message',''))")
HAS_TOKEN=$(python3 -c "import json; d=json.load(open('$BODY_FILE')); print(1 if (d.get('data') or {}).get('access_token') else 0)")
X_AUTH=$(grep -i '^x-ragflow-authorization:' "$HDR_FILE" | head -1 | cut -d: -f2- | tr -d ' \r\n' || true)
AUTH_HDR=$(grep -i '^authorization:' "$HDR_FILE" | head -1 | cut -d: -f2- | tr -d ' \r\n' || true)

echo "==> POST ${BASE}/api/v1/auth/login (${EMAIL})"
echo "    HTTP ${HTTP} code=${CODE} message=${MSG}"
echo "    access_token in JSON: ${HAS_TOKEN}"
echo "    X-Ragflow-Authorization: ${X_AUTH:+present}${X_AUTH:-missing}"
echo "    Authorization header: ${AUTH_HDR:+present}${AUTH_HDR:-missing}"

if [[ "$HTTP" != "200" || "$CODE" != "0" ]]; then
  echo "FAIL: login API error" >&2
  exit 1
fi
if [[ "$HAS_TOKEN" != "1" && -z "$X_AUTH" && -z "$AUTH_HDR" ]]; then
  echo "FAIL: no token in JSON or response headers" >&2
  exit 1
fi

# Node fetch simulation (same as browser client)
export ENC
export BASE EMAIL
node - <<'NODE'
const enc = process.env.ENC;
const base = process.env.BASE;
const email = process.env.EMAIL;
(async () => {
  const res = await fetch(`${base}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: enc }),
  });
  const data = await res.json();
  const token =
    data?.data?.access_token ||
    res.headers.get('X-Ragflow-Authorization') ||
    res.headers.get('Authorization') ||
    res.headers.get('authorization') ||
    '';
  if (data.code !== 0 || !token) {
    console.error('FAIL: node fetch client cannot obtain token');
    console.error('  code', data.code, 'message', data.message);
    console.error('  access_token', data?.data?.access_token);
    console.error('  X-Ragflow-Authorization', res.headers.get('X-Ragflow-Authorization'));
    console.error('  Authorization', res.headers.get('Authorization'));
    process.exit(1);
  }
  console.log('==> node fetch client: token ok (len=%s)', token.length);

  const meRes = await fetch(`${base}/v1/tbox/me`, {
    headers: { Authorization: token },
  });
  const me = await meRes.json();
  if (me.code !== 0) {
    console.error('FAIL: /v1/tbox/me after login', me.code, me.message);
    process.exit(1);
  }
  console.log('==> /v1/tbox/me ok email=%s', me.data?.email || '?');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
NODE

echo "==> login smoke OK"
