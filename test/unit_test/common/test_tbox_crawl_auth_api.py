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
#  See the License for the License governing permissions and
#  limitations under the License.
#

from __future__ import annotations

import json
import os
import unittest

from common.tbox_crawl_auth import (
    EXTRA_CRAWL_AUTH_PROFILE,
    build_fetch_headers,
    profile_env_suffix,
    resolve_auth_headers,
    validate_extra_config_no_secrets,
)
from common.tbox_crawl_api import (
    EXTRA_CRAWL_API_ITEMS_PATH,
    api_item_to_document,
    extract_api_items,
    parse_api_config,
)


class TestCrawlAuth(unittest.TestCase):
    def test_profile_env_suffix(self):
        self.assertEqual(profile_env_suffix("intranet"), "INTRANET")
        self.assertEqual(profile_env_suffix("my-site.v2"), "MY_SITE_V2")

    def test_resolve_headers_from_env(self):
        key = "TBOX_CRAWL_AUTH_DEMO_HEADERS"
        old = os.environ.pop(key, None)
        try:
            os.environ[key] = json.dumps({"Authorization": "Bearer secret", "X-Custom": "1"})
            headers = resolve_auth_headers({EXTRA_CRAWL_AUTH_PROFILE: "demo"})
            self.assertEqual(headers["Authorization"], "Bearer secret")
            self.assertEqual(headers["X-Custom"], "1")
        finally:
            if old is None:
                os.environ.pop(key, None)
            else:
                os.environ[key] = old

    def test_build_fetch_headers_merges_ua(self):
        headers = build_fetch_headers(None, default_user_agent="TboxBot/1.0")
        self.assertEqual(headers["User-Agent"], "TboxBot/1.0")

    def test_rejects_secret_keys_in_extra(self):
        err = validate_extra_config_no_secrets({"tbox_crawl_auth_token": "x"})
        self.assertIsNotNone(err)
        self.assertIn("must not contain", err or "")

    def test_allows_profile_only(self):
        self.assertIsNone(validate_extra_config_no_secrets({EXTRA_CRAWL_AUTH_PROFILE: "intranet"}))


class TestCrawlApi(unittest.TestCase):
    def test_root_array(self):
        body = json.dumps([{"id": "1", "title": "A", "body": "text"}]).encode()
        cfg = parse_api_config({})
        items = extract_api_items(body, cfg)
        self.assertEqual(len(items), 1)
        text, name = api_item_to_document(items[0], cfg)
        self.assertIn("text", text)
        self.assertEqual(name, "1")

    def test_nested_items_path(self):
        payload = {"data": {"items": [{"title": "Hello"}]}}
        body = json.dumps(payload).encode()
        cfg = parse_api_config({EXTRA_CRAWL_API_ITEMS_PATH: "data.items"})
        items = extract_api_items(body, cfg)
        self.assertEqual(len(items), 1)
        text, _ = api_item_to_document(items[0], cfg)
        self.assertIn("Hello", text)


if __name__ == "__main__":
    unittest.main()
