import * as path from 'path'
import * as fs from 'fs-extra'
import MarkdownIt from 'markdown-it'
import type {
  ContractScanSampleFieldMatrixItem,
  ContractScanSampleGroundTruthFieldMap,
  ContractScanSampleResolvedBlueprint,
} from '../../shared/types/contractScanSample.types'
import {
  buildContractScanSamplePlanCatalog,
  CONTRACT_SCAN_SAMPLE_OUTPUT_ROOT_DIR,
} from '../../shared/utils/contractScanSamplePlan'
import { buildContractScanSampleFoundation } from '../../shared/utils/contractScanSampleFoundation'

type LayoutVariant = 'chaptered' | 'narrative' | 'memo' | 'hybrid'

type FieldRow = {
  key: string
  label: string
  value: string
}

type RenderContext = {
  builtinLabels: Map<string, string>
  extLabelsByType: Map<string, Map<string, string>>
  partyBUnitLabels: Map<string, string>
  partyBContactLabels: Map<string, string>
}

type ReceiptPlanView = {
  planName: string
  direction: string
  expectedDate: string
  expectedAmount: string
  ratio: string
  frequency: string
  remark: string
}

const PROJECT_ROOT = path.resolve(__dirname, '..', '..', '..')
const OUTPUT_ROOT = path.join(PROJECT_ROOT, 'resources', 'contract', CONTRACT_SCAN_SAMPLE_OUTPUT_ROOT_DIR)
const HTML_OUTPUT_DIR = path.join(OUTPUT_ROOT, 'html')
const TRUTH_OUTPUT_DIR = path.join(OUTPUT_ROOT, 'truth')

const markdown = new MarkdownIt({
  html: false,
  breaks: true,
  linkify: false,
  typographer: false,
})

const LAYOUT_SEQUENCE: LayoutVariant[] = ['chaptered', 'narrative', 'memo', 'hybrid']

const BASIC_INFO_ORDER = [
  'contractType',
  'contractName',
  'contractCode',
  'clientName',
  'partyBName',
  'signingDate',
  'endDate',
  'contractAmount',
  'currency',
  'contractStatus',
  'settlementMethod',
  'signingForm',
  'executionMethod',
  'department',
  'responsiblePerson',
]

const EXT_FIELD_PRIORITY_ORDER: Record<string, string[]> = {
  FINANCE: ['financeType', 'loanAmount', 'loanTermMonths', 'annualInterestRate', 'repaymentMethod', 'guaranteeType', 'collateral', 'earlyRepayment'],
  COOPERATION: ['cooperationType', 'cooperationScope', 'cooperationMechanism', 'investmentA', 'investmentB', 'revenueShare', 'exclusivity', 'validityPeriod'],
  LEASE: ['leaseItem', 'leaseStartDate', 'leaseEndDate', 'monthlyRent', 'assetArea', 'depositAmount', 'rentCycle', 'purpose'],
  PURCHASE: ['goodsCategory', 'qualityStandard', 'deliveryPlace', 'brand', 'warrantyMonths', 'inspectionMethod', 'transportMethod', 'prepayRatio'],
  LABOR: ['position', 'department', 'termType', 'probationMonths', 'workingHours', 'workLocation', 'confidentialityYears', 'nonCompeteYears'],
  LEGAL: ['serviceType', 'serviceScope', 'caseNumber', 'courtName', 'assignedLawyer', 'litigationAmount', 'agencyFee', 'caseStatus'],
  IT_SERVICE: ['serviceType', 'serviceContent', 'billingMethod', 'teamSize', 'slaLevel', 'responseTimeHours'],
}

const PARTY_B_UNIT_ORDER = [
  'name',
  'legal_rep_name',
  'legal_rep_mobile',
  'legal_rep_email',
  'phone',
  'address',
  'tax_number',
  'bank_name',
  'bank_account',
  'invoice_type',
]

const PARTY_B_CONTACT_ORDER = [
  'name',
  'department',
  'mobile',
  'phone',
  'email',
  'wechat',
  'is_primary',
  'is_legal_representative',
  'id_number',
]

const FALLBACK_LABELS: Record<string, string> = {
  contractName: '合同名称',
  contractCode: '合同编号',
  contractType: '合同类型',
  clientName: '甲方单位',
  partyBName: '乙方单位',
  signingDate: '签约日期',
  endDate: '合同截止日期',
  contractAmount: '合同金额',
  currency: '币种',
  contractStatus: '合同状态',
  settlementMethod: '结算方式',
  signingForm: '合同订立形式',
  executionMethod: '合同执行方式',
  contractSummary: '合同摘要',
  department: '部门',
  responsiblePerson: '责任人',
  remark: '备注',
  financeType: '融资类型',
  loanAmount: '融资金额',
  loanTermMonths: '融资期限',
  annualInterestRate: '年化利率',
  repaymentMethod: '还款方式',
  guaranteeType: '担保方式',
  collateral: '抵质押物',
  earlyRepayment: '提前还款约定',
  cooperationType: '合作类型',
  cooperationScope: '合作范围',
  cooperationMechanism: '合作机制',
  investmentA: '甲方投入',
  investmentB: '乙方投入',
  revenueShare: '收益分配',
  exclusivity: '排他性约定',
  validityPeriod: '合作有效期',
  leaseItem: '租赁标的',
  leaseStartDate: '起租日期',
  leaseEndDate: '止租日期',
  monthlyRent: '月租金',
  assetArea: '面积/数量',
  depositAmount: '保证金',
  rentCycle: '租金周期',
  purpose: '使用用途',
  goodsCategory: '货物类别',
  qualityStandard: '质量标准',
  deliveryPlace: '交付地点',
  brand: '品牌',
  warrantyMonths: '质保期',
  inspectionMethod: '验收方式',
  transportMethod: '运输方式',
  prepayRatio: '预付款比例',
  position: '岗位',
  termType: '期限类型',
  probationMonths: '试用期',
  workingHours: '工时制度',
  workLocation: '工作地点',
  confidentialityYears: '保密期限',
  nonCompeteYears: '竞业限制期限',
  serviceType: '服务类型',
  serviceScope: '服务范围',
  caseNumber: '案号',
  courtName: '受理法院',
  assignedLawyer: '指派律师',
  litigationAmount: '争议标的额',
  agencyFee: '代理费',
  caseStatus: '案件/服务状态',
  serviceContent: '服务内容',
  billingMethod: '计费方式',
  teamSize: '团队规模',
  slaLevel: 'SLA 等级',
  responseTimeHours: '响应时效',
}

function buildLabelMap(items: ContractScanSampleFieldMatrixItem[]): Map<string, string> {
  return new Map(items.map(item => [item.key, item.label]))
}

function buildRenderContext(): RenderContext {
  const foundation = buildContractScanSampleFoundation()
  return {
    builtinLabels: buildLabelMap(foundation.builtinFields),
    extLabelsByType: new Map(
      foundation.contractTypeGroups.map(group => [group.contractTypeKey, buildLabelMap(group.fields)]),
    ),
    partyBUnitLabels: buildLabelMap(foundation.partyBUnitFields),
    partyBContactLabels: buildLabelMap(foundation.partyBContactFields),
  }
}

function isMeaningfulValue(value: unknown): boolean {
  if (value === null || value === undefined) return false
  if (typeof value === 'string') return value.trim().length > 0
  if (Array.isArray(value)) return value.length > 0
  return true
}

function stripTrailingPunctuation(value: string): string {
  return value.replace(/[；。!！?？]+$/g, '').trim()
}

function ensureSentence(value: string): string {
  const normalized = stripTrailingPunctuation(value)
  return normalized ? `${normalized}。` : ''
}

function escapeMarkdownTableCell(value: string): string {
  return value.replace(/\|/g, '\\|').replace(/\r?\n/g, '<br />')
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function trimTrailingZeros(value: number): string {
  if (Number.isInteger(value)) return String(value)
  return value.toFixed(2).replace(/\.?0+$/, '')
}

function formatMoney(value: number): string {
  const fixed = Number.isInteger(value) ? value.toLocaleString('zh-CN') : value.toLocaleString('zh-CN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
  return `${fixed} 元`
}

function formatFieldValue(key: string, value: unknown): string {
  if (!isMeaningfulValue(value)) return ''
  if (Array.isArray(value)) return value.map(item => formatFieldValue(key, item)).filter(Boolean).join('、')
  if (typeof value === 'number') {
    const normalizedKey = key.toLowerCase()
    if (
      normalizedKey.includes('amount')
      || normalizedKey.includes('rent')
      || normalizedKey.includes('fee')
      || normalizedKey.includes('salary')
      || normalizedKey.includes('price')
      || normalizedKey.includes('loanamount')
      || normalizedKey.includes('litigationamount')
    ) {
      return formatMoney(value)
    }
    if (normalizedKey.includes('ratio') || normalizedKey.includes('rate')) {
      return `${trimTrailingZeros(value)}%`
    }
    if (normalizedKey.endsWith('months')) {
      return `${trimTrailingZeros(value)} 个月`
    }
    if (normalizedKey.endsWith('years')) {
      return `${trimTrailingZeros(value)} 年`
    }
    if (normalizedKey.includes('size') || normalizedKey.includes('area')) {
      return trimTrailingZeros(value)
    }
    return trimTrailingZeros(value)
  }
  return String(value).trim()
}

function getRowsFromFieldMap(
  fieldMap: ContractScanSampleGroundTruthFieldMap,
  labels: Map<string, string>,
  preferredOrder: string[],
): FieldRow[] {
  const keys = Object.keys(fieldMap || {})
  const orderedKeys = [
    ...preferredOrder.filter(key => keys.includes(key)),
    ...keys
      .filter(key => !preferredOrder.includes(key))
      .sort((left, right) => {
        const leftLabel = labels.get(left) || left
        const rightLabel = labels.get(right) || right
        return leftLabel.localeCompare(rightLabel, 'zh-CN')
      }),
  ]

  return orderedKeys
    .map((key) => {
      const field = fieldMap[key]
      if (!field || !isMeaningfulValue(field.value)) return null
      return {
        key,
        label: labels.get(key) || FALLBACK_LABELS[key] || key,
        value: formatFieldValue(key, field.value),
      } satisfies FieldRow
    })
    .filter((item): item is FieldRow => Boolean(item && item.value))
}

function pickLayout(sample: ContractScanSampleResolvedBlueprint): LayoutVariant {
  return LAYOUT_SEQUENCE[(sample.sequence - 1) % LAYOUT_SEQUENCE.length]
}

function pickText(sample: ContractScanSampleResolvedBlueprint, key: string, candidates: string[]): string {
  const seed = `${sample.sampleId}:${sample.variantKey}:${key}`
  const hash = Array.from(seed).reduce((total, char) => total + char.charCodeAt(0), 0)
  return candidates[hash % candidates.length]
}

function getBuiltinText(sample: ContractScanSampleResolvedBlueprint, key: string): string {
  return formatFieldValue(key, sample.truth.builtinFields[key]?.value)
}

function renderTable(headers: [string, string], rows: FieldRow[]): string {
  if (rows.length === 0) return '_无_'
  const lines = [
    `| ${headers[0]} | ${headers[1]} |`,
    '| --- | --- |',
  ]
  rows.forEach((row) => {
    lines.push(`| ${escapeMarkdownTableCell(row.label)} | ${escapeMarkdownTableCell(row.value)} |`)
  })
  return lines.join('\n')
}

function renderReceiptPlanTable(plans: ReceiptPlanView[]): string {
  if (plans.length === 0) return '_无_'
  const lines = [
    '| 期次/名称 | 方向 | 日期 | 金额 | 比例 | 频率 | 备注 |',
    '| --- | --- | --- | --- | --- | --- | --- |',
  ]
  plans.forEach((plan) => {
    lines.push([
      plan.planName,
      plan.direction,
      plan.expectedDate || '-',
      plan.expectedAmount || '-',
      plan.ratio || '-',
      plan.frequency || '-',
      plan.remark || '-',
    ].map(escapeMarkdownTableCell).join(' | ').replace(/^/, '| ').replace(/$/, ' |'))
  })
  return lines.join('\n')
}

function buildReceiptPlans(sample: ContractScanSampleResolvedBlueprint): ReceiptPlanView[] {
  return sample.truth.receiptPlans.map((plan, index) => ({
    planName: formatFieldValue('plan_name', plan.fields.plan_name?.value) || `第${index + 1}期`,
    direction: formatFieldValue('direction', plan.fields.direction?.value),
    expectedDate: formatFieldValue('expected_date', plan.fields.expected_date?.value),
    expectedAmount: formatFieldValue('expected_amount', plan.fields.expected_amount?.value),
    ratio: formatFieldValue('ratio', plan.fields.ratio?.value),
    frequency: formatFieldValue('receipt_frequency', plan.fields.receipt_frequency?.value),
    remark: formatFieldValue('remark', plan.fields.remark?.value),
  }))
}

function buildReceiptClause(sample: ContractScanSampleResolvedBlueprint, plans: ReceiptPlanView[]): string {
  const scenarioIntroMap: Record<string, string> = {
    single_installment: '本合同采用单期结算方式，款项触发条件集中、金额一次性确认。',
    double_installment: '本合同采用双节点结算方式，前后期付款条件和金额需分别列示。',
    multi_installment: '本合同采用多期滚动结算方式，相关节点、频率和金额分散写入正文与附表。',
  }
  const intro = scenarioIntroMap[sample.receiptPlanScenario] || '本合同约定了明确的收付款计划。'
  const detailText = plans.map((plan, index) => {
    const parts = [
      `${index + 1}. ${plan.planName}`,
      plan.direction ? `方向为${plan.direction}` : '',
      plan.expectedDate ? `计划日期为${plan.expectedDate}` : '',
      plan.expectedAmount ? `金额为${plan.expectedAmount}` : '',
      plan.ratio ? `比例为${plan.ratio}` : '',
      plan.frequency ? `频率为${plan.frequency}` : '',
      plan.remark ? `触发说明：${plan.remark}` : '',
    ].filter(Boolean)
    return parts.join('，')
  }).join('；')

  return [intro, detailText].filter(Boolean).join(' ')
}

function buildNarrativeIntro(sample: ContractScanSampleResolvedBlueprint): string {
  const contractName = getBuiltinText(sample, 'contractName')
  const clientName = getBuiltinText(sample, 'clientName')
  const partyBName = getBuiltinText(sample, 'partyBName')
  const contractCode = getBuiltinText(sample, 'contractCode')
  const signingDate = getBuiltinText(sample, 'signingDate')
  const contractAmount = getBuiltinText(sample, 'contractAmount')
  const summary = getBuiltinText(sample, 'contractSummary')
  const starter = pickText(sample, 'intro', [
    '鉴于双方已完成前期沟通，现就相关合作事项形成如下合同文本',
    '经甲乙双方协商一致，就本次业务合作、履行安排及付款节点达成如下约定',
    '为明确双方权利义务，并便于后续交付、验收和结算，双方确认签署本合同',
  ])
  return ensureSentence([
    starter,
    contractName ? `合同名称为“${contractName}”` : '',
    contractCode ? `合同编号为 ${contractCode}` : '',
    signingDate ? `签订日期为 ${signingDate}` : '',
    clientName ? `甲方为 ${clientName}` : '',
    partyBName ? `乙方为 ${partyBName}` : '',
    contractAmount ? `合同金额暂按 ${contractAmount} 执行` : '',
    summary ? `双方确认的合作背景为：${summary}` : '',
  ].filter(Boolean).join('；'))
}

function buildCoreClauseParagraphs(sample: ContractScanSampleResolvedBlueprint, extRows: FieldRow[]): string[] {
  if (extRows.length === 0) return []
  const firstGroup = extRows.slice(0, Math.min(4, extRows.length))
  const secondGroup = extRows.slice(firstGroup.length)
  const primary = firstGroup.map(row => `${row.label}${pickText(sample, `verb:${row.key}`, ['为', '约定为', '明确为'])}${row.value}`).join('；')
  const sections = [primary ? `${pickText(sample, 'primary-clause', [
    '核心业务条件如下',
    '合同关键字段分布如下',
    '双方确认以下核心条款',
  ])}：${primary}。` : '']
  if (secondGroup.length > 0) {
    sections.push(`${pickText(sample, 'secondary-clause', [
      '补充条款同时约定',
      '此外，正文另行写明',
      '其余执行条件包括',
    ])}：${secondGroup.map(row => `${row.label}${row.value}`).join('；')}。`)
  }
  return sections.filter(Boolean)
}

function buildOtherTerms(sample: ContractScanSampleResolvedBlueprint): string[] {
  const summary = getBuiltinText(sample, 'contractSummary')
  const remark = getBuiltinText(sample, 'remark')
  const lines: string[] = []
  if (summary) {
    lines.push(ensureSentence(`合同摘要：${summary}`))
  }
  if (remark) {
    lines.push(ensureSentence(`补充说明：${remark}`))
  }
  if (sample.truth.notes.length > 0) {
    lines.push(`起草说明：${sample.truth.notes.join('；')}`)
  }
  return lines
}

function buildContactBlocks(sample: ContractScanSampleResolvedBlueprint, context: RenderContext): string[] {
  const blocks = sample.truth.partyBContacts.map((contact, index) => {
    const rows = getRowsFromFieldMap(contact, context.partyBContactLabels, PARTY_B_CONTACT_ORDER)
    if (rows.length === 0) return `### 联系人 ${index + 1}\n\n_无_`
    return `### 联系人 ${index + 1}\n\n${renderTable(['字段', '内容'], rows)}`
  })
  return blocks.length > 0 ? blocks : ['_无联系人信息_']
}

function buildSignatureSection(sample: ContractScanSampleResolvedBlueprint): string {
  const clientName = getBuiltinText(sample, 'clientName') || '甲方'
  const partyBName = getBuiltinText(sample, 'partyBName') || '乙方'
  const signingDate = getBuiltinText(sample, 'signingDate')
  return [
    '## 签署栏',
    '',
    `甲方：${clientName}`,
    '',
    `乙方：${partyBName}`,
    '',
    `签署日期：${signingDate || '待补充'}`,
  ].join('\n')
}

function renderChapteredMarkdown(
  sample: ContractScanSampleResolvedBlueprint,
  context: RenderContext,
  basicRows: FieldRow[],
  extRows: FieldRow[],
  partyBUnitRows: FieldRow[],
  receiptPlans: ReceiptPlanView[],
): string {
  return [
    `# ${getBuiltinText(sample, 'contractName') || sample.contractTypeLabel}`,
    '',
    `> 合同编号：${getBuiltinText(sample, 'contractCode') || '待补充'}  `,
    `> 合同类型：${sample.contractTypeLabel}  `,
    `> 签订日期：${getBuiltinText(sample, 'signingDate') || '待补充'}`,
    '',
    `甲方：${getBuiltinText(sample, 'clientName') || '待补充'}`,
    '',
    `乙方：${getBuiltinText(sample, 'partyBName') || '待补充'}`,
    '',
    buildNarrativeIntro(sample),
    '',
    '## 第一条 合同基本信息',
    '',
    renderTable(['字段', '内容'], basicRows),
    '',
    '## 第二条 标的与核心条款',
    '',
    ...buildCoreClauseParagraphs(sample, extRows),
    '',
    renderTable(['字段', '内容'], extRows),
    '',
    '## 第三条 乙方信息',
    '',
    renderTable(['字段', '内容'], partyBUnitRows),
    '',
    '## 第四条 乙方联系人与沟通机制',
    '',
    ...buildContactBlocks(sample, context),
    '',
    '## 第五条 收付款计划',
    '',
    buildReceiptClause(sample, receiptPlans),
    '',
    renderReceiptPlanTable(receiptPlans),
    '',
    '## 第六条 履行补充说明',
    '',
    ...buildOtherTerms(sample),
    '',
    buildSignatureSection(sample),
    '',
  ].join('\n')
}

function renderNarrativeMarkdown(
  sample: ContractScanSampleResolvedBlueprint,
  context: RenderContext,
  basicRows: FieldRow[],
  extRows: FieldRow[],
  partyBUnitRows: FieldRow[],
  receiptPlans: ReceiptPlanView[],
): string {
  const topRows = basicRows.filter(row => ['contractCode', 'contractType', 'signingDate', 'contractAmount'].includes(row.key))
  const narrativeRows = basicRows.filter(row => !topRows.some(top => top.key === row.key))
  return [
    `# ${getBuiltinText(sample, 'contractName') || sample.contractTypeLabel}`,
    '',
    buildNarrativeIntro(sample),
    '',
    '## 合同抬头信息',
    '',
    renderTable(['字段', '内容'], topRows),
    '',
    '## 合作背景与执行口径',
    '',
    ...narrativeRows.map(row => `- ${row.label}：${row.value}`),
    '',
    '## 核心业务条款',
    '',
    ...extRows.map((row, index) => `${index + 1}. ${row.label}：${row.value}`),
    '',
    '## 收付款安排',
    '',
    buildReceiptClause(sample, receiptPlans),
    '',
    renderReceiptPlanTable(receiptPlans),
    '',
    '## 乙方资料',
    '',
    renderTable(['字段', '内容'], partyBUnitRows),
    '',
    '## 联系窗口',
    '',
    ...buildContactBlocks(sample, context),
    '',
    '## 其他约定',
    '',
    ...buildOtherTerms(sample),
    '',
    buildSignatureSection(sample),
    '',
  ].join('\n')
}

function renderMemoMarkdown(
  sample: ContractScanSampleResolvedBlueprint,
  context: RenderContext,
  basicRows: FieldRow[],
  extRows: FieldRow[],
  partyBUnitRows: FieldRow[],
  receiptPlans: ReceiptPlanView[],
): string {
  return [
    `# ${getBuiltinText(sample, 'contractName') || sample.contractTypeLabel}`,
    '',
    `> 事项摘要：${buildNarrativeIntro(sample)}`,
    '',
    '## 一、事项清单',
    '',
    renderTable(['字段', '内容'], basicRows),
    '',
    '## 二、执行与交付要点',
    '',
    ...extRows.map(row => `- ${row.label}：${row.value}`),
    '',
    '## 三、收付款条款',
    '',
    buildReceiptClause(sample, receiptPlans),
    '',
    ...receiptPlans.map((plan, index) => `- 第${index + 1}期 ${plan.planName}：${[
      plan.direction ? `方向${plan.direction}` : '',
      plan.expectedDate ? `日期${plan.expectedDate}` : '',
      plan.expectedAmount ? `金额${plan.expectedAmount}` : '',
      plan.ratio ? `比例${plan.ratio}` : '',
      plan.frequency ? `频率${plan.frequency}` : '',
      plan.remark ? `备注${plan.remark}` : '',
    ].filter(Boolean).join('，')}`),
    '',
    '## 附件 A 乙方信息',
    '',
    renderTable(['字段', '内容'], partyBUnitRows),
    '',
    '## 附件 B 联系人信息',
    '',
    ...buildContactBlocks(sample, context),
    '',
    '## 附件 C 备注',
    '',
    ...buildOtherTerms(sample),
    '',
    buildSignatureSection(sample),
    '',
  ].join('\n')
}

function renderHybridMarkdown(
  sample: ContractScanSampleResolvedBlueprint,
  context: RenderContext,
  basicRows: FieldRow[],
  extRows: FieldRow[],
  partyBUnitRows: FieldRow[],
  receiptPlans: ReceiptPlanView[],
): string {
  const leadingRows = basicRows.slice(0, Math.min(6, basicRows.length))
  const trailingRows = basicRows.slice(leadingRows.length)
  return [
    `# ${getBuiltinText(sample, 'contractName') || sample.contractTypeLabel}`,
    '',
    renderTable(['字段', '内容'], leadingRows),
    '',
    '## 条款一 合同背景',
    '',
    buildNarrativeIntro(sample),
    '',
    '## 条款二 标的与关键字段',
    '',
    ...buildCoreClauseParagraphs(sample, extRows),
    '',
    renderTable(['字段', '内容'], extRows),
    '',
    '## 条款三 乙方资料与联系人',
    '',
    renderTable(['字段', '内容'], partyBUnitRows),
    '',
    ...buildContactBlocks(sample, context),
    '',
    '## 条款四 对价与计划',
    '',
    buildReceiptClause(sample, receiptPlans),
    '',
    renderReceiptPlanTable(receiptPlans),
    '',
    '## 附表 其他基础信息',
    '',
    renderTable(['字段', '内容'], trailingRows),
    '',
    '## 附加说明',
    '',
    ...buildOtherTerms(sample),
    '',
    buildSignatureSection(sample),
    '',
  ].join('\n')
}

function renderSampleMarkdown(sample: ContractScanSampleResolvedBlueprint, context: RenderContext): { markdownText: string; layout: LayoutVariant } {
  const basicRows = getRowsFromFieldMap(sample.truth.builtinFields, context.builtinLabels, BASIC_INFO_ORDER)
  const extRows = getRowsFromFieldMap(
    sample.truth.extFields,
    context.extLabelsByType.get(sample.contractTypeKey) || new Map<string, string>(),
    EXT_FIELD_PRIORITY_ORDER[sample.contractTypeKey] || [],
  )
  const partyBUnitRows = getRowsFromFieldMap(sample.truth.partyBUnit, context.partyBUnitLabels, PARTY_B_UNIT_ORDER)
  const receiptPlans = buildReceiptPlans(sample)
  const layout = pickLayout(sample)

  const markdownText = layout === 'chaptered'
    ? renderChapteredMarkdown(sample, context, basicRows, extRows, partyBUnitRows, receiptPlans)
    : layout === 'narrative'
      ? renderNarrativeMarkdown(sample, context, basicRows, extRows, partyBUnitRows, receiptPlans)
      : layout === 'memo'
        ? renderMemoMarkdown(sample, context, basicRows, extRows, partyBUnitRows, receiptPlans)
        : renderHybridMarkdown(sample, context, basicRows, extRows, partyBUnitRows, receiptPlans)

  return { markdownText: markdownText.trim() + '\n', layout }
}

function buildHtmlPreview(sample: ContractScanSampleResolvedBlueprint, markdownText: string, layout: LayoutVariant): string {
  const rendered = markdown.render(markdownText)
  return [
    '<!doctype html>',
    '<html lang="zh-CN">',
    '<head>',
    '  <meta charset="utf-8" />',
    '  <meta name="viewport" content="width=device-width, initial-scale=1" />',
    `  <title>${escapeHtml(sample.fileBaseName)}</title>`,
    '  <style>',
    '    :root { color-scheme: light; }',
    '    body { margin: 0; font-family: "Microsoft YaHei", "PingFang SC", Arial, sans-serif; background: #f5f7fb; color: #1f2937; }',
    '    main { max-width: 960px; margin: 32px auto; padding: 32px 40px; background: #fff; box-shadow: 0 12px 36px rgba(15, 23, 42, 0.08); border-radius: 16px; }',
    '    .meta { margin-bottom: 20px; color: #64748b; font-size: 14px; }',
    '    h1, h2, h3 { color: #0f172a; }',
    '    h1 { margin-top: 0; font-size: 30px; }',
    '    h2 { margin-top: 28px; font-size: 22px; }',
    '    h3 { margin-top: 20px; font-size: 18px; }',
    '    p, li { line-height: 1.8; font-size: 15px; }',
    '    table { width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 14px; }',
    '    th, td { border: 1px solid #dbe2ea; padding: 10px 12px; text-align: left; vertical-align: top; }',
    '    th { background: #f8fafc; }',
    '    blockquote { margin: 0; padding: 12px 16px; background: #eff6ff; border-left: 4px solid #3b82f6; color: #1e3a8a; }',
    '    code { background: #f1f5f9; padding: 2px 6px; border-radius: 6px; }',
    '  </style>',
    '</head>',
    '<body>',
    '  <main>',
    `    <div class="meta">样本编号：${escapeHtml(sample.sampleId)} ｜ 变体：${escapeHtml(sample.variantLabel)} ｜ 版式：${escapeHtml(layout)}</div>`,
    rendered,
    '  </main>',
    '</body>',
    '</html>',
  ].join('\n')
}

async function main(): Promise<void> {
  const catalog = buildContractScanSamplePlanCatalog()
  const context = buildRenderContext()

  await fs.emptyDir(OUTPUT_ROOT)
  await Promise.all([
    fs.ensureDir(HTML_OUTPUT_DIR),
    fs.ensureDir(TRUTH_OUTPUT_DIR),
  ])

  const sampleArtifacts: Array<Record<string, string>> = []

  for (const sample of catalog.samples) {
    const { markdownText, layout } = renderSampleMarkdown(sample, context)
    const markdownPath = path.join(OUTPUT_ROOT, sample.fileName)
    const htmlPath = path.join(HTML_OUTPUT_DIR, `${sample.fileBaseName}.html`)
    const truthPath = path.join(TRUTH_OUTPUT_DIR, `${sample.fileBaseName}.json`)

    await fs.writeFile(markdownPath, markdownText, 'utf8')
    await fs.writeFile(htmlPath, buildHtmlPreview(sample, markdownText, layout), 'utf8')
    await fs.writeJson(truthPath, sample.truth, { spaces: 2 })

    sampleArtifacts.push({
      sampleId: sample.sampleId,
      markdown: path.relative(PROJECT_ROOT, markdownPath).replace(/\\/g, '/'),
      html: path.relative(PROJECT_ROOT, htmlPath).replace(/\\/g, '/'),
      truth: path.relative(PROJECT_ROOT, truthPath).replace(/\\/g, '/'),
      layout,
    })
  }

  await fs.writeJson(path.join(OUTPUT_ROOT, 'catalog.json'), {
    version: catalog.version,
    outputRootDir: catalog.outputRootDir,
    totalSamples: catalog.totalSamples,
    scanFolder: path.relative(PROJECT_ROOT, OUTPUT_ROOT).replace(/\\/g, '/'),
    generatedAt: new Date().toISOString(),
    distributions: catalog.distributions,
    fileNameRule: catalog.fileNameRule,
    samples: sampleArtifacts,
  }, { spaces: 2 })

  console.log(`已生成 ${catalog.totalSamples} 份合同扫描样本：${OUTPUT_ROOT}`)
}

main().catch((error: unknown) => {
  console.error('生成合同扫描样本失败', error)
  process.exitCode = 1
})
