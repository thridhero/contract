import type { Theme } from './types'

/**
 * 深色主题配置
 * 基于现代设计系统，提供舒适的暗色视觉体验
 */
export const darkTheme: Theme = {
  name: 'dark',
  mode: 'dark',

  // 侧边栏 - 深蓝灰色背景
  sidebar: {
    background: '#1E2127',
    text: '#E8EAED',
    textSecondary: '#9AA0A6',
    hoverBackground: '#2D333B',
    activeBackground: '#373E47',
    activeBorder: '#58A6FF',
    divider: '#30363D'
  },

  // 标题栏 - 深色背景
  titlebar: {
    background: '#161B22',
    text: '#E8EAED',
    textSecondary: '#9AA0A6',
    border: '#30363D'
  },

  // 内容区域 - 深色主背景
  content: {
    background: '#0D1117',
    cardBackground: '#161B22',
    cardBackgroundHover: '#1C2128',
    text: '#E8EAED',
    textSecondary: '#C9D1D9',
    textMuted: '#8B949E',
    border: '#30363D',
    divider: '#21262D'
  },

  // 按钮 - 蓝色主色调（保持品牌一致性）
  button: {
    primary: {
      background: '#58A6FF',
      hover: '#79B8FF',
      active: '#A5D6FF',
      text: '#0D1117'
    },
    secondary: {
      background: '#484F58',
      hover: '#3D444D',
      active: '#333A42',
      text: '#E8EAED'
    },
    danger: {
      background: '#F85149',
      hover: '#FF7B72',
      active: '#FFA198',
      text: '#0D1117'
    },
    ghost: {
      background: 'transparent',
      hover: '#21262D',
      active: '#30363D',
      text: '#E8EAED'
    }
  },

  // 输入框
  input: {
    background: '#0D1117',
    backgroundHover: '#161B22',
    backgroundFocus: '#0D1117',
    border: '#30363D',
    borderHover: '#484F58',
    borderFocus: '#58A6FF',
    text: '#E8EAED',
    placeholder: '#6E7681'
  },

  // 表格
  table: {
    headerBackground: '#161B22',
    headerText: '#E8EAED',
    rowBackground: '#0D1117',
    rowBackgroundHover: '#161B22',
    rowBackgroundAlternate: '#111820',
    rowText: '#E8EAED',
    border: '#30363D'
  },

  // 滚动条
  scrollbar: {
    track: 'transparent',
    thumb: '#484F58',
    thumbHover: '#6E7681'
  },

  // 阴影（深色模式下更柔和）
  shadow: {
    sm: '0 1px 2px 0 rgba(0, 0, 0, 0.3)',
    md: '0 4px 6px -1px rgba(0, 0, 0, 0.4), 0 2px 4px -1px rgba(0, 0, 0, 0.3)',
    lg: '0 10px 15px -3px rgba(0, 0, 0, 0.4), 0 4px 6px -2px rgba(0, 0, 0, 0.3)',
    xl: '0 20px 25px -5px rgba(0, 0, 0, 0.4), 0 10px 10px -5px rgba(0, 0, 0, 0.3)'
  },

  // 分隔线
  separator: {
    color: '#30363D'
  }
}

export default darkTheme
