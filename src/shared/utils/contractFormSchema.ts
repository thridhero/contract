import type {
  ContractBuiltinFieldKey,
  ContractExtData,
  ContractFieldDisplayTab,
  ContractFieldType,
  ContractFieldValue,
  ContractFieldOptionSource,
  ContractFieldOptionSourceType,
  ContractFormSchema,
  ContractFormSchemaConfig,
  ContractFormSchemaField,
  ContractFormSection,
} from '../types/contractFormSchema.types'
import {
  CONTRACT_BUILTIN_FIELD_KEYS,
  CONTRACT_FORM_SCHEMA_VERSION,
  DEFAULT_CONTRACT_TYPE_SCHEMA_KEY,
} from '../types/contractFormSchema.types'
import {
  CONTRACT_TYPE_SEED_ALIASES,
  CONTRACT_TYPE_SEEDS,
  CORE_REQUIRED_FIELDS,
  BUILTIN_FIELD_DEFINITIONS,
} from './contractFormSchemaSeeds'

/** 规范化合同类型对应的 schema 键名。 */
function normalizeContractTypeSchemaKey(value: unknown): string {
  const key = String(value || '').trim()
  if (!key || key === DEFAULT_CONTRACT_TYPE_SCHEMA_KEY) {
    return DEFAULT_CONTRACT_TYPE_SCHEMA_KEY
  }
  return CONTRACT_TYPE_SEED_ALIASES[key] || key
}

/** 判断字段 key 是否为内置字段。 */
export function isContractBuiltinFieldKey(value: string): value is ContractBuiltinFieldKey {
  return (CONTRACT_BUILTIN_FIELD_KEYS as readonly string[]).includes(value)
}

/** 获取默认的合同表单 schema。 */
export function getDefaultContractFormSchema(): ContractFormSchema {
  return {
    version: CONTRACT_FORM_SCHEMA_VERSION,
    fields: BUILTIN_FIELD_DEFINITIONS.map(field => ({
      ...field,
      options: field.options ? [...field.options] : undefined,
      optionSource: field.optionSource ? { ...field.optionSource } : undefined,
    })),
  }
}

/** 深拷贝字段定义，避免派生 schema 时污染来源配置。 */
function cloneContractFormSchemaField(field: ContractFormSchemaField): ContractFormSchemaField {
  return {
    ...field,
    options: field.options ? [...field.options] : undefined,
    optionSource: field.optionSource ? { ...field.optionSource } : undefined,
  }
}

/** 将默认 schema 与合同类型 schema 合并，合同类型配置优先覆盖同 key 字段。 */
function mergeContractFormSchemas(baseSchema: ContractFormSchema, overrideSchema: ContractFormSchema): ContractFormSchema {
  const base = normalizeContractFormSchema(baseSchema)
  const override = normalizeContractFormSchema(overrideSchema)
  const mergedFields = new Map<string, ContractFormSchemaField>()

  for (const field of base.fields) {
    mergedFields.set(field.key, cloneContractFormSchemaField(field))
  }
  for (const field of override.fields) {
    mergedFields.set(field.key, cloneContractFormSchemaField(field))
  }

  return normalizeContractFormSchema({
    version: CONTRACT_FORM_SCHEMA_VERSION,
    fields: Array.from(mergedFields.values()),
  })
}

/** 统一字段排序规则。 */
function sortContractSchemaFields(fields: ContractFormSchemaField[]): ContractFormSchemaField[] {
  return fields.sort((a, b) => {
    if (a.required !== b.required) return a.required ? -1 : 1
    if (a.order !== b.order) return a.order - b.order
    if (a.builtin !== b.builtin) return a.builtin ? -1 : 1
    return a.key.localeCompare(b.key, 'zh-CN')
  })
}

/** 基于指定默认 schema 生成各合同类型的派生 schema。 */
function buildContractTypeSchemas(baseSchema: ContractFormSchema): Record<string, ContractFormSchema> {
  const defaultSchema = {
    version: baseSchema.version,
    fields: sortContractSchemaFields(baseSchema.fields.map(cloneContractFormSchemaField)),
  }

  const createExtendedSchema = (extendedFields: Partial<ContractFormSchemaField>[]): ContractFormSchema => {
    const fields = defaultSchema.fields.map(cloneContractFormSchemaField)
    let currentOrder = fields.length > 0 ? fields[fields.length - 1].order + 10 : 10

    for (const ext of extendedFields) {
      fields.push({
        key: ext.key!,
        label: ext.label!,
        type: ext.type || 'text',
        section: ext.section || 'content',
        required: ext.required || false,
        visible: ext.visible !== false,
        order: currentOrder,
        span: ext.span || 1,
        placeholder: ext.placeholder,
        aiPrompt: ext.aiPrompt,
        options: ext.options,
        optionSource: ext.optionSource ? { ...ext.optionSource } : undefined,
        builtin: false,
        lockedVisible: false,
        lockedRequired: false,
        lockedKey: false,
        lockedType: false,
      })
      currentOrder += 10
    }

    return {
      version: CONTRACT_FORM_SCHEMA_VERSION,
      fields: sortContractSchemaFields(fields),
    }
  }

  const schemasByContractType: Record<string, ContractFormSchema> = {}
  for (const [typeKey, fields] of Object.entries(CONTRACT_TYPE_SEEDS)) {
    schemasByContractType[typeKey] = createExtendedSchema(fields)
  }

  return schemasByContractType
}

/** 获取默认的合同表单 schema 配置。 */
export function getDefaultContractFormSchemaConfig(baseSchema?: ContractFormSchema): ContractFormSchemaConfig {
  const defaultSchema = normalizeContractFormSchema(baseSchema || getDefaultContractFormSchema())

  return {
    version: CONTRACT_FORM_SCHEMA_VERSION,
    defaultSchema,
    schemasByContractType: buildContractTypeSchemas(defaultSchema),
  }
}

/** 规范化字段所属分区。 */
function normalizeSection(value: unknown, fallback: ContractFormSection): ContractFormSection {
  if (value === 'base' || value === 'content') {
    return value
  }
  return fallback
}

/** 规范化字段展示所属选项卡。 */
function normalizeDisplayTab(value: unknown, fallback: ContractFieldDisplayTab): ContractFieldDisplayTab {
  return value === 'default' || value === 'extended' ? value : fallback
}

/** 规范化字段类型。 */
function normalizeType(value: unknown, fallback: ContractFieldType): ContractFieldType {
  if (
    value === 'text'
    || value === 'textarea'
    || value === 'number'
    || value === 'date'
    || value === 'select'
    || value === 'multiselect'
    || value === 'tree'
    || value === 'richtext'
  ) {
    return value
  }
  return fallback
}

/** 规范化字段跨列宽度。 */
function normalizeSpan(value: unknown, fallback: 1 | 2): 1 | 2 {
  return value === 2 ? 2 : fallback
}

/** 规范化布尔配置值。 */
function normalizeBoolean(value: unknown, fallback: boolean): boolean {
  if (typeof value === 'boolean') return value
  return fallback
}

/** 规范化字段标签文本。 */
function normalizeLabel(value: unknown, fallback: string): string {
  const text = String(value ?? '').trim()
  return text || fallback
}

/** 规范化字段占位提示文本。 */
function normalizePlaceholder(value: unknown): string | undefined {
  const text = String(value ?? '').trim()
  return text || undefined
}

/** 规范化 AI 提示词文本。 */
function normalizeAiPrompt(value: unknown): string | undefined {
  const text = String(value ?? '').trim()
  return text || undefined
}

/** 规范化下拉选项列表并去重。 */
function normalizeOptions(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined
  const normalized = Array.from(new Set(value.map(item => String(item ?? '').trim()).filter(Boolean)))
  return normalized.length > 0 ? normalized : undefined
}

/** 规范化字段选项来源类型。 */
function normalizeOptionSourceType(value: unknown): ContractFieldOptionSourceType | null {
  if (
    value === 'manual'
    || value === 'dictionary'
    || value === 'treeDictionary'
    || value === 'partyAUnit'
    || value === 'partyBUnit'
  ) {
    return value
  }
  return null
}

/** 规范化字段选项来源配置。 */
function normalizeOptionSource(value: unknown): ContractFieldOptionSource | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined
  }
  const raw = value as Partial<ContractFieldOptionSource>
  const type = normalizeOptionSourceType(raw.type)
  const groupName = String(raw.groupName ?? '').trim()
  if (!type || type === 'manual' || !groupName) {
    return undefined
  }
  return {
    type,
    groupName,
  }
}

/** 规范化合同字段 key。 */
export function normalizeContractFieldKey(value: unknown): string {
  return String(value ?? '')
    .trim()
    .replace(/[^\w-]+/g, '_')
    .replace(/_{2,}/g, '_')
    .replace(/^_+|_+$/g, '')
    .toLowerCase()
}

/** 判断字段是否显示在默认字段页签。 */
export function isContractFieldInDefaultTab(field: Pick<ContractFormSchemaField, 'builtin' | 'displayTab'>): boolean {
  return Boolean(field.builtin) || field.displayTab === 'default'
}

/** 判断字段是否显示在拓展字段页签。 */
export function isContractFieldInExtendedTab(field: Pick<ContractFormSchemaField, 'builtin' | 'displayTab'>): boolean {
  return !isContractFieldInDefaultTab(field)
}

const LEGACY_REMOVED_FIELD_KEYS = new Set([
  'paymentdirection',
  'abnormaldescription',
  'startdate',
  'deliverydate',
  'maincontent',
])

const ALWAYS_OPTIONAL_BUILTIN_FIELDS = new Set<ContractBuiltinFieldKey>([
  'groupName',
  'currency',
])

/** 按内置字段定义规范化单个字段配置。 */
function normalizeBuiltinField(
  source: Partial<ContractFormSchemaField> | undefined,
  fallback: ContractFormSchemaField,
): ContractFormSchemaField {
  const required = ALWAYS_OPTIONAL_BUILTIN_FIELDS.has(fallback.key as ContractBuiltinFieldKey)
    ? false
    : (fallback.lockedRequired ? true : normalizeBoolean(source?.required, fallback.required))
  const visible = fallback.lockedVisible ? true : normalizeBoolean(source?.visible, fallback.visible)
  const type = fallback.lockedType ? fallback.type : normalizeType(source?.type, fallback.type)
  // Keep endDate in base section for all schemas to avoid showing it in "合同内容" from legacy config.
  const section = fallback.key === 'endDate'
    ? fallback.section
    : normalizeSection(source?.section, fallback.section)
  const optionSource = fallback.key === 'department'
    ? fallback.optionSource
    : normalizeOptionSource(source?.optionSource) ?? fallback.optionSource
  return {
    ...fallback,
    label: normalizeLabel(source?.label, fallback.label),
    type,
    section,
    displayTab: 'default',
    required,
    visible,
    order: Number.isFinite(Number(source?.order)) ? Number(source?.order) : fallback.order,
    span: normalizeSpan(source?.span, fallback.span),
    placeholder: normalizePlaceholder(source?.placeholder) ?? fallback.placeholder,
    aiPrompt: normalizeAiPrompt(source?.aiPrompt) ?? fallback.aiPrompt,
    options: normalizeOptions(source?.options) ?? fallback.options,
    optionSource,
  }
}

/** 规范化自定义字段配置。 */
function normalizeCustomField(
  source: Partial<ContractFormSchemaField>,
  fallbackOrder: number,
): ContractFormSchemaField | null {
  const key = normalizeContractFieldKey(source.key)
  if (!key || isContractBuiltinFieldKey(key)) {
    return null
  }
  if (LEGACY_REMOVED_FIELD_KEYS.has(key)) {
    return null
  }
  return {
    key,
    label: normalizeLabel(source.label, key),
    type: normalizeType(source.type, 'text'),
    section: normalizeSection(source.section, 'content'),
    displayTab: normalizeDisplayTab(source.displayTab, 'extended'),
    required: normalizeBoolean(source.required, false),
    visible: normalizeBoolean(source.visible, true),
    order: Number.isFinite(Number(source.order)) ? Number(source.order) : fallbackOrder,
    span: normalizeSpan(source.span, 1),
    placeholder: normalizePlaceholder(source.placeholder),
    aiPrompt: normalizeAiPrompt(source.aiPrompt),
    options: normalizeOptions(source.options),
    optionSource: normalizeOptionSource(source.optionSource),
    builtin: false,
    lockedVisible: false,
    lockedRequired: false,
    lockedKey: false,
    lockedType: false,
  }
}

/** 将任意输入规范化为标准合同表单 schema。 */
export function normalizeContractFormSchema(input: unknown): ContractFormSchema {
  const rawFields = Array.isArray(input)
    ? input
    : Array.isArray((input as ContractFormSchema | null | undefined)?.fields)
      ? (input as ContractFormSchema).fields
      : []

  const builtinSourceMap = new Map<string, Partial<ContractFormSchemaField>>()
  const customFieldsSource: Partial<ContractFormSchemaField>[] = []
  for (const rawField of rawFields) {
    if (!rawField || typeof rawField !== 'object') continue
    const field = rawField as Partial<ContractFormSchemaField>
    const key = String(field.key ?? '').trim()
    if (isContractBuiltinFieldKey(key)) {
      builtinSourceMap.set(key, field)
    } else {
      customFieldsSource.push(field)
    }
  }

  const builtinFields = BUILTIN_FIELD_DEFINITIONS.map(field => normalizeBuiltinField(builtinSourceMap.get(field.key), field))
  const customFields: ContractFormSchemaField[] = []
  const usedKeys = new Set<string>(builtinFields.map(field => field.key))
  for (let index = 0; index < customFieldsSource.length; index += 1) {
    const rawField = customFieldsSource[index]
    const normalizedField = normalizeCustomField(rawField, 1000 + index + 1)
    if (!normalizedField || usedKeys.has(normalizedField.key)) {
      continue
    }
    usedKeys.add(normalizedField.key)
    customFields.push(normalizedField)
  }

  const fields = [...builtinFields, ...customFields].sort((a, b) => {
    if (a.required !== b.required) return a.required ? -1 : 1
    if (a.order !== b.order) return a.order - b.order
    if (a.builtin !== b.builtin) return a.builtin ? -1 : 1
    return a.key.localeCompare(b.key, 'zh-CN')
  }).map((field, index) => ({
    ...field,
    order: (index + 1) * 10,
  }))

  return {
    version: CONTRACT_FORM_SCHEMA_VERSION,
    fields,
  }
}

/** 判断输入是否符合 schema 配置对象结构。 */
function isContractFormSchemaConfigLike(input: unknown): input is Partial<ContractFormSchemaConfig> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return false
  }
  return 'defaultSchema' in input || 'schemasByContractType' in input
}

/** 将任意输入规范化为标准合同表单 schema 配置。 */
export function normalizeContractFormSchemaConfig(input: unknown): ContractFormSchemaConfig {
  if (isContractFormSchemaConfigLike(input)) {
    const normalizedDefaultSchema = normalizeContractFormSchema(input.defaultSchema)
    const defaultConfig = getDefaultContractFormSchemaConfig(normalizedDefaultSchema)
    const rawSchemas = input.schemasByContractType
    const inputSchemas: Record<string, ContractFormSchema> = {}
    for (const [contractType, schema] of Object.entries(rawSchemas && typeof rawSchemas === 'object' ? rawSchemas : {})) {
      const normalizedContractType = normalizeContractTypeSchemaKey(contractType)
      if (!normalizedContractType || normalizedContractType === DEFAULT_CONTRACT_TYPE_SCHEMA_KEY) continue
      inputSchemas[normalizedContractType] = normalizeContractFormSchema(schema)
    }
    
    const mergedSchemas = { ...defaultConfig.schemasByContractType, ...inputSchemas }

    return {
      version: CONTRACT_FORM_SCHEMA_VERSION,
      defaultSchema: normalizedDefaultSchema,
      schemasByContractType: mergedSchemas,
    }
  }

  const normalizedDefaultSchema = normalizeContractFormSchema(input)
  const defaultConfig = getDefaultContractFormSchemaConfig(normalizedDefaultSchema)
  return {
    version: CONTRACT_FORM_SCHEMA_VERSION,
    defaultSchema: normalizedDefaultSchema,
    schemasByContractType: defaultConfig.schemasByContractType,
  }
}

/** 根据合同类型解析最终生效的表单 schema。 */
export function resolveContractFormSchema(
  input: ContractFormSchema | ContractFormSchemaConfig | unknown,
  contractType?: string | null,
): ContractFormSchema {
  const normalizedConfig = normalizeContractFormSchemaConfig(input)
  const contractTypeKey = normalizeContractTypeSchemaKey(contractType)
  if (contractTypeKey && normalizedConfig.schemasByContractType[contractTypeKey]) {
    return mergeContractFormSchemas(normalizedConfig.defaultSchema, normalizedConfig.schemasByContractType[contractTypeKey])
  }
  return normalizedConfig.defaultSchema
}

/** 获取所有已配置的合同类型 schema 键。 */
export function getContractTypeSchemaKeys(config: ContractFormSchemaConfig): string[] {
  return Object.keys(normalizeContractFormSchemaConfig(config).schemasByContractType)
    .sort((a, b) => a.localeCompare(b, 'zh-CN'))
}

/** 解析存储中的 schema 配置文本。 */
export function parseContractFormSchemaStorageValue(rawValue: unknown): ContractFormSchemaConfig {
  if (typeof rawValue !== 'string' || !rawValue.trim()) {
    return getDefaultContractFormSchemaConfig()
  }
  try {
    return normalizeContractFormSchemaConfig(JSON.parse(rawValue))
  } catch {
    return getDefaultContractFormSchemaConfig()
  }
}

/** 序列化合同表单 schema 配置。 */
export function serializeContractFormSchema(schema: ContractFormSchemaConfig | ContractFormSchema): string {
  return JSON.stringify(normalizeContractFormSchemaConfig(schema))
}

/** 生成合同类型对应的存储键。 */
export function getContractTypeSchemaStorageKey(contractType?: string | null): string {
  return normalizeContractTypeSchemaKey(contractType)
}

/** 按分区获取合同表单字段列表。 */
export function getContractFormFieldsBySection(
  schema: ContractFormSchema,
  section: ContractFormSection,
  includeHidden = false,
): ContractFormSchemaField[] {
  return normalizeContractFormSchema(schema).fields.filter(field => {
    if (field.section !== section) return false
    if (!includeHidden && !field.visible) return false
    return true
  })
}

/** 将富文本 HTML 转换为纯文本。 */
export function htmlToPlainText(value: string): string {
  return String(value || '')
    .replace(/<\s*br\s*\/?>/gi, '\n')
    .replace(/<\/p\s*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+\n/g, '\n')
    .replace(/\n\s+/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim()
}

/** 规范化日期值为 YYYY-MM-DD 文本。 */
function normalizeDateValue(value: unknown): string | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const year = value.getFullYear()
    const month = String(value.getMonth() + 1).padStart(2, '0')
    const day = String(value.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }
  const text = String(value ?? '').trim()
  return text || null
}

/** 按字段类型规范化字段值。 */
export function normalizeContractFieldValue(field: ContractFormSchemaField, value: unknown): ContractFieldValue {
  if (field.type === 'multiselect') {
    if (!Array.isArray(value)) return []
    return Array.from(new Set(value.map(item => String(item ?? '').trim()).filter(Boolean)))
  }
  if (field.type === 'number') {
    if (value === null || value === undefined || value === '') return null
    const numberValue = Number(value)
    return Number.isFinite(numberValue) ? numberValue : null
  }
  if (field.type === 'tree') {
    if (value === null || value === undefined || value === '') return null
    if (typeof value === 'object' && !Array.isArray(value)) {
      const keys = Object.keys(value as Record<string, unknown>)
        .filter((k) => Boolean((value as any)[k]))
        .map((k) => String(k || '').trim())
        .filter(Boolean)
      return keys.length > 0 ? keys[0] : null
    }
    const text = String(value ?? '').trim()
    return text || null
  }
  if (field.type === 'date') {
    return normalizeDateValue(value)
  }
  const text = String(value ?? '').trim()
  return text || null
}

/** 判断字段值是否为空。 */
export function isContractFieldEmpty(field: ContractFormSchemaField, value: unknown): boolean {
  const normalizedValue = normalizeContractFieldValue(field, value)
  if (field.type === 'multiselect') {
    return !Array.isArray(normalizedValue) || normalizedValue.length === 0
  }
  if (field.type === 'number') {
    return normalizedValue === null || normalizedValue === undefined
  }
  return String(normalizedValue ?? '').trim() === ''
}

/** 校验合同表单字段值并返回错误集合。 */
export function validateContractFormValues(
  schema: ContractFormSchema,
  values: Record<string, unknown>,
): Record<string, string> {
  const normalizedSchema = normalizeContractFormSchema(schema)
  const errors: Record<string, string> = {}

  for (const field of normalizedSchema.fields) {
    if (!field.visible || !field.required) continue
    if (isContractFieldEmpty(field, values[field.key])) {
      errors[field.key] = `${field.label}不能为空`
    }
  }

  const endDate = normalizeDateValue(values.endDate)

  return errors
}

/** 解析合同扩展字段数据。 */
export function parseContractExtData(rawValue: unknown): ContractExtData {
  if (!rawValue) return {}
  if (typeof rawValue === 'object' && !Array.isArray(rawValue)) {
    return { ...(rawValue as ContractExtData) }
  }
  if (typeof rawValue !== 'string' || !rawValue.trim()) return {}
  try {
    const parsed = JSON.parse(rawValue)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {}
    }
    return parsed as ContractExtData
  } catch {
    return {}
  }
}

/** 从表单值中提取扩展字段数据。 */
export function extractContractExtData(
  schema: ContractFormSchema,
  values: Record<string, unknown>,
): ContractExtData {
  const normalizedSchema = normalizeContractFormSchema(schema)
  const extData: ContractExtData = {}
  for (const field of normalizedSchema.fields) {
    if (field.builtin) continue
    const normalizedValue = normalizeContractFieldValue(field, values[field.key])
    const isEmpty = field.type === 'multiselect'
      ? !Array.isArray(normalizedValue) || normalizedValue.length === 0
      : normalizedValue === null || String(normalizedValue ?? '').trim() === ''
    if (!isEmpty) {
      extData[field.key] = normalizedValue
    }
  }
  return extData
}

/** 序列化合同扩展字段数据。 */
export function serializeContractExtData(extData: ContractExtData): string | null {
  const normalizedEntries = Object.entries(extData).filter(([, value]) => {
    if (Array.isArray(value)) return value.length > 0
    if (value === null || value === undefined) return false
    return String(value).trim() !== ''
  })
  if (normalizedEntries.length === 0) {
    return null
  }
  return JSON.stringify(Object.fromEntries(normalizedEntries))
}

/** 获取字段值的展示文本。 */
export function getContractFieldDisplayValue(field: ContractFormSchemaField, value: unknown): string {
  if (value === null || value === undefined) {
    return '-'
  }
  if (field.type === 'multiselect') {
    const list = Array.isArray(value) ? value.map(item => String(item ?? '').trim()).filter(Boolean) : []
    return list.length > 0 ? list.join('、') : '-'
  }
  if (field.type === 'number') {
    const numberValue = Number(value)
    return Number.isFinite(numberValue)
      ? numberValue.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })
      : '-'
  }
  if (field.type === 'richtext') {
    const text = htmlToPlainText(String(value ?? ''))
    return text || '-'
  }
  const text = String(value ?? '').trim()
  return text || '-'
}

/** 获取内置合同字段的显示名称。 */
export function getContractBuiltinFieldLabel(key: ContractBuiltinFieldKey): string {
  return BUILTIN_FIELD_DEFINITIONS.find(field => field.key === key)?.label || key
}

/** 获取合同核心必填字段集合。 */
export function getContractCoreRequiredFields(): Set<ContractBuiltinFieldKey> {
  return new Set(CORE_REQUIRED_FIELDS)
}
