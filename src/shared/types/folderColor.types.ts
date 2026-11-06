export type FolderColorScope = 'contract-files' | 'other-files'

export type FolderColorKey = 'red' | 'orange' | 'yellow' | 'green' | 'blue' | 'purple'

export type FolderColorMap = Record<string, FolderColorKey>

export interface FolderColorMapGetDTO {
  libraryPath: string
  scope: FolderColorScope
}

export interface FolderColorMapSetDTO {
  libraryPath: string
  scope: FolderColorScope
  map: FolderColorMap
}

export interface FolderColorMapResult {
  map: FolderColorMap
}
