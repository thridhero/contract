/**
 * 主题状态管理 Store
 * 使用 Pinia 管理全局主题状态
 */
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { createRendererLogger } from '@/utils/logger'
import type { Theme, ThemeMode } from '../../themes/types'
import { lightTheme, darkTheme, themeToCSSVars, detectSystemTheme } from '../../themes'

import { usePreset, definePreset } from '@primeuix/themes'
import Aura from '@primeuix/themes/aura'
import Material from '@primeuix/themes/material'
import Lara from '@primeuix/themes/lara'
import Nora from '@primeuix/themes/nora'

const logger = createRendererLogger('ThemeStore')

// 本地存储键名
const STORAGE_KEY = 'app-theme-mode'
const PRESET_STORAGE_KEY = 'app-primevue-preset'
const FONT_SIZE_STORAGE_KEY = 'app-font-size'
const PRIMARY_COLOR_STORAGE_KEY = 'app-primary-color'

export type PrimeVuePreset = 'aura' | 'material' | 'lara' | 'nora'

/**
 * 主题 Store
 */
export const useThemeStore = defineStore('theme', () => {
  // ============ State ============
  /** 当前主题模式 */
  const themeMode = ref<ThemeMode>('auto')

  /** PrimeVue 预设主题 */
  const primeVuePreset = ref<PrimeVuePreset>('aura')

  /** 基础字体大小 */
  const fontSize = ref<string>('14px')

  /** 主题颜色 (对应 PrimeVue 的 primary.color) */
  const primaryColor = ref<string>('#0D6EFD') // 默认蓝色

  /** 是否为深色模式（实际应用的模式） */
  const isDark = ref(false)

  /** 是否已完成初始化 */
  const isInitialized = ref(false)

  /** 是否正在过渡动画中 */
  const isTransitioning = ref(false)

  // ============ Getters ============
  /** 当前主题配置 */
  const currentTheme = computed<Theme>(() => {
    return isDark.value ? darkTheme : lightTheme
  })

  /** CSS 变量映射 */
  const cssVars = computed(() => themeToCSSVars(currentTheme.value))

  /** 图标颜色 */
  const iconColor = computed(() => isDark.value ? '#E8EAED' : '#212529')

  /** 次要图标颜色 */
  const iconColorSecondary = computed(() => isDark.value ? '#9AA0A6' : '#6C757D')

  /** 当前模式标签 */
  const modeLabel = computed(() => {
    switch (themeMode.value) {
      case 'light': return '浅色'
      case 'dark': return '深色'
      case 'auto': return '跟随系统'
      default: return '自动'
    }
  })

  // ============ Actions ============
  let mediaQueryListener: ((e: MediaQueryListEvent) => void) | null = null

  const setupSystemThemeListener = () => {
    if (typeof window === 'undefined') return

    removeSystemThemeListener()

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    mediaQueryListener = (e: MediaQueryListEvent) => {
      if (themeMode.value === 'auto') {
        isDark.value = e.matches
        applyTheme(e.matches)
        syncThemeV2(e.matches, true)
      }
    }

    mediaQuery.addEventListener('change', mediaQueryListener)
  }

  const removeSystemThemeListener = () => {
    if (typeof window === 'undefined' || !mediaQueryListener) return

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    mediaQuery.removeEventListener('change', mediaQueryListener)
    mediaQueryListener = null
  }

  const syncThemeV2 = (dark: boolean, isAuto: boolean) => {
    if (typeof window === 'undefined' || typeof document === 'undefined') return

    const themeId = dark ? 'theme-dark' : 'theme-light'
    document.documentElement.setAttribute('data-theme', themeId)

    try {
      localStorage.setItem('app-theme-id', themeId)
      localStorage.setItem('app-theme-auto', isAuto ? 'true' : 'false')
    } catch (e) {
      logger.warn('无法同步 data-theme 主题设置:', e)
    }
  }

  /**
   * 应用主题到 DOM
   */
  const applyTheme = (dark: boolean) => {
    if (typeof document === 'undefined') return

    const html = document.documentElement
    const body = document.body

    // 添加/移除 dark 类
    if (dark) {
      html.classList.add('dark')
      html.classList.add('dark-mode')
      body.classList.add('dark-mode')
    } else {
      html.classList.remove('dark')
      html.classList.remove('dark-mode')
      body.classList.remove('dark-mode')
    }

    // 应用 CSS 变量
    const vars = themeToCSSVars(dark ? darkTheme : lightTheme)
    Object.entries(vars).forEach(([key, value]) => {
      html.style.setProperty(key, value)
    })

    // 更新 meta theme-color
    const metaThemeColor = document.querySelector('meta[name="theme-color"]')
    if (metaThemeColor) {
      metaThemeColor.setAttribute('content', dark ? '#0D1117' : '#FFFFFF')
    }
  }

  /**
   * 设置主题模式
   */
  const setThemeMode = (mode: ThemeMode, apply = true) => {
    themeMode.value = mode

    // 计算实际是否为深色模式
    const shouldBeDark = mode === 'auto'
      ? detectSystemTheme() === 'dark'
      : mode === 'dark'

    isDark.value = shouldBeDark

    // 应用主题
    if (apply) {
      applyTheme(shouldBeDark)
    }

    if (mode === 'auto') {
      setupSystemThemeListener()
    } else {
      removeSystemThemeListener()
    }

    syncThemeV2(shouldBeDark, mode === 'auto')

    // 持久化存储
    try {
      localStorage.setItem(STORAGE_KEY, mode)
    } catch (e) {
      logger.warn('无法持久化主题设置:', e)
    }
  }

  /**
   * 切换主题（浅色 <-> 深色）
   */
  const toggleTheme = () => {
    const newMode = isDark.value ? 'light' : 'dark'
    setThemeMode(newMode)
  }

  /**
   * 设置 PrimeVue 预设主题
   */
  const setPrimeVuePreset = (presetName: PrimeVuePreset) => {
    primeVuePreset.value = presetName
    
    let presetObj;
    switch (presetName) {
      case 'material': presetObj = Material; break;
      case 'lara': presetObj = Lara; break;
      case 'nora': presetObj = Nora; break;
      case 'aura':
      default: presetObj = Aura; break;
    }
    
    // 调用 PrimeVue 的 usePreset 动态切换主题
    if (primaryColor.value && primaryColor.value !== '#0D6EFD') {
      // 如果有自定义颜色，则合并预设
      const customPreset = definePreset(presetObj, {
        semantic: {
          primary: {
            50: `${primaryColor.value}10`,
            100: `${primaryColor.value}20`,
            200: `${primaryColor.value}30`,
            300: `${primaryColor.value}40`,
            400: `${primaryColor.value}60`,
            500: primaryColor.value,
            600: `${primaryColor.value}E0`,
            700: `${primaryColor.value}C0`,
            800: `${primaryColor.value}A0`,
            900: `${primaryColor.value}80`,
            950: `${primaryColor.value}60`
          }
        }
      })
      usePreset(customPreset)
    } else {
      usePreset(presetObj)
    }

    // 持久化存储
    try {
      localStorage.setItem(PRESET_STORAGE_KEY, presetName)
    } catch (e) {
      logger.warn('无法持久化 PrimeVue 预设:', e)
    }
  }

  /**
   * 设置全局主色调
   */
  const setPrimaryColor = (color: string) => {
    primaryColor.value = color
    
    // 更新自定义 CSS 变量，确保应用内其他组件（非 PrimeVue 组件）也能响应
    if (typeof document !== 'undefined') {
      const html = document.documentElement
      html.style.setProperty('--btn-primary-bg', color)
      html.style.setProperty('--sidebar-active-border', color)
    }

    // 重新应用当前的 PrimeVue 预设以使新颜色生效
    setPrimeVuePreset(primeVuePreset.value)

    try {
      localStorage.setItem(PRIMARY_COLOR_STORAGE_KEY, color)
    } catch (e) {
      logger.warn('无法持久化主色调:', e)
    }
  }

  /**
   * 设置全局字体大小
   */
  const setFontSize = (size: string) => {
    fontSize.value = size
    
    if (typeof document !== 'undefined') {
      document.documentElement.style.fontSize = size
    }

    try {
      localStorage.setItem(FONT_SIZE_STORAGE_KEY, size)
    } catch (e) {
      logger.warn('无法持久化字体大小:', e)
    }
  }

  /**
   * 初始化主题
   */
  const initTheme = () => {
    if (typeof window === 'undefined') return

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

    // 应用主题（不触发持久化）
    setThemeMode(savedMode, false)

    // 应用到 DOM
    const shouldBeDark = savedMode === 'auto'
      ? detectSystemTheme() === 'dark'
      : savedMode === 'dark'
    applyTheme(shouldBeDark)
    syncThemeV2(shouldBeDark, savedMode === 'auto')

    // 初始化主色调
    try {
      const storedColor = localStorage.getItem(PRIMARY_COLOR_STORAGE_KEY)
      if (storedColor) {
        primaryColor.value = storedColor
        // 提前注入 CSS 变量
        if (typeof document !== 'undefined') {
          const html = document.documentElement
          html.style.setProperty('--btn-primary-bg', storedColor)
          html.style.setProperty('--sidebar-active-border', storedColor)
        }
      }
    } catch (e) {
      logger.warn('无法读取主色调设置:', e)
    }

    // 初始化 PrimeVue 预设
    try {
      const storedPreset = localStorage.getItem(PRESET_STORAGE_KEY) as PrimeVuePreset
      if (storedPreset && ['aura', 'material', 'lara', 'nora'].includes(storedPreset)) {
        setPrimeVuePreset(storedPreset)
      }
    } catch (e) {
      logger.warn('无法读取 PrimeVue 预设设置:', e)
    }

    // 初始化字体大小
    try {
      const storedFontSize = localStorage.getItem(FONT_SIZE_STORAGE_KEY)
      if (storedFontSize) {
        setFontSize(storedFontSize)
      } else {
        setFontSize('14px') // 默认 14px
      }
    } catch (e) {
      logger.warn('无法读取字体大小设置:', e)
    }

    isInitialized.value = true

    // 如果是自动模式，设置系统主题监听
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

  // ============ Return ============
  return {
    // State
    themeMode,
    primeVuePreset,
    fontSize,
    primaryColor,
    isDark,
    isInitialized,
    isTransitioning,

    // Getters
    currentTheme,
    cssVars,
    iconColor,
    iconColorSecondary,
    modeLabel,

    // Actions
    initTheme,
    setThemeMode,
    setPrimeVuePreset,
    setPrimaryColor,
    setFontSize,
    toggleTheme,
    applyTheme,
    cleanup
  }
})

export default useThemeStore
