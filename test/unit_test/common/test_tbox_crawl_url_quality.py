import unittest

from common.tbox_crawl_url_quality import filter_urls_by_quality, url_passes_quality


class TestUrlQuality(unittest.TestCase):
    def test_rejects_site_root(self):
        self.assertFalse(url_passes_quality("https://www.miit.gov.cn/", "normal"))
        self.assertFalse(url_passes_quality("https://example.com/index.html", "normal"))

    def test_accepts_article_like_path(self):
        self.assertTrue(url_passes_quality("https://example.com/news/2024/tbox-whitepaper.html", "normal"))

    def test_off_mode_keeps_all(self):
        urls = ["https://a.com/", "https://b.com/x/y/z"]
        kept, skipped = filter_urls_by_quality(urls, mode="off")
        self.assertEqual(len(kept), 2)
        self.assertEqual(skipped, 0)

    def test_skips_login_paths(self):
        self.assertFalse(url_passes_quality("https://example.com/login", "normal"))


if __name__ == "__main__":
    unittest.main()
