import type {
  ContractFieldOptionSource,
  ContractFieldType,
  ContractFormSection,
} from './contractFormSchema.types'

export const CONTRACT_SCAN_SAMPLE_FOUNDATION_VERSION = 1
export const CONTRACT_SCAN_SAMPLE_PLAN_VERSION = 1

export type ContractScanSampleFieldDomain =
  | 'builtin'
  | 'contractType'
  | 'partyBUnit'
  | 'partyBContact'
  | 'receiptPlan'

export type ContractScanSampleCoverageLevel =
  | 'at_least_once'
  | 'contract_type_key_field'
  | 'scenario_required'

export type ContractScanSampleTruthExpectation =
  | 'must_hit'
  | 'optional_hit'
  | 'manual_fill_allowed'

export type ContractScanReceiptPlanScenario =
  | 'single_installment'
  | 'double_installment'
  | 'multi_installment'

export interface ContractScanSampleFieldMatrixItem {
  key: string
  label: string
  domain: ContractScanSampleFieldDomain
  fieldType: ContractFieldType
  required: boolean
  coverageLevel: ContractScanSampleCoverageLevel
  defaultTruthExpectation: ContractScanSampleTruthExpectation
  section?: ContractFormSection
  contractTypeKey?: string
  contractTypeLabel?: string
  mappedFormFieldKeys?: string[]
  options?: string[]
  optionSource?: ContractFieldOptionSource
  notes?: string
}

export interface ContractScanSampleContractTypeFieldGroup {
  contractTypeKey: string
  contractTypeLabel: string
  aliasLabels: string[]
  fields: ContractScanSampleFieldMatrixItem[]
}

export interface ContractScanSampleReceiptPlanMatrix {
  fields: ContractScanSampleFieldMatrixItem[]
  requiredScenarios: ContractScanReceiptPlanScenario[]
}

export interface ContractScanSampleFoundation {
  version: number
  builtinFields: ContractScanSampleFieldMatrixItem[]
  contractTypeGroups: ContractScanSampleContractTypeFieldGroup[]
  partyBUnitFields: ContractScanSampleFieldMatrixItem[]
  partyBContactFields: ContractScanSampleFieldMatrixItem[]
  receiptPlan: ContractScanSampleReceiptPlanMatrix
}

export interface ContractScanSampleGroundTruthFieldValue<T = unknown> {
  value: T | null
  expectation: ContractScanSampleTruthExpectation
  notes?: string
}

export type ContractScanSampleGroundTruthFieldMap = Record<string, ContractScanSampleGroundTruthFieldValue>

export interface ContractScanSampleReceiptPlanGroundTruthItem {
  scenario?: ContractScanReceiptPlanScenario
  fields: ContractScanSampleGroundTruthFieldMap
}

export interface ContractScanSampleGroundTruth {
  sampleId: string
  contractTypeKey: string
  contractTypeLabel: string
  fileName: string
  builtinFields: ContractScanSampleGroundTruthFieldMap
  extFields: ContractScanSampleGroundTruthFieldMap
  partyBUnit: ContractScanSampleGroundTruthFieldMap
  partyBContacts: ContractScanSampleGroundTruthFieldMap[]
  receiptPlans: ContractScanSampleReceiptPlanGroundTruthItem[]
  notes: string[]
}

export type ContractScanSampleDocumentExtension = 'md' | 'pdf' | 'docx' | 'png'

export interface ContractScanSampleDistributionItem {
  contractTypeKey: string
  contractTypeLabel: string
  typeCode: string
  count: number
  notes?: string
}

export interface ContractScanSampleFileNameRule {
  pattern: string
  defaultExtension: ContractScanSampleDocumentExtension
  allowedExtensions: ContractScanSampleDocumentExtension[]
  example: string
  notes?: string[]
}

export interface ContractScanSampleTemplateFieldValue<T = unknown> {
  value: T | null
  expectation?: ContractScanSampleTruthExpectation
  notes?: string
}

export type ContractScanSampleTemplateFieldMap = Record<string, ContractScanSampleTemplateFieldValue>

export interface ContractScanSampleTemplatePartyBContact {
  fields: ContractScanSampleTemplateFieldMap
}

export interface ContractScanSampleTemplateReceiptPlan {
  scenario: ContractScanReceiptPlanScenario
  fields: ContractScanSampleTemplateFieldMap
}

export interface ContractScanSampleTruthTemplate {
  builtinFields?: ContractScanSampleTemplateFieldMap
  extFields?: ContractScanSampleTemplateFieldMap
  partyBUnit?: ContractScanSampleTemplateFieldMap
  partyBContacts?: ContractScanSampleTemplatePartyBContact[]
  receiptPlans?: ContractScanSampleTemplateReceiptPlan[]
  notes?: string[]
}

export interface ContractScanSampleBlueprint {
  sampleId: string
  contractTypeKey: string
  contractTypeLabel: string
  typeCode: string
  sequence: number
  variantKey: string
  variantLabel: string
  fileBaseName: string
  fileName: string
  receiptPlanScenario: ContractScanReceiptPlanScenario
  truthTemplate: ContractScanSampleTruthTemplate
}

export interface ContractScanSampleResolvedBlueprint extends ContractScanSampleBlueprint {
  truth: ContractScanSampleGroundTruth
}

export interface ContractScanSampleGenerationEntrypoint {
  version: number
  outputRootDir: string
  fileNameRule: ContractScanSampleFileNameRule
  distributions: ContractScanSampleDistributionItem[]
  samples: ContractScanSampleResolvedBlueprint[]
}

export interface ContractScanSamplePlanCatalog extends ContractScanSampleGenerationEntrypoint {
  totalSamples: number
}
