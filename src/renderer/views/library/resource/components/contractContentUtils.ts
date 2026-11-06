import type { ContractResource } from '../types/contractResource'
import { renderContractSummaryToHtml } from '../../../../utils/contractSummaryMarkdown'

export const categoryLabels: Record<string, string> = {
  rd_contract: '研发合同',
  entrusted_development: '委托开发合同',
  technical_service: '技术服务合同',
  software_procurement: '软件采购合同',
  maintenance_service: '维护服务合同',
}

export function getResourceIcon(type: string): string {
  const icons: Record<string, string> = {
    'contract-info': '📑',
    'software-project': '🧩',
    other: '🧩'
  }
  return icons[type] || icons.other
}

export function getTypeText(resource: ContractResource): string {
  const type = resource.contractType || resource.softwareCategory || ''
  return categoryLabels[type] || '合同信息'
}

export function getDateText(resource: ContractResource): string {
  return resource.signingDate || resource.completionDate || resource.date || '-'
}

export function getContractCode(resource: ContractResource): string {
  return resource.contractCode || resource.version || resource.size || '-'
}

export function getContractName(resource: ContractResource): string {
  return resource.contractName || resource.name || '-'
}

export function getClientName(resource: ContractResource): string {
  return resource.clientName || resource.copyrightOwner || '-'
}

export function getPartyBName(resource: ContractResource): string {
  return resource.partyBName || '-'
}

export function getSigningDate(resource: ContractResource): string {
  return resource.signingDate || resource.completionDate || resource.date || '-'
}

export function getUpdatedAt(resource: ContractResource): string {
  return resource.updatedAt || resource.date || '-'
}

export function getContractSummary(resource: ContractResource): string {
  // 返回原始 Markdown 文本，用于 tooltip 等场景
  return resource.contractSummary || resource.technicalFeatures || resource.description || '-'
}

/**
 * 获取合同摘要的 HTML 渲染结果（Markdown → HTML），用于 v-html 展示
 */
export function getContractSummaryHtml(resource: ContractResource): string {
  const raw = resource.contractSummary || resource.technicalFeatures || resource.description || ''
  if (!raw || raw === '-') return '-'
  return renderContractSummaryToHtml(raw) || '-'
}

export function getContractStatus(resource: ContractResource): string {
  return resource.contractStatusDisplay || resource.contractStatus || '-'
}

/**
 * 根据合同状态返回对应的 Tag severity 值
 * - success: 完结/已完成状态
 * - warn: 执行中/进行中状态
 * - danger: 作废/终止/违约等异常状态
 * - info: 其他状态或空值
 */
export function getContractStatusSeverity(resource: ContractResource): 'success' | 'warn' | 'danger' | 'info' {
  // 优先使用字典解析后的显示名，回退到原始值
  const status = (resource.contractStatusDisplay || resource.contractStatus || '').trim()
  if (!status) return 'info'

  const finishedStatuses = ['已完成', '已完结', '完结', '完成', '结束', '已结束', '已签署', '已变更', '已续签', '归档', 'closed', 'completed']
  const inProgressStatuses = ['执行', '执行中', '进行中', '履行中', '生效中', '有效', '审核中', '待审核', '审核通过', '待签署', '部分履行', '待变更', '变更中', '待续签', '续签中', 'active', 'in_progress', 'in-progress']
  const dangerStatuses = ['已作废', '已解除', '已终止', '终止', '中止', '暂停履行', '逾期', '违约', '纠纷中', '驳回', 'cancelled', 'terminated']

  if (finishedStatuses.some(s => status === s || status.includes(s))) return 'success'
  if (dangerStatuses.some(s => status === s || status.includes(s))) return 'danger'
  if (inProgressStatuses.some(s => status === s || status.includes(s))) return 'warn'

  return 'info'
}

export function formatMoney(value: number | null | undefined) {
  if (value === null || value === undefined) return '-'
  if (!Number.isFinite(value)) return '-'
  return new Intl.NumberFormat('zh-CN', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(value)
}

export function formatContractAmount(resource: ContractResource) {
  const amount = formatMoney(resource.contractAmount)
  if (amount === '-') return '-'
  const currency = String(resource.currency || '').trim()
  return currency ? `${amount} ${currency}` : amount
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`
}

export function formatDate(value: string) {
  if (!value || value === '-') return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 10) || '-'
  const yyyy = date.getFullYear()
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

export function formatDateTime(value: string) {
  if (!value || value === '-') return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  const yyyy = date.getFullYear()
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  const hh = String(date.getHours()).padStart(2, '0')
  const mi = String(date.getMinutes()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}`
}
