import type {
  AIContractExtractionResult,
  AIExtractContractInfoRequest,
  AIExtractedReceiptPlan,
} from '../../../../../shared/types/ai.types'
import type {
  ContractFormSchema,
  ContractFormSchemaConfig,
  ContractFormSchemaField,
} from '../../../../../shared/types/contractFormSchema.types'
import type { ContractInfoCreateDTO, ContractInfoEntity } from '../../../../../shared/types/contractInfo.types'
import { IdGenerator } from '../../../../../shared/utils/idGenerator'
import {
  extractContractExtData,
  normalizeContractFormSchemaConfig,
  resolveContractFormSchema,
} from '../../../../../shared/utils/contractFormSchema'
import { normalizeStoredContractSummaryToMarkdown } from '../../../../utils/contractSummaryMarkdown'
import {
  buildFlatTreeNodes,
  buildIndentedTreeOptions,
  buildTreeNodes,
  formatDate,
  matchOptionValue,
  normalizeContractName,
  normalizeProjectColor,
  parseDateText,
  resolveSuggestedContractName,
  toSelectOptions,
  type SelectOption,
  type TreeNodeOption,
} from './createContractInfoModalUtils'

type FieldOptionEntry = { value: string; label?: string }

type SourceOptionCache = Map<string, { options: SelectOption[]; treeNodes: TreeNodeOption[] }>

export type BatchAiReceiptPlan = {
  plan_name: string
  direction: '收款' | '付款'
  receipt_frequency?: string
  ratio?: number
  expected_amount?: number
  expected_date?: string
  remark?: string
}

export type BatchImportPreparation = {
  schemaConfig: ContractFormSchemaConfig
  normalizedSchemaConfig: ContractFormSchemaConfig
  contractTypeOptions: SelectOption[]
  contractGroupOptions: SelectOption[]
  currencyOptions: SelectOption[]
  contractStatusOptions: SelectOption[]
  settlementMethodOptions: SelectOption[]
  signingFormOptions: SelectOption[]
  procurementSourceOptions: SelectOption[]
  executionMethodOptions: SelectOption[]
  sourceOptionCache: SourceOptionCache
  allFieldOptionEntries: Record<string, FieldOptionEntry[]>
  existingContractCodes: Set<string>
  existingContractNames: Set<string>
}

type QueryListResult<T> = {
  success: boolean
  data?: {
    data?: T[]
    items?: T[]
  }
  error?: string
}

const DEFAULT_PROJECT_ICON = 'pi pi-file-edit'
const DEFAULT_PROJECT_COLOR = '#1d4ed8'
const DEFAULT_BATCH_CONTRACT_STATUS_CODE = '005'
const STRONG_CONTRACT_KEYWORD_RE = /(合同|协议|合同书|协议书|补充协议|框架协议|意向书)/
const NON_CONTRACT_KEYWORD_RE = /(发票|收据|报价单|报价书|对账单|验收单|送货单|出库单|入库单|提货单|申请表|审批表|说明书|授权书|通知书|清单|投标文件|招标文件|中标通知书|付款单|请款单|订单|采购单|收货单|配送单)/

const toPlainJsonValue = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T

const readListData = <T>(result: QueryListResult<T> | null | undefined): T[] => {
  if (!result?.success || !result.data) return []
  const data = Array.isArray(result.data.data)
    ? result.data.data
    : (Array.isArray(result.data.items) ? result.data.items : [])
  return data as T[]
}

const trimText = (value: unknown) => String(value || '').trim()

const hasAnyKeyword = (values: unknown[], pattern: RegExp) => {
  return values.some((value) => {
    const text = trimText(value)
    return Boolean(text) && pattern.test(text)
  })
}

const countTruthy = (values: unknown[]) => values.filter(Boolean).length

const resolveUniqueCode = (preferredRaw: unknown, usedCodes: Set<string>) => {
  const preferred = trimText(preferredRaw).replace(/\s+/g, '')
  if (preferred && !usedCodes.has(preferred)) return preferred
  if (preferred && usedCodes.has(preferred)) {
    for (let i = 1; i <= 50; i += 1) {
      const candidate = `${preferred}-${String(i).padStart(2, '0')}`
      if (!usedCodes.has(candidate)) return candidate
    }
  }
  for (let i = 0; i < 100; i += 1) {
    const candidate = IdGenerator.generateCode('HT')
    if (!usedCodes.has(candidate)) return candidate
  }
  return `${IdGenerator.generateCode('HT')}-${Math.floor(Math.random() * 1000)}`
}

const resolveUniqueName = (preferredRaw: unknown, usedNames: Set<string>) => {
  const preferred = trimText(preferredRaw)
  const normalized = normalizeContractName(preferred)
  if (preferred && !usedNames.has(normalized)) return preferred
  const base = preferred || `合同-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}`
  for (let i = 1; i <= 200; i += 1) {
    const candidate = i === 1 && !preferred ? base : `${base}-${String(i).padStart(2, '0')}`
    const candidateKey = normalizeContractName(candidate)
    if (candidate && !usedNames.has(candidateKey)) return candidate
  }
  return `${base}-${Date.now()}`
}

const normalizeTextField = (rawValue: unknown) => trimText(rawValue)

const normalizeDateField = (rawValue: unknown) => {
  const date = parseDateText(trimText(rawValue))
  return date ? formatDate(date) : ''
}

const normalizeNumberField = (rawValue: unknown) => {
  const num = Number(rawValue)
  return Number.isFinite(num) ? num : null
}

const normalizeSelectField = (
  field: ContractFormSchemaField,
  rawValue: unknown,
  options: SelectOption[],
) => {
  const source = trimText(rawValue)
  if (!source) return field.type === 'tree' ? null : ''
  if (
    field.key === 'clientName'
    || field.key === 'partyBName'
    || field.key === 'partyAContact'
    || field.key === 'partyBContact'
    || field.key === 'responsiblePerson'
    || field.key === 'department'
  ) {
    return matchOptionValue(options, source) || source
  }
  if (options.length === 0) return ''
  return matchOptionValue(options, source) || ''
}

const normalizeMultiselectField = (rawValue: unknown, options: SelectOption[]) => {
  const list = Array.isArray(rawValue)
    ? rawValue.map((item) => trimText(item)).filter(Boolean)
    : trimText(rawValue).split(/[,，、]/).map((item) => item.trim()).filter(Boolean)
  if (list.length === 0) return []
  if (options.length === 0) return list
  return list
    .map((item) => matchOptionValue(options, item))
    .filter((item): item is string => Boolean(item))
}

const normalizeFieldValue = (
  field: ContractFormSchemaField,
  rawValue: unknown,
  options: SelectOption[],
) => {
  if (rawValue === undefined || rawValue === null || rawValue === '') return undefined
  if (field.type === 'number') return normalizeNumberField(rawValue)
  if (field.type === 'date') return normalizeDateField(rawValue)
  if (field.type === 'multiselect') return normalizeMultiselectField(rawValue, options)
  if (field.type === 'select' || field.type === 'tree') return normalizeSelectField(field, rawValue, options)
  return normalizeTextField(rawValue)
}

const resolveBatchDefaultContractStatus = (options: SelectOption[]) => {
  const preferred = DEFAULT_BATCH_CONTRACT_STATUS_CODE
  const byValue = options.find((item) => trimText(item.value) === preferred)
  if (byValue) return preferred
  const byLabel = options.find((item) => trimText(item.label).includes('草稿'))
  if (byLabel?.value) return trimText(byLabel.value)
  return preferred
}

const normalizeReceiptPlans = (items: AIExtractedReceiptPlan[] | undefined | null): BatchAiReceiptPlan[] => {
  const rows: BatchAiReceiptPlan[] = []
  const source = Array.isArray(items) ? items : []
  source.forEach((item, index) => {
    const rowNo = index + 1
    const planName = trimText(item.period || item.planName) || `第${rowNo}期`
    const direction = trimText(item.direction).includes('付') ? '付款' : '收款'
    const receipt_frequency = trimText((item as any).frequency || (item as any).receiptFrequency) || undefined
    const rawRatio = item.ratio
    const ratio = rawRatio === null || rawRatio === undefined || rawRatio === ''
      ? undefined
      : (Number.isFinite(Number(rawRatio)) && Number(rawRatio) >= 0 ? Number(rawRatio) : undefined)
    const rawAmount = item.amount
    const expectedAmount = rawAmount === null || rawAmount === undefined || rawAmount === ''
      ? undefined
      : (Number.isFinite(Number(rawAmount)) && Number(rawAmount) >= 0 ? Number(rawAmount) : undefined)
    const plannedDate = item.plannedDate ? normalizeDateField(item.plannedDate) : ''
    const remark = [trimText(item.condition), trimText(item.remark)].filter(Boolean).join('；')
    rows.push({
      plan_name: planName,
      direction,
      receipt_frequency,
      ratio,
      expected_amount: expectedAmount,
      expected_date: plannedDate || undefined,
      remark: remark || undefined,
    })
  })
  return rows.filter((item) => Boolean(item.plan_name))
}

const buildInlineFieldOptions = (field: ContractFormSchemaField): SelectOption[] => {
  if (!Array.isArray(field.options) || field.options.length === 0) return []
  return field.options
    .map((item) => trimText(item))
    .filter(Boolean)
    .map((item) => ({ label: item, value: item }))
}

const collectSchemaOptionSources = (schemaConfig: ContractFormSchemaConfig, contractTypeOptions: SelectOption[]) => {
  const keys = new Set<string>([''])
  contractTypeOptions.forEach((item) => {
    const value = trimText(item.value)
    if (value) keys.add(value)
  })
  const fields: ContractFormSchemaField[] = []
  keys.forEach((contractType) => {
    const schema = resolveContractFormSchema(schemaConfig, contractType)
    schema.fields.forEach((field) => {
      if (!field.builtin && field.optionSource?.groupName) {
        fields.push(field)
      }
    })
  })
  return Array.from(new Map(fields.map((field) => [`${field.optionSource?.type}:${field.optionSource?.groupName}`, field])).values())
}

const buildFieldOptionsBySchema = (
  schema: ContractFormSchema,
  preparation: BatchImportPreparation,
): Record<string, SelectOption[]> => {
  const optionMap: Record<string, SelectOption[]> = {}
  const builtinMap: Record<string, SelectOption[]> = {
    groupName: preparation.contractGroupOptions,
    currency: preparation.currencyOptions,
    contractStatus: preparation.contractStatusOptions,
    settlementMethod: preparation.settlementMethodOptions,
    signingForm: preparation.signingFormOptions,
    procurementSource: preparation.procurementSourceOptions,
    executionMethod: preparation.executionMethodOptions,
    contractType: preparation.contractTypeOptions,
  }

  schema.fields.forEach((field) => {
    if (builtinMap[field.key]) {
      optionMap[field.key] = builtinMap[field.key]
      return
    }
    const inlineOptions = buildInlineFieldOptions(field)
    if (inlineOptions.length > 0) {
      optionMap[field.key] = inlineOptions
      return
    }
    const source = field.optionSource
    if (!source?.groupName) {
      optionMap[field.key] = []
      return
    }
    const cacheKey = `${source.type}:${source.groupName}`
    optionMap[field.key] = preparation.sourceOptionCache.get(cacheKey)?.options ?? []
  })

  return optionMap
}

const buildAllFieldOptionEntries = (
  schemaConfig: ContractFormSchemaConfig,
  contractTypeOptions: SelectOption[],
  sourceOptionCache: SourceOptionCache,
): Record<string, FieldOptionEntry[]> => {
  const entries = new Map<string, FieldOptionEntry[]>()
  const keys = new Set<string>([''])
  contractTypeOptions.forEach((item) => {
    const value = trimText(item.value)
    if (value) keys.add(value)
  })

  keys.forEach((contractType) => {
    const schema = resolveContractFormSchema(schemaConfig, contractType)
    schema.fields.forEach((field) => {
      const cacheKey = field.optionSource?.groupName
        ? `${field.optionSource.type}:${field.optionSource.groupName}`
        : ''
      const options = cacheKey
        ? (sourceOptionCache.get(cacheKey)?.options ?? [])
        : buildInlineFieldOptions(field)
      if (options.length === 0) return
      const current = entries.get(field.key) ?? []
      const seen = new Set(current.map((item) => item.value))
      options.forEach((option) => {
        if (seen.has(option.value)) return
        current.push({ value: option.value, label: option.label })
        seen.add(option.value)
      })
      entries.set(field.key, current)
    })
  })

  return Object.fromEntries(entries)
}

export const loadBatchImportPreparation = async (libraryPath: string): Promise<BatchImportPreparation> => {
  const [
    schemaRes,
    contractInfosRes,
    contractGroupRes,
    contractTypeRes,
    currencyRes,
    contractStatusRes,
    settlementMethodRes,
    signingFormRes,
    procurementSourceRes,
    executionMethodRes,
    customerRes,
    supplierRes,
  ] = await Promise.all([
    window.electronAPI.library.getContractFormSchema({ libraryPath }),
    window.electronAPI.library.getContractInfos(libraryPath),
    window.electronAPI.dictionary.getList({ group_name: '合同分组', page: 1, pageSize: 1000 }),
    window.electronAPI.dictionary.getList({ group_name: '合同类型', page: 1, pageSize: 1000 }),
    window.electronAPI.dictionary.getList({ group_name: '币种', page: 1, pageSize: 1000 }),
    window.electronAPI.dictionary.getList({ group_name: '合同状态', page: 1, pageSize: 1000 }),
    window.electronAPI.dictionary.getList({ group_name: '结算方式', page: 1, pageSize: 1000 }),
    window.electronAPI.dictionary.getList({ group_name: '订立形式', page: 1, pageSize: 1000 }),
    window.electronAPI.dictionary.getList({ group_name: '合同采购来源', page: 1, pageSize: 1000 }),
    window.electronAPI.dictionary.getList({ group_name: '合同执行方式', page: 1, pageSize: 1000 }),
    window.electronAPI.customer.getList({ page: 1, pageSize: 1000 }),
    window.electronAPI.supplier.getList({ page: 1, pageSize: 1000 }),
  ])

  if (!schemaRes.success || !schemaRes.data) {
    throw new Error(schemaRes.error || '读取合同表单配置失败')
  }

  const schemaConfig = schemaRes.data
  const normalizedSchemaConfig = normalizeContractFormSchemaConfig(schemaConfig)
  const contractTypeOptions = toSelectOptions(readListData(contractTypeRes as QueryListResult<{ name: string; value?: string | null }>))
  if (contractTypeOptions.length === 0) {
    throw new Error('请先在系统字典中维护“合同类型”')
  }

  const rawCustomers = readListData(customerRes as QueryListResult<{ name?: string; client_name?: string }>)
  const rawSuppliers = readListData(supplierRes as QueryListResult<{ name?: string }>)
  const optionSourceFields = collectSchemaOptionSources(normalizedSchemaConfig, contractTypeOptions)
  const partyAUnitOptions = rawCustomers
    .map((item) => {
      const value = trimText((item as any).name || (item as any).client_name)
      return value ? { label: value, value } : null
    })
    .filter((item): item is SelectOption => Boolean(item))
  const partyBUnitOptions = rawSuppliers
    .map((item) => {
      const value = trimText((item as any).name)
      return value ? { label: value, value } : null
    })
    .filter((item): item is SelectOption => Boolean(item))
  const sourceOptionCache: SourceOptionCache = new Map()
  optionSourceFields.forEach((field) => {
    const source = field.optionSource
    if (!source?.groupName) return
    const cacheKey = `${source.type}:${source.groupName}`
    if (source.type === 'partyAUnit') {
      sourceOptionCache.set(cacheKey, {
        options: partyAUnitOptions,
        treeNodes: buildFlatTreeNodes(partyAUnitOptions),
      })
      return
    }
    if (source.type === 'partyBUnit') {
      sourceOptionCache.set(cacheKey, {
        options: partyBUnitOptions,
        treeNodes: buildFlatTreeNodes(partyBUnitOptions),
      })
    }
  })
  const remoteSources = optionSourceFields.filter((field) => {
    const source = field.optionSource
    if (!source?.groupName) return false
    if (source.type === 'partyAUnit' || source.type === 'partyBUnit') return false
    return !sourceOptionCache.has(`${source.type}:${source.groupName}`)
  })

  const sourceResults = await Promise.all(
    remoteSources.map(async (field) => {
      const source = field.optionSource!
      const cacheKey = `${source.type}:${source.groupName}`
      if (source.type === 'treeDictionary') {
        const result = await window.electronAPI.treeDictionary.getList({ group_name: source.groupName, page: 1, pageSize: 1000 })
        const items = readListData(result as QueryListResult<{ id: string; parent_id: string; name: string; value?: string | null }>)
        return {
          cacheKey,
          options: buildIndentedTreeOptions(items.map((item) => ({
            id: trimText(item.id),
            parent_id: trimText(item.parent_id),
            name: trimText(item.name),
            value: trimText(item.value),
          }))),
          treeNodes: buildTreeNodes(items.map((item) => ({
            id: trimText(item.id),
            parent_id: trimText(item.parent_id),
            name: trimText(item.name),
            value: trimText(item.value),
          }))),
        }
      }

      const result = await window.electronAPI.dictionary.getList({ group_name: source.groupName, page: 1, pageSize: 1000 })
      const items = readListData(result as QueryListResult<{ name: string; value?: string | null }>)
      const options = toSelectOptions(items)
      return {
        cacheKey,
        options,
        treeNodes: buildFlatTreeNodes(options),
      }
    }),
  )

  sourceResults.forEach((item) => {
    sourceOptionCache.set(item.cacheKey, { options: item.options, treeNodes: item.treeNodes })
  })

  const contractInfos = Array.isArray(contractInfosRes.data) ? contractInfosRes.data : []
  const existingContractCodes = new Set(contractInfos.map((item: ContractInfoEntity) => trimText(item.contract_code)).filter(Boolean))
  const existingContractNames = new Set(contractInfos.map((item: ContractInfoEntity) => normalizeContractName(trimText(item.contract_name))).filter(Boolean))

  return {
    schemaConfig,
    normalizedSchemaConfig,
    contractTypeOptions,
    contractGroupOptions: toSelectOptions(readListData(contractGroupRes as QueryListResult<{ name: string; value?: string | null }>)),
    currencyOptions: toSelectOptions(readListData(currencyRes as QueryListResult<{ name: string; value?: string | null }>)),
    contractStatusOptions: toSelectOptions(readListData(contractStatusRes as QueryListResult<{ name: string; value?: string | null }>)),
    settlementMethodOptions: toSelectOptions(readListData(settlementMethodRes as QueryListResult<{ name: string; value?: string | null }>)),
    signingFormOptions: toSelectOptions(readListData(signingFormRes as QueryListResult<{ name: string; value?: string | null }>)),
    procurementSourceOptions: toSelectOptions(readListData(procurementSourceRes as QueryListResult<{ name: string; value?: string | null }>)),
    executionMethodOptions: toSelectOptions(readListData(executionMethodRes as QueryListResult<{ name: string; value?: string | null }>)),
    sourceOptionCache,
    allFieldOptionEntries: buildAllFieldOptionEntries(normalizedSchemaConfig, contractTypeOptions, sourceOptionCache),
    existingContractCodes,
    existingContractNames,
  }
}

export const buildBatchAiRequest = (
  filePath: string,
  fileId: string,
  preparation: BatchImportPreparation,
): AIExtractContractInfoRequest => {
  return {
    filePath,
    fileId,
    // Electron IPC cannot clone Vue proxy objects, so sanitize nested config payloads.
    schemaConfig: toPlainJsonValue(preparation.normalizedSchemaConfig),
    contractTypeCandidates: preparation.contractTypeOptions.map((item) => item.value).filter(Boolean),
    contractTypeCandidateEntries: preparation.contractTypeOptions.map((item) => ({
      code: item.value,
      name: item.label || item.value,
    })),
    fieldOptionEntries: toPlainJsonValue(preparation.allFieldOptionEntries),
    retrievalMode: 'library-rag',
    invocationSource: 'batch-import',
    modelStrategy: 'auto',
  }
}

export const assertBatchImportContractCandidate = (
  result: AIContractExtractionResult,
  fileName: string,
  preparation: BatchImportPreparation,
) => {
  const preferredContractType = trimText(result.resolvedContractType || result.contractType)
  const matchedContractType = matchOptionValue(preparation.contractTypeOptions, preferredContractType)
  if (!matchedContractType) {
    throw new Error(preferredContractType ? `合同类型未命中字典：${preferredContractType}` : 'AI 未能识别有效合同类型')
  }

  const contractName = trimText(resolveSuggestedContractName(result, preparation.contractTypeOptions) || result.contractName)
  const contractSummary = trimText(result.contractSummary)
  const clientName = trimText(result.clientName)
  const partyBName = trimText(result.partyBName)
  const contractCode = trimText(result.contractCode)
  const signingDate = normalizeDateField(result.signingDate)
  const confidenceValue = Number(result.contractTypeConfidence)
  const confidence = Number.isFinite(confidenceValue) ? confidenceValue : undefined
  const keywordSources = [
    fileName,
    contractName,
    contractSummary,
    trimText(result.contractType),
    trimText(result.resolvedContractType),
    trimText(result.contractTypeReason),
  ]
  const hasStrongContractKeyword = hasAnyKeyword(keywordSources, STRONG_CONTRACT_KEYWORD_RE)
  const hasNonContractKeyword = hasAnyKeyword(keywordSources, NON_CONTRACT_KEYWORD_RE)
  const hasBothParties = Boolean(clientName && partyBName)
  const evidenceCount = countTruthy([
    matchedContractType,
    clientName,
    partyBName,
    contractCode,
    signingDate,
    contractSummary.length >= 24 ? contractSummary : '',
  ])

  if (confidence !== undefined && confidence < 0.35 && !hasStrongContractKeyword) {
    throw new Error(`AI 判型置信度过低（${(confidence * 100).toFixed(1)}%），疑似非合同文件`)
  }

  if (hasNonContractKeyword && !hasStrongContractKeyword && !hasBothParties) {
    throw new Error('识别结果更像发票、清单、申请单等非合同文件，已跳过入库')
  }

  if (!hasStrongContractKeyword && !hasBothParties && evidenceCount < 4) {
    throw new Error('缺少合同标题、甲乙方、编号、日期等关键信息，疑似非合同文件')
  }
}

export const buildBatchCreatePayload = (
  result: AIContractExtractionResult,
  preparation: BatchImportPreparation,
): {
  payload: Omit<ContractInfoCreateDTO, 'libraryPath'>
  aiReceiptPlans: BatchAiReceiptPlan[]
} => {
  const defaultContractStatus = resolveBatchDefaultContractStatus(preparation.contractStatusOptions)
  const extractedFields = result.extractedFields && typeof result.extractedFields === 'object'
    ? result.extractedFields as Record<string, unknown>
    : {}

  const preferredContractType = trimText(result.resolvedContractType || result.contractType)
  const matchedContractType = matchOptionValue(preparation.contractTypeOptions, preferredContractType)
  if (!matchedContractType) {
    throw new Error(preferredContractType ? `合同类型未命中字典：${preferredContractType}` : 'AI 未能识别有效合同类型')
  }

  const schema = resolveContractFormSchema(preparation.normalizedSchemaConfig, matchedContractType)
  const fieldOptionsByKey = buildFieldOptionsBySchema(schema, preparation)

  const values: Record<string, unknown> = {
    contractType: matchedContractType,
    contractName: resolveUniqueName(resolveSuggestedContractName(result, preparation.contractTypeOptions), preparation.existingContractNames),
    contractCode: resolveUniqueCode(result.contractCode, preparation.existingContractCodes),
    signingDate: normalizeDateField(result.signingDate),
    clientName: trimText(result.clientName),
    partyBName: trimText(result.partyBName),
    contractSummary: normalizeStoredContractSummaryToMarkdown(trimText(result.contractSummary)),
    groupName: '',
    currency: matchOptionValue(preparation.currencyOptions, trimText(extractedFields.currency)) || '',
    contractStatus: defaultContractStatus,
    department: '',
    responsiblePerson: '',
    endDate: normalizeDateField(extractedFields.endDate),
    settlementMethod: matchOptionValue(preparation.settlementMethodOptions, trimText(extractedFields.settlementMethod)) || '',
    signingForm: matchOptionValue(preparation.signingFormOptions, trimText(extractedFields.signingForm)) || '',
    procurementSource: matchOptionValue(preparation.procurementSourceOptions, trimText(extractedFields.procurementSource)) || '',
    executionMethod: matchOptionValue(preparation.executionMethodOptions, trimText(extractedFields.executionMethod)) || '',
    contractAmount: normalizeNumberField(extractedFields.contractAmount),
    remark: trimText(extractedFields.remark),
    partyAContact: trimText(extractedFields.partyAContact),
    partyAContactMobile: trimText(extractedFields.partyAContactMobile || extractedFields.partyALegalRepMobile),
    partyAContactPhone: trimText(extractedFields.partyAContactPhone || extractedFields.partyAPhone),
    partyAContactEmail: trimText(extractedFields.partyAContactEmail || extractedFields.partyALegalRepEmail),
    partyAContactIdNumber: trimText(extractedFields.partyAContactIdNumber || extractedFields.partyALegalRepIdNumber),
    partyBContact: trimText(extractedFields.partyBContact),
    partyBContactMobile: trimText(extractedFields.partyBContactMobile || extractedFields.partyBLegalRepMobile),
    partyBContactPhone: trimText(extractedFields.partyBContactPhone || extractedFields.partyBPhone),
    partyBContactEmail: trimText(extractedFields.partyBContactEmail || extractedFields.partyBLegalRepEmail),
    partyBContactIdNumber: trimText(extractedFields.partyBContactIdNumber || extractedFields.partyBLegalRepIdNumber),
  }

  schema.fields.forEach((field) => {
    if (field.key === 'contractType') return
    if (!Object.prototype.hasOwnProperty.call(extractedFields, field.key)) return
    const normalizedValue = normalizeFieldValue(field, extractedFields[field.key], fieldOptionsByKey[field.key] || [])
    if (normalizedValue === undefined) return
    values[field.key] = normalizedValue
  })

  const payload: Omit<ContractInfoCreateDTO, 'libraryPath'> = {
    contractName: trimText(values.contractName),
    contractCode: trimText(values.contractCode),
    signingDate: trimText(values.signingDate),
    contractType: matchedContractType,
    groupName: trimText(values.groupName),
    currency: trimText(values.currency),
    clientName: trimText(values.clientName),
    partyAPhone: trimText(result.partyAPhone) || undefined,
    partyAAddress: trimText(result.partyAAddress) || undefined,
    partyATaxNumber: trimText(result.partyATaxNumber) || undefined,
    partyABankName: trimText(result.partyABankName) || undefined,
    partyABankAccount: trimText(result.partyABankAccount) || undefined,
    partyAInvoiceType: trimText(result.partyAInvoiceType) || undefined,
    partyAContact: trimText(values.partyAContact) || undefined,
    partyAContactMobile: trimText(values.partyAContactMobile) || undefined,
    partyAContactPhone: trimText(values.partyAContactPhone) || undefined,
    partyAContactEmail: trimText(values.partyAContactEmail) || undefined,
    partyAContactIdNumber: trimText(values.partyAContactIdNumber) || undefined,
    partyBName: trimText(values.partyBName),
    partyBPhone: trimText(result.partyBPhone) || undefined,
    partyBAddress: trimText(result.partyBAddress) || undefined,
    partyBTaxNumber: trimText(result.partyBTaxNumber) || undefined,
    partyBBankName: trimText(result.partyBBankName) || undefined,
    partyBBankAccount: trimText(result.partyBBankAccount) || undefined,
    partyBInvoiceType: trimText(result.partyBInvoiceType) || undefined,
    partyBLegalRepName: trimText(result.partyBLegalRepName) || undefined,
    partyBLegalRepMobile: trimText(result.partyBLegalRepMobile) || undefined,
    partyBLegalRepEmail: trimText(result.partyBLegalRepEmail) || undefined,
    partyBLegalRepIdNumber: trimText(result.partyBLegalRepIdNumber) || undefined,
    partyBContact: trimText(values.partyBContact) || undefined,
    partyBContactMobile: trimText(values.partyBContactMobile) || undefined,
    partyBContactPhone: trimText(values.partyBContactPhone) || undefined,
    partyBContactEmail: trimText(values.partyBContactEmail) || undefined,
    partyBContactIdNumber: trimText(values.partyBContactIdNumber) || undefined,
    contractSummary: normalizeStoredContractSummaryToMarkdown(trimText(values.contractSummary)),
    contractAmount: values.contractAmount === null ? null : normalizeNumberField(values.contractAmount),
    contractStatus: trimText(values.contractStatus) || DEFAULT_BATCH_CONTRACT_STATUS_CODE,
    department: trimText(values.department) || undefined,
    responsiblePerson: trimText(values.responsiblePerson) || undefined,
    endDate: trimText(values.endDate) || undefined,
    settlementMethod: trimText(values.settlementMethod) || undefined,
    signingForm: trimText(values.signingForm) || undefined,
    procurementSource: trimText(values.procurementSource) || undefined,
    executionMethod: trimText(values.executionMethod) || undefined,
    remark: trimText(values.remark) || undefined,
    contractTags: [],
    extData: extractContractExtData(schema, values),
    projectIcon: DEFAULT_PROJECT_ICON,
    projectColor: normalizeProjectColor(DEFAULT_PROJECT_COLOR),
  }

  return {
    payload,
    aiReceiptPlans: normalizeReceiptPlans(result.receiptPlans),
  }
}

export const reserveBatchPayloadIdentity = (
  payload: Omit<ContractInfoCreateDTO, 'libraryPath'>,
  preparation: BatchImportPreparation,
) => {
  const contractCode = trimText(payload.contractCode)
  const contractName = normalizeContractName(trimText(payload.contractName))
  if (contractCode) preparation.existingContractCodes.add(contractCode)
  if (contractName) preparation.existingContractNames.add(contractName)
}
