import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { createRendererLogger } from '../../utils/logger'
import type { UserProfileSnapshot } from '../../utils/backendAuth'

const LOGIN_BYPASS_ENABLED = true
const LOGIN_BYPASS_EXPIRES_AT = new Date('2099-12-31T23:59:59.999Z').getTime()
const LOGIN_BYPASS_ACCESS_TOKEN = 'local-bypass-access-token'
const LOGIN_BYPASS_CLIENT_ID = 'local-bypass-client-id'

type AuthState = {
  accessToken: string
  clientId: string
  expiresAt: number
  userProfile?: UserProfileSnapshot
}

const logger = createRendererLogger('AuthStore')

const emptyUserProfile = (): UserProfileSnapshot => ({
  nickname: LOGIN_BYPASS_ENABLED ? '本地用户' : '',
  userName: LOGIN_BYPASS_ENABLED ? '本地用户' : '',
  email: '',
  phone: '',
  avatarUrl: '',
  roles: [],
})

const normalizeText = (value: unknown): string => {
  if (typeof value !== 'string') return ''
  return value.trim().replace(/^[`'"]+|[`'"]+$/g, '').trim()
}

const normalizeRoles = (roles: unknown): string[] => {
  if (!Array.isArray(roles)) return []
  return roles
    .map((item) => normalizeText(item))
    .filter(Boolean)
}

const normalizeUserProfile = (profile?: UserProfileSnapshot | null): UserProfileSnapshot => ({
  nickname: normalizeText(profile?.nickname),
  userName: normalizeText(profile?.userName),
  email: normalizeText(profile?.email),
  phone: normalizeText(profile?.phone),
  avatarUrl: normalizeText(profile?.avatarUrl),
  roles: normalizeRoles(profile?.roles),
})

export const useAuthStore = defineStore('auth', () => {
  const accessToken = ref('')
  const clientId = ref('')
  const expiresAt = ref(0)
  const userProfile = ref<UserProfileSnapshot>(emptyUserProfile())
  const isInitialized = ref(false)

  const buildPersistedAuthState = (): AuthState => ({
    accessToken: String(accessToken.value || ''),
    clientId: String(clientId.value || ''),
    expiresAt: Number(expiresAt.value || 0),
    userProfile: normalizeUserProfile(userProfile.value),
  })

  const persistAuthState = async () => {
    await window.electronAPI.config.updateItem('auth', buildPersistedAuthState())
  }

  const applyBypassAuth = () => {
    accessToken.value = LOGIN_BYPASS_ACCESS_TOKEN
    clientId.value = LOGIN_BYPASS_CLIENT_ID
    expiresAt.value = LOGIN_BYPASS_EXPIRES_AT
    userProfile.value = normalizeUserProfile({
      ...userProfile.value,
      nickname: userProfile.value.nickname || '本地用户',
      userName: userProfile.value.userName || '本地用户',
    })
  }

  const isLoggedIn = computed(() => {
    if (LOGIN_BYPASS_ENABLED) return true
    if (!accessToken.value || !clientId.value) return false
    if (!expiresAt.value) return false
    return Date.now() < expiresAt.value
  })

  const init = async () => {
    if (isInitialized.value) return
    try {
      const res = await window.electronAPI.config.getItem('auth')
      if (res.success && res.data) {
        const raw = res.data as Partial<AuthState>
        accessToken.value = String(raw.accessToken || '')
        clientId.value = String(raw.clientId || '')
        expiresAt.value = Number(raw.expiresAt || 0)
        userProfile.value = normalizeUserProfile(raw.userProfile)
      }
      if (LOGIN_BYPASS_ENABLED) {
        applyBypassAuth()
      }
    } catch (error) {
      logger.error('加载登录态失败', error)
      if (LOGIN_BYPASS_ENABLED) {
        applyBypassAuth()
      }
    } finally {
      isInitialized.value = true
    }
  }

  const setAuth = async (state: AuthState) => {
    accessToken.value = state.accessToken
    clientId.value = state.clientId
    expiresAt.value = state.expiresAt
    userProfile.value = normalizeUserProfile(state.userProfile)
    await persistAuthState()
  }

  const syncUserProfile = async (profile?: UserProfileSnapshot | null) => {
    const next = normalizeUserProfile(profile)
    const prevSerialized = JSON.stringify(userProfile.value)
    const nextSerialized = JSON.stringify(next)
    if (prevSerialized === nextSerialized) {
      return false
    }
    userProfile.value = next
    if (accessToken.value && clientId.value) {
      await persistAuthState()
    }
    return true
  }

  const clearAuth = async () => {
    if (LOGIN_BYPASS_ENABLED) {
      applyBypassAuth()
      await persistAuthState()
      return
    }
    accessToken.value = ''
    clientId.value = ''
    expiresAt.value = 0
    userProfile.value = emptyUserProfile()
    await window.electronAPI.config.updateItem('auth', null)
  }

  return {
    accessToken,
    clientId,
    expiresAt,
    userProfile,
    isInitialized,
    isLoggedIn,
    init,
    setAuth,
    syncUserProfile,
    clearAuth,
  }
})
