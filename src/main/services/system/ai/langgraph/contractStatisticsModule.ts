import type Database from 'better-sqlite3'
import type {
  AIAgentContractStatisticsToolData,
  AIAgentSession,
  AIAgentToolCallRecord,
} from '../../../../../shared/types/aiAgent.types'
import type { AIStructuredFieldDefinition } from '../../../../../shared/types/ai.types'
import type {
  ContractStatisticsAIPlan,
  ContractStatisticsClarification,
} from '../../../../../shared/types/contractStatistics.types'
import { buildContractStatisticsClarification, executeContractStatisticsPlan } from '../contractStatistics'

export type StructuredGenerationPayload = {
  scene: string
  prompt: string
  sourceText: string
  schema: AIStructuredFieldDefinition[]
}

export type ContractStatisticsStructuredGenerator = <T extends Record<string, unknown>>(
  payload: StructuredGenerationPayload,
) => Promise<T>

export interface ContractStatisticsModuleDependencies {
  generateStructured: ContractStatisticsStructuredGenerator
  buildConversationContext: (session: AIAgentSession, messageLimit: number) => string
  createToolRecord: (
    toolName: 'contract_statistics',
    title: string,
    args: Record<string, unknown>,
    status: 'success' | 'error',
    summary: string,
    rawData?: unknown,
  ) => AIAgentToolCallRecord
  resolveDbPathFromLibraryPath: (libraryPath: string) => string
  openDbByPath: (dbPath: string) => Database.Database
}

export type ContractStatisticsAnalysisResult = {
  question: string
  analysis: string
  plan: ContractStatisticsAIPlan | null
  clarification: ContractStatisticsClarification
}

const splitCsvText = (value: unknown): string[] => String(value || '')
  .split(/[，,]/)
  .map(item => item.trim())
  .filter(Boolean)

const normalizeStatisticsChartType = (
  value: unknown,
): ContractStatisticsAIPlan['request']['preferredVisualizations'][number] => {
  const text = String(value || '').trim()
  if (text === 'line' || text === 'pie' || text === 'table') return text
  return 'bar'
}

const parseStatisticsFilters = (value: unknown): ContractStatisticsAIPlan['request']['filters'] => {
  const raw = String(value || '').trim()
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter(item => item && typeof item === 'object')
      .map(item => ({
        field: String((item as any).field || '').trim() as any,
        operator: String((item as any).operator || 'eq').trim() as any,
        value: (item as any).value,
        values: Array.isArray((item as any).values) ? (item as any).values : undefined,
        label: String((item as any).label || '').trim() || undefined,
      }))
      .filter(item => Boolean(item.field))
  } catch {
    return []
  }
}

const createStatisticsMetricColumn = (
  metricKey: string,
): ContractStatisticsAIPlan['request']['columns'][number] | null => {
  switch (metricKey) {
    case 'contract_count':
      return {
        kind: 'metric',
        columnId: 'contract_count',
        metric: { metricId: 'contract_count', function: 'count', label: '合同数量' },
      }
    case 'sum_contract_amount':
      return {
        kind: 'metric',
        columnId: 'sum_contract_amount',
        metric: { metricId: 'sum_contract_amount', function: 'sum', field: 'contract_amount', label: '合同金额合计' },
      }
    case 'avg_contract_amount':
      return {
        kind: 'metric',
        columnId: 'avg_contract_amount',
        metric: { metricId: 'avg_contract_amount', function: 'avg', field: 'contract_amount', label: '合同金额均值' },
      }
    case 'max_contract_amount':
      return {
        kind: 'metric',
        columnId: 'max_contract_amount',
        metric: { metricId: 'max_contract_amount', function: 'max', field: 'contract_amount', label: '合同金额最大值' },
      }
    case 'min_contract_amount':
      return {
        kind: 'metric',
        columnId: 'min_contract_amount',
        metric: { metricId: 'min_contract_amount', function: 'min', field: 'contract_amount', label: '合同金额最小值' },
      }
    default:
      return null
  }
}

export const getLatestStatisticsToolData = (session: AIAgentSession): AIAgentContractStatisticsToolData | null => {
  for (let i = session.messages.length - 1; i >= 0; i -= 1) {
    const message = session.messages[i]
    const toolCalls = Array.isArray(message.toolCalls) ? message.toolCalls : []
    for (let j = toolCalls.length - 1; j >= 0; j -= 1) {
      const toolCall = toolCalls[j]
      if (toolCall.toolName !== 'contract_statistics' || !toolCall.rawData || typeof toolCall.rawData !== 'object') {
        continue
      }
      const raw = toolCall.rawData as Partial<AIAgentContractStatisticsToolData>
      if (raw.kind === 'contract_statistics' && typeof raw.status === 'string') {
        return raw as AIAgentContractStatisticsToolData
      }
    }
  }
  return null
}

export const isStatisticsConfirmationMessage = (userMessage: string): boolean => {
  const text = String(userMessage || '').trim()
  const normalized = text.replace(/[，。！？、\s]/g, '')
  return /^(确认|确认执行|确认统计|确定|确定执行|确定统计|开始执行|执行吧|就按这个|按这个来|可以执行|没问题执行|好的执行|可以开始了|开始吧)$/
    .test(normalized)
}

export const looksLikeStatisticsIntent = (userMessage: string): boolean => {
  const text = String(userMessage || '').trim()
  return /(统计|汇总|分析|金额|数量|排行|排名|趋势|分布|占比|top|总额|合计|均值|平均|按.+(统计|汇总|分组)|各.+(统计|数量|金额))/i.test(text)
}

export const looksLikeStatisticsFollowUp = (
  userMessage: string,
  latest: AIAgentContractStatisticsToolData | null,
): boolean => {
  if (!latest || (latest.status !== 'pending_clarification' && latest.status !== 'pending_confirmation')) {
    return false
  }
  const text = String(userMessage || '').trim()
  return /(加上|增加|补充|再加|去掉|删除|不要|只保留|改成|改为|按|限定|筛选|时间范围|今年|本月|上月|客户名称|合同类型|金额|数量)/i.test(text)
}

export const formatStatisticsPlanSummary = (plan: ContractStatisticsAIPlan): string => {
  const fields = plan.request.columns
    .filter(item => item.kind === 'field')
    .map(item => String(item.label || item.field || '').trim())
    .filter(Boolean)
  const metrics = plan.request.columns
    .filter(item => item.kind === 'metric')
    .map(item => String(item.metric.label || item.metric.metricId || '').trim())
    .filter(Boolean)
  const filters = Array.isArray(plan.request.filters)
    ? plan.request.filters.map(item => String(item.label || item.field || '').trim()).filter(Boolean)
    : []
  const chartType = Array.isArray(plan.request.preferredVisualizations)
    ? plan.request.preferredVisualizations.find(item => ['bar', 'line', 'pie'].includes(item))
    : ''
  return [
    `统计主题：${plan.question || '合同统计'}`,
    `字段：${fields.length ? fields.join('、') : '无'}`,
    `指标：${metrics.length ? metrics.join('、') : '无'}`,
    `筛选：${filters.length ? filters.join('、') : '默认仅统计未删除合同'}`,
    `展示：${chartType || 'table'} + 独立报表`,
  ].join('\n')
}

export const formatStatisticsPendingConfirmationSummary = (plan: ContractStatisticsAIPlan): string => [
  '已整理出待执行的合同统计方案，请先确认。',
  formatStatisticsPlanSummary(plan),
  '如需调整，可直接补充字段或条件；确认无误后请回复“确认执行”。',
].join('\n')

export const formatStatisticsClarificationSummary = (data: AIAgentContractStatisticsToolData): string => {
  const clarification = data.clarification || buildContractStatisticsClarification({})
  return [
    '当前还不能安全生成统计 SQL，请先补充或修正以下信息。',
    clarification.recognized.length ? `已识别：${clarification.recognized.join('、')}` : '已识别：暂无稳定字段',
    clarification.missing.length ? `仍缺失：${clarification.missing.join('、')}` : '',
    clarification.invalidFields.length ? `不可用字段：${clarification.invalidFields.join('、')}` : '',
    `建议补充：${clarification.suggestions.join(' ')}`,
  ].filter(Boolean).join('\n')
}

export const analyzeContractStatisticsRequest = async (
  deps: Pick<ContractStatisticsModuleDependencies, 'generateStructured' | 'buildConversationContext'>,
  session: AIAgentSession,
  userMessage: string,
  previousPlan?: ContractStatisticsAIPlan,
): Promise<ContractStatisticsAnalysisResult> => {
  const result = await deps.generateStructured<Record<string, unknown>>({
    scene: 'agent-contract-statistics-plan',
    prompt: [
      '你是合同统计计划解析器，需要把用户消息解析为受控统计方案。',
      '只允许基于合同主表 contract_info 的白名单字段工作，不得生成原始 SQL。',
      '维度字段白名单：contract_type, client_name, party_b_name, contract_status, department, responsible_person, signing_year, signing_month。',
      '明细字段白名单：contract_name, contract_code, signing_date, contract_type, client_name, party_b_name, contract_amount, contract_status, department, responsible_person, currency。',
      '指标白名单：contract_count, sum_contract_amount, avg_contract_amount, max_contract_amount, min_contract_amount。',
      '筛选字段白名单：contract_type, client_name, party_b_name, contract_status, department, responsible_person, signing_year, signing_month, signing_date, contract_amount。',
      '图表类型只允许：bar, line, pie, table。',
      '如果用户是在补充上一版统计方案，请输出修改后的完整方案，而不是增量片段。',
      '如果用户改为一个新的统计问题，请忽略旧方案并输出新方案。',
      '如果用户输入了白名单外字段，不要猜测，把字段名放入 invalidFields。',
      '如果信息不足，请在 missing 中列出缺口，例如：统计指标、分组字段、时间范围、筛选条件。',
      '只有在可以形成完整统计方案时，才返回 action=plan；否则返回 action=clarify。',
    ].join('\n'),
    sourceText: [
      `用户消息：${userMessage}`,
      '',
      previousPlan
        ? `上一版统计方案：\n${formatStatisticsPlanSummary(previousPlan)}`
        : '上一版统计方案：无',
      '',
      '会话上下文：',
      deps.buildConversationContext(session, 8),
    ].join('\n'),
    schema: [
      { key: 'action', type: 'string', description: 'plan 或 clarify', required: true },
      { key: 'intent', type: 'string', description: 'aggregation 或 detail' },
      { key: 'question', type: 'string', description: '整理后的统计主题' },
      { key: 'analysis', type: 'string', description: '方案摘要说明' },
      { key: 'dimensions', type: 'string', description: '维度字段，英文 key，用逗号分隔' },
      { key: 'detailFields', type: 'string', description: '明细字段，英文 key，用逗号分隔' },
      { key: 'metrics', type: 'string', description: '指标字段，英文 key，用逗号分隔' },
      { key: 'filtersJson', type: 'string', description: '筛选条件 JSON 数组字符串，元素包含 field/operator/value/values/label' },
      { key: 'chartType', type: 'string', description: 'bar、line、pie、table 之一' },
      { key: 'invalidFields', type: 'string', description: '非法字段，用逗号分隔' },
      { key: 'missing', type: 'string', description: '仍缺失的信息，用逗号分隔' },
    ],
  })

  const question = String(result.question || userMessage).trim()
  const analysis = String(result.analysis || '').trim()
  const invalidFields = splitCsvText(result.invalidFields)
  const missing = splitCsvText(result.missing)
  const clarification = buildContractStatisticsClarification({
    recognized: [
      ...splitCsvText(result.dimensions),
      ...splitCsvText(result.metrics),
      ...splitCsvText(result.detailFields),
    ],
    missing,
    invalidFields,
  })

  if (String(result.action || '').trim() !== 'plan') {
    return {
      question,
      analysis,
      plan: null,
      clarification,
    }
  }

  const intent = String(result.intent || 'aggregation').trim() === 'detail' ? 'detail' : 'aggregation'
  const fieldKeys = intent === 'detail'
    ? splitCsvText(result.detailFields)
    : splitCsvText(result.dimensions)
  const metricKeys = splitCsvText(result.metrics)
  const chartType = normalizeStatisticsChartType(result.chartType)
  const filters = parseStatisticsFilters(result.filtersJson)

  const columns = [
    ...fieldKeys.map((fieldKey) => ({
      kind: 'field' as const,
      columnId: fieldKey,
      field: fieldKey as any,
    })),
    ...(intent === 'aggregation'
      ? metricKeys.map((metricKey) => createStatisticsMetricColumn(metricKey))
      : []),
  ].filter(Boolean) as ContractStatisticsAIPlan['request']['columns']

  const plan: ContractStatisticsAIPlan = {
    version: 1,
    source: 'contract',
    intent,
    question,
    analysis,
    request: {
      version: 1,
      source: 'contract',
      question,
      columns,
      filters,
      groupBy: intent === 'aggregation'
        ? fieldKeys.map((fieldKey) => ({ field: fieldKey as any }))
        : undefined,
      preferredVisualizations: ['table', chartType, 'html_report'],
    },
  }

  return {
    question,
    analysis,
    plan,
    clarification,
  }
}

export const buildContractStatisticsPlan = async (
  deps: Pick<ContractStatisticsModuleDependencies, 'generateStructured' | 'buildConversationContext'>,
  session: AIAgentSession,
  userQuestion: string,
  previousPlan?: ContractStatisticsAIPlan | null,
): Promise<ContractStatisticsAIPlan> => {
  const analyzed = await analyzeContractStatisticsRequest(deps, session, userQuestion, previousPlan || undefined)
  if (analyzed.plan) {
    return analyzed.plan
  }
  return {
    version: 1,
    source: 'contract',
    intent: 'aggregation',
    question: String(userQuestion || '').trim(),
    analysis: analyzed.analysis || '等待用户补充统计字段或口径',
    request: {
      version: 1,
      source: 'contract',
      question: String(userQuestion || '').trim(),
      columns: [],
      preferredVisualizations: ['table', 'html_report'],
    },
  }
}

export const reviseContractStatisticsPlan = async (
  deps: Pick<ContractStatisticsModuleDependencies, 'generateStructured' | 'buildConversationContext'>,
  session: AIAgentSession,
  userQuestion: string,
  previousPlan?: ContractStatisticsAIPlan | null,
  _snapshot?: unknown,
): Promise<ContractStatisticsAIPlan> => buildContractStatisticsPlan(deps, session, userQuestion, previousPlan || undefined)

export const handleContractStatisticsTool = async (
  deps: ContractStatisticsModuleDependencies,
  session: AIAgentSession,
  userMessage: string,
): Promise<AIAgentToolCallRecord> => {
  const normalizedMessage = String(userMessage || '').trim()
  const latestStatisticsState = getLatestStatisticsToolData(session)

  let db: Database.Database | null = null
  try {
    const dbPath = deps.resolveDbPathFromLibraryPath(session.libraryPath)
    db = deps.openDbByPath(dbPath)

    if (latestStatisticsState?.status === 'pending_confirmation'
      && latestStatisticsState.plan
      && isStatisticsConfirmationMessage(normalizedMessage)) {
      const execution = executeContractStatisticsPlan(db, latestStatisticsState.plan)
      const rawData: AIAgentContractStatisticsToolData = {
        kind: 'contract_statistics',
        status: 'executed',
        question: latestStatisticsState.question || latestStatisticsState.plan.question,
        plan: latestStatisticsState.plan,
        execution,
      }
      const summary = execution.outcome.ok
        ? [
            '已按确认方案执行合同统计并生成正式报表。',
            formatStatisticsPlanSummary(latestStatisticsState.plan),
            execution.summary,
            '聊天区仅保留摘要与入口，完整表格和图表请在独立报表页查看。',
          ].join('\n')
        : [
            '确认后执行统计失败，请调整字段或筛选条件后重试。',
            formatStatisticsPlanSummary(latestStatisticsState.plan),
            execution.summary,
          ].join('\n')
      return deps.createToolRecord(
        'contract_statistics',
        '合同统计报表',
        { searchQuery: normalizedMessage },
        execution.outcome.ok ? 'success' : 'error',
        summary,
        rawData,
      )
    }

    const analyzed = await analyzeContractStatisticsRequest(
      deps,
      session,
      normalizedMessage,
      latestStatisticsState?.status !== 'executed' ? latestStatisticsState?.plan : undefined,
    )

    if (!analyzed.plan || analyzed.clarification.invalidFields.length > 0 || analyzed.clarification.missing.length > 0) {
      const rawData: AIAgentContractStatisticsToolData = {
        kind: 'contract_statistics',
        status: 'pending_clarification',
        question: analyzed.question || normalizedMessage,
        plan: analyzed.plan || undefined,
        clarification: analyzed.clarification,
      }
      return deps.createToolRecord(
        'contract_statistics',
        '合同统计报表',
        { searchQuery: normalizedMessage },
        'success',
        formatStatisticsClarificationSummary(rawData),
        rawData,
      )
    }

    const rawData: AIAgentContractStatisticsToolData = {
      kind: 'contract_statistics',
      status: 'pending_confirmation',
      question: analyzed.question || normalizedMessage,
      plan: analyzed.plan,
      clarification: analyzed.clarification,
    }
    return deps.createToolRecord(
      'contract_statistics',
      '合同统计报表',
      { searchQuery: normalizedMessage },
      'success',
      formatStatisticsPendingConfirmationSummary(analyzed.plan),
      rawData,
    )
  } catch (error) {
    const rawData: AIAgentContractStatisticsToolData = {
      kind: 'contract_statistics',
      status: 'pending_clarification',
      question: normalizedMessage,
      clarification: buildContractStatisticsClarification({
        missing: ['统计方案生成失败'],
      }),
    }
    return deps.createToolRecord(
      'contract_statistics',
      '合同统计报表',
      { searchQuery: normalizedMessage },
      'error',
      error instanceof Error ? error.message : '合同统计处理失败',
      rawData,
    )
  } finally {
    db?.close()
  }
}
