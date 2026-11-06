import Database from 'better-sqlite3';
import * as fs from 'fs';
import * as path from 'path';
import { randomUUID, webcrypto } from 'crypto';
import { Annotation, END, START, StateGraph } from '@langchain/langgraph';
import type {
  AIAgentContractFileSearchItem,
  AIAgentContractFileSearchResult,
  AIAgentCompressionSnapshot,
  AIAgentProductSearchWarrantyStatus,
  AIAgentPersonnelSearchQueryType,
  AIAgentCreateSessionRequest,
  AIAgentCreateSessionResult,
  AIAgentDeleteSessionRequest,
  AIAgentGetSessionRequest,
  AIAgentMessage,
  AIAgentSendMessageRequest,
  AIAgentSendMessageResult,
  AIAgentRenameSessionRequest,
  AIAgentRenameSessionResult,
  AIAgentSession,
  AIAgentSessionSummary,
  AIAgentToolCallRecord,
  AIAgentToolName,
} from '../../../../../shared/types/aiAgent.types';
import type { AISettings, AIStructuredFieldDefinition } from '../../../../../shared/types/ai.types';
import type { ContractInfoEntity, ContractInfoQueryResult } from '../../../../../shared/types/contractInfo.types';
import type {
  ContractStatisticsAIPlan,
} from '../../../../../shared/types/contractStatistics.types';
import type { IpcResponse } from '../../../../../shared/types/ipc.types';
import { AIService } from '../AIService';
import { getAIConfig } from '../config';
import { logger } from '../shared';
import { DatabaseService, openLibraryDatabase } from '../../DatabaseService';
import { executePersonnelSearchTool, summarizePersonnelSearchResult } from './personnelSearchTool';
import { executeInvoiceSearchTool, summarizeInvoiceSearchResult } from './invoiceSearchTool';
import { executePartyUnitSearchTool, summarizePartyUnitSearchResult } from './partyUnitSearchTool';
import { executeProductSearchTool, summarizeProductSearchResult } from './productSearchTool';
import {
  analyzeContractStatisticsRequest as analyzeAgentContractStatisticsRequest,
  buildContractStatisticsPlan as buildAgentContractStatisticsPlan,
  formatStatisticsClarificationSummary,
  formatStatisticsPendingConfirmationSummary,
  formatStatisticsPlanSummary,
  getLatestStatisticsToolData,
  handleContractStatisticsTool,
  isStatisticsConfirmationMessage,
  looksLikeStatisticsFollowUp,
  looksLikeStatisticsIntent,
  reviseContractStatisticsPlan as reviseAgentContractStatisticsPlan,
} from './contractStatisticsModule';
import * as channels from '../../../../ipc/channels';
import { libraryContractReadHandlers } from '../../../../ipc/handlers/library/library/contractReadHandlers';
import { searchHandlers } from '../../../../ipc/handlers/system/searchHandlers';

if (!(globalThis as any).crypto) {
  (globalThis as any).crypto = webcrypto;
}

type AgentPlan = {
  action: 'reply' | AIAgentToolName;
  reply?: string;
  searchQuery?: string;
  contractId?: string;
  productWarrantyStatus?: AIAgentProductSearchWarrantyStatus;
  personnelQueryType?: AIAgentPersonnelSearchQueryType;
  reason?: string;
};

type AgentToolExecution = {
  record: AIAgentToolCallRecord;
  resolvedContractId?: string;
};

const AgentGraphAnnotation = Annotation.Root({
  session: Annotation<AIAgentSession | null>({
    reducer: (_left, right) => right,
    default: () => null,
  }),
  userMessage: Annotation<string>({
    reducer: (_left, right) => right,
    default: () => '',
  }),
  settings: Annotation<AISettings | null>({
    reducer: (_left, right) => right,
    default: () => null,
  }),
  plan: Annotation<AgentPlan | null>({
    reducer: (_left, right) => right,
    default: () => null,
  }),
  toolExecution: Annotation<AgentToolExecution | null>({
    reducer: (_left, right) => right,
    default: () => null,
  }),
  finalAnswer: Annotation<string>({
    reducer: (_left, right) => right,
    default: () => '',
  }),
});

type AgentGraphState = typeof AgentGraphAnnotation.State;

type SessionRow = {
  id: string;
  title: string;
  library_path: string;
  last_message_preview?: string | null;
  last_summary?: string | null;
  compression_summary?: string | null;
  compression_key_entities_json?: string | null;
  compression_recent_focus?: string | null;
  compression_compressed_at?: string | null;
  created_at: string;
  updated_at: string;
};

type MessageRow = {
  id: string;
  session_id: string;
  role: AIAgentMessage['role'];
  content: string;
  tool_calls_json?: string | null;
  sort_order: number;
  created_at: string;
};

type CachedSessionEntry = {
  session: AIAgentSession;
  dbPath: string;
  expiresAt: number;
};

export class AgentService {
  private static instance: AgentService;

  private static readonly SESSION_CACHE_TTL_MS = 60_000;

  private readonly sessionCache = new Map<string, CachedSessionEntry>();

  private readonly graph = this.createGraph();

  private constructor() {}

  public static getInstance(): AgentService {
    if (!AgentService.instance) {
      AgentService.instance = new AgentService();
    }
    return AgentService.instance;
  }

  public async createSession(payload: AIAgentCreateSessionRequest): Promise<AIAgentCreateSessionResult> {
    const { db, dbPath } = this.openDbForWrite(payload.libraryPath);
    const now = new Date().toISOString();
    const session: AIAgentSession = {
      id: randomUUID(),
      title: String(payload.title || '新建会话').trim() || '新建会话',
      libraryPath: this.resolveStoredLibraryPath(dbPath, payload.libraryPath),
      createdAt: now,
      updatedAt: now,
      messages: [],
    };

    try {
      db.prepare(`
        INSERT INTO ai_workbench_sessions (
          id,
          title,
          library_path,
          last_message_preview,
          last_summary,
          compression_key_entities_json,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, '', '', '[]', ?, ?)
      `).run(
        session.id,
        session.title,
        session.libraryPath,
        session.createdAt,
        session.updatedAt,
      );
    } finally {
      db.close();
    }

    this.setCachedSession(session, dbPath);
    return { session };
  }

  public listSessions(): AIAgentSessionSummary[] {
    const dbPath = this.tryResolveCurrentDbPath();
    if (!dbPath) {
      return [];
    }

    const db = this.openDbByPath(dbPath);
    try {
      const rows = db.prepare(`
        SELECT
          id,
          title,
          library_path,
          last_message_preview,
          updated_at
        FROM ai_workbench_sessions
        WHERE deleted_at IS NULL
        ORDER BY datetime(updated_at) DESC, datetime(created_at) DESC, id DESC
      `).all() as Array<{
        id: string;
        title: string;
        library_path: string;
        last_message_preview?: string | null;
        updated_at: string;
      }>;

      return rows.map((row) => ({
        id: row.id,
        title: row.title,
        libraryPath: String(row.library_path || ''),
        updatedAt: row.updated_at,
        lastMessagePreview: String(row.last_message_preview || ''),
      }));
    } finally {
      db.close();
    }
  }

  public getSession(payload: AIAgentGetSessionRequest): AIAgentSession | null {
    const sessionId = String(payload.sessionId || '').trim();
    if (!sessionId) {
      return null;
    }

    const cached = this.getCachedSession(sessionId);
    if (cached) {
      return cached;
    }

    const { db, dbPath } = this.openDbForSession(sessionId);
    try {
      const session = this.readSessionFromDb(db, sessionId);
      if (session) {
        this.setCachedSession(session, dbPath);
      }
      return session;
    } finally {
      db.close();
    }
  }

  public async renameSession(payload: AIAgentRenameSessionRequest): Promise<AIAgentRenameSessionResult> {
    const sessionId = String(payload.sessionId || '').trim();
    const title = String(payload.title || '').trim();
    if (!sessionId) {
      throw new Error('会话 ID 不能为空');
    }
    if (!title) {
      throw new Error('会话标题不能为空');
    }

    const { db, dbPath } = this.openDbForSession(sessionId);
    try {
      const existingSession = this.readSessionFromDb(db, sessionId);
      if (!existingSession) {
        throw new Error('会话不存在');
      }

      const updatedAt = new Date().toISOString();
      db.prepare(`
        UPDATE ai_workbench_sessions
        SET title = ?, updated_at = ?
        WHERE id = ? AND deleted_at IS NULL
      `).run(title, updatedAt, sessionId);

      const session = this.readSessionFromDb(db, sessionId);
      if (!session) {
        throw new Error('会话不存在');
      }

      this.setCachedSession(session, dbPath);
      return { session };
    } finally {
      db.close();
    }
  }

  public deleteSession(payload: AIAgentDeleteSessionRequest): { success: boolean } {
    const sessionId = String(payload.sessionId || '').trim();
    if (!sessionId) {
      throw new Error('会话 ID 不能为空');
    }

    const { db } = this.openDbForSession(sessionId);
    try {
      const deletedAt = new Date().toISOString();
      const sessionResult = db.prepare(`
        UPDATE ai_workbench_sessions
        SET deleted_at = ?, updated_at = ?
        WHERE id = ? AND deleted_at IS NULL
      `).run(deletedAt, deletedAt, sessionId);

      db.prepare(`
        UPDATE ai_workbench_messages
        SET deleted_at = ?, updated_at = ?
        WHERE session_id = ? AND deleted_at IS NULL
      `).run(deletedAt, deletedAt, sessionId);

      this.sessionCache.delete(sessionId);
      return {
        success: sessionResult.changes > 0,
      };
    } finally {
      db.close();
    }
  }

  public async sendMessage(payload: AIAgentSendMessageRequest): Promise<AIAgentSendMessageResult> {
    const sessionId = String(payload.sessionId || '').trim();
    const userContent = String(payload.content || '').trim();
    if (!sessionId) {
      throw new Error('会话 ID 不能为空');
    }
    if (!userContent) {
      throw new Error('消息内容不能为空');
    }

    const { db, dbPath } = this.openDbForWrite(payload.libraryPath, sessionId);
    const existingSession = this.readSessionFromDb(db, sessionId);
    if (!existingSession) {
      throw new Error('会话不存在');
    }

    const session: AIAgentSession = this.cloneSession(existingSession);
    if (payload.libraryPath) {
      session.libraryPath = this.resolveStoredLibraryPath(dbPath, payload.libraryPath);
    }

    const userMessage: AIAgentMessage = {
      id: randomUUID(),
      role: 'user',
      content: userContent,
      createdAt: new Date().toISOString(),
    };
    session.messages.push(userMessage);
    session.updatedAt = userMessage.createdAt;
    if (session.messages.length === 1 || session.title === '新建会话') {
      session.title = userContent.slice(0, 24) || session.title;
    }

    try {
      this.insertMessage(db, sessionId, userMessage);
      this.updateSessionMetadata(db, session);

      const graphResult = await this.graph.invoke({
        session,
        userMessage: userContent,
        settings: getAIConfig(),
        plan: null,
        toolExecution: null,
        finalAnswer: '',
      });

      const assistantMessage: AIAgentMessage = {
        id: randomUUID(),
        role: 'assistant',
        content: graphResult.finalAnswer || '暂时无法生成回复，请稍后重试。',
        createdAt: new Date().toISOString(),
        toolCalls: graphResult.toolExecution ? [graphResult.toolExecution.record] : undefined,
      };

      this.insertMessage(db, sessionId, assistantMessage);

      const compression = graphResult.session?.compression || session.compression;
      const finalSession: AIAgentSession = {
        ...session,
        compression,
        updatedAt: assistantMessage.createdAt,
        messages: [...session.messages, assistantMessage],
      };

      this.updateSessionMetadata(db, finalSession, {
        lastSummary: assistantMessage.content,
      });

      this.setCachedSession(finalSession, dbPath);
      return {
        session: finalSession,
        assistantMessage,
      };
    } catch (error) {
      this.setCachedSession(session, dbPath);
      logger.error('保存 Agent 会话消息失败', error);
      throw error;
    } finally {
      db.close();
    }
  }

  private createGraph() {
    return new StateGraph(AgentGraphAnnotation)
      .addNode('compress', async (state: AgentGraphState) => {
        if (!state.session || !state.settings) {
          return {};
        }
        const threshold = Math.max(4, Number(state.settings.agentSettings.compressionThreshold || 12));
        const nonSystemMessages = state.session.messages.filter(item => item.role !== 'system');
        if (nonSystemMessages.length < threshold) {
          return {};
        }
        const compression = await this.compressSession(state.session);
        return {
          session: {
            ...state.session,
            compression,
            messages: this.keepRecentMessages(state.session.messages, 6),
          },
        };
      })
      .addNode('planner', async (state: AgentGraphState) => {
        if (!state.session || !state.settings) {
          throw new Error('Agent 状态不完整');
        }
        const plan = await this.planNextStep(state.session, state.userMessage, state.settings);
        return { plan };
      })
      .addNode('tool', async (state: AgentGraphState) => {
        if (!state.session || !state.plan) {
          return {};
        }
        const toolExecution = await this.executeTool(state.session, state.plan);
        return { toolExecution };
      })
      .addNode('answer', async (state: AgentGraphState) => {
        if (!state.session || !state.plan || !state.settings) {
          throw new Error('Agent 状态不完整');
        }
        const finalAnswer = state.plan.action === 'reply'
          ? (state.plan.reply || '暂时无法生成回复，请稍后重试。')
          : await this.composeAnswer(state.session, state.userMessage, state.plan, state.toolExecution?.record);
        return { finalAnswer };
      })
      .addEdge(START, 'compress')
      .addEdge('compress', 'planner')
      .addConditionalEdges('planner', (state: AgentGraphState) => (
        state.plan?.action && state.plan.action !== 'reply' ? 'tool' : 'answer'
      ))
      .addEdge('tool', 'answer')
      .addEdge('answer', END)
      .compile();
  }

  private async compressSession(session: AIAgentSession): Promise<AIAgentCompressionSnapshot> {
    const prompt = [
      '请压缩以下 AI Agent 会话上下文，保留后续继续查询合同所需的核心信息。',
      '你需要识别当前关注的合同、已经调用过的工具、关键结论与未完成问题。',
      'keyEntities 返回逗号分隔的关键实体名。',
    ].join('\n');
    const result = await this.generateStructured({
      scene: 'agent-session-compression',
      prompt,
      sourceText: this.buildConversationContext(session, 20),
      schema: [
        { key: 'summary', type: 'string', description: '压缩摘要', required: true },
        { key: 'keyEntities', type: 'string', description: '关键实体，逗号分隔', required: true },
        { key: 'recentFocus', type: 'string', description: '当前会话焦点', required: true },
      ],
    });

    const keyEntities = String(result.keyEntities || '')
      .split(/[，,]/)
      .map(item => item.trim())
      .filter(Boolean);

    return {
      summary: String(result.summary || '').trim(),
      keyEntities,
      recentFocus: String(result.recentFocus || '').trim(),
      compressedAt: new Date().toISOString(),
    };
  }

  private keepRecentMessages(messages: AIAgentMessage[], keepCount: number): AIAgentMessage[] {
    if (messages.length <= keepCount) {
      return [...messages];
    }
    return messages.slice(-keepCount);
  }

  private async planNextStep(session: AIAgentSession, userMessage: string, settings: AISettings): Promise<AgentPlan> {
    const availableTools = settings.agentSettings.enableTools
      ? settings.agentSettings.availableTools
      : [];
    const latestStatisticsState = getLatestStatisticsToolData(session);
    const statisticsEnabled = availableTools.includes('contract_statistics');
    if (statisticsEnabled && latestStatisticsState?.status === 'pending_confirmation' && isStatisticsConfirmationMessage(userMessage)) {
      return {
        action: 'contract_statistics',
        searchQuery: String(userMessage || '').trim(),
        reason: '命中统计确认指令',
      };
    }
    if (statisticsEnabled && looksLikeStatisticsFollowUp(userMessage, latestStatisticsState)) {
      return {
        action: 'contract_statistics',
        searchQuery: String(userMessage || '').trim(),
        reason: '命中统计补充或改口指令',
      };
    }
    if (statisticsEnabled && looksLikeStatisticsIntent(userMessage)) {
      return {
        action: 'contract_statistics',
        searchQuery: String(userMessage || '').trim(),
        reason: '命中统计分析意图',
      };
    }
    const prompt = [
      '你是 AI 工作台的计划节点，需要决定是直接回答，还是调用一个工具。',
      '仅允许 action 取值为 reply、contract_search、contract_full_text_search、contract_detail_summary、contract_statistics、product_search、personnel_search、customer_search、supplier_search、invoice_search。',
      `当前可用工具：${availableTools.join('、') || '无'}`,
      '如果用户明确在查询合同名称、编号、甲方、乙方等主数据，优先使用 contract_search。',
      '如果用户在询问正文内容、条款、关键字命中，优先使用 contract_full_text_search，该工具会搜索当前资源库全库已索引文件。',
      '如果用户在询问某个文件名是否存在、要找某个具体文件（如 *.pdf、*.docx、*.md），优先使用 contract_full_text_search。',
      '如果用户在追问某份已命中合同的摘要、主体、签约信息，使用 contract_detail_summary。',
      '如果用户在做统计、汇总、分组、趋势、排行、占比、分布、TopN、合同金额合计、合同数量等分析，优先使用 contract_statistics。',
      '如果当前会话里已有待补充或待确认的统计方案，且用户是在继续补充字段、筛选条件、分组方式，或明确表示确认执行，也使用 contract_statistics。',
      '如果用户在查询产品编码对应的信息，或想筛选已过保/未过保产品列表，优先使用 product_search。',
      '如果用户在查询员工姓名、手机号、身份证号，查询某个部门有哪些人，或询问某人有哪些证件/有毕业证的人/身份证地址包含某关键词，优先使用 personnel_search。',
      '如果用户在查询甲方单位、客户、建设单位、业主等信息，如单位名称、联系人、电话、税号、开户地址，优先使用 customer_search。',
      '如果用户在查询乙方单位、供应商、服务商、承包方等信息，如单位名称、联系人、电话、税号、开户地址、法人信息，优先使用 supplier_search。',
      '如果用户在查询发票号码、发票代码、销方、购方、税号、发票类型，或想找某份合同关联的发票，优先使用 invoice_search。',
      '如果没有合适工具或工具被禁用，则使用 reply 并给出明确答复。',
      '若 action 为 product_search，productWarrantyStatus 仅允许为 expired 或 notExpired；若用户只说要查过保/未过保产品，也要调用 product_search。',
      '若 action 为 personnel_search，personnelQueryType 仅允许为 name、phone、id_card_number、department、document 之一，并尽量提炼 searchQuery 为核心关键词。',
      '若 action 为 customer_search 或 supplier_search，也应尽量提炼 searchQuery，只保留单位名称、编码、联系人、电话、税号、开户行等核心关键词。',
      '若 action 为 invoice_search，也应尽量提炼 searchQuery，只保留发票号码、代码、公司名、合同编号或合同名称等核心关键词。',
      'reply 时直接生成面向用户的中文回答；调用工具时填写 searchQuery 或 contractId。',
    ].join('\n');

    const planned = await this.generateStructured({
      scene: 'agent-planning',
      prompt,
      sourceText: [
        `用户本轮问题：${userMessage}`,
        '',
        '会话上下文：',
        this.buildConversationContext(session, 10),
      ].join('\n'),
      schema: [
        { key: 'action', type: 'string', description: 'reply 或工具名', required: true },
        { key: 'reply', type: 'string', description: '直接回复内容' },
        { key: 'searchQuery', type: 'string', description: '工具检索词' },
        { key: 'contractId', type: 'string', description: '目标合同 ID' },
        { key: 'productWarrantyStatus', type: 'string', description: '产品维保状态：expired、notExpired' },
        { key: 'personnelQueryType', type: 'string', description: '员工查询维度：name、phone、id_card_number、department、document' },
        { key: 'reason', type: 'string', description: '决策原因' },
      ],
    });

    const actionText = String(planned.action || '').trim() as AgentPlan['action'];
    if (!actionText || actionText === 'reply') {
      return {
        action: 'reply',
        reply: String(planned.reply || '请提供更明确的合同名称、编号、甲方、乙方或条款关键字，我再帮你继续查询。').trim(),
        reason: String(planned.reason || '').trim(),
      };
    }

    const allowedTools = new Set<AIAgentToolName>(availableTools);
    if (!allowedTools.has(actionText as AIAgentToolName)) {
      return {
        action: 'reply',
        reply: '当前会话未启用所需工具，请在 AI 设置中开启对应工具后重试。',
        reason: '工具未启用',
      };
    }

    return {
      action: actionText,
      searchQuery: String(planned.searchQuery || userMessage).trim(),
      contractId: String(planned.contractId || '').trim(),
      productWarrantyStatus: String(planned.productWarrantyStatus || '').trim() as AIAgentProductSearchWarrantyStatus | undefined,
      personnelQueryType: String(planned.personnelQueryType || '').trim() as AIAgentPersonnelSearchQueryType | undefined,
      reason: String(planned.reason || '').trim(),
    };
  }

  private async executeTool(session: AIAgentSession, plan: AgentPlan): Promise<AgentToolExecution> {
    switch (plan.action) {
      case 'contract_search':
        return await this.searchContracts(session.libraryPath, plan.searchQuery || '');
      case 'contract_full_text_search':
        return await this.searchContractFullText(session.libraryPath, plan.searchQuery || '');
      case 'contract_detail_summary':
        return await this.getContractDetailSummary(session.libraryPath, plan.contractId || this.inferContractId(session));
      case 'contract_statistics':
        return await this.handleContractStatistics(session, plan.searchQuery || '');
      case 'product_search':
        return await this.searchProducts(session.libraryPath, plan.searchQuery || '', plan.productWarrantyStatus);
      case 'personnel_search':
        return await this.searchPersonnels(session.libraryPath, plan.searchQuery || '', plan.personnelQueryType);
      case 'customer_search':
        return await this.searchCustomerUnits(session.libraryPath, plan.searchQuery || '');
      case 'supplier_search':
        return await this.searchSupplierUnits(session.libraryPath, plan.searchQuery || '');
      case 'invoice_search':
        return await this.searchInvoices(session.libraryPath, plan.searchQuery || '');
      default:
        throw new Error(`不支持的工具动作: ${String(plan.action)}`);
    }
  }

  private async searchContracts(libraryPath: string, searchQuery: string): Promise<AgentToolExecution> {
    const response = await libraryContractReadHandlers[channels.LIBRARY_QUERY_CONTRACT_INFOS](
      {} as Electron.IpcMainInvokeEvent,
      {
        libraryPath,
        page: 1,
        pageSize: 5,
        searchQuery,
        searchFields: ['all'],
      },
    ) as IpcResponse<ContractInfoQueryResult>;

    if (!response.success || !response.data) {
      return {
        record: this.createToolRecord('contract_search', '合同信息查询', { searchQuery }, 'error', response.error || '合同查询失败'),
      };
    }

    const items = response.data.items || [];
    if (items.length === 0) {
      return {
        record: this.createToolRecord(
          'contract_search',
          '合同信息查询',
          { searchQuery },
          'success',
          '未找到匹配合同，建议尝试合同编号、甲方、乙方或文件内容关键字。',
          { items: [] },
        ),
      };
    }

    const summary = items
      .slice(0, 5)
      .map(item => `${item.contract_name}（编号：${item.contract_code || '-'}，甲方：${item.client_name || '-'}，乙方：${item.party_b_name || '-'}）`)
      .join('\n');

    return {
      record: this.createToolRecord(
        'contract_search',
        '合同信息查询',
        { searchQuery },
        'success',
        `共命中 ${response.data.total} 条合同，优先返回前 ${items.length} 条：\n${summary}`,
        response.data,
      ),
      resolvedContractId: items[0]?.id,
    };
  }

  private async searchContractFullText(libraryPath: string, searchQuery: string): Promise<AgentToolExecution> {
    const response = await searchHandlers[channels.SEARCH_FULL_TEXT_IN_PATH](
      {} as Electron.IpcMainInvokeEvent,
      {
        query: searchQuery,
        baseDir: libraryPath,
        recursive: true,
        ensureIndexed: true,
        limit: 5,
        offset: 0,
      },
    ) as {
      total: number;
      items: Array<{
        file_path: string;
        snippet: string;
        source_type?: 'contract' | 'other';
        file_id?: string;
        contract_id?: string;
        contract_no?: string;
        contract_name?: string;
        file_name?: string;
        relative_path?: string;
        directory_label?: string;
        can_preview?: boolean;
      }>;
      indexing: boolean;
      lastIndexedAt?: number;
      lastError?: string;
    };

    const items = Array.isArray(response.items) ? response.items : [];
    const structuredItems: AIAgentContractFileSearchItem[] = items
      .map((item) => {
        const sourceType: AIAgentContractFileSearchItem['sourceType'] = item?.source_type === 'other' ? 'other' : 'contract';
        return {
          sourceType,
        fileId: String(item?.file_id || '').trim(),
        contractId: String(item?.contract_id || '').trim(),
        contractNo: String(item?.contract_no || '').trim(),
        contractName: String(item?.contract_name || '').trim(),
        fileName: String(item?.file_name || path.basename(String(item?.file_path || ''))).trim(),
        filePath: String(item?.file_path || '').trim(),
        relativePath: String(item?.relative_path || '').trim(),
        directoryLabel: String(item?.directory_label || '').trim(),
        snippet: String(item?.snippet || '').trim(),
        canPreview: item?.can_preview !== false && Boolean(String(item?.file_path || '').trim()),
        };
      })
      .filter((item) => Boolean(item.filePath));

    const structuredResult: AIAgentContractFileSearchResult = {
      keyword: searchQuery,
      total: Number(response.total || 0),
      items: structuredItems,
      indexing: Boolean(response.indexing),
      lastIndexedAt: response.lastIndexedAt,
      lastError: response.lastError,
    };

    if (items.length === 0) {
      const noResultSummary = response.indexing
        ? '当前未命中文件，索引仍在处理中。可稍后重试，或换更短的关键字。'
        : '当前资源库未命中相关文件，建议换更短关键字、别名，或改查合同名称与编号。';
      return {
        record: this.createToolRecord(
          'contract_full_text_search',
          '全库文件检索',
          { searchQuery },
          'success',
          noResultSummary,
          structuredResult,
        ),
      };
    }

    const summary = structuredItems
      .slice(0, 5)
      .map(item => {
        const sourceLabel = item.sourceType === 'other'
          ? `文件来源：其他文件${item.directoryLabel ? `（${item.directoryLabel}）` : ''}`
          : item.contractNo || item.contractName
            ? `文件来源：合同文件（${item.contractNo || '-'} ${item.contractName || ''}`.trim() + '）'
            : '文件来源：合同文件';
        return `${item.fileName}\n${sourceLabel}\n${item.snippet}`;
      })
      .join('\n\n');

    const prefix = response.indexing
      ? `全库文件检索命中 ${structuredResult.total} 条记录，索引仍在更新中，先返回前 ${structuredItems.length} 条：`
      : `全库文件检索命中 ${structuredResult.total} 条记录，前 ${structuredItems.length} 条如下：`;

    return {
      record: this.createToolRecord(
        'contract_full_text_search',
        '全库文件检索',
        { searchQuery },
        'success',
        `${prefix}\n${summary}`,
        structuredResult,
      ),
    };
  }

  private async getContractDetailSummary(libraryPath: string, contractId: string): Promise<AgentToolExecution> {
    if (!contractId) {
      return {
        record: this.createToolRecord(
          'contract_detail_summary',
          '合同详情摘要',
          { contractId },
          'error',
          '当前无法确定要读取哪一份合同，请先查询合同名称或编号。',
        ),
      };
    }

    const response = await libraryContractReadHandlers[channels.LIBRARY_GET_CONTRACT_INFO](
      {} as Electron.IpcMainInvokeEvent,
      {
        libraryPath,
        id: contractId,
      },
    ) as IpcResponse<ContractInfoEntity>;

    if (!response.success || !response.data) {
      return {
        record: this.createToolRecord('contract_detail_summary', '合同详情摘要', { contractId }, 'error', response.error || '读取合同详情失败'),
      };
    }

    const item = response.data;
    return {
      record: this.createToolRecord(
        'contract_detail_summary',
        '合同详情摘要',
        { contractId },
        'success',
        [
          `合同名称：${item.contract_name || '-'}`,
          `合同编号：${item.contract_code || '-'}`,
          `甲方：${item.client_name || '-'}`,
          `乙方：${item.party_b_name || '-'}`,
          `签约日期：${item.signing_date || '-'}`,
          `合同类型：${item.contract_type || '-'}`,
          `摘要：${item.contract_summary || '-'}`,
        ].join('\n'),
        item,
      ),
      resolvedContractId: item.id,
    };
  }

  private async searchProducts(
    libraryPath: string,
    searchQuery: string,
    warrantyStatus?: AIAgentProductSearchWarrantyStatus,
  ): Promise<AgentToolExecution> {
    const normalizedQuery = String(searchQuery || '').trim();
    let db: Database.Database | null = null;
    try {
      const dbPath = this.resolveDbPathFromLibraryPath(libraryPath);
      const openedDb = this.openDbByPath(dbPath);
      db = openedDb;
      const result = executeProductSearchTool({
        db: openedDb,
        args: {
          searchQuery: normalizedQuery,
          warrantyStatus,
        },
        pageSize: 10,
      });

      if (result.emptyReason === 'missing_criteria') {
        return {
          record: this.createToolRecord(
            'product_search',
            '产品信息查询',
            { searchQuery: normalizedQuery, warrantyStatus: warrantyStatus || '' },
            'error',
            summarizeProductSearchResult(result),
          ),
        };
      }

      return {
        record: this.createToolRecord(
          'product_search',
          '产品信息查询',
          { searchQuery: result.keyword, warrantyStatus: result.warrantyStatus || '' },
          'success',
          summarizeProductSearchResult(result),
          result,
        ),
        resolvedContractId: result.items[0]?.contractId || undefined,
      };
    } catch (error) {
      return {
        record: this.createToolRecord(
          'product_search',
          '产品信息查询',
          { searchQuery: normalizedQuery, warrantyStatus: warrantyStatus || '' },
          'error',
          error instanceof Error ? error.message : '产品信息查询失败',
        ),
      };
    } finally {
      db?.close();
    }
  }

  private async searchPersonnels(
    libraryPath: string,
    searchQuery: string,
    queryType?: AIAgentPersonnelSearchQueryType,
  ): Promise<AgentToolExecution> {
    const normalizedQuery = String(searchQuery || '').trim();
    if (!normalizedQuery) {
      return {
        record: this.createToolRecord(
          'personnel_search',
          '员工信息查询',
          { searchQuery, queryType: queryType || 'name' },
          'error',
          '缺少员工查询关键词，请提供姓名、手机号、身份证号片段或部门名称。',
        ),
      };
    }

    let db: Database.Database | null = null;
    try {
      const dbPath = this.resolveDbPathFromLibraryPath(libraryPath);
      const openedDb = this.openDbByPath(dbPath);
      db = openedDb;
      const result = executePersonnelSearchTool({
        db: openedDb,
        args: {
          searchQuery: normalizedQuery,
          queryType,
        },
        pageSize: 10,
        departmentPageSize: 10,
      });

      if (result.items.length === 0) {
        return {
          record: this.createToolRecord(
            'personnel_search',
            '员工信息查询',
            { searchQuery: result.keyword, queryType: result.queryType },
            'success',
            summarizePersonnelSearchResult(result),
            result,
          ),
        };
      }

      return {
        record: this.createToolRecord(
          'personnel_search',
          '员工信息查询',
          { searchQuery: result.keyword, queryType: result.queryType },
          'success',
          summarizePersonnelSearchResult(result),
          result,
        ),
      };
    } catch (error) {
      return {
        record: this.createToolRecord(
          'personnel_search',
          '员工信息查询',
          { searchQuery: normalizedQuery, queryType: queryType || 'name' },
          'error',
          error instanceof Error ? error.message : '员工信息查询失败',
        ),
      };
    } finally {
      db?.close();
    }
  }

  private async searchCustomerUnits(libraryPath: string, searchQuery: string): Promise<AgentToolExecution> {
    const normalizedQuery = String(searchQuery || '').trim();
    if (!normalizedQuery) {
      return {
        record: this.createToolRecord(
          'customer_search',
          '甲方单位查询',
          { searchQuery },
          'error',
          '缺少甲方单位查询关键词，请提供单位名称、编码、联系人、电话或税号。',
        ),
      };
    }

    let db: Database.Database | null = null;
    try {
      const dbPath = this.resolveDbPathFromLibraryPath(libraryPath);
      const openedDb = this.openDbByPath(dbPath);
      db = openedDb;
      const result = executePartyUnitSearchTool({
        db: openedDb,
        args: {
          searchQuery: normalizedQuery,
          partyType: 'party_a',
        },
        pageSize: 10,
      });

      return {
        record: this.createToolRecord(
          'customer_search',
          '甲方单位查询',
          { searchQuery: result.keyword },
          'success',
          summarizePartyUnitSearchResult(result),
          result,
        ),
      };
    } catch (error) {
      return {
        record: this.createToolRecord(
          'customer_search',
          '甲方单位查询',
          { searchQuery: normalizedQuery },
          'error',
          error instanceof Error ? error.message : '甲方单位查询失败',
        ),
      };
    } finally {
      db?.close();
    }
  }

  private async searchSupplierUnits(libraryPath: string, searchQuery: string): Promise<AgentToolExecution> {
    const normalizedQuery = String(searchQuery || '').trim();
    if (!normalizedQuery) {
      return {
        record: this.createToolRecord(
          'supplier_search',
          '乙方单位查询',
          { searchQuery },
          'error',
          '缺少乙方单位查询关键词，请提供单位名称、编码、联系人、电话、税号或法人信息。',
        ),
      };
    }

    let db: Database.Database | null = null;
    try {
      const dbPath = this.resolveDbPathFromLibraryPath(libraryPath);
      const openedDb = this.openDbByPath(dbPath);
      db = openedDb;
      const result = executePartyUnitSearchTool({
        db: openedDb,
        args: {
          searchQuery: normalizedQuery,
          partyType: 'party_b',
        },
        pageSize: 10,
      });

      return {
        record: this.createToolRecord(
          'supplier_search',
          '乙方单位查询',
          { searchQuery: result.keyword },
          'success',
          summarizePartyUnitSearchResult(result),
          result,
        ),
      };
    } catch (error) {
      return {
        record: this.createToolRecord(
          'supplier_search',
          '乙方单位查询',
          { searchQuery: normalizedQuery },
          'error',
          error instanceof Error ? error.message : '乙方单位查询失败',
        ),
      };
    } finally {
      db?.close();
    }
  }

  private async searchInvoices(libraryPath: string, searchQuery: string): Promise<AgentToolExecution> {
    const normalizedQuery = String(searchQuery || '').trim();
    if (!normalizedQuery) {
      return {
        record: this.createToolRecord(
          'invoice_search',
          '发票信息查询',
          { searchQuery },
          'error',
          '缺少发票查询关键词，请提供发票号码、代码、销方、购方、合同编号或合同名称。',
        ),
      };
    }

    let db: Database.Database | null = null;
    try {
      const dbPath = this.resolveDbPathFromLibraryPath(libraryPath);
      const openedDb = this.openDbByPath(dbPath);
      db = openedDb;
      const result = executeInvoiceSearchTool({
        db: openedDb,
        args: {
          searchQuery: normalizedQuery,
        },
        pageSize: 10,
      });

      return {
        record: this.createToolRecord(
          'invoice_search',
          '发票信息查询',
          { searchQuery: result.keyword },
          'success',
          summarizeInvoiceSearchResult(result),
          result,
        ),
        resolvedContractId: result.items[0]?.contractId || undefined,
      };
    } catch (error) {
      return {
        record: this.createToolRecord(
          'invoice_search',
          '发票信息查询',
          { searchQuery: normalizedQuery },
          'error',
          error instanceof Error ? error.message : '发票信息查询失败',
        ),
      };
    } finally {
      db?.close();
    }
  }

  public async buildContractStatisticsPlan(
    session: AIAgentSession,
    userQuestion: string,
    previousPlan?: ContractStatisticsAIPlan | null,
  ): Promise<ContractStatisticsAIPlan> {
    return buildAgentContractStatisticsPlan(
      this.getContractStatisticsModuleDependencies(),
      session,
      userQuestion,
      previousPlan || undefined,
    );
  }

  public async reviseContractStatisticsPlan(
    session: AIAgentSession,
    userQuestion: string,
    previousPlan?: ContractStatisticsAIPlan | null,
    snapshot?: unknown,
  ): Promise<ContractStatisticsAIPlan> {
    return reviseAgentContractStatisticsPlan(
      this.getContractStatisticsModuleDependencies(),
      session,
      userQuestion,
      previousPlan || undefined,
      snapshot,
    );
  }

  private async handleContractStatistics(session: AIAgentSession, userMessage: string): Promise<AgentToolExecution> {
    return {
      record: await handleContractStatisticsTool(
        this.getContractStatisticsModuleDependencies(),
        session,
        userMessage,
      ),
    };
  }

  private async analyzeContractStatisticsRequest(
    session: AIAgentSession,
    userMessage: string,
    previousPlan?: ContractStatisticsAIPlan,
  ) {
    return analyzeAgentContractStatisticsRequest(
      this.getContractStatisticsModuleDependencies(),
      session,
      userMessage,
      previousPlan,
    );
  }

  private getLatestStatisticsToolData(session: AIAgentSession) {
    return getLatestStatisticsToolData(session);
  }

  private isStatisticsConfirmationMessage(userMessage: string): boolean {
    return isStatisticsConfirmationMessage(userMessage);
  }

  private looksLikeStatisticsIntent(userMessage: string): boolean {
    return looksLikeStatisticsIntent(userMessage);
  }

  private looksLikeStatisticsFollowUp(userMessage: string, latest: ReturnType<typeof getLatestStatisticsToolData>): boolean {
    return looksLikeStatisticsFollowUp(userMessage, latest);
  }

  private formatStatisticsPlanSummary(plan: ContractStatisticsAIPlan): string {
    return formatStatisticsPlanSummary(plan);
  }

  private formatStatisticsPendingConfirmationSummary(plan: ContractStatisticsAIPlan): string {
    return formatStatisticsPendingConfirmationSummary(plan);
  }

  private formatStatisticsClarificationSummary(data: Parameters<typeof formatStatisticsClarificationSummary>[0]): string {
    return formatStatisticsClarificationSummary(data);
  }

  private inferContractId(session: AIAgentSession): string {
    for (let i = session.messages.length - 1; i >= 0; i -= 1) {
      const message = session.messages[i];
      const toolCalls = Array.isArray(message.toolCalls) ? message.toolCalls : [];
      for (const toolCall of toolCalls) {
        const rawData = toolCall.rawData as {
          items?: Array<{ id?: string; contractId?: string }>;
          id?: string;
        } | undefined;
        if (toolCall.toolName === 'contract_detail_summary' && typeof rawData?.id === 'string') {
          return rawData.id;
        }
        if (toolCall.toolName === 'contract_search' && Array.isArray(rawData?.items) && rawData.items[0]?.id) {
          return String(rawData.items[0].id);
        }
        if (toolCall.toolName === 'product_search' && Array.isArray(rawData?.items) && rawData.items[0]?.contractId) {
          return String(rawData.items[0].contractId);
        }
        if (toolCall.toolName === 'invoice_search' && Array.isArray(rawData?.items) && rawData.items[0]?.contractId) {
          return String(rawData.items[0].contractId);
        }
      }
    }
    return '';
  }

  private async composeAnswer(
    session: AIAgentSession,
    userMessage: string,
    plan: AgentPlan,
    toolRecord?: AIAgentToolCallRecord,
  ): Promise<string> {
    if (!toolRecord) {
      return '暂时无法完成本次查询，请稍后再试。';
    }

    if (toolRecord.toolName === 'contract_statistics') {
      return toolRecord.summary || '合同统计方案已更新。';
    }

    const result = await this.generateStructured({
      scene: 'agent-answer',
      prompt: [
        '你是 AI 工作台的回答节点，请根据用户问题和工具结果，生成中文最终答复。',
        '如果工具是合同主数据查询或详情摘要，请聚焦合同名称、编号、主体、签约信息等结果。',
        '如果工具是合同全文检索，请说明命中文件或片段。',
        '如果工具是合同统计报表，请说明当前是待补充、待确认还是已执行，并提醒用户通过确认后生成独立报表。',
        '如果工具是产品信息查询，请优先返回产品编码、名称、规格、维保日期、是否过保、所属合同、甲方和乙方。',
        '如果工具是员工信息查询，请优先返回姓名、岗位、手机号、身份证号、所属部门，以及证件名称/证件类型等关键信息。',
        '如果员工查询是按部门执行，请明确说明匹配到的部门、员工人数，以及多部门同名或模糊匹配情况。',
        '如果工具是甲方单位或乙方单位查询，请优先返回单位名称、编码、联系人、电话、税号、开户地址、开户行和法人信息等关键字段。',
        '如果工具是发票信息查询，请优先返回发票号码、代码、销方、购方、开票日期、价税合计以及所属合同。',
        '如果未命中，要明确提示未找到，并给出更合适的重试关键词建议。',
      ].join('\n'),
      sourceText: [
        `用户问题：${userMessage}`,
        `计划动作：${plan.action}`,
        '',
        '会话摘要：',
        session.compression?.summary || '暂无摘要',
        '',
        '工具结果：',
        toolRecord.summary,
      ].join('\n'),
      schema: [
        { key: 'answer', type: 'string', description: '最终答复', required: true },
      ],
    });

    return String(result.answer || toolRecord.summary || '暂时无法生成回答').trim();
  }

  private async generateStructured<T extends Record<string, unknown>>(payload: {
    scene: string;
    prompt: string;
    sourceText: string;
    schema: AIStructuredFieldDefinition[];
  }): Promise<T> {
    const result = await AIService.getInstance().generateStructured<T>({
      scene: payload.scene,
      prompt: payload.prompt,
      sourceText: payload.sourceText,
      schema: payload.schema,
    });
    if (!result.ok || !result.data) {
      throw new Error(result.error || 'AI 结构化调用失败');
    }
    return result.data;
  }

  private getContractStatisticsModuleDependencies() {
    return {
      generateStructured: this.generateStructured.bind(this),
      buildConversationContext: this.buildConversationContext.bind(this),
      createToolRecord: this.createToolRecord.bind(this),
      resolveDbPathFromLibraryPath: this.resolveDbPathFromLibraryPath.bind(this),
      openDbByPath: this.openDbByPath.bind(this),
    };
  }

  private createToolRecord(
    toolName: AIAgentToolName,
    title: string,
    args: Record<string, unknown>,
    status: 'success' | 'error',
    summary: string,
    rawData?: unknown,
  ): AIAgentToolCallRecord {
    return {
      id: randomUUID(),
      toolName,
      title,
      args,
      status,
      summary,
      rawData,
      createdAt: new Date().toISOString(),
    };
  }

  private buildConversationContext(session: AIAgentSession, messageLimit: number): string {
    const recentMessages = session.messages.slice(-messageLimit);
    return [
      session.compression
        ? `压缩摘要：${session.compression.summary}\n关键实体：${session.compression.keyEntities.join('、')}\n当前焦点：${session.compression.recentFocus}`
        : '压缩摘要：暂无',
      '',
      ...recentMessages.map((message) => {
        const toolText = Array.isArray(message.toolCalls) && message.toolCalls.length > 0
          ? `\n工具记录：${message.toolCalls.map(item => `${item.title} -> ${item.summary}`).join('\n')}`
          : '';
        return `[${message.role}] ${message.content}${toolText}`;
      }),
    ].join('\n');
  }

  private getLastMessagePreview(session: AIAgentSession): string {
    for (let i = session.messages.length - 1; i >= 0; i -= 1) {
      const content = String(session.messages[i]?.content || '').trim();
      if (content) {
        return content.slice(0, 40);
      }
    }
    return '';
  }

  private openDbForWrite(libraryPath?: string, sessionId?: string): { db: Database.Database; dbPath: string } {
    const dbPath = this.resolveDbPathForWrite(libraryPath, sessionId);
    return {
      db: this.openDbByPath(dbPath),
      dbPath,
    };
  }

  private openDbForSession(sessionId: string): { db: Database.Database; dbPath: string } {
    const dbPath = this.resolveDbPathForRead(sessionId);
    return {
      db: this.openDbByPath(dbPath),
      dbPath,
    };
  }

  private openDbByPath(dbPath: string): Database.Database {
    return openLibraryDatabase(dbPath, { enableWal: true }).db;
  }

  private resolveDbPathForWrite(libraryPath?: string, sessionId?: string): string {
    const explicitLibraryPath = String(libraryPath || '').trim();
    if (explicitLibraryPath) {
      return this.resolveDbPathFromLibraryPath(explicitLibraryPath);
    }

    if (sessionId) {
      const cachedEntry = this.getCacheEntry(sessionId);
      if (cachedEntry) {
        return cachedEntry.dbPath;
      }
    }

    const currentDbPath = this.tryResolveCurrentDbPath();
    if (currentDbPath) {
      return currentDbPath;
    }

    throw new Error('当前未加载资源库，无法保存 AI 会话');
  }

  private resolveDbPathForRead(sessionId: string): string {
    const cachedEntry = this.getCacheEntry(sessionId);
    if (cachedEntry) {
      return cachedEntry.dbPath;
    }

    const currentDbPath = this.tryResolveCurrentDbPath();
    if (currentDbPath) {
      return currentDbPath;
    }

    throw new Error('当前未加载资源库，无法读取 AI 会话');
  }

  private resolveDbPathFromLibraryPath(libraryPath: string): string {
    const normalizedLibraryPath = path.resolve(libraryPath);
    const dbPath = DatabaseService.getInstance().getLibraryDbPath(normalizedLibraryPath);
    if (!fs.existsSync(dbPath)) {
      throw new Error('资源库数据库不存在');
    }
    return dbPath;
  }

  private tryResolveCurrentDbPath(): string | null {
    const currentDbPath = DatabaseService.getInstance().getDbPath();
    if (!currentDbPath || !fs.existsSync(currentDbPath)) {
      return null;
    }
    return currentDbPath;
  }

  private resolveStoredLibraryPath(dbPath: string, libraryPath?: string): string {
    const explicitLibraryPath = String(libraryPath || '').trim();
    return explicitLibraryPath ? path.resolve(explicitLibraryPath) : path.dirname(dbPath);
  }

  private readSessionFromDb(db: Database.Database, sessionId: string): AIAgentSession | null {
    const sessionRow = db.prepare(`
      SELECT
        id,
        title,
        library_path,
        last_message_preview,
        last_summary,
        compression_summary,
        compression_key_entities_json,
        compression_recent_focus,
        compression_compressed_at,
        created_at,
        updated_at
      FROM ai_workbench_sessions
      WHERE id = ? AND deleted_at IS NULL
      LIMIT 1
    `).get(sessionId) as SessionRow | undefined;

    if (!sessionRow) {
      return null;
    }

    const messageRows = db.prepare(`
      SELECT
        id,
        session_id,
        role,
        content,
        tool_calls_json,
        sort_order,
        created_at
      FROM ai_workbench_messages
      WHERE session_id = ? AND deleted_at IS NULL
      ORDER BY sort_order ASC, datetime(created_at) ASC, id ASC
    `).all(sessionId) as MessageRow[];

    return {
      id: sessionRow.id,
      title: sessionRow.title,
      libraryPath: String(sessionRow.library_path || ''),
      createdAt: sessionRow.created_at,
      updatedAt: sessionRow.updated_at,
      compression: this.parseCompression(sessionRow),
      messages: messageRows.map((row) => ({
        id: row.id,
        role: row.role,
        content: row.content,
        createdAt: row.created_at,
        toolCalls: this.parseToolCalls(row.tool_calls_json),
      })),
    };
  }

  private insertMessage(db: Database.Database, sessionId: string, message: AIAgentMessage): void {
    const nextSortOrder = this.getNextSortOrder(db, sessionId);
    db.prepare(`
      INSERT INTO ai_workbench_messages (
        id,
        session_id,
        role,
        content,
        tool_calls_json,
        sort_order,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      message.id,
      sessionId,
      message.role,
      message.content,
      this.stringifyToolCalls(message.toolCalls),
      nextSortOrder,
      message.createdAt,
      message.createdAt,
    );
  }

  private getNextSortOrder(db: Database.Database, sessionId: string): number {
    const row = db.prepare(`
      SELECT COALESCE(MAX(sort_order), 0) AS max_sort_order
      FROM ai_workbench_messages
      WHERE session_id = ? AND deleted_at IS NULL
    `).get(sessionId) as { max_sort_order?: number } | undefined;
    return Number(row?.max_sort_order || 0) + 1;
  }

  private updateSessionMetadata(
    db: Database.Database,
    session: AIAgentSession,
    options?: { lastSummary?: string },
  ): void {
    db.prepare(`
      UPDATE ai_workbench_sessions
      SET
        title = ?,
        library_path = ?,
        last_message_preview = ?,
        last_summary = ?,
        compression_summary = ?,
        compression_key_entities_json = ?,
        compression_recent_focus = ?,
        compression_compressed_at = ?,
        updated_at = ?
      WHERE id = ? AND deleted_at IS NULL
    `).run(
      session.title,
      session.libraryPath,
      this.getLastMessagePreview(session),
      this.toSummaryText(options?.lastSummary),
      session.compression?.summary || null,
      JSON.stringify(session.compression?.keyEntities || []),
      session.compression?.recentFocus || null,
      session.compression?.compressedAt || null,
      session.updatedAt,
      session.id,
    );
  }

  private toSummaryText(content?: string): string {
    return String(content || '').trim().slice(0, 240);
  }

  private parseCompression(row: SessionRow): AIAgentCompressionSnapshot | undefined {
    const summary = String(row.compression_summary || '').trim();
    const recentFocus = String(row.compression_recent_focus || '').trim();
    const compressedAt = String(row.compression_compressed_at || '').trim();
    const keyEntities = this.parseJsonArray(row.compression_key_entities_json);
    if (!summary && !recentFocus && !compressedAt && keyEntities.length === 0) {
      return undefined;
    }
    return {
      summary,
      keyEntities,
      recentFocus,
      compressedAt,
    };
  }

  private parseToolCalls(rawJson?: string | null): AIAgentToolCallRecord[] | undefined {
    if (!rawJson) {
      return undefined;
    }
    try {
      const parsed = JSON.parse(rawJson) as AIAgentToolCallRecord[] | undefined;
      return Array.isArray(parsed) && parsed.length > 0 ? parsed : undefined;
    } catch (error) {
      logger.warn('解析工具调用记录失败，将忽略损坏数据', error);
      return undefined;
    }
  }

  private stringifyToolCalls(toolCalls?: AIAgentToolCallRecord[]): string {
    return JSON.stringify(Array.isArray(toolCalls) ? toolCalls : []);
  }

  private parseJsonArray(rawJson?: string | null): string[] {
    if (!rawJson) {
      return [];
    }
    try {
      const parsed = JSON.parse(rawJson) as unknown;
      return Array.isArray(parsed)
        ? parsed.map(item => String(item || '').trim()).filter(Boolean)
        : [];
    } catch (error) {
      logger.warn('解析压缩关键实体失败，将忽略损坏数据', error);
      return [];
    }
  }

  private getCachedSession(sessionId: string): AIAgentSession | null {
    const cacheEntry = this.getCacheEntry(sessionId);
    if (!cacheEntry) {
      return null;
    }
    return this.cloneSession(cacheEntry.session);
  }

  private getCacheEntry(sessionId: string): CachedSessionEntry | null {
    const cacheEntry = this.sessionCache.get(sessionId);
    if (!cacheEntry) {
      return null;
    }
    if (cacheEntry.expiresAt <= Date.now()) {
      this.sessionCache.delete(sessionId);
      return null;
    }
    return cacheEntry;
  }

  private setCachedSession(session: AIAgentSession, dbPath: string): void {
    this.sessionCache.set(session.id, {
      session: this.cloneSession(session),
      dbPath,
      expiresAt: Date.now() + AgentService.SESSION_CACHE_TTL_MS,
    });
  }

  private cloneSession(session: AIAgentSession): AIAgentSession {
    return JSON.parse(JSON.stringify(session)) as AIAgentSession;
  }
}
