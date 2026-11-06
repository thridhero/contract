import { shell } from 'electron'
import * as crypto from 'crypto'
import * as fs from 'fs-extra'
import * as os from 'os'
import * as path from 'path'
import { PDFDocument } from 'pdf-lib'
import { pathToFileURL } from 'url'
import type {
  InspectScanEnhanceInputsRequest,
  InspectScanEnhanceInputsResult,
  RunScanEnhanceRequest,
  RunScanEnhanceResult,
  ScanEnhanceImageFormat,
  ScanEnhanceItem,
  ScanEnhanceItemResult,
  ScanEnhanceProgressPayload,
  ScanEnhanceSourceKind,
} from '../../../shared/types/toolbox.types'

type ElectronMainModule = {
  app?: {
    isPackaged?: boolean
    getAppPath?: () => string
    getPath?: (name: string) => string
  }
  BrowserWindow?: new (options?: Record<string, unknown>) => {
    loadURL: (url: string) => Promise<void>
    webContents: {
      executeJavaScript: <T>(code: string, userGesture?: boolean) => Promise<T>
      on: (channel: string, listener: (...args: unknown[]) => void) => void
    }
    destroy: () => void
  }
  nativeImage?: {
    createFromPath: (imagePath: string) => {
      isEmpty: () => boolean
      getSize: () => { width: number; height: number }
      toPNG: () => Buffer
    }
  }
}

type PdfPreviewPage = {
  pageNumber: number
  width: number
  height: number
  pageWidthPt: number
  pageHeightPt: number
  previewDataUrl: string
}

type ProcessedScanPage = {
  id: string
  status: 'success' | 'error'
  errorMessage?: string
  dataUrl?: string
  previewDataUrl?: string
  width?: number
  height?: number
  pageWidthPt?: number
  pageHeightPt?: number
}

type ProgressReporter = (payload: ScanEnhanceProgressPayload) => void

const SUPPORTED_IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.bmp', '.gif', '.tif', '.tiff'])
const PX_TO_PT = 72 / 96

const logger = {
  warn: (...args: unknown[]) => {
    try {
      console.warn('[ScanEnhanceService]', ...args)
    } catch {
      // noop
    }
  },
}

export class ScanEnhanceService {
  private static instance: ScanEnhanceService

  private constructor() {}

  public static getInstance(): ScanEnhanceService {
    if (!ScanEnhanceService.instance) {
      ScanEnhanceService.instance = new ScanEnhanceService()
    }
    return ScanEnhanceService.instance
  }

  public async inspectInputs(request: InspectScanEnhanceInputsRequest): Promise<InspectScanEnhanceInputsResult> {
    const sourceKind = this.normalizeSourceKind(request.sourceKind)
    const filePaths = this.normalizeFilePaths(request.filePaths, sourceKind)
    const items: ScanEnhanceItem[] = []

    if (sourceKind === 'pdf') {
      for (const filePath of filePaths) {
        const pages = await this.inspectPdfFile(filePath)
        items.push(...pages)
      }
    } else {
      for (const filePath of filePaths) {
        items.push(await this.inspectImageFile(filePath))
      }
    }

    return {
      sourceKind,
      items,
    }
  }

  public async run(
    request: RunScanEnhanceRequest,
    onProgress?: ProgressReporter,
  ): Promise<RunScanEnhanceResult> {
    const sourceKind = this.normalizeSourceKind(request.sourceKind)
    const outputKind = request.outputKind === 'images' ? 'images' : 'pdf'
    const imageFormat = request.imageFormat === 'jpg' ? 'jpg' : 'png'
    const outputPath = path.resolve(String(request.outputPath || '').trim())
    const items = this.normalizeRunItems(request.items, sourceKind)
    if (!outputPath) {
      throw new Error('输出路径不能为空')
    }

    this.reportProgress(onProgress, {
      stage: 'checking',
      percent: 4,
      currentPage: 0,
      totalPages: items.length,
      message: '正在检查输入文件...',
    })

    const processedPages = await this.executeScanEnhanceScript(
      this.buildScanEnhanceScript(sourceKind, items, imageFormat),
      onProgress,
    )

    const successfulPages = processedPages.filter(page => page.status === 'success' && page.dataUrl)
    if (successfulPages.length === 0) {
      const firstError = processedPages.find(page => page.errorMessage)?.errorMessage || '未生成任何有效结果'
      throw new Error(firstError)
    }

    let fileSize = 0
    let generatedFiles: string[] = []
    if (outputKind === 'images') {
      this.reportProgress(onProgress, {
        stage: 'writing',
        percent: 90,
        currentPage: 0,
        totalPages: items.length,
        message: '正在写出增强后的图片...',
      })
      const imageWriteResult = await this.writeImagesOutput(outputPath, successfulPages, imageFormat)
      generatedFiles = imageWriteResult.generatedFiles
      fileSize = imageWriteResult.totalSize
    } else {
      this.reportProgress(onProgress, {
        stage: 'writing',
        percent: 90,
        currentPage: 0,
        totalPages: items.length,
        message: '正在重建增强后的 PDF...',
      })
      fileSize = await this.writePdfOutput(outputPath, successfulPages, items)
      generatedFiles = [outputPath]
    }

    if (request.openAfterSave) {
      try {
        await shell.openPath(outputPath)
      } catch (error) {
        logger.warn(`自动打开扫描增强结果失败: ${outputPath}`, error)
      }
    }

    this.reportProgress(onProgress, {
      stage: 'completed',
      percent: 100,
      currentPage: items.length,
      totalPages: items.length,
      message: '扫描件增强完成。',
    })

    const itemResults = this.buildItemResults(processedPages, generatedFiles, outputKind)
    return {
      outputKind,
      outputPath,
      fileSize,
      totalCount: items.length,
      successCount: successfulPages.length,
      failureCount: Math.max(0, items.length - successfulPages.length),
      generatedFiles,
      itemResults,
    }
  }

  private buildItemResults(
    processedPages: ProcessedScanPage[],
    generatedFiles: string[],
    outputKind: 'pdf' | 'images',
  ): ScanEnhanceItemResult[] {
    let successImageIndex = 0
    return processedPages.map((page) => {
      const isSuccess = page.status === 'success'
      const outputPath = isSuccess && outputKind === 'images'
        ? generatedFiles[successImageIndex++]
        : undefined
      return {
        id: page.id,
        outputPath,
        processedPreviewDataUrl: page.previewDataUrl,
        width: page.width,
        height: page.height,
        status: page.status,
        errorMessage: page.errorMessage,
      }
    })
  }

  private async inspectPdfFile(filePath: string): Promise<ScanEnhanceItem[]> {
    const normalizedPath = this.resolvePdfPath(filePath)
    const stat = await fs.stat(normalizedPath)
    const pages = await this.renderPdfPreviewPages(normalizedPath)
    const sourceName = path.basename(normalizedPath)
    return pages.map((page) => ({
      id: crypto.createHash('sha1').update(`${normalizedPath}#${page.pageNumber}`).digest('hex'),
      sourceKind: 'pdf',
      sourcePath: normalizedPath,
      sourceName,
      name: `${sourceName} · 第 ${page.pageNumber} 页`,
      pageNumber: page.pageNumber,
      pageCount: pages.length,
      width: page.width,
      height: page.height,
      size: Number(stat.size || 0),
      previewDataUrl: page.previewDataUrl,
      status: 'idle',
    }))
  }

  private async inspectImageFile(filePath: string): Promise<ScanEnhanceItem> {
    const normalizedPath = this.resolveImagePath(filePath)
    const stat = await fs.stat(normalizedPath)
    const preview = await this.buildImagePreview(normalizedPath)
    return {
      id: crypto.createHash('sha1').update(normalizedPath).digest('hex'),
      sourceKind: 'image',
      sourcePath: normalizedPath,
      sourceName: path.basename(normalizedPath),
      name: path.basename(normalizedPath),
      width: preview.width,
      height: preview.height,
      size: Number(stat.size || 0),
      previewDataUrl: preview.previewDataUrl,
      status: 'idle',
    }
  }

  private normalizeSourceKind(sourceKind: ScanEnhanceSourceKind | string | undefined): ScanEnhanceSourceKind {
    return sourceKind === 'pdf' ? 'pdf' : 'image'
  }

  private normalizeFilePaths(filePaths: string[], sourceKind: ScanEnhanceSourceKind): string[] {
    const normalized = Array.from(
      new Set(
        (Array.isArray(filePaths) ? filePaths : [])
          .map(item => path.resolve(String(item || '').trim()))
          .filter(Boolean),
      ),
    )
    if (normalized.length === 0) {
      throw new Error(sourceKind === 'pdf' ? '请至少选择一个 PDF 文件' : '请至少选择一张图片')
    }
    return normalized
  }

  private normalizeRunItems(items: ScanEnhanceItem[], sourceKind: ScanEnhanceSourceKind): ScanEnhanceItem[] {
    const normalized = Array.isArray(items) ? items : []
    if (normalized.length === 0) {
      throw new Error('请先导入待处理页面')
    }
    return normalized.map((item) => ({
      ...item,
      sourceKind,
      sourcePath: sourceKind === 'pdf' ? this.resolvePdfPath(item.sourcePath) : this.resolveImagePath(item.sourcePath),
      pageNumber: sourceKind === 'pdf' ? Math.max(1, Math.floor(Number(item.pageNumber || 1))) : undefined,
    }))
  }

  private async renderPdfPreviewPages(filePath: string): Promise<PdfPreviewPage[]> {
    const script = this.buildPdfPreviewScript(filePath)
    return this.executeHiddenWindowScript<PdfPreviewPage[]>(script)
  }

  private buildPdfPreviewScript(filePath: string): string {
    const pdfModulePath = this.getPdfJsModulePath()
    const pdfModuleUrl = pathToFileURL(pdfModulePath).href
    const pdfWorkerPath = pathToFileURL(path.join(path.dirname(pdfModulePath), 'pdf.worker.mjs')).href
    return `
      (async () => {
        const fs = require('fs');
        if (typeof ReadableStream !== 'undefined' && !ReadableStream.prototype[Symbol.asyncIterator]) {
          ReadableStream.prototype[Symbol.asyncIterator] = async function* () {
            const reader = this.getReader();
            try {
              while (true) {
                const result = await reader.read();
                if (result.done) break;
                yield result.value;
              }
            } finally {
              reader.releaseLock();
            }
          };
        }
        const pdfjsLib = await import(${JSON.stringify(pdfModuleUrl)});
        pdfjsLib.GlobalWorkerOptions.workerSrc = ${JSON.stringify(pdfWorkerPath)};
        const data = new Uint8Array(fs.readFileSync(${JSON.stringify(filePath)}));
        const loadingTask = pdfjsLib.getDocument({
          data,
          disableWorker: true,
          useWorkerFetch: false,
          isEvalSupported: false,
        });
        const pdf = await loadingTask.promise;
        const pages = [];
        for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
          const page = await pdf.getPage(pageNumber);
          const baseViewport = page.getViewport({ scale: 1 });
          const previewScale = Math.min(0.45, 320 / Math.max(1, baseViewport.width));
          const viewport = page.getViewport({ scale: Math.max(0.2, previewScale) });
          const canvas = document.createElement('canvas');
          canvas.width = Math.max(1, Math.ceil(viewport.width));
          canvas.height = Math.max(1, Math.ceil(viewport.height));
          const context = canvas.getContext('2d', { alpha: false });
          if (!context) {
            throw new Error('无法创建 PDF 预览 Canvas 上下文');
          }
          context.fillStyle = '#ffffff';
          context.fillRect(0, 0, canvas.width, canvas.height);
          await page.render({ canvasContext: context, viewport }).promise;
          pages.push({
            pageNumber,
            width: canvas.width,
            height: canvas.height,
            pageWidthPt: baseViewport.width,
            pageHeightPt: baseViewport.height,
            previewDataUrl: canvas.toDataURL('image/png'),
          });
        }
        return pages;
      })()
    `
  }

  private buildScanEnhanceScript(
    sourceKind: ScanEnhanceSourceKind,
    items: ScanEnhanceItem[],
    imageFormat: ScanEnhanceImageFormat,
  ): string {
    const pdfModulePath = this.getPdfJsModulePath()
    const pdfModuleUrl = pathToFileURL(pdfModulePath).href
    const pdfWorkerPath = pathToFileURL(path.join(path.dirname(pdfModulePath), 'pdf.worker.mjs')).href
    const payload = items.map((item) => ({
      id: item.id,
      sourcePath: item.sourcePath,
      sourceName: item.sourceName,
      pageNumber: item.pageNumber,
    }))

    return `
      (async () => {
        const fs = require('fs');
        const { ipcRenderer } = require('electron');
        const sourceKind = ${JSON.stringify(sourceKind)};
        const items = ${JSON.stringify(payload)};
        const imageFormat = ${JSON.stringify(imageFormat)};
        const OUTPUT_MIME = imageFormat === 'jpg' ? 'image/jpeg' : 'image/png';
        const OUTPUT_QUALITY = imageFormat === 'jpg' ? 0.96 : undefined;

        function sendProgress(payload) {
          ipcRenderer.send('scan-enhance-progress', payload);
        }
        function clamp(value, min, max) {
          return Math.max(min, Math.min(max, value));
        }
        function createCanvas(width, height) {
          const canvas = document.createElement('canvas');
          canvas.width = Math.max(1, Math.round(width));
          canvas.height = Math.max(1, Math.round(height));
          return canvas;
        }
        function cropCanvas(canvas, bounds) {
          const width = Math.max(1, bounds.right - bounds.left);
          const height = Math.max(1, bounds.bottom - bounds.top);
          const next = createCanvas(width, height);
          const context = next.getContext('2d', { alpha: false });
          if (!context) throw new Error('无法创建裁切 Canvas');
          context.fillStyle = '#ffffff';
          context.fillRect(0, 0, width, height);
          context.drawImage(canvas, bounds.left, bounds.top, width, height, 0, 0, width, height);
          return next;
        }
        function resizeCanvas(canvas, maxSize) {
          const ratio = Math.min(1, maxSize / Math.max(canvas.width, canvas.height));
          if (ratio >= 0.999) return canvas;
          const next = createCanvas(canvas.width * ratio, canvas.height * ratio);
          const context = next.getContext('2d', { alpha: false });
          if (!context) throw new Error('无法创建缩放 Canvas');
          context.fillStyle = '#ffffff';
          context.fillRect(0, 0, next.width, next.height);
          context.drawImage(canvas, 0, 0, next.width, next.height);
          return next;
        }
        function upscaleCanvas(canvas, scale) {
          const safeScale = Math.max(1, Number(scale || 1));
          if (safeScale <= 1.001) return canvas;
          const next = createCanvas(canvas.width * safeScale, canvas.height * safeScale);
          const context = next.getContext('2d', { alpha: false });
          if (!context) throw new Error('无法创建放大 Canvas');
          context.imageSmoothingEnabled = true;
          context.imageSmoothingQuality = 'high';
          context.fillStyle = '#ffffff';
          context.fillRect(0, 0, next.width, next.height);
          context.drawImage(canvas, 0, 0, next.width, next.height);
          return next;
        }
        function getDocumentUpscaleFactor(canvas) {
          const maxSide = Math.max(canvas.width, canvas.height);
          if (maxSide <= 1100) return 1.85;
          if (maxSide <= 1500) return 1.65;
          if (maxSide <= 2200) return 1.35;
          return 1;
        }
        function canvasToDataUrl(canvas, maxPreviewSize) {
          const previewCanvas = maxPreviewSize ? resizeCanvas(canvas, maxPreviewSize) : canvas;
          return previewCanvas.toDataURL(OUTPUT_MIME, OUTPUT_QUALITY);
        }
        function bufferToDataUrl(filePath) {
          const ext = String(filePath || '').split('.').pop().toLowerCase();
          let mime = 'image/png';
          if (ext === 'jpg' || ext === 'jpeg') mime = 'image/jpeg';
          else if (ext === 'webp') mime = 'image/webp';
          else if (ext === 'gif') mime = 'image/gif';
          else if (ext === 'bmp') mime = 'image/bmp';
          const bytes = fs.readFileSync(filePath);
          return 'data:' + mime + ';base64,' + Buffer.from(bytes).toString('base64');
        }
        function loadImage(dataUrl) {
          return new Promise((resolve, reject) => {
            const image = new Image();
            image.onload = () => resolve(image);
            image.onerror = () => reject(new Error('图片加载失败'));
            image.src = dataUrl;
          });
        }
        function getGrayData(canvas) {
          const context = canvas.getContext('2d', { alpha: false });
          if (!context) throw new Error('无法创建像素分析上下文');
          const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
          const gray = new Uint8ClampedArray(canvas.width * canvas.height);
          for (let i = 0, p = 0; i < imageData.data.length; i += 4, p += 1) {
            gray[p] = Math.round(imageData.data[i] * 0.299 + imageData.data[i + 1] * 0.587 + imageData.data[i + 2] * 0.114);
          }
          return { context, imageData, gray };
        }
        function estimatePercentile(values, percentile) {
          if (!values || values.length === 0) return 0
          const histogram = new Uint32Array(256)
          for (let index = 0; index < values.length; index += 1) {
            histogram[values[index]] += 1
          }
          const total = values.length
          const target = clamp(Math.round(total * percentile), 0, total - 1)
          let cumulative = 0
          for (let value = 0; value < 256; value += 1) {
            cumulative += histogram[value]
            if (cumulative > target) {
              return value
            }
          }
          return 255
        }
        function detectContentBounds(canvas) {
          const { gray } = getGrayData(canvas);
          const width = canvas.width;
          const height = canvas.height;
          const sampleSize = Math.max(8, Math.floor(Math.min(width, height) * 0.08));
          let cornerSum = 0;
          let cornerCount = 0;
          const cornerBoxes = [
            [0, 0],
            [Math.max(0, width - sampleSize), 0],
            [0, Math.max(0, height - sampleSize)],
            [Math.max(0, width - sampleSize), Math.max(0, height - sampleSize)],
          ];
          for (const [left, top] of cornerBoxes) {
            for (let y = top; y < Math.min(height, top + sampleSize); y += 2) {
              for (let x = left; x < Math.min(width, left + sampleSize); x += 2) {
                cornerSum += gray[y * width + x];
                cornerCount += 1;
              }
            }
          }
          const background = cornerCount > 0 ? cornerSum / cornerCount : 245;
          const threshold = clamp(background - 24, 128, 238);
          let left = width
          let right = 0
          let top = height
          let bottom = 0
          let hitCount = 0
          const step = Math.max(1, Math.floor(Math.min(width, height) / 600))
          for (let y = 0; y < height; y += step) {
            for (let x = 0; x < width; x += step) {
              const value = gray[y * width + x]
              if (value < threshold) {
                if (x < left) left = x
                if (x > right) right = x
                if (y < top) top = y
                if (y > bottom) bottom = y
                hitCount += 1
              }
            }
          }
          if (hitCount < 64 || right - left < width * 0.2 || bottom - top < height * 0.2) {
            return { left: 0, top: 0, right: width, bottom: height }
          }
          const marginX = Math.max(8, Math.round((right - left) * 0.03))
          const marginY = Math.max(8, Math.round((bottom - top) * 0.03))
          return {
            left: clamp(left - marginX, 0, width - 1),
            top: clamp(top - marginY, 0, height - 1),
            right: clamp(right + marginX, 1, width),
            bottom: clamp(bottom + marginY, 1, height),
          }
        }
        function detectPaperBounds(canvas) {
          const { gray } = getGrayData(canvas)
          const width = canvas.width
          const height = canvas.height
          const threshold = clamp(estimatePercentile(gray, 0.7) - 10, 168, 245)
          let left = width
          let right = 0
          let top = height
          let bottom = 0
          let hitCount = 0
          const step = Math.max(1, Math.floor(Math.min(width, height) / 700))
          for (let y = 0; y < height; y += step) {
            for (let x = 0; x < width; x += step) {
              if (gray[y * width + x] >= threshold) {
                if (x < left) left = x
                if (x > right) right = x
                if (y < top) top = y
                if (y > bottom) bottom = y
                hitCount += 1
              }
            }
          }
          if (hitCount < 128 || right - left < width * 0.35 || bottom - top < height * 0.35) {
            return null
          }
          const marginX = Math.max(6, Math.round((right - left) * 0.015))
          const marginY = Math.max(6, Math.round((bottom - top) * 0.015))
          return {
            left: clamp(left - marginX, 0, width - 1),
            top: clamp(top - marginY, 0, height - 1),
            right: clamp(right + marginX, 1, width),
            bottom: clamp(bottom + marginY, 1, height),
          }
        }
        function distance(a, b) {
          return Math.hypot(b.x - a.x, b.y - a.y)
        }
        function quadArea(quad) {
          if (!quad) return 0
          let area = 0
          for (let index = 0; index < quad.length; index += 1) {
            const current = quad[index]
            const next = quad[(index + 1) % quad.length]
            area += current.x * next.y - next.x * current.y
          }
          return Math.abs(area) * 0.5
        }
        function detectDocumentQuad(canvas) {
          const preview = resizeCanvas(canvas, 960)
          const { gray } = getGrayData(preview)
          const width = preview.width
          const height = preview.height
          const edgeMargin = Math.max(8, Math.floor(Math.min(width, height) * 0.06))
          let borderSum = 0
          let borderCount = 0
          for (let y = 0; y < height; y += 1) {
            for (let x = 0; x < width; x += 1) {
              if (x < edgeMargin || x >= width - edgeMargin || y < edgeMargin || y >= height - edgeMargin) {
                borderSum += gray[y * width + x]
                borderCount += 1
              }
            }
          }
          const borderMean = borderCount > 0 ? borderSum / borderCount : 188
          const brightThreshold = clamp(Math.max(borderMean + 16, estimatePercentile(gray, 0.72) - 8), 156, 248)
          let left = width
          let right = 0
          let top = height
          let bottom = 0
          let tl = null
          let tr = null
          let br = null
          let bl = null
          let hitCount = 0
          for (let y = 0; y < height; y += 1) {
            for (let x = 0; x < width; x += 1) {
              const value = gray[y * width + x]
              if (value < brightThreshold) continue
              left = Math.min(left, x)
              right = Math.max(right, x)
              top = Math.min(top, y)
              bottom = Math.max(bottom, y)
              hitCount += 1
              if (!tl || x + y < tl.x + tl.y) tl = { x, y }
              if (!tr || x - y > tr.x - tr.y) tr = { x, y }
              if (!br || x + y > br.x + br.y) br = { x, y }
              if (!bl || y - x > bl.y - bl.x) bl = { x, y }
            }
          }
          if (!tl || !tr || !br || !bl) return null
          const boundsWidth = right - left
          const boundsHeight = bottom - top
          if (hitCount < width * height * 0.08 || boundsWidth < width * 0.28 || boundsHeight < height * 0.28) {
            return null
          }
          const scaleX = canvas.width / width
          const scaleY = canvas.height / height
          const quad = [
            { x: tl.x * scaleX, y: tl.y * scaleY },
            { x: tr.x * scaleX, y: tr.y * scaleY },
            { x: br.x * scaleX, y: br.y * scaleY },
            { x: bl.x * scaleX, y: bl.y * scaleY },
          ]
          const area = quadArea(quad)
          if (area < canvas.width * canvas.height * 0.22) {
            return null
          }
          return quad
        }
        function sampleBilinear(data, width, height, x, y, channelOffset) {
          const x0 = clamp(Math.floor(x), 0, width - 1)
          const y0 = clamp(Math.floor(y), 0, height - 1)
          const x1 = clamp(x0 + 1, 0, width - 1)
          const y1 = clamp(y0 + 1, 0, height - 1)
          const dx = clamp(x - x0, 0, 1)
          const dy = clamp(y - y0, 0, 1)
          const index00 = (y0 * width + x0) * 4 + channelOffset
          const index10 = (y0 * width + x1) * 4 + channelOffset
          const index01 = (y1 * width + x0) * 4 + channelOffset
          const index11 = (y1 * width + x1) * 4 + channelOffset
          const top = data[index00] * (1 - dx) + data[index10] * dx
          const bottom = data[index01] * (1 - dx) + data[index11] * dx
          return top * (1 - dy) + bottom * dy
        }
        function rectifyDocumentCanvas(canvas) {
          const quad = detectDocumentQuad(canvas)
          if (!quad) return canvas
          const [topLeft, topRight, bottomRight, bottomLeft] = quad
          const topWidth = distance(topLeft, topRight)
          const bottomWidth = distance(bottomLeft, bottomRight)
          const leftHeight = distance(topLeft, bottomLeft)
          const rightHeight = distance(topRight, bottomRight)
          const targetWidth = Math.max(1, Math.round((topWidth + bottomWidth) / 2))
          const targetHeight = Math.max(1, Math.round((leftHeight + rightHeight) / 2))
          if (targetWidth < 240 || targetHeight < 240) return canvas
          const sourceContext = canvas.getContext('2d', { alpha: false })
          if (!sourceContext) throw new Error('无法创建透视矫正上下文')
          const sourceImage = sourceContext.getImageData(0, 0, canvas.width, canvas.height)
          const outputCanvas = createCanvas(targetWidth, targetHeight)
          const outputContext = outputCanvas.getContext('2d', { alpha: false })
          if (!outputContext) throw new Error('无法创建透视输出 Canvas')
          const outputImage = outputContext.createImageData(targetWidth, targetHeight)
          for (let y = 0; y < targetHeight; y += 1) {
            const v = targetHeight <= 1 ? 0 : y / (targetHeight - 1)
            for (let x = 0; x < targetWidth; x += 1) {
              const u = targetWidth <= 1 ? 0 : x / (targetWidth - 1)
              const srcX = topLeft.x * (1 - u) * (1 - v)
                + topRight.x * u * (1 - v)
                + bottomRight.x * u * v
                + bottomLeft.x * (1 - u) * v
              const srcY = topLeft.y * (1 - u) * (1 - v)
                + topRight.y * u * (1 - v)
                + bottomRight.y * u * v
                + bottomLeft.y * (1 - u) * v
              const outputIndex = (y * targetWidth + x) * 4
              outputImage.data[outputIndex] = sampleBilinear(sourceImage.data, canvas.width, canvas.height, srcX, srcY, 0)
              outputImage.data[outputIndex + 1] = sampleBilinear(sourceImage.data, canvas.width, canvas.height, srcX, srcY, 1)
              outputImage.data[outputIndex + 2] = sampleBilinear(sourceImage.data, canvas.width, canvas.height, srcX, srcY, 2)
              outputImage.data[outputIndex + 3] = 255
            }
          }
          outputContext.putImageData(outputImage, 0, 0)
          return outputCanvas
        }
        function estimateSkewDegrees(canvas) {
          const { gray } = getGrayData(canvas)
          const width = canvas.width
          const height = canvas.height
          const points = []
          const step = Math.max(2, Math.floor(Math.min(width, height) / 240))
          for (let y = 0; y < height; y += step) {
            for (let x = 0; x < width; x += step) {
              const value = gray[y * width + x]
              if (value < 180) {
                points.push([x - width / 2, y - height / 2])
              }
            }
          }
          if (points.length < 80) return 0
          const limited = points.length > 20000 ? points.filter((_, index) => index % Math.ceil(points.length / 20000) === 0) : points
          let bestAngle = 0
          let bestScore = -Infinity
          for (let angle = -6; angle <= 6.001; angle += 0.5) {
            const radians = angle * Math.PI / 180
            const sin = Math.sin(radians)
            const cos = Math.cos(radians)
            const buckets = new Map()
            for (const point of limited) {
              const yRot = point[1] * cos - point[0] * sin
              const bucket = Math.round(yRot / 6)
              buckets.set(bucket, (buckets.get(bucket) || 0) + 1)
            }
            let score = 0
            buckets.forEach((count) => {
              score += count * count
            })
            if (score > bestScore) {
              bestScore = score
              bestAngle = angle
            }
          }
          return Math.abs(bestAngle) < 0.35 ? 0 : bestAngle
        }
        function rotateCanvas(canvas, degrees) {
          if (!degrees) return canvas
          const radians = degrees * Math.PI / 180
          const sin = Math.abs(Math.sin(radians))
          const cos = Math.abs(Math.cos(radians))
          const width = Math.max(1, Math.ceil(canvas.width * cos + canvas.height * sin))
          const height = Math.max(1, Math.ceil(canvas.width * sin + canvas.height * cos))
          const next = createCanvas(width, height)
          const context = next.getContext('2d', { alpha: false })
          if (!context) throw new Error('无法创建旋转 Canvas')
          context.fillStyle = '#ffffff'
          context.fillRect(0, 0, width, height)
          context.translate(width / 2, height / 2)
          context.rotate(radians)
          context.drawImage(canvas, -canvas.width / 2, -canvas.height / 2)
          return next
        }
        function buildIntegral(gray, width, height) {
          const integral = new Float64Array((width + 1) * (height + 1))
          for (let y = 1; y <= height; y += 1) {
            let rowSum = 0
            for (let x = 1; x <= width; x += 1) {
              rowSum += gray[(y - 1) * width + (x - 1)]
              integral[y * (width + 1) + x] = integral[(y - 1) * (width + 1) + x] + rowSum
            }
          }
          return integral
        }
        function sampleMean(integral, width, x0, y0, x1, y1) {
          const stride = width + 1
          const area = Math.max(1, (x1 - x0) * (y1 - y0))
          const sum = integral[y1 * stride + x1] - integral[y0 * stride + x1] - integral[y1 * stride + x0] + integral[y0 * stride + x0]
          return sum / area
        }
        function enhanceCanvas(sourceCanvas) {
          const workingCanvas = createCanvas(sourceCanvas.width, sourceCanvas.height)
          const workingContext = workingCanvas.getContext('2d', { alpha: false })
          if (!workingContext) throw new Error('无法创建增强 Canvas')
          workingContext.fillStyle = '#ffffff'
          workingContext.fillRect(0, 0, workingCanvas.width, workingCanvas.height)
          workingContext.drawImage(sourceCanvas, 0, 0)

          const { context, imageData, gray } = getGrayData(workingCanvas)
          const width = workingCanvas.width
          const height = workingCanvas.height
          const integral = buildIntegral(gray, width, height)
          const corrected = new Uint8ClampedArray(gray.length)
          const radius = Math.max(18, Math.floor(Math.min(width, height) / 18))
          for (let y = 0; y < height; y += 1) {
            const top = Math.max(0, y - radius)
            const bottom = Math.min(height, y + radius)
            for (let x = 0; x < width; x += 1) {
              const left = Math.max(0, x - radius)
              const right = Math.min(width, x + radius)
              const localMean = sampleMean(integral, width, left, top, right, bottom)
              const value = clamp((gray[y * width + x] / Math.max(1, localMean)) * 255, 0, 255)
              corrected[y * width + x] = value
            }
          }

          const histogram = new Uint32Array(256)
          corrected.forEach((value) => {
            histogram[value] += 1
          })
          const total = corrected.length
          const lowTarget = total * 0.04
          const highTarget = total * 0.985
          let low = 0
          let high = 255
          let cumulative = 0
          for (let i = 0; i < 256; i += 1) {
            cumulative += histogram[i]
            if (cumulative >= lowTarget) {
              low = i
              break
            }
          }
          cumulative = 0
          for (let i = 0; i < 256; i += 1) {
            cumulative += histogram[i]
            if (cumulative >= highTarget) {
              high = i
              break
            }
          }
          const normalized = new Uint8ClampedArray(corrected.length)
          const localIntegral = buildIntegral(corrected, width, height)
          const textRadius = Math.max(10, Math.floor(Math.min(width, height) / 45))
          const range = Math.max(16, high - low)
          const textMask = new Uint8ClampedArray(corrected.length)
          for (let y = 0; y < height; y += 1) {
            const top = Math.max(0, y - textRadius)
            const bottom = Math.min(height, y + textRadius)
            for (let x = 0; x < width; x += 1) {
              const left = Math.max(0, x - textRadius)
              const right = Math.min(width, x + textRadius)
              const value = clamp(((corrected[y * width + x] - low) * 255) / range, 0, 255)
              const localMean = sampleMean(localIntegral, width, left, top, right, bottom)
              const delta = localMean - value
              const isText = delta > 8
              textMask[y * width + x] = isText ? 255 : 0
              normalized[y * width + x] = isText
                ? clamp(value - Math.min(92, 44 + delta * 0.7), 0, 255)
                : clamp(value + Math.min(64, 18 + Math.max(0, value - localMean) * 0.45), 0, 255)
            }
          }

          const sharpened = new Uint8ClampedArray(normalized.length)
          for (let y = 0; y < height; y += 1) {
            for (let x = 0; x < width; x += 1) {
              const index = y * width + x
              const center = normalized[index]
              const left = normalized[y * width + Math.max(0, x - 1)]
              const right = normalized[y * width + Math.min(width - 1, x + 1)]
              const top = normalized[Math.max(0, y - 1) * width + x]
              const bottom = normalized[Math.min(height - 1, y + 1) * width + x]
              const blur = (left + right + top + bottom) / 4
              const edgeBoost = center - blur
              const textBoost = textMask[index] > 0 ? 1.15 : 0.45
              let nextValue = clamp(center + edgeBoost * textBoost, 0, 255)
              if (textMask[index] > 0) {
                nextValue = clamp(nextValue - 18, 0, 255)
              } else if (nextValue > 214) {
                nextValue = clamp(nextValue + 22, 0, 255)
              }
              sharpened[index] = nextValue
            }
          }

          for (let i = 0, p = 0; i < imageData.data.length; i += 4, p += 1) {
            const value = sharpened[p]
            imageData.data[i] = value
            imageData.data[i + 1] = value
            imageData.data[i + 2] = value
            imageData.data[i + 3] = 255
          }
          context.putImageData(imageData, 0, 0)
          return workingCanvas
        }
        async function processCanvas(canvas, meta) {
          const rectified = rectifyDocumentCanvas(canvas)
          const initial = rectified === canvas ? cropCanvas(canvas, detectContentBounds(canvas)) : rectified
          const rotated = rotateCanvas(initial, -estimateSkewDegrees(initial))
          const paperBounds = detectPaperBounds(rotated)
          const fallbackBounds = detectContentBounds(rotated)
          const tightened = cropCanvas(rotated, paperBounds || fallbackBounds)
          const upscaled = upscaleCanvas(tightened, getDocumentUpscaleFactor(tightened))
          const enhanced = enhanceCanvas(upscaled)
          return {
            status: 'success',
            width: enhanced.width,
            height: enhanced.height,
            pageWidthPt: meta.pageWidthPt,
            pageHeightPt: meta.pageHeightPt,
            previewDataUrl: canvasToDataUrl(enhanced, 720),
            dataUrl: enhanced.toDataURL(OUTPUT_MIME, OUTPUT_QUALITY),
          }
        }
        async function processPdfItems() {
          if (typeof ReadableStream !== 'undefined' && !ReadableStream.prototype[Symbol.asyncIterator]) {
            ReadableStream.prototype[Symbol.asyncIterator] = async function* () {
              const reader = this.getReader();
              try {
                while (true) {
                  const result = await reader.read();
                  if (result.done) break;
                  yield result.value;
                }
              } finally {
                reader.releaseLock();
              }
            };
          }
          const pdfjsLib = await import(${JSON.stringify(pdfModuleUrl)});
          pdfjsLib.GlobalWorkerOptions.workerSrc = ${JSON.stringify(pdfWorkerPath)};
          const docs = new Map();
          const results = [];
          for (let index = 0; index < items.length; index += 1) {
            const item = items[index];
            try {
              let pdf = docs.get(item.sourcePath);
              if (!pdf) {
                const data = new Uint8Array(fs.readFileSync(item.sourcePath));
                const loadingTask = pdfjsLib.getDocument({
                  data,
                  disableWorker: true,
                  useWorkerFetch: false,
                  isEvalSupported: false,
                });
                pdf = await loadingTask.promise;
                docs.set(item.sourcePath, pdf);
              }
              sendProgress({
                stage: 'rendering',
                percent: 8 + Math.round((index / Math.max(1, items.length)) * 36),
                currentPage: index + 1,
                totalPages: items.length,
                message: '正在渲染 PDF 页面...',
              });
              const page = await pdf.getPage(item.pageNumber || 1);
              const baseViewport = page.getViewport({ scale: 1 });
              const renderScale = Math.min(2.6, Math.max(1.6, 2200 / Math.max(1, baseViewport.height)));
              const viewport = page.getViewport({ scale: renderScale });
              const canvas = createCanvas(viewport.width, viewport.height);
              const context = canvas.getContext('2d', { alpha: false });
              if (!context) throw new Error('无法创建 PDF 渲染上下文');
              context.fillStyle = '#ffffff';
              context.fillRect(0, 0, canvas.width, canvas.height);
              await page.render({ canvasContext: context, viewport }).promise;
              sendProgress({
                stage: 'enhancing',
                percent: 44 + Math.round((index / Math.max(1, items.length)) * 44),
                currentPage: index + 1,
                totalPages: items.length,
                message: '正在增强扫描件清晰度...',
              });
              const processed = await processCanvas(canvas, {
                pageWidthPt: baseViewport.width,
                pageHeightPt: baseViewport.height,
              });
              results.push({ id: item.id, ...processed });
            } catch (error) {
              results.push({
                id: item.id,
                status: 'error',
                errorMessage: error instanceof Error ? error.message : String(error),
              });
            }
          }
          return results;
        }
        async function processImageItems() {
          const results = [];
          for (let index = 0; index < items.length; index += 1) {
            const item = items[index];
            try {
              sendProgress({
                stage: 'rendering',
                percent: 8 + Math.round((index / Math.max(1, items.length)) * 18),
                currentPage: index + 1,
                totalPages: items.length,
                message: '正在读取图片...',
              });
              const image = await loadImage(bufferToDataUrl(item.sourcePath));
              const canvas = createCanvas(image.naturalWidth || image.width, image.naturalHeight || image.height);
              const context = canvas.getContext('2d', { alpha: false });
              if (!context) throw new Error('无法创建图片渲染上下文');
              context.fillStyle = '#ffffff';
              context.fillRect(0, 0, canvas.width, canvas.height);
              context.drawImage(image, 0, 0, canvas.width, canvas.height);
              sendProgress({
                stage: 'enhancing',
                percent: 30 + Math.round((index / Math.max(1, items.length)) * 58),
                currentPage: index + 1,
                totalPages: items.length,
                message: '正在增强扫描件清晰度...',
              });
              const processed = await processCanvas(canvas, {});
              results.push({ id: item.id, ...processed });
            } catch (error) {
              results.push({
                id: item.id,
                status: 'error',
                errorMessage: error instanceof Error ? error.message : String(error),
              });
            }
          }
          return results;
        }
        return sourceKind === 'pdf' ? processPdfItems() : processImageItems();
      })()
    `
  }

  private async executeScanEnhanceScript(
    script: string,
    onProgress?: ProgressReporter,
  ): Promise<ProcessedScanPage[]> {
    return this.executeHiddenWindowScript<ProcessedScanPage[]>(script, (channel, payload) => {
      if (channel !== 'scan-enhance-progress') return
      this.reportProgress(onProgress, payload as Partial<ScanEnhanceProgressPayload>)
    })
  }

  private async executeHiddenWindowScript<T>(
    script: string,
    onMessage?: (channel: string, payload: unknown) => void,
  ): Promise<T> {
    const electronModule = this.getElectronMainModule()
    if (!electronModule?.BrowserWindow) {
      throw new Error('当前运行环境不支持扫描件增强')
    }

    const BrowserWindow = electronModule.BrowserWindow
    const window = new BrowserWindow({
      show: false,
      width: 1440,
      height: 1800,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false,
        sandbox: false,
        webSecurity: false,
      },
    })

    if (onMessage) {
      window.webContents.on('ipc-message', (_event: unknown, channel: unknown, payload: unknown) => {
        onMessage(String(channel || ''), payload)
      })
    }

    try {
      await window.loadURL(pathToFileURL(this.resolveBlankHtmlPath()).href)
      return await window.webContents.executeJavaScript<T>(script, true)
    } finally {
      window.destroy()
    }
  }

  private reportProgress(onProgress: ProgressReporter | undefined, payload: Partial<ScanEnhanceProgressPayload>): void {
    if (!onProgress) return
    onProgress({
      stage: payload.stage || 'checking',
      percent: Math.max(0, Math.min(100, Math.round(Number(payload.percent || 0)))),
      currentPage: Math.max(0, Math.floor(Number(payload.currentPage || 0))),
      totalPages: Math.max(0, Math.floor(Number(payload.totalPages || 0))),
      message: String(payload.message || ''),
    })
  }

  private async writeImagesOutput(
    outputDir: string,
    pages: ProcessedScanPage[],
    imageFormat: ScanEnhanceImageFormat,
  ): Promise<{ generatedFiles: string[]; totalSize: number }> {
    await fs.ensureDir(outputDir)
    const generatedFiles: string[] = []
    let totalSize = 0
    const extension = imageFormat === 'jpg' ? 'jpg' : 'png'
    let imageIndex = 1
    for (const page of pages) {
      const filePath = path.join(outputDir, `${String(imageIndex).padStart(3, '0')}.${extension}`)
      const bytes = this.dataUrlToBuffer(page.dataUrl || '')
      await fs.writeFile(filePath, bytes)
      const stat = await fs.stat(filePath)
      generatedFiles.push(filePath)
      totalSize += Number(stat.size || 0)
      imageIndex += 1
    }
    return { generatedFiles, totalSize }
  }

  private async writePdfOutput(
    outputPath: string,
    pages: ProcessedScanPage[],
    items: ScanEnhanceItem[],
  ): Promise<number> {
    const pdfDoc = await PDFDocument.create()
    const itemMap = new Map(items.map(item => [item.id, item]))
    for (const page of pages) {
      const bytes = this.dataUrlToBuffer(page.dataUrl || '')
      const sourceItem = itemMap.get(page.id)
      const ext = (page.dataUrl || '').includes('image/jpeg') ? 'jpg' : 'png'
      const embedded = ext === 'jpg'
        ? await pdfDoc.embedJpg(bytes)
        : await pdfDoc.embedPng(bytes)
      const originalPageWidth = Number(page.pageWidthPt || 0)
      const originalPageHeight = Number(page.pageHeightPt || 0)
      const drawWidthPt = Math.max(1, Number(page.width || sourceItem?.width || 1) * PX_TO_PT)
      const drawHeightPt = Math.max(1, Number(page.height || sourceItem?.height || 1) * PX_TO_PT)
      const pageWidth = originalPageWidth > 0 ? originalPageWidth : drawWidthPt
      const pageHeight = originalPageHeight > 0 ? originalPageHeight : drawHeightPt
      const pdfPage = pdfDoc.addPage([pageWidth, pageHeight])
      const scale = Math.min(pageWidth / drawWidthPt, pageHeight / drawHeightPt)
      const width = drawWidthPt * scale
      const height = drawHeightPt * scale
      const x = (pageWidth - width) / 2
      const y = (pageHeight - height) / 2
      pdfPage.drawImage(embedded, { x, y, width, height })
    }

    await fs.ensureDir(path.dirname(outputPath))
    const pdfBytes = await pdfDoc.save({
      useObjectStreams: true,
      addDefaultPage: false,
      updateFieldAppearances: false,
    })
    await fs.writeFile(outputPath, Buffer.from(pdfBytes))
    const stat = await fs.stat(outputPath)
    return Number(stat.size || 0)
  }

  private dataUrlToBuffer(dataUrl: string): Buffer {
    const match = String(dataUrl || '').match(/^data:.*?;base64,(.+)$/)
    if (!match) {
      throw new Error('图片数据编码失败')
    }
    return Buffer.from(match[1], 'base64')
  }

  private async buildImagePreview(filePath: string): Promise<{ width: number; height: number; previewDataUrl?: string }> {
    const nativeImage = this.getElectronMainModule()?.nativeImage
    if (nativeImage) {
      const image = nativeImage.createFromPath(filePath)
      if (!image.isEmpty()) {
        const size = image.getSize()
        return {
          width: Math.max(1, Number(size.width || 1)),
          height: Math.max(1, Number(size.height || 1)),
          previewDataUrl: `data:image/png;base64,${Buffer.from(image.toPNG()).toString('base64')}`,
        }
      }
    }

    const ext = path.extname(filePath).toLowerCase()
    const bytes = await fs.readFile(filePath)
    if (ext === '.png') {
      return {
        width: 1,
        height: 1,
        previewDataUrl: `data:image/png;base64,${Buffer.from(bytes).toString('base64')}`,
      }
    }
    return {
      width: 1,
      height: 1,
      previewDataUrl: undefined,
    }
  }

  private resolvePdfPath(filePath: string): string {
    const normalizedPath = path.resolve(String(filePath || '').trim())
    if (!normalizedPath) {
      throw new Error('文件路径不能为空')
    }
    if (path.extname(normalizedPath).toLowerCase() !== '.pdf') {
      throw new Error(`仅支持 PDF 文件: ${normalizedPath}`)
    }
    if (!fs.existsSync(normalizedPath)) {
      throw new Error(`文件不存在: ${normalizedPath}`)
    }
    return normalizedPath
  }

  private resolveImagePath(filePath: string): string {
    const normalizedPath = path.resolve(String(filePath || '').trim())
    if (!normalizedPath) {
      throw new Error('图片路径不能为空')
    }
    if (!fs.existsSync(normalizedPath)) {
      throw new Error(`图片不存在: ${normalizedPath}`)
    }
    const ext = path.extname(normalizedPath).toLowerCase()
    if (!SUPPORTED_IMAGE_EXTENSIONS.has(ext)) {
      throw new Error(`暂不支持的图片格式: ${normalizedPath}`)
    }
    return normalizedPath
  }

  private resolveBlankHtmlPath(): string {
    const candidates = [
      process.resourcesPath ? path.join(process.resourcesPath, 'ocr', 'blank.html') : '',
      path.join(process.cwd(), 'resources', 'ocr', 'blank.html'),
      path.join(this.getProjectRootPath(), 'resources', 'ocr', 'blank.html'),
    ]
      .map(item => String(item || '').trim())
      .filter(Boolean)

    for (const candidate of candidates) {
      if (fs.existsSync(candidate)) {
        return candidate
      }
    }

    throw new Error(`未找到扫描件增强 blank.html，已尝试：${candidates.join(' | ')}`)
  }

  private getPdfJsModulePath(): string {
    return path.join(this.getNodeModulesRootPath(), 'pdfjs-dist', 'legacy', 'build', 'pdf.mjs')
  }

  private getNodeModulesRootPath(): string {
    return path.join(this.getProjectRootPath(), 'node_modules')
  }

  private getProjectRootPath(): string {
    const electronModule = this.getElectronMainModule()
    const appPath = electronModule?.app?.getAppPath?.()
    if (appPath && electronModule?.app?.isPackaged) {
      return appPath.replace(/app\.asar([\\/]|$)/, 'app.asar.unpacked$1')
    }
    return path.resolve(process.cwd())
  }

  private getElectronMainModule(): ElectronMainModule | null {
    try {
      const electronModule = require('electron') as ElectronMainModule | string
      if (typeof electronModule === 'string') {
        return null
      }
      return electronModule
    } catch {
      return null
    }
  }
}
