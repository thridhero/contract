export type AIAgentToolName =
  | 'contract_search'
  | 'contract_full_text_search'
  | 'contract_detail_summary'
  | 'contract_statistics'
  | 'product_search'
  | 'personnel_search'
  | 'customer_search'
  | 'supplier_search'
  | 'invoice_search'

import type {
  ContractStatisticsAIPlan,
  ContractStatisticsClarification,
  ContractStatisticsExecutionResult,
  ContractStatisticsReportStatus,
} from './contractStatistics.types'

export type AIAgentFileSearchSourceType =
  | 'contract'
  | 'other'

export interface AIAgentContractFileSearchItem {
  sourceType: AIAgentFileSearchSourceType
  fileId: string
  contractId: string
  contractNo: string
  contractName: string
  fileName: string
  filePath: string
  relativePath: string
  directoryLabel: string
  snippet: string
  canPreview: boolean
}

export interface AIAgentContractFileSearchResult {
  keyword: string
  total: number
  items: AIAgentContractFileSearchItem[]
  indexing: boolean
  lastIndexedAt?: number
  lastError?: string
}

export type AIAgentProductSearchWarrantyStatus = 'expired' | 'notExpired'

export type AIAgentProductSearchEmptyReason =
  | 'no_match'
  | 'missing_criteria'

export interface AIAgentProductSearchArgs {
  searchQuery?: string
  warrantyStatus?: AIAgentProductSearchWarrantyStatus
}

export interface AIAgentProductSearchItem {
  id: string
  contractId: string
  contractCode: string
  contractName: string
  code: string
  name: string
  category: string
  specification: string
  unit: string
  purchaseDate: string
  warrantyDate: string
  warrantyStatus: AIAgentProductSearchWarrantyStatus | ''
  customerName: string
  supplierName: string
  origin: string
  remark: string
}

export interface AIAgentProductSearchResult {
  keyword: string
  total: number
  items: AIAgentProductSearchItem[]
  warrantyStatus?: AIAgentProductSearchWarrantyStatus
  searchFields: string[]
  emptyReason?: AIAgentProductSearchEmptyReason
}

export type AIAgentPersonnelSearchQueryType =
  | 'name'
  | 'phone'
  | 'id_card_number'
  | 'department'
  | 'document'

export type AIAgentPersonnelSearchEmptyReason =
  | 'no_match'
  | 'no_department'
  | 'department_without_personnel'

export interface AIAgentPersonnelSearchArgs {
  searchQuery: string
  queryType: AIAgentPersonnelSearchQueryType
}

export interface AIAgentPersonnelSearchItem {
  id: string
  name: string
  position: string
  phone: string
  email: string
  idCardNumber: string
  departmentNames: string[]
  matchedDepartmentNames?: string[]
  documentNames?: string[]
  documentTypes?: string[]
}

export interface AIAgentPersonnelSearchDepartmentMatch {
  id: string
  name: string
  personnelCount: number
}

export interface AIAgentPersonnelSearchResult {
  queryType: AIAgentPersonnelSearchQueryType
  keyword: string
  total: number
  items: AIAgentPersonnelSearchItem[]
  matchedDepartments?: AIAgentPersonnelSearchDepartmentMatch[]
  emptyReason?: AIAgentPersonnelSearchEmptyReason
}

export type AIAgentPartyUnitSearchPartyType =
  | 'party_a'
  | 'party_b'

export type AIAgentPartyUnitSearchEmptyReason =
  | 'no_match'

export interface AIAgentPartyUnitSearchArgs {
  searchQuery: string
  partyType: AIAgentPartyUnitSearchPartyType
}

export interface AIAgentPartyUnitSearchItem {
  partyType: AIAgentPartyUnitSearchPartyType
  id: string
  code: string
  name: string
  groupName: string
  contact: string
  department: string
  mobile: string
  phone: string
  email: string
  address: string
  taxNumber: string
  bankName: string
  bankAccount: string
  invoiceType: string
  legalRepName: string
  legalRepMobile: string
  legalRepEmail: string
  legalRepIdNumber: string
}

export interface AIAgentPartyUnitSearchResult {
  partyType: AIAgentPartyUnitSearchPartyType
  keyword: string
  total: number
  items: AIAgentPartyUnitSearchItem[]
  emptyReason?: AIAgentPartyUnitSearchEmptyReason
}

export type AIAgentInvoiceSearchEmptyReason = 'no_match'

export interface AIAgentInvoiceSearchArgs {
  searchQuery: string
}

export interface AIAgentInvoiceSearchItem {
  id: string
  contractId: string
  contractCode: string
  contractName: string
  fileId: string
  sourcePath: string
  invoiceType: string
  invoiceCode: string
  invoiceNo: string
  invoiceDate: string
  issueDate: string
  sellerName: string
  sellerTaxNo: string
  buyerName: string
  buyerTaxNo: string
  amountWithoutTax?: number
  taxAmount?: number
  amountWithTax?: number
  totalAmount?: number
  currency: string
  parseStatus: string
  parseEngine: string
  createdAt: string
  updatedAt: string
}

export interface AIAgentInvoiceSearchResult {
  keyword: string
  total: number
  items: AIAgentInvoiceSearchItem[]
  searchFields: string[]
  emptyReason?: AIAgentInvoiceSearchEmptyReason
}

export interface AIAgentContractStatisticsToolData {
  kind: 'contract_statistics'
  status: ContractStatisticsReportStatus
  question: string
  plan?: ContractStatisticsAIPlan
  clarification?: ContractStatisticsClarification
  execution?: ContractStatisticsExecutionResult
}

export interface AIAgentSettings {
  modelId: string
  enableTools: boolean
  compressionThreshold: number
  availableTools: AIAgentToolName[]
}

export type AIAgentMessageRole = 'user' | 'assistant' | 'system' | 'tool'
export type AIAgentToolStatus = 'success' | 'error'

export interface AIAgentToolCallRecord {
  id: string
  toolName: AIAgentToolName
  title: string
  args: Record<string, unknown>
  status: AIAgentToolStatus
  summary: string
  rawData?: unknown
  createdAt: string
}

export interface AIAgentMessage {
  id: string
  role: AIAgentMessageRole
  content: string
  createdAt: string
  toolCalls?: AIAgentToolCallRecord[]
}

export interface AIAgentCompressionSnapshot {
  summary: string
  keyEntities: string[]
  recentFocus: string
  compressedAt: string
}

export interface AIAgentSession {
  id: string
  title: string
  libraryPath: string
  createdAt: string
  updatedAt: string
  messages: AIAgentMessage[]
  compression?: AIAgentCompressionSnapshot
}

export interface AIAgentSessionSummary {
  id: string
  title: string
  libraryPath: string
  updatedAt: string
  lastMessagePreview: string
}

export interface AIAgentCreateSessionRequest {
  libraryPath: string
  title?: string
}

export interface AIAgentCreateSessionResult {
  session: AIAgentSession
}

export interface AIAgentSendMessageRequest {
  sessionId: string
  libraryPath: string
  content: string
}

export interface AIAgentSendMessageResult {
  session: AIAgentSession
  assistantMessage: AIAgentMessage
}

export interface AIAgentGetSessionRequest {
  sessionId: string
}

export interface AIAgentDeleteSessionRequest {
  sessionId: string
}

export interface AIAgentRenameSessionRequest {
  sessionId: string
  title: string
}

export interface AIAgentRenameSessionResult {
  session: AIAgentSession
}
