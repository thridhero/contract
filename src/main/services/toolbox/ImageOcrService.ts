import * as crypto from 'crypto'
import * as fs from 'fs-extra'
import * as path from 'path'
import {
  AlignmentType,
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
} from 'docx'
import { PdfOcrService } from '../file/PdfOcrService'
import type {
  BatchImageOcrRequest,
  BatchImageOcrResult,
  ExportImageOcrDocxRequest,
  ExportImageOcrDocxResult,
  ScanOcrImageFolderRequest,
  ScanOcrImageFolderResult,
  ToolboxImageItem,
  ToolboxOcrImageItem,
} from '../../../shared/types/toolbox.types'

const SUPPORTED_OCR_IMAGE_EXTENSIONS = new Set([
  '.png',
  '.jpg',
  '.jpeg',
  '.webp',
  '.bmp',
  '.gif',
  '.tif',
  '.tiff',
])

const logger = {
  warn: (...args: unknown[]) => {
    try {
      console.warn('[ImageOcrService]', ...args)
    } catch {
      // noop
    }
  },
}

function removeBlankLines(text: string): string {
  return String(text || '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map(line => line.trimEnd())
    .filter(line => line.trim())
    .join('\n')
}

export class ImageOcrService {
  private static instance: ImageOcrService

  private constructor() {}

  public static getInstance(): ImageOcrService {
    if (!ImageOcrService.instance) {
      ImageOcrService.instance = new ImageOcrService()
    }
    return ImageOcrService.instance
  }

  public async scanImageFolder(request: ScanOcrImageFolderRequest): Promise<ScanOcrImageFolderResult> {
    const folderPath = path.resolve(String(request.folderPath || '').trim())
    if (!folderPath) {
      throw new Error('目录路径不能为空')
    }
    if (!fs.existsSync(folderPath)) {
      throw new Error(`目录不存在: ${folderPath}`)
    }

    const stat = await fs.stat(folderPath)
    if (!stat.isDirectory()) {
      throw new Error('所选路径不是目录')
    }

    const items: ToolboxImageItem[] = []
    await this.walkDirectory(folderPath, folderPath, request.recursive !== false, items)
    items.sort((a, b) => {
      const left = `${String(a.relativePath || '').toLowerCase()}\u0000${a.name.toLowerCase()}`
      const right = `${String(b.relativePath || '').toLowerCase()}\u0000${b.name.toLowerCase()}`
      return left.localeCompare(right, 'zh-CN')
    })

    return {
      folderPath,
      items,
    }
  }

  public async batchOcr(request: BatchImageOcrRequest): Promise<BatchImageOcrResult> {
    const images = Array.isArray(request.images) ? request.images : []
    if (images.length === 0) {
      throw new Error('至少需要一张图片')
    }

    const ocrService = PdfOcrService.getInstance()
    const results: ToolboxOcrImageItem[] = []
    let successCount = 0
    let failureCount = 0

    for (const item of images) {
      const normalized = await this.normalizeImageItem(item)
      if (!normalized) {
        failureCount += 1
        results.push({
          ...this.buildFallbackItem(item),
          status: 'error',
          errorMessage: '图片不存在或无法读取',
        })
        continue
      }

      try {
        const result = await ocrService.testOcr(normalized.path)
        successCount += 1
        results.push({
          ...normalized,
          status: 'success',
          recognizedText: removeBlankLines(String(result.text || '')),
          elapsedMs: Number(result.elapsedMs || 0),
          errorMessage: undefined,
        })
      } catch (error) {
        failureCount += 1
        results.push({
          ...normalized,
          status: 'error',
          recognizedText: '',
          elapsedMs: undefined,
          errorMessage: error instanceof Error ? error.message : String(error),
        })
      }
    }

    return {
      items: results,
      successCount,
      failureCount,
    }
  }

  public async exportToDocx(request: ExportImageOcrDocxRequest): Promise<ExportImageOcrDocxResult> {
    const outputPath = path.resolve(String(request.outputPath || '').trim())
    if (!outputPath) {
      throw new Error('输出路径不能为空')
    }

    const successfulItems = (Array.isArray(request.items) ? request.items : [])
      .filter(item => item && item.status === 'success' && String(item.recognizedText || '').trim())

    if (successfulItems.length === 0) {
      throw new Error('没有可导出的识别结果')
    }

    const title = String(request.documentTitle || '').trim() || '图片 OCR 识别结果'
    const generatedAt = new Date().toLocaleString('zh-CN', { hour12: false })
    const children: Paragraph[] = [
      new Paragraph({
        heading: HeadingLevel.TITLE,
        alignment: AlignmentType.CENTER,
        children: [new TextRun(title)],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun(`导出时间：${generatedAt}`)],
      }),
      new Paragraph({ text: '' }),
    ]

    successfulItems.forEach((item, index) => {
      const fileLabel = item.relativePath || item.name
      children.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_1,
          pageBreakBefore: index > 0,
          children: [new TextRun(`${index + 1}. ${item.name}`)],
        }),
        new Paragraph({
          children: [
            new TextRun({ text: '来源路径：', bold: true }),
            new TextRun(item.path),
          ],
        }),
        new Paragraph({
          children: [
            new TextRun({ text: '相对名称：', bold: true }),
            new TextRun(fileLabel),
          ],
        }),
        new Paragraph({
          children: [
            new TextRun({ text: '识别耗时：', bold: true }),
            new TextRun(item.elapsedMs ? `${item.elapsedMs} ms` : '未知'),
          ],
        }),
      )

      const lines = removeBlankLines(String(item.recognizedText || '')).split('\n')

      children.push(
        new Paragraph({
          spacing: { before: 240, after: 80 },
          children: [new TextRun({ text: '识别结果', bold: true })],
        }),
      )

      if (lines.length === 0 || lines.every(line => !line.trim())) {
        children.push(new Paragraph({ children: [new TextRun('')]}))
      } else {
        lines.forEach(line => {
          children.push(
            new Paragraph({
              spacing: { after: 80 },
              children: [new TextRun(line)],
            }),
          )
        })
      }
    })

    const document = new Document({
      sections: [
        {
          children,
        },
      ],
    })

    await fs.ensureDir(path.dirname(outputPath))
    const buffer = await Packer.toBuffer(document)
    await fs.writeFile(outputPath, buffer)
    const stat = await fs.stat(outputPath)

    return {
      outputPath,
      fileSize: Number(stat.size || 0),
      exportedCount: successfulItems.length,
    }
  }

  private async walkDirectory(
    rootDir: string,
    currentDir: string,
    recursive: boolean,
    items: ToolboxImageItem[],
  ): Promise<void> {
    const entries = await fs.readdir(currentDir, { withFileTypes: true })

    for (const entry of entries) {
      const absolutePath = path.join(currentDir, entry.name)

      if (entry.isDirectory()) {
        if (recursive) {
          await this.walkDirectory(rootDir, absolutePath, recursive, items)
        }
        continue
      }

      if (!entry.isFile()) {
        continue
      }

      if (!SUPPORTED_OCR_IMAGE_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
        continue
      }

      try {
        const item = await this.buildImageItem(absolutePath, rootDir, 'folder')
        if (item) {
          items.push(item)
        }
      } catch (error) {
        logger.warn(`扫描 OCR 图片失败，已跳过: ${absolutePath}`, error)
      }
    }
  }

  private async normalizeImageItem(item: ToolboxImageItem): Promise<ToolboxImageItem | null> {
    const filePath = path.resolve(String(item?.path || '').trim())
    if (!filePath || !fs.existsSync(filePath)) {
      return null
    }
    const built = await this.buildImageItem(filePath, null, item.source || 'file')
    if (!built) {
      return null
    }
    return {
      ...built,
      id: String(item.id || built.id),
      relativePath: item.relativePath || built.relativePath,
      source: item.source || built.source,
    }
  }

  private buildFallbackItem(item: Partial<ToolboxImageItem>): ToolboxImageItem {
    const filePath = path.resolve(String(item?.path || '').trim())
    return {
      id: String(item?.id || crypto.createHash('sha1').update(filePath || Math.random().toString()).digest('hex')),
      name: String(item?.name || path.basename(filePath || '未知图片')),
      path: filePath,
      relativePath: item?.relativePath,
      width: item?.width,
      height: item?.height,
      size: Number(item?.size || 0),
      source: item?.source || 'file',
    }
  }

  private async buildImageItem(
    absolutePath: string,
    relativeRoot: string | null,
    source: ToolboxImageItem['source'],
  ): Promise<ToolboxImageItem | null> {
    const normalizedPath = path.resolve(String(absolutePath || '').trim())
    if (!normalizedPath || !fs.existsSync(normalizedPath)) {
      return null
    }

    const stat = await fs.stat(normalizedPath)
    if (!stat.isFile()) {
      return null
    }

    const size = await this.readImageSize(normalizedPath)
    const relativePath = relativeRoot
      ? path.relative(relativeRoot, normalizedPath).replace(/\\/g, '/')
      : undefined

    return {
      id: crypto.createHash('sha1').update(normalizedPath).digest('hex'),
      name: path.basename(normalizedPath),
      path: normalizedPath,
      relativePath,
      width: size.width || undefined,
      height: size.height || undefined,
      size: Number(stat.size || 0),
      source,
    }
  }

  private getNativeImage(): typeof import('electron').nativeImage | null {
    try {
      const electronModule = require('electron') as typeof import('electron')
      return electronModule?.nativeImage || null
    } catch {
      return null
    }
  }

  private async readImageSize(imagePath: string): Promise<{ width: number; height: number }> {
    const native = this.getNativeImage()
    if (native) {
      const image = native.createFromPath(imagePath)
      if (!image.isEmpty()) {
        const size = image.getSize()
        if (size.width && size.height) {
          return size
        }
      }
    }

    const ext = path.extname(imagePath).toLowerCase()
    if (ext === '.png') {
      const rawBytes = await fs.readFile(imagePath)
      const size = this.readPngSize(Buffer.from(rawBytes))
      if (size) {
        return size
      }
    }

    throw new Error(`图片无法读取或格式不受支持: ${imagePath}`)
  }

  private readPngSize(buffer: Buffer): { width: number; height: number } | null {
    if (!buffer || buffer.length < 24) return null
    const pngSignature = '89504e470d0a1a0a'
    if (buffer.subarray(0, 8).toString('hex') !== pngSignature) {
      return null
    }

    const chunkType = buffer.subarray(12, 16).toString('ascii')
    if (chunkType !== 'IHDR') {
      return null
    }

    return {
      width: buffer.readUInt32BE(16),
      height: buffer.readUInt32BE(20),
    }
  }
}
