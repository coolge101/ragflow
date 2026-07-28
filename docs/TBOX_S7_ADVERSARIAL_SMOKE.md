# TBOX S7 对抗冒烟记录（Harness §7.6）

**目的**：发版前 **`test/adversarial_tests.py`** live 用例执行记录（非 PR 门禁）。
**矩阵 / Harness**：`G5-*` 质量域；**§7.6** 发版 checklist 步骤 3。

---

## 1. 执行命令

```bash
cd <REPO>
export PYTHONPATH=$(pwd)
export RAGFLOW_ADVERSARIAL_TESTS=1
# 可选：export RAGFLOW_ADVERSARIAL_URL=http://127.0.0.1:9380
uv run pytest test/adversarial_tests.py -v --tb=short
```

默认未设置 `RAGFLOW_ADVERSARIAL_TESTS` 时，带 `@pytest.mark.adversarial` 的 live 用例 **skip**（见 `docs/TBOX_ENV_AND_VERSIONS.md` §5）。

---

## 2. 记录模板

| 项 | 结果 | 备注 |
|----|------|------|
| 日期 | 2026-05-24 | |
| Git HEAD | `48c4b4695`（Phase 6） | |
| 环境 | 本地 Docker @ 9380 | |
| `test/adversarial_tests.py` | ✅ **4 passed** | `RAGFLOW_ADVERSARIAL_TESTS=1` |
| 归档 | 本文件 + CI 日志（可选） | |

**测试人**：Cursor Agent（API 环境 live 跑通）

---

## 3. 与发版冒烟关系

发版建议顺序（Harness §7.6）：

1. `bash scripts/tbox_release_smoke.sh`（health + G1 + G3）
2. 本文 S7 对抗（本文件 §1）
3. 可选：`harness_engineering` workflow 手动触发

---

## 4. 相关文档

- Harness §7.6：`docs/TBOX_KB_DELIVERY_HARNESS.md`
- Phase 7 plan：`docs/superpowers/plans/2026-05-24-tbox-phase7-plan.md`
- 环境变量：`docs/TBOX_ENV_AND_VERSIONS.md` §5
