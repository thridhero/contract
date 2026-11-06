export const isCjkChar = (ch: string) => {
  const s = String(ch || '')
  if (!s) return false
  const cp = s.codePointAt(0)
  if (cp === undefined) return false
  if (cp === 0x3007) return true
  if (cp >= 0x3400 && cp <= 0x4dbf) return true
  if (cp >= 0x4e00 && cp <= 0x9fff) return true
  if (cp >= 0xf900 && cp <= 0xfaff) return true
  return false
}

export const extractCjkSegments = (text: string) => {
  const segments: string[] = []
  let buf = ''
  const s = String(text || '')
  for (let i = 0; i < s.length; i += 1) {
    const ch = s.charAt(i)
    if (isCjkChar(ch)) {
      buf += ch
      continue
    }
    if (buf) segments.push(buf)
    buf = ''
  }
  if (buf) segments.push(buf)
  return segments
}

export const buildCjkNgrams = (
  text: string,
  options?: { minN?: number; maxN?: number; maxTokens?: number; maxSegmentLen?: number }
) => {
  const minN = Number.isFinite(options?.minN as any) ? Math.max(1, Number(options?.minN)) : 2
  const maxN = Number.isFinite(options?.maxN as any) ? Math.max(minN, Number(options?.maxN)) : 3
  const maxTokens = Number.isFinite(options?.maxTokens as any) ? Math.max(1, Number(options?.maxTokens)) : 8000
  const maxSegmentLen = Number.isFinite(options?.maxSegmentLen as any) ? Math.max(8, Number(options?.maxSegmentLen)) : 2000

  const set = new Set<string>()
  const segments = extractCjkSegments(text)
  for (const raw of segments) {
    const seg = raw.length > maxSegmentLen ? raw.slice(0, maxSegmentLen) : raw
    for (let n = minN; n <= maxN; n += 1) {
      if (seg.length < n) continue
      for (let i = 0; i + n <= seg.length; i += 1) {
        set.add(seg.slice(i, i + n))
        if (set.size >= maxTokens) return Array.from(set)
      }
    }
  }
  return Array.from(set)
}

export const buildCjkTokensString = (text: string, options?: { maxTokens?: number }) => {
  const tokens = buildCjkNgrams(text, { minN: 2, maxN: 3, maxTokens: options?.maxTokens })
  return tokens.join(' ')
}

export const isSingleCjkQuery = (query: string) => {
  const q = String(query || '').trim()
  if (!q) return false
  const compact = q.replace(/\s+/g, '')
  if (compact.length !== 1) return false
  return isCjkChar(compact)
}

export const escapeFtsPhrase = (value: string) => {
  const v = String(value || '')
  const escaped = v.split('"').join('""')
  return `"${escaped}"`
}

export const buildCjkAwareMatchQuery = (query: string, options?: { maxTokens?: number }) => {
  const raw = String(query || '').trim()
  const parts = raw.split(/\s+/).map((p) => String(p || '').trim()).filter(Boolean)
  const maxTokens = Number.isFinite(options?.maxTokens as any) ? Math.max(8, Number(options?.maxTokens)) : 64

  const tokens: string[] = []
  for (const part of parts) {
    const cjkSegments = extractCjkSegments(part).filter((s) => s.length >= 2)
    if (cjkSegments.length > 0) {
      for (const seg of cjkSegments) {
        const grams = buildCjkNgrams(seg, { minN: 2, maxN: 3, maxTokens })
        for (const g of grams) {
          tokens.push(escapeFtsPhrase(g))
          if (tokens.length >= maxTokens) break
        }
        if (tokens.length >= maxTokens) break
      }
      if (tokens.length >= maxTokens) break
      continue
    }
    tokens.push(escapeFtsPhrase(part))
    if (tokens.length >= maxTokens) break
  }
  return tokens.join(' ')
}
