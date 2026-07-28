#!/usr/bin/env python3
"""Print a short human summary of security_overall_report.json for harness CI logs."""

from __future__ import annotations

import json
import sys
from pathlib import Path

REPORT = Path("security_overall_report.json")


def main() -> int:
    if not REPORT.is_file():
        print("Security report not available", file=sys.stderr)
        return 0

    data = json.loads(REPORT.read_text(encoding="utf-8"))
    score = data.get("overall_security_score", "N/A")
    print(f"Overall Security Score: {score}/100")
    print()

    print("Test Results:")
    try:
        skip = {"overall_security_score", "generated_at", "recommendations", "static_analysis"}
        for test_type, results in data.items():
            if test_type in skip:
                continue
            if isinstance(results, dict) and "total" in results:
                passed = results.get("passed", 0)
                total = results.get("total", 0)
                print(f"  {test_type}: {passed}/{total} passed")
    except Exception as e:  # noqa: BLE001
        print(f"  Error: {e}")
    print()

    print("Static Analysis:")
    try:
        static = data.get("static_analysis", {})
        if "bandit" in static:
            n = static["bandit"].get("issues", 0)
            print(f"  Bandit: {n} issues")
        if "safety" in static:
            n = static["safety"].get("vulnerabilities", 0)
            print(f"  Safety: {n} vulnerabilities")
    except Exception as e:  # noqa: BLE001
        print(f"  Error: {e}")
    print()

    print("Recommendations:")
    try:
        for rec in data.get("recommendations", []):
            print(f"  • {rec}")
    except Exception as e:  # noqa: BLE001
        print(f"  Error: {e}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
