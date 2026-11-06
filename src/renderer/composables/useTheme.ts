/**
 * 主题管理 Composable
 * 提供响应式的主题管理功能
 */
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { createRendererLogger } from '@/utils/logger'
import type { Theme, ThemeMode, CSSVarMap } from '../themes/types'
import { lightTheme, darkTheme, themeToCSSVars, detectSystemTheme } from '../themes'

const logger = createRendererLogger('UseTheme')

// 本地存储键名
const STORAGE_KEY = 'app-theme-mode'

// 全局状态（确保跨组件共享）
const globalThemeMode = ref<ThemeMode>('auto')
const globalIsDark = ref(false)
const globalIsInitialized = ref(false)

/**
 * 主题管理 Composable
 * @returns 主题管理相关的方法和状态
 */
export function useTheme() {
  // 本地状态（与全局状态同步）
  const themeMode = ref<ThemeMode>(globalThemeMode.value)
  const isDarkMode = ref(globalIsDark.value)
  const isInitialized = ref(globalIsInitialized.value)

  // 系统主题监听器
  let mediaQueryListener: ((e: MediaQueryListEvent) => void) | null = null

  /**
   * 获取实际应用的主题模式
   */
  const effectiveMode = computed<'light' | 'dark'>(() => {
    if (themeMode.value === 'auto') {
      return detectSystemTheme()
    }
    return themeMode.value
  })

  /**
   * 当前主题配置
   */
  const currentTheme = computed<Theme>(() => {
    return isDarkMode.value ? darkTheme : lightTheme
  })

  /**
   * CSS 变量映射
   */
  const cssVars = computed<CSSVarMap>(() => {
    return themeToCSSVars(currentTheme.value)
  })

  /**
   * 图标颜色（根据主题返回合适的颜色）
   */
  const iconColor = computed(() => {
    return isDarkMode.value ? '#E8EAED' : '#212529'
  })

  /**
   * 次要图标颜色
   */
  const iconColorSecondary = computed(() => {
    return isDarkMode.value ? '#9AA0A6' : '#6C757D'
  })

  /**
   * 应用主题到 DOM
   */
  const applyTheme = (dark: boolean) => {
    if (typeof document === 'undefined') return

    const html = document.documentElement
    const body = document.body

    // 添加/移除 dark 类（用于 Tailwind）
    if (dark) {
      html.classList.add('dark')
      body.classList.add('dark-mode')
    } else {
      html.classList.remove('dark')
      body.classList.remove('dark-mode')
    }

    // 应用 CSS 变量
    const vars = themeToCSSVars(dark ? darkTheme : lightTheme)
    Object.entries(vars).forEach(([key, value]) => {
      html.style.setProperty(key, value)
    })

    // 更新 meta theme-color（移动端浏览器主题色）
    const metaThemeColor = document.querySelector('meta[name="theme-color"]')
    if (metaThemeColor) {
      metaThemeColor.setAttribute('content', dark ? '#0D1117' : '#FFFFFF')
    }
  }

  /**
   * 更新主题状态
   */
  const updateThemeState = (mode: ThemeMode) => {
    themeMode.value = mode
    globalThemeMode.value = mode

    // 计算实际是否为深色模式
    const shouldBeDark = mode === 'auto' ? detectSystemTheme() === 'dark' : mode === 'dark'
    isDarkMode.value = shouldBeDark
    globalIsDark.value = shouldBeDark

    // 应用主题
    applyTheme(shouldBeDark)

    // 持久化存储
    try {
      localStorage.setItem(STORAGE_KEY, mode)
    } catch (e) {
      logger.warn('无法持久化主题设置:', e)
    }
  }

  /**
   * 设置主题模式
   */
  const setThemeMode = (mode: ThemeMode) => {
    updateThemeState(mode)

    // 如果是自动模式，设置系统主题监听
    if (mode === 'auto') {
      setupSystemThemeListener()
    } else {
      removeSystemThemeListener()
    }
  }

  /**
   * 切换主题（浅色 <-> 深色）
   */
  const toggleTheme = () => {
    const newMode = isDarkMode.value ? 'light' : 'dark'
    setThemeMode(newMode)
  }

  /**
   * 设置系统主题监听器
   */
  const setupSystemThemeListener = () => {
    if (typeof window === 'undefined') return

    removeSystemThemeListener()

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    mediaQueryListener = (e: MediaQueryListEvent) => {
      if (themeMode.value === 'auto') {
        const shouldBeDark = e.matches
        isDarkMode.value = shouldBeDark
        globalIsDark.value = shouldBeDark
        applyTheme(shouldBeDark)
      }
    }

    mediaQuery.addEventListener('change', mediaQueryListener)
  }

  /**
   * 移除系统主题监听器
   */
  const removeSystemThemeListener = () => {
    if (typeof window === 'undefined' || !mediaQueryListener) return

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    mediaQuery.removeEventListener('change', mediaQueryListener)
    mediaQueryListener = null
  }

  /**
   * 初始化主题
   */
  const initTheme = () => {
    if (typeof window === 'undefined') return

    // 防止重复初始化
    if (globalIsInitialized.value) {
      themeMode.value = globalThemeMode.value
      isDarkMode.value = globalIsDark.value
      isInitialized.value = true
      applyTheme(isDarkMode.value)
      return
    }

    // 从本地存储读取主题设置
    let savedMode: ThemeMode = 'auto'
    try {
      const stored = localStorage.getItem(STORAGE_KEY) as ThemeMode
      if (stored && ['light', 'dark', 'auto'].includes(stored)) {
        savedMode = stored
      }
    } catch (e) {
      logger.warn('无法读取主题设置:', e)
    }

    // 应用主题
    themeMode.value = savedMode
    globalThemeMode.value = savedMode

    const shouldBeDark = savedMode === 'auto'
      ? detectSystemTheme() === 'dark'
      : savedMode === 'dark'

    isDarkMode.value = shouldBeDark
    globalIsDark.value = shouldBeDark
    isInitialized.value = true
    globalIsInitialized.value = true

    applyTheme(shouldBeDark)

    // 如果是自动模式，设置监听器
    if (savedMode === 'auto') {
      setupSystemThemeListener()
    }
  }

  /**
   * 清理资源
   */
  const cleanup = () => {
    removeSystemThemeListener()
  }

  // 生命周期管理
  onMounted(() => {
    // 组件挂载时确保主题已应用
    if (isInitialized.value) {
      applyTheme(isDarkMode.value)
    }
  })

  onUnmounted(() => {
    // 注意：不在组件卸载时清理，因为主题是全局的
    // cleanup()
  })

  // 监听状态变化（用于调试）
  watch([themeMode, isDarkMode], ([newMode, newDark]) => {
    logger.debug(`Theme changed - Mode: ${newMode}, Dark: ${newDark}`)
  })

  return {
    // 状态
    themeMode,
    isDarkMode,
    isInitialized,
    effectiveMode,

    // 计算属性
    currentTheme,
    cssVars,
    iconColor,
    iconColorSecondary,

    // 方法
    initTheme,
    setThemeMode,
    toggleTheme,
    applyTheme,
    cleanup
  }
}

/**
 * 获取当前主题（非响应式，用于非 Vue 上下文）
 */
export function getCurrentTheme(): Theme {
  if (typeof window === 'undefined') return lightTheme

  try {
    const stored = localStorage.getItem(STORAGE_KEY) as ThemeMode
    if (stored === 'dark') return darkTheme
    if (stored === 'light') return lightTheme
    // auto 或默认
    return detectSystemTheme() === 'dark' ? darkTheme : lightTheme
  } catch {
    return lightTheme
  }
}

/**
 * 获取当前主题模式
 */
export function getCurrentThemeMode(): ThemeMode {
  if (typeof window === 'undefined') return 'auto'

  try {
    const stored = localStorage.getItem(STORAGE_KEY) as ThemeMode
    if (stored && ['light', 'dark', 'auto'].includes(stored)) {
      return stored
    }
  } catch {
    // ignore
  }
  return 'auto'
}

export default useTheme
