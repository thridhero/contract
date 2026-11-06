import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

export type FileCopyTaskStatus = 'idle' | 'copying' | 'completed' | 'failed' | 'cancelled'

export type FileCopyTaskProgress = {
  taskId: string
  status: FileCopyTaskStatus
  total: number
  current: number
  done: number
  percent: number
  currentFile: string
  destDir: string
  error: string | null
  visible: boolean
}

export type FileCopyStartInput = Array<{ src: string; name: string; relativePath?: string }>

type StartPayload = { taskId: string; total: number; destDir: string }
type ProgressPayload = {
  taskId: string
  current: number
  total: number
  percent: string
  currentFile?: string
  bytesCopied?: number
  totalBytes?: number
  speed?: string
}
type CompletedPayload = { taskId: string; result: any }
type CancelledPayload = { taskId: string }

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n))

export const useFileCopyTaskStore = defineStore('fileCopyTask', () => {
  const taskId = ref('')
  const status = ref<FileCopyTaskStatus>('idle')
  const total = ref(0)
  const current = ref(0)
  const done = ref(0)
  const percent = ref(0)
  const currentFile = ref('')
  const destDir = ref('')
  const error = ref<string | null>(null)
  const visible = ref(false)

  const remaining = computed(() => Math.max(0, total.value - done.value))
  const fractionText = computed(() => (total.value > 0 ? `${Math.min(current.value, total.value)}/${total.value}` : ''))
  const percentText = computed(() => `${percent.value.toFixed(2)}%`)
  const isCopying = computed(() => status.value === 'copying')
  const isFinished = computed(() => status.value === 'completed' || status.value === 'failed' || status.value === 'cancelled')

  let initialized = false
  let unlistenStarted: (() => void) | null = null
  let unlistenProgress: (() => void) | null = null
  let unlistenCompleted: (() => void) | null = null
  let unlistenCancelled: (() => void) | null = null
  let unlistenFileFailed: (() => void) | null = null
  let autoHideTimer: number | null = null

  const clearAutoHide = () => {
    if (autoHideTimer) {
      window.clearTimeout(autoHideTimer)
      autoHideTimer = null
    }
  }

  const scheduleAutoHide = () => {
    clearAutoHide()
    autoHideTimer = window.setTimeout(() => {
      visible.value = false
    }, 3500)
  }

  const dismiss = () => {
    clearAutoHide()
    visible.value = false
  }

  const setStarted = (payload: StartPayload) => {
    taskId.value = payload.taskId
    status.value = 'copying'
    total.value = Number(payload.total || 0)
    current.value = 0
    done.value = 0
    percent.value = 0
    currentFile.value = ''
    destDir.value = String(payload.destDir || '')
    error.value = null
    visible.value = true
    clearAutoHide()
  }

  const setProgress = (payload: ProgressPayload) => {
    if (payload.taskId && taskId.value && payload.taskId !== taskId.value) return

    const pTotal = Number(payload.total || 0)
    const pCurrent = Number(payload.current || 0)
    const hasBytes = typeof payload.totalBytes === 'number' && payload.totalBytes > 0

    total.value = pTotal
    current.value = pCurrent
    done.value = hasBytes ? Math.max(0, pCurrent - 1) : pCurrent
    currentFile.value = String(payload.currentFile || currentFile.value || '')

    const raw = clamp(Number.parseFloat(String(payload.percent || '0')), 0, 100)
    const computedOverall = hasBytes && pTotal > 0
      ? (((Math.max(0, pCurrent - 1) + raw / 100) / pTotal) * 100)
      : raw
    percent.value = clamp(computedOverall, 0, 100)

    visible.value = true
    clearAutoHide()
  }

  const setCompleted = (payload: CompletedPayload) => {
    if (payload.taskId && taskId.value && payload.taskId !== taskId.value) return
    status.value = 'completed'
    done.value = total.value
    current.value = total.value
    percent.value = 100
    scheduleAutoHide()
  }

  const setCancelled = (payload: CancelledPayload) => {
    if (payload.taskId && taskId.value && payload.taskId !== taskId.value) return
    status.value = 'cancelled'
    scheduleAutoHide()
  }

  const setFailed = (err: unknown) => {
    status.value = 'failed'
    error.value = err instanceof Error ? err.message : String(err || '拷贝失败')
    scheduleAutoHide()
  }

  const ensureSubscribed = () => {
    if (initialized) return
    initialized = true

    unlistenStarted = window.electronAPI.fileCopy.onStarted((payload) => setStarted(payload as StartPayload))
    unlistenProgress = window.electronAPI.fileCopy.onProgress((payload) => setProgress(payload as ProgressPayload))
    unlistenCompleted = window.electronAPI.fileCopy.onCompleted((payload) => setCompleted(payload as CompletedPayload))
    unlistenCancelled = window.electronAPI.fileCopy.onCancelled((payload) => setCancelled(payload as CancelledPayload))
    unlistenFileFailed = window.electronAPI.fileCopy.onFileFailed(() => {})
  }

  const cleanup = () => {
    unlistenStarted?.()
    unlistenProgress?.()
    unlistenCompleted?.()
    unlistenCancelled?.()
    unlistenFileFailed?.()
    unlistenStarted = null
    unlistenProgress = null
    unlistenCompleted = null
    unlistenCancelled = null
    unlistenFileFailed = null
    clearAutoHide()
    initialized = false
  }

  const reset = () => {
    dismiss()
    taskId.value = ''
    status.value = 'idle'
    total.value = 0
    current.value = 0
    done.value = 0
    percent.value = 0
    currentFile.value = ''
    destDir.value = ''
    error.value = null
  }

  const startCopy = async (files: FileCopyStartInput, targetDir: string, options?: unknown) => {
    ensureSubscribed()
    visible.value = true
    error.value = null
    try {
      const base = options && typeof options === 'object' ? { ...(options as any) } : {}
      const conflictBase = base.conflict && typeof base.conflict === 'object' ? { ...(base.conflict as any) } : {}
      if (!conflictBase.mode) conflictBase.mode = 'ask'
      if (typeof conflictBase.detectDuplicates !== 'boolean') conflictBase.detectDuplicates = true
      const mergedOptions = { ...base, conflict: conflictBase }

      const resp = await window.electronAPI.fileCopy.start(files, targetDir, mergedOptions) as any
      const normalized = resp && typeof resp === 'object' && 'success' in resp ? resp : { success: true, data: resp }
      if (!normalized.success) {
        throw new Error(normalized.error || '拷贝失败')
      }
      return normalized.data
    } catch (e) {
      setFailed(e)
      throw e
    }
  }

  const cancelCopy = async () => {
    ensureSubscribed()
    const id = String(taskId.value || '')
    if (!id) return false
    const resp = await window.electronAPI.fileCopy.cancel(id) as any
    const normalized = resp && typeof resp === 'object' && 'success' in resp ? resp : { success: true, data: resp }
    return Boolean(normalized.success && (normalized.data?.success ?? true))
  }

  const snapshot = computed<FileCopyTaskProgress>(() => ({
    taskId: taskId.value,
    status: status.value,
    total: total.value,
    current: current.value,
    done: done.value,
    percent: percent.value,
    currentFile: currentFile.value,
    destDir: destDir.value,
    error: error.value,
    visible: visible.value,
  }))

  return {
    snapshot,
    taskId,
    status,
    total,
    current,
    done,
    remaining,
    percent,
    currentFile,
    destDir,
    error,
    visible,
    fractionText,
    percentText,
    isCopying,
    isFinished,
    ensureSubscribed,
    cleanup,
    dismiss,
    reset,
    startCopy,
    cancelCopy,
  }
})
