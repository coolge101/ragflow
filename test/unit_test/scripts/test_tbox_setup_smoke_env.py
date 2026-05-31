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
SETUP = ROOT / "scripts" / "tbox_setup_smoke_env.sh"
ENV_FILE = ROOT / "scripts" / "tbox_smoke.env"
EXAMPLE = ROOT / "scripts" / "tbox_smoke.env.example"


class TestSetupSmokeEnv(unittest.TestCase):
    def setUp(self) -> None:
        self._backup: str | None = None
        if ENV_FILE.exists():
            self._backup = ENV_FILE.read_text(encoding="utf-8")

    def tearDown(self) -> None:
        if self._backup is not None:
            ENV_FILE.write_text(self._backup, encoding="utf-8")
        elif ENV_FILE.exists():
            ENV_FILE.unlink()

    def _run(self, *args: str) -> subprocess.CompletedProcess[str]:
        return subprocess.run(
            ["bash", str(SETUP), *args],
            cwd=ROOT,
            capture_output=True,
            text=True,
            check=False,
        )

    def test_check_only_prints_pre_release_and_helper(self) -> None:
        ENV_FILE.write_text(EXAMPLE.read_text(encoding="utf-8"), encoding="utf-8")
        proc = self._run("--check-only")
        self.assertEqual(proc.returncode, 0, proc.stderr)
        out = proc.stdout
        self.assertIn("tbox_pre_release.sh", out)
        self.assertIn("tbox_print_release_next_steps.sh", out)

    def test_created_env_prints_helper_on_first_run(self) -> None:
        if ENV_FILE.exists():
            ENV_FILE.unlink()
        proc = self._run()
        self.assertEqual(proc.returncode, 0, proc.stderr)
        self.assertTrue(ENV_FILE.exists())
        self.assertIn("tbox_print_release_next_steps.sh", proc.stdout)


if __name__ == "__main__":
    unittest.main()
