import { getIconForDirectoryPath, getIconUrlByName, getIconUrlForFilePath } from 'vscode-material-icons'

type ContractFileLike =
  | {
      type?: string | null
      name?: string | null
      path?: string | null
    }
  | string
  | null
  | undefined

const ICONS_RELATIVE_PATH = 'assets/material-icons'

const resolveIconsBaseUrl = (): string => {
  try {
    if (typeof window !== 'undefined' && window.location?.href) {
      const url = new URL(`${ICONS_RELATIVE_PATH}/`, window.location.href).toString()
      return url.replace(/\/+$/g, '')
    }
  } catch {
  }
  return `/${ICONS_RELATIVE_PATH}`
}

const ICONS_URL = resolveIconsBaseUrl()

const cache = new Map<string, string>()

const normalizePath = (value: string) =>
  String(value || '')
    .trim()
    .replace(/\\/g, '/')
    .replace(/\/+/g, '/')

const basename = (value: string) => {
  const v = normalizePath(value).replace(/\/+$/g, '')
  if (!v) return ''
  const idx = v.lastIndexOf('/')
  return idx >= 0 ? v.slice(idx + 1) : v
}

const isFolderLike = (input: ContractFileLike) => {
  if (!input || typeof input === 'string') return false
  return String(input.type || '').toLowerCase() === 'folder'
}

const getGenericFolderIconUrl = () => {
  const iconName = getIconForDirectoryPath('__folder__')
  return getIconUrlByName(iconName, ICONS_URL)
}

const getGenericFileIconUrl = () => {
  return getIconUrlForFilePath('__file__', ICONS_URL)
}

export function getContractFileIconUrl(recordOrNameOrPath: ContractFileLike): string {
  const isFolder = isFolderLike(recordOrNameOrPath)
  const raw =
    typeof recordOrNameOrPath === 'string'
      ? recordOrNameOrPath
      : String(recordOrNameOrPath?.path || recordOrNameOrPath?.name || '')

  const name = basename(raw)
  const key = `${isFolder ? 'folder' : 'file'}:${name.toLowerCase() || '__empty__'}`

  const cached = cache.get(key)
  if (cached) return cached

  let url = ''
  try {
    if (isFolder) {
      url = getGenericFolderIconUrl()
    } else if (name) {
      url = getIconUrlForFilePath(name, ICONS_URL)
    }
  } catch {
    url = ''
  }

  if (!url) {
    try {
      url = isFolder ? getGenericFolderIconUrl() : getGenericFileIconUrl()
    } catch {
      url = ''
    }
  }

  if (!url) {
    url = `${ICONS_URL}/${isFolder ? 'folder' : 'file'}.svg`
  }

  cache.set(key, url)
  return url
}
