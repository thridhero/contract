export const normalizePathForCompare = (p: string) => String(p || '').replace(/\\/g, '/').replace(/\/+$/g, '')

export const joinPath = (base: string, ...parts: string[]) => {
  const sep = base.includes('\\') ? '\\' : '/'
  const normalizedBase = String(base || '').replace(/[\\/]+$/g, '')
  const normalizedParts = parts.map((p) => String(p || '').replace(/^[\\/]+/g, '').replace(/[\\/]+$/g, '')).filter(Boolean)
  return [normalizedBase, ...normalizedParts].join(sep)
}

export const getRelativeParts = (abs: string, root: string) => {
  const nAbs = normalizePathForCompare(abs)
  const nRoot = normalizePathForCompare(root)
  if (!nAbs.startsWith(nRoot)) return []
  const rel = nAbs.slice(nRoot.length).replace(/^\/+/g, '')
  return rel ? rel.split('/').filter(Boolean) : []
}

export const dirname = (p: string) => {
  const s = String(p || '')
  const idx1 = s.lastIndexOf('/')
  const idx2 = s.lastIndexOf('\\')
  const idx = Math.max(idx1, idx2)
  if (idx <= 0) return s
  return s.slice(0, idx)
}

export const formatSize = (size: number | null) => {
  if (size === null || size === undefined) return '-'
  if (size < 1024) return `${size} B`
  const kb = size / 1024
  if (kb < 1024) return `${kb.toFixed(1)} KB`
  const mb = kb / 1024
  if (mb < 1024) return `${mb.toFixed(1)} MB`
  const gb = mb / 1024
  return `${gb.toFixed(1)} GB`
}

export const formatTime = (mtime: number | null) => {
  if (!mtime) return '-'
  const d = new Date(mtime)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export const formatDbTime = (v: string | null | undefined) => {
  const s = String(v || '').trim()
  if (!s) return '-'
  if (s.includes('T')) {
    const d = new Date(s)
    if (!Number.isNaN(d.getTime())) {
      const pad = (n: number) => String(n).padStart(2, '0')
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
    }
  }
  return s.replace('T', ' ').replace('.000Z', '')
}

export const getExt = (name: string) => {
  const idx = String(name || '').lastIndexOf('.')
  if (idx <= 0) return ''
  return String(name).slice(idx + 1).toUpperCase()
}

export const getTypeText = (nodeData: any) => {
  if (!nodeData) return '-'
  if (nodeData.type === 'folder') return '文件夹'
  const ext = getExt(String(nodeData.name || ''))
  return ext || '文件'
}

export const getSizeText = (nodeData: any) => {
  if (!nodeData) return '-'
  if (nodeData.type === 'folder') return '-'
  return formatSize(nodeData.size ?? null)
}

export const compareName = (a: string, b: string) => String(a || '').localeCompare(String(b || ''), 'zh-Hans-CN', { numeric: true, sensitivity: 'base' })

export const copyTextToClipboard = async (text: string) => {
  const value = String(text || '')
  if (!value) return false
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value)
      return true
    }
  } catch {
  }
  try {
    const textarea = document.createElement('textarea')
    textarea.value = value
    textarea.setAttribute('readonly', 'true')
    textarea.style.position = 'fixed'
    textarea.style.left = '-9999px'
    textarea.style.top = '0'
    document.body.appendChild(textarea)
    textarea.focus()
    textarea.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(textarea)
    return ok
  } catch {
    return false
  }
}

export const isEditableTarget = (t: EventTarget | null) => {
  const el = t as HTMLElement | null
  if (!el) return false
  if ((el as any).isContentEditable) return true
  if (el.closest?.('[contenteditable="true"]')) return true
  const tag = String((el as any).tagName || '').toUpperCase()
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'
}

export const isElementVisible = (el: Element) => {
  const style = window.getComputedStyle(el)
  return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0'
}

export const isModalOpen = () => {
  const modal = document.querySelector('[aria-modal="true"]')
  if (modal && isElementVisible(modal)) return true
  const mask = document.querySelector('.p-dialog-mask, .p-overlay-mask')
  if (mask && isElementVisible(mask)) return true
  return false
}
