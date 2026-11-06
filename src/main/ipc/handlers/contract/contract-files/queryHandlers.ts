import * as fs from 'fs'
import * as path from 'path'
import Database from 'better-sqlite3'
import * as channels from '../../../channels'
import { ok, fail, IpcResponse } from '../../../../../shared/types/ipc.types'
import type {
  ContractFileAllGroup,
  ContractFileDirectoryListItem,
  ContractFileDirectoryTreeNode,
  ContractFileAllListDTO,
  ContractFileAllListResult,
  ContractFileAllListPagedDTO,
  ContractFileAllListPagedResult,
  ContractFileListDTO,
  ContractFileListResult,
  ContractFileTrashListDTO,
  ContractFileUpsertFromPathsDTO,
  ContractFileRecord,
  ContractFileRecordType,
  ContractFileRecordWithContractName,
} from '../../../../../shared/types/contractFile.types'
import {
  ContractFileHandlerMap,
  ensurePathWithin,
  getContractMeta,
  logger,
  openLibraryDb,
  sha256File,
  toRecord,
  ulid,
} from './shared'

type ContractFileGroupData = Omit<ContractFileAllGroup, 'currentDir' | 'currentItems' | 'directoryTree'> & {
  items: ContractFileRecordWithContractName[]
}

const compareText = (a: string, b: string) =>
  String(a || '').localeCompare(String(b || ''), 'zh-CN', { numeric: true, sensitivity: 'base' })

const isPathWithinRoot = (rootPath: string, targetPath: string) => {
  const root = path.resolve(rootPath)
  const target = path.resolve(targetPath)
  const rel = path.relative(root, target)
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel))
}

const normalizeCurrentDirPath = (requestedPath: unknown, rootDir: string) => {
  const fallback = path.resolve(rootDir)
  const raw = String(requestedPath || '').trim()
  if (!raw) return fallback
  const resolved = path.resolve(raw)
  return isPathWithinRoot(fallback, resolved) ? resolved : fallback
}

const getRelativeParts = (targetPath: string, rootDir: string) => {
  const rel = path.relative(path.resolve(rootDir), path.resolve(targetPath))
  if (!rel || rel === '.') return []
  if (rel.startsWith('..') || path.isAbsolute(rel)) return []
  return rel.split(/[\\/]+/).filter(Boolean)
}

const compareDirectoryItems = (a: ContractFileDirectoryListItem, b: ContractFileDirectoryListItem) => {
  const getRank = (value: ContractFileDirectoryListItem['type']) => {
    if (value === 'contract') return 0
    if (value === 'folder') return 1
    return 2
  }
  const rankDiff = getRank(a.type) - getRank(b.type)
  if (rankDiff !== 0) return rankDiff
  return compareText(a.name, b.name)
}

const sortDirectoryTree = (nodes: ContractFileDirectoryTreeNode[]) => {
  nodes.sort((a, b) => {
    const getRank = (value: ContractFileDirectoryTreeNode['nodeType']) => {
      if (value === 'contract') return 0
      if (value === 'folder') return 1
      return 2
    }
    const rankDiff = getRank(a.nodeType) - getRank(b.nodeType)
    if (rankDiff !== 0) return rankDiff
    return compareText(a.name, b.name)
  })
  for (const node of nodes) {
    if (Array.isArray(node.children) && node.children.length) {
      sortDirectoryTree(node.children)
    }
  }
}

const toRecordWithContractName = (row: any): ContractFileRecordWithContractName => ({
  ...toRecord(row),
  contractName: String(row.contract_name || ''),
})

const toDirectoryListItem = (record: ContractFileRecordWithContractName): ContractFileDirectoryListItem => ({
  key: String(record.fileId || `${record.type}:${record.path}`),
  fileId: String(record.fileId || '').trim() || null,
  name: String(record.name || ''),
  path: String(record.path || ''),
  type: record.type,
  contractId: String(record.contractId || ''),
  contractNo: String(record.contractNo || ''),
  contractName: String(record.contractName || ''),
  size: record.size ?? null,
  mtime: record.mtime ?? null,
  record,
})

const toContractRootListItem = (group: ContractFileGroupData): ContractFileDirectoryListItem => ({
  key: `contract:${group.contractId}`,
  fileId: null,
  name: String(group.contractNo || group.contractName || path.basename(group.rootDir) || group.contractId),
  path: String(group.rootDir || ''),
  type: 'contract',
  contractId: String(group.contractId || ''),
  contractNo: String(group.contractNo || ''),
  contractName: String(group.contractName || ''),
  size: null,
  mtime: null,
  record: null,
})

const buildGroupDirectoryTree = (group: ContractFileGroupData): ContractFileDirectoryTreeNode[] => {
  const rootNode: ContractFileDirectoryTreeNode = {
    key: `contract:${group.contractId}`,
    name: String(group.contractNo || group.contractName || path.basename(group.rootDir) || group.contractId),
    path: String(group.rootDir || ''),
    nodeType: 'contract',
    contractId: String(group.contractId || ''),
    contractNo: String(group.contractNo || ''),
    contractName: String(group.contractName || ''),
    children: [],
  }

  const byPath = new Map<string, ContractFileDirectoryTreeNode>([[path.resolve(group.rootDir), rootNode]])

  const ensureChild = (parent: ContractFileDirectoryTreeNode, absPath: string, name: string) => {
    const resolved = path.resolve(absPath)
    const existing = byPath.get(resolved)
    if (existing) return existing
    const node: ContractFileDirectoryTreeNode = {
      key: resolved,
      name,
      path: resolved,
      nodeType: 'folder',
      contractId: group.contractId,
      contractNo: group.contractNo,
      contractName: group.contractName,
      children: [],
    }
    parent.children.push(node)
    byPath.set(resolved, node)
    return node
  }

  for (const item of group.items) {
    const folderPath = item.type === 'folder' ? item.path : path.dirname(item.path)
    const parts = getRelativeParts(folderPath, group.rootDir)
    if (!parts.length) continue

    let parent = rootNode
    let currentPath = group.rootDir
    for (const part of parts) {
      currentPath = path.join(currentPath, part)
      parent = ensureChild(parent, currentPath, part)
    }
  }

  sortDirectoryTree(rootNode.children)
  return [rootNode]
}

const buildGroupCurrentItems = (group: ContractFileGroupData, currentDir: string): ContractFileDirectoryListItem[] => {
  const normalizedCurrentDir = path.resolve(currentDir)
  return group.items
    .filter((item) => path.resolve(path.dirname(item.path)) === normalizedCurrentDir)
    .map(toDirectoryListItem)
    .sort(compareDirectoryItems)
}

const buildLibraryDirectoryTree = (groups: ContractFileGroupData[], libraryRootDir: string): ContractFileDirectoryTreeNode[] => {
  const rootNode: ContractFileDirectoryTreeNode = {
    key: path.resolve(libraryRootDir),
    name: path.basename(path.resolve(libraryRootDir)) || path.resolve(libraryRootDir),
    path: path.resolve(libraryRootDir),
    nodeType: 'root',
    contractId: null,
    contractNo: null,
    contractName: null,
    children: [],
  }

  for (const group of groups) {
    const tree = buildGroupDirectoryTree(group)
    if (tree[0]) rootNode.children.push(tree[0])
  }

  sortDirectoryTree(rootNode.children)
  return [rootNode]
}

const buildAllCurrentItems = (
  groups: ContractFileGroupData[],
  libraryRootDir: string,
  currentDir: string,
): ContractFileDirectoryListItem[] => {
  const normalizedCurrentDir = path.resolve(currentDir)
  const normalizedLibraryRoot = path.resolve(libraryRootDir)

  if (normalizedCurrentDir === normalizedLibraryRoot) {
    return groups.map(toContractRootListItem).sort(compareDirectoryItems)
  }

  const group = groups.find((item) => isPathWithinRoot(item.rootDir, normalizedCurrentDir))
  if (!group) return []
  return buildGroupCurrentItems(group, normalizedCurrentDir)
}

export const contractFileQueryHandlers: ContractFileHandlerMap = {
  [channels.CONTRACT_FILES_GET_LIST]: async (_event, dto: unknown): Promise<IpcResponse<ContractFileListResult>> => {
    let db: Database.Database | null = null
    try {
      const payload = dto as ContractFileListDTO
      const libraryPath = String(payload.libraryPath || '').trim()
      const contractId = String(payload.contractId || '').trim()
      if (!libraryPath) return fail(new Error('资源库路径不能为空'))
      if (!contractId) return fail(new Error('合同ID不能为空'))

      db = openLibraryDb(libraryPath)
      const meta = getContractMeta(db, contractId)
      const contractDir = path.join(path.resolve(libraryPath), meta.folderName)
      const rootDir = path.join(contractDir, 'documents')

      const search = String(payload.search || '').trim()
      const includeDeleted = Boolean(payload.includeDeleted)
      const where = ['contract_id = ?']
      const params: any[] = [contractId]
      if (!includeDeleted) {
        where.push('deleted_at IS NULL')
      }
      if (search) {
        where.push('name_upper LIKE ?')
        params.push(`%${search.toUpperCase()}%`)
      }
      const sql = `
        SELECT *
        FROM contract_files
        WHERE ${where.join(' AND ')}
        ORDER BY CASE WHEN type = 'folder' THEN 0 ELSE 1 END, name_upper COLLATE NOCASE ASC
      `
      const rows = db.prepare(sql).all(...params) as any[]
      const items = rows.map((row) => ({
        ...toRecord(row),
        contractName: meta.contractName,
      })) as ContractFileRecordWithContractName[]
      const currentDir = normalizeCurrentDirPath(payload.currentDirPath, rootDir)
      const group: ContractFileGroupData = {
        contractId,
        contractNo: meta.contractNo,
        contractName: meta.contractName,
        rootDir,
        items,
      }
      return ok({
        rootDir,
        contractNo: meta.contractNo,
        contractName: meta.contractName,
        items,
        directoryTree: buildGroupDirectoryTree(group),
        currentDir,
        currentItems: buildGroupCurrentItems(group, currentDir),
      })
    } catch (error) {
      logger.error('查询合同文件记录失败:', error)
      return fail(error)
    } finally {
      db?.close()
    }
  },

  [channels.CONTRACT_FILES_GET_TRASH_LIST]: async (_event, dto: unknown): Promise<IpcResponse<{ rootDir: string; contractNo: string; items: ContractFileRecord[] }>> => {
    let db: Database.Database | null = null
    try {
      const payload = dto as ContractFileTrashListDTO
      const libraryPath = String(payload.libraryPath || '').trim()
      if (!libraryPath) return fail(new Error('资源库路径不能为空'))

      db = openLibraryDb(libraryPath)

      const search = String(payload.search || '').trim()
      const where = ['deleted_at IS NOT NULL']
      const params: any[] = []
      if (search) {
        where.push('name_upper LIKE ?')
        params.push(`%${search.toUpperCase()}%`)
      }

      const sql = `
        SELECT *
        FROM contract_files
        WHERE ${where.join(' AND ')}
        ORDER BY deleted_at DESC, CASE WHEN type = 'folder' THEN 0 ELSE 1 END, name_upper COLLATE NOCASE ASC
      `
      const rows = db.prepare(sql).all(...params) as any[]
      return ok({ rootDir: path.resolve(libraryPath), contractNo: '', items: rows.map(toRecord) })
    } catch (error) {
      logger.error('查询回收站文件记录失败:', error)
      return fail(error)
    } finally {
      db?.close()
    }
  },

  [channels.CONTRACT_FILES_GET_ALL_LIST]: async (_event, dto: unknown): Promise<IpcResponse<ContractFileAllListResult>> => {
    let db: Database.Database | null = null
    try {
      const payload = dto as ContractFileAllListDTO
      const libraryPath = String(payload.libraryPath || '').trim()
      if (!libraryPath) return fail(new Error('资源库路径不能为空'))

      const mode = payload.mode === 'flat' ? 'flat' : 'grouped'
      const libraryRootDir = path.resolve(libraryPath)

      db = openLibraryDb(libraryPath)

      const search = String(payload.search || '').trim()
      const where = ['cf.deleted_at IS NULL']
      const params: any[] = []
      if (search) {
        where.push('cf.name_upper LIKE ?')
        params.push(`%${search.toUpperCase()}%`)
      }

      const sql = `
        SELECT
          cf.*,
          ci.contract_code AS contract_code,
          ci.contract_name AS contract_name,
          ci.folder_name AS folder_name
        FROM contract_files cf
        JOIN contract_info ci ON ci.id = cf.contract_id
        WHERE ${where.join(' AND ')}
        ORDER BY ci.contract_code COLLATE NOCASE ASC, CASE WHEN cf.type = 'folder' THEN 0 ELSE 1 END, cf.name_upper COLLATE NOCASE ASC
      `
      const rows = db.prepare(sql).all(...params) as any[]

      const items: ContractFileRecordWithContractName[] = []
      const groupsById = new Map<string, ContractFileGroupData>()
      for (const row of rows) {
        const contractId = String(row.contract_id || '')
        const contractNo = String(row.contract_code || row.contract_no || '')
        const contractName = String(row.contract_name || '')
        const folderName = String(row.folder_name || '').trim()
        if (!contractId || !folderName) continue
        const contractDir = path.join(libraryRootDir, folderName)
        ensurePathWithin(libraryRootDir, contractDir)
        const rootDir = path.join(contractDir, 'documents')

        let group = groupsById.get(contractId)
        if (!group) {
          group = { contractId, contractNo, contractName, rootDir, items: [] }
          groupsById.set(contractId, group)
        }

        const record = toRecordWithContractName(row)
        items.push(record)
        try {
          ensurePathWithin(contractDir, record.path)
          group.items.push(record)
        } catch {
        }
      }

      const groupsBase = Array.from(groupsById.values()).sort((a, b) =>
        String(a.contractNo || '').localeCompare(String(b.contractNo || ''), 'zh-CN', { numeric: true, sensitivity: 'base' }),
      )
      const directoryTree = buildLibraryDirectoryTree(groupsBase, libraryRootDir)
      const currentDir = normalizeCurrentDirPath(payload.currentDirPath, libraryRootDir)

      if (mode === 'grouped') {
        const groups: ContractFileAllGroup[] = groupsBase.map((group) => ({
          ...group,
          directoryTree: buildGroupDirectoryTree(group),
          currentDir: isPathWithinRoot(group.rootDir, currentDir) ? currentDir : path.resolve(group.rootDir),
          currentItems: buildGroupCurrentItems(
            group,
            isPathWithinRoot(group.rootDir, currentDir) ? currentDir : path.resolve(group.rootDir),
          ),
        }))
        return ok({
          mode,
          libraryRootDir,
          directoryTree,
          currentDir,
          currentItems: buildAllCurrentItems(groupsBase, libraryRootDir, currentDir),
          groups,
        })
      }

      return ok({
        mode,
        libraryRootDir,
        directoryTree,
        currentDir,
        currentItems: buildAllCurrentItems(groupsBase, libraryRootDir, currentDir),
        items,
      })
    } catch (error) {
      logger.error('查询全库合同文件记录失败:', error)
      return fail(error)
    } finally {
      db?.close()
    }
  },

  [channels.CONTRACT_FILES_GET_ALL_LIST_PAGED]: async (_event, dto: unknown): Promise<IpcResponse<ContractFileAllListPagedResult>> => {
    let db: Database.Database | null = null
    try {
      const payload = dto as ContractFileAllListPagedDTO
      const libraryPath = String(payload.libraryPath || '').trim()
      if (!libraryPath) return fail(new Error('资源库路径不能为空'))

      const libraryRootDir = path.resolve(libraryPath)
      const offsetRaw = Number((payload as any).offset)
      const limitRaw = Number((payload as any).limit)
      const offset = Number.isFinite(offsetRaw) && offsetRaw > 0 ? Math.floor(offsetRaw) : 0
      const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(500, Math.floor(limitRaw)) : 100

      db = openLibraryDb(libraryPath)

      const search = String(payload.search || '').trim()
      const where = ['cf.deleted_at IS NULL']
      const params: any[] = []
      if (search) {
        where.push('cf.name_upper LIKE ?')
        params.push(`%${search.toUpperCase()}%`)
      }

      const countSql = `
        SELECT COUNT(1) AS total
        FROM contract_files cf
        JOIN contract_info ci ON ci.id = cf.contract_id
        WHERE ${where.join(' AND ')}
      `
      const totalRow = db.prepare(countSql).get(...params) as { total?: number } | undefined
      const total = totalRow?.total ? Number(totalRow.total) : 0
      if (!total) return ok({ libraryRootDir, total: 0, items: [] })

      const sql = `
        SELECT
          cf.*,
          ci.contract_code AS contract_code,
          ci.contract_name AS contract_name
        FROM contract_files cf
        JOIN contract_info ci ON ci.id = cf.contract_id
        WHERE ${where.join(' AND ')}
        ORDER BY ci.contract_code COLLATE NOCASE ASC, CASE WHEN cf.type = 'folder' THEN 0 ELSE 1 END, cf.name_upper COLLATE NOCASE ASC
        LIMIT ? OFFSET ?
      `
      const rows = db.prepare(sql).all(...params, limit, offset) as any[]
      const items: ContractFileRecordWithContractName[] = []
      for (const row of rows) {
        const record = toRecord(row)
        items.push({
          ...record,
          contractName: String(row.contract_name || ''),
        })
      }
      return ok({ libraryRootDir, total, items })
    } catch (error) {
      logger.error('分页查询全库合同文件记录失败:', error)
      return fail(error)
    } finally {
      db?.close()
    }
  },

  [channels.CONTRACT_FILES_UPSERT_FROM_PATHS]: async (_event, dto: unknown): Promise<IpcResponse<{ upserted: number }>> => {
    let db: Database.Database | null = null
    try {
      const payload = dto as ContractFileUpsertFromPathsDTO
      const libraryPath = String(payload.libraryPath || '').trim()
      const contractId = String(payload.contractId || '').trim()
      const contractNo = String(payload.contractNo || '').trim()
      const pathsInput = Array.isArray(payload.paths) ? payload.paths : []
      if (!libraryPath) return fail(new Error('资源库路径不能为空'))
      if (!contractId) return fail(new Error('合同ID不能为空'))
      if (!contractNo) return fail(new Error('合同编号不能为空'))
      if (pathsInput.length === 0) return ok({ upserted: 0 })

      db = openLibraryDb(libraryPath)
      const meta = getContractMeta(db, contractId)
      if (meta.contractNo !== contractNo) {
        return fail(new Error('合同编号不匹配'))
      }

      const contractDir = path.join(path.resolve(libraryPath), meta.folderName)
      ensurePathWithin(path.resolve(libraryPath), contractDir)

      const findExisting = db.prepare('SELECT file_id FROM contract_files WHERE contract_no = ? AND path = ? LIMIT 1')
      const insertStmt = db.prepare(`
        INSERT INTO contract_files (
          file_id, contract_id, contract_no, path, name, name_upper, type, size, mtime, sha256, first_page_thumb, preview_status
        ) VALUES (
          ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
        )
      `)
      const updateStmt = db.prepare(`
        UPDATE contract_files
        SET
          contract_id = ?,
          name = ?,
          name_upper = ?,
          type = ?,
          size = ?,
          mtime = ?,
          sha256 = ?,
          first_page_thumb = ?,
          preview_status = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE file_id = ?
      `)

      let upserted = 0
      const tx = db.transaction((items: string[]) => {
        for (const p of items) {
          const abs = path.resolve(String(p || ''))
          ensurePathWithin(contractDir, abs)
          if (!fs.existsSync(abs)) continue
          const stat = fs.statSync(abs)
          const isDir = stat.isDirectory()
          const name = path.basename(abs)
          const nameUpper = name.toUpperCase()
          const type: ContractFileRecordType = isDir ? 'folder' : 'file'
          const size = isDir ? null : stat.size
          const mtime = Number(stat.mtimeMs)
          const sha256: string | null = null
          const firstPageThumb: string | null = null
          const previewStatus: string | null = null
          const existed = findExisting.get(contractNo, abs) as { file_id?: string } | undefined
          if (existed?.file_id) {
            updateStmt.run(contractId, name, nameUpper, type, size, mtime, sha256, firstPageThumb, previewStatus, existed.file_id)
          } else {
            insertStmt.run(ulid(), contractId, contractNo, abs, name, nameUpper, type, size, mtime, sha256, firstPageThumb, previewStatus)
          }
          upserted += 1
        }
      })

      tx(pathsInput)

      const fileRows = db.prepare(`
        SELECT file_id, path
        FROM contract_files
        WHERE contract_id = ? AND sha256 IS NULL AND type = 'file'
      `).all(contractId) as Array<{ file_id: string; path: string }>

      for (const row of fileRows) {
        if (!fs.existsSync(row.path)) continue
        ensurePathWithin(contractDir, row.path)
        const hash = await sha256File(row.path)
        db.prepare('UPDATE contract_files SET sha256 = ?, updated_at = CURRENT_TIMESTAMP WHERE file_id = ?').run(hash, row.file_id)
      }

      return ok({ upserted })
    } catch (error) {
      logger.error('写入合同文件记录失败:', error)
      return fail(error)
    } finally {
      db?.close()
    }
  },
}
