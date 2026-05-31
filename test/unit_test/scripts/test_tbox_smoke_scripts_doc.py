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

import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
SMOKE_SCRIPTS = ROOT / "docs" / "TBOX_SMOKE_SCRIPTS.md"
WALKTHROUGH = ROOT / "docs" / "TBOX_UI_ACCEPTANCE_WALKTHROUGH.md"


class TestSmokeScriptsDoc(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.smoke_text = SMOKE_SCRIPTS.read_text(encoding="utf-8")
        cls.walk_text = WALKTHROUGH.read_text(encoding="utf-8")

    def test_smoke_scripts_has_phase16_17_section(self) -> None:
        self.assertIn("## Phase 16–17 浏览器手测（5180）", self.smoke_text)
        self.assertIn("tbox_phase16_17_handtest.sh", self.smoke_text)
        self.assertIn("/review/step/phase16-17", self.smoke_text)
        self.assertIn("tbox_print_release_next_steps.sh", self.smoke_text)
        self.assertIn("phase49-plan.md", self.smoke_text)

    def test_walkthrough_section21_aligns_with_vm_wording(self) -> None:
        self.assertIn("handtest` → 浏览器 **C §7 + D**", self.walk_text)
        self.assertIn("/review/step/phase16-17", self.walk_text)
        self.assertIn("TBOX_SMOKE_SCRIPTS.md", self.walk_text)


if __name__ == "__main__":
    unittest.main()
