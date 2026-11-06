import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { createRendererLogger } from '@/utils/logger'
import { useProjectStore } from '../project/projectStore'

const logger = createRendererLogger('SidebarStore')

export const SIDEBAR_WIDTH_EXPANDED = 320
export const SIDEBAR_WIDTH_COLLAPSED = 72
export const SIDEBAR_WIDTH_MAX = 560
export const SIDEBAR_COLLAPSE_THRESHOLD = 140
const SIDEBAR_COLLAPSE_HYSTERESIS = 16
const AI_WORKBENCH_KEY = 'ai-workbench'

/**
 * 侧边栏分类项接口
 * 用于左侧分类栏的快捷分类、智能文件夹等
 */
export interface SidebarCategory {
  key: string
  name: string
  icon: string
  count: number
}

/**
 * 侧边栏文件夹接口
 * 用于文件夹树形结构展示
 */
export interface SidebarFolder {
  id: string
  name: string
  count: number
  children?: SidebarFolder[]
}

/**
 * 侧边栏 Store
 * 管理左侧分类栏的所有数据：快捷分类、智能文件夹、文件夹树、资源库菜单等
 */
export const useSidebarStore = defineStore('sidebar', () => {
  const projectStore = useProjectStore()
  const libraryStats = ref({
    activeContracts: 0,
    trashContracts: 0,
    totalTags: 0,
  })

  const isSidebarCollapsed = ref(false)

  const sidebarWidthPx = ref<number>(SIDEBAR_WIDTH_EXPANDED)
  const lastExpandedWidthPx = ref<number>(SIDEBAR_WIDTH_EXPANDED)

  const clampSidebarWidth = (width: number) =>
    Math.min(SIDEBAR_WIDTH_MAX, Math.max(SIDEBAR_WIDTH_COLLAPSED, Math.round(width)))

  const sidebarWidth = computed(() => sidebarWidthPx.value)

  const setSidebarWidth = (width: number) => {
    const nextWidth = clampSidebarWidth(width)

    if (isSidebarCollapsed.value) {
      if (nextWidth >= SIDEBAR_COLLAPSE_THRESHOLD + SIDEBAR_COLLAPSE_HYSTERESIS) {
        isSidebarCollapsed.value = false
        sidebarWidthPx.value = nextWidth
        lastExpandedWidthPx.value = nextWidth
        return
      }
      sidebarWidthPx.value = SIDEBAR_WIDTH_COLLAPSED
      return
    }

    if (nextWidth <= SIDEBAR_COLLAPSE_THRESHOLD) {
      isSidebarCollapsed.value = true
      sidebarWidthPx.value = SIDEBAR_WIDTH_COLLAPSED
      return
    }

    sidebarWidthPx.value = nextWidth
    lastExpandedWidthPx.value = nextWidth
  }

  const toggleSidebarCollapsed = () => {
    if (isSidebarCollapsed.value) {
      const restored = clampSidebarWidth(Math.max(lastExpandedWidthPx.value, SIDEBAR_COLLAPSE_THRESHOLD + SIDEBAR_COLLAPSE_HYSTERESIS))
      isSidebarCollapsed.value = false
      sidebarWidthPx.value = restored
      lastExpandedWidthPx.value = restored
      return
    }

    lastExpandedWidthPx.value = sidebarWidthPx.value
    isSidebarCollapsed.value = true
    sidebarWidthPx.value = SIDEBAR_WIDTH_COLLAPSED
  }

  // ─── 快捷分类（与最近使用同一层级）──────────────────────────────

  const quickCategoriesConfig = ref<SidebarCategory[]>([])

  const defaultQuickCategories: SidebarCategory[] = [
    { key: AI_WORKBENCH_KEY, name: 'AI 工作台', icon: 'sparkles', count: 0 },
    { key: 'toolbox', name: '工具箱', icon: 'wrench', count: 0 },
    { key: 'all', name: '合同信息', icon: 'inbox', count: 0 },
    { key: 'untagged', name: '全库合同文件', icon: 'file-pdf', count: 0 },
    { key: 'other-files', name: '资料管理', icon: 'file', count: 0 },
    { key: 'calendar', name: '日历', icon: 'calendar', count: 0 },
    { key: 'trash', name: '回收站', icon: 'trash', count: 0 },
    { key: 'suppliers', name: '乙方单位', icon: 'users', count: 0 },
    { key: 'customers', name: '甲方单位', icon: 'briefcase', count: 0 },
    { key: 'department-personnel', name: '部门与人员', icon: 'sitemap', count: 0 },
    { key: 'contract-config', name: '合同配置', icon: 'sliders-h', count: 0 },
    { key: 'contract-executions', name: '合同执行管理', icon: 'clipboard', count: 0 },
    { key: 'contract-products', name: '合同产品管理', icon: 'box', count: 0 },
    { key: 'receipt-plans', name: '收款计划', icon: 'wallet', count: 0 },
    { key: 'contract-invoices', name: '发票管理', icon: 'receipt', count: 0 },
    { key: 'project-management', name: '项目管理', icon: 'folder-open', count: 0 },
    { key: 'dictionaries', name: '字典设置', icon: 'book', count: 0 },
    { key: 'tree-dictionaries', name: '树形字典', icon: 'sitemap', count: 0 },
  ]

  const normalizeQuickCategories = (cats: SidebarCategory[]) =>
    cats.filter(
      (c) =>
        c.key !== 'uncategorized' &&
        c.key !== 'departments' &&
        c.key !== 'personnel' &&
        c.key !== 'recent' &&
        c.key !== 'templates' &&
        c.key !== 'statistics' &&
        c.key !== 'tags' &&
        c.key !== 'contract-management' &&
        c.key !== 'feedback',
    )

  const pinAiWorkbenchFirst = (cats: SidebarCategory[]): SidebarCategory[] => {
    const aiCategory = cats.find((c) => c.key === AI_WORKBENCH_KEY)
    if (!aiCategory) {
      return cats
    }

    return [aiCategory, ...cats.filter((c) => c.key !== AI_WORKBENCH_KEY)]
  }

  const canonicalCategoryName = (key: string, fallbackName: string) => {
    if (key === 'all') return '合同信息'
    return fallbackName
  }

  const mergeQuickCategories = (config: SidebarCategory[]): SidebarCategory[] => {
    const merged: SidebarCategory[] = [...config]
    const existingKeys = new Set(merged.map((c) => c.key))

    for (const def of defaultQuickCategories) {
      if (existingKeys.has(def.key)) continue

      if (def.key === 'trash') {
        const idx = merged.findIndex((c) => c.key === 'tags')
        if (idx >= 0) {
          merged.splice(idx + 1, 0, def)
        } else {
          merged.push(def)
        }
      } else if (def.key === 'tree-dictionaries') {
        const idx = merged.findIndex((c) => c.key === 'dictionaries')
        if (idx >= 0) {
          merged.splice(idx + 1, 0, def)
        } else {
          merged.push(def)
        }
      } else {
        merged.push(def)
      }

      existingKeys.add(def.key)
    }

    return merged
  }

  const quickCategories = computed<SidebarCategory[]>(() => {
    if (quickCategoriesConfig.value.length === 0) {
      // Fallback defaults
      return defaultQuickCategories.map((cat) => {
        let count = cat.count
        if (cat.key === 'all') {
          count = libraryStats.value.activeContracts
        } else if (cat.key === 'tags') {
          count = libraryStats.value.totalTags
        } else if (cat.key === 'trash') {
          count = libraryStats.value.trashContracts
        }

        return { ...cat, name: canonicalCategoryName(cat.key, cat.name), count }
      })
    }
    
    // Merge dynamic counts with config
    return pinAiWorkbenchFirst(normalizeQuickCategories(mergeQuickCategories(quickCategoriesConfig.value))).map(cat => {
      let count = cat.count
      if (cat.key === 'all') {
        count = libraryStats.value.activeContracts
      } else if (cat.key === 'tags') {
        count = libraryStats.value.totalTags
      } else if (cat.key === 'trash') {
        count = libraryStats.value.trashContracts
      }
      return { ...cat, name: canonicalCategoryName(cat.key, cat.name), count }
    })
  })

  // ─── 快速访问 ─────────────────────────────────────────────────

  const quickAccess = computed<SidebarCategory[]>(() => [])

  // ─── 智能文件夹 ───────────────────────────────────────────────

  const smartFolders = computed<SidebarCategory[]>(() => {
    const stats = projectStore.stats.by_status

    return [
      {
        key: 'smart:expiring',
        name: '本月到期',
        icon: 'calendar-times',
        count: stats['expiring'] ?? 0,
      },
      {
        key: 'smart:correction',
        name: '需要补正',
        icon: 'exclamation-triangle',
        count: stats['correction'] ?? 0,
      },
      {
        key: 'smart:payment',
        name: '待缴费',
        icon: 'dollar',
        count: stats['payment'] ?? 0,
      },
    ]
  })

  // ─── 文件夹树（按申请人分组）──────────────────────────────────

  const folderTree = computed<SidebarFolder[]>(() => {
    const grouped = new Map<string, SidebarFolder>()

    for (const p of projectStore.projects) {
      const groupKey = p.applicant_type === 'enterprise' ? '企业申请' : '个人申请'
      if (!grouped.has(groupKey)) {
        grouped.set(groupKey, {
          id: groupKey,
          name: groupKey,
          count: 0,
          children: [],
        })
      }
      const group = grouped.get(groupKey)!
      group.count++
      group.children?.push({
        id: p.id,
        name: p.name,
        count: 0,
      })
    }

    return Array.from(grouped.values())
  })

  let cleanupConfigListener: (() => void) | null = null

  async function load() {
    await projectStore.loadProjects()

    const libraryPath = localStorage.getItem('currentLibraryPath') || ''
    if (libraryPath) {
      try {
        const statsRes = await window.electronAPI.library.getSidebarStats(libraryPath)
        if (statsRes.success && statsRes.data) {
          libraryStats.value = {
            activeContracts: Number(statsRes.data.activeContracts || 0),
            trashContracts: Number(statsRes.data.trashContracts || 0),
            totalTags: Number(statsRes.data.totalTags || 0),
          }
        }
      } catch (error) {
        logger.error('Failed to load library sidebar stats:', error)
      }
    } else {
      libraryStats.value = {
        activeContracts: 0,
        trashContracts: 0,
        totalTags: 0,
      }
    }
    
    try {
      const res = await window.electronAPI.config.getItem('quickCategories')
      if (res.success && res.data) {
        quickCategoriesConfig.value = pinAiWorkbenchFirst(normalizeQuickCategories(res.data))
      }
    } catch (error) {
      logger.error('Failed to load quickCategories config:', error)
    }

    if (!cleanupConfigListener) {
      cleanupConfigListener = window.electronAPI.config.onChanged((config) => {
        if (config && config.quickCategories) {
          quickCategoriesConfig.value = pinAiWorkbenchFirst(normalizeQuickCategories(config.quickCategories))
        }
      })
    }
  }

  return {
    isSidebarCollapsed,
    sidebarWidth,
    setSidebarWidth,
    toggleSidebarCollapsed,
    quickCategories,
    quickAccess,
    smartFolders,
    folderTree,
    load,
  }
})
