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
#  See the License for the specific language governing permissions and limitations under the License.
#

from __future__ import annotations

import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
POST_MERGE = ROOT / "scripts" / "tbox_post_upstream_merge.sh"
RUNBOOK = ROOT / "docs" / "TBOX_DEPLOY_RUNBOOK.md"


class TestPostUpstreamMerge(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.post_merge_text = POST_MERGE.read_text(encoding="utf-8")
        cls.runbook_text = RUNBOOK.read_text(encoding="utf-8")

    def test_post_merge_prints_phase16_17_chain(self) -> None:
        self.assertIn("tbox_phase16_17_handtest.sh", self.post_merge_text)
        self.assertIn("/review/step/phase16-17", self.post_merge_text)
        self.assertIn("tbox_phase16_17_finish.sh --archive", self.post_merge_text)
        self.assertIn("tbox_print_release_next_steps.sh", self.post_merge_text)
        self.assertIn("TBOX_SMOKE_SCRIPTS.md", self.post_merge_text)

    def test_runbook_section81_cross_links_smoke_docs(self) -> None:
        section = self.runbook_text.split("### 8.1", 1)[1].split("\n---\n", 1)[0]
        self.assertIn("TBOX_SMOKE_SCRIPTS.md", section)
        self.assertIn("TBOX_SMOKE_ENV.md", section)
        self.assertIn("/review/step/phase16-17", section)
        self.assertIn("tbox_print_release_next_steps.sh", section)


if __name__ == "__main__":
    unittest.main()
