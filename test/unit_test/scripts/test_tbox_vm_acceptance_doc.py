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
VM_ACCEPTANCE = ROOT / "docs" / "TBOX_VM_PRODUCTION_ACCEPTANCE.md"


class TestVmAcceptanceSection5(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        text = VM_ACCEPTANCE.read_text(encoding="utf-8")
        cls.section5 = text.split("## 5. 记录模板", 1)[1].split("## 6.", 1)[0]

    def test_section5_aligns_with_smoke_scripts_phase16_17(self) -> None:
        self.assertIn("步骤 D", self.section5)
        self.assertIn("5180 准生产前置", self.section5)
        self.assertIn("TBOX_SMOKE_SCRIPTS.md", self.section5)
        self.assertIn("TBOX_SMOKE_ENV.md", self.section5)
        self.assertIn("§1.3", self.section5)
        self.assertIn("tbox_phase16_17_handtest.sh", self.section5)


if __name__ == "__main__":
    unittest.main()
