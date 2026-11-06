<template>
  <div class="flex h-full min-h-0 gap-4">
    <section class="flex min-h-0 min-w-0 basis-1/3 flex-col rounded-3xl border bg-[var(--content-card-bg)] p-4">
      <div class="flex items-center justify-between gap-4 border-b border-[var(--content-border)] pb-3">
        <div>
          <h3 class="text-xl font-semibold text-[var(--content-text)]">
            {{ items.length === 0 ? '等待导入图片' : `识别队列 (${items.length})` }}
          </h3>
          <p class="mt-1 text-sm text-[var(--content-text-secondary)]">
            支持多选图片或扫描文件夹，按当前列表顺序逐张识别。
          </p>
        </div>
        <div class="text-right text-sm text-[var(--content-text-secondary)]">
          <div>成功 {{ successCount }} 张</div>
          <div>失败 {{ failureCount }} 张</div>
        </div>
      </div>

      <div v-if="items.length === 0" class="flex min-h-0 flex-1 items-center justify-center px-8 text-center">
        <button
          type="button"
          class="ocr-empty-state"
          :class="{ 'ocr-empty-state--dragover': isDragOver }"
          @click="handleAddImages"
          @dragenter.prevent="handleDragEnter"
          @dragover.prevent="handleDragOver"
          @dragleave.prevent="handleDragLeave"
          @drop.prevent="handleDropImages"
        >
          <div class="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-sky-50 text-2xl text-sky-600">
            <i class="pi pi-images"></i>
          </div>
          <div class="mt-4 text-base font-medium text-[var(--content-text)]">还没有待识别图片</div>
          <p class="mt-2 text-sm leading-7 text-[var(--content-text-secondary)]">
            支持拖入图片，或点击选择图片。
          </p>
        </button>
      </div>

      <div v-else class="mt-4 min-h-0 flex-1 overflow-auto pr-1">
        <div class="space-y-3">
          <button
            v-for="item in items"
            :key="item.id"
            type="button"
            class="ocr-queue-item"
            :class="{ 'ocr-queue-item--active': selectedItem?.id === item.id }"
            @click="selectItem(item.id)"
          >
            <div
              class="ocr-queue-item__thumb-wrap"
              title="双击放大预览"
              @dblclick.stop="openImagePreview(item)"
            >
              <img v-if="getPreviewUrl(item)" :src="getPreviewUrl(item)" :alt="item.name" class="ocr-queue-item__thumb" />
              <div v-else class="ocr-queue-item__thumb-placeholder">
                <i class="pi pi-image"></i>
              </div>
            </div>
            <div class="min-w-0 flex-1 text-left">
              <div class="flex items-start justify-between gap-3">
                <div class="min-w-0">
                  <div class="truncate text-sm font-medium text-[var(--content-text)]">{{ item.name }}</div>
                  <div class="mt-1 truncate text-xs text-[var(--content-text-secondary)]">{{ item.relativePath || item.path }}</div>
                </div>
                <span class="ocr-status-badge" :class="statusClassMap[item.status]">
                  {{ statusLabelMap[item.status] }}
                </span>
              </div>
              <div class="mt-2 flex flex-wrap items-center gap-3 text-xs text-[var(--content-text-secondary)]">
                <span>{{ formatImageMeta(item) }}</span>
                <span v-if="item.elapsedMs">耗时 {{ item.elapsedMs }} ms</span>
                <span v-if="item.errorMessage" class="text-red-500">{{ item.errorMessage }}</span>
              </div>
            </div>
          </button>
        </div>
      </div>
    </section>

    <section class="flex min-h-0 min-w-0 basis-2/3 flex-col rounded-3xl border bg-[var(--content-card-bg)] p-4">
      <div v-if="items.length > 0" class="flex min-h-0 flex-1 flex-col rounded-2xl border border-[var(--content-border)] bg-[var(--content-bg)] p-4">
        <div class="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--content-border)] pb-3">
          <div class="text-base font-medium text-[var(--content-text)]">文件文本预览</div>
          <div class="flex flex-wrap items-center gap-3 text-sm text-[var(--content-text-secondary)]">
            <span>已完成 {{ successCount }} / {{ items.length }} 张</span>
            <span>成功 {{ successCount }} 张</span>
            <span>失败 {{ failureCount }} 张</span>
            <span v-if="isRunning" class="text-sky-600">正在执行中...</span>
          </div>
        </div>
        <div class="mt-4 min-h-0 flex-1">
          <div class="ocr-text-preview h-[560px] overflow-hidden rounded-2xl border border-[var(--content-border)]">
            <div class="ocr-text-preview__scroller h-full overflow-auto px-4 py-3">
              <pre class="ocr-text-preview__content whitespace-pre-wrap break-words text-sm leading-7">{{ aggregatePreviewText }}</pre>
            </div>
          </div>
        </div>
      </div>

      <div v-else class="flex min-h-0 flex-1 items-center justify-center text-center">
        <div>
          <div class="text-base font-medium text-[var(--content-text)]">暂未导入图片</div>
          <p class="mt-2 text-sm leading-7 text-[var(--content-text-secondary)]">
            导入图片后，这里会实时汇总所有识别文字，便于直接检查整篇结果。
          </p>
        </div>
      </div>
    </section>

    <Dialog
      v-model:visible="showClearAllConfirmDialog"
      modal
      header="确认清空识别队列"
      :style="{ width: '420px', maxWidth: '92vw' }"
      class="theme-dialog"
    >
      <div class="text-sm leading-7 text-[var(--content-text-secondary)]">
        确认清空当前已导入的
        <span class="font-medium text-[var(--content-text)]">{{ items.length }}</span>
        张图片吗？
      </div>
      <template #footer>
        <div class="flex justify-end gap-2">
          <Button label="取消" text @click="cancelClearAll" />
          <Button label="清空" severity="danger" @click="confirmClearAll" />
        </div>
      </template>
    </Dialog>

    <Dialog
      v-model:visible="showExportSuccessDialog"
      modal
      header="文件已导出"
      :style="{ width: '520px', maxWidth: '92vw' }"
      class="theme-dialog"
    >
      <div class="text-sm leading-7 text-[var(--content-text-secondary)]">
        <div class="font-medium text-[var(--content-text)]">{{ lastExportResult?.outputPath }}</div>
        <div class="mt-2">
          共导出 {{ lastExportResult?.exportedCount || 0 }} 张图片识别结果 · {{ formatBytes(lastExportResult?.fileSize || 0) }}
        </div>
      </div>
      <template #footer>
        <div class="flex justify-end gap-2">
          <Button label="打开文件" severity="secondary" @click="handleOpenExportedFile" />
          <Button label="复制" severity="secondary" @click="handleCopyExportedFile" />
          <Button label="打开目录" @click="handleOpenExportedFolder" />
        </div>
      </template>
    </Dialog>

    <Dialog
      v-model:visible="showImagePreviewDialog"
      :modal="false"
      :draggable="true"
      :dismissableMask="false"
      :header="imagePreviewTitle"
      :style="{ width: 'min(920px, 88vw)', maxWidth: '88vw' }"
      class="theme-dialog ocr-image-preview-dialog"
    >
      <div class="ocr-image-preview">
        <img
          v-if="imagePreviewUrl"
          :src="imagePreviewUrl"
          :alt="imagePreviewTitle"
          class="ocr-image-preview__image"
        />
        <div v-else class="ocr-image-preview__empty">
          图片预览加载中...
        </div>
      </div>
    </Dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import { useToast } from 'primevue/usetoast'
import type {
  ExportImageOcrDocxResult,
  ToolboxImageItem,
  ToolboxOcrImageItem,
  ToolboxOcrStatus,
} from '../../../shared/types/toolbox.types'

const toast = useToast()

const items = ref<ToolboxOcrImageItem[]>([])
const selectedId = ref('')
const isRunning = ref(false)
const isExporting = ref(false)
const isDragOver = ref(false)
const previewUrlMap = ref<Record<string, string>>({})
const showClearAllConfirmDialog = ref(false)
const showExportSuccessDialog = ref(false)
const showImagePreviewDialog = ref(false)
const imagePreviewItemId = ref('')
const lastExportResult = ref<(ExportImageOcrDocxResult & { kind?: 'docx' | 'md' }) | null>(null)

const selectedItem = computed(() => items.value.find(item => item.id === selectedId.value) || null)
const imagePreviewItem = computed(() => items.value.find(item => item.id === imagePreviewItemId.value) || null)
const imagePreviewTitle = computed(() => imagePreviewItem.value?.name || '图片预览')
const imagePreviewUrl = computed(() => (imagePreviewItem.value ? getPreviewUrl(imagePreviewItem.value) : ''))
const successCount = computed(() => items.value.filter(item => item.status === 'success').length)
const failureCount = computed(() => items.value.filter(item => item.status === 'error').length)
const aggregatePreviewText = computed(() => {
  if (items.value.length === 0) {
    return ''
  }
  const segments = items.value.map((item) => {
    if (item.status === 'processing') {
      return '正在识别中，请稍候...'
    }
    if (item.status === 'error') {
      return `识别失败：${item.errorMessage || '未知错误'}`
    }
    const text = removeBlankLines(String(item.recognizedText || '')).trim()
    if (!text) {
      return item.status === 'success' ? '未识别到可用文本。' : '点击顶部工具栏开始识别'
    }
    return text
  })
  return segments.filter(segment => String(segment || '').trim()).join('\n\n')
})

const statusLabelMap: Record<ToolboxOcrStatus, string> = {
  idle: '待识别',
  processing: '识别中',
  success: '识别成功',
  error: '识别失败',
}

const statusClassMap: Record<ToolboxOcrStatus, string> = {
  idle: 'ocr-status-badge--idle',
  processing: 'ocr-status-badge--processing',
  success: 'ocr-status-badge--success',
  error: 'ocr-status-badge--error',
}

function removeBlankLines(text: string): string {
  return String(text || '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map(line => line.trimEnd())
    .filter(line => line.trim())
    .join('\n')
}

watch(
  () => items.value.map(item => item.id),
  (ids, oldIds = []) => {
    const removed = oldIds.filter(id => !ids.includes(id))
    for (const id of removed) {
      revokePreviewUrl(previewUrlMap.value, id)
    }
    if (!ids.includes(selectedId.value)) {
      selectedId.value = ids[0] || ''
    }
  },
)

const supportedImageFilter = {
  name: '图片文件',
  extensions: ['png', 'jpg', 'jpeg', 'webp', 'bmp', 'gif', 'tif', 'tiff'],
}

const supportedImageExtensions = new Set(supportedImageFilter.extensions.map(extension => extension.toLowerCase()))

function formatBytes(size: number): string {
  if (!size) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  let value = size
  let unitIndex = 0
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024
    unitIndex += 1
  }
  return `${value >= 100 || unitIndex === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[unitIndex]}`
}

function getFileName(filePath: string): string {
  const normalized = String(filePath || '')
  const index = Math.max(normalized.lastIndexOf('/'), normalized.lastIndexOf('\\'))
  return index >= 0 ? normalized.slice(index + 1) : normalized
}

function getDirectoryPath(filePath: string): string {
  const normalized = String(filePath || '')
  const index = Math.max(normalized.lastIndexOf('/'), normalized.lastIndexOf('\\'))
  return index >= 0 ? normalized.slice(0, index) : normalized
}

function buildDefaultDocxName(): string {
  if (items.value.length === 1) {
    const name = getFileName(items.value[0].name || items.value[0].path)
    const dotIndex = name.lastIndexOf('.')
    return `${dotIndex >= 0 ? name.slice(0, dotIndex) : name}-OCR结果.docx`
  }
  return '图片OCR识别结果.docx'
}

function buildDefaultMarkdownName(): string {
  if (items.value.length === 1) {
    const name = getFileName(items.value[0].name || items.value[0].path)
    const dotIndex = name.lastIndexOf('.')
    return `${dotIndex >= 0 ? name.slice(0, dotIndex) : name}-OCR结果.md`
  }
  return '图片OCR识别结果.md'
}

function formatImageMeta(item: ToolboxImageItem): string {
  const sizeText = formatBytes(Number(item.size || 0))
  if (item.width && item.height) {
    return `${item.width} × ${item.height} · ${sizeText}`
  }
  return sizeText
}

function mergeItems(existing: ToolboxOcrImageItem[], incoming: ToolboxImageItem[]): ToolboxOcrImageItem[] {
  const map = new Map(existing.map(item => [item.path, item]))
  const merged = [...existing]
  for (const item of incoming) {
    if (!item.path || map.has(item.path)) continue
    const nextItem: ToolboxOcrImageItem = {
      ...item,
      status: 'idle',
      recognizedText: '',
      elapsedMs: undefined,
      errorMessage: '',
    }
    map.set(item.path, nextItem)
    merged.push(nextItem)
  }
  return merged
}

function selectItem(id: string): void {
  selectedId.value = id
}

function openImagePreview(item: ToolboxImageItem): void {
  if (!getPreviewUrl(item)) return
  imagePreviewItemId.value = item.id
  showImagePreviewDialog.value = true
}

function clearAll(): void {
  items.value = []
  lastExportResult.value = null
  showImagePreviewDialog.value = false
  imagePreviewItemId.value = ''
  clearPreviewMap(previewUrlMap.value)
}

function requestClearAll(): void {
  if (items.value.length === 0 || isRunning.value) return
  showClearAllConfirmDialog.value = true
}

function cancelClearAll(): void {
  showClearAllConfirmDialog.value = false
}

function confirmClearAll(): void {
  clearAll()
  cancelClearAll()
}

async function buildManualImageItems(filePaths: string[]): Promise<{ items: ToolboxImageItem[]; skipped: number }> {
  const results = await Promise.all(
    filePaths.map(async (filePath, index) => {
      try {
        const infoRes = await window.electronAPI.fs.getFileInfo(filePath)
        if (!infoRes.success || !infoRes.data) {
          return null
        }
        return {
          id: `${Date.now()}-${index}-${window.crypto.randomUUID()}`,
          name: infoRes.data.name || getFileName(filePath),
          path: filePath,
          size: Number(infoRes.data.size || 0),
          width: infoRes.data.imageWidth,
          height: infoRes.data.imageHeight,
          source: 'file',
        } satisfies ToolboxImageItem
      } catch {
        return null
      }
    }),
  )

  const validItems = results.filter((item): item is ToolboxImageItem => Boolean(item))
  return {
    items: validItems,
    skipped: filePaths.length - validItems.length,
  }
}

async function appendImagePaths(filePaths: string[], invalidMessage: string): Promise<void> {
  const normalizedPaths = filePaths.map(item => String(item || '').trim()).filter(Boolean)
  if (normalizedPaths.length === 0) {
    return
  }

  const { items: nextItems, skipped } = await buildManualImageItems(normalizedPaths)
  if (nextItems.length === 0) {
    toast.add({ severity: 'warn', summary: '未导入图片', detail: invalidMessage, life: 3500 })
    return
  }

  items.value = mergeItems(items.value, nextItems)
  selectedId.value = selectedId.value || nextItems[0]?.id || ''
  void preloadPreviewUrls(nextItems)
  await nextTick()

  if (skipped > 0) {
    toast.add({ severity: 'warn', summary: '部分图片已跳过', detail: `有 ${skipped} 张图片无法读取，已自动跳过。`, life: 4000 })
  } else {
    toast.add({ severity: 'success', summary: '图片已加入', detail: `已加入 ${nextItems.length} 张图片。`, life: 2500 })
  }
}

async function handleAddImages(): Promise<void> {
  if (isRunning.value) {
    toast.add({ severity: 'warn', summary: '识别进行中', detail: '请等待当前识别任务完成后再继续添加图片。', life: 3200 })
    return
  }

  const result = await window.electronAPI.fs.selectFile({
    properties: ['openFile', 'multiSelections'],
    filters: [supportedImageFilter],
  })

  if (!result.success || !result.data || result.data.canceled) {
    return
  }

  const filePaths = Array.isArray(result.data.filePaths)
    ? result.data.filePaths.map((item: unknown) => String(item || '').trim()).filter(Boolean)
    : []
  if (filePaths.length === 0) {
    return
  }

  await appendImagePaths(filePaths, '所选图片无法读取。')
}

async function handleSelectFolder(): Promise<void> {
  if (isRunning.value) {
    toast.add({ severity: 'warn', summary: '识别进行中', detail: '请等待当前识别任务完成后再继续扫描目录。', life: 3200 })
    return
  }

  const result = await window.electronAPI.fs.selectFile({
    properties: ['openDirectory'],
  })

  if (!result.success || !result.data || result.data.canceled) {
    return
  }

  const folderPath = Array.isArray(result.data.filePaths) ? String(result.data.filePaths[0] || '').trim() : ''
  if (!folderPath) {
    return
  }

  const scanResult = await window.electronAPI.toolbox.scanOcrImageFolder({
    folderPath,
    recursive: true,
  })

  if (!scanResult.success || !scanResult.data) {
    toast.add({ severity: 'error', summary: '扫描失败', detail: scanResult.error || '无法扫描该目录中的图片。', life: 4500 })
    return
  }

  if (scanResult.data.items.length === 0) {
    toast.add({ severity: 'info', summary: '未找到图片', detail: '当前目录及子目录中没有可导入的图片。', life: 3500 })
    return
  }

  items.value = mergeItems(items.value, scanResult.data.items)
  selectedId.value = selectedId.value || scanResult.data.items[0]?.id || ''
  void preloadPreviewUrls(scanResult.data.items)
  await nextTick()
  toast.add({ severity: 'success', summary: '目录图片已加入', detail: `已加入 ${scanResult.data.items.length} 张图片。`, life: 3000 })
}

function collectDroppedImagePaths(event: DragEvent): string[] {
  const fileList = Array.from(event.dataTransfer?.files || [])
  return fileList
    .map((file) => {
      const filePath = Reflect.get(file, 'path')
      return typeof filePath === 'string' ? filePath : ''
    })
    .filter((filePath) => {
      const extension = String(filePath.split('.').pop() || '').toLowerCase()
      return supportedImageExtensions.has(extension)
    })
}

function handleDragEnter(): void {
  if (isRunning.value) return
  isDragOver.value = true
}

function handleDragOver(): void {
  if (isRunning.value) return
  isDragOver.value = true
}

function handleDragLeave(): void {
  isDragOver.value = false
}

async function handleDropImages(event: DragEvent): Promise<void> {
  isDragOver.value = false
  if (isRunning.value) {
    toast.add({ severity: 'warn', summary: '识别进行中', detail: '请等待当前识别任务完成后再继续添加图片。', life: 3200 })
    return
  }

  const filePaths = collectDroppedImagePaths(event)
  if (filePaths.length === 0) {
    toast.add({ severity: 'warn', summary: '未导入图片', detail: '请拖入 PNG、JPG、WEBP、BMP、GIF 或 TIFF 图片。', life: 3500 })
    return
  }

  await appendImagePaths(filePaths, '拖入的文件中没有可读取的图片。')
}

async function handleStartRecognition(): Promise<void> {
  if (isRunning.value) return
  if (items.value.length === 0) {
    toast.add({ severity: 'warn', summary: '无法识别', detail: '请先导入至少一张图片。', life: 3000 })
    return
  }

  isRunning.value = true
  lastExportResult.value = null

  try {
    for (let index = 0; index < items.value.length; index += 1) {
      const current = items.value[index]
      items.value[index] = {
        ...current,
        status: 'processing',
        errorMessage: '',
      }
      selectedId.value = current.id
      await nextTick()

      const response = await window.electronAPI.toolbox.batchImageOcr({
        images: [{
          id: current.id,
          name: current.name,
          path: current.path,
          relativePath: current.relativePath,
          width: current.width,
          height: current.height,
          size: current.size,
          source: current.source,
        }],
      })

      if (!response.success || !response.data || response.data.items.length === 0) {
        items.value[index] = {
          ...current,
          status: 'error',
          recognizedText: '',
          elapsedMs: undefined,
          errorMessage: response.error || '识别失败',
        }
        continue
      }

      items.value[index] = response.data.items[0]
    }

    toast.add({
      severity: 'success',
      summary: '识别完成',
      detail: `成功 ${successCount.value} 张，失败 ${failureCount.value} 张。`,
      life: 3500,
    })
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: '识别失败',
      detail: error instanceof Error ? error.message : '批量识别过程中发生错误。',
      life: 5000,
    })
  } finally {
    isRunning.value = false
  }
}

async function handleExportWord(): Promise<void> {
  if (isExporting.value) return
  if (successCount.value === 0) {
    toast.add({ severity: 'warn', summary: '无法导出', detail: '请先完成至少一张图片的识别。', life: 3200 })
    return
  }

  const saveResult = await window.electronAPI.fs.saveFile({
    defaultPath: buildDefaultDocxName(),
    filters: [{ name: 'Word 文档', extensions: ['docx'] }],
  })

  if (!saveResult.success || !saveResult.data || saveResult.data.canceled || !saveResult.data.filePath) {
    return
  }

  isExporting.value = true
  try {
    const exportableItems = items.value.map(item => ({
      id: item.id,
      name: item.name,
      path: item.path,
      relativePath: item.relativePath,
      width: item.width,
      height: item.height,
      size: item.size,
      source: item.source,
      status: item.status,
      recognizedText: item.recognizedText,
      elapsedMs: item.elapsedMs,
      errorMessage: item.errorMessage,
    }))

    const result = await window.electronAPI.toolbox.exportImageOcrDocx({
      outputPath: String(saveResult.data.filePath),
      documentTitle: '图片 OCR 识别结果',
      items: exportableItems,
    })

    if (!result.success || !result.data) {
      throw new Error(result.error || '导出 Word 失败')
    }

    lastExportResult.value = {
      ...result.data,
      kind: 'docx',
    }
    showExportSuccessDialog.value = true
    toast.add({
      severity: 'success',
      summary: 'Word 已导出',
      detail: `已导出 ${result.data.exportedCount} 张图片的识别结果。`,
      life: 3500,
    })
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: '导出失败',
      detail: error instanceof Error ? error.message : '导出 Word 时发生错误。',
      life: 5000,
    })
  } finally {
    isExporting.value = false
  }
}

async function handleExportMarkdown(): Promise<void> {
  if (isExporting.value) return
  if (successCount.value === 0) {
    toast.add({ severity: 'warn', summary: '无法导出', detail: '请先完成至少一张图片的识别。', life: 3200 })
    return
  }

  const saveResult = await window.electronAPI.fs.saveFile({
    defaultPath: buildDefaultMarkdownName(),
    filters: [{ name: 'Markdown 文件', extensions: ['md'] }],
  })

  if (!saveResult.success || !saveResult.data || saveResult.data.canceled || !saveResult.data.filePath) {
    return
  }

  isExporting.value = true
  try {
    const markdownText = aggregatePreviewText.value.trim()
    const writeResult = await window.electronAPI.fs.writeFile(String(saveResult.data.filePath), markdownText)
    if (!writeResult.success) {
      throw new Error(writeResult.error || '导出 Markdown 失败')
    }

    const fileSize = new Blob([markdownText], { type: 'text/markdown;charset=utf-8' }).size
    lastExportResult.value = {
      outputPath: String(saveResult.data.filePath),
      fileSize,
      exportedCount: successCount.value,
      kind: 'md',
    }
    showExportSuccessDialog.value = true
    toast.add({
      severity: 'success',
      summary: 'Markdown 已导出',
      detail: `已导出 ${successCount.value} 张图片的 Markdown 结果。`,
      life: 3500,
    })
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: '导出失败',
      detail: error instanceof Error ? error.message : '导出 Markdown 时发生错误。',
      life: 5000,
    })
  } finally {
    isExporting.value = false
  }
}

async function handleOpenExportedFile(): Promise<void> {
  if (!lastExportResult.value) return
  await window.electronAPI.fs.openFile(lastExportResult.value.outputPath)
}

async function handleCopyExportedFile(): Promise<void> {
  if (!lastExportResult.value) return
  await window.electronAPI.fs.clipboardWriteFile(lastExportResult.value.outputPath)
}

async function handleOpenExportedFolder(): Promise<void> {
  if (!lastExportResult.value) return
  await window.electronAPI.fs.openFolder(getDirectoryPath(lastExportResult.value.outputPath))
}

function getPreviewUrl(item: ToolboxImageItem): string {
  return previewUrlMap.value[item.id] || ''
}

function revokePreviewUrl(map: Record<string, string>, id: string): void {
  const url = map[id]
  if (!url) return
  if (url.startsWith('blob:')) {
    URL.revokeObjectURL(url)
  }
  delete map[id]
}

function clearPreviewMap(map: Record<string, string>): void {
  Object.keys(map).forEach((id) => {
    revokePreviewUrl(map, id)
  })
}

function getMimeType(filePath: string): string {
  const ext = String(filePath || '').toLowerCase().split('.').pop() || ''
  if (ext === 'png') return 'image/png'
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg'
  if (ext === 'webp') return 'image/webp'
  if (ext === 'bmp') return 'image/bmp'
  if (ext === 'gif') return 'image/gif'
  if (ext === 'tif' || ext === 'tiff') return 'image/tiff'
  return 'application/octet-stream'
}

async function preloadPreviewUrls(targetItems: ToolboxImageItem[]): Promise<void> {
  await Promise.all(
    targetItems.map(async (item) => {
      if (!item?.id || !item.path || previewUrlMap.value[item.id]) {
        return
      }
      try {
        const response = await window.electronAPI.fs.readFileBytes(item.path)
        if (!response.success || !response.data) {
          return
        }
        const bytes = response.data instanceof Uint8Array ? response.data : new Uint8Array(response.data as ArrayLike<number>)
        const blob = new Blob([bytes], { type: getMimeType(item.path) })
        const nextUrl = URL.createObjectURL(blob)
        previewUrlMap.value = {
          ...previewUrlMap.value,
          [item.id]: nextUrl,
        }
      } catch {
        // ignore preview errors to avoid blocking OCR flow
      }
    }),
  )
}

onBeforeUnmount(() => {
  clearPreviewMap(previewUrlMap.value)
})

defineExpose({
  handleAddImages,
  handleSelectFolder,
  requestClearAll,
  handleStartRecognition,
  handleExportMarkdown,
  handleExportWord,
  get isRunning() {
    return isRunning.value
  },
  get isExporting() {
    return isExporting.value
  },
  get canExport() {
    return successCount.value > 0
  },
})
</script>

<style scoped>
.ocr-queue-item {
  display: flex;
  width: 100%;
  gap: 14px;
  border: 1px solid var(--content-border);
  border-radius: 20px;
  padding: 12px;
  background: color-mix(in srgb, var(--content-card-bg) 92%, white 8%);
  transition: border-color 0.18s ease, transform 0.18s ease, box-shadow 0.18s ease;
}

.ocr-queue-item:hover {
  transform: translateY(-1px);
  border-color: color-mix(in srgb, var(--p-sky-400) 45%, var(--content-border) 55%);
  box-shadow: 0 12px 24px rgba(15, 23, 42, 0.08);
}

.ocr-queue-item--active {
  border-color: color-mix(in srgb, var(--p-sky-500) 65%, var(--content-border) 35%);
  box-shadow: 0 16px 32px rgba(14, 116, 144, 0.12);
}

.ocr-queue-item__thumb {
  width: 84px;
  height: 84px;
  flex: 0 0 84px;
  object-fit: cover;
  border-radius: 18px;
  border: 1px solid var(--content-border);
  background: white;
}

.ocr-queue-item__thumb-wrap {
  width: 84px;
  height: 84px;
  flex: 0 0 84px;
  cursor: zoom-in;
}

.ocr-queue-item__thumb-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 84px;
  height: 84px;
  border-radius: 18px;
  border: 1px solid var(--content-border);
  background: linear-gradient(135deg, rgba(241, 245, 249, 0.95), rgba(255, 255, 255, 0.98));
  color: var(--content-text-secondary);
}

.ocr-status-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 72px;
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 12px;
  line-height: 1.2;
  border: 1px solid transparent;
}

.ocr-status-badge--idle {
  background: rgba(148, 163, 184, 0.12);
  color: rgb(71, 85, 105);
  border-color: rgba(148, 163, 184, 0.25);
}

.ocr-status-badge--processing {
  background: rgba(14, 165, 233, 0.12);
  color: rgb(3, 105, 161);
  border-color: rgba(14, 165, 233, 0.24);
}

.ocr-status-badge--success {
  background: rgba(34, 197, 94, 0.12);
  color: rgb(21, 128, 61);
  border-color: rgba(34, 197, 94, 0.24);
}

.ocr-status-badge--error {
  background: rgba(239, 68, 68, 0.12);
  color: rgb(185, 28, 28);
  border-color: rgba(239, 68, 68, 0.24);
}

.ocr-empty-state {
  display: block;
  width: min(100%, 420px);
  padding: 28px 24px;
  border: 1px dashed color-mix(in srgb, var(--content-border) 72%, var(--primary-color, #0ea5e9) 28%);
  border-radius: 24px;
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--content-card-bg) 92%, white 8%), var(--content-card-bg));
  transition: border-color 0.18s ease, background 0.18s ease, transform 0.18s ease, box-shadow 0.18s ease;
}

.ocr-empty-state:hover {
  transform: translateY(-1px);
  border-color: color-mix(in srgb, var(--primary-color, #0ea5e9) 52%, var(--content-border) 48%);
  box-shadow: 0 14px 30px rgba(15, 23, 42, 0.08);
}

.ocr-empty-state--dragover {
  border-color: color-mix(in srgb, var(--primary-color, #0ea5e9) 72%, var(--content-border) 28%);
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--primary-color, #0ea5e9) 10%, var(--content-card-bg)), var(--content-card-bg));
  box-shadow: 0 18px 36px rgba(14, 165, 233, 0.16);
}

.ocr-text-preview {
  background:
    radial-gradient(circle at 12% 10%, color-mix(in srgb, var(--primary-color, #0ea5e9) 8%, transparent) 0, transparent 28%),
    var(--content-card-bg);
  color: var(--content-text);
}

.ocr-text-preview__scroller {
  scrollbar-color: color-mix(in srgb, var(--content-text-muted) 38%, transparent) transparent;
}

.ocr-text-preview__content {
  margin: 0;
  color: var(--content-text);
  font-family: 'JetBrains Mono', 'Microsoft YaHei', monospace;
}

.ocr-image-preview {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 360px;
  max-height: 72vh;
  overflow: auto;
  border-radius: 18px;
  border: 1px solid var(--content-border);
  background:
    linear-gradient(45deg, rgba(148, 163, 184, 0.13) 25%, transparent 25%),
    linear-gradient(-45deg, rgba(148, 163, 184, 0.13) 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, rgba(148, 163, 184, 0.13) 75%),
    linear-gradient(-45deg, transparent 75%, rgba(148, 163, 184, 0.13) 75%);
  background-color: #f8fafc;
  background-position: 0 0, 0 10px, 10px -10px, -10px 0;
  background-size: 20px 20px;
}

.ocr-image-preview__image {
  display: block;
  max-width: 100%;
  max-height: 72vh;
  object-fit: contain;
  background: white;
  box-shadow: 0 18px 45px rgba(15, 23, 42, 0.16);
}

.ocr-image-preview__empty {
  color: var(--content-text-secondary);
  font-size: 14px;
}

</style>
