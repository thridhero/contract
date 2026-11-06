import { shell } from 'electron'
import * as fs from 'fs-extra'
import * as os from 'os'
import * as path from 'path'
import { pathToFileURL } from 'url'
import { PDFDocument } from 'pdf-lib'
import { PdfOcrService } from '../file/PdfOcrService'
import type {
  CompressPdfFileRequest,
  CompressPdfFileResult,
  EstimatePdfCompressionRequest,
  EstimatePdfCompressionResult,
  InspectSinglePdfResult,
  PdfCompressionProgressPayload,
  ToolboxPdfCompressionLevel,
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
}

type RenderedPdfPage = {
  pageNumber: number
  dataUrl: string
  width: number
  height: number
  pageWidthPt: number
  pageHeightPt: number
}

type CompressionProfile = {
  scale: number
  jpegQuality: number
}

type PdfCompressionProgressReporter = (payload: PdfCompressionProgressPayload) => void

const TEXT_LAYER_THRESHOLD = 12

const logger = {
  warn: (...args: unknown[]) => {
    try {
      console.warn('[PdfCompressService]', ...args)
    } catch {
      // noop
    }
  },
}

export class PdfCompressService {
  private static instance: PdfCompressService

  private constructor() {}

  public static getInstance(): PdfCompressService {
    if (!PdfCompressService.instance) {
      PdfCompressService.instance = new PdfCompressService()
    }
    return PdfCompressService.instance
  }

  public async estimateCompression(request: EstimatePdfCompressionRequest): Promise<EstimatePdfCompressionResult> {
    const filePath = this.resolvePdfPath(request.filePath)
    const info = await this.inspectSinglePdf(filePath)
    const level = this.normalizeLevel(request.level)

    if (!info.isPureScan) {
      return {
        ...info,
        level,
        estimatedMinSize: info.size,
        estimatedMaxSize: info.size,
        summary: '当前文件包含可提取文本，不属于纯扫描件，暂不支持该压缩方式。',
      }
    }

    const [estimatedMinSize, estimatedMaxSize] = this.estimateSizeRange(info.size, info.pageCount, level)
    return {
      ...info,
      level,
      estimatedMinSize,
      estimatedMaxSize,
      summary: this.buildEstimateSummary(info.size, info.pageCount, level, estimatedMinSize, estimatedMaxSize),
    }
  }

  public async compressPdfFile(
    request: CompressPdfFileRequest,
    onProgress?: PdfCompressionProgressReporter,
  ): Promise<CompressPdfFileResult> {
    const filePath = this.resolvePdfPath(request.filePath)
    const outputPath = path.resolve(String(request.outputPath || '').trim())
    if (!outputPath) {
      throw new Error('输出路径不能为空')
    }

    this.reportProgress(onProgress, {
      stage: 'checking',
      percent: 5,
      currentPage: 0,
      totalPages: 0,
      message: '正在检测 PDF 是否为纯扫描件...',
    })
    const info = await this.inspectSinglePdf(filePath)
    if (!info.isPureScan) {
      throw new Error('当前文件包含可提取文本，不属于纯扫描件，暂不支持该压缩方式。')
    }

    const level = this.normalizeLevel(request.level)
    const profile = this.getCompressionProfile(level)
    const pages = await this.renderPdfPagesAsJpeg(
      filePath,
      profile.scale,
      profile.jpegQuality,
      info.pageCount,
      onProgress,
    )

    if (pages.length === 0) {
      throw new Error('PDF 未包含可压缩页面')
    }

    this.reportProgress(onProgress, {
      stage: 'rebuilding',
      percent: 84,
      currentPage: 0,
      totalPages: info.pageCount,
      message: '正在重建扫描版 PDF...',
    })
    const pdfDoc = await PDFDocument.create()
    for (let index = 0; index < pages.length; index += 1) {
      const page = pages[index]
      const embedded = await pdfDoc.embedJpg(this.dataUrlToUint8Array(page.dataUrl))
      const targetPage = pdfDoc.addPage([page.pageWidthPt, page.pageHeightPt])
      targetPage.drawImage(embedded, {
        x: 0,
        y: 0,
        width: page.pageWidthPt,
        height: page.pageHeightPt,
      })
      this.reportProgress(onProgress, {
        stage: 'rebuilding',
        percent: 84 + Math.round(((index + 1) / pages.length) * 10),
        currentPage: index + 1,
        totalPages: pages.length,
        message: `正在重建第 ${index + 1}/${pages.length} 页...`,
      })
    }

    await fs.ensureDir(path.dirname(outputPath))
    this.reportProgress(onProgress, {
      stage: 'writing',
      percent: 96,
      currentPage: info.pageCount,
      totalPages: info.pageCount,
      message: '正在写入压缩后的 PDF...',
    })
    const pdfBytes = await pdfDoc.save({
      useObjectStreams: true,
      addDefaultPage: false,
      updateFieldAppearances: false,
    })
    await fs.writeFile(outputPath, Buffer.from(pdfBytes))

    if (request.openAfterSave) {
      try {
        await shell.openPath(outputPath)
      } catch (error) {
        logger.warn(`自动打开压缩 PDF 失败: ${outputPath}`, error)
      }
    }

    const writtenStat = await fs.stat(outputPath)
    const compressedSize = Number(writtenStat.size || 0)
    const originalSize = info.size
    const savedBytes = Math.max(0, originalSize - compressedSize)
    const compressionRatio = originalSize > 0
      ? Number((((originalSize - compressedSize) / originalSize) * 100).toFixed(2))
      : 0

    this.reportProgress(onProgress, {
      stage: 'completed',
      percent: 100,
      currentPage: info.pageCount,
      totalPages: info.pageCount,
      message: '压缩完成。',
    })

    return {
      outputPath,
      originalSize,
      compressedSize,
      savedBytes,
      compressionRatio,
      pageCount: info.pageCount,
      level,
      hasTextLayer: info.hasTextLayer,
      isPureScan: info.isPureScan,
    }
  }

  private async inspectSinglePdf(filePath: string): Promise<InspectSinglePdfResult> {
    const stat = await fs.stat(filePath)
    if (!stat.isFile()) {
      throw new Error(`不是有效文件: ${filePath}`)
    }

    const bytes = await fs.readFile(filePath)
    const doc = await PDFDocument.load(bytes)
    const pageCount = Number(doc.getPageCount() || 0)
    if (pageCount <= 0) {
      throw new Error(`PDF 不包含可用页面: ${path.basename(filePath)}`)
    }

    const extractedText = await PdfOcrService.getInstance().extractTextLayerFromPdf(filePath)
    const normalizedText = this.normalizeTextLayer(extractedText)
    const hasTextLayer = normalizedText.length >= TEXT_LAYER_THRESHOLD

    return {
      path: filePath,
      name: path.basename(filePath),
      size: Number(stat.size || 0),
      pageCount,
      hasTextLayer,
      isPureScan: !hasTextLayer,
    }
  }

  private normalizeTextLayer(text: string): string {
    return String(text || '').replace(/\s+/g, '').trim()
  }

  private normalizeLevel(level: ToolboxPdfCompressionLevel | string | undefined): ToolboxPdfCompressionLevel {
    if (level === 'light' || level === 'standard' || level === 'strong') {
      return level
    }
    return 'standard'
  }

  private getCompressionProfile(level: ToolboxPdfCompressionLevel): CompressionProfile {
    switch (level) {
      case 'light':
        return { scale: 1.55, jpegQuality: 0.78 }
      case 'strong':
        return { scale: 1.1, jpegQuality: 0.4 }
      case 'standard':
      default:
        return { scale: 1.3, jpegQuality: 0.58 }
    }
  }

  private estimateSizeRange(
    originalSize: number,
    pageCount: number,
    level: ToolboxPdfCompressionLevel,
  ): [number, number] {
    const averagePageSize = pageCount > 0 ? originalSize / pageCount : originalSize
    const isLargeScan = averagePageSize >= 900 * 1024
    const isSmallScan = averagePageSize <= 180 * 1024

    let minRatio = 0.34
    let maxRatio = 0.62

    if (level === 'light') {
      minRatio = 0.48
      maxRatio = 0.78
    } else if (level === 'strong') {
      minRatio = 0.18
      maxRatio = 0.42
    }

    if (isLargeScan) {
      minRatio *= 0.85
      maxRatio *= 0.92
    }

    if (isSmallScan) {
      minRatio = Math.min(0.86, minRatio * 1.35)
      maxRatio = Math.min(0.98, maxRatio * 1.2)
    }

    const estimatedMinSize = Math.max(1, Math.round(originalSize * Math.max(0.08, minRatio)))
    const estimatedMaxSize = Math.max(estimatedMinSize, Math.round(originalSize * Math.max(minRatio, maxRatio)))
    return [estimatedMinSize, estimatedMaxSize]
  }

  private buildEstimateSummary(
    originalSize: number,
    pageCount: number,
    level: ToolboxPdfCompressionLevel,
    estimatedMinSize: number,
    estimatedMaxSize: number,
  ): string {
    const averagePageSize = pageCount > 0 ? originalSize / pageCount : originalSize
    const levelLabel = level === 'light' ? '轻度' : level === 'strong' ? '强力' : '标准'
    const rangeText = `${this.formatBytes(estimatedMinSize)} - ${this.formatBytes(estimatedMaxSize)}`
    if (averagePageSize <= 180 * 1024) {
      return `${levelLabel}压缩预计输出 ${rangeText}，当前平均每页体积已较小，压缩空间可能有限。`
    }
    return `${levelLabel}压缩预计输出 ${rangeText}。该结果基于页数与平均每页体积的启发式区间估算。`
  }

  private formatBytes(size: number): string {
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

  private resolvePdfPath(filePath: string): string {
    const normalized = path.resolve(String(filePath || '').trim())
    if (!normalized) {
      throw new Error('文件路径不能为空')
    }
    if (path.extname(normalized).toLowerCase() !== '.pdf') {
      throw new Error(`仅支持 PDF 文件: ${normalized}`)
    }
    if (!fs.existsSync(normalized)) {
      throw new Error(`文件不存在: ${normalized}`)
    }
    return normalized
  }

  private async renderPdfPagesAsJpeg(
    filePath: string,
    scale: number,
    jpegQuality: number,
    totalPages: number,
    onProgress?: PdfCompressionProgressReporter,
  ): Promise<RenderedPdfPage[]> {
    const pdfModulePath = this.getPdfJsModulePath()
    const script = this.buildPdfJpegRenderScript(filePath, pdfModulePath, scale, jpegQuality)
    return await this.executePdfRender<RenderedPdfPage[]>(script, renderedPage => {
      const currentPage = Math.max(0, Math.min(totalPages, Number(renderedPage || 0)))
      this.reportProgress(onProgress, {
        stage: 'rendering',
        percent: 10 + Math.round((currentPage / Math.max(1, totalPages)) * 72),
        currentPage,
        totalPages,
        message: `正在压缩第 ${currentPage}/${totalPages} 页...`,
      })
    })
  }

  private buildPdfJpegRenderScript(
    filePath: string,
    pdfModulePath: string,
    scale: number,
    jpegQuality: number,
  ): string {
    const pdfModuleUrl = pathToFileURL(pdfModulePath).href
    const pdfWorkerPath = pathToFileURL(path.join(path.dirname(pdfModulePath), 'pdf.worker.mjs')).href
    return `
      (async () => {
        try {
          const fs = require('fs');
          const { ipcRenderer } = require('electron');
          if (typeof ReadableStream !== 'undefined' && !ReadableStream.prototype[Symbol.asyncIterator]) {
            ReadableStream.prototype[Symbol.asyncIterator] = async function* () {
              const reader = this.getReader();
              try {
                while (true) {
                  const result = await reader.read();
                  if (result.done) {
                    break;
                  }
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
            const renderViewport = page.getViewport({ scale: ${JSON.stringify(scale)} });
            const canvas = document.createElement('canvas');
            canvas.width = Math.max(1, Math.ceil(renderViewport.width));
            canvas.height = Math.max(1, Math.ceil(renderViewport.height));
            const context = canvas.getContext('2d', { alpha: false });
            if (!context) {
              throw new Error('无法创建 PDF 压缩 Canvas 上下文');
            }
            context.save();
            context.fillStyle = '#ffffff';
            context.fillRect(0, 0, canvas.width, canvas.height);
            context.restore();
            await page.render({ canvasContext: context, viewport: renderViewport }).promise;
            pages.push({
              pageNumber,
              dataUrl: canvas.toDataURL('image/jpeg', ${JSON.stringify(jpegQuality)}),
              width: canvas.width,
              height: canvas.height,
              pageWidthPt: baseViewport.width,
              pageHeightPt: baseViewport.height,
            });
            ipcRenderer.send('pdf-compress-page-rendered', pageNumber);
          }
          return pages;
        } catch (err) {
          console.error('PDF JPEG 渲染脚本执行失败:', err);
          throw err;
        }
      })()
    `
  }

  private dataUrlToUint8Array(dataUrl: string): Uint8Array {
    const match = String(dataUrl || '').match(/^data:.*?;base64,(.+)$/)
    if (!match) {
      throw new Error('PDF 页面图片编码失败')
    }
    return new Uint8Array(Buffer.from(match[1], 'base64'))
  }

  private async executePdfRender<T>(
    script: string,
    onPageRendered?: (pageNumber: number) => void,
  ): Promise<T> {
    const electronModule = this.getElectronMainModule()
    if (!electronModule?.BrowserWindow) {
      throw new Error('当前运行环境不支持扫描版 PDF 压缩')
    }

    const BrowserWindow = electronModule.BrowserWindow
    const window = new BrowserWindow({
      show: false,
      width: 1400,
      height: 1800,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false,
        sandbox: false,
        webSecurity: false,
      },
    })

    if (onPageRendered) {
      window.webContents.on('ipc-message', (_event: unknown, channel: unknown, pageNumber: unknown) => {
        if (channel === 'pdf-compress-page-rendered') {
          onPageRendered(Number(pageNumber || 0))
        }
      })
    }

    try {
      const blankHtmlUrl = pathToFileURL(this.resolveBlankHtmlPath()).href
      await window.loadURL(blankHtmlUrl)
      return await window.webContents.executeJavaScript<T>(script, true)
    } finally {
      window.destroy()
    }
  }

  private reportProgress(
    onProgress: PdfCompressionProgressReporter | undefined,
    payload: PdfCompressionProgressPayload,
  ): void {
    if (!onProgress) return
    const percent = Math.max(0, Math.min(100, Math.round(Number(payload.percent || 0))))
    onProgress({
      ...payload,
      percent,
      currentPage: Math.max(0, Math.floor(Number(payload.currentPage || 0))),
      totalPages: Math.max(0, Math.floor(Number(payload.totalPages || 0))),
    })
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

    throw new Error(`未找到 PDF 渲染页 blank.html，已尝试：${candidates.join(' | ')}`)
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

  private getUserDataPath(): string {
    const electronModule = this.getElectronMainModule()
    const userDataPath = electronModule?.app?.getPath?.('userData')
    if (userDataPath) {
      return userDataPath
    }
    return path.join(os.tmpdir(), 'software-registration-manager')
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
