<template>
  <main class="flex flex-col h-full overflow-hidden bg-[var(--content-bg)] text-[var(--content-text)]">
    <PreviewHeader
      :display-name="displayName"
      :file-path="filePath"
      :has-previous="hasPrevious"
      :has-next="hasNext"
      :is-zoomable="isZoomable"
      :is-ready="isReady"
      :scale="scale"
      :library-path="libraryPath"
      :contract-id="contractId"
      :file-id="fileId"
      @back="goBack"
      @previous="goPrevious"
      @next="goNext"
      @zoom-in="zoomIn"
      @zoom-out="zoomOut"
      @reset-zoom="resetZoom"
      @copy="copyFileToClipboard"
      @open-external="openExternal"
    />

    <div class="flex-1 overflow-hidden">
      <div v-if="loading" class="h-full flex items-center justify-center">
        <ProgressSpinner style="width: 40px; height: 40px" strokeWidth="3" />
      </div>

      <div v-else-if="errorMessage" class="h-full flex flex-col items-center justify-center text-[var(--content-text-secondary)] px-6">
        <i class="pi pi-exclamation-triangle text-3xl mb-3 opacity-60"></i>
        <div class="text-sm text-center max-w-[70ch] break-words">{{ errorMessage }}</div>
      </div>

      <div ref="previewScrollEl" v-else class="h-full overflow-auto relative" :class="isUnsupported ? 'flex items-center justify-center' : 'p-6'">
        <!-- PDF Preview -->
        <PdfPreview
          v-if="ext === 'pdf'"
          :page-numbers="pageNumbers"
          @set-canvas-ref="setCanvasRef"
        />

        <!-- Image Preview -->
        <ImagePreview
          v-else-if="isImage"
          :image-url="imageUrl"
          :scale="scale"
        />

        <!-- Office Preview -->
        <OfficePreview
          v-else-if="isOffice"
          :ext="ext"
          :office-buffer="officeBuffer"
          :office-key="officeKey"
          :excel-view-mode="excelViewMode"
          :excel-sheets="excelSheets"
          @rendered="onOfficeRendered"
          @error="onOfficeError"
        />

        <TextPreview
          v-else-if="isText"
          :file-path="filePath"
          :text="textContent ?? ''"
          :encoding="textEncoding"
          :truncated="textTruncated"
          :bytes-read="textBytesRead"
          :file-size="textFileSize"
        />

        <!-- Unsupported File -->
        <UnsupportedFile
          v-else
          :ext="ext"
          :display-name="displayName"
          @copy="copyFileToClipboard"
          @open-external="openExternal"
        />
      </div>
    </div>
  </main>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import ProgressSpinner from 'primevue/progressspinner'
import { useToast } from 'primevue/usetoast'
import PreviewHeader from './components/preview/PreviewHeader.vue'
import PdfPreview from './components/preview/PdfPreview.vue'
import ImagePreview from './components/preview/ImagePreview.vue'
import OfficePreview from './components/preview/OfficePreview.vue'
import TextPreview from './components/preview/TextPreview.vue'
import UnsupportedFile from './components/preview/UnsupportedFile.vue'
import { useFilePreview } from './composables/useFilePreview'
import { useFileNavigation } from './composables/useFileNavigation'
import { isTextLikeFile } from './utils/isTextLikeFile'
import { isOdfSpreadsheetExtension, isOdfTextPreviewExtension } from '@/utils/odfPreview'

const route = useRoute()
const router = useRouter()
const toast = useToast()

const libraryPath = computed(() => localStorage.getItem('currentLibraryPath') || '')
const contractId = computed(() => String(route.params.contractId || '').trim())
const isTrashMode = computed(() => contractId.value === '__trash__')

const filePath = computed(() => {
  const v = route.query.path
  if (typeof v === 'string') return v
  if (Array.isArray(v)) return String(v[0] || '')
  return ''
})

const fileId = computed(() => {
  const v = route.query.fileId
  if (typeof v === 'string') return v
  if (Array.isArray(v)) return String(v[0] || '')
  
  const idx = currentIndex.value
  if (idx >= 0 && idx < siblingFiles.value.length) {
    return String(siblingFiles.value[idx].fileId)
  }
  return ''
})

const displayName = computed(() => {
  const v = route.query.name
  if (typeof v === 'string') return v
  if (Array.isArray(v)) return String(v[0] || '')
  const p = String(filePath.value || '')
  const idx1 = p.lastIndexOf('/')
  const idx2 = p.lastIndexOf('\\')
  const idx = Math.max(idx1, idx2)
  return idx >= 0 ? p.slice(idx + 1) : p
})

const ext = computed(() => {
  const name = displayName.value
  const idx = name.lastIndexOf('.')
  if (idx > 0) return name.slice(idx + 1).toLowerCase()
  return ''
})

const isImage = computed(() => ['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(ext.value))
const isOffice = computed(() => ['docx', 'xlsx', 'xls', 'pptx', 'ppt'].includes(ext.value) || isOdfSpreadsheetExtension(ext.value))
const isText = computed(() => isTextLikeFile(displayName.value) || isOdfTextPreviewExtension(ext.value) || ext.value === 'ofd')
const isUnsupported = computed(() => ext.value !== 'pdf' && !isImage.value && !isOffice.value && !isText.value)
const isZoomable = computed(() => ext.value === 'pdf' || isImage.value)

// File preview composable
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
  setCanvasRef,
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

// File navigation composable
const {
  siblingFiles,
  loadSiblings,
  currentIndex,
  hasPrevious,
  hasNext,
  getPreviousFile,
  getNextFile,
} = useFileNavigation({
  libraryPath: () => libraryPath.value,
  contractId: () => contractId.value,
  filePath: () => filePath.value,
  isTrashMode: () => isTrashMode.value,
})

const goPrevious = () => {
  if (!hasPrevious.value) return
  const prev = getPreviousFile()
  if (prev) {
    router.replace({ query: { ...route.query, path: prev.path, name: prev.name, fileId: String(prev.fileId || '') } })
  }
}

const goNext = () => {
  if (!hasNext.value) return
  const next = getNextFile()
  if (next) {
    router.replace({ query: { ...route.query, path: next.path, name: next.name, fileId: String(next.fileId || '') } })
  }
}

const previewScrollEl = ref<HTMLElement | null>(null)

const isEditableTarget = (target: EventTarget | null) => {
  const el = target instanceof HTMLElement ? target : null
  if (!el) return false
  const tag = el.tagName.toLowerCase()
  if (tag === 'input' || tag === 'textarea' || tag === 'select') return true
  return el.isContentEditable
}

const wheelListenerOptions: AddEventListenerOptions = { passive: false }
const onWheel = (e: WheelEvent) => {
  if (e.defaultPrevented) return
  if (!(e.ctrlKey || e.metaKey)) return
  if (isEditableTarget(e.target)) return
  if (!isZoomable.value || !isReady.value) return

  const delta = Number(e.deltaY)
  if (!Number.isFinite(delta) || delta === 0) return

  e.preventDefault()
  if (delta < 0) {
    void zoomIn()
  } else {
    void zoomOut()
  }
}

watch(previewScrollEl, (el, prev) => {
  prev?.removeEventListener('wheel', onWheel)
  el?.addEventListener('wheel', onWheel, wheelListenerOptions)
})

const onKeydown = (e: KeyboardEvent) => {
  if (e.defaultPrevented) return
  if (isEditableTarget(e.target)) return

  if (e.ctrlKey || e.metaKey) {
    if (e.key === 'c' || e.key === 'C') {
      const p = String(filePath.value || '').trim()
      if (!p) return
      e.preventDefault()
      copyFileToClipboard()
    }
    return
  }
  if (e.altKey) return

  const scrollStep = 80
  const contentEl = document.querySelector('.flex-1.overflow-hidden > div') as HTMLElement | null
  const scrollable = contentEl || document.documentElement

  if (e.key === 'ArrowLeft') {
    if (!hasPrevious.value) return
    e.preventDefault()
    goPrevious()
    return
  }
  if (e.key === 'ArrowRight') {
    if (!hasNext.value) return
    e.preventDefault()
    goNext()
    return
  }
  if (e.key === 'ArrowUp') {
    e.preventDefault()
    scrollable.scrollTop -= scrollStep
    return
  }
  if (e.key === 'ArrowDown') {
    e.preventDefault()
    scrollable.scrollTop += scrollStep
  }
}

const copyFileToClipboard = async () => {
  const p = String(filePath.value || '').trim()
  if (!p) return
  const res = await window.electronAPI.fs.clipboardWriteFile(p)
  if (res.success) {
    toast.add({ severity: 'success', summary: '已复制', detail: '文件已复制到剪贴板，可直接粘贴到微信或资源管理器', life: 2000 })
  } else {
    toast.add({ severity: 'error', summary: '复制失败', detail: res.error || '复制文件失败', life: 3000 })
  }
}

const openExternal = async () => {
  const p = String(filePath.value || '').trim()
  if (!p) return
  const res = await window.electronAPI.fs.openFile(p)
  if (!res.success) {
    toast.add({ severity: 'error', summary: '打开失败', detail: res.error || '打开文件失败', life: 3000 })
  }
}

const goBack = () => {
  if (window.history.length > 1) {
    router.back()
    return
  }
  router.push({ name: 'ContractFiles', params: { contractId: contractId.value } })
}

const loadAll = async () => {
  if (siblingFiles.value.length === 0) {
    await loadSiblings()
  }
  await loadFile()
}

watch([() => route.query.path, () => route.query.name], async () => {
  await loadAll()
})

onMounted(async () => {
  window.addEventListener('keydown', onKeydown)
  await loadAll()
})

onBeforeUnmount(async () => {
  window.removeEventListener('keydown', onKeydown)
  previewScrollEl.value?.removeEventListener('wheel', onWheel)
  await cleanup()
})
</script>
