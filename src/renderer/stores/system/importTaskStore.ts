import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import type {
  ImportTaskGetStatusResponse,
  ImportTaskInvoiceCandidate,
  ImportTaskProgressPayload,
  ImportTaskStartRequest,
} from '../../../shared/types/importTask.types'

export const useImportTaskStore = defineStore('importTask', () => {
  const progressByContextKey = ref<Record<string, ImportTaskProgressPayload>>({})
  const resultsByContextKey = ref<Record<string, ImportTaskGetStatusResponse['results']>>({})
  const invoiceCandidatesByContextKey = ref<Record<string, ImportTaskInvoiceCandidate[]>>({})
  const visibleByContextKey = ref<Record<string, boolean>>({})

  let initialized = false
  let unlistenProgress: (() => void) | null = null
  const autoHideTimers: Record<string, number> = {}

  const clearAutoHide = (contextKey: string) => {
    const key = String(contextKey || '').trim()
    if (!key) return
    const timer = autoHideTimers[key]
    if (timer) {
      window.clearTimeout(timer)
      delete autoHideTimers[key]
    }
  }

  const scheduleAutoHide = (contextKey: string) => {
    const key = String(contextKey || '').trim()
    if (!key) return
    clearAutoHide(key)
    autoHideTimers[key] = window.setTimeout(() => {
      visibleByContextKey.value = { ...visibleByContextKey.value, [key]: false }
      delete autoHideTimers[key]
    }, 3500)
  }

  const ensureSubscribed = () => {
    if (initialized) return
    initialized = true
    unlistenProgress = window.electronAPI.importTasks.onProgress((payload) => {
      if (!payload?.contextKey) return
      clearAutoHide(payload.contextKey)
      progressByContextKey.value = {
        ...progressByContextKey.value,
        [payload.contextKey]: payload,
      }
      visibleByContextKey.value = { ...visibleByContextKey.value, [payload.contextKey]: true }
      if (payload.stage === 'completed' || payload.stage === 'completed-with-errors' || payload.stage === 'cancelled' || payload.stage === 'failed') {
        scheduleAutoHide(payload.contextKey)
      }
    })
  }

  const syncStatus = async (contextKey: string) => {
    ensureSubscribed()
    const key = String(contextKey || '').trim()
    if (!key) return
    const resp = await window.electronAPI.importTasks.getStatus({ contextKey }) as any
    const normalized = resp && typeof resp === 'object' && 'success' in resp ? resp : { success: true, data: resp }
    if (!normalized.success) return
    const data = normalized.data as ImportTaskGetStatusResponse
    if (data?.progress) {
      clearAutoHide(key)
      progressByContextKey.value = {
        ...progressByContextKey.value,
        [key]: data.progress,
      }
      if (data.progress.stage === 'completed' || data.progress.stage === 'completed-with-errors' || data.progress.stage === 'cancelled' || data.progress.stage === 'failed') {
        visibleByContextKey.value = { ...visibleByContextKey.value, [key]: false }
      } else {
        visibleByContextKey.value = { ...visibleByContextKey.value, [key]: true }
      }
    }
    if (data?.results) {
      resultsByContextKey.value = {
        ...resultsByContextKey.value,
        [key]: data.results,
      }
    }
    if (Array.isArray(data?.invoiceCandidates)) {
      invoiceCandidatesByContextKey.value = {
        ...invoiceCandidatesByContextKey.value,
        [key]: data.invoiceCandidates,
      }
    }
  }

  const startImport = async (payload: ImportTaskStartRequest) => {
    ensureSubscribed()
    const resp = await window.electronAPI.importTasks.start(payload) as any
    const normalized = resp && typeof resp === 'object' && 'success' in resp ? resp : { success: true, data: resp }
    if (!normalized.success) {
      throw new Error(normalized.error || '导入失败')
    }
    return normalized.data
  }

  const cancelImport = async (taskId: string) => {
    ensureSubscribed()
    const id = String(taskId || '').trim()
    if (!id) return false
    const resp = await window.electronAPI.importTasks.cancel({ taskId: id }) as any
    const normalized = resp && typeof resp === 'object' && 'success' in resp ? resp : { success: true, data: resp }
    return Boolean(normalized.success && (normalized.data?.success ?? true))
  }

  const getProgress = (contextKey: string) => computed(() => progressByContextKey.value[String(contextKey || '').trim()] || null)
  const getResults = (contextKey: string) => computed(() => resultsByContextKey.value[String(contextKey || '').trim()] || null)
  const getInvoiceCandidates = (contextKey: string) => computed(() => invoiceCandidatesByContextKey.value[String(contextKey || '').trim()] || [])
  const isVisible = (contextKey: string) => computed(() => Boolean(visibleByContextKey.value[String(contextKey || '').trim()]))
  const peekProgress = (contextKey: string) => progressByContextKey.value[String(contextKey || '').trim()] || null
  const peekInvoiceCandidates = (contextKey: string) => invoiceCandidatesByContextKey.value[String(contextKey || '').trim()] || []

  const cleanup = () => {
    unlistenProgress?.()
    unlistenProgress = null
    initialized = false
    for (const key of Object.keys(autoHideTimers)) {
      clearAutoHide(key)
    }
  }

  return {
    ensureSubscribed,
    syncStatus,
    startImport,
    cancelImport,
    getProgress,
    getResults,
    getInvoiceCandidates,
    isVisible,
    peekProgress,
    peekInvoiceCandidates,
    cleanup,
  }
})
