#
#  Copyright 2025 The InfiniFlow Authors. All Rights Reserved.
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

import json

import pytest

import common.harness_monitor as harness_monitor
from common.harness_monitor import (
    DecisionOutcome,
    HarnessMonitor,
    SecurityEventType,
    get_global_monitor,
    record_metrics,
    record_security_event,
    track_decision,
)


@pytest.fixture(autouse=True)
def _reset_global_monitor():
    harness_monitor._global_monitor = None
    yield
    harness_monitor._global_monitor = None


class TestHarnessMonitor:
    def test_monitor_initialization(self):
        monitor = HarnessMonitor()
        assert monitor is not None
        assert len(monitor.decision_traces) == 0
        assert len(monitor.security_events) == 0
        assert len(monitor.performance_metrics) == 0

    def test_track_decision(self):
        monitor = HarnessMonitor()

        decision_id = monitor.track_decision(
            component="test_component",
            input_data={"query": "test query"},
            reasoning_chain=[{"step": "analyze", "result": "safe"}],
            constraints_applied=["no_harmful_content"],
            outcome=DecisionOutcome.ALLOWED,
            confidence_score=0.95,
        )

        assert decision_id is not None
        assert len(monitor.decision_traces) == 1

        trace = monitor.get_decision_trace(decision_id)
        assert trace is not None
        assert trace.component == "test_component"
        assert trace.outcome == DecisionOutcome.ALLOWED
        assert trace.confidence_score == 0.95

    def test_record_security_event(self):
        monitor = HarnessMonitor()

        event_id = monitor.record_security_event(
            event_type=SecurityEventType.PROMPT_INJECTION,
            severity="high",
            component="api_gateway",
            description="Detected prompt injection attempt",
            details={"payload": "ignore previous instructions"},
            action_taken="blocked_request",
        )

        assert event_id is not None
        assert len(monitor.security_events) == 1

        events = monitor.get_security_events(event_type=SecurityEventType.PROMPT_INJECTION, severity="high")
        assert len(events) == 1
        assert events[0].description == "Detected prompt injection attempt"

    def test_record_metrics(self):
        monitor = HarnessMonitor()

        metric_id = monitor.record_metrics(
            component="llm_service",
            response_time_ms=150.5,
            throughput_rps=10.2,
            error_rate=0.01,
            resource_usage={"cpu_percent": 45.5, "memory_percent": 60.2},
        )

        assert metric_id is not None
        assert len(monitor.performance_metrics) == 1

        metrics = monitor.get_performance_metrics(component="llm_service")
        assert len(metrics) == 1
        assert metrics[0].response_time_ms == 150.5
        assert metrics[0].error_rate == 0.01

    def test_global_monitor(self):
        monitor1 = get_global_monitor()
        monitor2 = get_global_monitor()
        assert monitor1 is monitor2

    def test_convenience_functions(self):
        decision_id = track_decision(
            component="test_func",
            input_data={"test": "data"},
            reasoning_chain=[{"test": "chain"}],
            constraints_applied=["constraint1"],
            outcome=DecisionOutcome.ALLOWED,
        )

        event_id = record_security_event(
            event_type=SecurityEventType.CONTENT_VIOLATION,
            severity="medium",
            component="test_func",
            description="Test event",
            details={"test": "details"},
            action_taken="logged",
        )

        metric_id = record_metrics(
            component="test_func",
            response_time_ms=100.0,
            throughput_rps=5.0,
            error_rate=0.05,
            resource_usage={"cpu": 50.0},
        )

        assert decision_id is not None
        assert event_id is not None
        assert metric_id is not None

    def test_report_generation(self):
        monitor = HarnessMonitor()

        for i in range(5):
            monitor.track_decision(
                component=f"component_{i}",
                input_data={"test": i},
                reasoning_chain=[{"step": i}],
                constraints_applied=[f"constraint_{i}"],
                outcome=DecisionOutcome.ALLOWED if i % 2 == 0 else DecisionOutcome.BLOCKED,
                confidence_score=0.9,
            )

        report = monitor.generate_report(time_range_minutes=60)

        assert report is not None
        assert "decision_stats" in report
        assert "event_stats" in report
        assert "metric_stats" in report
        assert "summary" in report

        assert report["decision_stats"]["total"] == 5

    def test_export_data(self):
        monitor = HarnessMonitor()

        monitor.track_decision(
            component="export_test",
            input_data={"test": "export"},
            reasoning_chain=[{"step": "export"}],
            constraints_applied=["export_constraint"],
            outcome=DecisionOutcome.ALLOWED,
        )

        json_data = monitor.export_data(data_type="decisions", format="json")
        data = json.loads(json_data)

        assert isinstance(data, list)
        assert len(data) == 1
        assert data[0]["component"] == "export_test"

    def test_resolve_security_event(self):
        monitor = HarnessMonitor()

        event_id = monitor.record_security_event(
            event_type=SecurityEventType.SYSTEM_ERROR,
            severity="critical",
            component="test",
            description="Test error",
            details={"error": "test"},
            action_taken="investigating",
        )

        events = monitor.get_security_events(resolved=False)
        assert len(events) == 1
        assert not events[0].resolved

        result = monitor.resolve_security_event(event_id, "Fixed the issue")
        assert result is True

        events = monitor.get_security_events(resolved=True)
        assert len(events) == 1
        assert events[0].resolved
        assert events[0].resolution_time is not None
