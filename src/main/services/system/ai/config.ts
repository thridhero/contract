import {
  AILocalModelConfig,
  AIPromptTemplateConfig,
  AIProvider,
  AISettings,
} from '../../../../shared/types/ai.types';
import {
  getDefaultPromptTemplateConfig,
  normalizeAISettings,
  normalizePromptTemplateConfig,
} from '../../../../shared/utils/ai';
import { DatabaseService } from '../DatabaseService';
import { logger } from './shared';

export function getAIConfig(): AISettings {
  const db = DatabaseService.getInstance();

  let localModels: AILocalModelConfig[] = [];
  const rawLocalModels = db.getSetting('ai_local_models')?.value || '';
  if (rawLocalModels) {
    try {
      localModels = JSON.parse(rawLocalModels) as AILocalModelConfig[];
    } catch (error) {
      logger.warn('解析本地模型配置失败，将回退默认值:', error);
    }
  }

  return normalizeAISettings({
    enabled: db.getSetting('ai_enabled')?.value === 'true',
    mode: db.getSetting('ai_mode')?.value === 'local' ? 'local' : 'cloud',
    provider: (db.getSetting('ai_provider')?.value || 'kimi') as AIProvider,
    apiKey: db.getSetting('ai_api_key')?.value || '',
    baseUrl: db.getSetting('ai_base_url')?.value || '',
    selectedModelId: db.getSetting('ai_selected_model_id')?.value || '',
    localModels,
    timeoutMs: Number(db.getSetting('ai_timeout_ms')?.value || 0) || undefined,
    structuredOutput: db.getSetting('ai_structured_output')?.value !== 'false',
    contractPrompt: db.getSetting('ai_contract_prompt')?.value || '',
    ragEnabled: db.getSetting('ai_rag_enabled')?.value !== 'false',
    embeddingModelPath: db.getSetting('ai_embedding_model_path')?.value || '',
    embeddingExecutablePath: db.getSetting('ai_embedding_executable_path')?.value || '',
    embeddingDimension: Number(db.getSetting('ai_embedding_dimension')?.value || 0) || undefined,
    retrievalTopK: Number(db.getSetting('ai_retrieval_top_k')?.value || 0) || undefined,
    retrievalScoreThreshold: Number(db.getSetting('ai_retrieval_score_threshold')?.value || 0) || undefined,
    localSmallModelMaxContextChars: Number(db.getSetting('ai_local_small_model_max_context_chars')?.value || 0) || undefined,
    localSmallModelFieldGroupMode: db.getSetting('ai_local_small_model_field_group_mode')?.value === 'single-pass'
      ? 'single-pass'
      : 'grouped',
    agentSettings: {
      modelId: db.getSetting('ai_agent_model_id')?.value || '',
      enableTools: db.getSetting('ai_agent_enable_tools')?.value !== 'false',
      compressionThreshold: Number(db.getSetting('ai_agent_compression_threshold')?.value || 0) || 12,
      availableTools: (() => {
        const rawValue = String(db.getSetting('ai_agent_available_tools')?.value || '').trim();
        if (!rawValue) return [];
        try {
          return JSON.parse(rawValue);
        } catch {
          return [];
        }
      })(),
    },
    promptTemplates: (() => {
      const raw = String(db.getSetting('ai_prompt_templates')?.value || '').trim();
      if (!raw) return getDefaultPromptTemplateConfig();
      try {
        return normalizePromptTemplateConfig(JSON.parse(raw) as Partial<AIPromptTemplateConfig>);
      } catch (error) {
        logger.warn('解析提示词模板中心配置失败，将回退默认值:', error);
        return getDefaultPromptTemplateConfig();
      }
    })(),
  });
}

export function getSelectedLocalModel(config: AISettings): AILocalModelConfig {
  const selected = config.localModels.find(item => item.id === config.selectedModelId);
  return selected || config.localModels[0];
}

export function ensureAIEnabled(config: AISettings, fileId = ''): void {
  if (config.enabled) {
    return;
  }

  const db = DatabaseService.getInstance();
  if (fileId) {
    db.logAIContractExtraction(fileId, '', 'FAILED', 'AI 功能未启用');
  }
  throw new Error('AI 功能未启用');
}
