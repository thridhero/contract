<template>
  <div class="flex h-full min-h-0 flex-col gap-5">
    <section class="grid min-h-0 flex-1 gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
      <div class="grid min-h-0 gap-5 lg:grid-cols-2">
        <article class="preview-card" :style="panelStyle">
          <div class="preview-card__header">
            <div>
              <h4 class="text-base font-semibold text-[var(--content-text)]">原图与手动裁切</h4>
              <p class="mt-1 text-sm text-[var(--content-text-secondary)]">
                {{ sourceFileName || '尚未选择图片' }}
              </p>
            </div>
            <div class="flex flex-wrap items-center justify-end gap-2">
              <Button
                :label="manualCropEnabled ? '关闭手动裁切' : '开启手动裁切'"
                :severity="manualCropEnabled ? 'secondary' : undefined"
                size="small"
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
            <div v-if="sourcePreviewUrl" class="signature-stage signature-stage--source">
              <div class="signature-image-shell">
                <img
                  ref="sourceImageRef"
                  :src="sourcePreviewUrl"
                  alt="原始签名图片"
                  class="signature-stage__image"
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
                  <div class="crop-overlay__hint">
                    拖动边框或四角调整范围
                  </div>
                </div>
              </div>
            </div>
            <div v-else class="signature-empty">
              <i class="pi pi-image text-2xl"></i>
              <button type="button" class="signature-empty__action" @click="selectImageAndProcess">
                <span class="mt-3 text-base font-medium text-[var(--content-text)]">等待上传签名图片</span>
                <span class="mt-2 text-sm text-[var(--content-text-secondary)]">点击这里选择图片文件</span>
              </button>
            </div>
          </div>
        </article>

        <article class="preview-card" :style="panelStyle">
          <div class="preview-card__header">
            <div>
              <h4 class="text-base font-semibold text-[var(--content-text)]">抠图结果</h4>
              <p class="mt-1 text-sm text-[var(--content-text-secondary)]">
                {{ result ? `${result.width} × ${result.height}` : '自动去背景并裁切到签字边界' }}
              </p>
            </div>
          </div>
          <div class="preview-card__body">
            <div v-if="isProcessing" class="signature-empty">
              <ProgressSpinner style="width: 46px; height: 46px" strokeWidth="4" />
              <div class="mt-4 text-base font-medium text-[var(--content-text)]">正在识别签字区域</div>
            </div>
            <div v-else-if="resultPreviewUrl" class="signature-stage signature-stage--result">
              <img :src="resultPreviewUrl" alt="签名抠图结果" class="signature-stage__image" />
            </div>
            <div v-else class="signature-empty">
              <i class="pi pi-file-edit text-2xl"></i>
              <div class="mt-3 text-base font-medium text-[var(--content-text)]">处理结果会显示在这里</div>
            </div>
          </div>
        </article>
      </div>

      <aside class="flex min-h-0 flex-col gap-5">
        <section class="rounded-[28px] border px-5 py-5 shadow-sm" :style="panelStyle">
          <div class="flex items-center justify-between gap-3">
            <div class="text-base font-semibold text-[var(--content-text)]">抠图调节</div>
            <button
              v-tooltip.left="'阈值越高，浅灰背景扣得越狠；颜色容差越低，字缝和笔迹周边更容易被清掉；柔化越小，边缘会更干净但也更硬。'"
              type="button"
              class="toolbox-inline-tip"
              aria-label="查看抠图调节说明"
            >
              <i class="pi pi-info-circle"></i>
            </button>
          </div>
          <div class="mt-4 space-y-5">
            <label class="block">
              <div class="flex items-center justify-between gap-3 text-sm">
                <span class="text-[var(--content-text)]">浅色阈值</span>
                <span class="text-[var(--content-text-secondary)]">{{ backgroundThreshold }}</span>
              </div>
              <input v-model.number="backgroundThreshold" type="range" min="208" max="252" step="1" class="toolbox-range mt-3 w-full" />
            </label>

            <label class="block">
              <div class="flex items-center justify-between gap-3 text-sm">
                <span class="text-[var(--content-text)]">颜色容差</span>
                <span class="text-[var(--content-text-secondary)]">{{ saturationThreshold }}</span>
              </div>
              <input v-model.number="saturationThreshold" type="range" min="8" max="80" step="1" class="toolbox-range mt-3 w-full" />
            </label>

            <label class="block">
              <div class="flex items-center justify-between gap-3 text-sm">
                <span class="text-[var(--content-text)]">边缘柔化</span>
                <span class="text-[var(--content-text-secondary)]">{{ softness }}</span>
              </div>
              <input v-model.number="softness" type="range" min="4" max="64" step="1" class="toolbox-range mt-3 w-full" />
            </label>
          </div>
        </section>

        <section class="rounded-[28px] border px-5 py-5 shadow-sm" :style="panelStyle">
          <div class="text-base font-semibold text-[var(--content-text)]">处理结果</div>
          <div v-if="result" class="mt-4 space-y-3 text-sm text-[var(--content-text-secondary)]">
            <div>文件名：{{ result.outputFileName }}</div>
            <div>尺寸：{{ result.width }} × {{ result.height }}</div>
            <div>最终边界：{{ trimBoundsText }}</div>
            <div>处理区域：{{ appliedCropText }}</div>
          </div>
          <div v-else class="mt-4 text-sm leading-7 text-[var(--content-text-secondary)]">
            选择图片后会自动处理。调整参数或裁切框后也会自动重新生成结果。
          </div>
          <div class="mt-5 flex flex-col gap-3">
            <Button label="重新处理当前图片" :disabled="!sourcePath || isProcessing" @click="processCurrentImage()" />
            <Button label="导出 PNG" :disabled="!result || isProcessing" @click="handleExportPng" />
            <Button label="复制图片" severity="secondary" :disabled="!result || isProcessing" @click="handleCopyImage" />
          </div>
        </section>

        <section v-if="helpVisible" class="rounded-[28px] border px-5 py-5 shadow-sm" :style="panelStyle">
          <div class="text-base font-semibold text-[var(--content-text)]">使用说明</div>
          <div class="mt-3 space-y-2 text-sm leading-7 text-[var(--content-text-secondary)]">
            <p>如果文字周边发灰，先提高“浅色阈值”，再适当降低“颜色容差”。</p>
            <p>如果笔迹边缘被吃掉了，先把“边缘柔化”拉高一点，或降低“浅色阈值”。</p>
            <p>字缝、字洞没有完全透明时，通常是阈值不够高或容差偏大。</p>
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
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import Button from 'primevue/button'
import ProgressSpinner from 'primevue/progressspinner'
import { useToast } from 'primevue/usetoast'
import type { ProcessSignatureImageResult, SignatureCropBounds } from '../../../shared/types/toolbox.types'

type NormalizedCropRect = {
  left: number
  top: number
  right: number
  bottom: number
}

type CropHandle = 'nw' | 'ne' | 'sw' | 'se'
type DragMode = 'move' | CropHandle

const toast = useToast()

const supportedImageFilter = {
  name: '图片文件',
  extensions: ['png', 'jpg', 'jpeg', 'webp', 'bmp', 'gif'],
}

const panelStyle = {
  borderColor: 'var(--content-border)',
  backgroundColor: 'var(--content-card-bg)',
}

const panelInsetStyle = {
  borderColor: 'var(--content-border)',
  backgroundColor: 'var(--content-bg)',
}

const sourcePath = ref('')
const sourcePreviewUrl = ref('')
const resultPreviewUrl = ref('')
const result = ref<ProcessSignatureImageResult | null>(null)
const helpVisible = ref(false)
const isProcessing = ref(false)
const errorMessage = ref('')
const backgroundThreshold = ref(244)
const saturationThreshold = ref(26)
const softness = ref(18)
const manualCropEnabled = ref(false)
const manualCropNormalized = ref<NormalizedCropRect | null>(null)
const cropEditActive = ref(false)
const sourceImageNaturalSize = ref({ width: 0, height: 0 })
const sourceImageRef = ref<HTMLImageElement | null>(null)
const cropOverlayRef = ref<HTMLElement | null>(null)
const cropHandles: CropHandle[] = ['nw', 'ne', 'sw', 'se']

let processSerial = 0
let processDebounceTimer: ReturnType<typeof setTimeout> | null = null
let dragMode: DragMode | null = null
let dragStartPoint: { x: number; y: number } | null = null
let dragStartRect: NormalizedCropRect | null = null

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

function formatBounds(bounds: SignatureCropBounds): string {
  return `${bounds.left}, ${bounds.top} - ${bounds.right}, ${bounds.bottom}`
}

function getMimeTypeForPath(filePath: string): string {
  const extension = String(filePath.split('.').pop() || '').toLowerCase()
  if (extension === 'jpg' || extension === 'jpeg') return 'image/jpeg'
  if (extension === 'webp') return 'image/webp'
  if (extension === 'bmp') return 'image/bmp'
  if (extension === 'gif') return 'image/gif'
  return 'image/png'
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
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
    left: 0.06,
    top: 0.08,
    right: 0.94,
    bottom: 0.92,
  }
}

function getCropBoundsForRequest(): SignatureCropBounds | null {
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

function scheduleProcess(delay = 220): void {
  if (!sourcePath.value) return
  clearPendingProcess()
  processDebounceTimer = setTimeout(() => {
    void processCurrentImage(false)
  }, delay)
}

async function processCurrentImage(showSuccessToast = false): Promise<void> {
  if (!sourcePath.value) return
  const requestId = ++processSerial
  errorMessage.value = ''
  isProcessing.value = true

  try {
    const response = await window.electronAPI.toolbox.processSignatureImage({
      filePath: sourcePath.value,
      backgroundThreshold: backgroundThreshold.value,
      saturationThreshold: saturationThreshold.value,
      softness: softness.value,
      cropBounds: getCropBoundsForRequest(),
    })
    if (requestId !== processSerial) {
      return
    }
    if (!response.success || !response.data) {
      throw new Error(response.error || '签名抠图失败')
    }

    result.value = response.data
    revokeObjectUrl(resultPreviewUrl)
    resultPreviewUrl.value = bytesToObjectUrl(response.data.previewBytes, 'image/png')
    if (showSuccessToast) {
      toast.add({ severity: 'success', summary: '处理完成', detail: `签名已自动抠图并裁切：${formatBounds(response.data.trimBounds)}`, life: 2500 })
    }
  } catch (error) {
    if (requestId !== processSerial) {
      return
    }
    result.value = null
    revokeObjectUrl(resultPreviewUrl)
    errorMessage.value = error instanceof Error ? error.message : '签名抠图失败'
    toast.add({ severity: 'error', summary: '处理失败', detail: errorMessage.value, life: 4000 })
  } finally {
    if (requestId === processSerial) {
      isProcessing.value = false
    }
  }
}

async function processFile(filePath: string): Promise<void> {
  sourcePath.value = filePath
  result.value = null
  errorMessage.value = ''
  manualCropNormalized.value = manualCropEnabled.value ? createDefaultCropRect() : null
  await loadSourcePreview(filePath)
  await processCurrentImage(true)
}

async function selectImageAndProcess(): Promise<void> {
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

async function handleExportPng(): Promise<void> {
  if (!result.value) return
  const saveResult = await window.electronAPI.fs.saveFile({
    defaultPath: result.value.outputFileName,
    filters: [{ name: 'PNG 图片', extensions: ['png'] }],
  })

  if (!saveResult.success || !saveResult.data || saveResult.data.canceled || !saveResult.data.filePath) {
    return
  }

  const writeResult = await window.electronAPI.fs.writeFileBytes(String(saveResult.data.filePath), result.value.pngBytes)
  if (!writeResult.success) {
    toast.add({ severity: 'error', summary: '导出失败', detail: writeResult.error || 'PNG 保存失败。', life: 4000 })
    return
  }

  toast.add({ severity: 'success', summary: '导出成功', detail: '透明 PNG 已保存。', life: 2500 })
}

async function handleCopyImage(): Promise<void> {
  if (!result.value) return
  const copyResult = await window.electronAPI.fs.clipboardWriteImageBytes(result.value.pngBytes)
  if (!copyResult.success) {
    toast.add({ severity: 'error', summary: '复制失败', detail: copyResult.error || '无法写入剪贴板。', life: 4000 })
    return
  }
  toast.add({ severity: 'success', summary: '已复制', detail: '签名图片已写入剪贴板。', life: 2200 })
}

function toggleHelp(): void {
  helpVisible.value = !helpVisible.value
}

function toggleManualCrop(): void {
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

watch([backgroundThreshold, saturationThreshold, softness], () => {
  scheduleProcess()
})

defineExpose({
  handleSelectImage: selectImageAndProcess,
  handleReprocess: () => (sourcePath.value ? processCurrentImage(true) : selectImageAndProcess()),
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

.signature-stage {
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

.signature-stage--source {
  background: linear-gradient(135deg, rgba(248, 250, 252, 0.95), rgba(255, 255, 255, 0.98));
}

.signature-stage--result {
  background:
    linear-gradient(45deg, rgba(226, 232, 240, 0.55) 25%, transparent 25%, transparent 75%, rgba(226, 232, 240, 0.55) 75%, rgba(226, 232, 240, 0.55)),
    linear-gradient(45deg, rgba(226, 232, 240, 0.55) 25%, transparent 25%, transparent 75%, rgba(226, 232, 240, 0.55) 75%, rgba(226, 232, 240, 0.55));
  background-color: rgba(255, 255, 255, 0.98);
  background-position: 0 0, 14px 14px;
  background-size: 28px 28px;
}

.signature-image-shell {
  position: relative;
  display: inline-flex;
  max-width: 100%;
  max-height: 100%;
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
  border: 2px solid rgba(16, 185, 129, 0.95);
  border-radius: 0.75rem;
  box-shadow: 0 0 0 9999px rgba(15, 23, 42, 0.22);
}

.crop-overlay__handle {
  position: absolute;
  width: 0.9rem;
  height: 0.9rem;
  border: 2px solid white;
  border-radius: 9999px;
  background: rgba(16, 185, 129, 1);
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

.signature-stage__image {
  max-height: 100%;
  max-width: 100%;
  object-fit: contain;
  border-radius: 1rem;
  box-shadow: 0 16px 34px rgba(15, 23, 42, 0.08);
}

.signature-empty {
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

.signature-empty__action {
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  border: none;
  background: transparent;
  cursor: pointer;
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
  accent-color: var(--primary-color);
}
</style>
