import * as fs from 'fs'
import * as path from 'path'
import { createLogger } from '../../utils/logger'
import { ConfigService } from './ConfigService'
import { DatabaseService } from './DatabaseService'
import { WindowManager } from '../../windows/WindowManager'
import type { BackupInfo, BackupSettings, CreateBackupResult, RestoreBackupResult } from '../../../shared/types/backup.types'

const logger = createLogger('BackupService')

const DEFAULT_BACKUP_SETTINGS: BackupSettings = {
  enabled: false,
  directoryMode: 'library',
  intervalHours: 24,
  keepLastN: 10,
}

function toPositiveInt(value: unknown, fallback: number): number {
  const n = Number(value)
  if (!Number.isFinite(n)) return fallback
  const i = Math.floor(n)
  return i > 0 ? i : fallback
}

function normalizeBackupSettings(input: unknown): BackupSettings {
  const raw = (input && typeof input === 'object') ? (input as any) : {}
  const directoryMode = raw.directoryMode === 'custom' ? 'custom' : 'library'
  const customDir = typeof raw.customDir === 'string' && raw.customDir.trim() ? raw.customDir.trim() : undefined
  return {
    ...DEFAULT_BACKUP_SETTINGS,
    ...raw,
    enabled: Boolean(raw.enabled),
    directoryMode,
    customDir,
    intervalHours: toPositiveInt(raw.intervalHours, DEFAULT_BACKUP_SETTINGS.intervalHours),
    keepLastN: toPositiveInt(raw.keepLastN, DEFAULT_BACKUP_SETTINGS.keepLastN),
    lastBackupAt: typeof raw.lastBackupAt === 'number' ? raw.lastBackupAt : undefined,
    lastBackupPath: typeof raw.lastBackupPath === 'string' ? raw.lastBackupPath : undefined,
    lastBackupOk: typeof raw.lastBackupOk === 'boolean' ? raw.lastBackupOk : undefined,
    lastBackupMessage: typeof raw.lastBackupMessage === 'string' ? raw.lastBackupMessage : undefined,
  }
}

function formatTimestamp(date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  const y = date.getFullYear()
  const m = pad(date.getMonth() + 1)
  const d = pad(date.getDate())
  const hh = pad(date.getHours())
  const mm = pad(date.getMinutes())
  const ss = pad(date.getSeconds())
  return `${y}${m}${d}-${hh}${mm}${ss}`
}

async function ensureDir(dirPath: string): Promise<void> {
  await fs.promises.mkdir(dirPath, { recursive: true })
}

function looksLikeSqliteDatabase(filePath: string): boolean {
  try {
    const fd = fs.openSync(filePath, 'r')
    try {
      const header = Buffer.alloc(16)
      fs.readSync(fd, header, 0, 16, 0)
      return header.toString('utf-8').startsWith('SQLite format 3')
    } finally {
      fs.closeSync(fd)
    }
  } catch {
    return false
  }
}

function safeUnlink(filePath: string): void {
  try {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath)
  } catch {}
}

export class BackupService {
  private static instance: BackupService

  static getInstance(): BackupService {
    if (!BackupService.instance) {
      BackupService.instance = new BackupService()
    }
    return BackupService.instance
  }

  getSettings(): BackupSettings {
    const configSvc = ConfigService.getInstance()
    return normalizeBackupSettings(configSvc.getConfigItem('backupSettings'))
  }

  saveSettings(settings: BackupSettings): BackupSettings {
    const configSvc = ConfigService.getInstance()
    const normalized = normalizeBackupSettings(settings)
    configSvc.updateConfigItem('backupSettings', normalized)
    return normalized
  }

  private resolveBackupDir(dbPath: string, settings: BackupSettings): string {
    if (settings.directoryMode === 'custom' && settings.customDir) {
      return path.resolve(settings.customDir)
    }
    return path.join(path.dirname(dbPath), 'backups')
  }

  private async listBackupsInDir(dirPath: string): Promise<BackupInfo[]> {
    const resolved = path.resolve(dirPath)
    if (!fs.existsSync(resolved)) return []
    const names = await fs.promises.readdir(resolved).catch((): string[] => [])
    const infos: BackupInfo[] = []
    for (const name of names) {
      if (!name.toLowerCase().endsWith('.db')) continue
      const full = path.join(resolved, name)
      try {
        const stat = await fs.promises.stat(full)
        if (!stat.isFile()) continue
        infos.push({ path: full, size: stat.size, mtimeMs: stat.mtimeMs })
      } catch {}
    }
    infos.sort((a, b) => b.mtimeMs - a.mtimeMs)
    return infos
  }

  private async cleanupOldBackups(dirPath: string, keepLastN: number): Promise<number> {
    const list = await this.listBackupsInDir(dirPath)
    if (list.length <= keepLastN) return 0
    const toRemove = list.slice(keepLastN)
    let removed = 0
    for (const item of toRemove) {
      try {
        await fs.promises.unlink(item.path)
        removed += 1
      } catch {}
    }
    return removed
  }

  async listBackups(): Promise<BackupInfo[]> {
    const dbPath = DatabaseService.getInstance().getDbPath()
    if (!dbPath) return []
    const settings = this.getSettings()
    const dir = this.resolveBackupDir(dbPath, settings)
    return this.listBackupsInDir(dir)
  }

  async createBackup(reason: 'manual' | 'auto' | 'pre-restore' = 'manual'): Promise<CreateBackupResult> {
    const dbSvc = DatabaseService.getInstance()
    const dbPath = dbSvc.getDbPath()
    if (!dbPath) {
      this.updateLastResult(false, '请先打开资源库')
      throw new Error('请先打开资源库')
    }

    const settings = this.getSettings()
    const backupDir = this.resolveBackupDir(dbPath, settings)
    await ensureDir(backupDir)

    const stamp = formatTimestamp()
    const prefix = reason === 'pre-restore' ? 'settings-safe' : 'settings'
    const backupPath = path.join(backupDir, `${prefix}-${stamp}.db`)

    const startedAt = Date.now()
    try {
      await dbSvc.backupTo(backupPath)
      const stat = await fs.promises.stat(backupPath)
      const removedOldCount = await this.cleanupOldBackups(backupDir, settings.keepLastN)
      this.updateLastResult(true, '', { lastBackupAt: Date.now(), lastBackupPath: backupPath })

      try {
        logger.info('数据库备份成功', {
          reason,
          file: path.basename(backupPath),
          size: stat.size,
          removedOldCount,
          costMs: Date.now() - startedAt,
        })
      } catch {}

      return { backupPath, size: stat.size, createdAt: stat.mtimeMs, removedOldCount }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error || '')
      this.updateLastResult(false, msg, { lastBackupAt: Date.now() })
      try {
        logger.error('数据库备份失败', { reason, error: msg })
      } catch {}
      safeUnlink(backupPath)
      throw error
    }
  }

  async restoreFromBackup(backupFilePath: string): Promise<RestoreBackupResult> {
    const dbSvc = DatabaseService.getInstance()
    const dbPath = dbSvc.getDbPath()
    if (!dbPath) throw new Error('请先打开资源库')

    const src = path.resolve(String(backupFilePath || '').trim())
    if (!src) throw new Error('备份文件路径不能为空')
    if (!fs.existsSync(src)) throw new Error('备份文件不存在')
    if (!looksLikeSqliteDatabase(src)) throw new Error('备份文件不是有效的 SQLite 数据库')

    let safetyBackupPath: string | undefined
    try {
      const safety = await this.createBackup('pre-restore')
      safetyBackupPath = safety.backupPath
    } catch {}

    dbSvc.close()

    safeUnlink(`${dbPath}-wal`)
    safeUnlink(`${dbPath}-shm`)

    await fs.promises.copyFile(src, dbPath)
    dbSvc.init(dbPath)

    const win = WindowManager.getMainWindow()
    let willReload = false
    if (win) {
      try {
        win.webContents.reload()
        willReload = true
      } catch {}
    }

    return { restored: true, safetyBackupPath, willReload }
  }

  private updateLastResult(ok: boolean, message: string, extra: Partial<BackupSettings> = {}): void {
    const configSvc = ConfigService.getInstance()
    const current = normalizeBackupSettings(configSvc.getConfigItem('backupSettings'))
    const next: BackupSettings = {
      ...current,
      ...extra,
      lastBackupOk: ok,
      lastBackupMessage: message || undefined,
    }
    configSvc.updateConfigItem('backupSettings', next)
  }
}
