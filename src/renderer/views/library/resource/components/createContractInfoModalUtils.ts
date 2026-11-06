import type { AIContractExtractionResult } from '../../../../../shared/types/ai.types'
import type { ContractFormSchema, ContractFormSchemaField } from '../../../../../shared/types/contractFormSchema.types'

export type TailwindColor = { name: string; value: string }

export type SelectOption = { label: string; value: string }

export type TreeNodeOption = {
  key: string
  label: string
  data: string
  children?: TreeNodeOption[]
}

export const fallbackContractTypeOptions: SelectOption[] = [
  { label: '研发合同', value: 'rd_contract' },
  { label: '委托开发合同', value: 'entrusted_development' },
  { label: '技术服务合同', value: 'technical_service' },
  { label: '软件采购合同', value: 'software_procurement' },
  { label: '维护服务合同', value: 'maintenance_service' },
]

export const tailwind700Colors: TailwindColor[] = [
  { name: 'red-700', value: '#b91c1c' },
  { name: 'orange-700', value: '#c2410c' },
  { name: 'amber-700', value: '#b45309' },
  { name: 'yellow-700', value: '#a16207' },
  { name: 'lime-700', value: '#4d7c0f' },
  { name: 'green-700', value: '#15803d' },
  { name: 'emerald-700', value: '#047857' },
  { name: 'teal-700', value: '#0f766e' },
  { name: 'cyan-700', value: '#0e7490' },
  { name: 'sky-700', value: '#0369a1' },
  { name: 'blue-700', value: '#1d4ed8' },
  { name: 'indigo-700', value: '#4338ca' },
  { name: 'violet-700', value: '#6d28d9' },
  { name: 'purple-700', value: '#7e22ce' },
  { name: 'fuchsia-700', value: '#a21caf' },
  { name: 'pink-700', value: '#be185d' },
  { name: 'rose-700', value: '#be123c' },
]

export const primeIcons = [
  'pi pi-file-edit', 'pi pi-file', 'pi pi-folder', 'pi pi-folder-open', 'pi pi-book',
  'pi pi-briefcase', 'pi pi-desktop', 'pi pi-globe', 'pi pi-cog', 'pi pi-code',
  'pi pi-database', 'pi pi-server', 'pi pi-cloud', 'pi pi-android', 'pi pi-apple',
  'pi pi-microsoft', 'pi pi-github', 'pi pi-box', 'pi pi-shield', 'pi pi-key',
  'pi pi-lock', 'pi pi-bolt', 'pi pi-star', 'pi pi-heart', 'pi pi-tag',
  'pi pi-tags', 'pi pi-sitemap', 'pi pi-th-large', 'pi pi-compass', 'pi pi-chart-line',
  'pi pi-chart-bar', 'pi pi-sliders-h', 'pi pi-palette', 'pi pi-images', 'pi pi-video',
  'pi pi-microchip', 'pi pi-sync', 'pi pi-send', 'pi pi-upload', 'pi pi-download',
  'pi pi-link', 'pi pi-share-alt', 'pi pi-check-circle', 'pi pi-verified', 'pi pi-sparkles',
  'pi pi-objects-column', 'pi pi-wifi', 'pi pi-mobile', 'pi pi-tablet',
]

export const normalizeContractName = (value: string) => String(value || '').trim().toLocaleLowerCase()

const CONTRACT_NAME_MAX_LENGTH = 60
const CONTRACT_NAME_SUFFIX_PATTERN = /(合同|协议|合同书|协议书)$/u
const GENERIC_CONTRACT_NAME_SET = new Set([
  '合同',
  '协议',
  '技术合同',
  '技术协议',
  '服务合同',
  '服务协议',
  '采购合同',
  '采购协议',
  '买卖合同',
  '购销合同',
  '供货合同',
  '销售合同',
  '维护合同',
  '运维合同',
  '实施合同',
  '开发合同',
  '软件开发合同',
  '软件采购合同',
  '技术服务合同',
  '技术开发合同',
  '补充协议',
  '框架协议',
  '合作协议',
])

const trimText = (value: unknown) => String(value || '').trim()

const normalizeContractTypeDisplayName = (value: unknown, options: SelectOption[] = []) => {
  const text = trimText(value)
  if (!text) return ''
  const normalized = text.toLocaleLowerCase()
  const matched = options.find((item) => {
    const optionValue = trimText(item.value).toLocaleLowerCase()
    const optionLabel = trimText(item.label).toLocaleLowerCase()
    return optionValue === normalized || optionLabel === normalized
  })
  const display = trimText(matched?.label || matched?.value || text)
  return /[\u4e00-\u9fa5]/.test(display) ? display : ''
}

const stripMarkdownDecorations = (value: string) => {
  return String(value || '')
    .replace(/\r/g, '')
    .split('\n')
    .map(line => line.trim())
    .filter(line => line && !/^\|.*\|$/.test(line) && !/^[#>*-]\s*/.test(line))
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()
}

const cleanProjectLikeText = (value: unknown) => {
  let text = trimText(value)
  if (!text) return ''
  text = stripMarkdownDecorations(text)
    .replace(/^采购标的明细[:：]?\s*/u, '')
    .replace(/^补充说明[:：]?\s*/u, '')
    .replace(/^(本合同(?:主要)?(?:约定|涉及|内容为|系|为)?)/u, '')
    .replace(/^(双方(?:就|围绕))/u, '')
    .replace(/^(甲方(?:委托乙方|向乙方|与乙方|就|采购|购买|订购))/u, '')
    .replace(/^(乙方(?:为甲方|向甲方|与甲方|就|提供|承接))/u, '')
    .replace(/^(就|关于|针对)/u, '')
    .replace(/[。；;，,].*$/u, '')
    .replace(/^(开展|提供|承接|实施|建设|采购|购买|委托开发|委托|开发|运维|维护)/u, '')
    .replace(/(相关)?(工作|服务|事项|事宜|内容|合作).*$/u, '')
    .replace(/\s+/g, ' ')
    .trim()
  if (text.length > CONTRACT_NAME_MAX_LENGTH) {
    text = text.slice(0, CONTRACT_NAME_MAX_LENGTH).trim()
  }
  if (text.length < 4) return ''
  if (/^(甲方|乙方|双方|本合同)$/u.test(text)) return ''
  return text
}

const findProjectLikeValueFromFields = (result: AIContractExtractionResult) => {
  const extractedFields = result.extractedFields
  if (!extractedFields || typeof extractedFields !== 'object') return ''
  const ignoredKeys = new Set([
    'contractName',
    'contractCode',
    'contractType',
    'clientName',
    'partyBName',
    'partyAContact',
    'partyBContact',
    'contractSummary',
    'remark',
  ])
  const preferredKeyPattern = /(project|subject|item|product|system|platform|solution|module|software|service|scope|content|target|engineering|deliverable)/i
  const preferredRows = Object.entries(extractedFields).filter(([key, value]) => {
    if (ignoredKeys.has(key)) return false
    if (!preferredKeyPattern.test(key)) return false
    return typeof value === 'string' || typeof value === 'number'
  })
  for (const [, value] of preferredRows) {
    const cleaned = cleanProjectLikeText(value)
    if (cleaned) return cleaned
  }
  return ''
}

const findProjectLikeValueFromSummary = (summary: unknown) => {
  const text = cleanProjectLikeText(summary)
  if (!text) return ''
  const fragments = text
    .split(/[。；;，,]/u)
    .map(item => cleanProjectLikeText(item))
    .filter(Boolean)
  const preferred = fragments.find(item => /项目|系统|平台|软件|工程|服务|采购|开发|建设|实施|运维|升级|改造/u.test(item))
  return preferred || fragments[0] || ''
}

const isGenericContractName = (name: string, contractTypeLabel = '') => {
  const normalized = trimText(name).replace(/\s+/g, '')
  if (!normalized) return true
  if (GENERIC_CONTRACT_NAME_SET.has(normalized)) return true
  const normalizedType = trimText(contractTypeLabel).replace(/\s+/g, '')
  if (normalizedType && (
    normalized === normalizedType
    || normalized === `${normalizedType}合同`
    || normalized === `${normalizedType}协议`
    || normalized === `${normalizedType}合同书`
    || normalized === `${normalizedType}协议书`
  )) {
    return true
  }
  return /^(技术|服务|采购|买卖|购销|供货|销售|维护|运维|实施|开发|租赁|合作|框架|保密|补充)(合同|协议|合同书|协议书)$/u.test(normalized)
}

const appendContractTypeSuffix = (base: string, contractTypeLabel: string) => {
  const normalizedBase = trimText(base)
  if (!normalizedBase) return ''
  if (CONTRACT_NAME_SUFFIX_PATTERN.test(normalizedBase)) return normalizedBase
  const readableType = normalizeContractTypeDisplayName(contractTypeLabel)
  if (!readableType) return `${normalizedBase}合同`
  const typeStem = readableType.replace(CONTRACT_NAME_SUFFIX_PATTERN, '').trim()
  if (typeStem && normalizedBase.includes(typeStem)) {
    return `${normalizedBase}合同`
  }
  return `${normalizedBase}${readableType.endsWith('合同') || readableType.endsWith('协议') ? readableType : `${readableType}合同`}`
}

const buildPartyBasedContractName = (partyA: string, partyB: string, contractTypeLabel: string) => {
  const names = [trimText(partyA), trimText(partyB)].filter(Boolean)
  if (names.length === 0) return ''
  const joined = names.length >= 2 ? `${names[0]}与${names[1]}` : names[0]
  return appendContractTypeSuffix(joined, contractTypeLabel)
}

export const resolveSuggestedContractName = (
  result: AIContractExtractionResult,
  contractTypeOptions: SelectOption[] = [],
) => {
  const contractTypeLabel = normalizeContractTypeDisplayName(
    result.resolvedContractType || result.contractType,
    contractTypeOptions,
  )
  const aiName = trimText(result.contractName)
  if (aiName && !isGenericContractName(aiName, contractTypeLabel)) {
    return aiName.slice(0, CONTRACT_NAME_MAX_LENGTH)
  }

  const projectLikeName = findProjectLikeValueFromFields(result) || findProjectLikeValueFromSummary(result.contractSummary)
  if (projectLikeName) {
    return appendContractTypeSuffix(projectLikeName, contractTypeLabel).slice(0, CONTRACT_NAME_MAX_LENGTH)
  }

  const partyBasedName = buildPartyBasedContractName(result.clientName || '', result.partyBName || '', contractTypeLabel)
  if (partyBasedName) return partyBasedName.slice(0, CONTRACT_NAME_MAX_LENGTH)

  const fallbackType = contractTypeLabel || '合同'
  return `${fallbackType}${new Date().toISOString().slice(0, 10).replace(/-/g, '')}`.slice(0, CONTRACT_NAME_MAX_LENGTH)
}

export const normalizeProjectColor = (value: string) => {
  const current = String(value || '').trim()
  const allowed = new Set(tailwind700Colors.map((item) => item.value))
  return allowed.has(current) ? current : '#1d4ed8'
}

export const toSelectOptions = (items: Array<{ name: string; value?: string | null }>): SelectOption[] => {
  return items
    .map((item) => {
      const rawValue = String((item as any).value ?? '').trim()
      const value = rawValue || String(item.name || '').trim()
      const label = String(item.name || value).trim()
      return { label, value }
    })
    .filter((item) => item.label && item.value)
}

export const buildIndentedTreeOptions = (items: Array<{ id: string; parent_id: string; name: string; value?: string | null }>): SelectOption[] => {
  const byParent = new Map<string, Array<{ id: string; parent_id: string; name: string; value?: string | null }>>()
  for (const item of items) {
    const parent = String(item.parent_id || '')
    const list = byParent.get(parent) ?? []
    list.push(item)
    byParent.set(parent, list)
  }
  const ids = new Set(items.map((item) => String(item.id)))
  const rootParents = new Set<string>()
  for (const item of items) {
    const parent = String(item.parent_id || '')
    if (!parent || parent === '0' || !ids.has(parent)) rootParents.add(parent)
  }
  const roots: Array<{ id: string; parent_id: string; name: string; value?: string | null }> = []
  for (const parent of rootParents) {
    roots.push(...(byParent.get(parent) ?? []))
  }
  const options: SelectOption[] = []
  const dfs = (node: { id: string; parent_id: string; name: string; value?: string | null }, level: number) => {
    const rawValue = String((node as any).value ?? '').trim()
    const value = rawValue || String(node.name || '').trim()
    if (value) options.push({ label: `${'—'.repeat(level)}${node.name}`, value })
    for (const child of byParent.get(String(node.id)) ?? []) dfs(child, level + 1)
  }
  roots.forEach((root) => dfs(root, 0))
  return options
}

export const buildTreeNodes = (items: Array<{ id: string; parent_id: string; name: string; value?: string | null }>): TreeNodeOption[] => {
  const byParent = new Map<string, Array<{ id: string; parent_id: string; name: string; value?: string | null }>>()
  for (const item of items) {
    const parent = String(item.parent_id || '')
    const list = byParent.get(parent) ?? []
    list.push(item)
    byParent.set(parent, list)
  }
  const ids = new Set(items.map((item) => String(item.id)))
  const rootParents = new Set<string>()
  for (const item of items) {
    const parent = String(item.parent_id || '')
    if (!parent || parent === '0' || !ids.has(parent)) rootParents.add(parent)
  }
  const roots: Array<{ id: string; parent_id: string; name: string; value?: string | null }> = []
  for (const parent of rootParents) {
    roots.push(...(byParent.get(parent) ?? []))
  }
  const buildNode = (node: { id: string; parent_id: string; name: string; value?: string | null }): TreeNodeOption => {
    const rawValue = String((node as any).value ?? '').trim()
    const value = rawValue || String(node.name || '').trim()
    return {
      key: value,
      label: String(node.name || value).trim(),
      data: value,
      children: (byParent.get(String(node.id)) ?? []).map(buildNode),
    }
  }
  return roots.map(buildNode)
}

export const buildFlatTreeNodes = (options: SelectOption[]): TreeNodeOption[] => {
  return options.map((option) => ({
    key: option.value,
    label: option.label,
    data: option.value,
    children: [],
  }))
}

export type GroupTreeNode = { key?: string; label?: string; data?: string; children?: GroupTreeNode[] }

export const normalizeGroupTreeNodeText = (value: unknown) => String(value ?? '').trim()

export const findGroupTreeNode = (nodes: GroupTreeNode[], predicate: (node: GroupTreeNode) => boolean): GroupTreeNode | null => {
  for (const node of nodes) {
    if (predicate(node)) return node
    const children = Array.isArray(node.children) ? node.children : []
    const found = findGroupTreeNode(children, predicate)
    if (found) return found
  }
  return null
}

export const buildDepartmentTreeFromGroupNode = (node: GroupTreeNode): TreeNodeOption => {
  const label = normalizeGroupTreeNodeText(node.label ?? node.data ?? '')
  const key = normalizeGroupTreeNodeText(node.key ?? node.data ?? node.label ?? '') || label
  return {
    key,
    label,
    data: label,
    children: (Array.isArray(node.children) ? node.children : []).map(buildDepartmentTreeFromGroupNode),
  }
}

export const buildDepartmentOptionsFromTreeNodes = (nodes: TreeNodeOption[], level = 0): SelectOption[] => {
  const result: SelectOption[] = []
  for (const node of nodes) {
    const value = String(node.data || node.label || '').trim()
    const label = String(node.label || value).trim()
    if (value) result.push({ label: `${'—'.repeat(level)}${label}`, value })
    if (Array.isArray(node.children) && node.children.length > 0) {
      result.push(...buildDepartmentOptionsFromTreeNodes(node.children, level + 1))
    }
  }
  return result
}

export const createDefaultFormState = (currentSchema: ContractFormSchema) => {
  const values: Record<string, any> = {
    contractName: '',
    contractCode: '',
    signingDate: null,
    endDate: null,
    contractType: '',
    groupName: '',
    currency: '',
    contractAmount: null,
    contractStatus: '',
    department: '',
    responsiblePerson: '',
    settlementMethod: '',
    signingForm: '',
    procurementSource: '',
    executionMethod: '',
    clientName: '',
    partyAContact: '',
    partyAContactMobile: '',
    partyAContactPhone: '',
    partyAContactEmail: '',
    partyAContactIdNumber: '',
    partyBName: '',
    partyBContact: '',
    partyBContactMobile: '',
    partyBContactPhone: '',
    partyBContactEmail: '',
    partyBContactIdNumber: '',
    contractSummary: '',
    remark: '',
    projectIcon: 'pi pi-file-edit',
    projectColor: '#1d4ed8',
  }
  for (const field of currentSchema.fields) {
    if (field.builtin) continue
    if (field.type === 'multiselect') values[field.key] = []
    else if (field.type === 'number') values[field.key] = null
    else if (field.type === 'date') values[field.key] = null
    else values[field.key] = ''
  }
  return values
}

export const sortFieldsForDisplay = (fields: ContractFormSchemaField[]) => {
  return [...fields].sort((a, b) => {
    if (a.required !== b.required) return a.required ? -1 : 1
    if (a.order !== b.order) return a.order - b.order
    return a.key.localeCompare(b.key, 'zh-CN')
  })
}

export const parseDate = (value: string | null | undefined): Date | null => {
  const text = String(value || '').trim()
  if (!text) return null
  const date = new Date(text)
  return Number.isNaN(date.getTime()) ? null : date
}

export const formatDate = (date: Date) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export const parseDateText = (value: string | null | undefined): Date | null => {
  const raw = String(value || '').trim()
  if (!raw) return null

  const dateLikeMatch = raw.match(/(\d{4}\s*[年./-]\s*\d{1,2}\s*[月./-]\s*\d{1,2}\s*日?)/)
  const text = String(dateLikeMatch?.[1] || raw).trim()

  const normalized = text
    .replace(/[年月]/g, '-')
    .replace(/日/g, '')
    .replace(/\./g, '-')
    .replace(/\//g, '-')
    .replace(/\s+/g, '')
  const date = new Date(normalized)
  return Number.isNaN(date.getTime()) ? null : date
}

export const matchOptionValue = (options: SelectOption[], value: string) => {
  const text = String(value || '').trim().toLowerCase()
  if (!text) return ''
  const matched = options.find((option) => {
    const optionValue = String(option.value || '').trim().toLowerCase()
    const optionLabel = String(option.label || '').trim().toLowerCase()
    return optionValue === text || optionLabel === text
  })
  if (matched) return matched.value

  const compact = text.replace(/\s+/g, '')
  const prefixMatch = compact.match(/^([a-z0-9._-]+)[(（].+[)）]$/i)
  if (prefixMatch?.[1]) {
    const prefix = prefixMatch[1].toLowerCase()
    const matchedPrefix = options.find((option) => String(option.value || '').trim().toLowerCase() === prefix)
    if (matchedPrefix) return matchedPrefix.value
  }

  return ''
}

export const normalizeTreeSelectSingleKey = (value: unknown): string => {
  if (value === null || value === undefined || value === '') return ''
  if (typeof value === 'object' && !Array.isArray(value)) {
    const keys = Object.keys(value as Record<string, unknown>)
      .filter((k) => Boolean((value as any)[k]))
      .map((k) => String(k || '').trim())
      .filter(Boolean)
    return keys[0] || ''
  }
  return String(value || '').trim()
}
