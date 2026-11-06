import { computed, type Ref } from 'vue'
import type { Router } from 'vue-router'
import { dirname, getRelativeParts, joinPath, normalizePathForCompare } from './contractFilesHelpers'
import type { ContractFilesViewMode } from './contractFilesViewTypes'

export function useContractFilesFolderNav(args: {
  router: Router
  contractId: Ref<string>
  isTrashMode: Ref<boolean>
  rootDir: Ref<string>
  currentListDir: Ref<string>
  viewMode: Ref<ContractFilesViewMode>
  searchQuery: Ref<string>
}) {
  const fullTextSearchBaseDir = computed(() => {
    if (args.isTrashMode.value) return ''
    const root = String(args.rootDir.value || '').trim()
    if (!root) return ''
    if (args.viewMode.value === 'list' || args.viewMode.value === 'waterfall') {
      return String(args.currentListDir.value || root).trim() || root
    }
    return root
  })

  const openFullTextSearchPage = async () => {
    const baseDir = String(fullTextSearchBaseDir.value || '').trim()
    if (!baseDir || args.isTrashMode.value) return
    await args.router.push({
      name: 'ContractFilesFullTextSearch',
      params: { contractId: args.contractId.value },
      query: { baseDir },
    })
  }

  const showFolderBreadcrumb = computed(() => {
    if (args.isTrashMode.value) return false
    if (args.viewMode.value !== 'list' && args.viewMode.value !== 'waterfall') return false
    return Boolean(String(args.rootDir.value || '').trim())
  })

  const folderBreadcrumbItems = computed(() => {
    const root = String(args.rootDir.value || '').trim()
    if (!root) return []
    const current = String(args.currentListDir.value || root).trim() || root

    const parts = getRelativeParts(current, root)
    const rootLabel = (() => {
      const tokens = root.replace(/\\\\/g, '/').split('/').filter(Boolean)
      return tokens[tokens.length - 1] || '根目录'
    })()

    const items: Array<{ label: string; path: string }> = [{ label: rootLabel, path: root }]
    let acc = root
    for (const part of parts) {
      acc = joinPath(acc, part)
      items.push({ label: part, path: acc })
    }
    return items
  })

  const canGoUpFolder = computed(() => {
    const root = normalizePathForCompare(args.rootDir.value)
    const current = normalizePathForCompare(args.currentListDir.value || args.rootDir.value)
    if (!root || !current) return false
    return current !== root
  })

  const clearSearchForFolderNav = () => {
    if (args.searchQuery.value.trim()) {
      args.searchQuery.value = ''
    }
  }

  const goUpFolder = () => {
    clearSearchForFolderNav()
    const rootRaw = String(args.rootDir.value || '').trim()
    const currentRaw = String(args.currentListDir.value || rootRaw || '').trim()
    const nRoot = normalizePathForCompare(rootRaw)
    const nCurrent = normalizePathForCompare(currentRaw)
    if (!nRoot || !nCurrent || nCurrent === nRoot) return

    const parentRaw = dirname(currentRaw)
    const nParent = normalizePathForCompare(parentRaw)
    if (!nParent || !nParent.startsWith(nRoot)) {
      args.currentListDir.value = rootRaw
      return
    }
    args.currentListDir.value = parentRaw
  }

  const navigateToFolder = (path: string) => {
    clearSearchForFolderNav()
    const rootRaw = String(args.rootDir.value || '').trim()
    const nRoot = normalizePathForCompare(rootRaw)
    const targetRaw = String(path || '').trim() || rootRaw
    const nTarget = normalizePathForCompare(targetRaw)
    if (!nRoot || !nTarget || !nTarget.startsWith(nRoot)) return
    args.currentListDir.value = targetRaw
  }

  return {
    fullTextSearchBaseDir,
    openFullTextSearchPage,
    showFolderBreadcrumb,
    folderBreadcrumbItems,
    canGoUpFolder,
    goUpFolder,
    navigateToFolder,
  }
}

