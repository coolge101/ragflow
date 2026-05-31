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
EXAMPLE = ROOT / "scripts" / "tbox_smoke.env.example"


class TestSmokeEnvExample(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.text = EXAMPLE.read_text(encoding="utf-8")

    def test_documents_pre_release_matrix(self) -> None:
        self.assertIn("tbox_pre_release.sh --help", self.text)
        self.assertIn("TBOX_PRE_RELEASE_VM", self.text)
        self.assertIn("TBOX_REQUIRE_DUAL_ACCOUNT", self.text)

    def test_documents_phase16_17_chain(self) -> None:
        self.assertIn("tbox_phase16_17_handtest.sh", self.text)
        self.assertIn("tbox_phase16_17_finish.sh --archive", self.text)
        self.assertIn("/review/step/phase16-17", self.text)
        self.assertIn("tbox_print_release_next_steps.sh", self.text)


if __name__ == "__main__":
    unittest.main()
