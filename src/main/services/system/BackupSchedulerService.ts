import * as path from 'path'
import { createLogger } from '../../utils/logger'
import { BackupService } from './BackupService'
import { DatabaseService } from './DatabaseService'

const logger = createLogger('BackupSchedulerService')

const DEFAULT_INTERVAL_MS = 30 * 60 * 1000

export class BackupSchedulerService {
  private static instance: BackupSchedulerService
  private timer: NodeJS.Timeout | null = null
  private running: Promise<void> | null = null

  static getInstance(): BackupSchedulerService {
    if (!BackupSchedulerService.instance) {
      BackupSchedulerService.instance = new BackupSchedulerService()
    }
    return BackupSchedulerService.instance
  }

  startPeriodic(intervalMs = DEFAULT_INTERVAL_MS): void {
    if (this.timer) return
    this.tick('startup').catch(() => {})
    this.timer = setInterval(() => {
      this.tick('interval').catch(() => {})
    }, intervalMs)
    ;(this.timer as any).unref?.()
  }

  private async tick(reason: 'startup' | 'interval'): Promise<void> {
    if (this.running) return this.running
    const task = this.tickInternal(reason).finally(() => {
      this.running = null
    })
    this.running = task
    return task
  }

  private async tickInternal(reason: 'startup' | 'interval'): Promise<void> {
    const settings = BackupService.getInstance().getSettings()
    if (!settings.enabled) return

    const dbPath = DatabaseService.getInstance().getDbPath()
    if (!dbPath) return

    const intervalMs = settings.intervalHours * 60 * 60 * 1000
    const last = typeof settings.lastBackupAt === 'number' ? settings.lastBackupAt : 0
    if (Date.now() - last < intervalMs) return

    try {
      await BackupService.getInstance().createBackup('auto')
      try {
        logger.info('自动备份完成', { reason, library: path.basename(path.dirname(dbPath)) })
      } catch {}
    } catch (error) {
      try {
        logger.error('自动备份失败', { reason, error: error instanceof Error ? error.message : String(error || '') })
      } catch {}
    }
  }
}
