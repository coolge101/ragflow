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

import ipaddress
import socket
import unittest
from unittest.mock import patch

from common.ssrf_guard import (
    _effective_ip,
    assert_url_is_safe,
    pin_dns,
    pin_dns_global,
)


class TestEffectiveIp(unittest.TestCase):
    def test_ipv4_mapped_loopback_normalizes(self):
        raw = ipaddress.ip_address("::ffff:127.0.0.1")
        eff = _effective_ip(raw)
        self.assertEqual(eff, ipaddress.ip_address("127.0.0.1"))

    def test_plain_v4_unchanged(self):
        raw = ipaddress.ip_address("8.8.8.8")
        self.assertIs(_effective_ip(raw), raw)


class TestPinDns(unittest.TestCase):
    def test_thread_local_pin_routes_getaddrinfo(self):
        with pin_dns("tbox-ssrf-pin-thread.example", "1.1.1.1"):
            infos = socket.getaddrinfo("tbox-ssrf-pin-thread.example", 443, type=socket.SOCK_STREAM)
            self.assertEqual(infos[0][4][0], "1.1.1.1")

    def test_global_pin_routes_getaddrinfo(self):
        with pin_dns_global("tbox-ssrf-pin-global.example", "1.0.0.1"):
            infos = socket.getaddrinfo("tbox-ssrf-pin-global.example", 443, type=socket.SOCK_STREAM)
            self.assertEqual(infos[0][4][0], "1.0.0.1")


class TestAssertUrlIsSafe(unittest.TestCase):
    def test_disallowed_scheme(self):
        with self.assertRaisesRegex(ValueError, "scheme"):
            assert_url_is_safe("file:///etc/passwd")

    def test_missing_host(self):
        with self.assertRaisesRegex(ValueError, "host"):
            assert_url_is_safe("https:///")

    @patch(
        "common.ssrf_guard._orig_getaddrinfo",
        return_value=[(socket.AF_INET, socket.SOCK_STREAM, socket.IPPROTO_TCP, "", ("8.8.8.8", 443))],
    )
    def test_public_resolution_ok(self, _mock_gai):
        host, ip = assert_url_is_safe("https://resolver-check.example/path")
        self.assertEqual(host, "resolver-check.example")
        self.assertEqual(ip, "8.8.8.8")

    @patch(
        "common.ssrf_guard._orig_getaddrinfo",
        return_value=[(socket.AF_INET, socket.SOCK_STREAM, socket.IPPROTO_TCP, "", ("127.0.0.1", 443))],
    )
    def test_loopback_blocked(self, _mock_gai):
        with self.assertRaisesRegex(ValueError, "non-public"):
            assert_url_is_safe("https://loopback-block.example/")
