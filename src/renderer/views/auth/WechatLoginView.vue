<template>
  <div class="h-screen w-screen flex flex-col" :style="{ backgroundColor: 'var(--content-bg)' }">
    <div class="flex items-center justify-between px-4 py-3 border-b" :style="{ borderColor: 'var(--content-border)', WebkitAppRegion: 'drag' }">
      <div class="text-sm font-semibold" :style="{ color: 'var(--content-text)' }">微信扫码登录</div>
      <WindowControls />
    </div>

    <div v-if="loginFailed" class="flex-1 flex items-center justify-center p-6">
      <div
        v-if="paymentRequired"
        class="w-full max-w-4xl rounded-xl border p-6 flex flex-col gap-5"
        :style="{ borderColor: 'var(--content-border)', backgroundColor: 'var(--sidebar-bg)' }"
      >
        <div class="flex items-start justify-between gap-4">
          <div class="flex flex-col gap-2">
            <div class="text-lg font-semibold" :style="{ color: 'var(--content-text)' }">设备尚未开通服务</div>
            <div class="text-sm" :style="{ color: 'var(--content-text-secondary)' }">
              {{ paymentFailureDescription || '请先完成当前设备的会员支付，支付成功后将自动完成登录。' }}
            </div>
          </div>
          <button
            class="px-4 py-2 rounded text-sm shrink-0"
            :style="{ backgroundColor: 'var(--content-border)', color: 'var(--content-text)' }"
            @click="reload"
          >
            重新扫码
          </button>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_340px] gap-5 items-start">
          <div
            class="rounded-xl border p-4 flex flex-col gap-3"
            :style="{ borderColor: 'var(--content-border)', backgroundColor: 'var(--content-bg)' }"
          >
            <div class="text-sm font-semibold" :style="{ color: 'var(--content-text)' }">选择套餐</div>
            <div v-if="loadingPlans" class="py-8 text-sm text-center" :style="{ color: 'var(--content-text-secondary)' }">
              正在加载套餐…
            </div>
            <div v-else-if="plans.length === 0" class="py-8 text-sm text-center" :style="{ color: 'var(--content-text-secondary)' }">
              暂无可购买套餐
            </div>
            <div v-else class="flex flex-col gap-3">
              <div
                v-for="plan in plans"
                :key="String(plan.planId)"
                class="rounded-lg border p-4 flex items-center justify-between gap-4"
                :style="{ borderColor: 'var(--content-border)', backgroundColor: 'var(--sidebar-bg)' }"
              >
                <div class="flex flex-col gap-1">
                  <div class="text-sm font-semibold" :style="{ color: 'var(--content-text)' }">{{ plan.name || '未命名套餐' }}</div>
                  <div class="text-xs" :style="{ color: 'var(--content-text-secondary)' }">
                    <span>{{ formatPrice(plan.priceCents) }}</span>
                    <span v-if="formatPeriod(plan.billingPeriod, plan.periodCount)" class="ml-2">{{ formatPeriod(plan.billingPeriod, plan.periodCount) }}</span>
                    <span v-if="plan.trialDays" class="ml-2">试用 {{ plan.trialDays }} 天</span>
                  </div>
                  <div v-if="plan.description" class="text-xs whitespace-pre-wrap" :style="{ color: 'var(--content-text-secondary)' }">
                    {{ plan.description }}
                  </div>
                </div>
                <button
                  type="button"
                  class="px-3 py-2 rounded text-sm shrink-0"
                  :disabled="creatingPaymentOrder && selectedPlanId === Number(plan.planId || 0)"
                  :style="{
                    backgroundColor: creatingPaymentOrder && selectedPlanId === Number(plan.planId || 0) ? 'var(--content-border)' : 'var(--primary-color)',
                    color: creatingPaymentOrder && selectedPlanId === Number(plan.planId || 0) ? 'var(--content-text-secondary)' : '#fff'
                  }"
                  @click="startLoginPayment(Number(plan.planId || 0))"
                >
                  {{ creatingPaymentOrder && selectedPlanId === Number(plan.planId || 0) ? '处理中…' : '立即开通' }}
                </button>
              </div>
            </div>
          </div>

          <div
            class="rounded-xl border p-4 flex flex-col gap-3"
            :style="{ borderColor: 'var(--content-border)', backgroundColor: 'var(--content-bg)' }"
          >
            <div class="text-sm font-semibold" :style="{ color: 'var(--content-text)' }">扫码支付</div>
            <div v-if="paymentOrderNo" class="text-xs" :style="{ color: 'var(--content-text-secondary)' }">订单号：{{ paymentOrderNo }}</div>
            <div v-if="paymentOrderExpiresAtText" class="text-xs" :style="{ color: 'var(--content-text-secondary)' }">有效期至：{{ paymentOrderExpiresAtText }}</div>
            <div v-if="paymentQrCodeImage" class="flex flex-col items-center gap-3">
              <div class="relative">
                <img :src="paymentQrCodeImage" alt="微信支付二维码" class="w-72 h-72 rounded bg-white p-3" />
                <button
                  v-if="paymentOrderExpired"
                  type="button"
                  class="absolute inset-0 rounded flex flex-col items-center justify-center gap-2"
                  :style="{ backgroundColor: 'rgba(0, 0, 0, 0.62)', color: '#fff' }"
                  @click="retryLoginPayment"
                >
                  <div class="text-base font-semibold">订单已失效</div>
                  <div class="text-sm">点击重新下单</div>
                </button>
              </div>
              <div class="text-sm text-center" :style="{ color: 'var(--content-text)' }">请使用微信扫一扫完成支付</div>
              <div v-if="isPaymentPolling" class="text-xs" :style="{ color: 'var(--content-text-secondary)' }">等待支付结果确认…</div>
            </div>
            <div v-else class="h-72 rounded flex items-center justify-center text-sm text-center" :style="{ backgroundColor: 'var(--sidebar-bg)', color: 'var(--content-text-secondary)' }">
              选择套餐后将在这里显示支付二维码
            </div>
          </div>
        </div>
      </div>
      <div
        v-else
        class="w-full max-w-md rounded-xl border p-6 flex flex-col items-center gap-4"
        :style="{ borderColor: 'var(--content-border)', backgroundColor: 'var(--sidebar-bg)' }"
      >
        <div class="text-base font-semibold text-center" :style="{ color: 'var(--danger-color)' }">
          {{ failureTitle }}
        </div>
        <div class="text-sm text-center" :style="{ color: 'var(--content-text)' }">
          {{ failureDescription }}
        </div>
        <button
          class="px-4 py-2 rounded text-sm"
          :style="{ backgroundColor: 'var(--primary-color)', color: 'var(--btn-primary-text)' }"
          @click="reload"
        >
          重新登录
        </button>
      </div>
    </div>

    <div v-else-if="!qrCodeImage" class="flex-1 flex items-center justify-center text-sm" :style="{ color: 'var(--content-text-secondary)' }">
      正在获取二维码…
    </div>

    <div v-else class="flex-1 flex items-center justify-center p-6">
      <div
        v-if="qrCodeImage"
        class="w-full max-w-md rounded-xl border p-6 flex flex-col items-center gap-4"
        :style="{ borderColor: 'var(--content-border)', backgroundColor: 'var(--sidebar-bg)' }"
      >
        <div class="relative">
          <img :src="qrCodeImage" alt="微信扫码登录二维码" class="w-72 h-72 rounded bg-white p-3" />
          <button
            v-if="qrExpired"
            type="button"
            class="absolute inset-0 rounded flex flex-col items-center justify-center gap-3"
            :style="{ backgroundColor: 'rgba(0, 0, 0, 0.62)', color: '#fff' }"
            @click="reload"
          >
            <div class="text-lg font-semibold">二维码已失效</div>
            <div class="flex items-center gap-2 text-sm">
              <i class="pi pi-refresh"></i>
              <span>点击刷新二维码</span>
            </div>
          </button>
        </div>
        <div class="text-sm text-center" :style="{ color: 'var(--content-text)' }">
          请使用微信扫一扫，扫描二维码完成登录
        </div>
        <button
          type="button"
          class="text-xs text-center inline-flex items-center gap-2"
          :style="{ color: 'var(--content-text-secondary)' }"
          @click="reload"
        >
          <i class="pi pi-refresh"></i>
          <span>{{ qrExpired ? '二维码已失效，点击刷新' : '刷新二维码' }}</span>
        </button>
        <div class="text-xs text-center" :style="{ color: 'var(--content-text-secondary)' }">
          登录即表示你已阅读并同意
          <button
            type="button"
            class="ml-1 underline underline-offset-2"
            :style="{ color: 'var(--primary-color)' }"
            @click="openPrivacyDialog"
          >
            隐私说明
          </button>
        </div>
        <div
          v-if="waitingForFullServiceConfirm"
          class="w-full rounded-lg px-4 py-3 text-sm text-center"
          :style="{ backgroundColor: 'rgba(22, 163, 74, 0.10)', color: '#166534' }"
        >
          手机端已完成扫码授权，请在手机页面点击“继续完成登录”按钮，再回来继续登录。
        </div>
        <div v-if="isPolling && !isSubmitting && !qrExpired" class="text-xs" :style="{ color: 'var(--content-text-secondary)' }">
          等待手机扫码并确认授权…
        </div>
        <div v-if="waitingForFullServiceConfirm && !isSubmitting" class="text-xs" :style="{ color: 'var(--content-text-secondary)' }">
          正在等待手机端点击“继续完成登录”…
        </div>
        <div v-if="isSubmitting" class="text-xs" :style="{ color: 'var(--primary-color)' }">
          正在确认登录…
        </div>
      </div>
    </div>

    <Dialog
      v-model:visible="privacyDialogVisible"
      modal
      :header="privacyDialogTitle"
      :style="{ width: '680px' }"
      :draggable="false"
    >
      <div v-if="privacyLoading" class="py-10 text-sm text-center" :style="{ color: 'var(--content-text-secondary)' }">
        正在加载隐私说明…
      </div>
      <div v-else-if="privacyLoadError" class="py-6 flex flex-col items-center gap-4">
        <div class="text-sm text-center" :style="{ color: 'var(--danger-color)' }">
          {{ privacyLoadError }}
        </div>
        <button
          type="button"
          class="px-4 py-2 rounded text-sm"
          :style="{ backgroundColor: 'var(--primary-color)', color: '#fff' }"
          @click="loadPrivacyContent(true)"
        >
          重新加载
        </button>
      </div>
      <div
        v-else-if="privacyContentHtml"
        class="cms-html-content max-h-[60vh] overflow-y-auto pr-1 text-sm leading-6"
        :style="{ color: 'var(--content-text)' }"
        v-html="privacyContentHtml"
      ></div>
      <div v-else class="py-10 text-sm text-center" :style="{ color: 'var(--content-text-secondary)' }">
        暂无隐私说明内容
      </div>
    </Dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import Dialog from 'primevue/dialog'
import { useToast } from 'primevue/usetoast'
import { useRoute, useRouter } from 'vue-router'
import WindowControls from '../../components/WindowControls.vue'
import { useAuthStore } from '../../stores/system/authStore'
import { useSubscriptionStore } from '../../stores/system/subscriptionStore'
import type { BillingPlan } from '../../utils/backendBilling'
import { createWechatPayNativeOrderForLogin, fetchBillingPlans, fetchLoginBillingOrderStatus } from '../../utils/backendBilling'
import {
  BackendBizError,
  backendFetch,
  completeWechatPaymentLogin,
  extractUserProfileSnapshot,
  fetchCmsContentByKey,
  getBackendAuthConfig,
  type PaymentRequiredPayload,
  fetchWechatAuthorizeUrl,
  pollWechatAuthorizeResult,
  wechatMpLogin,
} from '../../utils/backendAuth'
import { createRendererLogger } from '../../utils/logger'
import { createQrCodeDataUrl } from '../../utils/qrcode'

const logger = createRendererLogger('WechatLoginView')
const router = useRouter()
const route = useRoute()
const toast = useToast()
const authStore = useAuthStore()
const subscriptionStore = useSubscriptionStore()

const qrCodeImage = ref('')
const qrExpired = ref(false)
const loginFailed = ref(false)
const failureTitle = ref('')
const failureDescription = ref('')
const paymentRequired = ref(false)
const paymentFailureDescription = ref('')
const paymentToken = ref('')
const plans = ref<BillingPlan[]>([])
const loadingPlans = ref(false)
const creatingPaymentOrder = ref(false)
const isPaymentPolling = ref(false)
const paymentOrderNo = ref('')
const paymentOrderExpiresAt = ref(0)
const paymentQrCodeImage = ref('')
const selectedPlanId = ref<number | null>(null)
const isSubmitting = ref(false)
const isPolling = ref(false)
const privacyDialogVisible = ref(false)
const privacyDialogTitle = ref('微信登录隐私说明')
const privacyContentHtml = ref('')
const privacyLoading = ref(false)
const privacyLoadError = ref('')
const expectedState = ref('')
const waitingForFullServiceConfirm = ref(false)
const pendingAuthorizedCode = ref('')
const WECHAT_LOGIN_STATE_KEY = 'wechatLoginState'
const WECHAT_FULL_SERVICE_CONFIRMED_KEY = 'wechatFullServiceConfirmed'
const WECHAT_POLL_INTERVAL_MS = 1500
const PRIVACY_CONTENT_KEY = 'privacy_agreement'
const BILLING_PROMPT_PENDING_KEY = 'billingMandatoryPromptPending'

let activePollState = ''
let pollTimer: ReturnType<typeof setInterval> | null = null
let pollInFlight = false
let lastPollStatus = ''
let pendingPollCount = 0
let paymentPollTimer: ReturnType<typeof setInterval> | null = null
let paymentPollInFlight = false
let hasLocalFullServiceConfirmation = false
const paymentOrderExpired = computed(() => Boolean(paymentOrderExpiresAt.value) && Date.now() > paymentOrderExpiresAt.value)
const paymentOrderExpiresAtText = computed(() => (paymentOrderExpiresAt.value ? new Date(paymentOrderExpiresAt.value).toLocaleString() : ''))

const sanitizeCmsHtml = (html: string) => {
  const rawHtml = String(html || '').trim()
  if (!rawHtml) return ''
  const parser = new DOMParser()
  const doc = parser.parseFromString(rawHtml, 'text/html')
  doc.querySelectorAll('script, iframe, object, embed').forEach((node) => node.remove())
  doc.querySelectorAll('*').forEach((element) => {
    Array.from(element.attributes).forEach((attr) => {
      const name = attr.name.toLowerCase()
      const value = attr.value.trim()
      if (name.startsWith('on')) {
        element.removeAttribute(attr.name)
        return
      }
      if ((name === 'href' || name === 'src') && /^javascript:/i.test(value)) {
        element.removeAttribute(attr.name)
      }
    })
  })
  return doc.body.innerHTML.trim()
}

const clearStoredState = async () => {
  logger.info('清理微信登录本地状态', {
    expectedState: expectedState.value,
    activePollState,
  })
  expectedState.value = ''
  activePollState = ''
  await window.electronAPI.config.updateItem(WECHAT_LOGIN_STATE_KEY, null)
}

const loadFullServiceConfirmationState = async () => {
  try {
    const saved = await window.electronAPI.config.getItem(WECHAT_FULL_SERVICE_CONFIRMED_KEY)
    hasLocalFullServiceConfirmation = Boolean(saved.success && saved.data)
    logger.info('读取本地完整服务确认状态', {
      confirmed: hasLocalFullServiceConfirmation,
    })
  } catch (error) {
    hasLocalFullServiceConfirmation = false
    logger.warn('读取本地完整服务确认状态失败，按未确认处理', error)
  }
}

const persistFullServiceConfirmationState = async (confirmed: boolean) => {
  hasLocalFullServiceConfirmation = confirmed
  await window.electronAPI.config.updateItem(WECHAT_FULL_SERVICE_CONFIRMED_KEY, confirmed ? 1 : null)
  logger.info('更新本地完整服务确认状态', {
    confirmed,
  })
}

const resetFailureState = () => {
  loginFailed.value = false
  failureTitle.value = ''
  failureDescription.value = ''
  paymentRequired.value = false
  paymentFailureDescription.value = ''
  paymentToken.value = ''
  plans.value = []
  selectedPlanId.value = null
  stopPaymentPolling()
  paymentOrderNo.value = ''
  paymentOrderExpiresAt.value = 0
  paymentQrCodeImage.value = ''
  waitingForFullServiceConfirm.value = false
  pendingAuthorizedCode.value = ''
}

const showErrorToast = (summary: string, detail: string) => {
  toast.add({
    severity: 'error',
    summary,
    detail: detail || summary,
    life: 5000,
  })
}

const showFailureState = (title: string, description: string) => {
  qrCodeImage.value = ''
  qrExpired.value = false
  loginFailed.value = true
  failureTitle.value = title
  failureDescription.value = description
}

const resolveFailureDescription = (detail: string, fallback: string) => {
  const normalizedDetail = String(detail || '').trim()
  return normalizedDetail || fallback
}

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

const loadPrivacyContent = async (forceReload = false) => {
  if (privacyLoading.value) return
  if (!forceReload && privacyContentHtml.value && !privacyLoadError.value) return
  privacyLoading.value = true
  privacyLoadError.value = ''
  try {
    const cfg = await getBackendAuthConfig()
    const content = await fetchCmsContentByKey(cfg, PRIVACY_CONTENT_KEY)
    privacyDialogTitle.value = String(content.title || '微信登录隐私说明')
    privacyContentHtml.value = sanitizeCmsHtml(String(content.contentText || ''))
    logger.info('隐私说明内容加载成功', {
      contentKey: PRIVACY_CONTENT_KEY,
      hasTitle: Boolean(content.title),
      htmlLength: privacyContentHtml.value.length,
    })
  } catch (error) {
    logger.error('加载隐私说明内容失败', error)
    privacyLoadError.value = (error as Error)?.message || '加载隐私说明失败，请稍后重试'
    privacyContentHtml.value = ''
  } finally {
    privacyLoading.value = false
  }
}

const openPrivacyDialog = async () => {
  privacyDialogVisible.value = true
  await loadPrivacyContent()
}

const markBillingPromptPending = () => {
  try {
    window.sessionStorage.setItem(BILLING_PROMPT_PENDING_KEY, '1')
  } catch {
  }
}

const stopPolling = () => {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
  logger.info('停止微信扫码轮询', {
    activePollState,
    isSubmitting: isSubmitting.value,
  })
  activePollState = ''
  isPolling.value = false
  lastPollStatus = ''
  pendingPollCount = 0
}

const stopPaymentPolling = () => {
  if (paymentPollTimer) {
    clearInterval(paymentPollTimer)
    paymentPollTimer = null
  }
  isPaymentPolling.value = false
  paymentPollInFlight = false
}

const normalizePaymentPayload = (raw: unknown): PaymentRequiredPayload => {
  if (!raw || typeof raw !== 'object') return {}
  return raw as PaymentRequiredPayload
}

const loadPaymentPlans = async () => {
  loadingPlans.value = true
  try {
    const cfg = await getBackendAuthConfig()
    plans.value = await fetchBillingPlans(cfg)
  } catch (error) {
    logger.error('加载登录支付套餐失败', error)
    plans.value = []
    showErrorToast('加载套餐失败', (error as Error)?.message || '加载套餐失败')
  } finally {
    loadingPlans.value = false
  }
}

const enterPaymentRequiredState = async (payload: PaymentRequiredPayload, description: string) => {
  paymentRequired.value = true
  paymentFailureDescription.value = description
  paymentToken.value = String(payload.paymentToken || '')
  loginFailed.value = true
  failureTitle.value = '设备尚未开通服务'
  failureDescription.value = description
  qrCodeImage.value = ''
  qrExpired.value = false
  await loadPaymentPlans()
}

const finalizeAuthorizedLogin = async (
  cfg: Awaited<ReturnType<typeof getBackendAuthConfig>>,
  result: { accessToken: string; clientId: string; expireIn: number; userProfile: ReturnType<typeof extractUserProfileSnapshot> },
  fullServiceConfirmed = false
) => {
  await authStore.setAuth({
    accessToken: result.accessToken,
    clientId: result.clientId,
    expiresAt: Date.now() + result.expireIn * 1000,
    userProfile: result.userProfile,
  })
  logger.info('微信扫码登录返回成功，开始校验登录态', {
    clientId: result.clientId,
    expireIn: result.expireIn,
    fullServiceConfirmed,
  })
  if (fullServiceConfirmed) {
    await persistFullServiceConfirmationState(true)
  }
  await clearStoredState()

  const verifyRes = await backendFetch(`${cfg.baseUrl.replace(/\/+$/, '')}/system/user/getInfo`, {
    method: 'GET',
    auth: { accessToken: result.accessToken, clientId: result.clientId },
  })
  const verifyJson = (await verifyRes.json().catch(() => null)) as any
  logger.info('微信扫码登录态校验响应', {
    httpStatus: verifyRes.status,
    bizCode: verifyJson?.code,
    bizMsg: verifyJson?.msg || verifyJson?.message,
  })
  if (!verifyRes.ok || (verifyJson && typeof verifyJson.code === 'number' && verifyJson.code !== 200)) {
    await authStore.clearAuth()
    throw new BackendBizError(
      String(verifyJson?.msg || verifyJson?.message || '登录态校验失败'),
      typeof verifyJson?.code === 'number' ? verifyJson.code : verifyRes.status || 500,
      verifyJson?.data
    )
  }
  await authStore.syncUserProfile(extractUserProfileSnapshot(verifyJson?.data))
  await subscriptionStore.init()
  await subscriptionStore.refresh()

  const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : ''
  logger.info('微信扫码登录完成，准备跳转', {
    redirect: redirect || 'Home',
    subscriptionActive: subscriptionStore.isActive,
  })
  if (!subscriptionStore.isActive) {
    markBillingPromptPending()
  }
  if (redirect) {
    await router.replace(redirect)
  } else {
    await router.replace({ name: 'Home' })
  }
}

const startPaymentPolling = async (paymentContextToken: string, orderNo: string) => {
  stopPaymentPolling()
  isPaymentPolling.value = true
  const cfg = await getBackendAuthConfig()
  paymentPollTimer = setInterval(async () => {
    if (!paymentOrderNo.value || paymentOrderNo.value !== orderNo) return
    if (paymentOrderExpired.value || paymentPollInFlight) return
    paymentPollInFlight = true
    try {
      const status = await fetchLoginBillingOrderStatus(cfg, { paymentToken: paymentContextToken }, orderNo)
      if (String(status.status || '').toUpperCase() === 'PAID') {
        stopPaymentPolling()
        const loginResult = await completeWechatPaymentLogin(cfg, { paymentToken: paymentContextToken })
        await finalizeAuthorizedLogin(cfg, loginResult, true)
      }
    } catch (error) {
      stopPaymentPolling()
      showErrorToast('查询支付失败', (error as Error)?.message || '查询支付失败')
    } finally {
      paymentPollInFlight = false
    }
  }, 1500)
}

const startLoginPayment = async (planId: number) => {
  if (!planId || !paymentToken.value) return
  creatingPaymentOrder.value = true
  selectedPlanId.value = planId
  stopPaymentPolling()
  paymentOrderNo.value = ''
  paymentOrderExpiresAt.value = 0
  paymentQrCodeImage.value = ''
  try {
    const cfg = await getBackendAuthConfig()
    const order = await createWechatPayNativeOrderForLogin(cfg, { paymentToken: paymentToken.value }, planId)
    paymentOrderNo.value = String(order.orderNo || '')
    paymentOrderExpiresAt.value = order.expiresAt ? Date.parse(String(order.expiresAt)) : 0
    const codeUrl = String(order.codeUrl || '')
    if (!codeUrl) {
      const loginResult = await completeWechatPaymentLogin(cfg, { paymentToken: paymentToken.value })
      await finalizeAuthorizedLogin(cfg, loginResult, true)
      return
    }
    paymentQrCodeImage.value = await createQrCodeDataUrl(codeUrl)
    await startPaymentPolling(paymentToken.value, paymentOrderNo.value)
  } catch (error) {
    logger.error('创建登录支付订单失败', error)
    showErrorToast('创建订单失败', (error as Error)?.message || '创建订单失败')
  } finally {
    creatingPaymentOrder.value = false
  }
}

const retryLoginPayment = async () => {
  if (!selectedPlanId.value) return
  await startLoginPayment(selectedPlanId.value)
}

const handlePollExpired = async () => {
  stopPolling()
  await clearStoredState()
  qrExpired.value = true
  logger.info('微信二维码已过期，等待用户刷新')
}

const handlePollError = async (message: string) => {
  stopPolling()
  await clearStoredState()
  const detail = resolveFailureDescription(message, '微信授权失败，请重新登录后再试')
  showErrorToast('登录失败', detail)
  showFailureState('登录失败', detail)
}

const pollWechatLoginResult = async () => {
  if (!activePollState || pollInFlight || isSubmitting.value) return
  pollInFlight = true
  try {
    const cfg = await getBackendAuthConfig()
    const result = await pollWechatAuthorizeResult(cfg, activePollState)
    const status = String(result.status || 'pending')
    if (status === 'pending') {
      pendingPollCount += 1
      if (pendingPollCount === 1 || pendingPollCount % 10 === 0) {
        logger.info('微信扫码轮询仍在等待授权', {
          state: activePollState,
          pollCount: pendingPollCount,
        })
      }
    }
    if (status !== lastPollStatus) {
      logger.info('微信扫码轮询状态变化', {
        state: activePollState,
        previousStatus: lastPollStatus || 'none',
        status,
        hasCode: Boolean(result.code),
        errcode: result.errcode,
      })
      lastPollStatus = status
    }
    if (status === 'pending') return
    if (status === 'expired') {
      await handlePollExpired()
      return
    }
    if (status === 'error') {
      await handlePollError(result.errmsg || result.errcode || '微信授权失败，请重新加载二维码后再试')
      return
    }
    if (status === 'authorized') {
      pendingAuthorizedCode.value = String(result.code || '')
      if (hasLocalFullServiceConfirmation) {
        const callbackCode = String(result.code || '')
        const callbackState = String(result.state || activePollState)
        stopPolling()
        await tryHandleCallbackPayload(callbackCode, callbackState, true)
        return
      }
      waitingForFullServiceConfirm.value = true
      return
    }
    if (status === 'confirmed') {
      const callbackCode = String(result.code || '')
      const callbackState = String(result.state || activePollState)
      stopPolling()
      await tryHandleCallbackPayload(callbackCode, callbackState, true)
    }
  } catch (error) {
    logger.error('轮询微信扫码状态失败', error)
  } finally {
    pollInFlight = false
  }
}

const startPolling = (state: string) => {
  stopPolling()
  if (!state) return
  activePollState = state
  isPolling.value = true
  lastPollStatus = ''
  pendingPollCount = 0
  logger.info('开始微信扫码轮询', {
    state,
    intervalMs: WECHAT_POLL_INTERVAL_MS,
  })
  void pollWechatLoginResult()
  pollTimer = setInterval(() => {
    void pollWechatLoginResult()
  }, WECHAT_POLL_INTERVAL_MS)
}

const loadAuthorizeUrl = async () => {
  stopPolling()
  stopPaymentPolling()
  qrCodeImage.value = ''
  qrExpired.value = false
  resetFailureState()
  try {
    const cfg = await getBackendAuthConfig()
    logger.info('开始获取微信二维码', {
      baseUrl: cfg.baseUrl,
      tenantId: cfg.tenantId,
      clientId: cfg.clientId,
    })
    const { qrcodeUrl, state } = await fetchWechatAuthorizeUrl(cfg)
    qrCodeImage.value = await createQrCodeDataUrl(qrcodeUrl)
    expectedState.value = state
    await window.electronAPI.config.updateItem(WECHAT_LOGIN_STATE_KEY, state)
    logger.info('微信二维码加载成功', {
      state,
      qrcodeUrlLength: qrcodeUrl.length,
    })
    startPolling(state)
  } catch (error) {
    await clearStoredState()
    logger.error('获取微信二维码失败', error)
    const detail = resolveFailureDescription((error as Error)?.message || '', '获取二维码失败')
    showErrorToast('获取二维码失败', detail)
    showFailureState('二维码加载失败', detail)
  }
}

const tryHandleCallbackPayload = async (wechatMpCode: string, wechatMpState: string, fullServiceConfirmed = false) => {
  if (isSubmitting.value) return
  if (!wechatMpCode || !wechatMpState) return
  logger.info('准备处理微信扫码回调载荷', {
    inputState: wechatMpState,
    codeLength: wechatMpCode.length,
    expectedState: expectedState.value,
    fullServiceConfirmed,
  })

  let currentState = expectedState.value
  if (!currentState) {
    const saved = await window.electronAPI.config.getItem(WECHAT_LOGIN_STATE_KEY)
    if (saved.success) {
      currentState = String(saved.data || '')
      expectedState.value = currentState
    }
  }
  if (!currentState || currentState !== wechatMpState) {
    logger.warn('微信扫码回调状态校验失败', {
      currentState,
      callbackState: wechatMpState,
    })
    stopPolling()
    await clearStoredState()
    const detail = '登录校验失败，请重新登录后再试'
    showErrorToast('登录校验失败', detail)
    showFailureState('登录失败', detail)
    return
  }

  stopPolling()
  isSubmitting.value = true
  waitingForFullServiceConfirm.value = false
  resetFailureState()
  try {
    const cfg = await getBackendAuthConfig()
    logger.info('开始使用微信扫码结果换取登录态', {
      state: wechatMpState,
      tenantId: cfg.tenantId,
      clientId: cfg.clientId,
      fullServiceConfirmed,
    })
    const result = await wechatMpLogin(cfg, {
      wechatMpCode,
      wechatMpState,
      deferLoginUntilServiceConfirm: true,
      fullServiceConfirmed,
    })
      await finalizeAuthorizedLogin(cfg, result, fullServiceConfirmed)
  } catch (error) {
    logger.error('扫码登录失败', error)
    if (error instanceof BackendBizError && error.code === 40901) {
      isSubmitting.value = false
      pendingAuthorizedCode.value = wechatMpCode
      waitingForFullServiceConfirm.value = true
      startPolling(wechatMpState)
      return
    }
    if (error instanceof BackendBizError && error.code === 40301) {
      const payload = normalizePaymentPayload(error.data)
      const detail = resolveFailureDescription(error.message, '当前设备尚未开通服务，请先完成支付')
      if (payload.paymentToken) {
        await enterPaymentRequiredState(payload, detail)
        return
      }
    }
    await clearStoredState()
    const detail = resolveFailureDescription((error as Error)?.message || '', '登录失败')
    showErrorToast('登录失败', detail)
    showFailureState('登录失败', detail)
  } finally {
    isSubmitting.value = false
  }
}

const tryHandleCallbackFromRoute = async () => {
  const callbackCode = typeof route.query.code === 'string' ? route.query.code : ''
  const callbackState = typeof route.query.state === 'string' ? route.query.state : ''
  const fullServiceConfirmed = ['1', 'true', 'yes', 'y'].includes(String(route.query.fullServiceConfirmed || '').toLowerCase())
  if (!callbackCode || !callbackState) return
  await tryHandleCallbackPayload(callbackCode, callbackState, fullServiceConfirmed)
}

const reload = async () => {
  if (isSubmitting.value) return
  await loadAuthorizeUrl()
}

onMounted(async () => {
  logger.info('进入微信扫码登录页面')
  await loadFullServiceConfirmationState()
  await authStore.init()
  if (authStore.isLoggedIn) {
    logger.info('当前已存在登录态，直接跳转首页')
    await router.replace({ name: 'Home' })
    return
  }
  await tryHandleCallbackFromRoute()
  if (authStore.isLoggedIn || loginFailed.value) return
  await loadAuthorizeUrl()
})

onBeforeUnmount(() => {
  stopPolling()
  stopPaymentPolling()
})
</script>

<style scoped>
.cms-html-content :deep(h1),
.cms-html-content :deep(h2),
.cms-html-content :deep(h3),
.cms-html-content :deep(h4),
.cms-html-content :deep(h5),
.cms-html-content :deep(h6) {
  margin: 0 0 0.75rem;
  font-weight: 600;
  color: var(--content-text);
}

.cms-html-content :deep(p) {
  margin: 0 0 0.75rem;
  white-space: pre-wrap;
  word-break: break-word;
}

.cms-html-content :deep(ul),
.cms-html-content :deep(ol) {
  margin: 0 0 0.75rem 1.25rem;
  padding: 0;
}

.cms-html-content :deep(li) {
  margin-bottom: 0.375rem;
}

.cms-html-content :deep(a) {
  color: var(--primary-color);
  text-decoration: underline;
}

.cms-html-content :deep(table) {
  width: 100%;
  border-collapse: collapse;
  margin-bottom: 0.75rem;
}

.cms-html-content :deep(th),
.cms-html-content :deep(td) {
  border: 1px solid var(--content-border);
  padding: 0.5rem;
  vertical-align: top;
}

.cms-html-content :deep(img) {
  max-width: 100%;
  height: auto;
}
</style>
