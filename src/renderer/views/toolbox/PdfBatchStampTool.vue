<template>
  <div
    class="relative flex h-full min-h-0 flex-col gap-5"
    :class="{ 'pdf-dropzone--active': isDragOver }"
    @dragenter.prevent="handleDragEnter"
    @dragover.prevent="handleDragOver"
    @dragleave.prevent="handleDragLeave"
    @drop.prevent="handleDropFiles"
  >
    <Dialog
      v-model:visible="legalDialogVisible"
      modal
      :closable="legalConfirmed"
      :closeOnEscape="legalConfirmed"
      :dismissableMask="legalConfirmed"
      header="法律风险提示"
      :style="{ width: 'min(560px, calc(100vw - 32px))' }"
    >
      <div class="space-y-4">
        <div class="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm leading-7 text-amber-800">
          <p>禁止用于伪造公章、证件或任何非法用途。</p>
          <p>仅限对本单位合法授权文件进行电子盖章排版与内部流转预览。</p>
          <p>使用本工具产生的一切法律责任由用户自行承担。</p>
        </div>
        <label class="flex cursor-pointer items-start gap-3 rounded-2xl border border-[var(--content-border)] px-4 py-3 text-sm text-[var(--content-text)]">
          <Checkbox v-model="legalAcknowledgeChecked" binary inputId="pdf-stamp-legal-confirm" class="mt-0.5" />
          <span>我已知悉并确认：仅对合法授权文件进行盖章，不用于伪造公章、合同或证件。</span>
        </label>
      </div>
      <template #footer>
        <div class="flex justify-end gap-2">
          <Button v-if="legalConfirmed" label="关闭" severity="secondary" @click="legalDialogVisible = false" />
          <Button label="确定已知" :disabled="!legalAcknowledgeChecked" @click="confirmLegalNotice" />
        </div>
      </template>
    </Dialog>

    <section class="flex min-h-0 flex-1 flex-col">
      <div
        v-if="items.length === 0"
        class="mt-5 flex min-h-[280px] flex-1 cursor-pointer items-center justify-center rounded-3xl border border-dashed px-8 py-14 text-center transition-colors"
        :class="{ 'empty-pdf-dropzone--active': isDragOver }"
        :style="panelStyle"
        role="button"
        tabindex="0"
        @click="handleAddFiles"
        @keyup.enter="handleAddFiles"
        @keyup.space.prevent="handleAddFiles"
        @dragenter.stop.prevent="handleDragEnter"
        @dragover.stop.prevent="handleDragOver"
        @dragleave.stop.prevent="handleDragLeave"
        @drop.stop.prevent="handleDropFiles"
      >
        <div>
          <div class="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-50 text-2xl text-rose-600">
            <i class="pi pi-bookmark"></i>
          </div>
          <div class="mt-4 text-base font-medium text-[var(--content-text)]">还没有待盖章的 PDF</div>
          <p class="mt-2 text-sm text-[var(--content-text-secondary)]">
            点击此处选择 PDF，或从资源管理器拖入多个本地 PDF 到此处，再选择印章图片开始定位。
          </p>
        </div>
      </div>

      <div v-else class="mt-5 grid min-h-0 flex-1 gap-5 xl:grid-cols-[minmax(360px,0.92fr)_minmax(320px,0.82fr)]">
        <article class="flex min-h-0 flex-col overflow-hidden rounded-3xl border p-4" :style="panelStyle">
          <div class="flex items-center justify-between gap-3">
            <div>
              <p class="mt-1 text-sm text-[var(--content-text-secondary)]">
                {{ previewItem ? `预览：${previewItem.name}` : '请先导入 PDF' }}
              </p>
            </div>
            <div class="flex items-center gap-2">
              <Button label="选择印章" size="small" severity="secondary" :disabled="!previewItem" @click="handleSelectStampImage" />
              <Button label="清空坐标" size="small" severity="secondary" :disabled="!placement" @click="clearPlacement" />
            </div>
          </div>

          <div class="relative mt-4 flex h-[clamp(420px,68vh,880px)] min-h-0 flex-col overflow-hidden rounded-2xl border" :style="innerPanelStyle">
            <div class="min-h-0 flex-1 overflow-hidden p-4">
              <div ref="previewScrollRef" class="pdf-preview-scroll mx-auto h-full w-full max-w-[980px] overflow-y-auto overflow-x-hidden pb-16 pr-2">
                <div class="flex w-full flex-col gap-6">
                  <div
                    v-for="pageNumber in previewPageNumbers"
                    :key="pageNumber"
                    :ref="(el) => setPreviewStageRef(el, pageNumber - 1)"
                    class="preview-stage"
                    :class="{ 'preview-stage--placement': placementModeActive }"
                    :style="previewStageStyle"
                    @click="handlePreviewClick($event, pageNumber - 1)"
                  >
                    <canvas
                      :ref="(el) => setPreviewCanvasRef(el, pageNumber - 1)"
                      class="rounded-xl border border-[var(--content-border)] bg-[var(--content-card-bg)] shadow-sm"
                    ></canvas>
                    <div
                      v-if="mode === 'position' && placement && stampPreviewUrl"
                      class="stamp-overlay"
                      :style="getStampOverlayStyle(pageNumber - 1)"
                      @mousedown.stop="startStampDrag($event, pageNumber - 1)"
                    >
                      <img :src="stampPreviewUrl" alt="印章预览" class="stamp-overlay__image" />
                    </div>
                    <div
                      v-else-if="mode === 'seam' && seamPreviewSlices[pageNumber - 1]?.url"
                      class="stamp-overlay"
                      :style="getSeamOverlayStyle(pageNumber - 1)"
                    >
                      <img :src="seamPreviewSlices[pageNumber - 1].url" alt="骑缝章预览" class="stamp-overlay__image" />
                    </div>
                    <div class="preview-stage__page-label">第 {{ pageNumber }} 页</div>
                  </div>
                </div>
              </div>
            </div>
            <div class="page-jump-control">
              <span class="text-[var(--content-text-secondary)]">跳转到</span>
              <input
                v-model="pageJumpInput"
                type="number"
                min="1"
                :max="previewPageCount || 1"
                class="page-jump-control__input"
                @keyup.enter="jumpToPreviewPage"
              />
              <span class="text-[var(--content-text-secondary)]">/ {{ previewPageCount || 0 }} 页</span>
              <Button label="跳转" size="small" severity="secondary" :disabled="previewPageCount <= 0" @click="jumpToPreviewPage" />
            </div>
          </div>
        </article>

        <aside class="flex min-h-0 flex-col gap-5">
          <section class="rounded-3xl border px-5 py-5 shadow-sm" :style="panelStyle">
            <div class="flex items-center justify-between gap-3">
              <div class="text-base font-semibold text-[var(--content-text)]">文件与印章</div>
            </div>
            <div class="mt-4 space-y-4 text-sm">
              <div class="rounded-2xl border px-4 py-3" :style="innerPanelStyle">
                <div class="text-[var(--content-text-secondary)]">盖章模式</div>
                <div class="mt-3 grid gap-3 sm:grid-cols-2">
                  <button
                    v-for="option in modeOptions"
                    :key="option.value"
                    type="button"
                    class="mode-card"
                    :class="{ 'mode-card--active': mode === option.value }"
                    @click="mode = option.value"
                  >
                    <div class="font-medium text-[var(--content-text)]">{{ option.label }}</div>
                    <div class="mt-1 text-xs leading-6 text-[var(--content-text-secondary)]">{{ option.description }}</div>
                  </button>
                </div>
              </div>
            </div>
          </section>

          <section class="rounded-3xl border px-5 py-5 shadow-sm" :style="panelStyle">
            <div class="text-base font-semibold text-[var(--content-text)]">盖章参数</div>
            <div class="mt-4 space-y-5">
              <label class="block">
                <div class="flex items-center justify-between gap-3 text-sm">
                  <span class="text-[var(--content-text)]">印章宽度</span>
                  <span class="text-[var(--content-text-secondary)]">{{ stampWidthPt }} pt</span>
                </div>
                <input v-model.number="stampWidthPt" type="range" min="40" max="220" step="1" class="toolbox-range mt-3 w-full" />
              </label>

              <label class="block">
                <div class="flex items-center justify-between gap-3 text-sm">
                  <span class="text-[var(--content-text)]">旋转角度</span>
                  <span class="text-[var(--content-text-secondary)]">{{ rotationDegrees }}°</span>
                </div>
                <input v-model.number="rotationDegrees" type="range" min="-180" max="180" step="1" class="toolbox-range mt-3 w-full" :disabled="mode === 'seam'" />
              </label>

              <label class="block">
                <div class="flex items-center justify-between gap-3 text-sm">
                  <span class="text-[var(--content-text)]">透明度</span>
                  <span class="text-[var(--content-text-secondary)]">{{ opacityPercent }}%</span>
                </div>
                <input v-model.number="opacityPercent" type="range" min="10" max="100" step="1" class="toolbox-range mt-3 w-full" />
              </label>
            </div>
          </section>
        </aside>
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
      指定位置模式下，开启定位后鼠标会显示为印章样式，点击任意一页即可把同样位置应用到所有页。
    </div>
    <div v-if="helpVisible" class="help-callout help-callout--b">
      骑缝章模式会按 PDF 页数自动切分印章并贴在页面右侧，适合合同归档件的连续盖章效果。
    </div>

    <div class="pdf-toolbar">
      <div class="pdf-toolbar__row">
        <Button icon="pi pi-plus" label="添加 PDF" severity="secondary" @click="handleAddFiles" />
        <Button icon="pi pi-image" label="选择印章" severity="secondary" @click="handleSelectStampImage" />
        <Button icon="pi pi-trash" label="清除" severity="secondary" :disabled="!canClear" @click="handleClearAll" />
        <Button label="批量导出" :loading="isGenerating" :disabled="!canGenerate" @click="handleGenerate" />
      </div>
    </div>

    <Dialog
      v-model:visible="showGenerateSuccessDialog"
      modal
      header="批量盖章完成"
      :style="{ width: '560px', maxWidth: '92vw' }"
      class="theme-dialog"
    >
      <div class="text-sm leading-7 text-[var(--content-text-secondary)]">
        <div class="font-medium text-[var(--content-text)]">{{ lastResult?.outputDir }}</div>
        <div class="mt-2">共生成 {{ lastResult?.fileCount || 0 }} 个文件 · {{ lastResult?.pageCount || 0 }} 页 · {{ totalResultSize }}</div>
      </div>
      <template #footer>
        <div class="flex justify-end gap-2">
          <Button label="复制首个文件" severity="secondary" :disabled="!firstGeneratedPath" @click="handleCopyFirstGeneratedFile" />
          <Button label="打开目录" @click="handleOpenGeneratedFolder" />
        </div>
      </template>
    </Dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import Button from 'primevue/button'
import Checkbox from 'primevue/checkbox'
import Dialog from 'primevue/dialog'
import { useToast } from 'primevue/usetoast'
import pdfWorkerSrc from 'pdfjs-dist/legacy/build/pdf.worker.mjs'
import type {
  BatchStampPdfFilesResult,
  ToolboxPdfItem,
  ToolboxPdfStampMode,
} from '../../../shared/types/toolbox.types'

type PendingLegalAction = 'select-stamp' | 'generate' | null

const toast = useToast()

const items = ref<ToolboxPdfItem[]>([])
const isDragOver = ref(false)
const dragDepth = ref(0)
const isGenerating = ref(false)
const helpVisible = ref(false)
const stampImagePath = ref('')
const stampPreviewUrl = ref('')
const stampImageSize = ref({ width: 1, height: 1 })
const stampCursorUrl = ref('')
const seamPreviewSlices = ref<Array<{ url: string; width: number }>>([])
const mode = ref<ToolboxPdfStampMode>('position')
const stampWidthPt = ref(120)
const rotationDegrees = ref(0)
const opacityPercent = ref(100)
const placement = ref<{ x: number; y: number } | null>(null)
const placementModeActive = ref(false)
const previewCanvasRefs = ref<Array<HTMLCanvasElement | null>>([])
const previewStageRefs = ref<Array<HTMLElement | null>>([])
const previewScrollRef = ref<HTMLElement | null>(null)
const previewPageSizes = ref<Array<{ width: number; height: number }>>([])
const previewScales = ref<number[]>([])
const previewPageCount = ref(0)
const pageJumpInput = ref('1')
const previewRenderToken = ref(0)
const draggingStamp = ref(false)
const legalDialogVisible = ref(false)
const legalConfirmed = ref(false)
const legalAcknowledgeChecked = ref(false)
const pendingLegalAction = ref<PendingLegalAction>(null)
const showGenerateSuccessDialog = ref(false)
const lastResult = ref<BatchStampPdfFilesResult | null>(null)

let pdfjsLoadPromise: Promise<any> | null = null
let activeDragPageIndex = -1
let dragPointerOffset = { x: 0, y: 0 }

const modeOptions: Array<{ value: ToolboxPdfStampMode; label: string; description: string }> = [
  { value: 'position', label: '指定位置', description: '用印章光标在预览页点击一次，同位应用到全部页面。' },
  { value: 'seam', label: '骑缝章', description: '按页数自动切分印章并连续贴在页面右侧。' },
]

const panelStyle = {
  borderColor: 'var(--content-border)',
  backgroundColor: 'var(--content-card-bg)',
}

const innerPanelStyle = {
  borderColor: 'var(--content-border)',
  backgroundColor: 'color-mix(in srgb, var(--content-card-bg) 94%, white 6%)',
}

const previewItem = computed(() => items.value[0] || null)
const opacity = computed(() => Math.max(0.1, Math.min(1, opacityPercent.value / 100)))
const canGenerate = computed(() => {
  if (items.value.length === 0 || !stampImagePath.value || isGenerating.value) return false
  if (mode.value === 'seam') return true
  return Boolean(placement.value)
})
const canClear = computed(() => (
  items.value.length > 0 ||
  Boolean(stampImagePath.value) ||
  Boolean(stampPreviewUrl.value) ||
  Boolean(placement.value) ||
  Boolean(lastResult.value) ||
  showGenerateSuccessDialog.value
))
const totalResultSize = computed(() => formatBytes(lastResult.value?.totalSize || 0))
const firstGeneratedPath = computed(() => lastResult.value?.generatedFiles?.[0]?.outputPath || '')
const previewPageNumbers = computed(() => Array.from({ length: previewPageCount.value }, (_, index) => index + 1))
const previewStageStyle = computed<Record<string, string>>(() => {
  if (!placementModeActive.value || !stampCursorUrl.value) return {}
  return {
    '--stamp-cursor': `url("${stampCursorUrl.value}") 16 16, crosshair`,
  }
})

function getStampOverlayStyle(pageIndex: number): Record<string, string> {
  const pageSize = previewPageSizes.value[pageIndex]
  const scale = previewScales.value[pageIndex]
  if (!placement.value || !pageSize?.width || !pageSize?.height || !scale) return {}
  const heightPt = getStampHeightPt()
  const left = placement.value.x * scale
  const top = (pageSize.height - placement.value.y - heightPt) * scale
  return {
    left: `${left}px`,
    top: `${top}px`,
    width: `${stampWidthPt.value * scale}px`,
    height: `${heightPt * scale}px`,
    opacity: String(opacity.value),
    transform: `rotate(${-rotationDegrees.value}deg)`,
    cursor: draggingStamp.value ? 'grabbing' : 'grab',
  }
}

function getSeamOverlayStyle(pageIndex: number): Record<string, string> {
  const pageSize = previewPageSizes.value[pageIndex]
  const scale = previewScales.value[pageIndex]
  const slice = seamPreviewSlices.value[pageIndex]
  if (!pageSize?.width || !pageSize?.height || !scale || !slice?.width || !stampImageSize.value.width) return {}
  const heightPt = getStampHeightPt()
  const sliceWidthPt = stampWidthPt.value * (slice.width / Math.max(1, stampImageSize.value.width))
  const seamCenterY = pageSize.height * 0.5
  const seamX = Math.max(0, pageSize.width - sliceWidthPt)
  const seamY = Math.max(0, seamCenterY - heightPt / 2)
  return {
    left: `${seamX * scale}px`,
    top: `${seamY * scale}px`,
    width: `${sliceWidthPt * scale}px`,
    height: `${heightPt * scale}px`,
    opacity: String(opacity.value),
    cursor: 'default',
  }
}

watch(previewItem, async () => {
  placement.value = null
  await nextTick()
  await renderPreview()
})

watch(mode, async (nextMode) => {
  if (nextMode === 'seam') {
    placementModeActive.value = false
  }
  await nextTick()
})

watch([stampImagePath, stampWidthPt, rotationDegrees, opacityPercent], async () => {
  await nextTick()
})

watch([stampPreviewUrl, previewPageCount], async () => {
  await regenerateSeamPreviewSlices()
})

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

function getStampHeightPt(): number {
  return Math.max(1, stampWidthPt.value * (stampImageSize.value.height / Math.max(1, stampImageSize.value.width)))
}

function revokeObjectUrl(urlRef: { value: string }): void {
  if (urlRef.value) {
    URL.revokeObjectURL(urlRef.value)
    urlRef.value = ''
  }
}

function revokeObjectUrlList(urls: Array<string | { url: string }>): void {
  for (const entry of urls) {
    const url = typeof entry === 'string' ? entry : entry?.url
    if (url) {
      URL.revokeObjectURL(url)
    }
  }
}

function bytesToObjectUrl(bytes: Uint8Array, mimeType: string): string {
  return URL.createObjectURL(new Blob([bytes], { type: mimeType }))
}

function toAbsoluteAssetUrl(input: string): string {
  const value = String(input || '').trim()
  if (!value) return value
  if (value.startsWith('file://') || value.startsWith('http://') || value.startsWith('https://')) {
    return value
  }
  return new URL(value, window.location.href).toString()
}

async function getPdfjs(): Promise<any> {
  if (pdfjsLoadPromise) return pdfjsLoadPromise

  pdfjsLoadPromise = (async () => {
    const promiseCtor = Promise as any
    if (typeof promiseCtor.try !== 'function') {
      promiseCtor.try = (fn: any, ...args: any[]) => Promise.resolve().then(() => fn(...args))
    }
    if (typeof promiseCtor.withResolvers !== 'function') {
      promiseCtor.withResolvers = () => {
        let resolve: (value: any) => void = () => void 0
        let reject: (reason?: any) => void = () => void 0
        const promise = new Promise((res, rej) => {
          resolve = res
          reject = rej
        })
        return { promise, resolve, reject }
      }
    }

    const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs')
    if (!pdfjsLib.GlobalWorkerOptions?.workerSrc) {
      pdfjsLib.GlobalWorkerOptions.workerSrc = toAbsoluteAssetUrl(pdfWorkerSrc)
    }
    return pdfjsLib
  })()

  return pdfjsLoadPromise
}

async function inspectPdfPaths(filePaths: string[]): Promise<void> {
  const normalizedPaths = Array.from(new Set(filePaths.map((item) => String(item || '').trim()).filter(Boolean)))
  if (normalizedPaths.length === 0) {
    return
  }
  const result = await window.electronAPI.toolbox.inspectPdfFiles({ filePaths: normalizedPaths })
  if (!result.success || !result.data) {
    throw new Error(result.error || '读取 PDF 信息失败')
  }
  const existing = new Set(items.value.map((item) => item.path))
  const added = result.data.items.filter((item) => item.path && !existing.has(item.path))
  if (added.length === 0) {
    toast.add({ severity: 'info', summary: '未新增文件', detail: '导入的 PDF 已存在于当前列表中。', life: 3000 })
    return
  }
  items.value = [...items.value, ...added]
  toast.add({ severity: 'success', summary: 'PDF 已加入', detail: `已加入 ${added.length} 个 PDF。`, life: 2500 })
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

async function selectStampImage(): Promise<void> {
  const result = await window.electronAPI.fs.selectFile({
    properties: ['openFile'],
    filters: [{ name: '图片文件', extensions: ['png', 'jpg', 'jpeg', 'webp', 'bmp'] }],
  })
  if (!result.success || !result.data || result.data.canceled) return
  const filePath = Array.isArray(result.data.filePaths)
    ? String(result.data.filePaths[0] || '').trim()
    : ''
  if (!filePath) return

  const bytesResult = await window.electronAPI.fs.readFileBytes(filePath)
  if (!bytesResult.success || !bytesResult.data) {
    throw new Error(bytesResult.error || '读取印章图片失败')
  }

  revokeObjectUrl(stampPreviewUrl)
  stampPreviewUrl.value = bytesToObjectUrl(
    bytesResult.data instanceof Uint8Array ? bytesResult.data : new Uint8Array(bytesResult.data as any),
    inferImageMimeType(filePath),
  )
  await updateStampImageSize(stampPreviewUrl.value)
  await generateStampCursor(stampPreviewUrl.value)
  stampImagePath.value = filePath
  if (mode.value === 'position') {
    placementModeActive.value = true
  }
}

async function updateStampImageSize(objectUrl: string): Promise<void> {
  const image = new Image()
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve()
    image.onerror = () => reject(new Error('无法读取印章图片尺寸'))
    image.src = objectUrl
  })
  stampImageSize.value = {
    width: Math.max(1, image.naturalWidth || image.width || 1),
    height: Math.max(1, image.naturalHeight || image.height || 1),
  }
}

async function generateStampCursor(objectUrl: string): Promise<void> {
  try {
    const image = new Image()
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve()
      image.onerror = () => reject(new Error('无法生成印章光标'))
      image.src = objectUrl
    })

    const size = 32
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // 保持宽高比，居中绘制到 32x32 光标区域
    const aspect = (image.naturalWidth || 1) / (image.naturalHeight || 1)
    let drawWidth = size
    let drawHeight = size
    let offsetX = 0
    let offsetY = 0
    if (aspect > 1) {
      drawHeight = size / aspect
      offsetY = (size - drawHeight) / 2
    } else {
      drawWidth = size * aspect
      offsetX = (size - drawWidth) / 2
    }

    ctx.clearRect(0, 0, size, size)
    ctx.drawImage(image, offsetX, offsetY, drawWidth, drawHeight)
    stampCursorUrl.value = canvas.toDataURL('image/png')
  } catch {
    stampCursorUrl.value = ''
  }
}

async function regenerateSeamPreviewSlices(): Promise<void> {
  revokeObjectUrlList(seamPreviewSlices.value)
  seamPreviewSlices.value = []

  const objectUrl = String(stampPreviewUrl.value || '').trim()
  const pageCount = Math.max(0, Math.floor(previewPageCount.value))
  if (!objectUrl || pageCount <= 0) return

  try {
    const image = new Image()
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve()
      image.onerror = () => reject(new Error('无法生成骑缝章预览'))
      image.src = objectUrl
    })

    const slices: Array<{ url: string; width: number }> = []
    for (let index = 0; index < pageCount; index += 1) {
      const startX = Math.floor(index * image.naturalWidth / pageCount)
      const endX = Math.floor((index + 1) * image.naturalWidth / pageCount)
      const width = Math.max(1, endX - startX)
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = Math.max(1, image.naturalHeight)
      const ctx = canvas.getContext('2d')
      if (!ctx) continue
      ctx.drawImage(image, startX, 0, width, image.naturalHeight, 0, 0, width, image.naturalHeight)
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob((value) => resolve(value), 'image/png'))
      if (!blob) continue
      slices.push({ url: URL.createObjectURL(blob), width })
    }
    seamPreviewSlices.value = slices
  } catch {
    seamPreviewSlices.value = []
  }
}

async function handleSelectStampImage(): Promise<void> {
  if (!legalConfirmed.value) {
    pendingLegalAction.value = 'select-stamp'
    legalDialogVisible.value = true
    return
  }
  try {
    await selectStampImage()
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: '选择失败',
      detail: error instanceof Error ? error.message : '无法读取印章图片。',
      life: 4500,
    })
  }
}

function confirmLegalNotice(): void {
  legalConfirmed.value = true
  legalDialogVisible.value = false
  const pending = pendingLegalAction.value
  pendingLegalAction.value = null
  if (pending === 'select-stamp') {
    void handleSelectStampImage()
  }
  if (pending === 'generate') {
    void handleGenerate()
  }
}

function clearPlacement(): void {
  placement.value = null
  if (mode.value === 'position' && stampPreviewUrl.value) {
    placementModeActive.value = true
  }
}

function resetPreviewState(): void {
  previewRenderToken.value += 1
  previewCanvasRefs.value = []
  previewStageRefs.value = []
  previewPageSizes.value = []
  previewScales.value = []
  previewPageCount.value = 0
  pageJumpInput.value = '1'
  previewScrollRef.value = null
}

function resetStampState(): void {
  stopStampDrag()
  placement.value = null
  placementModeActive.value = false
  stampImageSize.value = { width: 1, height: 1 }
  stampImagePath.value = ''
  revokeObjectUrl(stampPreviewUrl)
  stampCursorUrl.value = ''
  revokeObjectUrlList(seamPreviewSlices.value)
  seamPreviewSlices.value = []
}

function handleClearAll(): void {
  items.value = []
  resetPreviewState()
  resetStampState()
  mode.value = 'position'
  stampWidthPt.value = 120
  rotationDegrees.value = 0
  opacityPercent.value = 100
  lastResult.value = null
  showGenerateSuccessDialog.value = false
  pendingLegalAction.value = null
  toast.add({ severity: 'success', summary: '已清除', detail: '已清空 PDF、印章和盖章设置，可重新开始。', life: 2500 })
}

function removeItem(id: string): void {
  items.value = items.value.filter((item) => item.id !== id)
}

function inferImageMimeType(filePath: string): string {
  const ext = String(filePath || '').toLowerCase()
  if (ext.endsWith('.jpg') || ext.endsWith('.jpeg')) return 'image/jpeg'
  if (ext.endsWith('.webp')) return 'image/webp'
  if (ext.endsWith('.bmp')) return 'image/bmp'
  return 'image/png'
}

async function renderPreview(): Promise<void> {
  const filePath = previewItem.value?.path
  await nextTick()
  if (!filePath) return

  const token = previewRenderToken.value + 1
  previewRenderToken.value = token
  try {
    const bytesResult = await window.electronAPI.fs.readFileBytes(filePath)
    if (!bytesResult.success || !bytesResult.data) {
      throw new Error(bytesResult.error || '读取预览 PDF 失败')
    }
    const pdfBytes = bytesResult.data instanceof Uint8Array ? bytesResult.data : new Uint8Array(bytesResult.data as any)
    const pdfjsLib = await getPdfjs()
    const loadingTask = pdfjsLib.getDocument({ data: pdfBytes, disableWorker: true })
    const pdfDoc = await loadingTask.promise
    const pageCount = Number(pdfDoc.numPages || 0)
    previewPageCount.value = pageCount
    pageJumpInput.value = pageCount > 0 ? '1' : ''
    previewPageSizes.value = Array.from({ length: pageCount }, () => ({ width: 0, height: 0 }))
    previewScales.value = Array.from({ length: pageCount }, () => 1)
    previewCanvasRefs.value = Array.from({ length: pageCount }, (_, index) => previewCanvasRefs.value[index] || null)
    previewStageRefs.value = Array.from({ length: pageCount }, (_, index) => previewStageRefs.value[index] || null)
    await nextTick()

    for (let pageIndex = 0; pageIndex < pageCount; pageIndex += 1) {
      if (token !== previewRenderToken.value) break
      const canvas = previewCanvasRefs.value[pageIndex]
      if (!canvas) continue
      const page = await pdfDoc.getPage(pageIndex + 1)
      const viewport = page.getViewport({ scale: 1.2 })
      const context = canvas.getContext('2d')
      if (!context) continue
      canvas.width = Math.max(1, Math.floor(viewport.width))
      canvas.height = Math.max(1, Math.floor(viewport.height))
      previewPageSizes.value[pageIndex] = { width: page.view[2], height: page.view[3] }
      previewScales.value[pageIndex] = viewport.width / page.view[2]
      await page.render({ canvasContext: context, viewport }).promise
    }
    await pdfDoc.destroy().catch(() => void 0)
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: '预览失败',
      detail: error instanceof Error ? error.message : '无法渲染 PDF 预览。',
      life: 4500,
    })
  }
}

function handlePreviewClick(event: MouseEvent, pageIndex: number): void {
  if (draggingStamp.value) return
  if (!placementModeActive.value || mode.value !== 'position') return
  updatePlacementFromPointer(event.clientX, event.clientY, pageIndex)
  placementModeActive.value = false
}

function setPreviewCanvasRef(el: Element | null, index: number): void {
  previewCanvasRefs.value[index] = el instanceof HTMLCanvasElement ? el : null
}

function setPreviewStageRef(el: Element | null, index: number): void {
  previewStageRefs.value[index] = el instanceof HTMLElement ? el : null
}

function updatePlacementFromPointer(clientX: number, clientY: number, pageIndex: number, anchorOffset?: { x: number; y: number }): void {
  const canvas = previewCanvasRefs.value[pageIndex]
  const pageSize = previewPageSizes.value[pageIndex]
  const pageScale = previewScales.value[pageIndex]
  if (!canvas || !pageSize?.width || !pageSize?.height || !pageScale) return

  const rect = canvas.getBoundingClientRect()
  const stampHeightPt = getStampHeightPt()
  const widthPx = stampWidthPt.value * pageScale
  const heightPx = stampHeightPt * pageScale
  const offsetX = anchorOffset?.x ?? 0
  const offsetY = anchorOffset?.y ?? 0
  const xPx = clientX - rect.left - offsetX
  const yPx = clientY - rect.top - offsetY
  const clampedLeftPx = Math.max(0, Math.min(Math.max(0, rect.width - widthPx), xPx))
  const clampedTopPx = Math.max(0, Math.min(Math.max(0, rect.height - heightPx), yPx))
  const pdfX = Math.max(0, Math.min(pageSize.width, clampedLeftPx / pageScale))
  const pdfTop = Math.max(0, Math.min(pageSize.height, clampedTopPx / pageScale))
  const pdfY = Math.max(0, pageSize.height - pdfTop - stampHeightPt)
  placement.value = { x: pdfX, y: pdfY }
}

function startStampDrag(event: MouseEvent, pageIndex: number): void {
  if (mode.value !== 'position' || !placement.value) return
  const pageScale = previewScales.value[pageIndex]
  if (!pageScale) return
  draggingStamp.value = true
  activeDragPageIndex = pageIndex
  dragPointerOffset = {
    x: Math.max(0, Math.min(stampWidthPt.value * pageScale, event.offsetX)),
    y: Math.max(0, Math.min(getStampHeightPt() * pageScale, event.offsetY)),
  }
  window.addEventListener('mousemove', handleStampDragMove)
  window.addEventListener('mouseup', stopStampDrag)
}

function handleStampDragMove(event: MouseEvent): void {
  if (!draggingStamp.value || activeDragPageIndex < 0) return
  updatePlacementFromPointer(event.clientX, event.clientY, activeDragPageIndex, dragPointerOffset)
}

function stopStampDrag(): void {
  draggingStamp.value = false
  activeDragPageIndex = -1
  window.removeEventListener('mousemove', handleStampDragMove)
  window.removeEventListener('mouseup', stopStampDrag)
}

async function jumpToPreviewPage(): Promise<void> {
  const pageCount = Math.max(0, Math.floor(previewPageCount.value))
  if (pageCount <= 0) return

  const pageNumber = Number(pageJumpInput.value)
  if (!Number.isInteger(pageNumber)) {
    toast.add({ severity: 'warn', summary: '页码无效', detail: '请输入整数页码。', life: 2500 })
    return
  }
  if (pageNumber < 1 || pageNumber > pageCount) {
    toast.add({ severity: 'warn', summary: '页码不存在', detail: `请输入 1 到 ${pageCount} 之间的页码。`, life: 3000 })
    return
  }

  await nextTick()
  const target = previewStageRefs.value[pageNumber - 1]
  const container = previewScrollRef.value
  if (!target || !container) return
  container.scrollTo({
    top: Math.max(0, target.offsetTop - 8),
    behavior: 'smooth',
  })
}

async function handleGenerate(): Promise<void> {
  if (!legalConfirmed.value) {
    pendingLegalAction.value = 'generate'
    legalDialogVisible.value = true
    return
  }
  if (!canGenerate.value) {
    toast.add({ severity: 'warn', summary: '无法导出', detail: '请先导入 PDF、选择印章并设置位置。', life: 3500 })
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
    const result = await window.electronAPI.toolbox.batchStampPdfFiles(buildBatchStampPayload(outputDir))

    if (!result.success || !result.data) {
      throw new Error(result.error || '批量盖章失败')
    }

    lastResult.value = result.data
    showGenerateSuccessDialog.value = true
    toast.add({ severity: 'success', summary: '批量盖章完成', detail: `已生成 ${result.data.fileCount} 个 PDF 文件。`, life: 3500 })
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: '盖章失败',
      detail: error instanceof Error ? error.message : '批量盖章时发生错误。',
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

function buildBatchStampPayload(outputDir: string) {
  const cleanPlacement = placement.value
    ? {
        x: Number(placement.value.x),
        y: Number(placement.value.y),
      }
    : undefined

  return {
    files: items.value.map((item) => ({
      id: String(item.id || ''),
      name: String(item.name || ''),
      path: String(item.path || ''),
      size: Number(item.size || 0),
      pageCount: Number(item.pageCount || 0),
      selected: Boolean(item.selected),
      rangeStart: Number(item.rangeStart || 1),
      rangeEnd: Number(item.rangeEnd || item.pageCount || 1),
    })),
    stampImage: {
      filePath: String(stampImagePath.value || ''),
    },
    mode: mode.value,
    placement: mode.value === 'position' ? cleanPlacement : undefined,
    stampWidthPt: Number(stampWidthPt.value || 120),
    rotationDegrees: Number(rotationDegrees.value || 0),
    opacity: Number(opacity.value || 1),
    outputDir: String(outputDir || ''),
    openAfterSave: false,
  }
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
  if (!firstGeneratedPath.value) return
  await window.electronAPI.fs.clipboardWriteFile(firstGeneratedPath.value)
  showGenerateSuccessDialog.value = false
}

async function handleOpenGeneratedFolder(): Promise<void> {
  const dirPath = lastResult.value?.outputDir || getDirectoryPath(firstGeneratedPath.value)
  if (!dirPath) return
  await window.electronAPI.fs.openFolder(dirPath)
  showGenerateSuccessDialog.value = false
}

function toggleHelp(): void {
  helpVisible.value = !helpVisible.value
}

defineExpose({
  handleAddFiles,
  handleSelectStampImage,
  handleClearAll,
  toggleHelp,
  isGenerating,
})

onBeforeUnmount(() => {
  stopStampDrag()
  revokeObjectUrlList(seamPreviewSlices.value)
  seamPreviewSlices.value = []
  revokeObjectUrl(stampPreviewUrl)
  stampCursorUrl.value = ''
})
</script>

<style scoped>
.preview-stage {
  position: relative;
  width: fit-content;
  margin-inline: auto;
}

.preview-stage--placement {
  cursor: var(--stamp-cursor, crosshair);
}

.preview-stage__page-label {
  position: absolute;
  right: 0.75rem;
  top: 0.75rem;
  padding: 0.15rem 0.55rem;
  border-radius: 9999px;
  background: rgba(15, 23, 42, 0.68);
  color: #fff;
  font-size: 0.75rem;
  line-height: 1.4;
  pointer-events: none;
}

.pdf-preview-scroll {
  overscroll-behavior: contain;
}

.page-jump-control {
  position: absolute;
  right: 1.25rem;
  bottom: 1rem;
  z-index: 8;
  display: flex;
  align-items: center;
  gap: 0.45rem;
  padding: 0.55rem 0.65rem;
  border: 1px solid color-mix(in srgb, var(--content-border) 82%, transparent);
  border-radius: 9999px;
  background: color-mix(in srgb, var(--content-card-bg) 88%, var(--content-bg) 12%);
  box-shadow: 0 10px 24px color-mix(in srgb, black 12%, transparent);
  backdrop-filter: blur(10px);
  font-size: 0.82rem;
}

.page-jump-control__input {
  width: 4.5rem;
  border: 1px solid var(--content-border);
  border-radius: 9999px;
  background: color-mix(in srgb, var(--content-bg) 82%, var(--content-card-bg) 18%);
  padding: 0.35rem 0.55rem;
  text-align: center;
  color: var(--content-text);
  outline: none;
}

.page-jump-control__input:focus {
  border-color: color-mix(in srgb, var(--p-rose-500) 60%, var(--content-border));
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--p-rose-500) 16%, transparent);
}

.stamp-overlay {
  position: absolute;
  pointer-events: auto;
  user-select: none;
  transform-origin: top left;
}

.stamp-overlay__image {
  width: 100%;
  height: 100%;
  object-fit: contain;
  pointer-events: none;
}

.mode-card {
  border: 1px solid var(--content-border);
  border-radius: 1rem;
  padding: 0.9rem 1rem;
  text-align: left;
  background: var(--content-card-bg);
  transition: border-color 0.16s ease, box-shadow 0.16s ease, transform 0.16s ease;
}

.mode-card:hover {
  border-color: color-mix(in srgb, var(--p-rose-500) 38%, var(--content-border));
  box-shadow: 0 10px 24px color-mix(in srgb, black 8%, transparent);
  transform: translateY(-1px);
}

.mode-card--active {
  border-color: color-mix(in srgb, var(--p-rose-500) 58%, var(--content-border));
  background: color-mix(in srgb, var(--content-card-bg) 76%, var(--p-rose-500) 24%);
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
  box-shadow: 0 14px 28px color-mix(in srgb, black 12%, transparent);
  backdrop-filter: blur(12px);
}

.pdf-dropzone--active {
  position: relative;
}

.empty-pdf-dropzone--active {
  border-color: color-mix(in srgb, var(--p-rose-500) 48%, var(--content-border)) !important;
  background: color-mix(in srgb, var(--content-card-bg) 78%, var(--p-rose-500) 22%) !important;
}

.pdf-dropzone-overlay {
  position: absolute;
  inset: 0;
  z-index: 15;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2px dashed color-mix(in srgb, var(--p-rose-500) 38%, transparent);
  border-radius: 1.5rem;
  background: color-mix(in srgb, var(--content-card-bg) 78%, var(--p-rose-500) 22%);
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
  border: 1px solid color-mix(in srgb, var(--p-rose-500) 18%, var(--content-border));
  border-radius: 0.9rem;
  background: color-mix(in srgb, var(--content-card-bg) 78%, var(--p-rose-500) 22%);
  color: var(--content-text-secondary);
  font-size: 0.9rem;
  line-height: 1.6;
  box-shadow: 0 12px 28px color-mix(in srgb, black 8%, transparent);
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
