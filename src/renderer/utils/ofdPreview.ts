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

function normalizeText(value: string): string {
  return String(value || '')
    .replace(/\u00a0/g, ' ')
    .replace(/\r/g, '')
}

function parseXml(xmlText: string): Document | null {
  const xml = String(xmlText || '').trim()
  if (!xml) return null
  const parser = new DOMParser()
  const doc = parser.parseFromString(xml, 'application/xml')
  if (doc.querySelector('parsererror')) return null
  return doc
}

function collectOfdTextCodes(doc: Document): string[] {
  const out: string[] = []

  const walk = (node: Node) => {
    if (!(node instanceof Element)) {
      for (const child of Array.from(node.childNodes || [])) walk(child)
      return
    }

    const name = getElementLocalName(node)
    if (name === 'textcode' || name === 'text') {
      const attrText = getAttrByLocalName(node, 'text')
      const attrUnicode = getAttrByLocalName(node, 'unicode')
      const candidate = normalizeText(attrText || attrUnicode || node.textContent || '')
      const trimmed = candidate.replace(/\s+/g, ' ').trim()
      if (trimmed) out.push(trimmed)
    }

    for (const child of Array.from(node.childNodes || [])) walk(child)
  }

  walk(doc.documentElement)
  return out
}

async function readZipTextFiles(buffer: ArrayBuffer): Promise<Array<{ path: string; text: string }>> {
  const jszipModule: any = await import('jszip')
  const JSZip = jszipModule?.default || jszipModule
  const zip = await JSZip.loadAsync(buffer)

  const entries = Object.keys(zip.files || {})
  const targetPaths = entries
    .filter((p) => typeof p === 'string')
    .map((p) => String(p))
    .filter((p) => /\/Pages\/Page_\d+\/Content\.xml$/i.test(p) || /\/Document\.xml$/i.test(p))

  const items: Array<{ path: string; text: string }> = []
  for (const p of targetPaths) {
    const f = zip.file(p)
    if (!f) continue
    const text = await f.async('string')
    items.push({ path: p, text })
  }
  return items
}

function finalize(lines: string[]): string {
  return lines
    .map((s) => String(s || '').trim())
    .filter(Boolean)
    .join('\n\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export async function extractOfdPreviewText(buffer: ArrayBuffer): Promise<string> {
  try {
    const xmlFiles = await readZipTextFiles(buffer)
    if (xmlFiles.length === 0) return ''

    const all: string[] = []
    for (const item of xmlFiles) {
      const doc = parseXml(item.text)
      if (!doc) continue
      const parts = collectOfdTextCodes(doc)
      if (parts.length > 0) all.push(...parts)
    }

    const unique: string[] = []
    const seen = new Set<string>()
    for (const s of all) {
      const key = s
      if (!key) continue
      if (seen.has(key)) continue
      seen.add(key)
      unique.push(key)
    }

    return finalize(unique)
  } catch {
    return ''
  }
}
