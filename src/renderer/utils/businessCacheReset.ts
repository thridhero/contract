import type { AppInfoData, IpcResponse } from '../../shared/types/ipc.types'
import { createRendererLogger } from './logger'

const logger = createRendererLogger('BusinessCacheReset')

export const CACHE_RESET_VERSION_KEY = 'app:business-cache-cleared-version'

const LOCAL_STORAGE_EXACT_KEYS = [
  'dictionary_groups_tree',
  'tree_dictionary_groups_tree',
  'project_management_groups_tree',
  'project_management_groups_source',
  'project_management_design',
  'project_management_sort',
  'project_management_query_preferences',
  'project_management_view_mode',
] as const

const LOCAL_STORAGE_PREFIX_KEYS = [
  'contract-files:all-folder-colors:',
  'other-files:folder-colors:',
] as const

const SESSION_STORAGE_PREFIX_KEYS = [
  'aiw:scroll:',
] as const

function removeFromStorageByExactKeys(storage: Storage, keys: readonly string[]) {
  keys.forEach((key) => {
    try {
      storage.removeItem(key)
    } catch (error) {
      logger.warn(`删除存储键失败: ${key}`, error)
    }
  })
}

function removeFromStorageByPrefix(storage: Storage, prefixes: readonly string[]) {
  const keys: string[] = []
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index)
    if (!key) continue
    if (prefixes.some((prefix) => key.startsWith(prefix))) {
      keys.push(key)
    }
  }
  keys.forEach((key) => {
    try {
      storage.removeItem(key)
    } catch (error) {
      logger.warn(`删除存储前缀键失败: ${key}`, error)
    }
  })
}

export function clearBusinessBrowserCache(): void {
  removeFromStorageByExactKeys(localStorage, LOCAL_STORAGE_EXACT_KEYS)
  removeFromStorageByPrefix(localStorage, LOCAL_STORAGE_PREFIX_KEYS)
  removeFromStorageByPrefix(sessionStorage, SESSION_STORAGE_PREFIX_KEYS)
}

export async function getCurrentAppVersion(): Promise<string> {
  try {
    const res = await window.electronAPI.app.getInfo() as IpcResponse<AppInfoData>
    if (res.success && res.data?.appVersion) {
      return String(res.data.appVersion).trim()
    }
  } catch (error) {
    logger.warn('读取当前应用版本失败', error)
  }
  return ''
}

export async function clearBusinessCacheOnVersionUpgrade(): Promise<boolean> {
  const currentVersion = await getCurrentAppVersion()
  if (!currentVersion) return false

  const clearedVersion = String(localStorage.getItem(CACHE_RESET_VERSION_KEY) || '').trim()
  if (!clearedVersion) {
    localStorage.setItem(CACHE_RESET_VERSION_KEY, currentVersion)
    logger.info(`首次记录业务缓存版本标记: ${currentVersion}`)
    return false
  }
  if (clearedVersion === currentVersion) return false

  clearBusinessBrowserCache()
  localStorage.setItem(CACHE_RESET_VERSION_KEY, currentVersion)
  logger.info(`检测到版本变化，已清理业务缓存: ${clearedVersion || 'none'} -> ${currentVersion}`)
  return true
}
