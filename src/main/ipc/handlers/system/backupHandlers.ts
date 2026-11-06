import { IpcMainInvokeEvent } from 'electron'
import * as channels from '../../channels'
import { BackupService } from '../../../services/system/BackupService'
import { ok, fail, IpcResponse } from '../../../../shared/types/ipc.types'
import type { BackupInfo, CreateBackupResult, RestoreBackupResult } from '../../../../shared/types/backup.types'

export const backupHandlers: Record<string, (event: IpcMainInvokeEvent, ...args: unknown[]) => Promise<unknown>> = {

  [channels.BACKUP_CREATE]: async (): Promise<IpcResponse<CreateBackupResult>> => {
    try {
      const result = await BackupService.getInstance().createBackup('manual')
      return ok(result)
    } catch (error) {
      return fail(error)
    }
  },

  [channels.BACKUP_LIST]: async (): Promise<IpcResponse<BackupInfo[]>> => {
    try {
      const result = await BackupService.getInstance().listBackups()
      return ok(result)
    } catch (error) {
      return fail(error)
    }
  },

  [channels.BACKUP_RESTORE]: async (_event, backupPath: unknown): Promise<IpcResponse<RestoreBackupResult>> => {
    try {
      const result = await BackupService.getInstance().restoreFromBackup(String(backupPath || ''))
      return ok(result)
    } catch (error) {
      return fail(error)
    }
  },
}

