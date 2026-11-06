/**
 * 数据库实体类型
 * 在主进程、预加载脚本、渲染进程之间共享，确保类型一致。
 */
export interface Setting {
  id: number;
  key: string;
  value: string;
  description: string;
  created_at: string;
  updated_at: string;
}

export interface SettingInsertParams {
  key: string;
  value: string;
  description?: string;
}

export interface SettingUpdateParams {
  key: string;
  value: string;
  description?: string;
}
