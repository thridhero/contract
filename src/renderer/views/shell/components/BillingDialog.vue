<template>
  <Dialog
    v-model:visible="visibleProxy"
    modal
    :style="{ width: '680px' }"
    :closable="false"
    :draggable="false"
    class="theme-dialog"
    @after-hide="handleClose"
  >
    <template #container="{ closeCallback }">
      <div
        class="flex flex-col rounded-xl overflow-hidden"
        :style="{ backgroundColor: 'var(--sidebar-bg)', color: 'var(--content-text)', maxHeight: '90vh' }"
      >
        <!-- 头部 -->
        <div class="flex items-center justify-between px-6 py-4 border-b shrink-0" :style="{ borderColor: 'var(--content-border)' }">
          <div>
            <div class="text-base font-bold">会员服务</div>
            <div class="text-xs mt-0.5" :style="{ color: 'var(--content-text-secondary)' }">升级会员，解锁全部功能</div>
          </div>
          <button
            class="w-7 h-7 flex items-center justify-center rounded-full text-sm transition-colors hover:opacity-70"
            :style="{ color: 'var(--content-text-secondary)' }"
            @click="closeCallback"
          >
            <i class="pi pi-times"></i>
          </button>
        </div>

        <div class="flex-1 overflow-y-auto px-6 py-5">
          <!-- 当前订阅状态 -->
          <div
            v-if="subscriptionActive"
            class="flex items-center justify-between gap-4 mb-5 px-4 py-3 rounded-lg border"
            :style="{ borderColor: 'var(--primary-color)', backgroundColor: 'color-mix(in srgb, var(--primary-color) 8%, transparent)' }"
          >
            <div class="flex items-center gap-2 text-sm">
              <i class="pi pi-check-circle" :style="{ color: 'var(--primary-color)' }"></i>
              <span>当前订阅：{{ subscriptionPlanText }} · {{ expiresAtText }}</span>
            </div>
            <button
              type="button"
              class="px-3 py-1.5 rounded text-xs shrink-0"
              :style="{ backgroundColor: 'var(--primary-color)', color: '#fff' }"
              @click="refreshSubscription"
            >
              刷新
            </button>
          </div>

          <!-- 加载中 -->
          <div v-if="loadingPlans" class="flex items-center justify-center py-16">
            <i class="pi pi-spin pi-spinner text-2xl" :style="{ color: 'var(--content-text-secondary)' }"></i>
          </div>

          <!-- 无套餐 -->
          <div v-else-if="plans.length === 0" class="text-center py-16 text-sm" :style="{ color: 'var(--content-text-secondary)' }">
            暂无可购买套餐
          </div>

          <!-- 套餐卡片 -->
          <div v-else class="flex gap-4" :class="plans.length >= 3 ? 'flex-nowrap overflow-x-auto pb-2' : 'flex-wrap justify-center'">
            <div
              v-for="(plan, idx) in plans"
              :key="String(plan.planId)"
              class="relative flex flex-col rounded-xl border transition-shadow hover:shadow-lg min-w-[190px]"
              :class="isRecommended(idx) ? 'scale-[1.02]' : ''"
              :style="{
                flex: plans.length <= 2 ? `1 1 ${100 / plans.length - 5}%` : '1 1 0',
                borderColor: isRecommended(idx) ? 'var(--primary-color)' : 'var(--content-border)',
                backgroundColor: 'var(--content-bg)',
              }"
            >
              <!-- 推荐标签 -->
              <div
                v-if="isRecommended(idx)"
                class="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-0.5 rounded-full text-xs font-medium whitespace-nowrap"
                :style="{ backgroundColor: 'var(--primary-color)', color: '#fff' }"
              >
                推荐
              </div>

              <div class="flex flex-col p-5 pt-6">
                <!-- 套餐名 -->
                <div class="text-sm font-semibold" :style="{ color: 'var(--content-text)' }">{{ plan.name || '未命名套餐' }}</div>

                <!-- 价格 -->
                <div class="mt-3 flex items-baseline gap-1">
                  <span class="text-3xl font-bold" :style="{ color: 'var(--content-text)' }">
                    {{ formatPrice(plan.priceCents) }}
                  </span>
                  <span class="text-xs" :style="{ color: 'var(--content-text-secondary)' }">
                    / {{ formatPeriodShort(plan.billingPeriod, plan.periodCount) }}
                  </span>
                </div>

                <!-- 试用天数 -->
                <div v-if="plan.trialDays" class="mt-1 text-xs" :style="{ color: 'var(--primary-color)' }">
                  首单含 {{ plan.trialDays }} 天免费试用
                </div>

                <!-- 功能列表 -->
                <div class="mt-4 flex flex-col gap-2 flex-1">
                  <div
                    v-for="(feature, fi) in parseFeatures(plan.description)"
                    :key="fi"
                    class="flex items-start gap-2 text-xs"
                    :style="{ color: 'var(--content-text-secondary)' }"
                  >
                    <i class="pi pi-check mt-0.5 shrink-0" :style="{ color: 'var(--primary-color)' }" style="font-size: 0.625rem"></i>
                    <span>{{ feature }}</span>
                  </div>
                </div>

                <!-- 购买按钮 -->
                <button
                  type="button"
                  class="mt-5 w-full py-2.5 rounded-lg text-sm font-medium transition-opacity disabled:opacity-50"
                  :disabled="creatingOrder && selectedPlanId === plan.planId"
                  :style="{
                    backgroundColor: isRecommended(idx) ? 'var(--primary-color)' : 'var(--sidebar-bg)',
                    color: isRecommended(idx) ? '#fff' : 'var(--content-text)',
                    border: isRecommended(idx) ? 'none' : '1px solid var(--content-border)',
                  }"
                  @click="startPurchase(plan.planId)"
                >
                  <span v-if="creatingOrder && selectedPlanId === plan.planId">处理中…</span>
                  <span v-else-if="subscriptionActive && currentPlanId === plan.planId">续费</span>
                  <span v-else>立即开通</span>
                </button>
              </div>
            </div>
          </div>

          <!-- 支付二维码 -->
          <div
            v-if="orderNo"
            class="mt-5 rounded-xl border p-5"
            :style="{ borderColor: 'var(--content-border)', backgroundColor: 'var(--content-bg)' }"
          >
            <div class="flex items-center justify-between mb-4">
              <div class="text-sm font-semibold" :style="{ color: 'var(--content-text)' }">微信支付</div>
              <button
                type="button"
                class="px-3 py-1.5 rounded text-xs"
                :style="{ backgroundColor: 'var(--sidebar-bg)', color: 'var(--content-text-secondary)', border: '1px solid var(--content-border)' }"
                @click="cancelOrder"
              >
                取消支付
              </button>
            </div>

            <div class="flex flex-col items-center gap-3">
              <div v-if="!qrCodeImage" class="flex items-center justify-center w-64 h-64 rounded-lg" :style="{ backgroundColor: 'var(--sidebar-bg)' }">
                <i class="pi pi-spin pi-spinner text-xl" :style="{ color: 'var(--content-text-secondary)' }"></i>
              </div>
              <div v-else class="relative">
                <img :src="qrCodeImage" alt="微信支付二维码" class="w-64 h-64 rounded-lg bg-white p-3" />
                <button
                  v-if="orderExpired"
                  type="button"
                  class="absolute inset-0 rounded-lg flex flex-col items-center justify-center gap-2 backdrop-blur-sm"
                  :style="{ backgroundColor: 'rgba(0, 0, 0, 0.55)', color: '#fff' }"
                  @click="retryOrder"
                >
                  <div class="text-base font-semibold">订单已过期</div>
                  <div class="flex items-center gap-1.5 text-sm">
                    <i class="pi pi-refresh"></i>
                    <span>点击重新下单</span>
                  </div>
                </button>
              </div>
              <div class="text-center">
                <div class="text-sm" :style="{ color: 'var(--content-text)' }">请使用微信扫一扫完成支付</div>
                <div class="text-xs mt-1 space-y-0.5" :style="{ color: 'var(--content-text-secondary)' }">
                  <div>订单号：{{ orderNo }}</div>
                  <div v-if="orderExpiresAtText">有效期至：{{ orderExpiresAtText }}</div>
                </div>
              </div>
              <div v-if="polling" class="flex items-center gap-2 text-xs" :style="{ color: 'var(--content-text-secondary)' }">
                <i class="pi pi-spin pi-spinner"></i>
                <span>等待支付结果确认…</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>
  </Dialog>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useToast } from 'primevue/usetoast'
import Dialog from 'primevue/dialog'
import { createQrCodeDataUrl } from '../../../utils/qrcode'
import { getBackendAuthConfig } from '../../../utils/backendAuth'
import { createWechatPayNativeOrder, fetchBillingOrderStatus, fetchBillingPlans } from '../../../utils/backendBilling'
import { useAuthStore } from '../../../stores/system/authStore'
import { useSubscriptionStore } from '../../../stores/system/subscriptionStore'

const props = defineProps<{ visible: boolean }>()
const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void
  (e: 'payment-success'): void
}>()

const visibleProxy = computed({
  get: () => props.visible,
  set: (value: boolean) => emit('update:visible', value),
})

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
const currentPlanId = computed(() => subscriptionStore.planName ? plans.value.find(p => p.name === subscriptionStore.planName)?.planId : null)
const expiresAtText = computed(() => (subscriptionStore.expiresAt ? new Date(subscriptionStore.expiresAt).toLocaleString() : ''))
const subscriptionPlanText = computed(() => {
  if (!subscriptionStore.planName) return ''
  const price = subscriptionStore.planPriceCents ? formatPrice(subscriptionStore.planPriceCents) : ''
  const period = formatPeriodShort(subscriptionStore.billingPeriod, subscriptionStore.periodCount)
  return [subscriptionStore.planName, price, '/', period].filter(Boolean).join(' ')
})

const orderExpiresAtText = computed(() => (orderExpiresAt.value ? new Date(orderExpiresAt.value).toLocaleString() : ''))

const isRecommended = (idx: number) => {
  if (plans.length <= 1) return false
  return idx === Math.floor(plans.length / 2)
}

const formatPrice = (cents?: number) => {
  const value = Number(cents || 0)
  if (!value) return '免费'
  return `¥${(value / 100).toFixed(2)}`
}

const formatPeriodShort = (period?: string, count?: number) => {
  const p = String(period || '').toUpperCase()
  const c = Number(count || 1)
  if (!p) return ''
  if (p === 'YEAR') return c > 1 ? `${c}年` : '年'
  if (p === 'DAYS') return c > 1 ? `${c}天` : '天'
  return c > 1 ? `${c}个月` : '月'
}

const parseFeatures = (description?: string): string[] => {
  if (!description) return []
  const lines = description.split('\n').map(s => s.trim()).filter(Boolean)
  return lines.length > 1 ? lines : [description]
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
        emit('payment-success')
        visibleProxy.value = false
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
      emit('payment-success')
      visibleProxy.value = false
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

const handleClose = () => {
  stopPolling()
  cancelOrder()
}

watch(visibleProxy, async (val) => {
  if (val) {
    await subscriptionStore.init()
    await authStore.init()
    if (authStore.isLoggedIn) {
      try {
        await subscriptionStore.refreshIfStale(0)
      } catch {
      }
    }
    await loadPlans()
  } else {
    handleClose()
  }
})

onBeforeUnmount(() => {
  stopPolling()
})
</script>
