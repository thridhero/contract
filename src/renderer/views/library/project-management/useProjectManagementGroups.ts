import type { Ref } from 'vue'
import type { ProjectManagementGroupNode } from '../../../../shared/types/projectManagement.types'
import type { ToastServiceMethods } from 'primevue/toastservice'

export function useProjectManagementGroups(options: {
  treeData: Ref<ProjectManagementGroupNode[]>
  groupSource: Ref<'local' | 'tree_dictionary'>
  selectedKey: Ref<Record<string, boolean>>
  groupSourcePopover: Ref<any>
  toast: ToastServiceMethods
  defaultTreeData: ProjectManagementGroupNode[]
  readJsonSetting: <T,>(key: string, fallback: T) => Promise<T>
  writeJsonSetting: (key: string, value: unknown, description: string) => Promise<void>
  cloneConfig: <T,>(value: T) => T
  groupsSettingKey: string
  groupsSourceSettingKey: string
  treeDictionaryGroupsSettingKey: string
  reloadData: () => Promise<void>
}) {
  const saveTreeData = async () => {
    if (options.groupSource.value !== 'local') return
    await options.writeJsonSetting(options.groupsSettingKey, options.treeData.value, '项目管理分组树')
  }

  const loadTreeData = async () => {
    options.groupSource.value = await options.readJsonSetting<'local' | 'tree_dictionary'>(options.groupsSourceSettingKey, 'local')
    if (options.groupSource.value === 'tree_dictionary') {
      options.treeData.value = await options.readJsonSetting(options.treeDictionaryGroupsSettingKey, options.defaultTreeData)
      if (!Array.isArray(options.treeData.value) || options.treeData.value.length === 0) {
        options.treeData.value = options.cloneConfig(options.defaultTreeData)
      }
      options.selectedKey.value = { '0': true }
      return
    }

    options.treeData.value = await options.readJsonSetting(options.groupsSettingKey, options.defaultTreeData)
    if (!Array.isArray(options.treeData.value) || options.treeData.value.length === 0) {
      options.treeData.value = options.cloneConfig(options.defaultTreeData)
      await saveTreeData()
    }
  }

  const openGroupSourceMenu = (event: Event) => {
    options.groupSourcePopover.value?.hide?.()
    options.groupSourcePopover.value?.show?.(event)
  }

  const useTreeDictionaryGroups = async () => {
    await options.writeJsonSetting(options.groupsSourceSettingKey, 'tree_dictionary', '项目管理分组来源')
    options.groupSourcePopover.value?.hide?.()
    await loadTreeData()
    await options.reloadData()
    options.toast.add({ severity: 'success', summary: '已引用', detail: '项目分组已引用树形字典分组（请到树形字典维护）', life: 2500 })
  }

  const useLocalGroups = async () => {
    await options.writeJsonSetting(options.groupsSourceSettingKey, 'local', '项目管理分组来源')
    options.groupSourcePopover.value?.hide?.()
    await loadTreeData()
    await options.reloadData()
    options.toast.add({ severity: 'success', summary: '已切换', detail: '项目分组已恢复为本地分组', life: 2000 })
  }

  const copyTreeDictionaryGroupsToLocal = async () => {
    const source = await options.readJsonSetting<ProjectManagementGroupNode[]>(options.treeDictionaryGroupsSettingKey, options.defaultTreeData)
    if (!Array.isArray(source) || source.length === 0) {
      options.toast.add({ severity: 'warn', summary: '无可复制数据', detail: '树形字典分组为空或未初始化', life: 2500 })
      return
    }
    await options.writeJsonSetting(options.groupsSettingKey, source, '项目管理分组树（来自树形字典）')
    await options.writeJsonSetting(options.groupsSourceSettingKey, 'local', '项目管理分组来源')
    options.groupSourcePopover.value?.hide?.()
    await loadTreeData()
    await options.reloadData()
    options.toast.add({ severity: 'success', summary: '复制成功', detail: '树形字典分组已复制为项目管理本地分组', life: 2500 })
  }

  const refreshGroupsFromTreeDictionary = async () => {
    if (options.groupSource.value !== 'tree_dictionary') return
    await loadTreeData()
    await options.reloadData()
    options.toast.add({ severity: 'success', summary: '已刷新', detail: '已重新读取树形字典分组', life: 1500 })
  }

  return {
    saveTreeData,
    loadTreeData,
    openGroupSourceMenu,
    useTreeDictionaryGroups,
    useLocalGroups,
    copyTreeDictionaryGroupsToLocal,
    refreshGroupsFromTreeDictionary
  }
}
