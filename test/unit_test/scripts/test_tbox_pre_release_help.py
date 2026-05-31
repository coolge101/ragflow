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

import subprocess
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
PRE_RELEASE = ROOT / "scripts" / "tbox_pre_release.sh"
SMOKE_ENV = ROOT / "docs" / "TBOX_SMOKE_ENV.md"


class TestPreReleaseHelp(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        proc = subprocess.run(
            ["bash", str(PRE_RELEASE), "--help"],
            cwd=ROOT,
            capture_output=True,
            text=True,
            check=False,
        )
        if proc.returncode != 0:
            raise AssertionError(proc.stderr)
        cls.help_text = proc.stdout

    def test_help_documents_phase16_17_three_step_chain(self) -> None:
        self.assertIn("tbox_phase16_17_handtest.sh", self.help_text)
        self.assertIn("/review/step/phase16-17", self.help_text)
        self.assertIn("tbox_phase16_17_finish.sh --archive", self.help_text)
        self.assertIn("tbox_print_release_next_steps.sh", self.help_text)

    def test_help_cross_refs_host_check_and_walkthrough_step_d(self) -> None:
        self.assertIn("tbox_host_check.sh", self.help_text)
        self.assertIn("TBOX_ENV_AND_VERSIONS.md", self.help_text)
        self.assertIn("TBOX_UI_ACCEPTANCE_WALKTHROUGH.md", self.help_text)
        self.assertIn("step D", self.help_text)

    def test_smoke_env_has_phase16_17_section(self) -> None:
        text = SMOKE_ENV.read_text(encoding="utf-8")
        self.assertIn("## Phase 16–17 浏览器手测（5180）", text)
        self.assertIn("TBOX_SMOKE_SCRIPTS.md", text)


if __name__ == "__main__":
    unittest.main()
