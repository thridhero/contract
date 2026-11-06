import { computed, type ComputedRef, type Ref } from 'vue'
import type { ContractFileRecord } from '../../../types/resources'
import { dirname, getExt, getRelativeParts, joinPath, normalizePathForCompare } from './contractFilesHelpers'
import type { ContractFilesViewMode } from './contractFilesViewTypes'

export function useContractFilesFilters(args: {
  rootDir: Ref<string>
  items: Ref<ContractFileRecord[]>
  viewMode: Ref<ContractFilesViewMode>
  currentListDir: Ref<string>
  searchQuery: Ref<string>

  filterBarVisible: Ref<boolean>
  tagPopover: Ref<any>
  folderPopover: Ref<any>
  formatPopover: Ref<any>

  selectedFolders: Ref<string[]>
  folderSearchQuery: Ref<string>
  selectedFormats: Ref<string[]>
  formatSearchQuery: Ref<string>

  listItemsBase: ComputedRef<ContractFileRecord[]>
  sortedListItemsBase: ComputedRef<ContractFileRecord[]>
}) {
  const toggleFilterBar = () => {
    args.filterBarVisible.value = !args.filterBarVisible.value
  }

  const filterBarItems = computed(() => {
    return [
      { key: 'tag', label: '标签筛选', icon: 'pi pi-tags', onClick: () => args.tagPopover.value?.toggle?.() },
      { key: 'folder', label: '文件夹', icon: 'pi pi-folder', onClick: () => args.folderPopover.value?.toggle?.() },
      { key: 'format', label: '格式', icon: 'pi pi-file', onClick: () => args.formatPopover.value?.toggle?.() },
    ]
  })

  const onFilterBarItemClick = (item: any, event: MouseEvent) => {
    if (!item?.key) return
    if (item.key === 'tag') {
      args.tagPopover.value?.toggle?.(event)
      return
    }
    if (item.key === 'folder') {
      args.folderPopover.value?.toggle?.(event)
      return
    }
    if (item.key === 'format') {
      args.formatPopover.value?.toggle?.(event)
      return
    }
  }

  const listDirForFiltering = computed(() => {
    if (args.viewMode.value !== 'list' && args.viewMode.value !== 'waterfall') return args.rootDir.value
    return args.currentListDir.value || args.rootDir.value
  })

  const folderOptions = computed(() => {
    const root = normalizePathForCompare(listDirForFiltering.value)
    if (!root) return []
    const seen = new Map<string, { key: string; label: string; count: number; fullPath: string }>()
    for (const item of args.items.value) {
      if (!item || item.type !== 'folder') continue
      const p = normalizePathForCompare(item.path)
      if (!p || p === root) continue
      if (!p.startsWith(root + '/')) continue
      const parts = getRelativeParts(p, root)
      if (parts.length === 0) continue
      const levelPath = joinPath(root, parts[0])
      const key = normalizePathForCompare(levelPath)
      const existing = seen.get(key)
      if (existing) {
        existing.count += 1
        continue
      }
      seen.set(key, { key, label: parts[0], count: 1, fullPath: levelPath })
    }
    return Array.from(seen.values()).sort((a, b) => a.label.localeCompare(b.label, 'zh-Hans-CN', { numeric: true, sensitivity: 'base' }))
  })

  const filteredFolderOptions = computed(() => {
    const keyword = args.folderSearchQuery.value.trim().toLowerCase()
    if (!keyword) return folderOptions.value
    return folderOptions.value.filter((it) => it.label.toLowerCase().includes(keyword))
  })

  const isFolderSelected = (folderKey: string) => {
    const key = normalizePathForCompare(folderKey)
    return args.selectedFolders.value.some((it) => normalizePathForCompare(it) === key)
  }

  const toggleFolderSelection = (folderKey: string) => {
    const key = normalizePathForCompare(folderKey)
    const next = new Set(args.selectedFolders.value.map((it) => normalizePathForCompare(it)))
    if (next.has(key)) next.delete(key)
    else next.add(key)
    args.selectedFolders.value = Array.from(next)
  }

  const clearFolderSelection = () => {
    args.selectedFolders.value = []
    args.folderSearchQuery.value = ''
  }

  const selectedFolderDisplay = computed(() => {
    if (args.selectedFolders.value.length === 0) return '全部'
    if (args.selectedFolders.value.length === 1) {
      const normalized = normalizePathForCompare(args.selectedFolders.value[0])
      const option = folderOptions.value.find((it) => normalizePathForCompare(it.fullPath) === normalized)
      return option?.label || dirname(normalized).split('/').pop() || '已选'
    }
    return `已选 ${args.selectedFolders.value.length} 个`
  })

  const fileTypeStats = computed(() => {
    const map = new Map<string, { ext: string; label: string; count: number }>()
    for (const item of args.items.value) {
      if (!item || item.type !== 'file') continue
      const ext = getExt(item.name || '').toLowerCase()
      const key = ext || '__unknown__'
      const label = ext ? ext.toUpperCase() : '未知'
      const existing = map.get(key)
      if (existing) {
        existing.count += 1
        continue
      }
      map.set(key, { ext: key, label, count: 1 })
    }
    return Array.from(map.values()).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
  })

  const filteredFileTypeStats = computed(() => {
    const keyword = args.formatSearchQuery.value.trim().toLowerCase()
    if (!keyword) return fileTypeStats.value
    return fileTypeStats.value.filter((it) => it.label.toLowerCase().includes(keyword) || it.ext.toLowerCase().includes(keyword))
  })

  const isFormatSelected = (ext: string) => {
    const key = String(ext || '').trim().toLowerCase()
    return args.selectedFormats.value.some((it) => String(it || '').trim().toLowerCase() === key)
  }

  const toggleFormatSelection = (ext: string) => {
    const key = String(ext || '').trim().toLowerCase()
    const next = new Set(args.selectedFormats.value.map((it) => String(it || '').trim().toLowerCase()))
    if (next.has(key)) next.delete(key)
    else next.add(key)
    args.selectedFormats.value = Array.from(next)
  }

  const clearFormatSelection = () => {
    args.selectedFormats.value = []
    args.formatSearchQuery.value = ''
  }

  const selectedFormatDisplay = computed(() => {
    if (args.selectedFormats.value.length === 0) return '全部'
    if (args.selectedFormats.value.length === 1) return args.selectedFormats.value[0].toUpperCase()
    return `已选 ${args.selectedFormats.value.length} 种`
  })

  const normalizedSelectedFolderPrefixes = computed(() => {
    const listDir = normalizePathForCompare(listDirForFiltering.value)
    const roots = args.selectedFolders.value
      .map((p) => normalizePathForCompare(p))
      .filter(Boolean)
      .map((p) => (p.startsWith(listDir) ? p : joinPath(listDir, p)))
      .map((p) => normalizePathForCompare(p))
    return roots
  })

  const normalizedSelectedFormats = computed(() => {
    return args.selectedFormats.value.map((it) => String(it || '').trim().toLowerCase()).filter(Boolean)
  })

  const applyRecordFilters = (records: ContractFileRecord[]) => {
    const folderPrefixes = normalizedSelectedFolderPrefixes.value
    const formats = normalizedSelectedFormats.value
    const keyword = args.searchQuery.value.trim().toLowerCase()
    const listDir = normalizePathForCompare(listDirForFiltering.value)

    return records.filter((it) => {
      if (!it) return false

      if (keyword) {
        const name = String(it.name || '').toLowerCase()
        if (!name.includes(keyword)) return false
      }

      const pathKey = normalizePathForCompare(it.path)
      if (folderPrefixes.length > 0) {
        const matched = folderPrefixes.some((prefix) => {
          const p = normalizePathForCompare(prefix)
          if (!p) return false
          if (pathKey === p) return true
          return pathKey.startsWith(p + '/')
        })
        if (!matched) return false
      } else if (listDir && (args.viewMode.value === 'list' || args.viewMode.value === 'waterfall')) {
        if (pathKey !== listDir && !pathKey.startsWith(listDir + '/')) return false
      }

      if (formats.length > 0 && it.type === 'file') {
        const ext = getExt(it.name || '').toLowerCase()
        const key = ext || '__unknown__'
        if (!formats.includes(key)) return false
      }

      return true
    })
  }

  const treeItems = computed(() => applyRecordFilters(args.items.value))
  const listItems = computed(() => applyRecordFilters(args.listItemsBase.value))
  const sortedListItems = computed(() => applyRecordFilters(args.sortedListItemsBase.value))

  return {
    filterBarItems,
    toggleFilterBar,
    onFilterBarItemClick,

    folderOptions,
    filteredFolderOptions,
    folderSearchQuery: args.folderSearchQuery,
    selectedFolders: args.selectedFolders,
    isFolderSelected,
    toggleFolderSelection,
    clearFolderSelection,
    selectedFolderDisplay,

    fileTypeStats,
    filteredFileTypeStats,
    formatSearchQuery: args.formatSearchQuery,
    selectedFormats: args.selectedFormats,
    isFormatSelected,
    toggleFormatSelection,
    clearFormatSelection,
    selectedFormatDisplay,

    applyRecordFilters,
    treeItems,
    listItems,
    sortedListItems,
  }
}

