export type SimpleTreeNode = {
  key?: unknown
  data?: unknown
  children?: SimpleTreeNode[]
}

export function findNodeByKey(nodes: SimpleTreeNode[], key: string): SimpleTreeNode | null {
  for (const node of nodes) {
    if (String(node?.key) === key) return node
    const children = node?.children
    if (Array.isArray(children) && children.length) {
      const found = findNodeByKey(children, key)
      if (found) return found
    }
  }
  return null
}

export function findParentNode(nodes: SimpleTreeNode[], targetKey: string, parent: SimpleTreeNode | null = null): SimpleTreeNode | null {
  for (const node of nodes) {
    if (String(node?.key) === targetKey) return parent
    const children = node?.children
    if (Array.isArray(children) && children.length) {
      const found = findParentNode(children, targetKey, node)
      if (found) return found
    }
  }
  return null
}

export function collectGroupNames(nodes: SimpleTreeNode[], set: Set<string>, options?: { excludeKey?: string }) {
  const excludeKey = options?.excludeKey
  for (const node of nodes) {
    if (node && (excludeKey == null || String(node.key) !== excludeKey)) {
      const name = typeof node.data === 'string' ? node.data.trim() : ''
      if (name) set.add(name)
    }
    const children = node?.children
    if (Array.isArray(children) && children.length) collectGroupNames(children, set, options)
  }
}

export function getSelectedSingleKey(selectionKeys: Record<string, boolean> | null | undefined): string {
  const keys = Object.keys(selectionKeys || {})
  return keys[0] ? String(keys[0]) : ''
}
