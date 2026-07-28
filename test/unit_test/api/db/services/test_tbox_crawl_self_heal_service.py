import unittest
from unittest.mock import MagicMock, patch

from api.db.services import tbox_crawl_self_heal_service as self_heal_svc
from common.tbox_crawl_self_heal import SelfHealConfig, SeedHealPlan


class TestCrawlSelfHealService(unittest.TestCase):
    @patch.object(self_heal_svc, "_get_task_row")
    @patch.object(self_heal_svc, "_recent_self_heal", return_value=False)
    @patch.object(self_heal_svc, "_load_health_snapshots", return_value={})
    @patch.object(self_heal_svc, "_healthy_catalog_urls", return_value=[])
    @patch.object(self_heal_svc, "compute_seed_heal_plan")
    @patch.object(self_heal_svc, "apply_seed_heal_plan")
    @patch.object(self_heal_svc, "_write_audit")
    def test_run_self_heal_patches_seeds(
        self,
        mock_audit,
        mock_apply,
        mock_plan,
        mock_catalog,
        mock_health,
        mock_recent,
        mock_get_task,
    ):
        row = MagicMock()
        row.id = "task1"
        row.tenant_id = "t1"
        row.name = "技术趋势"
        row.extra_config = {}
        row.seed_urls = ["https://www.zhihu.com/"]
        row.created_by = "u1"
        mock_get_task.return_value = row

        mock_plan.return_value = SeedHealPlan(
            prune_urls=["https://www.zhihu.com/"],
            import_catalog=False,
            reasons=["prune bad seed"],
        )
        mock_apply.return_value = ["https://example.com/ok"]

        changed = self_heal_svc.run_self_heal("task1")
        self.assertTrue(changed)
        mock_audit.assert_called_once()
        row.save.assert_called_once()
        self.assertEqual(row.seed_urls, ["https://example.com/ok"])

    @patch.object(self_heal_svc, "_get_task_row", return_value=None)
    def test_run_self_heal_missing_task(self, _mock_get):
        self.assertFalse(self_heal_svc.run_self_heal("missing"))

    @patch.object(self_heal_svc, "parse_self_heal_config")
    @patch.object(self_heal_svc, "_get_task_row")
    def test_run_self_heal_disabled(self, mock_get_task, mock_parse):
        row = MagicMock()
        row.extra_config = {}
        mock_get_task.return_value = row
        mock_parse.return_value = SelfHealConfig(enabled=False)
        self.assertFalse(self_heal_svc.run_self_heal("task1"))


if __name__ == "__main__":
    unittest.main()
