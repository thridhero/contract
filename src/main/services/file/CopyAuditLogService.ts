import { app } from 'electron'
import * as fs from 'fs'
import * as path from 'path'

export type CopyAuditEntry = {
  type: 'file-copy'
  taskId: string
  startedAt: number
  endedAt: number
  durationMs: number
  destDir: string
  total: number
  succeeded: number
  failed: number
  cancelled?: boolean
  result?: unknown
}

export class CopyAuditLogService {
  private static instance: CopyAuditLogService | null = null

  static getInstance() {
    if (!CopyAuditLogService.instance) {
      CopyAuditLogService.instance = new CopyAuditLogService()
    }
    return CopyAuditLogService.instance
  }

  private baseDir: string

  private constructor() {
    this.baseDir = path.join(app.getPath('userData'), 'logs', 'file-copy')
  }

  private getLogFilePath(ts: number) {
    const d = new Date(ts)
    const yyyy = String(d.getFullYear())
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const dd = String(d.getDate()).padStart(2, '0')
    return path.join(this.baseDir, `file-copy-${yyyy}-${mm}-${dd}.jsonl`)
  }

  async append(entry: CopyAuditEntry) {
    fs.mkdirSync(this.baseDir, { recursive: true })
    const filePath = this.getLogFilePath(entry.endedAt || Date.now())
    const line = JSON.stringify(entry) + '\n'
    await fs.promises.appendFile(filePath, line, 'utf8')
  }
}

