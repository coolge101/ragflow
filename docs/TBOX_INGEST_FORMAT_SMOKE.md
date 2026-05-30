# TBOX 多格式入库手测清单（G1-OCR-IMAGE）

**目的**：验证 G1「自有成果 Embedding」在常见格式下的上传 → 解析 → 检索/对话引用链路。
**矩阵 ID**：`G1-OCR-IMAGE`、`G1-DOC-UPLOAD`、`G1-DOC-PARSE`
**前置**：`web-tbox` 已登录；至少有一个空知识库；嵌入模型已在 `/kb` 配置。

---

## 1. 样本准备

每种格式各准备 **1 个** 小文件（建议 &lt; 5MB），内容含可检索的独特关键词（如 `TBOX-SMOKE-20260524-PDF`）。

| 格式 | 建议后缀 | 备注 |
|------|----------|------|
| PDF | `.pdf` | 含可复制文本；扫描件可测 OCR |
| Word | `.docx` | |
| Excel | `.xlsx` | 含 **表头行 + 至少一行数据**（`ExcelParser` 约定） |
| 图片 | `.png` / `.jpg` | 含可见文字（测 OCR） |

---

## 2. 上传与解析（`/documents`）

对目标知识库依次：

1. 上传样本文件
2. 在文档列表中选中该文件，点击 **「开始解析」**
3. 等待 `run` 状态变为成功（或列表显示已解析 chunk 数）
4. 记录：文件名、解析耗时、是否报错

**通过标准**：四种格式均能完成解析，无 5xx；失败时记录错误信息与 parser 类型。

---

## 3. 检索验证（`/search`）

1. 选择同一知识库
2. 用样本中的 **独特关键词** 检索
3. 确认结果列表出现对应片段

**通过标准**：PDF/Word/Excel 至少一种文本格式能命中；图片若 OCR 成功应能命中。

---

## 4. 对话引用（`/`）

1. 在 `/apps` 创建或选择已绑定该库的应用
2. 在对话页提问：「文档里关于 &lt;独特关键词&gt; 的内容是什么？」
3. 确认回答引用侧栏或正文提及该文档/chunk

**通过标准**：至少一种格式在对话中可被引用；纯图片 OCR 失败时在矩阵备注中标注环境限制。

---

## 5. 记录模板

| 格式 | 上传 | 解析 | 检索命中 | 对话引用 | 备注 |
|------|------|------|----------|----------|------|
| PDF | ✅ | ✅（1 chunk） | ✅ | ☐ 未测 | keyword `TBOX-SMOKE-20260524-PDF` |
| Word | ✅ | ✅（1 chunk） | ✅ | ☐ 未测 | keyword `TBOX-SMOKE-20260524-DOCX` |
| Excel | ✅ | ✅（1 chunk） | ✅ | ☐ 未测 | 样本须 **表头行 + 数据行**（见脚本） |
| 图片 | ✅ | ✅（1 chunk） | ✅ | ☐ 未测 | OCR 回退：`picture.py` 在无 image2text 时仍用 OCR 文本 |

**测试人 / 日期 / 环境**：

- **测试人**：Cursor Agent（API 冒烟脚本，替代 UI 手测 §2–3）
- **日期**：2026-05-24（Phase 4 Task 16 复测通过）
- **环境**：`http://127.0.0.1:9380` · Docker CPU 栈 · 账号 `admin@ragflow.io`
- **知识库**：`TBOX-G1-SMOKE-20260524`（`chunk_method=naive`）
- **脚本**：`scripts/tbox_g1_ingest_format_smoke.py`
- **§4 对话引用**：未执行

**结论**：四种格式上传 → 解析 → 检索链路均通过。Excel 单行单元格在 `ExcelParser` 下仍为 0 chunk（须表头+数据行或使用 `table` 分块）；PNG 在未配置 image2text 时依赖 **`rag/app/picture.py` OCR 回退**（Phase 4 修复）。

---

## 6. 相关文档

- 能力矩阵：`docs/superpowers/specs/2026-05-24-tbox-capability-matrix-design.md`
- 交付 Harness：`docs/TBOX_KB_DELIVERY_HARNESS.md` §1 G1
- Quickstart：`docs/TBOX_QUICKSTART.md`
