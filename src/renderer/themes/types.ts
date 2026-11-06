/**
 * 主题系统类型定义
 * 定义所有主题相关的接口和类型
 */

// 主题模式类型
export type ThemeMode = 'light' | 'dark' | 'auto'

// 侧边栏主题配置
export interface SidebarTheme {
  background: string
  text: string
  textSecondary: string
  hoverBackground: string
  activeBackground: string
  activeBorder: string
  divider: string
}

// 标题栏主题配置
export interface TitlebarTheme {
  background: string
  text: string
  textSecondary: string
  border: string
}

// 内容区域主题配置
export interface ContentTheme {
  background: string
  cardBackground: string
  cardBackgroundHover: string
  text: string
  textSecondary: string
  textMuted: string
  border: string
  divider: string
}

// 按钮主题配置
export interface ButtonTheme {
  primary: {
    background: string
    hover: string
    active: string
    text: string
  }
  secondary: {
    background: string
    hover: string
    active: string
    text: string
  }
  danger: {
    background: string
    hover: string
    active: string
    text: string
  }
  ghost: {
    background: string
    hover: string
    active: string
    text: string
  }
}

// 输入框主题配置
export interface InputTheme {
  background: string
  backgroundHover: string
  backgroundFocus: string
  border: string
  borderHover: string
  borderFocus: string
  text: string
  placeholder: string
}

// 表格主题配置
export interface TableTheme {
  headerBackground: string
  headerText: string
  rowBackground: string
  rowBackgroundHover: string
  rowBackgroundAlternate: string
  rowText: string
  border: string
}

// 滚动条主题配置
export interface ScrollbarTheme {
  track: string
  thumb: string
  thumbHover: string
}

// 阴影配置
export interface ShadowTheme {
  sm: string
  md: string
  lg: string
  xl: string
}

// 完整主题配置
export interface Theme {
  name: string
  mode: 'light' | 'dark'
  sidebar: SidebarTheme
  titlebar: TitlebarTheme
  content: ContentTheme
  button: ButtonTheme
  input: InputTheme
  table: TableTheme
  scrollbar: ScrollbarTheme
  shadow: ShadowTheme
  separator: {
    color: string
  }
}

// CSS 变量映射类型
export type CSSVarMap = Record<string, string>

// 主题配置选项
export interface ThemeOptions {
  mode: ThemeMode
  followSystem: boolean
  transitionDuration: number
}

// 主题状态
export interface ThemeState {
  currentMode: ThemeMode
  isDark: boolean
  isTransitioning: boolean
}
