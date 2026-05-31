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
PREFLIGHT = ROOT / "scripts" / "tbox_s6_preflight.sh"
DEPLOY_GH = ROOT / "docs" / "TBOX_DEPLOY_FROM_GITHUB.md"


class TestS6Preflight(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.preflight_text = PREFLIGHT.read_text(encoding="utf-8")
        cls.deploy_gh_text = DEPLOY_GH.read_text(encoding="utf-8")

    def test_s6_preflight_post_merge_chain(self) -> None:
        self.assertIn("tbox_post_upstream_merge.sh", self.preflight_text)
        self.assertIn("tbox_phase16_17_handtest.sh", self.preflight_text)
        self.assertIn("tbox_phase16_17_finish.sh --archive", self.preflight_text)
        self.assertIn("tbox_print_release_next_steps.sh", self.preflight_text)
        self.assertIn("TBOX_UPSTREAM_MERGE_RUNBOOK.md", self.preflight_text)
        self.assertIn("TBOX_DEPLOY_FROM_GITHUB.md", self.preflight_text)
        self.assertIn("§1.3", self.preflight_text)
        self.assertIn("§8.1", self.preflight_text)

    def test_deploy_from_github_section6_s6_chain(self) -> None:
        section = self.deploy_gh_text.split("## 6. 验收", 1)[1].split("## 7.", 1)[0]
        self.assertIn("tbox_s6_preflight.sh", section)
        self.assertIn("tbox_post_upstream_merge.sh", section)
        self.assertIn("tbox_phase16_17_handtest.sh", section)
        self.assertIn("TBOX_UPSTREAM_MERGE_RUNBOOK.md", section)

    def test_deploy_from_github_section8_upstream_merge(self) -> None:
        section = self.deploy_gh_text.split("## 8. 日常更新", 1)[1].split("## 9.", 1)[0]
        self.assertIn("tbox_s6_preflight.sh", section)
        self.assertIn("tbox_post_upstream_merge.sh", section)
        self.assertIn("tbox_phase16_17_finish.sh --archive", section)


if __name__ == "__main__":
    unittest.main()
