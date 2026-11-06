import { shell } from 'electron'
import * as crypto from 'crypto'
import * as fs from 'fs-extra'
import * as path from 'path'
import type { Stats } from 'fs'
import { PDFDocument } from 'pdf-lib'
import type {
  InspectPdfFilesRequest,
  InspectPdfFilesResult,
  MergePdfFilesRequest,
  MergePdfFilesResult,
  ToolboxPdfItem,
} from '../../../shared/types/toolbox.types'

const logger = {
  warn: (...args: unknown[]) => {
    try {
      console.warn('[PdfMergeService]', ...args)
    } catch {
      // noop
    }
  },
}

export class PdfMergeService {
  private static instance: PdfMergeService

  private constructor() {}

  public static getInstance(): PdfMergeService {
    if (!PdfMergeService.instance) {
      PdfMergeService.instance = new PdfMergeService()
    }
    return PdfMergeService.instance
  }

  public async inspectPdfFiles(request: InspectPdfFilesRequest): Promise<InspectPdfFilesResult> {
    const filePaths = Array.isArray(request.filePaths) ? request.filePaths : []
    if (filePaths.length === 0) {
      throw new Error('请至少选择一个 PDF 文件')
    }

    const items: ToolboxPdfItem[] = []
    for (const filePath of filePaths) {
      items.push(await this.buildPdfItem(filePath))
    }

    return { items }
  }

  public async mergePdfFiles(request: MergePdfFilesRequest): Promise<MergePdfFilesResult> {
    const outputPath = path.resolve(String(request.outputPath || '').trim())
    if (!outputPath) {
      throw new Error('输出路径不能为空')
    }

    const files = Array.isArray(request.files) ? request.files : []
    if (files.length === 0) {
      throw new Error('请至少选择一个 PDF 文件')
    }

    const targetDoc = await PDFDocument.create()
    let totalPageCount = 0

    for (const item of files) {
      const normalizedPath = path.resolve(String(item.path || '').trim())
      const fileName = String(item.name || path.basename(normalizedPath) || '未命名文件')
      const sourceBytes = await this.readPdfBytes(normalizedPath)
      const sourceDoc = await PDFDocument.load(sourceBytes)
      const sourcePageCount = Number(sourceDoc.getPageCount() || 0)
      if (sourcePageCount <= 0) {
        throw new Error(`PDF 不包含可合并页面: ${fileName}`)
      }

      const rangeStart = this.normalizePageNumber(item.rangeStart, '起始页')
      const rangeEnd = this.normalizePageNumber(item.rangeEnd, '结束页')
      if (rangeStart > rangeEnd) {
        throw new Error(`页码范围无效: ${fileName}`)
      }
      if (rangeStart < 1 || rangeEnd > sourcePageCount) {
        throw new Error(`页码范围超出总页数: ${fileName}`)
      }

      const pageIndexes = Array.from({ length: rangeEnd - rangeStart + 1 }, (_, index) => rangeStart - 1 + index)
      const copiedPages = await targetDoc.copyPages(sourceDoc, pageIndexes)
      copiedPages.forEach((page) => targetDoc.addPage(page))
      totalPageCount += copiedPages.length
    }

    await fs.ensureDir(path.dirname(outputPath))
    const pdfBytes = await targetDoc.save()
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
      pageCount: totalPageCount,
      fileSize: Number(writtenStat.size || 0),
    }
  }

  private async buildPdfItem(filePath: string): Promise<ToolboxPdfItem> {
    const normalizedPath = path.resolve(String(filePath || '').trim())
    const stat = await this.readPdfStat(normalizedPath)
    const bytes = await this.readPdfBytes(normalizedPath)
    const pdfDoc = await PDFDocument.load(bytes)
    const pageCount = Number(pdfDoc.getPageCount() || 0)
    if (pageCount <= 0) {
      throw new Error(`PDF 不包含可用页面: ${path.basename(normalizedPath)}`)
    }

    return {
      id: crypto.createHash('sha1').update(normalizedPath).digest('hex'),
      name: path.basename(normalizedPath),
      path: normalizedPath,
      size: Number(stat.size || 0),
      pageCount,
      selected: true,
      rangeStart: 1,
      rangeEnd: pageCount,
    }
  }

  private async readPdfStat(pdfPath: string): Promise<Stats> {
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
    return stat
  }

  private async readPdfBytes(pdfPath: string): Promise<Uint8Array> {
    await this.readPdfStat(pdfPath)
    try {
      const bytes = await fs.readFile(pdfPath)
      return new Uint8Array(bytes)
    } catch (error) {
      throw new Error(`读取 PDF 失败: ${path.basename(pdfPath)}${error instanceof Error ? ` (${error.message})` : ''}`)
    }
  }

  private normalizePageNumber(value: unknown, label: string): number {
    const normalized = Number(value)
    if (!Number.isInteger(normalized) || normalized <= 0) {
      throw new Error(`${label}必须是大于 0 的整数`)
    }
    return normalized
  }
}
