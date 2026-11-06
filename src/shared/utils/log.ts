import type { LoggingSettings } from '../types/log.types'

export const DEFAULT_LOG_PATTERN = '[{timestamp}] [{level}] [{process}] [{module}] {message}'

export function normalizeLoggingSettings(settings?: Partial<LoggingSettings>): LoggingSettings {
  const retentionDays = Number(settings?.retentionDays)
  const maxSizeMb = Number(settings?.maxSizeMb)

  return {
    level: settings?.level || 'info',
    retentionDays: Number.isFinite(retentionDays) ? Math.min(Math.max(Math.floor(retentionDays), 1), 365) : 14,
    maxSizeMb: Number.isFinite(maxSizeMb) ? Math.min(Math.max(Math.floor(maxSizeMb), 1), 1024) : 20,
    consoleEnabled: settings?.consoleEnabled ?? true,
    pattern: typeof settings?.pattern === 'string' && settings.pattern.trim()
      ? settings.pattern.trim()
      : DEFAULT_LOG_PATTERN,
  }
}
