import { backendFetch, type BackendAuthConfig } from './backendAuth'

type BackendR<T> = {
  code?: number
  msg?: string
  message?: string
  data?: T
}

export type BillingPlan = {
  planId?: number
  name?: string
  priceCents?: number
  billingPeriod?: string
  periodCount?: number
  trialDays?: number
  description?: string
  enabled?: string | boolean | number
}

export type BillingOrderCreate = {
  orderNo?: string
  amountCents?: number
  codeUrl?: string
  expiresAt?: string | Date
}

export type BillingOrderStatus = {
  orderNo?: string
  status?: string
  expiresAt?: string | Date
  paidAt?: string | Date
}

export type LoginBillingContext = {
  paymentToken: string
}

export type SubscriptionStatus = {
  active?: boolean
  expiresAt?: string | Date
  planName?: string
  planPriceCents?: number
  billingPeriod?: string
  periodCount?: number
}

function isPaymentRequiredMessage(message: string): boolean {
  return /(未开通服务|请先付费|请先购买|未订阅|已到期)/.test(message)
}

function unwrapR<T>(json: BackendR<T>): { ok: true; data: T } | { ok: false; message: string } {
  const code = Number(json?.code ?? 0)
  const ok = code === 0 || code === 200
  if (ok) return { ok: true, data: (json?.data as T) ?? (null as unknown as T) }
  return { ok: false, message: String(json?.msg || json?.message || '请求失败') }
}

function ensureSlashlessBaseUrl(input: string): string {
  return String(input || '').replace(/\/+$/, '')
}

function isBillingPlanEnabled(enabled: unknown): boolean {
  if (enabled == null) return true
  if (typeof enabled === 'string') {
    const normalized = enabled.trim().toUpperCase()
    if (normalized === 'Y') return true
    if (normalized === 'N') return false
    if (['TRUE', '1', 'ENABLED', 'ENABLE', 'ACTIVE', 'NORMAL', 'ON', 'YES'].includes(normalized)) return true
    if (['FALSE', '0', 'DISABLED', 'DISABLE', 'INACTIVE', 'OFF', 'NO'].includes(normalized)) return false
    return true
  }
  if (typeof enabled === 'boolean') return enabled
  if (typeof enabled === 'number') return enabled !== 0
  return false
}

function toFiniteNumber(value: unknown): number | undefined {
  const n = Number(value)
  return Number.isFinite(n) ? n : undefined
}

function toTrimmedText(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const text = value.trim()
  return text || undefined
}

function pickPlanArray(raw: unknown): unknown[] {
  if (Array.isArray(raw)) return raw
  if (!raw || typeof raw !== 'object') return []
  const data = raw as Record<string, unknown>
  const candidates = [
    data.records,
    data.rows,
    data.list,
    data.items,
    data.result,
    data.content,
    data.data,
  ]
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate
  }
  return []
}

function normalizeBillingPlan(raw: unknown): BillingPlan | null {
  if (!raw || typeof raw !== 'object') return null
  const plan = raw as Record<string, unknown>
  const planId = toFiniteNumber(plan.planId ?? plan.plan_id ?? plan.id)
  const priceCents =
    toFiniteNumber(plan.priceCents ?? plan.price_cents ?? plan.amountCents ?? plan.amount_cents) ??
    (() => {
      const price = toFiniteNumber(plan.price)
      return price == null ? undefined : Math.round(price * 100)
    })()
  const periodCount = toFiniteNumber(plan.periodCount ?? plan.period_count ?? plan.billingCount ?? plan.billing_count)
  const trialDays = toFiniteNumber(plan.trialDays ?? plan.trial_days ?? plan.freeTrialDays ?? plan.free_trial_days)
  const billingPeriod = toTrimmedText(plan.billingPeriod ?? plan.billing_period ?? plan.period ?? plan.periodUnit ?? plan.period_unit)
  const name = toTrimmedText(plan.name ?? plan.planName ?? plan.plan_name ?? plan.title)
  const description = toTrimmedText(plan.description ?? plan.remark ?? plan.features ?? plan.featureDesc)
  const enabled = plan.enabled ?? plan.status ?? plan.isEnabled ?? plan.is_enabled

  if (planId == null && !name) return null

  return {
    planId,
    name,
    priceCents,
    billingPeriod,
    periodCount,
    trialDays,
    description,
    enabled,
  }
}

export async function fetchBillingPlans(cfg: BackendAuthConfig): Promise<BillingPlan[]> {
  const baseUrl = ensureSlashlessBaseUrl(cfg.baseUrl)
  const res = await backendFetch(`${baseUrl}/billing/plans?tenantId=${encodeURIComponent(String(cfg.tenantId))}`, { method: 'GET' })
  const json = (await res.json().catch(() => null)) as BackendR<unknown> | null
  if (!res.ok) {
    throw new Error(String(json?.msg || `读取套餐失败(HTTP ${res.status})`))
  }
  if (!json) throw new Error('读取套餐返回为空')
  const unwrapped = unwrapR(json)
  if (!unwrapped.ok) throw new Error(unwrapped.message)
  const list = pickPlanArray(unwrapped.data)
    .map((plan) => normalizeBillingPlan(plan))
    .filter((plan): plan is BillingPlan => Boolean(plan))
  return list.filter((plan) => isBillingPlanEnabled(plan.enabled))
}

export async function fetchMySubscription(
  cfg: BackendAuthConfig,
  auth: { accessToken: string; clientId: string }
): Promise<SubscriptionStatus> {
  const baseUrl = ensureSlashlessBaseUrl(cfg.baseUrl)
  const res = await backendFetch(`${baseUrl}/billing/me`, { method: 'GET', auth })
  const json = (await res.json().catch(() => null)) as BackendR<SubscriptionStatus> | null
  if (!res.ok) {
    const code = Number(json?.code ?? 0)
    const message = String(json?.msg || json?.message || '')
    if (code === 40301 || isPaymentRequiredMessage(message)) {
      return { active: false }
    }
    throw new Error(String(json?.msg || `读取订阅状态失败(HTTP ${res.status})`))
  }
  if (!json) throw new Error('订阅状态返回为空')
  const unwrapped = unwrapR(json)
  if (!unwrapped.ok) {
    if (Number(json?.code ?? 0) === 40301 || isPaymentRequiredMessage(unwrapped.message)) {
      return { active: false }
    }
    throw new Error(unwrapped.message)
  }
  return unwrapped.data || {}
}

export async function createWechatPayNativeOrder(
  cfg: BackendAuthConfig,
  auth: { accessToken: string; clientId: string },
  planId: number
): Promise<BillingOrderCreate> {
  const baseUrl = ensureSlashlessBaseUrl(cfg.baseUrl)
  const res = await backendFetch(`${baseUrl}/billing/wechatpay/native-order`, {
    method: 'POST',
    auth,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ planId }),
  })
  const json = (await res.json().catch(() => null)) as BackendR<BillingOrderCreate> | null
  if (!res.ok) {
    throw new Error(String(json?.msg || `创建支付订单失败(HTTP ${res.status})`))
  }
  if (!json) throw new Error('创建支付订单返回为空')
  const unwrapped = unwrapR(json)
  if (!unwrapped.ok) throw new Error(unwrapped.message)
  return unwrapped.data || {}
}

export async function fetchBillingOrderStatus(
  cfg: BackendAuthConfig,
  auth: { accessToken: string; clientId: string },
  orderNo: string
): Promise<BillingOrderStatus> {
  const baseUrl = ensureSlashlessBaseUrl(cfg.baseUrl)
  const res = await backendFetch(`${baseUrl}/billing/orders/${encodeURIComponent(orderNo)}`, { method: 'GET', auth })
  const json = (await res.json().catch(() => null)) as BackendR<BillingOrderStatus> | null
  if (!res.ok) {
    throw new Error(String(json?.msg || `读取订单状态失败(HTTP ${res.status})`))
  }
  if (!json) throw new Error('读取订单状态返回为空')
  const unwrapped = unwrapR(json)
  if (!unwrapped.ok) throw new Error(unwrapped.message)
  return unwrapped.data || {}
}

export async function createWechatPayNativeOrderForLogin(
  cfg: BackendAuthConfig,
  context: LoginBillingContext,
  planId: number
): Promise<BillingOrderCreate> {
  const baseUrl = ensureSlashlessBaseUrl(cfg.baseUrl)
  const res = await backendFetch(`${baseUrl}/billing/wechatpay/native-order/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ planId, paymentToken: context.paymentToken }),
  })
  const json = (await res.json().catch(() => null)) as BackendR<BillingOrderCreate> | null
  if (!res.ok) {
    throw new Error(String(json?.msg || `创建登录支付订单失败(HTTP ${res.status})`))
  }
  if (!json) throw new Error('创建登录支付订单返回为空')
  const unwrapped = unwrapR(json)
  if (!unwrapped.ok) throw new Error(unwrapped.message)
  return unwrapped.data || {}
}

export async function fetchLoginBillingOrderStatus(
  cfg: BackendAuthConfig,
  context: LoginBillingContext,
  orderNo: string
): Promise<BillingOrderStatus> {
  const baseUrl = ensureSlashlessBaseUrl(cfg.baseUrl)
  const requestUrl =
    `${baseUrl}/billing/orders/${encodeURIComponent(orderNo)}/login?paymentToken=${encodeURIComponent(context.paymentToken)}`
  const res = await backendFetch(requestUrl, { method: 'GET' })
  const json = (await res.json().catch(() => null)) as BackendR<BillingOrderStatus> | null
  if (!res.ok) {
    throw new Error(String(json?.msg || `读取登录支付订单状态失败(HTTP ${res.status})`))
  }
  if (!json) throw new Error('读取登录支付订单状态返回为空')
  const unwrapped = unwrapR(json)
  if (!unwrapped.ok) throw new Error(unwrapped.message)
  return unwrapped.data || {}
}
