import * as fs from 'fs'
import * as path from 'path'
import Database from 'better-sqlite3'
import * as channels from '../../../channels'
import { ok, fail, IpcResponse } from '../../../../../shared/types/ipc.types'
import type {
  OtherFileCopyDTO,
  OtherFileCreateFolderDTO,
  OtherFileDeleteDTO,
  OtherFileMoveDTO,
  OtherFileMoveItemResult,
  OtherFileMoveResult,
  OtherFilePurgeDTO,
  OtherFileRecord,
  OtherFileRecordType,
  OtherFileRenameDTO,
  OtherFileRestoreDTO,
  OtherFileRestoreResult,
} from '../../../../../shared/types/otherFile.types'
import {
  OtherFileHandlerMap,
  deletePathSafely,
  ensurePathWithin,
  ensureValidEntryName,
  getOtherFilesRootDir,
  getOtherFilesTrashRootDir,
  logger,
  makeUniquePath,
  movePath,
  openLibraryDb,
  sha256File,
  toRecord,
  ulid,
} from './shared'

const normalizePath = (value: string) => path.resolve(String(value || '').trim())

const isSameOrSubPath = (parentPath: string, targetPath: string) => {
  const parent = normalizePath(parentPath)
  const target = normalizePath(targetPath)
  if (parent === target) return true
  const rel = path.relative(parent, target)
  return !!rel && !rel.startsWith('..') && !path.isAbsolute(rel)
}

const pathExistsInDb = (
  db: Database.Database,
  pathValue: string,
  excludeFileIds: string[],
) => {
  const baseSql = [
    'SELECT 1 AS ok FROM other_files',
    'WHERE deleted_at IS NULL AND path = ?',
  ]
  const args: any[] = [pathValue]
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
  rawTargetPath: string,
  excludeFileIds: string[],
) => {
  const ext = path.extname(rawTargetPath)
  const baseName = path.basename(rawTargetPath, ext)
  const parentDir = path.dirname(rawTargetPath)
  let candidate = rawTargetPath
  let index = 2
  while (fs.existsSync(candidate) || pathExistsInDb(db, candidate, excludeFileIds)) {
    candidate = path.join(parentDir, `${baseName} (${index})${ext}`)
    index += 1
  }
  return candidate
}

const deleteConflictTargetRows = (
  db: Database.Database,
  targetPath: string,
  excludeFileIds: string[],
) => {
  const normalizedTarget = normalizePath(targetPath).replace(/[\\/]+$/g, '')
  const likePrefix = normalizedTarget + path.sep + '%'
  const excluded = excludeFileIds.filter(Boolean)
  const sql = [
    'SELECT file_id FROM other_files',
    'WHERE deleted_at IS NULL AND (path = ? OR path LIKE ?)',
  ]
  const args: any[] = [normalizedTarget, likePrefix]
  if (excluded.length > 0) {
    sql.push(`AND file_id NOT IN (${excluded.map(() => '?').join(',')})`)
    args.push(...excluded)
  }
  const rows = db.prepare(sql.join(' ')).all(...args) as Array<{ file_id?: string }>
  const ids = rows.map((row) => String(row.file_id || '').trim()).filter(Boolean)
  if (ids.length === 0) return
  const placeholders = ids.map(() => '?').join(',')
  db.prepare(`DELETE FROM other_files WHERE file_id IN (${placeholders})`).run(...ids)
}

export const otherFileMutationHandlers: OtherFileHandlerMap = {
  [channels.OTHER_FILES_DELETE]: async (_event, dto: unknown): Promise<IpcResponse<{ success: boolean }>> => {
    let db: Database.Database | null = null
    try {
      const payload = dto as OtherFileDeleteDTO
      const libraryPath = String(payload.libraryPath || '').trim()
      const fileId = String(payload.fileId || '').trim()
      if (!libraryPath) return fail(new Error('资源库路径不能为空'))
      if (!fileId) return fail(new Error('文件ID不能为空'))

      db = openLibraryDb(libraryPath)
      const row = db.prepare('SELECT * FROM other_files WHERE file_id = ? LIMIT 1').get(fileId) as any | undefined
      if (!row) return fail(new Error('文件记录不存在'))
      if (row.deleted_at) return fail(new Error('文件已在回收站'))

      const libraryRoot = path.resolve(libraryPath)
      const rootDir = getOtherFilesRootDir(libraryPath)
      ensurePathWithin(libraryRoot, rootDir)

      const entryPath = String(row.path || '')
      ensurePathWithin(rootDir, entryPath)
      const entryType = (String(row.type || 'file') as OtherFileRecordType)
      const folderPath = entryType === 'folder' ? entryPath.replace(/[\\/]+$/g, '') : entryPath

      const trashBase = getOtherFilesTrashRootDir(libraryPath)
      let relFromRoot = path.relative(rootDir, path.resolve(entryPath))
      if (!relFromRoot || relFromRoot.startsWith('..') || path.isAbsolute(relFromRoot)) {
        relFromRoot = path.basename(entryPath)
      }
      const rawTrashRoot = path.join(trashBase, relFromRoot)
      const trashRoot = await makeUniquePath(rawTrashRoot)

      const subtreeRows = (() => {
        if (entryType !== 'folder') return [row]
        const likePrefix = folderPath + path.sep + '%'
        return db!.prepare('SELECT * FROM other_files WHERE deleted_at IS NULL AND (path = ? OR path LIKE ?)')
          .all(folderPath, likePrefix) as any[]
      })()

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

      if (!fs.existsSync(entryPath)) {
        const deleteTx = db.transaction((rowsToDelete: any[]) => {
          const ids = rowsToDelete.map(r => String(r.file_id || '').trim()).filter(Boolean)
          if (ids.length === 0) return
          const placeholders = ids.map(() => '?').join(',')
          db!.prepare(`DELETE FROM other_files WHERE file_id IN (${placeholders})`).run(...ids)
        })
        deleteTx(subtreeRows)
        return ok({ success: true })
      }

      await movePath(entryPath, trashRoot, entryType)

      const entryExt = path.extname(entryPath).toLowerCase()
      if (entryType === 'file' && entryExt === '.pdf') {
        const base = path.basename(entryPath, entryExt)
        const mdPath = path.join(path.dirname(entryPath), `${base}.md`)
        try {
          ensurePathWithin(rootDir, mdPath)
          if (fs.existsSync(mdPath)) {
            const existedInDb = db.prepare('SELECT 1 FROM other_files WHERE path = ? LIMIT 1').get(mdPath) as any
            if (!existedInDb) {
              const mdDestRaw = path.join(path.dirname(trashRoot), `${path.basename(trashRoot, path.extname(trashRoot))}.md`)
              const mdDest = await makeUniquePath(mdDestRaw)
              await movePath(mdPath, mdDest, 'file')
            }
          }
        } catch {
        }
      }

      const updateTx = db.transaction((rowsToUpdate: any[], opts: { folderPath: string; trashRoot: string; rootDir: string; trashBase: string }) => {
        const stmt = db!.prepare(`
          UPDATE other_files
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
          const relInTrash = path.relative(opts.trashBase, trashAbs)
          const virtualPath = path.join(opts.rootDir, '回收站', relInTrash)
          const nextName = path.basename(virtualPath)
          stmt.run(originalAbs, trashAbs, virtualPath, nextName, nextName.toUpperCase(), fileIdInner)
        }
      })

      try {
        updateTx(subtreeRows, { folderPath, trashRoot, rootDir, trashBase })
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
      logger.error('删除其他文件失败:', error)
      return fail(error)
    } finally {
      db?.close()
    }
  },

  [channels.OTHER_FILES_RESTORE]: async (_event, dto: unknown): Promise<IpcResponse<OtherFileRestoreResult>> => {
    let db: Database.Database | null = null
    try {
      const payload = dto as OtherFileRestoreDTO
      const libraryPath = String(payload.libraryPath || '').trim()
      const fileId = String(payload.fileId || '').trim()
      if (!libraryPath) return fail(new Error('资源库路径不能为空'))
      if (!fileId) return fail(new Error('文件ID不能为空'))

      db = openLibraryDb(libraryPath)
      const row = db.prepare('SELECT * FROM other_files WHERE file_id = ? LIMIT 1').get(fileId) as any | undefined
      if (!row) return fail(new Error('文件记录不存在'))
      if (!row.deleted_at) return fail(new Error('文件不在回收站中'))

      const libraryRoot = path.resolve(libraryPath)
      const rootDir = getOtherFilesRootDir(libraryPath)
      ensurePathWithin(libraryRoot, rootDir)

      const srcTrash = String(row.trash_path || '').trim()
      const rawDest = String(row.original_path || '').trim()
      if (!srcTrash) return fail(new Error('回收站路径为空'))
      if (!rawDest) return fail(new Error('原始路径为空'))
      const entryType = (String(row.type || 'file') as OtherFileRecordType)

      const trashBase = getOtherFilesTrashRootDir(libraryPath)
      ensurePathWithin(trashBase, srcTrash)
      ensurePathWithin(rootDir, rawDest)
      if (!fs.existsSync(srcTrash)) return fail(new Error('回收站文件不存在'))

      const dest = fs.existsSync(rawDest) ? await makeUniquePath(rawDest) : rawDest
      await movePath(srcTrash, dest, entryType)

      const trashRootNorm = entryType === 'folder' ? srcTrash.replace(/[\\/]+$/g, '') : srcTrash
      const destRootNorm = entryType === 'folder' ? dest.replace(/[\\/]+$/g, '') : dest
      const originalRootNorm = entryType === 'folder' ? rawDest.replace(/[\\/]+$/g, '') : rawDest

      const subtreeRows = (() => {
        if (entryType !== 'folder') return [row]
        const likePrefix = trashRootNorm + path.sep + '%'
        return db!.prepare('SELECT * FROM other_files WHERE deleted_at IS NOT NULL AND (trash_path = ? OR trash_path LIKE ?)')
          .all(trashRootNorm, likePrefix) as any[]
      })()

      const restoreTx = db.transaction((rowsToUpdate: any[]) => {
        const stmt = db!.prepare(`
          UPDATE other_files
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
      logger.error('恢复其他文件失败:', error)
      return fail(error)
    } finally {
      db?.close()
    }
  },

  [channels.OTHER_FILES_PURGE]: async (_event, dto: unknown): Promise<IpcResponse<{ success: boolean }>> => {
    let db: Database.Database | null = null
    try {
      const payload = dto as OtherFilePurgeDTO
      const libraryPath = String(payload.libraryPath || '').trim()
      const fileId = String(payload.fileId || '').trim()
      if (!libraryPath) return fail(new Error('资源库路径不能为空'))
      if (!fileId) return fail(new Error('文件ID不能为空'))

      db = openLibraryDb(libraryPath)
      const row = db.prepare('SELECT * FROM other_files WHERE file_id = ? LIMIT 1').get(fileId) as any | undefined
      if (!row) return fail(new Error('文件记录不存在'))
      if (!row.deleted_at) return fail(new Error('仅支持彻底删除回收站中的文件'))

      const libraryRoot = path.resolve(libraryPath)
      const trashBase = getOtherFilesTrashRootDir(libraryPath)
      const srcTrash = String(row.trash_path || '').trim()
      if (!srcTrash) return fail(new Error('回收站路径为空'))
      ensurePathWithin(trashBase, srcTrash)

      const entryType = (String(row.type || 'file') as OtherFileRecordType)
      const trashRootNorm = entryType === 'folder' ? srcTrash.replace(/[\\/]+$/g, '') : srcTrash

      const subtreeRows = (() => {
        if (entryType !== 'folder') return [row]
        const likePrefix = trashRootNorm + path.sep + '%'
        return db!.prepare('SELECT * FROM other_files WHERE deleted_at IS NOT NULL AND (trash_path = ? OR trash_path LIKE ?)')
          .all(trashRootNorm, likePrefix) as any[]
      })()

      try {
        await deletePathSafely(srcTrash)
      } catch {
      }

      const deleteTx = db.transaction((rowsToDelete: any[]) => {
        const ids = rowsToDelete.map(r => String(r.file_id || '').trim()).filter(Boolean)
        if (ids.length === 0) return
        const placeholders = ids.map(() => '?').join(',')
        db!.prepare(`DELETE FROM other_files WHERE file_id IN (${placeholders})`).run(...ids)
      })
      deleteTx(subtreeRows)

      return ok({ success: true })
    } catch (error) {
      logger.error('彻底删除其他文件失败:', error)
      return fail(error)
    } finally {
      db?.close()
    }
  },

  [channels.OTHER_FILES_COPY]: async (_event, dto: unknown): Promise<IpcResponse<{ record: OtherFileRecord }>> => {
    let db: Database.Database | null = null
    try {
      const payload = dto as OtherFileCopyDTO
      const libraryPath = String(payload.libraryPath || '').trim()
      const fileId = String(payload.fileId || '').trim()
      if (!libraryPath) return fail(new Error('资源库路径不能为空'))
      if (!fileId) return fail(new Error('文件ID不能为空'))

      db = openLibraryDb(libraryPath)
      const row = db.prepare('SELECT * FROM other_files WHERE file_id = ? LIMIT 1').get(fileId) as any | undefined
      if (!row) return fail(new Error('文件记录不存在'))
      if (String(row.type || '') !== 'file') return fail(new Error('仅支持复制文件'))
      if (String(row.deleted_at || '').trim()) return fail(new Error('回收站中的文件不支持复制'))

      const rootDir = getOtherFilesRootDir(libraryPath)
      const srcPath = String(row.path || '')
      ensurePathWithin(rootDir, srcPath)

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
        INSERT INTO other_files (
          file_id, path, name, name_upper, type, size, mtime, sha256, first_page_thumb, preview_status
        ) VALUES (?, ?, ?, ?, 'file', ?, ?, ?, ?, ?)
      `).run(
        newId,
        target,
        path.basename(target),
        path.basename(target).toUpperCase(),
        stat.size,
        Number(stat.mtimeMs),
        hash,
        row.first_page_thumb ? String(row.first_page_thumb) : null,
        row.preview_status ? String(row.preview_status) : null,
      )

      const created = db.prepare('SELECT * FROM other_files WHERE file_id = ? LIMIT 1').get(newId) as any
      return ok({ record: toRecord(created) })
    } catch (error) {
      logger.error('复制其他文件失败:', error)
      return fail(error)
    } finally {
      db?.close()
    }
  },

  [channels.OTHER_FILES_MOVE]: async (_event, dto: unknown): Promise<IpcResponse<OtherFileMoveResult>> => {
    let db: Database.Database | null = null
    try {
      const payload = dto as OtherFileMoveDTO
      const libraryPath = String(payload.libraryPath || '').trim()
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
      if (!targetDirPathInput) return fail(new Error('目标文件夹不能为空'))
      if (fileIds.length === 0) return fail(new Error('请选择要移动的文件或文件夹'))

      db = openLibraryDb(libraryPath)
      const libraryRoot = path.resolve(libraryPath)
      const rootDir = getOtherFilesRootDir(libraryPath)
      ensurePathWithin(libraryRoot, rootDir)

      const targetDirPath = normalizePath(targetDirPathInput)
      ensurePathWithin(rootDir, targetDirPath)
      if (!fs.existsSync(targetDirPath) || !fs.statSync(targetDirPath).isDirectory()) {
        return fail(new Error('目标文件夹不存在'))
      }

      const placeholders = fileIds.map(() => '?').join(',')
      const selectedRows = db.prepare(`SELECT * FROM other_files WHERE file_id IN (${placeholders})`).all(...fileIds) as any[]
      if (selectedRows.length !== fileIds.length) {
        return fail(new Error('部分文件记录不存在，请刷新后重试'))
      }
      if (selectedRows.some(r => !!String(r.deleted_at || '').trim())) {
        return fail(new Error('回收站中的项目不支持移动'))
      }

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

      const resultItems: OtherFileMoveItemResult[] = []

      for (const row of topLevelRows) {
        const fileId = String(row.file_id || '').trim()
        const sourcePath = normalizePath(String(row.path || ''))
        const entryType = (String(row.type || 'file') as OtherFileRecordType)
        if (!fileId || !sourcePath) {
          resultItems.push({ fileId, fromPath: sourcePath, status: 'failed', reason: '记录数据不完整' })
          continue
        }

        try {
          ensurePathWithin(rootDir, sourcePath)
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
          return db!.prepare('SELECT * FROM other_files WHERE deleted_at IS NULL AND (path = ? OR path LIKE ?)')
            .all(oldFolderPath, likePrefix) as any[]
        })()

        let targetPathRaw = path.join(targetDirPath, path.basename(sourcePath))
        let destinationPath = targetPathRaw
        let replaced = false
        const conflictOnRawTarget =
          fs.existsSync(targetPathRaw) ||
          pathExistsInDb(db, targetPathRaw, subtreeRows.map(r => String(r.file_id || '')))

        if (conflictOnRawTarget) {
          if (conflictStrategy === 'skip') {
            resultItems.push({ fileId, fromPath: sourcePath, status: 'skipped', reason: '目标已存在' })
            continue
          }
          if (conflictStrategy === 'replace') {
            try {
              deleteConflictTargetRows(
                db,
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

        const updateTx = db.transaction((rowsToUpdate: any[]) => {
          const stmt = db!.prepare(`
            UPDATE other_files
            SET
              path = ?,
              name = ?,
              name_upper = ?,
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
            stmt.run(nextPath, nextName, nextName.toUpperCase(), id)
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
              logger.error('移动其他文件回滚失败:', rollbackError)
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

      const movedCount = resultItems.filter(it => it.status === 'moved').length
      const skipped = resultItems.filter(it => it.status === 'skipped').length
      const failed = resultItems.filter(it => it.status === 'failed').length
      return ok({ moved: movedCount, skipped, failed, items: resultItems })
    } catch (error) {
      logger.error('移动其他文件失败:', error)
      return fail(error)
    } finally {
      db?.close()
    }
  },

  [channels.OTHER_FILES_CREATE_FOLDER]: async (_event, dto: unknown): Promise<IpcResponse<{ record: OtherFileRecord }>> => {
    let db: Database.Database | null = null
    try {
      const payload = dto as OtherFileCreateFolderDTO
      const libraryPath = String(payload.libraryPath || '').trim()
      const parentPath = String(payload.parentPath || '').trim()
      const folderName = String(payload.folderName || '').trim()
      if (!libraryPath) return fail(new Error('资源库路径不能为空'))
      if (!parentPath) return fail(new Error('父目录不能为空'))
      if (!folderName) return fail(new Error('文件夹名称不能为空'))
      ensureValidEntryName(folderName)

      db = openLibraryDb(libraryPath)
      const rootDir = getOtherFilesRootDir(libraryPath)
      ensurePathWithin(rootDir, parentPath)

      const newPath = path.join(parentPath, folderName)
      ensurePathWithin(rootDir, newPath)
      if (fs.existsSync(newPath)) return fail(new Error('文件夹已存在'))

      fs.mkdirSync(newPath, { recursive: false })

      const id = ulid()
      db.prepare(`
        INSERT INTO other_files (
          file_id, path, name, name_upper, type, size, mtime, sha256, first_page_thumb, preview_status
        ) VALUES (?, ?, ?, ?, 'folder', NULL, ?, NULL, NULL, NULL)
      `).run(
        id,
        newPath,
        folderName,
        folderName.toUpperCase(),
        Date.now(),
      )

      const created = db.prepare('SELECT * FROM other_files WHERE file_id = ? LIMIT 1').get(id) as any
      return ok({ record: toRecord(created) })
    } catch (error) {
      logger.error('新增文件夹失败:', error)
      return fail(error)
    } finally {
      db?.close()
    }
  },

  [channels.OTHER_FILES_RENAME]: async (_event, dto: unknown): Promise<IpcResponse<{ record: OtherFileRecord }>> => {
    let db: Database.Database | null = null
    try {
      const payload = dto as OtherFileRenameDTO
      const libraryPath = String(payload.libraryPath || '').trim()
      const fileId = String(payload.fileId || '').trim()
      const newName = String(payload.newName || '').trim()
      if (!libraryPath) return fail(new Error('资源库路径不能为空'))
      if (!fileId) return fail(new Error('文件ID不能为空'))
      if (!newName) return fail(new Error('新名称不能为空'))
      ensureValidEntryName(newName)

      db = openLibraryDb(libraryPath)
      const row = db.prepare('SELECT * FROM other_files WHERE file_id = ? LIMIT 1').get(fileId) as any | undefined
      if (!row) return fail(new Error('文件记录不存在'))
      if (String(row.deleted_at || '').trim()) return fail(new Error('回收站中的项目不支持重命名'))

      const rootDir = getOtherFilesRootDir(libraryPath)
      const oldPath = String(row.path || '')
      ensurePathWithin(rootDir, oldPath)

      const parentDir = path.dirname(oldPath)
      const newPath = path.join(parentDir, newName)
      ensurePathWithin(rootDir, newPath)

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
          const affected = db!.prepare('SELECT file_id, path FROM other_files WHERE deleted_at IS NULL AND (path = ? OR path LIKE ?)')
            .all(oldPrefix, childLike) as Array<{ file_id: string; path: string }>
          const updatePathStmt = db!.prepare('UPDATE other_files SET path = ?, updated_at = CURRENT_TIMESTAMP WHERE file_id = ?')
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
            UPDATE other_files
            SET name = ?, name_upper = ?, mtime = ?, updated_at = CURRENT_TIMESTAMP
            WHERE file_id = ?
          `).run(newName, newName.toUpperCase(), mtime, fileId)
        } else {
          db!.prepare(`
            UPDATE other_files
            SET path = ?, name = ?, name_upper = ?, size = ?, mtime = ?, updated_at = CURRENT_TIMESTAMP
            WHERE file_id = ?
          `).run(newPath, newName, newName.toUpperCase(), stat.size, mtime, fileId)
        }
      })

      tx()

      const updated = db.prepare('SELECT * FROM other_files WHERE file_id = ? LIMIT 1').get(fileId) as any
      return ok({ record: toRecord(updated) })
    } catch (error) {
      logger.error('重命名其他文件失败:', error)
      return fail(error)
    } finally {
      db?.close()
    }
  },
}
