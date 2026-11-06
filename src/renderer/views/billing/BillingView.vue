<template>
  <div class="h-screen w-screen flex flex-col" :style="{ backgroundColor: 'var(--content-bg)' }">
    <div class="flex items-center justify-between px-4 py-3 border-b" :style="{ borderColor: 'var(--content-border)', WebkitAppRegion: 'drag' }">
      <div class="text-sm font-semibold" :style="{ color: 'var(--content-text)' }">订阅与支付</div>
    </div>

    <div class="flex-1 overflow-y-auto p-6">
      <div class="max-w-3xl mx-auto flex flex-col gap-6">
        <div class="rounded-xl border p-4" :style="{ borderColor: 'var(--content-border)', backgroundColor: 'var(--sidebar-bg)' }">
          <div class="flex items-center justify-between gap-4">
            <div class="flex flex-col gap-1">
              <div class="text-sm font-semibold" :style="{ color: 'var(--content-text)' }">当前订阅</div>
              <div class="text-xs" :style="{ color: 'var(--content-text-secondary)' }">
                <span v-if="subscriptionActive">有效期至：{{ expiresAtText }}</span>
                <span v-else>未开通或已到期</span>
              </div>
              <div v-if="subscriptionPlanText" class="text-xs" :style="{ color: 'var(--content-text-secondary)' }">
                {{ subscriptionPlanText }}
              </div>
            </div>
            <button
              type="button"
              class="px-3 py-2 rounded text-sm"
              :style="{ backgroundColor: 'var(--primary-color)', color: '#fff' }"
              @click="refreshSubscription"
            >
              刷新订阅
            </button>
          </div>
        </div>

        <div class="rounded-xl border p-4" :style="{ borderColor: 'var(--content-border)', backgroundColor: 'var(--sidebar-bg)' }">
          <div class="text-sm font-semibold mb-3" :style="{ color: 'var(--content-text)' }">套餐</div>
          <div v-if="loadingPlans" class="text-sm" :style="{ color: 'var(--content-text-secondary)' }">正在加载套餐…</div>
          <div v-else-if="plans.length === 0" class="text-sm" :style="{ color: 'var(--content-text-secondary)' }">暂无可购买套餐</div>
          <div v-else class="flex flex-col gap-3">
            <div
              v-for="plan in plans"
              :key="String(plan.planId)"
              class="rounded-lg border p-4 flex items-center justify-between gap-4"
              :style="{ borderColor: 'var(--content-border)', backgroundColor: 'var(--content-bg)' }"
            >
              <div class="flex flex-col gap-1">
                <div class="text-sm font-semibold" :style="{ color: 'var(--content-text)' }">{{ plan.name || '未命名套餐' }}</div>
                <div class="text-xs" :style="{ color: 'var(--content-text-secondary)' }">
                  <span>{{ formatPrice(plan.priceCents) }}</span>
                  <span class="ml-2">{{ formatPeriod(plan.billingPeriod, plan.periodCount) }}</span>
                  <span v-if="plan.trialDays" class="ml-2">含试用 {{ plan.trialDays }} 天</span>
                </div>
                <div v-if="plan.description" class="text-xs" :style="{ color: 'var(--content-text-secondary)' }">{{ plan.description }}</div>
              </div>
              <button
                type="button"
                class="px-3 py-2 rounded text-sm shrink-0"
                :disabled="creatingOrder"
                :style="{
                  backgroundColor: creatingOrder ? 'var(--content-border)' : 'var(--primary-color)',
                  color: creatingOrder ? 'var(--content-text-secondary)' : '#fff',
                }"
                @click="startPurchase(plan.planId)"
              >
                {{ creatingOrder ? '处理中…' : '购买/续费' }}
              </button>
            </div>
          </div>
        </div>

        <div
          v-if="orderNo"
          class="rounded-xl border p-4 flex flex-col gap-3"
          :style="{ borderColor: 'var(--content-border)', backgroundColor: 'var(--sidebar-bg)' }"
        >
          <div class="flex items-center justify-between gap-4">
            <div class="text-sm font-semibold" :style="{ color: 'var(--content-text)' }">扫码支付</div>
            <button
              type="button"
              class="px-3 py-2 rounded text-sm"
              :style="{ backgroundColor: 'var(--content-border)', color: 'var(--content-text)' }"
              @click="cancelOrder"
            >
              关闭
            </button>
          </div>

          <div class="text-xs" :style="{ color: 'var(--content-text-secondary)' }">订单号：{{ orderNo }}</div>
          <div v-if="orderExpiresAtText" class="text-xs" :style="{ color: 'var(--content-text-secondary)' }">有效期至：{{ orderExpiresAtText }}</div>

          <div v-if="qrCodeImage" class="flex flex-col items-center gap-3">
            <div class="relative">
              <img :src="qrCodeImage" alt="微信支付二维码" class="w-72 h-72 rounded bg-white p-3" />
              <button
                v-if="orderExpired"
                type="button"
                class="absolute inset-0 rounded flex flex-col items-center justify-center gap-3"
                :style="{ backgroundColor: 'rgba(0, 0, 0, 0.62)', color: '#fff' }"
                @click="retryOrder"
              >
                <div class="text-lg font-semibold">订单已过期</div>
                <div class="flex items-center gap-2 text-sm">
                  <i class="pi pi-refresh"></i>
                  <span>点击重新下单</span>
                </div>
              </button>
            </div>
            <div class="text-sm text-center" :style="{ color: 'var(--content-text)' }">
              请使用微信扫一扫完成支付
            </div>
            <div v-if="polling" class="text-xs" :style="{ color: 'var(--content-text-secondary)' }">等待支付结果确认…</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useToast } from 'primevue/usetoast'
import { createQrCodeDataUrl } from '../../utils/qrcode'
import { getBackendAuthConfig } from '../../utils/backendAuth'
import { createWechatPayNativeOrder, fetchBillingOrderStatus, fetchBillingPlans } from '../../utils/backendBilling'
import { useAuthStore } from '../../stores/system/authStore'
import { useSubscriptionStore } from '../../stores/system/subscriptionStore'

const router = useRouter()
const route = useRoute()
const toast = useToast()
const authStore = useAuthStore()
const subscriptionStore = useSubscriptionStore()

const plans = ref<Array<{ planId?: number; name?: string; priceCents?: number; billingPeriod?: string; periodCount?: number; trialDays?: number; description?: string }>>([])
const loadingPlans = ref(false)
const creatingOrder = ref(false)
const polling = ref(false)

const orderNo = ref('')
const orderExpiresAt = ref(0)
const orderExpired = computed(() => Boolean(orderExpiresAt.value) && Date.now() > orderExpiresAt.value)
const qrCodeImage = ref('')
const selectedPlanId = ref<number | null>(null)

let pollTimer: ReturnType<typeof setInterval> | null = null
let pollInFlight = false

const subscriptionActive = computed(() => subscriptionStore.isActive)
const expiresAtText = computed(() => (subscriptionStore.expiresAt ? new Date(subscriptionStore.expiresAt).toLocaleString() : ''))
const subscriptionPlanText = computed(() => {
  if (!subscriptionStore.planName) return ''
  const price = subscriptionStore.planPriceCents ? formatPrice(subscriptionStore.planPriceCents) : ''
  const period = formatPeriod(subscriptionStore.billingPeriod, subscriptionStore.periodCount)
  return [subscriptionStore.planName, price, period].filter(Boolean).join(' · ')
})

const orderExpiresAtText = computed(() => (orderExpiresAt.value ? new Date(orderExpiresAt.value).toLocaleString() : ''))

const formatPrice = (cents?: number) => {
  const value = Number(cents || 0)
  if (!value) return '免费'
  return `¥${(value / 100).toFixed(2)}`
}

const formatPeriod = (period?: string, count?: number) => {
  const p = String(period || '').toUpperCase()
  const c = Number(count || 1)
  if (!p) return ''
  if (p === 'YEAR') return `每${c}年`
  if (p === 'DAYS') return `每${c}天`
  return `每${c}月`
}

const stopPolling = () => {
  polling.value = false
  pollInFlight = false
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
}

const startPolling = async (cfg: Awaited<ReturnType<typeof getBackendAuthConfig>>, order: string) => {
  stopPolling()
  polling.value = true
  pollTimer = setInterval(async () => {
    if (!authStore.isLoggedIn) return
    if (!orderNo.value || orderNo.value !== order) return
    if (orderExpired.value) return
    if (pollInFlight) return
    pollInFlight = true
    try {
      const status = await fetchBillingOrderStatus(cfg, { accessToken: authStore.accessToken, clientId: authStore.clientId }, order)
      if (String(status.status || '').toUpperCase() === 'PAID') {
        stopPolling()
        await subscriptionStore.refresh()
        toast.add({ severity: 'success', summary: '支付成功', detail: '订阅已生效', life: 2500 })
        const redirect = String(route.query.redirect || '')
        if (redirect) {
          router.replace(redirect)
        } else {
          router.replace({ name: 'Home' })
        }
      }
    } catch (error) {
      stopPolling()
      toast.add({ severity: 'error', summary: '查询支付失败', detail: String((error as Error)?.message || error), life: 3500 })
    } finally {
      pollInFlight = false
    }
  }, 1500)
}

const loadPlans = async () => {
  loadingPlans.value = true
  try {
    const cfg = await getBackendAuthConfig()
    plans.value = await fetchBillingPlans(cfg)
  } catch (error) {
    toast.add({ severity: 'error', summary: '加载套餐失败', detail: String((error as Error)?.message || error), life: 4000 })
    plans.value = []
  } finally {
    loadingPlans.value = false
  }
}

const refreshSubscription = async () => {
  try {
    await subscriptionStore.refresh()
  } catch (error) {
    toast.add({ severity: 'error', summary: '刷新订阅失败', detail: String((error as Error)?.message || error), life: 3500 })
  }
}

const startPurchase = async (planId?: number) => {
  if (!planId) return
  creatingOrder.value = true
  stopPolling()
  qrCodeImage.value = ''
  orderNo.value = ''
  orderExpiresAt.value = 0
  selectedPlanId.value = planId
  try {
    await authStore.init()
    if (!authStore.isLoggedIn) {
      toast.add({ severity: 'warn', summary: '需要登录', detail: '请先登录后再购买', life: 2500 })
      router.replace({ name: 'Home' })
      return
    }
    const cfg = await getBackendAuthConfig()
    const order = await createWechatPayNativeOrder(cfg, { accessToken: authStore.accessToken, clientId: authStore.clientId }, planId)
    orderNo.value = String(order.orderNo || '')
    orderExpiresAt.value = order.expiresAt ? Date.parse(String(order.expiresAt)) : 0
    const codeUrl = String(order.codeUrl || '')
    if (!codeUrl) {
      await subscriptionStore.refresh()
      toast.add({ severity: 'success', summary: '订阅已开通', detail: '无需支付', life: 2500 })
      const redirect = String(route.query.redirect || '')
      if (redirect) {
        router.replace(redirect)
      } else {
        router.replace({ name: 'Home' })
      }
      return
    }
    qrCodeImage.value = await createQrCodeDataUrl(codeUrl)
    await startPolling(cfg, orderNo.value)
  } catch (error) {
    toast.add({ severity: 'error', summary: '创建订单失败', detail: String((error as Error)?.message || error), life: 4000 })
  } finally {
    creatingOrder.value = false
  }
}

const retryOrder = async () => {
  if (!selectedPlanId.value) return
  await startPurchase(selectedPlanId.value)
}

const cancelOrder = () => {
  stopPolling()
  qrCodeImage.value = ''
  orderNo.value = ''
  orderExpiresAt.value = 0
  selectedPlanId.value = null
}

onMounted(async () => {
  await subscriptionStore.init()
  await authStore.init()
  if (authStore.isLoggedIn) {
    try {
      await subscriptionStore.refreshIfStale(0)
    } catch {
    }
  }
  await loadPlans()
})

onBeforeUnmount(() => {
  stopPolling()
})
</script>
