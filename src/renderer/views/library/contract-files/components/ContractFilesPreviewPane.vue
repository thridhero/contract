<template>
  <div class="h-full w-full overflow-hidden relative bg-[var(--content-bg)] text-[var(--content-text)]">
    <div v-if="!filePath" class="h-full flex items-center justify-center text-sm text-[var(--content-text-secondary)]">
      选择左侧结果以预览
    </div>

    <div v-else class="h-full overflow-hidden relative">
      <div v-if="loading" class="h-full flex items-center justify-center">
        <ProgressSpinner style="width: 40px; height: 40px" strokeWidth="3" />
      </div>

      <div v-else-if="errorMessage" class="h-full flex flex-col items-center justify-center text-[var(--content-text-secondary)] px-6">
        <i class="pi pi-exclamation-triangle text-3xl mb-3 opacity-60"></i>
        <div class="text-sm text-center max-w-[70ch] break-words">{{ errorMessage }}</div>
      </div>

      <div
        v-else
        ref="previewScrollEl"
        class="h-full overflow-auto relative"
        :class="isUnsupported ? 'flex items-center justify-center' : 'p-6'"
      >
        <PdfPreview
          v-if="ext === 'pdf'"
          :page-numbers="pageNumbers"
          :page-highlights="pdfPageHighlights"
          @set-canvas-ref="setCanvasRef"
          @set-text-layer-ref="setTextLayerRef"
        />
        <ImagePreview v-else-if="isImage" :image-url="imageUrl" :scale="scale" />
        <div v-else-if="isOffice" :style="{ zoom: String(scale) }" class="origin-top-left">
          <OfficePreview
            ref="officePreviewEl"
            :ext="ext"
            :office-buffer="officeBuffer"
            :office-key="officeKey"
            :excel-view-mode="excelViewMode"
            :excel-sheets="excelSheets"
            @rendered="onOfficeRendered"
            @error="onOfficeError"
          />
        </div>
        <div v-else-if="isText" :style="{ zoom: String(scale) }" class="origin-top-left">
          <TextPreview
            :file-path="filePath"
            :text="textContent ?? ''"
            :encoding="textEncoding"
            :truncated="textTruncated"
            :bytes-read="textBytesRead"
            :file-size="textFileSize"
          />
        </div>
        <UnsupportedFile v-else :ext="ext" :display-name="displayName" />
      </div>
    </div>

    <div v-if="filePath && canZoom" class="absolute right-4 bottom-4 z-20 flex items-center gap-1.5">
      <button
        type="button"
        class="w-9 h-9 rounded-full flex items-center justify-center border border-[var(--content-border)] bg-[var(--content-bg)]/90 backdrop-blur-md text-[var(--content-text)] shadow-lg hover:bg-[var(--sidebar-hover-bg)] transition-colors"
        @click="zoomOut"
      >
        <i class="pi pi-minus"></i>
      </button>
      <button
        type="button"
        class="h-9 px-3 rounded-full flex items-center justify-center border border-[var(--content-border)] bg-[var(--content-bg)]/90 backdrop-blur-md text-[var(--content-text)] shadow-lg hover:bg-[var(--sidebar-hover-bg)] transition-colors tabular-nums text-xs"
        @click="resetZoom"
      >
        {{ zoomPercent }}
      </button>
      <button
        type="button"
        class="w-9 h-9 rounded-full flex items-center justify-center border border-[var(--content-border)] bg-[var(--content-bg)]/90 backdrop-blur-md text-[var(--content-text)] shadow-lg hover:bg-[var(--sidebar-hover-bg)] transition-colors"
        @click="zoomIn"
      >
        <i class="pi pi-plus"></i>
      </button>
      <button
        type="button"
        class="w-9 h-9 rounded-full flex items-center justify-center bg-[var(--btn-primary-bg)] text-white shadow-lg hover:opacity-90 transition-opacity"
        @click="openFind"
      >
        <i class="pi pi-search"></i>
      </button>
    </div>

    <div
      v-if="findVisible"
      class="absolute right-4 top-4 z-20 flex items-center gap-2 rounded-xl border border-[var(--content-border)] bg-[var(--content-bg)]/90 backdrop-blur-md px-3 py-2 shadow-lg"
    >
      <div class="relative w-64">
        <i class="pi pi-search absolute left-2 top-1/2 -translate-y-1/2 text-[var(--content-text-secondary)] text-sm"></i>
        <input
          ref="findInputEl"
          v-model="findQuery"
          type="text"
          class="w-full bg-[var(--input-bg)] border border-[var(--input-border)] rounded-lg pl-7 pr-2 py-1.5 text-sm focus:outline-none focus:border-blue-500 text-[var(--content-text)]"
          placeholder="在文档内查找"
          @keydown.enter.prevent="(e) => (e.shiftKey ? findPrevious() : findNext())"
          @keydown.esc.prevent="closeFind"
        />
      </div>

      <div class="text-xs tabular-nums text-[var(--content-text-secondary)] min-w-14 text-center">
        {{ matchDisplay }}
      </div>

      <button
        type="button"
        class="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--content-text-secondary)] hover:bg-[var(--sidebar-hover-bg)] hover:text-[var(--content-text)] transition-colors"
        :disabled="!canFind"
        @click="findPrevious"
      >
        <i class="pi pi-angle-up"></i>
      </button>
      <button
        type="button"
        class="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--content-text-secondary)] hover:bg-[var(--sidebar-hover-bg)] hover:text-[var(--content-text)] transition-colors"
        :disabled="!canFind"
        @click="findNext"
      >
        <i class="pi pi-angle-down"></i>
      </button>

      <button
        type="button"
        class="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--content-text-secondary)] hover:bg-[var(--sidebar-hover-bg)] hover:text-[var(--content-text)] transition-colors"
        @click="closeFind"
      >
        <i class="pi pi-times"></i>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import ProgressSpinner from 'primevue/progressspinner'
import PdfPreview from './preview/PdfPreview.vue'
import ImagePreview from './preview/ImagePreview.vue'
import OfficePreview from './preview/OfficePreview.vue'
import TextPreview from './preview/TextPreview.vue'
import UnsupportedFile from './preview/UnsupportedFile.vue'
import { useFilePreview } from '../composables/useFilePreview'
import { isTextLikeFile } from '../utils/isTextLikeFile'
import { isOdfSpreadsheetExtension, isOdfTextPreviewExtension } from '@/utils/odfPreview'
import { useDebounceFn } from '@vueuse/core'
import type { PdfTextSearchHighlightResult, PdfTextSearchMatch, PdfTextSearchRect } from '../../../../../shared/types/fileConversion.types'

type PdfTextSegment = {
  text: string
  left: number
  top: number
  width: number
  height: number
}

type PdfPreviewMatch = {
  id: string
  pageNumber: number
  rects: PdfTextSearchRect[]
  source: 'text' | 'ocr'
  text?: string
}

const props = defineProps<{
  filePath: string
  displayName: string
}>()

const filePath = computed(() => String(props.filePath || '').trim())
const displayName = computed(() => String(props.displayName || '').trim())

const ext = computed(() => {
  const name = displayName.value
  const idx = name.lastIndexOf('.')
  if (idx > 0) return name.slice(idx + 1).toLowerCase()
  return ''
})

const previewScrollEl = ref<HTMLElement | null>(null)
const isImage = computed(() => ['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(ext.value))
const isOffice = computed(() => ['docx', 'xlsx', 'xls', 'pptx', 'ppt'].includes(ext.value) || isOdfSpreadsheetExtension(ext.value))
const isText = computed(() => isTextLikeFile(displayName.value) || isOdfTextPreviewExtension(ext.value) || ext.value === 'ofd')
const isUnsupported = computed(() => ext.value !== 'pdf' && !isImage.value && !isOffice.value && !isText.value)

const {
  loading,
  errorMessage,
  scale,
  imageUrl,
  textContent,
  textEncoding,
  textTruncated,
  textBytesRead,
  textFileSize,
  excelSheets,
  excelViewMode,
  officeBuffer,
  officeKey,
  isReady,
  pageNumbers,
  pageCount,
  pdfDoc,
  setCanvasRef,
  setTextLayerRef,
  onOfficeRendered,
  onOfficeError,
  cleanup,
  loadFile,
  zoomIn,
  zoomOut,
  resetZoom,
} = useFilePreview({
  filePath: () => filePath.value,
  ext: () => ext.value,
  isImage: () => isImage.value,
  displayName: () => displayName.value,
})

const canZoom = computed(() => !isUnsupported.value)

const zoomPercent = computed(() => `${Math.round(Math.max(0.01, scale.value) * 100)}%`)

watch(
  () => filePath.value,
  async () => {
    await stopFindInPage('clearSelection')
    resetFindState()
    if (!filePath.value) return
    await loadFile()
  },
  { immediate: true }
)

const findVisible = ref(false)
const findQuery = ref('')
const findInputEl = ref<HTMLInputElement | null>(null)
const officePreviewEl = ref<InstanceType<typeof OfficePreview> | null>(null)
const lastRequestId = ref(0)
const activeMatchOrdinal = ref(0)
const matches = ref(0)
const pdfSearchLoading = ref(false)
const pdfSearchSeq = ref(0)
const pdfMatches = ref<PdfPreviewMatch[]>([])

const isPdfFind = computed(() => ext.value === 'pdf')
const isOfficeFind = computed(() => isOffice.value)
const canFind = computed(() => !!filePath.value && !!findQuery.value.trim())

const matchDisplay = computed(() => {
  if (!canFind.value) return '-'
  if (isPdfFind.value && pdfSearchLoading.value) return '...'
  if (matches.value <= 0) return '0/0'
  const active = Math.max(1, activeMatchOrdinal.value)
  return `${active}/${matches.value}`
})

const clampUnit = (value: number) => {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.min(1, value))
}

const normalizeRect = (rect: PdfTextSearchRect | null | undefined) => {
  if (!rect) return null
  const left = clampUnit(Number(rect.left || 0))
  const top = clampUnit(Number(rect.top || 0))
  const width = clampUnit(Number(rect.width || 0))
  const height = clampUnit(Number(rect.height || 0))
  if (width <= 0 || height <= 0) return null
  const safeWidth = Math.min(width, 1 - left)
  const safeHeight = Math.min(height, 1 - top)
  if (safeWidth <= 0 || safeHeight <= 0) return null
  return { left, top, width: safeWidth, height: safeHeight }
}

const pdfPageHighlights = computed(() => {
  const highlightMap: Record<number, Array<{
    id: string
    left: number
    top: number
    width: number
    height: number
    active: boolean
  }>> = {}
  const activeMatch = activeMatchOrdinal.value > 0 ? pdfMatches.value[activeMatchOrdinal.value - 1] : null
  const activeId = activeMatch?.id || ''
  for (const match of pdfMatches.value) {
    for (const [rectIndex, rect] of match.rects.entries()) {
      const normalized = normalizeRect(rect)
      if (!normalized) continue
      if (!highlightMap[match.pageNumber]) highlightMap[match.pageNumber] = []
      highlightMap[match.pageNumber].push({
        id: `${match.id}-${rectIndex}`,
        left: normalized.left,
        top: normalized.top,
        width: normalized.width,
        height: normalized.height,
        active: match.id === activeId,
      })
    }
  }
  return highlightMap
})

function resetFindState() {
  lastRequestId.value = 0
  activeMatchOrdinal.value = 0
  matches.value = 0
  pdfSearchSeq.value += 1
  pdfSearchLoading.value = false
  pdfMatches.value = []
  if (isOfficeFind.value && officePreviewEl.value) {
    officePreviewEl.value.clearSearch()
  }
}

async function stopFindInPage(action: 'clearSelection' | 'keepSelection' | 'activateSelection') {
  try {
    await window.electronAPI.webContents.stopFindInPage({ action })
  } catch {
  }
}

const doFind = async (payload: { text: string; options?: { forward?: boolean; findNext?: boolean } }) => {
  const text = String(payload.text || '').trim()
  if (!text) return
  try {
    const res = await window.electronAPI.webContents.findInPage({
      text,
      options: {
        forward: payload.options?.forward !== false,
        findNext: !!payload.options?.findNext,
      },
    })
    if (!res.success || !res.data) return
    lastRequestId.value = Number(res.data.requestId || 0)
  } catch {
  }
}

const buildPdfSegments = (items: any[], pageWidth: number, pageHeight: number) => {
  const segments: PdfTextSegment[] = []
  for (const item of items) {
    const text = String(item?.str ?? '')
    const rawLeft = Number(item?.transform?.[4] ?? 0)
    const rawTop = Number(item?.transform?.[5] ?? 0)
    const rawHeight = Math.max(
      8,
      Math.abs(Number(item?.height ?? 0)),
      Math.abs(Number(item?.transform?.[3] ?? 0)),
    )
    const rawWidth = Math.max(
      2,
      Math.abs(Number(item?.width ?? 0)),
      text.trim() ? text.length * rawHeight * 0.5 : 0,
    )
    if (!text && rawWidth <= 0) continue
    const left = Math.max(0, Math.min(pageWidth, rawLeft))
    const top = Math.max(0, Math.min(pageHeight, pageHeight - rawTop - rawHeight))
    segments.push({
      text,
      left,
      top,
      width: Math.min(rawWidth, Math.max(0, pageWidth - left)),
      height: Math.min(rawHeight, Math.max(0, pageHeight - top)),
    })
  }
  return segments
}

const groupPdfSegmentsByLine = (segments: PdfTextSegment[]) => {
  const sorted = [...segments].sort((a, b) => {
    const deltaTop = Math.abs(a.top - b.top)
    const tolerance = Math.max(a.height, b.height) * 0.6
    if (deltaTop <= tolerance) return a.left - b.left
    return a.top - b.top
  })
  const lines: PdfTextSegment[][] = []
  for (const segment of sorted) {
    const lastLine = lines[lines.length - 1]
    const first = lastLine?.[0]
    if (!lastLine || !first) {
      lines.push([segment])
      continue
    }
    const tolerance = Math.max(first.height, segment.height) * 0.6
    if (Math.abs(first.top - segment.top) <= tolerance) {
      lastLine.push(segment)
      continue
    }
    lines.push([segment])
  }
  return lines
}

const searchPdfLineMatches = (segments: PdfTextSegment[], queryLower: string, pageWidth: number, pageHeight: number) => {
  const ranges: Array<{ start: number; end: number; segment: PdfTextSegment }> = []
  let combined = ''
  for (const segment of segments) {
    const start = combined.length
    combined += segment.text
    ranges.push({ start, end: combined.length, segment })
  }
  const lower = combined.toLocaleLowerCase()
  const pageMatches: PdfTextSearchMatch[] = []
  let fromIndex = 0
  while (fromIndex <= lower.length - queryLower.length) {
    const matchIndex = lower.indexOf(queryLower, fromIndex)
    if (matchIndex < 0) break
    const matchEnd = matchIndex + queryLower.length
    const rects = ranges
      .filter((range) => range.end > matchIndex && range.start < matchEnd)
      .map((range) => normalizeRect({
        left: range.segment.left / pageWidth,
        top: range.segment.top / pageHeight,
        width: range.segment.width / pageWidth,
        height: range.segment.height / pageHeight,
      }))
      .filter((rect): rect is PdfTextSearchRect => !!rect)
    if (rects.length > 0) {
      pageMatches.push({
        rects,
        text: combined.slice(matchIndex, matchEnd),
        source: 'text',
      })
    }
    fromIndex = matchIndex + Math.max(1, queryLower.length)
  }
  return pageMatches
}

const readPdfTextMatchesForPage = async (pageNumber: number, queryLower: string) => {
  const doc = pdfDoc.value
  if (!doc) return { hasText: false, matches: [] as PdfTextSearchMatch[] }
  const page = await doc.getPage(pageNumber)
  const viewport = page.getViewport({ scale: 1 })
  const textContent = await page.getTextContent()
  const rawItems = Array.isArray((textContent as any)?.items) ? (textContent as any).items : []
  const segments = buildPdfSegments(rawItems, viewport.width, viewport.height)
  if (segments.length === 0) {
    return { hasText: false, matches: [] as PdfTextSearchMatch[] }
  }
  const lineGroups = groupPdfSegmentsByLine(segments)
  const pageMatches: PdfTextSearchMatch[] = []
  for (const line of lineGroups) {
    pageMatches.push(...searchPdfLineMatches(line, queryLower, viewport.width, viewport.height))
  }
  return { hasText: true, matches: pageMatches }
}

const applyPdfMatches = (payload: PdfTextSearchHighlightResult['items']) => {
  const ordered = [...payload].sort((a, b) => a.pageNumber - b.pageNumber)
  const nextMatches: PdfPreviewMatch[] = []
  for (const page of ordered) {
    for (const match of page.matches || []) {
      const rects = Array.isArray(match.rects)
        ? match.rects.map((rect) => normalizeRect(rect)).filter((rect): rect is PdfTextSearchRect => !!rect)
        : []
      if (rects.length === 0) continue
      nextMatches.push({
        id: `pdf-match-${page.pageNumber}-${nextMatches.length}`,
        pageNumber: page.pageNumber,
        rects,
        source: match.source,
        text: match.text,
      })
    }
  }
  pdfMatches.value = nextMatches
  matches.value = nextMatches.length
  activeMatchOrdinal.value = nextMatches.length > 0 ? 1 : 0
}

const scrollToActivePdfMatch = async () => {
  const container = previewScrollEl.value
  const current = activeMatchOrdinal.value > 0 ? pdfMatches.value[activeMatchOrdinal.value - 1] : null
  if (!container || !current) return
  await nextTick()
  const highlightEl = container.querySelector(`[data-highlight-id="${current.id}-0"]`) as HTMLElement | null
  if (highlightEl) {
    highlightEl.scrollIntoView({ block: 'center', behavior: 'smooth' })
    return
  }
  const pageEl = container.querySelector(`[data-pdf-page="${current.pageNumber}"]`) as HTMLElement | null
  if (pageEl) {
    pageEl.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }
}

const setActivePdfMatchOrdinal = async (ordinal: number) => {
  if (matches.value <= 0) return
  const total = matches.value
  const normalized = ((ordinal - 1 + total) % total) + 1
  activeMatchOrdinal.value = normalized
  await scrollToActivePdfMatch()
}

const searchPdfMatches = async (queryText: string) => {
  const doc = pdfDoc.value
  if (!doc) {
    resetFindState()
    return
  }
  const current = pdfSearchSeq.value + 1
  pdfSearchSeq.value = current
  pdfSearchLoading.value = true
  try {
    const queryLower = String(queryText || '').trim().toLocaleLowerCase()
    const pageItems: PdfTextSearchHighlightResult['items'] = []
    const ocrPageNumbers: number[] = []

    for (let pageNumber = 1; pageNumber <= pageCount.value; pageNumber += 1) {
      if (current !== pdfSearchSeq.value) return
      const pageResult = await readPdfTextMatchesForPage(pageNumber, queryLower)
      if (pageResult.matches.length > 0) {
        pageItems.push({
          pageNumber,
          matches: pageResult.matches,
        })
        continue
      }
      if (!pageResult.hasText) {
        ocrPageNumbers.push(pageNumber)
      }
    }

    if (ocrPageNumbers.length > 0 && filePath.value) {
      const res = await window.electronAPI.fileConversion.findPdfTextHighlights({
        filePath: filePath.value,
        query: queryText,
        pageNumbers: ocrPageNumbers,
      })
      if (current !== pdfSearchSeq.value) return
      if (res.success && Array.isArray(res.data?.items)) {
        pageItems.push(...res.data.items)
      }
    }

    if (current !== pdfSearchSeq.value) return
    applyPdfMatches(pageItems)
    if (matches.value > 0) {
      await scrollToActivePdfMatch()
    }
  } catch {
    if (current !== pdfSearchSeq.value) return
    pdfMatches.value = []
    matches.value = 0
    activeMatchOrdinal.value = 0
  } finally {
    if (current === pdfSearchSeq.value) {
      pdfSearchLoading.value = false
    }
  }
}

const debouncedFind = useDebounceFn(async () => {
  if (!findVisible.value) return
  if (!canFind.value) {
    await stopFindInPage('clearSelection')
    resetFindState()
    return
  }
  if (isPdfFind.value) {
    await stopFindInPage('clearSelection')
    await searchPdfMatches(findQuery.value)
    return
  }
  if (isOfficeFind.value && officePreviewEl.value) {
    await stopFindInPage('clearSelection')
    const res = await officePreviewEl.value.search(findQuery.value)
    matches.value = res.matches
    activeMatchOrdinal.value = res.activeMatchOrdinal
    return
  }
  await doFind({ text: findQuery.value, options: { forward: true, findNext: false } })
}, 200)

watch(findQuery, () => {
  void debouncedFind()
})

watch(
  () => isReady.value,
  (ready) => {
    if (!ready) return
    if (!findVisible.value) return
    if (!findQuery.value.trim()) return
    void debouncedFind()
  }
)

const openFind = async () => {
  if (!filePath.value) return
  findVisible.value = true
  await nextTick()
  const el = findInputEl.value
  if (el) {
    try {
      el.focus({ preventScroll: true } as any)
    } catch {
      el.focus()
    }
    el.select()
  }
}

const setFindQuery = async (query: string, open = true) => {
  findQuery.value = String(query || '')
  if (open) await openFind()
}

const closeFind = async () => {
  findVisible.value = false
  await stopFindInPage('clearSelection')
  resetFindState()
}

const findNext = async () => {
  if (!canFind.value) return
  if (isPdfFind.value) {
    await setActivePdfMatchOrdinal(activeMatchOrdinal.value + 1)
    return
  }
  if (isOfficeFind.value && officePreviewEl.value) {
    const res = officePreviewEl.value.findNext()
    matches.value = res.matches
    activeMatchOrdinal.value = res.activeMatchOrdinal
    return
  }
  await doFind({ text: findQuery.value, options: { forward: true, findNext: true } })
}

const findPrevious = async () => {
  if (!canFind.value) return
  if (isPdfFind.value) {
    await setActivePdfMatchOrdinal(activeMatchOrdinal.value - 1)
    return
  }
  if (isOfficeFind.value && officePreviewEl.value) {
    const res = officePreviewEl.value.findPrevious()
    matches.value = res.matches
    activeMatchOrdinal.value = res.activeMatchOrdinal
    return
  }
  await doFind({ text: findQuery.value, options: { forward: false, findNext: true } })
}

defineExpose({
  openFind,
  closeFind,
  findNext,
  findPrevious,
  setFindQuery,
})

const onKeydownCapture = (e: KeyboardEvent) => {
  const key = String(e.key || '')
  const lower = key.toLowerCase()
  const mod = e.ctrlKey || e.metaKey
  if (mod && !e.shiftKey && !e.altKey && lower === 'f') {
    e.preventDefault()
    if (!findVisible.value) {
      void openFind()
      return
    }
    const el = findInputEl.value
    if (el) {
      try {
        el.focus({ preventScroll: true } as any)
      } catch {
        el.focus()
      }
      el.select()
    }
    return
  }
  if (mod && !e.shiftKey && !e.altKey && (key === '=' || key === '+' || lower === 'add')) {
    e.preventDefault()
    void zoomIn()
    return
  }
  if (mod && !e.shiftKey && !e.altKey && (key === '-' || lower === 'subtract')) {
    e.preventDefault()
    void zoomOut()
    return
  }
  if (mod && !e.shiftKey && !e.altKey && lower === '0') {
    e.preventDefault()
    void resetZoom()
    return
  }
  if (key === 'Escape' && findVisible.value) {
    e.preventDefault()
    void closeFind()
  }
}

const onWheelZoom = (e: WheelEvent) => {
  if (!canZoom.value) return
  const mod = e.ctrlKey || e.metaKey
  if (!mod) return
  const target = e.target as HTMLElement | null
  const container = previewScrollEl.value
  if (!container) return
  if (target && !container.contains(target)) return
  if (target?.closest('input, textarea, [contenteditable="true"]')) return
  e.preventDefault()
  if (e.deltaY < 0) {
    void zoomIn()
    return
  }
  if (e.deltaY > 0) {
    void zoomOut()
  }
}

let offFoundInPage: null | (() => void) = null

onMounted(() => {
  window.addEventListener('keydown', onKeydownCapture, true)
  window.addEventListener('wheel', onWheelZoom as any, { passive: false, capture: true } as any)
  offFoundInPage = window.electronAPI.webContents.onFoundInPage((payload) => {
    const p = payload as any
    const rid = Number(p?.requestId ?? 0)
    if (!rid || rid !== lastRequestId.value) return
    matches.value = Math.max(0, Number(p?.matches ?? 0))
    activeMatchOrdinal.value = Math.max(0, Number(p?.activeMatchOrdinal ?? 0))
  })
})

onBeforeUnmount(async () => {
  window.removeEventListener('keydown', onKeydownCapture, true)
  window.removeEventListener('wheel', onWheelZoom as any, true as any)
  offFoundInPage?.()
  offFoundInPage = null
  await stopFindInPage('clearSelection')
  await cleanup()
})
</script>
