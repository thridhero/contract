export type ContractInfoFields = {
  contractName: string
  contractCode: string
  signingDate: string | Date | null
  contractType: string
  groupName?: string
  currency?: string
  clientName: string
  partyBName: string
  contractSummary: string
}

export function validateContractInfoRequiredFields(fields: ContractInfoFields): Record<string, string> {
  const errors: Record<string, string> = {}
  if (!fields.contractName || String(fields.contractName).trim() === '') {
    errors.contractName = '合同名称不能为空'
  }
  if (!fields.contractCode || String(fields.contractCode).trim() === '') {
    errors.contractCode = '合同编号不能为空'
  }
  if (!fields.signingDate) {
    errors.signingDate = '签约日期不能为空'
  }
  if (!fields.contractType || String(fields.contractType).trim() === '') {
    errors.contractType = '合同类型不能为空'
  }
  if (!fields.clientName || String(fields.clientName).trim() === '') {
    errors.clientName = '合同甲方不能为空'
  }
  if (!fields.partyBName || String(fields.partyBName).trim() === '') {
    errors.partyBName = '合同乙方不能为空'
  }
  if (!fields.contractSummary || String(fields.contractSummary).trim() === '') {
    errors.contractSummary = '合同摘要不能为空'
  }
  return errors
}
