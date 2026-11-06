# 合同文件缩略图落盘策略（10 万级文件）

## 目标
- 支持 10 万级图片/文档缩略图预览
- 避免将缩略图以 base64/DataURL 形式写入 SQLite，降低数据库体积与查询/WAL 开销
- 保持 UI 预览加载稳定，并便于后续清理与迁移

## 方案概览
- **缩略图落盘为文件**：生成 `webp` 文件并写入合同目录内的隐藏目录
- **数据库仅存路径与状态**：
  - `contract_files.first_page_thumb` 存缩略图文件路径（绝对路径）
  - `contract_files.preview_status` 存缩略图状态（`pending/processing/completed/failed`）

## 存储位置与命名规则
- 缩略图文件保存到每个合同目录下：
  - `<合同folder_name>/.thumbs/<前2位>/<key>.webp`
- `key` 取值：
  - 优先使用 `sha256`（同文件可复用缩略图路径）
  - 缺失时使用 `fileId`
- `<前2位>` 为 `key` 的前两位，作为分桶目录，避免单目录堆积大量文件

示例：
- `...\<合同folder_name>\.thumbs\ab\ab12...ef.webp`

## 生成流程
1. 渲染进程生成预览：
   - `PreviewAdapter` 读取源文件并渲染首页/首帧到 `canvas`
   - 输出 `webp` DataURL（宽 480px，质量 0.75）
2. DataURL 转为二进制：
   - `data:image/webp;base64,...` → `Uint8Array`
3. IPC 落盘与写库（原子化思路）：
   - 调用 `contractFiles.saveThumbnailFile`
   - 主进程：
     - 写入 `.thumbs/.../*.webp`
     - 更新 `first_page_thumb` 为落盘路径
     - 更新 `preview_status='completed'`

## PDF 缩略图策略
- **渲染引擎**：渲染进程使用 `pdfjs-dist`（worker 模式）解析 PDF，并仅渲染第 1 页作为缩略图来源
- **输入读取**：将 PDF 以 `ArrayBuffer` 读入（本地路径统一转 `file://` 后用 `fetch` 读取），避免额外的临时落盘与重复 IO
- **目标尺寸**：以“宽 480px”为目标，按页面原始宽高比等比缩放；必要时限制最大渲染像素（防止超大页面导致内存峰值过高）
- **渲染流程**：
  1. `pdfjsLib.getDocument({ data: buffer })` 加载文档
  2. `pdf.getPage(1)` 获取首页
  3. 计算 viewport scale（使渲染后宽度接近 480px）
  4. `page.render({ canvasContext, viewport })` 渲染到 `canvas`
  5. `canvas.toDataURL('image/webp', 0.75)` 输出 DataURL，进入“落盘为 webp + 写库路径”的通用流程
- **失败与降级**：
  - 加载/渲染失败（损坏、加密、权限不足、字体缺失等）时，将 `preview_status='failed'`，`first_page_thumb` 保持为空
  - UI 端对 `failed/empty` 状态显示占位图标（或维持骨架），并允许后续“重新生成”触发重试

## 清理策略
- **重置缩略图**（例如“重新生成”触发将 `first_page_thumb` 置空）时：
  - 若旧 `first_page_thumb` 是落盘文件路径（非 `data:`）
  - 且在同一合同内没有其他记录引用该路径
  - 则删除旧缩略图文件
- **删除文件记录**时：
  - 同样会尝试清理其缩略图文件（仍会检查引用计数，避免误删共享缩略图）

## 与 UI 展示的关系
- UI 优先使用 `first_page_thumb` 指向的缩略图文件显示
- 若缩略图尚未生成，图片文件可直接用原图路径回退显示（避免只看到骨架屏）

## 关键实现点（代码位置）
- 队列与生成：
  - [thumbnailQueueStore.ts](file:///e:/hqkj/code/soft/softRegistration/electron-dual-panel-app/src/renderer/stores/thumbnailQueueStore.ts)
- 预览抽取：
  - [PreviewAdapter.ts](file:///e:/hqkj/code/soft/softRegistration/electron-dual-panel-app/src/renderer/utils/PreviewAdapter.ts)
- IPC 通道：
  - [channels.ts](file:///e:/hqkj/code/soft/softRegistration/electron-dual-panel-app/src/main/ipc/channels.ts)
- IPC 暴露：
  - [preload.ts](file:///e:/hqkj/code/soft/softRegistration/electron-dual-panel-app/src/main/preload.ts)
- 主进程落盘与写库：
  - [contractFileHandlers.ts](file:///e:/hqkj/code/soft/softRegistration/electron-dual-panel-app/src/main/ipc/handlers/contractFileHandlers.ts)
