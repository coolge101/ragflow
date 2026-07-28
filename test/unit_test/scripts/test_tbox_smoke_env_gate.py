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

import os
import subprocess
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
GATE = ROOT / "scripts" / "tbox_require_dual_account_gate.sh"
ENV_FILE = ROOT / "scripts" / "tbox_smoke.env"


class TestDualAccountGate(unittest.TestCase):
    def setUp(self) -> None:
        self._backup: str | None = None
        if ENV_FILE.exists():
            self._backup = ENV_FILE.read_text(encoding="utf-8")

    def tearDown(self) -> None:
        if self._backup is not None:
            ENV_FILE.write_text(self._backup, encoding="utf-8")
        elif ENV_FILE.exists():
            ENV_FILE.unlink()

    def _run_gate(self, *, require_dual: bool) -> int:
        env = os.environ.copy()
        if require_dual:
            env["TBOX_REQUIRE_DUAL_ACCOUNT"] = "1"
        else:
            env.pop("TBOX_REQUIRE_DUAL_ACCOUNT", None)
        proc = subprocess.run(
            ["bash", str(GATE)],
            cwd=ROOT,
            env=env,
            capture_output=True,
            text=True,
        )
        return proc.returncode

    def test_optional_mode_passes_without_env(self) -> None:
        if ENV_FILE.exists():
            ENV_FILE.unlink()
        self.assertEqual(self._run_gate(require_dual=False), 0)

    def test_required_fails_without_dual_env(self) -> None:
        if ENV_FILE.exists():
            ENV_FILE.unlink()
        self.assertEqual(self._run_gate(require_dual=True), 1)

    def test_required_fails_on_partial_dual_env(self) -> None:
        ENV_FILE.write_text("TBOX_SMOKE_NORMAL_EMAIL=only@example.com\n", encoding="utf-8")
        self.assertEqual(self._run_gate(require_dual=True), 1)

    def test_required_passes_with_full_dual_env(self) -> None:
        ENV_FILE.write_text(
            "TBOX_SMOKE_NORMAL_EMAIL=user@example.com\nTBOX_SMOKE_NORMAL_PASSWORD=secret\n",
            encoding="utf-8",
        )
        self.assertEqual(self._run_gate(require_dual=True), 0)


if __name__ == "__main__":
    unittest.main()
