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
#  See the License for the specific language governing permissions and
#  limitations under the License.
#

from __future__ import annotations

import importlib.util
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
SCRIPT = ROOT / "scripts" / "tbox_console_bundle_smoke.py"


def _load_module():
    spec = importlib.util.spec_from_file_location("tbox_console_bundle_smoke", SCRIPT)
    assert spec and spec.loader
    mod = importlib.util.module_from_spec(spec)
    sys.modules["tbox_console_bundle_smoke"] = mod
    spec.loader.exec_module(mod)
    return mod


mod = _load_module()


class TestScriptUrls(unittest.TestCase):
    def test_relative_and_absolute(self):
        html = '<script src="/assets/index-abc.js"></script><script src="assets/other.js"></script>'
        urls = mod.script_urls(html, "http://127.0.0.1:5180")
        self.assertEqual(
            urls,
            [
                "http://127.0.0.1:5180/assets/index-abc.js",
                "http://127.0.0.1:5180/assets/other.js",
            ],
        )

    def test_external_passthrough(self):
        html = '<script src="https://cdn.example/app.js"></script>'
        self.assertEqual(
            mod.script_urls(html, "http://127.0.0.1:5180"),
            ["https://cdn.example/app.js"],
        )


class TestCheckBundle(unittest.TestCase):
    def test_all_markers_present(self):
        body = r'kind:"cite" scrollIntoView \[(?:ID:)? selectLabelPrefix:p="片段"'
        chk = mod.check_bundle("http://x/a.js", body)
        self.assertEqual(chk.markers_missing, [])
        self.assertEqual(len(chk.markers_found), len(mod.MARKERS))

    def test_partial_markers(self):
        body = "scrollIntoView only"
        chk = mod.check_bundle("http://x/a.js", body)
        self.assertIn("chunk_scroll", chk.markers_found)
        self.assertIn("citation_click", chk.markers_missing)

    def test_markers_merge_across_bundles(self):
        a = mod.check_bundle("http://x/a.js", 'kind:"cite"')
        b = mod.check_bundle("http://x/b.js", r'scrollIntoView \[(?:ID:)? selectLabelPrefix:p="片段"')
        combined = set(a.markers_found) | set(b.markers_found)
        still_missing = [name for name, _ in mod.MARKERS if name not in combined]
        self.assertEqual(still_missing, [])


if __name__ == "__main__":
    unittest.main()
