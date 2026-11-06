export type ContractStatisticsSource = 'contract'
export type ContractStatisticsIntent = 'aggregation' | 'detail'
export type ContractStatisticsColumnKind = 'field' | 'metric'
export type ContractStatisticsMetricFunction = 'count' | 'sum' | 'avg' | 'min' | 'max'
export type ContractStatisticsSortDirection = 'asc' | 'desc'
export type ContractStatisticsVisualization = 'table' | 'bar' | 'line' | 'pie' | 'html_report'
export type ContractStatisticsReportStatus =
  | 'pending_clarification'
  | 'pending_confirmation'
  | 'executed'
  | 'invalidated'

export type ContractStatisticsFieldKey =
  | 'contract_name'
  | 'contract_code'
  | 'signing_date'
  | 'signing_year'
  | 'signing_month'
  | 'contract_type'
  | 'client_name'
  | 'party_b_name'
  | 'contract_amount'
  | 'contract_status'
  | 'department'
  | 'responsible_person'
  | 'currency'

export interface ContractStatisticsMetricSpec {
  metricId: string
  function: ContractStatisticsMetricFunction
  field?: ContractStatisticsFieldKey
  label?: string
}

export interface ContractStatisticsFieldColumn {
  kind: 'field'
  columnId: string
  field: ContractStatisticsFieldKey
  label?: string
}

export interface ContractStatisticsMetricColumn {
  kind: 'metric'
  columnId: string
  metric: ContractStatisticsMetricSpec
}

export type ContractStatisticsColumn =
  | ContractStatisticsFieldColumn
  | ContractStatisticsMetricColumn

export interface ContractStatisticsGroupByItem {
  field: ContractStatisticsFieldKey
  label?: string
}

export interface ContractStatisticsOrderByItem {
  field: string
  direction: ContractStatisticsSortDirection
}

export type ContractStatisticsFilterOperator =
  | 'eq'
  | 'in'
  | 'gte'
  | 'lte'
  | 'between'
  | 'contains'

export interface ContractStatisticsFilterItem {
  field: ContractStatisticsFieldKey
  operator: ContractStatisticsFilterOperator
  value?: unknown
  values?: unknown[]
  label?: string
}

export interface ContractStatisticsRequest {
  version: number
  source: ContractStatisticsSource
  question?: string
  columns: ContractStatisticsColumn[]
  filters?: ContractStatisticsFilterItem[]
  groupBy?: Array<ContractStatisticsGroupByItem | ContractStatisticsFieldKey>
  orderBy?: ContractStatisticsOrderByItem[]
  preferredVisualizations?: ContractStatisticsVisualization[]
}

export interface ContractStatisticsAIPlan {
  version: number
  source: ContractStatisticsSource
  intent: ContractStatisticsIntent
  question: string
  analysis?: string
  rawSql?: string
  request: ContractStatisticsRequest
}

export interface ContractStatisticsResultColumn {
  columnId: string
  label: string
  kind: ContractStatisticsColumnKind
  valueType: 'text' | 'number' | 'date'
}

export interface ContractStatisticsSummaryItem {
  label: string
  value: string
}

export interface ContractStatisticsChartSeries {
  name: string
  data: number[]
}

export interface ContractStatisticsChartData {
  type: Exclude<ContractStatisticsVisualization, 'table' | 'html_report'>
  labels: string[]
  series: ContractStatisticsChartSeries[]
}

export interface ContractStatisticsReportArtifact {
  title: string
  subtitle: string
  generatedAt: string
  summary: ContractStatisticsSummaryItem[]
  columns: ContractStatisticsResultColumn[]
  rows: Array<Record<string, unknown>>
  chart?: ContractStatisticsChartData
  html: string
}

export interface ContractStatisticsExecutionSuccessData {
  columns: ContractStatisticsResultColumn[]
  rows: Array<Record<string, unknown>>
  total: number
  sqlPreview: string
  summary: ContractStatisticsSummaryItem[]
  chart?: ContractStatisticsChartData
  report: ContractStatisticsReportArtifact
}

export interface ContractStatisticsExecutionError {
  code: string
  message: string
  details?: unknown
}

export interface ContractStatisticsExecutionOutcome {
  ok: boolean
  data?: ContractStatisticsExecutionSuccessData
  error?: ContractStatisticsExecutionError
}

export interface ContractStatisticsExecutionResult {
  executedAt: string
  outcome: ContractStatisticsExecutionOutcome
  summary: string
}

export interface ContractStatisticsClarification {
  recognized: string[]
  missing: string[]
  invalidFields: string[]
  suggestions: string[]
}
