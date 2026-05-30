# TBOX 控制台（web-tbox）— 页面类需求备忘（二期实现）

本文汇总前期讨论中**与页面 / 动线 / 验收 / 导出**相关的需求，供**项目二期**排期与实现时对照。一期已落地的部分会注明「已有」，避免重复开发。

**相关文档**

- **能力矩阵与下一阶段计划（G1–G5）**：[`docs/superpowers/specs/2026-05-24-tbox-capability-matrix-design.md`](./superpowers/specs/2026-05-24-tbox-capability-matrix-design.md)、[`docs/superpowers/plans/2026-05-24-tbox-next-phase.md`](./superpowers/plans/2026-05-24-tbox-next-phase.md)
- 小白按步验收：`docs/TBOX_UI_ACCEPTANCE_WALKTHROUGH.md`
- 咨询结果导出：**P1 已支持 MD/PDF**（`/`、`/search`）；Word/Excel 见 phase3 plan。

---

## 一、总体 UI 策略（二期仍适用）

1. **先功能完善、再视觉美化**：动线跑通、状态与错误提示清晰优先；统一主题与动效可后置。
2. **按用户动线逐页推进**：登录 → 知识库/文档 → 对话/检索 → 采集/审计等，每页闭环后再扩下一页。
3. **验收与产品说明同源**：验收项与真实页面行为一致，避免「文档写了但页上没有」。

---

## 二、验收与确认页体系（一期已有骨架，二期可加深）

| 需求 | 说明 | 二期建议 |
|------|------|----------|
| **可打开的确认页** | 每一步有独立说明 + 验收清单，便于评审与留档。 | 与 `journeySteps`、真实路由保持同步；缺页补页。 |
| **`/review` 索引** | 总表列出动线步骤，可进入单步确认页。 | 筛选、排序、按角色隐藏步骤（若有多角色动线）。 |
| **`/review/step/:id`** | 单步完整确认页（说明、勾选、备注等）。 | 深链稳定、分享 URL；步骤 `id` 与代码常量单一来源。 |
| **各业务页右下角「本页验收」** | 在当前真实页打勾，与确认页**共用同一套 localStorage**（数据同步）。 | 窄屏/抽屉布局下按钮不遮挡主操作；无障碍与焦点顺序。 |
| **导出 HTML + 浏览器打印存 PDF** | 评审/验收流：一页纸 HTML，打印为 PDF 存档。 | 模板品牌化、可选是否带敏感备注；可选服务端生成 PDF（质量更好）。 |
| **`public/ui-pages/` 静态线框** | 纯静态线框页，便于产品/设计对齐，不依赖后端。 | 与最终实现页面对照表（哪张线框对应哪条路由）。 |

**一期参考实现位置（勿在备忘中重复造轮子）**

- 评审路由与步骤：`web-tbox/src/review/`、`web-tbox/src/pages/review/`
- 右下角面板：`web-tbox/src/components/PageReviewPanel.tsx`
- 步骤映射：`web-tbox/src/review/pathToJourneyStep.ts`
- 导出：`web-tbox/src/review/exportReviewOnePager.ts`、`web-tbox/src/review/reviewStorage.ts`
- 静态线框：`web-tbox/public/ui-pages/`

---

## 三、业务结果导出（对话 / 检索）

**一期 + P1 已交付（2026-05-24）**

| 格式 | 路径 | 状态 |
|------|------|------|
| Markdown | **`/`**、**`/search`** | ✅ `exportConsultationResult.ts` |
| PDF（打印） | 同上 | ✅ 浏览器「另存为 PDF」 |

**P2 已交付（2026-05-24 Task 11）**

| 格式 | 路径 | 状态 |
|------|------|------|
| Word (.docx) | **`/`** | ✅ |
| Excel (.xlsx) | **`/search`** | ✅ |
| PowerPoint (.pptx) | **`/`**、**`/search`** | ✅ Task 11b |

---

## 三（原）· 二期导出范围备忘

**目标**：在**对话页**（`/`）与**检索页**（`/search`）等，支持将「咨询结果」导出为多种文件格式。

**范围建议（排期时拆任务）**

1. **导出内容**：当前会话消息、当前检索结果列表、（可选）侧栏引用片段合并进同一文件。
2. **格式**（按优先级可调整）
   - **Markdown / 纯文本**：✅ 已交付。
   - **PDF**：✅ 打印转 PDF 已交付。
   - **Word（.docx）**：P2。
   - **Excel（.xlsx）**：P2。

**非目标（除非产品明确要求）**

- 与官方 `web/` 全量能力对齐；可参考 `web/src/pages/agent/constant/index.tsx` 中的 `ExportFileType` 思路，但 **web-tbox 单独实现**即可。

---

## 四、二期：其他页面能力（动线缺口，来自前期讨论）

**一期已收尾（不再作为二期「占位补全」）**

| 项 | 说明 |
|------|------|
| **知识库配置 `/kb`** | 已对接官方 **`GET/PUT /api/v1/datasets/:id`**（名称、描述、嵌入模型、分块方法、`permission`、`parser_config`）；整库删除需 **`kb.dangerous`**（与 `/documents` 删整库一致）。表单化向导、嵌入模型下拉等仍可排二期体验项。 |

以下在一期仍为**简化实现**，二期按产品优先级补齐：

| 方向 | 说明 |
|------|------|
| **采集高级策略** | ✅ P1：`/crawl` 关键词/深度/域名 + worker（`common/tbox_crawl_strategy.py`）。P2：登录站点、API 源。 |
| **审计筛选与导出** | 审计列表：时间、用户、动作类型筛选；可选 CSV/Excel 导出（与 Agent 日志 CSV 导出类似思路）。 |

---

## 五、二期落地时自检清单

- [x] `PageReviewPanel` / `journeySteps` / `pathToJourneyStep` 与 P1 路由（导出、模板、爬取策略）一致。
- [x] `docs/TBOX_UI_ACCEPTANCE_WALKTHROUGH.md` 已与 P1 实现对齐。
- [x] 导出 MD/PDF：UTF-8 下载与打印路径已接入 `/` 与 `/search`。
- [ ] 静态线框 `public/ui-pages/` 与真实页差异在评审会上说清，避免验收误解。

---

*文档性质：需求备忘，非承诺排期；二期范围以当时立项为准。*
