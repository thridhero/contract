<template>
  <div class="flex h-full min-h-0 flex-col gap-5">
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
          <p>仅限抠取本单位自有实体公章透明图，用于合法电子文件盖章排版。</p>
          <p>使用本工具产生的一切法律责任由用户自行承担。</p>
        </div>
        <label class="flex cursor-pointer items-start gap-3 rounded-2xl border border-[var(--content-border)] px-4 py-3 text-sm text-[var(--content-text)]">
          <Checkbox v-model="legalAcknowledgeChecked" binary inputId="seal-legal-confirm" class="mt-0.5" />
          <span>我已知悉并确认：仅对本单位自有实体公章扫描件进行透明化处理，不用于伪造公章或证件。</span>
        </label>
      </div>
      <template #footer>
        <Button v-if="legalConfirmed" label="关闭" severity="secondary" @click="legalDialogVisible = false" />
        <Button label="确定已知" :disabled="!legalAcknowledgeChecked" @click="confirmLegalNotice" />
      </template>
    </Dialog>

    <section class="grid min-h-0 flex-1 gap-5 xl:grid-cols-[minmax(0,1fr)_400px]">
      <div class="grid min-h-0 gap-5 lg:grid-cols-2">
        <article class="preview-card" :style="panelStyle">
          <div class="preview-card__header">
            <div>
              <h4 class="text-base font-semibold text-[var(--content-text)]">原图与识别范围</h4>
              <p class="mt-1 text-sm text-[var(--content-text-secondary)]">
                {{ sourceFileName || '尚未选择图片' }}
              </p>
            </div>
            <div class="flex flex-wrap items-center justify-end gap-2">
              <Button
                :label="manualCropEnabled ? '关闭手动裁切' : '开启手动裁切'"
                :severity="manualCropEnabled ? 'secondary' : undefined"
                size="small"
                :disabled="!legalConfirmed"
                @click="toggleManualCrop"
              />
              <Button
                label="重置裁切框"
                severity="secondary"
                size="small"
                :disabled="!manualCropEnabled"
                @click="resetCropRect"
              />
            </div>
          </div>
          <div class="preview-card__body">
            <div v-if="sourcePreviewUrl" class="seal-stage seal-stage--source">
              <div class="seal-image-shell">
                <img
                  ref="sourceImageRef"
                  :src="sourcePreviewUrl"
                  alt="原始印章图片"
                  class="seal-stage__image"
                  @load="handleSourceImageLoad"
                />
                <div
                  v-if="manualCropEnabled"
                  ref="cropOverlayRef"
                  class="crop-overlay"
                  @pointerdown.self="handleOverlayPointerDown"
                  @dblclick.stop="exitManualCrop"
                >
                  <div
                    v-if="cropRectStyle"
                    class="crop-overlay__selection"
                    :style="cropRectStyle"
                    @pointerdown.stop="handleSelectionPointerDown"
                    @dblclick.stop="exitManualCrop"
                  >
                    <button
                      v-for="handle in cropHandles"
                      :key="handle"
                      type="button"
                      class="crop-overlay__handle"
                      :class="`crop-overlay__handle--${handle}`"
                      @pointerdown.stop="handleResizePointerDown(handle, $event)"
                    ></button>
                  </div>
                  <div class="crop-overlay__hint">拖动边框或四角调整范围</div>
                </div>
              </div>
            </div>
            <div v-else class="seal-empty">
              <i class="pi pi-image text-2xl"></i>
              <button type="button" class="seal-empty__action" @click="selectImageAndProcess">
                <span class="mt-3 text-base font-medium text-[var(--content-text)]">等待上传印章图片</span>
                <span class="mt-2 text-sm text-[var(--content-text-secondary)]">
                  {{ legalConfirmed ? '点击这里选择图片文件' : '点击后先确认法律提示' }}
                </span>
              </button>
            </div>
          </div>
        </article>

        <article class="preview-card" :style="panelStyle">
          <div class="preview-card__header">
            <div>
              <h4 class="text-base font-semibold text-[var(--content-text)]">透明 PNG 预览</h4>
              <p class="mt-1 text-sm text-[var(--content-text-secondary)]">
                {{ result ? `${result.width} × ${result.height}，导出 ${result.exportWidth} × ${result.exportHeight}` : '自动识别红色印章区域并去除浅色背景' }}
              </p>
            </div>
            <div v-if="result" class="flex flex-wrap items-center justify-end gap-2">
              <Button
                icon="pi pi-pencil"
                text
                rounded
                severity="secondary"
                :class="{ 'toolbox-icon-button--active': eraseModeEnabled }"
                :aria-label="eraseModeEnabled ? '关闭涂抹工具' : '开启涂抹工具'"
                v-tooltip.bottom="eraseModeEnabled ? '关闭涂抹工具' : '开启涂抹工具'"
                @click="toggleEraseMode"
              />
              <Button icon="pi pi-search-minus" text rounded severity="secondary" aria-label="缩小预览" v-tooltip.bottom="'缩小预览'" @click="zoomResult(-0.2)" />
              <Button icon="pi pi-search-plus" text rounded severity="secondary" aria-label="放大预览" v-tooltip.bottom="'放大预览'" @click="zoomResult(0.2)" />
              <Button icon="pi pi-replay" text rounded severity="secondary" aria-label="恢复原始结果" v-tooltip.bottom="'恢复原始结果'" @click="restoreEditedResult" />
            </div>
          </div>
          <div class="preview-card__body">
            <div v-if="isProcessing" class="seal-empty">
              <ProgressSpinner style="width: 46px; height: 46px" strokeWidth="4" />
              <div class="mt-4 text-base font-medium text-[var(--content-text)]">正在识别印章区域</div>
            </div>
            <div v-else-if="result" class="seal-stage seal-stage--result">
              <div class="seal-result-shell">
                <img
                  v-if="!eraseModeEnabled"
                  :src="resultPreviewUrl"
                  alt="印章提取结果"
                  class="seal-stage__image"
                  :style="resultImageStyle"
                />
                <canvas
                  v-else
                  ref="resultCanvasRef"
                  :style="resultCanvasStyle"
                  class="seal-stage__image seal-stage__canvas"
                  :class="{ 'seal-stage__canvas--erase': eraseModeEnabled }"
                  @pointerdown="handleResultCanvasPointerDown"
                  @pointermove="handleResultCanvasPointerMove"
                  @pointerup="handleResultCanvasPointerUp"
                  @pointerleave="handleResultCanvasPointerLeave"
                ></canvas>
                <div class="seal-result-shell__zoom">{{ zoomPercentLabel }}</div>
              </div>
            </div>
            <div v-else class="seal-empty">
              <i class="pi pi-circle text-2xl"></i>
              <div class="mt-3 text-base font-medium text-[var(--content-text)]">处理结果会显示在这里</div>
            </div>
          </div>
        </article>
      </div>

      <aside class="flex min-h-0 flex-col gap-5">
        <section class="rounded-[28px] border px-5 py-5 shadow-sm" :style="panelStyle">
          <div class="flex items-center justify-between gap-3">
            <div class="text-base font-semibold text-[var(--content-text)]">提取调节</div>
            <button
              v-tooltip.left="'背景去除越高，白底和灰底去除越彻底；红色保留越高，越能保留偏浅印泥；边缘净化越高，边缘会更平滑。'"
              type="button"
              class="toolbox-inline-tip"
              aria-label="查看调节说明"
            >
              <i class="pi pi-info-circle"></i>
            </button>
          </div>
          <div class="mt-4 space-y-5">
            <label class="block">
              <div class="flex items-center justify-between gap-3 text-sm">
                <span class="text-[var(--content-text)]">背景去除强度</span>
                <span class="text-[var(--content-text-secondary)]">{{ backgroundThreshold }}</span>
              </div>
              <input v-model.number="backgroundThreshold" type="range" min="180" max="252" step="1" class="toolbox-range mt-3 w-full" :disabled="!legalConfirmed" />
            </label>

            <label class="block">
              <div class="flex items-center justify-between gap-3 text-sm">
                <span class="text-[var(--content-text)]">红色保留强度</span>
                <span class="text-[var(--content-text-secondary)]">{{ redSensitivity }}</span>
              </div>
              <input v-model.number="redSensitivity" type="range" min="12" max="160" step="1" class="toolbox-range mt-3 w-full" :disabled="!legalConfirmed" />
            </label>

            <label class="block">
              <div class="flex items-center justify-between gap-3 text-sm">
                <span class="text-[var(--content-text)]">边缘净化</span>
                <span class="text-[var(--content-text-secondary)]">{{ edgeSoftness }}</span>
              </div>
              <input v-model.number="edgeSoftness" type="range" min="4" max="80" step="1" class="toolbox-range mt-3 w-full" :disabled="!legalConfirmed" />
            </label>

            <label class="block">
              <div class="flex items-center justify-between gap-3 text-sm">
                <span class="text-[var(--content-text)]">导出 DPI</span>
                <span class="text-[var(--content-text-secondary)]">{{ dpi }}</span>
              </div>
              <select v-model.number="dpi" class="toolbox-select mt-3 w-full" :disabled="!legalConfirmed">
                <option :value="300">300 DPI</option>
                <option :value="600">600 DPI</option>
                <option :value="900">900 DPI</option>
              </select>
            </label>
          </div>
        </section>

        <section class="rounded-[28px] border px-5 py-5 shadow-sm" :style="panelStyle">
          <div class="text-base font-semibold text-[var(--content-text)]">处理结果</div>
          <div v-if="result" class="mt-4 space-y-3 text-sm text-[var(--content-text-secondary)]">
            <div>文件名：{{ result.outputFileName }}</div>
            <div>识别形状：{{ shapeLabel }}</div>
            <div>预览尺寸：{{ result.width }} × {{ result.height }}</div>
            <div>导出尺寸：{{ result.exportWidth }} × {{ result.exportHeight }}</div>
            <div>导出 DPI：{{ result.dpi }}</div>
            <div>最终边界：{{ trimBoundsText }}</div>
            <div>处理区域：{{ appliedCropText }}</div>
            <div v-if="result.warningMessage" class="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-amber-700">
              {{ result.warningMessage }}
            </div>
          </div>
          <div v-else class="mt-4 text-sm leading-7 text-[var(--content-text-secondary)]">
            选择印章图片后，工具会自动识别红色圆章或椭圆章并生成透明 PNG。
          </div>
          <div class="mt-5 flex flex-col gap-3">
            <Button label="重新处理当前图片" :disabled="!sourcePath || isProcessing || !legalConfirmed" @click="processCurrentImage()" />
            <div v-if="result" class="rounded-2xl border border-[var(--content-border)] px-4 py-3">
              <div class="flex items-center justify-between gap-3 text-sm">
                <span class="text-[var(--content-text)]">涂抹半径</span>
                <span class="text-[var(--content-text-secondary)]">{{ brushSize }} px</span>
              </div>
              <input v-model.number="brushSize" type="range" min="2" max="32" step="1" class="toolbox-range mt-3 w-full" :disabled="!eraseModeEnabled" />
              <div class="mt-3 flex items-center justify-between gap-3 text-xs text-[var(--content-text-secondary)]">
                <span>{{ eraseModeEnabled ? '在结果图上拖动即可把对应区域擦成透明。' : '点击上方铅笔图标后可进入涂抹透明模式。' }}</span>
                <span v-if="hasEditedResult">已修改</span>
              </div>
            </div>
            <Button label="导出 PNG" :disabled="!result || isProcessing" @click="handleExportPng" />
            <Button label="复制图片" severity="secondary" :disabled="!result || isProcessing" @click="handleCopyImage" />
          </div>
        </section>

        <section v-if="helpVisible" class="rounded-[28px] border px-5 py-5 shadow-sm" :style="panelStyle">
          <div class="text-base font-semibold text-[var(--content-text)]">使用说明</div>
          <div class="mt-3 space-y-2 text-sm leading-7 text-[var(--content-text-secondary)]">
            <p>建议上传白底或浅色底的红色实体公章扫描图，处理效果最稳定。</p>
            <p>如果印泥偏浅，可先提高“红色保留强度”；如果背景阴影较重，可提高“背景去除强度”。</p>
            <p>导出时会按 DPI 放大像素尺寸并写入 DPI 元数据，适合电子文件盖章排版。</p>
          </div>
        </section>

        <section v-if="errorMessage && !isProcessing" class="rounded-[28px] border border-red-200 bg-red-50 px-5 py-5 shadow-sm">
          <div class="flex items-start gap-3">
            <i class="pi pi-exclamation-circle mt-0.5 text-red-500"></i>
            <div>
              <div class="text-base font-semibold text-red-700">处理失败</div>
              <p class="mt-2 text-sm leading-7 text-red-600">{{ errorMessage }}</p>
            </div>
          </div>
        </section>
      </aside>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import Button from 'primevue/button'
import Checkbox from 'primevue/checkbox'
import Dialog from 'primevue/dialog'
import ProgressSpinner from 'primevue/progressspinner'
import { useToast } from 'primevue/usetoast'
import type { ProcessSealImageResult, SealCropBounds, SealShapeType } from '../../../shared/types/toolbox.types'

type NormalizedCropRect = {
  left: number
  top: number
  right: number
  bottom: number
}

type CropHandle = 'nw' | 'ne' | 'sw' | 'se'
type DragMode = 'move' | CropHandle
type PendingLegalAction = 'select-image' | null

const toast = useToast()

const supportedImageFilter = {
  name: '图片文件',
  extensions: ['png', 'jpg', 'jpeg', 'webp', 'bmp'],
}

const panelStyle = {
  borderColor: 'var(--content-border)',
  backgroundColor: 'var(--content-card-bg)',
}

const sourcePath = ref('')
const sourcePreviewUrl = ref('')
const resultPreviewUrl = ref('')
const result = ref<ProcessSealImageResult | null>(null)
const helpVisible = ref(false)
const isProcessing = ref(false)
const errorMessage = ref('')
const legalDialogVisible = ref(false)
const legalConfirmed = ref(false)
const legalAcknowledgeChecked = ref(false)
const pendingLegalAction = ref<PendingLegalAction>(null)
const backgroundThreshold = ref(236)
const redSensitivity = ref(58)
const edgeSoftness = ref(18)
const dpi = ref(300)
const resultZoom = ref(1)
const eraseModeEnabled = ref(false)
const brushSize = ref(10)
const hasEditedResult = ref(false)
const manualCropEnabled = ref(false)
const manualCropNormalized = ref<NormalizedCropRect | null>(null)
const cropEditActive = ref(false)
const sourceImageNaturalSize = ref({ width: 0, height: 0 })
const sourceImageRef = ref<HTMLImageElement | null>(null)
const cropOverlayRef = ref<HTMLElement | null>(null)
const resultCanvasRef = ref<HTMLCanvasElement | null>(null)
const cropHandles: CropHandle[] = ['nw', 'ne', 'sw', 'se']

let processSerial = 0
let processDebounceTimer: ReturnType<typeof setTimeout> | null = null
let dragMode: DragMode | null = null
let dragStartPoint: { x: number; y: number } | null = null
let dragStartRect: NormalizedCropRect | null = null
let erasePointerActive = false
let lastErasePoint: { x: number; y: number } | null = null
let basePreviewBytes: Uint8Array | null = null
let baseExportBytes: Uint8Array | null = null

const sourceFileName = computed(() => {
  const normalized = String(sourcePath.value || '')
  const index = Math.max(normalized.lastIndexOf('/'), normalized.lastIndexOf('\\'))
  return index >= 0 ? normalized.slice(index + 1) : normalized
})

const trimBoundsText = computed(() => {
  if (!result.value) return ''
  const { left, top, right, bottom } = result.value.trimBounds
  return `${left}, ${top} - ${right}, ${bottom}`
})

const appliedCropText = computed(() => {
  if (!result.value) return ''
  const { left, top, right, bottom } = result.value.appliedCropBounds
  return `${left}, ${top} - ${right}, ${bottom}`
})

const shapeLabel = computed(() => {
  if (!result.value) return ''
  return mapShapeLabel(result.value.detectedShape)
})

const cropRectStyle = computed<Record<string, string> | null>(() => {
  if (!cropEditActive.value || !manualCropNormalized.value) return null
  const rect = manualCropNormalized.value
  return {
    left: `${rect.left * 100}%`,
    top: `${rect.top * 100}%`,
    width: `${(rect.right - rect.left) * 100}%`,
    height: `${(rect.bottom - rect.top) * 100}%`,
  }
})

const resultCanvasStyle = computed<Record<string, string>>(() => {
  if (!result.value) {
    return {}
  }
  const displayWidth = Math.max(96, Math.round(result.value.width * resultZoom.value))
  const displayHeight = Math.max(96, Math.round(result.value.height * resultZoom.value))
  return {
    width: `${displayWidth}px`,
    height: `${displayHeight}px`,
  }
})

const resultImageStyle = computed<Record<string, string>>(() => {
  if (!result.value) {
    return {}
  }
  return {
    width: `${Math.max(96, Math.round(result.value.width * resultZoom.value))}px`,
    height: `${Math.max(96, Math.round(result.value.height * resultZoom.value))}px`,
  }
})

const zoomPercentLabel = computed(() => `${Math.round(resultZoom.value * 100)}%`)

function revokeObjectUrl(target: { value: string }): void {
  if (target.value) {
    URL.revokeObjectURL(target.value)
    target.value = ''
  }
}

function bytesToObjectUrl(bytes: Uint8Array, mimeType: string): string {
  const blob = new Blob([bytes], { type: mimeType })
  return URL.createObjectURL(blob)
}

async function bytesToImageElement(bytes: Uint8Array, mimeType: string): Promise<HTMLImageElement> {
  const objectUrl = bytesToObjectUrl(bytes, mimeType)
  try {
    const image = new Image()
    const loaded = new Promise<HTMLImageElement>((resolve, reject) => {
      image.onload = () => resolve(image)
      image.onerror = () => reject(new Error('预览图片加载失败'))
    })
    image.src = objectUrl
    return await loaded
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}

function getMimeTypeForPath(filePath: string): string {
  const extension = String(filePath.split('.').pop() || '').toLowerCase()
  if (extension === 'jpg' || extension === 'jpeg') return 'image/jpeg'
  if (extension === 'webp') return 'image/webp'
  if (extension === 'bmp') return 'image/bmp'
  return 'image/png'
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function mapShapeLabel(shape: SealShapeType): string {
  if (shape === 'circle') return '圆章'
  if (shape === 'ellipse') return '椭圆章'
  return '内容区域'
}

function normalizeCropRect(rect: NormalizedCropRect): NormalizedCropRect | null {
  const left = clamp(Math.min(rect.left, rect.right), 0, 1)
  const right = clamp(Math.max(rect.left, rect.right), 0, 1)
  const top = clamp(Math.min(rect.top, rect.bottom), 0, 1)
  const bottom = clamp(Math.max(rect.top, rect.bottom), 0, 1)
  if (right - left < 0.015 || bottom - top < 0.015) {
    return null
  }
  return { left, top, right, bottom }
}

function createDefaultCropRect(): NormalizedCropRect {
  return {
    left: 0.08,
    top: 0.08,
    right: 0.92,
    bottom: 0.92,
  }
}

function getCropBoundsForRequest(): SealCropBounds | null {
  const rect = manualCropNormalized.value
  const size = sourceImageNaturalSize.value
  if (!rect || !size.width || !size.height) {
    return null
  }

  const left = clamp(Math.round(rect.left * (size.width - 1)), 0, size.width - 1)
  const top = clamp(Math.round(rect.top * (size.height - 1)), 0, size.height - 1)
  const right = clamp(Math.round(rect.right * (size.width - 1)), left, size.width - 1)
  const bottom = clamp(Math.round(rect.bottom * (size.height - 1)), top, size.height - 1)
  return { left, top, right, bottom }
}

async function loadSourcePreview(filePath: string): Promise<void> {
  revokeObjectUrl(sourcePreviewUrl)
  const response = await window.electronAPI.fs.readFileBytes(filePath)
  if (!response.success || !response.data) {
    throw new Error(response.error || '读取原图失败')
  }
  sourcePreviewUrl.value = bytesToObjectUrl(response.data, getMimeTypeForPath(filePath))
}

function clearPendingProcess(): void {
  if (processDebounceTimer) {
    clearTimeout(processDebounceTimer)
    processDebounceTimer = null
  }
}

function resetProcessingState(): void {
  clearPendingProcess()
  processSerial += 1
  isProcessing.value = false
  errorMessage.value = ''
  result.value = null
  basePreviewBytes = null
  baseExportBytes = null
  hasEditedResult.value = false
  eraseModeEnabled.value = false
  resultZoom.value = 1
  erasePointerActive = false
  lastErasePoint = null
  revokeObjectUrl(resultPreviewUrl)
}

function resetWorkspaceState(): void {
  resetProcessingState()
  sourcePath.value = ''
  revokeObjectUrl(sourcePreviewUrl)
  sourceImageNaturalSize.value = { width: 0, height: 0 }
  manualCropEnabled.value = false
  manualCropNormalized.value = null
  cropEditActive.value = false
  dragMode = null
  dragStartPoint = null
  dragStartRect = null
  removeDragListeners()
}

function openLegalDialog(): void {
  legalDialogVisible.value = true
}

function ensureLegalConfirmed(action: PendingLegalAction = null): boolean {
  if (legalConfirmed.value) {
    return true
  }
  pendingLegalAction.value = action
  openLegalDialog()
  return false
}

async function confirmLegalNotice(): Promise<void> {
  if (!legalAcknowledgeChecked.value) {
    toast.add({ severity: 'warn', summary: '请先勾选确认', detail: '勾选已知悉后才能继续使用印章提取。', life: 3200 })
    return
  }
  legalConfirmed.value = true
  legalDialogVisible.value = false
  toast.add({ severity: 'success', summary: '已确认法律提示', detail: '现在可以选择并处理印章图片。', life: 2400 })
  const pendingAction = pendingLegalAction.value
  pendingLegalAction.value = null
  if (pendingAction === 'select-image') {
    await openImagePickerAndProcess()
  }
}

function scheduleProcess(delay = 220): void {
  if (!sourcePath.value || !legalConfirmed.value) return
  clearPendingProcess()
  processDebounceTimer = setTimeout(() => {
    void processCurrentImage(false)
  }, delay)
}

async function processCurrentImage(showSuccessToast = false): Promise<void> {
  if (!sourcePath.value || !legalConfirmed.value) return
  const requestId = ++processSerial
  errorMessage.value = ''
  isProcessing.value = true

  try {
    const response = await window.electronAPI.toolbox.processSealImage({
      filePath: sourcePath.value,
      legalConfirmed: legalConfirmed.value,
      backgroundThreshold: backgroundThreshold.value,
      redSensitivity: redSensitivity.value,
      edgeSoftness: edgeSoftness.value,
      dpi: dpi.value,
      scaleMode: 'dpi-scale',
      cropBounds: getCropBoundsForRequest(),
    })
    if (requestId !== processSerial) {
      return
    }
    if (!response.success || !response.data) {
      throw new Error(response.error || '印章提取失败')
    }

    result.value = response.data
    basePreviewBytes = new Uint8Array(response.data.previewBytes)
    baseExportBytes = new Uint8Array(response.data.pngBytes)
    revokeObjectUrl(resultPreviewUrl)
    resultPreviewUrl.value = bytesToObjectUrl(response.data.previewBytes, 'image/png')
    if (showSuccessToast) {
      toast.add({
        severity: 'success',
        summary: '处理完成',
        detail: `已提取${mapShapeLabel(response.data.detectedShape)}透明 PNG，可按 ${response.data.dpi} DPI 导出。`,
        life: 2800,
      })
    }
  } catch (error) {
    if (requestId !== processSerial) {
      return
    }
    result.value = null
    revokeObjectUrl(resultPreviewUrl)
    errorMessage.value = error instanceof Error ? error.message : '印章提取失败'
    toast.add({ severity: 'error', summary: '处理失败', detail: errorMessage.value, life: 4000 })
  } finally {
    if (requestId === processSerial) {
      isProcessing.value = false
    }
  }
}

async function processFile(filePath: string): Promise<void> {
  if (!ensureLegalConfirmed()) {
    return
  }
  sourcePath.value = filePath
  resetProcessingState()
  manualCropNormalized.value = manualCropEnabled.value ? createDefaultCropRect() : null
  await loadSourcePreview(filePath)
  await processCurrentImage(true)
}

async function openImagePickerAndProcess(): Promise<void> {
  const picker = await window.electronAPI.fs.selectFile({
    properties: ['openFile'],
    filters: [supportedImageFilter],
  })
  if (!picker.success || !picker.data || picker.data.canceled) {
    return
  }

  const filePath = Array.isArray(picker.data.filePaths) ? String(picker.data.filePaths[0] || '').trim() : ''
  if (!filePath) {
    return
  }

  await processFile(filePath)
}

async function selectImageAndProcess(): Promise<void> {
  if (!ensureLegalConfirmed('select-image')) {
    return
  }
  await openImagePickerAndProcess()
}

async function initializeResultCanvas(bytes: Uint8Array): Promise<void> {
  const canvas = resultCanvasRef.value
  if (!canvas) return
  const image = await bytesToImageElement(bytes, 'image/png')
  canvas.width = image.naturalWidth
  canvas.height = image.naturalHeight
  const context = canvas.getContext('2d')
  if (!context) {
    throw new Error('无法初始化抠图画布')
  }
  context.clearRect(0, 0, canvas.width, canvas.height)
  context.drawImage(image, 0, 0)
  hasEditedResult.value = false
}

function getResultCanvasContext(): CanvasRenderingContext2D | null {
  return resultCanvasRef.value?.getContext('2d') ?? null
}

function getCanvasPoint(event: PointerEvent): { x: number; y: number } | null {
  const canvas = resultCanvasRef.value
  if (!canvas) return null
  const rect = canvas.getBoundingClientRect()
  if (!rect.width || !rect.height) return null
  return {
    x: clamp(((event.clientX - rect.left) / rect.width) * canvas.width, 0, canvas.width),
    y: clamp(((event.clientY - rect.top) / rect.height) * canvas.height, 0, canvas.height),
  }
}

function eraseAtPoint(point: { x: number; y: number }): void {
  const context = getResultCanvasContext()
  if (!context) return
  context.save()
  context.globalCompositeOperation = 'destination-out'
  context.lineCap = 'round'
  context.lineJoin = 'round'
  context.lineWidth = brushSize.value * 2
  if (!lastErasePoint) {
    context.beginPath()
    context.arc(point.x, point.y, brushSize.value, 0, Math.PI * 2)
    context.fill()
  } else {
    context.beginPath()
    context.moveTo(lastErasePoint.x, lastErasePoint.y)
    context.lineTo(point.x, point.y)
    context.stroke()
  }
  context.restore()
  lastErasePoint = point
  hasEditedResult.value = true
}

async function canvasToBytes(): Promise<Uint8Array | null> {
  const canvas = resultCanvasRef.value
  if (!canvas) return null
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
  if (!blob) return null
  const arrayBuffer = await blob.arrayBuffer()
  return new Uint8Array(arrayBuffer)
}

async function syncEditedResultBytes(): Promise<Uint8Array | null> {
  const nextBytes = await canvasToBytes()
  if (!nextBytes || !result.value) {
    return null
  }
  revokeObjectUrl(resultPreviewUrl)
  resultPreviewUrl.value = bytesToObjectUrl(nextBytes, 'image/png')
  result.value = {
    ...result.value,
    pngBytes: nextBytes,
    previewBytes: nextBytes,
  }
  return nextBytes
}

async function toggleEraseMode(): Promise<void> {
  if (!result.value || isProcessing.value) return
  const nextEnabled = !eraseModeEnabled.value
  eraseModeEnabled.value = nextEnabled
  if (nextEnabled && basePreviewBytes && !hasEditedResult.value) {
    await nextTick()
    await initializeResultCanvas(basePreviewBytes)
  }
}

function zoomResult(step: number): void {
  resultZoom.value = clamp(Number((resultZoom.value + step).toFixed(2)), 0.5, 3)
}

async function restoreEditedResult(): Promise<void> {
  if (!basePreviewBytes) return
  await initializeResultCanvas(basePreviewBytes)
  revokeObjectUrl(resultPreviewUrl)
  resultPreviewUrl.value = bytesToObjectUrl(basePreviewBytes, 'image/png')
  if (result.value) {
    result.value = {
      ...result.value,
      pngBytes: baseExportBytes ? new Uint8Array(baseExportBytes) : result.value.pngBytes,
      previewBytes: new Uint8Array(basePreviewBytes),
    }
  }
  toast.add({ severity: 'success', summary: '已恢复结果', detail: '已还原到本次自动提取后的初始结果。', life: 2200 })
}

function handleResultCanvasPointerDown(event: PointerEvent): void {
  if (!eraseModeEnabled.value || !result.value) return
  const point = getCanvasPoint(event)
  if (!point) return
  erasePointerActive = true
  lastErasePoint = null
  eraseAtPoint(point)
}

function handleResultCanvasPointerMove(event: PointerEvent): void {
  if (!eraseModeEnabled.value || !erasePointerActive) return
  const point = getCanvasPoint(event)
  if (!point) return
  eraseAtPoint(point)
}

async function finishEraseStroke(): Promise<void> {
  if (!erasePointerActive) return
  erasePointerActive = false
  lastErasePoint = null
  await syncEditedResultBytes()
}

async function handleResultCanvasPointerUp(): Promise<void> {
  await finishEraseStroke()
}

async function handleResultCanvasPointerLeave(): Promise<void> {
  await finishEraseStroke()
}

async function handleExportPng(): Promise<void> {
  if (!result.value) return
  const exportBytes = (await syncEditedResultBytes()) ?? result.value.pngBytes
  const saveResult = await window.electronAPI.fs.saveFile({
    defaultPath: result.value.outputFileName,
    filters: [{ name: 'PNG 图片', extensions: ['png'] }],
  })

  if (!saveResult.success || !saveResult.data || saveResult.data.canceled || !saveResult.data.filePath) {
    return
  }

  const writeResult = await window.electronAPI.fs.writeFileBytes(String(saveResult.data.filePath), exportBytes)
  if (!writeResult.success) {
    toast.add({ severity: 'error', summary: '导出失败', detail: writeResult.error || 'PNG 保存失败。', life: 4000 })
    return
  }

  toast.add({
    severity: 'success',
    summary: '导出成功',
    detail: `透明 PNG 已保存，导出尺寸 ${result.value.exportWidth} × ${result.value.exportHeight}，${result.value.dpi} DPI。`,
    life: 2800,
  })
}

async function handleCopyImage(): Promise<void> {
  if (!result.value) return
  const copyBytes = (await syncEditedResultBytes()) ?? result.value.pngBytes
  const copyResult = await window.electronAPI.fs.clipboardWriteImageBytes(copyBytes)
  if (!copyResult.success) {
    toast.add({ severity: 'error', summary: '复制失败', detail: copyResult.error || '无法写入剪贴板。', life: 4000 })
    return
  }
  toast.add({ severity: 'success', summary: '已复制', detail: '印章 PNG 已写入剪贴板。', life: 2200 })
}

function toggleHelp(): void {
  helpVisible.value = !helpVisible.value
}

function toggleManualCrop(): void {
  if (!legalConfirmed.value) return
  manualCropEnabled.value = !manualCropEnabled.value
  if (manualCropEnabled.value) {
    manualCropNormalized.value = manualCropNormalized.value ?? createDefaultCropRect()
    cropEditActive.value = true
  } else {
    cropEditActive.value = false
  }
  scheduleProcess(0)
}

function exitManualCrop(): void {
  if (!manualCropEnabled.value) return
  dragMode = null
  dragStartPoint = null
  dragStartRect = null
  removeDragListeners()
  manualCropEnabled.value = false
  cropEditActive.value = false
  scheduleProcess(0)
}

function resetCropRect(): void {
  if (!manualCropNormalized.value && !manualCropEnabled.value) return
  manualCropNormalized.value = createDefaultCropRect()
  cropEditActive.value = manualCropEnabled.value
  scheduleProcess(0)
}

function handleSourceImageLoad(): void {
  const image = sourceImageRef.value
  if (!image) return
  sourceImageNaturalSize.value = {
    width: image.naturalWidth,
    height: image.naturalHeight,
  }
  if (manualCropEnabled.value && !manualCropNormalized.value) {
    manualCropNormalized.value = createDefaultCropRect()
  }
}

function getNormalizedPoint(event: PointerEvent): { x: number; y: number } | null {
  const overlay = cropOverlayRef.value
  if (!overlay) return null
  const rect = overlay.getBoundingClientRect()
  if (!rect.width || !rect.height) return null
  return {
    x: clamp((event.clientX - rect.left) / rect.width, 0, 1),
    y: clamp((event.clientY - rect.top) / rect.height, 0, 1),
  }
}

function removeDragListeners(): void {
  window.removeEventListener('pointermove', handleCropPointerMove)
  window.removeEventListener('pointerup', handleCropPointerUp)
}

function beginCropDrag(mode: DragMode, event: PointerEvent): void {
  if (!cropEditActive.value || !manualCropNormalized.value) return
  const point = getNormalizedPoint(event)
  if (!point) return
  dragMode = mode
  dragStartPoint = point
  dragStartRect = { ...manualCropNormalized.value }
  window.addEventListener('pointermove', handleCropPointerMove)
  window.addEventListener('pointerup', handleCropPointerUp)
}

function updateCropRect(event: PointerEvent): void {
  if (!cropEditActive.value || !dragMode || !dragStartPoint || !dragStartRect) return
  const point = getNormalizedPoint(event)
  if (!point) return

  const deltaX = point.x - dragStartPoint.x
  const deltaY = point.y - dragStartPoint.y

  if (dragMode === 'move') {
    const width = dragStartRect.right - dragStartRect.left
    const height = dragStartRect.bottom - dragStartRect.top
    const nextLeft = clamp(dragStartRect.left + deltaX, 0, 1 - width)
    const nextTop = clamp(dragStartRect.top + deltaY, 0, 1 - height)
    manualCropNormalized.value = {
      left: nextLeft,
      top: nextTop,
      right: nextLeft + width,
      bottom: nextTop + height,
    }
    return
  }

  const nextRect: NormalizedCropRect = { ...dragStartRect }
  if (dragMode.includes('n')) {
    nextRect.top = clamp(dragStartRect.top + deltaY, 0, dragStartRect.bottom - 0.015)
  }
  if (dragMode.includes('s')) {
    nextRect.bottom = clamp(dragStartRect.bottom + deltaY, dragStartRect.top + 0.015, 1)
  }
  if (dragMode.includes('w')) {
    nextRect.left = clamp(dragStartRect.left + deltaX, 0, dragStartRect.right - 0.015)
  }
  if (dragMode.includes('e')) {
    nextRect.right = clamp(dragStartRect.right + deltaX, dragStartRect.left + 0.015, 1)
  }
  manualCropNormalized.value = nextRect
}

function handleCropPointerMove(event: PointerEvent): void {
  updateCropRect(event)
}

function handleCropPointerUp(event: PointerEvent): void {
  updateCropRect(event)
  const nextRect = manualCropNormalized.value ? normalizeCropRect(manualCropNormalized.value) : null
  manualCropNormalized.value = nextRect
  dragMode = null
  dragStartPoint = null
  dragStartRect = null
  removeDragListeners()
  scheduleProcess(0)
}

function handleSelectionPointerDown(event: PointerEvent): void {
  beginCropDrag('move', event)
}

function handleResizePointerDown(handle: CropHandle, event: PointerEvent): void {
  beginCropDrag(handle, event)
}

function handleOverlayPointerDown(): void {
  if (!cropEditActive.value || manualCropNormalized.value) return
  manualCropNormalized.value = createDefaultCropRect()
}

function handleWindowKeydown(event: KeyboardEvent): void {
  if (!manualCropEnabled.value) return
  if (event.key !== 'Enter' || event.isComposing) return
  event.preventDefault()
  exitManualCrop()
}

watch([backgroundThreshold, redSensitivity, edgeSoftness, dpi], () => {
  scheduleProcess()
})

watch(legalConfirmed, (next) => {
  if (!next) {
    pendingLegalAction.value = null
    legalAcknowledgeChecked.value = false
    resetProcessingState()
  } else if (sourcePath.value) {
    scheduleProcess(0)
  }
})

defineExpose({
  handleSelectImage: selectImageAndProcess,
  handleReset: resetWorkspaceState,
  toggleHelp,
  helpVisible,
})

onMounted(() => {
  window.addEventListener('keydown', handleWindowKeydown)
})

onBeforeUnmount(() => {
  clearPendingProcess()
  revokeObjectUrl(sourcePreviewUrl)
  revokeObjectUrl(resultPreviewUrl)
  removeDragListeners()
  window.removeEventListener('keydown', handleWindowKeydown)
})
</script>

<style scoped>
.preview-card {
  display: flex;
  min-height: 0;
  flex-direction: column;
  border: 1px solid var(--content-border);
  border-radius: 1.75rem;
  padding: 1.25rem;
  box-shadow: 0 14px 34px rgba(15, 23, 42, 0.05);
}

.preview-card__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
}

.preview-card__body {
  display: flex;
  min-height: 320px;
  flex: 1;
  align-items: center;
  justify-content: center;
  padding-top: 1.25rem;
}

.seal-stage {
  display: flex;
  min-height: 320px;
  width: 100%;
  align-items: center;
  justify-content: center;
  overflow: auto;
  border-radius: 1.5rem;
  border: 1px solid var(--content-border);
  padding: 1.5rem;
}

.seal-stage--source {
  background: linear-gradient(135deg, rgba(255, 247, 237, 0.95), rgba(255, 255, 255, 0.98));
}

.seal-stage--result {
  background:
    linear-gradient(45deg, rgba(226, 232, 240, 0.55) 25%, transparent 25%, transparent 75%, rgba(226, 232, 240, 0.55) 75%, rgba(226, 232, 240, 0.55)),
    linear-gradient(45deg, rgba(226, 232, 240, 0.55) 25%, transparent 25%, transparent 75%, rgba(226, 232, 240, 0.55) 75%, rgba(226, 232, 240, 0.55));
  background-color: rgba(255, 255, 255, 0.98);
  background-position: 0 0, 14px 14px;
  background-size: 28px 28px;
}

.seal-image-shell {
  position: relative;
  display: inline-flex;
  max-width: 100%;
  max-height: 100%;
}

.seal-result-shell {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.seal-result-shell__zoom {
  position: absolute;
  right: 0.85rem;
  top: 0.85rem;
  border-radius: 9999px;
  background: rgba(15, 23, 42, 0.72);
  padding: 0.35rem 0.7rem;
  font-size: 0.75rem;
  color: white;
  pointer-events: none;
}

.crop-overlay {
  position: absolute;
  inset: 0;
  cursor: default;
  border-radius: 1rem;
  background: linear-gradient(180deg, rgba(15, 23, 42, 0.03), rgba(15, 23, 42, 0.06));
}

.crop-overlay__selection {
  position: absolute;
  cursor: move;
  border: 2px solid rgba(244, 63, 94, 0.92);
  border-radius: 0.75rem;
  box-shadow: 0 0 0 9999px rgba(15, 23, 42, 0.22);
}

.crop-overlay__handle {
  position: absolute;
  width: 0.9rem;
  height: 0.9rem;
  border: 2px solid white;
  border-radius: 9999px;
  background: rgba(244, 63, 94, 1);
  box-shadow: 0 4px 12px rgba(15, 23, 42, 0.18);
}

.crop-overlay__handle--nw {
  left: 0;
  top: 0;
  cursor: nwse-resize;
  transform: translate(-50%, -50%);
}

.crop-overlay__handle--ne {
  right: 0;
  top: 0;
  cursor: nesw-resize;
  transform: translate(50%, -50%);
}

.crop-overlay__handle--sw {
  left: 0;
  bottom: 0;
  cursor: nesw-resize;
  transform: translate(-50%, 50%);
}

.crop-overlay__handle--se {
  right: 0;
  bottom: 0;
  cursor: nwse-resize;
  transform: translate(50%, 50%);
}

.crop-overlay__hint {
  position: absolute;
  right: 0.85rem;
  top: 0.85rem;
  border-radius: 9999px;
  background: rgba(15, 23, 42, 0.72);
  padding: 0.35rem 0.7rem;
  font-size: 0.75rem;
  color: white;
}

.seal-stage__image {
  max-height: 100%;
  max-width: 100%;
  object-fit: contain;
  border-radius: 1rem;
  box-shadow: 0 16px 34px rgba(15, 23, 42, 0.08);
}

.seal-stage__canvas {
  max-width: none;
}

.seal-stage__canvas--erase {
  cursor: crosshair;
}

.seal-empty {
  display: flex;
  min-height: 320px;
  width: 100%;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  border: 1px dashed color-mix(in srgb, var(--content-border) 80%, transparent);
  border-radius: 1.5rem;
  color: var(--content-text-secondary);
  text-align: center;
}

.seal-empty__action {
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  border: none;
  background: transparent;
  cursor: pointer;
}

.seal-empty__action:disabled {
  cursor: not-allowed;
  opacity: 0.72;
}

.toolbox-inline-tip {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  border: 1px solid var(--content-border);
  border-radius: 9999px;
  background: var(--content-bg);
  color: var(--content-text-secondary);
  transition: color 0.2s ease, border-color 0.2s ease, background-color 0.2s ease;
}

.toolbox-inline-tip:hover {
  color: var(--primary-color);
  border-color: color-mix(in srgb, var(--primary-color) 45%, var(--content-border));
  background: color-mix(in srgb, var(--primary-color) 8%, var(--content-bg));
}

.toolbox-range {
  accent-color: rgb(225, 29, 72);
}

.toolbox-select {
  border: 1px solid var(--content-border);
  border-radius: 0.9rem;
  background: var(--content-bg);
  padding: 0.7rem 0.9rem;
  color: var(--content-text);
}

.toolbox-icon-button--active {
  color: rgb(225, 29, 72);
  background: rgba(255, 241, 242, 0.9);
}
</style>
