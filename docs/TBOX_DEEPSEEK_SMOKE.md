# TBOX DeepSeek 对话冒烟（G3-MODEL-DEEPSEEK）

**目的**：验证 G3「DeepSeek 优先」在 API 层的 health → 模型列表 → 流式/非流式对话链路。
**矩阵 ID**：`G3-MODEL-DEEPSEEK`
**UI 手测**：见 **`docs/TBOX_QUICKSTART.md`** §3.2。

---

## 1. 前置

- RAGFlow API 可访问（默认 `http://127.0.0.1:9380`）
- 账号可登录（默认 `admin@ragflow.io` / `admin`）
- **完整对话验收**须配置 DeepSeek API Key（环境变量或 **`/kb`** 界面）

---

## 2. API 冒烟脚本

```bash
cd <REPO>
export PYTHONPATH=$(pwd)

# 仅探测 health + DeepSeek 是否在 LLM 目录（无 Key 时 chat 跳过）
uv run python3 scripts/tbox_g3_deepseek_smoke.py

# 完整对话（须有效 DeepSeek Key）
export TBOX_SMOKE_DEEPSEEK_API_KEY='sk-...'
# 可选：TBOX_SMOKE_DEEPSEEK_MODEL='deepseek-v4-flash@DeepSeek'
uv run python3 scripts/tbox_g3_deepseek_smoke.py
```

**通过标准**：

| 项 | 无 Key | 有 Key |
|----|--------|--------|
| `health_ok` | ✅ | ✅ |
| `deepseek_models` 非空 | ✅ | ✅ |
| `chat_ok` | ☐ 跳过（`note` 含 skipped） | ✅ |
| `answer_preview` | — | 非空且无 `**ERROR**` |

---

## 3. 记录模板

| 项 | 结果 | 备注 |
|----|------|------|
| health / contract | ✅ | `tbox_api_contract_version=5` |
| DeepSeek 模型列表 | ✅ | `deepseek-v4-flash/pro@DeepSeek` |
| chat/completions (SSE) | ✅ | 租户已配 Key；`answer` 含 `TBOX-DEEPSEEK-OK` |
| web-tbox `/` 流式一轮 | ☐ 未测 | UI 手测 §3.2 |

**测试人 / 日期 / 环境**：Cursor Agent · 2026-05-24 · `http://127.0.0.1:9380` · `scripts/tbox_g3_deepseek_smoke.py`

---

## 4. 相关文档

- 能力矩阵：`docs/superpowers/specs/2026-05-24-tbox-capability-matrix-design.md`
- Phase 5 plan：`docs/superpowers/plans/2026-05-24-tbox-phase5-plan.md`
- Quickstart §3.2：`docs/TBOX_QUICKSTART.md`
