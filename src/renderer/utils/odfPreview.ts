const ODF_SPREADSHEET_EXTENSIONS = new Set([
  'ods',
  'fods',
  'ots',
])

const ODF_TEXT_PREVIEW_EXTENSIONS = new Set([
  'odt',
  'fodt',
  'ott',
  'odm',
  'oth',
  'odg',
  'otg',
  'odp',
  'fodp',
  'otp',
  'odf',
])

export function isOdfSpreadsheetExtension(ext: string): boolean {
  return ODF_SPREADSHEET_EXTENSIONS.has(String(ext || '').trim().toLowerCase())
}

export function isOdfTextPreviewExtension(ext: string): boolean {
  return ODF_TEXT_PREVIEW_EXTENSIONS.has(String(ext || '').trim().toLowerCase())
}

export function isOdfPreviewExtension(ext: string): boolean {
  return isOdfSpreadsheetExtension(ext) || isOdfTextPreviewExtension(ext)
}

function getElementLocalName(node: Node | null | undefined): string {
  if (!(node instanceof Element)) return ''
  return String(node.localName || node.nodeName || '').toLowerCase()
}

function getAttrByLocalName(element: Element, localName: string): string {
  const target = String(localName || '').trim().toLowerCase()
  if (!target) return ''

  for (const attr of Array.from(element.attributes || [])) {
    const name = String(attr.localName || attr.name || '').toLowerCase()
    if (name === target) return String(attr.value || '')
  }

  return ''
}

function normalizeInlineText(value: string): string {
  return String(value || '')
    .replace(/\u00a0/g, ' ')
    .replace(/\r/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n[ \t]+/g, '\n')
}

function normalizeBlockText(value: string): string {
  return normalizeInlineText(value)
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join('\n')
}

function collectInlineText(node: Node | null | undefined): string {
  if (!node) return ''

  if (node.nodeType === Node.TEXT_NODE) {
    return String(node.nodeValue || '')
  }

  if (!(node instanceof Element)) {
    return ''
  }

  const name = getElementLocalName(node)
  if (name === 's') {
    const count = Math.max(1, Number.parseInt(getAttrByLocalName(node, 'c') || '1', 10) || 1)
    return ' '.repeat(count)
  }
  if (name === 'tab') {
    return '\t'
  }
  if (name === 'line-break') {
    return '\n'
  }

  return Array.from(node.childNodes || [])
    .map((child) => collectInlineText(child))
    .join('')
}

function pushLine(lines: string[], value: string): void {
  const text = normalizeBlockText(value)
  if (!text) return
  lines.push(text)
}

function pushTableRow(lines: string[], row: Element): void {
  const cells = Array.from(row.children || [])
    .filter((child) => {
      const name = getElementLocalName(child)
      return name === 'table-cell' || name === 'covered-table-cell'
    })
    .map((cell) => normalizeBlockText(collectInlineText(cell)).replace(/\n+/g, ' / '))

  if (cells.length === 0) return
  if (!cells.some((cell) => cell !== '')) return
  lines.push(`| ${cells.join(' | ')} |`)
}

function walkOdfNode(node: Node, lines: string[], state: { page: number }): void {
  if (!(node instanceof Element)) return

  const name = getElementLocalName(node)

  if (name === 'page') {
    state.page += 1
    const pageName = normalizeBlockText(getAttrByLocalName(node, 'name'))
    lines.push(`## 幻灯片 ${state.page}${pageName ? ` ${pageName}` : ''}`)
    for (const child of Array.from(node.childNodes || [])) {
      walkOdfNode(child, lines, state)
    }
    return
  }

  if (name === 'table') {
    const tableName = normalizeBlockText(getAttrByLocalName(node, 'name'))
    if (tableName) {
      lines.push(`## ${tableName}`)
    }
    for (const child of Array.from(node.childNodes || [])) {
      walkOdfNode(child, lines, state)
    }
    return
  }

  if (name === 'table-row') {
    pushTableRow(lines, node)
    return
  }

  if (name === 'list-item') {
    pushLine(lines, `- ${collectInlineText(node)}`)
    return
  }

  if (name === 'h') {
    pushLine(lines, `## ${collectInlineText(node)}`)
    return
  }

  if (name === 'p') {
    pushLine(lines, collectInlineText(node))
    return
  }

  for (const child of Array.from(node.childNodes || [])) {
    walkOdfNode(child, lines, state)
  }
}

function finalizePreviewText(lines: string[]): string {
  return lines
    .map((line) => String(line || '').trim())
    .filter(Boolean)
    .join('\n\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function parseOdfXmlText(xmlText: string): string {
  const xml = String(xmlText || '').trim()
  if (!xml) return ''

  const parser = new DOMParser()
  const doc = parser.parseFromString(xml, 'application/xml')
  if (doc.querySelector('parsererror')) {
    return ''
  }

  const lines: string[] = []
  const state = { page: 0 }
  walkOdfNode(doc.documentElement, lines, state)
  return finalizePreviewText(lines)
}

async function readZippedOdfContentXml(buffer: ArrayBuffer): Promise<string> {
  const jszipModule: any = await import('jszip')
  const JSZip = jszipModule?.default || jszipModule
  const zip = await JSZip.loadAsync(buffer)
  const contentFile = zip.file('content.xml')
  if (!contentFile) return ''
  return await contentFile.async('string')
}

export async function extractOdfPreviewText(buffer: ArrayBuffer, ext: string): Promise<string> {
  const lowerExt = String(ext || '').trim().toLowerCase()
  if (!isOdfTextPreviewExtension(lowerExt)) {
    return ''
  }

  try {
    const xmlText = lowerExt.startsWith('fod')
      ? new TextDecoder('utf-8').decode(buffer)
      : await readZippedOdfContentXml(buffer)

    return parseOdfXmlText(xmlText)
  } catch {
    return ''
  }
}
