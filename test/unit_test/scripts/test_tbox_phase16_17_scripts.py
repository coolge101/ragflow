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

import subprocess
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
HANDTEST = ROOT / "scripts" / "tbox_phase16_17_handtest.sh"
FINISH = ROOT / "scripts" / "tbox_phase16_17_finish.sh"
ARCHIVE = ROOT / "scripts" / "tbox_archive_phase16_17_handtest.sh"


class TestPhase1617Scripts(unittest.TestCase):
    def test_handtest_documents_review_and_helper(self) -> None:
        text = HANDTEST.read_text(encoding="utf-8")
        self.assertIn("/review/step/phase16-17", text)
        self.assertIn("tbox_phase16_17_finish.sh --archive", text)
        self.assertIn("tbox_print_release_next_steps.sh", text)
        self.assertIn("TBOX_SYSTEM_USER_MANUAL.md", text)
        self.assertIn("tbox_pre_release.sh --help", text)
        self.assertIn("step D", text)

    def test_finish_bash_syntax(self) -> None:
        subprocess.run(["bash", "-n", str(FINISH)], check=True)

    def test_finish_without_archive_hint(self) -> None:
        text = FINISH.read_text(encoding="utf-8")
        self.assertIn("--archive", text)
        self.assertIn("tbox_print_release_next_steps.sh", text)

    def test_archive_prints_helper_on_success(self) -> None:
        text = ARCHIVE.read_text(encoding="utf-8")
        self.assertIn("tbox_print_release_next_steps.sh", text)


if __name__ == "__main__":
    unittest.main()
