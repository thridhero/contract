import type { IpcResponse } from '../types/ipc.types'
import type { TagEntity, TagGroupEntity } from '../types/tag.types'

export type ContractClientOption = {
  value: string
  label: string
  tagName: string
  sourceName: string
}

export type ArchiveFailedItem = {
  name: string
  reason: string
}

export type ContractArchiveResult = {
  uploaded: number
  duplicates: string[]
  failed: ArchiveFailedItem[]
}

export type ContractArchiveFsApi = {
  createFolder: (folderPath: string) => Promise<IpcResponse>
  getFileInfo: (filePath: string) => Promise<IpcResponse<unknown>>
  copyFiles: (srcPaths: string[], destDir: string) => Promise<IpcResponse<unknown[]>>
}

export function getBaseFileName(filePath: string): string {
  const normalizedPath = filePath.replace(/\\/g, '/')
  const pathParts = normalizedPath.split('/')
  return pathParts[pathParts.length - 1] || filePath
}

export async function archiveContractFiles(
  sourceFilePaths: string[],
  projectPath: string,
  fsApi: ContractArchiveFsApi,
): Promise<ContractArchiveResult> {
  const uniquePaths = Array.from(new Set(sourceFilePaths.filter(Boolean)))
  const documentsDir = `${projectPath.replace(/[\\/]+$/, '')}/documents`
  const duplicates: string[] = []
  const failed: ArchiveFailedItem[] = []
  let uploaded = 0

  if (uniquePaths.length === 0) {
    return { uploaded, duplicates, failed }
  }

  await fsApi.createFolder(documentsDir)

  for (const sourcePath of uniquePaths) {
    const fileName = getBaseFileName(sourcePath)
    const targetPath = `${documentsDir}/${fileName}`
    try {
      const existed = await fsApi.getFileInfo(targetPath)
      if (existed.success) {
        duplicates.push(fileName)
        continue
      }

      const copyResult = await fsApi.copyFiles([sourcePath], documentsDir)
      if (copyResult.success && copyResult.data && copyResult.data.length > 0) {
        uploaded += 1
      } else {
        failed.push({
          name: fileName,
          reason: copyResult.error || '复制失败',
        })
      }
    } catch (error) {
      failed.push({
        name: fileName,
        reason: error instanceof Error ? error.message : '复制失败',
      })
    }
  }

  return { uploaded, duplicates, failed }
}

export function buildContractClientOptions(
  tags: TagEntity[],
  tagGroups: TagGroupEntity[],
  historicalClientNames: string[],
): ContractClientOption[] {
  const supplierGroupIdSet = new Set(
    tagGroups
      .filter(group => group.name.trim().includes('供应商'))
      .map(group => group.id),
  )
  const names = new Set<string>()
  const supplierOptions: ContractClientOption[] = []
  for (const tag of tags) {
    if (!tag.group_id || !supplierGroupIdSet.has(tag.group_id)) {
      continue
    }
    const tagName = tag.name.trim()
    if (!tagName || names.has(tagName)) {
      continue
    }
    names.add(tagName)
    supplierOptions.push({
      value: tagName,
      label: `${tagName}（供应商）`,
      tagName,
      sourceName: '供应商',
    })
  }

  const supplierNameSet = new Set(supplierOptions.map(option => option.tagName))
  const historicalNameSet = new Set<string>()
  const historyOptions: ContractClientOption[] = []
  for (const historicalClientName of historicalClientNames) {
    const value = historicalClientName.trim()
    if (!value || supplierNameSet.has(value) || historicalNameSet.has(value)) {
      continue
    }
    historicalNameSet.add(value)
    historyOptions.push({
      value,
      label: `${value}（历史值）`,
      tagName: value,
      sourceName: '历史值',
    })
  }

  return [...supplierOptions, ...historyOptions]
}

export function filterContractClientOptions(
  options: ContractClientOption[],
  keyword: string,
): ContractClientOption[] {
  const normalizedKeyword = keyword.trim().toLowerCase()
  if (!normalizedKeyword) {
    return options
  }
  return options.filter(option => {
    return option.tagName.toLowerCase().includes(normalizedKeyword)
      || option.sourceName.toLowerCase().includes(normalizedKeyword)
  })
}
