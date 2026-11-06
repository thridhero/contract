import { IpcMainInvokeEvent } from 'electron';
import * as channels from '../../channels';
import { AIService } from '../../../services/system/AIService';
import { DatabaseService } from '../../../services/system/DatabaseService';
import { ok, IpcResponse } from '../../../../shared/types/ipc.types';
import {
  AIContractExtractionEvidenceResult,
  AIContractExtractionResult,
  AIExtractContractInfoRequest,
  AILocalModelValidationRequest,
  AILocalModelValidationResult,
  AIStructuredGenerateRequest,
  AIStructuredGenerateResult,
  AITestConnectionRequest,
  AITestConnectionResult,
} from '../../../../shared/types/ai.types';
import type {
  AIAgentCreateSessionRequest,
  AIAgentCreateSessionResult,
  AIAgentDeleteSessionRequest,
  AIAgentGetSessionRequest,
  AIAgentRenameSessionRequest,
  AIAgentRenameSessionResult,
  AIAgentSendMessageRequest,
  AIAgentSendMessageResult,
  AIAgentSession,
  AIAgentSessionSummary,
} from '../../../../shared/types/aiAgent.types';
import { AgentService } from '../../../services/system/ai/langgraph/AgentService';

const getAIService = () => AIService.getInstance();
const getAgentService = () => AgentService.getInstance();

export const aiHandlers: Record<string, (event: IpcMainInvokeEvent, ...args: unknown[]) => Promise<unknown>> = {
  // 触发合同信息抽取，兼容对象参数和旧版分散参数两种调用方式。
  [channels.AI_EXTRACT_CONTRACT]: async (_, payload: unknown, fileId?: unknown, prompt?: unknown): Promise<IpcResponse<AIContractExtractionResult>> => {
    const normalizedPayload: AIExtractContractInfoRequest = (payload && typeof payload === 'object')
      ? payload as AIExtractContractInfoRequest
      : {
          filePath: String(payload || ''),
          fileId: fileId ? String(fileId) : '',
          prompt: prompt ? String(prompt) : undefined,
        };
    const result = await getAIService().extractContractInfo(normalizedPayload);
    return ok(result);
  },
  // 根据文件 ID 读取 AI 抽取时保存的文本分块和字段证据，便于前端展示溯源信息。
  [channels.AI_GET_EXTRACTION_EVIDENCE]: async (_, payload: unknown): Promise<IpcResponse<AIContractExtractionEvidenceResult>> => {
    const fileId = payload && typeof payload === 'object'
      ? String((payload as { fileId?: unknown }).fileId || '').trim()
      : String(payload || '').trim();
    const db = DatabaseService.getInstance();
    return ok({
      chunks: fileId ? db.getContractAiChunks(fileId) : [],
      evidence: fileId ? db.getContractFieldEvidence(fileId) : [],
    });
  },
  // 调用通用结构化生成能力，将自然语言或上下文内容转换为预期的结构化结果。
  [channels.AI_GENERATE_STRUCTURED]: async (_, payload: unknown): Promise<IpcResponse<AIStructuredGenerateResult>> => {
    const result = await getAIService().generateStructured(payload as AIStructuredGenerateRequest);
    return ok(result);
  },
  // 测试当前 AI 服务配置是否可用，通常用于设置页的连通性校验。
  [channels.AI_TEST_CONNECTION]: async (_, config: unknown): Promise<IpcResponse<AITestConnectionResult>> => {
    const result = await getAIService().testConnection(config as AITestConnectionRequest);
    return ok(result);
  },
  // 校验本地模型配置是否合法，例如模型路径、运行参数和可访问性是否满足要求。
  [channels.AI_VALIDATE_LOCAL_MODEL]: async (_, payload: unknown): Promise<IpcResponse<AILocalModelValidationResult>> => {
    const result = await getAIService().validateLocalModel(payload as AILocalModelValidationRequest);
    return ok(result);
  },
  [channels.AI_PROMOTE_CONTRACT_VECTORS]: async (_, payload: unknown): Promise<IpcResponse<{ success: boolean }>> => {
    const data = payload && typeof payload === 'object' ? payload as { filePath?: unknown; contractId?: unknown } : {};
    getAIService().promoteContractVectors(
      String(data.filePath || '').trim(),
      String(data.contractId || '').trim(),
    );
    return ok({ success: true });
  },
  // 创建新的 AI Agent 会话，返回会话基础信息供前端进入对话页面。
  [channels.AI_AGENT_CREATE_SESSION]: async (_, payload: unknown): Promise<IpcResponse<AIAgentCreateSessionResult>> => {
    const result = await getAgentService().createSession(payload as AIAgentCreateSessionRequest);
    return ok(result);
  },
  // 获取所有 AI Agent 会话摘要列表，用于会话侧边栏或历史记录展示。
  [channels.AI_AGENT_LIST_SESSIONS]: async (): Promise<IpcResponse<AIAgentSessionSummary[]>> => {
    return ok(getAgentService().listSessions());
  },
  // 根据会话查询完整会话详情，包含消息历史和关联元数据。
  [channels.AI_AGENT_GET_SESSION]: async (_, payload: unknown): Promise<IpcResponse<AIAgentSession | null>> => {
    return ok(getAgentService().getSession(payload as AIAgentGetSessionRequest));
  },
  // 修改指定 AI Agent 会话名称，便于用户管理和区分不同对话主题。
  [channels.AI_AGENT_RENAME_SESSION]: async (_, payload: unknown): Promise<IpcResponse<AIAgentRenameSessionResult>> => {
    const result = await getAgentService().renameSession(payload as AIAgentRenameSessionRequest);
    return ok(result);
  },
  // 向指定 AI Agent 会话发送消息，并返回模型回复及本轮交互结果。
  [channels.AI_AGENT_SEND_MESSAGE]: async (_, payload: unknown): Promise<IpcResponse<AIAgentSendMessageResult>> => {
    const result = await getAgentService().sendMessage(payload as AIAgentSendMessageRequest);
    return ok(result);
  },
  // 删除指定 AI Agent 会话，供前端在清理历史对话时调用。
  [channels.AI_AGENT_DELETE_SESSION]: async (_, payload: unknown): Promise<IpcResponse<{ success: boolean }>> => {
    return ok(getAgentService().deleteSession(payload as AIAgentDeleteSessionRequest));
  },
};
