import { computed, ref, type Ref } from 'vue'
import type { ContractFileRecord } from '../../../../shared/types/contractFile.types'
import { compareName, dirname, getExt, normalizePathForCompare } from './contractFilesHelpers'

type ContractFilesViewMode = 'tree' | 'list' | 'waterfall'
type ListSortField = 'name' | 'type' | 'size' | 'mtime'

const normalizeListSortField = (v: unknown): ListSortField => {
  if (v === 'name' || v === 'type' || v === 'size' || v === 'mtime') return v
  return 'name'
}

const getTypeSortKeyForRecord = (r: ContractFileRecord) => {
  if (!r) return ''
  if (r.type === 'folder') return ''
  return String(getExt(r.name) || '文件').toLowerCase()
}

export const useContractFilesList = (params: {
  items: Ref<ContractFileRecord[]>
  rootDir: Ref<string>
  currentListDir: Ref<string>
  searchQuery: Ref<string>
  activeRenderMode: Ref<ContractFilesViewMode | null>
  settingKey?: string
  trashMode?: Ref<boolean>
}) => {
  const { items, rootDir, currentListDir, searchQuery, activeRenderMode } = params
  const trashMode = params.trashMode
  const settingKey = params.settingKey || 'contract_files_list_sort'

  const listSortField = ref<ListSortField>(
    normalizeListSortField(
      (() => {
        try {
          const raw = localStorage.getItem(settingKey)
          if (!raw) return 'name'
          const parsed = JSON.parse(raw)
          return parsed?.field
        } catch {
          return 'name'
        }
      })()
    )
  )

  const listSortOrder = ref<1 | -1>(
    (() => {
      try {
        const raw = localStorage.getItem(settingKey)
        if (!raw) return 1
        const parsed = JSON.parse(raw)
        return parsed?.order === -1 ? -1 : 1
      } catch {
        return 1
      }
    })()
  )

  const saveListSort = () => {
    try {
      localStorage.setItem(settingKey, JSON.stringify({ field: listSortField.value, order: listSortOrder.value }))
    } catch {
    }
  }

  const onListSort = (event: any) => {
    const field = normalizeListSortField(event?.sortField)
    const order = event?.sortOrder === -1 ? -1 : 1
    listSortField.value = field
    listSortOrder.value = order
    saveListSort()
  }

  const listItems = computed(() => {
    if (searchQuery.value.trim()) {
      return items.value
    }
    if (trashMode?.value) {
      return items.value
    }
    const current = normalizePathForCompare(currentListDir.value || rootDir.value)
    if (!current) return items.value
    return items.value.filter((it) => normalizePathForCompare(dirname(it.path)) === current)
  })

  const sortedListItems = computed(() => {
    if (activeRenderMode.value !== 'list') {
      return listItems.value
    }
    const source = Array.isArray(listItems.value) ? [...listItems.value] : []
    const field = listSortField.value
    const order = listSortOrder.value
    source.sort((a, b) => {
      const aFolder = a?.type === 'folder'
      const bFolder = b?.type === 'folder'
      if (aFolder !== bFolder) return aFolder ? -1 : 1

      let c = 0
      if (field === 'name') {
        c = compareName(a?.name || '', b?.name || '')
      } else if (field === 'type') {
        c = compareName(getTypeSortKeyForRecord(a), getTypeSortKeyForRecord(b))
      } else if (field === 'size') {
        const av = typeof a?.size === 'number' ? a.size : -1
        const bv = typeof b?.size === 'number' ? b.size : -1
        c = av - bv
      } else {
        const av = typeof a?.mtime === 'number' ? a.mtime : 0
        const bv = typeof b?.mtime === 'number' ? b.mtime : 0
        c = av - bv
      }

      if (c === 0) c = compareName(a?.name || '', b?.name || '')
      return c * order
    })
    return source
  })

  return {
    listItems,
    sortedListItems,
    listSortField,
    listSortOrder,
    onListSort,
    settingKey,
  }
}
