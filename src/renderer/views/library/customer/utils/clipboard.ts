import type { Customer } from '../../../../../shared/types/customer.types'

export function formatCustomerInfoForClipboard(customer: Customer): string {
  const lines: string[] = []

  lines.push(`🏢 ${customer.name || '未知客户'}`)
  if (customer.code) lines.push(`编号：${customer.code}`)
  lines.push('')

  lines.push('📞 联系信息')
  if (customer.contact) lines.push(`联 系 人：${customer.contact}`)
  if ((customer as any).mobile) lines.push(`手机：${(customer as any).mobile}`)
  if ((customer as any).phone) lines.push(`电话：${(customer as any).phone}`)
  lines.push('')

  if (customer.tax_number || customer.invoice_type || customer.bank_name || customer.bank_account) {
    lines.push('📋 发票信息')
    if (customer.tax_number) lines.push(`税    号：${customer.tax_number}`)
    if (customer.invoice_type) lines.push(`发票类型：${customer.invoice_type}`)
    if (customer.bank_name) lines.push(`开 户 行：${customer.bank_name}`)
    if (customer.bank_account) lines.push(`银行账号：${customer.bank_account}`)
    lines.push('')
  }

  if ((customer as any).company_type || customer.address) {
    lines.push('📌 公司信息')
    if ((customer as any).company_type) lines.push(`公司类型：${(customer as any).company_type}`)
    if (customer.address) lines.push(`地    址：${customer.address}`)
    lines.push('')
  }

  if (customer.group_name) lines.push(`📊 分组：${customer.group_name}`)

  return lines.join('\n')
}
