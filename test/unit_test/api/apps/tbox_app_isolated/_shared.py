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


class MutableTboxRouteUser:
    """Bound to ``api.apps.current_user`` before ``tbox_app`` loads; mutate fields per test."""

    def reset(self) -> None:
        self.id = "tbox-route-test-user"
        self.is_superuser = True
        self.email = "route-tester@example.invalid"
        self.nickname = "RouteTester"
        self.access_token = "access-token-intact"
        self.save_calls = 0

    def __init__(self) -> None:
        self.reset()

    def save(self) -> None:
        self.save_calls += 1


TBOX_ROUTE_TEST_USER = MutableTboxRouteUser()


def crawl_allowed_sets():
    return (
        frozenset({"static_web", "rss"}),
        frozenset({"draft", "ready", "paused"}),
    )
