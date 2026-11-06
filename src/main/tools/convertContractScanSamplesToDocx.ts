import * as path from 'path'
import * as fs from 'fs-extra'
import MarkdownIt from 'markdown-it'
import {
  AlignmentType,
  HeadingLevel,
  LevelFormat,
  Document,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from 'docx'

const PROJECT_ROOT = path.resolve(__dirname, '..', '..', '..')
const DEFAULT_INPUT_DIR = path.join(PROJECT_ROOT, 'resources', 'contract', 'contract-scan-sample-bundle')
const DEFAULT_OUTPUT_DIR = path.join(DEFAULT_INPUT_DIR, 'docx')

const markdown = new MarkdownIt({
  html: false,
  breaks: true,
  linkify: false,
  typographer: false,
})

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

const parseArgs = (argv: string[]) => {
  const args = new Map<string, string>()
  for (let i = 0; i < argv.length; i += 1) {
    const raw = argv[i]
    if (!raw.startsWith('--')) continue
    const key = raw.slice(2)
    const next = argv[i + 1]
    if (next && !next.startsWith('--')) {
      args.set(key, next)
      i += 1
    } else {
      args.set(key, 'true')
    }
  }
  return args
}

const compactText = (value: unknown) => String(value == null ? '' : value).replace(/\s+/g, ' ').trim()

const tokenInlineText = (token: MdToken): string => {
  if (token.type === 'inline' && Array.isArray(token.children)) {
    return compactText(token.children.map((child) => child.content || '').join(' '))
  }
  return compactText(token.content || '')
}

const buildRunsFromInline = (token: MdToken): TextRun[] => {
  const children = token.type === 'inline' && Array.isArray(token.children) ? token.children : []
  const runs: TextRun[] = []
  let bold = false
  let italics = false

  const pushText = (text: string, opts?: { code?: boolean }) => {
    if (!text) return
    runs.push(
      new TextRun({
        text,
        bold,
        italics,
        font: opts?.code ? 'Consolas' : undefined,
      }),
    )
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
    if (child.type === 'link_open' || child.type === 'link_close') {
      continue
    }
    if (child.type === 'image') {
      const alt = compactText(child.content || child.attrGet('alt') || '')
      pushText(alt ? `[${alt}]` : '[图片]')
      continue
    }
  }

  return runs.length > 0 ? runs : [new TextRun({ text: tokenInlineText(token) })]
}

const buildHeading = (level: number, runs: TextRun[]) => {
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

const NUMBERING_OPTIONS = {
  config: [
    {
      reference: 'contract-scan-numbering',
      levels: [
        { level: 0, format: LevelFormat.DECIMAL, text: '%1.', alignment: AlignmentType.LEFT },
        { level: 1, format: LevelFormat.DECIMAL, text: '%2.', alignment: AlignmentType.LEFT },
        { level: 2, format: LevelFormat.DECIMAL, text: '%3.', alignment: AlignmentType.LEFT },
      ],
    },
  ],
} as const

const consumeTable = (tokens: MdToken[], startIndex: number): { node: Table; nextIndex: number } => {
  const rows: Array<{ cells: { text: string; isHeader: boolean }[] }> = []
  let currentRow: { cells: { text: string; isHeader: boolean }[] } | null = null
  let inHeader = false
  let i = startIndex

  for (; i < tokens.length; i += 1) {
    const token = tokens[i]
    if (token.type === 'thead_open') {
      inHeader = true
      continue
    }
    if (token.type === 'thead_close') {
      inHeader = false
      continue
    }
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
      const text = cellToken ? tokenInlineText(cellToken) : ''
      currentRow?.cells.push({ text, isHeader: inHeader || token.type === 'th_open' })
      continue
    }
    if (token.type === 'table_close') break
  }

  const tableRows = rows.map((row) => {
    return new TableRow({
      children: row.cells.map((cell) => {
        return new TableCell({
          width: { size: 100 / Math.max(1, row.cells.length), type: WidthType.PERCENTAGE },
          children: [
            new Paragraph({
              children: [new TextRun({ text: cell.text })],
            }),
          ],
        })
      }),
    })
  })

  const node = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: tableRows,
  })

  return { node, nextIndex: i }
}

const markdownToDocx = (markdownText: string) => {
  const tokens = markdown.parse(markdownText, {})
  const children: Array<Paragraph | Table> = []
  const listStack: ListContext[] = []
  let inBlockquote = false

  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i]

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
      const inline = tokens[i + 1]
      const runs = inline ? buildRunsFromInline(inline) : [new TextRun({ text: '' })]
      children.push(buildHeading(level, runs))
      continue
    }

    if (token.type === 'paragraph_open') {
      const inline = tokens[i + 1]
      const runs = inline ? buildRunsFromInline(inline) : [new TextRun({ text: '' })]
      const listCtx = listStack[listStack.length - 1]
      const paragraph = new Paragraph({
        children: runs,
        indent: inBlockquote ? { left: 720 } : undefined,
        bullet: listCtx?.type === 'bullet' ? { level: Math.min(8, listCtx.level) } : undefined,
        numbering: listCtx?.type === 'ordered'
          ? { reference: 'contract-scan-numbering', level: Math.min(2, listCtx.level) }
          : undefined,
      })
      children.push(paragraph)
      continue
    }

    if (token.type === 'fence' || token.type === 'code_block') {
      const text = String(token.content || '').replace(/\n$/, '')
      children.push(
        new Paragraph({
          indent: { left: 720 },
          children: [
            new TextRun({ text, font: 'Consolas' }),
          ],
        }),
      )
      continue
    }

    if (token.type === 'table_open') {
      const { node, nextIndex } = consumeTable(tokens, i)
      children.push(node)
      i = nextIndex
      continue
    }
  }

  return new Document({
    numbering: NUMBERING_OPTIONS,
    sections: [
      {
        properties: {},
        children,
      },
    ],
  })
}

const resolveMdFiles = async (inputDir: string) => {
  const entries = await fs.readdir(inputDir)
  return entries
    .filter((name) => name.toLowerCase().endsWith('.md'))
    .filter((name) => name.toLowerCase().startsWith('contract_scan_'))
    .map((name) => path.join(inputDir, name))
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const inputDir = path.resolve(args.get('input') || DEFAULT_INPUT_DIR)
  const outputDir = path.resolve(args.get('output') || DEFAULT_OUTPUT_DIR)

  await fs.ensureDir(outputDir)
  const mdFiles = await resolveMdFiles(inputDir)
  if (mdFiles.length === 0) {
    throw new Error(`未找到可转换的 Markdown 合同文件: ${inputDir}`)
  }

  for (const mdPath of mdFiles) {
    const markdownText = await fs.readFile(mdPath, 'utf-8')
    const doc = markdownToDocx(markdownText)
    const baseName = path.basename(mdPath, path.extname(mdPath))
    const outPath = path.join(outputDir, `${baseName}.docx`)
    const buffer = await Packer.toBuffer(doc)
    await fs.writeFile(outPath, buffer)
  }
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
  process.exit(1)
})
