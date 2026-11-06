export type FileSystemEntryKind = 'file' | 'directory'

export interface FileSystemEntry {
  name: string
  path: string
  kind: FileSystemEntryKind
  size: number
  lastModified: number
}

