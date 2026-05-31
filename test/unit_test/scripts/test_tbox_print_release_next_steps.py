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
HELPER = ROOT / "scripts" / "tbox_print_release_next_steps.sh"
CALLERS = (
    ROOT / "scripts" / "tbox-up.sh",
    ROOT / "scripts" / "start-tbox-ragflow.sh",
    ROOT / "scripts" / "deploy-on-new-server.sh",
)


class TestPrintReleaseNextSteps(unittest.TestCase):
    def _run(self, *args: str) -> subprocess.CompletedProcess[str]:
        return subprocess.run(
            ["bash", str(HELPER), *args],
            cwd=ROOT,
            capture_output=True,
            text=True,
            check=False,
        )

    def test_helper_exits_zero_and_prints_pre_release_chain(self) -> None:
        proc = self._run()
        self.assertEqual(proc.returncode, 0, proc.stderr)
        out = proc.stdout
        self.assertIn("tbox_pre_release.sh", out)
        self.assertIn("tbox_setup_smoke_env.sh", out)
        self.assertIn("tbox_phase16_17_handtest.sh", out)
        self.assertIn("tbox_pre_release.sh --help", out)
        self.assertIn("tbox_host_check.sh", out)
        self.assertIn("TBOX_ENV_AND_VERSIONS.md", out)
        self.assertIn("TBOX_UI_ACCEPTANCE_WALKTHROUGH.md", out)
        self.assertIn("step D", out)
        self.assertIn("TBOX_SMOKE_SCRIPTS.md", out)
        self.assertIn("TBOX_SMOKE_ENV.md", out)
        self.assertIn("tbox_post_upstream_merge.sh", out)

    def test_with_compose_hint_includes_compose_up(self) -> None:
        proc = self._run("--with-compose-hint")
        self.assertEqual(proc.returncode, 0, proc.stderr)
        self.assertIn("TBOX_CONSOLE=1 bash docker/tbox-compose-up.sh", proc.stdout)

    def test_prefix_env_is_reflected(self) -> None:
        proc = subprocess.run(
            ["bash", str(HELPER)],
            cwd=ROOT,
            capture_output=True,
            text=True,
            check=False,
            env={
                **dict(__import__("os").environ),
                "TBOX_RELEASE_STEPS_PREFIX": "[test-prefix]",
            },
        )
        self.assertEqual(proc.returncode, 0, proc.stderr)
        self.assertIn("[test-prefix] Quasi-production", proc.stdout)

    def test_three_startup_scripts_invoke_helper(self) -> None:
        for path in CALLERS:
            text = path.read_text(encoding="utf-8")
            self.assertIn("tbox_print_release_next_steps.sh", text, msg=str(path))


if __name__ == "__main__":
    unittest.main()
