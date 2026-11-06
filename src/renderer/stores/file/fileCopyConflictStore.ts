import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

export type FileCopyConflictReason = 'dest-exists' | 'duplicate'
export type FileCopyConflictAction = 'replace' | 'skip' | 'rename' | 'keep-both'
export type FileCopyConflictDecision = { action: FileCopyConflictAction; newName?: string }

export type FileCopyHashes = { md5?: string; sha256?: string }
export type FileCopyConflictFile = { src: string; name: string; relativePath?: string }

export type FileCopyConflictPayload = {
  requestId: string
  taskId: string
  reason: FileCopyConflictReason
  file: FileCopyConflictFile
  srcPath: string
  destPath: string
  srcSize?: number
  destSize?: number
  srcHashes?: FileCopyHashes
  destHashes?: FileCopyHashes
  defaultDecision: FileCopyConflictDecision
}

const normalizeName = (name: string) => String(name || '').replace(/[\\/]+/g, '_').trim()

const splitName = (name: string) => {
  const safe = normalizeName(name)
  const dot = safe.lastIndexOf('.')
  if (dot > 0) return { base: safe.slice(0, dot), ext: safe.slice(dot) }
  return { base: safe, ext: '' }
}

const suggestName = (originalName: string, mode: 'rename' | 'keep-both') => {
  const { base, ext } = splitName(originalName)
  if (!base) return mode === 'keep-both' ? `文件 - 副本${ext}` : `文件 - 重命名${ext}`
  return mode === 'keep-both' ? `${base} - 副本${ext}` : `${base} - 重命名${ext}`
}

export const useFileCopyConflictStore = defineStore('fileCopyConflict', () => {
  const queue = ref<FileCopyConflictPayload[]>([])
  const current = ref<FileCopyConflictPayload | null>(null)
  const selectedAction = ref<FileCopyConflictAction>('replace')
  const newName = ref('')
  const submitError = ref<string | null>(null)
  const submitting = ref(false)

  const visible = computed(() => Boolean(current.value))

  const reasonText = computed(() => {
    const r = current.value?.reason
    if (r === 'duplicate') return '疑似重复（哈希一致）'
    if (r === 'dest-exists') return '目标已存在'
    return '存在冲突'
  })

  const defaultAction = computed<FileCopyConflictAction>(() => {
    const a = current.value?.defaultDecision?.action
    if (a === 'replace' || a === 'skip' || a === 'rename' || a === 'keep-both') return a
    return 'replace'
  })

  let initialized = false
  let unlistenConflict: (() => void) | null = null
  let unlistenCancelled: (() => void) | null = null
  let unlistenCompleted: (() => void) | null = null

  const openNext = () => {
    if (current.value) return
    const next = queue.value.shift()
    if (!next) return
    current.value = next
    submitError.value = null
    submitting.value = false
    selectedAction.value = defaultAction.value
    if (selectedAction.value === 'rename') {
      newName.value = suggestName(next.file?.name || '', 'rename')
    } else if (selectedAction.value === 'keep-both') {
      newName.value = suggestName(next.file?.name || '', 'keep-both')
    } else {
      newName.value = ''
    }
  }

  const enqueue = (payload: unknown) => {
    const p = (payload || {}) as Partial<FileCopyConflictPayload>
    const requestId = String(p.requestId || '').trim()
    if (!requestId) return
    const taskId = String(p.taskId || '').trim()
    const file = (p.file || {}) as any

    const normalized: FileCopyConflictPayload = {
      requestId,
      taskId,
      reason: (p.reason as any) || 'dest-exists',
      file: {
        src: String(file.src || ''),
        name: String(file.name || ''),
        relativePath: typeof file.relativePath === 'string' ? file.relativePath : undefined,
      },
      srcPath: String(p.srcPath || ''),
      destPath: String(p.destPath || ''),
      srcSize: typeof p.srcSize === 'number' ? p.srcSize : undefined,
      destSize: typeof p.destSize === 'number' ? p.destSize : undefined,
      srcHashes: (p.srcHashes || undefined) as any,
      destHashes: (p.destHashes || undefined) as any,
      defaultDecision: (p.defaultDecision || { action: 'replace' }) as any,
    }

    queue.value.push(normalized)
    openNext()
  }

  const clearForTask = (taskId: string) => {
    const id = String(taskId || '').trim()
    if (!id) return
    queue.value = queue.value.filter((c) => c.taskId !== id)
    if (current.value?.taskId === id) {
      current.value = null
      submitError.value = null
      submitting.value = false
      selectedAction.value = 'replace'
      newName.value = ''
      openNext()
    }
  }

  const ensureSubscribed = () => {
    if (initialized) return
    initialized = true

    unlistenConflict = window.electronAPI.fileCopy.onConflict((payload) => enqueue(payload))
    unlistenCancelled = window.electronAPI.fileCopy.onCancelled((payload: any) => clearForTask(String(payload?.taskId || '')))
    unlistenCompleted = window.electronAPI.fileCopy.onCompleted((payload: any) => clearForTask(String(payload?.taskId || '')))
  }

  const cleanup = () => {
    unlistenConflict?.()
    unlistenCancelled?.()
    unlistenCompleted?.()
    unlistenConflict = null
    unlistenCancelled = null
    unlistenCompleted = null
    initialized = false
  }

  const setAction = (action: FileCopyConflictAction) => {
    selectedAction.value = action
    submitError.value = null
    const name = current.value?.file?.name || ''
    if (action === 'rename') {
      if (!newName.value) newName.value = suggestName(name, 'rename')
    } else if (action === 'keep-both') {
      if (!newName.value) newName.value = suggestName(name, 'keep-both')
    } else {
      newName.value = ''
    }
  }

  const canSubmit = computed(() => {
    if (!current.value) return false
    if (submitting.value) return false
    if (selectedAction.value === 'rename' || selectedAction.value === 'keep-both') {
      return Boolean(String(newName.value || '').trim())
    }
    return true
  })

  const submit = async () => {
    if (!current.value) return false
    if (!canSubmit.value) return false
    submitError.value = null
    submitting.value = true
    try {
      const decision: FileCopyConflictDecision =
        selectedAction.value === 'rename' || selectedAction.value === 'keep-both'
          ? { action: selectedAction.value, newName: String(newName.value || '').trim() }
          : { action: selectedAction.value }

      const resp = await window.electronAPI.fileCopy.decideConflict({
        requestId: current.value.requestId,
        decision,
      }) as any

      const normalized = resp && typeof resp === 'object' && 'success' in resp ? resp : { success: true, data: resp }
      const ok = Boolean(normalized.success && (normalized.data?.success ?? true))
      if (!ok) {
        submitError.value = '回传决策失败，请重试'
        return false
      }

      current.value = null
      submitting.value = false
      submitError.value = null
      selectedAction.value = 'replace'
      newName.value = ''
      openNext()
      return true
    } catch (e: any) {
      submitError.value = e?.message || '回传决策失败，请重试'
      submitting.value = false
      return false
    }
  }

  return {
    visible,
    current,
    reasonText,
    selectedAction,
    newName,
    submitError,
    submitting,
    canSubmit,
    ensureSubscribed,
    cleanup,
    setAction,
    submit,
  }
})

