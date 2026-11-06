<template>
  <div class="flex h-full min-h-0 gap-4">
    <section class="flex min-h-0 min-w-0 basis-[42%] flex-col rounded-3xl border bg-[var(--content-card-bg)] p-4">
      <div class="flex items-center justify-between gap-4 border-b border-[var(--content-border)] pb-3">
        <div>
          <h3 class="text-xl font-semibold text-[var(--content-text)]">
            {{ items.length === 0 ? '等待导入扫描件' : `待处理页面 (${items.length})` }}
          </h3>
          <p class="mt-1 text-sm text-[var(--content-text-secondary)]">
            {{ sourceKind === 'pdf' ? '当前为 PDF 页模式，按页顺序批量增强。' : '当前为图片模式，按当前顺序批量增强。' }}
          </p>
        </div>
        <div class="rounded-2xl border px-4 py-3 text-right" :style="statCardStyle">
          <div class="text-xs uppercase tracking-[0.18em] text-[var(--content-text-secondary)]">增强摘要</div>
          <div class="mt-2 text-lg font-semibold text-[var(--content-text)]">{{ items.length }} 页</div>
          <div class="mt-1 text-sm text-[var(--content-text-secondary)]">{{ totalSizeText }}</div>
        </div>
      </div>

      <div v-if="items.length === 0" class="mt-4 flex min-h-0 flex-1 items-center justify-center rounded-3xl border border-dashed px-6 text-center" :style="emptyStateStyle">
        <div>
          <div class="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-sky-50 text-2xl text-sky-600">
            <i class="pi pi-sparkles"></i>
          </div>
          <div class="mt-4 text-base font-medium text-[var(--content-text)]">还没有待增强页面</div>
          <p class="mt-2 text-sm leading-7 text-[var(--content-text-secondary)]">
            从顶部添加 PDF、图片或选择图片目录后，这里会按页展开待处理列表。
          </p>
        </div>
      </div>

      <div v-else class="mt-4 min-h-0 flex-1 overflow-auto pr-1">
        <div class="space-y-3">
          <button
            v-for="(item, index) in items"
            :key="item.id"
            type="button"
            class="scan-queue-item"
            :class="{ 'scan-queue-item--active': selectedItem?.id === item.id }"
            @click="selectItem(item.id)"
          >
            <div class="scan-queue-item__thumb-wrap">
              <img v-if="item.previewDataUrl" :src="item.previewDataUrl" :alt="item.name" class="scan-queue-item__thumb" />
              <div v-else class="scan-queue-item__thumb-placeholder">
                <i class="pi pi-image"></i>
              </div>
            </div>
            <div class="min-w-0 flex-1 text-left">
              <div class="flex items-start justify-between gap-3">
                <div class="min-w-0">
                  <div class="truncate text-sm font-medium text-[var(--content-text)]">{{ item.name }}</div>
                  <div class="mt-1 truncate text-xs text-[var(--content-text-secondary)]">{{ item.sourcePath }}</div>
                </div>
                <span class="scan-status-badge" :class="statusClass(item.status)">
                  {{ statusLabel(item.status) }}
                </span>
              </div>
              <div class="mt-2 flex flex-wrap items-center gap-3 text-xs text-[var(--content-text-secondary)]">
                <span>{{ item.width }} × {{ item.height }}</span>
                <span>{{ item.sourceKind === 'pdf' ? `PDF 第 ${item.pageNumber} 页` : '图片' }}</span>
                <span v-if="item.errorMessage" class="text-red-500">{{ item.errorMessage }}</span>
              </div>
            </div>
            <div class="flex shrink-0 items-center gap-1">
              <Button icon="pi pi-arrow-up" text rounded severity="secondary" aria-label="上移" :disabled="index === 0" @click.stop="moveItem(index, -1)" />
              <Button icon="pi pi-arrow-down" text rounded severity="secondary" aria-label="下移" :disabled="index === items.length - 1" @click.stop="moveItem(index, 1)" />
              <Button icon="pi pi-trash" text rounded severity="secondary" aria-label="删除" @click.stop="removeItem(item.id)" />
            </div>
          </button>
        </div>
      </div>
    </section>

    <section class="flex min-h-0 min-w-0 basis-[58%] flex-col gap-4">
      <div class="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div class="rounded-3xl border bg-[var(--content-card-bg)] p-4">
          <div class="flex items-center justify-between gap-3 border-b border-[var(--content-border)] pb-3">
            <div class="text-base font-medium text-[var(--content-text)]">原图 / 增强后预览</div>
            <div class="text-sm text-[var(--content-text-secondary)]">
              <template v-if="selectedItem">{{ selectedItem.name }}</template>
              <template v-else>暂无选中页面</template>
            </div>
          </div>

          <div v-if="selectedItem" class="mt-4 grid gap-4 xl:grid-cols-2">
            <div class="scan-preview-card">
              <div class="scan-preview-card__title">原图</div>
              <div class="scan-preview-card__body">
                <img v-if="selectedItem.previewDataUrl" :src="selectedItem.previewDataUrl" :alt="selectedItem.name" class="scan-preview-card__image" />
                <div v-else class="scan-preview-card__empty">暂无原图预览</div>
              </div>
            </div>
            <div class="scan-preview-card">
              <div class="scan-preview-card__title">增强后</div>
              <div class="scan-preview-card__body">
                <img v-if="selectedItem.processedPreviewDataUrl" :src="selectedItem.processedPreviewDataUrl" :alt="`${selectedItem.name} 增强后`" class="scan-preview-card__image" />
                <div v-else class="scan-preview-card__empty">
                  处理完成后会在这里显示增强结果
                </div>
              </div>
            </div>
          </div>
          <div v-else class="mt-4 flex h-[420px] items-center justify-center rounded-2xl border border-dashed text-center text-sm text-[var(--content-text-secondary)]">
            选中左侧页面后可查看原图和增强后对比
          </div>
        </div>

        <aside class="rounded-3xl border bg-[var(--content-card-bg)] p-4">
          <div class="text-base font-semibold text-[var(--content-text)]">输出设置</div>
          <div class="mt-4">
            <div class="mb-2 text-sm font-medium text-[var(--content-text)]">输出类型</div>
            <div class="grid grid-cols-2 gap-2">
              <button
                type="button"
                class="scan-segment"
                :class="{ 'scan-segment--active': outputKind === 'pdf' }"
                @click="outputKind = 'pdf'"
              >
                PDF
              </button>
              <button
                type="button"
                class="scan-segment"
                :class="{ 'scan-segment--active': outputKind === 'images' }"
                @click="outputKind = 'images'"
              >
                图片
              </button>
            </div>
          </div>

          <div v-if="outputKind === 'images'" class="mt-5">
            <div class="mb-2 text-sm font-medium text-[var(--content-text)]">图片格式</div>
            <div class="grid grid-cols-2 gap-2">
              <button
                type="button"
                class="scan-segment"
                :class="{ 'scan-segment--active': imageFormat === 'png' }"
                @click="imageFormat = 'png'"
              >
                PNG
              </button>
              <button
                type="button"
                class="scan-segment"
                :class="{ 'scan-segment--active': imageFormat === 'jpg' }"
                @click="imageFormat = 'jpg'"
              >
                JPG
              </button>
            </div>
          </div>

          <label class="mt-5 flex items-center gap-3">
            <Checkbox v-model="openAfterSave" binary />
            <span class="text-sm text-[var(--content-text)]">处理完成后自动打开结果</span>
          </label>

          <div class="mt-5 rounded-2xl border px-4 py-4" :style="statCardStyle">
            <div class="text-xs uppercase tracking-[0.18em] text-[var(--content-text-secondary)]">当前模式</div>
            <div class="mt-2 text-lg font-semibold text-[var(--content-text)]">
              {{ sourceKind === 'pdf' ? 'PDF 扫描页' : '图片集合' }}
            </div>
            <div class="mt-2 text-sm leading-7 text-[var(--content-text-secondary)]">
              自动四角拉正、裁边、倾斜校正、去阴影提白底，并增强文字清晰度。
            </div>
          </div>

          <div v-if="isRunning || progress" class="mt-5 rounded-2xl border px-4 py-4" :style="statCardStyle">
            <div class="flex items-center justify-between gap-3">
              <div class="text-sm font-medium text-[var(--content-text)]">{{ progressMessage }}</div>
              <div class="text-sm tabular-nums text-sky-700">{{ progressPercent }}%</div>
            </div>
            <ProgressBar :value="progressPercent" :showValue="false" class="mt-3" style="height: 6px" />
            <div class="mt-2 text-xs text-[var(--content-text-secondary)]">
              {{ progressPageText }}
            </div>
          </div>

          <div class="mt-5 grid gap-2">
            <Button label="开始处理" :loading="isRunning" :disabled="items.length === 0" @click="handleStartProcessing" />
            <Button label="导出 PDF" severity="secondary" :disabled="items.length === 0 || isRunning" @click="handleExportPdf" />
            <Button label="导出图片" severity="secondary" :disabled="items.length === 0 || isRunning" @click="handleExportImages" />
          </div>
        </aside>
      </div>
    </section>

    <Dialog
      v-model:visible="showClearAllConfirmDialog"
      modal
      header="确认清空页面"
      :style="{ width: '420px', maxWidth: '92vw' }"
      class="theme-dialog"
    >
      <div class="text-sm leading-7 text-[var(--content-text-secondary)]">
        确认清空当前已导入的
        <span class="font-medium text-[var(--content-text)]">{{ items.length }}</span>
        个页面吗？
      </div>
      <template #footer>
        <div class="flex justify-end gap-2">
          <Button label="取消" text @click="showClearAllConfirmDialog = false" />
          <Button label="清空" severity="danger" @click="confirmClearAll" />
        </div>
      </template>
    </Dialog>

    <Dialog
      v-model:visible="showResultDialog"
      modal
      header="扫描件增强完成"
      :style="{ width: '560px', maxWidth: '92vw' }"
      class="theme-dialog"
    >
      <div class="text-sm leading-7 text-[var(--content-text-secondary)]">
        <div class="font-medium text-[var(--content-text)]">{{ lastResult?.outputPath }}</div>
        <div class="mt-3 grid gap-2 md:grid-cols-2">
          <div>总页数：{{ lastResult?.totalCount || 0 }}</div>
          <div>成功页：{{ lastResult?.successCount || 0 }}</div>
          <div>失败页：{{ lastResult?.failureCount || 0 }}</div>
          <div>输出体积：{{ formatBytes(lastResult?.fileSize || 0) }}</div>
        </div>
      </div>
      <template #footer>
        <div class="flex justify-end gap-2">
          <Button label="打开结果" severity="secondary" @click="handleOpenOutput" />
          <Button label="复制路径" severity="secondary" @click="handleCopyOutput" />
          <Button label="打开目录" @click="handleOpenOutputDir" />
        </div>
      </template>
    </Dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import Button from 'primevue/button'
import Checkbox from 'primevue/checkbox'
import Dialog from 'primevue/dialog'
import ProgressBar from 'primevue/progressbar'
import { useToast } from 'primevue/usetoast'
import type {
  RunScanEnhanceResult,
  ScanEnhanceImageFormat,
  ScanEnhanceItem,
  ScanEnhanceOutputKind,
  ScanEnhanceProgressPayload,
  ScanEnhanceSourceKind,
} from '../../../shared/types/toolbox.types'

const toast = useToast()

const items = ref<ScanEnhanceItem[]>([])
const selectedId = ref('')
const sourceKind = ref<ScanEnhanceSourceKind>('image')
const outputKind = ref<ScanEnhanceOutputKind>('pdf')
const imageFormat = ref<ScanEnhanceImageFormat>('png')
const openAfterSave = ref(false)
const isRunning = ref(false)
const progress = ref<ScanEnhanceProgressPayload | null>(null)
const lastResult = ref<RunScanEnhanceResult | null>(null)
const showResultDialog = ref(false)
const showClearAllConfirmDialog = ref(false)

const statCardStyle = {
  borderColor: 'var(--content-border)',
  backgroundColor: 'var(--content-card-bg)',
}

const emptyStateStyle = {
  borderColor: 'var(--content-border)',
  backgroundColor: 'var(--content-card-bg)',
}

const selectedItem = computed(() => items.value.find(item => item.id === selectedId.value) || null)
const totalSizeText = computed(() => formatBytes(items.value.reduce((sum, item) => sum + Number(item.size || 0), 0)))
const progressPercent = computed(() => Math.max(0, Math.min(100, Math.round(Number(progress.value?.percent || 0)))))
const progressMessage = computed(() => progress.value?.message || (isRunning.value ? '正在准备处理...' : ''))
const progressPageText = computed(() => {
  if (!progress.value?.totalPages) return '等待开始'
  return `页面进度：${progress.value.currentPage}/${progress.value.totalPages}`
})

let stopProgressListener: (() => void) | null = null

function ensureProgressListener(): void {
  if (stopProgressListener) return
  stopProgressListener = window.electronAPI.toolbox.onScanEnhanceProgress((payload) => {
    progress.value = payload
  })
}

function cleanupProgressListener(): void {
  if (!stopProgressListener) return
  stopProgressListener()
  stopProgressListener = null
}

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

function statusLabel(status?: ScanEnhanceItem['status']): string {
  switch (status) {
    case 'processing':
      return '处理中'
    case 'success':
      return '成功'
    case 'error':
      return '失败'
    default:
      return '待处理'
  }
}

function statusClass(status?: ScanEnhanceItem['status']): string {
  switch (status) {
    case 'processing':
      return 'scan-status-badge--processing'
    case 'success':
      return 'scan-status-badge--success'
    case 'error':
      return 'scan-status-badge--error'
    default:
      return 'scan-status-badge--idle'
  }
}

function selectItem(id: string): void {
  selectedId.value = id
}

function moveItem(index: number, delta: number): void {
  const nextIndex = index + delta
  if (nextIndex < 0 || nextIndex >= items.value.length) return
  const nextItems = [...items.value]
  const [target] = nextItems.splice(index, 1)
  nextItems.splice(nextIndex, 0, target)
  items.value = nextItems
}

function removeItem(id: string): void {
  items.value = items.value.filter(item => item.id !== id)
  if (selectedId.value === id) {
    selectedId.value = items.value[0]?.id || ''
  }
}

function setItems(nextItems: ScanEnhanceItem[], nextSourceKind: ScanEnhanceSourceKind): void {
  items.value = nextItems
  sourceKind.value = nextSourceKind
  outputKind.value = nextSourceKind === 'pdf' ? 'pdf' : outputKind.value
  selectedId.value = nextItems[0]?.id || ''
}

function mergeItems(existing: ScanEnhanceItem[], incoming: ScanEnhanceItem[]): ScanEnhanceItem[] {
  const seen = new Set(existing.map(item => item.id))
  const merged = [...existing]
  for (const item of incoming) {
    if (seen.has(item.id)) continue
    merged.push(item)
    seen.add(item.id)
  }
  return merged
}

function buildPlainItemsPayload(sourceItems: ScanEnhanceItem[]): ScanEnhanceItem[] {
  return sourceItems.map(item => ({
    id: String(item.id || ''),
    sourceKind: item.sourceKind,
    sourcePath: String(item.sourcePath || ''),
    sourceName: String(item.sourceName || ''),
    name: String(item.name || ''),
    pageNumber: item.pageNumber,
    pageCount: item.pageCount,
    width: Number(item.width || 0),
    height: Number(item.height || 0),
    size: Number(item.size || 0),
    previewDataUrl: item.previewDataUrl,
    outputPath: item.outputPath,
    processedPreviewDataUrl: item.processedPreviewDataUrl,
    status: item.status,
    errorMessage: item.errorMessage,
  }))
}

async function inspectAndAppend(filePaths: string[], nextSourceKind: ScanEnhanceSourceKind): Promise<void> {
  if (filePaths.length === 0) return
  const response = await window.electronAPI.toolbox.inspectScanEnhanceInputs({
    sourceKind: nextSourceKind,
    filePaths,
  })
  if (!response.success || !response.data) {
    throw new Error(response.error || '文件检查失败')
  }
  const incoming = response.data.items || []
  if (items.value.length > 0 && sourceKind.value !== nextSourceKind) {
    setItems(incoming, nextSourceKind)
    toast.add({
      severity: 'info',
      summary: '已切换输入模式',
      detail: nextSourceKind === 'pdf' ? '已切换为 PDF 页模式。' : '已切换为图片模式。',
      life: 2600,
    })
    return
  }
  const merged = mergeItems(items.value, incoming)
  setItems(merged, nextSourceKind)
}

async function handleAddPdfFiles(): Promise<void> {
  try {
    const result = await window.electronAPI.fs.selectFile({
      title: '选择待增强 PDF',
      properties: ['openFile', 'multiSelections'],
      filters: [{ name: 'PDF 文件', extensions: ['pdf'] }],
    })
    if (!result.success || result.data?.canceled) return
    await inspectAndAppend((result.data.filePaths || []) as string[], 'pdf')
  } catch (error) {
    notifyError(error, '导入 PDF 失败')
  }
}

async function handleAddImages(): Promise<void> {
  try {
    const result = await window.electronAPI.fs.selectFile({
      title: '选择待增强图片',
      properties: ['openFile', 'multiSelections'],
      filters: [{ name: '图片文件', extensions: ['png', 'jpg', 'jpeg', 'webp', 'bmp', 'gif', 'tif', 'tiff'] }],
    })
    if (!result.success || result.data?.canceled) return
    await inspectAndAppend((result.data.filePaths || []) as string[], 'image')
  } catch (error) {
    notifyError(error, '导入图片失败')
  }
}

async function handleSelectFolder(): Promise<void> {
  try {
    const result = await window.electronAPI.fs.selectFile({
      title: '选择图片目录',
      properties: ['openDirectory'],
    })
    if (!result.success || result.data?.canceled) return
    const folderPath = String(result.data.filePaths?.[0] || '')
    if (!folderPath) return
    const scanResult = await window.electronAPI.toolbox.scanImageFolder({
      folderPath,
      recursive: true,
    })
    if (!scanResult.success || !scanResult.data) {
      throw new Error(scanResult.error || '目录扫描失败')
    }
    const filePaths = (scanResult.data.items || []).map(item => item.path)
    await inspectAndAppend(filePaths, 'image')
  } catch (error) {
    notifyError(error, '导入目录失败')
  }
}

async function chooseOutputPath(nextOutputKind: ScanEnhanceOutputKind): Promise<string | null> {
  if (nextOutputKind === 'pdf') {
    const saveResult = await window.electronAPI.fs.saveFile({
      title: '导出增强后的 PDF',
      defaultPath: '扫描件增强.pdf',
      filters: [{ name: 'PDF 文件', extensions: ['pdf'] }],
    })
    if (!saveResult.success || saveResult.data?.canceled || !saveResult.data?.filePath) {
      return null
    }
    return String(saveResult.data.filePath)
  }

  const folderResult = await window.electronAPI.fs.selectFile({
    title: '选择增强图片输出目录',
    properties: ['openDirectory', 'createDirectory'],
  })
  if (!folderResult.success || folderResult.data?.canceled) {
    return null
  }
  return String(folderResult.data.filePaths?.[0] || '')
}

async function runWithOutput(nextOutputKind: ScanEnhanceOutputKind): Promise<void> {
  if (items.value.length === 0 || isRunning.value) return
  const outputPath = await chooseOutputPath(nextOutputKind)
  if (!outputPath) return

  ensureProgressListener()
  progress.value = null
  isRunning.value = true
  outputKind.value = nextOutputKind
  items.value = items.value.map(item => ({
    ...item,
    status: 'processing',
    errorMessage: undefined,
  }))

  try {
    const payloadItems = buildPlainItemsPayload(items.value)
    const response = await window.electronAPI.toolbox.runScanEnhance({
      sourceKind: sourceKind.value,
      items: payloadItems,
      profile: 'document',
      outputKind: nextOutputKind,
      outputPath,
      imageFormat: imageFormat.value,
      openAfterSave: openAfterSave.value,
    })
    if (!response.success || !response.data) {
      throw new Error(response.error || '扫描件增强失败')
    }

    lastResult.value = response.data
    const resultMap = new Map(response.data.itemResults.map(item => [item.id, item]))
    items.value = items.value.map(item => {
      const result = resultMap.get(item.id)
      if (!result) return item
      return {
        ...item,
        outputPath: result.outputPath,
        processedPreviewDataUrl: result.processedPreviewDataUrl || item.processedPreviewDataUrl,
        width: result.width || item.width,
        height: result.height || item.height,
        status: result.status,
        errorMessage: result.errorMessage,
      }
    })
    showResultDialog.value = true
    toast.add({
      severity: 'success',
      summary: '扫描件增强完成',
      detail: `成功 ${response.data.successCount} 页，失败 ${response.data.failureCount} 页。`,
      life: 3200,
    })
  } catch (error) {
    items.value = items.value.map(item => ({
      ...item,
      status: item.processedPreviewDataUrl ? 'success' : 'idle',
      errorMessage: undefined,
    }))
    notifyError(error, '扫描件增强失败')
  } finally {
    isRunning.value = false
  }
}

async function handleStartProcessing(): Promise<void> {
  await runWithOutput(outputKind.value)
}

async function handleExportPdf(): Promise<void> {
  await runWithOutput('pdf')
}

async function handleExportImages(): Promise<void> {
  await runWithOutput('images')
}

function requestClearAll(): void {
  if (items.value.length === 0) return
  showClearAllConfirmDialog.value = true
}

function confirmClearAll(): void {
  items.value = []
  selectedId.value = ''
  progress.value = null
  showClearAllConfirmDialog.value = false
}

async function handleOpenOutput(): Promise<void> {
  try {
    if (!lastResult.value) return
    if (lastResult.value.outputKind === 'pdf') {
      await window.electronAPI.fs.openFile(lastResult.value.outputPath)
      return
    }
    const firstFile = lastResult.value.generatedFiles[0]
    if (firstFile) {
      await window.electronAPI.fs.openFile(firstFile)
    }
  } catch (error) {
    notifyError(error, '打开结果失败')
  }
}

async function handleOpenOutputDir(): Promise<void> {
  try {
    if (!lastResult.value) return
    const dirPath = lastResult.value.outputKind === 'pdf'
      ? getDirectoryPath(lastResult.value.outputPath)
      : lastResult.value.outputPath
    await window.electronAPI.fs.openFolder(dirPath)
  } catch (error) {
    notifyError(error, '打开目录失败')
  }
}

async function handleCopyOutput(): Promise<void> {
  try {
    if (!lastResult.value) return
    const targetPath = lastResult.value.outputKind === 'pdf'
      ? lastResult.value.outputPath
      : lastResult.value.generatedFiles[0] || lastResult.value.outputPath
    const response = await window.electronAPI.fs.clipboardWriteFile(targetPath)
    if (!response.success) {
      throw new Error(response.error || '复制路径失败')
    }
    toast.add({
      severity: 'success',
      summary: '已复制',
      detail: '结果路径已写入剪贴板。',
      life: 2200,
    })
  } catch (error) {
    notifyError(error, '复制结果失败')
  }
}

function getDirectoryPath(filePath: string): string {
  const normalized = String(filePath || '')
  const index = Math.max(normalized.lastIndexOf('/'), normalized.lastIndexOf('\\'))
  return index >= 0 ? normalized.slice(0, index) : normalized
}

function notifyError(error: unknown, summary: string): void {
  const detail = error instanceof Error ? error.message : String(error)
  toast.add({
    severity: 'error',
    summary,
    detail,
    life: 3600,
  })
}

onBeforeUnmount(() => {
  cleanupProgressListener()
})

defineExpose({
  handleAddPdfFiles,
  handleAddImages,
  handleSelectFolder,
  handleStartProcessing,
  handleExportPdf,
  handleExportImages,
  requestClearAll,
  get isRunning() {
    return isRunning.value
  },
})
</script>

<style scoped>
.scan-queue-item {
  display: flex;
  width: 100%;
  gap: 0.875rem;
  align-items: center;
  border: 1px solid var(--content-border);
  border-radius: 1.25rem;
  background: color-mix(in srgb, var(--content-card-bg) 92%, white 8%);
  padding: 0.9rem;
  transition: border-color 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease;
}

.scan-queue-item:hover {
  border-color: rgba(14, 116, 144, 0.28);
  box-shadow: 0 14px 28px rgba(15, 23, 42, 0.08);
  transform: translateY(-1px);
}

.scan-queue-item--active {
  border-color: rgba(2, 132, 199, 0.38);
  box-shadow: 0 18px 36px rgba(14, 165, 233, 0.12);
}

.scan-queue-item__thumb-wrap {
  display: flex;
  width: 84px;
  min-width: 84px;
  height: 112px;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  border-radius: 1rem;
  border: 1px solid var(--content-border);
  background: linear-gradient(135deg, rgba(241, 245, 249, 0.96), rgba(255, 255, 255, 0.98));
}

.scan-queue-item__thumb,
.scan-preview-card__image {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}

.scan-queue-item__thumb-placeholder,
.scan-preview-card__empty {
  color: var(--content-text-secondary);
  font-size: 0.875rem;
}

.scan-status-badge {
  border-radius: 999px;
  padding: 0.28rem 0.7rem;
  font-size: 0.75rem;
  font-weight: 600;
}

.scan-status-badge--idle {
  background: rgba(226, 232, 240, 0.8);
  color: rgb(71, 85, 105);
}

.scan-status-badge--processing {
  background: rgba(224, 242, 254, 0.88);
  color: rgb(3, 105, 161);
}

.scan-status-badge--success {
  background: rgba(220, 252, 231, 0.88);
  color: rgb(21, 128, 61);
}

.scan-status-badge--error {
  background: rgba(254, 226, 226, 0.9);
  color: rgb(185, 28, 28);
}

.scan-preview-card {
  display: flex;
  min-height: 0;
  flex-direction: column;
  border: 1px solid var(--content-border);
  border-radius: 1.25rem;
  overflow: hidden;
}

.scan-preview-card__title {
  border-bottom: 1px solid var(--content-border);
  padding: 0.85rem 1rem;
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--content-text);
}

.scan-preview-card__body {
  display: flex;
  height: 380px;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, rgba(241, 245, 249, 0.9), rgba(255, 255, 255, 0.96));
  padding: 1rem;
}

.scan-segment {
  border: 1px solid var(--content-border);
  border-radius: 0.9rem;
  background: color-mix(in srgb, var(--content-card-bg) 92%, white 8%);
  color: var(--content-text);
  padding: 0.7rem 0.9rem;
  font-size: 0.9rem;
  font-weight: 600;
  transition: border-color 0.2s ease, background-color 0.2s ease, box-shadow 0.2s ease;
}

.scan-segment--active {
  border-color: rgba(2, 132, 199, 0.32);
  background: linear-gradient(135deg, rgba(224, 242, 254, 0.95), rgba(239, 246, 255, 0.98));
  box-shadow: 0 10px 22px rgba(14, 165, 233, 0.1);
}
</style>
