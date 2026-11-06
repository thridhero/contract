/**
 * Library Types
 * 资源库相关类型定义
 */

/**
 * 资源库对象
 */
export interface Library {
  /** 唯一标识符（UUID） */
  id: string;
  /** 资源库名称 */
  name: string;
  /** 资源库完整路径 */
  path: string;
  /** 创建时间（ISO 8601 格式） */
  createdAt: string;
  /** 更新时间（ISO 8601 格式） */
  updatedAt: string;
}

/**
 * 创建资源库 DTO
 */
export interface LibraryCreateDTO {
  /** 资源库名称 */
  name: string;
  /** 保存路径 */
  path: string;
}
