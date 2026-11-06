import { shell } from 'electron'
import * as fs from 'fs-extra'
import * as path from 'path'
import type { Stats } from 'fs'
import { PDFDocument } from 'pdf-lib'
import type {
  SplitPdfFilesRequest,
  SplitPdfFilesResult,
  SplitPdfGeneratedFile,
  ToolboxPdfSplitItem,
  ToolboxPdfSplitRange,
} from '../../../shared/types/toolbox.types'

const logger = {
  warn: (...args: unknown[]) => {
    try {
      console.warn('[PdfSplitService]', ...args)
    } catch {
      // noop
    }
  },
}

interface NormalizedRange {
  start: number
  end: number
}

export class PdfSplitService {
  private static instance: PdfSplitService

  private constructor() {}

  public static getInstance(): PdfSplitService {
    if (!PdfSplitService.instance) {
      PdfSplitService.instance = new PdfSplitService()
    }
    return PdfSplitService.instance
  }

  public async splitPdfFiles(request: SplitPdfFilesRequest): Promise<SplitPdfFilesResult> {
    const outputDir = path.resolve(String(request.outputDir || '').trim())
    if (!outputDir) {
      throw new Error('输出目录不能为空')
    }

    const files = Array.isArray(request.files) ? request.files : []
    if (files.length === 0) {
      throw new Error('请至少选择一个 PDF 文件')
    }

    await fs.ensureDir(outputDir)
    const generatedFiles: SplitPdfGeneratedFile[] = []

    for (const item of files) {
      const normalizedPath = path.resolve(String(item.path || '').trim())
      const fileName = String(item.name || path.basename(normalizedPath) || '未命名文件')
      const sourceBytes = await this.readPdfBytes(normalizedPath)
      const sourceDoc = await PDFDocument.load(sourceBytes)
      const sourcePageCount = Number(sourceDoc.getPageCount() || 0)
      if (sourcePageCount <= 0) {
        throw new Error(`PDF 不包含可拆分页面: ${fileName}`)
      }

      const ranges = item.splitMode === 'custom-ranges'
        ? this.normalizeCustomRanges(item.customRanges, sourcePageCount, fileName)
        : this.buildChunkRanges(item.pagesPerChunk, sourcePageCount, fileName)

      for (let index = 0; index < ranges.length; index += 1) {
        const range = ranges[index]
        const targetDoc = await PDFDocument.create()
        const pageIndexes = Array.from({ length: range.end - range.start + 1 }, (_, offset) => range.start - 1 + offset)
        const copiedPages = await targetDoc.copyPages(sourceDoc, pageIndexes)
        copiedPages.forEach((page) => targetDoc.addPage(page))

        const outputPath = await this.resolveOutputPath(
          outputDir,
          item.splitMode,
          fileName,
          range,
          index,
        )
        const pdfBytes = await targetDoc.save()
        await fs.writeFile(outputPath, Buffer.from(pdfBytes))
        const stat = await fs.stat(outputPath)

        generatedFiles.push({
          outputPath,
          pageCount: copiedPages.length,
          fileSize: Number(stat.size || 0),
          sourceName: fileName,
        })
      }
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

  private buildChunkRanges(pagesPerChunkValue: unknown, pageCount: number, fileName: string): NormalizedRange[] {
    const pagesPerChunk = this.normalizePageNumber(pagesPerChunkValue, '每个文档包含页数')
    const ranges: NormalizedRange[] = []
    for (let start = 1; start <= pageCount; start += pagesPerChunk) {
      ranges.push({
        start,
        end: Math.min(pageCount, start + pagesPerChunk - 1),
      })
    }
    if (ranges.length === 0) {
      throw new Error(`PDF 不包含可拆分页面: ${fileName}`)
    }
    return ranges
  }

  private normalizeCustomRanges(rangesValue: ToolboxPdfSplitRange[], pageCount: number, fileName: string): NormalizedRange[] {
    const ranges = Array.isArray(rangesValue) ? rangesValue : []
    if (ranges.length === 0) {
      throw new Error(`请至少为 ${fileName} 配置一个页码范围`)
    }

    const normalized = ranges.map((range, index) => {
      const start = this.normalizePageNumber(range?.start, `第 ${index + 1} 段起始页`)
      const end = this.normalizePageNumber(range?.end, `第 ${index + 1} 段结束页`)
      if (start > end) {
        throw new Error(`页码范围无效: ${fileName} 第 ${index + 1} 段`)
      }
      if (start < 1 || end > pageCount) {
        throw new Error(`页码范围超出总页数: ${fileName} 第 ${index + 1} 段`)
      }
      return { start, end }
    })

    const sorted = [...normalized].sort((left, right) => left.start - right.start || left.end - right.end)
    for (let index = 1; index < sorted.length; index += 1) {
      const previous = sorted[index - 1]
      const current = sorted[index]
      if (current.start <= previous.end) {
        throw new Error(`页码范围存在重叠: ${fileName}`)
      }
    }

    return normalized
  }

  private async resolveOutputPath(
    outputDir: string,
    splitMode: ToolboxPdfSplitItem['splitMode'],
    fileName: string,
    range: NormalizedRange,
    index: number,
  ): Promise<string> {
    const parsed = path.parse(fileName)
    const safeBaseName = parsed.name || '未命名文件'
    const suffix = splitMode === 'custom-ranges'
      ? `范围_${range.start}-${range.end}`
      : `第${String(index + 1).padStart(3, '0')}份_${range.start}-${range.end}`
    let candidate = path.join(outputDir, `${safeBaseName}_${suffix}.pdf`)
    let dedupeIndex = 1
    while (await fs.pathExists(candidate)) {
      candidate = path.join(outputDir, `${safeBaseName}_${suffix}_${dedupeIndex}.pdf`)
      dedupeIndex += 1
    }
    return candidate
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
