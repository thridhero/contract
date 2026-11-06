/**
 * 项目相关类型定义
 */

// 工作区
export interface Workspace {
  id: number
  name: string
}

// 快捷分类
export interface QuickCategory {
  key: string
  name: string
  icon: string
  count: number
}

// 文件夹（支持嵌套子文件夹）
export interface Folder {
  id: number
  name: string
  count: number
  children?: Folder[]
}

// 详情区域文件夹（用于卡片展示）
export interface DetailFolder {
  id: number
  name: string
  count: number
  tags?: string[]
}
