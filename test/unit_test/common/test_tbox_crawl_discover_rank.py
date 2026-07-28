import os
import unittest

from common.tbox_crawl_discover import DiscoverHit
from common.tbox_crawl_discover_rank import (
    EXTRA_DISCOVER_MAX_FETCH,
    EXTRA_DISCOVER_RANK_MIN_SCORE,
    EXTRA_DISCOVER_RANK_MODE,
    parse_discover_max_fetch,
    parse_discover_rank_min_score,
    parse_discover_rank_mode,
    rank_discover_hits,
    score_discover_hit,
)


class TestDiscoverRank(unittest.TestCase):
    def test_portal_homepage_scores_low(self):
        h = DiscoverHit(
            url="https://www.cttic.cn/",
            title="首页 - CTTIC",
            snippet="网站首页 登录 注册",
            query="TBOX",
        )
        score = score_discover_hit(h, topic="车联网 TBOX", mode="rules")
        self.assertLess(score, 55)

    def test_article_url_scores_high(self):
        h = DiscoverHit(
            url="https://example.com/news/2024/tbox-whitepaper.html",
            title="TBOX 技术趋势白皮书",
            snippet="车联网架构分析",
            query="TBOX 技术趋势",
        )
        score = score_discover_hit(h, topic="TBOX 技术趋势", mode="rules")
        self.assertGreaterEqual(score, 55)

    def test_rank_filters_and_sorts(self):
        hits = [
            DiscoverHit(url="https://a.com/", title="首页", snippet=""),
            DiscoverHit(url="https://b.com/news/1", title="TBOX 报告", snippet="趋势"),
        ]
        kept, skipped = rank_discover_hits(
            hits, topic="TBOX", mode="rules", min_score=55, max_keep=5
        )
        self.assertEqual(skipped, 1)
        self.assertEqual(len(kept), 1)
        self.assertIn("news", kept[0].url)

    def test_mode_off_returns_perfect_score(self):
        h = DiscoverHit(url="https://a.com/", title="首页", snippet="")
        self.assertEqual(score_discover_hit(h, topic="TBOX", mode="off"), 100)

    def test_mode_off_rank_keeps_without_skip(self):
        hits = [
            DiscoverHit(url="https://a.com/", title="首页", snippet=""),
            DiscoverHit(url="https://b.com/news/1", title="TBOX", snippet=""),
        ]
        kept, skipped = rank_discover_hits(
            hits, topic="TBOX", mode="off", min_score=55, max_keep=1
        )
        self.assertEqual(skipped, 0)
        self.assertEqual(len(kept), 1)
        self.assertEqual(kept[0].url, hits[0].url)

    def test_url_only_scoring_capped_at_70(self):
        h = DiscoverHit(
            url="https://example.com/news/2024/tbox-whitepaper.html",
            title="",
            snippet="",
            query="TBOX",
        )
        score = score_discover_hit(h, topic="TBOX 技术趋势", mode="rules")
        self.assertLessEqual(score, 70)
        self.assertGreaterEqual(score, 55)

    def test_parse_discover_rank_mode(self):
        self.assertEqual(parse_discover_rank_mode({}), "off")
        self.assertEqual(
            parse_discover_rank_mode({EXTRA_DISCOVER_RANK_MODE: "rules"}), "rules"
        )
        self.assertEqual(
            parse_discover_rank_mode({EXTRA_DISCOVER_RANK_MODE: "rules_then_llm"}),
            "rules_then_llm",
        )
        self.assertEqual(
            parse_discover_rank_mode({EXTRA_DISCOVER_RANK_MODE: "invalid"}), "off"
        )

    def test_parse_discover_rank_min_score(self):
        self.assertEqual(parse_discover_rank_min_score({}), 55)
        self.assertEqual(
            parse_discover_rank_min_score({EXTRA_DISCOVER_RANK_MIN_SCORE: 80}), 80
        )
        self.assertEqual(parse_discover_rank_min_score({EXTRA_DISCOVER_RANK_MIN_SCORE: -5}), 0)
        self.assertEqual(parse_discover_rank_min_score({EXTRA_DISCOVER_RANK_MIN_SCORE: 150}), 100)

    def test_parse_discover_max_fetch(self):
        self.assertEqual(parse_discover_max_fetch({EXTRA_DISCOVER_MAX_FETCH: 3}), 3)
        prev = os.environ.pop("TBOX_CRAWL_INGEST_MAX", None)
        try:
            os.environ["TBOX_CRAWL_INGEST_MAX"] = "8"
            self.assertEqual(parse_discover_max_fetch({}), 8)
        finally:
            if prev is None:
                os.environ.pop("TBOX_CRAWL_INGEST_MAX", None)
            else:
                os.environ["TBOX_CRAWL_INGEST_MAX"] = prev

    def test_list_page_snippet_penalty(self):
        h = DiscoverHit(
            url="https://example.com/channel/list",
            title="行业资讯栏目列表",
            snippet="点击查看更多 下一页 栏目导航",
            query="TBOX",
        )
        score = score_discover_hit(h, topic="TBOX", mode="rules")
        self.assertLess(score, 55)

    def test_rank_preserves_stable_order_on_ties(self):
        hits = [
            DiscoverHit(url="https://a.com/news/1", title="TBOX alpha", snippet="趋势"),
            DiscoverHit(url="https://b.com/news/2", title="TBOX beta", snippet="趋势"),
        ]
        kept, skipped = rank_discover_hits(
            hits, topic="TBOX", mode="rules", min_score=0, max_keep=5
        )
        self.assertEqual(skipped, 0)
        self.assertEqual(kept[0].url, hits[0].url)
        self.assertEqual(kept[1].url, hits[1].url)


if __name__ == "__main__":
    unittest.main()
