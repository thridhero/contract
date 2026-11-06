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
            {{ items.length === 0 ? '支持多选 PDF、拖拽导入，并为每个文件单独设置输出页码范围。' : `当前总页数 ${totalPageCount} 页，预计输出 ${mergedPageCount} 页。` }}
          </p>
        </div>
        <div class="rounded-2xl border px-4 py-3 text-right" :style="statCardStyle">
          <div class="text-xs uppercase tracking-[0.18em] text-[var(--content-text-secondary)]">合并摘要</div>
          <div class="mt-2 text-lg font-semibold text-[var(--content-text)]">{{ mergedPageCount }} 页</div>
          <div class="mt-1 text-sm text-[var(--content-text-secondary)]">{{ totalSizeText }}</div>
        </div>
      </div>

      <div v-if="items.length === 0" class="mt-5 flex min-h-0 flex-1 items-center justify-center rounded-3xl border border-dashed px-6 text-center" :style="emptyStateStyle">
        <div>
          <div class="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-red-50 text-2xl text-red-500">
            <i class="pi pi-file-pdf"></i>
          </div>
          <div class="mt-4 text-base font-medium text-[var(--content-text)]">还没有待合并的 PDF</div>
          <p class="mt-2 text-sm text-[var(--content-text-secondary)]">
            点击“添加文件”或把本地 PDF 拖进来，列表会按当前顺序参与合并。
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
          <div class="pdf-table-cell pdf-table-cell--range">输出范围</div>
          <div class="pdf-table-cell pdf-table-cell--actions">操作</div>
        </div>

        <div v-for="(item, index) in items" :key="item.id" class="pdf-table-row">
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
          <div class="pdf-table-cell pdf-table-cell--range">
            <div class="flex items-center gap-2">
              <input
                :value="item.rangeStart"
                type="number"
                min="1"
                :max="item.pageCount"
                class="pdf-range-input"
                @change="updateRange(item.id, 'rangeStart', ($event.target as HTMLInputElement).value)"
                @blur="normalizeRange(item.id)"
              />
              <span class="text-sm text-[var(--content-text-secondary)]">-</span>
              <input
                :value="item.rangeEnd"
                type="number"
                min="1"
                :max="item.pageCount"
                class="pdf-range-input"
                @change="updateRange(item.id, 'rangeEnd', ($event.target as HTMLInputElement).value)"
                @blur="normalizeRange(item.id)"
              />
            </div>
          </div>
          <div class="pdf-table-cell pdf-table-cell--actions">
            <div class="flex items-center justify-end gap-1">
              <Button icon="pi pi-arrow-up" text rounded severity="secondary" aria-label="上移" :disabled="index === 0" @click="moveItem(index, -1)" />
              <Button icon="pi pi-arrow-down" text rounded severity="secondary" aria-label="下移" :disabled="index === items.length - 1" @click="moveItem(index, 1)" />
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
      勾选框仅用于“清除选中”，不会影响最终合并顺序；合并始终按当前列表顺序执行。
    </div>
    <div v-if="helpVisible" class="help-callout help-callout--b">
      每个文件的起止页独立生效，留空或越界时会自动纠正为有效范围。
    </div>

    <div class="pdf-toolbar">
      <div class="pdf-toolbar__row">
        <Button icon="pi pi-plus" label="添加文件" severity="secondary" @click="handleAddFiles" />
        <Button icon="pi pi-trash" label="清除选中" severity="secondary" :disabled="selectedCount === 0" @click="requestClearSelected" />
        <div class="min-w-[120px] text-center text-sm text-[var(--content-text-secondary)]">
          已选 {{ selectedCount }}/{{ items.length }}
        </div>
        <Button icon="pi pi-cog" label="设置" severity="secondary" @click="toggleSettings" />
        <Button label="合并导出" :loading="isGenerating" :disabled="items.length === 0" @click="handleMergePdf" />
      </div>
    </div>

    <Dialog
      v-model:visible="showClearSelectedDialog"
      modal
      header="确认清除选中"
      :style="{ width: '420px', maxWidth: '92vw' }"
      class="theme-dialog"
    >
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

    <Dialog
      v-model:visible="settingsVisible"
      modal
      header="导出设置"
      :style="{ width: '460px', maxWidth: '92vw' }"
      class="theme-dialog"
    >
      <div class="space-y-5">
        <label class="block">
          <div class="mb-2 text-sm font-medium text-[var(--content-text)]">默认输出文件名</div>
          <input v-model="defaultOutputName" type="text" class="pdf-settings-input" />
        </label>
        <label class="flex items-center gap-3">
          <Checkbox v-model="openAfterSave" binary />
          <span class="text-sm text-[var(--content-text)]">导出完成后自动打开文件</span>
        </label>
      </div>
      <template #footer>
        <div class="flex justify-end gap-2">
          <Button label="关闭" @click="settingsVisible = false" />
        </div>
      </template>
    </Dialog>

    <Dialog
      v-model:visible="showGenerateSuccessDialog"
      modal
      header="文件已生成"
      :style="{ width: '520px', maxWidth: '92vw' }"
      class="theme-dialog"
    >
      <div class="text-sm leading-7 text-[var(--content-text-secondary)]">
        <div class="font-medium text-[var(--content-text)]">{{ lastResult?.outputPath }}</div>
        <div class="mt-2">
          共 {{ lastResult?.pageCount || 0 }} 页 · {{ formatBytes(lastResult?.fileSize || 0) }}
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
import { computed, ref } from 'vue'
import Button from 'primevue/button'
import Checkbox from 'primevue/checkbox'
import Dialog from 'primevue/dialog'
import { useToast } from 'primevue/usetoast'
import type { MergePdfFilesResult, ToolboxPdfItem } from '../../../shared/types/toolbox.types'

const toast = useToast()

const items = ref<ToolboxPdfItem[]>([])
const helpVisible = ref(false)
const settingsVisible = ref(false)
const showClearSelectedDialog = ref(false)
const showGenerateSuccessDialog = ref(false)
const isGenerating = ref(false)
const isDragOver = ref(false)
const dragDepth = ref(0)
const defaultOutputName = ref('PDF合并.pdf')
const openAfterSave = ref(false)
const lastResult = ref<MergePdfFilesResult | null>(null)

const allSelected = computed(() => items.value.length > 0 && items.value.every((item) => item.selected))
const selectedCount = computed(() => items.value.filter((item) => item.selected).length)
const totalPageCount = computed(() => items.value.reduce((sum, item) => sum + item.pageCount, 0))
const mergedPageCount = computed(() => items.value.reduce((sum, item) => sum + Math.max(0, item.rangeEnd - item.rangeStart + 1), 0))
const totalSizeText = computed(() => formatBytes(items.value.reduce((sum, item) => sum + Number(item.size || 0), 0)))

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

function mergeItems(existing: ToolboxPdfItem[], incoming: ToolboxPdfItem[]): ToolboxPdfItem[] {
  const seen = new Set(existing.map((item) => item.path))
  const merged = [...existing]
  for (const item of incoming) {
    if (!item.path || seen.has(item.path)) continue
    seen.add(item.path)
    merged.push(item)
  }
  return merged
}

async function inspectPdfPaths(filePaths: string[]): Promise<void> {
  const normalizedPaths = Array.from(new Set(filePaths.map((item) => String(item || '').trim()).filter(Boolean)))
  if (normalizedPaths.length === 0) {
    return
  }

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

  if (!result.success || !result.data || result.data.canceled) {
    return
  }

  const filePaths = Array.isArray(result.data.filePaths)
    ? result.data.filePaths.map((item: unknown) => String(item || '').trim()).filter(Boolean)
    : []

  if (filePaths.length === 0) {
    return
  }

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

function moveItem(index: number, step: number): void {
  const targetIndex = index + step
  if (targetIndex < 0 || targetIndex >= items.value.length) {
    return
  }

  const next = [...items.value]
  const [moved] = next.splice(index, 1)
  next.splice(targetIndex, 0, moved)
  items.value = next
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function updateRange(id: string, field: 'rangeStart' | 'rangeEnd', rawValue: string): void {
  const item = items.value.find((entry) => entry.id === id)
  if (!item) return

  const parsed = Number(rawValue)
  if (!Number.isFinite(parsed)) {
    item[field] = field === 'rangeStart' ? 1 : item.pageCount
    normalizeRange(id)
    return
  }

  item[field] = clamp(Math.round(parsed), 1, item.pageCount)
  normalizeRange(id)
}

function normalizeRange(id: string): void {
  const item = items.value.find((entry) => entry.id === id)
  if (!item) return

  item.rangeStart = clamp(Math.round(Number(item.rangeStart) || 1), 1, item.pageCount)
  item.rangeEnd = clamp(Math.round(Number(item.rangeEnd) || item.pageCount), 1, item.pageCount)
  if (item.rangeStart > item.rangeEnd) {
    if (item.rangeStart >= item.pageCount) {
      item.rangeStart = item.pageCount
      item.rangeEnd = item.pageCount
    } else {
      item.rangeEnd = item.rangeStart
    }
  }
}

function buildDefaultPdfName(): string {
  const proposed = String(defaultOutputName.value || '').trim()
  if (!proposed) return 'PDF合并.pdf'
  return proposed.toLowerCase().endsWith('.pdf') ? proposed : `${proposed}.pdf`
}

async function handleMergePdf(): Promise<void> {
  if (items.value.length === 0) {
    toast.add({ severity: 'warn', summary: '无法导出', detail: '请先添加至少一个 PDF。', life: 3000 })
    return
  }

  items.value.forEach((item) => normalizeRange(item.id))

  const saveResult = await window.electronAPI.fs.saveFile({
    defaultPath: buildDefaultPdfName(),
    filters: [{ name: 'PDF 文件', extensions: ['pdf'] }],
  })

  if (!saveResult.success || !saveResult.data || saveResult.data.canceled || !saveResult.data.filePath) {
    return
  }

  isGenerating.value = true
  try {
    const result = await window.electronAPI.toolbox.mergePdfFiles({
      files: items.value.map((item) => ({
        ...item,
      })),
      outputPath: String(saveResult.data.filePath),
      openAfterSave: openAfterSave.value,
    })

    if (!result.success || !result.data) {
      throw new Error(result.error || '合并 PDF 失败')
    }

    lastResult.value = result.data
    showGenerateSuccessDialog.value = true
    toast.add({ severity: 'success', summary: 'PDF 已生成', detail: `已生成 ${result.data.pageCount} 页 PDF。`, life: 3500 })
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: '合并失败',
      detail: error instanceof Error ? error.message : '合并 PDF 时发生错误。',
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

async function openGeneratedFile(): Promise<void> {
  if (!lastResult.value?.outputPath) return
  await window.electronAPI.fs.openFile(lastResult.value.outputPath)
}

async function copyGeneratedFile(): Promise<void> {
  if (!lastResult.value?.outputPath) return
  await window.electronAPI.fs.clipboardWriteFile(lastResult.value.outputPath)
}

async function openGeneratedFolder(): Promise<void> {
  if (!lastResult.value?.outputPath) return
  await window.electronAPI.fs.openFolder(getDirectoryPath(lastResult.value.outputPath))
}

async function handleOpenGeneratedFile(): Promise<void> {
  await openGeneratedFile()
  showGenerateSuccessDialog.value = false
}

async function handleCopyGeneratedFile(): Promise<void> {
  await copyGeneratedFile()
  showGenerateSuccessDialog.value = false
}

async function handleOpenGeneratedFolder(): Promise<void> {
  await openGeneratedFolder()
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
  grid-template-columns: 64px minmax(0, 1fr) 96px 180px 156px;
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
.pdf-settings-input {
  width: 100%;
  border: 1px solid var(--content-border);
  border-radius: 0.75rem;
  background: color-mix(in srgb, var(--content-bg) 82%, var(--content-card-bg) 18%);
  padding: 0.55rem 0.75rem;
  color: var(--content-text);
  outline: none;
}

.pdf-range-input {
  width: 64px;
  text-align: center;
}

.pdf-range-input:focus,
.pdf-settings-input:focus {
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
  border: 1px solid color-mix(in srgb, var(--content-border) 82%, transparent);
  border-radius: 9999px;
  background: color-mix(in srgb, var(--content-card-bg) 88%, var(--content-bg) 12%);
  box-shadow: 0 14px 28px color-mix(in srgb, black 16%, transparent);
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
  border: 2px dashed color-mix(in srgb, var(--p-red-500) 42%, transparent);
  border-radius: 1.5rem;
  background: color-mix(in srgb, var(--content-card-bg) 78%, var(--p-red-500) 22%);
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
  border: 1px solid color-mix(in srgb, var(--p-sky-500) 28%, var(--content-border));
  border-radius: 0.9rem;
  background: color-mix(in srgb, var(--content-card-bg) 78%, var(--p-sky-500) 22%);
  color: var(--content-text-secondary);
  font-size: 0.9rem;
  line-height: 1.6;
  box-shadow: 0 12px 28px color-mix(in srgb, black 12%, transparent);
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
