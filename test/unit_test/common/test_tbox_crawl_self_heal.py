import unittest

from common.tbox_crawl_self_heal import (
    SelfHealConfig,
    UrlHealthSnapshot,
    apply_seed_heal_plan,
    compute_seed_heal_plan,
    infer_catalog_topic,
    is_unhealthy_seed,
    parse_self_heal_config,
)


class TestCrawlSelfHealPolicy(unittest.TestCase):
    def test_infer_topic_from_task_name(self):
        self.assertEqual(infer_catalog_topic("技术趋势监测", {}), "tech")
        self.assertEqual(infer_catalog_topic("Market watch", {}), "market")
        self.assertIsNone(infer_catalog_topic("", {}))

    def test_parse_config_defaults(self):
        cfg = parse_self_heal_config({}, task_name="技术趋势")
        self.assertTrue(cfg.enabled)
        self.assertTrue(cfg.auto_prune_seeds)
        self.assertEqual(cfg.catalog_topic, "tech")
        self.assertEqual(cfg.seed_health_min_score, 20)

    def test_unhealthy_seed_rule(self):
        row = UrlHealthSnapshot(
            url="https://www.zhihu.com/",
            url_canonical="https://www.zhihu.com/",
            health_score=10,
            fail_count=3,
            last_outcome="robots",
        )
        self.assertTrue(is_unhealthy_seed(row, min_score=20))

    def test_prune_bad_seed_with_catalog_import(self):
        bad = "https://www.zhihu.com/"
        bad_canon = "https://zhihu.com/"
        good1 = "https://example.com/a"
        good2 = "https://example.com/b"
        health = {
            bad_canon: UrlHealthSnapshot(
                url=bad,
                url_canonical=bad_canon,
                health_score=10,
                fail_count=4,
                last_outcome="robots",
            ),
        }
        cfg = SelfHealConfig(
            enabled=True,
            auto_prune_seeds=True,
            auto_import_catalog=True,
            catalog_topic="tech",
        )
        plan = compute_seed_heal_plan(
            [bad],
            health,
            config=cfg,
            catalog_healthy_urls=[good1, good2],
        )
        self.assertIn(bad, plan.prune_urls)
        self.assertTrue(plan.import_catalog)
        after = apply_seed_heal_plan([bad], plan)
        self.assertNotIn(bad, after)
        self.assertTrue(len(after) >= 1)

    def test_retain_one_seed_without_catalog(self):
        bad = "https://www.zhihu.com/"
        bad_canon = "https://zhihu.com/"
        health = {
            bad_canon: UrlHealthSnapshot(
                url=bad,
                url_canonical=bad_canon,
                health_score=5,
                fail_count=5,
                last_outcome="robots",
            ),
        }
        cfg = SelfHealConfig(enabled=True, auto_prune_seeds=True, auto_import_catalog=False)
        plan = compute_seed_heal_plan([bad], health, config=cfg, catalog_healthy_urls=[])
        after = apply_seed_heal_plan([bad], plan)
        self.assertEqual(after, [bad])


if __name__ == "__main__":
    unittest.main()
