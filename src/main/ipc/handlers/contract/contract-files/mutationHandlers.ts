import * as fs from 'fs'
import * as path from 'path'
import Database from 'better-sqlite3'
import * as channels from '../../../channels'
import { ok, fail, IpcResponse } from '../../../../../shared/types/ipc.types'
import type {
  ContractFileCopyDTO,
  ContractFileCreateFolderDTO,
  ContractFileDeleteDTO,
  ContractFileMoveDTO,
  ContractFileMoveItemResult,
  ContractFileMoveResult,
  ContractFilePurgeDTO,
  ContractFileRecord,
  ContractFileRecordType,
  ContractFileRenameDTO,
  ContractFileRestoreDTO,
  ContractFileRestoreResult,
} from '../../../../../shared/types/contractFile.types'
import {
  buildHiddenMarkdownSidecarPath,
  buildLegacyMarkdownSidecarPath,
  listMarkdownSidecarCandidates,
} from '../../../../services/file/markdownSidecar'
import {
  ContractFileHandlerMap,
  ensureDir,
  ensurePathWithin,
  ensureValidEntryName,
  getContractMeta,
  logger,
  makeUniquePath,
  movePath,
  openLibraryDb,
  sha256File,
  toRecord,
  ulid,
} from './shared'

const normalizePath = (value: string) => path.resolve(String(value || '').trim())
const hasTable = (db: Database.Database, tableName: string) => {
  const row = db.prepare(`
    SELECT 1
    FROM sqlite_master
    WHERE type = 'table' AND name = ?
    LIMIT 1
  `).get(tableName)
  return Boolean(row)
}

const isSameOrSubPath = (parentPath: string, targetPath: string) => {
  const parent = normalizePath(parentPath)
  const target = normalizePath(targetPath)
  if (parent === target) return true
  const rel = path.relative(parent, target)
  return !!rel && !rel.startsWith('..') && !path.isAbsolute(rel)
}

const pathExistsInDb = (
  db: Database.Database,
  contractId: string,
  pathValue: string,
  excludeFileIds: string[],
) => {
  const baseSql = [
    'SELECT 1 AS ok FROM contract_files',
    'WHERE contract_id = ? AND deleted_at IS NULL AND path = ?',
  ]
  const args: any[] = [contractId, pathValue]
  const excluded = excludeFileIds.filter(Boolean)
  if (excluded.length > 0) {
    baseSql.push(`AND file_id NOT IN (${excluded.map(() => '?').join(',')})`)
    args.push(...excluded)
  }
  baseSql.push('LIMIT 1')
  const row = db.prepare(baseSql.join(' ')).get(...args) as { ok?: number } | undefined
  return Boolean(row?.ok)
}

const makeUniqueTargetPathWithDb = async (
  db: Database.Database,
  contractId: string,
  rawTargetPath: string,
  excludeFileIds: string[],
) => {
  const ext = path.extname(rawTargetPath)
  const baseName = path.basename(rawTargetPath, ext)
  const parentDir = path.dirname(rawTargetPath)
  let candidate = rawTargetPath
  let index = 2
  while (fs.existsSync(candidate) || pathExistsInDb(db, contractId, candidate, excludeFileIds)) {
    candidate = path.join(parentDir, `${baseName} (${index})${ext}`)
    index += 1
  }
  return candidate
}

const deleteConflictTargetRows = (
  db: Database.Database,
  contractId: string,
  targetPath: string,
  excludeFileIds: string[],
) => {
  const normalizedTarget = normalizePath(targetPath).replace(/[\\/]+$/g, '')
  const likePrefix = normalizedTarget + path.sep + '%'
  const excluded = excludeFileIds.filter(Boolean)
  const sql = [
    'SELECT file_id FROM contract_files',
    'WHERE contract_id = ? AND deleted_at IS NULL AND (path = ? OR path LIKE ?)',
  ]
  const args: any[] = [contractId, normalizedTarget, likePrefix]
  if (excluded.length > 0) {
    sql.push(`AND file_id NOT IN (${excluded.map(() => '?').join(',')})`)
    args.push(...excluded)
  }
  const rows = db.prepare(sql.join(' ')).all(...args) as Array<{ file_id?: string }>
  const ids = rows.map((row) => String(row.file_id || '').trim()).filter(Boolean)
  if (ids.length === 0) return
  const placeholders = ids.map(() => '?').join(',')
  db.prepare(`DELETE FROM contract_files WHERE file_id IN (${placeholders})`).run(...ids)
}

export const contractFileMutationHandlers: ContractFileHandlerMap = {
  [channels.CONTRACT_FILES_DELETE]: async (_event, dto: unknown): Promise<IpcResponse<{ success: boolean }>> => {
    let db: Database.Database | null = null
    try {
      const payload = dto as ContractFileDeleteDTO
      const libraryPath = String(payload.libraryPath || '').trim()
      const fileId = String(payload.fileId || '').trim()
      if (!libraryPath) return fail(new Error('资源库路径不能为空'))
      if (!fileId) return fail(new Error('文件ID不能为空'))

      db = openLibraryDb(libraryPath)
      const row = db.prepare('SELECT * FROM contract_files WHERE file_id = ? LIMIT 1').get(fileId) as any | undefined
      if (!row) return fail(new Error('文件记录不存在'))
      if (row.deleted_at) return fail(new Error('文件已在回收站'))

      const contractId = String(row.contract_id || '')
      const meta = getContractMeta(db, contractId)
      const libraryRoot = path.resolve(libraryPath)
      const contractDir = path.join(path.resolve(libraryPath), meta.folderName)
      const rootDir = path.join(contractDir, 'documents')
      const entryPath = String(row.path || '')
      ensurePathWithin(contractDir, entryPath)
      const entryType = (String(row.type || 'file') as ContractFileRecordType)
      const folderPath = entryType === 'folder' ? entryPath.replace(/[\\/]+$/g, '') : entryPath

      const trashContractBase = path.join(libraryRoot, '.trash', 'files', meta.folderName)
      let relFromDocuments = path.relative(rootDir, path.resolve(entryPath))
      if (!relFromDocuments || relFromDocuments.startsWith('..') || path.isAbsolute(relFromDocuments)) {
        relFromDocuments = path.basename(entryPath)
      }
      const rawTrashRoot = path.join(trashContractBase, relFromDocuments)
      const trashRoot = await makeUniquePath(rawTrashRoot)

      const subtreeRows = (() => {
        if (entryType !== 'folder') return [row]
        const likePrefix = folderPath + path.sep + '%'
        return db!.prepare('SELECT * FROM contract_files WHERE contract_id = ? AND deleted_at IS NULL AND (path = ? OR path LIKE ?)')
          .all(contractId, folderPath, likePrefix) as any[]
      })()

      // Also move/delete thumbnail file if it exists, to avoid leaving dangling thumbnail files
      for (const r of subtreeRows) {
        if (r.first_page_thumb && !String(r.first_page_thumb).startsWith('data:')) {
          try {
            const thumbPath = String(r.first_page_thumb)
            if (fs.existsSync(thumbPath)) {
              fs.unlinkSync(thumbPath)
            }
          } catch (e) {
            logger.warn('删除文件时清理缩略图失败', e)
          }
        }
      }

      // If source file doesn't exist, directly hard delete the database record
      if (!fs.existsSync(entryPath)) {
        const deleteTx = db.transaction((rowsToDelete: any[]) => {
          const ids = rowsToDelete.map(r => String(r.file_id || '').trim()).filter(Boolean)
          if (ids.length === 0) return
          const placeholders = ids.map(() => '?').join(',')
          db!.prepare(`DELETE FROM contract_files WHERE file_id IN (${placeholders})`).run(...ids)
        })
        deleteTx(subtreeRows)
        return ok({ success: true })
      }

      await movePath(entryPath, trashRoot, entryType)

      const entryExt = path.extname(entryPath).toLowerCase()
      if (entryType === 'file' && entryExt !== '.md') {
        const hiddenMdDestRaw = buildHiddenMarkdownSidecarPath(trashRoot)
        const legacyMdPath = buildLegacyMarkdownSidecarPath(entryPath)
        for (const mdPath of listMarkdownSidecarCandidates(entryPath)) {
          try {
            ensurePathWithin(contractDir, mdPath)
            if (!fs.existsSync(mdPath)) continue

            if (mdPath === legacyMdPath) {
              const existedInDb = db.prepare('SELECT 1 FROM contract_files WHERE contract_id = ? AND path = ? LIMIT 1')
                .get(contractId, mdPath) as any
              if (existedInDb) continue
            }

            const mdDest = await makeUniquePath(hiddenMdDestRaw)
            await ensureDir(path.dirname(mdDest))
            await movePath(mdPath, mdDest, 'file')
          } catch {
          }
        }
      }

      const updateTx = db.transaction((rowsToUpdate: any[], opts: { folderPath: string; trashRoot: string; rootDir: string; trashContractBase: string }) => {
        const stmt = db!.prepare(`
          UPDATE contract_files
          SET
            deleted_at = CURRENT_TIMESTAMP,
            original_path = ?,
            trash_path = ?,
            path = ?,
            name = ?,
            name_upper = ?,
            first_page_thumb = NULL,
            preview_status = 'pending',
            updated_at = CURRENT_TIMESTAMP
          WHERE file_id = ?
        `)

        for (const r of rowsToUpdate) {
          const fileIdInner = String(r.file_id || '').trim()
          if (!fileIdInner) continue
          const originalAbs = String(r.path || '')
          let trashAbs = opts.trashRoot
          if (entryType === 'folder') {
            const rel = path.relative(opts.folderPath, originalAbs)
            trashAbs = path.join(opts.trashRoot, rel)
          }
          const relInTrash = path.relative(opts.trashContractBase, trashAbs)
          const virtualPath = path.join(opts.rootDir, '回收站', relInTrash)
          const nextName = path.basename(virtualPath)
          stmt.run(originalAbs, trashAbs, virtualPath, nextName, nextName.toUpperCase(), fileIdInner)
        }
      })

      try {
        updateTx(subtreeRows, { folderPath, trashRoot, rootDir, trashContractBase })
      } catch (error) {
        try {
          await movePath(trashRoot, entryPath, entryType)
        } catch (rollbackError) {
          logger.error('软删回滚失败:', rollbackError)
        }
        throw error
      }

      return ok({ success: true })
    } catch (error) {
      logger.error('删除合同文件失败:', error)
      return fail(error)
    } finally {
      db?.close()
    }
  },

  [channels.CONTRACT_FILES_RESTORE]: async (_event, dto: unknown): Promise<IpcResponse<ContractFileRestoreResult>> => {
    let db: Database.Database | null = null
    try {
      const payload = dto as ContractFileRestoreDTO
      const libraryPath = String(payload.libraryPath || '').trim()
      const fileId = String(payload.fileId || '').trim()
      if (!libraryPath) return fail(new Error('资源库路径不能为空'))
      if (!fileId) return fail(new Error('文件ID不能为空'))

      db = openLibraryDb(libraryPath)
      const row = db.prepare('SELECT * FROM contract_files WHERE file_id = ? LIMIT 1').get(fileId) as any | undefined
      if (!row) return fail(new Error('文件记录不存在'))
      if (!row.deleted_at) return fail(new Error('文件不在回收站中'))

      const contractId = String(row.contract_id || '')
      const meta = getContractMeta(db, contractId)
      const libraryRoot = path.resolve(libraryPath)
      const contractDir = path.join(path.resolve(libraryPath), meta.folderName)

      const srcTrash = String(row.trash_path || '').trim()
      const rawDest = String(row.original_path || '').trim()
      if (!srcTrash) return fail(new Error('回收站路径为空'))
      if (!rawDest) return fail(new Error('原始路径为空'))
      const entryType = (String(row.type || 'file') as ContractFileRecordType)

      const trashContractBase = path.join(libraryRoot, '.trash', 'files', meta.folderName)
      ensurePathWithin(trashContractBase, srcTrash)
      ensurePathWithin(contractDir, rawDest)
      if (!fs.existsSync(srcTrash)) return fail(new Error('回收站文件不存在'))

      const dest = fs.existsSync(rawDest) ? await makeUniquePath(rawDest) : rawDest

      await movePath(srcTrash, dest, entryType)

      const trashRootNorm = entryType === 'folder' ? srcTrash.replace(/[\\/]+$/g, '') : srcTrash
      const destRootNorm = entryType === 'folder' ? dest.replace(/[\\/]+$/g, '') : dest
      const originalRootNorm = entryType === 'folder' ? rawDest.replace(/[\\/]+$/g, '') : rawDest

      const subtreeRows = (() => {
        if (entryType !== 'folder') return [row]
        const likePrefix = trashRootNorm + path.sep + '%'
        return db!.prepare('SELECT * FROM contract_files WHERE contract_id = ? AND deleted_at IS NOT NULL AND (trash_path = ? OR trash_path LIKE ?)')
          .all(contractId, trashRootNorm, likePrefix) as any[]
      })()

      const restoreTx = db.transaction((rowsToUpdate: any[]) => {
        const stmt = db!.prepare(`
          UPDATE contract_files
          SET
            deleted_at = NULL,
            original_path = '',
            trash_path = '',
            path = ?,
            name = ?,
            name_upper = ?,
            updated_at = CURRENT_TIMESTAMP
          WHERE file_id = ?
        `)

        for (const r of rowsToUpdate) {
          const fileIdInner = String(r.file_id || '').trim()
          if (!fileIdInner) continue
          const oldOriginalAbs = String(r.original_path || '').trim()
          if (!oldOriginalAbs) continue
          let nextAbs = destRootNorm
          if (entryType === 'folder') {
            const rel = path.relative(originalRootNorm, oldOriginalAbs)
            nextAbs = path.join(destRootNorm, rel)
          }
          const nextName = path.basename(nextAbs)
          stmt.run(nextAbs, nextName, nextName.toUpperCase(), fileIdInner)
        }
      })

      try {
        restoreTx(subtreeRows)
      } catch (error) {
        try {
          await movePath(dest, srcTrash, entryType)
        } catch (rollbackError) {
          logger.error('恢复回滚失败:', rollbackError)
        }
        throw error
      }

      return ok({
        success: true,
        originalPath: rawDest,
        restoredPath: dest,
        renamed: dest !== rawDest,
      })
    } catch (error) {
      logger.error('恢复合同文件失败:', error)
      return fail(error)
    } finally {
      db?.close()
    }
  },

  [channels.CONTRACT_FILES_PURGE]: async (_event, dto: unknown): Promise<IpcResponse<{ success: boolean }>> => {
    let db: Database.Database | null = null
    try {
      const payload = dto as ContractFilePurgeDTO
      const libraryPath = String(payload.libraryPath || '').trim()
      const fileId = String(payload.fileId || '').trim()
      if (!libraryPath) return fail(new Error('资源库路径不能为空'))
      if (!fileId) return fail(new Error('文件ID不能为空'))

      db = openLibraryDb(libraryPath)
      const row = db.prepare('SELECT * FROM contract_files WHERE file_id = ? LIMIT 1').get(fileId) as any | undefined
      if (!row) return fail(new Error('文件记录不存在'))
      if (!row.deleted_at) return fail(new Error('仅支持彻底删除回收站中的文件'))

      const contractId = String(row.contract_id || '')
      const meta = getContractMeta(db, contractId)
      const libraryRoot = path.resolve(libraryPath)
      const contractDir = path.join(libraryRoot, meta.folderName)
      const entryType = (String(row.type || 'file') as ContractFileRecordType)
      const trashContractBase = path.join(libraryRoot, '.trash', 'files', meta.folderName)

      const rootTrash = String(row.trash_path || '').trim()
      if (!rootTrash) return fail(new Error('回收站路径为空'))
      ensurePathWithin(trashContractBase, rootTrash)

      const rootTrashNorm = entryType === 'folder' ? rootTrash.replace(/[\\/]+$/g, '') : rootTrash
      const subtreeRows = (() => {
        if (entryType !== 'folder') return [row]
        const likePrefix = rootTrashNorm + path.sep + '%'
        return db!.prepare('SELECT * FROM contract_files WHERE contract_id = ? AND deleted_at IS NOT NULL AND (trash_path = ? OR trash_path LIKE ?)')
          .all(contractId, rootTrashNorm, likePrefix) as any[]
      })()

      const subtreeIds = subtreeRows.map(r => String(r.file_id || '').trim()).filter(Boolean)
      const subtreeOriginalPaths = Array.from(new Set(subtreeRows.map(r => String(r.original_path || '').trim()).filter(Boolean)))
      const subtreeThumbCandidates = Array.from(new Set(
        subtreeRows
          .map(r => (r.first_page_thumb ? String(r.first_page_thumb) : ''))
          .map(v => String(v || '').trim())
          .filter(v => v && !v.startsWith('data:')),
      ))

      const pendingDir = path.join(libraryRoot, '.trash', '.purge_pending', ulid())
      await ensureDir(pendingDir)
      const pendingPath = path.join(pendingDir, path.basename(rootTrashNorm))
      const pendingFinal = await makeUniquePath(pendingPath)

      if (!fs.existsSync(rootTrashNorm)) return fail(new Error('回收站文件不存在'))
      await movePath(rootTrashNorm, pendingFinal, entryType)

      const deleteTx = db.transaction((rowsToDelete: any[]) => {
        const ids = rowsToDelete.map(r => String(r.file_id || '').trim()).filter(Boolean)
        if (ids.length === 0) return
        const placeholders = ids.map(() => '?').join(',')
        db!.prepare(`DELETE FROM contract_files WHERE file_id IN (${placeholders})`).run(...ids)
      })

      try {
        deleteTx(subtreeRows)
      } catch (error) {
        try {
          await movePath(pendingFinal, rootTrashNorm, entryType)
        } catch (rollbackError) {
          logger.error('彻底删除回滚失败:', rollbackError)
        }
        throw error
      }

      try {
        if (entryType === 'folder') {
          await fs.promises.rm(pendingFinal, { recursive: true, force: true })
        } else {
          await fs.promises.rm(pendingFinal, { force: true })
        }
      } catch (error) {
        try {
          const restoreTx = db.transaction((rowsToRestore: any[]) => {
            const stmt = db!.prepare(`
              INSERT INTO contract_files (
                file_id,
                contract_id,
                contract_no,
                path,
                original_path,
                trash_path,
                name,
                name_upper,
                type,
                size,
                mtime,
                sha256,
                first_page_thumb,
                preview_status,
                deleted_at,
                created_at,
                updated_at
              ) VALUES (
                ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
              )
            `)
            for (const r of rowsToRestore) {
              stmt.run(
                String(r.file_id || ''),
                String(r.contract_id || ''),
                String(r.contract_no || ''),
                String(r.path || ''),
                String(r.original_path || ''),
                String(r.trash_path || ''),
                String(r.name || ''),
                String(r.name_upper || ''),
                String(r.type || ''),
                r.size === null || r.size === undefined ? null : Number(r.size),
                r.mtime === null || r.mtime === undefined ? null : Number(r.mtime),
                r.sha256 ? String(r.sha256) : null,
                r.first_page_thumb ? String(r.first_page_thumb) : null,
                r.preview_status ? String(r.preview_status) : null,
                r.deleted_at ? String(r.deleted_at) : null,
                r.created_at ? String(r.created_at) : null,
                r.updated_at ? String(r.updated_at) : null,
              )
            }
          })
          restoreTx(subtreeRows)
        } catch (restoreDbError) {
          logger.error('彻底删除失败且回滚 DB 失败:', restoreDbError)
          throw error
        }
        try {
          await movePath(pendingFinal, rootTrashNorm, entryType)
        } catch (restoreFsError) {
          logger.error('彻底删除失败且回滚文件失败:', restoreFsError)
        }
        throw error
      }

      try {
        const chunk = <T>(items: T[], size: number) => {
          const out: T[][] = []
          for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
          return out
        }
        if (subtreeIds.length > 0) {
          for (const batch of chunk(subtreeIds, 900)) {
            const placeholders = batch.map(() => '?').join(',')
            db.prepare(`DELETE FROM contract_ai_log WHERE file_id IN (${placeholders})`).run(...batch)
            if (hasTable(db, 'contract_vector_chunks')) {
              db.prepare(`DELETE FROM contract_vector_chunks WHERE file_id IN (${placeholders})`).run(...batch)
            }
          }
        }
        if (subtreeOriginalPaths.length > 0) {
          for (const batch of chunk(subtreeOriginalPaths, 800)) {
            const placeholders = batch.map(() => '?').join(',')
            db.prepare(`DELETE FROM file_content_fts WHERE file_path IN (${placeholders})`).run(...batch)
            db.prepare(`DELETE FROM file_metadata WHERE file_path IN (${placeholders})`).run(...batch)
          }
        }
        if (subtreeThumbCandidates.length > 0) {
          const usedStmt = db.prepare('SELECT COUNT(1) as c FROM contract_files WHERE contract_id = ? AND first_page_thumb = ?')
          for (const thumbPath of subtreeThumbCandidates) {
            try {
              ensurePathWithin(contractDir, thumbPath)
              const usedRow = usedStmt.get(contractId, thumbPath) as { c?: number } | undefined
              const count = Number(usedRow?.c || 0)
              if (count === 0 && fs.existsSync(thumbPath)) {
                await fs.promises.rm(thumbPath, { force: true })
              }
            } catch {
            }
          }
        }
      } catch (cleanupError) {
        try {
          logger.warn('彻底删除成功但派生数据清理失败', {
            fileId,
            error: cleanupError instanceof Error ? cleanupError.message : String(cleanupError || ''),
          })
        } catch {
        }
      }

      return ok({ success: true })
    } catch (error) {
      logger.error('彻底删除合同文件失败:', error)
      return fail(error)
    } finally {
      db?.close()
    }
  },

  [channels.CONTRACT_FILES_COPY]: async (_event, dto: unknown): Promise<IpcResponse<{ record: ContractFileRecord }>> => {
    let db: Database.Database | null = null
    try {
      const payload = dto as ContractFileCopyDTO
      const libraryPath = String(payload.libraryPath || '').trim()
      const fileId = String(payload.fileId || '').trim()
      if (!libraryPath) return fail(new Error('资源库路径不能为空'))
      if (!fileId) return fail(new Error('文件ID不能为空'))

      db = openLibraryDb(libraryPath)
      const row = db.prepare('SELECT * FROM contract_files WHERE file_id = ? LIMIT 1').get(fileId) as any | undefined
      if (!row) return fail(new Error('文件记录不存在'))
      if (String(row.type || '') !== 'file') return fail(new Error('仅支持复制文件'))

      const contractId = String(row.contract_id || '')
      const meta = getContractMeta(db, contractId)
      const contractDir = path.join(path.resolve(libraryPath), meta.folderName)

      const srcPath = String(row.path || '')
      ensurePathWithin(contractDir, srcPath)

      const dir = path.dirname(srcPath)
      const ext = path.extname(srcPath)
      const base = path.basename(srcPath, ext)

      let target = path.join(dir, `${base} - 副本${ext}`)
      let index = 2
      while (fs.existsSync(target)) {
        target = path.join(dir, `${base} - 副本 (${index})${ext}`)
        index += 1
      }

      fs.copyFileSync(srcPath, target)
      const stat = fs.statSync(target)
      const hash = await sha256File(target)

      const newId = ulid()
      db.prepare(`
        INSERT INTO contract_files (
          file_id, contract_id, contract_no, path, name, name_upper, type, size, mtime, sha256, first_page_thumb, preview_status
        ) VALUES (?, ?, ?, ?, ?, ?, 'file', ?, ?, ?, ?, ?)
      `).run(
        newId,
        contractId,
        String(row.contract_no || ''),
        target,
        path.basename(target),
        path.basename(target).toUpperCase(),
        stat.size,
        Number(stat.mtimeMs),
        hash,
        row.first_page_thumb ? String(row.first_page_thumb) : null,
        row.preview_status ? String(row.preview_status) : null,
      )

      const created = db.prepare('SELECT * FROM contract_files WHERE file_id = ? LIMIT 1').get(newId) as any
      return ok({ record: toRecord(created) })
    } catch (error) {
      logger.error('复制合同文件失败:', error)
      return fail(error)
    } finally {
      db?.close()
    }
  },

  [channels.CONTRACT_FILES_MOVE]: async (_event, dto: unknown): Promise<IpcResponse<ContractFileMoveResult>> => {
    let db: Database.Database | null = null
    try {
      const payload = dto as ContractFileMoveDTO
      const libraryPath = String(payload.libraryPath || '').trim()
      const targetContractId = String(payload.targetContractId || '').trim()
      const targetDirPathInput = String(payload.targetDirPath || '').trim()
      const conflictStrategy = (
        payload.conflictStrategy === 'skip' ||
        payload.conflictStrategy === 'replace' ||
        payload.conflictStrategy === 'keep-both' ||
        payload.conflictStrategy === 'rename'
      )
        ? payload.conflictStrategy
        : 'rename'
      const fileIds = Array.from(new Set((Array.isArray(payload.fileIds) ? payload.fileIds : []).map(v => String(v || '').trim()).filter(Boolean)))
      if (!libraryPath) return fail(new Error('资源库路径不能为空'))
      if (!targetContractId) return fail(new Error('目标合同不能为空'))
      if (!targetDirPathInput) return fail(new Error('目标文件夹不能为空'))
      if (fileIds.length === 0) return fail(new Error('请选择要移动的文件或文件夹'))

      db = openLibraryDb(libraryPath)
      const libraryRoot = path.resolve(libraryPath)
      const targetMeta = getContractMeta(db, targetContractId)
      const targetContractDir = path.join(libraryRoot, targetMeta.folderName)
      const targetDocumentsDir = path.join(targetContractDir, 'documents')
      const targetDirPath = normalizePath(targetDirPathInput)
      ensurePathWithin(targetContractDir, targetDirPath)
      ensurePathWithin(targetDocumentsDir, targetDirPath)
      if (!fs.existsSync(targetDirPath) || !fs.statSync(targetDirPath).isDirectory()) {
        return fail(new Error('目标文件夹不存在'))
      }

      const placeholders = fileIds.map(() => '?').join(',')
      const selectedRows = db.prepare(`SELECT * FROM contract_files WHERE file_id IN (${placeholders})`).all(...fileIds) as any[]
      if (selectedRows.length !== fileIds.length) {
        return fail(new Error('部分文件记录不存在，请刷新后重试'))
      }
      if (selectedRows.some(r => !!String(r.deleted_at || '').trim())) {
        return fail(new Error('回收站中的项目不支持移动'))
      }

      // 当文件夹与其子项同时被选中时，仅保留最上层项，避免重复移动。
      const selectedFolderPaths = selectedRows
        .filter(r => String(r.type || '') === 'folder')
        .map(r => normalizePath(String(r.path || '')))
      const topLevelRows = selectedRows.filter((r) => {
        const p = normalizePath(String(r.path || ''))
        for (const folderPath of selectedFolderPaths) {
          if (folderPath === p) continue
          if (isSameOrSubPath(folderPath, p)) return false
        }
        return true
      })

      const resultItems: ContractFileMoveItemResult[] = []
      const sourceMetaCache = new Map<string, { contractId: string; contractNo: string; folderName: string; contractName: string }>()

      for (const row of topLevelRows) {
        const fileId = String(row.file_id || '').trim()
        const sourcePath = normalizePath(String(row.path || ''))
        const entryType = (String(row.type || 'file') as ContractFileRecordType)
        const sourceContractId = String(row.contract_id || '').trim()
        if (!fileId || !sourcePath || !sourceContractId) {
          resultItems.push({ fileId, fromPath: sourcePath, status: 'failed', reason: '记录数据不完整' })
          continue
        }

        const sourceMeta = (() => {
          const cached = sourceMetaCache.get(sourceContractId)
          if (cached) return cached
          const created = getContractMeta(db!, sourceContractId)
          sourceMetaCache.set(sourceContractId, created)
          return created
        })()
        const sourceContractDir = path.join(libraryRoot, sourceMeta.folderName)
        const sourceDocumentsDir = path.join(sourceContractDir, 'documents')

        try {
          ensurePathWithin(sourceContractDir, sourcePath)
          ensurePathWithin(sourceDocumentsDir, sourcePath)
        } catch (error) {
          resultItems.push({
            fileId,
            fromPath: sourcePath,
            status: 'failed',
            reason: error instanceof Error ? error.message : '源路径不合法',
          })
          continue
        }

        if (!fs.existsSync(sourcePath)) {
          resultItems.push({ fileId, fromPath: sourcePath, status: 'failed', reason: '源文件不存在' })
          continue
        }

        if (entryType === 'folder' && isSameOrSubPath(sourcePath, targetDirPath)) {
          resultItems.push({ fileId, fromPath: sourcePath, status: 'failed', reason: '不能移动到自身或子目录' })
          continue
        }

        const oldFolderPath = entryType === 'folder' ? sourcePath.replace(/[\\/]+$/g, '') : sourcePath
        const subtreeRows = (() => {
          if (entryType !== 'folder') return [row]
          const likePrefix = oldFolderPath + path.sep + '%'
          return db!.prepare('SELECT * FROM contract_files WHERE contract_id = ? AND deleted_at IS NULL AND (path = ? OR path LIKE ?)')
            .all(sourceContractId, oldFolderPath, likePrefix) as any[]
        })()

        let targetPathRaw = path.join(targetDirPath, path.basename(sourcePath))
        let destinationPath = targetPathRaw
        let replaced = false
        const conflictOnRawTarget =
          fs.existsSync(targetPathRaw) ||
          pathExistsInDb(db, targetContractId, targetPathRaw, subtreeRows.map(r => String(r.file_id || '')))

        if (conflictOnRawTarget) {
          if (conflictStrategy === 'skip') {
            resultItems.push({ fileId, fromPath: sourcePath, status: 'skipped', reason: '目标已存在' })
            continue
          }
          if (conflictStrategy === 'replace') {
            try {
              deleteConflictTargetRows(
                db,
                targetContractId,
                targetPathRaw,
                subtreeRows.map(r => String(r.file_id || '')),
              )
              if (fs.existsSync(targetPathRaw)) {
                await fs.promises.rm(targetPathRaw, { recursive: true, force: true })
              }
              destinationPath = targetPathRaw
              replaced = true
            } catch (error) {
              resultItems.push({
                fileId,
                fromPath: sourcePath,
                status: 'failed',
                reason: error instanceof Error ? error.message : '清理目标冲突失败',
              })
              continue
            }
          } else {
            destinationPath = await makeUniqueTargetPathWithDb(
              db,
              targetContractId,
              targetPathRaw,
              subtreeRows.map(r => String(r.file_id || '')),
            )
          }
        }

        let moved = false
        try {
          await movePath(sourcePath, destinationPath, entryType)
          moved = true
        } catch (error) {
          resultItems.push({
            fileId,
            fromPath: sourcePath,
            status: 'failed',
            reason: error instanceof Error ? error.message : '移动文件失败',
          })
          continue
        }

        const destinationFolderPath = entryType === 'folder' ? destinationPath.replace(/[\\/]+$/g, '') : destinationPath
        const sourceContractChanged = sourceContractId !== targetContractId

        const updateTx = db.transaction((rowsToUpdate: any[]) => {
          const stmt = db!.prepare(`
            UPDATE contract_files
            SET
              contract_id = ?,
              contract_no = ?,
              path = ?,
              name = ?,
              name_upper = ?,
              first_page_thumb = ?,
              preview_status = ?,
              updated_at = CURRENT_TIMESTAMP
            WHERE file_id = ?
          `)
          for (const r of rowsToUpdate) {
            const id = String(r.file_id || '').trim()
            if (!id) continue
            const oldPath = String(r.path || '')
            let nextPath = destinationPath
            if (entryType === 'folder') {
              const rel = path.relative(oldFolderPath, oldPath)
              nextPath = path.join(destinationFolderPath, rel)
            }
            const nextName = path.basename(nextPath)
            stmt.run(
              targetContractId,
              targetMeta.contractNo,
              nextPath,
              nextName,
              nextName.toUpperCase(),
              sourceContractChanged ? null : r.first_page_thumb ? String(r.first_page_thumb) : null,
              sourceContractChanged ? 'pending' : r.preview_status ? String(r.preview_status) : null,
              id,
            )
          }
        })

        try {
          updateTx(subtreeRows)
          resultItems.push({
            fileId,
            fromPath: sourcePath,
            toPath: destinationPath,
            status: 'moved',
            renamed: destinationPath !== targetPathRaw,
            replaced,
          })
        } catch (error) {
          if (moved) {
            try {
              await movePath(destinationPath, sourcePath, entryType)
            } catch (rollbackError) {
              logger.error('移动合同文件回滚失败:', rollbackError)
            }
          }
          resultItems.push({
            fileId,
            fromPath: sourcePath,
            status: 'failed',
            reason: error instanceof Error ? error.message : '更新文件记录失败',
          })
        }
      }

      const moved = resultItems.filter(it => it.status === 'moved').length
      const skipped = resultItems.filter(it => it.status === 'skipped').length
      const failed = resultItems.filter(it => it.status === 'failed').length
      return ok({ moved, skipped, failed, items: resultItems })
    } catch (error) {
      logger.error('移动合同文件失败:', error)
      return fail(error)
    } finally {
      db?.close()
    }
  },

  [channels.CONTRACT_FILES_CREATE_FOLDER]: async (_event, dto: unknown): Promise<IpcResponse<{ record: ContractFileRecord }>> => {
    let db: Database.Database | null = null
    try {
      const payload = dto as ContractFileCreateFolderDTO
      const libraryPath = String(payload.libraryPath || '').trim()
      const contractId = String(payload.contractId || '').trim()
      const contractNo = String(payload.contractNo || '').trim()
      const parentPath = String(payload.parentPath || '').trim()
      const folderName = String(payload.folderName || '').trim()
      if (!libraryPath) return fail(new Error('资源库路径不能为空'))
      if (!contractId) return fail(new Error('合同ID不能为空'))
      if (!contractNo) return fail(new Error('合同编号不能为空'))
      if (!parentPath) return fail(new Error('父目录不能为空'))
      if (!folderName) return fail(new Error('文件夹名称不能为空'))
      ensureValidEntryName(folderName)

      db = openLibraryDb(libraryPath)
      const meta = getContractMeta(db, contractId)
      if (meta.contractNo !== contractNo) return fail(new Error('合同编号不匹配'))

      const contractDir = path.join(path.resolve(libraryPath), meta.folderName)
      ensurePathWithin(contractDir, parentPath)

      const newPath = path.join(parentPath, folderName)
      ensurePathWithin(contractDir, newPath)
      if (fs.existsSync(newPath)) return fail(new Error('文件夹已存在'))

      fs.mkdirSync(newPath, { recursive: false })

      const id = ulid()
      db.prepare(`
        INSERT INTO contract_files (
          file_id, contract_id, contract_no, path, name, name_upper, type, size, mtime, sha256, first_page_thumb, preview_status
        ) VALUES (?, ?, ?, ?, ?, ?, 'folder', NULL, ?, NULL, NULL, NULL)
      `).run(
        id,
        contractId,
        contractNo,
        newPath,
        folderName,
        folderName.toUpperCase(),
        Date.now(),
      )

      const created = db.prepare('SELECT * FROM contract_files WHERE file_id = ? LIMIT 1').get(id) as any
      return ok({ record: toRecord(created) })
    } catch (error) {
      logger.error('新增文件夹失败:', error)
      return fail(error)
    } finally {
      db?.close()
    }
  },

  [channels.CONTRACT_FILES_RENAME]: async (_event, dto: unknown): Promise<IpcResponse<{ record: ContractFileRecord }>> => {
    let db: Database.Database | null = null
    try {
      const payload = dto as ContractFileRenameDTO
      const libraryPath = String(payload.libraryPath || '').trim()
      const fileId = String(payload.fileId || '').trim()
      const newName = String(payload.newName || '').trim()
      if (!libraryPath) return fail(new Error('资源库路径不能为空'))
      if (!fileId) return fail(new Error('文件ID不能为空'))
      if (!newName) return fail(new Error('新名称不能为空'))
      ensureValidEntryName(newName)

      db = openLibraryDb(libraryPath)
      const row = db.prepare('SELECT * FROM contract_files WHERE file_id = ? LIMIT 1').get(fileId) as any | undefined
      if (!row) return fail(new Error('文件记录不存在'))

      const contractId = String(row.contract_id || '')
      const meta = getContractMeta(db, contractId)
      const contractDir = path.join(path.resolve(libraryPath), meta.folderName)

      const oldPath = String(row.path || '')
      ensurePathWithin(contractDir, oldPath)

      const parentDir = path.dirname(oldPath)
      const newPath = path.join(parentDir, newName)
      ensurePathWithin(contractDir, newPath)

      if (!fs.existsSync(oldPath)) return fail(new Error('源文件/文件夹不存在'))
      if (fs.existsSync(newPath)) return fail(new Error('目标已存在'))

      const type = String(row.type || 'file')
      fs.renameSync(oldPath, newPath)

      const tx = db.transaction(() => {
        const stat = fs.statSync(newPath)
        const mtime = Number(stat.mtimeMs)
        if (type === 'folder') {
          const oldPrefix = oldPath.replace(/[\\/]+$/g, '')
          const newPrefix = newPath.replace(/[\\/]+$/g, '')
          const childLike = oldPrefix + path.sep + '%'
          const affected = db!.prepare('SELECT file_id, path FROM contract_files WHERE contract_id = ? AND (path = ? OR path LIKE ?)').all(contractId, oldPrefix, childLike) as Array<{ file_id: string; path: string }>
          const updatePathStmt = db!.prepare('UPDATE contract_files SET path = ?, updated_at = CURRENT_TIMESTAMP WHERE file_id = ?')
          for (const r of affected) {
            const p = String(r.path || '')
            let nextPath = p
            if (p === oldPrefix) {
              nextPath = newPrefix
            } else if (p.startsWith(oldPrefix + path.sep)) {
              nextPath = newPrefix + p.slice(oldPrefix.length)
            }
            updatePathStmt.run(nextPath, r.file_id)
          }
          db!.prepare(`
            UPDATE contract_files
            SET name = ?, name_upper = ?, mtime = ?, updated_at = CURRENT_TIMESTAMP
            WHERE file_id = ?
          `).run(newName, newName.toUpperCase(), mtime, fileId)
        } else {
          db!.prepare(`
            UPDATE contract_files
            SET path = ?, name = ?, name_upper = ?, size = ?, mtime = ?, updated_at = CURRENT_TIMESTAMP
            WHERE file_id = ?
          `).run(newPath, newName, newName.toUpperCase(), stat.size, mtime, fileId)
        }
      })

      tx()

      const updated = db.prepare('SELECT * FROM contract_files WHERE file_id = ? LIMIT 1').get(fileId) as any
      return ok({ record: toRecord(updated) })
    } catch (error) {
      logger.error('重命名合同文件失败:', error)
      return fail(error)
    } finally {
      db?.close()
    }
  },
}
