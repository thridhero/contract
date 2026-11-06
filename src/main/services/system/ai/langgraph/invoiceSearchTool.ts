import type Database from 'better-sqlite3'
import { createContractInvoicesMethods } from '../../database/contractInvoices'
import type {
  ContractInvoice,
  ContractInvoiceQueryDTO,
  ContractInvoiceSearchField,
} from '../../../../../shared/types/contractInvoice.types'
import type {
  AIAgentInvoiceSearchArgs,
  AIAgentInvoiceSearchItem,
  AIAgentInvoiceSearchResult,
} from '../../../../../shared/types/aiAgent.types'

const DEFAULT_INVOICE_SEARCH_FIELDS: ContractInvoiceSearchField[] = [
  'contract_code',
  'contract_name',
  'source_path',
  'invoice_type',
  'invoice_code',
  'invoice_no',
  'seller_name',
  'seller_tax_no',
  'buyer_name',
  'buyer_tax_no',
  'currency',
  'parse_status',
  'parse_engine',
  'parse_error',
  'parse_errors',
]

const normalizeKeyword = (value: string) => String(value || '').replace(/\s+/g, ' ').trim()

const resolveParseStatus = (searchQuery: string): ContractInvoiceQueryDTO['parseStatus'] | undefined => {
  const normalized = normalizeKeyword(searchQuery)
  if (!normalized) return undefined
  if (/(解析失败|失败发票|失败的发票|failed)/i.test(normalized)) return 'failed'
  if (/(解析成功|成功发票|成功的发票|success)/i.test(normalized)) return 'success'
  if (/(解析中|处理中|processing)/i.test(normalized)) return 'processing'
  return undefined
}

const stripParseStatusKeywords = (searchQuery: string): string => {
  return normalizeKeyword(searchQuery)
    .replace(/解析失败|失败发票|失败的发票|failed/ig, ' ')
    .replace(/解析成功|成功发票|成功的发票|success/ig, ' ')
    .replace(/解析中|处理中|processing/ig, ' ')
    .replace(/发票信息|发票查询|查找发票|查询发票|发票/ig, ' ')
    .replace(/的/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

const resolveInvoiceSearchFields = (searchQuery: string): ContractInvoiceSearchField[] => {
  const normalized = normalizeKeyword(searchQuery)
  const compact = normalized.replace(/\s+/g, '')
  if (/^[A-Za-z0-9-]{6,}$/.test(compact)) {
    return ['invoice_no', 'invoice_code', 'contract_code']
  }
  if (/(专票|普票|电子发票|纸质发票|发票类型)/.test(normalized)) {
    return ['invoice_type', 'invoice_no', 'invoice_code', 'contract_name', 'contract_code']
  }
  return [...DEFAULT_INVOICE_SEARCH_FIELDS]
}

const mapInvoiceItem = (item: ContractInvoice): AIAgentInvoiceSearchItem => ({
  id: item.id,
  contractId: String(item.contract_id || '').trim(),
  contractCode: String(item.contract_code || '').trim(),
  contractName: String(item.contract_name || '').trim(),
  fileId: String(item.file_id || '').trim(),
  sourcePath: String(item.source_path || '').trim(),
  invoiceType: String(item.invoice_type || '').trim(),
  invoiceCode: String(item.invoice_code || '').trim(),
  invoiceNo: String(item.invoice_no || '').trim(),
  invoiceDate: String(item.invoice_date || '').trim(),
  issueDate: String(item.issue_date || '').trim(),
  sellerName: String(item.seller_name || '').trim(),
  sellerTaxNo: String(item.seller_tax_no || '').trim(),
  buyerName: String(item.buyer_name || '').trim(),
  buyerTaxNo: String(item.buyer_tax_no || '').trim(),
  amountWithoutTax: item.amount_without_tax ?? undefined,
  taxAmount: item.tax_amount ?? undefined,
  amountWithTax: item.amount_with_tax ?? undefined,
  totalAmount: item.total_amount ?? undefined,
  currency: String(item.currency || '').trim(),
  parseStatus: String(item.parse_status || '').trim(),
  parseEngine: String(item.parse_engine || '').trim(),
  createdAt: String(item.created_at || '').trim(),
  updatedAt: String(item.updated_at || '').trim(),
})

const formatAmount = (value?: number, currency?: string): string => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return '-'
  }
  const formatted = Number.isInteger(value) ? String(value) : value.toFixed(2)
  const currencyText = String(currency || '').trim()
  return currencyText ? `${formatted} ${currencyText}` : formatted
}

export const summarizeInvoiceSearchResult = (result: AIAgentInvoiceSearchResult): string => {
  if (result.emptyReason === 'no_match') {
    return '未找到匹配发票，建议尝试发票号码、发票代码、销方/购方名称、合同编号或合同名称重新查询。'
  }

  const summary = result.items
    .slice(0, 10)
    .map(item => [
      `${item.invoiceNo || '-'}（代码：${item.invoiceCode || '-'}，类型：${item.invoiceType || '-'}）`,
      `合同：${item.contractCode || '-'} ${item.contractName || ''}`.trim(),
      `销方：${item.sellerName || '-'}，购方：${item.buyerName || '-'}`,
      `价税合计：${formatAmount(item.totalAmount, item.currency)}`,
      `开票日期：${item.issueDate || item.invoiceDate || '-'}`,
    ].join('，'))
    .join('\n')

  return `共命中 ${result.total} 张发票，优先返回前 ${result.items.length} 张：\n${summary}`
}

type ExecuteInvoiceSearchOptions = {
  db: Database.Database
  args: Pick<AIAgentInvoiceSearchArgs, 'searchQuery'>
  pageSize?: number
}

export const executeInvoiceSearchTool = ({
  db,
  args,
  pageSize = 10,
}: ExecuteInvoiceSearchOptions): AIAgentInvoiceSearchResult => {
  const searchQuery = normalizeKeyword(args.searchQuery || '')
  if (!searchQuery) {
    return {
      keyword: '',
      total: 0,
      items: [],
      searchFields: [...DEFAULT_INVOICE_SEARCH_FIELDS],
      emptyReason: 'no_match',
    }
  }

  const contractInvoicesMethods = createContractInvoicesMethods(() => db)
  const parseStatus = resolveParseStatus(searchQuery)
  const fuzzySearchQuery = stripParseStatusKeywords(searchQuery)
  const searchFields = resolveInvoiceSearchFields(fuzzySearchQuery || searchQuery)
  const query: ContractInvoiceQueryDTO = {
    page: 1,
    pageSize,
    search: fuzzySearchQuery || undefined,
    searchFields: fuzzySearchQuery ? searchFields : undefined,
    parseStatus,
    sortBy: 'created_at',
    sortOrder: 'desc',
  }
  const invoiceResult = contractInvoicesMethods.getContractInvoices(query)

  return {
    keyword: searchQuery,
    total: Number(invoiceResult.total || 0),
    items: Array.isArray(invoiceResult.data) ? invoiceResult.data.map(item => mapInvoiceItem(item)) : [],
    searchFields: fuzzySearchQuery ? [...searchFields] : [],
    emptyReason: invoiceResult.total > 0 ? undefined : 'no_match',
  }
}
