import type { Theme } from './types'

/**
 * 浅色主题配置
 * 基于现代设计系统，提供清晰明亮的视觉体验
 */
export const lightTheme: Theme = {
  name: 'light',
  mode: 'light',

  // 侧边栏 - 浅灰色背景，清晰层次
  sidebar: {
    background: '#F8F9FA',
    text: '#212529',
    textSecondary: '#6C757D',
    hoverBackground: '#E9ECEF',
    activeBackground: '#DEE2E6',
    activeBorder: '#0D6EFD',
    divider: '#DEE2E6'
  },

  // 标题栏 - 纯白背景
  titlebar: {
    background: '#FFFFFF',
    text: '#212529',
    textSecondary: '#6C757D',
    border: '#DEE2E6'
  },

  // 内容区域 - 白色主背景
  content: {
    background: '#FFFFFF',
    cardBackground: '#F8F9FA',
    cardBackgroundHover: '#E9ECEF',
    text: '#212529',
    textSecondary: '#495057',
    textMuted: '#6C757D',
    border: '#DEE2E6',
    divider: '#E9ECEF'
  },

  // 按钮 - 蓝色主色调
  button: {
    primary: {
      background: '#0D6EFD',
      hover: '#0B5ED7',
      active: '#0A58CA',
      text: '#FFFFFF'
    },
    secondary: {
      background: '#6C757D',
      hover: '#5C636A',
      active: '#565E64',
      text: '#FFFFFF'
    },
    danger: {
      background: '#DC3545',
      hover: '#BB2D3B',
      active: '#B02A37',
      text: '#FFFFFF'
    },
    ghost: {
      background: 'transparent',
      hover: '#E9ECEF',
      active: '#DEE2E6',
      text: '#212529'
    }
  },

  // 输入框
  input: {
    background: '#FFFFFF',
    backgroundHover: '#FFFFFF',
    backgroundFocus: '#FFFFFF',
    border: '#DEE2E6',
    borderHover: '#ADB5BD',
    borderFocus: '#0D6EFD',
    text: '#212529',
    placeholder: '#ADB5BD'
  },

  // 表格
  table: {
    headerBackground: '#F8F9FA',
    headerText: '#212529',
    rowBackground: '#FFFFFF',
    rowBackgroundHover: '#F8F9FA',
    rowBackgroundAlternate: '#FBFCFD',
    rowText: '#212529',
    border: '#DEE2E6'
  },

  // 滚动条
  scrollbar: {
    track: 'transparent',
    thumb: '#ADB5BD',
    thumbHover: '#6C757D'
  },

  // 阴影
  shadow: {
    sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
    md: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
    lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
    xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
  },

  // 分隔线
  separator: {
    color: '#DEE2E6'
  }
}

export default lightTheme
