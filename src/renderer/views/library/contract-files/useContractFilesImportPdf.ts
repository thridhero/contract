import type { Ref } from 'vue'

export const useContractFilesImportPdf = (params: {
  rootDir: Ref<string>
  currentListDir: Ref<string>
  viewMode: Ref<'tree' | 'list' | 'waterfall'>
  toast: any
  fileCopyTaskStore: any
  lastCopyFiles: Ref<Array<{ src: string; name: string; relativePath?: string }>>
  lastCopyDestDir: Ref<string>
  runCopyAndSync: (files: Array<{ src: string; name: string; relativePath?: string }>, destDir: string) => Promise<void>
}) => {
  const { rootDir, currentListDir, viewMode, toast, fileCopyTaskStore, lastCopyFiles, lastCopyDestDir, runCopyAndSync } = params

  const getBaseName = (p: string) => {
    const s = String(p || '')
    const idx1 = s.lastIndexOf('/')
    const idx2 = s.lastIndexOf('\\')
    const idx = Math.max(idx1, idx2)
    return idx >= 0 ? s.slice(idx + 1) : s
  }

  const importPdfFiles = async () => {
    if (!rootDir.value) return
    if (fileCopyTaskStore.isCopying) {
      toast.add({ severity: 'info', summary: '正在拷贝中', detail: '请等待当前任务完成后再导入', life: 2000 })
      return
    }
    const res = await window.electronAPI.fs.selectFile({
      properties: ['openFile', 'multiSelections'],
      filters: [{ name: 'PDF', extensions: ['pdf'] }],
    })
    if (!res.success || !res.data) {
      toast.add({ severity: 'error', summary: '导入失败', detail: res.error || '选择文件失败', life: 3000 })
      return
    }
    if ((res.data as any).canceled) return
    const filePaths = Array.isArray((res.data as any).filePaths) ? ((res.data as any).filePaths as any[]) : []
    const pdfPaths = filePaths
      .map((p) => String(p || '').trim())
      .filter(Boolean)
      .filter((p) => p.toLowerCase().endsWith('.pdf'))
    if (pdfPaths.length === 0) return

    const useCurrentDir = viewMode.value === 'list' || viewMode.value === 'waterfall'
    const destDir = useCurrentDir ? (currentListDir.value || rootDir.value) : rootDir.value

    const files = pdfPaths.map((p) => ({ src: p, name: getBaseName(p) }))
    lastCopyFiles.value = files
    lastCopyDestDir.value = destDir
    try {
      await runCopyAndSync(files, destDir)
    } catch (err: any) {
      toast.add({ severity: 'error', summary: '导入失败', detail: err?.message || '导入失败', life: 3000 })
    }
  }

  return { importPdfFiles }
}

