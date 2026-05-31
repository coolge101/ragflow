#!/usr/bin/env python3
"""5180 console bundle smoke — verify Phase 16–17 citation/highlight code in served JS."""

from __future__ import annotations

import json
import os
import re
import sys
import urllib.error
import urllib.request
from dataclasses import asdict, dataclass

CONSOLE = os.environ.get("TBOX_CONSOLE_URL", "http://127.0.0.1:5180").rstrip("/")
TIMEOUT = int(os.environ.get("TBOX_CONSOLE_SMOKE_TIMEOUT", "30"))

# Minified bundle markers (survive Vite production build)
MARKERS: tuple[tuple[str, str], ...] = (
    ("citation_click", 'kind:"cite"'),
    ("chunk_scroll", "scrollIntoView"),
    ("citation_regex", r"\[(?:ID:)?"),
    ("chunk_list_panel", 'selectLabelPrefix:p="片段"'),
)


@dataclass
class BundleCheck:
    url: str
    bytes: int
    markers_found: list[str]
    markers_missing: list[str]


def fetch(url: str) -> str:
    req = urllib.request.Request(url, headers={"User-Agent": "tbox-console-bundle-smoke/1.0"})
    with urllib.request.urlopen(req, timeout=TIMEOUT) as resp:
        return resp.read().decode("utf-8", errors="replace")


def script_urls(html: str, base: str) -> list[str]:
    rels = re.findall(r"""<script[^>]+src=["']([^"']+\.js)["']""", html, flags=re.I)
    out: list[str] = []
    for rel in rels:
        if rel.startswith("http://") or rel.startswith("https://"):
            out.append(rel)
        elif rel.startswith("/"):
            out.append(f"{base}{rel}")
        else:
            out.append(f"{base}/{rel.lstrip('/')}")
    return out


def check_bundle(url: str, body: str) -> BundleCheck:
    found: list[str] = []
    missing: list[str] = []
    for name, needle in MARKERS:
        if needle in body:
            found.append(name)
        else:
            missing.append(name)
    return BundleCheck(url, len(body.encode("utf-8", errors="replace")), found, missing)


def main() -> int:
    pages = (f"{CONSOLE}/", f"{CONSOLE}/login")
    html = ""
    page_used = ""
    last_err: Exception | None = None
    for page in pages:
        try:
            html = fetch(page)
            page_used = page
            break
        except (urllib.error.URLError, TimeoutError) as ex:
            last_err = ex
    if not html:
        print(json.dumps({"error": f"cannot fetch console HTML: {last_err}"}), file=sys.stderr)
        return 1

    urls = script_urls(html, CONSOLE)
    if not urls:
        print(json.dumps({"error": "no script src in HTML", "page": page_used}), file=sys.stderr)
        return 1

    checks: list[BundleCheck] = []
    combined_found: set[str] = set()
    for url in urls:
        try:
            body = fetch(url)
        except (urllib.error.URLError, TimeoutError) as ex:
            print(json.dumps({"error": f"fetch failed: {url}", "detail": str(ex)}), file=sys.stderr)
            return 1
        chk = check_bundle(url, body)
        checks.append(chk)
        combined_found.update(chk.markers_found)

    still_missing = [name for name, _ in MARKERS if name not in combined_found]
    ok = len(still_missing) == 0
    payload = {
        "console_url": CONSOLE,
        "page": page_used,
        "bundles": [asdict(c) for c in checks],
        "markers_required": [m[0] for m in MARKERS],
        "markers_missing": still_missing,
        "ok": ok,
        "hint": None if ok else "bash scripts/tbox_rebuild_console.sh",
    }
    print(json.dumps(payload, ensure_ascii=False, indent=2))
    if not ok:
        print(
            f"FAIL: 5180 bundle missing Phase 16–17 markers: {still_missing}. Run: bash scripts/tbox_rebuild_console.sh",
            file=sys.stderr,
        )
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
