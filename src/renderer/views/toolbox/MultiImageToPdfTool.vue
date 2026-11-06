<template>
  <div
    class="relative flex h-full min-h-0 flex-col"
    :class="{ 'gallery-dropzone--active': isDragOver }"
    @dragenter.prevent="handleDragEnter"
    @dragover.prevent="handleDragOverPanel"
    @dragleave.prevent="handleDragLeave"
    @drop.prevent="handleDropFiles"
  >
    <section
      ref="galleryPanelRef"
      class="flex min-h-0 flex-1 flex-col p-1 outline-none"
      tabindex="0"
      @keydown="handleGalleryKeydown"
      @wheel="handleGalleryWheel"
    >
      <div class="flex items-center justify-between gap-4">
        <div>
          <h3 class="mt-2 text-xl font-semibold text-[var(--content-text)]">
            {{ items.length === 0 ? '等待导入图片' : `已导入 ${items.length} 张图片` }}
          </h3>
        </div>
        <div class="text-sm text-[var(--content-text-secondary)]">
          <template v-if="selectedItem">{{ selectedItem.name }}</template>
          <template v-else-if="items.length > 0">{{ items.length }} 张图片 · {{ totalSizeText }}</template>
          <template v-else>暂无选中</template>
        </div>
      </div>

      <div v-if="items.length === 0" class="mt-5 flex min-h-0 flex-1 items-center justify-center rounded-3xl px-6 text-center">
        <div>
          <div class="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl text-2xl text-[var(--content-text-secondary)]">
            <i class="pi pi-image"></i>
          </div>
          <div class="mt-4 text-base font-medium text-[var(--content-text)]">暂时还没有图片</div>
          <p class="mt-2 text-sm text-[var(--content-text-secondary)]">
            从右上角添加图片或导入目录后，这里会直接以平铺方式展示全部图片。
          </p>
        </div>
      </div>

      <div v-else class="mt-5 min-h-0 flex-1 overflow-auto pr-1">
        <div class="gallery-grid" :style="{ gridTemplateColumns: `repeat(auto-fill, minmax(${tileWidth}px, 1fr))` }">
          <button
            v-for="(item, index) in items"
            :key="item.id"
            type="button"
            class="gallery-tile"
            :class="{
              'gallery-tile--active': selectedItem?.id === item.id,
              'gallery-tile--dragging': draggedItemId === item.id,
            }"
            draggable="true"
            @click="selectItem(item.id)"
            @dblclick="openViewer(item.id)"
            @dragstart="onDragStart(item.id)"
            @dragend="onDragEnd"
            @dragover.prevent="onDragOver(item.id)"
            @drop.prevent="onDrop(item.id)"
          >
            <div class="gallery-tile__image-wrap">
              <img :src="getPreviewUrl(item)" :alt="item.name" class="gallery-tile__image" />
            </div>
            <div class="mt-3">
              <div class="flex items-center justify-between gap-3">
                <div class="min-w-0 truncate text-sm font-medium text-[var(--content-text)]">{{ item.name }}</div>
                <Button icon="pi pi-times" text rounded severity="secondary" aria-label="删除" @click.stop="removeItem(item.id)" />
              </div>
            </div>
          </button>
        </div>
      </div>

    </section>

    <div v-if="isDragOver" class="gallery-dropzone-overlay">
      <div class="gallery-dropzone-overlay__content">
        <i class="pi pi-images text-2xl"></i>
        <div class="mt-3 text-base font-medium">松开鼠标即可导入图片</div>
        <div class="mt-1 text-sm text-[var(--content-text-secondary)]">支持一次拖入多张图片</div>
      </div>
    </div>

    <div v-if="helpVisible" class="help-callout help-callout--a">
      单击选中，双击或按空格打开大图；方向键可切换选中图片。
    </div>
    <div v-if="helpVisible" class="help-callout help-callout--b">
      支持拖动缩略图排序，按当前顺序逐页输出；按住 Ctrl 并滚轮可缩放主面板图片。
    </div>
    <div v-if="helpVisible" class="help-callout help-callout--c">
      当前主面板会直接平铺展示所有图片。
    </div>

    <div class="floating-toolbar">
      <div class="floating-toolbar__row">
        <Button icon="pi pi-minus" text rounded severity="secondary" aria-label="缩小图片" @click="zoomOutGrid()" />
        <input v-model="previewZoom" type="range" min="60" max="300" step="10" class="toolbox-range w-32" />
        <span class="min-w-[48px] text-right text-sm text-[var(--content-text-secondary)]">{{ previewZoom }}%</span>
        <Button icon="pi pi-plus" text rounded severity="secondary" aria-label="放大图片" @click="zoomInGrid()" />
        <Button
          label="导出 PDF"
          size="small"
          :loading="isGenerating"
          :disabled="items.length === 0"
          @click="handleGeneratePdf"
        />
      </div>
    </div>

    <Dialog
      v-model:visible="showDeleteConfirmDialog"
      modal
      header="确认删除图片"
      :style="{ width: '420px', maxWidth: '92vw' }"
      class="theme-dialog"
    >
      <div class="text-sm leading-7 text-[var(--content-text-secondary)]">
        确认删除当前选中的图片
        <span class="font-medium text-[var(--content-text)]">{{ pendingDeleteItemName }}</span>
        吗？
      </div>
      <template #footer>
        <div class="flex justify-end gap-2">
          <Button label="取消" text @click="cancelDelete" />
          <Button label="删除" severity="danger" @click="confirmDelete" />
        </div>
      </template>
    </Dialog>

    <Dialog
      v-model:visible="showClearAllConfirmDialog"
      modal
      header="确认清空图片"
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

    <Dialog
      v-model:visible="viewerVisible"
      modal
      dismissableMask
      :closable="true"
      :header="viewerItem?.name || '图片查看'"
      :style="{ width: '90vw', maxWidth: '1400px' }"
      class="theme-dialog image-viewer-dialog"
      @show="focusViewer"
    >
      <div
        ref="viewerPanelRef"
        class="relative flex h-[72vh] items-center justify-center overflow-auto rounded-3xl border bg-[linear-gradient(135deg,rgba(241,245,249,0.92),rgba(255,255,255,0.98))] p-6 outline-none"
        :style="{ borderColor: 'var(--content-border)' }"
        tabindex="0"
        @keydown="handleViewerKeydown"
      >
        <img
          v-if="viewerItem"
          :src="viewerPreviewUrl"
          :alt="viewerItem.name"
          class="max-h-full max-w-full rounded-2xl border bg-white shadow-lg"
          :style="{
            borderColor: 'var(--content-border)',
            transform: `scale(${viewerZoom / 100})`,
            transformOrigin: 'center center',
            transition: 'transform 0.2s ease',
          }"
        />

        <div class="viewer-toolbar">
          <Button icon="pi pi-minus" text rounded severity="secondary" aria-label="缩小" @click="zoomOutViewer" />
          <span class="min-w-[56px] text-center text-sm text-[var(--content-text)]">{{ viewerZoom }}%</span>
          <Button icon="pi pi-plus" text rounded severity="secondary" aria-label="放大" @click="zoomInViewer" />
        </div>
      </div>
    </Dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import Dialog from 'primevue/dialog'
import { useToast } from 'primevue/usetoast'
import type { CreateImagePdfResult, ToolboxImageItem } from '../../../shared/types/toolbox.types'
import Button from 'primevue/button'

const toast = useToast()

const items = ref<ToolboxImageItem[]>([])
const selectedId = ref<string>('')
const previewZoom = ref(100)
const draggedItemId = ref<string>('')
const isGenerating = ref(false)
const lastResult = ref<CreateImagePdfResult | null>(null)
const previewUrlMap = ref<Record<string, string>>({})
const helpVisible = ref(false)
const showDeleteConfirmDialog = ref(false)
const showClearAllConfirmDialog = ref(false)
const pendingDeleteId = ref('')
const showGenerateSuccessDialog = ref(false)
const isDragOver = ref(false)
const dragDepth = ref(0)

const viewerVisible = ref(false)
const viewerId = ref('')
const viewerZoom = ref(100)
const galleryPanelRef = ref<HTMLElement | null>(null)
const viewerPanelRef = ref<HTMLElement | null>(null)

const selectedItem = computed(() => items.value.find((item) => item.id === selectedId.value) || null)
const viewerItem = computed(() => items.value.find((item) => item.id === viewerId.value) || null)
const totalSizeText = computed(() => formatBytes(items.value.reduce((sum, item) => sum + Number(item.size || 0), 0)))
const tileWidth = computed(() => Math.round(160 * (previewZoom.value / 100)))
const viewerPreviewUrl = computed(() => (viewerItem.value ? getPreviewUrl(viewerItem.value) : ''))
const pendingDeleteItemName = computed(() => items.value.find((item) => item.id === pendingDeleteId.value)?.name || '')

watch(
  items,
  (nextItems) => {
    if (nextItems.length === 0) {
      selectedId.value = ''
      viewerId.value = ''
      viewerVisible.value = false
      return
    }
    if (!nextItems.some((item) => item.id === selectedId.value)) {
      selectedId.value = nextItems[0].id
    }
    if (viewerVisible.value && !nextItems.some((item) => item.id === viewerId.value)) {
      viewerId.value = nextItems[0].id
    }
  },
  { deep: true, immediate: true },
)

watch(
  () => items.value.map((item) => item.id),
  (ids, oldIds = []) => {
    const removed = oldIds.filter((id) => !ids.includes(id))
    for (const id of removed) {
      revokePreviewUrl(previewUrlMap.value, id)
    }
  },
)

const supportedImageFilter = {
  name: '图片文件',
  extensions: ['png', 'jpg', 'jpeg', 'webp', 'bmp', 'gif'],
}

const supportedImageExtensions = new Set(['.png', '.jpg', '.jpeg', '.webp', '.bmp', '.gif'])

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

function getFileName(filePath: string): string {
  const normalized = String(filePath || '')
  const index = Math.max(normalized.lastIndexOf('/'), normalized.lastIndexOf('\\'))
  return index >= 0 ? normalized.slice(index + 1) : normalized
}

function buildDefaultPdfName(): string {
  if (items.value.length === 1) {
    const fileName = getFileName(items.value[0].name || items.value[0].path)
    const dotIndex = fileName.lastIndexOf('.')
    return `${dotIndex >= 0 ? fileName.slice(0, dotIndex) : fileName}.pdf`
  }
  return '多图片合并.pdf'
}

function mergeItems(existing: ToolboxImageItem[], incoming: ToolboxImageItem[]): ToolboxImageItem[] {
  const seen = new Set(existing.map((item) => item.path))
  const merged = [...existing]
  for (const item of incoming) {
    if (!item.path || seen.has(item.path)) continue
    seen.add(item.path)
    merged.push(item)
  }
  return merged
}

function getSelectedIndex(): number {
  return items.value.findIndex((item) => item.id === selectedId.value)
}

function selectItem(id: string): void {
  selectedId.value = id
  galleryPanelRef.value?.focus()
}

function moveSelection(step: number): void {
  if (items.value.length === 0) return
  const currentIndex = getSelectedIndex()
  const safeIndex = currentIndex >= 0 ? currentIndex : 0
  const nextIndex = (safeIndex + step + items.value.length) % items.value.length
  selectedId.value = items.value[nextIndex].id
}

function removeItem(id: string): void {
  pendingDeleteId.value = id
  showDeleteConfirmDialog.value = true
}

function cancelDelete(): void {
  showDeleteConfirmDialog.value = false
  pendingDeleteId.value = ''
}

function confirmDelete(): void {
  const id = pendingDeleteId.value
  if (!id) {
    cancelDelete()
    return
  }
  items.value = items.value.filter((item) => item.id !== id)
  cancelDelete()
}

function clearAll(): void {
  items.value = []
  lastResult.value = null
  clearPreviewMap(previewUrlMap.value)
}

function requestClearAll(): void {
  if (items.value.length === 0) return
  showClearAllConfirmDialog.value = true
}

function cancelClearAll(): void {
  showClearAllConfirmDialog.value = false
}

function confirmClearAll(): void {
  clearAll()
  cancelClearAll()
}

function onDragStart(id: string): void {
  draggedItemId.value = id
}

function onDragEnd(): void {
  draggedItemId.value = ''
}

function onDragOver(targetId: string): void {
  if (!draggedItemId.value || draggedItemId.value === targetId) return

  const sourceIndex = items.value.findIndex((item) => item.id === draggedItemId.value)
  const targetIndex = items.value.findIndex((item) => item.id === targetId)
  if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) return

  const next = [...items.value]
  const [moved] = next.splice(sourceIndex, 1)
  next.splice(targetIndex, 0, moved)
  items.value = next
}

function onDrop(targetId: string): void {
  if (!draggedItemId.value || draggedItemId.value === targetId) return
  onDragEnd()
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

  const imageItems = results.filter((item): item is ToolboxImageItem => Boolean(item))
  return {
    items: imageItems,
    skipped: filePaths.length - imageItems.length,
  }
}

async function handleAddImages(): Promise<void> {
  const result = await window.electronAPI.fs.selectFile({
    properties: ['openFile', 'multiSelections'],
    filters: [supportedImageFilter],
  })

  if (!result.success || !result.data || result.data.canceled) {
    return
  }

  const filePaths = Array.isArray(result.data.filePaths) ? result.data.filePaths.map((item: unknown) => String(item || '').trim()).filter(Boolean) : []
  if (filePaths.length === 0) {
    return
  }

  const { items: nextItems, skipped } = await buildManualImageItems(filePaths)
  if (nextItems.length === 0) {
    toast.add({ severity: 'warn', summary: '未导入图片', detail: '所选文件无法读取或不是可用图片。', life: 3500 })
    return
  }

  items.value = mergeItems(items.value, nextItems)
  selectedId.value = nextItems[0]?.id || selectedId.value
  await nextTick()
  galleryPanelRef.value?.focus()

  if (skipped > 0) {
    toast.add({ severity: 'warn', summary: '部分图片已跳过', detail: `有 ${skipped} 张图片无法读取，已自动跳过。`, life: 4000 })
  } else {
    toast.add({ severity: 'success', summary: '图片已加入', detail: `已加入 ${nextItems.length} 张图片。`, life: 2500 })
  }
}

async function handleSelectFolder(): Promise<void> {
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

  const scanResult = await window.electronAPI.toolbox.scanImageFolder({
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
  selectedId.value = scanResult.data.items[0]?.id || selectedId.value
  await nextTick()
  galleryPanelRef.value?.focus()
  toast.add({ severity: 'success', summary: '目录图片已加入', detail: `已加入 ${scanResult.data.items.length} 张图片。`, life: 3000 })
}

function isSupportedImagePath(filePath: string): boolean {
  return supportedImageExtensions.has(getFileExtension(filePath))
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

  const unquoted = value.replace(/^['"]|['"]$/g, '')
  return unquoted.replace(/^file:\/\//i, '').trim()
}

function extractFilePathFromFile(file: File | null | undefined): string {
  if (!file) return ''
  try {
    const fromElectron = window.electronAPI?.fs?.getFilePath?.(file)
    if (typeof fromElectron === 'string' && fromElectron.trim()) {
      return normalizeDroppedPath(fromElectron)
    }
  } catch {
    // ignore and continue with fallbacks
  }

  const maybePath = (file as File & { path?: string }).path
  if (typeof maybePath === 'string' && maybePath.trim()) {
    return normalizeDroppedPath(maybePath)
  }

  return ''
}

function collectDroppedPaths(dataTransfer: DataTransfer | null): { paths: string[]; detectedFileCount: number } {
  if (!dataTransfer) {
    return { paths: [], detectedFileCount: 0 }
  }

  const candidatePaths: string[] = []
  const files = Array.from(dataTransfer.files || [])
  const items = Array.from(dataTransfer.items || [])

  for (const file of files) {
    const path = extractFilePathFromFile(file)
    if (path) {
      candidatePaths.push(path)
    }
  }

  for (const item of items) {
    if (item.kind !== 'file') continue
    const file = item.getAsFile()
    const path = extractFilePathFromFile(file)
    if (path) {
      candidatePaths.push(path)
    }
  }

  const uriListPaths = String(dataTransfer.getData('text/uri-list') || '')
    .split(/\r?\n/)
    .map((item) => normalizeDroppedPath(item))

  const plainTextPaths = String(dataTransfer.getData('text/plain') || '')
    .split(/[\r\n]+/)
    .map((item) => normalizeDroppedPath(item))

  const downloadUrlPaths = String(dataTransfer.getData('DownloadURL') || '')
    .split(/\r?\n/)
    .flatMap((entry) => entry.split(':').slice(2))
    .map((item) => normalizeDroppedPath(item))

  const paths = [...candidatePaths, ...uriListPaths, ...plainTextPaths, ...downloadUrlPaths]
    .filter((filePath) => filePath && isSupportedImagePath(filePath))

  return {
    paths: Array.from(new Set(paths)),
    detectedFileCount: files.length || items.filter((item) => item.kind === 'file').length,
  }
}

function handleDragEnter(): void {
  dragDepth.value += 1
  isDragOver.value = true
}

function handleDragOverPanel(event: DragEvent): void {
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
      summary: '未识别到图片',
      detail: detectedFileCount > 0 ? '已检测到拖入文件，但暂未解析出可导入的图片路径。' : '拖入的内容不是受支持的本地图片文件。',
      life: 3500,
    })
    return
  }
  await addImagePaths(paths)
}

async function handleGeneratePdf(): Promise<void> {
  if (items.value.length === 0) {
    toast.add({ severity: 'warn', summary: '无法生成', detail: '请先添加至少一张图片。', life: 3000 })
    return
  }

  const saveResult = await window.electronAPI.fs.saveFile({
    defaultPath: buildDefaultPdfName(),
    filters: [{ name: 'PDF 文件', extensions: ['pdf'] }],
  })

  if (!saveResult.success || !saveResult.data || saveResult.data.canceled || !saveResult.data.filePath) {
    return
  }

  isGenerating.value = true
  try {
    const payloadImages = items.value.map((item) => ({
      id: item.id,
      name: item.name,
      path: item.path,
      relativePath: item.relativePath,
      width: item.width,
      height: item.height,
      size: item.size,
      source: item.source,
    }))

    const result = await window.electronAPI.toolbox.createImagePdf({
      images: payloadImages,
      outputPath: String(saveResult.data.filePath),
      pagePreset: 'A4',
      marginPx: 24,
    })

    if (!result.success || !result.data) {
      throw new Error(result.error || '生成 PDF 失败')
    }

    lastResult.value = result.data
    showGenerateSuccessDialog.value = true
    toast.add({ severity: 'success', summary: 'PDF 已生成', detail: `已生成 ${result.data.pageCount} 页 PDF。`, life: 3500 })
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: '生成失败',
      detail: error instanceof Error ? error.message : '生成 PDF 时发生错误。',
      life: 5000,
    })
  } finally {
    isGenerating.value = false
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

async function loadPreviewUrl(filePath: string): Promise<string> {
  const result = await window.electronAPI.fs.readFileBytes(filePath)
  if (!result.success || !result.data) {
    throw new Error(result.error || '读取图片失败')
  }
  const ext = getFileExtension(filePath)
  const mimeType = getMimeType(ext)
  const bytes = result.data instanceof Uint8Array ? result.data : new Uint8Array(result.data as any)
  const blob = new Blob([bytes], { type: mimeType })
  return URL.createObjectURL(blob)
}

function getPreviewUrl(item: ToolboxImageItem): string {
  const current = previewUrlMap.value[item.id]
  if (current) return current
  void ensurePreviewUrl(item, previewUrlMap.value)
  return ''
}

async function ensurePreviewUrl(item: ToolboxImageItem, targetMap: Record<string, string>): Promise<void> {
  if (targetMap[item.id]) return
  try {
    const objectUrl = await loadPreviewUrl(item.path)
    targetMap[item.id] = objectUrl
  } catch (error) {
    toast.add({
      severity: 'warn',
      summary: '图片预览失败',
      detail: error instanceof Error ? error.message : `无法预览图片：${item.name}`,
      life: 3000,
    })
  }
}

function getFileExtension(filePath: string): string {
  const fileName = getFileName(filePath)
  const dotIndex = fileName.lastIndexOf('.')
  return dotIndex >= 0 ? fileName.slice(dotIndex).toLowerCase() : ''
}

function getMimeType(ext: string): string {
  if (ext === '.png') return 'image/png'
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg'
  if (ext === '.webp') return 'image/webp'
  if (ext === '.gif') return 'image/gif'
  if (ext === '.bmp') return 'image/bmp'
  return 'application/octet-stream'
}

function revokePreviewUrl(targetMap: Record<string, string>, id: string): void {
  const current = targetMap[id]
  if (current) {
    URL.revokeObjectURL(current)
    delete targetMap[id]
  }
}

function clearPreviewMap(targetMap: Record<string, string>): void {
  for (const key of Object.keys(targetMap)) {
    revokePreviewUrl(targetMap, key)
  }
}

function openViewer(id?: string): void {
  const targetId = id || selectedId.value
  if (!targetId) return
  selectedId.value = targetId
  viewerId.value = targetId
  viewerVisible.value = true
  viewerZoom.value = 100
}

async function focusViewer(): Promise<void> {
  await nextTick()
  viewerPanelRef.value?.focus()
}

function zoomInViewer(): void {
  viewerZoom.value = Math.min(240, viewerZoom.value + 10)
}

function zoomOutViewer(): void {
  viewerZoom.value = Math.max(40, viewerZoom.value - 10)
}

function zoomInGrid(): void {
  previewZoom.value = Math.min(300, previewZoom.value + 10)
}

function zoomOutGrid(): void {
  previewZoom.value = Math.max(60, previewZoom.value - 10)
}

function toggleHelp(): void {
  helpVisible.value = !helpVisible.value
}

function moveViewer(step: number): void {
  if (items.value.length === 0) return
  const currentIndex = items.value.findIndex((item) => item.id === viewerId.value)
  const safeIndex = currentIndex >= 0 ? currentIndex : 0
  const nextIndex = (safeIndex + step + items.value.length) % items.value.length
  const nextId = items.value[nextIndex].id
  viewerId.value = nextId
  selectedId.value = nextId
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return Boolean(target.closest('input, textarea, [contenteditable="true"]'))
}

function handleGalleryKeydown(event: KeyboardEvent): void {
  if (isEditableTarget(event.target)) return
  if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
    event.preventDefault()
    moveSelection(1)
    return
  }
  if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
    event.preventDefault()
    moveSelection(-1)
    return
  }
  if (event.key === ' ' || event.key === 'Spacebar') {
    event.preventDefault()
    openViewer()
    return
  }
  if (event.key === 'Delete') {
    event.preventDefault()
    if (selectedId.value) {
      removeItem(selectedId.value)
    }
  }
}

async function addImagePaths(filePaths: string[]): Promise<void> {
  const normalizedPaths = filePaths.map((item) => String(item || '').trim()).filter(Boolean)
  if (normalizedPaths.length === 0) return

  const { items: nextItems, skipped } = await buildManualImageItems(normalizedPaths)
  if (nextItems.length === 0) {
    toast.add({ severity: 'warn', summary: '未导入图片', detail: '拖入的文件无法读取或不是可用图片。', life: 3500 })
    return
  }

  items.value = mergeItems(items.value, nextItems)
  selectedId.value = nextItems[0]?.id || selectedId.value
  await nextTick()
  galleryPanelRef.value?.focus()

  if (skipped > 0) {
    toast.add({ severity: 'warn', summary: '部分图片已跳过', detail: `有 ${skipped} 张图片无法读取，已自动跳过。`, life: 4000 })
  } else {
    toast.add({ severity: 'success', summary: '图片已加入', detail: `已加入 ${nextItems.length} 张图片。`, life: 2500 })
  }
}

function handleGalleryWheel(event: WheelEvent): void {
  if (!event.ctrlKey) return
  event.preventDefault()
  if (event.deltaY < 0) {
    zoomInGrid()
    return
  }
  if (event.deltaY > 0) {
    zoomOutGrid()
  }
}

function handleViewerKeydown(event: KeyboardEvent): void {
  if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
    event.preventDefault()
    moveViewer(1)
    return
  }
  if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
    event.preventDefault()
    moveViewer(-1)
    return
  }
  if (event.key === '+' || event.key === '=') {
    event.preventDefault()
    zoomInViewer()
    return
  }
  if (event.key === '-' || event.key === '_') {
    event.preventDefault()
    zoomOutViewer()
    return
  }
  if (event.key === 'Escape') {
    viewerVisible.value = false
  }
}

function handleWindowKeydown(event: KeyboardEvent): void {
  if (showDeleteConfirmDialog.value || showClearAllConfirmDialog.value) return
  if (isEditableTarget(event.target)) return
  if (viewerVisible.value) {
    handleViewerKeydown(event)
    return
  }
  if ((event.key === 'Delete' || event.key === 'Backspace') && selectedId.value) {
    event.preventDefault()
    removeItem(selectedId.value)
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleWindowKeydown, true)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleWindowKeydown, true)
  clearPreviewMap(previewUrlMap.value)
})

defineExpose({
  handleAddImages,
  handleSelectFolder,
  requestClearAll,
  handleGeneratePdf,
  zoomInGrid,
  zoomOutGrid,
  toggleHelp,
  previewZoom,
  isGenerating,
  helpVisible,
})
</script>

<style scoped>
.gallery-grid {
  display: grid;
  gap: 1rem;
}

.gallery-dropzone--active {
  position: relative;
}

.gallery-tile {
  border-radius: 1.25rem;
  padding: 0.9rem;
  cursor: grab;
  text-align: left;
  transition: transform 0.2s ease, box-shadow 0.2s ease, background-color 0.2s ease, opacity 0.2s ease;
}

.gallery-tile:active {
  cursor: grabbing;
}

.gallery-tile:hover {
  transform: translateY(-2px);
  box-shadow: 0 18px 30px rgba(15, 23, 42, 0.08);
}

.gallery-tile--active {
  background: rgba(59, 130, 246, 0.08);
  box-shadow: 0 0 0 1px rgba(59, 130, 246, 0.12);
}

.gallery-tile--dragging {
  opacity: 0.35;
  transform: scale(0.96);
}

.gallery-tile__image-wrap {
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  border-radius: 1rem;
  min-height: 180px;
}

.gallery-tile__image {
  max-height: 300px;
  max-width: 100%;
  object-fit: contain;
  border-radius: 0.85rem;
}

.gallery-dropzone-overlay {
  position: absolute;
  inset: 0;
  z-index: 15;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2px dashed rgba(59, 130, 246, 0.45);
  border-radius: 1.5rem;
  background: rgba(239, 246, 255, 0.88);
  backdrop-filter: blur(4px);
  pointer-events: none;
}

.gallery-dropzone-overlay__content {
  text-align: center;
  color: var(--content-text);
}

.viewer-toolbar {
  position: absolute;
  right: 1rem;
  bottom: 1rem;
  display: flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.45rem 0.55rem;
  border: 1px solid var(--content-border);
  border-radius: 9999px;
  background: rgba(255, 255, 255, 0.88);
  box-shadow: 0 12px 24px rgba(15, 23, 42, 0.12);
}

.floating-toolbar {
  position: fixed;
  right: 1.5rem;
  bottom: 1.5rem;
  z-index: 20;
}

.floating-toolbar__row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.55rem 0.75rem;
  border: 1px solid rgba(148, 163, 184, 0.22);
  border-radius: 9999px;
  background: rgba(255, 255, 255, 0.92);
  box-shadow: 0 14px 28px rgba(15, 23, 42, 0.12);
  backdrop-filter: blur(12px);
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
  top: 4.9rem;
  left: 0.75rem;
}

.help-callout--b {
  left: 0.75rem;
  bottom: 7rem;
}

.help-callout--c {
  top: 0.6rem;
  left: 0.75rem;
}

.toolbox-range {
  accent-color: rgb(37, 99, 235);
}
</style>
