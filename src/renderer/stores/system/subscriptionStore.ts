import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { createRendererLogger } from '../../utils/logger'
import { fetchMySubscription } from '../../utils/backendBilling'
import { getBackendAuthConfig } from '../../utils/backendAuth'
import { useAuthStore } from './authStore'

const LOGIN_BYPASS_ENABLED = true
const LOGIN_BYPASS_SUBSCRIPTION_EXPIRES_AT = new Date('2099-12-31T23:59:59.999Z').getTime()

type SubscriptionState = {
  expiresAt: number
  planName: string
  planPriceCents: number
  billingPeriod: string
  periodCount: number
  lastFetchedAt: number
}

const logger = createRendererLogger('SubscriptionStore')

const normalizeNumber = (value: unknown): number => {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

const normalizeText = (value: unknown): string => {
  if (typeof value !== 'string') return ''
  return value.trim()
}

const parseExpiresAt = (value: unknown): number => {
  if (!value) return 0
  if (value instanceof Date) return value.getTime()
  const text = String(value)
  const t = Date.parse(text)
  return Number.isFinite(t) ? t : 0
}

export const useSubscriptionStore = defineStore('subscription', () => {
  const expiresAt = ref(0)
  const planName = ref('')
  const planPriceCents = ref(0)
  const billingPeriod = ref('')
  const periodCount = ref(0)
  const lastFetchedAt = ref(0)
  const isInitialized = ref(false)

  const isActive = computed(() => {
    if (!expiresAt.value) return false
    return Date.now() < expiresAt.value
  })

  const persist = async () => {
    const payload: SubscriptionState = {
      expiresAt: expiresAt.value,
      planName: planName.value,
      planPriceCents: planPriceCents.value,
      billingPeriod: billingPeriod.value,
      periodCount: periodCount.value,
      lastFetchedAt: lastFetchedAt.value,
    }
    await window.electronAPI.config.updateItem('subscription', payload)
  }

  const applyBypassSubscription = () => {
    expiresAt.value = LOGIN_BYPASS_SUBSCRIPTION_EXPIRES_AT
    planName.value = '本地模式'
    planPriceCents.value = 0
    billingPeriod.value = 'LIFETIME'
    periodCount.value = 1
    lastFetchedAt.value = Date.now()
  }

  const init = async () => {
    if (isInitialized.value) return
    try {
      const res = await window.electronAPI.config.getItem('subscription')
      if (res.success && res.data) {
        const raw = res.data as Partial<SubscriptionState>
        expiresAt.value = normalizeNumber(raw.expiresAt)
        planName.value = normalizeText(raw.planName)
        planPriceCents.value = normalizeNumber(raw.planPriceCents)
        billingPeriod.value = normalizeText(raw.billingPeriod)
        periodCount.value = normalizeNumber(raw.periodCount)
        lastFetchedAt.value = normalizeNumber(raw.lastFetchedAt)
      }
      if (LOGIN_BYPASS_ENABLED) {
        applyBypassSubscription()
      }
    } catch (error) {
      logger.error('加载订阅状态失败', error)
      if (LOGIN_BYPASS_ENABLED) {
        applyBypassSubscription()
      }
    } finally {
      isInitialized.value = true
    }
  }

  const clear = async () => {
    if (LOGIN_BYPASS_ENABLED) {
      applyBypassSubscription()
      await persist()
      return
    }
    expiresAt.value = 0
    planName.value = ''
    planPriceCents.value = 0
    billingPeriod.value = ''
    periodCount.value = 0
    lastFetchedAt.value = 0
    await window.electronAPI.config.updateItem('subscription', null)
  }

  const refresh = async () => {
    if (LOGIN_BYPASS_ENABLED) {
      applyBypassSubscription()
      await persist()
      return
    }
    const authStore = useAuthStore()
    await authStore.init()
    if (!authStore.isLoggedIn) {
      await clear()
      return
    }
    const cfg = await getBackendAuthConfig()
    const sub = await fetchMySubscription(cfg, { accessToken: authStore.accessToken, clientId: authStore.clientId })
    expiresAt.value = parseExpiresAt(sub.expiresAt)
    planName.value = normalizeText(sub.planName)
    planPriceCents.value = normalizeNumber(sub.planPriceCents)
    billingPeriod.value = normalizeText(sub.billingPeriod)
    periodCount.value = normalizeNumber(sub.periodCount)
    lastFetchedAt.value = Date.now()
    await persist()
  }

  const refreshIfStale = async (ttlMs: number) => {
    const now = Date.now()
    if (lastFetchedAt.value && now - lastFetchedAt.value < ttlMs) return
    await refresh()
  }

  return {
    expiresAt,
    planName,
    planPriceCents,
    billingPeriod,
    periodCount,
    lastFetchedAt,
    isInitialized,
    isActive,
    init,
    clear,
    refresh,
    refreshIfStale,
  }
})

