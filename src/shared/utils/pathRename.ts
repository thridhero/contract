const trimPath = (value: string) => String(value || '').trim().replace(/[\\/]+$/g, '')

const normalizePathForCompare = (value: string) => trimPath(value).replace(/\\/g, '/')

const splitRelativeParts = (targetPath: string, parentPath: string) => {
  const normalizedTarget = normalizePathForCompare(targetPath)
  const normalizedParent = normalizePathForCompare(parentPath)
  if (!normalizedTarget || !normalizedParent) return null
  if (normalizedTarget === normalizedParent) return []
  if (!normalizedTarget.startsWith(`${normalizedParent}/`)) return null
  return normalizedTarget.slice(normalizedParent.length + 1).split('/').filter(Boolean)
}

export const remapPathAfterFolderRename = (currentPath: string, oldFolderPath: string, newFolderPath: string) => {
  const nextCurrent = trimPath(currentPath)
  const oldBase = trimPath(oldFolderPath)
  const newBase = trimPath(newFolderPath)
  if (!nextCurrent || !oldBase || !newBase || oldBase === newBase) return nextCurrent

  const relativeParts = splitRelativeParts(nextCurrent, oldBase)
  if (relativeParts === null) return nextCurrent
  if (relativeParts.length === 0) return newBase

  const separator = newBase.includes('\\') ? '\\' : '/'
  return [newBase, ...relativeParts].join(separator)
}
