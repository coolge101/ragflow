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
WEB_TBOX_CHECK = ROOT / "scripts" / "tbox_web_tbox_check.sh"
HARNESS = ROOT / "docs" / "TBOX_KB_DELIVERY_HARNESS.md"


class TestWebTboxCheckScript(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.text = WEB_TBOX_CHECK.read_text(encoding="utf-8")

    def test_prints_phase16_17_and_env_hints(self) -> None:
        self.assertIn("tbox_phase16_17_handtest.sh", self.text)
        self.assertIn("tbox_phase16_17_finish.sh --archive", self.text)
        self.assertIn("tbox_print_release_next_steps.sh", self.text)
        self.assertIn("TBOX_ENV_AND_VERSIONS.md", self.text)


class TestHarnessPhase5462Summary(unittest.TestCase):
    def test_harness_documents_phase54_62_summary(self) -> None:
        text = HARNESS.read_text(encoding="utf-8")
        self.assertIn("Phase 51–53", text)
        self.assertIn("Phase 54–62", text)
        self.assertIn("Phase 63", text)
        self.assertIn("Phase 64", text)
        self.assertIn("Phase 65", text)
        self.assertIn("Phase 66", text)
        self.assertIn("Phase 0–66", text)


if __name__ == "__main__":
    unittest.main()
