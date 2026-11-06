import type { BackupSettings } from './backup.types'
import type { LoggingSettings } from './log.types'

export type GlobalConfig = {
  libraries: unknown[]
  backendAuth?: {
    baseUrl: string
    tenantId?: number
    clientId?: string
    wechatSource?: string
    redirectMatch?: string
    [key: string]: unknown
  }
  auth?: unknown
  loggingSettings: LoggingSettings
  backupSettings: BackupSettings
  quickCategories: unknown[]
  [key: string]: unknown
}
