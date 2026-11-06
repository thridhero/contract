import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { AIExecutionMode, AIProvider, AISettings, AILocalModelConfig } from '../../../shared/types/ai.types'
import { getDefaultPromptTemplateConfig, normalizeAISettings, normalizePromptTemplateConfig } from '../../../shared/utils/ai'
import type { AIAgentSettings } from '../../../shared/types/aiAgent.types'
import { createRendererLogger } from '../../utils/logger'

const logger = createRendererLogger('AIStore')

export const useAIStore = defineStore('ai', () => {
  const enabled = ref(false)
  const mode = ref<AIExecutionMode>('cloud')
  const provider = ref<AIProvider>('kimi')
  const apiKey = ref('')
  const baseUrl = ref('')
  const selectedModelId = ref('')
  const localModels = ref<AILocalModelConfig[]>(normalizeAISettings({}).localModels)
  const timeoutMs = ref(normalizeAISettings({}).timeoutMs)
  const structuredOutput = ref(true)
  const contractPrompt = ref('')
  const promptTemplates = ref(normalizePromptTemplateConfig(getDefaultPromptTemplateConfig()))
  const ragEnabled = ref(true)
  const embeddingModelPath = ref('')
  const embeddingExecutablePath = ref('')
  const embeddingDimension = ref(normalizeAISettings({}).embeddingDimension)
  const retrievalTopK = ref(normalizeAISettings({}).retrievalTopK)
  const retrievalScoreThreshold = ref(normalizeAISettings({}).retrievalScoreThreshold)
  const localSmallModelMaxContextChars = ref(normalizeAISettings({}).localSmallModelMaxContextChars)
  const localSmallModelFieldGroupMode = ref(normalizeAISettings({}).localSmallModelFieldGroupMode)
  const agentSettings = ref<AIAgentSettings>(normalizeAISettings({}).agentSettings)
  const isInitialized = ref(false)

  const applySettings = (settings: AISettings) => {
    enabled.value = settings.enabled
    mode.value = settings.mode
    provider.value = settings.provider
    apiKey.value = settings.apiKey
    baseUrl.value = settings.baseUrl
    selectedModelId.value = settings.selectedModelId
    localModels.value = settings.localModels
    timeoutMs.value = settings.timeoutMs
    structuredOutput.value = settings.structuredOutput
    contractPrompt.value = settings.contractPrompt
    promptTemplates.value = settings.promptTemplates
    ragEnabled.value = settings.ragEnabled
    embeddingModelPath.value = settings.embeddingModelPath
    embeddingExecutablePath.value = settings.embeddingExecutablePath
    embeddingDimension.value = settings.embeddingDimension
    retrievalTopK.value = settings.retrievalTopK
    retrievalScoreThreshold.value = settings.retrievalScoreThreshold
    localSmallModelMaxContextChars.value = settings.localSmallModelMaxContextChars
    localSmallModelFieldGroupMode.value = settings.localSmallModelFieldGroupMode
    agentSettings.value = settings.agentSettings
  }

  const getAISettings = (): AISettings => normalizeAISettings({
    enabled: enabled.value,
    mode: mode.value,
    provider: provider.value,
    apiKey: apiKey.value,
    baseUrl: baseUrl.value,
    selectedModelId: selectedModelId.value,
    localModels: localModels.value,
    timeoutMs: timeoutMs.value,
    structuredOutput: structuredOutput.value,
    contractPrompt: contractPrompt.value,
    promptTemplates: promptTemplates.value,
    ragEnabled: ragEnabled.value,
    embeddingModelPath: embeddingModelPath.value,
    embeddingExecutablePath: embeddingExecutablePath.value,
    embeddingDimension: embeddingDimension.value,
    retrievalTopK: retrievalTopK.value,
    retrievalScoreThreshold: retrievalScoreThreshold.value,
    localSmallModelMaxContextChars: localSmallModelMaxContextChars.value,
    localSmallModelFieldGroupMode: localSmallModelFieldGroupMode.value,
    agentSettings: agentSettings.value,
  })

  const initAISettings = async () => {
    try {
      const db = window.electronAPI.db

      const [
        enabledRes,
        modeRes,
        providerRes,
        apiKeyRes,
        baseUrlRes,
        selectedModelIdRes,
        localModelsRes,
        timeoutRes,
        structuredOutputRes,
        promptRes,
        promptTemplatesRes,
        ragEnabledRes,
        embeddingModelPathRes,
        embeddingExecutablePathRes,
        embeddingDimensionRes,
        retrievalTopKRes,
        retrievalScoreThresholdRes,
        localSmallModelMaxContextCharsRes,
        localSmallModelFieldGroupModeRes,
        agentModelRes,
        agentToolEnabledRes,
        agentCompressionThresholdRes,
        agentAvailableToolsRes,
      ] = await Promise.all([
        db.getSetting('ai_enabled'),
        db.getSetting('ai_mode'),
        db.getSetting('ai_provider'),
        db.getSetting('ai_api_key'),
        db.getSetting('ai_base_url'),
        db.getSetting('ai_selected_model_id'),
        db.getSetting('ai_local_models'),
        db.getSetting('ai_timeout_ms'),
        db.getSetting('ai_structured_output'),
        db.getSetting('ai_contract_prompt'),
        db.getSetting('ai_prompt_templates'),
        db.getSetting('ai_rag_enabled'),
        db.getSetting('ai_embedding_model_path'),
        db.getSetting('ai_embedding_executable_path'),
        db.getSetting('ai_embedding_dimension'),
        db.getSetting('ai_retrieval_top_k'),
        db.getSetting('ai_retrieval_score_threshold'),
        db.getSetting('ai_local_small_model_max_context_chars'),
        db.getSetting('ai_local_small_model_field_group_mode'),
        db.getSetting('ai_agent_model_id'),
        db.getSetting('ai_agent_enable_tools'),
        db.getSetting('ai_agent_compression_threshold'),
        db.getSetting('ai_agent_available_tools'),
      ])

      let parsedPromptTemplates = getDefaultPromptTemplateConfig()
      const rawPromptTemplates = promptTemplatesRes.success ? String(promptTemplatesRes.data?.value || '').trim() : ''
      if (rawPromptTemplates) {
        try {
          parsedPromptTemplates = normalizePromptTemplateConfig(JSON.parse(rawPromptTemplates))
        } catch (error) {
          logger.error('解析提示词模板中心失败', error)
        }
      }

      let parsedLocalModels: AILocalModelConfig[] = []
      const rawLocalModels = localModelsRes.success ? String(localModelsRes.data?.value || '').trim() : ''
      if (rawLocalModels) {
        try {
          parsedLocalModels = JSON.parse(rawLocalModels) as AILocalModelConfig[]
        } catch (error) {
          logger.error('解析本地模型列表失败', error)
        }
      }

      applySettings(normalizeAISettings({
        enabled: enabledRes.success && enabledRes.data?.value === 'true',
        mode: modeRes.success && modeRes.data?.value === 'local' ? 'local' : 'cloud',
        provider: (providerRes.success && providerRes.data?.value === 'minimax')
          ? 'minimax'
          : (providerRes.success && providerRes.data?.value === 'deepseek')
            ? 'deepseek'
            : 'kimi',
        apiKey: (apiKeyRes.success && apiKeyRes.data?.value) || '',
        baseUrl: (baseUrlRes.success && baseUrlRes.data?.value) || '',
        selectedModelId: (selectedModelIdRes.success && selectedModelIdRes.data?.value) || '',
        localModels: parsedLocalModels,
        timeoutMs: Number((timeoutRes.success && timeoutRes.data?.value) || 0) || undefined,
        structuredOutput: structuredOutputRes.success ? structuredOutputRes.data?.value !== 'false' : true,
        contractPrompt: (promptRes.success && promptRes.data?.value) || '',
        promptTemplates: parsedPromptTemplates,
        ragEnabled: ragEnabledRes.success ? ragEnabledRes.data?.value !== 'false' : true,
        embeddingModelPath: (embeddingModelPathRes.success && embeddingModelPathRes.data?.value) || '',
        embeddingExecutablePath: (embeddingExecutablePathRes.success && embeddingExecutablePathRes.data?.value) || '',
        embeddingDimension: Number((embeddingDimensionRes.success && embeddingDimensionRes.data?.value) || 0) || undefined,
        retrievalTopK: Number((retrievalTopKRes.success && retrievalTopKRes.data?.value) || 0) || undefined,
        retrievalScoreThreshold: Number((retrievalScoreThresholdRes.success && retrievalScoreThresholdRes.data?.value) || 0) || undefined,
        localSmallModelMaxContextChars: Number((localSmallModelMaxContextCharsRes.success && localSmallModelMaxContextCharsRes.data?.value) || 0) || undefined,
        localSmallModelFieldGroupMode: localSmallModelFieldGroupModeRes.success && localSmallModelFieldGroupModeRes.data?.value === 'single-pass'
          ? 'single-pass'
          : 'grouped',
        agentSettings: {
          modelId: (agentModelRes.success && agentModelRes.data?.value) || '',
          enableTools: agentToolEnabledRes.success ? agentToolEnabledRes.data?.value !== 'false' : true,
          compressionThreshold: Number((agentCompressionThresholdRes.success && agentCompressionThresholdRes.data?.value) || 0) || 12,
          availableTools: (() => {
            const rawValue = (agentAvailableToolsRes.success && agentAvailableToolsRes.data?.value) || ''
            if (!rawValue) return []
            try {
              return JSON.parse(rawValue)
            } catch {
              return []
            }
          })(),
        },
      }))

      isInitialized.value = true
    } catch (error) {
      logger.error('加载 AI 配置失败', error)
    }
  }

  const upsertSetting = async (key: string, value: string, description: string) => {
    const existing = await window.electronAPI.db.getSetting(key)
    if (existing.success && existing.data) {
      await window.electronAPI.db.updateSetting(key, value, description)
    } else {
      await window.electronAPI.db.insertSetting(key, value, description)
    }
  }

  const saveAISettings = async (settings: AISettings) => {
    try {
      const normalized = normalizeAISettings(settings)

      await upsertSetting('ai_enabled', normalized.enabled.toString(), 'AI功能开关')
      await upsertSetting('ai_mode', normalized.mode, 'AI运行模式')
      await upsertSetting('ai_provider', normalized.provider, 'AI服务提供商')
      await upsertSetting('ai_api_key', normalized.apiKey, 'AI API Key')
      await upsertSetting('ai_base_url', normalized.baseUrl, 'AI Base URL')
      await upsertSetting('ai_selected_model_id', normalized.selectedModelId, '当前生效的本地模型')
      await upsertSetting('ai_local_models', JSON.stringify(normalized.localModels), '本地模型列表')
      await upsertSetting('ai_timeout_ms', String(normalized.timeoutMs), 'AI请求超时时间')
      await upsertSetting('ai_structured_output', String(normalized.structuredOutput), '是否启用结构化JSON输出')
      await upsertSetting('ai_contract_prompt', normalized.contractPrompt, '合同提取提示词')
      await upsertSetting('ai_prompt_templates', JSON.stringify(normalized.promptTemplates), 'AI提示词模板中心配置')
      await upsertSetting('ai_rag_enabled', String(normalized.ragEnabled), '是否启用RAG检索')
      await upsertSetting('ai_embedding_model_path', normalized.embeddingModelPath, 'Embedding 模型文件路径')
      await upsertSetting('ai_embedding_executable_path', normalized.embeddingExecutablePath, 'Embedding 执行器路径')
      await upsertSetting('ai_embedding_dimension', String(normalized.embeddingDimension), 'Embedding 维度')
      await upsertSetting('ai_retrieval_top_k', String(normalized.retrievalTopK), 'RAG 召回 TopK')
      await upsertSetting('ai_retrieval_score_threshold', String(normalized.retrievalScoreThreshold), 'RAG 相似度阈值')
      await upsertSetting('ai_local_small_model_max_context_chars', String(normalized.localSmallModelMaxContextChars), '本地小模型最大上下文字符数')
      await upsertSetting('ai_local_small_model_field_group_mode', normalized.localSmallModelFieldGroupMode, '本地小模型字段分组模式')
      await upsertSetting('ai_agent_model_id', normalized.agentSettings.modelId, 'Agent 默认模型')
      await upsertSetting('ai_agent_enable_tools', String(normalized.agentSettings.enableTools), 'Agent 是否启用工具调用')
      await upsertSetting('ai_agent_compression_threshold', String(normalized.agentSettings.compressionThreshold), 'Agent 上下文压缩阈值')
      await upsertSetting('ai_agent_available_tools', JSON.stringify(normalized.agentSettings.availableTools), 'Agent 可用工具范围')

      applySettings(normalized)
      return true
    } catch (error) {
      logger.error('保存 AI 配置失败', error)
      return false
    }
  }

  return {
    enabled,
    mode,
    provider,
    apiKey,
    baseUrl,
    selectedModelId,
    localModels,
    timeoutMs,
    structuredOutput,
    contractPrompt,
    promptTemplates,
    ragEnabled,
    embeddingModelPath,
    embeddingExecutablePath,
    embeddingDimension,
    retrievalTopK,
    retrievalScoreThreshold,
    localSmallModelMaxContextChars,
    localSmallModelFieldGroupMode,
    agentSettings,
    isInitialized,
    getAISettings,
    initAISettings,
    saveAISettings
  }
})
