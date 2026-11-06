/**
 * 主题系统统一出口
 * 集中管理所有主题相关的导出
 */

// 类型导出
export type {
  Theme,
  ThemeMode,
  ThemeOptions,
  ThemeState,
  CSSVarMap,
  SidebarTheme,
  TitlebarTheme,
  ContentTheme,
  ButtonTheme,
  InputTheme,
  TableTheme,
  ScrollbarTheme,
  ShadowTheme
} from './types'

// 主题配置导出
export { lightTheme } from './light'
export { darkTheme } from './dark'

// 默认导出
export { lightTheme as default } from './light'

// 主题工具函数
import type { Theme, CSSVarMap } from './types'
import { lightTheme } from './light'
import { darkTheme } from './dark'

/**
 * 获取指定模式的主题配置
 * @param mode - 主题模式
 * @returns 主题配置对象
 */
export function getTheme(mode: 'light' | 'dark'): Theme {
  return mode === 'dark' ? darkTheme : lightTheme
}

/**
 * 将主题配置转换为 CSS 变量映射
 * @param theme - 主题配置
 * @returns CSS 变量映射对象
 */
export function themeToCSSVars(theme: Theme): CSSVarMap {
  return {
    // 侧边栏
    '--sidebar-bg': theme.sidebar.background,
    '--sidebar-text': theme.sidebar.text,
    '--sidebar-text-secondary': theme.sidebar.textSecondary,
    '--sidebar-hover-bg': theme.sidebar.hoverBackground,
    '--sidebar-active-bg': theme.sidebar.activeBackground,
    '--sidebar-active-border': theme.sidebar.activeBorder,
    '--sidebar-divider': theme.sidebar.divider,

    // 标题栏
    '--titlebar-bg': theme.titlebar.background,
    '--titlebar-text': theme.titlebar.text,
    '--titlebar-text-secondary': theme.titlebar.textSecondary,
    '--titlebar-border': theme.titlebar.border,

    // 内容区域
    '--content-bg': theme.content.background,
    '--content-card-bg': theme.content.cardBackground,
    '--content-card-bg-hover': theme.content.cardBackgroundHover,
    '--content-text': theme.content.text,
    '--content-text-secondary': theme.content.textSecondary,
    '--content-text-muted': theme.content.textMuted,
    '--content-border': theme.content.border,
    '--content-divider': theme.content.divider,

    // 按钮 - 主要
    '--btn-primary-bg': theme.button.primary.background,
    '--btn-primary-hover': theme.button.primary.hover,
    '--btn-primary-active': theme.button.primary.active,
    '--btn-primary-text': theme.button.primary.text,

    // 按钮 - 次要
    '--btn-secondary-bg': theme.button.secondary.background,
    '--btn-secondary-hover': theme.button.secondary.hover,
    '--btn-secondary-active': theme.button.secondary.active,
    '--btn-secondary-text': theme.button.secondary.text,

    // 按钮 - 危险
    '--btn-danger-bg': theme.button.danger.background,
    '--btn-danger-hover': theme.button.danger.hover,
    '--btn-danger-active': theme.button.danger.active,
    '--btn-danger-text': theme.button.danger.text,

    // 按钮 - 幽灵
    '--btn-ghost-bg': theme.button.ghost.background,
    '--btn-ghost-hover': theme.button.ghost.hover,
    '--btn-ghost-active': theme.button.ghost.active,
    '--btn-ghost-text': theme.button.ghost.text,

    // 输入框
    '--input-bg': theme.input.background,
    '--input-bg-hover': theme.input.backgroundHover,
    '--input-bg-focus': theme.input.backgroundFocus,
    '--input-border': theme.input.border,
    '--input-border-hover': theme.input.borderHover,
    '--input-border-focus': theme.input.borderFocus,
    '--input-text': theme.input.text,
    '--input-placeholder': theme.input.placeholder,

    // 表格
    '--table-header-bg': theme.table.headerBackground,
    '--table-header-text': theme.table.headerText,
    '--table-row-bg': theme.table.rowBackground,
    '--table-row-bg-hover': theme.table.rowBackgroundHover,
    '--table-row-bg-alt': theme.table.rowBackgroundAlternate,
    '--table-row-text': theme.table.rowText,
    '--table-border': theme.table.border,

    // 滚动条
    '--scrollbar-track': theme.scrollbar.track,
    '--scrollbar-thumb': theme.scrollbar.thumb,
    '--scrollbar-thumb-hover': theme.scrollbar.thumbHover,

    // 阴影
    '--shadow-sm': theme.shadow.sm,
    '--shadow-md': theme.shadow.md,
    '--shadow-lg': theme.shadow.lg,
    '--shadow-xl': theme.shadow.xl,

    // 分隔线
    '--separator-color': theme.separator.color
  }
}

/**
 * 检测系统主题偏好
 * @returns 系统主题模式
 */
export function detectSystemTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'light'
  if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    return 'dark'
  }
  return 'light'
}

/**
 * 所有可用主题列表
 */
export const availableThemes = [
  { label: '浅色', value: 'light', icon: 'pi pi-sun' },
  { label: '深色', value: 'dark', icon: 'pi pi-moon' },
  { label: '跟随系统', value: 'auto', icon: 'pi pi-desktop' }
] as const
