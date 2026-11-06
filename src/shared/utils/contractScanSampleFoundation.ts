import type {
  ContractBuiltinFieldKey,
  ContractFieldType,
  ContractFormSchemaConfig,
  ContractFormSection,
} from '../types/contractFormSchema.types'
import {
  CONTRACT_BUILTIN_FIELD_KEYS,
} from '../types/contractFormSchema.types'
import type {
  ContractScanReceiptPlanScenario,
  ContractScanSampleContractTypeFieldGroup,
  ContractScanSampleFieldMatrixItem,
  ContractScanSampleFoundation,
  ContractScanSampleGroundTruth,
  ContractScanSampleGroundTruthFieldValue,
  ContractScanSampleGroundTruthFieldMap,
} from '../types/contractScanSample.types'
import {
  CONTRACT_SCAN_SAMPLE_FOUNDATION_VERSION,
} from '../types/contractScanSample.types'
import {
  getDefaultContractFormSchemaConfig,
  normalizeContractFormSchemaConfig,
  resolveContractFormSchema,
} from './contractFormSchema'
import {
  BUILTIN_FIELD_DEFINITIONS,
  CONTRACT_TYPE_SEED_ALIASES,
  CORE_REQUIRED_FIELDS,
} from './contractFormSchemaSeeds'

type SupplementalBuiltinDefinition = {
  label: string
  type: ContractFieldType
  section: ContractFormSection
  options?: string[]
  notes?: string
}

const BUILTIN_FIELD_DEFINITION_MAP = new Map(
  BUILTIN_FIELD_DEFINITIONS.map(field => [field.key, field] as const),
)

const SUPPLEMENTAL_BUILTIN_DEFINITIONS: Partial<Record<ContractBuiltinFieldKey, SupplementalBuiltinDefinition>> = {
  partyAContact: { label: '甲方联系人', type: 'text', section: 'base' },
  partyAContactMobile: { label: '甲方联系人手机号', type: 'text', section: 'base' },
  partyAContactPhone: { label: '甲方联系人电话', type: 'text', section: 'base' },
  partyAContactEmail: { label: '甲方联系人邮箱', type: 'text', section: 'base' },
  partyAContactIdNumber: { label: '甲方联系人身份证号', type: 'text', section: 'base' },
  partyBContact: { label: '乙方联系人', type: 'text', section: 'base' },
  partyBContactMobile: { label: '乙方联系人手机号', type: 'text', section: 'base' },
  partyBContactPhone: { label: '乙方联系人电话', type: 'text', section: 'base' },
  partyBContactEmail: { label: '乙方联系人邮箱', type: 'text', section: 'base' },
  partyBContactIdNumber: { label: '乙方联系人身份证号', type: 'text', section: 'base' },
  groupName: { label: '合同分组', type: 'text', section: 'base' },
  currency: { label: '币种', type: 'select', section: 'base' },
  contractTags: { label: '标签', type: 'multiselect', section: 'content' },
}

const PRIMARY_CONTRACT_TYPE_LABELS: Record<string, string> = {
  FINANCE: '金融担保',
  COOPERATION: '战略合作',
  LEASE: '租赁',
  PURCHASE: '买卖采购',
  LABOR: '劳动合同',
  LEGAL: '法律服务',
  IT_SERVICE: '技术服务',
  IT_DEV: '软件开发',
}

const PARTY_B_UNIT_FIELDS: ContractScanSampleFieldMatrixItem[] = [
  { key: 'name', label: '单位名称', domain: 'partyBUnit', fieldType: 'text', required: true, coverageLevel: 'at_least_once', defaultTruthExpectation: 'must_hit', mappedFormFieldKeys: ['partyBName'] },
  { key: 'legal_rep_name', label: '法人姓名', domain: 'partyBUnit', fieldType: 'text', required: false, coverageLevel: 'at_least_once', defaultTruthExpectation: 'optional_hit', mappedFormFieldKeys: ['partyBLegalRepName'] },
  { key: 'legal_rep_id_number', label: '法人身份证号', domain: 'partyBUnit', fieldType: 'text', required: false, coverageLevel: 'at_least_once', defaultTruthExpectation: 'optional_hit', mappedFormFieldKeys: ['partyBLegalRepIdNumber'] },
  { key: 'legal_rep_mobile', label: '法人手机', domain: 'partyBUnit', fieldType: 'text', required: false, coverageLevel: 'at_least_once', defaultTruthExpectation: 'optional_hit', mappedFormFieldKeys: ['partyBLegalRepMobile'] },
  { key: 'legal_rep_email', label: '法人邮箱', domain: 'partyBUnit', fieldType: 'text', required: false, coverageLevel: 'at_least_once', defaultTruthExpectation: 'optional_hit', mappedFormFieldKeys: ['partyBLegalRepEmail'] },
  { key: 'phone', label: '联系电话', domain: 'partyBUnit', fieldType: 'text', required: false, coverageLevel: 'at_least_once', defaultTruthExpectation: 'optional_hit', mappedFormFieldKeys: ['partyBPhone'] },
  { key: 'invoice_type', label: '发票类型', domain: 'partyBUnit', fieldType: 'select', required: false, coverageLevel: 'at_least_once', defaultTruthExpectation: 'optional_hit', mappedFormFieldKeys: ['partyBInvoiceType'], options: ['专票', '普票'] },
  { key: 'address', label: '单位地址', domain: 'partyBUnit', fieldType: 'text', required: false, coverageLevel: 'at_least_once', defaultTruthExpectation: 'optional_hit', mappedFormFieldKeys: ['partyBAddress'] },
  { key: 'tax_number', label: '税号', domain: 'partyBUnit', fieldType: 'text', required: false, coverageLevel: 'at_least_once', defaultTruthExpectation: 'optional_hit', mappedFormFieldKeys: ['partyBTaxNumber'] },
  { key: 'bank_name', label: '开户行', domain: 'partyBUnit', fieldType: 'text', required: false, coverageLevel: 'at_least_once', defaultTruthExpectation: 'optional_hit', mappedFormFieldKeys: ['partyBBankName'] },
  { key: 'bank_account', label: '银行账号', domain: 'partyBUnit', fieldType: 'text', required: false, coverageLevel: 'at_least_once', defaultTruthExpectation: 'optional_hit', mappedFormFieldKeys: ['partyBBankAccount'] },
]

const PARTY_B_CONTACT_FIELDS: ContractScanSampleFieldMatrixItem[] = [
  { key: 'name', label: '联系人姓名', domain: 'partyBContact', fieldType: 'text', required: false, coverageLevel: 'at_least_once', defaultTruthExpectation: 'optional_hit', mappedFormFieldKeys: ['partyBContact'] },
  { key: 'id_number', label: '联系人身份证号', domain: 'partyBContact', fieldType: 'text', required: false, coverageLevel: 'at_least_once', defaultTruthExpectation: 'optional_hit', mappedFormFieldKeys: ['partyBContactIdNumber'] },
  { key: 'department', label: '联系人部门', domain: 'partyBContact', fieldType: 'text', required: false, coverageLevel: 'at_least_once', defaultTruthExpectation: 'manual_fill_allowed', notes: '当前新增合同弹窗未直接承载该字段，保留在真值中供后续样本生成和人工核对使用。' },
  { key: 'mobile', label: '联系人手机', domain: 'partyBContact', fieldType: 'text', required: false, coverageLevel: 'at_least_once', defaultTruthExpectation: 'optional_hit', mappedFormFieldKeys: ['partyBContactMobile'] },
  { key: 'phone', label: '联系人电话', domain: 'partyBContact', fieldType: 'text', required: false, coverageLevel: 'at_least_once', defaultTruthExpectation: 'optional_hit', mappedFormFieldKeys: ['partyBContactPhone'] },
  { key: 'email', label: '联系人邮箱', domain: 'partyBContact', fieldType: 'text', required: false, coverageLevel: 'at_least_once', defaultTruthExpectation: 'optional_hit', mappedFormFieldKeys: ['partyBContactEmail'] },
  { key: 'wechat', label: '联系人微信', domain: 'partyBContact', fieldType: 'text', required: false, coverageLevel: 'at_least_once', defaultTruthExpectation: 'manual_fill_allowed', notes: '当前新增合同弹窗未直接承载该字段，保留在真值中供后续样本生成和人工核对使用。' },
  { key: 'is_primary', label: '主联系人标记', domain: 'partyBContact', fieldType: 'select', required: false, coverageLevel: 'at_least_once', defaultTruthExpectation: 'manual_fill_allowed', options: ['true', 'false'] },
  { key: 'is_legal_representative', label: '法人标记', domain: 'partyBContact', fieldType: 'select', required: false, coverageLevel: 'at_least_once', defaultTruthExpectation: 'manual_fill_allowed', options: ['true', 'false'] },
]

const RECEIPT_PLAN_FIELDS: ContractScanSampleFieldMatrixItem[] = [
  { key: 'plan_name', label: '收付款名称', domain: 'receiptPlan', fieldType: 'text', required: true, coverageLevel: 'scenario_required', defaultTruthExpectation: 'must_hit', mappedFormFieldKeys: ['plan_name'] },
  { key: 'direction', label: '收付方向', domain: 'receiptPlan', fieldType: 'select', required: true, coverageLevel: 'scenario_required', defaultTruthExpectation: 'must_hit', mappedFormFieldKeys: ['direction'], options: ['收款', '付款'] },
  { key: 'receipt_frequency', label: '收付频率', domain: 'receiptPlan', fieldType: 'select', required: false, coverageLevel: 'scenario_required', defaultTruthExpectation: 'optional_hit', mappedFormFieldKeys: ['receipt_frequency'] },
  { key: 'expected_date', label: '应收(付)日期', domain: 'receiptPlan', fieldType: 'date', required: false, coverageLevel: 'scenario_required', defaultTruthExpectation: 'optional_hit', mappedFormFieldKeys: ['expected_date'] },
  { key: 'expected_amount', label: '应收(付)金额', domain: 'receiptPlan', fieldType: 'number', required: false, coverageLevel: 'scenario_required', defaultTruthExpectation: 'optional_hit', mappedFormFieldKeys: ['expected_amount'] },
  { key: 'ratio', label: '比例(%)', domain: 'receiptPlan', fieldType: 'number', required: false, coverageLevel: 'scenario_required', defaultTruthExpectation: 'optional_hit', mappedFormFieldKeys: ['ratio'] },
  { key: 'remark', label: '备注/触发条件', domain: 'receiptPlan', fieldType: 'text', required: false, coverageLevel: 'scenario_required', defaultTruthExpectation: 'optional_hit', mappedFormFieldKeys: ['remark'] },
]

export const CONTRACT_SCAN_SAMPLE_RECEIPT_PLAN_SCENARIOS: ContractScanReceiptPlanScenario[] = [
  'single_installment',
  'double_installment',
  'multi_installment',
]

function cloneFieldItem(field: ContractScanSampleFieldMatrixItem): ContractScanSampleFieldMatrixItem {
  return {
    ...field,
    mappedFormFieldKeys: field.mappedFormFieldKeys ? [...field.mappedFormFieldKeys] : undefined,
    options: field.options ? [...field.options] : undefined,
    optionSource: field.optionSource ? { ...field.optionSource } : undefined,
  }
}

function buildContractTypeLabelMap(): Record<string, string[]> {
  const labelsByType = new Map<string, string[]>()
  for (const [label, typeKey] of Object.entries(CONTRACT_TYPE_SEED_ALIASES)) {
    const list = labelsByType.get(typeKey) || []
    list.push(label)
    labelsByType.set(typeKey, list)
  }

  return Object.fromEntries(
    Array.from(labelsByType.entries()).map(([typeKey, labels]) => [
      typeKey,
      labels.sort((a, b) => a.localeCompare(b, 'zh-CN')),
    ]),
  )
}

const CONTRACT_TYPE_LABEL_MAP = buildContractTypeLabelMap()

function getContractTypeLabel(typeKey: string): string {
  return PRIMARY_CONTRACT_TYPE_LABELS[typeKey]
    || CONTRACT_TYPE_LABEL_MAP[typeKey]?.[0]
    || typeKey
}

function getBuiltinFieldMatrixItem(key: ContractBuiltinFieldKey): ContractScanSampleFieldMatrixItem {
  const builtinField = BUILTIN_FIELD_DEFINITION_MAP.get(key)
  const supplemental = SUPPLEMENTAL_BUILTIN_DEFINITIONS[key]
  const label = builtinField?.label || supplemental?.label || key
  const fieldType = builtinField?.type || supplemental?.type || 'text'
  const section = builtinField?.section || supplemental?.section
  const options = builtinField?.options || supplemental?.options
  const optionSource = builtinField?.optionSource
  const notes = supplemental?.notes

  return {
    key,
    label,
    domain: 'builtin',
    fieldType,
    section,
    required: CORE_REQUIRED_FIELDS.has(key),
    coverageLevel: 'at_least_once',
    defaultTruthExpectation: CORE_REQUIRED_FIELDS.has(key) ? 'must_hit' : 'optional_hit',
    mappedFormFieldKeys: [key],
    options: options ? [...options] : undefined,
    optionSource: optionSource ? { ...optionSource } : undefined,
    notes,
  }
}

export function getContractScanSampleBuiltinFieldMatrix(): ContractScanSampleFieldMatrixItem[] {
  return CONTRACT_BUILTIN_FIELD_KEYS.map(key => getBuiltinFieldMatrixItem(key))
}

export function getContractScanSamplePartyBUnitFields(): ContractScanSampleFieldMatrixItem[] {
  return PARTY_B_UNIT_FIELDS.map(cloneFieldItem)
}

export function getContractScanSamplePartyBContactFields(): ContractScanSampleFieldMatrixItem[] {
  return PARTY_B_CONTACT_FIELDS.map(cloneFieldItem)
}

export function getContractScanSampleReceiptPlanFields(): ContractScanSampleFieldMatrixItem[] {
  return RECEIPT_PLAN_FIELDS.map(cloneFieldItem)
}

function buildContractTypeFieldGroups(schemaConfig: ContractFormSchemaConfig): ContractScanSampleContractTypeFieldGroup[] {
  const normalizedConfig = normalizeContractFormSchemaConfig(schemaConfig)
  const groups = Object.keys(normalizedConfig.schemasByContractType).map((contractTypeKey) => {
    const contractTypeLabel = getContractTypeLabel(contractTypeKey)
    const aliasLabels = [...(CONTRACT_TYPE_LABEL_MAP[contractTypeKey] || [])]
    const mergedSchema = resolveContractFormSchema(normalizedConfig, contractTypeKey)
    const fields = mergedSchema.fields
      .filter(field => !field.builtin)
      .map<ContractScanSampleFieldMatrixItem>(field => ({
        key: field.key,
        label: field.label,
        domain: 'contractType',
        fieldType: field.type,
        section: field.section,
        required: field.required,
        coverageLevel: 'contract_type_key_field',
        defaultTruthExpectation: field.required ? 'must_hit' : 'optional_hit',
        contractTypeKey,
        contractTypeLabel,
        mappedFormFieldKeys: [field.key],
        options: field.options ? [...field.options] : undefined,
        optionSource: field.optionSource ? { ...field.optionSource } : undefined,
      }))
      .sort((a, b) => {
        if (a.required !== b.required) return a.required ? -1 : 1
        return a.label.localeCompare(b.label, 'zh-CN')
      })

    return {
      contractTypeKey,
      contractTypeLabel,
      aliasLabels,
      fields,
    }
  })

  return groups.sort((a, b) => a.contractTypeLabel.localeCompare(b.contractTypeLabel, 'zh-CN'))
}

export function buildContractScanSampleFoundation(
  schemaConfig: ContractFormSchemaConfig = getDefaultContractFormSchemaConfig(),
): ContractScanSampleFoundation {
  return {
    version: CONTRACT_SCAN_SAMPLE_FOUNDATION_VERSION,
    builtinFields: getContractScanSampleBuiltinFieldMatrix(),
    contractTypeGroups: buildContractTypeFieldGroups(schemaConfig),
    partyBUnitFields: getContractScanSamplePartyBUnitFields(),
    partyBContactFields: getContractScanSamplePartyBContactFields(),
    receiptPlan: {
      fields: getContractScanSampleReceiptPlanFields(),
      requiredScenarios: [...CONTRACT_SCAN_SAMPLE_RECEIPT_PLAN_SCENARIOS],
    },
  }
}

function createGroundTruthFieldMap(fields: ContractScanSampleFieldMatrixItem[]): ContractScanSampleGroundTruthFieldMap {
  return Object.fromEntries(
    fields.map(field => [
      field.key,
      {
        value: null,
        expectation: field.defaultTruthExpectation,
      } as ContractScanSampleGroundTruthFieldValue,
    ]),
  )
}

export function createEmptyContractScanSampleGroundTruth(input: {
  sampleId: string
  contractTypeKey: string
  contractTypeLabel?: string
  fileName: string
  schemaConfig?: ContractFormSchemaConfig
}): ContractScanSampleGroundTruth {
  const foundation = buildContractScanSampleFoundation(input.schemaConfig)
  const contractTypeGroup = foundation.contractTypeGroups.find(group => group.contractTypeKey === input.contractTypeKey)

  return {
    sampleId: input.sampleId,
    contractTypeKey: input.contractTypeKey,
    contractTypeLabel: input.contractTypeLabel || contractTypeGroup?.contractTypeLabel || getContractTypeLabel(input.contractTypeKey),
    fileName: input.fileName,
    builtinFields: createGroundTruthFieldMap(foundation.builtinFields),
    extFields: createGroundTruthFieldMap(contractTypeGroup?.fields || []),
    partyBUnit: createGroundTruthFieldMap(foundation.partyBUnitFields),
    partyBContacts: [],
    receiptPlans: [],
    notes: [],
  }
}
