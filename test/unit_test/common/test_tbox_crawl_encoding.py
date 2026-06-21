import unittest

from common.tbox_crawl_encoding import decode_response_body, encoding_from_content_type, mime_from_content_type
from common.tbox_crawl_extract import extract_main_text


class TestCrawlEncoding(unittest.TestCase):
    def test_encoding_from_content_type(self):
        self.assertEqual(encoding_from_content_type("text/html; charset=gbk"), "gb18030")

    def test_mime_from_content_type(self):
        self.assertEqual(mime_from_content_type("text/html; charset=gbk"), "text/html")

    def test_decode_gbk_body(self):
        cn = "车联网 TBOX 技术趋势白皮书".encode("gbk")
        html = b'<html><head><meta http-equiv="Content-Type" content="text/html; charset=gbk"></head><body><p>' + cn + b"</p></body></html>"
        text = decode_response_body(html, "text/html; charset=gbk")
        self.assertIn("车联网", text)
        self.assertIn("TBOX", text)

    def test_extract_main_text_gbk(self):
        cn = ("车联网 TBOX 技术趋势 " * 25).encode("gbk")
        html = b"<html><body><article><p>" + cn + b"</p></article></body></html>"
        text = extract_main_text(html, "text/html; charset=gb2312")
        self.assertGreaterEqual(len(text), 200)
        self.assertIn("车联网", text)

    def test_normalize_html_storage_utf8(self):
        from common.tbox_crawl_encoding import normalize_html_bytes_for_storage

        cn = "政策解读".encode("gbk")
        html = b"<html><head></head><body>" + cn + b"</body></html>"
        out = normalize_html_bytes_for_storage(html, "text/html; charset=gbk")
        self.assertIn(b'charset="utf-8"', out)
        self.assertIn("政策解读".encode("utf-8"), out)

    def test_normalize_html_replaces_legacy_charset_meta(self):
        from common.tbox_crawl_encoding import normalize_html_bytes_for_storage

        cn = "首页".encode("gbk")
        html = b'<html><head><meta http-equiv="Content-Type" content="text/html; charset=gbk"></head><body>' + cn + b"</body></html>"
        out = normalize_html_bytes_for_storage(html, "text/html; charset=gbk")
        self.assertIn(b'charset="utf-8"', out)
        self.assertNotIn(b"charset=gbk", out)
        self.assertIn("首页".encode("utf-8"), out)


if __name__ == "__main__":
    unittest.main()
