import type { ContractFormSchemaConfig } from '../types/contractFormSchema.types'
import type {
  ContractScanReceiptPlanScenario,
  ContractScanSampleBlueprint,
  ContractScanSampleDistributionItem,
  ContractScanSampleDocumentExtension,
  ContractScanSampleFileNameRule,
  ContractScanSampleFoundation,
  ContractScanSampleGenerationEntrypoint,
  ContractScanSampleGroundTruthFieldValue,
  ContractScanSampleGroundTruthFieldMap,
  ContractScanSamplePlanCatalog,
  ContractScanSampleResolvedBlueprint,
  ContractScanSampleTemplateFieldMap,
  ContractScanSampleTemplateFieldValue,
  ContractScanSampleTruthExpectation,
  ContractScanSampleTruthTemplate,
} from '../types/contractScanSample.types'
import {
  CONTRACT_SCAN_SAMPLE_PLAN_VERSION,
} from '../types/contractScanSample.types'
import {
  buildContractScanSampleFoundation,
  createEmptyContractScanSampleGroundTruth,
} from './contractScanSampleFoundation'

type ContractTypeMeta = {
  label: string
  typeCode: string
}

type BaseBuiltinFieldInput = {
  contractName: string
  contractCode: string
  clientName: string
  partyBName: string
  signingDate: string
  contractAmount: number
  optionalFields?: ContractScanSampleTemplateFieldMap
}

type SampleDefinitionInput = {
  contractTypeKey: string
  sequence: number
  variantKey: string
  variantLabel: string
  receiptPlanScenario: ContractScanReceiptPlanScenario
  truthTemplate: ContractScanSampleTruthTemplate
}

const CONTRACT_TYPE_META_MAP: Record<string, ContractTypeMeta> = {
  FINANCE: { label: '金融担保', typeCode: 'FIN' },
  COOPERATION: { label: '战略合作', typeCode: 'COP' },
  LEASE: { label: '租赁', typeCode: 'LEA' },
  PURCHASE: { label: '买卖采购', typeCode: 'PUR' },
  LABOR: { label: '劳动合同', typeCode: 'LAB' },
  LEGAL: { label: '法律服务', typeCode: 'LEG' },
  IT_SERVICE: { label: '技术服务', typeCode: 'ITS' },
}

export const CONTRACT_SCAN_SAMPLE_OUTPUT_ROOT_DIR = 'contract-scan-sample-bundle'

const DEFAULT_DOCUMENT_EXTENSION: ContractScanSampleDocumentExtension = 'md'

const ALLOWED_DOCUMENT_EXTENSIONS: ContractScanSampleDocumentExtension[] = [
  'md',
  'pdf',
  'docx',
  'png',
]

const SAMPLE_DISTRIBUTION: ContractScanSampleDistributionItem[] = [
  { contractTypeKey: 'FINANCE', contractTypeLabel: '金融担保', typeCode: 'FIN', count: 3, notes: '覆盖借款、担保、保理 3 种核心语义。' },
  { contractTypeKey: 'COOPERATION', contractTypeLabel: '战略合作', typeCode: 'COP', count: 3, notes: '覆盖渠道推广、联合创新、资源置换。' },
  { contractTypeKey: 'LEASE', contractTypeLabel: '租赁', typeCode: 'LEA', count: 4, notes: '覆盖办公场地、仓储、设备、车辆租赁。' },
  { contractTypeKey: 'PURCHASE', contractTypeLabel: '买卖采购', typeCode: 'PUR', count: 5, notes: '覆盖办公设备、服务器、物资耗材和备件。' },
  { contractTypeKey: 'LABOR', contractTypeLabel: '劳动合同', typeCode: 'LAB', count: 3, notes: '覆盖固定期限、无固定期限、项目制。' },
  { contractTypeKey: 'LEGAL', contractTypeLabel: '法律服务', typeCode: 'LEG', count: 3, notes: '覆盖诉讼代理、常法顾问、专项审查。' },
  { contractTypeKey: 'IT_SERVICE', contractTypeLabel: '技术服务', typeCode: 'ITS', count: 3, notes: '覆盖运维外包、实施服务、技术咨询。' },
]

export const CONTRACT_SCAN_SAMPLE_FILE_NAME_RULE: ContractScanSampleFileNameRule = {
  pattern: 'contract_scan_{sampleId}_{variantKey}.{ext}',
  defaultExtension: DEFAULT_DOCUMENT_EXTENSION,
  allowedExtensions: [...ALLOWED_DOCUMENT_EXTENSIONS],
  example: 'contract_scan_FIN-01_bank-loan.md',
  notes: [
    'sampleId 采用“类型缩写-两位序号”规则，如 FIN-01、PUR-05。',
    'variantKey 仅使用小写字母、数字和连字符，便于跨平台生成与批量比对。',
    'Task3 默认生成可被现有批量扫描入口直接识别的 Markdown 主文件。',
    '如需导出为 PDF、docx 或 png，应保持同一 fileBaseName 以便真值与产物对齐。',
  ],
}

function cloneFieldValue(field: ContractScanSampleTemplateFieldValue): ContractScanSampleTemplateFieldValue {
  return { ...field }
}

function cloneFieldMap(fieldMap?: ContractScanSampleTemplateFieldMap): ContractScanSampleTemplateFieldMap | undefined {
  if (!fieldMap) return undefined
  return Object.fromEntries(
    Object.entries(fieldMap).map(([key, value]) => [key, cloneFieldValue(value)]),
  )
}

function cloneTruthTemplate(template: ContractScanSampleTruthTemplate): ContractScanSampleTruthTemplate {
  return {
    builtinFields: cloneFieldMap(template.builtinFields),
    extFields: cloneFieldMap(template.extFields),
    partyBUnit: cloneFieldMap(template.partyBUnit),
    partyBContacts: template.partyBContacts?.map(contact => ({
      fields: cloneFieldMap(contact.fields) || {},
    })),
    receiptPlans: template.receiptPlans?.map(plan => ({
      scenario: plan.scenario,
      fields: cloneFieldMap(plan.fields) || {},
    })),
    notes: template.notes ? [...template.notes] : undefined,
  }
}

function cloneDistributionItem(item: ContractScanSampleDistributionItem): ContractScanSampleDistributionItem {
  return { ...item }
}

function getContractTypeMeta(contractTypeKey: string): ContractTypeMeta {
  const meta = CONTRACT_TYPE_META_MAP[contractTypeKey]
  if (!meta) {
    throw new Error(`Unsupported contract scan sample type: ${contractTypeKey}`)
  }
  return meta
}

function buildTemplateFieldValue(
  value: unknown,
  expectation: ContractScanSampleTruthExpectation,
  notes?: string,
): ContractScanSampleTemplateFieldValue {
  return {
    value,
    expectation,
    notes,
  }
}

function must(value: unknown, notes?: string): ContractScanSampleTemplateFieldValue {
  return buildTemplateFieldValue(value, 'must_hit', notes)
}

function optional(value: unknown, notes?: string): ContractScanSampleTemplateFieldValue {
  return buildTemplateFieldValue(value, 'optional_hit', notes)
}

function manual(value: unknown, notes?: string): ContractScanSampleTemplateFieldValue {
  return buildTemplateFieldValue(value, 'manual_fill_allowed', notes)
}

function buildBaseBuiltinFields(
  contractTypeKey: string,
  input: BaseBuiltinFieldInput,
): ContractScanSampleTemplateFieldMap {
  const meta = getContractTypeMeta(contractTypeKey)
  return {
    contractName: must(input.contractName),
    contractCode: must(input.contractCode),
    clientName: must(input.clientName),
    partyBName: must(input.partyBName),
    contractType: must(meta.label),
    signingDate: must(input.signingDate),
    contractAmount: must(input.contractAmount),
    ...(input.optionalFields || {}),
  }
}

export function buildContractScanSampleId(contractTypeKey: string, sequence: number): string {
  const { typeCode } = getContractTypeMeta(contractTypeKey)
  return `${typeCode}-${String(sequence).padStart(2, '0')}`
}

export function buildContractScanSampleFileBaseName(sampleId: string, variantKey: string): string {
  return `contract_scan_${sampleId}_${variantKey}`
}

export function buildContractScanSampleFileName(input: {
  sampleId: string
  variantKey: string
  extension?: ContractScanSampleDocumentExtension
}): string {
  const extension = input.extension || DEFAULT_DOCUMENT_EXTENSION
  return `${buildContractScanSampleFileBaseName(input.sampleId, input.variantKey)}.${extension}`
}

function defineSample(input: SampleDefinitionInput): ContractScanSampleBlueprint {
  const meta = getContractTypeMeta(input.contractTypeKey)
  const sampleId = buildContractScanSampleId(input.contractTypeKey, input.sequence)
  const fileBaseName = buildContractScanSampleFileBaseName(sampleId, input.variantKey)
  return {
    sampleId,
    contractTypeKey: input.contractTypeKey,
    contractTypeLabel: meta.label,
    typeCode: meta.typeCode,
    sequence: input.sequence,
    variantKey: input.variantKey,
    variantLabel: input.variantLabel,
    fileBaseName,
    fileName: buildContractScanSampleFileName({ sampleId, variantKey: input.variantKey }),
    receiptPlanScenario: input.receiptPlanScenario,
    truthTemplate: cloneTruthTemplate(input.truthTemplate),
  }
}

const SAMPLE_BLUEPRINTS: ContractScanSampleBlueprint[] = [
  defineSample({
    contractTypeKey: 'FINANCE',
    sequence: 1,
    variantKey: 'bank-loan',
    variantLabel: '银行借款版',
    receiptPlanScenario: 'multi_installment',
    truthTemplate: {
      builtinFields: buildBaseBuiltinFields('FINANCE', {
        contractName: '流动资金借款合同',
        contractCode: 'FIN-2026-001',
        clientName: '江苏云桥科技股份有限公司',
        partyBName: '上海浦科融资担保有限公司',
        signingDate: '2026-01-15',
        contractAmount: 5000000,
        optionalFields: {
          endDate: must('2027-01-14'),
          contractStatus: optional('履行中'),
          settlementMethod: optional('银行转账'),
          signingForm: optional('书面'),
          executionMethod: optional('按计划履行'),
          contractSummary: optional('用于补充流动资金周转，附带阶段性财务报送义务。'),
          currency: optional('CNY'),
          remark: optional('借款合同正文含提前还款与质押条款。'),
        },
      }),
      extFields: {
        financeType: must('借款'),
        loanAmount: must(5000000),
        loanTermMonths: must(12),
        annualInterestRate: optional(6.8),
        repaymentMethod: optional('按月付息到期还本'),
        guaranteeType: optional('保证'),
        collateral: optional('核心应收账款质押'),
        earlyRepayment: optional('提前15日书面通知可部分提前还款'),
      },
      partyBUnit: {
        name: must('上海浦科融资担保有限公司'),
        legal_rep_name: optional('周岚'),
        phone: optional('021-58886611'),
        address: optional('上海市浦东新区张江路88号'),
        tax_number: optional('91310000MA1K3F6X9Q'),
        bank_name: optional('招商银行上海张江支行'),
        bank_account: optional('123456789012345678'),
        invoice_type: optional('专票'),
      },
      partyBContacts: [
        {
          fields: {
            name: optional('林霄'),
            mobile: optional('13917661234'),
            email: optional('linxiao@puke-finance.com'),
            department: manual('风险控制部'),
            is_primary: manual('true'),
          },
        },
      ],
      receiptPlans: [
        {
          scenario: 'multi_installment',
          fields: {
            plan_name: must('按月付息计划'),
            direction: must('付款'),
            receipt_frequency: optional('按月'),
            expected_date: must('2026-02-15'),
            expected_amount: must(28333.33),
            ratio: optional(5.67),
            remark: optional('第1期利息，后续各期同口径滚动'),
          },
        },
        {
          scenario: 'multi_installment',
          fields: {
            plan_name: must('到期还本计划'),
            direction: must('付款'),
            expected_date: must('2027-01-14'),
            expected_amount: must(5000000),
            ratio: optional(100),
            remark: optional('本金一次性归还'),
          },
        },
      ],
      notes: ['金融担保样本应突出金额、利率、担保方式、提前还款约定分散出现的版式。'],
    },
  }),
  defineSample({
    contractTypeKey: 'FINANCE',
    sequence: 2,
    variantKey: 'supply-chain-guarantee',
    variantLabel: '供应链担保版',
    receiptPlanScenario: 'double_installment',
    truthTemplate: {
      builtinFields: buildBaseBuiltinFields('FINANCE', {
        contractName: '供应链履约担保合同',
        contractCode: 'FIN-2026-002',
        clientName: '南京智港医疗设备有限公司',
        partyBName: '苏州信禾融资担保有限公司',
        signingDate: '2026-03-02',
        contractAmount: 2000000,
        optionalFields: {
          endDate: must('2027-09-01'),
          settlementMethod: optional('银行保函'),
          executionMethod: optional('阶段履约'),
          contractSummary: optional('为采购主合同项下的分批交付义务提供履约担保。'),
        },
      }),
      extFields: {
        financeType: must('担保'),
        loanAmount: must(2000000),
        loanTermMonths: must(18),
        guaranteeType: optional('保证'),
        annualInterestRate: optional(4.2),
        repaymentMethod: optional('一次性还本付息'),
        earlyRepayment: optional('主债务提前结清后担保责任同步解除'),
      },
      partyBUnit: {
        name: must('苏州信禾融资担保有限公司'),
        legal_rep_name: optional('顾海宁'),
        legal_rep_mobile: optional('13812661120'),
        phone: optional('0512-67118890'),
        address: optional('苏州市工业园区星湖街218号'),
        tax_number: optional('91320594MA27FK2D8P'),
        invoice_type: optional('普票'),
      },
      partyBContacts: [
        {
          fields: {
            name: optional('蒋悦'),
            phone: optional('0512-67118891'),
            email: optional('jiangyue@xinhe-guarantee.cn'),
            wechat: manual('xinhe-rm-07'),
          },
        },
      ],
      receiptPlans: [
        {
          scenario: 'double_installment',
          fields: {
            plan_name: must('担保服务费首付款'),
            direction: must('付款'),
            expected_date: must('2026-03-05'),
            expected_amount: must(60000),
            ratio: optional(60),
            remark: optional('保函开立后三个工作日内支付'),
          },
        },
        {
          scenario: 'double_installment',
          fields: {
            plan_name: must('担保服务费尾款'),
            direction: must('付款'),
            expected_date: must('2026-09-05'),
            expected_amount: must(40000),
            ratio: optional(40),
            remark: optional('主合同完成首批验收后支付'),
          },
        },
      ],
      notes: ['该样本用于覆盖“担保服务费分两期支付 + 保函/履约语义”的组合场景。'],
    },
  }),
  defineSample({
    contractTypeKey: 'FINANCE',
    sequence: 3,
    variantKey: 'factoring',
    variantLabel: '保理融资版',
    receiptPlanScenario: 'single_installment',
    truthTemplate: {
      builtinFields: buildBaseBuiltinFields('FINANCE', {
        contractName: '应收账款保理融资合同',
        contractCode: 'FIN-2026-003',
        clientName: '合肥云脉工业软件有限公司',
        partyBName: '杭州远曜商业保理有限公司',
        signingDate: '2026-04-18',
        contractAmount: 3200000,
        optionalFields: {
          endDate: must('2026-10-17'),
          contractStatus: optional('待生效'),
          settlementMethod: optional('受让应收账款回款'),
          remark: optional('正文中保理服务费与回购义务条款独立成段。'),
        },
      }),
      extFields: {
        financeType: must('保理'),
        loanAmount: must(3200000),
        loanTermMonths: must(6),
        annualInterestRate: optional(8.2),
        repaymentMethod: optional('一次性还本付息'),
        collateral: optional('电子政务项目应收账款'),
        earlyRepayment: optional('提前回款不减免已发生保理服务费'),
      },
      partyBUnit: {
        name: must('杭州远曜商业保理有限公司'),
        legal_rep_name: optional('许安'),
        phone: optional('0571-88220016'),
        address: optional('杭州市西湖区文三路398号'),
        bank_name: optional('中国银行杭州高新支行'),
        bank_account: optional('3301548899002211008'),
        invoice_type: optional('专票'),
      },
      partyBContacts: [
        {
          fields: {
            name: optional('陶清'),
            mobile: optional('13758112263'),
            email: optional('taoqing@yf-factoring.com'),
            is_legal_representative: manual('false'),
          },
        },
      ],
      receiptPlans: [
        {
          scenario: 'single_installment',
          fields: {
            plan_name: must('保理融资到期结清'),
            direction: must('付款'),
            expected_date: must('2026-10-17'),
            expected_amount: must(3296000),
            remark: optional('含本金及固定保理服务费'),
          },
        },
      ],
      notes: ['该样本要求在合同中体现保理服务费、回购责任和基础应收账款来源。'],
    },
  }),
  defineSample({
    contractTypeKey: 'COOPERATION',
    sequence: 1,
    variantKey: 'channel-promotion',
    variantLabel: '渠道推广版',
    receiptPlanScenario: 'double_installment',
    truthTemplate: {
      builtinFields: buildBaseBuiltinFields('COOPERATION', {
        contractName: '渠道联合推广战略合作协议',
        contractCode: 'COP-2026-001',
        clientName: '北京星图云销科技有限公司',
        partyBName: '广州触达数字营销有限公司',
        signingDate: '2026-02-08',
        contractAmount: 800000,
        optionalFields: {
          endDate: must('2027-02-07'),
          executionMethod: optional('按季度复盘'),
          contractSummary: optional('双方围绕华南区域渠道拓展与联合营销进行合作。'),
          contractStatus: optional('履行中'),
        },
      }),
      extFields: {
        cooperationType: must('市场合作'),
        cooperationScope: must('围绕华南区域渠道开发、联合路演和品牌曝光开展协作'),
        cooperationMechanism: optional('建立季度运营例会和双周线索同步机制'),
        investmentA: optional('甲方提供品牌物料、市场预算和销售线索系统'),
        investmentB: optional('乙方提供区域地推团队和媒体资源'),
        revenueShare: optional('按净回款 15% 向乙方结算渠道分成'),
        exclusivity: optional('非独家合作'),
        validityPeriod: optional('自签署之日起12个月'),
      },
      partyBUnit: {
        name: must('广州触达数字营销有限公司'),
        legal_rep_name: optional('梁亦凡'),
        phone: optional('020-38881221'),
        address: optional('广州市天河区黄埔大道西669号'),
        tax_number: optional('91440101MA59GF8Q6R'),
        bank_name: optional('广发银行广州体育西支行'),
        bank_account: optional('6232590088800111223'),
        invoice_type: optional('专票'),
      },
      partyBContacts: [
        {
          fields: {
            name: optional('邓敏'),
            mobile: optional('13610110027'),
            email: optional('dengmin@chuda-marketing.cn'),
            department: manual('渠道运营部'),
          },
        },
      ],
      receiptPlans: [
        {
          scenario: 'double_installment',
          fields: {
            plan_name: must('渠道启动服务费'),
            direction: must('付款'),
            expected_date: must('2026-02-15'),
            expected_amount: must(300000),
            ratio: optional(37.5),
            remark: optional('合作启动并完成首轮培训后支付'),
          },
        },
        {
          scenario: 'double_installment',
          fields: {
            plan_name: must('季度达标分成'),
            direction: must('付款'),
            expected_date: must('2026-06-30'),
            expected_amount: must(500000),
            ratio: optional(62.5),
            remark: optional('按达成净回款比例计算'),
          },
        },
      ],
      notes: ['该样本覆盖合作协议中“投入项 + 分成项 + 非独家约定”同时出现的布局。'],
    },
  }),
  defineSample({
    contractTypeKey: 'COOPERATION',
    sequence: 2,
    variantKey: 'joint-innovation',
    variantLabel: '联合创新版',
    receiptPlanScenario: 'multi_installment',
    truthTemplate: {
      builtinFields: buildBaseBuiltinFields('COOPERATION', {
        contractName: '联合创新实验室合作协议',
        contractCode: 'COP-2026-002',
        clientName: '上海新曜智能装备有限公司',
        partyBName: '苏州智链工业互联网研究院有限公司',
        signingDate: '2026-05-09',
        contractAmount: 1200000,
        optionalFields: {
          endDate: must('2028-05-08'),
          contractSummary: optional('联合建设工业互联网实验室并共同开展课题孵化。'),
          responsiblePerson: optional('王青'),
          department: optional('研发中心'),
        },
      }),
      extFields: {
        cooperationType: must('技术合作'),
        cooperationScope: must('围绕设备数据采集、工业协议适配和 AI 预测性维护开展课题研发'),
        cooperationMechanism: optional('共设联合课题组，每月举行一次 steering committee'),
        investmentA: optional('甲方提供测试产线、研发工位和样机'),
        investmentB: optional('乙方提供研究员、算法框架与专利方法'),
        revenueShare: optional('成果产业化后按 6:4 分配收益'),
        exclusivity: optional('独家合作'),
        validityPeriod: optional('3年'),
      },
      partyBUnit: {
        name: must('苏州智链工业互联网研究院有限公司'),
        legal_rep_name: optional('韩霄'),
        legal_rep_email: optional('hanxiao@ic-research.cn'),
        phone: optional('0512-68001210'),
        address: optional('苏州市高新区科技城科灵路10号'),
        invoice_type: optional('专票'),
      },
      partyBContacts: [
        {
          fields: {
            name: optional('姜彤'),
            mobile: optional('13962118802'),
            email: optional('jiangtong@ic-research.cn'),
            is_primary: manual('true'),
          },
        },
        {
          fields: {
            name: optional('卢谦'),
            phone: optional('0512-68001211'),
            department: manual('项目管理办公室'),
          },
        },
      ],
      receiptPlans: [
        {
          scenario: 'multi_installment',
          fields: {
            plan_name: must('实验室启动投入'),
            direction: must('付款'),
            expected_date: must('2026-05-20'),
            expected_amount: must(400000),
            ratio: optional(33.33),
          },
        },
        {
          scenario: 'multi_installment',
          fields: {
            plan_name: must('中期课题拨付'),
            direction: must('付款'),
            expected_date: must('2026-11-30'),
            expected_amount: must(400000),
            ratio: optional(33.33),
            remark: optional('完成阶段成果评审后支付'),
          },
        },
        {
          scenario: 'multi_installment',
          fields: {
            plan_name: must('结题拨付'),
            direction: must('付款'),
            expected_date: must('2027-05-31'),
            expected_amount: must(400000),
            ratio: optional(33.34),
            remark: optional('验收通过后支付'),
          },
        },
      ],
      notes: ['该样本适合在文本中引入表格与条列式课题清单，增强版式多样性。'],
    },
  }),
  defineSample({
    contractTypeKey: 'COOPERATION',
    sequence: 3,
    variantKey: 'resource-exchange',
    variantLabel: '资源置换版',
    receiptPlanScenario: 'single_installment',
    truthTemplate: {
      builtinFields: buildBaseBuiltinFields('COOPERATION', {
        contractName: '品牌资源置换合作协议',
        contractCode: 'COP-2026-003',
        clientName: '深圳海域智媒有限公司',
        partyBName: '成都映桥会展服务有限公司',
        signingDate: '2026-07-16',
        contractAmount: 300000,
        optionalFields: {
          endDate: must('2026-12-31'),
          settlementMethod: optional('资源互换折价结算'),
          contractSummary: optional('双方以展会展位、媒体曝光和客户邀约资源进行互换合作。'),
        },
      }),
      extFields: {
        cooperationType: must('资源置换'),
        cooperationScope: must('互换行业峰会展位、直播推广资源和参会客户邀约名单'),
        investmentA: optional('甲方提供主论坛冠名和直播导流资源'),
        investmentB: optional('乙方提供线下展区搭建和会务接待资源'),
        revenueShare: optional('超额商业化收入按 5:5 分配'),
        validityPeriod: optional('至 2026 年 12 月 31 日'),
      },
      partyBUnit: {
        name: must('成都映桥会展服务有限公司'),
        legal_rep_name: optional('赵沛'),
        phone: optional('028-83360071'),
        address: optional('成都市高新区益州大道中段555号'),
        invoice_type: optional('普票'),
      },
      partyBContacts: [
        {
          fields: {
            name: optional('何栩'),
            mobile: optional('13550210087'),
            email: optional('hexu@inqiao-event.cn'),
            wechat: manual('inqiao-hexu'),
          },
        },
      ],
      receiptPlans: [
        {
          scenario: 'single_installment',
          fields: {
            plan_name: must('资源折价补差结算'),
            direction: must('收款'),
            expected_date: must('2026-11-15'),
            expected_amount: must(300000),
            remark: optional('按双方实际核销后的差额一次性结算'),
          },
        },
      ],
      notes: ['资源置换样本用于覆盖“收款方向 + 折价差额”表达。'],
    },
  }),
  defineSample({
    contractTypeKey: 'LEASE',
    sequence: 1,
    variantKey: 'office-space',
    variantLabel: '办公场地版',
    receiptPlanScenario: 'multi_installment',
    truthTemplate: {
      builtinFields: buildBaseBuiltinFields('LEASE', {
        contractName: '办公场地租赁合同',
        contractCode: 'LEA-2026-001',
        clientName: '杭州极目数据科技有限公司',
        partyBName: '杭州凌洲置业有限公司',
        signingDate: '2026-01-08',
        contractAmount: 864000,
        optionalFields: {
          endDate: must('2027-12-31'),
          settlementMethod: optional('银行转账'),
          contractSummary: optional('承租滨江办公楼 12 层整层，租期两年。'),
          executionMethod: optional('按月支付租金'),
        },
      }),
      extFields: {
        leaseItem: must('杭州市滨江区海创园 A 座 12 层'),
        leaseStartDate: must('2026-01-01'),
        leaseEndDate: must('2027-12-31'),
        monthlyRent: must(36000),
        assetArea: optional(680),
        depositAmount: optional(72000),
        rentCycle: optional('月付'),
        purpose: optional('办公'),
      },
      partyBUnit: {
        name: must('杭州凌洲置业有限公司'),
        legal_rep_name: optional('蒋昊'),
        phone: optional('0571-86690018'),
        address: optional('杭州市滨江区江虹路1750号'),
        tax_number: optional('91330108MA2B1Q2R7P'),
        bank_name: optional('宁波银行杭州滨江支行'),
        bank_account: optional('7901001222333444555'),
      },
      partyBContacts: [
        {
          fields: {
            name: optional('严玥'),
            mobile: optional('13868006721'),
            email: optional('yanyue@lingzhou-estate.cn'),
            department: manual('招商主管中心'),
          },
        },
      ],
      receiptPlans: [
        {
          scenario: 'multi_installment',
          fields: {
            plan_name: must('租赁保证金'),
            direction: must('付款'),
            expected_date: must('2026-01-05'),
            expected_amount: must(72000),
            remark: optional('签约后三个工作日内支付'),
          },
        },
        {
          scenario: 'multi_installment',
          fields: {
            plan_name: must('首月租金'),
            direction: must('付款'),
            expected_date: must('2026-01-10'),
            expected_amount: must(36000),
            ratio: optional(4.17),
          },
        },
        {
          scenario: 'multi_installment',
          fields: {
            plan_name: must('月度租金循环支付'),
            direction: must('付款'),
            receipt_frequency: optional('按月'),
            expected_date: must('2026-02-10'),
            expected_amount: must(36000),
            remark: optional('此后每月10日前支付当月租金'),
          },
        },
      ],
      notes: ['办公场地版要求合同中同时出现面积、押金和按月支付条款。'],
    },
  }),
  defineSample({
    contractTypeKey: 'LEASE',
    sequence: 2,
    variantKey: 'warehouse',
    variantLabel: '仓储租赁版',
    receiptPlanScenario: 'double_installment',
    truthTemplate: {
      builtinFields: buildBaseBuiltinFields('LEASE', {
        contractName: '仓储场地租赁合同',
        contractCode: 'LEA-2026-002',
        clientName: '宁波海谱供应链有限公司',
        partyBName: '宁波临港仓储运营有限公司',
        signingDate: '2026-02-20',
        contractAmount: 480000,
        optionalFields: {
          endDate: must('2027-02-19'),
          contractStatus: optional('履行中'),
          procurementSource: optional('直接租赁'),
          contractSummary: optional('承租恒温仓及附属月台用于医疗耗材存储。'),
        },
      }),
      extFields: {
        leaseItem: must('宁波保税区 3 号恒温仓 2-4 号区'),
        leaseStartDate: must('2026-03-01'),
        leaseEndDate: must('2027-02-19'),
        monthlyRent: must(40000),
        assetArea: optional(1200),
        depositAmount: optional(80000),
        rentCycle: optional('半年付'),
        purpose: optional('仓储'),
      },
      partyBUnit: {
        name: must('宁波临港仓储运营有限公司'),
        legal_rep_name: optional('俞正'),
        phone: optional('0574-86886620'),
        address: optional('宁波北仑区港兴路68号'),
        bank_name: optional('中国工商银行宁波北仑支行'),
        bank_account: optional('3901029988776655441'),
        invoice_type: optional('专票'),
      },
      partyBContacts: [
        {
          fields: {
            name: optional('宋妍'),
            mobile: optional('13732190010'),
            email: optional('songyan@gangcang.cn'),
          },
        },
      ],
      receiptPlans: [
        {
          scenario: 'double_installment',
          fields: {
            plan_name: must('保证金及首期租金'),
            direction: must('付款'),
            expected_date: must('2026-02-25'),
            expected_amount: must(320000),
            ratio: optional(66.67),
            remark: optional('含押金 8 万和前 6 个月租金'),
          },
        },
        {
          scenario: 'double_installment',
          fields: {
            plan_name: must('第二期租金'),
            direction: must('付款'),
            expected_date: must('2026-09-01'),
            expected_amount: must(240000),
            ratio: optional(50),
            remark: optional('覆盖剩余 6 个月租金'),
          },
        },
      ],
      notes: ['仓储版强调“半年付 + 保证金并入首期”的复杂金额表述。'],
    },
  }),
  defineSample({
    contractTypeKey: 'LEASE',
    sequence: 3,
    variantKey: 'equipment',
    variantLabel: '设备租赁版',
    receiptPlanScenario: 'single_installment',
    truthTemplate: {
      builtinFields: buildBaseBuiltinFields('LEASE', {
        contractName: '工程设备租赁合同',
        contractCode: 'LEA-2026-003',
        clientName: '武汉智维建设工程有限公司',
        partyBName: '长沙岳虎机械设备有限公司',
        signingDate: '2026-04-11',
        contractAmount: 150000,
        optionalFields: {
          endDate: must('2026-10-10'),
          settlementMethod: optional('开票后一次性支付'),
          executionMethod: optional('按项目节点归还'),
        },
      }),
      extFields: {
        leaseItem: must('塔式起重机 QTZ80 及附属配件'),
        leaseStartDate: must('2026-04-15'),
        leaseEndDate: must('2026-10-10'),
        monthlyRent: must(25000),
        depositAmount: optional(30000),
        purpose: optional('工程施工'),
      },
      partyBUnit: {
        name: must('长沙岳虎机械设备有限公司'),
        legal_rep_name: optional('唐明哲'),
        phone: optional('0731-88900017'),
        address: optional('长沙市雨花区环保中路169号'),
        invoice_type: optional('普票'),
      },
      partyBContacts: [
        {
          fields: {
            name: optional('彭可'),
            mobile: optional('13873119952'),
            is_legal_representative: manual('false'),
          },
        },
      ],
      receiptPlans: [
        {
          scenario: 'single_installment',
          fields: {
            plan_name: must('设备租金结算'),
            direction: must('付款'),
            expected_date: must('2026-10-15'),
            expected_amount: must(150000),
            remark: optional('归还设备并完成验收后一次性结算'),
          },
        },
      ],
      notes: ['设备租赁版用于覆盖“标的型号 + 工程用途 + 一次性结算”场景。'],
    },
  }),
  defineSample({
    contractTypeKey: 'LEASE',
    sequence: 4,
    variantKey: 'vehicle',
    variantLabel: '车辆租赁版',
    receiptPlanScenario: 'multi_installment',
    truthTemplate: {
      builtinFields: buildBaseBuiltinFields('LEASE', {
        contractName: '车辆租赁服务合同',
        contractCode: 'LEA-2026-004',
        clientName: '西安迅驰城市配送有限公司',
        partyBName: '西安云禾汽车租赁有限公司',
        signingDate: '2026-06-03',
        contractAmount: 216000,
        optionalFields: {
          endDate: must('2027-05-31'),
          contractSummary: optional('租赁 6 台新能源厢式货车用于同城配送。'),
          responsiblePerson: optional('赵辰'),
        },
      }),
      extFields: {
        leaseItem: must('新能源厢式货车 6 台'),
        leaseStartDate: must('2026-06-10'),
        leaseEndDate: must('2027-05-31'),
        monthlyRent: must(18000),
        depositAmount: optional(36000),
        rentCycle: optional('季付'),
        purpose: optional('同城配送'),
      },
      partyBUnit: {
        name: must('西安云禾汽车租赁有限公司'),
        legal_rep_name: optional('徐竞'),
        phone: optional('029-88581103'),
        address: optional('西安市未央区凤城八路117号'),
        bank_name: optional('交通银行西安经开区支行'),
        bank_account: optional('6222628800112233445'),
      },
      partyBContacts: [
        {
          fields: {
            name: optional('程蔚'),
            mobile: optional('13991990082'),
            email: optional('chengwei@yh-carlease.cn'),
            department: manual('车务管理部'),
          },
        },
      ],
      receiptPlans: [
        {
          scenario: 'multi_installment',
          fields: {
            plan_name: must('车辆保证金'),
            direction: must('付款'),
            expected_date: must('2026-06-08'),
            expected_amount: must(36000),
          },
        },
        {
          scenario: 'multi_installment',
          fields: {
            plan_name: must('首季度租金'),
            direction: must('付款'),
            expected_date: must('2026-06-10'),
            expected_amount: must(54000),
            ratio: optional(25),
          },
        },
        {
          scenario: 'multi_installment',
          fields: {
            plan_name: must('后续季度租金'),
            direction: must('付款'),
            receipt_frequency: optional('按季'),
            expected_date: must('2026-09-10'),
            expected_amount: must(54000),
            remark: optional('此后每季度首月10日前支付'),
          },
        },
      ],
      notes: ['车辆租赁版覆盖“季付 + 保证金 + 多台标的”组合。'],
    },
  }),
  defineSample({
    contractTypeKey: 'PURCHASE',
    sequence: 1,
    variantKey: 'laptop-batch',
    variantLabel: '笔记本批采版',
    receiptPlanScenario: 'double_installment',
    truthTemplate: {
      builtinFields: buildBaseBuiltinFields('PURCHASE', {
        contractName: '办公笔记本采购合同',
        contractCode: 'PUR-2026-001',
        clientName: '北京启航软件有限公司',
        partyBName: '北京睿采信息科技有限公司',
        signingDate: '2026-01-12',
        contractAmount: 486000,
        optionalFields: {
          endDate: must('2026-03-31'),
          settlementMethod: optional('验收后对公转账'),
          procurementSource: optional('公开比价'),
          contractSummary: optional('采购 54 台开发办公笔记本及扩展坞。'),
        },
      }),
      extFields: {
        goodsCategory: must('电子产品'),
        qualityStandard: must('符合厂商出厂标准并支持 3 年全国联保'),
        deliveryPlace: must('北京市海淀区上地信息路 19 号'),
        brand: optional('ThinkPad'),
        warrantyMonths: optional(36),
        inspectionMethod: optional('到货开箱检查并完成资产登记'),
        transportMethod: optional('快递'),
        prepayRatio: optional(30),
      },
      partyBUnit: {
        name: must('北京睿采信息科技有限公司'),
        legal_rep_name: optional('方言'),
        phone: optional('010-62990071'),
        address: optional('北京市昌平区回龙观西大街 9 号'),
        tax_number: optional('91110114MA01TQ9L2B'),
        bank_name: optional('中国建设银行北京回龙观支行'),
        bank_account: optional('1105019988776655222'),
        invoice_type: optional('专票'),
      },
      partyBContacts: [
        {
          fields: {
            name: optional('侯颖'),
            mobile: optional('13681120098'),
            email: optional('houying@ruicai-it.cn'),
          },
        },
      ],
      receiptPlans: [
        {
          scenario: 'double_installment',
          fields: {
            plan_name: must('预付款'),
            direction: must('付款'),
            expected_date: must('2026-01-15'),
            expected_amount: must(145800),
            ratio: optional(30),
          },
        },
        {
          scenario: 'double_installment',
          fields: {
            plan_name: must('验收尾款'),
            direction: must('付款'),
            expected_date: must('2026-02-28'),
            expected_amount: must(340200),
            ratio: optional(70),
            remark: optional('完成验收并收到专票后支付'),
          },
        },
      ],
      notes: ['笔记本采购版覆盖“品牌 + 质保期 + 预付款比例”。'],
    },
  }),
  defineSample({
    contractTypeKey: 'PURCHASE',
    sequence: 2,
    variantKey: 'office-supplies',
    variantLabel: '办公耗材版',
    receiptPlanScenario: 'multi_installment',
    truthTemplate: {
      builtinFields: buildBaseBuiltinFields('PURCHASE', {
        contractName: '办公耗材年度采购框架合同',
        contractCode: 'PUR-2026-002',
        clientName: '天津广联物流科技有限公司',
        partyBName: '天津辰墨办公用品有限公司',
        signingDate: '2026-02-02',
        contractAmount: 240000,
        optionalFields: {
          endDate: must('2026-12-31'),
          contractStatus: optional('履行中'),
          executionMethod: optional('按月分批供货'),
        },
      }),
      extFields: {
        goodsCategory: must('耗材'),
        qualityStandard: must('满足国标及甲方常用品牌清单要求'),
        deliveryPlace: must('天津市西青区中北工业园创新道 18 号'),
        inspectionMethod: optional('到货数量抽检与质量抽样'),
        transportMethod: optional('快递'),
        prepayRatio: optional(20),
      },
      partyBUnit: {
        name: must('天津辰墨办公用品有限公司'),
        legal_rep_name: optional('韩涛'),
        phone: optional('022-87990084'),
        address: optional('天津市西青区海泰发展六道 6 号'),
        invoice_type: optional('普票'),
      },
      partyBContacts: [
        {
          fields: {
            name: optional('钱倩'),
            mobile: optional('13820330041'),
            wechat: manual('cm-office-qian'),
          },
        },
      ],
      receiptPlans: [
        {
          scenario: 'multi_installment',
          fields: {
            plan_name: must('框架预付款'),
            direction: must('付款'),
            expected_date: must('2026-02-05'),
            expected_amount: must(48000),
            ratio: optional(20),
          },
        },
        {
          scenario: 'multi_installment',
          fields: {
            plan_name: must('季度结算款'),
            direction: must('付款'),
            receipt_frequency: optional('按季'),
            expected_date: must('2026-04-05'),
            expected_amount: must(64000),
            remark: optional('每季度按实际领用量结算'),
          },
        },
        {
          scenario: 'multi_installment',
          fields: {
            plan_name: must('年度尾款'),
            direction: must('付款'),
            expected_date: must('2026-12-20'),
            expected_amount: must(128000),
            ratio: optional(53.33),
          },
        },
      ],
      notes: ['耗材框架版适合覆盖“按季结算 + 年度尾款 + 分批发货”语义。'],
    },
  }),
  defineSample({
    contractTypeKey: 'PURCHASE',
    sequence: 3,
    variantKey: 'server-equipment',
    variantLabel: '服务器设备版',
    receiptPlanScenario: 'single_installment',
    truthTemplate: {
      builtinFields: buildBaseBuiltinFields('PURCHASE', {
        contractName: '服务器设备采购合同',
        contractCode: 'PUR-2026-003',
        clientName: '上海凌数云计算有限公司',
        partyBName: '上海弘岳信息系统有限公司',
        signingDate: '2026-03-18',
        contractAmount: 980000,
        optionalFields: {
          endDate: must('2026-05-31'),
          settlementMethod: optional('一次性付款'),
          procurementSource: optional('项目专项采购'),
        },
      }),
      extFields: {
        goodsCategory: must('电子产品'),
        qualityStandard: must('原厂整机、配置与招标清单一致并附 SN 清单'),
        deliveryPlace: must('上海市浦东新区祖冲之路 2277 弄 1 号'),
        brand: optional('浪潮'),
        warrantyMonths: optional(60),
        inspectionMethod: optional('机房上架通电联调验收'),
        transportMethod: optional('陆运'),
      },
      partyBUnit: {
        name: must('上海弘岳信息系统有限公司'),
        legal_rep_name: optional('陈捷'),
        phone: optional('021-55561129'),
        address: optional('上海市杨浦区长阳路 1687 号'),
        bank_name: optional('浦发银行上海杨浦支行'),
        bank_account: optional('9340001220003191888'),
        invoice_type: optional('专票'),
      },
      partyBContacts: [
        {
          fields: {
            name: optional('陆闻'),
            mobile: optional('13764650073'),
            email: optional('luwen@hongyue-sys.cn'),
            department: manual('项目交付部'),
          },
        },
      ],
      receiptPlans: [
        {
          scenario: 'single_installment',
          fields: {
            plan_name: must('项目整体验收付款'),
            direction: must('付款'),
            expected_date: must('2026-05-20'),
            expected_amount: must(980000),
            remark: optional('服务器上架联调通过后一次性支付'),
          },
        },
      ],
      notes: ['服务器版应突出 SN 清单、机房上架、联调验收等技术采购语境。'],
    },
  }),
  defineSample({
    contractTypeKey: 'PURCHASE',
    sequence: 4,
    variantKey: 'display-screen',
    variantLabel: '显示屏项目版',
    receiptPlanScenario: 'multi_installment',
    truthTemplate: {
      builtinFields: buildBaseBuiltinFields('PURCHASE', {
        contractName: '会议显示屏采购及安装合同',
        contractCode: 'PUR-2026-004',
        clientName: '重庆山城文旅运营有限公司',
        partyBName: '重庆煜显电子工程有限公司',
        signingDate: '2026-05-26',
        contractAmount: 650000,
        optionalFields: {
          endDate: must('2026-08-31'),
          executionMethod: optional('供货安装一体化'),
          contractSummary: optional('采购 LED 会议屏并完成安装调试培训。'),
        },
      }),
      extFields: {
        goodsCategory: must('电子产品'),
        qualityStandard: must('显示屏亮度、分辨率和拼缝符合技术附件要求'),
        deliveryPlace: must('重庆市渝中区解放碑步行街游客中心'),
        brand: optional('利亚德'),
        warrantyMonths: optional(24),
        inspectionMethod: optional('安装调试完成后按技术指标验收'),
        transportMethod: optional('陆运'),
        prepayRatio: optional(40),
      },
      partyBUnit: {
        name: must('重庆煜显电子工程有限公司'),
        legal_rep_name: optional('向晨'),
        phone: optional('023-68770031'),
        address: optional('重庆市九龙坡区石桥铺科园一路 3 号'),
        tax_number: optional('91500107MA5U8Y7D3C'),
        invoice_type: optional('专票'),
      },
      partyBContacts: [
        {
          fields: {
            name: optional('郭琳'),
            mobile: optional('13883331174'),
            email: optional('guolin@yuxian-led.cn'),
          },
        },
      ],
      receiptPlans: [
        {
          scenario: 'multi_installment',
          fields: {
            plan_name: must('项目预付款'),
            direction: must('付款'),
            expected_date: must('2026-05-30'),
            expected_amount: must(260000),
            ratio: optional(40),
          },
        },
        {
          scenario: 'multi_installment',
          fields: {
            plan_name: must('到货进度款'),
            direction: must('付款'),
            expected_date: must('2026-06-30'),
            expected_amount: must(260000),
            ratio: optional(40),
          },
        },
        {
          scenario: 'multi_installment',
          fields: {
            plan_name: must('验收尾款'),
            direction: must('付款'),
            expected_date: must('2026-08-20'),
            expected_amount: must(130000),
            ratio: optional(20),
          },
        },
      ],
      notes: ['显示屏项目版覆盖“供货 + 安装 + 培训 + 里程碑结算”组合。'],
    },
  }),
  defineSample({
    contractTypeKey: 'PURCHASE',
    sequence: 5,
    variantKey: 'spare-parts',
    variantLabel: '备件应急版',
    receiptPlanScenario: 'single_installment',
    truthTemplate: {
      builtinFields: buildBaseBuiltinFields('PURCHASE', {
        contractName: '设备备件应急采购合同',
        contractCode: 'PUR-2026-005',
        clientName: '青岛海岳自动化有限公司',
        partyBName: '济南维配机电有限公司',
        signingDate: '2026-08-04',
        contractAmount: 98000,
        optionalFields: {
          endDate: must('2026-08-31'),
          settlementMethod: optional('到货验收后 10 日内付款'),
          contractStatus: optional('待履行'),
        },
      }),
      extFields: {
        goodsCategory: must('其他'),
        qualityStandard: must('备件型号与设备铭牌一致，须提供原厂合格证明'),
        deliveryPlace: must('青岛市即墨区智能制造产业园 5 号厂房'),
        inspectionMethod: optional('到货点检并试运行'),
        transportMethod: optional('空运'),
      },
      partyBUnit: {
        name: must('济南维配机电有限公司'),
        legal_rep_name: optional('邵泉'),
        phone: optional('0531-69991127'),
        address: optional('济南市高新区舜华路 750 号'),
        invoice_type: optional('普票'),
      },
      partyBContacts: [
        {
          fields: {
            name: optional('马超'),
            mobile: optional('13853110027'),
            phone: optional('0531-69991128'),
          },
        },
      ],
      receiptPlans: [
        {
          scenario: 'single_installment',
          fields: {
            plan_name: must('应急备件结算款'),
            direction: must('付款'),
            expected_date: must('2026-08-25'),
            expected_amount: must(98000),
            remark: optional('全部备件到货并试运行通过后支付'),
          },
        },
      ],
      notes: ['备件应急版强调型号、合格证明、试运行验收等零散字段。'],
    },
  }),
  defineSample({
    contractTypeKey: 'LABOR',
    sequence: 1,
    variantKey: 'fixed-term-engineer',
    variantLabel: '固定期限工程师版',
    receiptPlanScenario: 'multi_installment',
    truthTemplate: {
      builtinFields: buildBaseBuiltinFields('LABOR', {
        contractName: '劳动合同书',
        contractCode: 'LAB-2026-001',
        clientName: '成都智元软件有限公司',
        partyBName: '李知远',
        signingDate: '2026-01-03',
        contractAmount: 276000,
        optionalFields: {
          endDate: must('2028-01-02'),
          department: optional('研发中心'),
          responsiblePerson: optional('谢琳'),
          contractSummary: optional('聘任高级后端工程师，含试用期及保密义务。'),
        },
      }),
      extFields: {
        position: must('高级后端工程师'),
        department: must('平台研发部'),
        termType: must('固定期限'),
        probationMonths: optional(3),
        workingHours: optional('标准工时'),
        workLocation: optional('成都高新区天府五街 200 号'),
        confidentialityYears: optional(3),
        nonCompeteYears: optional(1),
      },
      partyBUnit: {
        name: must('李知远'),
        legal_rep_name: optional('李知远', '自然人样本中该字段可回落为本人姓名，用于兼容乙方结构。'),
        phone: optional('13880990018'),
        address: optional('成都市武侯区锦悦西路 66 号'),
      },
      partyBContacts: [
        {
          fields: {
            name: optional('李知远'),
            mobile: optional('13880990018'),
            email: optional('lzy.dev@example.com'),
            department: manual('个人'),
          },
        },
      ],
      receiptPlans: [
        {
          scenario: 'multi_installment',
          fields: {
            plan_name: must('试用期工资发放'),
            direction: must('付款'),
            receipt_frequency: optional('按月'),
            expected_date: must('2026-02-15'),
            expected_amount: must(18000),
            remark: optional('发放上月工资'),
          },
        },
        {
          scenario: 'multi_installment',
          fields: {
            plan_name: must('转正后工资发放'),
            direction: must('付款'),
            receipt_frequency: optional('按月'),
            expected_date: must('2026-05-15'),
            expected_amount: must(23000),
            remark: optional('转正后自次月起执行'),
          },
        },
      ],
      notes: ['劳动合同样本保留自然人乙方结构，用于验证对个人主体的兼容性。'],
    },
  }),
  defineSample({
    contractTypeKey: 'LABOR',
    sequence: 2,
    variantKey: 'open-ended-sales',
    variantLabel: '无固定期限销售版',
    receiptPlanScenario: 'single_installment',
    truthTemplate: {
      builtinFields: buildBaseBuiltinFields('LABOR', {
        contractName: '无固定期限劳动合同',
        contractCode: 'LAB-2026-002',
        clientName: '深圳拓远科技有限公司',
        partyBName: '周沐晴',
        signingDate: '2026-03-10',
        contractAmount: 360000,
        optionalFields: {
          department: optional('市场中心'),
          contractStatus: optional('生效中'),
          remark: optional('绩效提成另行按销售管理办法执行。'),
        },
      }),
      extFields: {
        position: must('区域销售经理'),
        department: must('华南销售部'),
        termType: must('无固定期限'),
        workingHours: optional('不定时工时'),
        workLocation: optional('深圳市南山区科技园'),
        confidentialityYears: optional(2),
      },
      partyBUnit: {
        name: must('周沐晴'),
        phone: optional('13926550074'),
        address: optional('深圳市宝安区新安一路 19 号'),
      },
      partyBContacts: [
        {
          fields: {
            name: optional('周沐晴'),
            mobile: optional('13926550074'),
            email: optional('zhoumq.sales@example.com'),
          },
        },
      ],
      receiptPlans: [
        {
          scenario: 'single_installment',
          fields: {
            plan_name: must('月度薪酬发放规则'),
            direction: must('付款'),
            receipt_frequency: optional('按月'),
            expected_date: must('每月15日'),
            expected_amount: must(30000),
            remark: optional('发放上月固定工资，提成部分另行核算'),
          },
        },
      ],
      notes: ['该样本覆盖“无固定期限 + 不定时工时 + 月度固定薪酬规则”描述。'],
    },
  }),
  defineSample({
    contractTypeKey: 'LABOR',
    sequence: 3,
    variantKey: 'project-term-designer',
    variantLabel: '项目制设计师版',
    receiptPlanScenario: 'double_installment',
    truthTemplate: {
      builtinFields: buildBaseBuiltinFields('LABOR', {
        contractName: '以完成一定工作任务为期限劳动合同',
        contractCode: 'LAB-2026-003',
        clientName: '南京象合数字创意有限公司',
        partyBName: '何昭',
        signingDate: '2026-06-06',
        contractAmount: 198000,
        optionalFields: {
          endDate: must('2027-03-31'),
          department: optional('创意设计中心'),
          contractSummary: optional('围绕城市更新项目承担视觉与交互设计工作。'),
        },
      }),
      extFields: {
        position: must('视觉设计师'),
        department: must('项目设计组'),
        termType: must('以完成一定工作任务为期限'),
        probationMonths: optional(1),
        workingHours: optional('综合计算工时'),
        workLocation: optional('南京市建邺区河西大街 198 号'),
        confidentialityYears: optional(2),
        nonCompeteYears: optional(1),
      },
      partyBUnit: {
        name: must('何昭'),
        phone: optional('13770660019'),
        address: optional('南京市建邺区庐山路 88 号'),
      },
      partyBContacts: [
        {
          fields: {
            name: optional('何昭'),
            mobile: optional('13770660019'),
            email: optional('hezhao.design@example.com'),
            wechat: manual('hz-visual-01'),
          },
        },
      ],
      receiptPlans: [
        {
          scenario: 'double_installment',
          fields: {
            plan_name: must('月度基础工资'),
            direction: must('付款'),
            receipt_frequency: optional('按月'),
            expected_date: must('2026-07-15'),
            expected_amount: must(15000),
          },
        },
        {
          scenario: 'double_installment',
          fields: {
            plan_name: must('项目结项奖金'),
            direction: must('付款'),
            expected_date: must('2027-04-15'),
            expected_amount: must(18000),
            remark: optional('项目验收通过后次月发放'),
          },
        },
      ],
      notes: ['项目制劳动合同样本用于覆盖“工作任务完成即到期”的措辞。'],
    },
  }),
  defineSample({
    contractTypeKey: 'LEGAL',
    sequence: 1,
    variantKey: 'litigation-agent',
    variantLabel: '诉讼代理版',
    receiptPlanScenario: 'double_installment',
    truthTemplate: {
      builtinFields: buildBaseBuiltinFields('LEGAL', {
        contractName: '民商事诉讼代理合同',
        contractCode: 'LEG-2026-001',
        clientName: '福州海讯电子有限公司',
        partyBName: '福建弘衡律师事务所',
        signingDate: '2026-01-22',
        contractAmount: 300000,
        optionalFields: {
          endDate: must('2027-01-21'),
          settlementMethod: optional('对公转账'),
          contractSummary: optional('委托处理买卖合同纠纷一审及后续执行。'),
        },
      }),
      extFields: {
        serviceType: must('诉讼代理'),
        serviceScope: must('负责一审起诉、庭审代理、证据组织及执行申请'),
        caseNumber: optional('(2026)闽0102民初1188号'),
        courtName: optional('福州市鼓楼区人民法院'),
        assignedLawyer: optional('陈昱律师'),
        litigationAmount: optional(5200000),
        agencyFee: optional(300000),
        caseStatus: optional('一审'),
      },
      partyBUnit: {
        name: must('福建弘衡律师事务所'),
        legal_rep_name: optional('刘博'),
        phone: optional('0591-87550016'),
        address: optional('福州市鼓楼区五四路 158 号'),
        bank_name: optional('兴业银行福州分行'),
        bank_account: optional('117210100100256889'),
        invoice_type: optional('专票'),
      },
      partyBContacts: [
        {
          fields: {
            name: optional('陈昱'),
            mobile: optional('13860660072'),
            email: optional('chenyu@honghenglaw.cn'),
            is_primary: manual('true'),
          },
        },
      ],
      receiptPlans: [
        {
          scenario: 'double_installment',
          fields: {
            plan_name: must('案件受理代理费首付款'),
            direction: must('付款'),
            expected_date: must('2026-01-25'),
            expected_amount: must(150000),
            ratio: optional(50),
          },
        },
        {
          scenario: 'double_installment',
          fields: {
            plan_name: must('一审开庭后代理费尾款'),
            direction: must('付款'),
            expected_date: must('2026-05-20'),
            expected_amount: must(150000),
            ratio: optional(50),
          },
        },
      ],
      notes: ['诉讼代理版重点覆盖案号、法院、指派律师、代理费。'],
    },
  }),
  defineSample({
    contractTypeKey: 'LEGAL',
    sequence: 2,
    variantKey: 'annual-counsel',
    variantLabel: '常年顾问版',
    receiptPlanScenario: 'multi_installment',
    truthTemplate: {
      builtinFields: buildBaseBuiltinFields('LEGAL', {
        contractName: '常年法律顾问服务合同',
        contractCode: 'LEG-2026-002',
        clientName: '无锡星合智造有限公司',
        partyBName: '江苏正衡律师事务所',
        signingDate: '2026-04-02',
        contractAmount: 180000,
        optionalFields: {
          endDate: must('2027-04-01'),
          executionMethod: optional('按月提供顾问服务'),
          contractStatus: optional('履行中'),
        },
      }),
      extFields: {
        serviceType: must('法律顾问'),
        serviceScope: must('合同审查、劳动用工咨询、日常合规咨询和专项培训'),
        assignedLawyer: optional('沈乔律师'),
        agencyFee: optional(180000),
        caseStatus: optional('结案', '顾问类样本可使用该字段表示非诉服务状态，便于验证可选字段兼容。'),
      },
      partyBUnit: {
        name: must('江苏正衡律师事务所'),
        legal_rep_name: optional('马骁'),
        phone: optional('0510-88800031'),
        address: optional('无锡市梁溪区中山路 159 号'),
        invoice_type: optional('专票'),
      },
      partyBContacts: [
        {
          fields: {
            name: optional('沈乔'),
            mobile: optional('13921110061'),
            email: optional('shenqiao@zhenghenglaw.cn'),
            department: manual('公司法业务部'),
          },
        },
      ],
      receiptPlans: [
        {
          scenario: 'multi_installment',
          fields: {
            plan_name: must('顾问费首期'),
            direction: must('付款'),
            expected_date: must('2026-04-05'),
            expected_amount: must(60000),
            ratio: optional(33.33),
          },
        },
        {
          scenario: 'multi_installment',
          fields: {
            plan_name: must('顾问费中期'),
            direction: must('付款'),
            expected_date: must('2026-10-05'),
            expected_amount: must(60000),
            ratio: optional(33.33),
          },
        },
        {
          scenario: 'multi_installment',
          fields: {
            plan_name: must('顾问费尾期'),
            direction: must('付款'),
            expected_date: must('2027-03-25'),
            expected_amount: must(60000),
            ratio: optional(33.34),
          },
        },
      ],
      notes: ['常法顾问版覆盖年费分期、日常咨询和合规培训等表述。'],
    },
  }),
  defineSample({
    contractTypeKey: 'LEGAL',
    sequence: 3,
    variantKey: 'compliance-review',
    variantLabel: '专项审查版',
    receiptPlanScenario: 'single_installment',
    truthTemplate: {
      builtinFields: buildBaseBuiltinFields('LEGAL', {
        contractName: '专项法律服务合同',
        contractCode: 'LEG-2026-003',
        clientName: '厦门远图跨境贸易有限公司',
        partyBName: '厦门观海律师事务所',
        signingDate: '2026-08-12',
        contractAmount: 120000,
        optionalFields: {
          endDate: must('2026-10-31'),
          contractSummary: optional('委托开展跨境业务合规和数据出境专项审查。'),
        },
      }),
      extFields: {
        serviceType: must('专项法律服务'),
        serviceScope: must('围绕跨境贸易合同、隐私政策和数据出境流程开展合规审查'),
        assignedLawyer: optional('叶澄律师'),
        agencyFee: optional(120000),
      },
      partyBUnit: {
        name: must('厦门观海律师事务所'),
        legal_rep_name: optional('谢蔚'),
        phone: optional('0592-55660041'),
        address: optional('厦门市思明区鹭江道 22 号'),
        bank_name: optional('中国银行厦门鹭江支行'),
        bank_account: optional('451200887733228899'),
      },
      partyBContacts: [
        {
          fields: {
            name: optional('叶澄'),
            mobile: optional('13850010048'),
            email: optional('yecheng@guanhailaw.cn'),
          },
        },
      ],
      receiptPlans: [
        {
          scenario: 'single_installment',
          fields: {
            plan_name: must('专项审查服务费'),
            direction: must('付款'),
            expected_date: must('2026-09-15'),
            expected_amount: must(120000),
            remark: optional('提交终版审查报告后一次性支付'),
          },
        },
      ],
      notes: ['专项审查版适合输出长段文本，验证 serviceScope 的抽取鲁棒性。'],
    },
  }),
  defineSample({
    contractTypeKey: 'IT_SERVICE',
    sequence: 1,
    variantKey: 'ops-outsourcing',
    variantLabel: '运维外包版',
    receiptPlanScenario: 'multi_installment',
    truthTemplate: {
      builtinFields: buildBaseBuiltinFields('IT_SERVICE', {
        contractName: '信息系统运维外包服务合同',
        contractCode: 'ITS-2026-001',
        clientName: '苏州博研医药科技有限公司',
        partyBName: '上海联序信息技术有限公司',
        signingDate: '2026-02-14',
        contractAmount: 720000,
        optionalFields: {
          endDate: must('2027-02-13'),
          settlementMethod: optional('季度结算'),
          executionMethod: optional('驻场+远程混合服务'),
          contractSummary: optional('围绕 ERP、MES 和数据库系统提供运维外包服务。'),
        },
      }),
      extFields: {
        serviceType: must('IT运维外包'),
        serviceContent: must('提供驻场工程师、7x12 告警响应、备份巡检和版本变更支持'),
        billingMethod: must('按项目'),
        teamSize: optional(4),
        slaLevel: optional('金牌'),
        responseTimeHours: optional(2),
      },
      partyBUnit: {
        name: must('上海联序信息技术有限公司'),
        legal_rep_name: optional('曹沛'),
        phone: optional('021-60221109'),
        address: optional('上海市徐汇区桂平路 481 号'),
        tax_number: optional('91310104MA1F2E8T7H'),
        bank_name: optional('中国民生银行上海徐汇支行'),
        bank_account: optional('695512220011883377'),
      },
      partyBContacts: [
        {
          fields: {
            name: optional('付扬'),
            mobile: optional('13817330095'),
            email: optional('fuyang@lianxu-it.cn'),
            department: manual('运维交付部'),
          },
        },
      ],
      receiptPlans: [
        {
          scenario: 'multi_installment',
          fields: {
            plan_name: must('首季度服务费'),
            direction: must('付款'),
            expected_date: must('2026-02-20'),
            expected_amount: must(180000),
            ratio: optional(25),
          },
        },
        {
          scenario: 'multi_installment',
          fields: {
            plan_name: must('第二季度服务费'),
            direction: must('付款'),
            expected_date: must('2026-05-20'),
            expected_amount: must(180000),
            ratio: optional(25),
          },
        },
        {
          scenario: 'multi_installment',
          fields: {
            plan_name: must('滚动季度服务费'),
            direction: must('付款'),
            receipt_frequency: optional('按季'),
            expected_date: must('2026-08-20'),
            expected_amount: must(180000),
            remark: optional('此后按季度滚动结算'),
          },
        },
      ],
      notes: ['运维外包版覆盖 SLA、响应时效、驻场服务等关键词。'],
    },
  }),
  defineSample({
    contractTypeKey: 'IT_SERVICE',
    sequence: 2,
    variantKey: 'implementation-project',
    variantLabel: '实施交付版',
    receiptPlanScenario: 'double_installment',
    truthTemplate: {
      builtinFields: buildBaseBuiltinFields('IT_SERVICE', {
        contractName: 'ERP 实施服务合同',
        contractCode: 'ITS-2026-002',
        clientName: '佛山凯元家居有限公司',
        partyBName: '广州云阶软件服务有限公司',
        signingDate: '2026-05-05',
        contractAmount: 560000,
        optionalFields: {
          endDate: must('2026-12-31'),
          contractSummary: optional('提供 ERP 蓝图设计、系统部署、培训与上线保障。'),
          responsiblePerson: optional('宋捷'),
        },
      }),
      extFields: {
        serviceType: must('实施服务'),
        serviceContent: must('完成蓝图调研、主数据初始化、流程配置、培训和上线切换支持'),
        billingMethod: must('按项目'),
        teamSize: optional(5),
        slaLevel: optional('银牌'),
        responseTimeHours: optional(4),
      },
      partyBUnit: {
        name: must('广州云阶软件服务有限公司'),
        legal_rep_name: optional('陆炜'),
        phone: optional('020-89220067'),
        address: optional('广州市海珠区新港东路 2519 号'),
        invoice_type: optional('专票'),
      },
      partyBContacts: [
        {
          fields: {
            name: optional('蔡盈'),
            mobile: optional('13660770024'),
            email: optional('caiying@yunjie-soft.cn'),
          },
        },
      ],
      receiptPlans: [
        {
          scenario: 'double_installment',
          fields: {
            plan_name: must('项目启动款'),
            direction: must('付款'),
            expected_date: must('2026-05-10'),
            expected_amount: must(224000),
            ratio: optional(40),
          },
        },
        {
          scenario: 'double_installment',
          fields: {
            plan_name: must('上线验收款'),
            direction: must('付款'),
            expected_date: must('2026-12-20'),
            expected_amount: must(336000),
            ratio: optional(60),
            remark: optional('系统上线并通过最终验收后支付'),
          },
        },
      ],
      notes: ['实施交付版覆盖项目式计费、验收节点和实施服务描述。'],
    },
  }),
  defineSample({
    contractTypeKey: 'IT_SERVICE',
    sequence: 3,
    variantKey: 'technical-consulting',
    variantLabel: '技术咨询版',
    receiptPlanScenario: 'single_installment',
    truthTemplate: {
      builtinFields: buildBaseBuiltinFields('IT_SERVICE', {
        contractName: '数字化转型技术咨询合同',
        contractCode: 'ITS-2026-003',
        clientName: '郑州中原装备制造集团有限公司',
        partyBName: '北京行知数策咨询有限公司',
        signingDate: '2026-09-01',
        contractAmount: 260000,
        optionalFields: {
          endDate: must('2026-11-30'),
          settlementMethod: optional('交付报告后一次性结算'),
          contractSummary: optional('开展数字化现状评估、架构规划及投资测算咨询。'),
        },
      }),
      extFields: {
        serviceType: must('技术咨询'),
        serviceContent: must('完成数字化成熟度评估、目标蓝图设计和三年行动路线图编制'),
        billingMethod: must('固定金额'),
        teamSize: optional(3),
        responseTimeHours: optional(8),
      },
      partyBUnit: {
        name: must('北京行知数策咨询有限公司'),
        legal_rep_name: optional('郭川'),
        phone: optional('010-68771182'),
        address: optional('北京市朝阳区酒仙桥路 14 号'),
        bank_name: optional('平安银行北京望京支行'),
        bank_account: optional('1100100223344556677'),
      },
      partyBContacts: [
        {
          fields: {
            name: optional('邵璇'),
            mobile: optional('13601220058'),
            email: optional('shaoxuan@xz-strategy.cn'),
            wechat: manual('xz-consult-sx'),
          },
        },
      ],
      receiptPlans: [
        {
          scenario: 'single_installment',
          fields: {
            plan_name: must('咨询服务费'),
            direction: must('付款'),
            expected_date: must('2026-11-25'),
            expected_amount: must(260000),
            remark: optional('提交正式咨询报告并完成汇报后支付'),
          },
        },
      ],
      notes: ['技术咨询版覆盖固定金额计费与咨询报告交付语义。'],
    },
  }),
]

function createGroundTruthFieldMap(fields: ContractScanSampleFoundation['builtinFields']): ContractScanSampleGroundTruthFieldMap {
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

function applyTemplateFieldMap(
  target: ContractScanSampleGroundTruthFieldMap,
  template?: ContractScanSampleTemplateFieldMap,
): void {
  if (!template) return
  for (const [key, input] of Object.entries(template)) {
    const current = target[key] || { value: null, expectation: input.expectation || 'must_hit' }
    target[key] = {
      ...current,
      value: input.value,
      expectation: input.expectation || current.expectation,
      notes: input.notes !== undefined ? input.notes : current.notes,
    }
  }
}

function resolveBlueprint(
  blueprint: ContractScanSampleBlueprint,
  foundation: ContractScanSampleFoundation,
  schemaConfig?: ContractFormSchemaConfig,
): ContractScanSampleResolvedBlueprint {
  const truth = createEmptyContractScanSampleGroundTruth({
    sampleId: blueprint.sampleId,
    contractTypeKey: blueprint.contractTypeKey,
    contractTypeLabel: blueprint.contractTypeLabel,
    fileName: blueprint.fileName,
    schemaConfig,
  })

  applyTemplateFieldMap(truth.builtinFields, blueprint.truthTemplate.builtinFields)
  applyTemplateFieldMap(truth.extFields, blueprint.truthTemplate.extFields)
  applyTemplateFieldMap(truth.partyBUnit, blueprint.truthTemplate.partyBUnit)

  truth.partyBContacts = (blueprint.truthTemplate.partyBContacts || []).map(contact => {
    const fields = createGroundTruthFieldMap(foundation.partyBContactFields)
    applyTemplateFieldMap(fields, contact.fields)
    return fields
  })

  truth.receiptPlans = (blueprint.truthTemplate.receiptPlans || []).map(plan => {
    const fields = createGroundTruthFieldMap(foundation.receiptPlan.fields)
    applyTemplateFieldMap(fields, plan.fields)
    return {
      scenario: plan.scenario,
      fields,
    }
  })

  truth.notes = blueprint.truthTemplate.notes ? [...blueprint.truthTemplate.notes] : []

  return {
    ...blueprint,
    truthTemplate: cloneTruthTemplate(blueprint.truthTemplate),
    truth,
  }
}

export function getContractScanSampleDistributions(): ContractScanSampleDistributionItem[] {
  return SAMPLE_DISTRIBUTION.map(cloneDistributionItem)
}

export function getContractScanSampleBlueprints(): ContractScanSampleBlueprint[] {
  return SAMPLE_BLUEPRINTS.map(blueprint => ({
    ...blueprint,
    truthTemplate: cloneTruthTemplate(blueprint.truthTemplate),
  }))
}

export function buildContractScanSamplePlanCatalog(
  schemaConfig?: ContractFormSchemaConfig,
): ContractScanSamplePlanCatalog {
  const foundation = buildContractScanSampleFoundation(schemaConfig)
  const samples = SAMPLE_BLUEPRINTS.map(blueprint => resolveBlueprint(blueprint, foundation, schemaConfig))

  return {
    version: CONTRACT_SCAN_SAMPLE_PLAN_VERSION,
    outputRootDir: CONTRACT_SCAN_SAMPLE_OUTPUT_ROOT_DIR,
    totalSamples: samples.length,
    fileNameRule: {
      ...CONTRACT_SCAN_SAMPLE_FILE_NAME_RULE,
      allowedExtensions: [...CONTRACT_SCAN_SAMPLE_FILE_NAME_RULE.allowedExtensions],
      notes: CONTRACT_SCAN_SAMPLE_FILE_NAME_RULE.notes ? [...CONTRACT_SCAN_SAMPLE_FILE_NAME_RULE.notes] : undefined,
    },
    distributions: getContractScanSampleDistributions(),
    samples,
  }
}

export function getContractScanSampleGenerationEntrypoint(
  schemaConfig?: ContractFormSchemaConfig,
): ContractScanSampleGenerationEntrypoint {
  const catalog = buildContractScanSamplePlanCatalog(schemaConfig)
  return {
    version: catalog.version,
    outputRootDir: catalog.outputRootDir,
    fileNameRule: {
      ...catalog.fileNameRule,
      allowedExtensions: [...catalog.fileNameRule.allowedExtensions],
      notes: catalog.fileNameRule.notes ? [...catalog.fileNameRule.notes] : undefined,
    },
    distributions: catalog.distributions.map(cloneDistributionItem),
    samples: catalog.samples.map(sample => ({
      ...sample,
      truthTemplate: cloneTruthTemplate(sample.truthTemplate),
      truth: {
        ...sample.truth,
        builtinFields: { ...sample.truth.builtinFields },
        extFields: { ...sample.truth.extFields },
        partyBUnit: { ...sample.truth.partyBUnit },
        partyBContacts: sample.truth.partyBContacts.map(contact => ({ ...contact })),
        receiptPlans: sample.truth.receiptPlans.map(plan => ({
          scenario: plan.scenario,
          fields: { ...plan.fields },
        })),
        notes: [...sample.truth.notes],
      },
    })),
  }
}
