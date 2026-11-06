import {
  AIContractExtractionResult,
  AIExtractContractInfoRequest,
  AIExtractedReceiptPlan,
  AILocalModelValidationRequest,
  AILocalModelValidationResult,
  AIStructuredFieldDefinition,
  AIStructuredGenerateMeta,
  AIStructuredGenerateRequest,
  AIStructuredGenerateResult,
  AITestConnectionRequest,
  AITestConnectionResult,
} from '../../../../shared/types/ai.types';
import type { ContractFormSchemaConfig, ContractFormSchemaField } from '../../../../shared/types/contractFormSchema.types';
import {
  buildStructuredPrompt,
  DEFAULT_CLOUD_TIMEOUT_MS,
  extractJsonText,
  getDefaultBaseUrl,
  normalizeLocalModel,
  resolvePromptTemplate,
  safeJsonParse,
  tryRepairAndParseJson,
  validateContractExtraction,
  validateStructuredData,
} from '../../../../shared/utils/ai';
import {
  normalizeContractFormSchemaConfig,
  resolveContractFormSchema,
} from '../../../../shared/utils/contractFormSchema';
import { DatabaseService } from '../DatabaseService';
import {
  canUseKimiFileExtraction,
  executeCloudStructured,
  extractTextViaKimiFile,
} from './cloud/client';
import { ensureAIEnabled, getAIConfig, getSelectedLocalModel } from './config';
import {
  buildContractTypeCandidatesText,
  buildDynamicExtractionSchema,
  buildPrimaryContractContext,
  classifyContractType,
  extractReceiptPlans,
  extractTextFromFile,
  getNormalizedPromptTemplates,
  isSaleLikeContractType,
  normalizeContractTypeCandidates,
  renderPromptTemplate,
} from './contracts/extraction';
import {
  buildContractChunks,
  buildChunkedContext,
  selectChunksForFields,
} from './contracts/chunking';
import type { ContractFieldEvidenceRecord } from '../database/aiLog';
import {
  appendTestLogResult,
  createTestLog,
  logStructuredGenerationResult,
  logStructuredGenerationStart,
  normalizeLocalLogOutput,
} from './logging/serviceLogging';
import {
  executeLocalStructured,
  executeLocalStructuredWithOptions,
  extractLocalPreviewText,
  extractLocalResponseText,
  probeLocalModel,
  validateLocalModel,
} from './local/runtime';
import { logger } from './shared';
import * as path from 'path';
import { PdfOcrService } from '../../file/PdfOcrService';
import type { OcrTextBlock } from '../../file/pdfOcr/paddleOcr';
import { ContractVectorStoreService } from './rag/ContractVectorStoreService';
import { RagRetrievalService } from './rag/RagRetrievalService';
import { EmbeddingService } from './embedding/EmbeddingService';

export class AIService {
  private static instance: AIService;

  private constructor() {}

  public static getInstance(): AIService {
    if (!AIService.instance) {
      AIService.instance = new AIService();
    }
    return AIService.instance;
  }

  public async generateStructured<T = Record<string, unknown>>(
    request: AIStructuredGenerateRequest,
  ): Promise<AIStructuredGenerateResult<T>> {
    const config = getAIConfig();
    ensureAIEnabled(config, request.fileId || '');

    const startedAt = Date.now();
    const meta: AIStructuredGenerateMeta = {
      mode: config.mode,
      elapsedMs: 0,
    };

    if (config.mode === 'cloud') {
      meta.provider = config.provider;
    } else {
      const selectedModel = getSelectedLocalModel(config);
      meta.modelId = selectedModel.id;
      meta.modelName = selectedModel.displayName;
      meta.runtime = selectedModel.runtime;
    }

    try {
      //构建最终提示词
      const finalPrompt = buildStructuredPrompt(request.prompt, request.sourceText, request.schema);
      logStructuredGenerationStart(request, config, finalPrompt);
      const rawText = config.mode === 'cloud'
        ? await executeCloudStructured(
            config.provider,
            config.apiKey,
            config.baseUrl,
            finalPrompt,
            config.timeoutMs || DEFAULT_CLOUD_TIMEOUT_MS,
          )
        : await executeLocalStructured(getSelectedLocalModel(config), finalPrompt);

      meta.rawText = rawText;
      meta.elapsedMs = Date.now() - startedAt;

      let parsed: Record<string, unknown> | undefined;
      try {
        parsed = safeJsonParse<Record<string, unknown>>(rawText);
      } catch (parseError) {
        if (config.mode === 'local') {
          const normalizedRawText = extractLocalResponseText(rawText);
          if (normalizedRawText && normalizedRawText !== rawText) {
            try {
              parsed = safeJsonParse<Record<string, unknown>>(normalizedRawText);
              meta.rawText = normalizedRawText;
            } catch {}
          }
        }

        if (!parsed) {
          const preview = config.mode === 'local'
            ? extractLocalPreviewText(rawText)
            : String(rawText || '').slice(0, 500);
          const parseMessage = parseError instanceof Error ? parseError.message : String(parseError);
          throw new Error(`结构化结果不是有效 JSON: ${parseMessage}\n输出预览: ${preview || '(空)'}`);
        }
      }

      const { data, validationErrors } = validateStructuredData(parsed, request.schema);

      if (validationErrors.length > 0) {
        logStructuredGenerationResult({
          request,
          config,
          elapsedMs: meta.elapsedMs,
          ok: false,
          rawText: meta.rawText,
          parsedData: data,
          error: '结构化结果校验失败',
          validationErrors,
        });
        return {
          ok: false,
          error: '结构化结果校验失败',
          validationErrors,
          meta,
        };
      }

      logStructuredGenerationResult({
        request,
        config,
        elapsedMs: meta.elapsedMs,
        ok: true,
        rawText: meta.rawText,
        parsedData: data,
      });
      return {
        ok: true,
        data: data as T,
        meta,
      };
    } catch (error) {
      meta.elapsedMs = Date.now() - startedAt;
      const message = error instanceof Error ? error.message : String(error);
      logStructuredGenerationResult({
        request,
        config,
        elapsedMs: meta.elapsedMs,
        ok: false,
        error: message,
      });
      return {
        ok: false,
        error: message,
        meta,
      };
    }
  }

  public async extractContractInfo(
    requestOrFilePath: AIExtractContractInfoRequest | string,
    legacyFileId = '',
    legacyPrompt?: string,
  ): Promise<AIContractExtractionResult> {
    const db = DatabaseService.getInstance();
    const config = getAIConfig();
    const request: AIExtractContractInfoRequest = typeof requestOrFilePath === 'string'
      ? { filePath: requestOrFilePath, fileId: legacyFileId, prompt: legacyPrompt }
      : requestOrFilePath;
    const filePath = String(request.filePath || '').trim();
    const fileId = String(request.fileId || '').trim();
    const stages: AIContractExtractionResult['stages'] = [];

    try {
      if (!filePath) {
        throw new Error('文件路径不能为空');
      }

      ensureAIEnabled(config, fileId);
      const normalizedPromptTemplates = getNormalizedPromptTemplates(config);
      const embeddingValidation = EmbeddingService.getInstance().validateConfig(config);
      const fileContent = await this.extractContractSourceText(filePath, config, stages);
      const primaryContext = buildPrimaryContractContext(fileContent);
      const chunks = buildContractChunks(fileContent);
      if (fileId) {
        db.replaceContractAiChunks(fileId, filePath, chunks);
        if (embeddingValidation.valid) {
          await ContractVectorStoreService.getInstance().replaceFileChunks({
            fileId,
            filePath,
            chunks,
            config,
          });
        }
      }
      const modelStrategy = resolveModelStrategy(config, request);
      const shouldUseRag = request.retrievalMode === 'library-rag' && config.ragEnabled && embeddingValidation.valid;
      let ragResult = {
        contextText: '',
        usedChunkIds: [] as string[],
        retrievedCount: 0,
        strategy: modelStrategy,
      };
      if (shouldUseRag) {
        try {
          ragResult = await RagRetrievalService.getInstance().retrieve({
            sourceText: primaryContext || fileContent,
            config,
            excludeFileId: fileId,
            excludeFilePath: filePath,
            strategy: modelStrategy,
          });
        } catch (error) {
          logger.warn('RAG 检索失败，已回退当前文档分块提取', {
            fileId,
            filePath,
            error: error instanceof Error ? error.message : String(error),
          });
          stages.push({
            stage: 'extract',
            success: false,
            message: `RAG 检索失败，已回退当前文档分块提取：${error instanceof Error ? error.message : String(error)}`,
          });
        }
      }
      if (request.retrievalMode === 'library-rag' && !shouldUseRag && !embeddingValidation.valid) {
        stages.push({
          stage: 'extract',
          success: false,
          message: `RAG 未启用，原因：${embeddingValidation.errors.join('；')}`,
        });
      }
      const ragContextText = ragResult.contextText
        ? [
            '以下检索上下文仅供参考，若与当前合同原文冲突，以当前合同原文为准。',
            ragResult.contextText,
          ].join('\n\n')
        : '';
      const classifySourceText = modelStrategy === 'local-rag'
        ? this.buildLocalTaskSourceText({
            config,
            chunks,
            targetFields: ['contractType', 'contractName', 'clientName', 'partyBName', 'signingDate', 'contractSummary'],
            ragContextText,
            fallbackText: primaryContext || fileContent,
          })
        : buildAugmentedSourceText(primaryContext || fileContent, ragContextText);
      const extractionSourceText = buildAugmentedSourceText(fileContent, ragContextText);
      const preferredContractType = String(request.preferredContractType || '').trim();
      const preferredContractTypeLabel = String(request.preferredContractTypeLabel || '').trim();
      const lockContractType = Boolean(request.lockContractType && preferredContractType);
      const contractTypeCandidates = lockContractType
        ? normalizeContractTypeCandidates({
            ...request,
            contractTypeCandidates: [preferredContractType],
            contractTypeCandidateEntries: [{
              code: preferredContractType,
              name: preferredContractTypeLabel || preferredContractType,
            }],
          })
        : normalizeContractTypeCandidates(request);
      const contractTypeCandidatesText = buildContractTypeCandidatesText(contractTypeCandidates);
      const classify = lockContractType
        ? {
            rawContractType: preferredContractTypeLabel || preferredContractType,
            resolvedContractType: preferredContractType,
            confidence: 1,
            reason: '使用当前已选合同类型直接驱动提取',
          }
        : await classifyContractType({
          fileId,
          config: { ...config, promptTemplates: normalizedPromptTemplates },
          fileContent: classifySourceText,
          candidates: contractTypeCandidates,
          generateStructured: (payload) => this.generateStructured(payload),
        }).catch(async (error) => {
          logger.warn('判型失败，回退重试', {
            error: error instanceof Error ? error.message : String(error),
          });
          return await classifyContractType({
            config: { ...config, promptTemplates: normalizedPromptTemplates },
            fileContent: classifySourceText || primaryContext || fileContent,
            fileId,
            candidates: contractTypeCandidates,
            generateStructured: (payload) => this.generateStructured(payload),
          });
        });
      stages.push({
        stage: 'classify',
        success: true,
        message: lockContractType
          ? `已使用当前选中合同类型：${classify.resolvedContractType}`
          : `判型完成：${classify.resolvedContractType}${classify.confidence !== undefined ? `（置信度 ${(classify.confidence * 100).toFixed(1)}%）` : ''}`,
      });

      const fieldOptionEntries = mergeFieldOptionEntries(
        request.fieldOptionEntries,
        resolveSchemaFieldOptionEntries(db, request.schemaConfig, classify.resolvedContractType),
      );
      logFieldOptionEntries(fileId, fieldOptionEntries);

      const { resolvedSchema, schema } = buildDynamicExtractionSchema(
        request.schemaConfig,
        classify.resolvedContractType,
        fieldOptionEntries,
      );
      const extractPromptTemplate = request.prompt
        ? String(request.prompt).trim()
        : resolvePromptTemplate(normalizedPromptTemplates, 'contractFieldExtraction', classify.resolvedContractType);
      const extractPrompt = renderPromptTemplate(extractPromptTemplate, {
        contractTypeCandidates: contractTypeCandidatesText,
        contractType: classify.resolvedContractType,
        fieldList: schema.map(field => `${field.key}(${field.description})`).join('、'),
      });
      const targetFields = Array.isArray(request.targetFields) && request.targetFields.length > 0
        ? request.targetFields.map(item => String(item || '').trim()).filter(Boolean)
        : schema.map(field => field.key);

      const structured = modelStrategy === 'local-rag'
        ? await this.generateStructuredWithLocalRag<Record<string, unknown>>({
            fileId,
            prompt: extractPrompt,
            sourceText: extractionSourceText,
            ragContextText,
            schema,
            targetFields,
            chunks,
          })
        : await this.generateStructured<Record<string, unknown>>({
            scene: 'contract-extraction',
            fileId,
            prompt: extractPrompt,
            sourceText: extractionSourceText,
            schema,
          });

      let finalStructured = structured;
      let ragTruncationRecovered = false;

      if (modelStrategy === 'local-rag') {
        ragTruncationRecovered = Boolean(finalStructured.meta.rawText && finalStructured.meta.rawText.includes('[TRUNCATION_RECOVERED]'));
      }

      if (!finalStructured.ok || !finalStructured.data) {
        const errorMessage = finalStructured.validationErrors?.length
          ? `${finalStructured.error || '结构化提取失败'}：${finalStructured.validationErrors.join('；')}`
          : finalStructured.error || '结构化提取失败';
        throw new Error(errorMessage);
      }

      const ruleBasedFields = extractRuleBasedFields(fileContent);
      let mergedFields = mergeRuleBasedFields(finalStructured.data, ruleBasedFields, schema, stages);
      const hasValidAmount = (value: unknown) => typeof value === 'number' && Number.isFinite(value) && value > 0;
      const hasNonEmptyText = (value: unknown) => typeof value === 'string' && String(value).trim().length > 0;
      const needsOcrFallback = !hasValidAmount(mergedFields.contractAmount)
        || !hasNonEmptyText(mergedFields.partyATaxNumber)
        || !hasNonEmptyText(mergedFields.partyABankName)
        || !hasNonEmptyText(mergedFields.partyABankAccount)
        || !hasNonEmptyText(mergedFields.partyBTaxNumber)
        || !hasNonEmptyText(mergedFields.partyBBankName)
        || !hasNonEmptyText(mergedFields.partyBBankAccount);

      if (needsOcrFallback && path.extname(filePath).toLowerCase() === '.pdf') {
        try {
          const pdfOcrService = PdfOcrService.getInstance();
          const ocrPages = await pdfOcrService.getOcrBlocksForPdf(filePath);
          // #region debug-point A:ocr-pages
          (()=>{const p='.dbg/party-ocr-mixup.env';let u='http://127.0.0.1:7777/event',s='party-ocr-mixup';try{const e=require('fs').readFileSync(p,'utf8');u=e.match(/DEBUG_SERVER_URL=(.+)/)?.[1]||u;s=e.match(/DEBUG_SESSION_ID=(.+)/)?.[1]||s}catch{}fetch(u,{method:'POST',body:JSON.stringify({sessionId:s,runId:'pre-fix',hypothesisId:'A',location:'AIService.ts:326',msg:'[DEBUG] OCR pages loaded for fallback',data:{fileId,filePath,pageCount:ocrPages.length,blockCounts:ocrPages.slice(0,5).map((item:any)=>({pageNumber:item.pageNumber,blockCount:Array.isArray(item.blocks)?item.blocks.length:0}))},ts:Date.now()})}).catch(()=>{})})();
          // #endregion
          const ocrBlockFields = extractRuleBasedFieldsFromOcrPages(ocrPages);
          // #region debug-point E:ocr-block-fields
          (()=>{const p='.dbg/party-ocr-mixup.env';let u='http://127.0.0.1:7777/event',s='party-ocr-mixup';try{const e=require('fs').readFileSync(p,'utf8');u=e.match(/DEBUG_SERVER_URL=(.+)/)?.[1]||u;s=e.match(/DEBUG_SESSION_ID=(.+)/)?.[1]||s}catch{}fetch(u,{method:'POST',body:JSON.stringify({sessionId:s,runId:'pre-fix',hypothesisId:'E',location:'AIService.ts:329',msg:'[DEBUG] OCR block fields extracted before merge',data:{fileId,ocrBlockFields,beforeMerge:{clientName:mergedFields.clientName,partyBName:mergedFields.partyBName,partyABankName:mergedFields.partyABankName,partyABankAccount:mergedFields.partyABankAccount,partyATaxNumber:mergedFields.partyATaxNumber,partyAAddress:mergedFields.partyAAddress,partyAPhone:mergedFields.partyAPhone,partyBBankName:mergedFields.partyBBankName,partyBBankAccount:mergedFields.partyBBankAccount,partyBTaxNumber:mergedFields.partyBTaxNumber,partyBAddress:mergedFields.partyBAddress,partyBPhone:mergedFields.partyBPhone}},ts:Date.now()})}).catch(()=>{})})();
          // #endregion
          mergedFields = mergeRuleBasedFields(mergedFields, ocrBlockFields, schema, stages);
          mergedFields = applyAuthoritativeOcrPartyFields(mergedFields, ocrBlockFields, stages);
          // #region debug-point E:ocr-block-merge-result
          (()=>{const p='.dbg/party-ocr-mixup.env';let u='http://127.0.0.1:7777/event',s='party-ocr-mixup';try{const e=require('fs').readFileSync(p,'utf8');u=e.match(/DEBUG_SERVER_URL=(.+)/)?.[1]||u;s=e.match(/DEBUG_SESSION_ID=(.+)/)?.[1]||s}catch{}fetch(u,{method:'POST',body:JSON.stringify({sessionId:s,runId:'pre-fix',hypothesisId:'E',location:'AIService.ts:332',msg:'[DEBUG] OCR block fields merged into extracted fields',data:{fileId,afterMerge:{clientName:mergedFields.clientName,partyBName:mergedFields.partyBName,partyABankName:mergedFields.partyABankName,partyABankAccount:mergedFields.partyABankAccount,partyATaxNumber:mergedFields.partyATaxNumber,partyAAddress:mergedFields.partyAAddress,partyAPhone:mergedFields.partyAPhone,partyBBankName:mergedFields.partyBBankName,partyBBankAccount:mergedFields.partyBBankAccount,partyBTaxNumber:mergedFields.partyBTaxNumber,partyBAddress:mergedFields.partyBAddress,partyBPhone:mergedFields.partyBPhone}},ts:Date.now()})}).catch(()=>{})})();
          // #endregion
          const ocrMarkdown = await pdfOcrService.getMarkdownForPdf(filePath);
          const ocrRuleFields = extractRuleBasedFields(ocrMarkdown.markdown || '');
          mergedFields = mergeRuleBasedFields(mergedFields, ocrRuleFields, schema, stages);
        } catch (error) {
          stages.push({
            stage: 'extract',
            success: false,
            message: `OCR 兜底失败：${error instanceof Error ? error.message : String(error)}`,
          });
        }
      }
      mergedFields = normalizeContactNumberFallback(mergedFields);
      mergedFields = enrichSaleContractSummary(mergedFields, classify.resolvedContractType);
      finalStructured = {
        ...finalStructured,
        data: mergedFields,
      };

      const validated = validateContractExtraction(finalStructured.data);
      if (validated.validationErrors.length > 0) {
        throw new Error(validated.validationErrors.join('；'));
      }

      stages.push({
        stage: 'extract',
        success: true,
        message: `字段提取完成：${resolvedSchema.fields.filter(field => field.visible).length} 个候选字段`,
      });

      const extractedFields = Object.fromEntries(
        Object.entries(finalStructured.data).filter(([key, value]) => key !== 'saleSubjectItems' && value !== undefined && value !== null),
      );
      const evidenceRows: ContractFieldEvidenceRecord[] = buildEvidenceRows({
        chunks,
        fileId,
        extractedFields,
        targetFields,
      });
      if (fileId) {
        db.replaceContractFieldEvidence(fileId, evidenceRows);
      }
      const signingDate = String(validated.data.signingDate || finalStructured.data.signingDate || '').trim();
      let receiptFrequencyCandidatesText = '';
      try {
        const formatPairs = (rows: Array<{ name?: unknown; value?: unknown }>) => {
          return rows
            .map((item) => {
              const value = String(item?.value || '').trim();
              const label = String(item?.name || '').trim();
              if (value && label && value !== label) return `${value}（${label}）`;
              return value || label;
            })
            .filter(Boolean)
            .join('、');
        };

        const rowsA = db.getDictionaries({ group_name: '收付频率', page: 1, pageSize: 1000 }).data;
        receiptFrequencyCandidatesText = formatPairs(rowsA || []);
        if (!receiptFrequencyCandidatesText) {
          const rowsB = db.getDictionaries({ group_name: '收款频率', page: 1, pageSize: 1000 }).data;
          receiptFrequencyCandidatesText = formatPairs(rowsB || []);
        }
      } catch {
        receiptFrequencyCandidatesText = '';
      }
      if (!receiptFrequencyCandidatesText) {
        const optionEntries = request.fieldOptionEntries as any;
        const list = (optionEntries?.receipt_frequency || optionEntries?.receiptFrequency || optionEntries?.frequency) as Array<{ value?: string; label?: string }> | undefined;
        if (Array.isArray(list) && list.length > 0) {
          receiptFrequencyCandidatesText = list
            .map((item) => {
              const value = String(item?.value || '').trim();
              const label = String(item?.label || '').trim();
              if (value && label && value !== label) return `${value}（${label}）`;
              return value || label;
            })
            .filter(Boolean)
            .join('、');
        }
      }
      let receiptPlans: AIExtractedReceiptPlan[] = [];
      try {
        const receiptPlanSourceText = modelStrategy === 'local-rag'
          ? this.buildLocalTaskSourceText({
              config,
              chunks,
              targetFields: ['receiptPlans', 'contractAmount', 'signingDate'],
              ragContextText,
              fallbackText: extractionSourceText,
            })
          : extractionSourceText;
        receiptPlans = await extractReceiptPlans({
          promptTemplates: normalizedPromptTemplates,
          fileContent: receiptPlanSourceText,
          fileId,
          contractType: classify.resolvedContractType,
          contractTypeCandidatesText,
          receiptFrequencyCandidatesText,
          signingDate,
          generateStructured: (payload) => this.generateStructured(payload),
        });
        stages.push({
          stage: 'receiptPlan',
          success: true,
          message: `收款计划提取完成：${receiptPlans.length} 条`,
        });
      } catch (error) {
        stages.push({
          stage: 'receiptPlan',
          success: false,
          message: error instanceof Error ? error.message : String(error),
        });
      }
      const result: AIContractExtractionResult = {
        ...validated.data,
        contractType: classify.resolvedContractType || validated.data.contractType,
        resolvedContractType: classify.resolvedContractType,
        contractTypeConfidence: classify.confidence,
        contractTypeReason: classify.reason,
        extractedFields,
        receiptPlans,
        stages,
        ragMeta: {
          enabled: shouldUseRag,
          retrievedCount: ragResult.retrievedCount,
          usedChunkIds: ragResult.usedChunkIds,
          strategy: modelStrategy,
          truncationRecovered: ragTruncationRecovered,
        },
      };

      if (fileId) {
        db.logAIContractExtraction(fileId, JSON.stringify(result), 'SUCCESS', '');
      }

      return result;
    } catch (error) {
      logger.error('AI 提取失败:', error);
      stages?.push?.({
        stage: 'extract',
        success: false,
        message: error instanceof Error ? error.message : String(error),
      });
      if (fileId) {
        db.logAIContractExtraction(fileId, '', 'FAILED', error instanceof Error ? error.message : String(error));
      }
      throw new Error(`AI 提取失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async extractContractSourceText(
    filePath: string,
    config: ReturnType<typeof getAIConfig>,
    stages: AIContractExtractionResult['stages'],
  ): Promise<string> {
    if (config.mode === 'cloud' && config.provider === 'kimi' && canUseKimiFileExtraction(filePath)) {
      try {
        const text = await extractTextViaKimiFile(
          config.apiKey,
          config.baseUrl,
          filePath,
          config.timeoutMs || DEFAULT_CLOUD_TIMEOUT_MS,
        );
        stages.push({
          stage: 'extract',
          success: true,
          message: '已优先将原始文件直接发送给 AI 服务，并基于文件内容完成预提取',
        });
        return text;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger.warn('原始文件直传 AI 失败，回退本地文本提取/OCR', {
          filePath,
          message,
        });
        stages.push({
          stage: 'extract',
          success: false,
          message: `原始文件直传 AI 不可用，已回退兼容链路：${message}`,
        });
      }
    }

    return await extractTextFromFile(filePath);
  }

  public promoteContractVectors(filePath: string, contractId: string): void {
    ContractVectorStoreService.getInstance().promoteFileChunks(filePath, contractId);
  }

  private async generateStructuredWithLocalRag<T = Record<string, unknown>>(params: {
    fileId: string;
    prompt: string;
    sourceText: string;
    ragContextText: string;
    schema: AIStructuredFieldDefinition[];
    targetFields: string[];
    chunks: Array<{ id: string; index: number; title: string; sectionType: string; compactContent: string; content: string; importanceScore: number; isNoise: boolean; keywords: string[] }>;
  }): Promise<AIStructuredGenerateResult<T>> {
    const config = getAIConfig();
    const localModel = getSelectedLocalModel(config);
    const groupMode = config.localSmallModelFieldGroupMode;
    const fieldGroups = groupMode === 'single-pass'
      ? [params.schema.map(item => item.key)]
      : LOCAL_FIELD_GROUPS.map(group => group.filter(key => params.schema.some(item => item.key === key)));
    const fallbackGroup = params.schema.map(item => item.key).filter(key => !fieldGroups.some(group => group.includes(key)));
    if (fallbackGroup.length > 0) fieldGroups.push(fallbackGroup);

    const merged: Record<string, unknown> = {};
    const meta: AIStructuredGenerateMeta = {
      mode: 'local',
      modelId: localModel.id,
      modelName: localModel.displayName,
      runtime: localModel.runtime,
      elapsedMs: 0,
    };
    const startedAt = Date.now();
    let truncationRecovered = false;

    for (const groupKeys of fieldGroups) {
      if (!Array.isArray(groupKeys) || groupKeys.length === 0) continue;
      const groupSchema = params.schema.filter(item => groupKeys.includes(item.key));
      const selectedChunks = selectChunksForFields(params.chunks as any, groupKeys, {
        includeGeneralClauses: groupKeys.includes('receiptPlans'),
      });
      const primaryChunkContext = buildChunkedContext(selectedChunks as any) || params.sourceText;
      const groupSourceText = buildLocalRagGroupSourceText({
        primaryText: primaryChunkContext,
        ragContextText: params.ragContextText,
        maxChars: this.getLocalSourceCharBudget(config),
      });

      const finalPrompt = buildStructuredPrompt(
        [
          params.prompt.trim(),
          '请只输出一个 JSON 对象。',
          '禁止输出 Markdown、代码围栏、解释说明。',
        ].join('\n'),
        groupSourceText,
        groupSchema,
      );

      const attemptConfigs = [
        { maxTokens: Math.min(localModel.maxTokens, 1024), contextSize: Math.min(localModel.contextSize, 4096), temperature: 0.1 },
        { maxTokens: Math.min(localModel.maxTokens, 768), contextSize: Math.min(localModel.contextSize, 3072), temperature: 0 },
      ];

      let groupParsed: Record<string, unknown> | null = null;
      let lastError = '';
      for (const attempt of attemptConfigs) {
        try {
          const rawText = await executeLocalStructuredWithOptions(localModel, finalPrompt, attempt);
          const repaired = tryRepairAndParseJson<Record<string, unknown>>(rawText);
          if (repaired.parsed) {
            if (repaired.repairedText && repaired.repairedText !== extractJsonText(rawText)) {
              truncationRecovered = true;
            }
            const validated = validateStructuredData(repaired.parsed, groupSchema);
            if (validated.validationErrors.length > 0) {
              lastError = validated.validationErrors.join('；');
              continue;
            }
            groupParsed = validated.data;
            break;
          }
          lastError = '本地模型返回的 JSON 无法解析';
        } catch (error) {
          lastError = error instanceof Error ? error.message : String(error);
        }
      }

      if (!groupParsed) {
        meta.elapsedMs = Date.now() - startedAt;
        return {
          ok: false,
          error: lastError || '本地小模型结构化提取失败',
          meta,
        };
      }

      Object.assign(merged, groupParsed);
    }

    meta.elapsedMs = Date.now() - startedAt;
    meta.rawText = truncationRecovered ? '[TRUNCATION_RECOVERED]' : '[LOCAL_GROUPED_OK]';
    return {
      ok: true,
      data: merged as T,
      meta,
    };
  }

  public async validateLocalModel(
    payload: AILocalModelValidationRequest,
  ): Promise<AILocalModelValidationResult> {
    return await validateLocalModel(payload);
  }

  public async testConnection(config: AITestConnectionRequest): Promise<AITestConnectionResult> {
    let logPath: string | null = null;
    const startedAt = Date.now();

    try {
      const mode = config.mode === 'local' ? 'local' : 'cloud';

      if (mode === 'cloud') {
        const provider = config.provider === 'minimax'
          ? 'minimax'
          : config.provider === 'deepseek'
            ? 'deepseek'
            : 'kimi';
        const prompt = '请只返回一个 JSON 对象，例如 {"message":"连接成功"}。';
        const timeoutMs = Number(config.timeoutMs || DEFAULT_CLOUD_TIMEOUT_MS);
        logPath = createTestLog({
          mode,
          provider,
          timeoutMs,
          prompt,
        });
        const resultText = await executeCloudStructured(
          provider,
          String(config.apiKey || '').trim(),
          String(config.baseUrl || '').trim() || getDefaultBaseUrl(provider),
          prompt,
          timeoutMs,
        );
        const normalizedResult = extractJsonText(resultText);
        appendTestLogResult(logPath, {
          success: true,
          elapsedMs: Date.now() - startedAt,
          resultText: normalizedResult,
        });

        return {
          success: true,
          message: normalizedResult,
          meta: {
            mode,
            provider,
          },
        };
      }

      const localModel = normalizeLocalModel(config.localModel);
      const validation = await validateLocalModel({ localModel });
      if (!validation.valid) {
        return {
          success: false,
          message: validation.errors.join('；'),
          meta: {
            mode,
            modelId: localModel.id,
            modelName: localModel.displayName,
            runtime: localModel.runtime,
          },
        };
      }

      const requestedTimeoutMs = Number(config.timeoutMs || 0);
      const rawTimeoutMs = Number.isFinite(requestedTimeoutMs) && requestedTimeoutMs > 0
        ? requestedTimeoutMs
        : localModel.timeoutMs;
      const probeTimeoutMs = Math.min(Math.max(1000, rawTimeoutMs), 20 * 60 * 1000);
      const prompt = '你是谁，有多少模型和参数，能做什么';
      logPath = createTestLog({
        mode,
        timeoutMs: probeTimeoutMs,
        prompt,
        localModel,
      });

      const probeResult = await probeLocalModel({
        ...localModel,
        timeoutMs: probeTimeoutMs,
      });

      if (probeResult.timedOut) {
        const errorText = '本地模型执行超时';
        appendTestLogResult(logPath, {
          success: false,
          elapsedMs: Date.now() - startedAt,
          exitCode: probeResult.code,
          timedOut: true,
          errorText,
          resultText: normalizeLocalLogOutput(probeResult.output, prompt),
        });
        return {
          success: false,
          message: errorText,
          meta: {
            mode,
            modelId: localModel.id,
            modelName: localModel.displayName,
            runtime: localModel.runtime,
          },
        };
      }

      if (!probeResult.output) {
        const errorText = '本地模型未返回任何内容';
        appendTestLogResult(logPath, {
          success: false,
          elapsedMs: Date.now() - startedAt,
          exitCode: probeResult.code,
          timedOut: false,
          errorText,
        });
        return {
          success: false,
          message: errorText,
          meta: {
            mode,
            modelId: localModel.id,
            modelName: localModel.displayName,
            runtime: localModel.runtime,
          },
        };
      }

      if (probeResult.code !== 0) {
        const errorText = `本地模型执行失败: ${probeResult.output}`;
        appendTestLogResult(logPath, {
          success: false,
          elapsedMs: Date.now() - startedAt,
          exitCode: probeResult.code,
          timedOut: false,
          errorText,
          resultText: normalizeLocalLogOutput(probeResult.output, prompt),
        });
        return {
          success: false,
          message: errorText,
          meta: {
            mode,
            modelId: localModel.id,
            modelName: localModel.displayName,
            runtime: localModel.runtime,
          },
        };
      }

      const preview = extractLocalResponseText(probeResult.output) || '最小推理执行成功';
      appendTestLogResult(logPath, {
        success: true,
        elapsedMs: Date.now() - startedAt,
        exitCode: probeResult.code,
        timedOut: false,
        resultText: normalizeLocalLogOutput(probeResult.output, prompt),
      });
      return {
        success: true,
        message: preview,
        meta: {
          mode,
          modelId: localModel.id,
          modelName: localModel.displayName,
          runtime: localModel.runtime,
        },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      appendTestLogResult(logPath, {
        success: false,
        elapsedMs: Date.now() - startedAt,
        errorText: message,
      });
      logger.error('测试 AI 连接失败:', error);
      return {
        success: false,
        message,
      };
    }
  }

  private getLocalSourceCharBudget(config: ReturnType<typeof getAIConfig>): number {
    const localModel = getSelectedLocalModel(config);
    const configuredMaxChars = Math.max(512, Number(config.localSmallModelMaxContextChars || 0) || 0);
    const safeByContextWindow = Math.max(1024, Math.floor((Number(localModel.contextSize || 0) || 4096) * 0.6));
    return configuredMaxChars > 0
      ? Math.min(configuredMaxChars, safeByContextWindow)
      : safeByContextWindow;
  }

  private buildLocalTaskSourceText(params: {
    config: ReturnType<typeof getAIConfig>;
    chunks: Array<{ id: string; index: number; title: string; sectionType: string; compactContent: string; content: string; importanceScore: number; isNoise: boolean; keywords: string[] }>;
    targetFields: string[];
    ragContextText: string;
    fallbackText: string;
  }): string {
    const selectedChunks = selectChunksForFields(params.chunks as any, params.targetFields, {
      includeGeneralClauses: params.targetFields.includes('receiptPlans'),
    });
    const primaryChunkContext = buildChunkedContext(selectedChunks as any) || String(params.fallbackText || '').trim();
    return buildLocalRagGroupSourceText({
      primaryText: primaryChunkContext,
      ragContextText: params.ragContextText,
      maxChars: this.getLocalSourceCharBudget(params.config),
    });
  }
}

type AIFieldOptionEntry = { value: string; label?: string };
type AIFieldOptionEntries = Record<string, AIFieldOptionEntry[]>;
const LOCAL_FIELD_GROUPS = [
  ['contractName', 'contractCode', 'signingDate', 'contractType', 'clientName', 'partyBName'],
  [
    'partyAContact', 'partyALegalRepName', 'partyALegalRepMobile', 'partyALegalRepEmail', 'partyALegalRepIdNumber',
    'partyAPhone', 'partyAAddress', 'partyATaxNumber', 'partyABankName', 'partyABankAccount', 'partyAInvoiceType',
    'partyBContact', 'partyBLegalRepName', 'partyBLegalRepMobile', 'partyBLegalRepEmail', 'partyBLegalRepIdNumber',
    'partyBPhone', 'partyBAddress', 'partyBTaxNumber', 'partyBBankName', 'partyBBankAccount', 'partyBInvoiceType',
  ],
  ['contractAmount', 'contractSummary', 'saleSubjectItems', 'remark', 'endDate', 'settlementMethod', 'signingForm', 'procurementSource', 'executionMethod'],
];

function resolveModelStrategy(config: ReturnType<typeof getAIConfig>, request: AIExtractContractInfoRequest): 'cloud-direct' | 'local-rag' | 'auto' {
  if (request.modelStrategy === 'cloud-direct' || request.modelStrategy === 'local-rag') {
    return request.modelStrategy;
  }
  return config.mode === 'local' ? 'local-rag' : 'cloud-direct';
}

function buildAugmentedSourceText(primaryText: string, ragContextText: string): string {
  const base = String(primaryText || '').trim();
  const rag = String(ragContextText || '').trim();
  if (!rag) return base;
  return [
    '【当前合同原文】',
    base,
    '',
    '【RAG_CONTEXT】',
    rag,
  ].join('\n');
}

function buildLocalRagGroupSourceText(params: {
  primaryText: string;
  ragContextText: string;
  maxChars: number;
}): string {
  const maxChars = Math.max(512, Number(params.maxChars || 0) || 0);
  const primaryLabel = '【当前合同原文】';
  const ragLabel = '【RAG_CONTEXT】';
  const primary = String(params.primaryText || '').trim();
  const rag = String(params.ragContextText || '').trim();
  if (!rag) {
    return primary.length > maxChars ? primary.slice(0, maxChars) : primary;
  }

  const primaryBlock = [primaryLabel, primary].join('\n');
  if (primaryBlock.length >= maxChars) {
    return primaryBlock.slice(0, maxChars);
  }

  const separator = '\n\n';
  const ragPrefix = `${separator}${ragLabel}\n`;
  const ragBudget = Math.max(0, maxChars - primaryBlock.length - ragPrefix.length);
  const ragTrimmed = ragBudget > 0 ? rag.slice(0, ragBudget) : '';
  return ragTrimmed
    ? `${primaryBlock}${ragPrefix}${ragTrimmed}`
    : primaryBlock;
}

function mergeFieldOptionEntries(
  primary?: AIExtractContractInfoRequest['fieldOptionEntries'],
  secondary?: AIExtractContractInfoRequest['fieldOptionEntries'],
): AIFieldOptionEntries | undefined {
  const result: AIFieldOptionEntries = {};
  const appendRows = (fieldKey: string, rows: AIFieldOptionEntry[] | undefined) => {
    const key = String(fieldKey || '').trim();
    if (!key || !Array.isArray(rows) || rows.length === 0) return;
    const dedup = new Map<string, AIFieldOptionEntry>(
      (result[key] || []).map((item) => [String(item.value || '').trim(), item]),
    );
    rows.forEach((item) => {
      const value = String(item?.value || '').trim();
      if (!value) return;
      const label = String(item?.label || '').trim();
      if (!dedup.has(value)) {
        dedup.set(value, { value, label: label || undefined });
      }
    });
    const merged = Array.from(dedup.values());
    if (merged.length > 0) result[key] = merged;
  };

  [primary, secondary].forEach((source) => {
    if (!source || typeof source !== 'object') return;
    Object.entries(source).forEach(([fieldKey, rows]) => appendRows(fieldKey, rows));
  });

  return Object.keys(result).length > 0 ? result : undefined;
}

function resolveSchemaFieldOptionEntries(
  db: DatabaseService,
  schemaConfig: ContractFormSchemaConfig | undefined,
  contractType: string,
): AIFieldOptionEntries | undefined {
  const resolvedSchema = resolveContractFormSchema(
    normalizeContractFormSchemaConfig(schemaConfig),
    String(contractType || '').trim(),
  );
  const entries: AIFieldOptionEntries = {};

  resolvedSchema.fields.forEach((field) => {
    const options = resolveFieldOptionEntries(db, field);
    if (options.length > 0) {
      entries[field.key] = options;
    }
  });

  return Object.keys(entries).length > 0 ? entries : undefined;
}

function resolveFieldOptionEntries(
  db: DatabaseService,
  field: ContractFormSchemaField,
): AIFieldOptionEntry[] {
  if (!field.visible) return [];
  if (field.type !== 'select' && field.type !== 'multiselect' && field.type !== 'tree') return [];

  const dedup = new Map<string, AIFieldOptionEntry>();
  const append = (valueLike: unknown, labelLike?: unknown) => {
    const value = String(valueLike || '').trim();
    if (!value) return;
    const label = String(labelLike || '').trim();
    if (!dedup.has(value)) {
      dedup.set(value, { value, label: label || undefined });
    }
  };

  if (Array.isArray(field.options)) {
    field.options.forEach((item) => append(item, item));
  }

  const sourceType = String(field.optionSource?.type || '').trim();
  const groupName = String(field.optionSource?.groupName || '').trim();
  if (!sourceType || !groupName) {
    return Array.from(dedup.values());
  }

  try {
    if (sourceType === 'dictionary') {
      const rows = db.getDictionaries({ group_name: groupName, page: 1, pageSize: 1000 }).data;
      rows.forEach((item) => append(item.value || item.name, item.name || item.value));
    } else if (sourceType === 'treeDictionary') {
      const rows = db.getTreeDictionaries({ group_name: groupName, page: 1, pageSize: 1000 }).data;
      rows.forEach((item) => append(item.value || item.name, item.name || item.value));
    }
  } catch (error) {
    logger.warn('解析 schema 字段候选项失败，已跳过该字段', {
      fieldKey: field.key,
      optionSourceType: sourceType,
      groupName,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  return Array.from(dedup.values());
}

function logFieldOptionEntries(fileId: string, fieldOptionEntries?: AIFieldOptionEntries): void {
  if (!fieldOptionEntries || typeof fieldOptionEntries !== 'object') {
    logger.info('AI extract request fieldOptionEntries missing', { fileId });
    return;
  }

  const keys = Object.keys(fieldOptionEntries);
  const preview = keys.slice(0, 6).map((fieldKey) => {
    const values = (fieldOptionEntries[fieldKey] || [])
      .map((item) => String(item?.value || '').trim())
      .filter(Boolean)
      .slice(0, 8);
    return `${fieldKey}:${values.join('、')}`;
  }).join('；');

  logger.info('AI extract request fieldOptionEntries prepared', {
    fileId,
    fieldCount: keys.length,
    preview,
  });
}

function buildEvidenceRows(params: {
  chunks: Array<{ id: string; index: number; title: string; compactContent: string; content: string }>;
  fileId: string;
  extractedFields: Record<string, unknown>;
  targetFields: string[];
}): ContractFieldEvidenceRecord[] {
  const rows: ContractFieldEvidenceRecord[] = [];
  const fields = Array.isArray(params.targetFields) && params.targetFields.length > 0
    ? params.targetFields
    : Object.keys(params.extractedFields || {});

  for (const fieldKey of fields) {
    const rawValue = params.extractedFields?.[fieldKey];
    if (rawValue === undefined || rawValue === null) continue;
    const fieldValue = typeof rawValue === 'string'
      ? rawValue.trim()
      : JSON.stringify(rawValue);
    if (!fieldValue) continue;

    const matchedChunk = params.chunks.find((chunk) => {
      const target = `${chunk.title}\n${chunk.content}`;
      return target.includes(fieldValue)
        || fieldValue.includes(chunk.title)
        || (fieldKey === 'contractAmount' && /(合同总价|合同金额|总金额|人民币|含税)/.test(target))
        || (fieldKey === 'receiptPlans' && /(付款方式|付款节点|预付款|进度款|尾款|收款计划)/.test(target))
        || (fieldKey === 'clientName' && /(甲方|采购方|委托方)/.test(target))
        || (fieldKey === 'partyBName' && /(乙方|供应方|受托方)/.test(target))
        || (fieldKey === 'signingDate' && /(签订日期|签署日期|签约日期)/.test(target));
    });

    if (!matchedChunk) continue;
    const confidence = estimateEvidenceConfidence(fieldKey, fieldValue, matchedChunk);
    rows.push({
      fieldKey,
      fieldValue,
      chunkId: matchedChunk.id,
      chunkIndex: matchedChunk.index,
      evidenceText: matchedChunk.compactContent || matchedChunk.content.slice(0, 800),
      confidence,
    });
  }

  return rows;
}

function estimateEvidenceConfidence(
  fieldKey: string,
  fieldValue: string,
  chunk: { title: string; content: string; compactContent: string },
): number {
  const target = `${chunk.title}\n${chunk.content}`;
  let score = 0.55;

  if (target.includes(fieldValue)) score += 0.25;
  if (chunk.compactContent.includes(fieldValue)) score += 0.1;

  if (fieldKey === 'contractCode' && /(合同编号|协议编号|编号)/.test(target)) score += 0.15;
  if (fieldKey === 'signingDate' && /(签订日期|签约日期|签署日期)/.test(target)) score += 0.15;
  if (fieldKey === 'clientName' && /(甲方|采购方|委托方)/.test(target)) score += 0.12;
  if (fieldKey === 'partyBName' && /(乙方|供应方|受托方)/.test(target)) score += 0.12;
  if (fieldKey === 'contractAmount' && /(合同总价|合同金额|总金额|人民币|含税)/.test(target)) score += 0.18;
  if (fieldKey === 'receiptPlans' && /(付款方式|付款节点|预付款|进度款|尾款|收款计划)/.test(target)) score += 0.12;

  return Math.max(0.05, Math.min(0.99, Number(score.toFixed(2))));
}

function extractRuleBasedFields(fileContent: string): Record<string, unknown> {
  const text = String(fileContent || '').replace(/\r/g, '');
  const layoutText = text.replace(/\t/g, '    ');
  const normalized = text.replace(/[ \t]+/g, ' ');
  const result: Record<string, unknown> = {};

  const matchFirst = (patterns: RegExp[]): string => {
    for (const pattern of patterns) {
      const matched = normalized.match(pattern);
      if (matched) {
        for (let i = matched.length - 1; i >= 1; i -= 1) {
          const candidate = String(matched[i] || '').trim();
          if (candidate) return candidate;
        }
      }
    }
    return '';
  };

  const matchFirstFrom = (source: string, patterns: RegExp[]): string => {
    for (const pattern of patterns) {
      const matched = source.match(pattern);
      if (matched) {
        for (let i = matched.length - 1; i >= 1; i -= 1) {
          const candidate = String(matched[i] || '').trim();
          if (candidate) return candidate;
        }
      }
    }
    return '';
  };

  const findFirstIndex = (source: string, patterns: RegExp[], fromIndex = 0): number => {
    const start = Math.max(0, Math.min(source.length, fromIndex));
    const sliced = source.slice(start);
    let best = -1;
    for (const pattern of patterns) {
      const idx = sliced.search(pattern);
      if (idx < 0) continue;
      const abs = start + idx;
      if (best < 0 || abs < best) best = abs;
    }
    return best;
  };

  const normalizeDash = (value: string) => String(value || '').trim().replace(/[－—–]/g, '-');
  const normalizeTaxNumber = (value: string) => String(value || '').toUpperCase().replace(/[^0-9A-Z]/g, '').trim();
  const normalizeBankAccount = (value: string) => String(value || '').replace(/[^\d]/g, '').trim();
  const normalizeBankName = (value: string) => {
    let text = String(value || '').replace(/\s+/g, ' ').trim();
    if (!text) return '';
    text = text.replace(/^(开户行|开户银行)[：:\s]*/i, '').replace(/[：:]+$/, '').trim();
    text = text.replace(/\s*(银行\s*[账帐]\s*号|开户\s*[账帐]\s*号|[账帐]\s*号|税号|纳税人识别号|统一社会信用代码|地址|电话|联系人)\s*[:：].*$/i, '').trim();
    if (!text) return '';
    text = text
      .replace(/^中行(?=\S)/, '中国银行')
      .replace(/^工行(?=\S)/, '中国工商银行')
      .replace(/^农行(?=\S)/, '中国农业银行')
      .replace(/^建行(?=\S)/, '中国建设银行')
      .replace(/^交行(?=\S)/, '交通银行')
      .replace(/^招行(?=\S)/, '招商银行')
      .replace(/^邮储(?=\S)/, '中国邮政储蓄银行')
      .replace(/^农信(?=\S)/, '农村信用社');
    if (/(名称、地址和账(?:号|户)为?|名称地址和账(?:号|户)为?)/.test(text)) return '';
    if (/^(名称|地址|[账帐]\s*号|电话|联系人)$/.test(text)) return '';
    if (!/(银行|信用社|农商行|农信社|合作联社|村镇银行|邮政储蓄|中行|工行|农行|建行|交行|招行|邮储|农信)/.test(text)) return '';
    return text;
  };
  const isLikelyBankContinuationLine = (value: string) => {
    const text = String(value || '').trim();
    if (!text) return false;
    if (/[：:]/.test(text)) return false;
    if (/^(甲方|乙方|采购方|供应方|委托方|受托方|需方|供方|购方|销方|买方|卖方)\b/.test(text)) return false;
    if (/^(银行\s*[账帐]\s*号|开户\s*[账帐]\s*号|[账帐]\s*号|税号|纳税人识别号|统一社会信用代码|地址|电话|联系电话|联系人|项目联系人|邮箱|电子信箱|E-?mail|Email|邮编|传真|法定代表人|委托代理人|开户行|开户银行)\b/i.test(text)) return false;
    if (/^\d{6,}$/.test(text)) return false;
    return true;
  };
  const extractBankContinuationLine = (source: string, startIndex: number) => {
    if (startIndex < 0) return '';
    const lines = String(source || '').slice(startIndex).split('\n');
    if (lines.length < 2) return '';
    const nextLine = String(lines[1] || '').trim();
    return isLikelyBankContinuationLine(nextLine) ? nextLine : '';
  };

  const collectMatches = (pattern: RegExp, mapper?: (matched: RegExpExecArray) => string): string[] => {
    const list: string[] = [];
    const seen = new Set<string>();
    const flags = pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`;
    const regex = new RegExp(pattern.source, flags);
    let matched: RegExpExecArray | null;
    while ((matched = regex.exec(normalized)) !== null) {
      const raw = mapper ? mapper(matched) : String(matched[1] || '').trim();
      const value = String(raw || '').trim();
      if (!value || seen.has(value)) continue;
      seen.add(value);
      list.push(value);
      if (list.length >= 6) break;
    }
    return list;
  };

  const collectMarkerIndexes = (patterns: RegExp[]): number[] => {
    const indexes = new Set<number>();
    for (const pattern of patterns) {
      const flags = pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`;
      const regex = new RegExp(pattern.source, flags);
      let matched: RegExpExecArray | null;
      while ((matched = regex.exec(normalized)) !== null) {
        indexes.add(matched.index);
        if (!regex.global) break;
      }
    }
    return Array.from(indexes).sort((a, b) => a - b);
  };

  const matchFirstWithIndexFrom = (source: string, patterns: RegExp[]): { value: string; index: number } => {
    let bestValue = '';
    let bestIndex = -1;
    for (const pattern of patterns) {
      const flags = pattern.flags.replace(/g/g, '');
      const regex = new RegExp(pattern.source, flags);
      const matched = regex.exec(source);
      if (!matched) continue;
      let candidate = '';
      for (let i = matched.length - 1; i >= 1; i -= 1) {
        const current = String(matched[i] || '').trim();
        if (current) {
          candidate = current;
          break;
        }
      }
      if (!candidate) continue;
      if (bestIndex < 0 || matched.index < bestIndex) {
        bestIndex = matched.index;
        bestValue = candidate;
      }
    }
    return { value: bestValue, index: bestIndex };
  };

  const partyAStartPatterns = [
    /^(甲方|采购方|委托方|发包方|需方|购方|购买方|买方)(?:名称|单位名称)?\s*(?:（[^）\n]{0,12}）|\([^)\n]{0,12}\))?\s*[：:]/m,
    /(?:^|\n)\s*(甲方|采购方|委托方|发包方|需方|购方|购买方|买方)(?:名称|单位名称)?\s*(?:（[^）\n]{0,12}）|\([^)\n]{0,12}\))?\s*[：:]/,
    /^(乙方|供应方|受托方|承包方|卖方)\s*[（(]\s*甲方\s*[)）]\s*[：:]/m,
    /(?:^|\n)\s*(乙方|供应方|受托方|承包方|卖方)\s*[（(]\s*甲方\s*[)）]\s*[：:]/,
  ];
  const partyBStartPatterns = [
    /^(乙方|供应方|受托方|承包方|供方|销方|销售方|卖方)(?:名称|单位名称)?\s*(?:（[^）\n]{0,12}）|\([^)\n]{0,12}\))?\s*[：:]/m,
    /(?:^|\n)\s*(乙方|供应方|受托方|承包方|供方|销方|销售方|卖方)(?:名称|单位名称)?\s*(?:（[^）\n]{0,12}）|\([^)\n]{0,12}\))?\s*[：:]/,
    /^(甲方|采购方|委托方|发包方|买方|需方)\s*[（(]\s*乙方\s*[)）]\s*[：:]/m,
    /(?:^|\n)\s*(甲方|采购方|委托方|发包方|买方|需方)\s*[（(]\s*乙方\s*[)）]\s*[：:]/,
  ];
  const partyAMarkerIndexes = collectMarkerIndexes(partyAStartPatterns);
  const partyBMarkerIndexes = collectMarkerIndexes(partyBStartPatterns);
  const inferPartyByIndex = (index: number): 'A' | 'B' | '' => {
    if (index < 0) return '';
    const nearestA = [...partyAMarkerIndexes].reverse().find((item) => item <= index) ?? -1;
    const nearestB = [...partyBMarkerIndexes].reverse().find((item) => item <= index) ?? -1;
    if (nearestA < 0 && nearestB < 0) return '';
    if (nearestA === nearestB) return '';
    return nearestA > nearestB ? 'A' : 'B';
  };
  const inferPartyByNearbyMentions = (index: number): 'A' | 'B' | '' => {
    if (index < 0) return '';
    const windowStart = Math.max(0, index - 180);
    const windowEnd = Math.min(normalized.length, index + 60);
    const windowText = normalized.slice(windowStart, windowEnd);
    const aMentions = ['甲方', '采购方', '委托方', '发包方', '需方', '购方', '购买方', '买方'];
    const bMentions = ['乙方', '供应方', '受托方', '承包方', '供方', '销方', '销售方', '卖方'];
    const findLast = (haystack: string, needles: string[]) => {
      let best = -1;
      for (const needle of needles) {
        const idx = haystack.lastIndexOf(needle);
        if (idx > best) best = idx;
      }
      return best;
    };
    const lastA = findLast(windowText, aMentions);
    const lastB = findLast(windowText, bMentions);
    if (lastA < 0 && lastB < 0) return '';
    if (lastA === lastB) return '';
    return lastB > lastA ? 'B' : 'A';
  };
  const inferPartyForAccountLikeField = (index: number): 'A' | 'B' | '' => {
    const byMarker = inferPartyByIndex(index);
    const byNearby = inferPartyByNearbyMentions(index);
    return byMarker || byNearby;
  };

  const extractDualColumnPartyFields = (): Record<string, unknown> => {
    const fields: Record<string, unknown> = {};
    const lines = layoutText.split('\n');
    const aTokenPattern = /(甲方|采购方|委托方|发包方|需方|购方|购买方|买方)(?:名称|单位名称)?\s*(?:（[^）\n]{0,12}）|\([^)\n]{0,12}\))?\s*[：:]/;
    const bTokenPattern = /(乙方|供应方|受托方|承包方|供方|销方|销售方|卖方)(?:名称|单位名称)?\s*(?:（[^）\n]{0,12}）|\([^)\n]{0,12}\))?\s*[：:]/;
    const findAnchor = () => {
      for (let i = 0; i < lines.length; i += 1) {
        const line = String(lines[i] || '');
        const aMatch = aTokenPattern.exec(line);
        const bMatch = bTokenPattern.exec(line);
        if (!aMatch || !bMatch) continue;
        if (aMatch.index === bMatch.index) continue;
        const aStart = aMatch.index;
        const aEnd = aMatch.index + String(aMatch[0] || '').length;
        const bStart = bMatch.index;
        const bEnd = bMatch.index + String(bMatch[0] || '').length;
        const leftMarkerFirst = aStart < bStart;
        const divider = leftMarkerFirst
          ? Math.max(aEnd, Math.floor((aEnd + bStart) / 2))
          : Math.max(bEnd, Math.floor((bEnd + aStart) / 2));
        return {
          lineIndex: i,
          divider,
          leftParty: leftMarkerFirst ? 'A' as const : 'B' as const,
          rightParty: leftMarkerFirst ? 'B' as const : 'A' as const,
        };
      }
      return null;
    };
    const anchor = findAnchor();
    if (!anchor) return fields;

    const sanitizeName = (value: string): string => {
      return String(value || '')
        .replace(/\s{2,}/g, ' ')
        .replace(/(甲方|采购方|委托方|发包方|需方|购方|购买方|买方|乙方|供应方|受托方|承包方|供方|销方|销售方|卖方)\s*[：:].*$/g, '')
        .trim();
    };
    const normalizePhoneLike = (value: string) => normalizeDash(String(value || '').trim())
      .replace(/[（）]/g, (char) => (char === '（' ? '(' : ')'))
      .replace(/\s+/g, '');
    const extractMobileDigits = (value: string): string => {
      const digits = String(value || '').replace(/[^\d]/g, '');
      if (!digits) return '';
      const matched = digits.match(/1\d{10}/);
      if (matched) return matched[0];
      if (digits.length === 13 && digits.startsWith('86') && /^1\d{10}$/.test(digits.slice(2))) return digits.slice(2);
      if (digits.length === 14 && digits.startsWith('0086') && /^1\d{10}$/.test(digits.slice(4))) return digits.slice(4);
      return '';
    };
    const applyField = (party: 'A' | 'B', key: string, value: string) => {
      const normalizedValue = String(value || '').trim();
      if (!normalizedValue) return;
      const fieldKey = `${party === 'A' ? 'partyA' : 'partyB'}${key}`;
      if (!String(fields[fieldKey] || '').trim()) {
        fields[fieldKey] = normalizedValue;
      }
    };
    const applySegment = (party: 'A' | 'B', segment: string) => {
      const source = String(segment || '').replace(/\s{2,}/g, ' ').trim();
      if (!source) return;

      if (party === 'A' && !String(fields.clientName || '').trim()) {
        const matched = source.match(/(?:甲方|采购方|委托方|发包方|需方|购方|购买方|买方)(?:名称|单位名称)?\s*(?:（[^）\n]{0,12}）|\([^)\n]{0,12}\))?\s*[：:]\s*(.+)$/);
        const value = sanitizeName(matched?.[1] || '');
        if (value) fields.clientName = value;
      }
      if (party === 'B' && !String(fields.partyBName || '').trim()) {
        const matched = source.match(/(?:乙方|供应方|受托方|承包方|供方|销方|销售方|卖方)(?:名称|单位名称)?\s*(?:（[^）\n]{0,12}）|\([^)\n]{0,12}\))?\s*[：:]\s*(.+)$/);
        const value = sanitizeName(matched?.[1] || '');
        if (value) fields.partyBName = value;
      }

      const contactName = matchFirstFrom(source, [
        /项目联系人[：:\s]*([^\n，,；;]+?)(?=\s*(?:通讯地址|联系电话|电话|手机|手机号|邮箱|电子信箱|传真|$))/,
        /(对接人|联络人|经办人|联系人|负责人)[：:\s]*([^\n，,；;]+?)(?=\s*(?:通讯地址|联系电话|电话|手机|手机号|邮箱|电子信箱|传真|$))/,
      ]);
      if (contactName) applyField(party, 'Contact', contactName);

      const contactNumber = normalizePhoneLike(matchFirstFrom(source, [
        /(?:联系人手机|联系人手机号|手机|手机号|移动电话|联系人电话|联系人联系电话|联系电话|电话|座机|固话)[：:\s]*([+()（）0-9\s－—–-]{6,30}\d)/,
      ]));
      if (contactNumber) {
        const mobile = extractMobileDigits(contactNumber);
        if (mobile) {
          applyField(party, 'ContactMobile', mobile);
        } else {
          applyField(party, 'ContactPhone', contactNumber);
        }
      }

      const email = matchFirstFrom(source, [
        /(电子信箱|邮箱|E-?mail|Email)[：:\s]*([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})/i,
        /(?:联系人邮箱|联系人电子信箱)[：:\s]*([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})/i,
      ]);
      if (email.includes('@')) applyField(party, 'ContactEmail', email.split(/[\s，,；;]+/)[0] || '');

      const taxNumber = normalizeTaxNumber(matchFirstFrom(source, [
        /(税号|纳税人识别号|统一社会信用代码)[：:\s]*([0-9A-Za-z][0-9A-Za-z\s\-]{13,30})/,
      ]));
      if (taxNumber.length >= 15 && taxNumber.length <= 20) applyField(party, 'TaxNumber', taxNumber);

      const bankAccount = normalizeBankAccount(matchFirstFrom(source, [
        /(银行\s*[账帐]\s*号|开户\s*[账帐]\s*号|[账帐]\s*号)[：:\s]*([0-9][0-9\s\-]{9,32})/,
      ]));
      if (bankAccount.length >= 10 && bankAccount.length <= 32) applyField(party, 'BankAccount', bankAccount);

      const bankName = normalizeBankName(matchFirstFrom(source, [
        /(开户行|开户银行)[：:\s]*([^\n，,；;：:]+?)(?=\s*(?:银行\s*[账帐]\s*号|开户\s*[账帐]\s*号|[账帐]\s*号|税号|纳税人识别号|统一社会信用代码|地址|电话|联系人|$))/,
        /(开户行|开户银行)[：:\s]*([^\n]+)$/,
      ]));
      if (bankName) applyField(party, 'BankName', bankName);
    };

    let blankCount = 0;
    const maxRegionLine = Math.min(lines.length - 1, anchor.lineIndex + 18);
    for (let i = anchor.lineIndex; i <= maxRegionLine; i += 1) {
      const line = String(lines[i] || '');
      if (!line.trim()) {
        blankCount += 1;
        if (blankCount >= 2 && i > anchor.lineIndex + 2) break;
        continue;
      }
      blankCount = 0;
      const leftSegment = line.slice(0, anchor.divider).trim();
      const rightSegment = line.slice(anchor.divider).trim();
      if (leftSegment) applySegment(anchor.leftParty, leftSegment);
      if (rightSegment) applySegment(anchor.rightParty, rightSegment);
    }

    return fields;
  };

  const pickFirstForParty = (party: 'A' | 'B', values: string[]) => {
    if (!Array.isArray(values) || values.length === 0) return '';
    if (values.length === 1) return values[0];
    const hasBuyerSeller = /(购方|购买方|买方|销方|销售方|卖方)/.test(normalized);
    if (hasBuyerSeller) return party === 'A' ? values[0] : values[1];
    return party === 'A' ? values[0] : values[1];
  };

  const pickFirstPartyScopedValue = (
    party: 'A' | 'B',
    values: Array<{ value: string; party: 'A' | 'B' | '' }>,
  ): string => {
    if (!Array.isArray(values) || values.length === 0) return '';
    const exact = values.find((item) => item.party === party && item.value);
    if (exact) return exact.value;
    const unlabeled = values.find((item) => !item.party && item.value);
    if (unlabeled) return unlabeled.value;
    return '';
  };

  const extractPartyContactFields = (party: 'A' | 'B') => {
    const allStartPatterns = [...partyAStartPatterns, ...partyBStartPatterns];

    const start = findFirstIndex(normalized, party === 'A' ? partyAStartPatterns : partyBStartPatterns, 0);
    if (start < 0) return;
    const endCandidate = findFirstIndex(normalized, allStartPatterns, start + 1);
    const end = endCandidate > start ? endCandidate : normalized.length;
    const block = normalized.slice(start, end);

    const contactNameMatch = matchFirstWithIndexFrom(block, [
      /项目联系人[：:\s]*([^\n，,；;]+?)(?=\s*(?:\n|通讯地址|联系电话|电话|手机|手机号|邮箱|电子信箱|传真|$))/,
      /(对接人|联络人|经办人|联系人|负责人)[：:\s]*([^\n，,；;]+?)(?=\s*(?:\n|通讯地址|联系电话|电话|手机|手机号|邮箱|电子信箱|传真|$))/,
    ]);
    const normalizedContactName = contactNameMatch.value ? String(contactNameMatch.value).trim() : '';
    const inferredContactParty = contactNameMatch.index >= 0 ? inferPartyByIndex(start + contactNameMatch.index) : '';
    if (normalizedContactName && (!inferredContactParty || inferredContactParty === party)) {
      result[party === 'A' ? 'partyAContact' : 'partyBContact'] = normalizedContactName;
    }

    const extractMobileDigits = (value: string): string => {
      const digits = String(value || '').replace(/[^\d]/g, '');
      if (!digits) return '';
      const matched = digits.match(/1\d{10}/);
      if (matched) return matched[0];
      if (digits.length === 13 && digits.startsWith('86') && /^1\d{10}$/.test(digits.slice(2))) return digits.slice(2);
      if (digits.length === 14 && digits.startsWith('0086') && /^1\d{10}$/.test(digits.slice(4))) return digits.slice(4);
      return '';
    };
    const normalizePhoneLike = (value: string) => normalizeDash(String(value || '').trim())
      .replace(/[（）]/g, (char) => (char === '（' ? '(' : ')'))
      .replace(/\s+/g, '');

    const contactNumberMatch = matchFirstWithIndexFrom(block, [
      /(?:联系人手机|联系人手机号|手机|手机号|移动电话|联系人电话|联系人联系电话|联系电话|电话|座机|固话)[：:\s]*([+()（）0-9\s－—–-]{6,30}\d)/,
    ]);
    const contactNumberValue = normalizePhoneLike(contactNumberMatch.value || '');
    const inferredContactNumberParty = contactNumberMatch.index >= 0 ? inferPartyByIndex(start + contactNumberMatch.index) : '';
    const contactMobileDigits = extractMobileDigits(contactNumberValue);
    if (contactMobileDigits && (!inferredContactNumberParty || inferredContactNumberParty === party)) {
      result[party === 'A' ? 'partyAContactMobile' : 'partyBContactMobile'] = contactMobileDigits;
    } else if (contactNumberValue && (!inferredContactNumberParty || inferredContactNumberParty === party)) {
      result[party === 'A' ? 'partyAContactPhone' : 'partyBContactPhone'] = contactNumberValue;
    }

    const emailMatch = matchFirstWithIndexFrom(block, [
      /(电子信箱|邮箱|E-?mail|Email)[：:\s]*([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})/i,
      /(?:联系人邮箱|联系人电子信箱)[：:\s]*([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})/i,
    ]);
    const emailValue = emailMatch.value.includes('@') ? emailMatch.value.split(/[\s，,；;]+/)[0] : '';
    const inferredEmailParty = emailMatch.index >= 0 ? inferPartyByIndex(start + emailMatch.index) : '';
    if (emailValue && (!inferredEmailParty || inferredEmailParty === party)) {
      result[party === 'A' ? 'partyAContactEmail' : 'partyBContactEmail'] = emailValue;
    }

    const taxNumberMatch = matchFirstWithIndexFrom(block, [
      /(税号|纳税人识别号|统一社会信用代码)[：:\s]*([0-9A-Za-z][0-9A-Za-z\s\-]{13,30})/,
    ]);
    const normalizedTaxNumber = normalizeTaxNumber(
      taxNumberMatch.value.replace(/^(税号|纳税人识别号|统一社会信用代码)[：:\s]*/i, ''),
    );
    const inferredTaxParty = taxNumberMatch.index >= 0 ? inferPartyByIndex(start + taxNumberMatch.index) : '';
    if (normalizedTaxNumber.length >= 15 && normalizedTaxNumber.length <= 20 && (!inferredTaxParty || inferredTaxParty === party)) {
      result[party === 'A' ? 'partyATaxNumber' : 'partyBTaxNumber'] = normalizedTaxNumber;
    }

    const bankAccountMatch = matchFirstWithIndexFrom(block, [
      /(银行\s*[账帐]\s*号|开户\s*[账帐]\s*号|[账帐]\s*号)[：:\s]*([0-9][0-9\s\-]{9,32})/,
    ]);
    const normalizedBankAccount = normalizeBankAccount(
      bankAccountMatch.value.replace(/^(银行\s*[账帐]\s*号|开户\s*[账帐]\s*号|[账帐]\s*号)[：:\s]*/i, ''),
    );
    const inferredBankAccountParty = bankAccountMatch.index >= 0 ? inferPartyByIndex(start + bankAccountMatch.index) : '';
    if (normalizedBankAccount.length >= 10 && normalizedBankAccount.length <= 32 && (!inferredBankAccountParty || inferredBankAccountParty === party)) {
      result[party === 'A' ? 'partyABankAccount' : 'partyBBankAccount'] = normalizedBankAccount;
    }

    const bankNameMatch = matchFirstWithIndexFrom(block, [
      /(开户行|开户银行)[：:\s]*([^\n，,；;：:]+?)(?=\s*(?:\n|银行\s*[账帐]\s*号|开户\s*[账帐]\s*号|[账帐]\s*号|税号|纳税人识别号|统一社会信用代码|地址|电话|联系人|$))/,
    ]);
    let normalizedBankName = normalizeBankName(bankNameMatch.value);
    const inferredBankParty = bankNameMatch.index >= 0 ? inferPartyByIndex(start + bankNameMatch.index) : '';
    if (normalizedBankName) {
      const continuation = extractBankContinuationLine(block, bankNameMatch.index);
      if (continuation) {
        normalizedBankName = normalizeBankName(`${normalizedBankName}${continuation}`);
      }
    }
    if (normalizedBankName && (!inferredBankParty || inferredBankParty === party)) {
      result[party === 'A' ? 'partyABankName' : 'partyBBankName'] = normalizedBankName;
    }
  };

  const contractCode = matchFirst([
    /合同编号[：:\s]*([A-Za-z0-9\-_/]+)\b/,
    /协议编号[：:\s]*([A-Za-z0-9\-_/]+)\b/,
    /编号[：:\s]*([A-Za-z0-9\-_/]{4,})\b/,
  ]);
  if (contractCode) result.contractCode = contractCode;

  const signingDate = matchFirst([
    /签订日期[：:\s]*(\d{4}[-/.年]\d{1,2}[-/.月]\d{1,2}日?)/,
    /签约日期[：:\s]*(\d{4}[-/.年]\d{1,2}[-/.月]\d{1,2}日?)/,
    /签署日期[：:\s]*(\d{4}[-/.年]\d{1,2}[-/.月]\d{1,2}日?)/,
  ]);
  if (signingDate) result.signingDate = normalizeRuleDate(signingDate);

  const clientName = matchFirst([
    /甲方[：:\s]*([^\n（）()]+?)(?:\n|$)/,
    /采购方[：:\s]*([^\n（）()]+?)(?:\n|$)/,
    /委托方[：:\s]*([^\n（）()]+?)(?:\n|$)/,
    /需方[：:\s]*([^\n（）()]+?)(?:\n|$)/,
  ]);
  if (clientName) result.clientName = clientName;

  const partyBName = matchFirst([
    /乙方[：:\s]*([^\n（）()]+?)(?:\n|$)/,
    /供应方[：:\s]*([^\n（）()]+?)(?:\n|$)/,
    /受托方[：:\s]*([^\n（）()]+?)(?:\n|$)/,
    /供方[：:\s]*([^\n（）()]+?)(?:\n|$)/,
  ]);
  if (partyBName) result.partyBName = partyBName;

  const extractAmountCandidate = () => {
    const patterns: Array<{ label: string; weight: number; regex: RegExp }> = [
      { label: '本合同总金额', weight: 101, regex: /本合同总金额(?:为)?[：:\s]*[人民币¥￥]*\s*(?:[零〇壹贰叁肆伍陆柒捌玖拾佰仟万亿两元圆角分整]{0,40})?\s*(?:[（(]\s*)?(?:[¥￥]\s*[:：]?\s*)?([0-9][0-9,，]*(?:\.\d{1,4})?)\s*(万)?\s*元?/g },
      { label: '合同总金额', weight: 100, regex: /合同总金额(?:为)?[：:\s]*[人民币¥￥]*\s*(?:[零〇壹贰叁肆伍陆柒捌玖拾佰仟万亿两元圆角分整]{0,40})?\s*(?:[（(]\s*)?(?:[¥￥]\s*[:：]?\s*)?([0-9][0-9,，]*(?:\.\d{1,4})?)\s*(万)?\s*元?/g },
      { label: '合同总价', weight: 100, regex: /合同总价(?:为)?[：:\s]*[人民币¥￥]*\s*(?:[零〇壹贰叁肆伍陆柒捌玖拾佰仟万亿两元圆角分整]{0,40})?\s*(?:[（(]\s*)?(?:[¥￥]\s*[:：]?\s*)?([0-9][0-9,，]*(?:\.\d{1,4})?)\s*(万)?\s*元?/g },
      { label: '合同金额', weight: 95, regex: /合同金额(?:为)?[：:\s]*[人民币¥￥]*\s*(?:[零〇壹贰叁肆伍陆柒捌玖拾佰仟万亿两元圆角分整]{0,40})?\s*(?:[（(]\s*)?(?:[¥￥]\s*[:：]?\s*)?([0-9][0-9,，]*(?:\.\d{1,4})?)\s*(万)?\s*元?/g },
      { label: '含税总价', weight: 92, regex: /含税总价(?:为)?[：:\s]*[人民币¥￥]*\s*(?:[零〇壹贰叁肆伍陆柒捌玖拾佰仟万亿两元圆角分整]{0,40})?\s*(?:[（(]\s*)?(?:[¥￥]\s*[:：]?\s*)?([0-9][0-9,，]*(?:\.\d{1,4})?)\s*(万)?\s*元?/g },
      { label: '含税总额', weight: 92, regex: /含税总额(?:为)?[：:\s]*[人民币¥￥]*\s*(?:[零〇壹贰叁肆伍陆柒捌玖拾佰仟万亿两元圆角分整]{0,40})?\s*(?:[（(]\s*)?(?:[¥￥]\s*[:：]?\s*)?([0-9][0-9,，]*(?:\.\d{1,4})?)\s*(万)?\s*元?/g },
      { label: '含税合计', weight: 90, regex: /含税\s*合计(?:金额)?\s*(?:[（(]\s*元\s*[)）])?\s*[：:\s]*[人民币¥￥]*\s*(?:[零〇壹贰叁肆伍陆柒捌玖拾佰仟万亿两元圆角分整]{0,40})?\s*(?:[（(]\s*)?(?:[¥￥]\s*[:：]?\s*)?([0-9][0-9,，]*(?:\.\d{1,4})?)\s*(万)?\s*元?/g },
      { label: '（含税）合计', weight: 90, regex: /[（(]\s*含税\s*[)）]\s*合计\s*(?:[（(]\s*元\s*[)）])?\s*[：:\s]*[人民币¥￥]*\s*(?:[零〇壹贰叁肆伍陆柒捌玖拾佰仟万亿两元圆角分整]{0,40})?\s*(?:[（(]\s*)?(?:[¥￥]\s*[:：]?\s*)?([0-9][0-9,，]*(?:\.\d{1,4})?)\s*(万)?\s*元?/g },
      { label: '价税合计', weight: 88, regex: /价税合计\s*(?:[（(]\s*元\s*[)）])?\s*[：:\s]*[人民币¥￥]*\s*(?:[零〇壹贰叁肆伍陆柒捌玖拾佰仟万亿两元圆角分整]{0,40})?\s*(?:[（(]\s*)?(?:[¥￥]\s*[:：]?\s*)?([0-9][0-9,，]*(?:\.\d{1,4})?)\s*(万)?\s*元?/g },
      { label: '合同总额', weight: 94, regex: /合同总额[^\n]{0,80}?(?:人民币|[¥￥])[^\n]{0,80}?(?:[¥￥]\s*[:：]?\s*)?([0-9][0-9,，]*(?:\.\d{1,4})?)\s*(万)?\s*元?/g },
      { label: '合同总金额（宽松）', weight: 93, regex: /合同总金额[^\n]{0,80}?(?:人民币|[¥￥])[^\n]{0,80}?(?:[¥￥]\s*[:：]?\s*)?([0-9][0-9,，]*(?:\.\d{1,4})?)\s*(万)?\s*元?/g },
      { label: '合同总价（宽松）', weight: 93, regex: /合同总价[^\n]{0,80}?(?:人民币|[¥￥])[^\n]{0,80}?(?:[¥￥]\s*[:：]?\s*)?([0-9][0-9,，]*(?:\.\d{1,4})?)\s*(万)?\s*元?/g },
      { label: '合同金额（宽松）', weight: 91, regex: /合同金额[^\n]{0,80}?(?:人民币|[¥￥])[^\n]{0,80}?(?:[¥￥]\s*[:：]?\s*)?([0-9][0-9,，]*(?:\.\d{1,4})?)\s*(万)?\s*元?/g },
      { label: '￥/¥ 金额（兜底）', weight: 70, regex: /(?:[（(]\s*)?(?:人民币|[¥￥])[^\n]{0,120}?(?:[¥￥]\s*[:：]?\s*)?([0-9]{1,3}(?:[\s,，][0-9]{3})+(?:\.\d{1,4})?|[0-9]+(?:\.\d{1,4})?)\s*(万)?\s*元?/g },
    ];
    const candidates: Array<{ amount: number; score: number }> = [];
    for (const item of patterns) {
      for (const matched of normalized.matchAll(item.regex)) {
        const raw = String(matched[1] || '').trim();
        if (!raw) continue;
        const sourceText = String(matched[0] || '');
        const hasWanUnit = String(matched[2] || '').trim() === '万' || /万元/.test(sourceText) || /\d\s*万\s*元?/.test(sourceText);
        const base = Number(raw.replace(/[,，\s]/g, ''));
        const parsed = hasWanUnit ? base * 10000 : base;
        if (!Number.isFinite(parsed) || parsed <= 0) continue;
        const score = item.weight
          + (/[¥￥]/.test(sourceText) ? 1 : 0)
          + (/人民币/.test(sourceText) ? 1 : 0);
        candidates.push({ amount: parsed, score });
      }
    }
    if (candidates.length === 0) return undefined;
    candidates.sort((a, b) => b.score - a.score || b.amount - a.amount);
    return candidates[0].amount;
  };

  const amount = extractAmountCandidate();
  if (amount !== undefined) result.contractAmount = amount;

  extractPartyContactFields('A');
  extractPartyContactFields('B');

  const taxNumberMatches = (() => {
    const list: Array<{ value: string; party: 'A' | 'B' | '' }> = [];
    const seen = new Set<string>();
    const regex = /(税号|纳税人识别号|统一社会信用代码)[：:\s]*([0-9A-Za-z][0-9A-Za-z\s\-]{13,30})/g;
    let matched: RegExpExecArray | null;
    while ((matched = regex.exec(normalized)) !== null) {
      const value = normalizeTaxNumber(String(matched[2] || ''));
      if (value.length < 15 || value.length > 20 || seen.has(value)) continue;
      seen.add(value);
      list.push({ value, party: inferPartyForAccountLikeField(matched.index) });
      if (list.length >= 6) break;
    }
    return list;
  })();
  const bankAccountMatches = (() => {
    const list: Array<{ value: string; party: 'A' | 'B' | '' }> = [];
    const seen = new Set<string>();
    const regex = /(银行\s*[账帐]\s*号|开户\s*[账帐]\s*号|[账帐]\s*号)[：:\s]*([0-9][0-9\s\-]{9,32})/g;
    let matched: RegExpExecArray | null;
    while ((matched = regex.exec(normalized)) !== null) {
      const value = normalizeBankAccount(String(matched[2] || ''));
      if (value.length < 10 || value.length > 32 || seen.has(value)) continue;
      seen.add(value);
      list.push({ value, party: inferPartyForAccountLikeField(matched.index) });
      if (list.length >= 6) break;
    }
    return list;
  })();
  const bankNameMatches = (() => {
    const list: Array<{ value: string; party: 'A' | 'B' | '' }> = [];
    const seen = new Set<string>();
    const regex = /(开户行|开户银行)[：:\s]*([^\n，,；;：:]+)/g;
    let matched: RegExpExecArray | null;
    while ((matched = regex.exec(normalized)) !== null) {
      const base = String(matched[2] || '').trim();
      const continuation = extractBankContinuationLine(normalized, matched.index);
      const value = normalizeBankName(`${base}${continuation}`);
      if (!value || seen.has(value)) continue;
      seen.add(value);
      list.push({ value, party: inferPartyForAccountLikeField(matched.index) });
      if (list.length >= 6) break;
    }
    return list;
  })();

  if (!String(result.partyATaxNumber || '').trim()) {
    const picked = pickFirstPartyScopedValue('A', taxNumberMatches);
    if (picked) result.partyATaxNumber = picked;
  }
  if (!String(result.partyBTaxNumber || '').trim()) {
    const picked = pickFirstPartyScopedValue('B', taxNumberMatches);
    if (picked) result.partyBTaxNumber = picked;
  }
  if (!String(result.partyABankAccount || '').trim()) {
    const picked = pickFirstPartyScopedValue('A', bankAccountMatches);
    if (picked) result.partyABankAccount = picked;
  }
  if (!String(result.partyBBankAccount || '').trim()) {
    const picked = pickFirstPartyScopedValue('B', bankAccountMatches);
    if (picked) result.partyBBankAccount = picked;
  }
  if (!String(result.partyABankName || '').trim()) {
    const picked = pickFirstPartyScopedValue('A', bankNameMatches);
    if (picked) result.partyABankName = picked;
  }
  if (!String(result.partyBBankName || '').trim()) {
    const picked = pickFirstPartyScopedValue('B', bankNameMatches);
    if (picked) result.partyBBankName = picked;
  }

  const dualColumnFields = extractDualColumnPartyFields();
  if (String(dualColumnFields.clientName || '').trim()) {
    result.clientName = dualColumnFields.clientName;
  }
  if (String(dualColumnFields.partyBName || '').trim()) {
    result.partyBName = dualColumnFields.partyBName;
  }
  [
    'partyAContact',
    'partyAContactPhone',
    'partyAContactMobile',
    'partyAContactEmail',
    'partyATaxNumber',
    'partyABankName',
    'partyABankAccount',
    'partyBContact',
    'partyBContactPhone',
    'partyBContactMobile',
    'partyBContactEmail',
    'partyBTaxNumber',
    'partyBBankName',
    'partyBBankAccount',
  ].forEach((fieldKey) => {
    const value = String(dualColumnFields[fieldKey] || '').trim();
    if (value) result[fieldKey] = value;
  });

  const normalizePlate = (value: string) => String(value || '')
    .replace(/[^\u4e00-\u9fa5A-Za-z0-9挂学警港澳]/g, '')
    .replace(/\s+/g, '')
    .toUpperCase()
    .trim()

  const extractPlateCandidate = (): string => {
    const direct = matchFirst([
      /车牌号[：:\s]*([^\n，,；;。]{4,20})/,
      /号牌(?:号码|号)?[：:\s]*([^\n，,；;。]{4,20})/,
      /车牌(?:号码)?[：:\s]*([^\n，,；;。]{4,20})/,
      /车辆(?:号牌|牌照)[：:\s]*([^\n，,；;。]{4,20})/,
      /车号为[：:\s]*([^\s，,；;。]{5,20})/,
    ])
    const platePattern = /([\u4e00-\u9fa5][A-Z][A-Z0-9]{4,6}[A-Z0-9挂学警港澳]?)/gi
    const scanSource = direct ? direct : normalized
    const matches = Array.from(scanSource.matchAll(platePattern))
      .map(item => normalizePlate(String(item[1] || '')))
      .filter(Boolean)
    const best = matches.find(item => item.length >= 7) || matches[0] || ''
    return normalizePlate(best)
  }

  const plate = extractPlateCandidate()
  if (plate) {
    const plateKeys = [
      'car_plate',
      'carplate',
      'carplatenumber',
      'plate_number',
      'platenumber',
      'license_plate',
      'licenseplate',
      'vehicle_plate',
      'vehicleplate',
      'vehicle_no',
      'vehicleno',
      'car_no',
      'carno',
    ]
    for (const key of plateKeys) {
      if (!String(result[key] || '').trim()) result[key] = plate
    }
  }

  const extractLeaseDateRange = (): { start: string; end: string } => {
    const datePattern = /(\d{4})\s*[年./-]\s*(\d{1,2})\s*[月./-]\s*(\d{1,2})\s*日?/g
    const normalizeDateTokens = (source: string): string[] => {
      const list: string[] = []
      for (const matched of source.matchAll(datePattern)) {
        const year = String(matched[1] || '').trim()
        const month = String(matched[2] || '').trim().padStart(2, '0')
        const day = String(matched[3] || '').trim().padStart(2, '0')
        if (!year) continue
        const iso = `${year}-${month}-${day}`
        if (!list.includes(iso)) list.push(iso)
        if (list.length >= 4) break
      }
      return list
    }

    const windowMatch = matchFirst([
      /租期[^。\n]{0,120}/,
      /租赁期限[^。\n]{0,120}/,
      /租赁期间[^。\n]{0,120}/,
      /租用期限[^。\n]{0,120}/,
      /租用期[^。\n]{0,120}/,
      /起租[^。\n]{0,120}/,
      /还车[^。\n]{0,120}/,
    ])
    const candidatesFromWindow = windowMatch ? normalizeDateTokens(windowMatch) : []
    if (candidatesFromWindow.length >= 2) {
      return { start: candidatesFromWindow[0], end: candidatesFromWindow[1] }
    }

    const rangeMatch = normalized.match(/(?:自|从)\s*(\d{4}\s*[年./-]\s*\d{1,2}\s*[月./-]\s*\d{1,2}\s*日?)\s*(?:起|开始)?\s*(?:至|到)\s*(\d{4}\s*[年./-]\s*\d{1,2}\s*[月./-]\s*\d{1,2}\s*日?)\s*(?:止|为止|结束|终止)?/)
    if (rangeMatch) {
      const start = normalizeRuleDate(rangeMatch[1])
      const end = normalizeRuleDate(rangeMatch[2])
      if (start && end) return { start, end }
    }

    const rangeMatch2 = normalized.match(/(\d{4}\s*[年./-]\s*\d{1,2}\s*[月./-]\s*\d{1,2}\s*日?)\s*(?:起|开始)?\s*(?:至|到)\s*(\d{4}\s*[年./-]\s*\d{1,2}\s*[月./-]\s*\d{1,2}\s*日?)\s*(?:止|为止|结束|终止)?/)
    if (rangeMatch2) {
      const start = normalizeRuleDate(rangeMatch2[1])
      const end = normalizeRuleDate(rangeMatch2[2])
      if (start && end) return { start, end }
    }

    const allDates = normalizeDateTokens(normalized)
    if (allDates.length >= 2) {
      return { start: allDates[0], end: allDates[1] }
    }
    return { start: '', end: '' }
  }

  const leaseRange = extractLeaseDateRange()
  if (leaseRange.start) {
    const startKeys = [
      'start_date',
      'startdate',
      'begin_date',
      'begindate',
      'start_time',
      'starttime',
      'lease_start_date',
      'rent_start_date',
      'rental_start_date',
      'begin_time',
      'begintime',
    ]
    for (const key of startKeys) {
      if (!String(result[key] || '').trim()) result[key] = leaseRange.start
    }
    if (!String(result.startDate || '').trim()) {
      result.startDate = leaseRange.start
    }
  }
  if (leaseRange.end) {
    const endKeys = [
      'end_date',
      'enddate',
      'finish_date',
      'finishdate',
      'end_time',
      'endtime',
      'lease_end_date',
      'rent_end_date',
      'rental_end_date',
      'return_date',
      'returndate',
    ]
    for (const key of endKeys) {
      if (!String(result[key] || '').trim()) result[key] = leaseRange.end
    }
    if (!String(result.endDate || '').trim()) {
      result.endDate = leaseRange.end
    }
  }

  return result;
}

function normalizeRuleDate(value: string): string {
  const text = String(value || '').trim();
  const matched = text.match(/(\d{4})[-/.年](\d{1,2})[-/.月](\d{1,2})/);
  if (!matched) return text;
  const year = matched[1];
  const month = matched[2].padStart(2, '0');
  const day = matched[3].padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function mergeRuleBasedFields(
  aiFields: Record<string, unknown>,
  ruleFields: Record<string, unknown>,
  schema: AIStructuredFieldDefinition[],
  stages: NonNullable<AIContractExtractionResult['stages']>,
): Record<string, unknown> {
  const merged: Record<string, unknown> = { ...aiFields };
  const conflicts: string[] = [];
  const appliedFallbacks: string[] = [];

  const schemaTypeMap = new Map<string, string>(
    (Array.isArray(schema) ? schema : []).map((field) => [String(field.key || '').trim(), String(field.type || '').trim()]),
  );
  const inferType = (value: unknown): string => {
    if (Array.isArray(value)) return 'array';
    if (value !== null && typeof value === 'object') return 'object';
    if (typeof value === 'number') return 'number';
    if (typeof value === 'boolean') return 'boolean';
    return 'string';
  };
  const isValidByType = (fieldKey: string, value: unknown, expectedType: string): boolean => {
    if (value === null || value === undefined) return false;
    if (expectedType === 'string') return typeof value === 'string' && String(value).trim().length > 0;
    if (expectedType === 'number') {
      if (typeof value !== 'number' || !Number.isFinite(value)) return false;
      if (fieldKey === 'contractAmount') return value > 0;
      return true;
    }
    if (expectedType === 'array') return Array.isArray(value) && value.length > 0;
    if (expectedType === 'boolean') return typeof value === 'boolean';
    if (expectedType === 'object') return typeof value === 'object' && value !== null && !Array.isArray(value);
    return String(value).trim().length > 0;
  };

  for (const [key, ruleValue] of Object.entries(ruleFields)) {
    const aiValue = merged[key];
    const aiText = normalizeCompareValue(aiValue);
    const ruleText = normalizeCompareValue(ruleValue);
    if (!ruleText) continue;

    const expectedType = schemaTypeMap.get(key) || inferType(ruleValue);
    const aiValid = isValidByType(key, aiValue, expectedType);
    const ruleValid = isValidByType(key, ruleValue, expectedType);

    if (key === 'contractAmount' && aiValid && ruleValid && typeof aiValue === 'number' && typeof ruleValue === 'number') {
      const aiAmount = aiValue;
      const ruleAmount = ruleValue;
      if (aiAmount > 0 && aiAmount < 100 && ruleAmount >= 1000 && ruleAmount / aiAmount >= 50) {
        merged[key] = ruleAmount;
        appliedFallbacks.push('contractAmount');
        continue;
      }
    }

    if (!aiValid && ruleValid) {
      merged[key] = ruleValue;
      appliedFallbacks.push(key);
      continue;
    }

    if (aiValid && ruleValid && aiText !== ruleText) {
      conflicts.push(`${key}(AI=${aiText}; Rule=${ruleText})`);
    }
  }

  if (appliedFallbacks.length > 0) {
    stages.push({
      stage: 'extract',
      success: true,
      message: `规则兜底补全：${appliedFallbacks.join('、')}`,
    });
  }

  if (conflicts.length > 0) {
    stages.push({
      stage: 'extract',
      success: false,
      message: `规则校验发现冲突：${conflicts.join('；')}`,
    });
  }

  return merged;
}

function normalizeContactNumberFallback(fields: Record<string, unknown>): Record<string, unknown> {
  const merged: Record<string, unknown> = { ...fields };

  const normalizeDash = (value: string) => String(value || '').trim().replace(/[－—–]/g, '-');
  const normalizePhoneLike = (value: string) => normalizeDash(String(value || '').trim())
    .replace(/[（）]/g, (char) => (char === '（' ? '(' : ')'))
    .replace(/\s+/g, '');
  const extractMobileDigits = (value: string): string => {
    const digits = String(value || '').replace(/[^\d]/g, '');
    if (!digits) return '';
    const matched = digits.match(/1\d{10}/);
    if (matched) return matched[0];
    if (digits.length === 13 && digits.startsWith('86') && /^1\d{10}$/.test(digits.slice(2))) return digits.slice(2);
    if (digits.length === 14 && digits.startsWith('0086') && /^1\d{10}$/.test(digits.slice(4))) return digits.slice(4);
    return '';
  };

  const apply = (party: 'A' | 'B') => {
    const mobileKey = party === 'A' ? 'partyAContactMobile' : 'partyBContactMobile';
    const phoneKey = party === 'A' ? 'partyAContactPhone' : 'partyBContactPhone';

    const rawMobile = normalizePhoneLike(String(merged[mobileKey] ?? ''));
    const rawPhone = normalizePhoneLike(String(merged[phoneKey] ?? ''));

    if (rawMobile) {
      const digits = extractMobileDigits(rawMobile);
      if (digits) {
        merged[mobileKey] = digits;
        if (!rawPhone) return;
      } else {
        if (!rawPhone) merged[phoneKey] = rawMobile;
        merged[mobileKey] = rawMobile;
        return;
      }
    }

    if (!rawMobile && rawPhone) {
      const digits = extractMobileDigits(rawPhone);
      merged[mobileKey] = digits || rawPhone;
    }
  };

  apply('A');
  apply('B');

  return merged;
}

type SaleSubjectItem = Record<string, string>;

function enrichSaleContractSummary(
  fields: Record<string, unknown>,
  contractType: string,
): Record<string, unknown> {
  if (!isSaleLikeContractType(contractType)) return fields;
  const items = normalizeSaleSubjectItems(fields.saleSubjectItems);
  if (items.length === 0) return fields;

  const next: Record<string, unknown> = { ...fields };
  const tableSummary = buildSaleSubjectSummaryTable(items);
  if (!tableSummary) return next;

  const currentSummary = String(next.contractSummary || '').trim();
  const compactCurrentSummary = stripMarkdownTable(currentSummary);
  if (compactCurrentSummary && !looksLikeDuplicateSaleSummary(compactCurrentSummary, items)) {
    next.contractSummary = `${tableSummary}\n\n补充说明：${compactCurrentSummary}`;
  } else {
    next.contractSummary = tableSummary;
  }
  return next;
}

function normalizeSaleSubjectItems(value: unknown): SaleSubjectItem[] {
  if (!Array.isArray(value)) return [];
  const rows: SaleSubjectItem[] = [];

  for (const item of value) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
    const row = item as Record<string, unknown>;
    const normalized: SaleSubjectItem = {};
    for (const [rawKey, rawValue] of Object.entries(row)) {
      const key = normalizeSaleSubjectColumnName(rawKey);
      if (!key) continue;
      const valueText = normalizeSaleSubjectCellValue(rawValue);
      if (!valueText) continue;
      normalized[key] = valueText;
    }
    if (!hasSaleSubjectItemContent(normalized)) continue;
    rows.push(normalized);
    if (rows.length >= 20) break;
  }

  return rows;
}

function normalizeSaleSubjectColumnName(value: string): string {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const aliasMap: Record<string, string> = {
    name: '标的名称',
    itemname: '标的名称',
    subjectname: '标的名称',
    productname: '产品名称',
    goodsname: '货物名称',
    targetname: '标的名称',
    title: '标的名称',
    specification: '规格型号',
    spec: '规格型号',
    model: '规格型号',
    specmodel: '规格型号',
    modelno: '规格型号',
    brandmodel: '品牌型号',
    unit: '单位',
    measureunit: '单位',
    uom: '单位',
    quantity: '数量',
    qty: '数量',
    count: '数量',
    amountqty: '数量',
    unitprice: '单价',
    price: '单价',
    pricewithtax: '含税单价',
    taxincludedunitprice: '含税单价',
    amount: '金额',
    totalamount: '金额',
    lineamount: '金额',
    subtotal: '小计',
    remark: '备注',
    remarks: '备注',
    note: '备注',
    comment: '备注',
  };
  const normalizedKey = raw.replace(/[\s_\-]+/g, '').toLowerCase();
  return aliasMap[normalizedKey] || raw;
}

function normalizeSaleSubjectCellValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') {
    if (Array.isArray(value)) {
      return value.map(item => String(item ?? '').trim()).filter(Boolean).join(' / ');
    }
    return '';
  }
  return String(value || '')
    .replace(/\s+/g, ' ')
    .replace(/[，,]\s*(?=\d{3}\b)/g, '')
    .trim();
}

function hasSaleSubjectItemContent(item: SaleSubjectItem): boolean {
  return Object.values(item).some(value => String(value || '').trim().length > 0);
}

function buildSaleSubjectSummaryTable(items: SaleSubjectItem[]): string {
  if (!Array.isArray(items) || items.length === 0) return '';
  const columns = collectSaleSubjectColumns(items);
  if (columns.length === 0) return '';
  const header = [
    `| ${columns.map(formatMarkdownTableCell).join(' | ')} |`,
    `| ${columns.map(() => '---').join(' | ')} |`,
  ];
  const body = items.map((item) => columns.map((column) => formatMarkdownTableCell(item[column])).join(' | '));
  return ['采购标的明细：', ...header.map(line => line), ...body.map(line => `| ${line} |`)].join('\n');
}

function collectSaleSubjectColumns(items: SaleSubjectItem[]): string[] {
  const ordered: string[] = [];
  const seen = new Set<string>();
  for (const item of items) {
    for (const key of Object.keys(item)) {
      const normalizedKey = String(key || '').trim();
      if (!normalizedKey || seen.has(normalizedKey)) continue;
      seen.add(normalizedKey);
      ordered.push(normalizedKey);
    }
  }
  return ordered.filter((column) => items.some((item) => String(item[column] || '').trim()));
}

function formatMarkdownTableCell(value: unknown): string {
  const text = String(value || '').trim();
  if (!text) return '-';
  return text.replace(/\|/g, '\\|').replace(/\r?\n+/g, ' / ');
}

function stripMarkdownTable(text: string): string {
  return String(text || '')
    .split('\n')
    .filter(line => !/^\s*\|.*\|\s*$/.test(line) && !/^\s*\|\s*[-: ]+\|\s*$/.test(line))
    .join('\n')
    .trim();
}

function looksLikeDuplicateSaleSummary(summary: string, items: SaleSubjectItem[]): boolean {
  const normalizedSummary = String(summary || '').replace(/\s+/g, '').toLowerCase();
  if (!normalizedSummary) return false;
  const itemNames = items
    .map(item => extractPrimarySaleSubjectLabel(item))
    .map(item => String(item || '').replace(/\s+/g, '').toLowerCase())
    .filter(Boolean);
  if (itemNames.length === 0) return false;
  const hitCount = itemNames.filter(name => normalizedSummary.includes(name)).length;
  return hitCount > 0 && hitCount >= Math.min(itemNames.length, 2);
}

function extractPrimarySaleSubjectLabel(item: SaleSubjectItem): string {
  const preferredKeys = [
    '标的名称',
    '名称',
    '产品名称',
    '货物名称',
    '采购内容',
    '服务内容',
    '项目名称',
  ];
  for (const key of preferredKeys) {
    const value = String(item[key] || '').trim();
    if (value) return value;
  }
  for (const [key, value] of Object.entries(item)) {
    if (/(名称|标的|产品|货物|内容|项目)/.test(key) && String(value || '').trim()) {
      return String(value || '').trim();
    }
  }
  return Object.values(item).find(value => String(value || '').trim()) || '';
}

function normalizeCompareValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : '';
  return String(value).trim();
}

type OcrPageBlocks = { pageNumber: number; blocks: OcrTextBlock[] };
type OcrLinePhraseMatch = {
  phrase: string;
  left: number;
  top: number;
  width: number;
  height: number;
};

function extractRuleBasedFieldsFromOcrPages(pages: OcrPageBlocks[]): Record<string, unknown> {
  if (!Array.isArray(pages) || pages.length === 0) return {};

  const anchor = findDualColumnAnchorFromOcrPages(pages);
  // #region debug-point B:ocr-anchor
  (()=>{const p='.dbg/party-ocr-mixup.env';let u='http://127.0.0.1:7777/event',s='party-ocr-mixup';try{const e=require('fs').readFileSync(p,'utf8');u=e.match(/DEBUG_SERVER_URL=(.+)/)?.[1]||u;s=e.match(/DEBUG_SESSION_ID=(.+)/)?.[1]||s}catch{}fetch(u,{method:'POST',body:JSON.stringify({sessionId:s,runId:'pre-fix',hypothesisId:'B',location:'AIService.ts:1947',msg:anchor?'[DEBUG] OCR dual-column anchor resolved':'[DEBUG] OCR dual-column anchor missing',data:{pageCount:pages.length,anchor,tailPages:pages.slice(-3).map(page=>({pageNumber:page.pageNumber,blockCount:Array.isArray(page.blocks)?page.blocks.length:0,sample:(page.blocks||[]).slice(0,12).map(block=>String(block?.text||'').trim()).filter(Boolean)}))},ts:Date.now()})}).catch(()=>{})})();
  // #endregion
  if (!anchor) return {};

  const page = pages.find(item => item.pageNumber === anchor.pageNumber);
  const lines = groupOcrBlocksByVisualLine(page?.blocks || []);
  if (lines.length === 0) return {};

  const leftLines: string[] = [];
  const rightLines: string[] = [];
  const maxLineIndex = Math.min(lines.length - 1, anchor.lineIndex + 22);
  for (let index = Math.max(0, anchor.lineIndex); index <= maxLineIndex; index += 1) {
    const lineBlocks = lines[index];
    const leftBlocks = lineBlocks.filter(block => getOcrBlockCenterX(block) < anchor.divider);
    const rightBlocks = lineBlocks.filter(block => getOcrBlockCenterX(block) >= anchor.divider);
    const leftText = buildCompactTextFromOcrBlocks(leftBlocks);
    const rightText = buildCompactTextFromOcrBlocks(rightBlocks);
    if (leftText) leftLines.push(leftText);
    if (rightText) rightLines.push(rightText);
  }
  // #region debug-point C:ocr-columns
  (()=>{const p='.dbg/party-ocr-mixup.env';let u='http://127.0.0.1:7777/event',s='party-ocr-mixup';try{const e=require('fs').readFileSync(p,'utf8');u=e.match(/DEBUG_SERVER_URL=(.+)/)?.[1]||u;s=e.match(/DEBUG_SESSION_ID=(.+)/)?.[1]||s}catch{}fetch(u,{method:'POST',body:JSON.stringify({sessionId:s,runId:'pre-fix',hypothesisId:'C',location:'AIService.ts:1968',msg:'[DEBUG] OCR columns split from anchor page',data:{anchor,leftPreview:leftLines.slice(0,10),rightPreview:rightLines.slice(0,10)},ts:Date.now()})}).catch(()=>{})})();
  // #endregion

  const leftFields = extractFieldsFromOcrColumn(anchor.leftParty, leftLines);
  const rightFields = extractFieldsFromOcrColumn(anchor.rightParty, rightLines);
  return { ...leftFields, ...rightFields };
}

function groupOcrBlocksByVisualLine(blocks: OcrTextBlock[]): OcrTextBlock[][] {
  const sorted = [...(Array.isArray(blocks) ? blocks : [])]
    .filter(block => {
      const text = String(block?.text || '').replace(/\s+/g, '').trim();
      return Boolean(text)
        && Number.isFinite(block?.rect?.top)
        && Number.isFinite(block?.rect?.height)
        && Number.isFinite(block?.rect?.left)
        && Number.isFinite(block?.rect?.width);
    })
    .sort((a, b) => {
      const aCenter = a.rect.top + a.rect.height / 2;
      const bCenter = b.rect.top + b.rect.height / 2;
      const tolerance = Math.max(a.rect.height, b.rect.height) * 0.8;
      if (Math.abs(aCenter - bCenter) <= tolerance) {
        return a.rect.left - b.rect.left;
      }
      return aCenter - bCenter;
    });

  const lines: OcrTextBlock[][] = [];
  for (const block of sorted) {
    const lastLine = lines[lines.length - 1];
    const firstBlock = lastLine?.[0];
    if (!lastLine || !firstBlock) {
      lines.push([block]);
      continue;
    }
    const firstCenter = firstBlock.rect.top + firstBlock.rect.height / 2;
    const blockCenter = block.rect.top + block.rect.height / 2;
    const tolerance = Math.max(firstBlock.rect.height, block.rect.height) * 0.8;
    if (Math.abs(firstCenter - blockCenter) <= tolerance) {
      lastLine.push(block);
    } else {
      lines.push([block]);
    }
  }

  return lines.map(line => [...line].sort((a, b) => a.rect.left - b.rect.left));
}

function findDualColumnAnchorFromOcrPages(pages: OcrPageBlocks[]): {
  pageNumber: number;
  lineIndex: number;
  divider: number;
  leftParty: 'A' | 'B';
  rightParty: 'A' | 'B';
} | null {
  const orderedPages = [...pages].sort((a, b) => b.pageNumber - a.pageNumber);
  const partyAPhrases = ['甲方', '采购方', '委托方', '发包方', '需方', '购方', '购买方', '买方'];
  const partyBPhrases = ['乙方', '供应方', '受托方', '承包方', '供方', '销方', '销售方', '卖方'];

  for (const page of orderedPages) {
    const lines = groupOcrBlocksByVisualLine(page.blocks || []);
    for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
      const line = lines[lineIndex];
      const compactText = buildCompactTextFromOcrBlocks(line);
      if (!compactText) continue;
      const aMatch = findPhraseMatchInOcrLine(line, partyAPhrases);
      const bMatch = findPhraseMatchInOcrLine(line, partyBPhrases);
      if (!aMatch || !bMatch) continue;
      const aCenterX = aMatch.left + aMatch.width / 2;
      const bCenterX = bMatch.left + bMatch.width / 2;
      if (Math.abs(aCenterX - bCenterX) < 0.12) continue;
      const leftMatch = aCenterX <= bCenterX ? aMatch : bMatch;
      const rightMatch = aCenterX <= bCenterX ? bMatch : aMatch;
      const divider = Math.max(0.2, Math.min(0.8, (leftMatch.left + leftMatch.width + rightMatch.left) / 2));
      return {
        pageNumber: page.pageNumber,
        lineIndex,
        divider,
        leftParty: leftMatch === aMatch ? 'A' : 'B',
        rightParty: rightMatch === bMatch ? 'B' : 'A',
      };
    }
  }

  return null;
}

function findPhraseMatchInOcrLine(blocks: OcrTextBlock[], phrases: string[]): OcrLinePhraseMatch | null {
  const compactText = buildCompactTextFromOcrBlocks(blocks);
  if (!compactText) return null;

  const ranges: Array<{ start: number; end: number; block: OcrTextBlock }> = [];
  let cursor = 0;
  for (const block of blocks) {
    const blockText = compactOcrText(block.text);
    if (!blockText) continue;
    const start = cursor;
    cursor += blockText.length;
    ranges.push({ start, end: cursor, block });
  }

  for (const phrase of phrases) {
    const index = compactText.indexOf(phrase);
    if (index < 0) continue;
    const end = index + phrase.length;
    const matchedBlocks = ranges
      .filter(range => range.end > index && range.start < end)
      .map(range => range.block);
    if (matchedBlocks.length === 0) continue;
    const left = Math.min(...matchedBlocks.map(block => block.rect.left));
    const top = Math.min(...matchedBlocks.map(block => block.rect.top));
    const right = Math.max(...matchedBlocks.map(block => block.rect.left + block.rect.width));
    const bottom = Math.max(...matchedBlocks.map(block => block.rect.top + block.rect.height));
    return {
      phrase,
      left,
      top,
      width: right - left,
      height: bottom - top,
    };
  }

  return null;
}

function buildCompactTextFromOcrBlocks(blocks: OcrTextBlock[]): string {
  return (Array.isArray(blocks) ? blocks : [])
    .map(block => compactOcrText(block?.text))
    .filter(Boolean)
    .join('');
}

function compactOcrText(value: unknown): string {
  return String(value || '').replace(/\s+/g, '').trim();
}

function getOcrBlockCenterX(block: OcrTextBlock): number {
  return Number(block?.rect?.left || 0) + Number(block?.rect?.width || 0) / 2;
}

function extractFieldsFromOcrColumn(party: 'A' | 'B', sourceLines: string[]): Record<string, unknown> {
  const lines = (Array.isArray(sourceLines) ? sourceLines : [])
    .map(item => compactOcrLine(item))
    .filter(Boolean);
  if (lines.length === 0) return {};

  const result: Record<string, unknown> = {};
  const columnText = lines.join('\n');
  const assign = (fieldKey: string, value: string) => {
    const normalized = String(value || '').trim();
    if (!normalized) return;
    if (!String(result[fieldKey] || '').trim()) {
      result[fieldKey] = normalized;
    }
  };
  const partyNameKey = party === 'A' ? 'clientName' : 'partyBName';
  const partyAddressKey = party === 'A' ? 'partyAAddress' : 'partyBAddress';
  const partyPhoneKey = party === 'A' ? 'partyAPhone' : 'partyBPhone';
  const partyContactPhoneKey = party === 'A' ? 'partyAContactPhone' : 'partyBContactPhone';
  const partyContactMobileKey = party === 'A' ? 'partyAContactMobile' : 'partyBContactMobile';
  const partyContactKey = party === 'A' ? 'partyAContact' : 'partyBContact';
  const partyTaxKey = party === 'A' ? 'partyATaxNumber' : 'partyBTaxNumber';
  const partyBankNameKey = party === 'A' ? 'partyABankName' : 'partyBBankName';
  const partyBankAccountKey = party === 'A' ? 'partyABankAccount' : 'partyBBankAccount';

  const partyMarkerPattern = party === 'A'
    ? /(甲方|采购方|委托方|发包方|需方|购方|购买方|买方)[：:]?(.*)/
    : /(乙方|供应方|受托方|承包方|供方|销方|销售方|卖方)[：:]?(.*)/;
  for (const line of lines) {
    const matched = line.match(partyMarkerPattern);
    const value = cleanupOcrPartyName(matched?.[2] || '');
    if (value) {
      assign(partyNameKey, value);
      break;
    }
  }

  const accountName = cleanupOcrPartyName(findOcrValueFromLines(lines, ['户名', '名称']));
  if (accountName) assign(partyNameKey, accountName);

  const bankName = normalizeOcrBankName(findLikelyOcrBankName(lines));
  if (bankName) assign(partyBankNameKey, bankName);

  const bankAccount = normalizeOcrBankAccount(findOcrValueFromLines(lines, ['银行账号', '开户账号', '账号', '账号', '账户']));
  if (bankAccount) assign(partyBankAccountKey, bankAccount);

  const taxNumber = normalizeOcrTaxNumber(findOcrValueFromLines(lines, ['统一社会信用代码', '纳税人识别号', '税号']));
  if (taxNumber) assign(partyTaxKey, taxNumber);

  const address = normalizeOcrAddress(findOcrMultiLineValue(lines, ['地址', '通讯地址']));
  if (address) assign(partyAddressKey, address);

  const phone = normalizeOcrPhone(findOcrValueFromLines(lines, ['联系电话', '联系人电话', '电话', '手机', '手机号']));
  if (phone) {
    assign(partyPhoneKey, phone);
    if (/^1\d{10}$/.test(phone)) {
      assign(partyContactMobileKey, phone);
    } else {
      assign(partyContactPhoneKey, phone);
    }
  }

  const contact = cleanupOcrPersonName(findOcrValueFromLines(lines, [
    '项目联系人',
    '联系人',
    '对接人',
    '经办人',
    '负责人',
    '法定代表人或其委托代理人',
    '法定代表人',
  ]));
  if (contact) assign(partyContactKey, contact);

  const inlineAddress = normalizeOcrAddress(extractOcrInlineValue(columnText, ['地址', '通讯地址']));
  if (inlineAddress) assign(partyAddressKey, inlineAddress);

  // #region debug-point D:ocr-column-fields
  (()=>{const p='.dbg/party-ocr-mixup.env';let u='http://127.0.0.1:7777/event',s='party-ocr-mixup';try{const e=require('fs').readFileSync(p,'utf8');u=e.match(/DEBUG_SERVER_URL=(.+)/)?.[1]||u;s=e.match(/DEBUG_SESSION_ID=(.+)/)?.[1]||s}catch{}fetch(u,{method:'POST',body:JSON.stringify({sessionId:s,runId:'pre-fix',hypothesisId:'D',location:`AIService.ts:2138:${party}`,msg:'[DEBUG] OCR column fields extracted',data:{party,lineCount:lines.length,linesPreview:lines.slice(0,12),result},ts:Date.now()})}).catch(()=>{})})();
  // #endregion

  return result;
}

function compactOcrLine(value: unknown): string {
  return String(value || '')
    .replace(/\s+/g, '')
    .replace(/[|¦]/g, '')
    .trim();
}

function findOcrValueFromLines(lines: string[], labels: string[]): string {
  for (let index = 0; index < lines.length; index += 1) {
    const value = extractOcrLineValue(lines[index], labels);
    if (value) return value;
    const labelOnly = hasOcrLineLabelOnly(lines[index], labels);
    if (labelOnly && index + 1 < lines.length) {
      const next = sanitizeOcrContinuationLine(lines[index + 1]);
      if (next) return next;
    }
  }
  return '';
}

function findOcrMultiLineValue(lines: string[], labels: string[]): string {
  for (let index = 0; index < lines.length; index += 1) {
    const extracted = extractOcrLineValue(lines[index], labels);
    const labelOnly = hasOcrLineLabelOnly(lines[index], labels);
    if (!extracted && !labelOnly) continue;

    const parts: string[] = [];
    if (extracted) parts.push(extracted);
    for (let nextIndex = index + 1; nextIndex < Math.min(lines.length, index + 4); nextIndex += 1) {
      const nextLine = String(lines[nextIndex] || '').trim();
      if (!nextLine) break;
      if (containsAnyOcrLabel(nextLine, ['开户银行', '开户行', '银行账号', '开户账号', '账号', '账号', '账户', '统一社会信用代码', '纳税人识别号', '税号', '电话', '联系电话', '联系人', '甲方', '乙方', '户名', '名称'])) {
        break;
      }
      const continuation = sanitizeOcrContinuationLine(nextLine);
      if (!continuation) break;
      parts.push(continuation);
    }
    if (parts.length > 0) {
      return parts.join('');
    }
  }
  return '';
}

function extractOcrLineValue(line: string, labels: string[]): string {
  const compact = compactOcrLine(line);
  for (const label of labels) {
    const index = compact.indexOf(label);
    if (index < 0) continue;
    const tail = compact.slice(index + label.length).replace(/^[:：]+/, '').trim();
    if (tail) return tail;
  }
  return '';
}

function hasOcrLineLabelOnly(line: string, labels: string[]): boolean {
  const compact = compactOcrLine(line);
  return labels.some(label => compact === label || compact === `${label}：` || compact === `${label}:`);
}

function containsAnyOcrLabel(line: string, labels: string[]): boolean {
  const compact = compactOcrLine(line);
  return labels.some(label => compact.includes(label));
}

function sanitizeOcrContinuationLine(line: string): string {
  const compact = compactOcrLine(line);
  if (!compact) return '';
  if (/^(第\d+页|\d+\/\d+页)$/.test(compact)) return '';
  if (/^(合同专用|专用章|骑缝章|盖章)$/.test(compact)) return '';
  if (/^(签订日期|电话|联系电话|联系人|开户银行|开户行|账号|银行账号|统一社会信用代码|纳税人识别号|税号|甲方|乙方|户名|名称)[:：]?$/.test(compact)) return '';
  if (/^0\d{9,11}$/.test(compact)) return '';
  if (/^[A-Za-z]$/.test(compact)) return '';
  if (/^[\u4e00-\u9fa5A-Za-z]{1,4}$/.test(compact) && !/(银行|支行|公司|大厦|园区|街|路|区|县|市|镇|乡|村|室|号)/.test(compact)) return '';
  return compact;
}

function extractOcrInlineValue(text: string, labels: string[]): string {
  const compact = compactOcrLine(text);
  for (const label of labels) {
    const matched = compact.match(new RegExp(`${label}[：:]?(.+?)(?=(甲方|乙方|开户银行|开户行|账号|账[号户]|统一社会信用代码|纳税人识别号|税号|电话|联系电话|联系人|户名|名称|$))`));
    const value = String(matched?.[1] || '').trim();
    if (value) return value;
  }
  return '';
}

function cleanupOcrPartyName(value: string): string {
  let text = compactOcrLine(value)
    .replace(/^(名称|户名|名)[:：]?/, '')
    .replace(/(法定代表人或其委托代理人|法定代表人|签订日期|电话|开户地址?|开户银行|账号|账[号户]|统一社会信用代码|纳税人识别号|税号|地址).*/g, '')
    .trim();
  if (!text) return '';
  if (text.length < 4) return '';
  if (/^\d+$/.test(text)) return '';
  return text;
}

function cleanupOcrPersonName(value: string): string {
  const text = compactOcrLine(value)
    .replace(/(电话|手机|邮箱|电子邮箱|邮箱地址).*/g, '')
    .trim();
  if (!text) return '';
  if (/签字盖章|盖章|委托代理人|法定代表/.test(text)) return '';
  if (/^[（）()：:]+$/.test(text)) return '';
  if (text.length > 20) return '';
  return text;
}

function normalizeOcrTaxNumber(value: string): string {
  const text = String(value || '').toUpperCase().replace(/[^0-9A-Z]/g, '').trim();
  return text.length >= 15 && text.length <= 20 ? text : '';
}

function normalizeOcrBankAccount(value: string): string {
  const text = String(value || '').replace(/[^\d]/g, '').trim();
  return text.length >= 10 && text.length <= 32 ? text : '';
}

function normalizeOcrBankName(value: string): string {
  const text = compactOcrLine(value)
    .replace(/^(开户银行|开户行)[:：]?/, '')
    .replace(/(开户银行|开户行)[:：]?$/g, '')
    .replace(/(银行账号|开户地址?账号|开户地址?账[号户]|账号|账[号户]|统一社会信用代码|纳税人识别号|税号|地址|电话|联系人).*/g, '')
    .trim();
  if (!text) return '';
  if (!/(银行|信用社|农商行|农信社|合作联社|村镇银行|邮政储蓄)/.test(text)) return '';
  return text;
}

function normalizeOcrAddress(value: string): string {
  return compactOcrLine(value)
    .replace(/^(地址|通讯地址)[:：]?/, '')
    .replace(/(电话|联系电话|联系人|开户银行|开户地址?账号|开户地址?账[号户]|统一社会信用代码|纳税人识别号|税号).*/g, '')
    .replace(/0\d{9,11}$/g, '')
    .replace(/(贸专用M|专用M|合同专用|专用章)+$/g, '')
    .trim();
}

function normalizeOcrPhone(value: string): string {
  const digits = String(value || '').replace(/[^\d]/g, '');
  if (!digits) return '';
  const mobile = digits.match(/1\d{10}/);
  if (mobile) return mobile[0];
  const landline = digits.match(/0\d{9,11}/);
  if (landline) return landline[0];
  return '';
}

function findLikelyOcrBankName(lines: string[]): string {
  const labeled = findOcrMultiLineValue(lines, ['开户银行', '开户行']);
  const normalizedLabeled = normalizeOcrBankName(labeled);
  if (normalizedLabeled) return normalizedLabeled;

  for (const line of lines) {
    const compact = compactOcrLine(line);
    if (!compact) continue;
    if (containsAnyOcrLabel(compact, ['甲方', '乙方', '户名', '名称', '账号', '银行账号', '统一社会信用代码', '纳税人识别号', '税号', '地址', '电话', '签订日期'])) {
      continue;
    }
    const normalized = normalizeOcrBankName(compact);
    if (normalized) return normalized;
  }

  return '';
}

function applyAuthoritativeOcrPartyFields(
  fields: Record<string, unknown>,
  ocrFields: Record<string, unknown>,
  stages: NonNullable<AIContractExtractionResult['stages']>,
): Record<string, unknown> {
  const next: Record<string, unknown> = { ...fields };
  const overwritten: string[] = [];
  const keys = [
    'partyABankName',
    'partyABankAccount',
    'partyAAddress',
    'partyAPhone',
    'partyATaxNumber',
    'partyBBankName',
    'partyBBankAccount',
    'partyBAddress',
    'partyBPhone',
    'partyBTaxNumber',
  ];

  for (const key of keys) {
    const ocrValue = String(ocrFields[key] || '').trim();
    if (!ocrValue) continue;
    const currentValue = String(next[key] || '').trim();
    if (currentValue !== ocrValue) {
      next[key] = ocrValue;
      overwritten.push(key);
    }
  }

  if (overwritten.length > 0) {
    stages.push({
      stage: 'extract',
      success: true,
      message: `OCR 双栏分栏覆盖字段：${overwritten.join('、')}`,
    });
  }

  return next;
}
