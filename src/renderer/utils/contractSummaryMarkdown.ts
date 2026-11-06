import DOMPurify from 'dompurify'
import MarkdownIt from 'markdown-it'
import TurndownService from 'turndown'
import { htmlToPlainText } from '../../shared/utils/contractFormSchema'

const markdown = new MarkdownIt({
  html: false,
  breaks: true,
  linkify: true,
})

const turndown = new TurndownService({
  headingStyle: 'atx',
  bulletListMarker: '-',
  codeBlockStyle: 'fenced',
})

const normalizeCellText = (value: string) => String(value || '')
  .replace(/\r?\n+/g, ' ')
  .replace(/\|/g, '\\|')
  .trim()

const escapeTableCell = (value: string) => normalizeCellText(value) || '-'

const buildMarkdownTableFromElement = (table: HTMLTableElement): string => {
  const rows = Array.from(table.querySelectorAll('tr'))
    .map((row) => Array.from(row.children)
      .filter((cell): cell is HTMLTableCellElement => cell instanceof HTMLTableCellElement)
      .map((cell) => escapeTableCell(cell.textContent || '')))
    .filter((cells) => cells.length > 0)

  if (rows.length === 0) return ''

  const header = rows[0]
  const body = rows.slice(1)
  const separator = header.map(() => '---')
  const tableLines = [
    `| ${header.join(' | ')} |`,
    `| ${separator.join(' | ')} |`,
    ...body.map((cells) => {
      const normalized = header.map((_, index) => cells[index] || '-')
      return `| ${normalized.join(' | ')} |`
    }),
  ]
  return tableLines.join('\n')
}

turndown.addRule('tableToMarkdown', {
  filter: ['table'],
  replacement: (_content, node) => {
    if (!(node instanceof HTMLTableElement)) return '\n\n'
    const markdownTable = buildMarkdownTableFromElement(node)
    return markdownTable ? `\n\n${markdownTable}\n\n` : '\n\n'
  },
})

const normalizeMarkdownWhitespace = (value: string): string => {
  return String(value || '')
    .replace(/\r/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

const looksLikeHtml = (value: string): boolean => /<\/?[a-z][\s\S]*>/i.test(String(value || '').trim())

const sanitizeHtml = (value: string): string => DOMPurify.sanitize(String(value || '').trim())

const htmlToMarkdown = (value: string): string => {
  const sanitized = sanitizeHtml(value)
  if (!htmlToPlainText(sanitized)) return ''
  return normalizeMarkdownWhitespace(turndown.turndown(sanitized))
}

export const normalizeStoredContractSummaryToMarkdown = (value: unknown): string => {
  const text = String(value || '').trim()
  if (!text) return ''
  if (looksLikeHtml(text)) {
    return htmlToMarkdown(text)
  }
  return normalizeMarkdownWhitespace(text)
}

export const contractSummaryMarkdownToEditorHtml = (value: unknown): string => {
  const markdownText = normalizeStoredContractSummaryToMarkdown(value)
  if (!markdownText) return ''
  return sanitizeHtml(markdown.render(markdownText))
}

export const contractSummaryEditorHtmlToMarkdown = (value: unknown): string => {
  const html = String(value || '').trim()
  if (!html) return ''
  return htmlToMarkdown(html)
}

export const renderContractSummaryToHtml = (value: unknown): string => {
  const markdownText = normalizeStoredContractSummaryToMarkdown(value)
  if (!markdownText) return ''
  return sanitizeHtml(markdown.render(markdownText))
}
