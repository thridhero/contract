import { computed, ref, type Ref } from 'vue'
import type { ContractFileRecord } from '../../../types/resources'
import type { ContractFilesViewMode } from './contractFilesViewTypes'
import type { FileCopyFailureRow } from '../../../stores/file/fileCopyTaskStore'
import { collectDroppedFiles, dirname, getRelativeParts, joinPath, normalizePathForCompare } from './contractFilesHelpers'

export function useContractFilesImport(args: {
  toast: { add: (options: any) => void }
  importTaskStore: {
    startImport: (payload: any) => Promise<void>
    peekProgress: (contextKey: string) => any
  }
  fileCopyTaskStore: {
    startCopy: (files: any[], destDir: string, options: any) => Promise<any>
  }

  libraryPath: Ref<string>
  contractId: Ref<string>
  contractNo: Ref<string>
  rootDir: Ref<string>
  currentListDir: Ref<string>
  viewMode: Ref<ContractFilesViewMode>
  isTrashMode: Ref<boolean>
  internalDragOutActive: Ref<boolean>

  loadContract: () => Promise<void>
}) {
  const importContextKey = computed(() => {
    if (!args.libraryPath.value || !args.contractId.value) return ''
    return `contract-files:${args.libraryPath.value}:${args.contractId.value}`
  })

  const showFailedDialog = ref(false)
  const copyFailures = ref<FileCopyFailureRow[]>([])
  const retryingFailures = ref(false)
  const lastCopyDestDir = ref('')

  const buildDbPathsFromFiles = (baseDir: string, filePaths: string[]) => {
    const set = new Set<string>()
    for (const abs of filePaths) {
      const p = String(abs || '').trim()
      if (!p) continue
      set.add(p)
      const parts = getRelativeParts(p, baseDir)
      if (parts.length <= 1) continue
      let current = baseDir
      for (let i = 0; i < parts.length - 1; i++) {
        current = joinPath(current, parts[i])
        set.add(current)
      }
    }
    return Array.from(set)
  }

  const normalizeForKey = (p: string) => normalizePathForCompare(p).toLowerCase()

  const makeFailureRow = (payload: {
    file: { src: string; name: string; relativePath?: string }
    srcPath: string
    destPath: string
    error: string
  }) => {
    const displayName = String(payload.file.relativePath || payload.file.name || '').trim() || '文件'
    const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`
    return {
      id,
      displayName,
      srcPath: String(payload.srcPath || ''),
      destPath: String(payload.destPath || ''),
      error: String(payload.error || '拷贝失败'),
      file: payload.file,
    } satisfies FileCopyFailureRow
  }

  const getContractFileRecords = async () => {
    if (!args.libraryPath.value || !args.contractId.value) return { contractNo: '', items: [] as ContractFileRecord[] }
    const res = await window.electronAPI.contractFiles.getList({
      libraryPath: args.libraryPath.value,
      contractId: args.contractId.value,
      search: undefined,
    })
    if (!res.success || !res.data) return { contractNo: '', items: [] as ContractFileRecord[] }
    const rootKey = normalizePathForCompare(args.rootDir.value) + '/'
    const filtered = res.data.items.filter((it: ContractFileRecord) => normalizePathForCompare(it.path).startsWith(rootKey))
    return { contractNo: res.data.contractNo, items: filtered }
  }

  const validateConsistency = async (fileResults: any[]) => {
    const failures: FileCopyFailureRow[] = []
    if (!args.libraryPath.value || !args.contractId.value) return failures

    const { contractNo: dbContractNo, items: records } = await getContractFileRecords()
    if (!args.contractNo.value && dbContractNo) {
      args.contractNo.value = dbContractNo
    }

    const fileMap = new Map<string, ContractFileRecord>()
    for (const r of records) {
      if (r.type !== 'file') continue
      fileMap.set(normalizeForKey(r.path), r)
    }

    for (const fr of fileResults) {
      const outcome = String(fr?.outcome || '')
      if (outcome === 'failed') continue
      const destPath = String(fr?.finalDestPath || fr?.destPath || '')
      const key = normalizeForKey(destPath)
      const record = fileMap.get(key)
      if (!record) {
        failures.push(makeFailureRow({
          file: fr.file,
          srcPath: String(fr?.srcPath || fr?.file?.src || ''),
          destPath,
          error: '数据库缺少文件记录',
        }))
        continue
      }
      try {
        const infoRes = await window.electronAPI.fs.getFileInfo(destPath) as any
        const normalized = infoRes && typeof infoRes === 'object' && 'success' in infoRes ? infoRes : { success: true, data: infoRes }
        if (!normalized.success) {
          throw new Error(normalized.error || '读取文件失败')
        }
        const size = Number(normalized.data?.size ?? 0)
        const dbSize = typeof record.size === 'number' ? record.size : -1
        if (dbSize >= 0 && size !== dbSize) {
          failures.push(makeFailureRow({
            file: fr.file,
            srcPath: String(fr?.srcPath || fr?.file?.src || ''),
            destPath,
            error: `文件大小不一致：磁盘 ${size}，数据库 ${dbSize}`,
          }))
        }
      } catch (e: any) {
        failures.push(makeFailureRow({
          file: fr.file,
          srcPath: String(fr?.srcPath || fr?.file?.src || ''),
          destPath,
          error: `读取目标文件失败：${e?.message || '未知错误'}`,
        }))
      }
    }
    return failures
  }

  const runCopyAndSync = async (files: Array<{ src: string; name: string; relativePath?: string }>, destDir: string) => {
    if (!args.libraryPath.value || !args.contractId.value) {
      throw new Error('资源库或合同信息缺失')
    }
    if (!args.contractNo.value) {
      const { contractNo: dbContractNo } = await getContractFileRecords()
      args.contractNo.value = dbContractNo
    }
    if (!args.contractNo.value) {
      throw new Error('合同编号缺失')
    }
    lastCopyDestDir.value = destDir
    const copyOptions = { conflict: { mode: 'ask', detectDuplicates: true }, hash: { compute: true, algorithms: ['md5', 'sha256'], verify: 'after-copy', verifyExisting: true, failOnMismatch: true } }
    const result = await args.fileCopyTaskStore.startCopy(files, destDir, copyOptions)

    const fileResults = Array.isArray((result as any)?.fileResults) ? (result as any).fileResults : []
    const okFileResults = fileResults.filter((r: any) => String(r?.outcome || '') !== 'failed')
    const destFilePaths = okFileResults.map((r: any) => String(r?.finalDestPath || r?.destPath || '')).filter(Boolean)
    const pathsForDb = buildDbPathsFromFiles(destDir, destFilePaths)

    if (pathsForDb.length > 0) {
      const upsertRes = await window.electronAPI.contractFiles.upsertFromPaths({
        libraryPath: args.libraryPath.value,
        contractId: args.contractId.value,
        contractNo: args.contractNo.value,
        paths: pathsForDb,
      })
      if (!upsertRes.success) {
        throw new Error(upsertRes.error || '写入文件记录失败')
      }
    }

    const baseFailures = Array.isArray((result as any)?.failed)
      ? ((result as any).failed as Array<{ file: any; error: string }>).map((f) =>
          makeFailureRow({
            file: f.file,
            srcPath: String(f?.file?.src || ''),
            destPath: joinPath(destDir, String(f?.file?.relativePath || f?.file?.name || '')),
            error: String(f?.error || '拷贝失败'),
          }),
        )
      : []

    const consistencyFailures = await validateConsistency(okFileResults)
    const mergedFailures = [...baseFailures, ...consistencyFailures]
    copyFailures.value = mergedFailures
    showFailedDialog.value = mergedFailures.length > 0

    await args.loadContract()
  }

  const startImportTask = async (files: Array<{ src: string; name: string; relativePath?: string }>, destDir: string) => {
    if (!args.libraryPath.value || !args.contractId.value) {
      throw new Error('资源库或合同信息缺失')
    }
    if (!args.contractNo.value) {
      const { contractNo: dbContractNo } = await getContractFileRecords()
      args.contractNo.value = dbContractNo
    }
    if (!args.contractNo.value) {
      throw new Error('合同编号缺失')
    }
    const key = importContextKey.value
    if (!key) {
      throw new Error('导入上下文缺失')
    }

    await args.importTaskStore.startImport({
      contextKey: key,
      destDir,
      files,
      libraryPath: args.libraryPath.value,
      contractId: args.contractId.value,
      contractNo: args.contractNo.value,
    })
  }

  const importFiles = async () => {
    if (args.isTrashMode.value) {
      args.toast.add({ severity: 'info', summary: '回收站不可导入', detail: '请在合同文件中导入', life: 2000 })
      return
    }
    if (!args.rootDir.value) return
    const res = await window.electronAPI.fs.selectFile({
      properties: ['openFile', 'multiSelections'],
      filters: [
        { name: '支持的文件', extensions: ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'png', 'jpg', 'jpeg', 'webp', 'bmp', 'tif', 'tiff'] },
      ],
    })
    if (!res.success || !res.data) {
      args.toast.add({ severity: 'error', summary: '导入失败', detail: res.error || '选择文件失败', life: 3000 })
      return
    }
    if ((res.data as any).canceled) return
    const filePaths = Array.isArray((res.data as any).filePaths) ? ((res.data as any).filePaths as any[]) : []

    const filesToImport = filePaths
      .map((p) => String(p || '').trim())
      .filter(Boolean)
      .map((p) => ({ src: p, name: p.split(/[\\/]/).pop() || '' }))

    if (filesToImport.length === 0) return

    const useCurrentDir = args.viewMode.value === 'list' || args.viewMode.value === 'waterfall'
    const destDir = useCurrentDir ? (args.currentListDir.value || args.rootDir.value) : args.rootDir.value

    try {
      await startImportTask(filesToImport, destDir)
      args.toast.add({ severity: 'success', summary: '开始导入', detail: `共 ${filesToImport.length} 个文件`, life: 2000 })
    } catch (err: any) {
      args.toast.add({ severity: 'error', summary: '导入失败', detail: err?.message || '导入失败', life: 3000 })
    }
  }

  const retryFailures = async (rows: FileCopyFailureRow[]) => {
    if (retryingFailures.value) return
    const destDir = lastCopyDestDir.value || args.rootDir.value
    if (!destDir) return
    const files = rows.map((r) => r.file).filter((f) => f?.src && f?.name)
    if (files.length === 0) return
    retryingFailures.value = true
    try {
      await runCopyAndSync(files, destDir)
    } finally {
      retryingFailures.value = false
    }
  }

  const retryAllFailures = async () => {
    await retryFailures(copyFailures.value)
  }

  const retrySelectedFailures = async (rows: FileCopyFailureRow[]) => {
    await retryFailures(rows)
  }

  const dragCounter = ref(0)
  const isDragActive = ref(false)

  const handleDragEnter = (e: DragEvent) => {
    e.preventDefault()
    if (args.isTrashMode.value) return
    if (args.internalDragOutActive.value) return
    dragCounter.value++
    isDragActive.value = true
  }

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault()
    if (args.isTrashMode.value) return
    if (args.internalDragOutActive.value) return
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'
  }

  const handleDragLeave = (e: DragEvent) => {
    e.preventDefault()
    if (args.isTrashMode.value) return
    if (args.internalDragOutActive.value) return
    dragCounter.value--
    if (dragCounter.value === 0) {
      isDragActive.value = false
    }
  }

  const handleDrop = async (e: DragEvent) => {
    e.preventDefault()
    if (args.isTrashMode.value) return
    if (args.internalDragOutActive.value) {
      args.internalDragOutActive.value = false
      isDragActive.value = false
      dragCounter.value = 0
      return
    }
    isDragActive.value = false
    dragCounter.value = 0
    if (!args.rootDir.value) return

    const existing = importContextKey.value ? args.importTaskStore.peekProgress(importContextKey.value) : null
    if (existing && (existing.stage === 'copying' || existing.stage === 'converting' || existing.stage === 'indexing')) {
      args.toast.add({ severity: 'info', summary: '正在导入中', detail: '请等待当前任务完成后再拖入', life: 2000 })
      return
    }

    const dt = e.dataTransfer
    if (!dt) return

    const rawFiles = Array.from(dt.files || [])
    const srcPaths = rawFiles.map((f) => window.electronAPI.fs.getFilePath(f)).filter(Boolean)
    const dropped: Array<{ src: string; name: string; relativePath?: string }> = []

    if (srcPaths.length > 0) {
      const res = await window.electronAPI.fileCopy.expandSources(srcPaths)
      if (res.success && res.data) {
        if (res.data.truncated) {
          args.toast.add({ severity: 'warn', summary: '文件过多', detail: '已达到最大展开数量，部分文件未导入', life: 3500 })
        }
        for (const it of res.data.items || []) {
          if (!it?.src) continue
          dropped.push({ src: String(it.src), name: String(it.name || ''), relativePath: it.relativePath ? String(it.relativePath) : undefined })
        }
      }
    } else {
      const droppedEntries = await collectDroppedFiles(dt)
      for (const { file, relativePath } of droppedEntries) {
        const abs = window.electronAPI.fs.getFilePath(file)
        if (!abs) continue
        dropped.push({ src: abs, name: file.name, relativePath })
      }
    }
    if (dropped.length === 0) return

    const useCurrentDir = args.viewMode.value === 'list' || args.viewMode.value === 'waterfall'
    const destDir = useCurrentDir ? (args.currentListDir.value || args.rootDir.value) : args.rootDir.value
    try {
      await startImportTask(dropped, destDir)
    } catch (err: any) {
      args.toast.add({ severity: 'error', summary: '上传失败', detail: err?.message || '上传失败', life: 3000 })
    }
  }

  return {
    importContextKey,
    isDragActive,
    handleDragEnter,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    importFiles,

    showFailedDialog,
    copyFailures,
    retryingFailures,
    retryAllFailures,
    retrySelectedFailures,
  }
}

