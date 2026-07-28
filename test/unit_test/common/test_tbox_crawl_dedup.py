#
#  Copyright 2026 The InfiniFlow Authors. All Rights Reserved.
#

from __future__ import annotations

import unittest

from common.tbox_crawl_dedup import (
    canonicalize_url,
    content_sha256,
    filter_urls_not_seen,
    merge_url_lists,
)


class TestTboxCrawlDedup(unittest.TestCase):
    def test_canonicalize_strips_tracking_and_www(self):
        u = "https://www.example.com/path/?utm_source=x&b=2&a=1"
        canon = canonicalize_url(u)
        self.assertEqual(canon, "https://example.com/path?b=2&a=1")
        self.assertNotIn("utm_source", canon)
        self.assertTrue(canon.startswith("https://example.com/path"))

    def test_content_sha256_stable(self):
        body = b"hello"
        self.assertEqual(content_sha256(body), content_sha256(body))

    def test_merge_url_lists_preserves_order_dedupes(self):
        merged = merge_url_lists(
            ["https://a.com/1", "https://www.a.com/1"],
            ["https://b.com/2", "https://a.com/1"],
        )
        self.assertEqual(merged, ["https://a.com/1", "https://b.com/2"])

    def test_filter_urls_not_seen(self):
        seen = {"https://example.com/old"}

        def seen_fn(dataset_id: str, canon: str) -> bool:
            self.assertEqual(dataset_id, "ds1")
            return canon in seen

        kept, skipped = filter_urls_not_seen(
            "ds1",
            ["https://example.com/old", "https://example.com/new"],
            seen_fn=seen_fn,
        )
        self.assertEqual(skipped, 1)
        self.assertEqual(kept, ["https://example.com/new"])


if __name__ == "__main__":
    unittest.main()
