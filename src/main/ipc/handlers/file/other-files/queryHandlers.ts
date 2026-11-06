import * as fs from 'fs'
import * as path from 'path'
import Database from 'better-sqlite3'
import * as channels from '../../../channels'
import { ok, fail, IpcResponse } from '../../../../../shared/types/ipc.types'
import type {
  OtherFileDirectoryTreeNode,
  OtherFileListDTO,
  OtherFileListResult,
  OtherFileTrashListDTO,
  OtherFileUpsertFromPathsDTO,
  OtherFileRecord,
  OtherFileRecordType,
} from '../../../../../shared/types/otherFile.types'
import {
  OtherFileHandlerMap,
  ensureDir,
  ensurePathWithin,
  getOtherFilesRootDir,
  logger,
  openLibraryDb,
  sha256File,
  toRecord,
  ulid,
} from './shared'

const compareText = (a: string, b: string) =>
  String(a || '').localeCompare(String(b || ''), 'zh-CN', { numeric: true, sensitivity: 'base' })

const isPathWithinRoot = (rootPath: string, targetPath: string) => {
  const root = path.resolve(rootPath)
  const target = path.resolve(targetPath)
  const rel = path.relative(root, target)
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel))
}

const normalizeCurrentDirPath = (requestedPath: unknown, rootDir: string) => {
  const fallback = path.resolve(rootDir)
  const raw = String(requestedPath || '').trim()
  if (!raw) return fallback
  const resolved = path.resolve(raw)
  return isPathWithinRoot(fallback, resolved) ? resolved : fallback
}

const getRelativeParts = (targetPath: string, rootDir: string) => {
  const rel = path.relative(path.resolve(rootDir), path.resolve(targetPath))
  if (!rel || rel === '.') return []
  if (rel.startsWith('..') || path.isAbsolute(rel)) return []
  return rel.split(/[\\/]+/).filter(Boolean)
}

const compareRecords = (a: OtherFileRecord, b: OtherFileRecord) => {
  const getRank = (value: OtherFileRecord['type']) => (value === 'folder' ? 0 : 1)
  const rankDiff = getRank(a.type) - getRank(b.type)
  if (rankDiff !== 0) return rankDiff
  return compareText(a.name, b.name)
}

const sortDirectoryTree = (nodes: OtherFileDirectoryTreeNode[]) => {
  nodes.sort((a, b) => compareText(a.name, b.name))
  for (const node of nodes) {
    if (Array.isArray(node.children) && node.children.length) {
      sortDirectoryTree(node.children)
    }
  }
}

const buildDirectoryTree = (items: OtherFileRecord[], rootDir: string): OtherFileDirectoryTreeNode[] => {
  const rootNode: OtherFileDirectoryTreeNode = {
    key: path.resolve(rootDir),
    name: path.basename(path.resolve(rootDir)) || path.resolve(rootDir),
    path: path.resolve(rootDir),
    children: [],
  }

  const byPath = new Map<string, OtherFileDirectoryTreeNode>([[path.resolve(rootDir), rootNode]])

  const ensureChild = (parent: OtherFileDirectoryTreeNode, absPath: string, name: string) => {
    const resolved = path.resolve(absPath)
    const existing = byPath.get(resolved)
    if (existing) return existing
    const node: OtherFileDirectoryTreeNode = {
      key: resolved,
      name,
      path: resolved,
      children: [],
    }
    parent.children.push(node)
    byPath.set(resolved, node)
    return node
  }

  for (const item of items) {
    const folderPath = item.type === 'folder' ? item.path : path.dirname(item.path)
    const parts = getRelativeParts(folderPath, rootDir)
    if (!parts.length) continue

    let parent = rootNode
    let currentPath = rootDir
    for (const part of parts) {
      currentPath = path.join(currentPath, part)
      parent = ensureChild(parent, currentPath, part)
    }
  }

  sortDirectoryTree(rootNode.children)
  return [rootNode]
}

const buildCurrentItems = (items: OtherFileRecord[], currentDir: string) => {
  const normalizedCurrentDir = path.resolve(currentDir)
  return items
    .filter((item) => path.resolve(path.dirname(item.path)) === normalizedCurrentDir)
    .sort(compareRecords)
}

export const otherFileQueryHandlers: OtherFileHandlerMap = {
  [channels.OTHER_FILES_GET_LIST]: async (_event, dto: unknown): Promise<IpcResponse<OtherFileListResult>> => {
    let db: Database.Database | null = null
    try {
      const payload = dto as OtherFileListDTO
      const libraryPath = String(payload.libraryPath || '').trim()
      if (!libraryPath) return fail(new Error('资源库路径不能为空'))

      const libraryRoot = path.resolve(libraryPath)
      const rootDir = getOtherFilesRootDir(libraryPath)
      ensurePathWithin(libraryRoot, rootDir)
      await ensureDir(rootDir)

      db = openLibraryDb(libraryPath)

      const search = String(payload.search || '').trim()
      const includeDeleted = Boolean(payload.includeDeleted)
      const where = includeDeleted ? [] : ['deleted_at IS NULL']
      const params: any[] = []
      if (search) {
        where.push('name_upper LIKE ?')
        params.push(`%${search.toUpperCase()}%`)
      }
      const sql = `
        SELECT *
        FROM other_files
        ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
        ORDER BY CASE WHEN type = 'folder' THEN 0 ELSE 1 END, name_upper COLLATE NOCASE ASC
      `
      const rows = db.prepare(sql).all(...params) as any[]
      const items = rows.map(toRecord)
      const currentDir = normalizeCurrentDirPath(payload.currentDirPath, rootDir)
      return ok({
        rootDir,
        items,
        directoryTree: buildDirectoryTree(items, rootDir),
        currentDir,
        currentItems: buildCurrentItems(items, currentDir),
      })
    } catch (error) {
      logger.error('查询其他文件记录失败:', error)
      return fail(error)
    } finally {
      db?.close()
    }
  },

  [channels.OTHER_FILES_GET_TRASH_LIST]: async (_event, dto: unknown): Promise<IpcResponse<{ rootDir: string; items: OtherFileRecord[] }>> => {
    let db: Database.Database | null = null
    try {
      const payload = dto as OtherFileTrashListDTO
      const libraryPath = String(payload.libraryPath || '').trim()
      if (!libraryPath) return fail(new Error('资源库路径不能为空'))

      const libraryRoot = path.resolve(libraryPath)
      const rootDir = getOtherFilesRootDir(libraryPath)
      ensurePathWithin(libraryRoot, rootDir)
      await ensureDir(rootDir)

      db = openLibraryDb(libraryPath)

      const search = String(payload.search || '').trim()
      const where = ['deleted_at IS NOT NULL']
      const params: any[] = []
      if (search) {
        where.push('name_upper LIKE ?')
        params.push(`%${search.toUpperCase()}%`)
      }
      const sql = `
        SELECT *
        FROM other_files
        WHERE ${where.join(' AND ')}
        ORDER BY deleted_at DESC, CASE WHEN type = 'folder' THEN 0 ELSE 1 END, name_upper COLLATE NOCASE ASC
      `
      const rows = db.prepare(sql).all(...params) as any[]
      return ok({ rootDir, items: rows.map(toRecord) })
    } catch (error) {
      logger.error('查询其他文件回收站失败:', error)
      return fail(error)
    } finally {
      db?.close()
    }
  },

  [channels.OTHER_FILES_UPSERT_FROM_PATHS]: async (_event, dto: unknown): Promise<IpcResponse<{ upserted: number }>> => {
    let db: Database.Database | null = null
    try {
      const payload = dto as OtherFileUpsertFromPathsDTO
      const libraryPath = String(payload.libraryPath || '').trim()
      const pathsInput = Array.isArray(payload.paths) ? payload.paths : []
      if (!libraryPath) return fail(new Error('资源库路径不能为空'))
      if (pathsInput.length === 0) return ok({ upserted: 0 })

      const libraryRoot = path.resolve(libraryPath)
      const rootDir = getOtherFilesRootDir(libraryPath)
      ensurePathWithin(libraryRoot, rootDir)
      await ensureDir(rootDir)

      db = openLibraryDb(libraryPath)

      const findExisting = db.prepare('SELECT file_id FROM other_files WHERE path = ? LIMIT 1')
      const insertStmt = db.prepare(`
        INSERT INTO other_files (
          file_id, path, name, name_upper, type, size, mtime, sha256, first_page_thumb, preview_status
        ) VALUES (
          ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
        )
      `)
      const updateStmt = db.prepare(`
        UPDATE other_files
        SET
          name = ?,
          name_upper = ?,
          type = ?,
          size = ?,
          mtime = ?,
          sha256 = ?,
          first_page_thumb = ?,
          preview_status = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE file_id = ?
      `)

      let upserted = 0
      const tx = db.transaction((items: string[]) => {
        for (const p of items) {
          const abs = path.resolve(String(p || ''))
          ensurePathWithin(rootDir, abs)
          if (!fs.existsSync(abs)) continue
          const stat = fs.statSync(abs)
          const isDir = stat.isDirectory()
          const name = path.basename(abs)
          const nameUpper = name.toUpperCase()
          const type: OtherFileRecordType = isDir ? 'folder' : 'file'
          const size = isDir ? null : stat.size
          const mtime = Number(stat.mtimeMs)
          const sha256: string | null = null
          const firstPageThumb: string | null = null
          const previewStatus: string | null = null
          const existed = findExisting.get(abs) as { file_id?: string } | undefined
          if (existed?.file_id) {
            updateStmt.run(name, nameUpper, type, size, mtime, sha256, firstPageThumb, previewStatus, existed.file_id)
          } else {
            insertStmt.run(ulid(), abs, name, nameUpper, type, size, mtime, sha256, firstPageThumb, previewStatus)
          }
          upserted += 1
        }
      })

      tx(pathsInput)

      const fileRows = db.prepare(`
        SELECT file_id, path
        FROM other_files
        WHERE sha256 IS NULL AND type = 'file' AND deleted_at IS NULL
      `).all() as Array<{ file_id: string; path: string }>

      for (const row of fileRows) {
        if (!fs.existsSync(row.path)) continue
        ensurePathWithin(rootDir, row.path)
        const hash = await sha256File(row.path)
        db.prepare('UPDATE other_files SET sha256 = ?, updated_at = CURRENT_TIMESTAMP WHERE file_id = ?').run(hash, row.file_id)
      }

      return ok({ upserted })
    } catch (error) {
      logger.error('写入其他文件记录失败:', error)
      return fail(error)
    } finally {
      db?.close()
    }
  },
}
