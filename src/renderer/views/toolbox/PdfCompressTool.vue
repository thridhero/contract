<template>
  <div
    class="relative flex h-full min-h-0 flex-col"
    :class="{ 'pdf-dropzone--active': isDragOver }"
    @dragenter.prevent="handleDragEnter"
    @dragover.prevent="handleDragOver"
    @dragleave.prevent="handleDragLeave"
    @drop.prevent="handleDropFiles"
  >
    <section class="flex min-h-0 flex-1 flex-col">
      <div class="flex items-center justify-between gap-4">
        <div>
          <h3 class="mt-2 text-xl font-semibold text-[var(--content-text)]">
            {{ selectedPdf ? '扫描版 PDF 压缩' : '等待导入扫描版 PDF' }}
          </h3>
          <p class="mt-2 text-sm text-[var(--content-text-secondary)]">
            {{ selectedPdf ? statusDescription : '仅处理纯扫描件 PDF，会将页面重新压缩为图片型 PDF。' }}
          </p>
        </div>
        <div class="rounded-2xl border px-4 py-3 text-right" :style="statCardStyle">
          <div class="text-xs uppercase tracking-[0.18em] text-[var(--content-text-secondary)]">压缩摘要</div>
          <div class="mt-2 text-lg font-semibold text-[var(--content-text)]">{{ selectedPdf ? formatBytes(selectedPdf.size) : '0 B' }}</div>
          <div class="mt-1 text-sm text-[var(--content-text-secondary)]">{{ selectedPdf ? `${selectedPdf.pageCount} 页` : '未选择文件' }}</div>
        </div>
      </div>

      <div v-if="!selectedPdf" class="mt-5 flex min-h-0 flex-1 items-center justify-center rounded-3xl border border-dashed px-6 text-center" :style="emptyStateStyle">
        <div>
          <div class="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-50 text-2xl text-emerald-600">
            <i class="pi pi-compress"></i>
          </div>
          <div class="mt-4 text-base font-medium text-[var(--content-text)]">还没有待压缩的 PDF</div>
          <p class="mt-2 text-sm text-[var(--content-text-secondary)]">
            点击“选择 PDF”或拖入单个本地 PDF，系统会先检测是否为纯扫描件。
          </p>
        </div>
      </div>

      <div v-else class="mt-5 grid min-h-0 flex-1 gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div class="min-h-0 overflow-auto rounded-3xl border p-5" :style="tableShellStyle">
          <div class="flex items-start justify-between gap-4">
            <div class="min-w-0">
              <div class="truncate text-base font-semibold text-[var(--content-text)]">{{ selectedPdf.name }}</div>
              <div class="mt-1 truncate text-xs text-[var(--content-text-secondary)]">{{ selectedPdf.path }}</div>
            </div>
            <span class="rounded-full px-3 py-1 text-xs font-medium" :class="scanBadgeClass">
              {{ selectedPdf.isPureScan ? '纯扫描件' : '含文本层' }}
            </span>
          </div>

          <div class="mt-5 grid gap-3 md:grid-cols-3">
            <div class="pdf-stat-box">
              <div class="text-xs text-[var(--content-text-secondary)]">原始大小</div>
              <div class="mt-2 text-lg font-semibold text-[var(--content-text)]">{{ formatBytes(selectedPdf.size) }}</div>
            </div>
            <div class="pdf-stat-box">
              <div class="text-xs text-[var(--content-text-secondary)]">页数</div>
              <div class="mt-2 text-lg font-semibold text-[var(--content-text)]">{{ selectedPdf.pageCount }} 页</div>
            </div>
            <div class="pdf-stat-box">
              <div class="text-xs text-[var(--content-text-secondary)]">文本层</div>
              <div class="mt-2 text-lg font-semibold text-[var(--content-text)]">{{ selectedPdf.hasTextLayer ? '已检测到' : '未检测到' }}</div>
            </div>
          </div>

          <div v-if="!selectedPdf.isPureScan" class="mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-7 text-amber-800">
            当前文件包含可提取文本，不属于纯扫描件，暂不支持该压缩方式。
          </div>

          <div class="mt-6">
            <div class="mb-3 text-sm font-medium text-[var(--content-text)]">压缩档位</div>
            <div class="grid gap-3 md:grid-cols-3">
              <button
                v-for="option in levelOptions"
                :key="option.value"
                type="button"
                class="level-option"
                :class="{ 'level-option--active': level === option.value }"
                :disabled="!selectedPdf.isPureScan"
                @click="setLevel(option.value)"
              >
                <div class="text-sm font-semibold text-[var(--content-text)]">{{ option.label }}</div>
                <div class="mt-2 text-xs leading-6 text-[var(--content-text-secondary)]">{{ option.description }}</div>
              </button>
            </div>
          </div>
        </div>

        <aside class="rounded-3xl border p-5" :style="tableShellStyle">
          <div class="text-sm font-semibold text-[var(--content-text)]">预计输出体积</div>
          <div class="mt-4 rounded-2xl border px-4 py-4" :style="statCardStyle">
            <template v-if="estimate">
              <div class="text-2xl font-semibold text-[var(--content-text)]">
                {{ formatBytes(estimate.estimatedMinSize) }} - {{ formatBytes(estimate.estimatedMaxSize) }}
              </div>
              <p class="mt-3 text-sm leading-7 text-[var(--content-text-secondary)]">{{ estimate.summary }}</p>
            </template>
            <template v-else>
              <div class="text-lg font-semibold text-[var(--content-text)]">暂无预估</div>
              <p class="mt-3 text-sm leading-7 text-[var(--content-text-secondary)]">选择纯扫描件 PDF 后会显示区间预估。</p>
            </template>
          </div>
          <label class="mt-5 flex items-center gap-3">
            <Checkbox v-model="openAfterSave" binary />
            <span class="text-sm text-[var(--content-text)]">压缩完成后自动打开文件</span>
          </label>
          <div class="mt-5 text-xs leading-6 text-[var(--content-text-secondary)]">
            输出文件为重建后的扫描版 PDF，不保留原始书签、注释、表单和文本层。
          </div>
        </aside>
      </div>
    </section>

    <div v-if="isDragOver" class="pdf-dropzone-overlay">
      <div class="pdf-dropzone-overlay__content">
        <i class="pi pi-file-pdf text-2xl"></i>
        <div class="mt-3 text-base font-medium">松开鼠标即可导入 PDF</div>
        <div class="mt-1 text-sm text-[var(--content-text-secondary)]">仅支持单个本地 PDF 文件</div>
      </div>
    </div>

    <div v-if="helpVisible" class="help-callout help-callout--a">
      该工具只处理纯扫描件；检测到文本层时会阻止压缩，避免破坏可搜索 PDF。
    </div>
    <div v-if="helpVisible" class="help-callout help-callout--b">
      压缩会重建页面图片，结果适合归档和发送，不适合保留批注、表单或书签。
    </div>

    <div class="pdf-toolbar">
      <div v-if="isGenerating || compressionProgress" class="pdf-progress-popover">
        <div class="flex items-center justify-between gap-4">
          <span class="truncate text-sm font-medium text-[var(--content-text)]">{{ compressionProgressMessage }}</span>
          <span class="text-sm tabular-nums text-emerald-700">{{ compressionProgressPercent }}%</span>
        </div>
        <ProgressBar :value="compressionProgressPercent" :showValue="false" class="mt-2" style="height: 6px" />
      </div>
      <div class="pdf-toolbar__row">
        <Button icon="pi pi-plus" label="选择 PDF" severity="secondary" @click="handleAddFiles" />
        <Button icon="pi pi-trash" label="清除" severity="secondary" :disabled="!selectedPdf" @click="clearFile" />
        <Button label="压缩导出" :loading="isGenerating" :disabled="!canCompress" @click="handleCompress" />
      </div>
    </div>

    <Dialog
      v-model:visible="showGenerateSuccessDialog"
      modal
      header="压缩完成"
      :style="{ width: '560px', maxWidth: '92vw' }"
      class="theme-dialog"
    >
      <div class="text-sm leading-7 text-[var(--content-text-secondary)]">
        <div class="font-medium text-[var(--content-text)]">{{ lastResult?.outputPath }}</div>
        <div class="mt-3 grid gap-2 md:grid-cols-2">
          <div>原始大小：{{ formatBytes(lastResult?.originalSize || 0) }}</div>
          <div>压缩后：{{ formatBytes(lastResult?.compressedSize || 0) }}</div>
          <div>节省体积：{{ formatBytes(lastResult?.savedBytes || 0) }}</div>
          <div>压缩率：{{ formatRatio(lastResult?.compressionRatio || 0) }}</div>
        </div>
        <div class="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-emerald-800">
          {{ resultMessage }}
        </div>
      </div>
      <template #footer>
        <div class="flex justify-end gap-2">
          <Button label="打开文件" severity="secondary" @click="handleOpenGeneratedFile" />
          <Button label="复制" severity="secondary" @click="handleCopyGeneratedFile" />
          <Button label="打开目录" @click="handleOpenGeneratedFolder" />
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
  CompressPdfFileResult,
  EstimatePdfCompressionResult,
  PdfCompressionProgressPayload,
  ToolboxPdfCompressionLevel,
} from '../../../shared/types/toolbox.types'

const toast = useToast()

const selectedPdf = ref<EstimatePdfCompressionResult | null>(null)
const estimate = ref<EstimatePdfCompressionResult | null>(null)
const level = ref<ToolboxPdfCompressionLevel>('standard')
const openAfterSave = ref(false)
const helpVisible = ref(false)
const isGenerating = ref(false)
const isInspecting = ref(false)
const isDragOver = ref(false)
const dragDepth = ref(0)
const showGenerateSuccessDialog = ref(false)
const lastResult = ref<CompressPdfFileResult | null>(null)
const compressionProgress = ref<PdfCompressionProgressPayload | null>(null)

const levelOptions: Array<{ value: ToolboxPdfCompressionLevel; label: string; description: string }> = [
  { value: 'light', label: '轻度', description: '保留更高画面质量，压缩幅度较温和。' },
  { value: 'standard', label: '标准', description: '默认推荐，兼顾清晰度与文件体积。' },
  { value: 'strong', label: '强力', description: '优先减小体积，适合发送和归档。' },
]

const statCardStyle = {
  borderColor: 'var(--content-border)',
  backgroundColor: 'var(--content-card-bg)',
}

const emptyStateStyle = {
  borderColor: 'var(--content-border)',
  backgroundColor: 'var(--content-card-bg)',
}

const tableShellStyle = {
  borderColor: 'var(--content-border)',
  backgroundColor: 'var(--content-card-bg)',
}

const canCompress = computed(() => Boolean(selectedPdf.value?.isPureScan) && !isGenerating.value && !isInspecting.value)
const statusDescription = computed(() => {
  if (!selectedPdf.value) return ''
  if (!selectedPdf.value.isPureScan) return '检测到可提取文本层，当前文件暂不支持扫描件压缩。'
  return `当前选择 ${selectedPdf.value.pageCount} 页，预计输出 ${estimateRangeText.value}。`
})
const estimateRangeText = computed(() => {
  if (!estimate.value) return '待预估'
  return `${formatBytes(estimate.value.estimatedMinSize)} - ${formatBytes(estimate.value.estimatedMaxSize)}`
})
const scanBadgeClass = computed(() => selectedPdf.value?.isPureScan
  ? 'bg-emerald-50 text-emerald-700'
  : 'bg-amber-50 text-amber-700')
const resultMessage = computed(() => {
  if (!lastResult.value) return ''
  if (lastResult.value.savedBytes <= 0) {
    return '已完成处理，体积未明显下降。输出文件为重建后的扫描版 PDF。'
  }
  return '压缩完成。输出文件为重建后的扫描版 PDF。'
})
const compressionProgressPercent = computed(() => Math.max(0, Math.min(100, Math.round(Number(compressionProgress.value?.percent || 0)))))
const compressionProgressMessage = computed(() => compressionProgress.value?.message || (isGenerating.value ? '正在准备压缩...' : ''))
const compressionProgressPageText = computed(() => {
  const progress = compressionProgress.value
  if (!progress || progress.totalPages <= 0 || progress.currentPage <= 0) return ''
  return `页面进度：${progress.currentPage}/${progress.totalPages}`
})

let stopCompressionProgress: (() => void) | null = null

function ensureCompressionProgressListener(): void {
  if (stopCompressionProgress) return
  stopCompressionProgress = window.electronAPI.toolbox.onPdfCompressionProgress((payload) => {
    compressionProgress.value = payload
  })
}

function stopCompressionProgressListener(): void {
  if (!stopCompressionProgress) return
  stopCompressionProgress()
  stopCompressionProgress = null
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

function formatRatio(value: number): string {
  return `${Number(value || 0).toFixed(2)}%`
}

function getDirectoryPath(filePath: string): string {
  const normalized = String(filePath || '')
  const index = Math.max(normalized.lastIndexOf('/'), normalized.lastIndexOf('\\'))
  return index >= 0 ? normalized.slice(0, index) : normalized
}

function getBaseNameWithoutExt(filePath: string): string {
  const name = String(filePath || '').split(/[\\/]/).pop() || '扫描版PDF'
  return name.replace(/\.pdf$/i, '') || '扫描版PDF'
}

async function inspectPdfPath(filePath: string): Promise<void> {
  const normalizedPath = String(filePath || '').trim()
  if (!normalizedPath) return

  isInspecting.value = true
  try {
    const result = await window.electronAPI.toolbox.estimatePdfCompression({
      filePath: normalizedPath,
      level: level.value,
    })

    if (!result.success || !result.data) {
      throw new Error(result.error || '读取 PDF 信息失败')
    }

    selectedPdf.value = result.data
    estimate.value = result.data
    if (!result.data.isPureScan) {
      toast.add({
        severity: 'warn',
        summary: '暂不支持',
        detail: '当前文件包含可提取文本，不属于纯扫描件。',
        life: 4200,
      })
      return
    }

    toast.add({ severity: 'success', summary: 'PDF 已导入', detail: '已完成纯扫描件检测和体积预估。', life: 2500 })
  } finally {
    isInspecting.value = false
  }
}

async function refreshEstimate(): Promise<void> {
  if (!selectedPdf.value) return
  const result = await window.electronAPI.toolbox.estimatePdfCompression({
    filePath: selectedPdf.value.path,
    level: level.value,
  })
  if (!result.success || !result.data) {
    throw new Error(result.error || '刷新压缩预估失败')
  }
  selectedPdf.value = result.data
  estimate.value = result.data
}

async function setLevel(nextLevel: ToolboxPdfCompressionLevel): Promise<void> {
  if (level.value === nextLevel) return
  level.value = nextLevel
  if (!selectedPdf.value) return
  try {
    await refreshEstimate()
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: '预估失败',
      detail: error instanceof Error ? error.message : '刷新压缩预估时发生错误。',
      life: 4200,
    })
  }
}

async function handleAddFiles(): Promise<void> {
  const result = await window.electronAPI.fs.selectFile({
    properties: ['openFile'],
    filters: [{ name: 'PDF 文件', extensions: ['pdf'] }],
  })

  if (!result.success || !result.data || result.data.canceled) {
    return
  }

  const filePath = Array.isArray(result.data.filePaths)
    ? String(result.data.filePaths[0] || '').trim()
    : ''
  if (!filePath) return

  try {
    await inspectPdfPath(filePath)
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: '导入失败',
      detail: error instanceof Error ? error.message : '无法读取所选 PDF 文件。',
      life: 4500,
    })
  }
}

async function handleCompress(): Promise<void> {
  if (!selectedPdf.value) {
    toast.add({ severity: 'warn', summary: '无法导出', detail: '请先选择一个 PDF。', life: 3000 })
    return
  }
  if (!selectedPdf.value.isPureScan) {
    toast.add({ severity: 'warn', summary: '暂不支持', detail: '当前文件包含可提取文本，不属于纯扫描件。', life: 3500 })
    return
  }

  const defaultPath = `${getDirectoryPath(selectedPdf.value.path)}\\${getBaseNameWithoutExt(selectedPdf.value.path)}-压缩.pdf`
  const saveResult = await window.electronAPI.fs.saveFile({
    title: '保存压缩后的 PDF',
    defaultPath,
    filters: [{ name: 'PDF 文件', extensions: ['pdf'] }],
  })

  if (!saveResult.success || !saveResult.data || saveResult.data.canceled) {
    return
  }

  const outputPath = String(saveResult.data.filePath || '').trim()
  if (!outputPath) return

  isGenerating.value = true
  compressionProgress.value = {
    stage: 'checking',
    percent: 0,
    currentPage: 0,
    totalPages: selectedPdf.value.pageCount,
    message: '正在准备压缩...',
  }
  ensureCompressionProgressListener()
  try {
    const result = await window.electronAPI.toolbox.compressPdfFile({
      filePath: selectedPdf.value.path,
      outputPath,
      level: level.value,
      openAfterSave: openAfterSave.value,
    })

    if (!result.success || !result.data) {
      throw new Error(result.error || 'PDF 压缩失败')
    }

    lastResult.value = result.data
    showGenerateSuccessDialog.value = true
    toast.add({ severity: 'success', summary: '压缩完成', detail: `输出大小 ${formatBytes(result.data.compressedSize)}。`, life: 3500 })
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: '压缩失败',
      detail: error instanceof Error ? error.message : '压缩 PDF 时发生错误。',
      life: 5000,
    })
  } finally {
    isGenerating.value = false
    window.setTimeout(() => {
      if (!isGenerating.value) {
        stopCompressionProgressListener()
        compressionProgress.value = null
      }
    }, 1200)
  }
}

function clearFile(): void {
  selectedPdf.value = null
  estimate.value = null
  lastResult.value = null
  compressionProgress.value = null
  stopCompressionProgressListener()
}

function normalizeDroppedPath(input: string): string {
  const value = String(input || '').replace(/\0/g, '').trim()
  if (!value) return ''

  if (value.startsWith('file:///')) {
    try {
      const url = new URL(value)
      const pathname = decodeURIComponent(url.pathname || '')
      return pathname.replace(/^\/([A-Za-z]:)/, '$1').replace(/\//g, '\\')
    } catch {
      return ''
    }
  }

  return value.replace(/^['"]|['"]$/g, '').replace(/^file:\/\//i, '').trim()
}

function extractFilePathFromFile(file: File | null | undefined): string {
  if (!file) return ''
  try {
    const fromElectron = window.electronAPI?.fs?.getFilePath?.(file)
    if (typeof fromElectron === 'string' && fromElectron.trim()) {
      return normalizeDroppedPath(fromElectron)
    }
  } catch {
    // ignore
  }

  const maybePath = (file as File & { path?: string }).path
  if (typeof maybePath === 'string' && maybePath.trim()) {
    return normalizeDroppedPath(maybePath)
  }

  return ''
}

function isPdfPath(filePath: string): boolean {
  return String(filePath || '').toLowerCase().endsWith('.pdf')
}

function collectDroppedPaths(dataTransfer: DataTransfer | null): { paths: string[]; detectedFileCount: number } {
  if (!dataTransfer) {
    return { paths: [], detectedFileCount: 0 }
  }

  const candidatePaths: string[] = []
  const files = Array.from(dataTransfer.files || [])
  const itemsList = Array.from(dataTransfer.items || [])

  for (const file of files) {
    const filePath = extractFilePathFromFile(file)
    if (filePath) candidatePaths.push(filePath)
  }

  for (const item of itemsList) {
    if (item.kind !== 'file') continue
    const filePath = extractFilePathFromFile(item.getAsFile())
    if (filePath) candidatePaths.push(filePath)
  }

  const uriListPaths = String(dataTransfer.getData('text/uri-list') || '')
    .split(/\r?\n/)
    .map(entry => normalizeDroppedPath(entry))

  const plainTextPaths = String(dataTransfer.getData('text/plain') || '')
    .split(/[\r\n]+/)
    .map(entry => normalizeDroppedPath(entry))

  return {
    paths: Array.from(new Set([...candidatePaths, ...uriListPaths, ...plainTextPaths].filter(entry => entry && isPdfPath(entry)))),
    detectedFileCount: files.length || itemsList.filter(item => item.kind === 'file').length,
  }
}

function handleDragEnter(): void {
  dragDepth.value += 1
  isDragOver.value = true
}

function handleDragOver(event: DragEvent): void {
  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = 'copy'
  }
  isDragOver.value = true
}

function handleDragLeave(): void {
  dragDepth.value = Math.max(0, dragDepth.value - 1)
  if (dragDepth.value === 0) {
    isDragOver.value = false
  }
}

async function handleDropFiles(event: DragEvent): Promise<void> {
  dragDepth.value = 0
  isDragOver.value = false
  const { paths, detectedFileCount } = collectDroppedPaths(event.dataTransfer)
  if (paths.length === 0) {
    toast.add({
      severity: 'warn',
      summary: '未识别到 PDF',
      detail: detectedFileCount > 0 ? '已检测到拖入文件，但暂未解析出可导入的 PDF 路径。' : '拖入的内容不是受支持的本地 PDF 文件。',
      life: 3500,
    })
    return
  }

  if (paths.length > 1) {
    toast.add({ severity: 'warn', summary: '仅支持单文件', detail: '请一次只拖入一个 PDF 文件。', life: 3500 })
    return
  }

  try {
    await inspectPdfPath(paths[0])
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: '导入失败',
      detail: error instanceof Error ? error.message : '拖入的 PDF 无法读取。',
      life: 4500,
    })
  }
}

async function handleOpenGeneratedFile(): Promise<void> {
  if (!lastResult.value?.outputPath) return
  await window.electronAPI.fs.openFile(lastResult.value.outputPath)
  showGenerateSuccessDialog.value = false
}

async function handleCopyGeneratedFile(): Promise<void> {
  if (!lastResult.value?.outputPath) return
  await window.electronAPI.fs.clipboardWriteFile(lastResult.value.outputPath)
  showGenerateSuccessDialog.value = false
}

async function handleOpenGeneratedFolder(): Promise<void> {
  const dirPath = getDirectoryPath(lastResult.value?.outputPath || '')
  if (!dirPath) return
  await window.electronAPI.fs.openFolder(dirPath)
  showGenerateSuccessDialog.value = false
}

function toggleHelp(): void {
  helpVisible.value = !helpVisible.value
}

defineExpose({
  handleAddFiles,
  clearFile,
  handleCompress,
  toggleHelp,
  helpVisible,
  isGenerating,
  isInspecting,
})

onBeforeUnmount(() => {
  stopCompressionProgressListener()
})
</script>

<style scoped>
.pdf-stat-box {
  border: 1px solid var(--content-border);
  border-radius: 1rem;
  padding: 1rem;
  background: color-mix(in srgb, var(--content-card-bg) 94%, white 6%);
}

.level-option {
  min-height: 112px;
  border: 1px solid var(--content-border);
  border-radius: 1rem;
  padding: 1rem;
  text-align: left;
  background: var(--content-card-bg);
  transition: border-color 0.16s ease, box-shadow 0.16s ease, transform 0.16s ease;
}

.level-option:not(:disabled):hover {
  border-color: rgba(16, 185, 129, 0.42);
  box-shadow: 0 10px 24px rgba(15, 23, 42, 0.08);
  transform: translateY(-1px);
}

.level-option--active {
  border-color: rgba(16, 185, 129, 0.62);
  background: rgba(236, 253, 245, 0.72);
}

.level-option:disabled {
  cursor: not-allowed;
  opacity: 0.62;
}

.pdf-toolbar {
  position: fixed;
  right: 1.5rem;
  bottom: 1.5rem;
  z-index: 20;
}

.pdf-toolbar__row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.7rem 0.85rem;
  border: 1px solid rgba(148, 163, 184, 0.22);
  border-radius: 9999px;
  background: rgba(255, 255, 255, 0.94);
  box-shadow: 0 14px 28px rgba(15, 23, 42, 0.12);
  backdrop-filter: blur(12px);
}

.pdf-progress-popover {
  width: min(420px, calc(100vw - 3rem));
  margin: 0 0 0.7rem auto;
  padding: 0.85rem 1rem;
  border: 1px solid rgba(16, 185, 129, 0.2);
  border-radius: 1rem;
  background: rgba(236, 253, 245, 0.96);
  box-shadow: 0 14px 30px rgba(15, 23, 42, 0.12);
  backdrop-filter: blur(12px);
}

.pdf-dropzone--active {
  position: relative;
}

.pdf-dropzone-overlay {
  position: absolute;
  inset: 0;
  z-index: 15;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2px dashed rgba(16, 185, 129, 0.38);
  border-radius: 1.5rem;
  background: rgba(236, 253, 245, 0.92);
  backdrop-filter: blur(4px);
  pointer-events: none;
}

.pdf-dropzone-overlay__content {
  text-align: center;
  color: var(--content-text);
}

.help-callout {
  position: absolute;
  z-index: 10;
  max-width: 360px;
  padding: 0.7rem 0.9rem;
  border: 1px solid rgba(16, 185, 129, 0.22);
  border-radius: 0.9rem;
  background: rgba(236, 253, 245, 0.96);
  color: var(--content-text-secondary);
  font-size: 0.9rem;
  line-height: 1.6;
  box-shadow: 0 12px 28px rgba(15, 23, 42, 0.08);
}

.help-callout--a {
  top: 0.5rem;
  left: 0.75rem;
}

.help-callout--b {
  top: 4.8rem;
  left: 0.75rem;
}
</style>
