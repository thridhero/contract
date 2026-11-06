import { shell, nativeImage } from 'electron'
import * as fs from 'fs-extra'
import * as path from 'path'
import { degrees, PDFDocument } from 'pdf-lib'
import type {
  BatchStampPdfFilesRequest,
  BatchStampPdfFilesResult,
  BatchStampPdfGeneratedFile,
  ToolboxPdfItem,
  ToolboxPdfStampMode,
} from '../../../shared/types/toolbox.types'

const logger = {
  warn: (...args: unknown[]) => {
    try {
      console.warn('[PdfBatchStampService]', ...args)
    } catch {
      // noop
    }
  },
}

type ResolvedStampImage = {
  kind: 'png' | 'jpg'
  bytes: Uint8Array
  width: number
  height: number
}

export class PdfBatchStampService {
  private static instance: PdfBatchStampService

  private constructor() {}

  public static getInstance(): PdfBatchStampService {
    if (!PdfBatchStampService.instance) {
      PdfBatchStampService.instance = new PdfBatchStampService()
    }
    return PdfBatchStampService.instance
  }

  public async batchStampPdfFiles(request: BatchStampPdfFilesRequest): Promise<BatchStampPdfFilesResult> {
    const outputDir = path.resolve(String(request.outputDir || '').trim())
    if (!outputDir) {
      throw new Error('输出目录不能为空')
    }

    const files = Array.isArray(request.files) ? request.files : []
    if (files.length === 0) {
      throw new Error('请至少选择一个 PDF 文件')
    }

    const mode = this.normalizeMode(request.mode)
    const stampWidthPt = this.normalizePositiveNumber(request.stampWidthPt, '印章宽度')
    const rotationDegreesValue = this.normalizeFiniteNumber(request.rotationDegrees, '旋转角度')
    const opacity = this.normalizeOpacity(request.opacity)
    const placement = mode === 'position' ? this.normalizePlacement(request.placement) : null
    const stampImage = await this.resolveStampImage(String(request.stampImage?.filePath || '').trim())
    const stampHeightPt = stampWidthPt * (stampImage.height / stampImage.width)

    await fs.ensureDir(outputDir)
    const generatedFiles: BatchStampPdfGeneratedFile[] = []

    for (const file of files) {
      const generated = await this.stampSinglePdf({
        file,
        outputDir,
        mode,
        placement,
        stampImage,
        stampWidthPt,
        stampHeightPt,
        rotationDegreesValue,
        opacity,
      })
      generatedFiles.push(generated)
    }

    if (request.openAfterSave) {
      try {
        await shell.openPath(outputDir)
      } catch (error) {
        logger.warn(`自动打开输出目录失败: ${outputDir}`, error)
      }
    }

    return {
      outputDir,
      generatedFiles,
      fileCount: generatedFiles.length,
      pageCount: generatedFiles.reduce((sum, item) => sum + item.pageCount, 0),
      totalSize: generatedFiles.reduce((sum, item) => sum + item.fileSize, 0),
    }
  }

  private async stampSinglePdf(options: {
    file: ToolboxPdfItem
    outputDir: string
    mode: ToolboxPdfStampMode
    placement: { x: number; y: number } | null
    stampImage: ResolvedStampImage
    stampWidthPt: number
    stampHeightPt: number
    rotationDegreesValue: number
    opacity: number
  }): Promise<BatchStampPdfGeneratedFile> {
    const normalizedPath = path.resolve(String(options.file.path || '').trim())
    const sourceName = String(options.file.name || path.basename(normalizedPath) || '未命名文件')
    const sourceBytes = await this.readPdfBytes(normalizedPath)
    const pdfDoc = await PDFDocument.load(sourceBytes)
    const pageCount = Number(pdfDoc.getPageCount() || 0)
    if (pageCount <= 0) {
      throw new Error(`PDF 不包含可盖章页面: ${sourceName}`)
    }

    const embeddedStamp = options.stampImage.kind === 'jpg'
      ? await pdfDoc.embedJpg(options.stampImage.bytes)
      : await pdfDoc.embedPng(options.stampImage.bytes)

    const seamSlices = options.mode === 'seam'
      ? this.buildSeamSlices(options.stampImage, pageCount)
      : null

    for (let pageIndex = 0; pageIndex < pageCount; pageIndex += 1) {
      const page = pdfDoc.getPage(pageIndex)
      const { width: pageWidth, height: pageHeight } = page.getSize()

      if (options.mode === 'position') {
        const placement = options.placement as { x: number; y: number }
        this.assertPlacementWithinPage(placement.x, placement.y, pageWidth, pageHeight, sourceName, pageIndex + 1)
        page.drawImage(embeddedStamp, {
          x: placement.x,
          y: placement.y,
          width: options.stampWidthPt,
          height: options.stampHeightPt,
          rotate: degrees(options.rotationDegreesValue),
          opacity: options.opacity,
        })
        continue
      }

      const slice = seamSlices?.[pageIndex]
      if (!slice) {
        continue
      }
      const embeddedSlice = slice.kind === 'jpg'
        ? await pdfDoc.embedJpg(slice.bytes)
        : await pdfDoc.embedPng(slice.bytes)
      const sliceWidthPt = options.stampWidthPt * (slice.width / options.stampImage.width)
      const seamCenterY = pageHeight * 0.5
      const seamX = Math.max(0, pageWidth - sliceWidthPt)
      const seamY = Math.max(0, seamCenterY - options.stampHeightPt / 2)
      page.drawImage(embeddedSlice, {
        x: seamX,
        y: seamY,
        width: sliceWidthPt,
        height: options.stampHeightPt,
        opacity: options.opacity,
      })
    }

    const outputPath = await this.resolveOutputPath(options.outputDir, sourceName)
    const pdfBytes = await pdfDoc.save()
    await fs.writeFile(outputPath, Buffer.from(pdfBytes))
    const stat = await fs.stat(outputPath)

    return {
      sourcePath: normalizedPath,
      sourceName,
      outputPath,
      fileSize: Number(stat.size || 0),
      pageCount,
    }
  }

  private buildSeamSlices(stampImage: ResolvedStampImage, pageCount: number): ResolvedStampImage[] {
    const image = nativeImage.createFromBuffer(Buffer.from(stampImage.bytes))
    if (image.isEmpty()) {
      throw new Error('印章图片无法读取')
    }

    const slices: ResolvedStampImage[] = []
    for (let index = 0; index < pageCount; index += 1) {
      const startX = Math.floor(index * stampImage.width / pageCount)
      const endX = Math.floor((index + 1) * stampImage.width / pageCount)
      const width = Math.max(1, endX - startX)
      const sliceImage = image.crop({
        x: Math.min(startX, stampImage.width - 1),
        y: 0,
        width,
        height: stampImage.height,
      })
      slices.push({
        kind: 'png',
        bytes: sliceImage.toPNG(),
        width,
        height: stampImage.height,
      })
    }
    return slices
  }

  private async resolveOutputPath(outputDir: string, sourceName: string): Promise<string> {
    const parsed = path.parse(sourceName)
    const baseName = parsed.name || '未命名文件'
    let candidate = path.join(outputDir, `${baseName}_已盖章.pdf`)
    let dedupeIndex = 1
    while (await fs.pathExists(candidate)) {
      candidate = path.join(outputDir, `${baseName}_已盖章_${dedupeIndex}.pdf`)
      dedupeIndex += 1
    }
    return candidate
  }

  private async readPdfBytes(pdfPath: string): Promise<Uint8Array> {
    if (!pdfPath) {
      throw new Error('文件路径不能为空')
    }
    if (path.extname(pdfPath).toLowerCase() !== '.pdf') {
      throw new Error(`仅支持 PDF 文件: ${pdfPath}`)
    }
    if (!await fs.pathExists(pdfPath)) {
      throw new Error(`文件不存在: ${pdfPath}`)
    }
    const stat = await fs.stat(pdfPath)
    if (!stat.isFile()) {
      throw new Error(`不是有效文件: ${pdfPath}`)
    }
    const bytes = await fs.readFile(pdfPath)
    return new Uint8Array(bytes)
  }

  private async resolveStampImage(filePath: string): Promise<ResolvedStampImage> {
    const normalizedPath = path.resolve(String(filePath || '').trim())
    if (!normalizedPath) {
      throw new Error('印章图片路径不能为空')
    }
    if (!await fs.pathExists(normalizedPath)) {
      throw new Error(`印章图片不存在: ${normalizedPath}`)
    }

    const image = nativeImage.createFromPath(normalizedPath)
    if (image.isEmpty()) {
      throw new Error(`印章图片无法读取: ${normalizedPath}`)
    }
    const { width, height } = image.getSize()
    if (!width || !height) {
      throw new Error('印章图片尺寸无效')
    }

    const ext = path.extname(normalizedPath).toLowerCase()
    if (ext === '.jpg' || ext === '.jpeg') {
      return {
        kind: 'jpg',
        bytes: new Uint8Array(await fs.readFile(normalizedPath)),
        width,
        height,
      }
    }

    return {
      kind: 'png',
      bytes: image.toPNG(),
      width,
      height,
    }
  }

  private normalizeMode(value: unknown): ToolboxPdfStampMode {
    if (value === 'position' || value === 'seam') {
      return value
    }
    throw new Error('盖章模式无效')
  }

  private normalizePlacement(value: unknown): { x: number; y: number } {
    const x = this.normalizeFiniteNumber((value as { x?: unknown } | null)?.x, '盖章横坐标')
    const y = this.normalizeFiniteNumber((value as { y?: unknown } | null)?.y, '盖章纵坐标')
    return { x, y }
  }

  private normalizePositiveNumber(value: unknown, label: string): number {
    const normalized = Number(value)
    if (!Number.isFinite(normalized) || normalized <= 0) {
      throw new Error(`${label}必须大于 0`)
    }
    return normalized
  }

  private normalizeFiniteNumber(value: unknown, label: string): number {
    const normalized = Number(value)
    if (!Number.isFinite(normalized)) {
      throw new Error(`${label}无效`)
    }
    return normalized
  }

  private normalizeOpacity(value: unknown): number {
    const normalized = Number(value)
    if (!Number.isFinite(normalized) || normalized < 0 || normalized > 1) {
      throw new Error('透明度必须在 0 到 1 之间')
    }
    return normalized
  }

  private assertPlacementWithinPage(
    x: number,
    y: number,
    pageWidth: number,
    pageHeight: number,
    sourceName: string,
    pageNumber: number,
  ): void {
    if (x < 0 || x > pageWidth || y < 0 || y > pageHeight) {
      throw new Error(`盖章位置超出页面范围: ${sourceName} 第 ${pageNumber} 页`)
    }
  }
}
