import { shell } from 'electron'
import { spawn } from 'child_process'
import * as crypto from 'crypto'
import * as fs from 'fs-extra'
import * as os from 'os'
import * as path from 'path'
import MarkdownIt from 'markdown-it'
import {
  AlignmentType,
  Document,
  HeadingLevel,
  LevelFormat,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from 'docx'
import type {
  ConvertPdfToWordRequest,
  ConvertPdfToWordResult,
  PdfToWordGeneratedFile,
} from '../../../shared/types/toolbox.types'

const markdown = new MarkdownIt({
  html: false,
  breaks: true,
  linkify: false,
  typographer: false,
})

const NUMBERING_OPTIONS = {
  config: [
    {
      reference: 'mineru-numbering',
      levels: [
        { level: 0, format: LevelFormat.DECIMAL, text: '%1.', alignment: AlignmentType.LEFT },
        { level: 1, format: LevelFormat.DECIMAL, text: '%2.', alignment: AlignmentType.LEFT },
        { level: 2, format: LevelFormat.DECIMAL, text: '%3.', alignment: AlignmentType.LEFT },
      ],
    },
  ],
} as const

const MINERU_TIMEOUT_MS = 10 * 60 * 1000
const MINERU_EXECUTABLE_CANDIDATES = [
  'run-mineru.cmd',
  'run-mineru.bat',
  'mineru.exe',
  'magic-pdf.exe',
  'mineru.cmd',
  'magic-pdf.cmd',
  'mineru.bat',
  'magic-pdf.bat',
  path.join('bin', 'mineru.exe'),
  path.join('bin', 'magic-pdf.exe'),
  path.join('Scripts', 'mineru.exe'),
  path.join('Scripts', 'magic-pdf.exe'),
]

type MdToken = {
  type: string
  tag: string
  content: string
  children?: MdToken[]
  attrGet?: (name: string) => string | null
}

type ListContext = {
  type: 'bullet' | 'ordered'
  level: number
}

type MineruRuntimeInfo = {
  executablePath: string
  workingDirectory: string
  version: string
  commandArgsPrefix: string[]
}

const logger = {
  warn: (...args: unknown[]) => {
    try {
      console.warn('[MineruPdfToWordService]', ...args)
    } catch {
      // noop
    }
  },
}

export class MineruPdfToWordService {
  private static instance: MineruPdfToWordService

  private constructor() {}

  public static getInstance(): MineruPdfToWordService {
    if (!MineruPdfToWordService.instance) {
      MineruPdfToWordService.instance = new MineruPdfToWordService()
    }
    return MineruPdfToWordService.instance
  }

  public async convertPdfToWord(request: ConvertPdfToWordRequest): Promise<ConvertPdfToWordResult> {
    const outputDir = path.resolve(String(request.outputDir || '').trim())
    if (!outputDir) {
      throw new Error('输出目录不能为空')
    }

    const files = Array.isArray(request.files) ? request.files : []
    if (files.length === 0) {
      throw new Error('请至少选择一个 PDF 文件')
    }

    const runtime = await this.resolveRuntime()
    await fs.ensureDir(outputDir)

    const generatedFiles: PdfToWordGeneratedFile[] = []
    const tempRoot = await fs.mkdtemp(path.join(this.getTempRootDir(), 'mineru-'))

    try {
      for (const item of files) {
        const sourcePath = path.resolve(String(item.path || '').trim())
        await this.assertPdfFile(sourcePath)

        const runDir = path.join(tempRoot, crypto.createHash('sha1').update(sourcePath).digest('hex'))
        await fs.ensureDir(runDir)

        await this.executeMineru(runtime, sourcePath, runDir)
        const markdownPath = await this.findGeneratedMarkdown(runDir, sourcePath)
        const markdownText = await fs.readFile(markdownPath, 'utf-8')

        if (!String(markdownText || '').trim()) {
          throw new Error(`MinerU 未产出可用 Markdown: ${path.basename(sourcePath)}`)
        }

        const outputPath = await this.resolveOutputPath(outputDir, sourcePath)
        const document = this.markdownToDocx(markdownText, path.basename(sourcePath))
        const buffer = await Packer.toBuffer(document)
        await fs.writeFile(outputPath, buffer)
        const stat = await fs.stat(outputPath)

        generatedFiles.push({
          sourcePath,
          sourceName: path.basename(sourcePath),
          outputPath,
          fileSize: Number(stat.size || 0),
          markdownPath,
          pageCount: Number(item.pageCount || 0),
        })
      }
    } finally {
      await fs.remove(tempRoot)
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
      runtimeVersion: runtime.version,
    }
  }

  private async resolveRuntime(): Promise<MineruRuntimeInfo> {
    const envExecutablePath = String(process.env.MINERU_EXECUTABLE || '').trim()
    const envWorkingDirectory = String(process.env.MINERU_WORKDIR || '').trim()
    const envVersion = String(process.env.MINERU_VERSION || '').trim()

    if (envExecutablePath) {
      const runtime: MineruRuntimeInfo = {
        executablePath: envExecutablePath,
        workingDirectory: envWorkingDirectory || path.dirname(envExecutablePath),
        version: envVersion || 'env-override',
        commandArgsPrefix: this.getEnvCommandArgsPrefix(),
      }
      await this.assertRuntimeUsable(runtime)
      if (!envVersion) {
        runtime.version = await this.buildRuntimeVersion(envExecutablePath)
      }
      return runtime
    }

    for (const runtimeDir of this.getBundledRuntimeCandidateDirs()) {
      const executablePath = this.resolveBundledExecutable(runtimeDir)
      if (!executablePath) {
        continue
      }
      const runtime: MineruRuntimeInfo = {
        executablePath,
        workingDirectory: runtimeDir,
        version: await this.readRuntimeVersion(runtimeDir, executablePath),
        commandArgsPrefix: [],
      }
      await this.assertRuntimeUsable(runtime)
      return runtime
    }

    throw new Error(
      `未找到内置 MinerU 运行时，请将可执行程序放入 ${path.join('resources', 'mineru')}，或通过 MINERU_EXECUTABLE 指定路径`,
    )
  }

  private async executeMineru(runtime: MineruRuntimeInfo, inputPath: string, outputDir: string): Promise<void> {
    const command = runtime.executablePath
    const candidates = this.buildCommandCandidates(inputPath, outputDir)
    let lastError: Error | null = null

    for (const args of candidates) {
      try {
        const result = await this.spawnCommand(command, [...runtime.commandArgsPrefix, ...args], runtime.workingDirectory)
        const hasMarkdown = await this.hasGeneratedMarkdown(outputDir)
        if (!hasMarkdown) {
          throw new Error(result.stderr.trim() || result.stdout.trim() || 'MinerU 未生成 Markdown 输出')
        }
        return
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error))
      }
    }

    throw new Error(`MinerU 执行失败: ${lastError?.message || path.basename(inputPath)}`)
  }

  private buildCommandCandidates(inputPath: string, outputDir: string): string[][] {
    const input = path.resolve(inputPath)
    const output = path.resolve(outputDir)
    return [
      ['-p', input, '-o', output],
      ['-p', input, '-o', output, '-m', 'auto'],
      ['-i', input, '-o', output],
      ['-i', input, '-o', output, '-m', 'auto'],
    ]
  }

  private async spawnCommand(
    command: string,
    args: string[],
    cwd: string,
  ): Promise<{ stdout: string; stderr: string }> {
    return await new Promise((resolve, reject) => {
      const child = spawn(command, args, {
        cwd,
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true,
      })

      const stdoutChunks: Buffer[] = []
      const stderrChunks: Buffer[] = []
      let timedOut = false

      const timer = setTimeout(() => {
        timedOut = true
        child.kill()
      }, this.getTimeoutMs())

      child.stdout.on('data', (chunk: Buffer | string) => {
        stdoutChunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
      })
      child.stderr.on('data', (chunk: Buffer | string) => {
        stderrChunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
      })
      child.on('error', (error) => {
        clearTimeout(timer)
        reject(new Error(`启动 MinerU 失败: ${error instanceof Error ? error.message : String(error)}`))
      })
      child.on('close', (code) => {
        clearTimeout(timer)
        const stdout = Buffer.concat(stdoutChunks).toString('utf-8')
        const stderr = Buffer.concat(stderrChunks).toString('utf-8')
        if (timedOut) {
          reject(new Error(`MinerU 执行超时: ${path.basename(command)}`))
          return
        }
        if (code !== 0) {
          reject(new Error(stderr.trim() || stdout.trim() || `MinerU 退出码异常: ${code}`))
          return
        }
        resolve({ stdout, stderr })
      })
    })
  }

  private async findGeneratedMarkdown(outputDir: string, sourcePath: string): Promise<string> {
    const markdownFiles = await this.collectFilesByExtension(outputDir, '.md')
    if (markdownFiles.length === 0) {
      throw new Error(`MinerU 未生成 Markdown 文件: ${path.basename(sourcePath)}`)
    }

    const sourceBaseName = path.parse(sourcePath).name.toLowerCase()
    const exactMatch = markdownFiles.find(filePath => path.parse(filePath).name.toLowerCase() === sourceBaseName)
    if (exactMatch) {
      return exactMatch
    }

    const newest = await this.findNewestFile(markdownFiles)
    return newest || markdownFiles[0]
  }

  private async hasGeneratedMarkdown(outputDir: string): Promise<boolean> {
    const markdownFiles = await this.collectFilesByExtension(outputDir, '.md')
    return markdownFiles.length > 0
  }

  private async collectFilesByExtension(rootDir: string, extension: string): Promise<string[]> {
    if (!await fs.pathExists(rootDir)) {
      return []
    }
    const results: string[] = []
    const targetExt = extension.toLowerCase()
    const walk = async (currentDir: string): Promise<void> => {
      const entries = await fs.readdir(currentDir, { withFileTypes: true })
      for (const entry of entries) {
        const absolutePath = path.join(currentDir, entry.name)
        if (entry.isDirectory()) {
          await walk(absolutePath)
          continue
        }
        if (entry.isFile() && path.extname(entry.name).toLowerCase() === targetExt) {
          results.push(absolutePath)
        }
      }
    }
    await walk(rootDir)
    return results
  }

  private async findNewestFile(filePaths: string[]): Promise<string | null> {
    let newestPath = ''
    let newestMtime = -1
    for (const filePath of filePaths) {
      const stat = await fs.stat(filePath)
      const mtime = Number(stat.mtimeMs || 0)
      if (mtime > newestMtime) {
        newestMtime = mtime
        newestPath = filePath
      }
    }
    return newestPath || null
  }

  private async resolveOutputPath(outputDir: string, sourcePath: string): Promise<string> {
    const safeBaseName = path.parse(sourcePath).name || '未命名文件'
    let candidate = path.join(outputDir, `${safeBaseName}.docx`)
    let dedupeIndex = 1
    while (await fs.pathExists(candidate)) {
      candidate = path.join(outputDir, `${safeBaseName}_${dedupeIndex}.docx`)
      dedupeIndex += 1
    }
    return candidate
  }

  private markdownToDocx(markdownText: string, documentTitle: string): Document {
    const tokens = markdown.parse(markdownText, {})
    const children: Array<Paragraph | Table> = [
      new Paragraph({
        heading: HeadingLevel.TITLE,
        children: [new TextRun(documentTitle)],
      }),
      new Paragraph({
        children: [new TextRun(`转换时间：${new Date().toLocaleString('zh-CN', { hour12: false })}`)],
      }),
      new Paragraph({ text: '' }),
    ]
    const listStack: ListContext[] = []
    let inBlockquote = false

    for (let i = 0; i < tokens.length; i += 1) {
      const token = tokens[i] as MdToken

      if (token.type === 'blockquote_open') {
        inBlockquote = true
        continue
      }
      if (token.type === 'blockquote_close') {
        inBlockquote = false
        continue
      }
      if (token.type === 'bullet_list_open') {
        listStack.push({ type: 'bullet', level: listStack.length })
        continue
      }
      if (token.type === 'bullet_list_close') {
        listStack.pop()
        continue
      }
      if (token.type === 'ordered_list_open') {
        listStack.push({ type: 'ordered', level: listStack.length })
        continue
      }
      if (token.type === 'ordered_list_close') {
        listStack.pop()
        continue
      }
      if (token.type === 'heading_open') {
        const level = Number(token.tag.replace('h', '')) || 1
        const inline = tokens[i + 1] as MdToken | undefined
        const runs = inline ? this.buildRunsFromInline(inline) : [new TextRun({ text: '' })]
        children.push(this.buildHeading(level, runs))
        continue
      }
      if (token.type === 'paragraph_open') {
        const inline = tokens[i + 1] as MdToken | undefined
        const runs = inline ? this.buildRunsFromInline(inline) : [new TextRun({ text: '' })]
        const listCtx = listStack[listStack.length - 1]
        children.push(new Paragraph({
          children: runs,
          indent: inBlockquote ? { left: 720 } : undefined,
          bullet: listCtx?.type === 'bullet' ? { level: Math.min(8, listCtx.level) } : undefined,
          numbering: listCtx?.type === 'ordered'
            ? { reference: 'mineru-numbering', level: Math.min(2, listCtx.level) }
            : undefined,
        }))
        continue
      }
      if (token.type === 'fence' || token.type === 'code_block') {
        const text = String(token.content || '').replace(/\n$/, '')
        children.push(new Paragraph({
          indent: { left: 720 },
          children: [new TextRun({ text, font: 'Consolas' })],
        }))
        continue
      }
      if (token.type === 'table_open') {
        const { node, nextIndex } = this.consumeTable(tokens as MdToken[], i)
        children.push(node)
        i = nextIndex
      }
    }

    return new Document({
      numbering: NUMBERING_OPTIONS,
      sections: [{ properties: {}, children }],
    })
  }

  private buildRunsFromInline(token: MdToken): TextRun[] {
    const children = token.type === 'inline' && Array.isArray(token.children) ? token.children : []
    const runs: TextRun[] = []
    let bold = false
    let italics = false

    const pushText = (text: string, opts?: { code?: boolean }) => {
      if (!text) return
      runs.push(new TextRun({
        text,
        bold,
        italics,
        font: opts?.code ? 'Consolas' : undefined,
      }))
    }

    const pushBreak = () => {
      runs.push(new TextRun({ text: '', break: 1 }))
    }

    for (const child of children) {
      if (child.type === 'text') {
        pushText(child.content || '')
        continue
      }
      if (child.type === 'strong_open') {
        bold = true
        continue
      }
      if (child.type === 'strong_close') {
        bold = false
        continue
      }
      if (child.type === 'em_open') {
        italics = true
        continue
      }
      if (child.type === 'em_close') {
        italics = false
        continue
      }
      if (child.type === 'code_inline') {
        pushText(child.content || '', { code: true })
        continue
      }
      if (child.type === 'hardbreak') {
        pushBreak()
        continue
      }
      if (child.type === 'softbreak') {
        pushText(' ')
        continue
      }
      if (child.type === 'image') {
        const alt = this.compactText(child.content || child.attrGet?.('alt') || '')
        pushText(alt ? `[图片] ${alt}` : '[图片]')
      }
    }

    return runs.length > 0 ? runs : [new TextRun({ text: this.tokenInlineText(token) })]
  }

  private buildHeading(level: number, runs: TextRun[]): Paragraph {
    const heading = [
      HeadingLevel.HEADING_1,
      HeadingLevel.HEADING_2,
      HeadingLevel.HEADING_3,
      HeadingLevel.HEADING_4,
      HeadingLevel.HEADING_5,
      HeadingLevel.HEADING_6,
    ][Math.max(0, Math.min(5, level - 1))]

    return new Paragraph({ heading, children: runs })
  }

  private consumeTable(tokens: MdToken[], startIndex: number): { node: Table; nextIndex: number } {
    const rows: Array<{ cells: { text: string }[] }> = []
    let currentRow: { cells: { text: string }[] } | null = null
    let i = startIndex

    for (; i < tokens.length; i += 1) {
      const token = tokens[i]
      if (token.type === 'tr_open') {
        currentRow = { cells: [] }
        continue
      }
      if (token.type === 'tr_close') {
        if (currentRow) rows.push(currentRow)
        currentRow = null
        continue
      }
      if (token.type === 'th_open' || token.type === 'td_open') {
        const cellToken = tokens[i + 1]
        currentRow?.cells.push({ text: cellToken ? this.tokenInlineText(cellToken) : '' })
        continue
      }
      if (token.type === 'table_close') {
        break
      }
    }

    const tableRows = rows.map((row) => new TableRow({
      children: row.cells.map((cell) => new TableCell({
        width: { size: 100 / Math.max(1, row.cells.length), type: WidthType.PERCENTAGE },
        children: [
          new Paragraph({
            children: [new TextRun({ text: cell.text })],
          }),
        ],
      })),
    }))

    return {
      node: new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: tableRows,
      }),
      nextIndex: i,
    }
  }

  private tokenInlineText(token: MdToken): string {
    if (token.type === 'inline' && Array.isArray(token.children)) {
      return this.compactText(token.children.map(child => child.content || '').join(' '))
    }
    return this.compactText(token.content || '')
  }

  private compactText(value: unknown): string {
    return String(value == null ? '' : value).replace(/\s+/g, ' ').trim()
  }

  private async assertRuntimeUsable(runtime: MineruRuntimeInfo): Promise<void> {
    if (!(await fs.pathExists(runtime.executablePath))) {
      throw new Error(`未找到 MinerU 可执行文件: ${runtime.executablePath}`)
    }
  }

  private getBundledRuntimeCandidateDirs(): string[] {
    const projectRootPath = this.getProjectRootPath()
    const packagedBase = process.resourcesPath
      ? path.join(process.resourcesPath, 'mineru')
      : ''
    const cwdBase = path.join(process.cwd(), 'resources', 'mineru')
    return [packagedBase, cwdBase, path.join(projectRootPath, 'resources', 'mineru')]
      .map(item => String(item || '').trim())
      .filter(Boolean)
  }

  private resolveBundledExecutable(runtimeDir: string): string | null {
    for (const candidate of MINERU_EXECUTABLE_CANDIDATES) {
      const absolutePath = path.join(runtimeDir, candidate)
      if (fs.existsSync(absolutePath)) {
        return absolutePath
      }
    }
    return null
  }

  private async readRuntimeVersion(runtimeDir: string, executablePath: string): Promise<string> {
    const versionFile = path.join(runtimeDir, 'version.txt')
    if (await fs.pathExists(versionFile)) {
      const version = (await fs.readFile(versionFile, 'utf-8')).trim()
      if (version) {
        return version
      }
    }
    return await this.buildRuntimeVersion(executablePath)
  }

  private async buildRuntimeVersion(executablePath: string): Promise<string> {
    const stat = await fs.stat(executablePath)
    return `${path.basename(executablePath)}:${stat.size}:${Number(stat.mtimeMs)}`
  }

  private getEnvCommandArgsPrefix(): string[] {
    const raw = String(process.env.MINERU_EXECUTABLE_ARGS || '').trim()
    if (!raw) {
      return []
    }
    try {
      const parsed = JSON.parse(raw) as unknown
      if (!Array.isArray(parsed)) {
        throw new Error('参数必须为数组')
      }
      return parsed.map(item => String(item))
    } catch (error) {
      throw new Error(`解析 MINERU_EXECUTABLE_ARGS 失败: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  private getProjectRootPath(): string {
    try {
      const electronModule = require('electron') as { app?: { getAppPath?: () => string; isPackaged?: boolean } }
      const appPath = electronModule?.app?.getAppPath?.()
      if (appPath && electronModule?.app?.isPackaged) {
        return appPath.replace(/app\.asar([\\/]|$)/, 'app.asar.unpacked$1')
      }
    } catch {
      // noop
    }
    return path.resolve(process.cwd())
  }

  private getTempRootDir(): string {
    const userData = this.getUserDataPath()
    return path.join(userData, 'mineru-runtime')
  }

  private getUserDataPath(): string {
    try {
      const electronModule = require('electron') as { app?: { getPath?: (name: string) => string } }
      return electronModule?.app?.getPath?.('userData') || path.join(os.tmpdir(), 'software-registration-manager')
    } catch {
      return path.join(os.tmpdir(), 'software-registration-manager')
    }
  }

  private getTimeoutMs(): number {
    const envValue = Number(process.env.MINERU_TIMEOUT_MS || 0)
    if (Number.isFinite(envValue) && envValue > 0) {
      return envValue
    }
    return MINERU_TIMEOUT_MS
  }

  private async assertPdfFile(filePath: string): Promise<void> {
    if (!filePath) {
      throw new Error('PDF 路径不能为空')
    }
    if (path.extname(filePath).toLowerCase() !== '.pdf') {
      throw new Error(`仅支持 PDF 文件: ${filePath}`)
    }
    if (!await fs.pathExists(filePath)) {
      throw new Error(`文件不存在: ${filePath}`)
    }
    const stat = await fs.stat(filePath)
    if (!stat.isFile()) {
      throw new Error(`不是有效文件: ${filePath}`)
    }
  }
}
