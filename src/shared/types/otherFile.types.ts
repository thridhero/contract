export type OtherFileRecordType = 'file' | 'folder'

export interface OtherFileRecord {
  fileId: string
  path: string
  originalPath?: string | null
  trashPath?: string | null
  name: string
  nameUpper: string
  type: OtherFileRecordType
  size: number | null
  mtime: number | null
  sha256: string | null
  firstPageThumb: string | null
  previewStatus: string | null
  deletedAt?: string | null
  createdAt: string
  updatedAt: string
}

export interface OtherFileListDTO {
  libraryPath: string
  search?: string
  includeDeleted?: boolean
  currentDirPath?: string
}

export interface OtherFileTrashListDTO {
  libraryPath: string
  search?: string
}

export interface OtherFileDirectoryTreeNode {
  key: string
  name: string
  path: string
  children: OtherFileDirectoryTreeNode[]
}

export interface OtherFileListResult {
  rootDir: string
  items: OtherFileRecord[]
  directoryTree: OtherFileDirectoryTreeNode[]
  currentDir: string
  currentItems: OtherFileRecord[]
}

export interface OtherFileUpsertFromPathsDTO {
  libraryPath: string
  paths: string[]
}

export interface OtherFileDeleteDTO {
  libraryPath: string
  fileId: string
}

export interface OtherFileRestoreDTO {
  libraryPath: string
  fileId: string
}

export interface OtherFileRestoreResult {
  success: boolean
  originalPath: string
  restoredPath: string
  renamed: boolean
}

export interface OtherFilePurgeDTO {
  libraryPath: string
  fileId: string
}

export interface OtherFileCopyDTO {
  libraryPath: string
  fileId: string
}

export type OtherFileMoveConflictStrategy = 'rename' | 'skip' | 'replace' | 'keep-both'

export interface OtherFileMoveDTO {
  libraryPath: string
  fileIds: string[]
  targetDirPath: string
  conflictStrategy?: OtherFileMoveConflictStrategy
}

export interface OtherFileMoveItemResult {
  fileId: string
  fromPath: string
  toPath?: string
  status: 'moved' | 'skipped' | 'failed'
  reason?: string
  renamed?: boolean
  replaced?: boolean
}

export interface OtherFileMoveResult {
  moved: number
  skipped: number
  failed: number
  items: OtherFileMoveItemResult[]
}

export interface OtherFileCreateFolderDTO {
  libraryPath: string
  parentPath: string
  folderName: string
}

export interface OtherFileRenameDTO {
  libraryPath: string
  fileId: string
  newName: string
}

export interface OtherFileUpdateThumbnailDTO {
  libraryPath: string
  fileId: string
  firstPageThumb: string | null
  previewStatus: string | null
}

export interface OtherFileSaveThumbnailFileDTO {
  libraryPath: string
  fileId: string
  thumbnailBytes: Uint8Array
  ext?: 'webp'
}

export type OtherFileDragOutMode = 'native' | 'fallback-folder'

export interface OtherFileStartDragOutDTO {
  libraryPath: string
  fileIds: string[]
}

export interface OtherFileStartDragOutResult {
  mode: OtherFileDragOutMode
}

