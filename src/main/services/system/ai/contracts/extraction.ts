import * as fs from 'fs';
import { FileConversionService } from '../../../file/FileConversionService';
import {
  AIExtractContractInfoRequest,
  AIExtractedReceiptPlan,
  AISettings,
  AIPromptTemplateConfig,
  AIStructuredFieldDefinition,
  AIStructuredGenerateResult,
} from '../../../../../shared/types/ai.types';
import type {
  ContractFormSchema,
  ContractFormSchemaConfig,
  ContractFormSchemaField,
} from '../../../../../shared/types/contractFormSchema.types';
import {
  CONTRACT_EXTRACTION_SCHEMA,
  normalizePromptTemplateConfig,
  resolvePromptTemplate,
} from '../../../../../shared/utils/ai';
import {
  normalizeContractFormSchemaConfig,
  resolveContractFormSchema,
} from '../../../../../shared/utils/contractFormSchema';
import { logger, ContractTypeCandidateEntry } from '../shared';

/**
 * 使用变量表替换提示词模板中的占位符，生成最终提示词文本。
 */
export function renderPromptTemplate(template: string, variables: Record<string, string>): string {
  return Object.entries(variables).reduce((acc, [key, value]) => {
    return acc.replace(new RegExp(`{{\\s*${key}\\s*}}`, 'g'), value);
  }, String(template || '').trim());
}

/**
 * 归一化合同类型候选项，按“显式候选 > 旧字段候选 > schema 配置”的顺序收集并去重。
 */
export function normalizeContractTypeCandidates(
  request: AIExtractContractInfoRequest,
): ContractTypeCandidateEntry[] {
  const entries: ContractTypeCandidateEntry[] = [];
  const appendEntry = (codeValue: unknown, nameValue: unknown) => {
    const code = String(codeValue || '').trim();
    const name = String(nameValue || '').trim();
    if (!code && !name) return;
    entries.push({
      code: code || name,
      name: name || code,
    });
  };

  if (Array.isArray(request.contractTypeCandidateEntries) && request.contractTypeCandidateEntries.length > 0) {
    request.contractTypeCandidateEntries.forEach((item) => appendEntry(item?.code, item?.name));
  }

  if (entries.length === 0) {
    const directCandidates = Array.isArray(request.contractTypeCandidates)
      ? request.contractTypeCandidates.map(item => String(item || '').trim()).filter(Boolean)
      : [];
    directCandidates.forEach((value) => appendEntry(value, value));
  }

  if (entries.length === 0) {
    const config = request.schemaConfig
      ? normalizeContractFormSchemaConfig(request.schemaConfig)
      : normalizeContractFormSchemaConfig(undefined);
    const schemaCandidates = Object.keys(config.schemasByContractType || {})
      .map(item => String(item || '').trim())
      .filter(Boolean);
    schemaCandidates.forEach((value) => appendEntry(value, value));
  }

  const uniqueMap = new Map<string, ContractTypeCandidateEntry>();
  entries.forEach((item) => {
    const key = `${item.code}::${item.name}`;
    if (!uniqueMap.has(key)) uniqueMap.set(key, item);
  });
  return Array.from(uniqueMap.values());
}

/**
 * 将合同类型候选项格式化为可读文本，用于拼接到提示词中。
 */
export function buildContractTypeCandidatesText(candidates: ContractTypeCandidateEntry[]): string {
  if (!Array.isArray(candidates) || candidates.length === 0) {
    return '无预设候选，请给出最合理的合同类型';
  }
  return candidates
    .map((item) => {
      const code = String(item.code || '').trim();
      const name = String(item.name || '').trim();
      if (code && name && code !== name) return `${code}（${name}）`;
      return code || name;
    })
    .filter(Boolean)
    .join('、');
}

/**
 * 将模型返回的合同类型与候选列表做匹配，优先返回候选中的标准 code。
 */
export function matchContractTypeCandidate(rawType: string, candidates: ContractTypeCandidateEntry[]): string {
  const value = String(rawType || '').trim();
  if (!value) return '';
  const normalized = value.toLowerCase();

  const exactCode = candidates.find((item) => String(item.code || '').trim() === value);
  if (exactCode) return exactCode.code;

  const exactName = candidates.find((item) => String(item.name || '').trim() === value);
  if (exactName) return exactName.code;

  const exactIgnoreCaseCode = candidates.find((item) => String(item.code || '').trim().toLowerCase() === normalized);
  if (exactIgnoreCaseCode) return exactIgnoreCaseCode.code;

  const exactIgnoreCaseName = candidates.find((item) => String(item.name || '').trim().toLowerCase() === normalized);
  if (exactIgnoreCaseName) return exactIgnoreCaseName.code;

  const include = candidates.find((item) => {
    const code = String(item.code || '').trim();
    const name = String(item.name || '').trim();
    return (code && (code.includes(value) || value.includes(code)))
      || (name && (name.includes(value) || value.includes(name)));
  });
  return include?.code || value;
}

/**
 * 从合同文本中提取主信息上下文。
 */
export function buildPrimaryContractContext(fileContent: string): string {
  return String(fileContent || '').replace(/\r/g, '').trim();
}

/**
 * 判断合同类型是否属于买卖/采购类，便于触发标的明细增强提取。
 */
export function isSaleLikeContractType(contractType: string): boolean {
  const text = String(contractType || '').trim().toLowerCase();
  if (!text) return false;
  return [
    'purchase',
    'procurement',
    'sale',
    'sales',
    'supply',
    'buy',
    'sell',
    '买卖',
    '采购',
    '购销',
    '供货',
    '销售',
    '货物',
    '设备采购',
    '软件采购',
  ].some(keyword => text.includes(keyword));
}

/**
 * 将表单字段类型映射为结构化生成接口使用的字段类型。
 */
function mapFieldTypeToModelType(field: ContractFormSchemaField): 'string' | 'number' | 'array' {
  if (field.type === 'number') return 'number';
  if (field.type === 'multiselect') return 'array';
  return 'string';
}

/**
 * 根据合同类型解析动态表单 schema，并与内置提取 schema 合并成模型使用的字段定义。
 */
export function buildDynamicExtractionSchema(
  schemaConfig: ContractFormSchemaConfig | undefined,
  contractType: string,
  fieldOptionEntries?: Record<string, Array<{ value: string; label?: string }>>,
): { resolvedSchema: ContractFormSchema; schema: AIStructuredFieldDefinition[] } {
  const normalizedConfig = normalizeContractFormSchemaConfig(schemaConfig);
  const resolvedSchema = resolveContractFormSchema(normalizedConfig, contractType);
  const saleLikeContract = isSaleLikeContractType(contractType);
  const MAX_OPTION_ITEMS = 80;
  const formatOptionText = (entry: { value: string; label?: string }) => {
    const value = String(entry.value || '').trim();
    const label = String(entry.label || '').trim();
    if (!value) return '';
    if (label && label !== value) return `${value}（${label}）`;
    return value;
  };
  const buildOptionsSuffix = (fieldKey: string) => {
    const options = fieldOptionEntries?.[fieldKey];
    if (!Array.isArray(options) || options.length === 0) return '';
    const rendered = options.map(formatOptionText).filter(Boolean);
    if (rendered.length === 0) return '';
    const limited = rendered.slice(0, MAX_OPTION_ITEMS);
    const suffix = limited.join('、');
    if (rendered.length > MAX_OPTION_ITEMS) {
      return `；可选值：${suffix}…（共${rendered.length}项）`;
    }
    return `；可选值：${suffix}`;
  };
  const dynamicFields = resolvedSchema.fields
    .filter(field => field.visible)
    .map((field): AIStructuredFieldDefinition => {
      const aiPrompt = String((field as { aiPrompt?: unknown }).aiPrompt || '').trim();
      const aiPromptSuffix = aiPrompt ? `；提取提示：${aiPrompt}` : '';
      return {
        key: field.key,
        type: mapFieldTypeToModelType(field),
        description: `${field.label || field.key}${buildOptionsSuffix(field.key)}${aiPromptSuffix}`,
      };
    });

  const mergedMap = new Map<string, AIStructuredFieldDefinition>();
  CONTRACT_EXTRACTION_SCHEMA.forEach(field => mergedMap.set(field.key, { ...field }));
  dynamicFields.forEach(field => {
    if (!mergedMap.has(field.key)) {
      mergedMap.set(field.key, field);
    }
  });
  if (saleLikeContract) {
    const summaryField = mergedMap.get('contractSummary');
    if (summaryField) {
      mergedMap.set('contractSummary', {
        ...summaryField,
        description: `${summaryField.description}；若属于买卖/采购/供货/销售类合同，请优先提取采购标的明细；如正文或附件表格存在多列，请保留原表头语义，contractSummary 优先输出为 Markdown 表格，列名按文档实际出现的列动态展示，不要固定成统一列`,
      });
    }
    mergedMap.set('saleSubjectItems', {
      key: 'saleSubjectItems',
      type: 'array',
      description: '买卖/采购类合同的标的明细数组。若原文存在表格，请按原表头逐行返回对象，保留文档中的列名和列顺序，例如“序号、货物名称、规格型号、单位、数量、含税单价、价税合计”等有什么列就返回什么列；不要固定为统一字段名。若原文没有表头，再按最合理的键值对返回',
    });
  }
  if (fieldOptionEntries) {
    Array.from(mergedMap.entries()).forEach(([key, field]) => {
      const suffix = buildOptionsSuffix(key);
      if (!suffix) return;
      if (String(field.description || '').includes('可选值')) return;
      mergedMap.set(key, { ...field, description: `${field.description || key}${suffix}` });
    });
  }

  return {
    resolvedSchema,
    schema: Array.from(mergedMap.values()),
  };
}

/**
 * 调用结构化生成能力判定合同类型，并返回原始结果、映射后的标准类型及置信度。
 */
export async function classifyContractType(params: {
  config: AISettings;
  fileContent: string;
  fileId: string;
  candidates: ContractTypeCandidateEntry[];
  generateStructured: <T = Record<string, unknown>>(request: {
    scene: string;
    fileId?: string;
    prompt: string;
    sourceText: string;
    schema: AIStructuredFieldDefinition[];
  }) => Promise<AIStructuredGenerateResult<T>>;
}): Promise<{ rawContractType: string; resolvedContractType: string; confidence?: number; reason?: string }> {
  const promptTemplate = resolvePromptTemplate(params.config.promptTemplates, 'contractTypeClassification');
  const prompt = renderPromptTemplate(promptTemplate, {
    contractTypeCandidates: buildContractTypeCandidatesText(params.candidates),
    contractType: '',
    fieldList: '',
  });

  const classifyResult = await params.generateStructured<{ contractType?: string; confidence?: number; reason?: string }>({
    scene: 'contract-type-classification',
    fileId: params.fileId,
    prompt,
    sourceText: params.fileContent,
    schema: [
      { key: 'contractType', type: 'string', description: '合同类型', required: true },
      { key: 'confidence', type: 'number', description: '判定置信度（0-1）' },
      { key: 'reason', type: 'string', description: '判定依据（简短）' },
    ],
  });

  if (!classifyResult.ok || !classifyResult.data) {
    const errorMessage = classifyResult.validationErrors?.length
      ? `${classifyResult.error || '合同类型判定失败'}：${classifyResult.validationErrors.join('；')}`
      : classifyResult.error || '合同类型判定失败';
    throw new Error(errorMessage);
  }

  const rawContractType = String(classifyResult.data.contractType || '').trim();
  if (!rawContractType) {
    throw new Error('合同类型判定结果为空');
  }

  const resolvedContractType = matchContractTypeCandidate(rawContractType, params.candidates);
  const confidence = Number(classifyResult.data.confidence);
  return {
    rawContractType,
    resolvedContractType,
    confidence: Number.isFinite(confidence) ? confidence : undefined,
    reason: String(classifyResult.data.reason || '').trim() || undefined,
  };
}

/**
 * 将收付款方向文本归一化为“付款”或“收款”。
 */
function normalizeReceiptPlanDirection(value: unknown): string {
  const text = String(value || '').trim();
  if (!text) return '';
  if (/甲方.*(?:支付|付款|付给).*乙方/.test(text)) return '付款';
  if (/乙方.*(?:支付|付款|付给).*甲方/.test(text)) return '收款';
  if (text.includes('付')) return '付款';
  if (text.includes('收')) return '收款';
  return '';
}

/**
 * 从宽松格式的金额、比例等文本中提取数字，忽略货币符号、括号和百分号等噪声。
 */
function parseLooseNumber(value: unknown): number | undefined {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : undefined;
  }
  const text = String(value || '').trim();
  if (!text) return undefined;
  const normalized = text
    .replace(/[¥￥,\s，]/g, '')
    .replace(/[\[\]()（）]/g, '')
    .replace(/%/g, '');
  const match = normalized.match(/-?\d+(?:\.\d+)?/);
  if (!match) return undefined;
  const num = Number(match[0]);
  return Number.isFinite(num) ? num : undefined;
}

/**
 * 将 ISO 日期字符串解析为本地 Date 对象；格式不合法时返回 null。
 */
function parseIsoDate(value: unknown): Date | null {
  const text = String(value || '').trim();
  const match = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day, 12, 0, 0, 0);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * 将 Date 对象格式化为 YYYY-MM-DD 字符串。
 */
function formatIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * 在给定日期基础上累加工作日，自动跳过周六和周日。
 */
function addBusinessDays(baseDate: Date, businessDays: number): Date {
  const result = new Date(baseDate);
  let remaining = Math.max(0, Math.floor(businessDays));
  while (remaining > 0) {
    result.setDate(result.getDate() + 1);
    const day = result.getDay();
    if (day !== 0 && day !== 6) {
      remaining -= 1;
    }
  }
  return result;
}

/**
 * 根据付款条件中的相对时间描述推断计划日期，例如“签订后 10 个工作日内”。
 */
function inferReceiptPlanDateFromCondition(condition: string, signingDate?: string): string | undefined {
  const baseDate = parseIsoDate(signingDate);
  const text = String(condition || '').trim();
  if (!baseDate || !text) return undefined;

  const hasSigningAnchor = /(合同签订|签订后|签约后)/.test(text);
  const hasOneYearAnchor = /(服务期满一年|满一年|一年后)/.test(text);
  if (!hasSigningAnchor && !hasOneYearAnchor) return undefined;

  const anchor = new Date(baseDate);
  if (hasOneYearAnchor) {
    anchor.setFullYear(anchor.getFullYear() + 1);
  }

  const workdayMatch = text.match(/\[?\s*(\d+)\s*\]?\s*个工作日内/);
  if (workdayMatch) {
    return formatIsoDate(addBusinessDays(anchor, Number(workdayMatch[1])));
  }

  return hasSigningAnchor || hasOneYearAnchor ? formatIsoDate(anchor) : undefined;
}

/**
 * 将模型返回的收付款计划数组清洗并归一化为统一结构。
 */
export function normalizeReceiptPlanItems(
  value: unknown,
  options?: { signingDate?: string; fileId?: string },
): AIExtractedReceiptPlan[] {
  if (!Array.isArray(value)) return [];
  const rows: AIExtractedReceiptPlan[] = [];

  for (const item of value) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
    const row = item as Record<string, unknown>;
    const period = String(row.period || row.phase || row.installment || row.stage || row['期次'] || '').trim();
    const condition = String(
      row.condition || row.trigger || row.requirement || row['触发条件'] || row['付款条件'] || row['收款条件'] || '',
    ).trim();
    const planName = String(
      row.planName || row.plan_name || row.name || row.title || row['名称'] || row['收款名称'] || row['付款名称'] || '',
    ).trim();
    const remark = String(row.remark || row['备注'] || row['说明'] || '').trim();
    const direction = normalizeReceiptPlanDirection(row.direction || row['方向'] || row['合同收付方向']);
    const frequency = String(
      row.frequency
      || row.receiptFrequency
      || row.receipt_frequency
      || row.frequencyType
      || row['收付频率']
      || row['收付频率']
      || '',
    ).trim();

    const ratio = parseLooseNumber(row.ratio ?? row.percentage ?? row.percent ?? row.paymentRatio ?? row['比例']);
    const ratioValue = ratio !== undefined && ratio >= 0 ? ratio : undefined;
    const amount = parseLooseNumber(
      row.amount
      ?? row.expected_amount
      ?? row.expectedAmount
      ?? row.paymentAmount
      ?? row.money
      ?? row.totalAmount
      ?? row['金额'],
    );
    const amountValue = amount !== undefined && amount >= 0 ? amount : undefined;

    const plannedDateRaw = String(
      row.plannedDate
      || row.planDate
      || row.expectedDate
      || row.expected_date
      || row.paymentDate
      || row['计划日期']
      || '',
    ).trim();
    let plannedDate = /^\d{4}-\d{2}-\d{2}$/.test(plannedDateRaw) ? plannedDateRaw : '';
    if (!plannedDate) {
      plannedDate = inferReceiptPlanDateFromCondition(condition || remark || planName, options?.signingDate) || '';
    }

    if (!period && !condition && !planName && !remark && !direction && ratioValue === undefined && amountValue === undefined && !plannedDate) {
      continue;
    }

    rows.push({
      period: period || undefined,
      condition: condition || undefined,
      ratio: ratioValue,
      amount: amountValue,
      plannedDate: plannedDate || undefined,
      direction: direction || undefined,
      planName: planName || undefined,
      frequency: frequency || undefined,
      remark: remark || undefined,
    });
  }

  return rows;
}

/**
 * 调用结构化生成能力提取收付款计划，并对结果做标准化处理。
 */
export async function extractReceiptPlans(params: {
  promptTemplates: AIPromptTemplateConfig;
  fileContent: string;
  fileId: string;
  contractType: string;
  contractTypeCandidatesText: string;
  receiptFrequencyCandidatesText?: string;
  signingDate?: string;
  generateStructured: <T = Record<string, unknown>>(request: {
    scene: string;
    fileId?: string;
    prompt: string;
    sourceText: string;
    schema: AIStructuredFieldDefinition[];
  }) => Promise<AIStructuredGenerateResult<T>>;
}): Promise<AIExtractedReceiptPlan[]> {
  const receiptPromptTemplate = resolvePromptTemplate(
    params.promptTemplates,
    'receiptPlanExtraction',
    params.contractType,
  );
  const receiptFrequencyCandidates = String(params.receiptFrequencyCandidatesText || '').trim();
  let receiptPrompt = renderPromptTemplate(receiptPromptTemplate, {
    contractTypeCandidates: params.contractTypeCandidatesText,
    contractType: params.contractType,
    fieldList: 'receiptPlans(period, condition, ratio, amount, plannedDate, direction, planName, frequency, remark)',
    signingDate: String(params.signingDate || '').trim() || '未知',
    receiptFrequencyCandidates: receiptFrequencyCandidates || '未提供候选频率',
  });
  if (receiptFrequencyCandidates && !receiptPromptTemplate.includes('{{receiptFrequencyCandidates}}')) {
    receiptPrompt += `\nfrequency 表示收付频率，只允许返回候选频率中的 value（候选项格式为 value（label）时，请返回括号前的 value）：${receiptFrequencyCandidates}；无法确认请留空字符串。`;
  }
  const receiptStructured = await params.generateStructured<{ receiptPlans?: unknown[] }>({
    scene: 'receipt-plan-extraction',
    fileId: params.fileId,
    prompt: receiptPrompt,
    sourceText: params.fileContent,
    schema: [
      { key: 'receiptPlans', type: 'array', description: '收款计划数组，元素包含期次、条件、比例、金额、计划日期、方向、名称、收付频率、备注' },
    ],
  });

  if (!receiptStructured.ok) {
    logger.warn('收款计划提取失败调试信息', {
      fileId: params.fileId,
      contractType: params.contractType,
      signingDate: params.signingDate || '',
      error: receiptStructured.error,
      validationErrors: receiptStructured.validationErrors,
      rawData: receiptStructured.data,
    });
    const message = receiptStructured.validationErrors?.length
      ? `${receiptStructured.error || '收款计划提取失败'}：${receiptStructured.validationErrors.join('；')}`
      : (receiptStructured.error || '收款计划提取失败');
    throw new Error(message);
  }

  const normalizedRows = normalizeReceiptPlanItems(receiptStructured.data?.receiptPlans || [], {
    signingDate: params.signingDate,
    fileId: params.fileId,
  });
  logger.info('收款计划提取结果调试信息', {
    fileId: params.fileId,
    contractType: params.contractType,
    signingDate: params.signingDate || '',
    rawReceiptPlans: receiptStructured.data?.receiptPlans || [],
    normalizedReceiptPlans: normalizedRows,
  });
  return normalizedRows;
}

/**
 * 从文件中提取 markdown 文本内容。
 */
export async function extractTextFromFile(filePath: string): Promise<string> {
  if (!fs.existsSync(filePath)) {
    throw new Error(`文件不存在: ${filePath}`);
  }

  try {
    const conversionResult = await FileConversionService.getInstance().convertToMarkdown(filePath);
    const content = conversionResult.markdown || '';

    const normalized = content.trim();
    if (!normalized) {
      throw new Error('文件内容为空');
    }

    return normalized;
  } catch (error) {
    logger.error('读取文件并提取文本失败:', error);
    throw new Error('读取文件并提取文本失败，可能是不受支持的格式或文件损坏');
  }
}

/**
 * 读取并规范化 AI 提示词模板配置，确保后续调用使用统一结构。
 */
export function getNormalizedPromptTemplates(config: AISettings): AIPromptTemplateConfig {
  return normalizePromptTemplateConfig(config.promptTemplates);
}
