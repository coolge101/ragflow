import unittest

from common.tbox_crawl_discover import DiscoverHit, DiscoverResult, merge_discover_hits


class TestDiscoverHit(unittest.TestCase):
    def test_urls_property_from_hits(self):
        hits = [
            DiscoverHit(url="https://a.com/news/1", title="TBOX 趋势", snippet="白皮书摘要", query="TBOX"),
            DiscoverHit(url="https://b.com/x", title="", snippet=""),
        ]
        result = DiscoverResult(
            hits=hits,
            provider="searxng",
            queries_executed=1,
            raw_result_count=2,
            notes="",
        )
        self.assertEqual(result.urls, ["https://a.com/news/1", "https://b.com/x"])
        self.assertEqual(result.hits[0].title, "TBOX 趋势")

    def test_merge_discover_hits_dedupes_by_canonical_url(self):
        hits = [
            DiscoverHit(url="https://Example.com/a/", title="First", snippet="s1", query="q1"),
            DiscoverHit(url="https://example.com/a", title="Second", snippet="s2", query="q2"),
        ]
        merged = merge_discover_hits(hits)
        self.assertEqual(len(merged), 1)
        self.assertEqual(merged[0].title, "First")
        self.assertEqual(merged[0].snippet, "s1")
        self.assertEqual(merged[0].query, "q1")


if __name__ == "__main__":
    unittest.main()
