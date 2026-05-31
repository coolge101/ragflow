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
README = ROOT / "web-tbox" / "README.md"
MANUAL = ROOT / "docs" / "TBOX_SYSTEM_USER_MANUAL.md"


class TestWebTboxReadmeDoc(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.readme = README.read_text(encoding="utf-8")

    def test_readme_pr_section_aligns_with_env_section61(self) -> None:
        self.assertIn("TBOX_ENV_AND_VERSIONS.md` §6.1", self.readme)
        self.assertIn("tbox_scripts_unit_check.sh", self.readme)
        self.assertIn("tbox_phase16_17_handtest.sh", self.readme)
        self.assertIn("tbox_print_release_next_steps.sh", self.readme)

    def test_readme_documents_walkthrough_step_d_handtest(self) -> None:
        self.assertIn("步骤 D", self.readme)
        self.assertIn("5180 准生产前置", self.readme)
        self.assertIn("C §7 + D", self.readme)


class TestSystemManualSection54(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        text = MANUAL.read_text(encoding="utf-8")
        cls.section54 = text.split("### 5.4", 1)[1].split("### 5.", 1)[0]

    def test_section54_cross_refs_env_and_three_step_chain(self) -> None:
        self.assertIn("TBOX_ENV_AND_VERSIONS.md", self.section54)
        self.assertIn("handtest", self.section54)
        self.assertIn("/review/step/phase16-17", self.section54)
        self.assertIn("finish --archive", self.section54)

    def test_section54_aligns_with_readme_step_d_handtest(self) -> None:
        self.assertIn("步骤 D", self.section54)
        self.assertIn("5180 准生产前置", self.section54)
        self.assertIn("C §7", self.section54)
        self.assertIn("pre_release --help", self.section54)


if __name__ == "__main__":
    unittest.main()
