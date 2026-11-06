import { computed, ref } from 'vue'
import type { Ref } from 'vue'
import type { CalendarEvent } from './calendarTypes'
import { recentOptions } from './calendarConstants'

type LoggerLike = { error: (...args: any[]) => void }

export function useCalendarFilters(options: {
  events: Ref<CalendarEvent[]>
  getLibraryPath: () => string
  logger: LoggerLike
}) {
  const filterBarVisible = ref(false)
  const proxyFilters = ref<{
    recent: string[]
    sourceCategory: string[]
    partyA: string[]
    partyB: string[]
    contractType: string[]
    date: string[]
  }>({
    recent: [],
    sourceCategory: [],
    partyA: [],
    partyB: [],
    contractType: [],
    date: [],
  })

  const filterSearchInputs = ref({
    partyA: '',
    partyB: '',
    contractType: '',
  })

  const popoverRecent = ref()
  const popoverSourceCategory = ref()
  const popoverPartyA = ref()
  const popoverPartyB = ref()
  const popoverContractType = ref()
  const popoverDate = ref()

  const sourceCategoryOptions = [
    { label: '合同', value: 'contract' },
    { label: '产品', value: 'product' },
  ]

  const formatDateKey = (date: Date) => {
    const y = date.getFullYear()
    const m = String(date.getMonth() + 1).padStart(2, '0')
    const d = String(date.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }

  const parseDateKey = (value: string): Date | null => {
    const m = String(value || '').trim().match(/^(\d{4})-(\d{2})-(\d{2})$/)
    if (!m) return null
    const y = Number(m[1])
    const mm = Number(m[2])
    const dd = Number(m[3])
    if (!Number.isFinite(y) || !Number.isFinite(mm) || !Number.isFinite(dd)) return null
    if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return null
    return new Date(y, mm - 1, dd)
  }

  const dateValue = computed<Date | null>({
    get: () => {
      const raw = proxyFilters.value.date[0]
      return raw ? parseDateKey(raw) : null
    },
    set: (value) => {
      proxyFilters.value.date = value ? [formatDateKey(value)] : []
    },
  })

  const dateLabel = computed(() => {
    const date = dateValue.value
    if (!date) return ''
    return formatDateKey(date)
  })

  const togglePopover = (popoverRef: any, event: Event) => {
    // 模板里传参时 ref 可能已被自动解包，这里同时兼容两种形态
    const instance = popoverRef?.toggle ? popoverRef : popoverRef?.value
    instance?.toggle?.(event)
  }

  const clearFilter = (field: keyof typeof proxyFilters.value) => {
    proxyFilters.value[field] = []
  }

  const toggleFilterOption = (field: keyof typeof proxyFilters.value, value: string) => {
    const arr = proxyFilters.value[field]
    const idx = arr.indexOf(value)
    if (idx > -1) {
      arr.splice(idx, 1)
    } else {
      arr.push(value)
    }
  }

  const isFilterOptionSelected = (field: keyof typeof proxyFilters.value, value: string) => {
    return proxyFilters.value[field].includes(value)
  }

  const basePartyAOptions = ref<{ label: string; value: string }[]>([])
  const basePartyBOptions = ref<{ label: string; value: string }[]>([])
  const baseContractTypeOptions = ref<{ label: string; value: string }[]>([])

  const loadFilterOptions = async () => {
    try {
      const libraryPath = options.getLibraryPath()
      void libraryPath

      const [clientRes, supplierRes, dictRes] = await Promise.all([
        window.electronAPI.customer.getList({ page: 1, pageSize: 1000 }),
        window.electronAPI.supplier.getList({ page: 1, pageSize: 1000 }),
        window.electronAPI.dictionary.getList({ group_name: '合同类型', page: 1, pageSize: 1000 })
      ])

      if (clientRes.success && clientRes.data) {
        basePartyAOptions.value = (clientRes.data.data || (clientRes.data as any).items || [])
          .map((item: any) => ({ label: item.name || item.client_name || '未知', value: item.name || item.client_name || '' }))
          .filter((item: any) => item.value)
      }
      if (supplierRes.success && supplierRes.data) {
        basePartyBOptions.value = (supplierRes.data.data || (supplierRes.data as any).items || [])
          .map((item: any) => ({ label: item.name || '未知', value: item.name || '' }))
          .filter((item: any) => item.value)
      }
      if (dictRes.success && dictRes.data) {
        baseContractTypeOptions.value = (dictRes.data.data || (dictRes.data as any).items || [])
          .map((item: any) => {
            const val = item.dict_value || item.name || item.label || ''
            const lbl = item.dict_label || item.name || item.label || val
            return { label: lbl, value: val }
          })
          .filter((item: any) => item.value)
      }
    } catch (error) {
      options.logger.error('加载过滤选项失败:', error)
    }
  }

  const getUniqueOptions = (field: keyof CalendarEvent, baseOptions: { label: string; value: string }[]) => {
    const set = new Map<string, string>()
    for (const opt of baseOptions) set.set(opt.value, opt.label)
    for (const e of options.events.value) {
      const val = e[field] as string
      if (val && !set.has(val)) set.set(val, val)
    }
    return Array.from(set.entries()).map(([value, label]) => ({ label, value }))
  }

  const partyAOptions = computed(() => {
    const opts = getUniqueOptions('partyA', basePartyAOptions.value)
    const q = filterSearchInputs.value.partyA.toLowerCase()
    return q ? opts.filter((o) => o.label.toLowerCase().includes(q)) : opts
  })

  const partyBOptions = computed(() => {
    const opts = getUniqueOptions('partyB', basePartyBOptions.value)
    const q = filterSearchInputs.value.partyB.toLowerCase()
    return q ? opts.filter((o) => o.label.toLowerCase().includes(q)) : opts
  })

  const contractTypeOptions = computed(() => {
    const opts = getUniqueOptions('contractType', baseContractTypeOptions.value)
    const q = filterSearchInputs.value.contractType.toLowerCase()
    return q ? opts.filter((o) => o.label.toLowerCase().includes(q)) : opts
  })

  const filteredEvents = computed(() => {
    let result = options.events.value

    if (proxyFilters.value.partyA.length > 0) {
      result = result.filter((e) => e.partyA && proxyFilters.value.partyA.includes(e.partyA))
    }
    if (proxyFilters.value.sourceCategory.length > 0) {
      result = result.filter((e) => e.sourceCategory && proxyFilters.value.sourceCategory.includes(e.sourceCategory))
    }
    if (proxyFilters.value.partyB.length > 0) {
      result = result.filter((e) => e.partyB && proxyFilters.value.partyB.includes(e.partyB))
    }
    if (proxyFilters.value.contractType.length > 0) {
      result = result.filter((e) => e.contractType && proxyFilters.value.contractType.includes(e.contractType))
    }

    if (proxyFilters.value.recent.length > 0) {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      result = result.filter((e) => {
        const d = new Date(e.date)
        d.setHours(0, 0, 0, 0)
        const diffDays = (today.getTime() - d.getTime()) / (1000 * 3600 * 24)
        return proxyFilters.value.recent.some((r) => {
          if (r === 'today') return diffDays === 0
          if (r === 'this_week') return d.getDay() >= 1 && diffDays >= 0 && diffDays <= 7
          if (r === 'this_month') return d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear()
          if (r === 'last_3_months') return diffDays >= 0 && diffDays <= 90
          return true
        })
      })
    }

    if (proxyFilters.value.date.length > 0) {
      const dateKeys = new Set(proxyFilters.value.date)
      result = result.filter((e) => {
        const dateKey = formatDateKey(new Date(e.date))
        return dateKeys.has(dateKey)
      })
    }

    return result
  })

  return {
    filterBarVisible,
    proxyFilters,
    filterSearchInputs,
    popoverRecent,
    popoverSourceCategory,
    popoverPartyA,
    popoverPartyB,
    popoverContractType,
    popoverDate,
    togglePopover,
    clearFilter,
    toggleFilterOption,
    isFilterOptionSelected,
    loadFilterOptions,
    partyAOptions,
    partyBOptions,
    contractTypeOptions,
    sourceCategoryOptions,
    recentOptions,
    dateValue,
    dateLabel,
    filteredEvents
  }
}
