import { computed, ref, shallowRef, watch, type ComputedRef, type Ref } from 'vue'

export type DeleteProgressStatus = 'idle' | 'deleting' | 'completed'

export type DeleteProgressState = {
  key: string
  visible: Ref<boolean>
  status: Ref<DeleteProgressStatus>
  total: Ref<number>
  done: Ref<number>
  currentIndex: Ref<number>
  currentName: Ref<string>
  failCount: Ref<number>
  isCancelled: Ref<boolean>
  start: (n: number, taskName?: string) => void
  finish: () => void
  cancel: () => void
  dismiss: () => void
  title: ComputedRef<string>
  fractionText: ComputedRef<string>
  percent: ComputedRef<number>
  percentText: ComputedRef<string>
}

const deleteProgressRegistry = new Map<string, DeleteProgressState>()

import { useTaskMonitorStore } from '../../../stores/system/taskMonitorStore'

const createDeleteProgressState = (key: string): DeleteProgressState => {
  const visible = ref(false)
  const status = ref<DeleteProgressStatus>('idle')
  const total = ref(0)
  const done = ref(0)
  const currentIndex = ref(0)
  const currentName = ref('')
  const failCount = ref(0)
  const isCancelled = ref(false)
  let hideTimer: number | null = null

  const clearState = () => {
    visible.value = false
    status.value = 'idle'
    total.value = 0
    done.value = 0
    currentIndex.value = 0
    currentName.value = ''
    failCount.value = 0
    isCancelled.value = false
  }

  const removeFromRegistry = () => {
    const current = deleteProgressRegistry.get(key)
    if (current === state) deleteProgressRegistry.delete(key)
  }

  const start = (n: number, taskName?: string) => {
    if (hideTimer) window.clearTimeout(hideTimer)
    hideTimer = null
    visible.value = true
    status.value = 'deleting'
    total.value = Math.max(0, Number(n || 0))
    done.value = 0
    currentIndex.value = 0
    currentName.value = ''
    failCount.value = 0
    isCancelled.value = false

    const taskMonitorStore = useTaskMonitorStore()
    if (taskMonitorStore) {
      taskMonitorStore.register({
        id: `delete-${key}`,
        name: taskName || `移入回收站操作（${total.value}个）`,
        type: 'delete',
        total: total.value,
      })
    }
  }

  const cancel = () => {
    if (status.value === 'deleting') {
      isCancelled.value = true
    }
  }

  const finish = () => {
    status.value = 'completed'
    const t = total.value
    if (t > 0) done.value = Math.min(t, Math.max(done.value, t))
    
    const taskMonitorStore = useTaskMonitorStore()
    if (taskMonitorStore) {
      if (failCount.value > 0) {
        taskMonitorStore.fail(`delete-${key}`, `完成，有 ${failCount.value} 个失败`)
      } else if (isCancelled.value) {
        taskMonitorStore.cancel(`delete-${key}`)
      } else {
        taskMonitorStore.complete(`delete-${key}`)
      }
    }

    if (hideTimer) window.clearTimeout(hideTimer)
    hideTimer = window.setTimeout(() => {
      clearState()
      hideTimer = null
      removeFromRegistry()
    }, 1800)
  }

  const dismiss = () => {
    if (hideTimer) window.clearTimeout(hideTimer)
    hideTimer = null
    clearState()
    removeFromRegistry()
  }

  const title = computed(() => {
    if (status.value === 'deleting') {
      return isCancelled.value ? '正在取消...' : '移入回收站中'
    }
    if (status.value === 'completed') {
      return isCancelled.value ? '移入回收站已取消' : '移入回收站完成'
    }
    return ''
  })

  const fractionText = computed(() => {
    const t = total.value
    if (!t) return ''
    const current =
      status.value === 'deleting' ? Math.min(t, Math.max(1, currentIndex.value || (done.value + 1))) : Math.min(t, Math.max(0, done.value))
    return `${current}/${t}`
  })

  const percent = computed(() => {
    const t = total.value
    if (!t) return 0
    const current =
      status.value === 'deleting' ? Math.min(t, Math.max(1, currentIndex.value || (done.value + 1))) : Math.min(t, Math.max(0, done.value))
    return Math.min(100, Math.max(0, (current / t) * 100))
  })

  const percentText = computed(() => {
    const t = total.value
    if (!t) return ''
    return `${Math.round(percent.value)}%`
  })

  const state: DeleteProgressState = {
    key,
    visible,
    status,
    total,
    done,
    currentIndex,
    currentName,
    failCount,
    isCancelled,
    start,
    finish,
    cancel,
    dismiss,
    title,
    fractionText,
    percent,
    percentText,
  }
  return state
}

const normalizeKey = (raw: unknown) => String(raw || '').trim()

const getDeleteProgressState = (key: string) => {
  const k = normalizeKey(key)
  const cached = deleteProgressRegistry.get(k)
  if (cached) return cached
  const next = createDeleteProgressState(k)
  deleteProgressRegistry.set(k, next)
  return next
}

export const useDeleteProgress = (keyRef: Ref<string>) => {
  const state = shallowRef<DeleteProgressState>(getDeleteProgressState(keyRef.value))
  watch(
    keyRef,
    (k) => {
      state.value = getDeleteProgressState(k)
    },
    { immediate: true },
  )
  return state
}
