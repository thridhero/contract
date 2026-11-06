export type ContractFileRecordType = 'file' | 'folder'

export interface ContractFileRecord {
  fileId: string
  contractId: string
  contractNo: string
  path: string
  originalPath?: string | null
  trashPath?: string | null
  name: string
  nameUpper: string
  type: ContractFileRecordType
  size: number | null
  mtime: number | null
  sha256: string | null
  firstPageThumb: string | null
  previewStatus: string | null
  deletedAt?: string | null
  createdAt: string
  updatedAt: string
}

export interface ContractFileListDTO {
  libraryPath: string
  contractId: string
  search?: string
  includeDeleted?: boolean
  currentDirPath?: string
}

export interface ContractFileTrashListDTO {
  libraryPath: string
  search?: string
}

export type ContractFileAllListMode = 'grouped' | 'flat'

export interface ContractFileAllListDTO {
  libraryPath: string
  mode?: ContractFileAllListMode
  search?: string
  currentDirPath?: string
}

export interface ContractFileAllListPagedDTO {
  libraryPath: string
  search?: string
  offset: number
  limit: number
}

export type ContractFileDirectoryTreeNodeType = 'root' | 'contract' | 'folder'

export interface ContractFileDirectoryTreeNode {
  key: string
  name: string
  path: string
  nodeType: ContractFileDirectoryTreeNodeType
  contractId?: string | null
  contractNo?: string | null
  contractName?: string | null
  children: ContractFileDirectoryTreeNode[]
}

export interface ContractFileAllGroup {
  contractId: string
  contractNo: string
  contractName: string
  rootDir: string
  items: ContractFileRecord[]
  directoryTree: ContractFileDirectoryTreeNode[]
  currentDir: string
  currentItems: ContractFileDirectoryListItem[]
}

export interface ContractFileRecordWithContractName extends ContractFileRecord {
  contractName: string
}

export type ContractFileDirectoryListItemType = ContractFileRecordType | 'contract'

export interface ContractFileDirectoryListItem {
  key: string
  fileId: string | null
  name: string
  path: string
  type: ContractFileDirectoryListItemType
  contractId: string
  contractNo: string
  contractName: string
  size: number | null
  mtime: number | null
  record: ContractFileRecordWithContractName | null
}

export interface ContractFileListResult {
  rootDir: string
  contractNo: string
  contractName: string
  items: ContractFileRecord[]
  directoryTree: ContractFileDirectoryTreeNode[]
  currentDir: string
  currentItems: ContractFileDirectoryListItem[]
}

export type ContractFileAllListResult =
  | {
    mode: 'grouped'
    libraryRootDir: string
    currentDir: string
    currentItems: ContractFileDirectoryListItem[]
    directoryTree: ContractFileDirectoryTreeNode[]
    groups: ContractFileAllGroup[]
  }
  | {
    mode: 'flat'
    libraryRootDir: string
    currentDir: string
    currentItems: ContractFileDirectoryListItem[]
    directoryTree: ContractFileDirectoryTreeNode[]
    items: ContractFileRecordWithContractName[]
  }

export interface ContractFileAllListPagedResult {
  libraryRootDir: string
  total: number
  items: ContractFileRecordWithContractName[]
}

export interface ContractFileUpsertFromPathsDTO {
  libraryPath: string
  contractId: string
  contractNo: string
  paths: string[]
}

export interface ContractFileDeleteDTO {
  libraryPath: string
  fileId: string
}

export interface ContractFileRestoreDTO {
  libraryPath: string
  fileId: string
}

export interface ContractFileRestoreResult {
  success: boolean
  originalPath: string
  restoredPath: string
  renamed: boolean
}

export interface ContractFilePurgeDTO {
  libraryPath: string
  fileId: string
}

export interface ContractFileCopyDTO {
  libraryPath: string
  fileId: string
}

export type ContractFileMoveConflictStrategy = 'rename' | 'skip' | 'replace' | 'keep-both'

export interface ContractFileMoveDTO {
  libraryPath: string
  fileIds: string[]
  targetContractId: string
  targetDirPath: string
  conflictStrategy?: ContractFileMoveConflictStrategy
}

export interface ContractFileMoveItemResult {
  fileId: string
  fromPath: string
  toPath?: string
  status: 'moved' | 'skipped' | 'failed'
  reason?: string
  renamed?: boolean
  replaced?: boolean
}

export interface ContractFileMoveResult {
  moved: number
  skipped: number
  failed: number
  items: ContractFileMoveItemResult[]
}

export interface ContractFileCreateFolderDTO {
  libraryPath: string
  contractId: string
  contractNo: string
  parentPath: string
  folderName: string
}

export interface ContractFileRenameDTO {
  libraryPath: string
  fileId: string
  newName: string
}

export interface ContractFileUpdateThumbnailDTO {
  libraryPath: string
  fileId: string
  firstPageThumb: string | null
  previewStatus: string | null
}

export interface ContractFileSaveThumbnailFileDTO {
  libraryPath: string
  fileId: string
  thumbnailBytes: Uint8Array
  ext?: 'webp'
}

export type ContractFileDragOutMode = 'native' | 'fallback-folder'

export interface ContractFileStartDragOutDTO {
  libraryPath: string
  contractId: string
  fileIds: string[]
}

export interface ContractFileStartDragOutResult {
  mode: ContractFileDragOutMode
}
