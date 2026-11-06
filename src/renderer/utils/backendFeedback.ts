import { backendFetch, type BackendAuthConfig } from './backendAuth'

type BackendR<T> = {
  code?: number
  msg?: string
  message?: string
  data?: T
}

export type FeedbackType = 'opinion' | 'issue'

export interface FeedbackUploadedFile {
  id?: string
  fileId?: string
  ossId?: string
  name?: string
  fileName?: string
  originalName?: string
  url?: string
  size?: number
  isImage?: boolean
  [key: string]: unknown
}

export interface FeedbackSubmitPayload {
  feedbackType: FeedbackType
  title: string
  contentHtml: string
  contentText: string
  screenshotOssIds: string[]
  attachmentOssIds: string[]
}

function unwrapR<T>(json: BackendR<T>): { ok: true; data: T } | { ok: false; message: string } {
  const code = Number(json?.code ?? 0)
  if (code === 0 || code === 200) {
    return { ok: true, data: (json?.data as T) ?? (null as unknown as T) }
  }
  return { ok: false, message: String(json?.msg || json?.message || '请求失败') }
}

function ensureSlashlessBaseUrl(input: string): string {
  return String(input || '').replace(/\/+$/, '')
}

export async function uploadFeedbackFile(
  cfg: BackendAuthConfig,
  auth: { accessToken: string; clientId: string },
  file: File,
  options: {
    isImg?: boolean
  } = {}
): Promise<FeedbackUploadedFile> {
  const baseUrl = ensureSlashlessBaseUrl(cfg.baseUrl)
  const formData = new FormData()
  formData.append('file', file, file.name)
  if (options.isImg) {
    formData.append('isImg', 'true')
  }

  const res = await backendFetch(`${baseUrl}/feedback/upload`, {
    method: 'POST',
    auth,
    body: formData,
  })
  const json = (await res.json().catch(() => null)) as BackendR<FeedbackUploadedFile> | null
  if (!res.ok) {
    throw new Error(String(json?.msg || `上传附件失败(HTTP ${res.status})`))
  }
  if (!json) {
    throw new Error('上传附件返回为空')
  }
  const unwrapped = unwrapR(json)
  if (!unwrapped.ok) {
    throw new Error(unwrapped.message)
  }
  return unwrapped.data || {}
}

export async function submitFeedback(
  cfg: BackendAuthConfig,
  auth: { accessToken: string; clientId: string },
  payload: FeedbackSubmitPayload
): Promise<Record<string, unknown> | null> {
  const baseUrl = ensureSlashlessBaseUrl(cfg.baseUrl)
  const res = await backendFetch(`${baseUrl}/feedback/submit`, {
    method: 'POST',
    auth,
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })
  const json = (await res.json().catch(() => null)) as BackendR<Record<string, unknown>> | null
  if (!res.ok) {
    throw new Error(String(json?.msg || `提交反馈失败(HTTP ${res.status})`))
  }
  if (!json) {
    throw new Error('提交反馈返回为空')
  }
  const unwrapped = unwrapR(json)
  if (!unwrapped.ok) {
    throw new Error(unwrapped.message)
  }
  return unwrapped.data || null
}
