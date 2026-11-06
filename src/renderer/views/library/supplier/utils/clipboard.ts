import type { Supplier } from '../../../../../shared/types/supplier.types'

type SupplierContactRow = {
  name: string
  department: string
  mobile: string
  phone: string
  email: string
  id_number: string
  wechat: string
  is_primary: boolean
  is_legal_representative: boolean
}

function parseContactsJson(contacts: unknown): SupplierContactRow[] {
  if (!contacts) return []
  if (Array.isArray(contacts)) return contacts as SupplierContactRow[]
  if (typeof contacts !== 'string') return []
  try {
    const parsed = JSON.parse(contacts) as unknown
    return Array.isArray(parsed) ? (parsed as SupplierContactRow[]) : []
  } catch {
    return []
  }
}

export function formatSupplierInfoForClipboard(supplier: Supplier): string {
  const lines: string[] = []

  lines.push(`🏢 ${supplier.name || '未知供应商'}`)
  if (supplier.code) lines.push(`编号：${supplier.code}`)
  lines.push('')

  const contacts = parseContactsJson((supplier as any).contacts)
  if (contacts.length > 0) {
    lines.push('👥 联系人信息')
    contacts.forEach((c, index) => {
      const flags: string[] = []
      if (c.is_primary) flags.push('主')
      if (c.is_legal_representative) flags.push('法')
      const suffix = flags.length > 0 ? ` (${flags.join('/')})` : ''
      if (contacts.length > 1) lines.push(`联系人${index + 1}${suffix}:`)
      if (c.name) lines.push(`  姓  名：${c.name}`)
      if (c.department) lines.push(`  部  门：${c.department}`)
      if (c.mobile) lines.push(`  手  机：${c.mobile}`)
      if (c.phone) lines.push(`  电  话：${c.phone}`)
      if (c.email) lines.push(`  邮  箱：${c.email}`)
      if (c.id_number) lines.push(`  身份证：${c.id_number}`)
      if (c.wechat) lines.push(`  微  信：${c.wechat}`)
      if (index < contacts.length - 1) lines.push('')
    })
    lines.push('')
  } else if (supplier.contact || supplier.phone) {
    lines.push('📞 联系信息')
    if (supplier.contact) lines.push(`联 系 人：${supplier.contact}`)
    if (supplier.phone) lines.push(`电    话：${supplier.phone}`)
    lines.push('')
  }

  if (supplier.tax_number || supplier.invoice_type) {
    lines.push('📋 发票信息')
    if (supplier.tax_number) lines.push(`税    号：${supplier.tax_number}`)
    if (supplier.invoice_type) lines.push(`发票类型：${supplier.invoice_type}`)
    lines.push('')
  }

  if (supplier.bank_name || supplier.bank_account) {
    lines.push('🏦 银行信息')
    if (supplier.bank_name) lines.push(`开 户 行：${supplier.bank_name}`)
    if (supplier.bank_account) lines.push(`银行账号：${supplier.bank_account}`)
    lines.push('')
  }

  if (supplier.address) {
    lines.push('📌 地址信息')
    lines.push(`地    址：${supplier.address}`)
    lines.push('')
  }

  if (supplier.group_name) lines.push(`📊 分组：${supplier.group_name}`)

  return lines.join('\n')
}
