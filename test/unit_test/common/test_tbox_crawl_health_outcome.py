import unittest

from common.tbox_crawl_health_outcome import classify_outcome_from_message, compute_health_score


class TestCrawlHealthOutcome(unittest.TestCase):
    def test_classify_robots(self):
        self.assertEqual(classify_outcome_from_message("blocked by robots.txt"), "robots")

    def test_classify_timeout(self):
        self.assertEqual(classify_outcome_from_message("Connection timed out"), "timeout")

    def test_score_favors_success(self):
        self.assertGreaterEqual(compute_health_score(success_count=3, fail_count=1, last_outcome="ok"), 60)

    def test_score_low_after_repeated_robots(self):
        score = compute_health_score(success_count=0, fail_count=3, last_outcome="robots")
        self.assertLessEqual(score, 25)


if __name__ == "__main__":
    unittest.main()
