import type { Ref } from 'vue'
import type { ContractFileRecord } from '../../../../shared/types/contractFile.types'
import { copyTextToClipboard, dirname } from './contractFilesHelpers'

export const useContractFilesOpenActions = (params: {
  toast: any
  selectedRecordsForMenu: Ref<ContractFileRecord[]>
  contextMenuTarget: Ref<{ path: string; record: ContractFileRecord | null } | null>
}) => {
  const { toast, selectedRecordsForMenu, contextMenuTarget } = params

  const openFile = async () => {
    const selected = selectedRecordsForMenu.value
    const record = selected.length === 1 ? selected[0] : contextMenuTarget.value?.record
    if (!record || record.type !== 'file') return
    const res = await window.electronAPI.fs.openFile(record.path)
    if (!res.success) {
      toast.add({ severity: 'error', summary: '打开失败', detail: res.error || '打开文件失败', life: 3000 })
    }
  }

  const openContainingFolder = async () => {
    const selected = selectedRecordsForMenu.value
    const record = selected.length === 1 ? selected[0] : contextMenuTarget.value?.record
    const folderPath = record ? (record.type === 'file' ? dirname(record.path) : record.path) : String(contextMenuTarget.value?.path || '')
    if (!folderPath) return
    const res = await window.electronAPI.fs.openFolder(folderPath)
    if (!res.success) {
      toast.add({ severity: 'error', summary: '打开失败', detail: res.error || '打开文件夹失败', life: 3000 })
    }
  }

  const copyPath = async () => {
    const selected = selectedRecordsForMenu.value
    const selectionCount = selected.length
    const paths =
      selectionCount > 0 ? selected.map((r) => String(r?.path || '')).filter(Boolean) : [String(contextMenuTarget.value?.path || '')].filter(Boolean)
    if (paths.length === 0) return
    const ok = await copyTextToClipboard(paths.join('\n'))
    if (!ok) {
      toast.add({ severity: 'error', summary: '复制失败', detail: '未能写入剪贴板', life: 2500 })
      return
    }
    toast.add({ severity: 'success', summary: '已复制路径', detail: paths.length > 1 ? `共 ${paths.length} 条` : paths[0], life: 2000 })
  }

  return {
    openFile,
    openContainingFolder,
    copyPath,
  }
}

