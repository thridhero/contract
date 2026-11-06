import { computed, markRaw, shallowRef } from 'vue'
import type { OtherFileRecord } from '../../../../../shared/types/otherFile.types'

export interface UseOtherFileNavigationOptions {
  libraryPath: () => string
  filePath: () => string
}

export function useOtherFileNavigation(options: UseOtherFileNavigationOptions) {
  const { libraryPath, filePath } = options

  const siblingFiles = shallowRef<OtherFileRecord[]>([])

  const loadSiblings = async () => {
    if (!libraryPath()) return
    const res = await window.electronAPI.otherFiles.getList({ libraryPath: libraryPath() })
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
          const openPath = String(i.path || '')
          if (!openPath) return false
          const iParts = openPath.split(/[/\\]/)
          iParts.pop()
          const iDir = iParts.join('/')
          return norm(iDir) === normDir
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

  const getPreviousFile = (): OtherFileRecord | null => {
    if (!hasPrevious.value) return null
    return siblingFiles.value[currentIndex.value - 1]
  }

  const getNextFile = (): OtherFileRecord | null => {
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

