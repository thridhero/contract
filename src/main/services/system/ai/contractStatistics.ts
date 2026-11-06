import type Database from 'better-sqlite3'
import type {
  ContractStatisticsAIPlan,
  ContractStatisticsChartData,
  ContractStatisticsClarification,
  ContractStatisticsColumn,
  ContractStatisticsExecutionError,
  ContractStatisticsExecutionResult,
  ContractStatisticsFieldKey,
  ContractStatisticsFilterItem,
  ContractStatisticsGroupByItem,
  ContractStatisticsOrderByItem,
  ContractStatisticsReportArtifact,
  ContractStatisticsResultColumn,
  ContractStatisticsSummaryItem,
  ContractStatisticsVisualization,
} from '../../../../shared/types/contractStatistics.types'

type FieldDefinition = {
  key: ContractStatisticsFieldKey
  label: string
  expr: string
  valueType: 'text' | 'number' | 'date'
  allowGroupBy: boolean
  allowFilter: boolean
}

type MetricDefinition = {
  key: string
  label: string
  expr: (fieldExpr?: string) => string
}

type SqlBuildResult = {
  sql: string
  params: unknown[]
  columns: ContractStatisticsResultColumn[]
  columnFieldKeyById: Record<string, ContractStatisticsFieldKey>
  orderBy: string[]
  sqlPreview: string
}

const CONTRACT_FIELD_DEFINITIONS: Record<ContractStatisticsFieldKey, FieldDefinition> = {
  contract_name: {
    key: 'contract_name',
    label: '合同名称',
    expr: 'contract_name',
    valueType: 'text',
    allowGroupBy: false,
    allowFilter: true,
  },
  contract_code: {
    key: 'contract_code',
    label: '合同编号',
    expr: 'contract_code',
    valueType: 'text',
    allowGroupBy: false,
    allowFilter: true,
  },
  signing_date: {
    key: 'signing_date',
    label: '签约日期',
    expr: 'signing_date',
    valueType: 'date',
    allowGroupBy: false,
    allowFilter: true,
  },
  signing_year: {
    key: 'signing_year',
    label: '签约年份',
    expr: "CAST(strftime('%Y', signing_date) AS INTEGER)",
    valueType: 'number',
    allowGroupBy: true,
    allowFilter: true,
  },
  signing_month: {
    key: 'signing_month',
    label: '签约月份',
    expr: "strftime('%Y-%m', signing_date)",
    valueType: 'text',
    allowGroupBy: true,
    allowFilter: true,
  },
  contract_type: {
    key: 'contract_type',
    label: '合同类型',
    expr: 'contract_type',
    valueType: 'text',
    allowGroupBy: true,
    allowFilter: true,
  },
  client_name: {
    key: 'client_name',
    label: '甲方单位',
    expr: 'client_name',
    valueType: 'text',
    allowGroupBy: true,
    allowFilter: true,
  },
  party_b_name: {
    key: 'party_b_name',
    label: '乙方单位',
    expr: 'party_b_name',
    valueType: 'text',
    allowGroupBy: true,
    allowFilter: true,
  },
  contract_amount: {
    key: 'contract_amount',
    label: '合同金额',
    expr: 'COALESCE(contract_amount, 0)',
    valueType: 'number',
    allowGroupBy: false,
    allowFilter: true,
  },
  contract_status: {
    key: 'contract_status',
    label: '合同状态',
    expr: 'contract_status',
    valueType: 'text',
    allowGroupBy: true,
    allowFilter: true,
  },
  department: {
    key: 'department',
    label: '归属部门',
    expr: 'department',
    valueType: 'text',
    allowGroupBy: true,
    allowFilter: true,
  },
  responsible_person: {
    key: 'responsible_person',
    label: '负责人',
    expr: 'responsible_person',
    valueType: 'text',
    allowGroupBy: true,
    allowFilter: true,
  },
  currency: {
    key: 'currency',
    label: '币种',
    expr: 'currency',
    valueType: 'text',
    allowGroupBy: true,
    allowFilter: true,
  },
}

const METRIC_DEFINITIONS: Record<string, MetricDefinition> = {
  contract_count: {
    key: 'contract_count',
    label: '合同数量',
    expr: () => 'COUNT(1)',
  },
  sum_contract_amount: {
    key: 'sum_contract_amount',
    label: '合同金额合计',
    expr: (fieldExpr) => `SUM(${fieldExpr || 'COALESCE(contract_amount, 0)'})`,
  },
  avg_contract_amount: {
    key: 'avg_contract_amount',
    label: '合同金额均值',
    expr: (fieldExpr) => `AVG(${fieldExpr || 'COALESCE(contract_amount, 0)'})`,
  },
  max_contract_amount: {
    key: 'max_contract_amount',
    label: '合同金额最大值',
    expr: (fieldExpr) => `MAX(${fieldExpr || 'COALESCE(contract_amount, 0)'})`,
  },
  min_contract_amount: {
    key: 'min_contract_amount',
    label: '合同金额最小值',
    expr: (fieldExpr) => `MIN(${fieldExpr || 'COALESCE(contract_amount, 0)'})`,
  },
}

const DEFAULT_CLARIFICATION_SUGGESTIONS = [
  '可补充分组字段，例如：合同类型、甲方单位、乙方单位、签约年份。',
  '可补充统计指标，例如：合同数量、合同金额合计、合同金额均值。',
  '如需限定范围，可补充筛选条件，例如：今年、某个合同类型、某个部门。',
]

const escapeHtml = (value: unknown): string => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;')

const normalizeText = (value: unknown): string => String(value ?? '').trim()

const normalizeStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) return []
  return value.map(item => String(item ?? '').trim()).filter(Boolean)
}

const toDisplayValue = (value: unknown): string => {
  if (value === null || value === undefined || value === '') return '-'
  if (typeof value === 'number') {
    return Number.isInteger(value) ? String(value) : value.toFixed(2)
  }
  return String(value)
}

const buildInlineBarChartSvg = (chart?: ContractStatisticsChartData): string => {
  if (!chart || !chart.labels.length || !chart.series.length) return ''
  const series = chart.series[0]
  const maxValue = Math.max(...series.data.map(item => Number(item || 0)), 0)
  if (maxValue <= 0) return ''
  const width = 720
  const height = Math.max(220, chart.labels.length * 42)
  const barLeft = 180
  const barMaxWidth = 480
  const rows = chart.labels.slice(0, 8).map((label, index) => {
    const rawValue = Number(series.data[index] || 0)
    const barWidth = Math.max(0, Math.round((rawValue / maxValue) * barMaxWidth))
    const y = 28 + index * 42
    return `
      <text x="12" y="${y}" fill="#475569" font-size="13">${escapeHtml(label)}</text>
      <rect x="${barLeft}" y="${y - 14}" width="${barWidth}" height="18" rx="6" fill="#2563eb"></rect>
      <text x="${barLeft + barWidth + 10}" y="${y}" fill="#0f172a" font-size="13">${escapeHtml(toDisplayValue(rawValue))}</text>
    `
  }).join('')
  return `
    <svg viewBox="0 0 ${width} ${height}" width="100%" height="${height}" role="img" aria-label="统计图表">
      <rect x="0" y="0" width="${width}" height="${height}" fill="#ffffff"></rect>
      ${rows}
    </svg>
  `
}

const buildReportHtml = (report: Omit<ContractStatisticsReportArtifact, 'html'>): string => {
  const summaryHtml = report.summary.map(item => `
    <div class="summary-card">
      <div class="summary-label">${escapeHtml(item.label)}</div>
      <div class="summary-value">${escapeHtml(item.value)}</div>
    </div>
  `).join('')

  const columnClassName = (column: ContractStatisticsResultColumn) => {
    if (column.valueType === 'number') return 'cell cell-number'
    return 'cell'
  }

  const visibleColumns = report.columns.filter((column) => column.columnId !== 'contract_code')
  const headerHtml = visibleColumns.map(column => `<th class="${columnClassName(column)}">${escapeHtml(column.label)}</th>`).join('')
  const bodyHtml = report.rows.map((row) => `
    <tr>
      ${visibleColumns.map(column => `<td class="${columnClassName(column)}">${escapeHtml(toDisplayValue(row[column.columnId]))}</td>`).join('')}
    </tr>
  `).join('')

  const chartSvg = buildInlineBarChartSvg(report.chart)

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(report.title)}</title>
  <style>
    :root {
      color-scheme: light;
      --bg: #f8fafc;
      --card: #ffffff;
      --border: #e2e8f0;
      --text: #0f172a;
      --muted: #475569;
      --primary: #2563eb;
    }
    * { box-sizing: border-box; }
    html, body { height: 100%; }
    body {
      margin: 0;
      padding: 0;
      background: var(--bg);
      color: var(--text);
      font-family: "Microsoft YaHei", "PingFang SC", sans-serif;
    }
    .page {
      width: 100%;
      max-width: none;
      margin: 0;
      padding: 24px;
      display: flex;
      flex-direction: column;
      gap: 20px;
    }
    .card {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 18px;
      padding: 20px 22px;
    }
    .title {
      font-size: 24px;
      font-weight: 700;
      margin: 0;
    }
    .subtitle {
      margin-top: 8px;
      color: var(--muted);
      line-height: 1.7;
      white-space: pre-wrap;
    }
    .meta {
      margin-top: 10px;
      font-size: 13px;
      color: var(--muted);
    }
    .summary-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 12px;
    }
    .summary-card {
      border: 1px solid var(--border);
      border-radius: 14px;
      padding: 14px 16px;
      background: #f8fbff;
    }
    .summary-label {
      font-size: 12px;
      color: var(--muted);
    }
    .summary-value {
      margin-top: 8px;
      font-size: 22px;
      font-weight: 700;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 14px;
    }
    th, td {
      padding: 12px 14px;
      border: 1px solid var(--border);
      text-align: left;
      vertical-align: top;
    }
    th {
      background: #eff6ff;
      font-weight: 600;
    }
    .cell-number {
      text-align: right;
      font-variant-numeric: tabular-nums;
    }
    .section-title {
      margin: 0 0 14px;
      font-size: 17px;
      font-weight: 700;
    }
  </style>
</head>
<body>
  <main class="page">
    <section class="card">
      <h1 class="title">${escapeHtml(report.title)}</h1>
      <div class="subtitle">${escapeHtml(report.subtitle)}</div>
      <div class="meta">生成时间：${escapeHtml(report.generatedAt)}</div>
    </section>
    <section class="card">
      <h2 class="section-title">摘要</h2>
      <div class="summary-grid">${summaryHtml}</div>
    </section>
    ${chartSvg ? `<section class="card"><h2 class="section-title">图表</h2>${chartSvg}</section>` : ''}
    <section class="card">
      <h2 class="section-title">表格</h2>
      <table>
        <thead><tr>${headerHtml}</tr></thead>
        <tbody>${bodyHtml}</tbody>
      </table>
    </section>
  </main>
</body>
</html>`
}

const buildErrorResult = (code: string, message: string, details?: unknown): ContractStatisticsExecutionResult => ({
  executedAt: new Date().toISOString(),
  outcome: {
    ok: false,
    error: { code, message, details },
  },
  summary: message,
})

const normalizeGroupBy = (items: ContractStatisticsAIPlan['request']['groupBy']): ContractStatisticsGroupByItem[] => {
  if (!Array.isArray(items)) return []
  return items
    .map((item): ContractStatisticsGroupByItem | null => {
      if (typeof item === 'string') {
        return { field: item as ContractStatisticsFieldKey, label: undefined }
      }
      return item && typeof item === 'object'
        ? { field: item.field as ContractStatisticsFieldKey, label: item.label }
        : null
    })
    .filter((item): item is ContractStatisticsGroupByItem => Boolean(item?.field))
}

const normalizeFilters = (filters: ContractStatisticsFilterItem[] | undefined): ContractStatisticsFilterItem[] => {
  if (!Array.isArray(filters)) return []
  return filters
    .map((item) => ({
      field: item.field,
      operator: item.operator,
      value: item.value,
      values: item.values,
      label: item.label,
    }))
    .filter((item) => Boolean(item.field) && Boolean(item.operator))
}

const validatePlan = (plan: ContractStatisticsAIPlan): ContractStatisticsExecutionError | null => {
  if (!plan || typeof plan !== 'object') {
    return { code: 'validation_failed', message: '统计方案不存在' }
  }
  if (normalizeText(plan.rawSql)) {
    return { code: 'raw_sql_forbidden', message: '不允许透传原始 SQL，请使用受控统计方案。' }
  }
  if (!plan.request || !Array.isArray(plan.request.columns) || plan.request.columns.length === 0) {
    return { code: 'validation_failed', message: '统计方案至少需要一个输出列。' }
  }
  const invalidFields = new Set<string>()
  for (const column of plan.request.columns) {
    if (column.kind === 'field') {
      const field = CONTRACT_FIELD_DEFINITIONS[column.field]
      if (!field) invalidFields.add(String(column.field || ''))
      if (field && plan.intent === 'aggregation' && !field.allowGroupBy) {
        invalidFields.add(String(column.field || ''))
      }
      continue
    }
    if (column.kind === 'metric') {
      const definition = METRIC_DEFINITIONS[column.metric.metricId]
      if (!definition) invalidFields.add(String(column.metric.metricId || ''))
      if (column.metric.field && !CONTRACT_FIELD_DEFINITIONS[column.metric.field]) {
        invalidFields.add(String(column.metric.field || ''))
      }
    }
  }
  for (const item of normalizeGroupBy(plan.request.groupBy)) {
    const field = CONTRACT_FIELD_DEFINITIONS[item.field]
    if (!field || !field.allowGroupBy) invalidFields.add(String(item.field || ''))
  }
  for (const filter of normalizeFilters(plan.request.filters)) {
    const field = CONTRACT_FIELD_DEFINITIONS[filter.field]
    if (!field || !field.allowFilter) invalidFields.add(String(filter.field || ''))
  }
  if (invalidFields.size > 0) {
    return {
      code: 'validation_failed',
      message: `以下字段或指标不在白名单内：${[...invalidFields].join('、')}`,
      details: { invalidFields: [...invalidFields] },
    }
  }
  return null
}

const ensureMetricColumns = (plan: ContractStatisticsAIPlan): ContractStatisticsAIPlan => {
  if (plan.intent !== 'aggregation') return plan
  const hasMetric = plan.request.columns.some(column => column.kind === 'metric')
  if (hasMetric) return plan
  return {
    ...plan,
    request: {
      ...plan.request,
      columns: [
        ...plan.request.columns,
        {
          kind: 'metric',
          columnId: 'contract_count',
          metric: {
            metricId: 'contract_count',
            function: 'count',
            label: '合同数量',
          },
        },
      ],
    },
  }
}

const buildWhereClause = (filters: ContractStatisticsFilterItem[]): { sql: string; params: unknown[] } => {
  const clauses = ['deleted_at IS NULL']
  const params: unknown[] = []

  for (const filter of filters) {
    const field = CONTRACT_FIELD_DEFINITIONS[filter.field]
    if (!field) continue
    if (filter.operator === 'contains') {
      clauses.push(`LOWER(COALESCE(${field.expr}, '')) LIKE ?`)
      params.push(`%${normalizeText(filter.value).toLowerCase()}%`)
      continue
    }
    if (filter.operator === 'eq') {
      clauses.push(`${field.expr} = ?`)
      params.push(filter.value)
      continue
    }
    if (filter.operator === 'gte') {
      clauses.push(`${field.expr} >= ?`)
      params.push(filter.value)
      continue
    }
    if (filter.operator === 'lte') {
      clauses.push(`${field.expr} <= ?`)
      params.push(filter.value)
      continue
    }
    if (filter.operator === 'in') {
      const values = normalizeStringArray(filter.values ?? filter.value)
      if (!values.length) continue
      clauses.push(`${field.expr} IN (${values.map(() => '?').join(', ')})`)
      params.push(...values)
      continue
    }
    if (filter.operator === 'between') {
      const values = Array.isArray(filter.values) ? filter.values.slice(0, 2) : []
      if (values.length !== 2) continue
      clauses.push(`${field.expr} BETWEEN ? AND ?`)
      params.push(values[0], values[1])
    }
  }

  return {
    sql: clauses.length ? `WHERE ${clauses.join(' AND ')}` : '',
    params,
  }
}

const buildSql = (plan: ContractStatisticsAIPlan): SqlBuildResult => {
  const columns: ContractStatisticsResultColumn[] = []
  const selectParts: string[] = []
  const groupByExprs: string[] = []
  const metricAliases = new Set<string>()
  const columnFieldKeyById: Record<string, ContractStatisticsFieldKey> = {}

  for (const column of plan.request.columns) {
    if (column.kind === 'field') {
      const field = CONTRACT_FIELD_DEFINITIONS[column.field]
      selectParts.push(`${field.expr} AS "${column.columnId}"`)
      columns.push({
        columnId: column.columnId,
        label: normalizeText(column.label) || field.label,
        kind: 'field',
        valueType: field.valueType,
      })
      columnFieldKeyById[column.columnId] = column.field
      if (plan.intent === 'aggregation') {
        groupByExprs.push(field.expr)
      }
      continue
    }

    const fieldExpr = column.metric.field ? CONTRACT_FIELD_DEFINITIONS[column.metric.field]?.expr : undefined
    const metric = METRIC_DEFINITIONS[column.metric.metricId]
    selectParts.push(`${metric.expr(fieldExpr)} AS "${column.columnId}"`)
    columns.push({
      columnId: column.columnId,
      label: normalizeText(column.metric.label) || metric.label,
      kind: 'metric',
      valueType: 'number',
    })
    metricAliases.add(column.columnId)
  }

  const filters = normalizeFilters(plan.request.filters)
  const { sql: whereSql, params } = buildWhereClause(filters)
  const groupBySql = plan.intent === 'aggregation' && groupByExprs.length > 0
    ? `GROUP BY ${groupByExprs.join(', ')}`
    : ''

  const orderBy: string[] = []
  for (const item of Array.isArray(plan.request.orderBy) ? plan.request.orderBy : []) {
    const direction = item.direction === 'asc' ? 'ASC' : 'DESC'
    if (metricAliases.has(item.field)) {
      orderBy.push(`"${item.field}" ${direction}`)
      continue
    }
    const field = CONTRACT_FIELD_DEFINITIONS[item.field as ContractStatisticsFieldKey]
    if (!field) continue
    orderBy.push(`${field.expr} ${direction}`)
  }

  if (orderBy.length === 0) {
    const firstMetric = columns.find(column => column.kind === 'metric')
    if (firstMetric && plan.intent === 'aggregation') {
      orderBy.push(`"${firstMetric.columnId}" DESC`)
    } else if (columns[0]) {
      orderBy.push(`"${columns[0].columnId}" ASC`)
    }
  }

  const sql = `
    SELECT
      ${selectParts.join(',\n      ')}
    FROM contract_info
    ${whereSql}
    ${groupBySql}
    ORDER BY ${orderBy.join(', ')}
    LIMIT 200
  `.trim()

  return {
    sql,
    params,
    columns,
    columnFieldKeyById,
    orderBy,
    sqlPreview: sql.replace(/\s+/g, ' ').trim(),
  }
}

const buildChartData = (
  visualizations: ContractStatisticsVisualization[] | undefined,
  columns: ContractStatisticsResultColumn[],
  rows: Array<Record<string, unknown>>,
): ContractStatisticsChartData | undefined => {
  const preferred = Array.isArray(visualizations) ? visualizations : []
  const chartType = preferred.find(item => ['bar', 'line', 'pie'].includes(item)) as ContractStatisticsChartData['type'] | undefined
  const dimensionColumn = columns.find(column => column.kind === 'field')
  const metricColumn = columns.find(column => column.kind === 'metric')
  if (!chartType || !dimensionColumn || !metricColumn || rows.length === 0) return undefined
  return {
    type: chartType,
    labels: rows.map(row => toDisplayValue(row[dimensionColumn.columnId])),
    series: [
      {
        name: metricColumn.label,
        data: rows.map(row => Number(row[metricColumn.columnId] || 0)),
      },
    ],
  }
}

const buildSummary = (
  plan: ContractStatisticsAIPlan,
  columns: ContractStatisticsResultColumn[],
  rows: Array<Record<string, unknown>>,
): ContractStatisticsSummaryItem[] => {
  const metricColumn = columns.find(column => column.kind === 'metric')
  const metricPlanColumn = plan.request.columns.find((column): column is Extract<ContractStatisticsColumn, { kind: 'metric' }> => (
    column.kind === 'metric' && column.columnId === metricColumn?.columnId
  ))
  const summary: ContractStatisticsSummaryItem[] = [
    { label: '统计主题', value: normalizeText(plan.question) || '合同统计' },
    { label: '结果行数', value: String(rows.length) },
  ]
  if (!metricColumn || !metricPlanColumn) {
    return summary
  }
  const values = rows
    .map((row) => Number(row[metricColumn.columnId] || 0))
    .filter((value) => Number.isFinite(value))
  if (!values.length) {
    return summary
  }
  const { function: metricFunction, metricId } = metricPlanColumn.metric
  if (metricFunction === 'count' || metricFunction === 'sum' || metricId === 'contract_count' || metricId.startsWith('sum_')) {
    const total = values.reduce((acc, value) => acc + value, 0)
    summary.push({ label: `${metricColumn.label}合计`, value: toDisplayValue(total) })
    return summary
  }
  if (metricFunction === 'avg' || metricId.startsWith('avg_')) {
    if (values.length === 1) {
      summary.push({ label: metricColumn.label, value: toDisplayValue(values[0]) })
      return summary
    }
    const minValue = Math.min(...values)
    const maxValue = Math.max(...values)
    summary.push({ label: `${metricColumn.label}区间`, value: `${toDisplayValue(minValue)} ~ ${toDisplayValue(maxValue)}` })
    return summary
  }
  if (metricFunction === 'max' || metricId.startsWith('max_')) {
    summary.push({ label: metricColumn.label, value: toDisplayValue(Math.max(...values)) })
    return summary
  }
  if (metricFunction === 'min' || metricId.startsWith('min_')) {
    summary.push({ label: metricColumn.label, value: toDisplayValue(Math.min(...values)) })
    return summary
  }
  summary.push({ label: metricColumn.label, value: toDisplayValue(values[0]) })
  return summary
}

const buildSubtitle = (plan: ContractStatisticsAIPlan, options?: { hiddenFields?: Set<ContractStatisticsFieldKey> }): string => {
  const hiddenFields = options?.hiddenFields ?? new Set<ContractStatisticsFieldKey>()
  const dimensions = plan.request.columns
    .filter((column): column is Extract<ContractStatisticsColumn, { kind: 'field' }> => column.kind === 'field')
    .filter((column) => !hiddenFields.has(column.field))
    .map(column => CONTRACT_FIELD_DEFINITIONS[column.field]?.label || column.field)
  const metrics = plan.request.columns
    .filter((column): column is Extract<ContractStatisticsColumn, { kind: 'metric' }> => column.kind === 'metric')
    .map(column => normalizeText(column.metric.label) || METRIC_DEFINITIONS[column.metric.metricId]?.label || column.metric.metricId)
  const filters = normalizeFilters(plan.request.filters).filter((item) => !hiddenFields.has(item.field)).map((item) => {
    const label = normalizeText(item.label) || CONTRACT_FIELD_DEFINITIONS[item.field]?.label || item.field
    const value = Array.isArray(item.values) ? item.values.join('、') : toDisplayValue(item.value)
    return `${label}${item.operator === 'contains' ? '包含' : item.operator === 'eq' ? '=' : item.operator === 'gte' ? '>=' : item.operator === 'lte' ? '<=' : item.operator === 'between' ? '区间' : '属于'}${value}`
  })
  return [
    dimensions.length ? `字段：${dimensions.join('、')}` : '',
    metrics.length ? `指标：${metrics.join('、')}` : '',
    filters.length ? `筛选：${filters.join('；')}` : '筛选：默认仅统计未删除合同',
  ].filter(Boolean).join('\n')
}

const loadDictionaryValueNameMap = (
  db: Database.Database,
  groupName: string,
): Map<string, string> => {
  try {
    const rows = db.prepare(`
      SELECT name, value
      FROM dictionaries
      WHERE deleted_at IS NULL AND group_name = ?
      ORDER BY sort_order ASC, created_at ASC
    `).all(groupName) as Array<{ name?: string; value?: string }>
    const map = new Map<string, string>()
    for (const row of rows) {
      const value = String(row?.value ?? '').trim()
      const name = String(row?.name ?? '').trim()
      if (value && name) map.set(value, name)
    }
    return map
  } catch {
    return new Map<string, string>()
  }
}

export const buildContractStatisticsClarification = (payload: {
  recognized?: string[]
  missing?: string[]
  invalidFields?: string[]
}): ContractStatisticsClarification => ({
  recognized: Array.isArray(payload.recognized) ? payload.recognized.filter(Boolean) : [],
  missing: Array.isArray(payload.missing) ? payload.missing.filter(Boolean) : [],
  invalidFields: Array.isArray(payload.invalidFields) ? payload.invalidFields.filter(Boolean) : [],
  suggestions: [...DEFAULT_CLARIFICATION_SUGGESTIONS],
})

export const executeContractStatisticsPlan = (
  db: Database.Database,
  inputPlan: ContractStatisticsAIPlan,
): ContractStatisticsExecutionResult => {
  const plan = ensureMetricColumns(inputPlan)
  const validationError = validatePlan(plan)
  if (validationError) {
    return buildErrorResult(validationError.code, validationError.message, validationError.details)
  }

  try {
    const sql = buildSql(plan)
    const rawRows = db.prepare(sql.sql).all(...sql.params) as Array<Record<string, unknown>>

    const hiddenFields = new Set<ContractStatisticsFieldKey>(['contract_code'])
    const contractTypeColumnIds = Object.entries(sql.columnFieldKeyById)
      .filter(([, fieldKey]) => fieldKey === 'contract_type')
      .map(([columnId]) => columnId)
    const contractStatusColumnIds = Object.entries(sql.columnFieldKeyById)
      .filter(([, fieldKey]) => fieldKey === 'contract_status')
      .map(([columnId]) => columnId)
    const contractCodeColumnIds = Object.entries(sql.columnFieldKeyById)
      .filter(([, fieldKey]) => fieldKey === 'contract_code')
      .map(([columnId]) => columnId)

    const contractTypeMap = contractTypeColumnIds.length ? loadDictionaryValueNameMap(db, '合同类型') : new Map<string, string>()
    const contractStatusMap = contractStatusColumnIds.length ? loadDictionaryValueNameMap(db, '合同状态') : new Map<string, string>()

    const rows = rawRows.map((row) => {
      const next: Record<string, unknown> = { ...row }
      for (const columnId of contractCodeColumnIds) delete next[columnId]
      for (const columnId of contractTypeColumnIds) {
        const value = String(next[columnId] ?? '').trim()
        if (value && contractTypeMap.has(value)) next[columnId] = contractTypeMap.get(value)
      }
      for (const columnId of contractStatusColumnIds) {
        const value = String(next[columnId] ?? '').trim()
        if (value && contractStatusMap.has(value)) next[columnId] = contractStatusMap.get(value)
      }
      return next
    })

    const columns = sql.columns.filter((column) => !hiddenFields.has(sql.columnFieldKeyById[column.columnId] as ContractStatisticsFieldKey))

    const chart = buildChartData(plan.request.preferredVisualizations, columns, rows)
    const summary = buildSummary(plan, columns, rows)
    const reportBase = {
      title: normalizeText(plan.question) || '合同统计报表',
      subtitle: buildSubtitle(plan, { hiddenFields }),
      generatedAt: new Date().toISOString(),
      summary,
      columns,
      rows,
      chart,
    }
    const report: ContractStatisticsReportArtifact = {
      ...reportBase,
      html: buildReportHtml(reportBase),
    }
    const successSummary = `统计成功，共返回 ${rows.length} 行结果。`
    return {
      executedAt: new Date().toISOString(),
      outcome: {
        ok: true,
        data: {
          columns,
          rows,
          total: rows.length,
          sqlPreview: sql.sqlPreview,
          summary,
          chart,
          report,
        },
      },
      summary: successSummary,
    }
  } catch (error) {
    return buildErrorResult(
      'execution_failed',
      error instanceof Error ? error.message : '合同统计执行失败',
    )
  }
}
