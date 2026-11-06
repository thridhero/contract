import Database from 'better-sqlite3'
import * as crypto from 'crypto'
import * as fs from 'fs'
import * as path from 'path'
import { ConfigService } from './ConfigService'
import { BootstrapService } from './BootstrapService'
import { createLogger } from '../../utils/logger'
import { openLibraryDatabase } from './DatabaseService'

const logger = createLogger('TrashAutoPurgeService')

const RETENTION_DAYS = 30
const DEFAULT_INTERVAL_MS = 12 * 60 * 60 * 1000
const PURGE_PENDING_TTL_MS = 7 * 24 * 60 * 60 * 1000

type PurgeReason = 'startup' | 'load-library' | 'interval'

type PurgeResult = {
  purgedContracts: number
  purgedContractFileRoots: number
  purgedContractFileRecords: number
}

function ensurePathWithin(rootPath: string, targetPath: string): void {
  const root = path.resolve(rootPath)
  const requested = path.resolve(targetPath)
  const rel = path.relative(root, requested)
  if (rel.startsWith('..') || path.isAbsolute(rel)) {
    throw new Error('无权限访问该路径')
  }
}

async function ensureDir(dirPath: string): Promise<void> {
  await fs.promises.mkdir(dirPath, { recursive: true })
}

async function makeUniquePath(targetPath: string): Promise<string> {
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

async function movePath(srcPath: string, destPath: string, isDir: boolean): Promise<void> {
  const src = path.resolve(String(srcPath || '').trim())
  const dest = path.resolve(String(destPath || '').trim())
  if (!src) throw new Error('源路径不能为空')
  if (!dest) throw new Error('目标路径不能为空')
  if (!fs.existsSync(src)) throw new Error('源路径不存在')
  await ensureDir(path.dirname(dest))
  try {
    await fs.promises.rename(src, dest)
    return
  } catch {
    if (isDir) {
      await fs.promises.cp(src, dest, { recursive: true })
      await fs.promises.rm(src, { recursive: true, force: true })
      return
    }
    await fs.promises.copyFile(src, dest)
    await fs.promises.rm(src, { force: true })
  }
}

function redactPath(libraryRoot: string, absPath: string): string {
  const root = path.resolve(libraryRoot)
  const target = path.resolve(String(absPath || '').trim())
  try {
    const rel = path.relative(root, target)
    if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) {
      return path.basename(target)
    }
    return rel.split(path.sep).join('/')
  } catch {
    return path.basename(target)
  }
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size))
  }
  return out
}

function hasTable(db: Database.Database, tableName: string): boolean {
  try {
    const row = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name = ? LIMIT 1").get(tableName) as { name?: string } | undefined
    return Boolean(row?.name)
  } catch {
    return false
  }
}

export class TrashAutoPurgeService {
  private static instance: TrashAutoPurgeService
  private timer: NodeJS.Timeout | null = null
  private runningByLibrary = new Map<string, Promise<PurgeResult>>()

  static getInstance(): TrashAutoPurgeService {
    if (!TrashAutoPurgeService.instance) {
      TrashAutoPurgeService.instance = new TrashAutoPurgeService()
    }
    return TrashAutoPurgeService.instance
  }

  startPeriodic(intervalMs = DEFAULT_INTERVAL_MS): void {
    if (this.timer) return
    this.timer = setInterval(() => {
      this.runForAllLibraries('interval').catch(() => {})
    }, intervalMs)
    ;(this.timer as any).unref?.()
  }

  runOnceForLibrary(libraryPath: string, reason: PurgeReason): Promise<PurgeResult> {
    const resolved = path.resolve(String(libraryPath || '').trim())
    if (!resolved) {
      return Promise.resolve({ purgedContracts: 0, purgedContractFileRoots: 0, purgedContractFileRecords: 0 })
    }
    const existing = this.runningByLibrary.get(resolved)
    if (existing) return existing
    const task = this.runForLibraryInternal(resolved, reason)
      .catch((error) => {
        try {
          logger.error('回收站自动清理失败', { reason, error: error instanceof Error ? error.message : String(error || '') })
        } catch {}
        return { purgedContracts: 0, purgedContractFileRoots: 0, purgedContractFileRecords: 0 }
      })
      .finally(() => {
        this.runningByLibrary.delete(resolved)
      })
    this.runningByLibrary.set(resolved, task)
    return task
  }

  async runForAllLibraries(reason: PurgeReason): Promise<void> {
    const configSvc = ConfigService.getInstance()
    const list = Array.isArray(configSvc.getConfigItem('libraries')) ? (configSvc.getConfigItem('libraries') as any[]) : []
    const fromConfig = list.map((l) => String(l?.path || '').trim()).filter(Boolean)
    const bootstrap = BootstrapService.getInstance().readConfig()
    const current = bootstrap?.projectPath ? [String(bootstrap.projectPath).trim()] : []
    const all = Array.from(new Set([...current, ...fromConfig].map((p) => path.resolve(p))))
    for (const p of all) {
      await this.runOnceForLibrary(p, reason)
    }
  }

  private openLibraryDb(libraryRoot: string): Database.Database {
    const dbPath = path.join(path.resolve(libraryRoot), 'settings.db')
    if (!fs.existsSync(dbPath)) {
      throw new Error('资源库数据库不存在')
    }
    return openLibraryDatabase(dbPath, {
      enableWal: true,
      busyTimeoutMs: 5000,
    }).db
  }

  private async cleanupOldPurgePending(libraryRoot: string): Promise<void> {
    const pendingBase = path.join(libraryRoot, '.trash', '.purge_pending')
    if (!fs.existsSync(pendingBase)) return
    const now = Date.now()
    const entries = await fs.promises.readdir(pendingBase).catch((): string[] => [])
    for (const name of entries) {
      const p = path.join(pendingBase, name)
      try {
        const stat = await fs.promises.stat(p)
        if (now - stat.mtimeMs > PURGE_PENDING_TTL_MS) {
          await fs.promises.rm(p, { recursive: true, force: true })
        }
      } catch {}
    }
  }

  private async runForLibraryInternal(libraryRoot: string, reason: PurgeReason): Promise<PurgeResult> {
    const resolvedRoot = path.resolve(libraryRoot)
    const dbPath = path.join(resolvedRoot, 'settings.db')
    if (!fs.existsSync(dbPath)) {
      return { purgedContracts: 0, purgedContractFileRoots: 0, purgedContractFileRecords: 0 }
    }

    let db: Database.Database | null = null
    const startedAt = Date.now()
    try {
      db = this.openLibraryDb(resolvedRoot)
      await this.cleanupOldPurgePending(resolvedRoot)

      try {
        logger.info('回收站自动清理开始', { reason, library: path.basename(resolvedRoot) })
      } catch {}

      const purgedContracts = await this.purgeExpiredContracts(db, resolvedRoot)
      const { purgedRoots, purgedRecords } = await this.purgeExpiredContractFiles(db, resolvedRoot)

      const costMs = Date.now() - startedAt
      try {
        logger.info('回收站自动清理完成', {
          reason,
          library: path.basename(resolvedRoot),
          purgedContracts,
          purgedContractFileRoots: purgedRoots,
          purgedContractFileRecords: purgedRecords,
          costMs,
        })
      } catch {}

      return { purgedContracts, purgedContractFileRoots: purgedRoots, purgedContractFileRecords: purgedRecords }
    } finally {
      db?.close()
    }
  }

  private async purgeExpiredContracts(db: Database.Database, libraryRoot: string): Promise<number> {
    const rows = db.prepare(`
      SELECT id, folder_name, trash_path, deleted_at
      FROM contract_info
      WHERE deleted_at IS NOT NULL
        AND COALESCE(trash_path, '') <> ''
        AND datetime(deleted_at) <= datetime('now', '-${RETENTION_DAYS} days')
      ORDER BY datetime(deleted_at) ASC
    `).all() as Array<{ id: string; folder_name: string; trash_path: string; deleted_at: string }>

    if (rows.length === 0) return 0

    const trashBase = path.join(libraryRoot, '.trash', 'contracts')
    const pendingBase = path.join(libraryRoot, '.trash', '.purge_pending')
    await ensureDir(pendingBase)

    let purged = 0
    for (const row of rows) {
      const id = String(row.id || '').trim()
      const folderName = String(row.folder_name || '').trim()
      const trashPath = String(row.trash_path || '').trim()
      if (!id || !trashPath || !folderName) continue
      try {
        ensurePathWithin(trashBase, trashPath)
      } catch {
        continue
      }
      if (!fs.existsSync(trashPath)) {
        try {
          db.transaction(() => {
            if (hasTable(db, 'contract_ai_log')) {
              db.prepare('DELETE FROM contract_ai_log WHERE file_id IN (SELECT file_id FROM contract_files WHERE contract_id = ?)').run(id)
            }
            db.prepare('DELETE FROM contract_files WHERE contract_id = ?').run(id)
            db.prepare('DELETE FROM contract_products WHERE contract_id = ?').run(id)
            db.prepare('DELETE FROM contract_executions WHERE contract_id = ?').run(id)
            db.prepare('DELETE FROM contract_receipt_payment WHERE contract_id = ?').run(id)
            db.prepare('DELETE FROM contract_info WHERE id = ?').run(id)
          })()
          purged += 1
        } catch {}
        continue
      }

      const pendingDir = path.join(pendingBase, `auto-${crypto.randomUUID()}`)
      await ensureDir(pendingDir)
      const pendingPath = path.join(pendingDir, path.basename(trashPath))
      const pendingFinal = await makeUniquePath(pendingPath)

      const contractDir = path.join(libraryRoot, folderName)
      const contractPrefix = path.resolve(contractDir) + path.sep
      const trashPrefix = path.resolve(trashPath) + path.sep

      await movePath(trashPath, pendingFinal, true)

      try {
        db.exec('BEGIN')
        if (hasTable(db, 'file_content_fts')) {
          db.prepare('DELETE FROM file_content_fts WHERE file_path LIKE ?').run(`${contractPrefix}%`)
          db.prepare('DELETE FROM file_content_fts WHERE file_path LIKE ?').run(`${trashPrefix}%`)
        }
        if (hasTable(db, 'file_metadata')) {
          db.prepare('DELETE FROM file_metadata WHERE file_path LIKE ?').run(`${contractPrefix}%`)
          db.prepare('DELETE FROM file_metadata WHERE file_path LIKE ?').run(`${trashPrefix}%`)
        }

        if (hasTable(db, 'contract_ai_log')) {
          db.prepare('DELETE FROM contract_ai_log WHERE file_id IN (SELECT file_id FROM contract_files WHERE contract_id = ?)').run(id)
        }
        db.prepare('DELETE FROM contract_files WHERE contract_id = ?').run(id)
        db.prepare('DELETE FROM contract_products WHERE contract_id = ?').run(id)
        db.prepare('DELETE FROM contract_executions WHERE contract_id = ?').run(id)
        db.prepare('DELETE FROM contract_receipt_payment WHERE contract_id = ?').run(id)
        db.prepare('DELETE FROM contract_info WHERE id = ?').run(id)
        db.exec('COMMIT')
      } catch (error) {
        try {
          db.exec('ROLLBACK')
        } catch {}
        try {
          await movePath(pendingFinal, trashPath, true)
        } catch {}
        throw error
      }

      await fs.promises.rm(pendingFinal, { recursive: true, force: true }).catch(() => {})
      purged += 1
      try {
        logger.info('自动彻底删除合同目录', {
          contract: id.slice(0, 8),
          trash: redactPath(libraryRoot, trashPath),
          deletedAt: row.deleted_at,
        })
      } catch {}
    }

    return purged
  }

  private async purgeExpiredContractFiles(db: Database.Database, libraryRoot: string): Promise<{ purgedRoots: number; purgedRecords: number }> {
    const rows = db.prepare(`
      SELECT file_id, contract_id, trash_path, original_path, type, first_page_thumb, deleted_at
      FROM contract_files
      WHERE deleted_at IS NOT NULL
        AND COALESCE(trash_path, '') <> ''
        AND datetime(deleted_at) <= datetime('now', '-${RETENTION_DAYS} days')
      ORDER BY LENGTH(trash_path) ASC, datetime(deleted_at) ASC
    `).all() as Array<{
      file_id: string
      contract_id: string
      trash_path: string
      original_path: string
      type: string
      first_page_thumb: string | null
      deleted_at: string
    }>

    if (rows.length === 0) return { purgedRoots: 0, purgedRecords: 0 }

    const filesTrashBase = path.join(libraryRoot, '.trash', 'files')
    const pendingBase = path.join(libraryRoot, '.trash', '.purge_pending')
    await ensureDir(pendingBase)

    const purgedRootPrefixes: string[] = []
    let purgedRoots = 0
    let purgedRecords = 0

    for (const row of rows) {
      const fileId = String(row.file_id || '').trim()
      const rootTrash = String(row.trash_path || '').trim()
      const entryType = String(row.type || 'file').trim()
      if (!fileId || !rootTrash) continue

      const rootTrashNorm = entryType === 'folder' ? rootTrash.replace(/[\\/]+$/g, '') : rootTrash
      const rootResolved = path.resolve(rootTrashNorm)
      const alreadyCovered = purgedRootPrefixes.some((p) => rootResolved === p || rootResolved.startsWith(p + path.sep))
      if (alreadyCovered) continue

      try {
        ensurePathWithin(filesTrashBase, rootResolved)
      } catch {
        continue
      }

      if (!fs.existsSync(rootResolved)) {
        try {
          const affected = this.collectContractFileSubtreeRows(db, String(row.contract_id || ''), rootResolved, entryType === 'folder')
          const ids = affected.map((r) => String(r.file_id || '').trim()).filter(Boolean)
          if (ids.length > 0) {
            const tx = db.transaction(() => {
              this.deleteAiLogsByFileIds(db, ids)
              this.deleteContractFilesByIds(db, ids)
            })
            tx()
            purgedRoots += 1
            purgedRecords += ids.length
            purgedRootPrefixes.push(rootResolved)
          }
        } catch {}
        continue
      }

      const pendingDir = path.join(pendingBase, `auto-${crypto.randomUUID()}`)
      await ensureDir(pendingDir)
      const pendingPath = path.join(pendingDir, path.basename(rootResolved))
      const pendingFinal = await makeUniquePath(pendingPath)

      const isDir = entryType === 'folder'
      await movePath(rootResolved, pendingFinal, isDir)

      const contractId = String(row.contract_id || '').trim()
      const affected = this.collectContractFileSubtreeRows(db, contractId, rootResolved, isDir)
      const ids = affected.map((r) => String(r.file_id || '').trim()).filter(Boolean)
      const originalPaths = affected.map((r) => String(r.original_path || '').trim()).filter(Boolean)
      const thumbCandidates = Array.from(new Set(
        affected
          .map((r) => (r.first_page_thumb ? String(r.first_page_thumb) : ''))
          .map((p) => String(p || '').trim())
          .filter((p) => p && !p.startsWith('data:'))
      ))

      const thumbDeleteList: string[] = []
      const contractDir = this.inferContractDirByTrashPath(libraryRoot, rootResolved, filesTrashBase)

      try {
        db.exec('BEGIN')
        if (ids.length > 0) {
          this.deleteAiLogsByFileIds(db, ids)
          if (originalPaths.length > 0) {
            this.deleteFileIndexByPaths(db, originalPaths)
          }
          this.deleteContractFilesByIds(db, ids)
        }

        if (contractId && contractDir && thumbCandidates.length > 0) {
          const countStmt = db.prepare('SELECT COUNT(1) as c FROM contract_files WHERE contract_id = ? AND first_page_thumb = ?')
          for (const tp of thumbCandidates) {
            const usedRow = countStmt.get(contractId, tp) as { c?: number } | undefined
            const count = Number(usedRow?.c || 0)
            if (count === 0) {
              thumbDeleteList.push(tp)
            }
          }
        }
        db.exec('COMMIT')
      } catch (error) {
        try {
          db.exec('ROLLBACK')
        } catch {}
        try {
          await movePath(pendingFinal, rootResolved, isDir)
        } catch {}
        throw error
      }

      await fs.promises.rm(pendingFinal, { recursive: true, force: true }).catch(() => {})

      if (contractDir && thumbDeleteList.length > 0) {
        for (const tp of thumbDeleteList) {
          try {
            ensurePathWithin(contractDir, tp)
            if (fs.existsSync(tp)) {
              await fs.promises.rm(tp, { force: true })
            }
          } catch {}
        }
      }

      purgedRoots += 1
      purgedRecords += ids.length
      purgedRootPrefixes.push(rootResolved)
      try {
        logger.info('自动彻底删除合同文件', {
          file: fileId.slice(0, 10),
          trash: redactPath(libraryRoot, rootResolved),
          deletedAt: row.deleted_at,
          records: ids.length,
        })
      } catch {}
    }

    return { purgedRoots, purgedRecords }
  }

  private collectContractFileSubtreeRows(
    db: Database.Database,
    contractId: string,
    rootTrashNorm: string,
    isFolder: boolean,
  ): Array<{ file_id: string; original_path: string; first_page_thumb: string | null }> {
    const cid = String(contractId || '').trim()
    if (!cid) return []
    if (!isFolder) {
      const row = db.prepare('SELECT file_id, original_path, first_page_thumb FROM contract_files WHERE contract_id = ? AND trash_path = ? LIMIT 1')
        .get(cid, rootTrashNorm) as any
      return row ? [row] : []
    }
    const likePrefix = rootTrashNorm + path.sep + '%'
    return db.prepare(`
      SELECT file_id, original_path, first_page_thumb
      FROM contract_files
      WHERE contract_id = ?
        AND deleted_at IS NOT NULL
        AND (trash_path = ? OR trash_path LIKE ?)
    `).all(cid, rootTrashNorm, likePrefix) as any[]
  }

  private deleteContractFilesByIds(db: Database.Database, ids: string[]): void {
    const list = ids.map((v) => String(v || '').trim()).filter(Boolean)
    if (list.length === 0) return
    for (const batch of chunk(list, 900)) {
      const placeholders = batch.map(() => '?').join(',')
      db.prepare(`DELETE FROM contract_files WHERE file_id IN (${placeholders})`).run(...batch)
    }
  }

  private deleteAiLogsByFileIds(db: Database.Database, ids: string[]): void {
    if (!hasTable(db, 'contract_ai_log')) return
    const list = ids.map((v) => String(v || '').trim()).filter(Boolean)
    if (list.length === 0) return
    for (const batch of chunk(list, 900)) {
      const placeholders = batch.map(() => '?').join(',')
      db.prepare(`DELETE FROM contract_ai_log WHERE file_id IN (${placeholders})`).run(...batch)
    }
  }

  private deleteFileIndexByPaths(db: Database.Database, filePaths: string[]): void {
    const hasFts = hasTable(db, 'file_content_fts')
    const hasMeta = hasTable(db, 'file_metadata')
    if (!hasFts && !hasMeta) return
    const list = Array.from(new Set(filePaths.map((v) => String(v || '').trim()).filter(Boolean)))
    if (list.length === 0) return
    for (const batch of chunk(list, 800)) {
      const placeholders = batch.map(() => '?').join(',')
      if (hasFts) db.prepare(`DELETE FROM file_content_fts WHERE file_path IN (${placeholders})`).run(...batch)
      if (hasMeta) db.prepare(`DELETE FROM file_metadata WHERE file_path IN (${placeholders})`).run(...batch)
    }
  }

  private inferContractDirByTrashPath(libraryRoot: string, rootTrashResolved: string, filesTrashBase: string): string | null {
    try {
      const rel = path.relative(filesTrashBase, rootTrashResolved)
      if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) return null
      const first = rel.split(path.sep).filter(Boolean)[0]
      if (!first) return null
      const dir = path.join(path.resolve(libraryRoot), first)
      ensurePathWithin(libraryRoot, dir)
      return dir
    } catch {
      return null
    }
  }
}
