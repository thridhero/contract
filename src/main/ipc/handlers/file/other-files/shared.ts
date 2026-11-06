import { IpcMainInvokeEvent, shell, app, nativeImage } from 'electron'
import Database from 'better-sqlite3'
import * as fs from 'fs'
import * as path from 'path'
import * as crypto from 'crypto'
import * as os from 'os'
import { createLogger } from '../../../../utils/logger'
import { openLibraryDatabase } from '../../../../services/system/DatabaseService'
import type { OtherFileRecord, OtherFileRecordType } from '../../../../../shared/types/otherFile.types'

export type OtherFileHandler = (event: IpcMainInvokeEvent, ...args: unknown[]) => Promise<unknown>
export type OtherFileHandlerMap = Record<string, OtherFileHandler>

export const logger = createLogger('OtherFileHandlers')

const ULID_CHARS = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'
const DRAGOUT_TEMP_DIR = 'other-files-dragout'
const OTHER_FILES_DIR_NAME = '其他'
const OTHER_FILES_LEGACY_DIR_NAME = 'other-files'

let dragoutCleanupDone = false

const createDragIcon = () => {
  try {
    return nativeImage.createFromDataURL('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMB/6Xl8AAAAABJRU5ErkJggg==')
  } catch {
    try {
      return nativeImage.createEmpty()
    } catch {
      return null
    }
  }
}

export const getFileIconSafe = async (filePath: string) => {
  const p = String(filePath || '').trim()
  if (!p) return createDragIcon()
  try {
    const icon = await (app as any)?.getFileIcon?.(p, { size: 'small' })
    return icon || createDragIcon()
  } catch {
    return createDragIcon()
  }
}

export const ulid = () => {
  const time = Date.now()
  let timePart = ''
  let t = time
  for (let i = 0; i < 10; i++) {
    timePart = ULID_CHARS[t % 32] + timePart
    t = Math.floor(t / 32)
  }

  const randomPart = crypto.randomBytes(10).toString('hex').toUpperCase()
  return timePart + randomPart
}

export const sha256File = (filePath: string) => new Promise<string>((resolve, reject) => {
  const hash = crypto.createHash('sha256')
  const stream = fs.createReadStream(filePath)
  stream.on('data', (chunk) => hash.update(chunk))
  stream.on('end', () => resolve(hash.digest('hex')))
  stream.on('error', reject)
})

export const openLibraryDb = (libraryPath: string) => {
  const dbPath = path.join(path.resolve(libraryPath), 'settings.db')
  if (!fs.existsSync(dbPath)) {
    throw new Error('资源库数据库不存在')
  }
  return openLibraryDatabase(dbPath, { enableWal: true }).db
}

export const ensurePathWithin = (rootPath: string, targetPath: string) => {
  const root = path.resolve(rootPath)
  const requested = path.resolve(targetPath)
  const rel = path.relative(root, requested)
  if (rel.startsWith('..') || path.isAbsolute(rel)) {
    throw new Error('无权限访问该路径')
  }
}

export const ensureValidEntryName = (name: string) => {
  const n = String(name || '').trim()
  if (!n) throw new Error('名称不能为空')
  if (n === '.' || n === '..') throw new Error('名称不合法')
  if (/[\\/]/.test(n)) throw new Error('名称不合法')
}

export const ensureDir = async (dirPath: string) => {
  await fs.promises.mkdir(dirPath, { recursive: true })
}

export const getPreferredOtherFilesRootDir = (libraryPath: string) =>
  path.join(path.resolve(libraryPath), OTHER_FILES_DIR_NAME)

export const getLegacyOtherFilesRootDir = (libraryPath: string) =>
  path.join(path.resolve(libraryPath), OTHER_FILES_LEGACY_DIR_NAME)

export const getOtherFilesRootDir = (libraryPath: string) => {
  const preferredRoot = getPreferredOtherFilesRootDir(libraryPath)
  if (fs.existsSync(preferredRoot)) return preferredRoot
  const legacyRoot = getLegacyOtherFilesRootDir(libraryPath)
  if (fs.existsSync(legacyRoot)) return legacyRoot
  return preferredRoot
}

export const getOtherFilesTrashRootDir = (libraryPath: string) => {
  const libraryRoot = path.resolve(libraryPath)
  const currentRoot = getOtherFilesRootDir(libraryPath)
  const dirName = path.basename(currentRoot) || OTHER_FILES_DIR_NAME
  return path.join(libraryRoot, '.trash', dirName)
}

const getDragoutBaseDir = () => {
  const base = (() => {
    try {
      const p = (app as any)?.getPath?.('temp')
      return p ? String(p) : ''
    } catch {
      return ''
    }
  })()
  return path.join(base || os.tmpdir(), DRAGOUT_TEMP_DIR)
}

export const deletePathSafely = async (targetPath: string) => {
  const absPath = String(targetPath || '').trim()
  if (!absPath || !fs.existsSync(absPath)) return
  try {
    await Promise.race([
      shell.trashItem(absPath),
      new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('trash timeout')), 15000)
      }),
    ])
    return
  } catch (error) {
    logger.warn('移动到回收站失败，改为直接删除', {
      path: absPath,
      error: error instanceof Error ? error.message : String(error || ''),
    })
  }
  const stat = fs.lstatSync(absPath)
  if (stat.isDirectory()) {
    fs.rmSync(absPath, { recursive: true, force: true })
  } else {
    fs.rmSync(absPath, { force: true })
  }
}

const cleanupOldDragoutDirs = async () => {
  if (dragoutCleanupDone) return
  dragoutCleanupDone = true
  const baseDir = getDragoutBaseDir()
  if (!fs.existsSync(baseDir)) return
  const entries = await fs.promises.readdir(baseDir).catch((): string[] => [])
  const now = Date.now()
  const ttlMs = 24 * 60 * 60 * 1000
  for (const name of entries) {
    const p = path.join(baseDir, name)
    try {
      const stat = await fs.promises.stat(p)
      if (now - stat.mtimeMs > ttlMs) {
        await deletePathSafely(p)
      }
    } catch {
    }
  }
}

export const makeUniquePath = async (targetPath: string) => {
  const base = path.dirname(targetPath)
  const ext = path.extname(targetPath)
  const name = path.basename(targetPath, ext)
  let candidate = targetPath
  let i = 2
  while (fs.existsSync(candidate)) {
    candidate = path.join(base, `${name} (${i})${ext}`)
    i += 1
  }
  return candidate
}

export const movePath = async (srcPath: string, destPath: string, type: OtherFileRecordType) => {
  const src = path.resolve(String(srcPath || '').trim())
  const dest = path.resolve(String(destPath || '').trim())
  if (!src) throw new Error('源路径不能为空')
  if (!dest) throw new Error('目标路径不能为空')
  if (!fs.existsSync(src)) throw new Error('源文件不存在')
  await ensureDir(path.dirname(dest))
  try {
    await fs.promises.rename(src, dest)
    return
  } catch {
    if (type === 'folder') {
      await fs.promises.cp(src, dest, { recursive: true })
      await fs.promises.rm(src, { recursive: true, force: true })
      return
    }
    await fs.promises.copyFile(src, dest)
    await fs.promises.rm(src, { force: true })
  }
}

export const copyToTempDir = async (sources: Array<{ absPath: string; type: OtherFileRecordType }>, rootDir: string) => {
  await cleanupOldDragoutDirs()
  const baseDir = getDragoutBaseDir()
  await ensureDir(baseDir)
  const tempDir = path.join(baseDir, ulid())
  await ensureDir(tempDir)

  for (const s of sources) {
    const abs = path.resolve(s.absPath)
    let rel = path.relative(rootDir, abs)
    if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) {
      rel = path.basename(abs)
    }
    const rawDest = path.join(tempDir, rel)
    const dest = await makeUniquePath(rawDest)
    await ensureDir(path.dirname(dest))
    if (s.type === 'folder') {
      await fs.promises.cp(abs, dest, { recursive: true })
    } else {
      await fs.promises.copyFile(abs, dest)
    }
  }

  const cleanupTimer = setTimeout(() => {
    deletePathSafely(tempDir).catch(() => {})
  }, 10 * 60 * 1000)
  ;(cleanupTimer as any).unref?.()

  return tempDir
}

export const parseThumbnailBytes = (value: unknown): Buffer => {
  if (!value) return Buffer.alloc(0)
  if (Buffer.isBuffer(value)) return value
  if (value instanceof Uint8Array) return Buffer.from(value)
  if (value instanceof ArrayBuffer) return Buffer.from(new Uint8Array(value))
  if (Array.isArray(value)) return Buffer.from(value)
  const anyVal = value as any
  if (anyVal?.buffer instanceof ArrayBuffer) return Buffer.from(new Uint8Array(anyVal.buffer))
  throw new Error('缩略图数据格式不支持')
}

export const getThumbFilePath = (rootDir: string, key: string, ext: string) => {
  const safeKey = String(key || '').trim()
  if (!safeKey) throw new Error('缩略图 key 为空')
  const prefix = safeKey.slice(0, 2) || '__'
  const dir = path.join(rootDir, '.thumbs', prefix)
  const filePath = path.join(dir, `${safeKey}.${ext}`)
  return { dir, filePath }
}

export const toRecord = (row: any): OtherFileRecord => ({
  fileId: String(row.file_id || ''),
  path: String(row.path || ''),
  originalPath: row.original_path ? String(row.original_path) : null,
  trashPath: row.trash_path ? String(row.trash_path) : null,
  name: String(row.name || ''),
  nameUpper: String(row.name_upper || ''),
  type: (String(row.type || 'file') as OtherFileRecordType),
  size: row.size === null || row.size === undefined ? null : Number(row.size),
  mtime: row.mtime === null || row.mtime === undefined ? null : Number(row.mtime),
  sha256: row.sha256 ? String(row.sha256) : null,
  firstPageThumb: row.first_page_thumb ? String(row.first_page_thumb) : null,
  previewStatus: row.preview_status ? String(row.preview_status) : null,
  deletedAt: row.deleted_at ? String(row.deleted_at) : null,
  createdAt: String(row.created_at || ''),
  updatedAt: String(row.updated_at || ''),
})
