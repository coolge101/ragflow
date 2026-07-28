import unittest

from common.tbox_crawl_extract import extract_main_text, parse_min_extract_chars, suggested_txt_filename


class TestCrawlExtract(unittest.TestCase):
    def test_extract_returns_string(self):
        text = extract_main_text(b"<html><body><article><p>hello world</p></article></body></html>")
        self.assertIsInstance(text, str)

    def test_short_html_returns_small_text(self):
        text = extract_main_text(b"<html><body><p>hi</p></body></html>")
        self.assertLess(len(text), 200)

    def test_suggested_filename(self):
        name = suggested_txt_filename("https://example.com/news/2024/report.html")
        self.assertTrue(name.endswith(".txt"))
        self.assertIn("example.com", name)

    def test_fallback_extracts_tag_stripped_body(self):
        html = b"<html><head><title>TBOX</title></head><body><div>" + ("TBOX \u8f66\u8054\u7f51\u6280\u672f\u8d8b\u52bf " * 30).encode() + b"</div></body></html>"
        text = extract_main_text(html, "text/html; charset=utf-8")
        self.assertGreaterEqual(len(text), 200)
        self.assertIn("\u8f66\u8054\u7f51", text)

    def test_min_chars_default(self):
        self.assertEqual(parse_min_extract_chars({}), 200)


if __name__ == "__main__":
    unittest.main()
