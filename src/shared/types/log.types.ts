import type { IpcResponse } from './ipc.types'

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'
export type LogProcess = 'main' | 'renderer'

export interface LoggingSettings {
  level: LogLevel
  retentionDays: number
  maxSizeMb: number
  consoleEnabled: boolean
  pattern: string
}

export interface LogWritePayload {
  level: LogLevel
  module: string
  message: string
  context?: unknown
  process?: LogProcess
}

export interface LoggingFsApi {
  write: (payload: LogWritePayload) => Promise<IpcResponse<{ logged: true }>>
  getSettings: () => Promise<IpcResponse<LoggingSettings>>
  saveSettings: (settings: LoggingSettings) => Promise<IpcResponse<LoggingSettings>>
  openFolder: () => Promise<IpcResponse<{ opened: true; path: string }>>
}
