import unittest
from unittest.mock import MagicMock, patch

from api.db.services import tbox_crawl_health_service as health_svc


class TestCrawlHealthService(unittest.TestCase):
    @patch.object(health_svc, "TboxCrawlUrlHealth")
    def test_record_inserts_new_row(self, mock_model):
        mock_model.get_or_none.return_value = None
        mock_model.insert.return_value.execute = MagicMock()
        health_svc.record_url_outcome(
            tenant_id="t1",
            task_id="task1",
            url="https://example.com/a",
            outcome="ok",
            source="seed",
        )
        mock_model.insert.assert_called_once()

    @patch.object(health_svc, "TboxCrawlUrlHealth")
    def test_record_updates_fail_count(self, mock_model):
        row = MagicMock()
        row.id = "h1"
        row.success_count = 1
        row.fail_count = 1
        mock_model.get_or_none.return_value = row
        mock_model.update.return_value.where.return_value.execute = MagicMock()
        health_svc.record_url_outcome(
            tenant_id="t1",
            task_id="task1",
            url="https://example.com/a",
            outcome="robots",
            source="seed",
        )
        mock_model.update.assert_called_once()


if __name__ == "__main__":
    unittest.main()
