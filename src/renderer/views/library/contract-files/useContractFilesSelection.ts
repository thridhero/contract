import { computed, ref, type ComputedRef, type Ref } from 'vue'
import type { ContractFileRecord } from '../../../types/resources'
import { normalizePathForCompare } from './contractFilesHelpers'
import type { ContractFilesViewMode } from './contractFilesViewTypes'

export function useContractFilesSelection(args: {
  viewMode: Ref<ContractFilesViewMode>
  items: Ref<ContractFileRecord[]>
  listItems: ComputedRef<ContractFileRecord[]>
  sortedListItems: ComputedRef<ContractFileRecord[]>
  treeTableNodes: ComputedRef<any[]>
  treeRootKey: ComputedRef<string>
  treeExpandedKeys: Ref<Record<string, boolean>>
  rootDir: Ref<string>
}) {
  const recordById = computed(() => {
    const map = new Map<string, ContractFileRecord>()
    for (const r of args.items.value) {
      map.set(String(r.fileId), r)
    }
    return map
  })

  const recordByPath = computed(() => {
    const map = new Map<string, ContractFileRecord>()
    for (const r of args.items.value) {
      map.set(normalizePathForCompare(r.path), r)
    }
    return map
  })

  const listAllSelected = ref(false)
  const listIncludedIds = ref<Set<string>>(new Set())
  const listExcludedIds = ref<Set<string>>(new Set())
  const listSelectionAnchorId = ref<string | null>(null)

  const treeAllSelected = ref(false)
  const treeIncludedKeys = ref<Set<string>>(new Set())
  const treeExcludedKeys = ref<Set<string>>(new Set())
  const treeSelectionAnchorKey = ref<string | null>(null)

  const waterfallAllSelected = ref(false)
  const waterfallIncludedIds = ref<Set<string>>(new Set())
  const waterfallExcludedIds = ref<Set<string>>(new Set())

  const isListSelected = (fileId: string) => {
    const id = String(fileId || '')
    if (!id) return false
    if (listAllSelected.value) return !listExcludedIds.value.has(id)
    return listIncludedIds.value.has(id)
  }

  const listRowClass = (data: ContractFileRecord) => {
    return isListSelected(String(data?.fileId || '')) ? 'p-highlight' : ''
  }

  const isTreeKeySelected = (key: string) => {
    const k = String(key || '').trim()
    if (!k) return false
    if (treeAllSelected.value) return !treeExcludedKeys.value.has(k)
    return treeIncludedKeys.value.has(k)
  }

  const treeRowClass = (node: any) => {
    const key = String(node?.key || '').trim()
    if (!key) return ''
    return isTreeKeySelected(key) ? 'contract-file-tree-row-selected' : ''
  }

  const isWaterfallSelected = (record: ContractFileRecord) => {
    const id = String(record?.fileId || '')
    if (!id) return false
    if (waterfallAllSelected.value) return !waterfallExcludedIds.value.has(id)
    return waterfallIncludedIds.value.has(id)
  }

  const countTreeNodes = (nodes: any[]): number => {
    let count = 0
    for (const n of nodes || []) {
      count += 1
      if (n?.children?.length) count += countTreeNodes(n.children)
    }
    return count
  }

  const countTreeNodeTypes = (nodes: any[]): { folderCount: number; fileCount: number } => {
    let folderCount = 0
    let fileCount = 0
    const traverse = (list: any[]) => {
      for (const node of list || []) {
        const t = String(node?.data?.type || '')
        if (t === 'folder') folderCount += 1
        else fileCount += 1
        if (node?.children?.length) traverse(node.children)
      }
    }
    traverse(nodes || [])
    return { folderCount, fileCount }
  }

  const visibleEntryCount = computed(() => {
    if (args.viewMode.value === 'tree') {
      const rootNode = Array.isArray(args.treeTableNodes.value) ? (args.treeTableNodes.value as any[])[0] : null
      return rootNode?.children?.length ? countTreeNodes(rootNode.children) : 0
    }
    return args.listItems.value.length
  })

  const visibleFolderCount = computed(() => {
    if (args.viewMode.value === 'tree') {
      const rootNode = Array.isArray(args.treeTableNodes.value) ? (args.treeTableNodes.value as any[])[0] : null
      const counts = rootNode?.children?.length ? countTreeNodeTypes(rootNode.children) : { folderCount: 0, fileCount: 0 }
      return counts.folderCount
    }
    return (args.listItems.value || []).filter((r) => r?.type === 'folder').length
  })

  const visibleFileCount = computed(() => {
    if (args.viewMode.value === 'tree') {
      const rootNode = Array.isArray(args.treeTableNodes.value) ? (args.treeTableNodes.value as any[])[0] : null
      const counts = rootNode?.children?.length ? countTreeNodeTypes(rootNode.children) : { folderCount: 0, fileCount: 0 }
      return counts.fileCount
    }
    return (args.listItems.value || []).filter((r) => r?.type === 'file').length
  })

  const selectedCount = computed(() => {
    if (args.viewMode.value === 'tree') {
      const rootKey = args.treeRootKey.value
      if (treeAllSelected.value) return Math.max(0, visibleEntryCount.value - treeExcludedKeys.value.size)
      const base = treeIncludedKeys.value.size
      return treeIncludedKeys.value.has(rootKey) ? Math.max(0, base - 1) : base
    }
    if (args.viewMode.value === 'list') {
      return listAllSelected.value ? Math.max(0, args.sortedListItems.value.length - listExcludedIds.value.size) : listIncludedIds.value.size
    }
    return waterfallAllSelected.value ? Math.max(0, args.listItems.value.length - waterfallExcludedIds.value.size) : waterfallIncludedIds.value.size
  })

  const ensureSelectionForContext = (record: ContractFileRecord | null | undefined) => {
    if (!record) return
    if (args.viewMode.value === 'tree') {
      const key = normalizePathForCompare(record.path)
      if (!isTreeKeySelected(key)) {
        treeAllSelected.value = false
        treeExcludedKeys.value = new Set()
        treeIncludedKeys.value = new Set([key])
        treeSelectionAnchorKey.value = key
      }
      return
    }
    if (args.viewMode.value === 'list') {
      const id = String(record.fileId)
      if (!isListSelected(id)) {
        listAllSelected.value = false
        listExcludedIds.value = new Set()
        listIncludedIds.value = new Set([id])
        listSelectionAnchorId.value = id
      }
      return
    }
    const id = String(record.fileId)
    if (!isWaterfallSelected(record)) {
      waterfallAllSelected.value = false
      waterfallExcludedIds.value = new Set()
      waterfallIncludedIds.value = new Set([id])
    }
  }

  const isSelectionCheckboxTarget = (target: EventTarget | null) => {
    const el = target as HTMLElement | null
    if (!el) return false
    return !!el.closest('.p-checkbox, .p-checkbox-box, .p-datatable-checkbox, .p-treetable-checkbox')
  }

  let pointerDownListStateSnapshot: { allSelected: boolean; included: Set<string>; excluded: Set<string> } | null = null
  let pointerDownTreeStateSnapshot: { allSelected: boolean; included: Set<string>; excluded: Set<string> } | null = null
  let pointerDownTreeMeta: { shiftKey: boolean; ctrlKey: boolean; metaKey: boolean; checkbox: boolean } | null = null

  const onFileAreaPointerDownCapture = (e: MouseEvent) => {
    pointerDownListStateSnapshot = args.viewMode.value === 'list'
      ? { allSelected: listAllSelected.value, included: new Set(listIncludedIds.value), excluded: new Set(listExcludedIds.value) }
      : null
    pointerDownTreeStateSnapshot = args.viewMode.value === 'tree'
      ? { allSelected: treeAllSelected.value, included: new Set(treeIncludedKeys.value), excluded: new Set(treeExcludedKeys.value) }
      : null
    pointerDownTreeMeta = args.viewMode.value === 'tree'
      ? { shiftKey: !!e.shiftKey, ctrlKey: !!e.ctrlKey, metaKey: !!e.metaKey, checkbox: isSelectionCheckboxTarget(e.target) }
      : null
  }

  const getVisibleTreeKeys = () => {
    const expanded = args.treeExpandedKeys.value || {}
    const keys: string[] = []
    const walk = (nodes: any[]) => {
      for (const node of nodes || []) {
        const key = String(node?.key || '').trim()
        if (!key) continue
        keys.push(key)
        if (node?.children?.length && expanded[key]) {
          walk(node.children)
        }
      }
    }
    walk(args.treeTableNodes.value as any)
    return keys
  }

  let listRowClickTimer: number | null = null
  const onListRowClick = (event: any) => {
    const e = event?.originalEvent as MouseEvent | undefined
    const record = event?.data as ContractFileRecord | undefined
    if (!e || !record) return
    if (listRowClickTimer) window.clearTimeout(listRowClickTimer)
    const anchor = listSelectionAnchorId.value
    listRowClickTimer = window.setTimeout(() => {
      const clickedId = String(record.fileId)
      const source = args.sortedListItems.value
      const indexOfId = (id: string) => source.findIndex((r) => String(r.fileId) === id)
      const clickedIndex = indexOfId(clickedId)
      if (clickedIndex < 0) return

      const snapshot = pointerDownListStateSnapshot || { allSelected: listAllSelected.value, included: new Set(listIncludedIds.value), excluded: new Set(listExcludedIds.value) }
      const modFromKey = e.metaKey || e.ctrlKey
      const checkbox = isSelectionCheckboxTarget(e.target)
      const mod = e.shiftKey ? modFromKey : (modFromKey || checkbox)

      const resolvedAnchorId = anchor && indexOfId(anchor) >= 0 ? anchor : clickedId
      const anchorIndex = indexOfId(resolvedAnchorId)

      if (e.shiftKey && anchorIndex >= 0) {
        const [from, to] = anchorIndex <= clickedIndex ? [anchorIndex, clickedIndex] : [clickedIndex, anchorIndex]
        const range = source.slice(from, to + 1)
        const rangeIds = new Set(range.map((r) => String(r.fileId)))
        listAllSelected.value = false
        listExcludedIds.value = new Set()
        listIncludedIds.value = modFromKey && !snapshot.allSelected ? new Set([...snapshot.included, ...rangeIds]) : rangeIds
        if (!listSelectionAnchorId.value) listSelectionAnchorId.value = resolvedAnchorId
        return
      }

      if (mod) {
        if (snapshot.allSelected) {
          const nextExcluded = new Set(snapshot.excluded)
          if (nextExcluded.has(clickedId)) nextExcluded.delete(clickedId)
          else nextExcluded.add(clickedId)
          listAllSelected.value = true
          listExcludedIds.value = nextExcluded
          listIncludedIds.value = new Set()
        } else {
          const nextIncluded = new Set(snapshot.included)
          if (nextIncluded.has(clickedId)) nextIncluded.delete(clickedId)
          else nextIncluded.add(clickedId)
          listAllSelected.value = false
          listExcludedIds.value = new Set()
          listIncludedIds.value = nextIncluded
        }
        listSelectionAnchorId.value = clickedId
        return
      }

      listAllSelected.value = false
      listExcludedIds.value = new Set()
      listIncludedIds.value = new Set([clickedId])
      listSelectionAnchorId.value = clickedId
    }, 0)
  }

  const onTreeNodeClick = (event: MouseEvent, node: any) => {
    const e = event
    if (!e || !node) return
    const clickedKey = String(node.key || '').trim()
    if (!clickedKey) return

    const snapshot = pointerDownTreeStateSnapshot || { allSelected: treeAllSelected.value, included: new Set(treeIncludedKeys.value), excluded: new Set(treeExcludedKeys.value) }
    const meta = pointerDownTreeMeta
    const shift = !!(meta ? meta.shiftKey : e.shiftKey)
    const modFromKey = !!(meta ? (meta.metaKey || meta.ctrlKey) : (e.metaKey || e.ctrlKey))
    const checkbox = !!meta?.checkbox || isSelectionCheckboxTarget(e.target)
    const mod = shift ? modFromKey : (modFromKey || checkbox)

    const visibleKeys = getVisibleTreeKeys()
    const indexOfKey = (k: string) => visibleKeys.indexOf(k)
    const clickedIndex = indexOfKey(clickedKey)
    if (clickedIndex < 0) {
      treeAllSelected.value = false
      treeExcludedKeys.value = new Set()
      treeIncludedKeys.value = new Set([clickedKey])
      treeSelectionAnchorKey.value = clickedKey
      return
    }

    const resolvedAnchorKey = treeSelectionAnchorKey.value && indexOfKey(treeSelectionAnchorKey.value) >= 0 ? treeSelectionAnchorKey.value : clickedKey
    const anchorIndex = indexOfKey(resolvedAnchorKey)

    if (shift && anchorIndex >= 0) {
      const [from, to] = anchorIndex <= clickedIndex ? [anchorIndex, clickedIndex] : [clickedIndex, anchorIndex]
      const rangeKeys = visibleKeys.slice(from, to + 1)
      const rangeSet = new Set(rangeKeys)
      treeAllSelected.value = false
      treeExcludedKeys.value = new Set()
      treeIncludedKeys.value = modFromKey && !snapshot.allSelected ? new Set([...snapshot.included, ...rangeSet]) : rangeSet
      if (!treeSelectionAnchorKey.value) treeSelectionAnchorKey.value = resolvedAnchorKey
      return
    }

    if (mod) {
      if (snapshot.allSelected) {
        if (clickedKey === args.treeRootKey.value) {
          treeSelectionAnchorKey.value = clickedKey
          return
        }
        const nextExcluded = new Set(snapshot.excluded)
        if (nextExcluded.has(clickedKey)) nextExcluded.delete(clickedKey)
        else nextExcluded.add(clickedKey)
        treeAllSelected.value = true
        treeExcludedKeys.value = nextExcluded
        treeIncludedKeys.value = new Set()
      } else {
        const nextIncluded = new Set(snapshot.included)
        if (nextIncluded.has(clickedKey)) nextIncluded.delete(clickedKey)
        else nextIncluded.add(clickedKey)
        treeAllSelected.value = false
        treeExcludedKeys.value = new Set()
        treeIncludedKeys.value = nextIncluded
      }
      treeSelectionAnchorKey.value = clickedKey
      return
    }
    treeAllSelected.value = false
    treeExcludedKeys.value = new Set()
    treeIncludedKeys.value = new Set([clickedKey])
    treeSelectionAnchorKey.value = clickedKey
  }

  const onTreeRowClick = (event: any) => {
    const e = event?.originalEvent as MouseEvent | undefined
    const node = event?.data
    if (!e || !node) return
    onTreeNodeClick(e, node)
  }

  const onWaterfallClick = (payload: { item: ContractFileRecord; event: MouseEvent }) => {
    const record = payload?.item
    const e = payload?.event
    if (!record || !e) return
    const id = String(record.fileId)
    if (e.ctrlKey || e.metaKey) {
      if (waterfallAllSelected.value) {
        const nextExcluded = new Set(waterfallExcludedIds.value)
        if (nextExcluded.has(id)) nextExcluded.delete(id)
        else nextExcluded.add(id)
        waterfallAllSelected.value = true
        waterfallExcludedIds.value = nextExcluded
        waterfallIncludedIds.value = new Set()
        return
      }
      const nextIncluded = new Set(waterfallIncludedIds.value)
      if (nextIncluded.has(id)) nextIncluded.delete(id)
      else nextIncluded.add(id)
      waterfallAllSelected.value = false
      waterfallExcludedIds.value = new Set()
      waterfallIncludedIds.value = nextIncluded
      return
    } else {
      waterfallAllSelected.value = false
      waterfallExcludedIds.value = new Set()
      waterfallIncludedIds.value = new Set([id])
    }
  }

  const toggleSelectAllCurrentMode = () => {
    if (args.viewMode.value === 'list') {
      const total = args.sortedListItems.value.length
      if (total <= 0) return
      if (listAllSelected.value && listExcludedIds.value.size === 0) {
        listAllSelected.value = false
        listExcludedIds.value = new Set()
        listIncludedIds.value = new Set()
        listSelectionAnchorId.value = null
        return
      }
      listAllSelected.value = true
      listExcludedIds.value = new Set()
      listIncludedIds.value = new Set()
      listSelectionAnchorId.value = null
      return
    }
    if (args.viewMode.value === 'tree') {
      const total = visibleEntryCount.value
      if (total <= 0) return
      if (treeAllSelected.value && treeExcludedKeys.value.size === 0) {
        treeAllSelected.value = false
        treeExcludedKeys.value = new Set()
        treeIncludedKeys.value = new Set()
        treeSelectionAnchorKey.value = null
        return
      }
      treeAllSelected.value = true
      treeExcludedKeys.value = new Set()
      treeIncludedKeys.value = new Set()
      treeSelectionAnchorKey.value = null
      return
    }
    const total = args.listItems.value.length
    if (total <= 0) return
    if (waterfallAllSelected.value && waterfallExcludedIds.value.size === 0) {
      waterfallAllSelected.value = false
      waterfallExcludedIds.value = new Set()
      waterfallIncludedIds.value = new Set()
      return
    }
    waterfallAllSelected.value = true
    waterfallExcludedIds.value = new Set()
    waterfallIncludedIds.value = new Set()
  }

  const getSelectedRecordsForAction = () => {
    if (args.viewMode.value === 'tree') {
      const rootKey = args.treeRootKey.value
      const selectedKeys = treeAllSelected.value
        ? getVisibleTreeKeys().filter((k) => k !== rootKey && !treeExcludedKeys.value.has(k))
        : [...treeIncludedKeys.value].filter((k) => k !== rootKey)
      const result: ContractFileRecord[] = []
      for (const k of selectedKeys) {
        const r = recordByPath.value.get(String(k))
        if (r) result.push(r)
      }
      return result
    }
    if (args.viewMode.value === 'list') {
      if (listAllSelected.value) {
        return args.sortedListItems.value.filter((r) => !listExcludedIds.value.has(String(r.fileId)))
      }
      const result: ContractFileRecord[] = []
      for (const id of listIncludedIds.value) {
        const r = recordById.value.get(String(id))
        if (r) result.push(r)
      }
      return result
    }
    if (waterfallAllSelected.value) {
      return args.listItems.value.filter((r) => !waterfallExcludedIds.value.has(String(r.fileId)))
    }
    const result: ContractFileRecord[] = []
    for (const id of waterfallIncludedIds.value) {
      const r = recordById.value.get(String(id))
      if (r) result.push(r)
    }
    return result
  }

  return {
    recordById,
    recordByPath,

    listAllSelected,
    listIncludedIds,
    listExcludedIds,
    listSelectionAnchorId,

    treeAllSelected,
    treeIncludedKeys,
    treeExcludedKeys,
    treeSelectionAnchorKey,

    waterfallAllSelected,
    waterfallIncludedIds,
    waterfallExcludedIds,

    isListSelected,
    listRowClass,
    isTreeKeySelected,
    treeRowClass,
    isWaterfallSelected,

    selectedCount,
    visibleEntryCount,
    visibleFolderCount,
    visibleFileCount,

    ensureSelectionForContext,
    onFileAreaPointerDownCapture,
    onListRowClick,
    onTreeNodeClick,
    onTreeRowClick,
    onWaterfallClick,
    getVisibleTreeKeys,
    toggleSelectAllCurrentMode,
    getSelectedRecordsForAction,
  }
}
