import { computed, type Ref } from 'vue'
import type { ContractFileRecord } from '../../../../shared/types/contractFile.types'
import { getRelativeParts, joinPath, normalizePathForCompare } from './contractFilesHelpers'

export const useContractFilesTree = (params: {
  items: Ref<ContractFileRecord[]>
  rootDir: Ref<string>
  activeRenderMode: Ref<'tree' | 'list' | 'waterfall' | null>
  treeExpandedKeys: Ref<Record<string, boolean>>
}) => {
  const { items, rootDir, activeRenderMode, treeExpandedKeys } = params

  const treeRootKey = computed(() => normalizePathForCompare(rootDir.value) || '__root__')

  const treeTableNodes = computed(() => {
    if (activeRenderMode.value !== 'tree') return []
    const root = rootDir.value
    if (!root) return []

    const recordByPath = new Map<string, ContractFileRecord>()
    for (const r of items.value) {
      recordByPath.set(normalizePathForCompare(r.path), r)
    }

    const map = new Map<string, any>()
    const ensureNode = (key: string, absPath: string, name: string, parentKey?: string) => {
      if (map.has(key)) return map.get(key)
      const record = recordByPath.get(normalizePathForCompare(absPath))
      const node = {
        key,
        data: {
          name,
          path: absPath,
          type: record?.type || 'folder',
          size: record?.size ?? null,
          mtime: record?.mtime ?? null,
          createdAt: record?.createdAt || '',
          record: record || null,
        },
        children: [] as any[],
        leaf: record?.type === 'file',
      }
      map.set(key, node)
      if (parentKey) {
        const parent = map.get(parentKey)
        if (parent) parent.children.push(node)
      }
      return node
    }

    const rootKey = treeRootKey.value
    const rootNode = ensureNode(rootKey, root, root, undefined)

    for (const item of items.value) {
      const parts = getRelativeParts(item.path, root)
      if (parts.length === 0) continue
      let parentKey = rootKey
      let currentAbs = root
      for (let i = 0; i < parts.length; i++) {
        currentAbs = joinPath(currentAbs, parts[i])
        const currentKey = normalizePathForCompare(currentAbs)
        const node = ensureNode(currentKey, currentAbs, parts[i], parentKey)
        if (i === parts.length - 1) {
          node.data = {
            name: item.name,
            path: item.path,
            type: item.type,
            size: item.size,
            mtime: item.mtime,
            createdAt: item.createdAt,
            record: item,
          }
          node.leaf = item.type === 'file'
        }
        parentKey = currentKey
      }
    }

    const sortChildren = (node: any) => {
      node.children.sort((a: any, b: any) => {
        const aFolder = String(a?.data?.type || '') === 'folder'
        const bFolder = String(b?.data?.type || '') === 'folder'
        if (aFolder !== bFolder) return aFolder ? -1 : 1
        return String(a?.data?.name || '').localeCompare(String(b?.data?.name || ''), 'zh-Hans-CN', { numeric: true, sensitivity: 'base' })
      })
      node.children.forEach(sortChildren)
    }
    sortChildren(rootNode)

    return [rootNode]
  })

  const flattenedTreeNodes = computed(() => {
    if (activeRenderMode.value !== 'tree') return []
    const nodes = treeTableNodes.value
    const result: any[] = []
    const expanded = treeExpandedKeys.value || {}

    const traverse = (nodeList: any[], level: number) => {
      for (const node of nodeList) {
        const hasChildren = Array.isArray(node.children) && node.children.length > 0
        const isExpanded = !!expanded[node.key]
        result.push({
          ...node,
          level,
          expanded: isExpanded,
          hasChildren,
        })
        if (isExpanded && hasChildren) {
          traverse(node.children, level + 1)
        }
      }
    }

    traverse(nodes, 0)
    return result
  })

  const toggleTreeNode = (node: any) => {
    const key = node.key
    const isExpanded = !!treeExpandedKeys.value[key]
    treeExpandedKeys.value = {
      ...treeExpandedKeys.value,
      [key]: !isExpanded,
    }
  }

  return {
    treeRootKey,
    treeTableNodes,
    flattenedTreeNodes,
    toggleTreeNode,
  }
}
