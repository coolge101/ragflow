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

"""Self-heal policy helpers for crawl seed PATCH actions (Phase 69.1)."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from common.tbox_crawl_dedup import canonicalize_url, merge_url_lists

ALLOWED_CATALOG_TOPICS = frozenset({"regulations", "tech", "market", "product"})

EXTRA_SELF_HEAL_ENABLED = "tbox_crawl_self_heal_enabled"
EXTRA_AUTO_PRUNE_SEEDS = "tbox_crawl_auto_prune_seeds"
EXTRA_AUTO_IMPORT_CATALOG = "tbox_crawl_auto_import_catalog"
EXTRA_SEED_HEALTH_MIN_SCORE = "tbox_crawl_seed_health_min_score"
EXTRA_CATALOG_TOPIC = "tbox_crawl_catalog_topic"

DEFAULT_SEED_HEALTH_MIN_SCORE = 20
MIN_FAIL_COUNT_FOR_PRUNE = 3
MIN_HEALTHY_CATALOG_FOR_IMPORT = 2
CATALOG_MIN_HEALTH_SCORE = 60
DEFAULT_CATALOG_HEALTH_SCORE = 70

_TOPIC_NAME_HINTS: tuple[tuple[tuple[str, ...], str], ...] = (
    (("法规", "监管", "合规", "regulation", "legal"), "regulations"),
    (("技术", "tech", "研发", "工程"), "tech"),
    (("市场", "行业", "竞争", "market"), "market"),
    (("产品", "product", "竞品"), "product"),
)


def _as_bool(val: Any, default: bool) -> bool:
    if val is None:
        return default
    if isinstance(val, bool):
        return val
    if isinstance(val, (int, float)):
        return bool(val)
    s = str(val).strip().lower()
    if s in ("1", "true", "yes", "on"):
        return True
    if s in ("0", "false", "no", "off"):
        return False
    return default


def _as_int(val: Any, default: int) -> int:
    try:
        return int(val)
    except (TypeError, ValueError):
        return default


def infer_catalog_topic(task_name: str, extra_config: dict[str, Any] | None = None) -> str | None:
    extra = extra_config or {}
    explicit = (extra.get(EXTRA_CATALOG_TOPIC) or "").strip().lower()
    if explicit in ALLOWED_CATALOG_TOPICS:
        return explicit
    name = (task_name or "").strip().lower()
    if not name:
        return None
    for hints, topic in _TOPIC_NAME_HINTS:
        if any(h in name for h in hints):
            return topic
    return None


@dataclass(frozen=True)
class SelfHealConfig:
    enabled: bool = True
    auto_prune_seeds: bool = True
    auto_import_catalog: bool = True
    seed_health_min_score: int = DEFAULT_SEED_HEALTH_MIN_SCORE
    catalog_topic: str | None = None


def parse_self_heal_config(extra_config: dict[str, Any] | None, *, task_name: str = "") -> SelfHealConfig:
    extra = extra_config or {}
    topic = infer_catalog_topic(task_name, extra)
    return SelfHealConfig(
        enabled=_as_bool(extra.get(EXTRA_SELF_HEAL_ENABLED), True),
        auto_prune_seeds=_as_bool(extra.get(EXTRA_AUTO_PRUNE_SEEDS), True),
        auto_import_catalog=_as_bool(extra.get(EXTRA_AUTO_IMPORT_CATALOG), True),
        seed_health_min_score=max(0, min(100, _as_int(extra.get(EXTRA_SEED_HEALTH_MIN_SCORE), DEFAULT_SEED_HEALTH_MIN_SCORE))),
        catalog_topic=topic,
    )


@dataclass
class UrlHealthSnapshot:
    url: str
    url_canonical: str
    health_score: int
    fail_count: int
    last_outcome: str


def is_unhealthy_seed(row: UrlHealthSnapshot, *, min_score: int, min_fail_count: int = MIN_FAIL_COUNT_FOR_PRUNE) -> bool:
    return row.health_score < min_score and row.fail_count >= min_fail_count


@dataclass
class SeedHealPlan:
    prune_urls: list[str] = field(default_factory=list)
    import_catalog: bool = False
    catalog_urls: list[str] = field(default_factory=list)
    reasons: list[str] = field(default_factory=list)


def compute_seed_heal_plan(
    seed_urls: list[str],
    health_by_canonical: dict[str, UrlHealthSnapshot],
    *,
    config: SelfHealConfig,
    catalog_healthy_urls: list[str] | None = None,
) -> SeedHealPlan:
    """Derive prune/import actions without mutating task state."""
    plan = SeedHealPlan()
    if not config.enabled:
        return plan

    seeds = list(seed_urls or [])
    catalog_good = list(dict.fromkeys(catalog_healthy_urls or []))
    prune_set: set[str] = set()

    if config.auto_prune_seeds and seeds:
        for url in seeds:
            canon = canonicalize_url(url)
            if not canon:
                continue
            snap = health_by_canonical.get(canon)
            if snap is None:
                continue
            if is_unhealthy_seed(snap, min_score=config.seed_health_min_score):
                prune_set.add(url)
                plan.prune_urls.append(url)
                plan.reasons.append(f"prune {url}: health_score={snap.health_score} fail_count={snap.fail_count} last={snap.last_outcome}")

    remaining = [u for u in seeds if u not in prune_set]
    need_catalog = len(remaining) == 0 or bool(plan.prune_urls)
    if config.auto_import_catalog and config.catalog_topic and len(catalog_good) >= MIN_HEALTHY_CATALOG_FOR_IMPORT:
        if need_catalog or len(remaining) < MIN_HEALTHY_CATALOG_FOR_IMPORT:
            plan.import_catalog = True
            plan.catalog_urls = [u for u in catalog_good if u not in remaining]
            if plan.catalog_urls:
                plan.reasons.append(f"import catalog topic={config.catalog_topic} urls={len(plan.catalog_urls)}")

    if plan.prune_urls and not plan.import_catalog:
        remaining_after = [u for u in seeds if u not in set(plan.prune_urls)]
        if not remaining_after and seeds:
            best_url = seeds[0]
            best_score = -1
            for url in seeds:
                canon = canonicalize_url(url)
                snap = health_by_canonical.get(canon or "")
                score = snap.health_score if snap else 50
                if score > best_score:
                    best_score = score
                    best_url = url
            plan.prune_urls = [u for u in plan.prune_urls if u != best_url]
            plan.reasons.append(f"retain at least one seed ({best_url})")

    return plan


def apply_seed_heal_plan(seed_urls: list[str], plan: SeedHealPlan) -> list[str]:
    """Merge catalog imports and prune bad seeds; guarantee non-empty when possible."""
    seeds = list(seed_urls or [])
    prune_canon = {canonicalize_url(u) for u in plan.prune_urls if canonicalize_url(u)}
    merged = merge_url_lists(plan.catalog_urls, seeds)
    kept = [u for u in merged if canonicalize_url(u) not in prune_canon]
    if kept:
        return kept
    if plan.catalog_urls:
        return [plan.catalog_urls[0]]
    if seeds:
        return [seeds[0]]
    return []
