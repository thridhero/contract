import type Database from 'better-sqlite3'
import { createContractProductsMethods } from '../../database/contractProducts'
import type { ContractProduct, ContractProductSearchField, ContractProductWarrantyStatus } from '../../../../../shared/types/contractProduct.types'
import type {
  AIAgentProductSearchArgs,
  AIAgentProductSearchItem,
  AIAgentProductSearchResult,
  AIAgentProductSearchWarrantyStatus,
} from '../../../../../shared/types/aiAgent.types'

const PRODUCT_CODE_SEARCH_FIELDS: ContractProductSearchField[] = ['code']

const normalizeKeyword = (value: string) => String(value || '').replace(/\s+/g, ' ').trim()

const extractLikelyProductCode = (value: string): string => {
  const normalized = normalizeKeyword(value)
  if (!normalized) return ''
  const matches = normalized.match(/[A-Za-z0-9][A-Za-z0-9-_]{2,}/g) || []
  if (!matches.length) return ''
  const scored = matches.map((token) => {
    const t = String(token || '').trim()
    const hasDigit = /\d/.test(t)
    const hasDash = /[-_]/.test(t)
    const score = (hasDigit ? 2 : 0) + (hasDash ? 1 : 0) + Math.min(t.length, 24) / 24
    return { token: t, score }
  })
  scored.sort((a, b) => b.score - a.score)
  return scored[0]?.token || ''
}

const resolveWarrantyStatus = (searchQuery: string): AIAgentProductSearchWarrantyStatus | undefined => {
  const normalized = normalizeKeyword(searchQuery)
  if (!normalized) return undefined
  if (/(未过期|没过期|未过保|在保|保内|有效中|未失效)/i.test(normalized)) return 'notExpired'
  if (/(已过期|过期|已过保|过保|失效)/i.test(normalized)) return 'expired'
  return undefined
}

const stripWarrantyKeywords = (searchQuery: string): string => {
  return normalizeKeyword(searchQuery)
    .replace(/未过期|没过期|未过保|在保|保内|有效中|未失效/ig, ' ')
    .replace(/已过期|过期|已过保|过保|失效/ig, ' ')
    .replace(/产品信息|产品查询|查询产品|查产品|产品列表|产品情况|产品状态|产品/ig, ' ')
    .replace(/编码为|编码是|产品编码|编码|代码/ig, ' ')
    .replace(/查询|查一下|查下|查找|帮我查|帮我查询|帮我找|看看|列出|筛选|一下/ig, ' ')
    .replace(/帮我|麻烦|请|我想|想|需要|帮忙/ig, ' ')
    .replace(/是否|情况|状态|维保|保修/ig, ' ')
    .replace(/的/g, ' ')
    .replace(/[，,。！？?；;：:]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

const mapWarrantyStatus = (value?: string | null): AIAgentProductSearchWarrantyStatus | '' => {
  const normalized = String(value || '').trim()
  if (!normalized) return ''
  const dateText = normalized.slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateText)) return ''
  const warrantyDate = new Date(`${dateText}T00:00:00`)
  if (Number.isNaN(warrantyDate.getTime())) return ''
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  return warrantyDate < today ? 'expired' : 'notExpired'
}

const mapProductItem = (item: ContractProduct): AIAgentProductSearchItem => ({
  id: item.id,
  contractId: String(item.contract_id || '').trim(),
  contractCode: String(item.contract_code || '').trim(),
  contractName: String(item.contract_name || '').trim(),
  code: String(item.code || '').trim(),
  name: String(item.name || '').trim(),
  category: String(item.category || '').trim(),
  specification: String(item.specification || '').trim(),
  unit: String(item.unit || '').trim(),
  purchaseDate: String(item.purchase_date || '').trim(),
  warrantyDate: String(item.warranty_date || '').trim(),
  warrantyStatus: mapWarrantyStatus(item.warranty_date),
  customerName: String(item.customer_name || '').trim(),
  supplierName: String(item.supplier_name || '').trim(),
  origin: String(item.origin || '').trim(),
  remark: String(item.remark || '').trim(),
})

const formatWarrantyStatusLabel = (status?: AIAgentProductSearchWarrantyStatus): string => {
  if (status === 'expired') return '已过保'
  if (status === 'notExpired') return '未过保'
  return '全部'
}

export const summarizeProductSearchResult = (result: AIAgentProductSearchResult): string => {
  if (result.emptyReason === 'missing_criteria') {
    return '缺少有效产品查询条件，请至少提供产品编码，或说明要查已过保/未过保产品。'
  }
  if (result.emptyReason === 'no_match') {
    const conditionText = result.warrantyStatus ? `，并按${formatWarrantyStatusLabel(result.warrantyStatus)}筛选` : ''
    return `未找到匹配产品，建议尝试更完整的产品编码${conditionText}后重试。`
  }

  const headerParts = [`共命中 ${result.total} 个产品`]
  if (result.warrantyStatus) {
    headerParts.push(`筛选条件：${formatWarrantyStatusLabel(result.warrantyStatus)}`)
  }
  const summary = result.items
    .slice(0, 10)
    .map(item => [
      `${item.name || '-'}（编码：${item.code || '-'}）`,
      `规格：${item.specification || '-'}`,
      `维保日期：${item.warrantyDate || '-'}`,
      `状态：${item.warrantyStatus === 'expired' ? '已过保' : item.warrantyStatus === 'notExpired' ? '未过保' : '未知'}`,
      `合同：${item.contractCode || '-'} ${item.contractName || ''}`.trim(),
      `甲方：${item.customerName || '-'}`,
      `乙方：${item.supplierName || '-'}`,
    ].join('，'))
    .join('\n')

  return `${headerParts.join('，')}，优先返回前 ${result.items.length} 个：\n${summary}`
}

type ExecuteProductSearchOptions = {
  db: Database.Database
  args: AIAgentProductSearchArgs
  pageSize?: number
}

export const executeProductSearchTool = ({
  db,
  args,
  pageSize = 10,
}: ExecuteProductSearchOptions): AIAgentProductSearchResult => {
  const rawQuery = normalizeKeyword(args.searchQuery || '')
  const warrantyStatus = args.warrantyStatus || resolveWarrantyStatus(rawQuery)
  let keyword = stripWarrantyKeywords(rawQuery)
  if (keyword && keyword.includes(' ')) {
    const extracted = extractLikelyProductCode(rawQuery)
    if (extracted) {
      keyword = extracted
    }
  } else if (!keyword) {
    const extracted = extractLikelyProductCode(rawQuery)
    if (extracted) {
      keyword = extracted
    }
  }

  if (!keyword && !warrantyStatus) {
    return {
      keyword: '',
      total: 0,
      items: [],
      warrantyStatus: undefined,
      searchFields: [],
      emptyReason: 'missing_criteria',
    }
  }

  const methods = createContractProductsMethods(() => db)
  const query = methods.getContractProducts({
    page: 1,
    pageSize,
    search: keyword || undefined,
    searchFields: keyword ? PRODUCT_CODE_SEARCH_FIELDS : undefined,
    warrantyStatus: warrantyStatus as ContractProductWarrantyStatus | undefined,
  })

  return {
    keyword,
    total: Number(query.total || 0),
    items: Array.isArray(query.data) ? query.data.map(item => mapProductItem(item)) : [],
    warrantyStatus,
    searchFields: keyword ? [...PRODUCT_CODE_SEARCH_FIELDS] : [],
    emptyReason: query.total > 0 ? undefined : 'no_match',
  }
}
