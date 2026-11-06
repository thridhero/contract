export const CONTRACT_FORM_SCHEMA_VERSION = 1
export const DEFAULT_CONTRACT_TYPE_SCHEMA_KEY = '__default__'

export type ContractFormSection = 'base' | 'content'
export type ContractFieldDisplayTab = 'default' | 'extended'

export type ContractFieldType =
  | 'text'
  | 'textarea'
  | 'number'
  | 'date'
  | 'select'
  | 'multiselect'
  | 'tree'
  | 'richtext'

export type ContractFieldOptionSourceType = 'manual' | 'dictionary' | 'treeDictionary' | 'partyAUnit' | 'partyBUnit'

export interface ContractFieldOptionSource {
  type: ContractFieldOptionSourceType
  groupName: string
}

export const CONTRACT_BUILTIN_FIELD_KEYS = [
  'contractName',
  'contractCode',
  'clientName',
  'partyAContact',
  'partyAContactMobile',
  'partyAContactPhone',
  'partyAContactEmail',
  'partyAContactIdNumber',
  'partyBName',
  'partyBContact',
  'partyBContactMobile',
  'partyBContactPhone',
  'partyBContactEmail',
  'partyBContactIdNumber',
  'groupName',
  'contractType',
  'signingDate',
  'currency',
  'contractAmount',
  'contractStatus',
  'department',
  'responsiblePerson',
  'endDate',
  'settlementMethod',
  'signingForm',
  'procurementSource',
  'executionMethod',
  'contractSummary',
  'remark',
  'contractTags',
] as const

export type ContractBuiltinFieldKey = typeof CONTRACT_BUILTIN_FIELD_KEYS[number]

export type ContractFieldValue = string | number | string[] | null

export type ContractExtData = Record<string, ContractFieldValue>

export interface ContractFormSchemaField {
  key: string
  label: string
  type: ContractFieldType
  section: ContractFormSection
  displayTab?: ContractFieldDisplayTab
  required: boolean
  visible: boolean
  order: number
  span: 1 | 2
  placeholder?: string
  aiPrompt?: string
  options?: string[]
  optionSource?: ContractFieldOptionSource
  builtin?: boolean
  lockedVisible?: boolean
  lockedRequired?: boolean
  lockedKey?: boolean
  lockedType?: boolean
}

export interface ContractFormSchema {
  version: number
  fields: ContractFormSchemaField[]
}

export interface ContractFormSchemaConfig {
  version: number
  defaultSchema: ContractFormSchema
  schemasByContractType: Record<string, ContractFormSchema>
}

export interface ContractFormSchemaGetDTO {
  libraryPath: string
}

export interface ContractFormSchemaSaveDTO {
  libraryPath: string
  schema: ContractFormSchemaConfig
}

export interface ContractFormSchemaExportDTO {
  libraryPath: string
  filePath: string
}

export interface ContractFormSchemaImportDTO {
  libraryPath: string
  filePath: string
}

export interface ContractFormSchemaExportResult {
  filePath: string
}
