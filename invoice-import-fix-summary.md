# 发票导入未入库问题总结

## 背景
- 问题现象：在合同文件中拖入发票 PDF 后，发票数据没有进入 `contract_invoices` 表。
- 复现场景：文件 `temp/【风韵出行-18.55元-1个行程】高德打车电子发票_20251215175423A010.pdf`。

## 排查结论
- 导入链路已触发：合同文件拖拽会走 `ImportTaskService` 的导入任务流程。
- 转换链路可用：目标 PDF 能成功转换为 Markdown（含 OCR 内容）。
- 核心根因有两点：
  - 电子发票号码是 20 位，旧规则偏向 8 位号码，导致 `invoiceNo` 被判定异常并降分。
  - OCR 文本中金额存在噪声，旧规则会把总金额误提取为 `1`，进一步拉低整体判定分。
- 结果表现：虽然能检测到“像发票”，但 `parseInvoiceFromMarkdown(...).isInvoice` 最终为 `false`，因此不会入库。

## 修复内容
- 调整发票号码规则：
  - 支持 20 位电子发票号码。
  - 20 位号码不再按格式异常处理，并提升对应置信度。
- 增加金额兜底提取：
  - 当标签提取到的总金额异常（如过小）时，回退到全局货币金额候选，取合理最大值。
- 增加电子发票兜底判定：
  - 在检测信号强、发票号+日期可信的情况下，即使综合分略低也判定为发票，避免漏判。

## 验证结果
- 单测通过：
  - `npx cross-env ELECTRON_RUN_AS_NODE=1 electron tests/unit-invoice-markdown-parser.js`
- 真实文件复测结果：
  - `isInvoice: true`
  - `invoiceNo: 25427000000544009122`
  - `issueDate: 2025-12-03`
  - `totalAmount: 18.55`
- 说明：当前该类电子发票可被识别并进入后续入库逻辑。

## 涉及修改文件

### 本轮问题修复（直接相关）
- `src/main/services/invoice/InvoiceMarkdownParser.ts`
- `tests/unit-invoice-markdown-parser.js`
- `tests/fixtures/invoice-markdown/invoice-electronic-20digits.md`

### 发票导入/管理功能链路（上下文相关）
- `src/main/services/system/ImportTaskService.ts`
- `src/main/ipc/handlers/contract/index.ts`
- `src/main/main.ts`
- `src/main/preload.ts`
- `src/renderer/types/electron-api.d.ts`
- `src/renderer/stores/contract/contractInvoiceStore.ts`
- `src/renderer/stores/contract/index.ts`
- `src/renderer/views/library/contract-invoice/ContractInvoiceManagementView.vue`
- `src/renderer/views/library/resource/ResourceView.vue`
- `src/renderer/stores/ui/sidebarStore.ts`
- `src/renderer/views/library/resource/components/ResourceSidebar.vue`
- `src/main/services/system/librarySchemaMigration/relatedSchemas.ts`
- `src/main/services/system/database/contractInvoices.ts`
- `src/main/ipc/handlers/contract/contractInvoiceHandlers.ts`
- `src/shared/types/contractInvoice.types.ts`
- `tests/unit-import-task-invoice.js`
- `.trae/specs/add-invoice-table-and-import-detection/spec.md`
- `.trae/specs/add-invoice-table-and-import-detection/tasks.md`
- `.trae/specs/add-invoice-table-and-import-detection/checklist.md`

## 后续建议
- 为合同文件页增加“重新识别发票”按钮，支持对已存在文件补录，不必重复导入文件。
- 在发票识别结果中记录“判定命中规则”，便于后续调优与问题追踪。
