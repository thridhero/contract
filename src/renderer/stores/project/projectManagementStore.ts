import { defineStore } from 'pinia'
import { ref } from 'vue'
import type {
  ProjectManagementCreateDTO,
  ProjectManagementItem,
  ProjectManagementMoveDTO,
  ProjectManagementQueryDTO,
  ProjectManagementQueryResult,
  ProjectManagementSummary,
  ProjectManagementUpdateDTO,
} from '../../shared/types/projectManagement.types'

const emptySummary: ProjectManagementSummary = {
  total: 0,
  totalProjectDays: 0,
  totalBuildingArea: 0,
  totalStartedBuildingArea: 0,
  totalCountedArea: 0,
  totalStartedCountedArea: 0,
}

export const useProjectManagementStore = defineStore('projectManagement', () => {
  const items = ref<ProjectManagementItem[]>([])
  const selectedItem = ref<ProjectManagementItem | null>(null)
  const loading = ref(false)
  const total = ref(0)
  const summary = ref<ProjectManagementSummary>({ ...emptySummary })
  const error = ref<string | null>(null)

  async function loadList(query: ProjectManagementQueryDTO): Promise<ProjectManagementQueryResult | null> {
    loading.value = true
    error.value = null
    try {
      const result = await window.electronAPI.projectManagement.getList(query)
      if (!result.success || !result.data) {
        error.value = result.error || '加载项目列表失败'
        items.value = []
        total.value = 0
        return null
      }

      items.value = result.data.data
      total.value = result.data.total
      if (selectedItem.value) {
        selectedItem.value = items.value.find((item) => item.id === selectedItem.value?.id) || null
      }
      return result.data
    } finally {
      loading.value = false
    }
  }

  async function loadSummary(query: ProjectManagementQueryDTO): Promise<ProjectManagementSummary> {
    const result = await window.electronAPI.projectManagement.getSummary(query)
    if (result.success && result.data) {
      summary.value = result.data
      return result.data
    }
    summary.value = { ...emptySummary }
    error.value = result.error || '加载项目汇总失败'
    return summary.value
  }

  async function createItem(dto: ProjectManagementCreateDTO): Promise<ProjectManagementItem | null> {
    const result = await window.electronAPI.projectManagement.create(dto)
    if (result.success && result.data) {
      return result.data
    }
    error.value = result.error || '创建项目失败'
    return null
  }

  async function updateItem(dto: ProjectManagementUpdateDTO): Promise<ProjectManagementItem | null> {
    const result = await window.electronAPI.projectManagement.update(dto)
    if (result.success && result.data) {
      if (selectedItem.value?.id === result.data.id) {
        selectedItem.value = result.data
      }
      return result.data
    }
    error.value = result.error || '更新项目失败'
    return null
  }

  async function deleteItem(id: string): Promise<boolean> {
    const result = await window.electronAPI.projectManagement.delete(id)
    if (result.success) {
      if (selectedItem.value?.id === id) {
        selectedItem.value = null
      }
      return true
    }
    error.value = result.error || '删除项目失败'
    return false
  }

  async function deleteByQuery(query?: ProjectManagementQueryDTO): Promise<number> {
    const result = await window.electronAPI.projectManagement.deleteByQuery({ query })
    if (result.success && result.data) {
      return result.data.deletedCount
    }
    error.value = result.error || '批量删空失败'
    return 0
  }

  async function moveItem(dto: ProjectManagementMoveDTO): Promise<ProjectManagementItem | null> {
    const result = await window.electronAPI.projectManagement.move(dto)
    if (result.success && result.data) {
      return result.data
    }
    error.value = result.error || '排序失败'
    return null
  }

  async function recode(query: ProjectManagementQueryDTO): Promise<number> {
    const result = await window.electronAPI.projectManagement.recode(query)
    if (result.success && result.data) {
      return result.data.updatedCount
    }
    error.value = result.error || '重新编码失败'
    return 0
  }

  function selectItem(item: ProjectManagementItem | null) {
    selectedItem.value = item
  }

  return {
    items,
    selectedItem,
    loading,
    total,
    summary,
    error,
    loadList,
    loadSummary,
    createItem,
    updateItem,
    deleteItem,
    deleteByQuery,
    moveItem,
    recode,
    selectItem,
  }
})
