import { IpcMainInvokeEvent } from 'electron'
import Database from 'better-sqlite3'
import * as channels from '../../../channels'
import { ok, fail, IpcResponse } from '../../../../../shared/types/ipc.types'
import type {
  FolderColorKey,
  FolderColorMap,
  FolderColorMapGetDTO,
  FolderColorMapResult,
  FolderColorMapSetDTO,
  FolderColorScope,
} from '../../../../../shared/types/folderColor.types'
import { openLibraryDb } from './shared'

const SETTINGS_KEY_BY_SCOPE: Record<FolderColorScope, string> = {
  'contract-files': 'ui:folder-colors:contract-files:v1',
  'other-files': 'ui:folder-colors:other-files:v1',
}

const isValidColorKey = (value: unknown): value is FolderColorKey => {
  return value === 'red'
    || value === 'orange'
    || value === 'yellow'
    || value === 'green'
    || value === 'blue'
    || value === 'purple'
}

const sanitizeMap = (value: unknown): FolderColorMap => {
  if (!value || typeof value !== 'object') return {}
  const input = value as Record<string, unknown>
  const out: FolderColorMap = {}
  for (const [k, v] of Object.entries(input)) {
    const key = String(k || '').trim()
    if (!key) continue
    if (!isValidColorKey(v)) continue
    out[key] = v
  }
  return out
}

const readFolderColorMapFromDb = (db: Database.Database, scope: FolderColorScope): FolderColorMap => {
  const settingsKey = SETTINGS_KEY_BY_SCOPE[scope]
  const row = db.prepare('SELECT value FROM settings WHERE key = ? LIMIT 1').get(settingsKey) as { value?: string | null } | undefined
  const raw = String(row?.value || '').trim()
  if (!raw) return {}
  try {
    return sanitizeMap(JSON.parse(raw))
  } catch {
    return {}
  }
}

const writeFolderColorMapToDb = (db: Database.Database, scope: FolderColorScope, map: FolderColorMap) => {
  const settingsKey = SETTINGS_KEY_BY_SCOPE[scope]
  const value = JSON.stringify(map || {})
  db.prepare(`
    INSERT INTO settings (key, value, description)
    VALUES (?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET
      value = excluded.value,
      description = excluded.description,
      updated_at = CURRENT_TIMESTAMP
  `).run(settingsKey, value, 'UI 目录颜色标记')
}

export const uiFolderColorsHandlers: Record<string, (event: IpcMainInvokeEvent, ...args: unknown[]) => Promise<unknown>> = {
  [channels.LIBRARY_UI_GET_FOLDER_COLOR_MAP]: async (_event, dto: unknown): Promise<IpcResponse<FolderColorMapResult>> => {
    let db: Database.Database | null = null
    try {
      const payload = dto as FolderColorMapGetDTO
      const libraryPath = String(payload.libraryPath || '').trim()
      const scope = String(payload.scope || '').trim() as FolderColorScope
      if (!libraryPath) return fail(new Error('资源库路径不能为空'))
      if (!(scope === 'contract-files' || scope === 'other-files')) return fail(new Error('无效的 scope'))
      db = openLibraryDb(libraryPath)
      const map = readFolderColorMapFromDb(db, scope)
      return ok({ map })
    } catch (error) {
      return fail(error)
    } finally {
      db?.close()
    }
  },

  [channels.LIBRARY_UI_SET_FOLDER_COLOR_MAP]: async (_event, dto: unknown): Promise<IpcResponse<{ success: boolean }>> => {
    let db: Database.Database | null = null
    try {
      const payload = dto as FolderColorMapSetDTO
      const libraryPath = String(payload.libraryPath || '').trim()
      const scope = String(payload.scope || '').trim() as FolderColorScope
      if (!libraryPath) return fail(new Error('资源库路径不能为空'))
      if (!(scope === 'contract-files' || scope === 'other-files')) return fail(new Error('无效的 scope'))
      const nextMap = sanitizeMap(payload.map)
      db = openLibraryDb(libraryPath)
      writeFolderColorMapToDb(db, scope, nextMap)
      return ok({ success: true })
    } catch (error) {
      return fail(error)
    } finally {
      db?.close()
    }
  },
}

