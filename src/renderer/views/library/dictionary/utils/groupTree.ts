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

export function ensureRootFirst<T extends SimpleTreeNode>(nodes: T[], rootKey = '0'): T[] {
  const index = nodes.findIndex((n) => String(n?.key) === rootKey)
  if (index <= 0) return nodes
  const reordered = [...nodes]
  const [root] = reordered.splice(index, 1)
  reordered.unshift(root)
  return reordered
}

export function collectNodeDataStrings(nodes: SimpleTreeNode[], options?: { excludeKey?: string }): string[] {
  const res: string[] = []
  const excludeKey = options?.excludeKey
  const walk = (list: SimpleTreeNode[]) => {
    for (const node of list) {
      if (excludeKey == null || String(node?.key) !== excludeKey) res.push(String(node?.data ?? ''))
      const children = node?.children
      if (Array.isArray(children) && children.length) walk(children)
    }
  }
  walk(nodes)
  return res
}

export function getSelectedSingleKey(selectionKeys: Record<string, boolean> | null | undefined): string {
  const keys = Object.keys(selectionKeys || {})
  return keys[0] ? String(keys[0]) : ''
}
