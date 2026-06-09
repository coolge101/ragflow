import unittest

from common.tbox_crawl_relevance import (
    infer_relevance_topic,
    parse_relevance_config,
    passes_relevance_gate,
    score_relevance_rules,
)


class TestCrawlRelevance(unittest.TestCase):
    def test_parse_defaults_off(self):
        cfg = parse_relevance_config({})
        self.assertEqual(cfg.mode, "off")
        self.assertEqual(cfg.min_score, 60)

    def test_infer_topic_from_task_name(self):
        topic = infer_relevance_topic({}, task_name="技术趋势监测")
        self.assertIn("技术", topic)

    def test_homepage_url_low_score(self):
        text = "首页 登录 注册 更多 导航 网站地图 " * 3
        score, reason = score_relevance_rules(
            text,
            "https://www.cttic.cn/",
            keywords=("TBOX", "车联网"),
            query_terms=(),
        )
        self.assertLess(score, 60)
        self.assertIn("homepage_url", reason)

    def test_article_with_keyword_passes_rules(self):
        text = "TBOX 车联网 技术趋势 " + ("正文内容段落。" * 80)
        url = "https://example.com/news/2024/tbox-report.html"
        score, _reason = score_relevance_rules(
            text,
            url,
            keywords=("TBOX",),
            query_terms=("技术趋势",),
        )
        self.assertGreaterEqual(score, 60)

    def test_gate_off_always_passes(self):
        ok, score, reason = passes_relevance_gate(
            "anything",
            "https://example.com/",
            tenant_id="t1",
            extra_config={},
        )
        self.assertTrue(ok)
        self.assertEqual(score, 100)
        self.assertEqual(reason, "off")

    def test_gate_rules_blocks_portal(self):
        text = "首页 登录 注册 更多 导航 " * 5
        ok, score, _reason = passes_relevance_gate(
            text,
            "https://portal.example.com/",
            tenant_id="t1",
            extra_config={"tbox_crawl_relevance_mode": "rules", "tbox_crawl_relevance_min_score": 60},
            keywords=("TBOX",),
        )
        self.assertFalse(ok)
        self.assertLess(score, 60)


if __name__ == "__main__":
    unittest.main()
