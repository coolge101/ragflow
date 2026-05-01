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
from unittest.mock import patch

from common.tbox_crawl_origin_throttle import OriginFetchThrottler


class _FakeRobots:
    def __init__(self, cd: float, net_mono: float):
        self._cd = cd
        self._net = net_mono

    def crawl_delay_seconds(self, url: str) -> float:
        return self._cd

    def last_robots_network_mono(self, key: tuple[str, str]) -> float:
        return self._net


class TestOriginFetchThrottler(unittest.TestCase):
    def test_min_interval_only_second_hop(self):
        clock = [0.0]
        sleeps: list[float] = []

        def mono() -> float:
            return clock[0]

        def sleep_s(d: float) -> None:
            sleeps.append(d)
            clock[0] += d

        with patch("common.tbox_crawl_origin_throttle.time.monotonic", mono):
            with patch("common.tbox_crawl_origin_throttle.time.sleep", sleep_s):
                t = OriginFetchThrottler(None, min_interval_sec=1.5, max_crawl_delay_sec=60.0, skip_crawl_delay=True)
                t.wait_before_hop("https://example.com/a")
                self.assertEqual(sleeps, [])

                clock[0] = 0.5
                t.record_hop_finished("https://example.com/a")
                t.wait_before_hop("https://example.com/b")
                self.assertEqual(len(sleeps), 1)
                self.assertAlmostEqual(sleeps[0], 1.5)

    def test_robots_crawl_delay_after_robots_fetch(self):
        clock = [100.0]
        sleeps: list[float] = []

        def mono() -> float:
            return clock[0]

        def sleep_s(d: float) -> None:
            sleeps.append(d)
            clock[0] += d

        with patch("common.tbox_crawl_origin_throttle.time.monotonic", mono):
            with patch("common.tbox_crawl_origin_throttle.time.sleep", sleep_s):
                robots = _FakeRobots(cd=2.0, net_mono=100.0)
                t = OriginFetchThrottler(robots, min_interval_sec=0.0, max_crawl_delay_sec=60.0, skip_crawl_delay=False)
                t.wait_before_hop("https://example.org/")
                self.assertEqual(len(sleeps), 1)
                self.assertAlmostEqual(sleeps[0], 2.0)


if __name__ == "__main__":
    unittest.main()
