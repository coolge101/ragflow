#
#  Copyright 2026 The InfiniFlow Authors. All Rights Reserved.
#
#  Licensed under the Apache License, Version 2.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#
#      http://www.apache.org/licenses/LICENSE-2.0
#
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.
#
"""Bridge to tbox-pipelines unified crawl platform (PostgreSQL + feature flags).

Environment (RAGFlow API process):
  TBOX_POSTGRES_DSN              — required for overview/toggle/triggers
  TBOX_PIPELINE_CONFIG           — pipeline JSON for crawl-run / expand-frontier
  TBOX_PIPELINES_HOME            — working directory when spawning CLI (optional)
  TBOX_PIPELINES_PYTHON          — python executable (default: sys.executable)
  TBOX_CRAWL_FEATURE_FLAGS_PATH  — override feature-flags.yaml path
"""

from __future__ import annotations

import json
import logging
import os
import subprocess
import sys
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)


class PlatformUnavailableError(RuntimeError):
    """Raised when tbox-pipelines cannot be reached or configured."""


def _pipeline_config_path() -> str:
    explicit = (
        os.environ.get("TBOX_PIPELINE_CONFIG", "").strip()
        or os.environ.get("TBOX_PIPELINES_CONFIG", "").strip()
    )
    if explicit:
        return explicit
    home = _pipelines_home()
    if home:
        return str(Path(home) / "config" / "pipeline.real-crawl.localhost.json")
    return "config/pipeline.real-crawl.localhost.json"


def _pipelines_home() -> str:
    return os.environ.get("TBOX_PIPELINES_HOME", "").strip()


def _pipelines_python() -> str:
    return os.environ.get("TBOX_PIPELINES_PYTHON", "").strip() or sys.executable


def _try_import_bridge():
    try:
        from tbox_pipelines.dashboard import platform_api as bridge  # type: ignore

        return bridge
    except ImportError:
        return None


def _resolve_config_via_import():
    bridge = _try_import_bridge()
    if bridge is None:
        return None, None
    config_path = _pipeline_config_path()
    try:
        return bridge, bridge.resolve_platform_config(config_path)
    except Exception as exc:  # noqa: BLE001
        logger.warning("platform resolve_config failed: %s", exc)
        return bridge, None


def _run_platform_cli(
    action: str,
    extra: list[str] | None = None,
    *,
    timeout: int = 120,
    json_output: bool = True,
) -> dict[str, Any]:
    home = _pipelines_home()
    config = _pipeline_config_path()
    cmd = [
        _pipelines_python(),
        "-m",
        "tbox_pipelines.cli",
        "platform",
        "--platform-action",
        action,
        "--config",
        config,
    ]
    if json_output:
        cmd.append("--json")
    if extra:
        cmd.extend(extra)

    env = dict(os.environ)
    dsn = os.environ.get("TBOX_POSTGRES_DSN", "").strip()
    if dsn:
        env["TBOX_POSTGRES_DSN"] = dsn

    try:
        proc = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            cwd=home or None,
            env=env,
            timeout=timeout,
            check=False,
        )
    except FileNotFoundError as exc:
        raise PlatformUnavailableError(
            "tbox-pipelines CLI not found; set TBOX_PIPELINES_HOME and TBOX_PIPELINES_PYTHON"
        ) from exc
    except subprocess.TimeoutExpired as exc:
        raise PlatformUnavailableError(f"platform CLI timed out: {action}") from exc

    if proc.returncode != 0:
        err = (proc.stderr or proc.stdout or "").strip()[:500]
        raise PlatformUnavailableError(err or f"platform CLI exit {proc.returncode}")

    raw = (proc.stdout or "").strip()
    if not raw:
        raise PlatformUnavailableError("platform CLI returned empty output")
    try:
        return json.loads(raw)
    except json.JSONDecodeError as exc:
        raise PlatformUnavailableError(f"invalid JSON from platform CLI: {raw[:200]}") from exc


def get_platform_overview(*, lookback_days: int = 7) -> dict[str, Any]:
    bridge, cfg = _resolve_config_via_import()
    if bridge is not None and cfg is not None:
        try:
            return bridge.get_overview(cfg, lookback_days=lookback_days)
        except Exception as exc:  # noqa: BLE001
            logger.warning("platform overview import path failed: %s", exc)

    try:
        payload = _run_platform_cli("overview", ["--lookback-days", str(int(lookback_days))])
        payload["available"] = True
        return payload
    except PlatformUnavailableError as exc:
        return {
            "available": False,
            "error": str(exc),
            "tasks": [],
            "engine": {},
            "frontier": {"lookback_days": lookback_days},
            "postgres_ok": False,
        }


def list_platform_documents(
    *,
    statuses: list[str] | None = None,
    domain: str | None = None,
    limit: int = 50,
    offset: int = 0,
) -> dict[str, Any]:
    bridge, cfg = _resolve_config_via_import()
    if bridge is not None and cfg is not None:
        try:
            return bridge.list_documents(
                cfg,
                statuses=statuses,
                domain=domain,
                limit=limit,
                offset=offset,
            )
        except Exception as exc:  # noqa: BLE001
            logger.warning("platform list_documents import path failed: %s", exc)
            return {
                "available": False,
                "error": str(exc),
                "total": 0,
                "items": [],
                "postgres_ok": False,
            }
    return {
        "available": False,
        "error": "tbox-pipelines bridge unavailable",
        "total": 0,
        "items": [],
        "postgres_ok": False,
    }


def toggle_platform_domain(domain: str, *, enabled: bool) -> dict[str, Any]:
    bridge, cfg = _resolve_config_via_import()
    if bridge is not None and cfg is not None:
        return bridge.toggle_domain(cfg, domain, enabled=enabled)

    flag = "true" if enabled else "false"
    return _run_platform_cli(
        "toggle",
        ["--domain", str(domain), "--enabled", flag],
        timeout=30,
        json_output=False,
    )


def trigger_platform_crawl(domain: str = "all") -> dict[str, Any]:
    bridge, cfg = _resolve_config_via_import()
    if bridge is not None and cfg is not None:
        return bridge.trigger_crawl(cfg, domain)

    domain = str(domain or "all").strip().lower() or "all"
    return _run_platform_cli(
        "crawl",
        ["--domain", domain],
        timeout=30,
        json_output=False,
    )


def trigger_platform_expand_frontier() -> dict[str, Any]:
    bridge, cfg = _resolve_config_via_import()
    if bridge is not None and cfg is not None:
        return bridge.trigger_expand_frontier(cfg)

    return _run_platform_cli("expand-frontier", timeout=30, json_output=False)


def get_discovery_overview(*, lookback_days: int = 7) -> dict[str, Any]:
    """Search-first discovery stats for the 5180 console panel (queries, contribution, recent URLs)."""
    bridge, cfg = _resolve_config_via_import()
    if bridge is not None and cfg is not None:
        try:
            payload = bridge.get_discovery_overview(cfg, lookback_days=lookback_days)
            payload.setdefault("available", True)
            return payload
        except Exception as exc:  # noqa: BLE001
            logger.warning("discovery overview import path failed: %s", exc)
            return {
                "available": False,
                "error": str(exc),
                "by_provider": {},
                "registered": 0,
                "search_contribution": {},
                "seed_contribution": {},
                "queries": [],
                "recent": [],
            }
    return {
        "available": False,
        "error": "tbox-pipelines bridge unavailable",
        "by_provider": {},
        "registered": 0,
        "search_contribution": {},
        "seed_contribution": {},
        "queries": [],
        "recent": [],
    }


def trigger_discovery_run(domains: str = "TD,RS") -> dict[str, Any]:
    """Spawn a discovery-only run (query-bank sync + search fan-out), no crawl/sync."""
    bridge, cfg = _resolve_config_via_import()
    if bridge is not None and cfg is not None:
        return bridge.trigger_discovery_run(cfg, domains)
    raise PlatformUnavailableError("tbox-pipelines bridge unavailable; cannot start discovery run")


def set_discovery_query_status(query_id: str, status: str) -> dict[str, Any]:
    """Enable/disable (or otherwise transition) a discovery query bank entry."""
    bridge, cfg = _resolve_config_via_import()
    if bridge is not None and cfg is not None:
        return bridge.set_discovery_query_status(cfg, query_id, status)
    raise PlatformUnavailableError("tbox-pipelines bridge unavailable; cannot update discovery query status")


def list_platform_triggers() -> dict[str, Any]:
    bridge, cfg = _resolve_config_via_import()
    if bridge is not None:
        return {"recent": bridge.recent_triggers()}
    try:
        return _run_platform_cli("triggers", timeout=15)
    except PlatformUnavailableError:
        return {"recent": []}


def plan_goal(*, text: str, domain: str | None = None, confirm: bool = False) -> dict[str, Any]:
    bridge, cfg = _resolve_config_via_import()
    if bridge is not None and cfg is not None:
        return bridge.plan_goal(cfg, text=text, domain=domain, confirm=confirm)
    raise PlatformUnavailableError("tbox-pipelines bridge unavailable; cannot plan goal")


def confirm_goal(goal_id: str) -> dict[str, Any]:
    bridge, cfg = _resolve_config_via_import()
    if bridge is not None and cfg is not None:
        return bridge.confirm_goal(cfg, goal_id)
    raise PlatformUnavailableError("tbox-pipelines bridge unavailable; cannot confirm goal")


def list_goals(*, domain: str | None = None, limit: int = 50) -> dict[str, Any]:
    bridge, cfg = _resolve_config_via_import()
    if bridge is not None and cfg is not None:
        return bridge.list_goals(cfg, domain=domain, limit=limit)
    raise PlatformUnavailableError("tbox-pipelines bridge unavailable; cannot list goals")


def list_goal_runs(goal_id: str, *, limit: int = 20) -> dict[str, Any]:
    bridge, cfg = _resolve_config_via_import()
    if bridge is not None and cfg is not None:
        return bridge.list_goal_runs(cfg, goal_id, limit=limit)
    raise PlatformUnavailableError("tbox-pipelines bridge unavailable; cannot list goal runs")


def trigger_goal_optimize(goal_id: str, *, dry_run: bool = False) -> dict[str, Any]:
    bridge, cfg = _resolve_config_via_import()
    if bridge is not None and cfg is not None:
        return bridge.trigger_goal_optimize(cfg, goal_id, dry_run=dry_run)
    raise PlatformUnavailableError("tbox-pipelines bridge unavailable; cannot start goal optimize")
