import { ref, type ComputedRef, type Ref } from 'vue'
import type { Router } from 'vue-router'
import type { ContractFileRecord } from '../../../types/resources'
import type { ContractFilesViewMode } from './contractFilesViewTypes'
import { copyTextToClipboard, dirname, joinPath, normalizePathForCompare } from './contractFilesHelpers'
import type { ContractInfoEntity } from '../../../../shared/types/contractInfo.types'
import type { ContractFileMoveConflictStrategy } from '../../../../shared/types/contractFile.types'

export function useContractFilesFileOps(args: {
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

  contextMenuTarget: Ref<{ path: string; record: ContractFileRecord | null } | null>
}) {
  const isDeletedRecord = (record: ContractFileRecord | null | undefined) => !!String(record?.deletedAt || '').trim()

  const openFile = async () => {
    const selected = args.getSelectedRecordsForAction()
    const record = selected.length === 1 ? selected[0] : args.contextMenuTarget.value?.record
    if (!record || record.type !== 'file') return
    const openPath = isDeletedRecord(record) ? (String(record.trashPath || '').trim() || record.path) : record.path
    const res = await window.electronAPI.fs.openFile(openPath)
    if (!res.success) {
      args.toast.add({ severity: 'error', summary: '打开失败', detail: res.error || '打开文件失败', life: 3000 })
    }
  }

  const previewRecord = async (record: ContractFileRecord) => {
    if (!record || record.type !== 'file') return
    const path = isDeletedRecord(record) ? String(record.trashPath || record.path || '') : String(record.path || '')
    if (!path) return
    await args.router.push({
      name: 'ContractFilesPreview',
      params: { contractId: args.contractId.value },
      query: {
        path,
        name: String(record.name || ''),
        fileId: String(record.fileId || ''),
      },
    })
  }

  const previewFile = async () => {
    const selected = args.getSelectedRecordsForAction()
    if (selected.length !== 1) return
    await previewRecord(selected[0])
  }

  const openContainingFolder = async () => {
    const selected = args.getSelectedRecordsForAction()
    const record = selected.length === 1 ? selected[0] : args.contextMenuTarget.value?.record
    const openPath = record
      ? (isDeletedRecord(record) ? (String(record.trashPath || '').trim() || record.path) : record.path)
      : String(args.contextMenuTarget.value?.path || '')
    const folderPath = record ? (record.type === 'file' ? dirname(openPath) : openPath) : openPath
    if (!folderPath) return
    const res = await window.electronAPI.fs.openFolder(folderPath)
    if (!res.success) {
      args.toast.add({ severity: 'error', summary: '打开失败', detail: res.error || '打开文件夹失败', life: 3000 })
    }
  }

  const copyPath = async () => {
    const selected = args.getSelectedRecordsForAction()
    const paths = selected.length > 0
      ? selected.map((r) => String(r?.path || '')).filter(Boolean)
      : [String(args.contextMenuTarget.value?.path || '')].filter(Boolean)
    if (paths.length === 0) return
    const ok = await copyTextToClipboard(paths.join('\n'))
    if (!ok) {
      args.toast.add({ severity: 'error', summary: '复制失败', detail: '未能写入剪贴板', life: 2500 })
      return
    }
    args.toast.add({ severity: 'success', summary: '已复制路径', detail: paths.length > 1 ? `共 ${paths.length} 条` : paths[0], life: 2000 })
  }

  const enterFolder = async (folderPath: string) => {
    const root = normalizePathForCompare(args.rootDir.value)
    const target = normalizePathForCompare(folderPath)
    if (!root || !target || !target.startsWith(root)) return
    args.currentListDir.value = folderPath
  }

  const openEntryFromWaterfall = async (record: ContractFileRecord) => {
    if (!record) return
    if (record.type === 'folder') {
      if (args.searchQuery.value.trim()) {
        args.searchQuery.value = ''
      }
      await enterFolder(record.path)
      return
    }
    if (record.type === 'file') {
      await previewRecord(record)
    }
  }

  const retryGenerateThumbnail = async (record: ContractFileRecord) => {
    if (!record || record.type !== 'file') return
    if (!args.libraryPath.value) return

    const target = args.items.value.find((it) => it.fileId === record.fileId)
    if (target) {
      target.firstPageThumb = null
      target.previewStatus = 'pending'
    }

    try {
      await window.electronAPI.contractFiles.updateThumbnail({
        libraryPath: args.libraryPath.value,
        fileId: record.fileId,
        firstPageThumb: null,
        previewStatus: 'pending',
      })
    } catch {
    }
  }

  const copyFile = async () => {
    const selected = args.getSelectedRecordsForAction()
    const record = selected.length === 1 ? selected[0] : args.contextMenuTarget.value?.record
    if (!record || record.type !== 'file') return
    const res = await window.electronAPI.contractFiles.copy({ libraryPath: args.libraryPath.value, fileId: record.fileId })
    if (!res.success) {
      args.toast.add({ severity: 'error', summary: '复制失败', detail: res.error || '复制文件失败', life: 3000 })
      return
    }
    args.toast.add({ severity: 'success', summary: '复制成功', detail: '已创建副本', life: 2000 })
    await args.refresh()
  }

  const copySelected = async () => {
    const selected = args.getSelectedRecordsForAction().filter((r) => r.type === 'file')
    if (selected.length === 0) return
    let okCount = 0
    let failCount = 0
    for (const r of selected) {
      const res = await window.electronAPI.contractFiles.copy({ libraryPath: args.libraryPath.value, fileId: r.fileId })
      if (res.success) okCount += 1
      else failCount += 1
    }
    if (okCount > 0) {
      args.toast.add({ severity: 'success', summary: '复制完成', detail: `成功 ${okCount}${failCount ? `，失败 ${failCount}` : ''}`, life: 2500 })
    } else {
      args.toast.add({ severity: 'error', summary: '复制失败', detail: '未能复制选中文件', life: 3000 })
    }
    await args.refresh()
  }

  const renameDialogVisible = ref(false)
  const renameDialogSubmitting = ref(false)
  const renameDialogRecord = ref<ContractFileRecord | null>(null)
  const renameDialogError = ref('')

  const closeRenameDialog = () => {
    renameDialogVisible.value = false
    renameDialogSubmitting.value = false
    renameDialogRecord.value = null
    renameDialogError.value = ''
  }

  const openRenameDialog = (record: ContractFileRecord) => {
    renameDialogRecord.value = record
    renameDialogSubmitting.value = false
    renameDialogError.value = ''
    renameDialogVisible.value = true
  }

  const confirmRename = async (newName: string) => {
    const record = renameDialogRecord.value
    if (!record) return
    if (renameDialogSubmitting.value) return
    renameDialogSubmitting.value = true
    renameDialogError.value = ''
    try {
      const res = await window.electronAPI.contractFiles.rename({
        libraryPath: args.libraryPath.value,
        fileId: record.fileId,
        newName: String(newName || '').trim(),
      })
      if (!res.success) {
        renameDialogError.value = res.error || '重命名失败'
        return
      }
      closeRenameDialog()
      args.toast.add({ severity: 'success', summary: '重命名成功', detail: newName, life: 2000 })
      await args.refresh()
    } finally {
      renameDialogSubmitting.value = false
    }
  }

  const createFolderDialogVisible = ref(false)
  const createFolderDialogSubmitting = ref(false)
  const createFolderDialogParentPath = ref('')
  const createFolderDialogError = ref('')

  const closeCreateFolderDialog = () => {
    createFolderDialogVisible.value = false
    createFolderDialogSubmitting.value = false
    createFolderDialogParentPath.value = ''
    createFolderDialogError.value = ''
  }

  const openCreateFolderDialog = (parentPath: string) => {
    createFolderDialogParentPath.value = String(parentPath || '').trim()
    createFolderDialogSubmitting.value = false
    createFolderDialogError.value = ''
    createFolderDialogVisible.value = true
  }

  const confirmCreateFolder = async (folderName: string) => {
    if (createFolderDialogSubmitting.value) return
    const parentPath = String(createFolderDialogParentPath.value || '').trim()
    if (!parentPath) return
    const contractNoValue = args.effectiveContractNo.value
    if (!contractNoValue) {
      createFolderDialogError.value = '合同编号为空，无法创建文件夹'
      return
    }
    createFolderDialogSubmitting.value = true
    createFolderDialogError.value = ''
    try {
      const res = await window.electronAPI.contractFiles.createFolder({
        libraryPath: args.libraryPath.value,
        contractId: args.contractId.value,
        contractNo: contractNoValue,
        parentPath,
        folderName: String(folderName || '').trim(),
      })
      if (!res.success) {
        createFolderDialogError.value = res.error || '创建文件夹失败'
        return
      }
      closeCreateFolderDialog()
      args.toast.add({ severity: 'success', summary: '创建成功', detail: folderName, life: 2000 })
      await args.refresh()
    } finally {
      createFolderDialogSubmitting.value = false
    }
  }

  const propertiesDialogVisible = ref(false)
  const propertiesDialogRecord = ref<ContractFileRecord | null>(null)

  const openPropertiesDialog = (record: ContractFileRecord) => {
    propertiesDialogRecord.value = record
    propertiesDialogVisible.value = true
  }

  const renameEntry = async () => {
    const selected = args.getSelectedRecordsForAction()
    if (selected.length !== 1) {
      args.toast.add({ severity: 'warn', summary: '只能单选', detail: '重命名只能对单个文件/文件夹进行操作', life: 2500 })
      return
    }
    const record = selected[0]
    if (!record) return
    openRenameDialog(record)
  }

  const restoreRecords = async (records: ContractFileRecord[]) => {
    if (!args.libraryPath.value) return
    const targets = (records || []).filter(isDeletedRecord)
    if (!targets.length) {
      args.toast.add({ severity: 'warn', summary: '无法还原', detail: '未选择回收站中的文件', life: 2500 })
      return
    }
    const renamedItems: Array<{ from: string; to: string; restored: string }> = []
    const normalize = (p: string) => String(p || '').replace(/\\\\/g, '/')
    const getBasename = (p: string) => normalize(p).split('/').pop() || ''
    const getDisplayPath = (absPath: string) => {
      const root = normalize(args.rootDir.value)
      const target = normalize(absPath)
      if (root && target.startsWith(root + '/')) {
        return target.slice(root.length + 1)
      }
      return getBasename(absPath)
    }
    let okCount = 0
    let failCount = 0
    for (const r of targets) {
      const res = await window.electronAPI.contractFiles.restore({ libraryPath: args.libraryPath.value, fileId: r.fileId })
      if (res.success) {
        okCount += 1
        if (res.data?.renamed) {
          const from = getBasename(res.data.originalPath)
          const to = getBasename(res.data.restoredPath)
          if (from && to && from !== to) {
            renamedItems.push({ from, to, restored: getDisplayPath(res.data.restoredPath) })
          }
        }
      } else {
        failCount += 1
      }
    }
    if (okCount > 0) {
      args.toast.add({
        severity: failCount ? 'warn' : 'success',
        summary: '还原完成',
        detail: `成功 ${okCount}${failCount ? `，失败 ${failCount}` : ''}`,
        life: 2500,
      })
      if (renamedItems.length > 0) {
        const preview = renamedItems.slice(0, 3).map(it => `${it.from} → ${it.to}（${it.restored}）`).join('；')
        args.toast.add({
          severity: 'info',
          summary: '已自动重命名',
          detail: renamedItems.length > 3 ? `${preview} 等 ${renamedItems.length} 项` : preview,
          life: 3500,
        })
      }
    } else {
      args.toast.add({ severity: 'error', summary: '还原失败', detail: '未能还原选中项', life: 3000 })
    }
    await args.refresh()
  }

  const restoreFile = async () => {
    const selected = args.getSelectedRecordsForAction()
    const record = selected.length === 1 ? selected[0] : args.contextMenuTarget.value?.record
    if (!record || !isDeletedRecord(record)) return
    await restoreRecords([record])
  }

  const restoreSelected = async () => {
    const selected = args.getSelectedRecordsForAction()
    await restoreRecords(selected)
  }

  const purgeRecords = async (records: ContractFileRecord[]) => {
    if (!args.libraryPath.value) return
    const targets = (records || []).filter(isDeletedRecord)
    if (!targets.length) {
      args.toast.add({ severity: 'warn', summary: '无法彻底删除', detail: '未选择回收站中的文件', life: 2500 })
      return
    }
    let okCount = 0
    let failCount = 0
    args.deleteProgress.value.start(targets.length, `彻底删除操作（${targets.length}个）`)
    try {
      for (let i = 0; i < targets.length; i++) {
        if (args.deleteProgress.value.isCancelled.value) break
        const r = targets[i]
        const current = okCount + failCount + 1
        const name = String(r?.name || '')
        args.deleteProgress.value.currentIndex.value = current
        args.deleteProgress.value.currentName.value = name
        await new Promise<void>((resolve) => window.setTimeout(() => resolve(), 0))
        let res: { success: boolean; error?: string } | null = null
        try {
          res = await Promise.race([
            window.electronAPI.contractFiles.purge({ libraryPath: args.libraryPath.value, fileId: r.fileId }),
            new Promise<{ success: false; error: string }>((resolve) => {
              window.setTimeout(() => resolve({ success: false, error: '彻底删除超时，请稍后重试' }), 20000)
            }),
          ])
        } catch (error) {
          res = { success: false, error: error instanceof Error ? error.message : '彻底删除失败' }
        }
        if (res?.success) okCount += 1
        else failCount += 1
        args.deleteProgress.value.done.value = okCount + failCount
      }
    } finally {
      args.deleteProgress.value.failCount.value = failCount
      args.deleteProgress.value.finish()
    }
    if (okCount > 0) {
      const isCancelled = args.deleteProgress.value.isCancelled.value
      args.toast.add({
        severity: isCancelled ? 'warn' : 'success',
        summary: isCancelled ? '彻底删除已取消' : '彻底删除完成',
        detail: `成功 ${okCount}${failCount ? `，失败 ${failCount}` : ''}`,
        life: 2500,
      })
    } else {
      const isCancelled = args.deleteProgress.value.isCancelled.value
      if (!isCancelled) {
        args.toast.add({ severity: 'error', summary: '彻底删除失败', detail: '未能删除选中项', life: 3000 })
      }
    }
    await args.refresh()
  }

  const purgeFile = async () => {
    const selected = args.getSelectedRecordsForAction()
    const record = selected.length === 1 ? selected[0] : args.contextMenuTarget.value?.record
    if (!record || !isDeletedRecord(record)) return
    args.confirm.require({
      message: record.type === 'folder' ? '确认彻底删除该文件夹？此操作不可恢复。' : '确认彻底删除该文件？此操作不可恢复。',
      header: '彻底删除确认',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: '是',
      rejectLabel: '否',
      accept: async () => {
        await purgeRecords([record])
      },
    })
  }

  const purgeSelected = async () => {
    const selected = args.getSelectedRecordsForAction().filter(isDeletedRecord)
    if (!selected.length) return
    args.confirm.require({
      message: `确认彻底删除选中的 ${selected.length} 项？此操作不可恢复。`,
      header: '彻底删除确认',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: '是',
      rejectLabel: '否',
      accept: async () => {
        await purgeRecords(selected)
      },
    })
  }

  const deleteFile = async () => {
    const selected = args.getSelectedRecordsForAction()
    const record = selected.length === 1 ? selected[0] : args.contextMenuTarget.value?.record
    if (!record) return
    if (isDeletedRecord(record)) {
      await purgeFile()
      return
    }
    args.confirm.require({
      message: record.type === 'folder' ? '确认将该文件夹移入回收站？' : '确认将该文件移入回收站？',
      header: '移入回收站确认',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: '是',
      rejectLabel: '否',
      accept: async () => {
        args.deleteProgress.value.start(1)
        args.deleteProgress.value.currentIndex.value = 1
        args.deleteProgress.value.currentName.value = String(record.name || '')
        try {
          const res = await window.electronAPI.contractFiles.delete({ libraryPath: args.libraryPath.value, fileId: record.fileId })
          if (!res.success) {
            args.deleteProgress.value.done.value = 1
            args.deleteProgress.value.failCount.value = 1
            args.toast.add({ severity: 'error', summary: '移入回收站失败', detail: res.error || '移入回收站失败', life: 3000 })
            return
          }
          args.deleteProgress.value.done.value = 1
          args.deleteProgress.value.failCount.value = 0
          args.toast.add({ severity: 'success', summary: '已移入回收站', detail: '', life: 2000 })
          await args.refresh()
        } catch (error) {
          args.deleteProgress.value.done.value = 1
          args.deleteProgress.value.failCount.value = 1
          args.toast.add({ severity: 'error', summary: '移入回收站失败', detail: error instanceof Error ? error.message : '移入回收站失败', life: 3000 })
        } finally {
          args.deleteProgress.value.finish()
        }
      },
    })
  }

  const deleteSelected = async () => {
    const selected = args.getSelectedRecordsForAction()
    if (selected.length === 0) return
    const notDeleted = selected.filter((r) => !isDeletedRecord(r))
    if (notDeleted.length === 0) {
      await purgeSelected()
      return
    }
    args.confirm.require({
      message: `确认将选中的 ${notDeleted.length} 项移入回收站？`,
      header: '移入回收站确认',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: '是',
      rejectLabel: '否',
      accept: async () => {
        let okCount = 0
        let failCount = 0
        args.deleteProgress.value.start(notDeleted.length)
        try {
          for (const r of notDeleted) {
            if (args.deleteProgress.value.isCancelled.value) break
            const current = okCount + failCount + 1
            const name = String(r?.name || '')
            args.deleteProgress.value.currentIndex.value = current
            args.deleteProgress.value.currentName.value = name
            await new Promise<void>((resolve) => {
              window.setTimeout(() => resolve(), 0)
            })
            let res: { success: boolean; error?: string } | null = null
            try {
              res = await Promise.race([
                window.electronAPI.contractFiles.delete({ libraryPath: args.libraryPath.value, fileId: r.fileId }),
                new Promise<{ success: false; error: string }>((resolve) => {
                  window.setTimeout(() => resolve({ success: false, error: '移入回收站超时，请稍后重试' }), 20000)
                }),
              ])
            } catch (error) {
              res = { success: false, error: error instanceof Error ? error.message : '移入回收站失败' }
            }
            if (res?.success) okCount += 1
            else failCount += 1
            args.deleteProgress.value.done.value = okCount + failCount
          }
        } finally {
          args.deleteProgress.value.failCount.value = failCount
          args.deleteProgress.value.finish()
        }

        if (okCount > 0) {
          const isCancelled = args.deleteProgress.value.isCancelled.value
          args.toast.add({
            severity: isCancelled ? 'warn' : 'success',
            summary: isCancelled ? '移入回收站已取消' : '移入回收站完成',
            detail: `成功 ${okCount}${failCount ? `，失败 ${failCount}` : ''}`,
            life: 2500,
          })
        } else {
          const isCancelled = args.deleteProgress.value.isCancelled.value
          if (!isCancelled) {
            args.toast.add({ severity: 'error', summary: '移入回收站失败', detail: '未能移入回收站', life: 3000 })
          }
        }
        await args.refresh()
      },
    })
  }

  const createFolder = async () => {
    const record = args.contextMenuTarget.value?.record
    const targetPath = record
      ? (record.type === 'folder' ? record.path : dirname(record.path))
      : (args.contextMenuTarget.value?.path || ((args.viewMode.value === 'list' || args.viewMode.value === 'waterfall') ? (args.currentListDir.value || args.rootDir.value) : args.rootDir.value))
    if (!targetPath) return
    openCreateFolderDialog(targetPath)
  }

  const moveDialogVisible = ref(false)
  const moveDialogSubmitting = ref(false)
  const moveDialogMode = ref<'same-folder' | 'other-contract'>('same-folder')
  const moveDialogError = ref('')
  const moveContractOptions = ref<Array<{ label: string; value: string }>>([])
  const moveTargetContractId = ref('')
  const moveFolderOptions = ref<Array<{ label: string; value: string }>>([])
  const moveFolderTreeOptions = ref<any[]>([])
  const moveTargetDirPath = ref('')
  const moveConflictStrategy = ref<ContractFileMoveConflictStrategy>('rename')

  const closeMoveDialog = () => {
    moveDialogVisible.value = false
    moveDialogSubmitting.value = false
    moveDialogError.value = ''
    moveContractOptions.value = []
    moveTargetContractId.value = ''
    moveFolderOptions.value = []
    moveFolderTreeOptions.value = []
    moveTargetDirPath.value = ''
    moveConflictStrategy.value = 'rename'
  }

  const parseContractExtData = (raw: unknown): Record<string, unknown> | null => {
    if (!raw) return null
    if (typeof raw === 'object' && raw !== null) return raw as Record<string, unknown>
    if (typeof raw !== 'string') return null
    const text = raw.trim()
    if (!text) return null
    try {
      const parsed = JSON.parse(text)
      return typeof parsed === 'object' && parsed !== null ? (parsed as Record<string, unknown>) : null
    } catch {
      return null
    }
  }

  const toFolderOptions = (root: string, records: ContractFileRecord[]) => {
    const nRoot = normalizePathForCompare(root)
    const map = new Map<string, string>()
    if (root) map.set(nRoot, '[根目录] documents')
    for (const r of records) {
      if (!r || r.type !== 'folder') continue
      if (isDeletedRecord(r)) continue
      const p = String(r.path || '').trim()
      const n = normalizePathForCompare(p)
      if (!p || !nRoot || !n || !n.startsWith(nRoot)) continue
      const rel = n === nRoot ? 'documents' : `documents/${n.slice(nRoot.length + 1)}`
      map.set(n, rel)
    }
    return Array.from(map.entries())
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label, 'zh-CN', { numeric: true, sensitivity: 'base' }))
  }

  const toFolderTreeNodes = (root: string, records: ContractFileRecord[]) => {
    const nRoot = normalizePathForCompare(root)
    if (!root || !nRoot) return []

    const folderRecords = (records || []).filter(
      (r) => r && r.type === 'folder' && !isDeletedRecord(r)
    )

    const pathSet = new Set<string>()
    for (const r of folderRecords) {
      const n = normalizePathForCompare(String(r.path || '').trim())
      if (n && n.startsWith(nRoot)) pathSet.add(n)
    }

    const map = new Map<string, { key: string; label: string; children: any[] }>()
    const ensureNode = (key: string, absPath: string, name: string, parentKey?: string) => {
      if (map.has(key)) return map.get(key)!
      const node: any = {
        key,
        label: name,
        children: [],
      }
      map.set(key, node)
      if (parentKey) {
        const parent = map.get(parentKey)
        if (parent) parent.children.push(node)
      }
      return node
    }

    const rootKey = nRoot
    const rootNode = ensureNode(rootKey, root, '[根目录] documents', undefined)

    for (const r of folderRecords) {
      const absPath = String(r.path || '').trim()
      const nAbsPath = normalizePathForCompare(absPath)
      if (!nAbsPath || !nAbsPath.startsWith(nRoot)) continue
      const rel = nAbsPath === nRoot ? '' : nAbsPath.slice(nRoot.length + 1)
      if (!rel) continue
      const parts = rel.split('/').filter(Boolean)
      let parentKey = rootKey
      let currentAbs = root
      for (let i = 0; i < parts.length; i++) {
        currentAbs = joinPath(currentAbs, parts[i])
        const currentKey = normalizePathForCompare(currentAbs)
        const node = ensureNode(currentKey, currentAbs, parts[i], parentKey)
        parentKey = currentKey
      }
    }

    const sortChildren = (node: any) => {
      node.children.sort((a: any, b: any) =>
        String(a.label || '').localeCompare(String(b.label || ''), 'zh-CN', { numeric: true, sensitivity: 'base' })
      )
      node.children.forEach(sortChildren)
    }
    sortChildren(rootNode)

    const flatten = (node: any): any => ({
      key: node.key,
      label: node.label,
      children: node.children.length > 0 ? node.children.map(flatten) : [],
    })

    return [flatten(rootNode)]
  }

  const loadFolderOptionsByContract = async (targetContractId: string) => {
    const targetId = String(targetContractId || '').trim()
    if (!targetId) {
      moveFolderOptions.value = []
      moveFolderTreeOptions.value = []
      moveTargetDirPath.value = ''
      return
    }
    const res = await window.electronAPI.contractFiles.getList({
      libraryPath: args.libraryPath.value,
      contractId: targetId,
    })
    if (!res.success || !res.data) {
      moveFolderOptions.value = []
      moveFolderTreeOptions.value = []
      moveTargetDirPath.value = ''
      throw new Error(res.error || '读取目标合同文件夹失败')
    }
    const rootDir = String(res.data.rootDir || '')
    const nRootDir = normalizePathForCompare(rootDir)
    const items = res.data.items || []
    console.log('[loadFolderOptionsByContract] rootDir:', rootDir, 'nRootDir:', nRootDir)
    console.log('[loadFolderOptionsByContract] items count:', items.length)
    moveFolderOptions.value = toFolderOptions(rootDir, items)
    moveFolderTreeOptions.value = toFolderTreeNodes(rootDir, items)
    console.log('[loadFolderOptionsByContract] folderOptions[0]:', moveFolderOptions.value[0])
    console.log('[loadFolderOptionsByContract] folderTreeOptions[0]:', moveFolderTreeOptions.value[0]?.key)
    moveTargetDirPath.value = moveFolderOptions.value[0]?.value || nRootDir || rootDir
    console.log('[loadFolderOptionsByContract] moveTargetDirPath.value set to:', moveTargetDirPath.value)
  }

  const openMoveDialog = async (mode: 'same-folder' | 'other-contract') => {
    const selected = args.getSelectedRecordsForAction()
    if (!selected.length) {
      args.toast.add({ severity: 'warn', summary: '请选择文件', detail: '请至少选择一项后再执行移动', life: 2500 })
      return
    }
    if (selected.some(isDeletedRecord)) {
      args.toast.add({ severity: 'warn', summary: '无法移动', detail: '回收站中的项目不支持移动', life: 2500 })
      return
    }
    moveDialogMode.value = mode
    moveDialogError.value = ''
    moveDialogSubmitting.value = false
    moveConflictStrategy.value = 'rename'

    if (mode === 'same-folder') {
      moveContractOptions.value = []
      moveTargetContractId.value = String(args.contractId.value || '')
      const root = args.rootDir.value
      const nRoot = normalizePathForCompare(root)
      const items = args.items.value || []
      console.log('[openMoveDialog same-folder] root:', root, 'nRoot:', nRoot)
      moveFolderOptions.value = toFolderOptions(root, items)
      moveFolderTreeOptions.value = toFolderTreeNodes(root, items)
      console.log('[openMoveDialog same-folder] folderOptions[0]:', moveFolderOptions.value[0])
      console.log('[openMoveDialog same-folder] folderTreeOptions[0]:', moveFolderTreeOptions.value[0]?.key)
      const nCurrent = normalizePathForCompare(args.currentListDir.value || root)
      const found = moveFolderOptions.value.find(it => it.value === nCurrent)
      console.log('[openMoveDialog same-folder] nCurrent:', nCurrent, 'found:', found)
      moveTargetDirPath.value = found?.value || moveFolderOptions.value[0]?.value || nRoot || root
      console.log('[openMoveDialog same-folder] moveTargetDirPath.value set to:', moveTargetDirPath.value)
      moveDialogVisible.value = true
      return
    }

    try {
      const contractsRes = await window.electronAPI.library.getContractInfos(args.libraryPath.value, { includeDeleted: false })
      if (!contractsRes.success || !contractsRes.data) {
        args.toast.add({ severity: 'error', summary: '加载失败', detail: contractsRes.error || '读取合同列表失败', life: 3000 })
        return
      }
      moveContractOptions.value = (contractsRes.data || [])
        .filter((it: any) => {
          const id = String(it?.id || '').trim()
          if (!id || id === String(args.contractId.value || '').trim()) return false
          return true
        })
        .map((it: any) => ({
          value: String(it.id || ''),
          label: `${String(it.contract_code || '').trim() || '[无编号]'} ${String(it.contract_name || '').trim()}`.trim(),
        }))
      if (moveContractOptions.value.length === 0) {
        args.toast.add({
          severity: 'warn',
          summary: '无可用目标',
          detail: '当前资源库没有其他可移动的合同',
          life: 2500,
        })
        return
      }
      moveTargetContractId.value = moveContractOptions.value[0].value
      await loadFolderOptionsByContract(moveTargetContractId.value)
      moveDialogVisible.value = true
    } catch (error) {
      args.toast.add({ severity: 'error', summary: '加载失败', detail: error instanceof Error ? error.message : '读取目标合同失败', life: 3000 })
    }
  }

  const onMoveDialogContractChange = async (contractId: string) => {
    moveTargetContractId.value = String(contractId || '').trim()
    moveDialogError.value = ''
    if (!moveTargetContractId.value) {
      moveFolderOptions.value = []
      moveTargetDirPath.value = ''
      return
    }
    try {
      await loadFolderOptionsByContract(moveTargetContractId.value)
    } catch (error) {
      moveDialogError.value = error instanceof Error ? error.message : '读取目标文件夹失败'
    }
  }

  const confirmMove = async () => {
    if (moveDialogSubmitting.value) return
    moveDialogError.value = ''
    const selected = args.getSelectedRecordsForAction().filter((r) => !isDeletedRecord(r))
    console.log('[confirmMove] moveTargetDirPath.value:', moveTargetDirPath.value)
    console.log('[confirmMove] folderOptions:', moveFolderOptions.value)
    console.log('[confirmMove] folderTreeOptions:', moveFolderTreeOptions.value?.map(n => ({ key: n.key, label: n.label })))
    if (!selected.length) {
      moveDialogError.value = '请选择要移动的文件'
      return
    }
    const targetContractId = moveDialogMode.value === 'other-contract'
      ? String(moveTargetContractId.value || '').trim()
      : String(args.contractId.value || '').trim()
    const targetDirPath = String(moveTargetDirPath.value || '').trim()
    const normalizedTargetDir = normalizePathForCompare(targetDirPath)
    if (!targetContractId) {
      moveDialogError.value = '目标合同不能为空'
      return
    }
    if (!targetDirPath) {
      moveDialogError.value = '目标文件夹不能为空'
      return
    }

    const hasSameParentNoop = selected.some((record) => {
      if (String(record.contractId || '').trim() !== targetContractId) return false
      return normalizePathForCompare(dirname(String(record.path || ''))) === normalizedTargetDir
    })
    if (hasSameParentNoop) {
      moveDialogError.value = '目标文件夹与部分选中项当前位置相同，请重新选择'
      return
    }

    for (const record of selected) {
      const sourcePath = String(record.path || '').trim()
      const normalizedSourcePath = normalizePathForCompare(sourcePath)
      if (!normalizedSourcePath) continue
      if (record.type === 'folder') {
        if (normalizedSourcePath === normalizedTargetDir) {
          moveDialogError.value = `不能将文件夹“${record.name}”移动到自身`
          return
        }
        if (normalizedTargetDir.startsWith(`${normalizedSourcePath}/`)) {
          moveDialogError.value = `不能将文件夹“${record.name}”移动到其子目录`
          return
        }
      }
      if (moveDialogMode.value === 'other-contract' && String(record.contractId || '').trim() !== String(args.contractId.value || '').trim()) {
        moveDialogError.value = '选中项包含非当前合同文件，请刷新后重试'
        return
      }
    }

    moveDialogSubmitting.value = true
    closeMoveDialog()
    
    try {
      const fileIds = Array.from(new Set(selected.map((r) => String(r.fileId || '').trim()).filter(Boolean)))
      const totalCount = fileIds.length
      
      // 启动进度条
      args.moveProgress.value.start(totalCount, `移动文件到目标合同`)
      
      let movedCount = 0
      let skippedCount = 0
      let failedCount = 0
      const resultItems: any[] = []
      
      // 逐个移动文件以显示进度
      for (let i = 0; i < fileIds.length; i++) {
        if (args.moveProgress.value.isCancelled.value) {
          break
        }
        
        const fileId = fileIds[i]
        const currentRecord = selected.find(r => String(r.fileId || '').trim() === fileId)
        const currentName = String(currentRecord?.name || '')
        
        args.moveProgress.value.currentIndex.value = i + 1
        args.moveProgress.value.currentName.value = currentName
        
        await new Promise<void>((resolve) => {
          window.setTimeout(() => resolve(), 0)
        })
        
        try {
          const res = await Promise.race([
            window.electronAPI.contractFiles.move({
              libraryPath: args.libraryPath.value,
              fileIds: [fileId],
              targetContractId,
              targetDirPath,
              conflictStrategy: moveConflictStrategy.value,
            }),
            new Promise<{ success: false; error: string }>((resolve) => {
              window.setTimeout(() => resolve({ success: false, error: '移动超时，请稍后重试' }), 30000)
            }),
          ])
          
          if (res.success && res.data) {
            const moved = Number(res.data.moved || 0)
            const skipped = Number(res.data.skipped || 0)
            const failed = Number(res.data.failed || 0)
            movedCount += moved
            skippedCount += skipped
            failedCount += failed
            if (res.data.items) {
              resultItems.push(...res.data.items)
            }
          } else {
            failedCount += 1
          }
        } catch (error) {
          failedCount += 1
        }
        
        args.moveProgress.value.done.value = movedCount + skippedCount + failedCount
      }
      
      const renamed = resultItems.filter(it => it.status === 'moved' && it.renamed).length
      const replaced = resultItems.filter(it => it.status === 'moved' && it.replaced).length
      
      // 完成进度条
      args.moveProgress.value.failCount.value = failedCount
      args.moveProgress.value.finish()
      
      // 显示结果提示
      if (movedCount > 0) {
        args.toast.add({
          severity: failedCount ? 'warn' : 'success',
          summary: '移动完成',
          detail: `成功 ${movedCount}${skippedCount ? `，跳过 ${skippedCount}` : ''}${failedCount ? `，失败 ${failedCount}` : ''}`,
          life: 2800,
        })
        if (renamed > 0 || replaced > 0) {
          const details: string[] = []
          if (renamed > 0) details.push(`${renamed} 项重命名`)
          if (replaced > 0) details.push(`${replaced} 项替换`)
          args.toast.add({ severity: 'info', summary: '冲突已处理', detail: details.join('，'), life: 3000 })
        }
      } else {
        const isCancelled = args.moveProgress.value.isCancelled.value
        if (!isCancelled) {
          args.toast.add({
            severity: failedCount ? 'error' : 'warn',
            summary: '未移动任何文件',
            detail: `跳过 ${skippedCount}${failedCount ? `，失败 ${failedCount}` : ''}`,
            life: 2800,
          })
        }
      }
      
      await args.refresh()
    } finally {
      moveDialogSubmitting.value = false
    }
  }

  return {
    isDeletedRecord,
    openFile,
    previewRecord,
    previewFile,
    openContainingFolder,
    copyPath,
    enterFolder,
    openEntryFromWaterfall,
    retryGenerateThumbnail,
    copyFile,
    copySelected,

    renameDialogVisible,
    renameDialogSubmitting,
    renameDialogRecord,
    renameDialogError,
    confirmRename,
    closeRenameDialog,
    renameEntry,

    createFolderDialogVisible,
    createFolderDialogSubmitting,
    createFolderDialogParentPath,
    createFolderDialogError,
    confirmCreateFolder,
    closeCreateFolderDialog,
    createFolder,

    moveDialogVisible,
    moveDialogSubmitting,
    moveDialogMode,
    moveDialogError,
    moveContractOptions,
    moveTargetContractId,
    moveFolderOptions,
    moveFolderTreeOptions,
    moveTargetDirPath,
    moveConflictStrategy,
    openMoveDialog,
    closeMoveDialog,
    confirmMove,
    onMoveDialogContractChange,

    propertiesDialogVisible,
    propertiesDialogRecord,
    openPropertiesDialog,

    restoreFile,
    restoreSelected,
    purgeFile,
    purgeSelected,
    deleteFile,
    deleteSelected,
  }
}
