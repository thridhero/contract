import { computed, markRaw, shallowRef } from 'vue'
import type { ContractFileRecord } from '../../../../../shared/types/contractFile.types'

export interface UseFileNavigationOptions {
  libraryPath: () => string
  contractId: () => string
  filePath: () => string
  isTrashMode: () => boolean
}

export function useFileNavigation(options: UseFileNavigationOptions) {
  const { libraryPath, contractId, filePath, isTrashMode } = options

  const siblingFiles = shallowRef<ContractFileRecord[]>([])

  const loadSiblings = async () => {
    if (!libraryPath() || !contractId()) return
    const res = isTrashMode()
      ? await window.electronAPI.contractFiles.getTrashList({ libraryPath: libraryPath() })
      : await window.electronAPI.contractFiles.getList({
          libraryPath: libraryPath(),
          contractId: contractId()
        })
    if (res.success && res.data) {
      const p = String(filePath() || '').trim()
      const parts = p.split(/[/\\]/)
      parts.pop()
      const currentDir = parts.join('/')
      
      const norm = (s: string) => s.replace(/\\\\/g, '/').toLowerCase()
      const normDir = norm(currentDir)
      
      const items = res.data.items
        .filter(i => {
          if (i.type !== 'file') return false
          const openPath = isTrashMode() ? String(i.trashPath || i.path || '') : String(i.path || '')
          if (!openPath) return false
          const iParts = openPath.split(/[/\\]/)
          iParts.pop()
          const iDir = iParts.join('/')
          return norm(iDir) === normDir
        })
        .map((i) => {
          if (!isTrashMode()) return i
          const openPath = String(i.trashPath || i.path || '')
          return { ...i, path: openPath }
        })
      
      items.sort((a, b) => a.name.localeCompare(b.name))
      siblingFiles.value = markRaw(items)
    }
  }

  const currentIndex = computed(() => {
    const p = String(filePath() || '').trim()
    const norm = (s: string) => s.replace(/\\\\/g, '/').toLowerCase()
    const normP = norm(p)
    return siblingFiles.value.findIndex(i => norm(i.path) === normP)
  })

  const hasPrevious = computed(() => currentIndex.value > 0)
  const hasNext = computed(() => currentIndex.value >= 0 && currentIndex.value < siblingFiles.value.length - 1)

  const getPreviousFile = (): ContractFileRecord | null => {
    if (!hasPrevious.value) return null
    return siblingFiles.value[currentIndex.value - 1]
  }

  const getNextFile = (): ContractFileRecord | null => {
    if (!hasNext.value) return null
    return siblingFiles.value[currentIndex.value + 1]
  }

  return {
    siblingFiles,
    loadSiblings,
    currentIndex,
    hasPrevious,
    hasNext,
    getPreviousFile,
    getNextFile,
  }
}
