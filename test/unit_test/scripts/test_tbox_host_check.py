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
HOST_CHECK = ROOT / "scripts" / "tbox_host_check.sh"
WALKTHROUGH = ROOT / "docs" / "TBOX_UI_ACCEPTANCE_WALKTHROUGH.md"
HARNESS = ROOT / "docs" / "TBOX_KB_DELIVERY_HARNESS.md"


class TestHostCheckScript(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.text = HOST_CHECK.read_text(encoding="utf-8")

    def test_prints_phase16_17_and_env_hints(self) -> None:
        self.assertIn("tbox_phase16_17_handtest.sh", self.text)
        self.assertIn("tbox_phase16_17_finish.sh --archive", self.text)
        self.assertIn("tbox_print_release_next_steps.sh", self.text)
        self.assertIn("TBOX_ENV_AND_VERSIONS.md", self.text)


class TestWalkthroughStepDHandtest(unittest.TestCase):
    def test_step_d_documents_handtest_prerequisite(self) -> None:
        text = WALKTHROUGH.read_text(encoding="utf-8")
        d_start = text.index("### 步骤 D：检索")
        d_end = text.index("### 步骤 E：文档")
        section = text[d_start:d_end]
        self.assertIn("tbox_phase16_17_handtest.sh", section)
        self.assertIn("5180 准生产前置", section)


class TestHarnessPhase55(unittest.TestCase):
    def test_harness_documents_phase55_and_milestone(self) -> None:
        text = HARNESS.read_text(encoding="utf-8")
        self.assertIn("Phase 55", text)
        self.assertIn("Phase 0–61", text)


if __name__ == "__main__":
    unittest.main()
