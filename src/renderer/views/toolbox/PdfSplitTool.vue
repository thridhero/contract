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
            {{ items.length === 0 ? '等待导入 PDF' : `已导入 ${items.length} 个 PDF` }}
          </h3>
          <p class="mt-2 text-sm text-[var(--content-text-secondary)]">
            {{ items.length === 0 ? '支持多选 PDF、拖拽导入，并为每个文件配置拆分方式。' : `预计生成 ${estimatedFileCount} 个文件，共 ${estimatedPageCount} 页。` }}
          </p>
        </div>
        <div class="rounded-2xl border px-4 py-3 text-right" :style="statCardStyle">
          <div class="text-xs uppercase tracking-[0.18em] text-[var(--content-text-secondary)]">拆分摘要</div>
          <div class="mt-2 text-lg font-semibold text-[var(--content-text)]">{{ estimatedFileCount }} 份</div>
          <div class="mt-1 text-sm text-[var(--content-text-secondary)]">{{ totalSizeText }}</div>
        </div>
      </div>

      <div v-if="items.length === 0" class="mt-5 flex min-h-0 flex-1 items-center justify-center rounded-3xl border border-dashed px-6 text-center" :style="emptyStateStyle">
        <div>
          <div class="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-red-50 text-2xl text-red-500">
            <i class="pi pi-file-pdf"></i>
          </div>
          <div class="mt-4 text-base font-medium text-[var(--content-text)]">还没有待拆分的 PDF</div>
          <p class="mt-2 text-sm text-[var(--content-text-secondary)]">
            点击“添加文件”或把本地 PDF 拖进来，再为每个文件单独设置拆分方式。
          </p>
        </div>
      </div>

      <div v-else class="mt-5 min-h-0 flex-1 overflow-auto rounded-3xl border" :style="tableShellStyle">
        <div class="pdf-table-header">
          <div class="pdf-table-cell pdf-table-cell--checkbox">
            <Checkbox :model-value="allSelected" binary @update:model-value="toggleSelectAll" />
          </div>
          <div class="pdf-table-cell">名称</div>
          <div class="pdf-table-cell pdf-table-cell--pages">页数</div>
          <div class="pdf-table-cell pdf-table-cell--mode">拆分方式</div>
          <div class="pdf-table-cell pdf-table-cell--range">参数</div>
          <div class="pdf-table-cell pdf-table-cell--actions">操作</div>
        </div>

        <div v-for="item in items" :key="item.id" class="pdf-table-row">
          <div class="pdf-table-cell pdf-table-cell--checkbox">
            <Checkbox v-model="item.selected" binary />
          </div>
          <div class="pdf-table-cell min-w-0">
            <div class="truncate text-sm font-medium text-[var(--content-text)]">{{ item.name }}</div>
            <div class="mt-1 truncate text-xs text-[var(--content-text-secondary)]">{{ item.path }}</div>
          </div>
          <div class="pdf-table-cell pdf-table-cell--pages">
            <span class="text-sm font-medium text-[var(--content-text)]">{{ item.pageCount }}</span>
          </div>
          <div class="pdf-table-cell pdf-table-cell--mode">
            <select :value="item.splitMode" class="pdf-select-input" @change="updateSplitMode(item.id, ($event.target as HTMLSelectElement).value)">
              <option value="max-pages">最大页数</option>
              <option value="custom-ranges">自定义范围</option>
            </select>
          </div>
          <div class="pdf-table-cell pdf-table-cell--range">
            <div v-if="item.splitMode === 'max-pages'" class="flex items-center gap-2">
              <span class="text-sm text-[var(--content-text-secondary)]">每份</span>
              <input
                :value="item.pagesPerChunk"
                type="number"
                min="1"
                :max="item.pageCount"
                class="pdf-range-input"
                @change="updatePagesPerChunk(item.id, ($event.target as HTMLInputElement).value)"
                @blur="normalizePagesPerChunk(item.id)"
              />
              <span class="text-sm text-[var(--content-text-secondary)]">页</span>
            </div>
            <div v-else class="flex items-center gap-2">
              <Button label="编辑范围" size="small" severity="secondary" @click="openRangesEditor(item.id)" />
              <span class="text-xs text-[var(--content-text-secondary)]">{{ describeRanges(item.customRanges) }}</span>
            </div>
          </div>
          <div class="pdf-table-cell pdf-table-cell--actions">
            <div class="flex items-center justify-end gap-1">
              <Button icon="pi pi-list" text rounded severity="secondary" aria-label="编辑范围" :disabled="item.splitMode !== 'custom-ranges'" @click="openRangesEditor(item.id)" />
              <Button icon="pi pi-trash" text rounded severity="secondary" aria-label="删除" @click="removeItem(item.id)" />
            </div>
          </div>
        </div>
      </div>
    </section>

    <div v-if="isDragOver" class="pdf-dropzone-overlay">
      <div class="pdf-dropzone-overlay__content">
        <i class="pi pi-file-pdf text-2xl"></i>
        <div class="mt-3 text-base font-medium">松开鼠标即可导入 PDF</div>
        <div class="mt-1 text-sm text-[var(--content-text-secondary)]">支持一次拖入多个本地 PDF 文件</div>
      </div>
    </div>

    <div v-if="helpVisible" class="help-callout help-callout--a">
      勾选框仅用于“清除选中”，不会影响拆分结果；每个文件都会按自己的配置独立输出。
    </div>
    <div v-if="helpVisible" class="help-callout help-callout--b">
      最大页数模式会按当前页数连续切分；自定义范围模式不允许重叠，也不允许超出总页数。
    </div>

    <div class="pdf-toolbar">
      <div class="pdf-toolbar__row">
        <Button icon="pi pi-plus" label="添加文件" severity="secondary" @click="handleAddFiles" />
        <Button icon="pi pi-trash" label="清除选中" severity="secondary" :disabled="selectedCount === 0" @click="requestClearSelected" />
        <div class="min-w-[120px] text-center text-sm text-[var(--content-text-secondary)]">
          已选 {{ selectedCount }}/{{ items.length }}
        </div>
        <Button icon="pi pi-cog" label="设置" severity="secondary" @click="toggleSettings" />
        <Button label="拆分导出" :loading="isGenerating" :disabled="items.length === 0" @click="handleSplitPdf" />
      </div>
    </div>

    <Dialog v-model:visible="showClearSelectedDialog" modal header="确认清除选中" :style="{ width: '420px', maxWidth: '92vw' }" class="theme-dialog">
      <div class="text-sm leading-7 text-[var(--content-text-secondary)]">
        确认移除当前勾选的
        <span class="font-medium text-[var(--content-text)]">{{ selectedCount }}</span>
        个 PDF 吗？
      </div>
      <template #footer>
        <div class="flex justify-end gap-2">
          <Button label="取消" text @click="showClearSelectedDialog = false" />
          <Button label="移除" severity="danger" @click="confirmClearSelected" />
        </div>
      </template>
    </Dialog>

    <Dialog v-model:visible="settingsVisible" modal header="导出设置" :style="{ width: '460px', maxWidth: '92vw' }" class="theme-dialog">
      <div class="space-y-5">
        <label class="flex items-center gap-3">
          <Checkbox v-model="openAfterSave" binary />
          <span class="text-sm text-[var(--content-text)]">导出完成后自动打开输出目录</span>
        </label>
      </div>
      <template #footer>
        <div class="flex justify-end gap-2">
          <Button label="关闭" @click="settingsVisible = false" />
        </div>
      </template>
    </Dialog>

    <Dialog v-model:visible="showGenerateSuccessDialog" modal header="拆分完成" :style="{ width: '560px', maxWidth: '92vw' }" class="theme-dialog">
      <div class="text-sm leading-7 text-[var(--content-text-secondary)]">
        <div class="font-medium text-[var(--content-text)]">{{ lastResult?.outputDir }}</div>
        <div class="mt-2">
          共生成 {{ lastResult?.fileCount || 0 }} 个文件 · {{ lastResult?.pageCount || 0 }} 页 · {{ formatBytes(lastResult?.totalSize || 0) }}
        </div>
      </div>
      <template #footer>
        <div class="flex justify-end gap-2">
          <Button label="复制首个文件" severity="secondary" :disabled="!firstGeneratedFilePath" @click="handleCopyFirstGeneratedFile" />
          <Button label="打开目录" @click="handleOpenGeneratedFolder" />
        </div>
      </template>
    </Dialog>

    <Dialog v-model:visible="rangesEditorVisible" modal header="编辑拆分范围" :style="{ width: '560px', maxWidth: '92vw' }" class="theme-dialog">
      <div class="space-y-4">
        <div class="text-sm text-[var(--content-text-secondary)]">
          为
          <span class="font-medium text-[var(--content-text)]">{{ editingItem?.name || '当前文件' }}</span>
          设置多个不重叠的页码范围。
        </div>
        <div class="space-y-3">
          <div v-for="(range, index) in editingRanges" :key="`${index}-${range.start}-${range.end}`" class="range-row">
            <div class="text-sm text-[var(--content-text-secondary)]">第 {{ index + 1 }} 段</div>
            <input v-model="range.start" type="number" min="1" class="pdf-range-input" />
            <span class="text-sm text-[var(--content-text-secondary)]">-</span>
            <input v-model="range.end" type="number" min="1" class="pdf-range-input" />
            <Button icon="pi pi-trash" text rounded severity="secondary" aria-label="删除范围" @click="removeEditingRange(index)" />
          </div>
        </div>
        <Button icon="pi pi-plus" label="新增范围" severity="secondary" @click="addEditingRange" />
      </div>
      <template #footer>
        <div class="flex justify-end gap-2">
          <Button label="取消" text @click="closeRangesEditor" />
          <Button label="保存" @click="saveRangesEditor" />
        </div>
      </template>
    </Dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import Button from 'primevue/button'
import Checkbox from 'primevue/checkbox'
import Dialog from 'primevue/dialog'
import { useToast } from 'primevue/usetoast'
import type {
  SplitPdfFilesResult,
  ToolboxPdfItem,
  ToolboxPdfSplitItem,
  ToolboxPdfSplitMode,
  ToolboxPdfSplitRange,
} from '../../../shared/types/toolbox.types'

const toast = useToast()

const items = ref<ToolboxPdfSplitItem[]>([])
const helpVisible = ref(false)
const settingsVisible = ref(false)
const showClearSelectedDialog = ref(false)
const showGenerateSuccessDialog = ref(false)
const isGenerating = ref(false)
const isDragOver = ref(false)
const dragDepth = ref(0)
const openAfterSave = ref(false)
const lastResult = ref<SplitPdfFilesResult | null>(null)
const rangesEditorVisible = ref(false)
const editingItemId = ref('')
const editingRanges = ref<Array<{ start: number | string; end: number | string }>>([])

const allSelected = computed(() => items.value.length > 0 && items.value.every((item) => item.selected))
const selectedCount = computed(() => items.value.filter((item) => item.selected).length)
const estimatedPageCount = computed(() => items.value.reduce((sum, item) => sum + estimateItemPages(item), 0))
const estimatedFileCount = computed(() => items.value.reduce((sum, item) => sum + estimateItemFileCount(item), 0))
const totalSizeText = computed(() => formatBytes(items.value.reduce((sum, item) => sum + Number(item.size || 0), 0)))
const editingItem = computed(() => items.value.find((item) => item.id === editingItemId.value) || null)
const firstGeneratedFilePath = computed(() => lastResult.value?.generatedFiles?.[0]?.outputPath || '')

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

function getDirectoryPath(filePath: string): string {
  const normalized = String(filePath || '')
  const index = Math.max(normalized.lastIndexOf('/'), normalized.lastIndexOf('\\'))
  return index >= 0 ? normalized.slice(0, index) : normalized
}

function describeRanges(ranges: ToolboxPdfSplitRange[]): string {
  if (!Array.isArray(ranges) || ranges.length === 0) return '未配置范围'
  return ranges.map((range) => `${range.start}-${range.end}`).join('，')
}

function createSplitItem(item: ToolboxPdfItem): ToolboxPdfSplitItem {
  return {
    ...item,
    splitMode: 'max-pages',
    pagesPerChunk: 1,
    customRanges: [{ start: 1, end: item.pageCount }],
  }
}

function mergeItems(existing: ToolboxPdfSplitItem[], incoming: ToolboxPdfItem[]): ToolboxPdfSplitItem[] {
  const seen = new Set(existing.map((item) => item.path))
  const merged = [...existing]
  for (const item of incoming) {
    if (!item.path || seen.has(item.path)) continue
    seen.add(item.path)
    merged.push(createSplitItem(item))
  }
  return merged
}

function estimateItemPages(item: ToolboxPdfSplitItem): number {
  if (item.splitMode === 'max-pages') return item.pageCount
  return item.customRanges.reduce((sum, range) => sum + Math.max(0, Number(range.end) - Number(range.start) + 1), 0)
}

function estimateItemFileCount(item: ToolboxPdfSplitItem): number {
  if (item.splitMode === 'max-pages') {
    const pagesPerChunk = Math.max(1, Math.round(Number(item.pagesPerChunk) || 1))
    return Math.ceil(item.pageCount / pagesPerChunk)
  }
  return Math.max(0, item.customRanges.length)
}

async function inspectPdfPaths(filePaths: string[]): Promise<void> {
  const normalizedPaths = Array.from(new Set(filePaths.map((item) => String(item || '').trim()).filter(Boolean)))
  if (normalizedPaths.length === 0) return

  const result = await window.electronAPI.toolbox.inspectPdfFiles({
    filePaths: normalizedPaths,
  })
  if (!result.success || !result.data) {
    throw new Error(result.error || '读取 PDF 信息失败')
  }

  const beforeCount = items.value.length
  items.value = mergeItems(items.value, result.data.items)
  const addedCount = items.value.length - beforeCount
  if (addedCount === 0) {
    toast.add({ severity: 'info', summary: '未新增文件', detail: '导入的 PDF 已存在于当前列表中。', life: 3000 })
    return
  }
  toast.add({ severity: 'success', summary: 'PDF 已加入', detail: `已加入 ${addedCount} 个 PDF。`, life: 2500 })
}

async function handleAddFiles(): Promise<void> {
  const result = await window.electronAPI.fs.selectFile({
    properties: ['openFile', 'multiSelections'],
    filters: [{ name: 'PDF 文件', extensions: ['pdf'] }],
  })

  if (!result.success || !result.data || result.data.canceled) return

  const filePaths = Array.isArray(result.data.filePaths)
    ? result.data.filePaths.map((item: unknown) => String(item || '').trim()).filter(Boolean)
    : []
  if (filePaths.length === 0) return

  try {
    await inspectPdfPaths(filePaths)
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: '导入失败',
      detail: error instanceof Error ? error.message : '无法读取所选 PDF 文件。',
      life: 4500,
    })
  }
}

function toggleSelectAll(value: unknown): void {
  const checked = Boolean(value)
  items.value = items.value.map((item) => ({ ...item, selected: checked }))
}

function requestClearSelected(): void {
  if (selectedCount.value === 0) return
  showClearSelectedDialog.value = true
}

function confirmClearSelected(): void {
  items.value = items.value.filter((item) => !item.selected)
  showClearSelectedDialog.value = false
}

function removeItem(id: string): void {
  items.value = items.value.filter((item) => item.id !== id)
}

function updateSplitMode(id: string, value: string): void {
  const item = items.value.find((entry) => entry.id === id)
  if (!item) return
  const mode = value === 'custom-ranges' ? 'custom-ranges' : 'max-pages'
  item.splitMode = mode as ToolboxPdfSplitMode
  if (mode === 'custom-ranges' && item.customRanges.length === 0) {
    item.customRanges = [{ start: 1, end: item.pageCount }]
  }
}

function updatePagesPerChunk(id: string, rawValue: string): void {
  const item = items.value.find((entry) => entry.id === id)
  if (!item) return
  const parsed = Number(rawValue)
  item.pagesPerChunk = Number.isFinite(parsed) ? Math.round(parsed) : 1
}

function normalizePagesPerChunk(id: string): void {
  const item = items.value.find((entry) => entry.id === id)
  if (!item) return
  item.pagesPerChunk = Math.min(item.pageCount, Math.max(1, Math.round(Number(item.pagesPerChunk) || 1)))
}

function openRangesEditor(id: string): void {
  const item = items.value.find((entry) => entry.id === id)
  if (!item) return
  editingItemId.value = id
  editingRanges.value = item.customRanges.length > 0
    ? item.customRanges.map((range) => ({ start: range.start, end: range.end }))
    : [{ start: 1, end: item.pageCount }]
  rangesEditorVisible.value = true
}

function closeRangesEditor(): void {
  rangesEditorVisible.value = false
  editingItemId.value = ''
  editingRanges.value = []
}

function addEditingRange(): void {
  const maxEnd = editingItem.value?.pageCount || 1
  editingRanges.value.push({ start: 1, end: maxEnd })
}

function removeEditingRange(index: number): void {
  editingRanges.value.splice(index, 1)
}

function normalizeRangesForItem(ranges: Array<{ start: number | string; end: number | string }>, pageCount: number): ToolboxPdfSplitRange[] {
  if (ranges.length === 0) {
    throw new Error('请至少配置一个页码范围')
  }
  const normalized = ranges.map((range, index) => {
    const start = Number(range.start)
    const end = Number(range.end)
    if (!Number.isInteger(start) || start <= 0) {
      throw new Error(`第 ${index + 1} 段起始页必须是大于 0 的整数`)
    }
    if (!Number.isInteger(end) || end <= 0) {
      throw new Error(`第 ${index + 1} 段结束页必须是大于 0 的整数`)
    }
    if (start > end) {
      throw new Error(`第 ${index + 1} 段页码范围无效`)
    }
    if (end > pageCount) {
      throw new Error(`第 ${index + 1} 段页码范围超出总页数`)
    }
    return { start, end }
  })

  const sorted = [...normalized].sort((left, right) => left.start - right.start || left.end - right.end)
  for (let index = 1; index < sorted.length; index += 1) {
    if (sorted[index].start <= sorted[index - 1].end) {
      throw new Error('自定义范围不允许重叠')
    }
  }

  return normalized
}

function saveRangesEditor(): void {
  const item = editingItem.value
  if (!item) return
  try {
    item.customRanges = normalizeRangesForItem(editingRanges.value, item.pageCount)
    closeRangesEditor()
  } catch (error) {
    toast.add({
      severity: 'warn',
      summary: '范围无效',
      detail: error instanceof Error ? error.message : '请检查页码范围。',
      life: 4000,
    })
  }
}

function buildPayloadFiles(): ToolboxPdfSplitItem[] {
  return items.value.map((item) => {
    normalizePagesPerChunk(item.id)
    if (item.splitMode === 'custom-ranges') {
      item.customRanges = normalizeRangesForItem(item.customRanges, item.pageCount)
    }
    return {
      ...item,
      pagesPerChunk: Math.min(item.pageCount, Math.max(1, Math.round(Number(item.pagesPerChunk) || 1))),
      customRanges: item.customRanges.map((range) => ({ start: Number(range.start), end: Number(range.end) })),
    }
  })
}

async function handleSplitPdf(): Promise<void> {
  if (items.value.length === 0) {
    toast.add({ severity: 'warn', summary: '无法导出', detail: '请先添加至少一个 PDF。', life: 3000 })
    return
  }

  let payloadFiles: ToolboxPdfSplitItem[]
  try {
    payloadFiles = buildPayloadFiles()
  } catch (error) {
    toast.add({
      severity: 'warn',
      summary: '配置无效',
      detail: error instanceof Error ? error.message : '请检查拆分设置。',
      life: 4000,
    })
    return
  }

  const selectResult = await window.electronAPI.fs.selectFile({
    properties: ['openDirectory'],
  })
  if (!selectResult.success || !selectResult.data || selectResult.data.canceled) return

  const outputDir = Array.isArray(selectResult.data.filePaths)
    ? String(selectResult.data.filePaths[0] || '').trim()
    : ''
  if (!outputDir) return

  isGenerating.value = true
  try {
    const result = await window.electronAPI.toolbox.splitPdfFiles({
      files: payloadFiles,
      outputDir,
      openAfterSave: openAfterSave.value,
    })
    if (!result.success || !result.data) {
      throw new Error(result.error || '拆分 PDF 失败')
    }
    lastResult.value = result.data
    showGenerateSuccessDialog.value = true
    toast.add({ severity: 'success', summary: 'PDF 已拆分', detail: `已生成 ${result.data.fileCount} 个 PDF 文件。`, life: 3500 })
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: '拆分失败',
      detail: error instanceof Error ? error.message : '拆分 PDF 时发生错误。',
      life: 5000,
    })
  } finally {
    isGenerating.value = false
  }
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
    .map((entry) => normalizeDroppedPath(entry))
  const plainTextPaths = String(dataTransfer.getData('text/plain') || '')
    .split(/[\r\n]+/)
    .map((entry) => normalizeDroppedPath(entry))

  return {
    paths: Array.from(new Set([...candidatePaths, ...uriListPaths, ...plainTextPaths].filter((entry) => entry && isPdfPath(entry)))),
    detectedFileCount: files.length || itemsList.filter((item) => item.kind === 'file').length,
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

  try {
    await inspectPdfPaths(paths)
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: '导入失败',
      detail: error instanceof Error ? error.message : '拖入的 PDF 无法读取。',
      life: 4500,
    })
  }
}

async function handleCopyFirstGeneratedFile(): Promise<void> {
  if (!firstGeneratedFilePath.value) return
  await window.electronAPI.fs.clipboardWriteFile(firstGeneratedFilePath.value)
  showGenerateSuccessDialog.value = false
}

async function handleOpenGeneratedFolder(): Promise<void> {
  const dirPath = lastResult.value?.outputDir || getDirectoryPath(firstGeneratedFilePath.value)
  if (!dirPath) return
  await window.electronAPI.fs.openFolder(dirPath)
  showGenerateSuccessDialog.value = false
}

function toggleSettings(): void {
  settingsVisible.value = !settingsVisible.value
}

function toggleHelp(): void {
  helpVisible.value = !helpVisible.value
}

defineExpose({
  handleAddFiles,
  requestClearSelected,
  toggleSettings,
  toggleHelp,
  settingsVisible,
  helpVisible,
  isGenerating,
})
</script>

<style scoped>
.pdf-table-header,
.pdf-table-row {
  display: grid;
  grid-template-columns: 64px minmax(0, 1fr) 88px 148px 220px 120px;
  gap: 0;
  align-items: center;
}

.pdf-table-header {
  position: sticky;
  top: 0;
  z-index: 1;
  background: color-mix(in srgb, var(--content-card-bg) 92%, white 8%);
  border-bottom: 1px solid var(--content-border);
}

.pdf-table-row {
  border-bottom: 1px solid color-mix(in srgb, var(--content-border) 82%, transparent);
}

.pdf-table-row:last-child {
  border-bottom: none;
}

.pdf-table-cell {
  padding: 1rem 1.1rem;
}

.pdf-table-cell--checkbox {
  display: flex;
  justify-content: center;
}

.pdf-table-cell--pages {
  text-align: center;
}

.pdf-table-cell--actions {
  text-align: right;
}

.pdf-range-input,
.pdf-select-input {
  width: 100%;
  border: 1px solid var(--content-border);
  border-radius: 0.75rem;
  background: rgba(255, 255, 255, 0.92);
  padding: 0.55rem 0.75rem;
  color: var(--content-text);
  outline: none;
}

.pdf-range-input {
  width: 72px;
  text-align: center;
}

.pdf-select-input:focus,
.pdf-range-input:focus {
  border-color: color-mix(in srgb, var(--primary-color) 45%, var(--content-border));
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--primary-color) 16%, transparent);
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
  border: 2px dashed rgba(239, 68, 68, 0.38);
  border-radius: 1.5rem;
  background: rgba(254, 242, 242, 0.92);
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
  border: 1px solid rgba(14, 165, 233, 0.22);
  border-radius: 0.9rem;
  background: rgba(239, 246, 255, 0.96);
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

.range-row {
  display: grid;
  grid-template-columns: 64px 88px 24px 88px 44px;
  gap: 0.5rem;
  align-items: center;
}
</style>
