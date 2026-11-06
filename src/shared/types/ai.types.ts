import type { IpcResponse } from './ipc.types'
import type { ContractFormSchemaConfig } from './contractFormSchema.types'
import type { AIAgentSettings } from './aiAgent.types'

export type AIProvider = 'kimi' | 'minimax' | 'deepseek'
export type AIExecutionMode = 'cloud' | 'local'
export type AILocalRuntime = 'llama.cpp'
export type AIModelValueType = 'string' | 'number' | 'boolean' | 'object' | 'array'
export type AIPromptTaskType = 'contractTypeClassification' | 'contractFieldExtraction' | 'receiptPlanExtraction'
export type AIRetrievalMode = 'none' | 'library-rag'
export type AIModelStrategy = 'cloud-direct' | 'local-rag' | 'auto'
export type AILocalFieldGroupMode = 'grouped' | 'single-pass'

export interface AIPromptTemplateConfig {
  version: number
  updatedAt: string
  defaultTemplates: Record<AIPromptTaskType, string>
  contractTypeOverrides: Record<string, Partial<Record<AIPromptTaskType, string>>>
}

export interface AISettings {
  enabled: boolean
  mode: AIExecutionMode
  provider: AIProvider
  apiKey: string
  baseUrl: string
  selectedModelId: string
  localModels: AILocalModelConfig[]
  timeoutMs: number
  structuredOutput: boolean
  contractPrompt: string
  promptTemplates: AIPromptTemplateConfig
  agentSettings: AIAgentSettings
  ragEnabled: boolean
  embeddingModelPath: string
  embeddingExecutablePath: string
  embeddingDimension: number
  retrievalTopK: number
  retrievalScoreThreshold: number
  localSmallModelMaxContextChars: number
  localSmallModelFieldGroupMode: AILocalFieldGroupMode
}

export interface AILocalModelConfig {
  id: string
  displayName: string
  modelType: string
  runtime: AILocalRuntime
  modelPath: string
  executablePath: string
  contextSize: number
  maxTokens: number
  temperature: number
  timeoutMs: number
  extraArgs: string
}

export interface AIContractExtractionResult {
  contractName?: string
  contractCode?: string
  signingDate?: string
  contractType?: string
  clientName?: string
  partyBName?: string
  partyAContact?: string
  partyALegalRepName?: string
  partyALegalRepMobile?: string
  partyALegalRepEmail?: string
  partyALegalRepIdNumber?: string
  partyAPhone?: string
  partyAAddress?: string
  partyATaxNumber?: string
  partyABankName?: string
  partyABankAccount?: string
  partyAInvoiceType?: string
  partyBContact?: string
  partyBLegalRepName?: string
  partyBLegalRepMobile?: string
  partyBLegalRepEmail?: string
  partyBLegalRepIdNumber?: string
  partyBPhone?: string
  partyBAddress?: string
  partyBTaxNumber?: string
  partyBBankName?: string
  partyBBankAccount?: string
  partyBInvoiceType?: string
  contractSummary?: string
  resolvedContractType?: string
  contractTypeConfidence?: number
  contractTypeReason?: string
  extractedFields?: Record<string, unknown>
  receiptPlans?: AIExtractedReceiptPlan[]
  stages?: AIContractExtractionStageStatus[]
  ragMeta?: AIContractRagMeta
}

export interface AIContractRagMeta {
  enabled: boolean
  retrievedCount: number
  usedChunkIds: string[]
  strategy: AIModelStrategy
  truncationRecovered: boolean
}

export interface AIContractChunkRecord {
  id: number
  fileId: string
  filePath: string
  chunkId: string
  chunkIndex: number
  title: string
  sectionType: string
  importanceScore: number
  isNoise: boolean
  keywords: string[]
  content: string
  compactContent: string
  createdAt?: string
}

export interface AIContractFieldEvidenceRecord {
  id: number
  fileId: string
  fieldKey: string
  fieldValue: string
  chunkId: string
  chunkIndex: number
  evidenceText: string
  confidence?: number
  createdAt?: string
}

export interface AIContractExtractionEvidenceResult {
  chunks: AIContractChunkRecord[]
  evidence: AIContractFieldEvidenceRecord[]
}

export interface AIContractExtractionStageStatus {
  stage: 'classify' | 'extract' | 'receiptPlan'
  success: boolean
  message: string
}

export interface AIExtractedReceiptPlan {
  period?: string
  condition?: string
  ratio?: number
  amount?: number
  plannedDate?: string
  direction?: string
  planName?: string
  frequency?: string
  remark?: string
}

export interface AIExtractContractInfoRequest {
  filePath: string
  fileId?: string
  prompt?: string
  schemaConfig?: ContractFormSchemaConfig
  targetFields?: string[]
  preferredContractType?: string
  preferredContractTypeLabel?: string
  lockContractType?: boolean
  contractTypeCandidates?: string[]
  contractTypeCandidateEntries?: Array<{
    code: string
    name: string
  }>
  fieldOptionEntries?: Record<string, Array<{
    value: string
    label?: string
  }>>
  retrievalMode?: AIRetrievalMode
  invocationSource?: 'manual' | 'batch-import'
  modelStrategy?: AIModelStrategy
}

export interface AIStructuredFieldDefinition {
  key: string
  type: AIModelValueType
  description: string
  required?: boolean
}

export interface AIStructuredGenerateRequest {
  scene?: string
  prompt: string
  sourceText: string
  schema: AIStructuredFieldDefinition[]
  fileId?: string
}

export interface AIStructuredGenerateMeta {
  mode: AIExecutionMode
  provider?: AIProvider
  modelId?: string
  modelName?: string
  runtime?: AILocalRuntime
  elapsedMs: number
  rawText?: string
  timedOut?: boolean
}

export interface AIStructuredGenerateResult<T = Record<string, unknown>> {
  ok: boolean
  data?: T
  error?: string
  validationErrors?: string[]
  meta: AIStructuredGenerateMeta
}

export interface AILocalModelValidationRequest {
  localModel?: Partial<AILocalModelConfig>
}

export interface AILocalModelValidationResult {
  valid: boolean
  errors: string[]
  executableExists: boolean
  modelExists: boolean
  executablePath: string
  modelPath: string
}

export interface AITestConnectionRequest {
  mode: AIExecutionMode
  provider?: AIProvider
  apiKey?: string
  baseUrl?: string
  timeoutMs?: number
  localModel?: Partial<AILocalModelConfig>
}

export interface AITestConnectionResult {
  success: boolean
  message: string
  meta?: Partial<AIStructuredGenerateMeta>
}

export interface AIFsApi {
  extractContractInfo: (payload: AIExtractContractInfoRequest) => Promise<IpcResponse<AIContractExtractionResult>>
  getExtractionEvidence: (payload: { fileId: string }) => Promise<IpcResponse<AIContractExtractionEvidenceResult>>
  generateStructured: <T = Record<string, unknown>>(payload: AIStructuredGenerateRequest) => Promise<IpcResponse<AIStructuredGenerateResult<T>>>
  testConnection: (config: AITestConnectionRequest) => Promise<IpcResponse<AITestConnectionResult>>
  validateLocalModel: (payload: AILocalModelValidationRequest) => Promise<IpcResponse<AILocalModelValidationResult>>
  promoteContractVectors: (payload: { filePath: string; contractId: string }) => Promise<IpcResponse<{ success: boolean }>>
}
