export type BackupDirectoryMode = 'library' | 'custom'

export type BackupSettings = {
  enabled: boolean
  directoryMode: BackupDirectoryMode
  customDir?: string
  intervalHours: number
  keepLastN: number
  lastBackupAt?: number
  lastBackupPath?: string
  lastBackupOk?: boolean
  lastBackupMessage?: string
}

export type BackupInfo = {
  path: string
  size: number
  mtimeMs: number
}

export type CreateBackupResult = {
  backupPath: string
  size: number
  createdAt: number
  removedOldCount: number
}

export type RestoreBackupResult = {
  restored: boolean
  safetyBackupPath?: string
  willReload: boolean
}

