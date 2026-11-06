export type ContractFilesViewMode = 'tree' | 'list' | 'waterfall'

export function normalizeViewMode(value: unknown): ContractFilesViewMode {
  if (value === 'tree' || value === 'list' || value === 'waterfall') return value
  return 'list'
}

