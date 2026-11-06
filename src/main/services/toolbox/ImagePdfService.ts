import { shell } from 'electron'
import * as crypto from 'crypto'
import * as fs from 'fs-extra'
import * as path from 'path'
import { PDFDocument } from 'pdf-lib'
import type {
  CreateImagePdfRequest,
  CreateImagePdfResult,
  ScanImageFolderRequest,
  ScanImageFolderResult,
  ToolboxImageItem,
} from '../../../shared/types/toolbox.types'

const logger = {
  warn: (...args: unknown[]) => {
    try {
      console.warn('[ImagePdfService]', ...args)
    } catch {
      // noop
    }
  },
}

const SUPPORTED_IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.bmp', '.gif'])
const A4_PAGE_WIDTH_PT = 595.28
const A4_PAGE_HEIGHT_PT = 841.89
const PX_TO_PT = 72 / 96

type ResolvedImage = {
  bytes: Uint8Array
  kind: 'png' | 'jpg'
  width: number
  height: number
}

export class ImagePdfService {
  private static instance: ImagePdfService

  private constructor() {}

  public static getInstance(): ImagePdfService {
    if (!ImagePdfService.instance) {
      ImagePdfService.instance = new ImagePdfService()
    }
    return ImagePdfService.instance
  }

  public async scanImageFolder(request: ScanImageFolderRequest): Promise<ScanImageFolderResult> {
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

  public async createImagePdf(request: CreateImagePdfRequest): Promise<CreateImagePdfResult> {
    const outputPath = path.resolve(String(request.outputPath || '').trim())
    if (!outputPath) {
      throw new Error('输出路径不能为空')
    }
    if (!Array.isArray(request.images) || request.images.length === 0) {
      throw new Error('至少需要选择一张图片')
    }
    if (request.pagePreset !== 'A4') {
      throw new Error(`暂不支持的页面规格: ${request.pagePreset}`)
    }

    const pdfDoc = await PDFDocument.create()
    const marginPt = Math.max(0, Number.isFinite(request.marginPx) ? request.marginPx * PX_TO_PT : 24 * PX_TO_PT)
    const pageWidth = A4_PAGE_WIDTH_PT
    const pageHeight = A4_PAGE_HEIGHT_PT
    const availableWidth = Math.max(1, pageWidth - marginPt * 2)
    const availableHeight = Math.max(1, pageHeight - marginPt * 2)

    for (const item of request.images) {
      const resolved = await this.resolveImageForPdf(item.path)
      const embedded = resolved.kind === 'jpg'
        ? await pdfDoc.embedJpg(resolved.bytes)
        : await pdfDoc.embedPng(resolved.bytes)

      const page = pdfDoc.addPage([pageWidth, pageHeight])
      const scale = Math.min(availableWidth / resolved.width, availableHeight / resolved.height)
      const drawWidth = resolved.width * scale
      const drawHeight = resolved.height * scale
      const x = (pageWidth - drawWidth) / 2
      const y = (pageHeight - drawHeight) / 2

      page.drawImage(embedded, {
        x,
        y,
        width: drawWidth,
        height: drawHeight,
      })
    }

    await fs.ensureDir(path.dirname(outputPath))
    const pdfBytes = await pdfDoc.save()
    await fs.writeFile(outputPath, Buffer.from(pdfBytes))

    if (request.openAfterSave) {
      try {
        await shell.openPath(outputPath)
      } catch (error) {
        logger.warn(`自动打开 PDF 失败: ${outputPath}`, error)
      }
    }

    const writtenStat = await fs.stat(outputPath)
    return {
      outputPath,
      pageCount: request.images.length,
      fileSize: Number(writtenStat.size || 0),
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

      const ext = path.extname(entry.name).toLowerCase()
      if (!SUPPORTED_IMAGE_EXTENSIONS.has(ext)) {
        continue
      }

      try {
        const item = await this.buildImageItem(absolutePath, rootDir, 'folder')
        if (item) {
          items.push(item)
        }
      } catch (error) {
        logger.warn(`扫描图片失败，已跳过: ${absolutePath}`, error)
      }
    }
  }

  public async buildImageItem(
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

  private async resolveImageForPdf(imagePath: string): Promise<ResolvedImage> {
    const normalizedPath = path.resolve(String(imagePath || '').trim())
    if (!normalizedPath || !fs.existsSync(normalizedPath)) {
      throw new Error(`图片不存在: ${imagePath}`)
    }

    const ext = path.extname(normalizedPath).toLowerCase()
    const native = this.getNativeImage()

    if (ext === '.jpg' || ext === '.jpeg') {
      if (!native) {
        throw new Error('当前运行环境无法处理 JPG 图片，请在 Electron 应用内执行该操作')
      }
      const image = native.createFromPath(normalizedPath)
      if (image.isEmpty()) {
        throw new Error(`图片无法读取: ${normalizedPath}`)
      }
      const { width, height } = image.getSize()
      const rawBytes = await fs.readFile(normalizedPath)
      return {
        bytes: new Uint8Array(rawBytes),
        kind: 'jpg',
        width,
        height,
      }
    }

    if (native) {
      const image = native.createFromPath(normalizedPath)
      if (!image.isEmpty()) {
        const { width, height } = image.getSize()
        if (width && height) {
          return {
            bytes: image.toPNG(),
            kind: 'png',
            width,
            height,
          }
        }
      }
    }

    const rawBytes = await fs.readFile(normalizedPath)
    const pngSize = this.readPngSize(Buffer.from(rawBytes))
    if (!pngSize) {
      throw new Error(`图片无法读取: ${normalizedPath}`)
    }
    return {
      bytes: new Uint8Array(rawBytes),
      kind: 'png',
      width: pngSize.width,
      height: pngSize.height,
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
