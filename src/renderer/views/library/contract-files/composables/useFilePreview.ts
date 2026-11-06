import { computed, markRaw, nextTick, ref, shallowRef, watch } from 'vue'
import pdfWorkerSrc from 'pdfjs-dist/legacy/build/pdf.worker.mjs'
import { isTextLikeFile } from '../utils/isTextLikeFile'
import { extractOdfPreviewText, isOdfSpreadsheetExtension, isOdfTextPreviewExtension } from '@/utils/odfPreview'
import { extractOfdPreviewText } from '@/utils/ofdPreview'

export interface UseFilePreviewOptions {
  filePath: () => string
  ext: () => string
  isImage: () => boolean
  displayName: () => string
}

export function useFilePreview(options: UseFilePreviewOptions) {
  const { filePath, ext, isImage, displayName } = options
  const isNativeText = () => isTextLikeFile(displayName())
  const isOdfTextPreview = () => isOdfTextPreviewExtension(ext())
  const isOfdTextPreview = () => ext() === 'ofd'
  const isText = () => isNativeText() || isOdfTextPreview() || isOfdTextPreview()

  const loading = ref(false)
  const errorMessage = ref('')
  const scale = ref(1)
  const bytes = shallowRef<Uint8Array | null>(null)
  const textContent = ref<string | null>(null)
  const textEncoding = ref('')
  const textTruncated = ref(false)
  const textBytesRead = ref(0)
  const textFileSize = ref(0)
  const imageUrl = ref('')
  const excelSheets = ref<Array<{ name: string; rows: string[][] }>>([])
  const excelViewMode = ref<'vue-office' | 'fallback'>('vue-office')
  let officeTimeout: number | null = null
  let officeRenderedOnce = false

  // PDF specific
  const pageCount = ref(0)
  const canvases = ref<Array<HTMLCanvasElement | null>>([])
  const textLayerHosts = ref<Array<HTMLElement | null>>([])
  const pdfDoc = shallowRef<any>(null)
  let textLayerBuilders: any[] = []
  let renderToken = 0
  let renderLoopPromise: Promise<void> | null = null
  let renderPending = false

  const officeBuffer = computed(() => {
    const u8 = bytes.value
    if (!u8) return null
    return u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength)
  })

  const officeKey = computed(() => {
    const p = String(filePath() || '')
    const len = bytes.value?.byteLength || 0
    return `${p}|${ext()}|${len}`
  })

  const isReady = computed(() => {
    if (isText()) return textContent.value !== null
    if (ext() === 'pdf') return !!pdfDoc.value && pageCount.value > 0
    if (isImage()) return !!imageUrl.value
    return !!bytes.value
  })

  const pageNumbers = computed(() => Array.from({ length: pageCount.value }, (_, i) => i + 1))

  let pdfjsLoadPromise: Promise<any> | null = null
  const getPdfjs = async () => {
    if (pdfjsLoadPromise) return pdfjsLoadPromise
    pdfjsLoadPromise = (async () => {
      const P = Promise as any
      if (typeof P.try !== 'function') {
        P.try = (fn: any, ...args: any[]) => Promise.resolve().then(() => fn(...args))
      }
      if (typeof P.withResolvers !== 'function') {
        P.withResolvers = () => {
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
        const toAbsoluteAssetUrl = (input: string): string => {
          const value = String(input || '').trim()
          if (!value) return value
          if (value.startsWith('file://') || value.startsWith('http://') || value.startsWith('https://')) {
            return value
          }
          return new URL(value, window.location.href).toString()
        }
        pdfjsLib.GlobalWorkerOptions.workerSrc = toAbsoluteAssetUrl(pdfWorkerSrc)
      }
      return pdfjsLib
    })()
    return pdfjsLoadPromise
  }

  let pdfjsViewerLoadPromise: Promise<any> | null = null
  const getPdfjsViewer = async () => {
    if (pdfjsViewerLoadPromise) return pdfjsViewerLoadPromise
    pdfjsViewerLoadPromise = import('pdfjs-dist/legacy/web/pdf_viewer.mjs')
    return pdfjsViewerLoadPromise
  }

  const setCanvasRef = (el: Element | null, index: number) => {
    const canvas = el instanceof HTMLCanvasElement ? el : null
    canvases.value[index] = canvas
  }

  const setTextLayerRef = (el: Element | null, index: number) => {
    const host = el instanceof HTMLElement ? el : null
    textLayerHosts.value[index] = host
    if (ext() === 'pdf' && isReady.value) {
      void scheduleRenderAllPages()
    }
  }

  const waitForCanvasRefs = async (expected: number) => {
    const total = Math.max(0, Math.floor(expected))
    if (total === 0) return true
    for (let i = 0; i < 8; i++) {
      await nextTick()
      const ready = canvases.value.slice(0, total).filter(Boolean).length
      if (ready >= total) return true
      await new Promise<void>((resolve) => window.setTimeout(resolve, 16))
    }
    return false
  }

  const renderAllPages = async () => {
    const doc = pdfDoc.value
    if (!doc) return
    const token = ++renderToken
    const maxPixels = 4096 * 4096
    for (let pageNo = 1; pageNo <= pageCount.value; pageNo++) {
      if (token !== renderToken) return
      const canvas = canvases.value[pageNo - 1]
      if (!canvas) continue
      const ctx = canvas.getContext('2d')
      if (!ctx) continue
      const page = await doc.getPage(pageNo)
      const viewport = page.getViewport({ scale: Math.max(0.1, scale.value) })
      const pixelCount = Math.floor(viewport.width) * Math.floor(viewport.height)
      const safeViewport =
        pixelCount > maxPixels && pixelCount > 0
          ? page.getViewport({ scale: Math.max(0.1, scale.value * Math.sqrt(maxPixels / pixelCount)) })
          : viewport
      canvas.width = Math.max(1, Math.floor(safeViewport.width))
      canvas.height = Math.max(1, Math.floor(safeViewport.height))
      await page.render({ canvasContext: ctx, viewport: safeViewport }).promise

      const host = textLayerHosts.value[pageNo - 1]
      if (!host) continue
      const existing = textLayerBuilders[pageNo - 1]
      if (existing?.cancel) {
        try {
          existing.cancel()
        } catch {
        }
      }
      host.innerHTML = ''
      const viewer = await getPdfjsViewer()
      const TextLayerBuilder = (viewer as any)?.TextLayerBuilder
      if (typeof TextLayerBuilder !== 'function') continue
      const builder = new TextLayerBuilder({
        pdfPage: page,
        onAppend: (div: HTMLElement) => {
          div.style.setProperty('--total-scale-factor', String((safeViewport as any)?.scale ?? 1))
          host.innerHTML = ''
          host.appendChild(div)
        },
      })
      textLayerBuilders[pageNo - 1] = builder
      await builder.render({ viewport: safeViewport, images: null })
    }
  }

  const scheduleRenderAllPages = async () => {
    renderPending = true
    if (renderLoopPromise) return renderLoopPromise
    renderLoopPromise = (async () => {
      while (renderPending) {
        renderPending = false
        const count = Math.max(0, Math.floor(pageCount.value))
        if (ext() !== 'pdf' || !isReady.value || count <= 0) continue
        const ready = await waitForCanvasRefs(count)
        if (!ready) {
          renderPending = true
          continue
        }
        await renderAllPages()
      }
    })().finally(() => {
      renderLoopPromise = null
    })
    return renderLoopPromise
  }

  const ensureExcelParsed = async () => {
    if (excelSheets.value.length > 0) return
    const u8 = bytes.value
    if (!u8) return
    const mod: any = await import('xlsx')
    const XLSX = mod?.default || mod
    const wb = XLSX.read(u8, { type: 'array', cellDates: true })
    const sheets: Array<{ name: string; rows: string[][] }> = []
    const rowLimit = 200
    const colLimit = 50
    for (const name of wb.SheetNames || []) {
      const sheet = wb.Sheets?.[name]
      if (!sheet) continue
      const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, blankrows: false, raw: false }) as any[][]
      const normalized = Array.isArray(rows) ? rows.slice(0, rowLimit) : []
      const strRows: string[][] = normalized.map((r) => {
        const arr = Array.isArray(r) ? r.slice(0, colLimit) : []
        const row: string[] = []
        for (let i = 0; i < colLimit; i++) {
          const v = arr[i]
          row.push(String(v ?? '').trim())
        }
        return row
      })
      const hasContent = strRows.some((r) => r.some((c) => c !== ''))
      if (hasContent) sheets.push({ name, rows: strRows })
    }
    excelSheets.value = sheets
  }

  const onOfficeRendered = async () => {
    officeRenderedOnce = true
    if (officeTimeout !== null) {
      window.clearTimeout(officeTimeout)
      officeTimeout = null
    }
  }

  const onOfficeError = async (err: any) => {
    if (officeTimeout !== null) {
      window.clearTimeout(officeTimeout)
      officeTimeout = null
    }

    if (['xlsx', 'xls'].includes(ext()) || isOdfSpreadsheetExtension(ext())) {
      try {
        await ensureExcelParsed()
        if (excelSheets.value.length > 0) {
          excelViewMode.value = 'fallback'
          return
        }
      } catch { }
    }

    const msg = err instanceof Error ? err.message : String(err || 'Office 预览失败')
    errorMessage.value = msg
  }

  const cleanup = async () => {
    renderToken += 1
    renderPending = false
    bytes.value = null
    textContent.value = null
    textEncoding.value = ''
    textTruncated.value = false
    textBytesRead.value = 0
    textFileSize.value = 0
    excelSheets.value = []
    excelViewMode.value = 'vue-office'
    officeRenderedOnce = false
    for (const builder of textLayerBuilders) {
      if (builder?.cancel) {
        try {
          builder.cancel()
        } catch {
        }
      }
    }
    textLayerBuilders = []
    for (const host of textLayerHosts.value) {
      if (host) host.innerHTML = ''
    }
    textLayerHosts.value = []
    if (officeTimeout !== null) {
      window.clearTimeout(officeTimeout)
      officeTimeout = null
    }
    if (imageUrl.value) {
      URL.revokeObjectURL(imageUrl.value)
      imageUrl.value = ''
    }
    const doc = pdfDoc.value
    pdfDoc.value = null
    pageCount.value = 0
    canvases.value = []
    if (doc) {
      await doc.destroy().catch(() => void 0)
    }
  }

  const loadFile = async () => {
    const p = String(filePath() || '').trim()
    if (!p) {
      loading.value = false
      errorMessage.value = '缺少文件路径参数'
      return
    }
    loading.value = true
    errorMessage.value = ''
    scale.value = 1
    await cleanup()

    try {
      if (isNativeText()) {
        const res = await window.electronAPI.fs.readFileText(p, { maxBytes: 2 * 1024 * 1024 })
        if (!res.success || !res.data) {
          throw new Error(res.error || '读取文件失败')
        }
        textContent.value = String(res.data.text ?? '')
        textEncoding.value = String(res.data.encoding ?? '')
        textTruncated.value = !!res.data.truncated
        textBytesRead.value = Number(res.data.bytesRead ?? 0)
        textFileSize.value = Number(res.data.fileSize ?? 0)
        return
      }

      const res = await window.electronAPI.fs.readFileBytes(p)
      if (!res.success || !res.data) {
        throw new Error(res.error || '读取文件失败')
      }
      const data = res.data
      const u8 = data instanceof Uint8Array ? data : new Uint8Array(data as any)
      bytes.value = markRaw(u8)

      if (isOdfTextPreview()) {
        const buffer = u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength)
        textContent.value = await extractOdfPreviewText(buffer, ext())
        textEncoding.value = 'odf-preview'
        textTruncated.value = false
        textBytesRead.value = u8.byteLength
        textFileSize.value = u8.byteLength
        if (!String(textContent.value || '').trim()) {
          errorMessage.value = 'ODF 文件暂未解析出可预览内容'
        }
        return
      }

      if (isOfdTextPreview()) {
        const buffer = u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength)
        textContent.value = await extractOfdPreviewText(buffer)
        textEncoding.value = 'ofd-preview'
        textTruncated.value = false
        textBytesRead.value = u8.byteLength
        textFileSize.value = u8.byteLength
        if (!String(textContent.value || '').trim()) {
          errorMessage.value = 'OFD 文件暂未解析出可预览内容'
        }
        return
      }

      if (['xlsx', 'xls'].includes(ext()) || isOdfSpreadsheetExtension(ext())) {
        excelViewMode.value = 'vue-office'
        officeRenderedOnce = false
        if (officeTimeout !== null) {
          window.clearTimeout(officeTimeout)
        }
        officeTimeout = window.setTimeout(async () => {
          officeTimeout = null
          if (officeRenderedOnce) return
          try {
            await ensureExcelParsed()
            if (excelSheets.value.length > 0) {
              excelViewMode.value = 'fallback'
              return
            }
          } catch (e) {
            const msg = e instanceof Error ? e.message : String(e || 'Excel 解析失败')
            errorMessage.value = msg
          }
          if (!errorMessage.value) {
            errorMessage.value = 'Excel 预览渲染失败或为空白'
          }
        }, 1500)
      }

      if (ext() === 'pdf') {
        const pdfjsLib = await getPdfjs()
        const loadingTask = pdfjsLib.getDocument({ data: u8, disableWorker: true })
        const doc = await loadingTask.promise
        pdfDoc.value = markRaw(doc)
        pageCount.value = Number(doc.numPages || 0)
        void scheduleRenderAllPages()
      } else if (isImage()) {
        const mimeMap: Record<string, string> = {
          jpg: 'image/jpeg',
          jpeg: 'image/jpeg',
          png: 'image/png',
          gif: 'image/gif',
          webp: 'image/webp',
        }
        const mimeType = mimeMap[ext()] || 'application/octet-stream'
        const blob = new Blob([u8], { type: mimeType })
        imageUrl.value = URL.createObjectURL(blob)
      }
    } catch (e) {
      errorMessage.value = e instanceof Error ? e.message : '加载文件失败'
    } finally {
      loading.value = false
    }
  }

  const zoomIn = async () => {
    scale.value = Math.min(3, Math.round((scale.value * 1.25) * 100) / 100)
  }
  const zoomOut = async () => {
    scale.value = Math.max(0.25, Math.round((scale.value / 1.25) * 100) / 100)
  }
  const resetZoom = async () => {
    scale.value = 1
  }

  watch(scale, async () => {
    if (ext() === 'pdf' && isReady.value) {
      await scheduleRenderAllPages()
    }
  })

  watch(pageCount, async (count) => {
    if (ext() === 'pdf' && count && isReady.value) {
      await scheduleRenderAllPages()
    }
  })

  return {
    loading,
    errorMessage,
    scale,
    bytes,
    textContent,
    textEncoding,
    textTruncated,
    textBytesRead,
    textFileSize,
    imageUrl,
    excelSheets,
    excelViewMode,
    officeBuffer,
    officeKey,
    isReady,
    pageNumbers,
    pageCount,
    pdfDoc,
    canvases,
    setCanvasRef,
    setTextLayerRef,
    renderAllPages,
    waitForCanvasRefs,
    onOfficeRendered,
    onOfficeError,
    cleanup,
    loadFile,
    zoomIn,
    zoomOut,
    resetZoom,
    ensureExcelParsed,
  }
}
