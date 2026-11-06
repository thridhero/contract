import * as fs from 'fs'
import * as path from 'path'
import Database from 'better-sqlite3'
import * as channels from '../../../channels'
import { ok, fail, IpcResponse } from '../../../../../shared/types/ipc.types'
import type {
  OtherFileStartDragOutDTO,
  OtherFileStartDragOutResult,
  OtherFileUpdateThumbnailDTO,
  OtherFileSaveThumbnailFileDTO,
  OtherFileRecordType,
} from '../../../../../shared/types/otherFile.types'
import {
  OtherFileHandlerMap,
  copyToTempDir,
  ensureDir,
  ensurePathWithin,
  getFileIconSafe,
  getOtherFilesRootDir,
  getThumbFilePath,
  logger,
  openLibraryDb,
  parseThumbnailBytes,
} from './shared'

export const otherFileAuxHandlers: OtherFileHandlerMap = {
  [channels.OTHER_FILES_UPDATE_THUMBNAIL]: async (_event, dto: unknown): Promise<IpcResponse<{ success: boolean }>> => {
    let db: Database.Database | null = null
    try {
      const payload = dto as OtherFileUpdateThumbnailDTO
      const libraryPath = String(payload.libraryPath || '').trim()
      const fileId = String(payload.fileId || '').trim()
      if (!libraryPath) return fail(new Error('资源库路径不能为空'))
      if (!fileId) return fail(new Error('文件ID不能为空'))

      db = openLibraryDb(libraryPath)
      const row = db.prepare('SELECT first_page_thumb FROM other_files WHERE file_id = ? LIMIT 1').get(fileId) as any | undefined
      if (!row) return fail(new Error('文件记录不存在'))

      const rootDir = getOtherFilesRootDir(libraryPath)
      const nextThumb = payload.firstPageThumb
      if (!nextThumb) {
        const oldThumb = row.first_page_thumb ? String(row.first_page_thumb) : ''
        if (oldThumb && !oldThumb.startsWith('data:') && fs.existsSync(oldThumb)) {
          try {
            ensurePathWithin(rootDir, oldThumb)
            const used = db.prepare('SELECT COUNT(1) AS c FROM other_files WHERE first_page_thumb = ? AND file_id <> ?')
              .get(oldThumb, fileId) as any
            const count = Number(used?.c || 0)
            if (count === 0) {
              fs.unlinkSync(oldThumb)
            }
          } catch {
          }
        }
      }

      db.prepare(`
        UPDATE other_files
        SET
          first_page_thumb = ?,
          preview_status = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE file_id = ?
      `).run(payload.firstPageThumb, payload.previewStatus, fileId)

      return ok({ success: true })
    } catch (error) {
      logger.error('更新缩略图状态失败:', error)
      return fail(error)
    } finally {
      db?.close()
    }
  },

  [channels.OTHER_FILES_SAVE_THUMBNAIL_FILE]: async (_event, dto: unknown): Promise<IpcResponse<{ filePath: string }>> => {
    let db: Database.Database | null = null
    try {
      const payload = dto as OtherFileSaveThumbnailFileDTO
      const libraryPath = String(payload.libraryPath || '').trim()
      const fileId = String(payload.fileId || '').trim()
      const ext = String(payload.ext || 'webp').trim() || 'webp'
      if (!libraryPath) return fail(new Error('资源库路径不能为空'))
      if (!fileId) return fail(new Error('文件ID不能为空'))

      const thumbBytes = parseThumbnailBytes((payload as any).thumbnailBytes)
      if (!thumbBytes || thumbBytes.length === 0) return fail(new Error('缩略图数据为空'))

      db = openLibraryDb(libraryPath)
      const row = db.prepare('SELECT sha256 FROM other_files WHERE file_id = ? LIMIT 1').get(fileId) as any | undefined
      if (!row) return fail(new Error('文件记录不存在'))

      const rootDir = getOtherFilesRootDir(libraryPath)
      ensurePathWithin(path.resolve(libraryPath), rootDir)

      const key = (row.sha256 ? String(row.sha256) : '') || fileId
      const { dir, filePath } = getThumbFilePath(rootDir, key, ext)
      ensurePathWithin(rootDir, filePath)
      await ensureDir(dir)
      await fs.promises.writeFile(filePath, thumbBytes)

      db.prepare(`
        UPDATE other_files
        SET
          first_page_thumb = ?,
          preview_status = 'completed',
          updated_at = CURRENT_TIMESTAMP
        WHERE file_id = ?
      `).run(filePath, fileId)

      return ok({ filePath })
    } catch (error) {
      logger.error('保存缩略图文件失败:', error)
      return fail(error)
    } finally {
      db?.close()
    }
  },

  [channels.OTHER_FILES_START_DRAG_OUT]: async (event, dto: unknown): Promise<IpcResponse<OtherFileStartDragOutResult>> => {
    let db: Database.Database | null = null
    try {
      const payload = dto as OtherFileStartDragOutDTO
      const libraryPath = String(payload.libraryPath || '').trim()
      const fileIdsInput = Array.isArray(payload.fileIds) ? payload.fileIds : []
      const fileIds: string[] = []
      const seen = new Set<string>()
      for (const v of fileIdsInput) {
        const id = String(v || '').trim()
        if (!id || seen.has(id)) continue
        seen.add(id)
        fileIds.push(id)
      }

      if (!libraryPath) return fail(new Error('资源库路径不能为空'))
      if (fileIds.length === 0) return fail(new Error('未选择任何文件'))

      db = openLibraryDb(libraryPath)
      const rootDir = getOtherFilesRootDir(libraryPath)
      ensurePathWithin(path.resolve(libraryPath), rootDir)

      const placeholders = fileIds.map(() => '?').join(',')
      const rows = db.prepare(`SELECT file_id, path, type FROM other_files WHERE file_id IN (${placeholders})`)
        .all(...fileIds) as Array<{ file_id: string; path: string; type: OtherFileRecordType }>

      if (rows.length === 0) return fail(new Error('未找到文件记录'))

      const recordsById = new Map(rows.map(r => [String(r.file_id), r]))
      for (const id of fileIds) {
        if (!recordsById.has(id)) return fail(new Error('存在无效的文件选择'))
      }

      const sources = fileIds.map(id => {
        const r = recordsById.get(id)!
        return { absPath: String(r.path || '').trim(), type: r.type }
      }).filter(s => Boolean(s.absPath))

      if (sources.length === 0) return fail(new Error('文件路径为空'))

      for (const s of sources) {
        ensurePathWithin(rootDir, s.absPath)
        const stat = fs.existsSync(s.absPath) ? fs.lstatSync(s.absPath) : null
        if (!stat) return fail(new Error('文件不存在'))
        if (s.type === 'folder' && !stat.isDirectory()) return fail(new Error('文件夹记录无效'))
        if (s.type === 'file' && !stat.isFile()) return fail(new Error('文件记录无效'))
      }

      const sender: any = event.sender as any
      if (!sender?.startDrag) return fail(new Error('当前窗口不支持拖拽导出'))

      if (sources.length === 1) {
        const filePath = path.resolve(sources[0].absPath)
        const icon = await getFileIconSafe(filePath)
        sender.startDrag({ file: filePath, icon: icon as any })
        return ok({ mode: 'native' })
      }

      try {
        const filePaths = sources.map(s => path.resolve(s.absPath))
        const icon = await getFileIconSafe(filePaths[0])
        sender.startDrag({ files: filePaths, icon: icon as any })
        return ok({ mode: 'native' })
      } catch (error) {
        try {
          logger.warn('原生多文件拖拽不可用，启用临时目录降级', {
            error: error instanceof Error ? error.message : String(error || ''),
          })
        } catch {
        }
      }

      const tempDir = await copyToTempDir(sources, rootDir)
      const icon = await getFileIconSafe(tempDir)
      sender.startDrag({ file: tempDir, icon: icon as any })
      return ok({ mode: 'fallback-folder' })
    } catch (error) {
      try {
        logger.error('拖拽导出失败:', error)
      } catch {
      }
      return fail(error)
    } finally {
      db?.close()
    }
  },
}
