import { computed, ref, type ComputedRef, type Ref } from 'vue'
import type { Router } from 'vue-router'
import type { ContractFileRecord } from '../../../types/resources'
import type { ContractFilesViewMode } from './contractFilesViewTypes'
import { dirname, isEditableTarget, isModalOpen, normalizePathForCompare } from './contractFilesHelpers'
import { useContractFilesFileOps } from './useContractFilesFileOps'

export function useContractFilesActions(args: {
  router: Router
  confirm: { require: (options: any) => void }
  toast: { add: (options: any) => void }

  libraryPath: Ref<string>
  contractId: Ref<string>
  rootDir: Ref<string>
  currentListDir: Ref<string>
  viewMode: Ref<ContractFilesViewMode>
  searchQuery: Ref<string>
  items: Ref<ContractFileRecord[]>
  effectiveContractNo: ComputedRef<string>

  refresh: () => Promise<void>

  deleteProgress: Ref<{
    start: (total: number) => void
    finish: () => void
    isCancelled: Ref<boolean>
    done: Ref<number>
    failCount: Ref<number>
    currentIndex: Ref<number>
    currentName: Ref<string>
  }>

  moveProgress: Ref<{
    start: (total: number) => void
    finish: () => void
    isCancelled: Ref<boolean>
    done: Ref<number>
    failCount: Ref<number>
    currentIndex: Ref<number>
    currentName: Ref<string>
  }>

  selectedCount: ComputedRef<number>
  getSelectedRecordsForAction: () => ContractFileRecord[]
  ensureSelectionForContext: (record: ContractFileRecord | null | undefined) => void
  getVisibleTreeKeys: () => string[]

  treeAllSelected: Ref<boolean>
  treeIncludedKeys: Ref<Set<string>>
  treeExcludedKeys: Ref<Set<string>>
  treeSelectionAnchorKey: Ref<string | null>

  listAllSelected: Ref<boolean>
  listIncludedIds: Ref<Set<string>>
  listExcludedIds: Ref<Set<string>>
  listSelectionAnchorId: Ref<string | null>

  waterfallAllSelected: Ref<boolean>
  waterfallIncludedIds: Ref<Set<string>>
  waterfallExcludedIds: Ref<Set<string>>

  isListSelected: (fileId: string) => boolean
  isTreeKeySelected: (key: string) => boolean
  isWaterfallSelected: (record: ContractFileRecord) => boolean
  toggleSelectAllCurrentMode: () => void

  sortedListItems: ComputedRef<ContractFileRecord[]>
  listItems: ComputedRef<ContractFileRecord[]>
  recordById: ComputedRef<Map<string, ContractFileRecord>>
  recordByPath: ComputedRef<Map<string, ContractFileRecord>>

  fileAreaEl: Ref<HTMLElement | null>

  treeTableNodes: ComputedRef<any[]>
  treeRootKey: ComputedRef<string>
  flattenedTreeNodes: ComputedRef<any[]>
  treeExpandedKeys: Ref<Record<string, boolean>>

  toggleTreeNode: (key: string) => void
  
  fileAreaRect: Ref<DOMRect | null>
}) {
  const contextMenuSelection = ref<ContractFileRecord | null>(null)
  const contextMenuTarget = ref<{ path: string; record: ContractFileRecord | null } | null>(null)
  const treeContextMenuSelectionKey = ref<string | null>(null)
  const cm = ref<any>(null)

  const fileOps = useContractFilesFileOps({
    router: args.router,
    confirm: args.confirm,
    toast: args.toast,
    libraryPath: args.libraryPath,
    contractId: args.contractId,
    rootDir: args.rootDir,
    currentListDir: args.currentListDir,
    viewMode: args.viewMode,
    searchQuery: args.searchQuery,
    items: args.items,
    effectiveContractNo: args.effectiveContractNo,
    refresh: args.refresh,
    deleteProgress: args.deleteProgress,
    moveProgress: args.moveProgress,
    selectedCount: args.selectedCount,
    getSelectedRecordsForAction: args.getSelectedRecordsForAction,
    contextMenuTarget,
  })

  const isMacPlatform = (() => { try { return /Mac|iPhone|iPad|iPod/i.test(navigator.platform || '') } catch { return false } })()
  const modKeyLabel = isMacPlatform ? '⌘' : 'Ctrl'
  const modKeyPressed = (e: KeyboardEvent) => (isMacPlatform ? e.metaKey : e.ctrlKey)

  const shortcutTexts = {
    preview: 'Enter',
    openContainingFolder: `${modKeyLabel}+E`,
    backToRoot: 'Alt+Home',
    rename: 'F2',
    selectAll: `${modKeyLabel}+A`,
    copy: `${modKeyLabel}+D`,
    delete: 'Del',
    newFolder: `${modKeyLabel}+Shift+N`,
  } as const

  const getFirstFromSet = (set: Set<string>) => {
    for (const v of set) return v
    return ''
  }

  const singleSelectedRecord = computed(() => {
    if (args.viewMode.value === 'tree') {
      if (args.treeAllSelected.value) return null
      const rootKey = args.treeRootKey.value
      if (args.treeIncludedKeys.value.size !== 1) return null
      const key = getFirstFromSet(args.treeIncludedKeys.value)
      if (!key || key === rootKey) return null
      return args.recordByPath.value.get(String(key)) || null
    }
    if (args.viewMode.value === 'list') {
      if (args.listAllSelected.value) return null
      if (args.listIncludedIds.value.size !== 1) return null
      const id = getFirstFromSet(args.listIncludedIds.value)
      return args.recordById.value.get(String(id)) || null
    }
    if (args.waterfallAllSelected.value) return null
    if (args.waterfallIncludedIds.value.size !== 1) return null
    const id = getFirstFromSet(args.waterfallIncludedIds.value)
    return args.recordById.value.get(String(id)) || null
  })

  const hasSelectedFiles = computed(() => {
    const selectionCount = args.selectedCount.value
    if (selectionCount === 0) return false
    if (args.viewMode.value === 'list') {
      if (args.listAllSelected.value) {
        const excluded = args.listExcludedIds.value
        for (const r of args.sortedListItems.value) {
          if (r.type !== 'file') continue
          if (!excluded.has(String(r.fileId))) return true
        }
        return false
      }
      for (const id of args.listIncludedIds.value) {
        const r = args.recordById.value.get(String(id))
        if (r?.type === 'file') return true
      }
      return false
    }
    if (args.viewMode.value === 'tree') {
      if (args.treeAllSelected.value) {
        const excluded = args.treeExcludedKeys.value
        const rootKey = args.treeRootKey.value
        for (const node of args.flattenedTreeNodes.value) {
          const key = String(node?.key || '').trim()
          if (!key || key === rootKey) continue
          if (excluded.has(key)) continue
          const type = String(node?.data?.type || node?.data?.data?.type || '')
          if (type === 'file') return true
        }
        return false
      }
      const rootKey = args.treeRootKey.value
      for (const k of args.treeIncludedKeys.value) {
        if (k === rootKey) continue
        const r = args.recordByPath.value.get(String(k))
        if (r?.type === 'file') return true
      }
      return false
    }
    if (args.waterfallAllSelected.value) {
      const excluded = args.waterfallExcludedIds.value
      for (const r of args.listItems.value) {
        if (r.type !== 'file') continue
        if (!excluded.has(String(r.fileId))) return true
      }
      return false
    }
    for (const id of args.waterfallIncludedIds.value) {
      const r = args.recordById.value.get(String(id))
      if (r?.type === 'file') return true
    }
    return false
  })

  const menuState = computed(() => {
    const record = contextMenuTarget.value?.record
    const selectionCount = args.selectedCount.value
    const singleRecord = selectionCount === 1 ? (singleSelectedRecord.value || record || null) : (record || null)
    const isFile = singleRecord?.type === 'file'
    const nRoot = normalizePathForCompare(args.rootDir.value)
    const nCurrent = normalizePathForCompare(args.currentListDir.value || args.rootDir.value)
    const canBackToRoot = (args.viewMode.value === 'list' || args.viewMode.value === 'waterfall') && nRoot && nCurrent && nCurrent !== nRoot

    const previewEnabled = selectionCount === 1 && !!singleRecord && isFile
    const openContainingFolderEnabled =
      (selectionCount === 1 && (!!singleRecord || !!contextMenuTarget.value?.path)) ||
      (selectionCount === 0 && !!contextMenuTarget.value?.path)
    const copyPathEnabled = selectionCount > 0 || !!contextMenuTarget.value?.path
    const backToRootEnabled = !!canBackToRoot
    const renameEnabled = selectionCount === 1 && !!singleRecord
    const copyEnabled = selectionCount === 0 ? !!isFile : hasSelectedFiles.value
    const deleteEnabled = selectionCount === 0 ? !!singleRecord : true
    const selectedRecords = selectionCount > 0 ? args.getSelectedRecordsForAction() : []
    const moveEnabled = selectionCount > 0 && selectedRecords.every((r) => !fileOps.isDeletedRecord(r))
    const newFolderEnabled = !!args.rootDir.value && !!args.effectiveContractNo.value

    return {
      previewEnabled,
      openContainingFolderEnabled,
      copyPathEnabled,
      backToRootEnabled,
      renameEnabled,
      copyEnabled,
      deleteEnabled,
      moveEnabled,
      newFolderEnabled,
    }
  })

  const resetListDir = () => {
    if (!args.rootDir.value) return
    args.currentListDir.value = args.rootDir.value
  }

  const menuModel = computed(() => {
    const record = contextMenuTarget.value?.record
    const selectionCount = args.selectedCount.value
    const singleRecord = selectionCount === 1 ? (singleSelectedRecord.value || record || null) : (record || null)
    const isFile = singleRecord?.type === 'file'
    const previewEnabled = selectionCount === 1 && !!singleRecord && isFile
    const propertiesEnabled = selectionCount <= 1 && !!singleRecord
    const nRoot = normalizePathForCompare(args.rootDir.value)
    const nCurrent = normalizePathForCompare(args.currentListDir.value || args.rootDir.value)
    const canBackToRoot = (args.viewMode.value === 'list' || args.viewMode.value === 'waterfall') && nRoot && nCurrent && nCurrent !== nRoot
    const openContainingFolderEnabled =
      (selectionCount === 1 && (!!singleRecord || !!contextMenuTarget.value?.path)) ||
      (selectionCount === 0 && !!contextMenuTarget.value?.path)
    const copyPathEnabled = selectionCount > 0 || !!contextMenuTarget.value?.path
    const newFolderEnabled = !!args.rootDir.value && !!args.effectiveContractNo.value
    const selectedRecords = selectionCount > 0 ? args.getSelectedRecordsForAction() : []
    const allDeleted = selectionCount > 0 ? selectedRecords.every(fileOps.isDeletedRecord) : fileOps.isDeletedRecord(singleRecord)

    // 在空白处右键时的菜单（没有选中任何项目）
    if (selectionCount === 0 && !record) {
      return [
        { label: '打开所在文件夹', icon: 'pi pi-folder-open', disabled: !openContainingFolderEnabled, shortcut: shortcutTexts.openContainingFolder, command: () => void fileOps.openContainingFolder() },
        { label: '复制路径', icon: 'pi pi-copy', disabled: !copyPathEnabled, command: () => void fileOps.copyPath() },
        { separator: true },
        { label: '返回根目录', icon: 'pi pi-home', disabled: !canBackToRoot, shortcut: shortcutTexts.backToRoot, command: () => void resetListDir() },
        { separator: true },
        { label: '新增文件夹', icon: 'pi pi-plus', disabled: !newFolderEnabled, shortcut: shortcutTexts.newFolder, command: () => void fileOps.createFolder() },
        { label: '从磁盘同步', icon: 'pi pi-refresh', disabled: !args.rootDir.value || !args.effectiveContractNo.value, command: () => void args.refresh() },
      ]
    }

    const trashActions = allDeleted
      ? [
          { label: selectionCount > 1 ? `还原选中(${selectionCount})` : '还原', icon: 'pi pi-replay', disabled: selectionCount === 0 ? !singleRecord : false, command: () => void (selectionCount > 1 ? fileOps.restoreSelected() : fileOps.restoreFile()) },
          { label: selectionCount > 1 ? `彻底删除(${selectionCount})` : '彻底删除', icon: 'pi pi-times-circle', class: 'text-red-600', disabled: selectionCount === 0 ? !singleRecord : false, command: () => void (selectionCount > 1 ? fileOps.purgeSelected() : fileOps.purgeFile()) },
        ]
      : [
          { label: selectionCount > 1 ? `移入回收站(${selectionCount})` : '移入回收站', icon: 'pi pi-trash', class: 'text-red-600', disabled: selectionCount === 0 ? !singleRecord : false, shortcut: shortcutTexts.delete, command: () => void (selectionCount > 1 ? fileOps.deleteSelected() : fileOps.deleteFile()) },
        ]

    return [
      { label: '预览', icon: 'pi pi-eye', disabled: !previewEnabled, shortcut: shortcutTexts.preview, command: () => void fileOps.previewFile() },
      { label: '打开文件', icon: 'pi pi-file', disabled: selectionCount !== 1 || !isFile, command: () => void fileOps.openFile() },
      { label: '打开所在文件夹', icon: 'pi pi-folder-open', disabled: !openContainingFolderEnabled, shortcut: shortcutTexts.openContainingFolder, command: () => void fileOps.openContainingFolder() },
      { label: selectionCount > 1 ? `复制路径(${selectionCount})` : '复制路径', icon: 'pi pi-copy', disabled: !copyPathEnabled, command: () => void fileOps.copyPath() },
      { label: '属性', icon: 'pi pi-info-circle', disabled: !propertiesEnabled, command: () => singleRecord && fileOps.openPropertiesDialog(singleRecord) },
      { separator: true },
      { label: '返回根目录', icon: 'pi pi-home', disabled: !canBackToRoot, shortcut: shortcutTexts.backToRoot, command: () => void resetListDir() },
      { label: '重命名', icon: 'pi pi-pencil', disabled: selectionCount !== 1 || !singleRecord, shortcut: shortcutTexts.rename, command: () => void fileOps.renameEntry() },
      {
        label: '移动',
        icon: 'pi pi-directions-alt',
        disabled: !(selectionCount > 0 && selectedRecords.every((r) => !fileOps.isDeletedRecord(r))),
        items: [
          { label: '同项目文件夹', icon: 'pi pi-folder', command: () => void fileOps.openMoveDialog('same-folder') },
          { label: '其他合同', icon: 'pi pi-briefcase', command: () => void fileOps.openMoveDialog('other-contract') },
        ],
      },
      { label: selectionCount > 1 ? `复制选中(${selectionCount})` : '复制文件', icon: 'pi pi-copy', disabled: selectionCount === 0 ? !isFile : !hasSelectedFiles.value, shortcut: shortcutTexts.copy, command: () => void (selectionCount > 1 ? fileOps.copySelected() : fileOps.copyFile()) },
      ...trashActions,
      { separator: true },
      { label: '新增文件夹', icon: 'pi pi-plus', disabled: !newFolderEnabled, shortcut: shortcutTexts.newFolder, command: () => void fileOps.createFolder() },
    ]
  })

  const findTreeNodeByKey = (key: string) => {
    const target = String(key || '').trim()
    if (!target) return null
    const stack: any[] = Array.isArray(args.treeTableNodes.value) ? [...(args.treeTableNodes.value as any[])] : []
    while (stack.length > 0) {
      const node = stack.shift()
      if (!node) continue
      if (String(node.key || '').trim() === target) return node
      if (Array.isArray(node.children) && node.children.length) {
        stack.unshift(...node.children)
      }
    }
    return null
  }

  const ensureContextMenuTargetForKeyboard = () => {
    const selectionCount = args.selectedCount.value
    if (selectionCount === 1) {
      const record = singleSelectedRecord.value || contextMenuTarget.value?.record
      if (record) {
        contextMenuTarget.value = { path: String(record?.path || ''), record: record || null }
        return
      }
    }
    if (args.viewMode.value === 'tree') {
      const explicitKey = String(treeContextMenuSelectionKey.value || '').trim()
      const anchorKey = String(args.treeSelectionAnchorKey.value || '').trim()
      let key = ''
      if (explicitKey) key = explicitKey
      else if (anchorKey && args.isTreeKeySelected(anchorKey)) key = anchorKey
      else if (!args.treeAllSelected.value) {
        const candidate = getFirstFromSet(args.treeIncludedKeys.value)
        key = candidate
      } else {
        const rootKey = args.treeRootKey.value
        const excluded = args.treeExcludedKeys.value
        for (const k of args.getVisibleTreeKeys()) {
          if (!k || k === rootKey) continue
          if (excluded.has(k)) continue
          key = k
          break
        }
      }
      if (key) {
        const node = findTreeNodeByKey(key)
        const path = String(node?.data?.path || '')
        const record = (node?.data?.record as ContractFileRecord | null) || args.recordByPath.value.get(key) || null
        contextMenuTarget.value = { path: path || String(args.rootDir.value || ''), record }
        return
      }
    }
    const fallbackPath =
      (args.viewMode.value === 'list' || args.viewMode.value === 'waterfall')
        ? (args.currentListDir.value || args.rootDir.value)
        : args.rootDir.value
    contextMenuTarget.value = { path: fallbackPath, record: null }
  }

  const onFileAreaMouseDown = () => {
    if (!args.fileAreaEl.value) return
    try {
      args.fileAreaEl.value.focus({ preventScroll: true } as any)
    } catch {
      args.fileAreaEl.value.focus()
    }
  }

  const internalDragOutActive = ref(false)

  const beginDragOutFromRecord = (e: DragEvent, record: ContractFileRecord) => {
    if (!args.libraryPath.value || !args.contractId.value) return
    if (!record?.fileId) return

    const fileId = String(record.fileId || '').trim()
    if (!fileId) return

    const useSelection = (() => {
      if (args.viewMode.value === 'tree') return args.isTreeKeySelected(normalizePathForCompare(record.path))
      if (args.viewMode.value === 'list') return args.isListSelected(fileId)
      return args.isWaterfallSelected(record)
    })()

    const records = useSelection ? args.getSelectedRecordsForAction() : [record]
    const fileIds: string[] = []
    const seen = new Set<string>()
    for (const r of records) {
      const id = String(r?.fileId || '').trim()
      if (!id || seen.has(id)) continue
      seen.add(id)
      fileIds.push(id)
    }
    if (fileIds.length === 0) return

    internalDragOutActive.value = true
    e.preventDefault()
    if (e.dataTransfer) e.dataTransfer.effectAllowed = 'copy'

    const promise = window.electronAPI.contractFiles.startDragOut({
      libraryPath: args.libraryPath.value,
      contractId: args.contractId.value,
      fileIds,
    })

    void promise.then((res) => {
      if (!res.success) internalDragOutActive.value = false
      if (!res.success) {
        args.toast.add({ severity: 'error', summary: '拖拽失败', detail: res.error || '无法拖拽导出', life: 3000 })
        return
      }
      if (res.data?.mode === 'fallback-folder') {
        args.toast.add({ severity: 'warn', summary: '已降级为文件夹拖拽', detail: '受运行时限制，多文件将以临时文件夹形式拖出', life: 3500 })
      }
    })
  }

  const onTreeDragStart = (e: DragEvent, record: ContractFileRecord) => {
    if (!record) return
    beginDragOutFromRecord(e, record)
  }

  const onFileAreaDragStart = async (e: DragEvent) => {
    if (e.defaultPrevented) return
    if (!args.libraryPath.value || !args.contractId.value) return
    const target = e.target as HTMLElement | null
    if (!target) return
    const el = target.closest('[data-contract-file-id]') as HTMLElement | null
    const fileId = String(el?.getAttribute('data-contract-file-id') || '').trim()
    if (!fileId) return
    const record = args.recordById.value.get(fileId)
    if (!record) return
    beginDragOutFromRecord(e, record)
  }

  const onFileAreaDragEnd = (e: DragEvent) => {
    internalDragOutActive.value = false
    e.preventDefault()
  }

  const onFileAreaKeydown = (e: KeyboardEvent) => {
    if (e.defaultPrevented) return
    if (isEditableTarget(e.target) || isModalOpen()) return

    const key = String(e.key || '')
    const lower = key.toLowerCase()
    const mod = modKeyPressed(e)
    const state = menuState.value
    const selectionCount = args.selectedCount.value

    if (mod && !e.shiftKey && !e.altKey && lower === 'a') {
      e.preventDefault()
      args.toggleSelectAllCurrentMode()
      return
    }

    if (key === 'Enter' && !mod && !e.shiftKey && !e.altKey) {
      if (!state.previewEnabled) return
      e.preventDefault()
      ensureContextMenuTargetForKeyboard()
      void fileOps.previewFile()
      return
    }

    if (mod && !e.shiftKey && !e.altKey && lower === 'e') {
      if (!state.openContainingFolderEnabled) return
      e.preventDefault()
      ensureContextMenuTargetForKeyboard()
      void fileOps.openContainingFolder()
      return
    }

    if (e.altKey && !mod && !e.shiftKey && key === 'Home') {
      if (!state.backToRootEnabled) return
      e.preventDefault()
      void resetListDir()
      return
    }

    if (!mod && !e.shiftKey && !e.altKey && key === 'F2') {
      if (!state.renameEnabled) return
      e.preventDefault()
      ensureContextMenuTargetForKeyboard()
      void fileOps.renameEntry()
      return
    }

    if (mod && !e.shiftKey && !e.altKey && lower === 'd') {
      if (!state.copyEnabled) return
      e.preventDefault()
      ensureContextMenuTargetForKeyboard()
      if (selectionCount > 1) void fileOps.copySelected()
      else void fileOps.copyFile()
      return
    }

    if (!mod && !e.shiftKey && !e.altKey && key === 'Delete') {
      if (!state.deleteEnabled) return
      e.preventDefault()
      ensureContextMenuTargetForKeyboard()
      if (selectionCount > 1) void fileOps.deleteSelected()
      else void fileOps.deleteFile()
      return
    }

    if (mod && e.shiftKey && !e.altKey && lower === 'n') {
      if (!state.newFolderEnabled) return
      e.preventDefault()
      ensureContextMenuTargetForKeyboard()
      void fileOps.createFolder()
      return
    }
  }

  const isFileAreaFocused = () => {
    const el = args.fileAreaEl.value
    if (!el) return false
    const active = document.activeElement as HTMLElement | null
    if (!active) return false
    return active === el || el.contains(active)
  }

  const onGlobalKeydownCapture = (e: KeyboardEvent) => {
    if (!isFileAreaFocused()) return
    onFileAreaKeydown(e)
  }

  const onRowContextMenu = (event: any) => {
    if (args.viewMode.value === 'list') {
      const record = event?.data as ContractFileRecord | undefined
      args.ensureSelectionForContext(record)
    }
    contextMenuSelection.value = event.data
    contextMenuTarget.value = { path: event.data?.path || '', record: event.data || null }
    cm.value?.show?.(event.originalEvent)
  }

  const openTreeContextMenu = (event: MouseEvent, node: any) => {
    const record = (node?.data?.record as ContractFileRecord | null) || null
    const key = String(node?.key || (record ? normalizePathForCompare(record.path) : '')).trim()
    if (args.viewMode.value === 'tree' && key && !args.isTreeKeySelected(key)) {
      args.treeAllSelected.value = false
      args.treeExcludedKeys.value = new Set()
      args.treeIncludedKeys.value = new Set([key])
      args.treeSelectionAnchorKey.value = key
    }
    if (key) treeContextMenuSelectionKey.value = key
    contextMenuTarget.value = { path: String(node?.data?.path || record?.path || ''), record }
    cm.value?.show?.(event)
  }

  const onTreeRowContextMenu = (event: any) => {
    const e = event?.originalEvent as MouseEvent | undefined
    const node = event?.data
    if (!e || !node) return
    openTreeContextMenu(e, node)
  }

  const onBlankContextMenu = (event: MouseEvent) => {
    // 在空白处右键时，设置 contextMenuTarget 为当前目录
    const fallbackPath = (args.viewMode.value === 'list' || args.viewMode.value === 'waterfall') 
      ? (args.currentListDir.value || args.rootDir.value) 
      : args.rootDir.value
    contextMenuTarget.value = { path: fallbackPath, record: null }
    cm.value?.show?.(event)
  }

  const onFileAreaContextMenu = (event: MouseEvent) => {
    // 检查是否点击在空白区域
    const target = event.target as HTMLElement | null
    const isOnItem = target?.closest('[data-contract-file-id], .p-datatable-tbody > tr, .p-treetable-tbody > tr')
    
    if (!isOnItem) {
      // 空白处右键，显示上下文菜单
      onBlankContextMenu(event)
    }
  }

  const onWaterfallContextMenu = (payload: { item: ContractFileRecord; event: MouseEvent }) => {
    const record = payload?.item
    args.ensureSelectionForContext(record)
    contextMenuTarget.value = { path: String(record?.path || ''), record: record || null }
    cm.value?.show?.(payload.event)
  }

  const onListRowDblclick = async (event: any) => {
    const record = event?.data as ContractFileRecord | undefined
    if (!record) return
    if (record.type === 'file') {
      await fileOps.previewRecord(record)
      return
    }
    if (record.type === 'folder') {
      if (args.searchQuery.value.trim()) {
        args.searchQuery.value = ''
      }
      await fileOps.enterFolder(record.path)
    }
  }

  const onTreeNodeDblclick = async (node: any) => {
    const type = String(node?.data?.type || '')
    if (type !== 'file') return
    const record =
      (node?.data?.record as ContractFileRecord | null) ||
      args.recordByPath.value.get(String(node?.key || '')) ||
      args.recordByPath.value.get(String(node?.data?.path || '')) ||
      null
    if (record) {
      await fileOps.previewRecord(record)
      return
    }
    const path = String(node?.data?.path || '')
    if (!path) return
    await args.router.push({
      name: 'ContractFilesPreview',
      params: { contractId: args.contractId.value },
      query: {
        path,
        name: String(node?.data?.name || node?.data?.label || ''),
        fileId: String(node?.data?.fileId || ''),
      },
    })
  }

  const onTreeRowDblclick = async (event: any) => {
    const node = event?.data
    if (!node) return
    await onTreeNodeDblclick(node)
  }

  return {
    cm,
    menuModel,
    menuState,
    onRowContextMenu,
    onTreeRowContextMenu,
    openTreeContextMenu,
    onBlankContextMenu,
    onFileAreaContextMenu,
    onWaterfallContextMenu,
    onListRowDblclick,
    onTreeRowDblclick,
    onTreeDragStart,
    onFileAreaDragStart,
    onFileAreaDragEnd,
    onFileAreaKeydown,
    onGlobalKeydownCapture,
    onFileAreaMouseDown,
    contextMenuSelection,
    contextMenuTarget,
    treeContextMenuSelectionKey,
    shortcutTexts,
    internalDragOutActive,
    resetListDir,
    ...fileOps,
  }
}
