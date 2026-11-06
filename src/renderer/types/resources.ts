/**
 * 资源相关类型定义
 */

// 资源（用于属性面板）
export interface Resource {
  type: string
  name: string
  size: string
  date: string
  path: string
  thumbnail?: string
  tags: string[]
  description?: string
}
