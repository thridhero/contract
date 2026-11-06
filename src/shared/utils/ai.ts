import type {
  AIContractExtractionResult,
  AIPromptTaskType,
  AIPromptTemplateConfig,
  AIProvider,
  AISettings,
  AILocalModelConfig,
  AIStructuredFieldDefinition,
} from '../types/ai.types'
import type { AIAgentSettings, AIAgentToolName } from '../types/aiAgent.types'

export const DEFAULT_AI_TIMEOUT_MS = 120000
export const DEFAULT_CLOUD_TIMEOUT_MS = 30000
export const DEFAULT_EMBEDDING_DIMENSION = 256
export const DEFAULT_RETRIEVAL_TOP_K = 6
export const DEFAULT_RETRIEVAL_SCORE_THRESHOLD = 0.18
export const DEFAULT_LOCAL_SMALL_MODEL_MAX_CONTEXT_CHARS = 12000
export const DEFAULT_CONTRACT_PROMPT = '请提取以下合同内容的关键信息，并以 JSON 对象返回：合同名称(contractName)、合同编号(contractCode)、签约日期(signingDate，格式 YYYY-MM-DD)、合同类型(contractType)、合同甲方(clientName)、合同乙方(partyBName)、合同摘要(contractSummary)。'
export const AI_PROMPT_TEMPLATE_VERSION = 1
export const AI_PROMPT_TASKS: AIPromptTaskType[] = [
  'contractTypeClassification',
  'contractFieldExtraction',
  'receiptPlanExtraction',
]
export const DEFAULT_AGENT_TOOL_NAMES: AIAgentToolName[] = [
  'contract_search',
  'contract_full_text_search',
  'contract_detail_summary',
  'contract_statistics',
  'product_search',
  'personnel_search',
  'customer_search',
  'supplier_search',
  'invoice_search',
]

export const DEFAULT_PROMPT_TEMPLATES: Record<AIPromptTaskType, string> = {
  contractTypeClassification: [
    '你是合同类型判定助手。请根据合同文本判断最匹配的合同类型。',
    '请优先使用候选类型中的值，不要编造新类型。',
    '返回字段：contractType（字符串）、confidence（0-1 之间小数）、reason（简短理由）。',
    '候选类型：{{contractTypeCandidates}}，返回内容要JSON结构',
  ].join('\n'),
  contractFieldExtraction: [
    '你是合同结构化提取助手。',
    '当前合同类型：{{contractType}}。',
    '请严格根据文本提取字段，无法确认请留空，不要臆造。',
    'contractName 优先提取合同封面、首页标题或文中明确出现的正式名称；如果原文标题过于泛化，如“技术合同”“服务合同”“采购合同”“补充协议”，请结合项目名称、标的名称、系统/平台名称、采购内容或服务内容，总结为一个更具体、可区分的合同名称。',
    'contractName 应优先体现项目或标的，不要只返回合同类型本身；如果能识别“XX项目”“XX系统”“XX平台”“XX软件”“XX服务”等关键信息，应组合成类似“XX项目技术服务合同”“XX系统采购合同”的名称。',
    '如果合同中出现甲方/乙方的联系电话、地址、税号、开户行、银行账号、发票类型、法人姓名、法人手机号、法人邮箱、法人身份证号等主体信息，请优先提取到对应字段。',
    '甲方/乙方的“项目联系人/联系人/经办人/联络人/对接人/负责人”等人员信息，分别提取到 partyAContact / partyBContact。',
    '若在联系人信息附近出现手机号、电话（座机/固话）、邮箱（电子信箱）、身份证号，请分别提取到 partyAContactMobile/partyAContactPhone/partyAContactEmail/partyAContactIdNumber 或 partyBContactMobile/partyBContactPhone/partyBContactEmail/partyBContactIdNumber。',
    '号码判断规则：11 位且以 1 开头通常为手机号，包含区号或横线（如 020-xxxxxxx/010-xxxxxxx）通常为座机；无法判断时优先填入 ContactPhone，ContactMobile 留空。',
    '邮箱判断规则：出现“电子信箱/邮箱/E-mail/Email”且归属联系人时填入 ContactEmail；仅当明确写“法人邮箱/法定代表人邮箱”时才填入 LegalRepEmail。',
    '提取开始时间和结束时间，如果字段信息类似时没，租期自2024年3月1日起至2024年12月31日止，那么开始时间是2020-03-01，结束时间是2024-12-31'
  ].join('\n'),
  receiptPlanExtraction: [
    '你是收款计划提取助手。',
    '当前合同类型：{{contractType}}。',
    '请仅提取合同中的收款/付款计划，输出字段只允许出现在 receiptPlans 数组元素内，且字段名必须使用英文键名：period、condition、ratio、amount、plannedDate、direction、planName、frequency、remark。',
    '严禁输出中文键名，如“期次、条件、比例、金额、计划日期、方向、名称、备注”。',
    '如果同一条款同时出现比例和金额，ratio 返回百分比数值，amount 返回明确金额数字，不要带人民币符号、百分号、逗号、方括号或中文大写金额。',
    'direction 只允许返回“收款”或“付款”，不要返回“支付”“回款”“首付款方向”等其他写法；如原文是“甲方向乙方支付”，应返回“付款”。',
    'frequency 表示收付频率，只允许返回候选频率中的 value（候选项格式为 value（label）时，请返回括号前的 value）：{{receiptFrequencyCandidates}}；可以根据文字中的年月季度等关键字眼进行匹配处理，无法确认请留空字符串，不要编造新频率。',
    '已识别签订日期：{{signingDate}}。如果条款明确写了合同签订后/签约后/满一年后若干个工作日内，且能基于该日期可靠推断 plannedDate，请返回 YYYY-MM-DD；无法可靠推断再留空。',
    '如果条款写的是“第一笔付款/第二笔付款/第三笔付款”，period 应保留该原文；如果写的是“首付款”，可放入 planName。',
    '无法确认的字段留空字符串，禁止编造；只有在完全不存在收付款计划条款时才返回空数组。',
    '请严格参考以下输出示例，并保持字段名完全一致：合同内容为第一笔付款在合同签订后收到乙方就合同总价[30]%的金额所提供的合法有效增值税发票，[5]个工作日内，由甲方向乙方支付合同总价[30]%，',
    '计大写人民币[柒万柒仟零肆拾元整]，¥[77040.00]的首付款。第二笔付款合同签订且甲方服务期满一年后，且甲方收到乙方下列全部单据后[ 10 ]个工作日内，向乙方支付合同总价[65]%的款项，计大写人',
    '民币[壹拾陆万陆仟玖佰贰拾元整]，¥[166920.00]：第三笔付款运维期满后[ 10 ]个工作日内，甲方向乙方支付合同总价[30]%的款项，计大写人民币[柒万柒仟零肆拾元整]，¥[77040.00]：',
    '{',
    '  "receiptPlans": [',
    '    {',
    '      "period": "第一笔付款",',
    '      "condition": "合同签订后收到乙方就合同总价30%的金额所提供的合法有效增值税发票，5个工作日内",',
    '      "ratio": 30,',
    '      "amount": 77040,',
    '      "plannedDate": "",',
    '      "direction": "付款",',
    '      "planName": "首付款",',
    '      "frequency": "",',
    '      "remark": ""',
    '    },',
    '    {',
    '      "period": "第二笔付款",',
    '      "condition": "合同签订且甲方服务期满一年后，且甲方收到乙方下列全部单据后10个工作日内",',
    '      "ratio": 65,',
    '      "amount": 166920,',
    '      "plannedDate": "",',
    '      "direction": "付款",',
    '      "planName": "",',
    '      "frequency": "",',
    '      "remark": ""',
    '    }',
    '  ]',
    '}',
    '如果没有任何明确的收款或付款计划，请返回：{"receiptPlans":[]}',
  ].join('\n'),
}

export const CONTRACT_EXTRACTION_SCHEMA: AIStructuredFieldDefinition[] = [
  { key: 'contractName', type: 'string', description: '合同名称；优先使用合同封面/首页正式标题；若标题仅为“技术合同/服务合同/采购合同/补充协议”等泛化名称，请结合项目名称、系统名称、标的名称、采购内容或服务内容，输出可区分的具体名称' },
  { key: 'contractCode', type: 'string', description: '合同编号' },
  { key: 'signingDate', type: 'string', description: '签约日期，格式 YYYY-MM-DD' },
  { key: 'contractType', type: 'string', description: '合同类型' },
  { key: 'clientName', type: 'string', description: '合同甲方名称' },
  { key: 'partyAContact', type: 'string', description: '甲方项目联系人/联系人/负责人姓名' },
  { key: 'partyALegalRepName', type: 'string', description: '甲方法人姓名' },
  { key: 'partyALegalRepMobile', type: 'string', description: '甲方法人联系手机号' },
  { key: 'partyALegalRepEmail', type: 'string', description: '甲方法人邮箱' },
  { key: 'partyALegalRepIdNumber', type: 'string', description: '甲方法人身份证号' },
  { key: 'partyAPhone', type: 'string', description: '甲方单位联系电话/总机（若是联系人手机号或座机请填 partyAContactMobile/partyAContactPhone）' },
  { key: 'partyAAddress', type: 'string', description: '甲方地址' },
  { key: 'partyATaxNumber', type: 'string', description: '甲方税号或统一社会信用代码' },
  { key: 'partyABankName', type: 'string', description: '甲方开户行' },
  { key: 'partyABankAccount', type: 'string', description: '甲方银行账号' },
  { key: 'partyAInvoiceType', type: 'string', description: '甲方发票类型' },
  { key: 'partyBName', type: 'string', description: '合同乙方名称' },
  { key: 'partyBContact', type: 'string', description: '乙方项目联系人/联系人/负责人姓名' },
  { key: 'partyBLegalRepName', type: 'string', description: '乙方法人姓名' },
  { key: 'partyBLegalRepMobile', type: 'string', description: '乙方法人联系手机号' },
  { key: 'partyBLegalRepEmail', type: 'string', description: '乙方法人邮箱' },
  { key: 'partyBLegalRepIdNumber', type: 'string', description: '乙方法人身份证号' },
  { key: 'partyBPhone', type: 'string', description: '乙方单位联系电话/总机（若是联系人手机号或座机请填 partyBContactMobile/partyBContactPhone）' },
  { key: 'partyBAddress', type: 'string', description: '乙方地址' },
  { key: 'partyBTaxNumber', type: 'string', description: '乙方税号或统一社会信用代码' },
  { key: 'partyBBankName', type: 'string', description: '乙方开户行' },
  { key: 'partyBBankAccount', type: 'string', description: '乙方银行账号' },
  { key: 'partyBInvoiceType', type: 'string', description: '乙方发票类型' },
  { key: 'contractSummary', type: 'string', description: '合同摘要' },
]

// 根据云端供应商返回默认 API 基础地址。
export const getDefaultBaseUrl = (provider: AIProvider) => {
  if (provider === 'kimi') return 'https://api.moonshot.cn'
  if (provider === 'minimax') return 'https://api.minimax.chat'
  return 'https://api.deepseek.com'
}

// 构建本地模型的默认配置列表。
export const buildDefaultLocalModels = (): AILocalModelConfig[] => [
  {
    id: 'nuextract-7b',
    displayName: 'NuExtract 7B',
    modelType: 'nuextract-7b',
    runtime: 'llama.cpp',
    modelPath: '',
    executablePath: '',
    contextSize: 4096,
    maxTokens: 1536,
    temperature: 0.1,
    timeoutMs: DEFAULT_AI_TIMEOUT_MS,
    extraArgs: '',
  },
  {
    id: 'qwen25-8b-instruct',
    displayName: 'Qwen 2.5 8B Instruct',
    modelType: 'qwen2.5-8b-instruct',
    runtime: 'llama.cpp',
    modelPath: '',
    executablePath: '',
    contextSize: 4096,
    maxTokens: 1024,
    temperature: 0.1,
    timeoutMs: DEFAULT_AI_TIMEOUT_MS,
    extraArgs: '',
  },
  {
    id: 'qwen25-32b-instruct',
    displayName: 'Qwen 2.5 32B Instruct',
    modelType: 'qwen2.5-32b-instruct',
    runtime: 'llama.cpp',
    modelPath: '',
    executablePath: '',
    contextSize: 4096,
    maxTokens: 1024,
    temperature: 0.1,
    timeoutMs: DEFAULT_AI_TIMEOUT_MS,
    extraArgs: '',
  },
]

export const normalizeAIAgentSettings = (value: Partial<AIAgentSettings> | null | undefined): AIAgentSettings => {
  const availableTools = Array.isArray(value?.availableTools)
    ? value.availableTools
        .map(item => String(item || '').trim())
        .filter((item): item is AIAgentToolName => DEFAULT_AGENT_TOOL_NAMES.includes(item as AIAgentToolName))
    : []

  return {
    modelId: String(value?.modelId || '').trim(),
    enableTools: value?.enableTools !== false,
    compressionThreshold: toPositiveNumber(value?.compressionThreshold, 12),
    availableTools: availableTools.length > 0 ? availableTools : [...DEFAULT_AGENT_TOOL_NAMES],
  }
}

// 将输入归一化为正整数，非法值时回退到默认值。
const toPositiveNumber = (value: unknown, fallback: number) => {
  const num = Number(value)
  if (!Number.isFinite(num) || num <= 0) return fallback
  return Math.floor(num)
}

// 将温度参数限制在 0 到 2 之间。
const toTemperature = (value: unknown, fallback: number) => {
  const num = Number(value)
  if (!Number.isFinite(num)) return fallback
  return Math.max(0, Math.min(2, num))
}

// 将任意时间输入标准化为 ISO 时间字符串。
const toTimestamp = (value: unknown, fallback: string) => {
  const text = String(value || '').trim()
  if (!text) return fallback
  const parsed = new Date(text)
  if (Number.isNaN(parsed.getTime())) return fallback
  return parsed.toISOString()
}

// 清洗提示词文本，空值时使用默认文案。
const normalizePromptText = (value: unknown, fallback: string) => {
  const text = String(value || '').trim()
  return text || fallback
}

const ensureReceiptPlanPromptHasFrequencyField = (template: string) => {
  const text = String(template || '')
  return text.replace(/英文键名：([^\n。]+)/g, (full, listRaw: string) => {
    const list = String(listRaw || '').trim()
    if (!list) return full
    if (/\bfrequency\b/.test(list)) return full
    if (/\bremark\b/.test(list)) {
      const next = list.replace(/([、,，]\s*)remark\b/, '$1frequency$1remark')
      return `英文键名：${next}`
    }
    return `英文键名：${list}、frequency`
  })
}

// 生成提示词模板配置的默认值。
export const getDefaultPromptTemplateConfig = (): AIPromptTemplateConfig => ({
  version: AI_PROMPT_TEMPLATE_VERSION,
  updatedAt: new Date().toISOString(),
  defaultTemplates: { ...DEFAULT_PROMPT_TEMPLATES },
  contractTypeOverrides: {},
})

// 规范化提示词模板配置，过滤无效字段并补齐默认值。
export const normalizePromptTemplateConfig = (
  value: Partial<AIPromptTemplateConfig> | null | undefined,
): AIPromptTemplateConfig => {
  const fallback = getDefaultPromptTemplateConfig()
  const rawDefaultTemplates = value?.defaultTemplates && typeof value.defaultTemplates === 'object'
    ? value.defaultTemplates
    : {}
  const defaultTemplates = AI_PROMPT_TASKS.reduce((acc, task) => {
    const normalized = normalizePromptText((rawDefaultTemplates as Record<string, unknown>)[task], DEFAULT_PROMPT_TEMPLATES[task])
    acc[task] = task === 'receiptPlanExtraction'
      ? ensureReceiptPlanPromptHasFrequencyField(normalized)
      : normalized
    return acc
  }, {} as Record<AIPromptTaskType, string>)

  const rawOverrides = value?.contractTypeOverrides && typeof value.contractTypeOverrides === 'object'
    ? value.contractTypeOverrides
    : {}
  const contractTypeOverrides: Record<string, Partial<Record<AIPromptTaskType, string>>> = {}

  for (const [rawContractType, rawTemplates] of Object.entries(rawOverrides)) {
    const contractType = String(rawContractType || '').trim()
    if (!contractType || !rawTemplates || typeof rawTemplates !== 'object') continue

    const normalizedTemplates: Partial<Record<AIPromptTaskType, string>> = {}
    for (const task of AI_PROMPT_TASKS) {
      const text = String((rawTemplates as Record<string, unknown>)[task] || '').trim()
      if (text) {
        normalizedTemplates[task] = task === 'receiptPlanExtraction'
          ? ensureReceiptPlanPromptHasFrequencyField(text)
          : text
      }
    }
    if (Object.keys(normalizedTemplates).length > 0) {
      contractTypeOverrides[contractType] = normalizedTemplates
    }
  }

  return {
    version: Number(value?.version) > 0 ? Number(value?.version) : fallback.version,
    updatedAt: toTimestamp(value?.updatedAt, fallback.updatedAt),
    defaultTemplates,
    contractTypeOverrides,
  }
}

// 按任务类型和合同类型解析最终要使用的提示词模板。
export const resolvePromptTemplate = (
  config: AIPromptTemplateConfig,
  task: AIPromptTaskType,
  contractType?: string | null,
) => {
  const normalized = normalizePromptTemplateConfig(config)
  const contractTypeKey = String(contractType || '').trim()
  if (contractTypeKey) {
    const override = normalized.contractTypeOverrides[contractTypeKey]?.[task]
    if (override && String(override).trim()) {
      return String(override).trim()
    }
  }
  return normalized.defaultTemplates[task]
}

// 去掉路径或参数首尾包裹的引号。
const stripWrappingQuotes = (value: string) => {
  const trimmed = String(value || '').trim()
  if (trimmed.length >= 2) {
    const first = trimmed[0]
    const last = trimmed[trimmed.length - 1]
    if ((first === '"' && last === '"') || (first === '\'' && last === '\'')) {
      return trimmed.slice(1, -1).trim()
    }
  }
  return trimmed
}

// 规范化单个本地模型配置。
export const normalizeLocalModel = (
  value: Partial<AILocalModelConfig> | null | undefined,
  index = 0,
): AILocalModelConfig => {
  const fallback = buildDefaultLocalModels()[index] || buildDefaultLocalModels()[0]
  const displayName = String(value?.displayName || fallback.displayName).trim() || fallback.displayName
  const modelType = String(value?.modelType || fallback.modelType).trim() || fallback.modelType

  return {
    id: String(value?.id || fallback.id || `local-model-${index + 1}`).trim() || `local-model-${index + 1}`,
    displayName,
    modelType,
    runtime: 'llama.cpp',
    modelPath: stripWrappingQuotes(String(value?.modelPath || '')),
    executablePath: stripWrappingQuotes(String(value?.executablePath || '')),
    contextSize: toPositiveNumber(value?.contextSize, fallback.contextSize),
    maxTokens: toPositiveNumber(value?.maxTokens, fallback.maxTokens),
    temperature: toTemperature(value?.temperature, fallback.temperature),
    timeoutMs: toPositiveNumber(value?.timeoutMs, fallback.timeoutMs),
    extraArgs: String(value?.extraArgs || '').trim(),
  }
}

// 规范化本地模型列表，并按 id 去重。
export const normalizeLocalModels = (value: unknown): AILocalModelConfig[] => {
  const items = Array.isArray(value) ? value : []
  const models = items
    .map((item, index) => normalizeLocalModel((item || {}) as Partial<AILocalModelConfig>, index))
    .filter((item, index, list) => list.findIndex(candidate => candidate.id === item.id) === index)

  return models.length > 0 ? models : buildDefaultLocalModels()
}

// 规范化 AI 设置，兼容旧字段并补齐默认配置。
export const normalizeAISettings = (value: Partial<AISettings> | null | undefined): AISettings => {
  const provider: AIProvider = value?.provider === 'minimax' || value?.provider === 'deepseek' || value?.provider === 'kimi'
    ? value.provider
    : 'kimi'
  const localModels = normalizeLocalModels(value?.localModels)
  const selectedModelId = String(value?.selectedModelId || '').trim()
  const hasSelectedModel = localModels.some(item => item.id === selectedModelId)

  const normalizedPromptTemplates = normalizePromptTemplateConfig(value?.promptTemplates)
  const legacyPrompt = String(value?.contractPrompt || '').trim()
  if (legacyPrompt) {
    normalizedPromptTemplates.defaultTemplates.contractFieldExtraction = legacyPrompt
  }

  return {
    enabled: Boolean(value?.enabled),
    mode: value?.mode === 'local' ? 'local' : 'cloud',
    provider,
    apiKey: String(value?.apiKey || '').trim(),
    baseUrl: String(value?.baseUrl || '').trim() || getDefaultBaseUrl(provider),
    selectedModelId: hasSelectedModel ? selectedModelId : localModels[0].id,
    localModels,
    timeoutMs: toPositiveNumber(value?.timeoutMs, DEFAULT_AI_TIMEOUT_MS),
    structuredOutput: value?.structuredOutput !== false,
    contractPrompt: normalizedPromptTemplates.defaultTemplates.contractFieldExtraction || DEFAULT_CONTRACT_PROMPT,
    promptTemplates: normalizedPromptTemplates,
    agentSettings: normalizeAIAgentSettings(value?.agentSettings),
    ragEnabled: value?.ragEnabled !== false,
    embeddingModelPath: stripWrappingQuotes(String(value?.embeddingModelPath || '')),
    embeddingExecutablePath: stripWrappingQuotes(String(value?.embeddingExecutablePath || '')),
    embeddingDimension: toPositiveNumber(value?.embeddingDimension, DEFAULT_EMBEDDING_DIMENSION),
    retrievalTopK: toPositiveNumber(value?.retrievalTopK, DEFAULT_RETRIEVAL_TOP_K),
    retrievalScoreThreshold: (() => {
      const num = Number(value?.retrievalScoreThreshold)
      if (!Number.isFinite(num)) return DEFAULT_RETRIEVAL_SCORE_THRESHOLD
      return Math.max(0, Math.min(1, num))
    })(),
    localSmallModelMaxContextChars: toPositiveNumber(
      value?.localSmallModelMaxContextChars,
      DEFAULT_LOCAL_SMALL_MODEL_MAX_CONTEXT_CHARS,
    ),
    localSmallModelFieldGroupMode: value?.localSmallModelFieldGroupMode === 'single-pass'
      ? 'single-pass'
      : 'grouped',
  }
}

// 将字段 schema 和源文本组装为结构化提取提示词。
export const buildStructuredPrompt = (
  prompt: string,
  sourceText: string,
  schema: AIStructuredFieldDefinition[],
) => {
  const schemaText = schema
    .map(field => `- ${field.key}: ${field.type}${field.required ? '，必填' : ''}，${field.description}`)
    .join('\n')

  return [
    prompt.trim(),
    '',
    '请严格遵守以下规则：',
    '1. 只返回一个 JSON 对象，不要输出解释、Markdown、代码块或额外文本。',
    '2. 如果字段缺失，请返回空字符串或省略该字段，不要编造内容。',
    '3. 日期统一使用 YYYY-MM-DD 格式。',
    '4. 输出字段仅允许来自下方列表。',
    '',
    '目标字段：',
    schemaText,
    '',
    '源文本：',
    sourceText.trim(),
  ].join('\n')
}

// 去掉模型响应中可能包裹的 Markdown 代码块标记。
export const stripMarkdownCodeFence = (text: string) => {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)
  return (fenced ? fenced[1] : text).trim()
}

// 判断一段文本是否可以被直接解析为 JSON。
const tryParseJson = (value: string): boolean => {
  try {
    JSON.parse(value)
    return true
  } catch {
    return false
  }
}

// 从文本中提取首个括号配对完整且可解析的 JSON 片段。
const extractBalancedJson = (text: string, openChar: '{' | '[', closeChar: '}' | ']') => {
  let inString = false
  let escapeNext = false

  for (let start = 0; start < text.length; start += 1) {
    if (text[start] !== openChar) continue

    let depth = 0
    inString = false
    escapeNext = false

    for (let i = start; i < text.length; i += 1) {
      const ch = text[i]

      if (inString) {
        if (escapeNext) {
          escapeNext = false
          continue
        }
        if (ch === '\\') {
          escapeNext = true
          continue
        }
        if (ch === '"') {
          inString = false
        }
        continue
      }

      if (ch === '"') {
        inString = true
        continue
      }

      if (ch === openChar) {
        depth += 1
      } else if (ch === closeChar) {
        depth -= 1
        if (depth === 0) {
          const candidate = text.slice(start, i + 1).trim()
          if (candidate && tryParseJson(candidate)) {
            return candidate
          }
          break
        }
      }
    }
  }

  return ''
}

// 从模型原始输出中尽量提取出可解析的 JSON 文本。
export const extractJsonText = (text: string) => {
  const cleaned = stripMarkdownCodeFence(String(text || '').trim())
  if (!cleaned) return ''

  const objectCandidate = extractBalancedJson(cleaned, '{', '}')
  if (objectCandidate) {
    return objectCandidate
  }

  const arrayCandidate = extractBalancedJson(cleaned, '[', ']')
  if (arrayCandidate) {
    return arrayCandidate
  }

  if (tryParseJson(cleaned)) {
    return cleaned
  }

  return cleaned
}

// 在提取 JSON 片段后执行解析，统一处理常见包裹格式。
export const safeJsonParse = <T = Record<string, unknown>>(text: string): T => {
  return JSON.parse(extractJsonText(text)) as T
}

function repairJsonSuffix(text: string): string {
  const source = String(text || '').trim()
  if (!source) return source

  let inString = false
  let escapeNext = false
  const stack: string[] = []
  let repaired = source.replace(/```+\s*$/g, '').trim()

  for (let i = 0; i < repaired.length; i += 1) {
    const ch = repaired[i]
    if (inString) {
      if (escapeNext) {
        escapeNext = false
        continue
      }
      if (ch === '\\') {
        escapeNext = true
        continue
      }
      if (ch === '"') {
        inString = false
      }
      continue
    }

    if (ch === '"') {
      inString = true
      continue
    }
    if (ch === '{') stack.push('}')
    else if (ch === '[') stack.push(']')
    else if ((ch === '}' || ch === ']') && stack[stack.length - 1] === ch) stack.pop()
  }

  if (inString) repaired += '"'
  while (/[,:]\s*$/.test(repaired)) {
    repaired = repaired.replace(/[,:]\s*$/, '').trimEnd()
  }
  if (repaired.endsWith(',')) repaired = repaired.slice(0, -1)
  return repaired + stack.reverse().join('')
}

export const tryRepairAndParseJson = <T = Record<string, unknown>>(text: string): { parsed?: T; repairedText?: string } => {
  const extracted = extractJsonText(text)
  if (!extracted) return {}
  try {
    return { parsed: JSON.parse(extracted) as T, repairedText: extracted }
  } catch {}

  const repaired = repairJsonSuffix(extracted)
  try {
    return { parsed: JSON.parse(repaired) as T, repairedText: repaired }
  } catch {
    return { repairedText: repaired }
  }
}

// 按字段 schema 校验并清洗结构化数据。
export const validateStructuredData = (
  value: unknown,
  schema: AIStructuredFieldDefinition[],
): { data: Record<string, unknown>; validationErrors: string[] } => {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {}
  const data: Record<string, unknown> = {}
  const validationErrors: string[] = []

  for (const field of schema) {
    const rawValue = source[field.key]

    if (rawValue === undefined || rawValue === null || rawValue === '') {
      if (field.required) {
        validationErrors.push(`缺少字段：${field.key}`)
      }
      continue
    }

    if (field.type === 'string') {
      const normalized = String(rawValue).trim()
      if (!normalized) {
        if (field.required) validationErrors.push(`字段为空：${field.key}`)
        continue
      }
      data[field.key] = normalized
      continue
    }

    if (field.type === 'number') {
      const normalized = Number(rawValue)
      if (!Number.isFinite(normalized)) {
        validationErrors.push(`字段类型错误：${field.key} 应为 number`)
        continue
      }
      data[field.key] = normalized
      continue
    }

    if (field.type === 'boolean') {
      data[field.key] = typeof rawValue === 'boolean' ? rawValue : String(rawValue).trim().toLowerCase() === 'true'
      continue
    }

    if (field.type === 'array') {
      if (!Array.isArray(rawValue)) {
        validationErrors.push(`字段类型错误：${field.key} 应为 array`)
        continue
      }
      data[field.key] = rawValue
      continue
    }

    if (typeof rawValue !== 'object' || Array.isArray(rawValue)) {
      validationErrors.push(`字段类型错误：${field.key} 应为 object`)
      continue
    }

    data[field.key] = rawValue
  }

  return { data, validationErrors }
}

// 校验合同关键信息提取结果。
export const validateContractExtraction = (value: unknown) => {
  const result = validateStructuredData(value, CONTRACT_EXTRACTION_SCHEMA)
  return {
    data: result.data as AIContractExtractionResult,
    validationErrors: result.validationErrors,
  }
}

// 将命令行风格的 JSON 参数字符串拆分为参数数组。
export const parseJsonArgString = (value: string) => {
  const input = String(value || '').trim()
  if (!input) return []
  const matches = input.match(/"[^"]*"|'[^']*'|\S+/g) || []
  return matches.map(item => item.replace(/^['"]|['"]$/g, ''))
}
