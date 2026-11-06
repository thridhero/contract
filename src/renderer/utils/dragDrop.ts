export type DroppedFileWithRelativePath = {
  file: File
  relativePath: string
}

type WebkitEntry = {
  isFile: boolean
  isDirectory: boolean
  name: string
  file: (success: (file: File) => void, error?: (err: any) => void) => void
  createReader?: () => { readEntries: (success: (entries: WebkitEntry[]) => void, error?: (err: any) => void) => void }
}

const normalizeRelativePath = (p: string) =>
  String(p || '')
    .replace(/\\/g, '/')
    .replace(/^\/+/g, '')
    .replace(/\/+/g, '/')

const readDirEntries = async (dir: WebkitEntry): Promise<WebkitEntry[]> => {
  if (!dir.createReader) return []
  const reader = dir.createReader()
  const entries: WebkitEntry[] = []
  while (true) {
    const batch = await new Promise<WebkitEntry[]>((resolve, reject) => {
      reader.readEntries(resolve, reject)
    })
    if (!batch.length) break
    entries.push(...batch)
  }
  return entries
}

const readEntryRecursive = async (entry: WebkitEntry, parentPath: string): Promise<DroppedFileWithRelativePath[]> => {
  if (entry.isFile) {
    const file = await new Promise<File>((resolve, reject) => {
      entry.file(resolve, reject)
    })
    const rel = normalizeRelativePath(parentPath ? `${parentPath}/${file.name}` : file.name)
    return [{ file, relativePath: rel }]
  }

  if (entry.isDirectory) {
    const nextParent = normalizeRelativePath(parentPath ? `${parentPath}/${entry.name}` : entry.name)
    const children = await readDirEntries(entry)
    const all: DroppedFileWithRelativePath[] = []
    for (const child of children) {
      const childFiles = await readEntryRecursive(child, nextParent)
      all.push(...childFiles)
    }
    return all
  }

  return []
}

export async function collectDroppedFiles(dataTransfer: DataTransfer): Promise<DroppedFileWithRelativePath[]> {
  const items = Array.from(dataTransfer.items || [])
  const hasEntry = items.some((i: any) => typeof i?.webkitGetAsEntry === 'function')
  if (hasEntry) {
    const roots = items
      .map((i: any) => (typeof i?.webkitGetAsEntry === 'function' ? (i.webkitGetAsEntry() as WebkitEntry | null) : null))
      .filter(Boolean) as WebkitEntry[]

    const all: DroppedFileWithRelativePath[] = []
    for (const entry of roots) {
      const files = await readEntryRecursive(entry, '')
      all.push(...files)
    }
    return all
  }

  const fallbackFiles = Array.from(dataTransfer.files || [])
  return fallbackFiles.map((file) => ({
    file,
    relativePath: normalizeRelativePath((file as any).webkitRelativePath || file.name),
  }))
}

