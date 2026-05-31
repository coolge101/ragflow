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
QUICKSTART = ROOT / "docs" / "TBOX_QUICKSTART.md"


class TestQuickstartDoc(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        text = QUICKSTART.read_text(encoding="utf-8")
        cls.section13 = text.split("### 1.3", 1)[1].split("## 2.", 1)[0]
        cls.section6 = text.split("## 6. PR 前自检", 1)[1].split("## ", 1)[0]

    def test_section13_aligns_with_print_release_helper(self) -> None:
        self.assertIn("tbox_print_release_next_steps.sh", self.section13)
        self.assertIn("tbox_phase16_17_handtest.sh", self.section13)
        self.assertIn("步骤 D", self.section13)
        self.assertIn("tbox_host_check.sh", self.section13)
        self.assertIn("TBOX_SYSTEM_USER_MANUAL.md", self.section13)

    def test_section6_includes_phase16_17_and_helper(self) -> None:
        self.assertIn("tbox_print_release_next_steps.sh", self.section6)
        self.assertIn("tbox_phase16_17_handtest.sh", self.section6)
        self.assertIn("tbox_phase16_17_finish.sh --archive", self.section6)
        self.assertIn("TBOX_UPSTREAM_MERGE_RUNBOOK.md", self.section6)


if __name__ == "__main__":
    unittest.main()
