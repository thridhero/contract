import type { Ref } from 'vue'
import type { ProjectManagementDesignConfig, ProjectManagementQueryPreferences, ProjectManagementSortConfig } from '../../../../shared/types/projectManagement.types'

export function useProjectManagementPreferences(options: {
  designConfig: Ref<ProjectManagementDesignConfig>
  sortConfig: Ref<ProjectManagementSortConfig>
  queryPreferences: Ref<ProjectManagementQueryPreferences>
  viewMode: Ref<'list' | 'card'>
  pagination: Ref<{ page: number; pageSize: number }>
  defaultDesignConfig: ProjectManagementDesignConfig
  defaultSortConfig: ProjectManagementSortConfig
  defaultQueryPreferences: ProjectManagementQueryPreferences
  readJsonSetting: <T,>(key: string, fallback: T) => Promise<T>
  writeJsonSetting: (key: string, value: unknown, description: string) => Promise<void>
  designSettingKey: string
  sortSettingKey: string
  querySettingKey: string
  viewModeSettingKey: string
}) {
  const loadPreferences = async () => {
    options.designConfig.value = await options.readJsonSetting(options.designSettingKey, options.defaultDesignConfig)
    options.sortConfig.value = await options.readJsonSetting(options.sortSettingKey, options.defaultSortConfig)
    options.queryPreferences.value = await options.readJsonSetting(options.querySettingKey, options.defaultQueryPreferences)
    options.viewMode.value = await options.readJsonSetting(options.viewModeSettingKey, 'list')
    options.queryPreferences.value.onlySelectedGroup = false
    options.queryPreferences.value.autoCombineGroupQuery = true
    options.queryPreferences.value.showSummary = true
    await options.writeJsonSetting(options.querySettingKey, options.queryPreferences.value, '项目管理查询偏好')
    options.pagination.value.pageSize = options.queryPreferences.value.pageSize
  }

  const setViewMode = async (mode: 'list' | 'card') => {
    options.viewMode.value = mode
    await options.writeJsonSetting(options.viewModeSettingKey, mode, '项目管理视图模式')
  }

  return { loadPreferences, setViewMode }
}
