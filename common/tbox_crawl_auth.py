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
#  See the License for the License for the specific language governing permissions and
#  limitations under the License.
#

"""Resolve crawl HTTP auth headers from environment (secrets never stored in task extra_config)."""

from __future__ import annotations

import json
import logging
import os
import re
from typing import Any

_LOG = logging.getLogger(__name__)

EXTRA_CRAWL_AUTH_PROFILE = "tbox_crawl_auth_profile"

_PROFILE_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$")

_FORBIDDEN_SECRET_EXTRA_KEYS = frozenset(
    {
        "tbox_crawl_auth_token",
        "tbox_crawl_auth_password",
        "tbox_crawl_auth_secret",
        "tbox_crawl_auth_headers",
        "tbox_crawl_auth_bearer",
        "authorization",
        "api_key",
        "apikey",
        "x_api_key",
    }
)


def profile_env_suffix(profile: str) -> str:
    """Map profile name to ``TBOX_CRAWL_AUTH_<SUFFIX>_HEADERS`` suffix."""
    cleaned = re.sub(r"[^A-Za-z0-9]", "_", (profile or "").strip())
    return cleaned.upper()


def resolve_auth_headers(extra_config: dict[str, Any] | None) -> dict[str, str]:
    """
    Load extra HTTP headers for a crawl task from env.

    Task stores only ``extra_config.tbox_crawl_auth_profile`` (e.g. ``intranet``).
    Worker reads ``TBOX_CRAWL_AUTH_INTRANET_HEADERS`` as a JSON object ``{"Header": "value", ...}``.
    """
    extra = extra_config or {}
    raw_profile = extra.get(EXTRA_CRAWL_AUTH_PROFILE)
    if raw_profile is None:
        return {}
    profile = str(raw_profile).strip()
    if not profile:
        return {}

    suffix = profile_env_suffix(profile)
    if not suffix:
        _LOG.warning("tbox_crawl_auth: empty env suffix for profile=%r", profile)
        return {}

    env_key = f"TBOX_CRAWL_AUTH_{suffix}_HEADERS"
    raw = (os.environ.get(env_key) or "").strip()
    if not raw:
        _LOG.warning("tbox_crawl_auth: profile=%r but %s is unset or empty", profile, env_key)
        return {}

    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError as exc:
        _LOG.warning("tbox_crawl_auth: invalid JSON in %s: %s", env_key, exc)
        return {}

    if not isinstance(parsed, dict):
        _LOG.warning("tbox_crawl_auth: %s must be a JSON object", env_key)
        return {}

    out: dict[str, str] = {}
    for key, val in parsed.items():
        k = str(key).strip()
        if not k or val is None:
            continue
        out[k] = str(val)
    return out


def build_fetch_headers(extra_config: dict[str, Any] | None, *, default_user_agent: str) -> dict[str, str]:
    """Default User-Agent merged with env-resolved auth headers (auth may override UA)."""
    headers = {"User-Agent": default_user_agent}
    headers.update(resolve_auth_headers(extra_config))
    return headers


def validate_auth_profile_value(profile: Any) -> str | None:
    if profile is None:
        return None
    if not isinstance(profile, str):
        return "tbox_crawl_auth_profile must be a string"
    s = profile.strip()
    if not s:
        return None
    if not _PROFILE_RE.fullmatch(s):
        return "tbox_crawl_auth_profile must match [A-Za-z0-9][A-Za-z0-9._-]{0,63}"
    return None


def validate_extra_config_no_secrets(extra_config: dict[str, Any] | None) -> str | None:
    """Reject extra_config keys/values that would store credentials in the DB."""
    if not extra_config:
        return None
    if not isinstance(extra_config, dict):
        return "extra_config must be an object"

    for key, val in extra_config.items():
        kl = str(key).lower().strip()
        if kl in _FORBIDDEN_SECRET_EXTRA_KEYS:
            return f"extra_config must not contain secret key {key!r}; use {EXTRA_CRAWL_AUTH_PROFILE} + env TBOX_CRAWL_AUTH_<PROFILE>_HEADERS"
        if kl.startswith("tbox_crawl_auth_") and kl != EXTRA_CRAWL_AUTH_PROFILE:
            return f"extra_config must not contain {key!r}; use {EXTRA_CRAWL_AUTH_PROFILE} + env TBOX_CRAWL_AUTH_<PROFILE>_HEADERS"

    if EXTRA_CRAWL_AUTH_PROFILE in extra_config:
        err = validate_auth_profile_value(extra_config.get(EXTRA_CRAWL_AUTH_PROFILE))
        if err:
            return err

    return None
