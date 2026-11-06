import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Project, ProjectCreateDTO, ProjectUpdateDTO, ProjectStatus } from '../../../shared/types/project.types'

export const useProjectStore = defineStore('project', () => {
  const projects = ref<Project[]>([])
  const selectedProject = ref<Project | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)
  const lastLoadOptions = ref({ includeArchived: false })

  // ─── 计算属性 ──────────────────────────────────────────────

  const projectsByStatus = computed(() => {
    const map: Record<string, Project[]> = {}
    for (const p of projects.value) {
      if (!map[p.status]) map[p.status] = []
      map[p.status].push(p)
    }
    return map
  })

  const totalCount = computed(() => projects.value.length)

  const stats = computed(() => {
    const by_status: Record<string, number> = {}
    for (const p of projects.value) {
      by_status[p.status] = (by_status[p.status] ?? 0) + 1
    }
    return { total: projects.value.length, by_status }
  })

  // ─── 方法 ──────────────────────────────────────────────────

  async function loadProjects(includeArchived = false) {
    lastLoadOptions.value = { includeArchived }
    loading.value = true
    error.value = null
    projects.value = [] // 切换库或加载时先清空，避免旧数据闪烁
    try {
      const res = await window.electronAPI.project.getAll(includeArchived)
      if (res.success && res.data) {
        projects.value = res.data
        if (selectedProject.value && !projects.value.some(p => p.id === selectedProject.value?.id)) {
          selectedProject.value = null
        }
      } else {
        error.value = res.error ?? '加载项目失败'
      }
    } finally {
      loading.value = false
    }
  }

  async function createProject(dto: ProjectCreateDTO): Promise<Project | null> {
    loading.value = true
    error.value = null
    try {
      const res = await window.electronAPI.project.create(dto)
      if (res.success && res.data) {
        projects.value.unshift(res.data)
        return res.data
      } else {
        error.value = res.error ?? '创建项目失败'
        return null
      }
    } finally {
      loading.value = false
    }
  }

  async function updateProject(dto: ProjectUpdateDTO): Promise<Project | null> {
    const res = await window.electronAPI.project.update(dto)
    if (res.success && res.data) {
      const idx = projects.value.findIndex(p => p.id === dto.id)
      if (idx !== -1) projects.value[idx] = res.data
      if (selectedProject.value?.id === dto.id) selectedProject.value = res.data
      return res.data
    }
    error.value = res.error ?? '更新项目失败'
    return null
  }

  async function deleteProject(id: string): Promise<boolean> {
    const res = await window.electronAPI.project.delete(id)
    if (res.success) {
      await loadProjects(lastLoadOptions.value.includeArchived)
      return true
    }
    error.value = res.error ?? '删除项目失败'
    return false
  }

  async function searchProjects(term: string) {
    if (!term.trim()) {
      await loadProjects(lastLoadOptions.value.includeArchived)
      return
    }
    loading.value = true
    try {
      const res = await window.electronAPI.project.search(term)
      if (res.success && res.data) projects.value = res.data
    } finally {
      loading.value = false
    }
  }

  function selectProject(project: Project | null) {
    selectedProject.value = project
  }

  return {
    projects,
    selectedProject,
    loading,
    error,
    projectsByStatus,
    totalCount,
    stats,
    loadProjects,
    createProject,
    updateProject,
    deleteProject,
    searchProjects,
    selectProject,
  }
})
