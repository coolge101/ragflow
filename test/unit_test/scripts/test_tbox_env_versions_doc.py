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
ENV_DOC = ROOT / "docs" / "TBOX_ENV_AND_VERSIONS.md"
WALKTHROUGH = ROOT / "docs" / "TBOX_UI_ACCEPTANCE_WALKTHROUGH.md"


class TestEnvVersionsDoc(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        text = ENV_DOC.read_text(encoding="utf-8")
        cls.section6 = text.split("## 6. PR 轻量 CI", 1)[1].split("## 7.", 1)[0]

    def test_section61_includes_scripts_unit_and_phase16_17(self) -> None:
        self.assertIn("### 6.1 本地对号", self.section6)
        self.assertIn("tbox_scripts_unit_check.sh", self.section6)
        self.assertIn("tbox_phase16_17_handtest.sh", self.section6)
        self.assertIn("tbox_print_release_next_steps.sh", self.section6)


class TestWalkthroughFeedbackSection(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        text = WALKTHROUGH.read_text(encoding="utf-8")
        cls.section6 = text.split("## 六、你执行完后怎么反馈", 1)[1].split("## 七、", 1)[0]

    def test_feedback_table_aligns_with_vm_section5(self) -> None:
        self.assertIn("handtest → review → finish", self.section6)
        self.assertIn("/review/step/phase16-17", self.section6)
        self.assertIn("tbox_phase16_17_finish.sh --archive", self.section6)


if __name__ == "__main__":
    unittest.main()
