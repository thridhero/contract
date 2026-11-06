import { createRendererLogger } from './logger'

const DEFAULT_BACKEND_CLIENT_ID = 'fd15ef26eb89afc6425b0f0570b84e57'
export const AUTHORIZATION_HEADER_NAME = 'Authorization'
export const CLIENT_ID_HEADER_NAME = 'clientid'
export const DEVICE_ID_HEADER_NAME = 'x-device-id'
export const DEVICE_MAC_HEADER_NAME = 'x-device-mac'
export const DEVICE_NAME_HEADER_NAME = 'x-device-name'
export const DEVICE_SOURCE_HEADER_NAME = 'x-device-source'

export type BackendAuthConfig = {
  baseUrl: string
  tenantId: number
  clientId: string
  redirectMatch: string
}

export type DeviceIdentity = {
  deviceId: string
  deviceName: string
  primaryMac: string
  macAddresses: string[]
  fingerprintSource: 'mac' | 'host'
  platform: string
  arch: string
}

type BackendR<T> = {
  code?: number
  msg?: string
  message?: string
  data?: T
}

export class BackendBizError extends Error {
  code: number
  data?: unknown

  constructor(message: string, code: number, data?: unknown) {
    super(message)
    this.name = 'BackendBizError'
    this.code = code
    this.data = data
  }
}

type KeyPairData = {
  uuidPrivateKey: string
  RSA_PUBLIC_KEY: string
}

type LoginVo = {
  access_token?: string
  expire_in?: number
  client_id?: string
  serviceConfirmRequired?: boolean
  loginCompleted?: boolean
  message?: string
  username?: string
  userName?: string
  nickname?: string
  nickName?: string
  email?: string
  phone?: string
  phonenumber?: string
  avatar?: string
  url?: string
  headimgurl?: string
  headImgUrl?: string
  roles?: unknown[]
  rawUserInfo?: Record<string, unknown>
}

export type UserProfileSnapshot = {
  nickname?: string
  userName?: string
  email?: string
  phone?: string
  avatarUrl?: string
  roles?: string[]
}

export type WechatQrcodePayload = {
  qrcodeUrl?: string
  state?: string
}

export type WechatMpPollPayload = {
  status?: string
  state?: string
  source?: string
  code?: string
  fullServiceConfirmed?: boolean
  errcode?: string
  errmsg?: string
  message?: string
}

export type CmsContentPayload = {
  contentId?: number
  contentKey?: string
  title?: string
  contentText?: string
  versionNum?: number
  isRequired?: string
  isShow?: string
  status?: string
  remark?: string
}

export type PaymentRequiredPayload = {
  paymentToken?: string
  orderNo?: string
  deviceId?: string
  userId?: string | number
  unionId?: string
  openId?: string
  [key: string]: unknown
}

const UNAUTHORIZED_BIZ_CODES = new Set<number>([
  401,
  40100,
  40101,
  40102,
  50008,
  50012,
  50014,
])

const UNAUTHORIZED_MESSAGE_REGEX =
  /(未登录|请登录|登录失效|登录过期|token\s*(失效|过期|无效)|invalid\s*token|unauthorized|not\s*login)/i

let isHandlingUnauthorized = false
let cachedDeviceIdentity: DeviceIdentity | null = null
const logger = createRendererLogger('backendAuth')

function sanitizeText(value: unknown): string {
  if (typeof value !== 'string') return ''
  return value.trim().replace(/^[`'"]+|[`'"]+$/g, '').trim()
}

function sanitizeAvatarUrl(value: unknown): string {
  const text = sanitizeText(value)
  if (!text) return ''
  if (/^(https?:\/\/|data:image\/|blob:|\/)/i.test(text)) {
    return text
  }
  return ''
}

function pickText(sources: Array<Record<string, unknown> | null | undefined>, keys: string[]): string {
  for (const source of sources) {
    if (!source || typeof source !== 'object') continue
    for (const key of keys) {
      const value = sanitizeText(source[key])
      if (value) return value
    }
  }
  return ''
}

function normalizeRoles(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value
    .map((item) => {
      if (typeof item === 'string') return sanitizeText(item)
      if (item && typeof item === 'object') {
        return pickText([item as Record<string, unknown>], ['roleName', 'name', 'label', 'roleKey'])
      }
      return ''
    })
    .filter(Boolean)
}

export function extractUserProfileSnapshot(payload: unknown): UserProfileSnapshot {
  if (!payload || typeof payload !== 'object') {
    return {}
  }
  const data = payload as Record<string, unknown>
  const user = data.user && typeof data.user === 'object' ? data.user as Record<string, unknown> : null
  const rawUserInfo = user?.rawUserInfo && typeof user.rawUserInfo === 'object'
    ? user.rawUserInfo as Record<string, unknown>
    : data.rawUserInfo && typeof data.rawUserInfo === 'object'
      ? data.rawUserInfo as Record<string, unknown>
      : null
  const sources = [user, rawUserInfo, data]

  const avatarUrl =
    sanitizeAvatarUrl(pickText(sources, ['url', 'headimgurl', 'headImgUrl', 'avatarUrl', 'portrait'])) ||
    sanitizeAvatarUrl(user?.avatar) ||
    sanitizeAvatarUrl(data.avatar)

  const topLevelRoles = normalizeRoles(data.roles)
  const nestedRoles = normalizeRoles(user?.roles)
  const roles = topLevelRoles.length > 0 ? topLevelRoles : nestedRoles

  return {
    nickname: pickText(sources, ['nickName', 'nickname']),
    userName: pickText(sources, ['userName', 'username']),
    email: pickText(sources, ['email', 'mail']),
    phone: pickText(sources, ['phonenumber', 'phone', 'mobile']),
    avatarUrl,
    roles,
  }
}

function ensureSlashlessBaseUrl(baseUrl: string) {
  return baseUrl.replace(/\/+$/, '')
}

function normalizeBackendBaseUrl(baseUrl: string) {
  const fallback = 'https://contract.hongqikeji.cn/api'
  const raw = String(baseUrl || '').trim() || fallback
  try {
    const parsed = new URL(raw.includes('://') ? raw : `http://${raw}`)
    const pathname = parsed.pathname.replace(/\/+$/, '')
    if (!pathname || pathname === '') {
      parsed.pathname = '/api'
    }
    return ensureSlashlessBaseUrl(parsed.toString())
  } catch {
    return fallback
  }
}

function sanitizeDeviceIdentity(raw: Partial<DeviceIdentity> | null | undefined): DeviceIdentity {
  const macAddresses = Array.isArray(raw?.macAddresses)
    ? raw?.macAddresses.map((item) => sanitizeText(item)).filter(Boolean)
    : []
  return {
    deviceId: sanitizeText(raw?.deviceId),
    deviceName: sanitizeText(raw?.deviceName),
    primaryMac: sanitizeText(raw?.primaryMac),
    macAddresses,
    fingerprintSource: raw?.fingerprintSource === 'mac' ? 'mac' : 'host',
    platform: sanitizeText(raw?.platform),
    arch: sanitizeText(raw?.arch),
  }
}

export async function getDeviceIdentity(): Promise<DeviceIdentity> {
  if (cachedDeviceIdentity) return cachedDeviceIdentity
  try {
    cachedDeviceIdentity = sanitizeDeviceIdentity(window.electronAPI.device.getIdentity())
  } catch (error) {
    logger.warn('读取设备标识失败，使用空设备信息', error)
    cachedDeviceIdentity = sanitizeDeviceIdentity(null)
  }
  return cachedDeviceIdentity
}

async function appendDeviceHeaders(headers: Headers): Promise<DeviceIdentity> {
  const device = await getDeviceIdentity()
  if (device.deviceId) headers.set(DEVICE_ID_HEADER_NAME, device.deviceId)
  if (device.primaryMac) headers.set(DEVICE_MAC_HEADER_NAME, device.primaryMac)
  if (device.deviceName) headers.set(DEVICE_NAME_HEADER_NAME, encodeURIComponent(device.deviceName))
  if (device.fingerprintSource) headers.set(DEVICE_SOURCE_HEADER_NAME, device.fingerprintSource)
  return device
}

function unwrapR<T>(json: BackendR<T>): { ok: true; data: T } | { ok: false; message: string } {
  const code = typeof json.code === 'number' ? json.code : 500
  const msg = String(json.msg || json.message || '')
  if (code === 200 && json.data !== undefined) {
    return { ok: true, data: json.data }
  }
  return { ok: false, message: msg || `请求失败(code=${code})` }
}

function parseCode(raw: unknown): number | null {
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw
  if (typeof raw === 'string' && raw.trim()) {
    const parsed = Number(raw)
    if (Number.isFinite(parsed)) return parsed
  }
  return null
}

function parseMessage(raw: unknown): string {
  return typeof raw === 'string' ? raw.trim() : ''
}

function createBackendBizError(message: string, code: number, data?: unknown): BackendBizError {
  return new BackendBizError(message || `请求失败(code=${code})`, code, data)
}

function jumpToLoginIfNeeded() {
  window.location.hash = '/'
}

async function clearAuthState() {
  try {
    const { pinia } = await import('../plugins/primevue')
    const { useAuthStore } = await import('../stores/system/authStore')
    const authStore = useAuthStore(pinia)
    await authStore.clearAuth()
    return
  } catch {
    // fallback: store 尚未可用时仅清理持久化登录态
  }
  await window.electronAPI.config.updateItem('auth', null)
}

async function handleUnauthorized() {
  if (isHandlingUnauthorized) return
  isHandlingUnauthorized = true
  try {
    await clearAuthState()
    jumpToLoginIfNeeded()
  } finally {
    isHandlingUnauthorized = false
  }
}

function isUnauthorizedPayload(payload: unknown): boolean {
  if (!payload || typeof payload !== 'object') return false
  const obj = payload as Record<string, unknown>
  const code = parseCode(obj.code)
  if (code !== null && UNAUTHORIZED_BIZ_CODES.has(code)) {
    return true
  }
  const msg = parseMessage(obj.msg) || parseMessage(obj.message)
  if (msg && UNAUTHORIZED_MESSAGE_REGEX.test(msg)) {
    return true
  }
  return false
}

async function shouldHandleUnauthorizedResponse(response: Response): Promise<boolean> {
  if (response.status === 401) return true
  const contentType = response.headers.get('content-type') || ''
  if (!contentType.toLowerCase().includes('application/json')) return false
  try {
    const payload = await response.clone().json()
    return isUnauthorizedPayload(payload)
  } catch {
    return false
  }
}

export async function getBackendAuthConfig(): Promise<BackendAuthConfig> {
  const res = await window.electronAPI.config.getItem('backendAuth')
  if (!res.success || !res.data) {
    throw new Error(res.error || '读取 backendAuth 配置失败')
  }
  const cfg = res.data as Partial<BackendAuthConfig>
  return {
    baseUrl: normalizeBackendBaseUrl(String(cfg.baseUrl || 'https://contract.hongqikeji.cn/api')),
    tenantId: Number(cfg.tenantId || 1),
    clientId: String(cfg.clientId || DEFAULT_BACKEND_CLIENT_ID),
    redirectMatch: String(cfg.redirectMatch || '/social-callback'),
  }
}

export async function fetchWechatAuthorizeUrl(cfg: BackendAuthConfig): Promise<{ qrcodeUrl: string; state: string }> {
  const baseUrl = ensureSlashlessBaseUrl(cfg.baseUrl)
  const requestUrl = `${baseUrl}/auth/wechat-mp/qrcode`
  logger.info('开始请求微信二维码地址', {
    configBaseUrl: cfg.baseUrl,
    normalizedBaseUrl: baseUrl,
    requestUrl,
  })

  const res = await fetch(requestUrl, { method: 'GET' })
  const contentType = res.headers.get('content-type') || ''
  const rawText = await res.text()
  logger.info('微信二维码接口响应', {
    requestUrl,
    status: res.status,
    ok: res.ok,
    contentType,
    bodyPreview: rawText.slice(0, 500),
  })

  if (!contentType.toLowerCase().includes('application/json')) {
    throw new Error(`二维码接口未返回 JSON(status=${res.status}): ${rawText.slice(0, 120)}`)
  }

  let json: BackendR<string | WechatQrcodePayload>
  try {
    json = JSON.parse(rawText) as BackendR<string | WechatQrcodePayload>
  } catch (error) {
    logger.error('微信二维码接口 JSON 解析失败', { requestUrl, rawText, error })
    throw new Error(`二维码接口返回内容无法解析为 JSON(status=${res.status})`)
  }

  const unwrapped = unwrapR(json)
  if (!unwrapped.ok) throw new Error(unwrapped.message)
  if (typeof unwrapped.data === 'string') {
    // 向后兼容旧结构：仅返回二维码 URL，无 state
    return { qrcodeUrl: String(unwrapped.data || ''), state: '' }
  }
  const qrcodeUrl = String(unwrapped.data?.qrcodeUrl || '')
  const state = String(unwrapped.data?.state || '')
  if (!qrcodeUrl) throw new Error('二维码地址为空')
  if (!state) throw new Error('二维码 state 为空')
  return { qrcodeUrl, state }
}

export async function pollWechatAuthorizeResult(cfg: BackendAuthConfig, state: string): Promise<WechatMpPollPayload> {
  const baseUrl = ensureSlashlessBaseUrl(cfg.baseUrl)
  const requestUrl = `${baseUrl}/auth/wechat-mp/poll?state=${encodeURIComponent(state)}`
  const res = await fetch(requestUrl, { method: 'GET' })
  const json = (await res.json().catch(() => null)) as BackendR<WechatMpPollPayload> | null
  if (!res.ok) {
    const message = String(json?.msg || `轮询微信扫码状态失败(HTTP ${res.status})`)
    throw new Error(message)
  }
  if (!json) {
    throw new Error('轮询微信扫码状态返回为空')
  }
  const unwrapped = unwrapR(json)
  if (!unwrapped.ok) throw new Error(unwrapped.message)
  logger.info('微信扫码轮询接口响应', {
    requestUrl,
    status: res.status,
    pollStatus: unwrapped.data?.status,
    hasCode: Boolean(unwrapped.data?.code),
    errcode: unwrapped.data?.errcode,
  })
  return unwrapped.data || {}
}

export async function fetchCmsContentByKey(cfg: BackendAuthConfig, contentKey: string): Promise<CmsContentPayload> {
  const baseUrl = ensureSlashlessBaseUrl(cfg.baseUrl)
  const requestUrl = `${baseUrl}/system/cmsContent/public/${encodeURIComponent(contentKey)}`
  const res = await fetch(requestUrl, { method: 'GET' })
  const json = (await res.json().catch(() => null)) as BackendR<CmsContentPayload> | null
  if (!res.ok) {
    const message = String(json?.msg || `读取静态内容失败(HTTP ${res.status})`)
    throw new Error(message)
  }
  if (!json) {
    throw new Error('静态内容返回为空')
  }
  const unwrapped = unwrapR(json)
  if (!unwrapped.ok) throw new Error(unwrapped.message)
  return unwrapped.data || {}
}

export async function wechatMpLogin(
  cfg: BackendAuthConfig,
  input: {
    wechatMpCode: string
    wechatMpState: string
    deferLoginUntilServiceConfirm?: boolean
    fullServiceConfirmed?: boolean
  }
) {
  const baseUrl = ensureSlashlessBaseUrl(cfg.baseUrl)
  const device = await getDeviceIdentity()
  logger.info('开始发起微信公众号登录', {
    baseUrl,
    tenantId: cfg.tenantId,
    clientId: cfg.clientId,
    state: input.wechatMpState,
    codeLength: String(input.wechatMpCode || '').length,
    deviceId: device.deviceId,
    hasMac: Boolean(device.primaryMac),
  })
  const keyPairRes = await fetch(`${baseUrl}/genKeyPair`, { method: 'GET' })
  const keyPairJson = (await keyPairRes.json()) as BackendR<KeyPairData>
  const keyPair = unwrapR(keyPairJson)
  if (!keyPair.ok) throw new Error(keyPair.message)

  const payload = {
    tenantId: cfg.tenantId,
    clientId: cfg.clientId,
    grantType: 'wechat_mp',
    wechatMpCode: input.wechatMpCode,
    wechatMpState: input.wechatMpState,
    deferLoginUntilServiceConfirm: input.deferLoginUntilServiceConfirm ?? false,
    fullServiceConfirmed: input.fullServiceConfirmed ?? false,
    deviceId: device.deviceId,
    deviceName: device.deviceName,
    deviceMac: device.primaryMac,
    deviceMacAddresses: device.macAddresses,
    devicePlatform: device.platform,
    deviceArch: device.arch,
    deviceFingerprintSource: device.fingerprintSource,
  }
  const plaintext = JSON.stringify(payload)
  const encryptedBody = window.electronAPI.crypto.rsaEncryptBase64(keyPair.data.RSA_PUBLIC_KEY, plaintext)
  const headers = new Headers({
    'Content-Type': 'application/json',
    'encrypt-key': keyPair.data.uuidPrivateKey,
  })
  await appendDeviceHeaders(headers)

  const loginRes = await fetch(`${baseUrl}/auth/login`, {
    method: 'POST',
    headers,
    body: encryptedBody,
  })
  const loginJson = (await loginRes.json()) as BackendR<LoginVo>
  const login = unwrapR(loginJson)
  logger.info('微信公众号登录接口响应', {
    status: loginRes.status,
    ok: loginRes.ok,
    bizCode: loginJson?.code,
    bizMsg: loginJson?.msg || loginJson?.message,
    hasAccessToken: Boolean(login.ok && login.data?.access_token),
  })
  if (!login.ok) {
    throw createBackendBizError(
      login.message,
      typeof loginJson?.code === 'number' ? loginJson.code : 500,
      loginJson?.data
    )
  }

  if (login.data?.serviceConfirmRequired === true || login.data?.loginCompleted === false) {
    throw createBackendBizError(
      String(login.data?.message || '请先确认使用完整服务，确认后再完成登录'),
      40901,
      login.data
    )
  }

  const accessToken = String(login.data.access_token || '')
  const expireIn = Number(login.data.expire_in || 0)
  const clientId = String(login.data.client_id || cfg.clientId)
  if (!accessToken || !expireIn) {
    throw new Error('登录返回数据不完整')
  }
  return {
    accessToken,
    clientId,
    expireIn,
    userProfile: extractUserProfileSnapshot(login.data),
  }
}

export async function confirmWechatFullService(cfg: BackendAuthConfig, state: string): Promise<WechatMpPollPayload> {
  const baseUrl = ensureSlashlessBaseUrl(cfg.baseUrl)
  const requestUrl = `${baseUrl}/auth/wechat-mp/confirm-full-service?state=${encodeURIComponent(state)}`
  const res = await fetch(requestUrl, { method: 'POST' })
  const json = (await res.json().catch(() => null)) as BackendR<WechatMpPollPayload> | null
  if (!res.ok) {
    const message = String(json?.msg || `确认完整服务失败(HTTP ${res.status})`)
    throw new Error(message)
  }
  if (!json) {
    throw new Error('确认完整服务返回为空')
  }
  const unwrapped = unwrapR(json)
  if (!unwrapped.ok) throw new Error(unwrapped.message)
  return unwrapped.data || {}
}

export async function completeWechatPaymentLogin(
  cfg: BackendAuthConfig,
  input: { paymentToken: string }
) {
  const baseUrl = ensureSlashlessBaseUrl(cfg.baseUrl)
  const headers = new Headers({ 'Content-Type': 'application/json' })
  await appendDeviceHeaders(headers)
  const res = await fetch(`${baseUrl}/auth/login/payment-complete`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ paymentToken: input.paymentToken }),
  })
  const json = (await res.json().catch(() => null)) as BackendR<LoginVo> | null
  if (!json) {
    throw new Error(`支付后登录返回为空(HTTP ${res.status})`)
  }
  const login = unwrapR(json)
  if (!login.ok) {
    throw createBackendBizError(
      login.message,
      typeof json?.code === 'number' ? json.code : res.status || 500,
      json?.data
    )
  }

  const accessToken = String(login.data.access_token || '')
  const expireIn = Number(login.data.expire_in || 0)
  const clientId = String(login.data.client_id || cfg.clientId)
  if (!accessToken || !expireIn) {
    throw new Error('支付后登录返回数据不完整')
  }
  return {
    accessToken,
    clientId,
    expireIn,
    userProfile: extractUserProfileSnapshot(login.data),
  }
}

export async function backendFetch(input: RequestInfo | URL, init: RequestInit & { auth?: { accessToken: string; clientId: string } } = {}) {
  const headers = new Headers(init.headers || {})
  if (init.auth?.accessToken) headers.set(AUTHORIZATION_HEADER_NAME, `Bearer ${init.auth.accessToken}`)
  if (init.auth?.clientId) headers.set(CLIENT_ID_HEADER_NAME, init.auth.clientId)
  await appendDeviceHeaders(headers)
  const { auth: _auth, ...rest } = init
  const response = await fetch(input, { ...rest, headers })
  if (await shouldHandleUnauthorizedResponse(response)) {
    await handleUnauthorized()
  }
  return response
}
