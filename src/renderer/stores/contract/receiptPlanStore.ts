import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import { useLibraryStore } from '../library/libraryStore'

export type ReceiptPlan = {
  id: string
  contract_id: string
  contract_code: string
  contract_name: string
  direction: string
  plan_name: string
  receipt_frequency: string
  expected_amount: number
  expected_date: string
  received_amount: number
  remark: string
  custom1: string
}

const sanitizeMoney = (value: unknown) => {
  const n = Number(value ?? 0)
  return Number.isFinite(n) ? n : 0
}

const RECEIPT_PLAN_STORAGE_KEY_PREFIX = 'receipt_plan_store_plans_v1'
const LEGACY_RECEIPT_PLAN_STORAGE_KEY = 'receipt_plan_store_plans_v1'

const buildReceiptPlanStorageKey = (libraryPath: string) => {
  const p = String(libraryPath || '').trim()
  return p ? `${RECEIPT_PLAN_STORAGE_KEY_PREFIX}:${p}` : ''
}

const normalizeReceiptPlan = (raw: any): ReceiptPlan | null => {
  if (!raw || typeof raw !== 'object') return null
  const id = String(raw.id ?? '').trim()
  if (!id) return null
  return {
    id,
    contract_id: String(raw.contract_id ?? ''),
    contract_code: String(raw.contract_code ?? ''),
    contract_name: String(raw.contract_name ?? ''),
    direction: String(raw.direction ?? ''),
    plan_name: String(raw.plan_name ?? ''),
    receipt_frequency: String((raw as any).receipt_frequency ?? ''),
    expected_amount: sanitizeMoney(raw.expected_amount),
    expected_date: String(raw.expected_date ?? ''),
    received_amount: sanitizeMoney(raw.received_amount),
    remark: String(raw.remark ?? ''),
    custom1: String(raw.custom1 ?? ''),
  }
}

export const useReceiptPlanStore = defineStore('receiptPlan', () => {
  const libraryStore = useLibraryStore()
  const plans = ref<ReceiptPlan[]>([])
  const seededStorageKey = ref('')

  const currentLibraryPath = computed(() => {
    const p = String(libraryStore.currentLibrary?.path || '').trim()
    if (p) return p
    return String(localStorage.getItem('currentLibraryPath') || '').trim()
  })

  const storageKey = computed(() => buildReceiptPlanStorageKey(currentLibraryPath.value))

  const getById = (id: string) => {
    return plans.value.find(p => p.id === id) || null
  }

  const ensureSeeded = () => {
    const key = storageKey.value
    if (!key) {
      plans.value = []
      seededStorageKey.value = ''
      return
    }
    if (seededStorageKey.value === key) return
    seededStorageKey.value = key

    let raw = localStorage.getItem(key)
    if (!raw) {
      const legacy = localStorage.getItem(LEGACY_RECEIPT_PLAN_STORAGE_KEY)
      if (legacy && currentLibraryPath.value) {
        try {
          localStorage.setItem(key, legacy)
          localStorage.removeItem(LEGACY_RECEIPT_PLAN_STORAGE_KEY)
          raw = legacy
        } catch {
          raw = null
        }
      }
    }
    if (!raw) return
    try {
      const parsed = JSON.parse(raw) as unknown
      if (!Array.isArray(parsed)) return
      const next = parsed.map(normalizeReceiptPlan).filter((x): x is ReceiptPlan => Boolean(x))
      plans.value = next
    } catch {
      return
    }
  }

  const adjustReceivedAmount = (planId: string, delta: number) => {
    const plan = getById(planId)
    if (!plan) return
    plan.received_amount = Math.max(0, sanitizeMoney(plan.received_amount) + sanitizeMoney(delta))
  }

  watch(
    plans,
    (value) => {
      const key = storageKey.value
      if (!key) return
      try {
        localStorage.setItem(key, JSON.stringify(value || []))
      } catch {
        return
      }
    },
    { deep: true }
  )

  watch(
    storageKey,
    (key) => {
      if (!key) {
        plans.value = []
        seededStorageKey.value = ''
        return
      }
      seededStorageKey.value = key
      let raw = localStorage.getItem(key)
      if (!raw) {
        const legacy = localStorage.getItem(LEGACY_RECEIPT_PLAN_STORAGE_KEY)
        if (legacy && currentLibraryPath.value) {
          try {
            localStorage.setItem(key, legacy)
            localStorage.removeItem(LEGACY_RECEIPT_PLAN_STORAGE_KEY)
            raw = legacy
          } catch {
            raw = null
          }
        }
      }
      if (!raw) {
        plans.value = []
        return
      }
      try {
        const parsed = JSON.parse(raw) as unknown
        if (!Array.isArray(parsed)) {
          plans.value = []
          return
        }
        plans.value = parsed.map(normalizeReceiptPlan).filter((x): x is ReceiptPlan => Boolean(x))
      } catch {
        plans.value = []
      }
    },
    { immediate: true }
  )

  return {
    plans,
    getById,
    ensureSeeded,
    adjustReceivedAmount,
  }
})
