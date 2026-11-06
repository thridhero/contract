import { computed, nextTick, reactive, ref, watch } from 'vue'
import { useToast } from 'primevue/usetoast'
import { createRendererLogger } from '@/utils/logger'
import { useAIStore } from '../../../../stores/system/aiStore'
import type { AIContractExtractionEvidenceResult, AIContractExtractionResult, AIExtractedReceiptPlan } from '../../../../../shared/types/ai.types'
import type { ContractInfoCreateDTO, ContractInfoEntity, ContractInfoUpdateDTO } from '../../../../../shared/types/contractInfo.types'
import type { ContractFormSchema, ContractFormSchemaConfig, ContractFormSchemaField, ContractFormSection } from '../../../../../shared/types/contractFormSchema.types'
import type { Customer, CustomerContact } from '../../../../../shared/types/customer.types'
import type { Personnel } from '../../../../../shared/types/personnel.types'
import type { Supplier } from '../../../../../shared/types/supplier.types'
import type { SupplierContact } from '../../../../../shared/types/supplier.types'
import { IdGenerator } from '../../../../../shared/utils/idGenerator'
import {
  extractContractExtData,
  getDefaultContractFormSchemaConfig,
  htmlToPlainText,
  isContractFieldInDefaultTab,
  isContractFieldInExtendedTab,
  normalizeContractFormSchemaConfig,
  parseContractExtData,
  resolveContractFormSchema,
  validateContractFormValues,
} from '../../../../../shared/utils/contractFormSchema'
import {
  normalizeStoredContractSummaryToMarkdown,
} from '../../../../utils/contractSummaryMarkdown'
import {
  buildDepartmentOptionsFromTreeNodes,
  buildDepartmentTreeFromGroupNode,
  buildFlatTreeNodes,
  buildIndentedTreeOptions,
  buildTreeNodes,
  createDefaultFormState,
  findGroupTreeNode,
  formatDate,
  matchOptionValue,
  normalizeContractName,
  normalizeGroupTreeNodeText,
  normalizeProjectColor,
  resolveSuggestedContractName,
  normalizeTreeSelectSingleKey,
  parseDate,
  parseDateText,
  primeIcons,
  sortFieldsForDisplay,
  tailwind700Colors,
  toSelectOptions,
  type GroupTreeNode,
  type SelectOption,
  type TreeNodeOption,
} from './createContractInfoModalUtils'

const logger = createRendererLogger('CreateContractInfoModal')
const AI_EXTRACT_TIMEOUT_MS = 8 * 60 * 1000

type CreatePayload = Omit<ContractInfoCreateDTO, 'libraryPath'>
type UpdatePayload = Omit<ContractInfoUpdateDTO, 'libraryPath'>
type ContractFormTab = ContractFormSection | 'ext' | 'partyAUnit' | 'partyBUnit' | 'receiptPlan'
type AIAppliedReceiptPlan = {
  plan_name: string
  direction: '收款' | '付款'
  receipt_frequency?: string
  ratio?: number
  expected_amount?: number
  expected_date?: string
  remark?: string
}
type AIPartyUnitForm = {
  legalRepName: string
  legalRepMobile: string
  legalRepEmail: string
  legalRepIdNumber: string
  phone: string
  address: string
  taxNumber: string
  bankName: string
  bankAccount: string
  invoiceType: string
}

/** 创建甲乙方单位信息的默认表单数据。 */
const createDefaultPartyUnitForm = (): AIPartyUnitForm => ({
  legalRepName: '',
  legalRepMobile: '',
  legalRepEmail: '',
  legalRepIdNumber: '',
  phone: '',
  address: '',
  taxNumber: '',
  bankName: '',
  bankAccount: '',
  invoiceType: '',
})

/** 封装新增/编辑合同弹窗的状态、校验与提交流程。 */
export function useCreateContractInfoModal(options: {
  visible: { value: boolean }
  mode: { value: 'create' | 'edit' }
  initial: { value: ContractInfoEntity | null }
  onConfirm: (
    payload:
      | { mode: 'create'; payload: CreatePayload; aiReceiptPlans?: AIAppliedReceiptPlan[]; aiReceiptPlanSyncToCalendar?: boolean; uploadedFile?: { tempPath: string; originalName: string } }
      | { mode: 'edit'; payload: UpdatePayload; aiReceiptPlans?: AIAppliedReceiptPlan[]; aiReceiptPlanSyncToCalendar?: boolean; uploadedFile?: { tempPath: string; originalName: string } }
  ) => void
}) {
  const toast = useToast()
  const aiStore = useAIStore()

  const contractInfos = ref<ContractInfoEntity[]>([])
  const isParsingContract = ref(false)
  const aiParsingStageText = ref('')
  const aiParsingElapsedText = ref('')
  const aiParsingLogs = ref<string[]>([])
  const aiParsingError = ref('')
  const aiExtractionEvidence = ref<AIContractExtractionEvidenceResult | null>(null)
  const selectedContractFilePath = ref('')
  const stagedContractUpload = ref<null | { fileId: string; aiPath: string; previewPath: string; originalName: string }>(null)
  const uploadedContractFileForSave = ref<null | { tempPath: string; originalName: string }>(null)
  let aiParsingTicker: ReturnType<typeof setInterval> | null = null
  const schemaConfig = ref<ContractFormSchemaConfig>(getDefaultContractFormSchemaConfig())
  const schema = ref<ContractFormSchema>(resolveContractFormSchema(schemaConfig.value, ''))
  const schemaValueCache = ref<Record<string, Record<string, unknown>>>({})
  const globalFieldCache = ref<Record<string, unknown>>({})
  const resolvedContractType = ref<string>('')
  const isSwitchingSchema = ref(false)
  const pendingAiReceiptPlans = ref<AIAppliedReceiptPlan[]>([])
  const receiptPlanImportEnabled = ref(true)
  const receiptPlanSyncToCalendar = ref(true)
  const receiptPlanRowErrors = ref<Record<string, string>>({})
  const aiPartyAUnitForm = reactive<AIPartyUnitForm>(createDefaultPartyUnitForm())
  const aiPartyBUnitForm = reactive<AIPartyUnitForm>(createDefaultPartyUnitForm())
  const partyAUnitImportEnabled = ref(true)
  const partyBUnitImportEnabled = ref(true)
  const hasAiPartyAUnit = ref(false)
  const hasAiPartyBUnit = ref(false)
  const errors = reactive<Record<string, string>>({})
  const activeTab = ref<ContractFormTab>('base')
  const iconPopover = ref<any>(null)
  const partyASelectRef = ref<any>(null)
  const partyBSelectRef = ref<any>(null)

  const form = reactive<Record<string, any>>({})
  const endDateTouchedByUser = ref(false)
  const isUpdatingEndDateProgrammatically = ref(false)
  const isApplyingAiExtraction = ref(false)

  const contractGroupOptions = ref<SelectOption[]>([])
  const contractTypeOptionsFromDictionary = ref<SelectOption[]>([])
  const currencyOptions = ref<SelectOption[]>([])
  const contractStatusOptions = ref<SelectOption[]>([])
  const settlementMethodOptions = ref<SelectOption[]>([])
  const signingFormOptions = ref<SelectOption[]>([])
  const procurementSourceOptions = ref<SelectOption[]>([])
  const executionMethodOptions = ref<SelectOption[]>([])
  const receiptFrequencyOptions = ref<SelectOption[]>([])
  const departmentOptions = ref<SelectOption[]>([])
  const departmentTreeOptions = ref<TreeNodeOption[]>([])
  const responsiblePersonOptions = ref<SelectOption[]>([])
  const responsiblePersonAllOptions = ref<SelectOption[]>([])
  const partyANameOptions = ref<SelectOption[]>([])
  const partyBNameOptions = ref<SelectOption[]>([])
  const partyAContactOptions = ref<SelectOption[]>([])
  const partyBContactOptions = ref<SelectOption[]>([])
  const schemaDrivenFieldOptions = ref<Record<string, SelectOption[]>>({})
  const schemaDrivenFieldTreeOptions = ref<Record<string, TreeNodeOption[]>>({})
  const rawCustomers = ref<any[]>([])
  const rawSuppliers = ref<any[]>([])
  const rawDepartments = ref<Array<{ id: string; name: string }>>([])
  const rawPersonnel = ref<Personnel[]>([])
  const departmentNameToId = computed(() => {
    const map: Record<string, string> = {}
    rawDepartments.value.forEach((d) => {
      const name = String(d.name || '').trim()
      const id = String(d.id || '').trim()
      if (name && id) map[name] = id
    })
    return map
  })

  const contractTypeMergedOptions = computed<SelectOption[]>(() => {
    return contractTypeOptionsFromDictionary.value
  })
  const hasSystemContractTypeOptions = computed(() => contractTypeMergedOptions.value.length > 0)

  const selectedContractFileName = computed(() => {
    const raw = String(selectedContractFilePath.value || '').trim()
    if (!raw) return ''
    const normalized = raw.replace(/\\/g, '/')
    const idx = normalized.lastIndexOf('/')
    return idx >= 0 ? normalized.slice(idx + 1) : normalized
  })

  const extTabTitle = computed(() => {
    const contractType = String(form.contractType || '').trim()
    if (!contractType) return '扩展信息'
    const matched = contractTypeMergedOptions.value.find((option) => String(option.value || '').trim() === contractType)
    return String(matched?.label || contractType || '扩展信息')
  })

  /** 使用新的表单状态整体覆盖当前响应式表单。 */
  const applyFormState = (nextState: Record<string, any>) => {
    Object.keys(form).forEach((key) => delete form[key])
    Object.assign(form, nextState)
  }

  const hasSelectedContractType = computed(() => String(form.contractType || '').trim().length > 0)
  const detailsEnabled = computed(() => options.mode.value === 'edit' || hasSelectedContractType.value)

  /** 规范化字段标签，便于做模糊匹配。 */
  const normalizeLabelKey = (value: unknown) => String(value ?? '').replace(/\s+/g, '').trim()

  const CONTRACT_END_DATE_INFERENCE_LABELS = [
    '服务时间',
    '服务期限',
    '服务期',
    '履行期限',
    '项目周期',
    '合同期限',
    '合同有效期',
    '有效期',
    '租期',
    '租赁期',
    '租赁期限',
    '租赁时间',
  ]

  const contractTermField = computed<ContractFormSchemaField | null>(() => {
    const fields = schema.value.fields
    for (const label of CONTRACT_END_DATE_INFERENCE_LABELS) {
      const matched = fields.find((field) => normalizeLabelKey(field.label).includes(label))
      if (matched) return matched
    }
    return null
  })

  const contractTermValue = computed(() => {
    const field = contractTermField.value
    if (!field) return null
    return form[field.key]
  })

  /** 按自然月偏移日期，并处理月底越界问题。 */
  const addMonths = (date: Date, months: number) => {
    const base = new Date(date.getTime())
    const originalDay = base.getDate()
    base.setDate(1)
    base.setMonth(base.getMonth() + months)
    const lastDayOfTargetMonth = new Date(base.getFullYear(), base.getMonth() + 1, 0).getDate()
    base.setDate(Math.min(originalDay, lastDayOfTargetMonth))
    return base
  }

  /** 按天数偏移日期。 */
  const addDays = (date: Date, days: number) => {
    const next = new Date(date.getTime())
    next.setDate(next.getDate() + days)
    return next
  }

  /** 解析合同期限中的中文数字，支持“一年”“十二个月”“半年”等表达。 */
  const parseChineseNumberToken = (value: string): number | null => {
    const text = String(value || '').trim()
    if (!text) return null
    if (text === '半') return 0.5

    const digitMap: Record<string, number> = {
      '零': 0,
      '一': 1,
      '二': 2,
      '两': 2,
      '三': 3,
      '四': 4,
      '五': 5,
      '六': 6,
      '七': 7,
      '八': 8,
      '九': 9,
    }

    let total = 0
    let current = 0
    for (const char of text) {
      if (char === '十') {
        current = current || 1
        total += current * 10
        current = 0
        continue
      }
      if (!(char in digitMap)) return null
      current = digitMap[char]
    }

    return total + current
  }

  /** 从期限文本中提取“数量 + 单位”，兼容阿拉伯数字和常见中文数字。 */
  const parseTermAmountAndUnit = (text: string): { amount: number; unit: 'year' | 'month' | 'day' } | null => {
    const raw = String(text || '').trim()
    if (!raw) return null

    const arabicMatch = raw.match(/(\d+(?:\.\d+)?)\s*(年|个月|月|天|日)/)
    if (arabicMatch) {
      const amount = Number(arabicMatch[1])
      if (!Number.isFinite(amount) || amount <= 0) return null
      const unitText = arabicMatch[2]
      return {
        amount,
        unit: unitText.includes('年') ? 'year' : (unitText.includes('天') || unitText.includes('日') ? 'day' : 'month'),
      }
    }

    const chineseMatch = raw.match(/([零一二两三四五六七八九十半]+)\s*(年|个月|月|天|日)/)
    if (!chineseMatch) return null
    const amount = parseChineseNumberToken(chineseMatch[1])
    if (!Number.isFinite(amount) || Number(amount) <= 0) return null
    const unitText = chineseMatch[2]
    return {
      amount: Number(amount),
      unit: unitText.includes('年') ? 'year' : (unitText.includes('天') || unitText.includes('日') ? 'day' : 'month'),
    }
  }

  /** 根据签约日期和服务期限类字段推导结束日期。 */
  const inferEndDateFromSigningDateAndTerm = (): Date | null => {
    const termField = contractTermField.value
    if (!termField) return null

    const raw = contractTermValue.value
    if (raw === null || raw === undefined) return null

    const label = normalizeLabelKey(termField.label)
    const text = String(raw ?? '').trim()
    if (!text) return null

    if (raw instanceof Date) return raw

    const dateLike = text.match(/\d{4}\s*[年\-/.]\s*\d{1,2}\s*[月\-/.]\s*\d{1,2}\s*日?/g) ?? []
    if (dateLike.length >= 1) {
      const end = parseDateText(dateLike[dateLike.length - 1])
      if (end) return end
    }

    if (!(form.signingDate instanceof Date)) return null

    const parsedTerm = parseTermAmountAndUnit(text)
    let amount = parsedTerm?.amount ?? Number(text)
    if (!Number.isFinite(amount) || amount <= 0) return null

    let unit: 'year' | 'month' | 'day' = parsedTerm?.unit || 'month'
    if (!parsedTerm) {
      if (label.includes('年')) unit = 'year'
      else if (label.includes('天') || label.includes('日')) unit = 'day'
      else unit = 'month'
    }

    const normalizedAmount = Math.floor(amount)
    if (!Number.isFinite(normalizedAmount) || normalizedAmount <= 0) return null

    const signingDate = form.signingDate
    const endExclusive = unit === 'year'
      ? addMonths(signingDate, normalizedAmount * 12)
      : unit === 'month'
        ? addMonths(signingDate, normalizedAmount)
        : addDays(signingDate, normalizedAmount)
    return addDays(endExclusive, -1)
  }

  const baseFields = computed(() =>
    schema.value.fields.filter((field) => {
      if (!isContractFieldInDefaultTab(field)) return false
      if (field.section !== 'base' || !field.visible) return false
      if (options.mode.value === 'create' && field.key === 'contractType') return false
      return true
    })
  )
  const extFields = computed(() => schema.value.fields.filter((field) => isContractFieldInExtendedTab(field) && field.visible))
  const contentFields = computed(() =>
    sortFieldsForDisplay(schema.value.fields.filter((field) => isContractFieldInDefaultTab(field) && field.section === 'content' && field.visible))
  )

  const fieldMap = computed(() => new Map(schema.value.fields.map((field) => [field.key, field])))
  const groupedAiEvidence = computed(() => {
    const rows = aiExtractionEvidence.value?.evidence || []
    const groups = new Map<string, Array<typeof rows[number]>>()
    rows.forEach((row) => {
      const key = String(row.fieldKey || '').trim() || 'unknown'
      const current = groups.get(key) || []
      current.push(row)
      groups.set(key, current)
    })
    return Array.from(groups.entries()).map(([fieldKey, evidence]) => ({
      fieldKey,
      fieldLabel: fieldMap.value.get(fieldKey)?.label || fieldKey,
      evidence,
    }))
  })

  const hasAiReceiptPlans = computed(() => pendingAiReceiptPlans.value.length > 0)
  const isAIEnabled = computed(() => aiStore.enabled)
  const showPartyAUnitTab = computed(() => options.mode.value === 'edit' || hasAiPartyAUnit.value)
  const showPartyBUnitTab = computed(() => options.mode.value === 'edit' || hasAiPartyBUnit.value)
  const showReceiptPlanTab = computed(() => options.mode.value === 'edit' || hasAiReceiptPlans.value)
  const aiInvoiceTypeOptions = [
    { label: '增值税专用发票', value: '专票' },
    { label: '增值税普通发票', value: '普票' },
  ]

  /** 校验 AI 识别出的收付款计划行数据。 */
  const computeReceiptPlanRowErrors = (plans: AIAppliedReceiptPlan[], enabled: boolean) => {
    const next: Record<string, string> = {}
    if (!enabled) return next
    plans.forEach((row, index) => {
      const key = String(index)
      const planName = String(row.plan_name || '').trim()
      if (!planName) {
        next[key] = '收付款名称不能为空'
        return
      }
      const direction = String(row.direction || '').trim()
      if (direction !== '收款' && direction !== '付款') {
        next[key] = '方向必须为收款或付款'
        return
      }
      const date = String(row.expected_date || '').trim()
      if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        next[key] = '日期格式必须为 YYYY-MM-DD'
        return
      }
      const amount = row.expected_amount
      if (amount !== undefined && amount !== null) {
        const n = Number(amount)
        if (!Number.isFinite(n) || n < 0) {
          next[key] = '金额必须为非负数字'
          return
        }
      }
      const ratio = row.ratio
      if (ratio !== undefined && ratio !== null) {
        const n = Number(ratio)
        if (!Number.isFinite(n) || n < 0) {
          next[key] = '比例必须为非负数字'
        }
      }
    })
    return next
  }

  const tabHasError = computed(() => {
    const result: Record<ContractFormTab, boolean> = {
      base: false,
      ext: false,
      content: false,
      partyAUnit: false,
      partyBUnit: false,
      receiptPlan: false,
    }
    for (const key of Object.keys(errors)) {
      const field = fieldMap.value.get(key)
      if (!field) continue
      const tabKey: ContractFormTab = isContractFieldInDefaultTab(field) ? field.section : 'ext'
      result[tabKey] = true
    }
    if (showReceiptPlanTab.value && receiptPlanImportEnabled.value && Object.keys(receiptPlanRowErrors.value).length > 0) {
      result.receiptPlan = true
    }
    return result
  })

  /** 获取字段对应的下拉选项列表。 */
  const getFieldOptions = (field: ContractFormSchemaField): SelectOption[] => {
    const builtinOptions: Record<string, SelectOption[]> = {
      contractType: contractTypeMergedOptions.value,
      groupName: contractGroupOptions.value,
      currency: currencyOptions.value,
      contractStatus: contractStatusOptions.value,
      settlementMethod: settlementMethodOptions.value,
      signingForm: signingFormOptions.value,
      procurementSource: procurementSourceOptions.value,
      executionMethod: executionMethodOptions.value,
      department: departmentOptions.value,
      responsiblePerson: responsiblePersonOptions.value,
    }
    if (builtinOptions[field.key]) return builtinOptions[field.key]
    if (schemaDrivenFieldOptions.value[field.key]?.length) return schemaDrivenFieldOptions.value[field.key]
    return Array.isArray(field.options) ? field.options.map((option) => ({ label: option, value: option })) : []
  }

  /** 获取字段对应的树形选项列表。 */
  const getFieldTreeOptions = (field: ContractFormSchemaField): TreeNodeOption[] => {
    if (field.key === 'department') return departmentTreeOptions.value
    const dynamicTreeOptions = schemaDrivenFieldTreeOptions.value[field.key]
    if (dynamicTreeOptions?.length) return dynamicTreeOptions
    const manualOptions = Array.isArray(field.options) ? field.options.map((option) => ({ label: option, value: option })) : []
    return manualOptions.map((option) => ({ key: option.value, label: option.label, data: option.value, children: [] }))
  }

  /** 更新指定字段的表单值。 */
  const updateFieldValue = (key: string, value: unknown) => {
    form[key] = value
  }

  /** 重置甲乙方单位补充信息表单。 */
  const resetPartyUnitForm = (target: AIPartyUnitForm) => {
    Object.assign(target, createDefaultPartyUnitForm())
  }

  /** 判断单位档案补充信息是否存在有效内容。 */
  const hasPartyUnitValues = (target: AIPartyUnitForm, name: string, contact: string) => {
    return [
      name,
      contact,
      target.legalRepName,
      target.legalRepMobile,
      target.legalRepEmail,
      target.legalRepIdNumber,
      target.phone,
      target.address,
      target.taxNumber,
      target.bankName,
      target.bankAccount,
      target.invoiceType,
    ].some((item) => String(item || '').trim().length > 0)
  }

  /** 追加一条带时间戳的 AI 解析日志。 */
  const appendAiParsingLog = (message: string) => {
    const normalized = String(message || '').trim()
    if (!normalized) return
    const line = `[${new Date().toLocaleTimeString('zh-CN', { hour12: false })}] ${normalized}`
    aiParsingLogs.value = [...aiParsingLogs.value.slice(-80), line]
  }

  /** 启动 AI 解析耗时心跳提示。 */
  const startAiParsingHeartbeat = () => {
    if (aiParsingTicker) {
      clearInterval(aiParsingTicker)
      aiParsingTicker = null
    }
    let elapsedSeconds = 0
    aiParsingElapsedText.value = '任务执行中，已耗时 0 秒'
    aiParsingTicker = setInterval(() => {
      elapsedSeconds += 1
      aiParsingElapsedText.value = `任务执行中，已耗时 ${elapsedSeconds} 秒`
      if (elapsedSeconds > 0 && elapsedSeconds % 15 === 0) {
        appendAiParsingLog(`AI 提取仍在执行（已耗时 ${elapsedSeconds} 秒）`)
      }
    }, 1000)
  }

  /** 停止 AI 解析耗时心跳提示。 */
  const stopAiParsingHeartbeat = () => {
    if (aiParsingTicker) {
      clearInterval(aiParsingTicker)
      aiParsingTicker = null
    }
    aiParsingElapsedText.value = ''
  }

  /** 为异步任务增加超时保护。 */
  const withTimeout = async <T>(promise: Promise<T>, timeoutMs: number, timeoutMessage: string): Promise<T> => {
    let timer: ReturnType<typeof setTimeout> | null = null
    return await new Promise<T>((resolve, reject) => {
      timer = setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs)
      promise
        .then(resolve)
        .catch(reject)
        .finally(() => {
          if (timer) clearTimeout(timer)
        })
    })
  }

  /** 根据人员列表构建负责人下拉选项。 */
  const buildResponsiblePersonOptionsFromPersonnel = (items: Personnel[]): SelectOption[] => {
    const map = new Map<string, SelectOption>()
    items.forEach((item) => {
      const name = String(item?.name || '').trim()
      if (!name) return
      const phone = String((item as any)?.phone || '').trim()
      const label = phone ? `${name}（${phone}）` : name
      if (!map.has(name)) map.set(name, { label, value: name })
    })
    return Array.from(map.values()).sort((a, b) => String(a.value).localeCompare(String(b.value), 'zh-CN'))
  }

  /** 根据当前部门刷新负责人候选项。 */
  const refreshResponsiblePersonOptions = async () => {
    const deptName = normalizeTreeSelectSingleKey(form.department)
    if (!deptName) {
      responsiblePersonOptions.value = [...responsiblePersonAllOptions.value]
      return
    }

    const deptId = departmentNameToId.value[deptName]
    if (deptId) {
      const res = await window.electronAPI.personnel.getList({ department_id: deptId })
      if (res.success && res.data) {
        const items = (res.data.data || []) as Personnel[]
        responsiblePersonOptions.value = buildResponsiblePersonOptionsFromPersonnel(items)
      } else {
        responsiblePersonOptions.value = []
      }
    } else if (rawPersonnel.value.length > 0) {
      const items = rawPersonnel.value.filter((p) => Array.isArray(p.department_names) && p.department_names.includes(deptName))
      responsiblePersonOptions.value = buildResponsiblePersonOptionsFromPersonnel(items)
    } else {
      responsiblePersonOptions.value = []
    }

    const current = String(form.responsiblePerson || '').trim()
    if (current && !responsiblePersonOptions.value.some((opt) => opt.value === current)) {
      form.responsiblePerson = ''
    }
  }

  /** 从客户缓存生成甲方单位候选项。 */
  const getPartyAUnitOptions = (): SelectOption[] => {
    return rawCustomers.value
      .map((item) => {
        const value = String(item.name || item.client_name || '').trim()
        return value ? { label: value, value } : null
      })
      .filter((item): item is SelectOption => Boolean(item))
  }

  /** 从供应商缓存生成乙方单位候选项。 */
  const getPartyBUnitOptions = (): SelectOption[] => {
    return rawSuppliers.value
      .map((item) => {
        const value = String(item.name || '').trim()
        return value ? { label: value, value } : null
      })
      .filter((item): item is SelectOption => Boolean(item))
  }
  /**
   * 加载由 schema 驱动的字段可选项（下拉/树形）
   * 根据字段配置的 optionSource 类型（字典、树形字典、甲方单位、乙方单位）拉取远端数据并缓存
   */
  const loadSchemaDrivenFieldOptions = async () => {
    const targetFields = schema.value.fields.filter((field) => {
      if (field.builtin) return false
      if (field.type !== 'select' && field.type !== 'multiselect' && field.type !== 'tree') return false
      return Boolean(field.optionSource?.groupName)
    })
    if (targetFields.length === 0) {
      schemaDrivenFieldOptions.value = {}
      schemaDrivenFieldTreeOptions.value = {}
      return
    }

    const sourceTasks = Array.from(
      new Map(
        targetFields.map((field) => {
          const source = field.optionSource!
          return [`${source.type}:${source.groupName}`, source] as const
        })
      ).values()
    )

    const taskResults = await Promise.all(
      sourceTasks.map(async (source) => {
        if (source.type === 'partyAUnit') {
          const options = getPartyAUnitOptions()
          return { cacheKey: `${source.type}:${source.groupName}`, options, treeNodes: buildFlatTreeNodes(options) }
        }
        if (source.type === 'partyBUnit') {
          const options = getPartyBUnitOptions()
          return { cacheKey: `${source.type}:${source.groupName}`, options, treeNodes: buildFlatTreeNodes(options) }
        }
        if (source.type === 'treeDictionary') {
          const result = await window.electronAPI.treeDictionary.getList({ group_name: source.groupName, page: 1, pageSize: 1000 })
          if (!result.success || !result.data) return { cacheKey: `${source.type}:${source.groupName}`, options: [], treeNodes: [] }
          const items = result.data.data as any[]
          return { cacheKey: `${source.type}:${source.groupName}`, options: buildIndentedTreeOptions(items), treeNodes: buildTreeNodes(items) }
        }
        const result = await window.electronAPI.dictionary.getList({ group_name: source.groupName, page: 1, pageSize: 1000 })
        if (!result.success || !result.data) return { cacheKey: `${source.type}:${source.groupName}`, options: [], treeNodes: [] }
        const options = toSelectOptions(result.data.data)
        return { cacheKey: `${source.type}:${source.groupName}`, options, treeNodes: buildFlatTreeNodes(options) }
      })
    )

    const optionSourceMap = new Map<string, { options: SelectOption[]; treeNodes: TreeNodeOption[] }>()
    taskResults.forEach((result) => optionSourceMap.set(result.cacheKey, { options: result.options, treeNodes: result.treeNodes }))

    schemaDrivenFieldOptions.value = Object.fromEntries(
      targetFields.map((field) => {
        const source = field.optionSource!
        return [field.key, optionSourceMap.get(`${source.type}:${source.groupName}`)?.options ?? []]
      })
    )
    schemaDrivenFieldTreeOptions.value = Object.fromEntries(
      targetFields.map((field) => {
        const source = field.optionSource!
        return [field.key, optionSourceMap.get(`${source.type}:${source.groupName}`)?.treeNodes ?? []]
      })
    )
  }

  /** 甲方单位变更后同步刷新甲方联系人选项。 */
  const onPartyAChange = (event: any, options?: { preserveCurrentContact?: boolean }) => {
    const selectedName = String(event?.value || form.clientName || '').trim()
    const customer = rawCustomers.value.find((item) => (item.name || item.client_name) === selectedName)
    const currentContact = String(form.partyAContact || '').trim()
    const preserveCurrentContact = options?.preserveCurrentContact ?? !Boolean(event?.originalEvent)
    partyAContactOptions.value = []

    if (!customer) {
      form.partyAContact = preserveCurrentContact && currentContact ? currentContact : ''
      return
    }
    const contactText = customer.contact || customer.contact_person || customer.responsible_person || ''
    const contacts = String(contactText).split(/[,，、/ ]/).filter(Boolean)
    partyAContactOptions.value = contacts.map((item: string) => ({ label: item, value: item }))
    form.partyAContact = preserveCurrentContact && currentContact ? currentContact : ''
  }

  /** 乙方单位变更后同步刷新乙方联系人选项。 */
  const onPartyBChange = (event: any, options?: { preserveCurrentContact?: boolean }) => {
    const selectedName = String(event?.value || form.partyBName || '').trim()
    const supplier = rawSuppliers.value.find((item) => item.name === selectedName)
    const currentContact = String(form.partyBContact || '').trim()
    const preserveCurrentContact = options?.preserveCurrentContact ?? !Boolean(event?.originalEvent)
    partyBContactOptions.value = []

    if (!supplier) {
      form.partyBContact = preserveCurrentContact && currentContact ? currentContact : ''
      return
    }
    let parsedContacts: string[] = []
    try {
      if (supplier.contacts) {
        const parsed = JSON.parse(supplier.contacts)
        if (Array.isArray(parsed)) parsedContacts = parsed.map((c) => c.name).filter(Boolean)
      }
    } catch (e) {
      logger.error('解析乙方联系人失败:', e)
    }
    if (parsedContacts.length === 0) {
      const contactText = supplier.contact || supplier.contact_person || supplier.responsible_person || ''
      parsedContacts = String(contactText).split(/[,，、/ ]/).filter(Boolean)
    }
    partyBContactOptions.value = parsedContacts.map((item: string) => ({ label: item, value: item }))
    form.partyBContact = preserveCurrentContact && currentContact ? currentContact : ''
  }

  /** 切换项目图标选择弹层显示状态。 */
  const toggleIconPopover = (event: Event) => iconPopover.value?.toggle?.(event)
  /** 选择并应用项目图标。 */
  const selectProjectIcon = (icon: string) => {
    form.projectIcon = icon
    iconPopover.value?.hide?.()
  }

  /** 批量加载合同表单依赖的字典、单位、部门和人员数据。 */
  const loadDictionaryCandidates = async () => {
    try {
      const tasks = await Promise.allSettled([
        window.electronAPI.dictionary.getList({ group_name: '合同分组', page: 1, pageSize: 1000 }),
        window.electronAPI.dictionary.getList({ group_name: '合同类型', page: 1, pageSize: 1000 }),
        window.electronAPI.dictionary.getList({ group_name: '币种', page: 1, pageSize: 1000 }),
        window.electronAPI.dictionary.getList({ group_name: '合同状态', page: 1, pageSize: 1000 }),
        window.electronAPI.dictionary.getList({ group_name: '结算方式', page: 1, pageSize: 1000 }),
        window.electronAPI.dictionary.getList({ group_name: '订立形式', page: 1, pageSize: 1000 }),
        window.electronAPI.dictionary.getList({ group_name: '合同采购来源', page: 1, pageSize: 1000 }),
        window.electronAPI.dictionary.getList({ group_name: '合同执行方式', page: 1, pageSize: 1000 }),
        window.electronAPI.dictionary.getList({ group_name: '收付频率', page: 1, pageSize: 1000 }),
        window.electronAPI.customer.getList({ page: 1, pageSize: 1000 }),
        window.electronAPI.supplier.getList({ page: 1, pageSize: 1000 }),
        window.electronAPI.department.getList({ page: 1, pageSize: 1000 }),
        window.electronAPI.personnel.getList({ page: 1, pageSize: 1000 }),
        window.electronAPI.db.getSetting('tree_dictionary_groups_tree'),
      ])

      const [
        contractGroupRes,
        contractTypeRes,
        currencyRes,
        contractStatusRes,
        settlementMethodRes,
        signingFormRes,
        procurementSourceRes,
        executionMethodRes,
        receiptFrequencyRes,
        customerRes,
        supplierRes,
        departmentRes,
        personnelRes,
        treeDictionaryGroupTreeRes,
      ] = tasks.map((task) => (task.status === 'fulfilled' ? task.value : null)) as [
        Awaited<ReturnType<typeof window.electronAPI.dictionary.getList>> | null,
        Awaited<ReturnType<typeof window.electronAPI.dictionary.getList>> | null,
        Awaited<ReturnType<typeof window.electronAPI.dictionary.getList>> | null,
        Awaited<ReturnType<typeof window.electronAPI.dictionary.getList>> | null,
        Awaited<ReturnType<typeof window.electronAPI.dictionary.getList>> | null,
        Awaited<ReturnType<typeof window.electronAPI.dictionary.getList>> | null,
        Awaited<ReturnType<typeof window.electronAPI.dictionary.getList>> | null,
        Awaited<ReturnType<typeof window.electronAPI.dictionary.getList>> | null,
        Awaited<ReturnType<typeof window.electronAPI.dictionary.getList>> | null,
        Awaited<ReturnType<typeof window.electronAPI.customer.getList>> | null,
        Awaited<ReturnType<typeof window.electronAPI.supplier.getList>> | null,
        Awaited<ReturnType<typeof window.electronAPI.department.getList>> | null,
        Awaited<ReturnType<typeof window.electronAPI.personnel.getList>> | null,
        Awaited<ReturnType<typeof window.electronAPI.db.getSetting>> | null,
      ]

      if (contractGroupRes?.success && contractGroupRes.data) contractGroupOptions.value = toSelectOptions(contractGroupRes.data.data)
      if (contractTypeRes?.success && contractTypeRes.data) contractTypeOptionsFromDictionary.value = toSelectOptions(contractTypeRes.data.data)
      if (currencyRes?.success && currencyRes.data) currencyOptions.value = toSelectOptions(currencyRes.data.data)
      if (contractStatusRes?.success && contractStatusRes.data) contractStatusOptions.value = toSelectOptions(contractStatusRes.data.data)
      if (settlementMethodRes?.success && settlementMethodRes.data) settlementMethodOptions.value = toSelectOptions(settlementMethodRes.data.data)
      if (signingFormRes?.success && signingFormRes.data) signingFormOptions.value = toSelectOptions(signingFormRes.data.data)
      if (procurementSourceRes?.success && procurementSourceRes.data) procurementSourceOptions.value = toSelectOptions(procurementSourceRes.data.data)
      if (executionMethodRes?.success && executionMethodRes.data) executionMethodOptions.value = toSelectOptions(executionMethodRes.data.data)
      if (receiptFrequencyRes?.success && receiptFrequencyRes.data) receiptFrequencyOptions.value = toSelectOptions(receiptFrequencyRes.data.data)

      if (customerRes?.success && customerRes.data) {
        rawCustomers.value = customerRes.data.data as any[]
        partyANameOptions.value = rawCustomers.value.map((item) => ({ label: item.name || item.client_name || '未知客户', value: item.name || item.client_name || '' }))
      }
      if (supplierRes?.success && supplierRes.data) {
        rawSuppliers.value = supplierRes.data.data as any[]
        partyBNameOptions.value = rawSuppliers.value.map((item) => ({ label: item.name || '未知供应商', value: item.name || '' }))
      }

      if (departmentRes?.success && departmentRes.data) {
        const departmentItems = ((departmentRes.data as any).data || (departmentRes.data as any).items || []) as Array<{
          id: string
          parent_id?: string | null
          name: string
        }>
        if (departmentItems.length > 0) {
          rawDepartments.value = departmentItems.map((item) => ({ id: String(item.id || '').trim(), name: String(item.name || '').trim() }))
          const normalizedDepartmentItems = departmentItems.map((item) => ({
            id: String(item.id || '').trim(),
            parent_id: String(item.parent_id || '').trim(),
            name: String(item.name || '').trim(),
          }))
          departmentTreeOptions.value = buildTreeNodes(normalizedDepartmentItems)
          departmentOptions.value = buildIndentedTreeOptions(normalizedDepartmentItems)
        }
      }

      if (personnelRes?.success && personnelRes.data) {
        const personnelItems = ((personnelRes.data as any).data || (personnelRes.data as any).items || []) as Personnel[]
        rawPersonnel.value = personnelItems
        responsiblePersonAllOptions.value = buildResponsiblePersonOptionsFromPersonnel(personnelItems)
        responsiblePersonOptions.value = [...responsiblePersonAllOptions.value]
      }

      /** 尝试从树字典配置中构建部门树选项。 */
      const tryBuildDepartment = (raw: unknown) => {
        try {
          const rawTree = typeof raw === 'string' ? JSON.parse(raw) : raw
          const nodes = Array.isArray(rawTree) ? (rawTree as GroupTreeNode[]) : []
          const departmentGroup = findGroupTreeNode(nodes, (node) => normalizeGroupTreeNodeText(node.label ?? node.data) === '部门')
          const departmentChildren = Array.isArray(departmentGroup?.children) ? departmentGroup!.children! : []
          const treeNodes = departmentChildren.map(buildDepartmentTreeFromGroupNode).filter((item) => item.label)
          departmentTreeOptions.value = treeNodes
          departmentOptions.value = buildDepartmentOptionsFromTreeNodes(treeNodes)
          return true
        } catch {
          return false
        }
      }

      if (departmentTreeOptions.value.length === 0) {
        if (treeDictionaryGroupTreeRes?.success && treeDictionaryGroupTreeRes.data?.value) {
          const ok = tryBuildDepartment(String(treeDictionaryGroupTreeRes.data.value))
          if (!ok) {
            departmentTreeOptions.value = []
            departmentOptions.value = []
          }
        } else {
          const cached = localStorage.getItem('tree_dictionary_groups_tree')
          if (cached) {
            const ok = tryBuildDepartment(cached)
            if (!ok) {
              departmentTreeOptions.value = []
              departmentOptions.value = []
            }
          }
        }
      }

      if (departmentTreeOptions.value.length === 0) {
        departmentTreeOptions.value = []
        departmentOptions.value = []
      }

      if (responsiblePersonOptions.value.length === 0) {
        responsiblePersonOptions.value = []
      }
    } catch {
    }
  }

  /** 加载当前资源库的合同表单 schema 配置。 */
  const loadContractSchema = async () => {
    const libraryPath = String(localStorage.getItem('currentLibraryPath') || '').trim()
    if (!libraryPath) {
      schemaConfig.value = getDefaultContractFormSchemaConfig()
      return
    }
    const result = await window.electronAPI.library.getContractFormSchema({ libraryPath })
    schemaConfig.value = result.success && result.data ? normalizeContractFormSchemaConfig(result.data) : getDefaultContractFormSchemaConfig()
  }

  /** 加载当前资源库中的合同列表，用于重名与编号校验。 */
  const loadClientCandidates = async () => {
    const libraryPath = String(localStorage.getItem('currentLibraryPath') || '').trim()
    if (!libraryPath) {
      contractInfos.value = []
      return
    }
    const result = await window.electronAPI.library.getContractInfos(libraryPath)
    contractInfos.value = result.success && result.data ? result.data : []
  }

  /** 根据当前模式和初始数据回填弹窗表单。 */
  const hydrateForm = () => {
    const nextState = createDefaultFormState(schema.value)
    const initial = options.initial.value
    if (options.mode.value === 'edit' && initial) {
      Object.assign(nextState, {
        contractName: String(initial.contract_name || ''),
        contractCode: String(initial.contract_code || ''),
        signingDate: parseDate(initial.signing_date),
        endDate: parseDate(initial.end_date),
        contractType: String(initial.contract_type || ''),
        groupName: String(initial.group_name || ''),
        currency: String(initial.currency || ''),
        contractAmount: initial.contract_amount ?? null,
        contractStatus: String(initial.contract_status || ''),
        department: String(initial.department || ''),
        responsiblePerson: String(initial.responsible_person || ''),
        settlementMethod: String(initial.settlement_method || ''),
        signingForm: String(initial.signing_form || ''),
        procurementSource: String(initial.procurement_source || ''),
        executionMethod: String(initial.execution_method || ''),
        clientName: String(initial.client_name || ''),
        partyAContact: String(initial.party_a_contact || ''),
        partyAContactMobile: String(initial.party_a_contact_mobile || ''),
        partyAContactPhone: String(initial.party_a_contact_phone || ''),
        partyAContactEmail: String(initial.party_a_contact_email || ''),
        partyAContactIdNumber: String(initial.party_a_contact_id_number || ''),
        partyBName: String(initial.party_b_name || ''),
        partyBContact: String(initial.party_b_contact || ''),
        partyBContactMobile: String(initial.party_b_contact_mobile || ''),
        partyBContactPhone: String(initial.party_b_contact_phone || ''),
        partyBContactEmail: String(initial.party_b_contact_email || ''),
        partyBContactIdNumber: String(initial.party_b_contact_id_number || ''),
        contractSummary: normalizeStoredContractSummaryToMarkdown(initial.contract_summary || ''),
        remark: String(initial.remark || ''),
        projectIcon: String(initial.project_icon || 'pi pi-file-edit'),
        projectColor: String(initial.project_color || '#1d4ed8'),
      })
      try {
        const tags = initial.contract_tags ? JSON.parse(initial.contract_tags) : []
        nextState.contractTags = Array.isArray(tags) ? tags : []
      } catch {
        nextState.contractTags = []
      }
      const extData = parseContractExtData(initial.ext_data)
      for (const field of schema.value.fields) {
        if (!field.builtin && Object.prototype.hasOwnProperty.call(extData, field.key)) {
          nextState[field.key] = (extData as any)[field.key]
        }
      }
    }
    nextState.projectColor = normalizeProjectColor(String(nextState.projectColor || '#1d4ed8'))
    isSwitchingSchema.value = true
    applyFormState(nextState)
    isSwitchingSchema.value = false
    pendingAiReceiptPlans.value = []
    receiptPlanImportEnabled.value = true
    receiptPlanSyncToCalendar.value = true
    receiptPlanRowErrors.value = {}
    resetPartyUnitForm(aiPartyAUnitForm)
    resetPartyUnitForm(aiPartyBUnitForm)
    partyAUnitImportEnabled.value = true
    partyBUnitImportEnabled.value = true
    hasAiPartyAUnit.value = false
    hasAiPartyBUnit.value = false
    if (form.clientName) onPartyAChange({ value: form.clientName })
    if (form.partyBName) onPartyBChange({ value: form.partyBName })
  }

  const loadCustomerByName = async (name: string) => {
    const found = findCustomerByName(name)
    if (found?.id) {
      const res = await window.electronAPI.customer.get(String(found.id))
      if (res.success && res.data) return res.data
    }

    const listRes = await window.electronAPI.customer.getList({
      page: 1,
      pageSize: 100,
      useGroupFilter: false,
      search: name,
      searchFields: ['name'],
    })
    if (!listRes.success || !listRes.data?.data) return null
    const target = normalizeNameKey(name)
    const matched = listRes.data.data.find((item) => normalizeNameKey(item.name) === target) || listRes.data.data[0]
    if (!matched?.id) return null
    const detailRes = await window.electronAPI.customer.get(String(matched.id))
    return detailRes.success && detailRes.data ? detailRes.data : null
  }

  const loadSupplierByName = async (name: string) => {
    const found = findSupplierByName(name)
    if (found?.id) {
      const res = await window.electronAPI.supplier.get(String(found.id))
      if (res.success && res.data) return res.data
    }

    const listRes = await window.electronAPI.supplier.getList({
      page: 1,
      pageSize: 100,
      search: name,
      searchFields: ['name'],
    })
    if (!listRes.success || !listRes.data?.data) return null
    const target = normalizeNameKey(name)
    const matched = listRes.data.data.find((item) => normalizeNameKey(item.name) === target) || listRes.data.data[0]
    if (!matched?.id) return null
    const detailRes = await window.electronAPI.supplier.get(String(matched.id))
    return detailRes.success && detailRes.data ? detailRes.data : null
  }

  const hydratePartyUnitFormsForEdit = async () => {
    if (options.mode.value !== 'edit') return
    if (!options.initial.value?.id) return
    const partyAName = String(form.clientName || '').trim()
    const partyBName = String(form.partyBName || '').trim()
    if (!partyAName && !partyBName) return

    if (partyAName) {
      const customer = await loadCustomerByName(partyAName)
      if (customer) {
        aiPartyAUnitForm.phone = String(customer.phone || '').trim()
        aiPartyAUnitForm.address = String(customer.address || '').trim()
        aiPartyAUnitForm.taxNumber = String(customer.tax_number || '').trim()
        aiPartyAUnitForm.bankName = String(customer.bank_name || '').trim()
        aiPartyAUnitForm.bankAccount = String(customer.bank_account || '').trim()
        aiPartyAUnitForm.invoiceType = normalizeInvoiceType(customer.invoice_type)

        const contacts = normalizeCustomerContacts(customer.contacts)
        const rep = contacts.find((c) => c.is_legal_representative) || contacts.find((c) => c.is_primary) || null
        if (rep) {
          aiPartyAUnitForm.legalRepName = String(rep.name || '').trim()
          aiPartyAUnitForm.legalRepMobile = String(rep.mobile || '').trim()
          aiPartyAUnitForm.legalRepEmail = String(rep.email || '').trim()
          aiPartyAUnitForm.legalRepIdNumber = String(rep.id_number || '').trim()
        }
      }
    }

    if (partyBName) {
      const supplier = await loadSupplierByName(partyBName)
      if (supplier) {
        aiPartyBUnitForm.phone = String(supplier.phone || '').trim()
        aiPartyBUnitForm.address = String(supplier.address || '').trim()
        aiPartyBUnitForm.taxNumber = String(supplier.tax_number || '').trim()
        aiPartyBUnitForm.bankName = String(supplier.bank_name || '').trim()
        aiPartyBUnitForm.bankAccount = String(supplier.bank_account || '').trim()
        aiPartyBUnitForm.invoiceType = normalizeInvoiceType(supplier.invoice_type)
        aiPartyBUnitForm.legalRepName = String(supplier.legal_rep_name || '').trim()
        aiPartyBUnitForm.legalRepMobile = String(supplier.legal_rep_mobile || '').trim()
        aiPartyBUnitForm.legalRepEmail = String(supplier.legal_rep_email || '').trim()
        aiPartyBUnitForm.legalRepIdNumber = String(supplier.legal_rep_id_number || '').trim()

        if (!aiPartyBUnitForm.legalRepName && !aiPartyBUnitForm.legalRepMobile && !aiPartyBUnitForm.legalRepEmail && !aiPartyBUnitForm.legalRepIdNumber) {
          const contacts = normalizeSupplierContacts(supplier.contacts)
          const rep = contacts.find((c) => c.is_legal_representative) || contacts.find((c) => c.is_primary) || null
          if (rep) {
            aiPartyBUnitForm.legalRepName = String(rep.name || '').trim()
            aiPartyBUnitForm.legalRepMobile = String(rep.mobile || '').trim()
            aiPartyBUnitForm.legalRepEmail = String(rep.email || '').trim()
            aiPartyBUnitForm.legalRepIdNumber = String(rep.id_number || '').trim()
          }
        }
      }
    }
  }

  /** 重置弹窗内的 AI、表单和校验状态。 */
  const resetModalState = () => {
    stopAiParsingHeartbeat()
    isParsingContract.value = false
    aiParsingStageText.value = ''
    aiParsingElapsedText.value = ''
    aiParsingLogs.value = []
    aiParsingError.value = ''
    aiExtractionEvidence.value = null
    selectedContractFilePath.value = ''
    pendingAiReceiptPlans.value = []
    receiptPlanImportEnabled.value = true
    receiptPlanSyncToCalendar.value = true
    receiptPlanRowErrors.value = {}
    resetPartyUnitForm(aiPartyAUnitForm)
    resetPartyUnitForm(aiPartyBUnitForm)
    partyAUnitImportEnabled.value = true
    partyBUnitImportEnabled.value = true
    hasAiPartyAUnit.value = false
    hasAiPartyBUnit.value = false
    schemaValueCache.value = {}
    globalFieldCache.value = {}
    Object.keys(errors).forEach((key) => delete errors[key])
    activeTab.value = 'base'

    const nextSchema = resolveContractFormSchema(schemaConfig.value, '')
    schema.value = nextSchema
    resolvedContractType.value = ''
    isSwitchingSchema.value = true
    applyFormState(createDefaultFormState(nextSchema))
    isSwitchingSchema.value = false
  }

  /** 生成按合同类型缓存 schema 值的键名。 */
  const getSchemaCacheKey = (contractType: string | null | undefined) => {
    const key = String(contractType || '').trim()
    return key || '__default__'
  }

  /** 复制需要在 schema 切换时保留的字段值。 */
  const clonePreservedValue = (value: unknown) => (Array.isArray(value) ? [...value] : value)

  /** 按合同类型切换 schema，并尽量保留已填写内容。 */
  const switchSchemaByContractType = async (nextContractType: string | null | undefined) => {
    const nextType = String(nextContractType || '').trim()
    const prevType = String(resolvedContractType.value || '').trim()
    const prevSchema = schema.value
    const nextSchema = resolveContractFormSchema(schemaConfig.value, nextType)

    const prevKeys = new Set(prevSchema.fields.map((field) => field.key))
    const nextKeys = new Set(nextSchema.fields.map((field) => field.key))
    const commonKeys = new Set<string>()
    prevKeys.forEach((key) => {
      if (nextKeys.has(key)) commonKeys.add(key)
    })

    const uniquePrevKeys: string[] = []
    prevKeys.forEach((key) => {
      if (!nextKeys.has(key)) uniquePrevKeys.push(key)
    })

    if (uniquePrevKeys.length > 0) {
      const cacheKey = getSchemaCacheKey(prevType)
      const existing = schemaValueCache.value[cacheKey] || {}
      const captured: Record<string, unknown> = { ...existing }
      uniquePrevKeys.forEach((key) => {
        if (Object.prototype.hasOwnProperty.call(form, key)) {
          const value = clonePreservedValue(form[key])
          captured[key] = value
          globalFieldCache.value = { ...globalFieldCache.value, [key]: value }
        }
      })
      schemaValueCache.value = { ...schemaValueCache.value, [cacheKey]: captured }
    }

    const nextState = createDefaultFormState(nextSchema)
    commonKeys.forEach((key) => {
      if (Object.prototype.hasOwnProperty.call(form, key)) nextState[key] = clonePreservedValue(form[key])
    })

    const nextCache = schemaValueCache.value[getSchemaCacheKey(nextType)] || {}
    nextKeys.forEach((key) => {
      if (commonKeys.has(key)) return
      if (Object.prototype.hasOwnProperty.call(nextCache, key)) {
        nextState[key] = clonePreservedValue(nextCache[key])
        return
      }
      if (Object.prototype.hasOwnProperty.call(globalFieldCache.value, key)) {
        nextState[key] = clonePreservedValue(globalFieldCache.value[key])
      }
    })

    nextState.contractType = nextType

    isSwitchingSchema.value = true
    schema.value = nextSchema
    resolvedContractType.value = nextType
    Object.keys(errors).forEach((key) => delete errors[key])
    applyFormState(nextState)
    isSwitchingSchema.value = false

    await loadSchemaDrivenFieldOptions()
    if (form.clientName) onPartyAChange({ value: form.clientName })
    if (form.partyBName) onPartyBChange({ value: form.partyBName })
    activeTab.value = 'base'
  }

  /** 编辑模式下加载合同文件路径用于左侧预览。 */
  const loadContractFileForPreview = async () => {
    if (options.mode.value !== 'edit') return
    const initial = options.initial.value
    if (!initial?.folder_name) return
    const libraryPath = String(localStorage.getItem('currentLibraryPath') || '').trim()
    if (!libraryPath) return
    try {
      const folderPath = [libraryPath.replace(/\\/g, '/'), initial.folder_name].join('/')
      const scanResult = await window.electronAPI.contract.scanFolder(folderPath)
      if (scanResult.success && scanResult.data && (scanResult.data as any).filePaths?.length > 0) {
        const files = (scanResult.data as any).filePaths as string[]
        const pdfFile = files.find((f) => String(f).toLowerCase().endsWith('.pdf')) || files[0]
        if (pdfFile) {
          selectedContractFilePath.value = pdfFile
        }
      }
    } catch {
    }
  }

  watch(
    () => options.visible.value,
    async (value) => {
      if (!value) {
        resetModalState()
        return
      }
      activeTab.value = 'base'
      Object.keys(errors).forEach((key) => delete errors[key])
      await Promise.all([loadContractSchema(), loadDictionaryCandidates(), loadClientCandidates()])
      const initialContractType = options.mode.value === 'edit' ? String(options.initial.value?.contract_type || '').trim() : ''
      schema.value = resolveContractFormSchema(schemaConfig.value, initialContractType)
      resolvedContractType.value = initialContractType
      await loadSchemaDrivenFieldOptions()
      hydrateForm()
      await hydratePartyUnitFormsForEdit()
      await loadContractFileForPreview()
      await refreshResponsiblePersonOptions()
    }
  )

  watch(
    () => form.endDate,
    (nextValue) => {
      if (isUpdatingEndDateProgrammatically.value) return
      endDateTouchedByUser.value = Boolean(nextValue)
    }
  )

  watch(
    () => [form.signingDate, contractTermField.value?.key, contractTermValue.value],
    () => {
      if (!options.visible.value) return
      if (options.mode.value !== 'create') return
      if (isApplyingAiExtraction.value) return
      if (form.endDate instanceof Date) return
      const inferred = inferEndDateFromSigningDateAndTerm()
      if (!inferred) return
      isUpdatingEndDateProgrammatically.value = true
      form.endDate = inferred
      nextTick(() => {
        isUpdatingEndDateProgrammatically.value = false
      })
    },
    { deep: true }
  )

  watch(
    () => [receiptPlanImportEnabled.value, pendingAiReceiptPlans.value],
    () => {
      receiptPlanRowErrors.value = computeReceiptPlanRowErrors(pendingAiReceiptPlans.value, receiptPlanImportEnabled.value)
    },
    { deep: true }
  )

  watch(
    () => ({
      partyA: showPartyAUnitTab.value,
      partyB: showPartyBUnitTab.value,
      receiptPlan: showReceiptPlanTab.value,
    }),
    (enabled) => {
      if (!enabled.partyA && activeTab.value === 'partyAUnit') activeTab.value = 'base'
      if (!enabled.partyB && activeTab.value === 'partyBUnit') activeTab.value = 'base'
      if (!enabled.receiptPlan && activeTab.value === 'receiptPlan') activeTab.value = 'base'
    },
  )

  watch(
    () => String(form.contractType || ''),
    async (nextValue, prevValue) => {
      if (!options.visible.value) return
      if (isSwitchingSchema.value) return
      const nextType = String(nextValue || '').trim()
      const prevType = String(prevValue || '').trim()
      if (nextType === prevType) return
      await switchSchemaByContractType(nextType)
    }
  )

  watch(
    () => normalizeTreeSelectSingleKey(form.department),
    async (nextValue, prevValue) => {
      if (!options.visible.value) return
      const next = String(nextValue || '').trim()
      const prev = String(prevValue || '').trim()
      if (next === prev) return
      await refreshResponsiblePersonOptions()
    }
  )

  /** 确保合同列表已加载完成。 */
  const ensureContractInfosLoaded = async () => {
    if (contractInfos.value.length > 0) return
    await loadClientCandidates()
  }

  /** 根据字段 key 判断所属标签页。 */
  const getTabByFieldKey = (key: string): ContractFormTab | null => {
    const field = fieldMap.value.get(key)
    if (!field) return null
    return isContractFieldInDefaultTab(field) ? field.section : 'ext'
  }

  /** 仅校验当前标签页的表单内容。 */
  const validateCurrentTab = async () => {
    const currentTab = activeTab.value
    if (currentTab === 'base') await ensureContractInfosLoaded()
    if (currentTab === 'receiptPlan') {
      receiptPlanRowErrors.value = computeReceiptPlanRowErrors(pendingAiReceiptPlans.value, receiptPlanImportEnabled.value)
      return Object.keys(receiptPlanRowErrors.value).length === 0
    }

    const allErrors = validateContractFormValues(schema.value, form)
    if (currentTab === 'base') {
      const name = normalizeContractName(String(form.contractName || ''))
      const currentId = options.mode.value === 'edit' ? String(options.initial.value?.id || '').trim() : ''
      if (
        name &&
        contractInfos.value.some((item) => {
          const otherId = String(item.id || '').trim()
          if (currentId && otherId === currentId) return false
          return normalizeContractName(item.contract_name) === name
        })
      ) {
        allErrors.contractName = '合同名称已存在'
      }
    }

    Object.keys(errors).forEach((key) => {
      if (getTabByFieldKey(key) === currentTab) delete errors[key]
    })

    const nextErrors: Record<string, string> = {}
    for (const [key, message] of Object.entries(allErrors)) {
      if (getTabByFieldKey(key) === currentTab) nextErrors[key] = message
    }
    Object.assign(errors, nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  const tabOrder = computed<ContractFormTab[]>(() => {
    const list: ContractFormTab[] = ['base', 'ext', 'content']
    if (showPartyAUnitTab.value) list.push('partyAUnit')
    if (showPartyBUnitTab.value) list.push('partyBUnit')
    if (showReceiptPlanTab.value) list.push('receiptPlan')
    return list
  })
  const isLastTab = computed(() => activeTab.value === tabOrder.value[tabOrder.value.length - 1])
  const primaryButtonLabel = computed(() => {
    if (options.mode.value === 'edit') return '保存'
    if (!isLastTab.value) return '下一步'
    return showReceiptPlanTab.value ? '保存入库' : '提交'
  })

  /** 执行整张表单和收付款计划的完整校验。 */
  const validateForm = () => {
    Object.keys(errors).forEach((key) => delete errors[key])
    Object.assign(errors, validateContractFormValues(schema.value, form))
    const name = normalizeContractName(String(form.contractName || ''))
    const currentId = options.mode.value === 'edit' ? String(options.initial.value?.id || '').trim() : ''
    if (
      name &&
      contractInfos.value.some((item) => {
        const otherId = String(item.id || '').trim()
        if (currentId && otherId === currentId) return false
        return normalizeContractName(item.contract_name) === name
      })
    ) {
      errors.contractName = '合同名称已存在'
    }

    receiptPlanRowErrors.value = computeReceiptPlanRowErrors(pendingAiReceiptPlans.value, receiptPlanImportEnabled.value)

    if (Object.keys(errors).length > 0 || Object.keys(receiptPlanRowErrors.value).length > 0) {
      const nextTab = tabOrder.value.find((section) => tabHasError.value[section])
      if (nextTab) activeTab.value = nextTab
      return false
    }
    return true
  }

  /** 处理主按钮的下一步或提交行为。 */
  const handlePrimaryAction = async () => {
    if (options.mode.value === 'edit') {
      await submit()
      return
    }
    if (!detailsEnabled.value) {
      await submit()
      return
    }
    if (isLastTab.value) {
      await submit()
      return
    }
    const ok = await validateCurrentTab()
    if (!ok) {
      toast.add({ severity: 'error', summary: '校验失败', detail: '请检查当前页必填项是否已填写正确', life: 2500 })
      return
    }
    const currentIndex = tabOrder.value.indexOf(activeTab.value)
    const nextTab = tabOrder.value[Math.max(0, Math.min(tabOrder.value.length - 1, currentIndex + 1))]
    activeTab.value = nextTab
  }

  /** 规范化名称文本，便于做不区分大小写比较。 */
  const normalizeNameKey = (value: unknown) => String(value || '').trim().toLowerCase()

  /** 按名称在客户缓存中查找单位。 */
  const findCustomerByName = (name: string) => {
    const target = normalizeNameKey(name)
    if (!target) return null
    return rawCustomers.value.find((item) => normalizeNameKey(item.name || item.client_name) === target) || null
  }

  /** 按名称在供应商缓存中查找单位。 */
  const findSupplierByName = (name: string) => {
    const target = normalizeNameKey(name)
    if (!target) return null
    return rawSuppliers.value.find((item) => normalizeNameKey(item.name) === target) || null
  }

  /** 将联系人文本拆分为姓名数组。 */
  const splitContactNames = (value: unknown): string[] => {
    return String(value || '')
      .split(/[,，、/;\n\r\t ]+/)
      .map((item) => item.trim())
      .filter(Boolean)
  }

  /** 向联系人文本中追加去重后的姓名。 */
  const appendContactName = (current: unknown, nextName: string) => {
    const names = splitContactNames(current)
    if (!names.some((item) => normalizeNameKey(item) === normalizeNameKey(nextName))) names.push(nextName)
    return names.join('、')
  }

  /** 规范化发票类型文本。 */
  const normalizeInvoiceType = (value: unknown) => {
    const text = String(value || '').trim()
    if (!text) return ''
    if (text.includes('专')) return '专票'
    if (text.includes('普')) return '普票'
    return text
  }

  /** 将客户联系人原始数据标准化为结构化数组。 */
  const normalizeCustomerContacts = (raw: unknown): CustomerContact[] => {
    /** 将联系人数组标准化为统一的数据结构。 */
    const normalizeArray = (parsed: unknown[]) => {
      return parsed.map((item) => {
        if (!item || typeof item !== 'object' || Array.isArray(item)) return null
        const obj = item as Record<string, unknown>
        return {
          id: String(obj.id || '').trim() || IdGenerator.generateCode('CUSC'),
          name: String(obj.name || '').trim(),
          department: String(obj.department || '').trim(),
          mobile: String(obj.mobile || '').trim(),
          phone: String(obj.phone || '').trim(),
          email: String(obj.email || '').trim(),
          id_number: String(obj.id_number || '').trim(),
          is_legal_representative: Boolean(obj.is_legal_representative),
          is_primary: Boolean(obj.is_primary),
        } satisfies CustomerContact
      }).filter((item): item is CustomerContact => Boolean(item))
    }

    if (Array.isArray(raw)) {
      return normalizeArray(raw as unknown[])
    }

    const text = String(raw || '').trim()
    if (!text) return []
    try {
      const parsed = JSON.parse(text) as unknown
      if (!Array.isArray(parsed)) return []
      return normalizeArray(parsed)
    } catch {
      return []
    }
  }

  /** 将供应商联系人原始数据标准化为结构化数组。 */
  const normalizeSupplierContacts = (raw: unknown): SupplierContact[] => {
    /** 将联系人数组标准化为统一的数据结构。 */
    const normalizeArray = (parsed: unknown[]) => {
      return parsed.map((item) => {
        if (!item || typeof item !== 'object' || Array.isArray(item)) return null
        const obj = item as Record<string, unknown>
        return {
          id: String(obj.id || '').trim() || IdGenerator.generateCode('SUPC'),
          name: String(obj.name || '').trim(),
          department: String(obj.department || '').trim(),
          mobile: String(obj.mobile || '').trim(),
          phone: String(obj.phone || '').trim(),
          email: String(obj.email || '').trim(),
          id_number: String(obj.id_number || '').trim(),
          wechat: String(obj.wechat || '').trim(),
          is_legal_representative: Boolean(obj.is_legal_representative),
          is_primary: Boolean(obj.is_primary),
        } satisfies SupplierContact
      }).filter((item): item is SupplierContact => Boolean(item))
    }

    if (Array.isArray(raw)) {
      return normalizeArray(raw as unknown[])
    }

    const text = String(raw || '').trim()
    if (!text) return []
    try {
      const parsed = JSON.parse(text) as unknown
      if (!Array.isArray(parsed)) return []
      return normalizeArray(parsed)
    } catch {
      return []
    }
  }

  /** 根据当前表单和 AI 结果生成客户联系人 JSON。 */
  const buildCustomerContactsJson = (existingContactsRaw: unknown) => {
    const legalRepName = String(aiPartyAUnitForm.legalRepName || '').trim()
    const legalRepMobile = String(aiPartyAUnitForm.legalRepMobile || '').trim()
    const legalRepEmail = String(aiPartyAUnitForm.legalRepEmail || '').trim()
    const legalRepIdNumber = String(aiPartyAUnitForm.legalRepIdNumber || '').trim()
    const contactName = String(form.partyAContact || '').trim()
    const contactMobile = String(form.partyAContactMobile || '').trim()
    const contactPhone = String(form.partyAContactPhone || '').trim()
    const contactEmail = String(form.partyAContactEmail || '').trim()
    const contactIdNumber = String(form.partyAContactIdNumber || '').trim()
    const hasInput = Boolean(
      legalRepName || legalRepMobile || legalRepEmail || legalRepIdNumber
      || contactName || contactMobile || contactPhone || contactEmail || contactIdNumber,
    )
    if (!hasInput) return { json: '', changed: false }

    const existing = normalizeCustomerContacts(existingContactsRaw)
    const updated = [...existing]

    /** 仅在原字段为空时补入新值。 */
    const fillIfEmpty = (current: string, incoming: string) => {
      if (String(current || '').trim()) return current
      return incoming
    }

    if (legalRepName || legalRepMobile || legalRepEmail || legalRepIdNumber) {
      const idx = updated.findIndex((item) => Boolean(item.is_legal_representative))
      const original = idx >= 0 ? updated[idx] : null
      const nextName = legalRepName || '法人'
      const next: CustomerContact = {
        id: original?.id || IdGenerator.generateCode('CUSC'),
        name: original?.name || '',
        department: original?.department || '',
        mobile: original?.mobile || '',
        phone: original?.phone || '',
        email: original?.email || '',
        id_number: original?.id_number || '',
        is_legal_representative: true,
        is_primary: original?.is_primary ?? true,
      }
      next.name = fillIfEmpty(next.name, nextName)
      next.mobile = fillIfEmpty(next.mobile, legalRepMobile)
      next.email = fillIfEmpty(next.email, legalRepEmail)
      next.id_number = fillIfEmpty(next.id_number, legalRepIdNumber)
      if (idx >= 0) updated[idx] = next
      else updated.push(next)
    }

    if (contactName || contactMobile || contactPhone || contactEmail || contactIdNumber) {
      const normalizedContactName = normalizeNameKey(contactName)
      let idx = updated.findIndex((item) => Boolean(item.is_primary) && !item.is_legal_representative)
      if (idx < 0 && normalizedContactName) {
        idx = updated.findIndex((item) => normalizeNameKey(item.name) === normalizedContactName)
      }
      const original = idx >= 0 ? updated[idx] : null
      const next: CustomerContact = {
        id: original?.id || IdGenerator.generateCode('CUSC'),
        name: original?.name || '',
        department: original?.department || '',
        mobile: original?.mobile || '',
        phone: original?.phone || '',
        email: original?.email || '',
        id_number: original?.id_number || '',
        is_legal_representative: false,
        is_primary: true,
      }
      next.name = fillIfEmpty(next.name, contactName)
      next.mobile = fillIfEmpty(next.mobile, contactMobile)
      next.phone = fillIfEmpty(next.phone, contactPhone)
      next.email = fillIfEmpty(next.email, contactEmail)
      next.id_number = fillIfEmpty(next.id_number, contactIdNumber)
      if (idx >= 0) updated[idx] = next
      else updated.push(next)
    }

    const nextJson = JSON.stringify(updated)
    const currentJson = typeof existingContactsRaw === 'string'
      ? String(existingContactsRaw || '').trim()
      : (Array.isArray(existingContactsRaw) ? JSON.stringify(existingContactsRaw) : '')
    return { json: nextJson, changed: nextJson !== currentJson }
  }

  /** 根据当前表单和 AI 结果生成供应商联系人 JSON。 */
  const buildSupplierContactsJson = (existingContactsRaw: unknown) => {
    const contactName = String(form.partyBContact || '').trim()
    const contactMobile = String(form.partyBContactMobile || '').trim()
    const contactPhone = String(form.partyBContactPhone || '').trim()
    const contactEmail = String(form.partyBContactEmail || '').trim()
    const contactIdNumber = String(form.partyBContactIdNumber || '').trim()
    const hasInput = Boolean(contactName || contactMobile || contactPhone || contactEmail || contactIdNumber)
    if (!hasInput) return { json: '', changed: false }

    const existing = normalizeSupplierContacts(existingContactsRaw)
    const updated = [...existing]

    /** 仅在原字段为空时补入新值。 */
    const fillIfEmpty = (current: string, incoming: string) => {
      if (String(current || '').trim()) return current
      return incoming
    }

    const normalizedContactName = normalizeNameKey(contactName)
    let idx = updated.findIndex((item) => Boolean(item.is_primary) && !item.is_legal_representative)
    if (idx < 0 && normalizedContactName) {
      idx = updated.findIndex((item) => normalizeNameKey(item.name) === normalizedContactName)
    }
    const original = idx >= 0 ? updated[idx] : null
    const next: SupplierContact = {
      id: original?.id || IdGenerator.generateCode('SUPC'),
      name: original?.name || '',
      department: original?.department || '',
      mobile: original?.mobile || '',
      phone: original?.phone || '',
      email: original?.email || '',
      id_number: original?.id_number || '',
      wechat: original?.wechat || '',
      is_legal_representative: original?.is_legal_representative ?? false,
      is_primary: true,
    }
    next.name = fillIfEmpty(next.name, contactName)
    next.mobile = fillIfEmpty(next.mobile, contactMobile)
    next.phone = fillIfEmpty(next.phone, contactPhone)
    next.email = fillIfEmpty(next.email, contactEmail)
    next.id_number = fillIfEmpty(next.id_number, contactIdNumber)

    if (idx >= 0) updated[idx] = next
    else updated.push(next)

    const nextJson = JSON.stringify(updated)
    const currentJson = typeof existingContactsRaw === 'string'
      ? String(existingContactsRaw || '').trim()
      : (Array.isArray(existingContactsRaw) ? JSON.stringify(existingContactsRaw) : '')
    return { json: nextJson, changed: nextJson !== currentJson }
  }

  /** 同步更新客户缓存和甲方候选项。 */
  const syncCustomerCaches = (customer: Customer) => {
    const id = String(customer?.id || '').trim()
    rawCustomers.value = id
      ? [customer, ...rawCustomers.value.filter((item) => String(item?.id || '').trim() !== id)]
      : [customer, ...rawCustomers.value]
    partyANameOptions.value = rawCustomers.value
      .map((item) => {
        const value = String(item.name || item.client_name || '').trim()
        return value ? { label: value, value } : null
      })
      .filter((item): item is SelectOption => Boolean(item))
  }

  /** 同步更新供应商缓存和乙方候选项。 */
  const syncSupplierCaches = (supplier: Supplier) => {
    const id = String(supplier?.id || '').trim()
    rawSuppliers.value = id
      ? [supplier, ...rawSuppliers.value.filter((item) => String(item?.id || '').trim() !== id)]
      : [supplier, ...rawSuppliers.value]
    partyBNameOptions.value = rawSuppliers.value
      .map((item) => {
        const value = String(item.name || '').trim()
        return value ? { label: value, value } : null
      })
      .filter((item): item is SelectOption => Boolean(item))
  }

  /** 在需要时保存或更新甲方单位档案。 */
  const savePartyAUnitIfNeeded = async () => {
    if (!showPartyAUnitTab.value || !partyAUnitImportEnabled.value) return
    const name = String(form.clientName || '').trim()
    if (!name) return
    const isEdit = options.mode.value === 'edit'
    const contact = String(form.partyAContact || '').trim()
    const contactMobile = String(form.partyAContactMobile || '').trim()
    const contactEmail = String(form.partyAContactEmail || '').trim()
    const found = findCustomerByName(name)
    const contactsJson = buildCustomerContactsJson(found?.contacts)

    if (found) {
      const mergedContact = contact
        ? appendContactName(found.contact || found.contact_person || found.responsible_person || '', contact)
        : String(found.contact || found.contact_person || found.responsible_person || '').trim()
      const inputPhone = String(aiPartyAUnitForm.phone || '').trim()
      const inputAddress = String(aiPartyAUnitForm.address || '').trim()
      const inputTax = String(aiPartyAUnitForm.taxNumber || '').trim()
      const inputBankName = String(aiPartyAUnitForm.bankName || '').trim()
      const inputBankAccount = String(aiPartyAUnitForm.bankAccount || '').trim()
      const inputInvoiceType = normalizeInvoiceType(aiPartyAUnitForm.invoiceType)
      const inputMobile = contactMobile
      const inputEmail = contactEmail
      const changed = (current: unknown, incoming: string) => String(current || '').trim() !== incoming
      const updates = {
        id: String(found.id || '').trim(),
        contact: mergedContact !== String(found.contact || '').trim() ? mergedContact : undefined,
        contacts: contactsJson.changed ? contactsJson.json : undefined,
        phone: isEdit
          ? (changed(found.phone, inputPhone) ? inputPhone : undefined)
          : (!String(found.phone || '').trim() ? inputPhone || undefined : undefined),
        mobile: isEdit
          ? (changed(found.mobile, inputMobile) ? inputMobile : undefined)
          : (!String(found.mobile || '').trim() ? inputMobile || undefined : undefined),
        email: isEdit
          ? (changed(found.email, inputEmail) ? inputEmail : undefined)
          : (!String(found.email || '').trim() ? inputEmail || undefined : undefined),
        address: isEdit
          ? (changed(found.address, inputAddress) ? inputAddress : undefined)
          : (!String(found.address || '').trim() ? inputAddress || undefined : undefined),
        tax_number: isEdit
          ? (changed(found.tax_number, inputTax) ? inputTax : undefined)
          : (!String(found.tax_number || '').trim() ? inputTax || undefined : undefined),
        bank_name: isEdit
          ? (changed(found.bank_name, inputBankName) ? inputBankName : undefined)
          : (!String(found.bank_name || '').trim() ? inputBankName || undefined : undefined),
        bank_account: isEdit
          ? (changed(found.bank_account, inputBankAccount) ? inputBankAccount : undefined)
          : (!String(found.bank_account || '').trim() ? inputBankAccount || undefined : undefined),
        invoice_type: isEdit
          ? (changed(found.invoice_type, inputInvoiceType) ? inputInvoiceType : undefined)
          : (!String(found.invoice_type || '').trim() ? inputInvoiceType || undefined : undefined),
      }
      const hasUpdates = Object.entries(updates).some(([key, value]) => key !== 'id' && value !== undefined)
      if (!hasUpdates) return
      const result = await window.electronAPI.customer.update(updates)
      if (!result.success || !result.data) {
        throw new Error(result.error || '保存甲方单位失败')
      }
      syncCustomerCaches(result.data)
      return
    }

    const result = await window.electronAPI.customer.create({
      code: IdGenerator.generateCode('CUS'),
      name,
      contact: contact || undefined,
      mobile: contactMobile || undefined,
      phone: String(aiPartyAUnitForm.phone || '').trim() || undefined,
      email: contactEmail || undefined,
      address: String(aiPartyAUnitForm.address || '').trim() || undefined,
      tax_number: String(aiPartyAUnitForm.taxNumber || '').trim() || undefined,
      bank_name: String(aiPartyAUnitForm.bankName || '').trim() || undefined,
      bank_account: String(aiPartyAUnitForm.bankAccount || '').trim() || undefined,
      invoice_type: normalizeInvoiceType(aiPartyAUnitForm.invoiceType) || undefined,
      contacts: contactsJson.json || undefined,
    })
    if (!result.success || !result.data) {
      throw new Error(result.error || '创建甲方单位失败')
    }
    syncCustomerCaches(result.data)
  }

  /** 在需要时保存或更新乙方单位档案。 */
  const savePartyBUnitIfNeeded = async () => {
    if (!showPartyBUnitTab.value || !partyBUnitImportEnabled.value) return
    const name = String(form.partyBName || '').trim()
    if (!name) return
    const isEdit = options.mode.value === 'edit'
    const contact = String(form.partyBContact || '').trim()
    const found = findSupplierByName(name)
    const contactsJson = buildSupplierContactsJson(found?.contacts)

    if (found) {
      const mergedContact = contact
        ? appendContactName(found.contact || found.contact_person || found.responsible_person || '', contact)
        : String(found.contact || found.contact_person || found.responsible_person || '').trim()
      const inputPhone = String(aiPartyBUnitForm.phone || '').trim()
      const inputAddress = String(aiPartyBUnitForm.address || '').trim()
      const inputTax = String(aiPartyBUnitForm.taxNumber || '').trim()
      const inputBankName = String(aiPartyBUnitForm.bankName || '').trim()
      const inputBankAccount = String(aiPartyBUnitForm.bankAccount || '').trim()
      const inputInvoiceType = normalizeInvoiceType(aiPartyBUnitForm.invoiceType)
      const inputRepName = String(aiPartyBUnitForm.legalRepName || '').trim()
      const inputRepMobile = String(aiPartyBUnitForm.legalRepMobile || '').trim()
      const inputRepEmail = String(aiPartyBUnitForm.legalRepEmail || '').trim()
      const inputRepId = String(aiPartyBUnitForm.legalRepIdNumber || '').trim()
      const changed = (current: unknown, incoming: string) => String(current || '').trim() !== incoming
      const updates = {
        id: String(found.id || '').trim(),
        contact: mergedContact !== String(found.contact || '').trim() ? mergedContact : undefined,
        contacts: contactsJson.changed ? contactsJson.json : undefined,
        phone: isEdit
          ? (changed(found.phone, inputPhone) ? inputPhone : undefined)
          : (!String(found.phone || '').trim() ? inputPhone || undefined : undefined),
        address: isEdit
          ? (changed(found.address, inputAddress) ? inputAddress : undefined)
          : (!String(found.address || '').trim() ? inputAddress || undefined : undefined),
        tax_number: isEdit
          ? (changed(found.tax_number, inputTax) ? inputTax : undefined)
          : (!String(found.tax_number || '').trim() ? inputTax || undefined : undefined),
        bank_name: isEdit
          ? (changed(found.bank_name, inputBankName) ? inputBankName : undefined)
          : (!String(found.bank_name || '').trim() ? inputBankName || undefined : undefined),
        bank_account: isEdit
          ? (changed(found.bank_account, inputBankAccount) ? inputBankAccount : undefined)
          : (!String(found.bank_account || '').trim() ? inputBankAccount || undefined : undefined),
        invoice_type: isEdit
          ? (changed(found.invoice_type, inputInvoiceType) ? inputInvoiceType : undefined)
          : (!String(found.invoice_type || '').trim() ? inputInvoiceType || undefined : undefined),
        legal_rep_name: isEdit
          ? (changed((found as Supplier).legal_rep_name, inputRepName) ? inputRepName : undefined)
          : (!String((found as Supplier).legal_rep_name || '').trim() ? inputRepName || undefined : undefined),
        legal_rep_mobile: isEdit
          ? (changed((found as Supplier).legal_rep_mobile, inputRepMobile) ? inputRepMobile : undefined)
          : (!String((found as Supplier).legal_rep_mobile || '').trim() ? inputRepMobile || undefined : undefined),
        legal_rep_email: isEdit
          ? (changed((found as Supplier).legal_rep_email, inputRepEmail) ? inputRepEmail : undefined)
          : (!String((found as Supplier).legal_rep_email || '').trim() ? inputRepEmail || undefined : undefined),
        legal_rep_id_number: isEdit
          ? (changed((found as Supplier).legal_rep_id_number, inputRepId) ? inputRepId : undefined)
          : (!String((found as Supplier).legal_rep_id_number || '').trim() ? inputRepId || undefined : undefined),
      }
      const hasUpdates = Object.entries(updates).some(([key, value]) => key !== 'id' && value !== undefined)
      if (!hasUpdates) return
      const result = await window.electronAPI.supplier.update(updates)
      if (!result.success || !result.data) {
        throw new Error(result.error || '保存乙方单位失败')
      }
      syncSupplierCaches(result.data)
      return
    }

    const result = await window.electronAPI.supplier.create({
      code: IdGenerator.generateCode('SUP'),
      name,
      contact: contact || undefined,
      contacts: contactsJson.json || undefined,
      phone: String(aiPartyBUnitForm.phone || '').trim() || undefined,
      address: String(aiPartyBUnitForm.address || '').trim() || undefined,
      tax_number: String(aiPartyBUnitForm.taxNumber || '').trim() || undefined,
      bank_name: String(aiPartyBUnitForm.bankName || '').trim() || undefined,
      bank_account: String(aiPartyBUnitForm.bankAccount || '').trim() || undefined,
      invoice_type: normalizeInvoiceType(aiPartyBUnitForm.invoiceType) || undefined,
      legal_rep_name: String(aiPartyBUnitForm.legalRepName || '').trim() || undefined,
      legal_rep_mobile: String(aiPartyBUnitForm.legalRepMobile || '').trim() || undefined,
      legal_rep_email: String(aiPartyBUnitForm.legalRepEmail || '').trim() || undefined,
      legal_rep_id_number: String(aiPartyBUnitForm.legalRepIdNumber || '').trim() || undefined,
    })
    if (!result.success || !result.data) {
      throw new Error(result.error || '创建乙方单位失败')
    }
    syncSupplierCaches(result.data)
  }

  /** 检查合同编号是否与现有数据冲突。 */
  const isContractCodeConflict = (code: string) => {
    const normalized = String(code || '').trim()
    if (!normalized) return true
    const currentId = options.mode.value === 'edit' ? String(options.initial.value?.id || '').trim() : ''
    return contractInfos.value.some((item) => {
      const otherId = String(item.id || '').trim()
      if (currentId && otherId === currentId) return false
      return String(item.contract_code || '').trim() === normalized
    })
  }

  /** 为识别出的合同编号生成可用的兜底值。 */
  const resolveContractCodeWithFallback = (rawCode: unknown) => {
    const preferred = String(rawCode || '').trim().replace(/\s+/g, '')
    if (preferred && !isContractCodeConflict(preferred)) return { code: preferred, reason: '识别值' }
    if (preferred && isContractCodeConflict(preferred)) {
      for (let i = 1; i <= 50; i += 1) {
        const candidate = `${preferred}-${String(i).padStart(2, '0')}`
        if (!isContractCodeConflict(candidate)) return { code: candidate, reason: '识别值冲突后自动修正' }
      }
    }
    for (let i = 0; i < 100; i += 1) {
      const candidate = IdGenerator.generateCode('HT')
      if (!isContractCodeConflict(candidate)) return { code: candidate, reason: '系统生成' }
    }
    return { code: `${IdGenerator.generateCode('HT')}-${Math.floor(Math.random() * 1000)}`, reason: '系统强制兜底生成' }
  }

  /** 标准化 AI 提取的收付款计划数据。 */
  const normalizeAiReceiptPlans = (items: AIExtractedReceiptPlan[] | undefined | null) => {
    const warnings: string[] = []
    const rows: AIAppliedReceiptPlan[] = []
    const source = Array.isArray(items) ? items : []
    source.forEach((item, index) => {
      const rowNo = index + 1
      const planName = String(item.period || item.planName || '').trim() || `第${rowNo}期`
      const direction = String(item.direction || '').includes('付') ? '付款' : '收款'
      const rawFrequency = String((item as any).frequency || (item as any).receiptFrequency || '').trim()
      let receipt_frequency: string | undefined
      if (rawFrequency) {
        if (receiptFrequencyOptions.value.length === 0) {
          receipt_frequency = rawFrequency
        } else {
          const matched = matchOptionValue(receiptFrequencyOptions.value, rawFrequency)
          if (matched) receipt_frequency = matched
          else warnings.push(`收款计划第${rowNo}行收付频率未命中字典白名单，已留空`)
        }
      }
      const ratio = Number.isFinite(Number(item.ratio)) && Number(item.ratio) >= 0
        ? Number(item.ratio)
        : undefined

      let expectedAmount: number | undefined
      if (Number.isFinite(Number(item.amount)) && Number(item.amount) >= 0) {
        expectedAmount = Number(item.amount)
      } else if (ratio !== undefined) {
        expectedAmount = undefined
      }

      let expectedDate: string | undefined
      if (item.plannedDate) {
        const date = parseDateText(String(item.plannedDate))
        if (date) expectedDate = formatDate(date)
        else warnings.push(`收款计划第${rowNo}行日期格式无效，已留空`)
      }

      const remark = [String(item.condition || '').trim(), String(item.remark || '').trim()]
        .filter(Boolean)
        .join('；')

      rows.push({
        plan_name: planName,
        direction,
        receipt_frequency,
        ratio,
        expected_amount: expectedAmount,
        expected_date: expectedDate,
        remark: remark || undefined,
      })
    })
    return { rows, warnings }
  }

  /** 按字段类型将 AI 提取值回填到表单。 */
  const applyExtractedValueByField = (
    field: ContractFormSchemaField,
    rawValue: unknown,
  ): { applied: boolean; reason?: string; status: 'success' | 'empty' | 'cleared' } => {
    if (rawValue === undefined || rawValue === null || rawValue === '') return { applied: false, reason: `${field.label}缺失`, status: 'empty' }
    if (field.type === 'number') {
      const num = Number(rawValue)
      if (!Number.isFinite(num)) return { applied: false, reason: `${field.label}格式无效`, status: 'cleared' }
      form[field.key] = num
      return { applied: true, status: 'success' }
    }
    if (field.type === 'date') {
      const rawText = String(rawValue || '').trim()
      const date = parseDateText(rawText)
      if (date) {
        form[field.key] = date
        return { applied: true, status: 'success' }
      }
      const rangeMatches = rawText.match(/(\d{4}\s*[年./-]\s*\d{1,2}\s*[月./-]\s*\d{1,2}\s*日?)[^0-9]{0,12}(\d{4}\s*[年./-]\s*\d{1,2}\s*[月./-]\s*\d{1,2}\s*日?)/)
      if (rangeMatches) {
        const startDate = parseDateText(rangeMatches[1])
        const endDate = parseDateText(rangeMatches[2])
        const label = String(field.label || '').replace(/\s+/g, '')
        const preferEnd = /(结束|截止|到期|终止|止|还车|归还)/.test(label)
        const preferStart = /(开始|起始|起租|起|交车|取车)/.test(label)
        const picked = (preferEnd && endDate) ? endDate : (preferStart && startDate) ? startDate : (startDate || endDate)
        if (picked) {
          form[field.key] = picked
          return { applied: true, status: 'success' }
        }
      }
      return { applied: false, reason: `${field.label}日期格式无效`, status: 'cleared' }
    }
    if (field.type === 'multiselect') {
      const list = Array.isArray(rawValue)
        ? rawValue.map((item) => String(item || '').trim()).filter(Boolean)
        : String(rawValue || '').split(/[,，、]/).map((item) => item.trim()).filter(Boolean)
      if (list.length === 0) return { applied: false, reason: `${field.label}缺失`, status: 'empty' }
      const options = getFieldOptions(field)
      if (options.length === 0) {
        form[field.key] = list
        return { applied: true, status: 'success' }
      }
      const matched = list.map((item) => matchOptionValue(options, item)).filter(Boolean) as string[]
      if (matched.length === 0) {
        form[field.key] = []
        return { applied: false, reason: `${field.label}未命中字典白名单`, status: 'cleared' }
      }
      form[field.key] = matched
      return { applied: true, status: 'success' }
    }
    if (field.type === 'select' || field.type === 'tree') {
      const source = String(rawValue || '').trim()
      if (!source) return { applied: false, reason: `${field.label}缺失`, status: 'empty' }
      if (field.key === 'clientName' || field.key === 'partyBName' || field.key === 'partyAContact' || field.key === 'partyBContact') {
        form[field.key] = source
        return { applied: true, status: 'success' }
      }
      const options = getFieldOptions(field)
      const matched = matchOptionValue(options, source)
      if (!matched) {
        form[field.key] = field.type === 'tree' ? null : ''
        return { applied: false, reason: `${field.label}未命中字典白名单`, status: 'cleared' }
      }
      form[field.key] = matched
      return { applied: true, status: 'success' }
    }
    const text = String(rawValue || '').trim()
    if (!text) return { applied: false, reason: `${field.label}缺失`, status: 'empty' }
    form[field.key] = text
    return { applied: true, status: 'success' }
  }

  /** 将 AI 合同解析结果批量回填到表单和附加页签。 */
  const applyContractExtractionResult = async (
    result: AIContractExtractionResult,
    options?: { lockedContractType?: string; lockedContractTypeLabel?: string },
  ) => {
    await ensureContractInfosLoaded()
    isApplyingAiExtraction.value = true
    try {
      const updatedFields: string[] = []
      const skippedFields: string[] = []
      const fieldFillResults: string[] = []
      const lockedContractType = String(options?.lockedContractType || '').trim()
      const lockedContractTypeLabel = String(options?.lockedContractTypeLabel || lockedContractType || '').trim()
      const assignText = (key: 'clientName' | 'partyBName' | 'contractSummary', label: string) => {
        const value = String(result[key] || '').trim()
        if (!value) {
          skippedFields.push(`${label}缺失`)
          fieldFillResults.push(`${label}: 置空（缺失）`)
          return
        }
        form[key] = key === 'contractSummary' ? normalizeStoredContractSummaryToMarkdown(value) : value
        updatedFields.push(label)
        fieldFillResults.push(`${label}: 成功`)
      }
      assignText('clientName', '甲方单位')
      assignText('partyBName', '乙方单位')
      assignText('contractSummary', '合同摘要')

      const aiContractName = String(result.contractName || '').trim()
      const fallbackContractName = resolveSuggestedContractName(result, contractTypeMergedOptions.value)
      const contractName = fallbackContractName
      form.contractName = contractName
      updatedFields.push('合同名称')
      fieldFillResults.push(`合同名称: 成功（${aiContractName && aiContractName === contractName ? 'AI识别' : '项目化命名优化'}）`)

      const resolvedContractCode = resolveContractCodeWithFallback(result.contractCode)
      form.contractCode = resolvedContractCode.code
      updatedFields.push('合同编号')
      fieldFillResults.push(`合同编号: 成功（${resolvedContractCode.reason}）`)

      const signingDate = parseDateText(result.signingDate)
      if (signingDate) {
        form.signingDate = signingDate
        updatedFields.push('签约日期')
        fieldFillResults.push('签约日期: 成功')
      } else if (result.signingDate) {
        skippedFields.push('签约日期格式无效')
        fieldFillResults.push('签约日期: 置空（日期格式无效）')
      }

      const preferredContractType = String(result.resolvedContractType || result.contractType || '').trim()
      const matchedContractType = matchOptionValue(contractTypeMergedOptions.value, preferredContractType)
      if (lockedContractType) {
        const currentType = matchOptionValue(contractTypeMergedOptions.value, lockedContractType) || lockedContractType
        if (String(resolvedContractType.value || '').trim() !== currentType) {
          await switchSchemaByContractType(currentType)
        } else if (String(form.contractType || '').trim() !== currentType) {
          form.contractType = currentType
        }
        updatedFields.push('合同类型')
        fieldFillResults.push(`合同类型: 成功（使用当前已选类型${lockedContractTypeLabel ? `：${lockedContractTypeLabel}` : ''}）`)
      } else if (matchedContractType) {
        await switchSchemaByContractType(matchedContractType)
        updatedFields.push('合同类型')
        fieldFillResults.push('合同类型: 成功（AI自动判型）')
      } else if (preferredContractType) {
        form.contractType = ''
        skippedFields.push('合同类型未命中字典白名单')
        fieldFillResults.push('合同类型: 置空（未命中字典白名单）')
      }

      const extractedFields = result.extractedFields && typeof result.extractedFields === 'object'
        ? result.extractedFields
        : {}
      const mergedExtractedFields: Record<string, unknown> = { ...(extractedFields as Record<string, unknown>) }
      const reservedKeys = new Set([
        'contractName',
        'contractCode',
        'signingDate',
        'contractType',
        'clientName',
        'partyBName',
        'partyAContact',
        'partyALegalRepName',
        'partyALegalRepMobile',
        'partyALegalRepEmail',
        'partyALegalRepIdNumber',
        'partyAPhone',
        'partyAAddress',
        'partyATaxNumber',
        'partyABankName',
        'partyABankAccount',
        'partyAInvoiceType',
        'partyBContact',
        'partyBLegalRepName',
        'partyBLegalRepMobile',
        'partyBLegalRepEmail',
        'partyBLegalRepIdNumber',
        'partyBPhone',
        'partyBAddress',
        'partyBTaxNumber',
        'partyBBankName',
        'partyBBankAccount',
        'partyBInvoiceType',
        'contractSummary',
        'resolvedContractType',
        'contractTypeConfidence',
        'contractTypeReason',
        'extractedFields',
        'receiptPlans',
        'stages',
      ])
      Object.entries(result as unknown as Record<string, unknown>).forEach(([key, value]) => {
        if (reservedKeys.has(key)) return
        if (mergedExtractedFields[key] !== undefined) return
        mergedExtractedFields[key] = value
      })

      for (const field of schema.value.fields) {
        if (field.key === 'contractType') continue
        if (!Object.prototype.hasOwnProperty.call(mergedExtractedFields, field.key)) continue
        const applied = applyExtractedValueByField(field, mergedExtractedFields[field.key])
        if (applied.applied) {
          if (!updatedFields.includes(field.label)) updatedFields.push(field.label)
          fieldFillResults.push(`${field.label}: 成功`)
        } else if (applied.reason) {
          skippedFields.push(applied.reason)
          fieldFillResults.push(`${field.label}: ${applied.status === 'empty' ? '未填' : '置空'}（${applied.reason}）`)
        }
      }

      const extractedRecord = mergedExtractedFields
      const pickFirstExtracted = (keys: string[]) => {
        for (const key of keys) {
          const value = extractedRecord[key]
          if (value !== undefined && value !== null && String(value).trim() !== '') return value
        }
        return undefined
      }

    const plateAliasKeys = [
      'car_plate',
      'carplate',
      'carplatenumber',
      'plate_number',
      'platenumber',
      'license_plate',
      'licenseplate',
      'vehicle_plate',
      'vehicleplate',
      'vehicle_no',
      'vehicleno',
      'car_no',
      'carno',
    ]
    const startAliasKeys = [
      'start_date',
      'startdate',
      'begin_date',
      'begindate',
      'start_time',
      'starttime',
      'lease_start_date',
      'rent_start_date',
      'rental_start_date',
      'begin_time',
      'begintime',
      'startDate',
    ]
    const endAliasKeys = [
      'end_date',
      'enddate',
      'finish_date',
      'finishdate',
      'end_time',
      'endtime',
      'lease_end_date',
      'rent_end_date',
      'rental_end_date',
      'return_date',
      'returndate',
      'endDate',
    ]

    for (const field of schema.value.fields) {
      const current = form[field.key]
      const hasValue = current !== undefined && current !== null && String(current).trim() !== ''
      if (hasValue) continue
      const label = normalizeLabelKey(field.label)
      if (!label) continue
      if (/(车牌|号牌|牌照)/.test(label)) {
        const alias = pickFirstExtracted(plateAliasKeys)
        if (alias !== undefined) {
          const applied = applyExtractedValueByField(field, alias)
          if (applied.applied) {
            if (!updatedFields.includes(field.label)) updatedFields.push(field.label)
            fieldFillResults.push(`${field.label}: 成功（别名兜底）`)
          }
        }
        continue
      }
      if (/(开始|起始|起租|交车|取车)/.test(label)) {
        const alias = pickFirstExtracted(startAliasKeys)
        if (alias !== undefined) {
          const applied = applyExtractedValueByField(field, alias)
          if (applied.applied) {
            if (!updatedFields.includes(field.label)) updatedFields.push(field.label)
            fieldFillResults.push(`${field.label}: 成功（别名兜底）`)
          }
        }
        continue
      }
      if (/(结束|截止|到期|终止|还车|归还)/.test(label)) {
        const alias = pickFirstExtracted(endAliasKeys)
        if (alias !== undefined) {
          const applied = applyExtractedValueByField(field, alias)
          if (applied.applied) {
            if (!updatedFields.includes(field.label)) updatedFields.push(field.label)
            fieldFillResults.push(`${field.label}: 成功（别名兜底）`)
          }
        }
      }
    }

      const extracted = { ...(result as unknown as Record<string, unknown>), ...(mergedExtractedFields as Record<string, unknown>) }
    const extractedPartyAContact = String(extracted.partyAContact || '').trim()
    const extractedPartyBContact = String(extracted.partyBContact || '').trim()

    if (extractedPartyAContact) {
      form.partyAContact = extractedPartyAContact
      updatedFields.push('甲方负责人')
      fieldFillResults.push('甲方负责人: 成功')
    }
    if (extractedPartyBContact) {
      form.partyBContact = extractedPartyBContact
      updatedFields.push('乙方负责人')
      fieldFillResults.push('乙方负责人: 成功')
    }

    resetPartyUnitForm(aiPartyAUnitForm)
    aiPartyAUnitForm.legalRepName = String(extracted.partyALegalRepName || '').trim()
    aiPartyAUnitForm.legalRepMobile = String(extracted.partyALegalRepMobile || '').trim()
    aiPartyAUnitForm.legalRepEmail = String(extracted.partyALegalRepEmail || '').trim()
    aiPartyAUnitForm.legalRepIdNumber = String(extracted.partyALegalRepIdNumber || '').trim()
    aiPartyAUnitForm.phone = String(extracted.partyAPhone || '').trim()
    aiPartyAUnitForm.address = String(extracted.partyAAddress || '').trim()
    aiPartyAUnitForm.taxNumber = String(extracted.partyATaxNumber || '').trim()
    aiPartyAUnitForm.bankName = String(extracted.partyABankName || '').trim()
    aiPartyAUnitForm.bankAccount = String(extracted.partyABankAccount || '').trim()
    aiPartyAUnitForm.invoiceType = normalizeInvoiceType(extracted.partyAInvoiceType)
    hasAiPartyAUnit.value = hasPartyUnitValues(aiPartyAUnitForm, String(form.clientName || ''), String(form.partyAContact || ''))
    if (hasAiPartyAUnit.value) {
      updatedFields.push('甲方单位档案')
      fieldFillResults.push('甲方单位档案: 已生成待确认信息')
    }

    resetPartyUnitForm(aiPartyBUnitForm)
    aiPartyBUnitForm.legalRepName = String(extracted.partyBLegalRepName || '').trim()
    aiPartyBUnitForm.legalRepMobile = String(extracted.partyBLegalRepMobile || '').trim()
    aiPartyBUnitForm.legalRepEmail = String(extracted.partyBLegalRepEmail || '').trim()
    aiPartyBUnitForm.legalRepIdNumber = String(extracted.partyBLegalRepIdNumber || '').trim()
    aiPartyBUnitForm.phone = String(extracted.partyBPhone || '').trim()
    aiPartyBUnitForm.address = String(extracted.partyBAddress || '').trim()
    aiPartyBUnitForm.taxNumber = String(extracted.partyBTaxNumber || '').trim()
    aiPartyBUnitForm.bankName = String(extracted.partyBBankName || '').trim()
    aiPartyBUnitForm.bankAccount = String(extracted.partyBBankAccount || '').trim()
    aiPartyBUnitForm.invoiceType = normalizeInvoiceType(extracted.partyBInvoiceType)
    hasAiPartyBUnit.value = hasPartyUnitValues(aiPartyBUnitForm, String(form.partyBName || ''), String(form.partyBContact || ''))
    if (hasAiPartyBUnit.value) {
      updatedFields.push('乙方单位档案')
      fieldFillResults.push('乙方单位档案: 已生成待确认信息')
    }

    const normalizedReceiptPlans = normalizeAiReceiptPlans(result.receiptPlans)
    pendingAiReceiptPlans.value = normalizedReceiptPlans.rows
    receiptPlanImportEnabled.value = true
    receiptPlanSyncToCalendar.value = true
    receiptPlanRowErrors.value = computeReceiptPlanRowErrors(pendingAiReceiptPlans.value, receiptPlanImportEnabled.value)
    if (normalizedReceiptPlans.rows.length > 0) {
      updatedFields.push('收款计划')
      fieldFillResults.push(`收款计划: 成功（${normalizedReceiptPlans.rows.length} 条待写入）`)
      activeTab.value = showPartyAUnitTab.value
        ? 'partyAUnit'
        : (showPartyBUnitTab.value ? 'partyBUnit' : 'receiptPlan')
    }
    if (normalizedReceiptPlans.warnings.length > 0) {
      skippedFields.push(...normalizedReceiptPlans.warnings)
      fieldFillResults.push(...normalizedReceiptPlans.warnings.map((item) => `收款计划: 置空（${item}）`))
    }

      if (form.clientName) onPartyAChange({ value: form.clientName }, { preserveCurrentContact: true })
      if (form.partyBName) onPartyBChange({ value: form.partyBName }, { preserveCurrentContact: true })
      if (updatedFields.length > 0 && normalizedReceiptPlans.rows.length === 0) {
        activeTab.value = showPartyAUnitTab.value
          ? 'partyAUnit'
          : (showPartyBUnitTab.value ? 'partyBUnit' : 'base')
      }

      const stageText = Array.isArray(result.stages)
        ? result.stages.map((stage) => {
          const label = stage.stage === 'classify' ? '判型' : (stage.stage === 'receiptPlan' ? '收款计划提取' : '字段提取')
          return `${label}：${stage.success ? '成功' : '失败'}（${stage.message}）`
        }).join('\n')
        : ''
      const confidenceText = Number.isFinite(Number(result.contractTypeConfidence))
        ? `合同类型置信度：${(Number(result.contractTypeConfidence) * 100).toFixed(1)}%`
        : ''

      if (stageText) {
        appendAiParsingLog(stageText)
      }
      if (confidenceText) {
        appendAiParsingLog(confidenceText)
      }
      if (updatedFields.length > 0) {
        appendAiParsingLog(`已回填：${updatedFields.join('、')}`)
      } else {
        appendAiParsingLog('未回填任何字段')
      }
      if (skippedFields.length > 0) {
        appendAiParsingLog(`需人工确认：${skippedFields.join('；')}`)
      }
      fieldFillResults.forEach((line) => appendAiParsingLog(line))
    } finally {
      nextTick(() => {
        isApplyingAiExtraction.value = false
      })
    }
  }

  /** 生成 AI 提取证据的摘要文本。 */
  const buildEvidenceSummaryText = (payload: AIContractExtractionEvidenceResult | null): string => {
    if (!payload) return ''
    const evidenceRows = Array.isArray(payload.evidence) ? payload.evidence : []
    if (evidenceRows.length === 0) return '未找到字段证据'
    return evidenceRows
      .slice(0, 8)
      .map((row) => {
        const preview = String(row.evidenceText || '')
          .replace(/\s+/g, ' ')
          .slice(0, 60)
        return `${row.fieldKey} <- 块#${row.chunkIndex + 1} ${preview}`
      })
      .join('\n')
  }

  /** 对证据文本执行 HTML 转义。 */
  const escapeHtml = (value: string) => String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')

  /** 在证据文本中高亮指定关键字。 */
  const highlightEvidenceText = (text: string, keyword: string): string => {
    const source = String(text || '')
    const target = String(keyword || '').trim()
    const escapedSource = escapeHtml(source)
    if (!target) return escapedSource
    const escapedKeyword = escapeHtml(target)
    if (!escapedKeyword) return escapedSource
    return escapedSource.split(escapedKeyword).join(`<mark class="rounded px-0.5" style="background-color: var(--p-yellow-200); color: var(--content-text);">${escapedKeyword}</mark>`)
  }

  /** 格式化证据置信度显示文本。 */
  const formatEvidenceConfidence = (value?: number): string => {
    const num = Number(value)
    if (!Number.isFinite(num)) return ''
    return `${(num * 100).toFixed(0)}%`
  }

  /** 切换到目标字段所在标签页并聚焦对应控件。 */
  const focusFieldByKey = async (fieldKey: string) => {
    const key = String(fieldKey || '').trim()
    if (!key) return
    const field = fieldMap.value.get(key)
    if (field) {
      activeTab.value = isContractFieldInDefaultTab(field) ? field.section : 'ext'
    } else if (key.startsWith('partyA')) {
      activeTab.value = showPartyAUnitTab.value ? 'partyAUnit' : 'base'
    } else if (key.startsWith('partyB')) {
      activeTab.value = showPartyBUnitTab.value ? 'partyBUnit' : 'base'
    } else if (key === 'receiptPlans') {
      activeTab.value = 'receiptPlan'
    } else {
      activeTab.value = 'base'
    }
    await nextTick()
    const target = document.querySelector(`[data-field-key="${key}"]`) as HTMLElement | null
    if (!target) return
    target.scrollIntoView({ behavior: 'smooth', block: 'center' })
    const focusable = target.querySelector('input, textarea, [contenteditable="true"], .p-select, .p-treeselect') as HTMLElement | null
    focusable?.focus?.()
  }

  /** 选择并暂存待上传的合同文件。 */
  const handleSelectContractFile = async () => {
    aiParsingError.value = ''
    aiExtractionEvidence.value = null
    aiParsingLogs.value = []
    selectedContractFilePath.value = ''
    stagedContractUpload.value = null
    uploadedContractFileForSave.value = null

    const selected = await window.electronAPI.fs.selectFile({
      properties: ['openFile'],
      filters: [{ name: '合同文档', extensions: ['doc', 'docx', 'pdf', 'txt', 'md', 'json', 'csv', 'xls', 'xlsx', 'png', 'jpg', 'jpeg', 'webp', 'bmp', 'tif', 'tiff'] }],
    })
    if (!selected.success || !selected.data) throw new Error(selected.error || '选择文件失败')
    if ((selected.data as any).canceled) return

    const filePath = String((selected.data as any).filePaths?.[0] || '').trim()
    if (!filePath) return

    const uploadResult = await window.electronAPI.contract.upload(filePath)
    if (!uploadResult.success || !uploadResult.data) throw new Error(uploadResult.error || '上传临时文件失败')

    const previewPath = String((uploadResult.data as any).previewPath || '').trim()
    const aiPath = String((uploadResult.data as any).tempPath || '').trim()
    const fileId = String((uploadResult.data as any).fileId || '').trim()
    const originalName = String(filePath.replace(/\\/g, '/').split('/').pop() || '').trim() || '合同文件'

    if (previewPath) {
      selectedContractFilePath.value = previewPath
    }
    if (fileId && (previewPath || aiPath)) {
      stagedContractUpload.value = { fileId, aiPath: aiPath || previewPath, previewPath: previewPath || aiPath, originalName }
    }
    if (previewPath) {
      uploadedContractFileForSave.value = { tempPath: previewPath, originalName }
    }
  }

  /** 整理表单可选项，供 AI 判型和字段匹配使用。 */
  const buildAiFieldOptionEntries = (): Record<string, Array<{ value: string; label?: string }>> => {
    const entries: Record<string, Array<{ value: string; label?: string }>> = {}
    /** 移除树形选项标签中的缩进前缀。 */
    const stripIndent = (label: string) => String(label || '').replace(/^—+/g, '').trim()
    /** 将树形选项拍平成 AI 可消费的列表。 */
    const flattenTreeOptions = (nodes: TreeNodeOption[]) => {
      const rows: Array<{ value: string; label?: string }> = []
      /** 递归遍历树形选项节点。 */
      const dfs = (node: TreeNodeOption) => {
        const value = String(node?.data || node?.key || '').trim()
        const label = stripIndent(String(node?.label || value))
        if (value) rows.push({ value, label: label || undefined })
        const children = Array.isArray(node.children) ? node.children : []
        children.forEach(dfs)
      }
      nodes.forEach(dfs)
      return rows
    }

    for (const field of schema.value.fields) {
      if (!field.visible) continue
      if (field.type !== 'select' && field.type !== 'multiselect' && field.type !== 'tree') continue

      const dedup = new Map<string, { value: string; label?: string }>()
      const options = getFieldOptions(field)
      if (Array.isArray(options) && options.length > 0) {
        for (const option of options) {
          const value = String(option?.value || '').trim()
          if (!value) continue
          const label = stripIndent(String(option?.label || value))
          if (!dedup.has(value)) dedup.set(value, { value, label: label || undefined })
        }
      } else if (field.type === 'tree') {
        flattenTreeOptions(getFieldTreeOptions(field)).forEach((row) => {
          if (!dedup.has(row.value)) dedup.set(row.value, row)
        })
      }

      const rows = Array.from(dedup.values())
      if (rows.length > 0) entries[field.key] = rows
    }

    if (receiptFrequencyOptions.value.length > 0) {
      entries.receipt_frequency = receiptFrequencyOptions.value
        .map((item) => ({
          value: String(item.value || '').trim(),
          label: String(item.label || item.value || '').trim() || undefined,
        }))
        .filter((item) => item.value)
    }

    return entries
  }

  /** 生成写入日志的 AI 候选项预览文本。 */
  const buildAiOptionPreviewText = (fieldOptionEntries: Record<string, Array<{ value: string; label?: string }>>) => {
    const keys = Object.keys(fieldOptionEntries)
    if (keys.length === 0) return ''

    const fieldLabelByKey = new Map<string, string>()
    schema.value.fields.forEach((field) => fieldLabelByKey.set(field.key, String(field.label || field.key)))

    const parts: string[] = []
    keys.slice(0, 8).forEach((key) => {
      const label = fieldLabelByKey.get(key) || key
      const values = (fieldOptionEntries[key] || []).map((item) => String(item.value || '').trim()).filter(Boolean)
      if (values.length === 0) return
      const shown = values.slice(0, 10).join('、')
      const suffix = values.length > 10 ? `…（共${values.length}项）` : ''
      parts.push(`${label}=${shown}${suffix}`)
    })

    if (parts.length === 0) return ''
    const extra = keys.length > 8 ? `；另有${keys.length - 8}个字段未展示` : ''
    return `${parts.join('；')}${extra}`
  }

  /** 收敛 AI 提取字段，仅保留当前弹窗可见且可直接回填的字段。 */
  const buildAiTargetFields = (): string[] => {
    return schema.value.fields
      .filter((field) => field.visible && field.key !== 'contractType')
      .map((field) => field.key)
  }

  /** 解析当前选中合同类型的值、名称和锁定状态。 */
  const resolveCurrentContractTypeContext = () => {
    const currentValue = String(form.contractType || '').trim()
    const matchedValue = matchOptionValue(contractTypeMergedOptions.value, currentValue)
    const canonicalValue = matchedValue || currentValue
    const matchedOption = contractTypeMergedOptions.value.find((item) => String(item.value || '').trim() === canonicalValue)
    return {
      value: canonicalValue,
      label: String(matchedOption?.label || canonicalValue || '').trim(),
      locked: Boolean(canonicalValue),
    }
  }

  /** 执行合同文件选择、AI 解析与结果回填流程。 */
  const handleParseContractByAI = async () => {
    if (!isAIEnabled.value) {
      toast.add({
        severity: 'warn',
        summary: 'AI 未启用',
        detail: '请先在设置中启用 AI 功能，再执行合同与收款计划提取',
        life: 3000,
      })
      return
    }
    if (!hasSystemContractTypeOptions.value) {
      toast.add({
        severity: 'warn',
        summary: '缺少系统合同类型',
        detail: '请先在系统字典中维护“合同类型”，AI 只能从系统提供的合同类型中判定和回填',
        life: 3500,
      })
      return
    }
    isParsingContract.value = true
    aiParsingError.value = ''
    aiExtractionEvidence.value = null
    aiParsingLogs.value = []
    selectedContractFilePath.value = ''
    stagedContractUpload.value = null
    uploadedContractFileForSave.value = null
    aiParsingStageText.value = '正在选择合同文件...'
    startAiParsingHeartbeat()
    appendAiParsingLog('开始 AI 合同解析流程')
    try {
      const contractTypeContext = resolveCurrentContractTypeContext()
      if (contractTypeContext.locked) {
        if (String(resolvedContractType.value || '').trim() !== contractTypeContext.value) {
          await switchSchemaByContractType(contractTypeContext.value)
        } else {
          await loadSchemaDrivenFieldOptions()
        }
        appendAiParsingLog(`已选合同类型：${contractTypeContext.label || contractTypeContext.value}，本次将按该类型直接提取`)
      } else {
        await loadSchemaDrivenFieldOptions()
        appendAiParsingLog('未选择合同类型，将先自动判型，再按判型结果提取')
      }
      await refreshResponsiblePersonOptions()

      const selected = await window.electronAPI.fs.selectFile({
        properties: ['openFile'],
        filters: [{ name: '合同文档', extensions: ['doc', 'docx', 'pdf', 'txt', 'md'] }],
      }) 
      if (!selected.success || !selected.data) throw new Error(selected.error || '选择文件失败')
      if ((selected.data as any).canceled) return

      const filePath = String((selected.data as any).filePaths?.[0] || '').trim()
      if (!filePath) return
      appendAiParsingLog(`已选择文件：${filePath}`)

      aiParsingStageText.value = '正在上传文件并准备 AI 提取...'
      appendAiParsingLog('开始上传原始文件')
      const uploadResult = await window.electronAPI.contract.upload(filePath)
      if (!uploadResult.success || !uploadResult.data) throw new Error(uploadResult.error || '上传临时文件失败')
      const previewPath = String((uploadResult.data as any).previewPath || '').trim()
      const aiPath = String((uploadResult.data as any).tempPath || '').trim()
      const fileId = String((uploadResult.data as any).fileId || '').trim()
      const originalName = String(filePath.replace(/\\/g, '/').split('/').pop() || '').trim() || '合同文件'
      if (previewPath) {
        selectedContractFilePath.value = previewPath
        uploadedContractFileForSave.value = { tempPath: previewPath, originalName }
      }
      if (fileId && (previewPath || aiPath)) {
        stagedContractUpload.value = { fileId, aiPath: aiPath || previewPath, previewPath: previewPath || aiPath, originalName }
      }
      appendAiParsingLog('文件上传成功，优先按原始文件直传 AI 解析')

      aiParsingStageText.value = '正在执行两阶段提取：原始文件解析 → 合同判型 → 按类型字段提取...'
      appendAiParsingLog('开始调用 AI 提取接口（该步骤可能耗时较长）')
      const fieldOptionEntries = buildAiFieldOptionEntries()
      const targetFields = buildAiTargetFields()
      const optionPreviewText = buildAiOptionPreviewText(fieldOptionEntries)
      if (optionPreviewText) {
        appendAiParsingLog(`已准备下拉候选：${optionPreviewText}`)
        logger.info('AI field option entries prepared', {
          fieldCount: Object.keys(fieldOptionEntries).length,
          preview: optionPreviewText,
        })
      } else {
        appendAiParsingLog('未发现可用下拉候选（将按文本直接判定）')
        logger.info('AI field option entries empty')
      }
      const parsed = await withTimeout(
        window.electronAPI.ai.extractContractInfo({
          filePath: aiPath,
          fileId,
          // ipcRenderer.invoke 仅支持可结构化克隆的数据，避免把 Vue Proxy 直接跨进程传输
          schemaConfig: normalizeContractFormSchemaConfig(schemaConfig.value),
          preferredContractType: contractTypeContext.locked ? contractTypeContext.value : undefined,
          preferredContractTypeLabel: contractTypeContext.locked ? contractTypeContext.label : undefined,
          lockContractType: contractTypeContext.locked,
          contractTypeCandidates: contractTypeContext.locked
            ? [contractTypeContext.value]
            : contractTypeMergedOptions.value.map((item) => String(item.value || '').trim()).filter(Boolean),
          contractTypeCandidateEntries: contractTypeContext.locked
            ? [{ code: contractTypeContext.value, name: contractTypeContext.label || contractTypeContext.value }]
            : contractTypeMergedOptions.value
              .map((item) => ({
                code: String(item.value || '').trim(),
                name: String(item.label || item.value || '').trim(),
              }))
              .filter((item) => item.code || item.name),
          fieldOptionEntries,
          targetFields,
          retrievalMode: aiStore.mode === 'local' ? 'library-rag' : 'none',
          invocationSource: 'manual',
          modelStrategy: 'auto',
        }),
        AI_EXTRACT_TIMEOUT_MS,
        `AI 解析超时（>${Math.round(AI_EXTRACT_TIMEOUT_MS / 1000)} 秒），请检查模型服务状态或网络后重试`,
      )
      if (!parsed.success || !parsed.data) throw new Error(parsed.error || 'AI 解析失败')
      appendAiParsingLog('两阶段提取完成，准备回填结果')
      aiParsingStageText.value = '正在回填识别结果...'
      await applyContractExtractionResult(parsed.data, {
        lockedContractType: contractTypeContext.locked ? contractTypeContext.value : '',
        lockedContractTypeLabel: contractTypeContext.locked ? contractTypeContext.label : '',
      })
      const evidenceResult = await window.electronAPI.ai.getExtractionEvidence({ fileId })
      if (evidenceResult.success && evidenceResult.data) {
        aiExtractionEvidence.value = evidenceResult.data
        const summaryText = buildEvidenceSummaryText(evidenceResult.data)
        if (summaryText) {
          appendAiParsingLog('已读取证据摘要')
          summaryText.split('\n').forEach((line) => appendAiParsingLog(line))
        }
      }
      appendAiParsingLog('回填完成')
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      aiParsingError.value = errorMessage
      appendAiParsingLog(`发生错误：${errorMessage}`)
      logger.error('AI 解析失败', {
        stageText: aiParsingStageText.value,
        errorMessage,
        logs: aiParsingLogs.value,
      })
      toast.add({
        severity: 'error',
        summary: 'AI 解析失败',
        detail: `当前阶段：${aiParsingStageText.value || '未知阶段'}\n${errorMessage}`,
        life: 5000,
      })
    } finally {
      stopAiParsingHeartbeat()
      isParsingContract.value = false
      aiParsingStageText.value = ''
    }
  }

  /** 校验富文本内容是否包含有效文本。 */
  const normalizeRichTextValue = (value: string) => {
    return htmlToPlainText(String(value || '')) ? String(value || '') : ''
  }

  /** 校验并提交当前合同表单数据。 */
  const submit = async () => {
    try {
      if (!detailsEnabled.value) {
        toast.add({ severity: 'warn', summary: '请先选择合同类型', detail: '选择合同类型后再提交', life: 2500 })
        return
      }
      await ensureContractInfosLoaded()
      if (!validateForm() || !(form.signingDate instanceof Date)) {
        toast.add({ severity: 'error', summary: '校验失败', detail: '请检查必填项是否已填写正确', life: 3000 })
        return
      }

      await savePartyAUnitIfNeeded()
      await savePartyBUnitIfNeeded()

      const payloadBase: CreatePayload = {
        contractName: String(form.contractName || '').trim(),
        contractCode: String(form.contractCode || '').trim(),
        signingDate: formatDate(form.signingDate),
        contractType: String(form.contractType || '').trim(),
        groupName: String(form.groupName || '').trim(),
        currency: String(form.currency || '').trim(),
        contractAmount: form.contractAmount ?? null,
        contractStatus: String(form.contractStatus || '').trim() || undefined,
        department: normalizeTreeSelectSingleKey(form.department) || undefined,
        responsiblePerson: String(form.responsiblePerson || '').trim() || undefined,
        endDate: form.endDate instanceof Date ? formatDate(form.endDate) : undefined,
        settlementMethod: String(form.settlementMethod || '').trim() || undefined,
        signingForm: String(form.signingForm || '').trim() || undefined,
        procurementSource: String(form.procurementSource || '').trim() || undefined,
        executionMethod: String(form.executionMethod || '').trim() || undefined,
        clientName: String(form.clientName || '').trim(),
        partyAContact: String(form.partyAContact || '').trim() || undefined,
        partyAContactMobile: String(form.partyAContactMobile || '').trim() || undefined,
        partyAContactPhone: String(form.partyAContactPhone || '').trim() || undefined,
        partyAContactEmail: String(form.partyAContactEmail || '').trim() || undefined,
        partyAContactIdNumber: String(form.partyAContactIdNumber || '').trim() || undefined,
        partyBName: String(form.partyBName || '').trim(),
        partyBContact: String(form.partyBContact || '').trim() || undefined,
        partyBContactMobile: String(form.partyBContactMobile || '').trim() || undefined,
        partyBContactPhone: String(form.partyBContactPhone || '').trim() || undefined,
        partyBContactEmail: String(form.partyBContactEmail || '').trim() || undefined,
        partyBContactIdNumber: String(form.partyBContactIdNumber || '').trim() || undefined,
        contractSummary: normalizeStoredContractSummaryToMarkdown(form.contractSummary || ''),
        remark: String(form.remark || '').trim() || undefined,
        contractTags: Array.isArray(form.contractTags) ? [...form.contractTags] : [],
        extData: extractContractExtData(schema.value, form),
        projectIcon: String(form.projectIcon || 'pi pi-file-edit'),
        projectColor: normalizeProjectColor(String(form.projectColor || '#1d4ed8')),
      }

      if (options.mode.value === 'edit') {
        const id = String(options.initial.value?.id || '').trim()
        if (!id) return
        options.onConfirm({
          mode: 'edit',
          payload: { ...(payloadBase as any), id } as UpdatePayload,
          aiReceiptPlans: receiptPlanImportEnabled.value ? pendingAiReceiptPlans.value : [],
          aiReceiptPlanSyncToCalendar: receiptPlanSyncToCalendar.value,
          uploadedFile: uploadedContractFileForSave.value || undefined,
        })
      } else {
        options.onConfirm({
          mode: 'create',
          payload: payloadBase,
          aiReceiptPlans: receiptPlanImportEnabled.value ? pendingAiReceiptPlans.value : [],
          aiReceiptPlanSyncToCalendar: receiptPlanSyncToCalendar.value,
          uploadedFile: uploadedContractFileForSave.value || undefined,
        })
      }
    } catch (error: any) {
      logger.error('Submit contract error:', error)
      toast.add({
        severity: 'error',
        summary: options.mode.value === 'edit' ? '更新合同失败' : '新增合同失败',
        detail: error?.message || '发生未知错误，请重试',
        life: 4000,
      })
    }
  }

  return {
    toast,
    contractInfos,
    isParsingContract,
    aiParsingStageText,
    aiParsingElapsedText,
    aiParsingLogs,
    aiParsingError,
    aiExtractionEvidence,
    selectedContractFilePath,
    selectedContractFileName,
    groupedAiEvidence,
    stagedContractUpload,
    uploadedContractFileForSave,
    schemaConfig,
    schema,
    resolvedContractType,
    errors,
    activeTab,
    iconPopover,
    partyASelectRef,
    partyBSelectRef,
    form,
    contractGroupOptions,
    contractTypeOptionsFromDictionary,
    currencyOptions,
    contractStatusOptions,
    settlementMethodOptions,
    signingFormOptions,
    procurementSourceOptions,
    executionMethodOptions,
    receiptFrequencyOptions,
    departmentOptions,
    departmentTreeOptions,
    partyANameOptions,
    partyBNameOptions,
    partyAContactOptions,
    partyBContactOptions,
    schemaDrivenFieldOptions,
    schemaDrivenFieldTreeOptions,
    rawCustomers,
    rawSuppliers,
    contractTypeMergedOptions,
    hasSystemContractTypeOptions,
    extTabTitle,
    isAIEnabled,
    hasSelectedContractType,
    detailsEnabled,
    baseFields,
    extFields,
    contentFields,
    tabHasError,
    getFieldOptions,
    getFieldTreeOptions,
    updateFieldValue,
    onPartyAChange,
    onPartyBChange,
    toggleIconPopover,
    selectProjectIcon,
    handleParseContractByAI,
    pendingAiReceiptPlans,
    aiPartyAUnitForm,
    aiPartyBUnitForm,
    partyAUnitImportEnabled,
    partyBUnitImportEnabled,
    receiptPlanImportEnabled,
    receiptPlanSyncToCalendar,
    receiptPlanRowErrors,
    showPartyAUnitTab,
    showPartyBUnitTab,
    showReceiptPlanTab,
    aiInvoiceTypeOptions,
    isLastTab,
    primaryButtonLabel,
    handlePrimaryAction,
    validateCurrentTab,
    focusFieldByKey,
    highlightEvidenceText,
    formatEvidenceConfidence,
    handleSelectContractFile,
    submit,
    primeIcons,
    tailwind700Colors,
  }
}
