export type UpdateChannel = 'stable'

export type UpdateCheckOptions = {
  channel?: UpdateChannel
  autoDownload?: boolean
  timeoutMs?: number
  silent?: boolean
}

export type UpdateCheckResponse = {
  hasUpdate: boolean
  latestVersion?: string
  downloadUrl?: string
  sha256?: string
  sizeBytes?: number
  releaseNotes?: string
}

export type UpdateStatus =
  | { state: 'idle'; message?: string }
  | { state: 'checking' }
  | { state: 'no-update'; currentVersion: string }
  | { state: 'update-available'; currentVersion: string; latestVersion: string; downloadUrl: string; sha256?: string; sizeBytes?: number; releaseNotes?: string }
  | { state: 'downloading'; downloadedBytes: number; totalBytes?: number; percent?: number; filePath?: string }
  | { state: 'verifying'; filePath: string }
  | { state: 'ready'; filePath: string; latestVersion: string; sha256?: string }
  | { state: 'error'; error: string }

export type UpdateCache = {
  lastCheckedAt: number
  currentVersion: string
  channel: UpdateChannel
  result?: UpdateCheckResponse
  downloadedFilePath?: string
  downloadedSha256?: string
  downloadedAt?: number
}

