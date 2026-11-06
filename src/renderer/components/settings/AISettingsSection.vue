<template>
  <div>
    <div class="mb-6">
      <h3 class="text-xs text-content-text-muted mb-2 px-1">基础设置</h3>
      <div class="border border-content-border rounded-xl bg-content-card overflow-hidden p-4 flex flex-col gap-4">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-3">
            <Checkbox :modelValue="settings.enabled" @update:modelValue="val => updateField('enabled', Boolean(val))" :binary="true" inputId="aiEnabled" />
            <label for="aiEnabled" class="text-[14px] text-content-text cursor-pointer select-none">启用 AI 辅助功能</label>
          </div>
        </div>
        <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label class="block text-[14px] text-content-text mb-2">运行模式</label>
            <Select
              :modelValue="settings.mode"
              @update:modelValue="val => updateMode((val as AIExecutionMode) || 'cloud')"
              :options="modeOptions"
              optionLabel="label"
              optionValue="value"
              class="w-full"
            />
          </div>
          <div>
            <label class="block text-[14px] text-content-text mb-2">默认超时（毫秒）</label>
            <InputNumber
              :modelValue="settings.timeoutMs"
              @update:modelValue="val => updateField('timeoutMs', Number(val || 0))"
              :min="1000"
              :step="1000"
              class="w-full"
            />
          </div>
        </div>
        <div class="flex items-center gap-3">
          <Checkbox :modelValue="settings.structuredOutput" @update:modelValue="val => updateField('structuredOutput', Boolean(val))" :binary="true" inputId="aiStructuredOutput" />
          <label for="aiStructuredOutput" class="text-[14px] text-content-text cursor-pointer select-none">启用严格结构化 JSON 返回</label>
        </div>
      </div>
    </div>

    <div class="mb-6">
      <h3 class="text-xs text-content-text-muted mb-2 px-1">Agent 运行配置</h3>
      <div class="border border-content-border rounded-xl bg-content-card overflow-hidden p-4 flex flex-col gap-4">
        <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label class="block text-[14px] text-content-text mb-2">默认 Agent 模型</label>
            <InputText
              :modelValue="normalizedSettings.agentSettings.modelId"
              @update:modelValue="val => updateAgentField('modelId', String(val || ''))"
              class="w-full text-sm rounded-lg"
              placeholder="留空则使用当前 Provider 默认模型"
            />
          </div>
          <div>
            <label class="block text-[14px] text-content-text mb-2">压缩阈值（消息轮次）</label>
            <InputNumber
              :modelValue="normalizedSettings.agentSettings.compressionThreshold"
              @update:modelValue="val => updateAgentField('compressionThreshold', Number(val || 0))"
              :min="4"
              :step="1"
              class="w-full"
            />
          </div>
        </div>
        <div class="flex items-center gap-3">
          <Checkbox
            :modelValue="normalizedSettings.agentSettings.enableTools"
            @update:modelValue="val => updateAgentField('enableTools', Boolean(val))"
            :binary="true"
            inputId="agentEnableTools"
          />
          <label for="agentEnableTools" class="text-[14px] text-content-text cursor-pointer select-none">启用 Agent 工具调用</label>
        </div>
        <div>
          <label class="block text-[14px] text-content-text mb-2">可用工具范围</label>
          <div class="grid grid-cols-1 gap-3 md:grid-cols-3">
            <label
              v-for="tool in agentToolOptions"
              :key="tool.value"
              class="flex items-start gap-3 rounded-lg border border-content-border px-3 py-3 cursor-pointer"
            >
              <Checkbox
                :modelValue="normalizedSettings.agentSettings.availableTools.includes(tool.value)"
                @update:modelValue="() => toggleAgentTool(tool.value)"
                :binary="true"
                :inputId="`agent-tool-${tool.value}`"
              />
              <span class="flex-1">
                <span class="block text-[14px] text-content-text">{{ tool.label }}</span>
                <span class="block text-xs text-content-text-muted mt-1">{{ tool.description }}</span>
              </span>
            </label>
          </div>
        </div>
      </div>
    </div>

    <div v-if="settings.mode === 'cloud'" class="mb-6">
      <h3 class="text-xs text-content-text-muted mb-2 px-1">云端模型</h3>
      <div class="border border-content-border rounded-xl bg-content-card overflow-hidden p-4 flex flex-col gap-4">
        <div>
          <label class="block text-[14px] text-content-text mb-2">AI 提供商</label>
          <Select
            :modelValue="settings.provider"
            @update:modelValue="val => updateProvider((val as AIProvider) || 'kimi')"
            :options="aiProviders"
            optionLabel="label"
            optionValue="value"
            class="w-full"
          />
        </div>
        <div>
          <label class="block text-[14px] text-content-text mb-2">API Key</label>
          <InputText
            :modelValue="settings.apiKey"
            @update:modelValue="val => updateField('apiKey', val as string)"
            type="password"
            class="w-full text-sm rounded-lg"
            placeholder="请输入 API Key"
          />
        </div>
        <div>
          <label class="block text-[14px] text-content-text mb-2">基础地址 (Base URL)</label>
          <InputText
            :modelValue="settings.baseUrl"
            @update:modelValue="val => updateField('baseUrl', val as string)"
            class="w-full text-sm rounded-lg"
            placeholder="例如: https://api.moonshot.cn 或 https://api.minimax.chat 或 https://api.deepseek.com"
          />
        </div>
      </div>
    </div>

    <div v-else class="mb-6">
      <h3 class="text-xs text-content-text-muted mb-2 px-1">本地抽取模型（llama.cpp）</h3>
      <div class="border border-content-border rounded-xl bg-content-card overflow-hidden p-4 flex flex-col gap-4">
        <div class="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div class="w-full md:max-w-[320px]">
            <label class="block text-[14px] text-content-text mb-2">当前模型</label>
            <Select
              :modelValue="settings.selectedModelId"
              @update:modelValue="val => updateField('selectedModelId', String(val || ''))"
              :options="modelOptions"
              optionLabel="label"
              optionValue="value"
              class="w-full"
            />
          </div>
          <Button label="新增模型" size="small" @click="addLocalModel" />
        </div>

        <div v-if="selectedLocalModel" :key="selectedLocalModel.id" class="rounded-xl border border-content-border p-4 flex flex-col gap-4">
          <div class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div class="text-sm font-medium text-content-text">{{ selectedLocalModel.displayName || '未命名模型' }}</div>
            <div class="flex gap-2">
              <Button size="small" severity="danger" outlined label="删除" :disabled="settings.localModels.length <= 1" @click="removeLocalModel(selectedLocalModel.id)" />
            </div>
          </div>

          <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label class="block text-[14px] text-content-text mb-2">模型名称</label>
              <InputText :modelValue="selectedLocalModel.displayName" @update:modelValue="val => updateLocalModelField(selectedLocalModel.id, 'displayName', val as string)" class="w-full" />
            </div>
            <div>
              <label class="block text-[14px] text-content-text mb-2">模型类型</label>
              <Select
                :modelValue="selectedLocalModel.modelType"
                @update:modelValue="val => updateLocalModelField(selectedLocalModel.id, 'modelType', val as string)"
                :options="modelTypeOptions"
                optionLabel="label"
                optionValue="value"
                class="w-full"
              />
            </div>
          </div>

          <div>
            <label class="block text-[14px] text-content-text mb-2">模型文件路径</label>
            <div class="flex gap-2">
              <InputText :modelValue="selectedLocalModel.modelPath" @update:modelValue="val => updateLocalModelField(selectedLocalModel.id, 'modelPath', val as string)" class="w-full" placeholder="请选择 .gguf 模型文件" />
              <Button size="small" severity="secondary" outlined label="浏览" @click="browseLocalPath(selectedLocalModel.id, 'modelPath')" />
            </div>
          </div>

          <div>
            <label class="block text-[14px] text-content-text mb-2">llama.cpp 执行器路径</label>
            <div class="flex gap-2">
              <InputText :modelValue="selectedLocalModel.executablePath" @update:modelValue="val => updateLocalModelField(selectedLocalModel.id, 'executablePath', val as string)" class="w-full" placeholder="请选择 llama-cli 或 main.exe" />
              <Button size="small" severity="secondary" outlined label="浏览" @click="browseLocalPath(selectedLocalModel.id, 'executablePath')" />
            </div>
          </div>

          <div class="grid grid-cols-1 gap-4 md:grid-cols-4">
            <div>
              <label class="block text-[14px] text-content-text mb-2">上下文</label>
              <InputNumber :modelValue="selectedLocalModel.contextSize" @update:modelValue="val => updateLocalModelField(selectedLocalModel.id, 'contextSize', Number(val || 0))" :min="512" :step="512" class="w-full" />
            </div>
            <div>
              <label class="block text-[14px] text-content-text mb-2">最大输出</label>
              <InputNumber :modelValue="selectedLocalModel.maxTokens" @update:modelValue="val => updateLocalModelField(selectedLocalModel.id, 'maxTokens', Number(val || 0))" :min="128" :step="128" class="w-full" />
            </div>
            <div>
              <label class="block text-[14px] text-content-text mb-2">温度</label>
              <InputNumber :modelValue="selectedLocalModel.temperature" @update:modelValue="val => updateLocalModelField(selectedLocalModel.id, 'temperature', Number(val || 0))" :min="0" :max="2" :step="0.1" :minFractionDigits="0" :maxFractionDigits="2" class="w-full" />
            </div>
            <div>
              <label class="block text-[14px] text-content-text mb-2">单模型超时</label>
              <InputNumber :modelValue="selectedLocalModel.timeoutMs" @update:modelValue="val => updateLocalModelField(selectedLocalModel.id, 'timeoutMs', Number(val || 0))" :min="1000" :step="1000" class="w-full" />
            </div>
          </div>

          <div>
            <label class="block text-[14px] text-content-text mb-2">附加参数</label>
            <InputText :modelValue="selectedLocalModel.extraArgs" @update:modelValue="val => updateLocalModelField(selectedLocalModel.id, 'extraArgs', val as string)" class="w-full" placeholder="可选，例如 --threads 8 --gpu-layers 35" />
          </div>
        </div>
      </div>
    </div>

    <div class="mb-6">
      <h3 class="text-xs text-content-text-muted mb-2 px-1">RAG 与向量检索</h3>
      <div class="border border-content-border rounded-xl bg-content-card overflow-hidden p-4 flex flex-col gap-4">
        <div class="flex items-center gap-3">
          <Checkbox :modelValue="normalizedSettings.ragEnabled" @update:modelValue="val => updateField('ragEnabled', Boolean(val))" :binary="true" inputId="aiRagEnabled" />
          <label for="aiRagEnabled" class="text-[14px] text-content-text cursor-pointer select-none">启用合同向量检索增强抽取</label>
        </div>

        <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label class="block text-[14px] text-content-text mb-2">Embedding 执行器路径</label>
            <div class="flex gap-2">
              <InputText :modelValue="normalizedSettings.embeddingExecutablePath" @update:modelValue="val => updateField('embeddingExecutablePath', String(val || ''))" class="w-full" placeholder="可独立于抽取模型配置" />
              <Button size="small" severity="secondary" outlined label="浏览" @click="browseEmbeddingPath('embeddingExecutablePath')" />
            </div>
          </div>
          <div>
            <label class="block text-[14px] text-content-text mb-2">Embedding 模型路径</label>
            <div class="flex gap-2">
              <InputText :modelValue="normalizedSettings.embeddingModelPath" @update:modelValue="val => updateField('embeddingModelPath', String(val || ''))" class="w-full" placeholder="向量模型文件路径" />
              <Button size="small" severity="secondary" outlined label="浏览" @click="browseEmbeddingPath('embeddingModelPath')" />
            </div>
          </div>
        </div>

        <div class="grid grid-cols-1 gap-4 md:grid-cols-4">
          <div>
            <label class="block text-[14px] text-content-text mb-2">Embedding 维度</label>
            <InputNumber :modelValue="normalizedSettings.embeddingDimension" @update:modelValue="val => updateField('embeddingDimension', Number(val || 0))" :min="64" :step="64" class="w-full" />
          </div>
          <div>
            <label class="block text-[14px] text-content-text mb-2">召回 TopK</label>
            <InputNumber :modelValue="normalizedSettings.retrievalTopK" @update:modelValue="val => updateField('retrievalTopK', Number(val || 0))" :min="1" :step="1" class="w-full" />
          </div>
          <div>
            <label class="block text-[14px] text-content-text mb-2">相似度阈值</label>
            <InputNumber :modelValue="normalizedSettings.retrievalScoreThreshold" @update:modelValue="val => updateField('retrievalScoreThreshold', Number(val || 0))" :min="0" :max="1" :step="0.01" :minFractionDigits="0" :maxFractionDigits="2" class="w-full" />
          </div>
          <div>
            <label class="block text-[14px] text-content-text mb-2">本地上下文字符上限</label>
            <InputNumber :modelValue="normalizedSettings.localSmallModelMaxContextChars" @update:modelValue="val => updateField('localSmallModelMaxContextChars', Number(val || 0))" :min="2000" :step="1000" class="w-full" />
          </div>
        </div>

        <div>
          <label class="block text-[14px] text-content-text mb-2">本地小模型抽取策略</label>
          <Select
            :modelValue="normalizedSettings.localSmallModelFieldGroupMode"
            @update:modelValue="val => updateField('localSmallModelFieldGroupMode', (val as AISettings['localSmallModelFieldGroupMode']) || 'grouped')"
            :options="localFieldGroupModeOptions"
            optionLabel="label"
            optionValue="value"
            class="w-full"
          />
        </div>
      </div>
    </div>

    <div class="mb-6">
      <h3 class="text-xs text-content-text-muted mb-2 px-1">提示词配置</h3>
      <div class="border border-content-border rounded-xl bg-content-card overflow-hidden p-4 flex flex-col gap-4">
        <div>
          <label class="block text-[14px] text-content-text mb-2">合同类型判定提示词</label>
          <Textarea
            :modelValue="promptTemplateSettings.defaultTemplates.contractTypeClassification"
            @update:modelValue="val => updatePromptTemplate('contractTypeClassification', val as string)"
            rows="4"
            autoResize
            class="w-full text-sm rounded-lg"
            placeholder="请输入用于合同类型判定的提示词模板..."
          />
        </div>
        <div>
          <label class="block text-[14px] text-content-text mb-2">合同字段提取提示词</label>
          <Textarea
            :modelValue="promptTemplateSettings.defaultTemplates.contractFieldExtraction"
            @update:modelValue="val => updatePromptTemplate('contractFieldExtraction', val as string)"
            rows="5"
            autoResize
            class="w-full text-sm rounded-lg"
            placeholder="请输入用于合同字段提取的提示词模板..."
          />
        </div>
        <div>
          <label class="block text-[14px] text-content-text mb-2">收款计划提取提示词</label>
          <Textarea
            :modelValue="promptTemplateSettings.defaultTemplates.receiptPlanExtraction"
            @update:modelValue="val => updatePromptTemplate('receiptPlanExtraction', val as string)"
            rows="4"
            autoResize
            class="w-full text-sm rounded-lg"
            placeholder="请输入用于收款计划提取的提示词模板..."
          />
        </div>
        <div>
          <label class="block text-[14px] text-content-text mb-2">按合同类型覆盖模板（JSON）</label>
          <Textarea
            v-model="promptOverridesDraft"
            rows="8"
            autoResize
            class="w-full text-sm rounded-lg font-mono"
            placeholder='例如：{"软件开发合同":{"contractFieldExtraction":"..."}}'
            @blur="applyPromptOverridesDraft"
          />
          <small v-if="promptOverridesError" class="text-red-500 mt-1 block">{{ promptOverridesError }}</small>
        </div>
        <div class="text-xs text-content-text-muted">
          占位符：`&#123;&#123;contractType&#125;&#125;`、`&#123;&#123;contractTypeCandidates&#125;&#125;`、`&#123;&#123;fieldList&#125;&#125;`
        </div>
      </div>
    </div>

    <div class="mb-6">
      <h3 class="text-xs text-content-text-muted mb-2 px-1">连接测试</h3>
      <div class="border border-content-border rounded-xl bg-content-card overflow-hidden p-4 flex flex-col gap-3">
        <div class="flex gap-2">
          <Button label="测试当前配置" :loading="isTesting" @click="handleTestConnection" />
          <Button v-if="settings.mode === 'local'" label="校验当前模型路径" severity="secondary" outlined :loading="isValidating" @click="handleValidateLocalModel" />
        </div>
        <div v-if="testResult" class="text-sm p-3 rounded border whitespace-pre-wrap break-all" :class="testSuccess ? 'border-green-500/30 bg-green-500/10 text-green-500' : 'border-red-500/30 bg-red-500/10 text-red-500'">
          {{ testResult }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { AIExecutionMode, AILocalModelConfig, AIProvider, AISettings, AIPromptTaskType } from '../../../shared/types/ai.types'
import { getDefaultBaseUrl, normalizeAISettings, normalizeLocalModel, normalizePromptTemplateConfig } from '../../../shared/utils/ai'
import type { AIAgentSettings, AIAgentToolName } from '../../../shared/types/aiAgent.types'
import Checkbox from 'primevue/checkbox'
import Select from 'primevue/select'
import InputText from 'primevue/inputtext'
import Textarea from 'primevue/textarea'
import Button from 'primevue/button'
import InputNumber from 'primevue/inputnumber'

const props = defineProps<{ settings: AISettings }>()
const emit = defineEmits<{ (e: 'update:settings', value: AISettings): void }>()

const modeOptions = [
  { label: '云端调用', value: 'cloud' },
  { label: '本地 llama.cpp', value: 'local' }
]

const aiProviders = [
  { label: 'Kimi (Moonshot)', value: 'kimi' },
  { label: 'MiniMax', value: 'minimax' },
  { label: 'DeepSeek', value: 'deepseek' }
]

const modelTypeOptions = [
  { label: 'NuExtract 7B', value: 'nuextract-7b' },
  { label: 'Qwen 2.5 8B Instruct', value: 'qwen2.5-8b-instruct' },
  { label: 'Qwen 2.5 32B Instruct', value: 'qwen2.5-32b-instruct' },
  { label: '自定义模型', value: 'custom' }
]

const localFieldGroupModeOptions = [
  { label: '分组抽取（防截断）', value: 'grouped' },
  { label: '单次抽取', value: 'single-pass' },
]

const agentToolOptions: Array<{ label: string; value: AIAgentToolName; description: string }> = [
  { label: '合同信息查询', value: 'contract_search', description: '按合同名称、编号、甲方、乙方等主数据检索合同。' },
  { label: '全库文件检索', value: 'contract_full_text_search', description: '按文件正文内容搜索当前资源库内已索引的合同文件和其他文件。' },
  { label: '合同详情摘要', value: 'contract_detail_summary', description: '读取合同核心字段并生成简明摘要。' },
  { label: '合同统计报表', value: 'contract_statistics', description: '识别统计缺口、等待确认后执行受控统计，并生成应用内独立报表。' },
  { label: '产品信息查询', value: 'product_search', description: '按产品编码检索产品，或按已过保/未过保筛选产品列表。' },
  { label: '员工信息查询', value: 'personnel_search', description: '按姓名、手机号、身份证号或部门名称检索员工信息。' },
  { label: '甲方单位查询', value: 'customer_search', description: '按单位名称、编码、联系人、电话、税号等检索甲方单位。' },
  { label: '乙方单位查询', value: 'supplier_search', description: '按单位名称、编码、联系人、电话、税号、法人信息等检索乙方单位。' },
  { label: '发票信息查询', value: 'invoice_search', description: '按发票号码、代码、销方、购方、合同编号或合同名称检索合同发票。' },
]

const isTesting = ref(false)
const isValidating = ref(false)
const testResult = ref('')
const testSuccess = ref(false)
const promptOverridesDraft = ref('')
const promptOverridesError = ref('')

const normalizedSettings = computed(() => normalizeAISettings(props.settings))
const promptTemplateSettings = computed(() => normalizePromptTemplateConfig(normalizedSettings.value.promptTemplates))
const selectedLocalModel = computed(() => (
  normalizedSettings.value.localModels.find(item => item.id === normalizedSettings.value.selectedModelId)
  || normalizedSettings.value.localModels[0]
))
const modelOptions = computed(() => {
  const displayNameTotals = normalizedSettings.value.localModels.reduce((map, item) => {
    const displayName = item.displayName || '未命名模型'
    map.set(displayName, (map.get(displayName) || 0) + 1)
    return map
  }, new Map<string, number>())
  const displayNameCounter = new Map<string, number>()

  return normalizedSettings.value.localModels.map(item => {
    const displayName = item.displayName || '未命名模型'
    const count = (displayNameCounter.get(displayName) || 0) + 1
    displayNameCounter.set(displayName, count)

    return {
      label: (displayNameTotals.get(displayName) || 0) > 1 ? `${displayName}（配置 ${count}）` : displayName,
      value: item.id
    }
  })
})

function emitSettings(value: AISettings) {
  emit('update:settings', normalizeAISettings(value))
}

function updateField<K extends keyof AISettings>(key: K, value: AISettings[K]) {
  emitSettings({ ...normalizedSettings.value, [key]: value })
}

function updateAgentField<K extends keyof AIAgentSettings>(key: K, value: AIAgentSettings[K]) {
  emitSettings({
    ...normalizedSettings.value,
    agentSettings: {
      ...normalizedSettings.value.agentSettings,
      [key]: value,
    },
  })
}

function toggleAgentTool(toolName: AIAgentToolName) {
  const currentTools = normalizedSettings.value.agentSettings.availableTools
  const exists = currentTools.includes(toolName)
  const nextTools = exists
    ? currentTools.filter(item => item !== toolName)
    : [...currentTools, toolName]
  updateAgentField('availableTools', nextTools)
}

function updateMode(mode: AIExecutionMode) {
  const next = normalizeAISettings({
    ...normalizedSettings.value,
    mode,
  })
  emitSettings(next)
}

function updatePromptTemplate(task: AIPromptTaskType, value: string) {
  const nextTemplates = normalizePromptTemplateConfig(normalizedSettings.value.promptTemplates)
  nextTemplates.defaultTemplates[task] = String(value || '').trim()
  nextTemplates.updatedAt = new Date().toISOString()
  emitSettings({
    ...normalizedSettings.value,
    contractPrompt: task === 'contractFieldExtraction'
      ? nextTemplates.defaultTemplates.contractFieldExtraction
      : normalizedSettings.value.contractPrompt,
    promptTemplates: nextTemplates,
  })
}

function applyPromptOverridesDraft() {
  const draft = String(promptOverridesDraft.value || '').trim()
  if (!draft) {
    promptOverridesError.value = ''
    emitSettings({
      ...normalizedSettings.value,
      promptTemplates: {
        ...promptTemplateSettings.value,
        updatedAt: new Date().toISOString(),
        contractTypeOverrides: {},
      },
    })
    return
  }
  try {
    const parsed = JSON.parse(draft)
    const nextTemplates = normalizePromptTemplateConfig({
      ...promptTemplateSettings.value,
      contractTypeOverrides: parsed,
      updatedAt: new Date().toISOString(),
    })
    promptOverridesError.value = ''
    emitSettings({
      ...normalizedSettings.value,
      promptTemplates: nextTemplates,
    })
  } catch (error) {
    promptOverridesError.value = `JSON 解析失败：${error instanceof Error ? error.message : String(error)}`
  }
}

function updateProvider(provider: AIProvider) {
  const currentBaseUrl = normalizedSettings.value.baseUrl.trim()
  const previousDefault = getDefaultBaseUrl(normalizedSettings.value.provider)
  const nextDefault = getDefaultBaseUrl(provider)

  emitSettings({
    ...normalizedSettings.value,
    provider,
    baseUrl: !currentBaseUrl || currentBaseUrl === previousDefault ? nextDefault : currentBaseUrl,
  })
}

function updateLocalModelField<K extends keyof AILocalModelConfig>(id: string, key: K, value: AILocalModelConfig[K]) {
  const localModels = normalizedSettings.value.localModels.map(item => (
    item.id === id
      ? normalizeLocalModel({ ...item, [key]: value })
      : item
  ))

  emitSettings({
    ...normalizedSettings.value,
    localModels,
  })
}

function addLocalModel() {
  const index = normalizedSettings.value.localModels.length + 1
  const newModel = normalizeLocalModel({
    id: `local-model-${Date.now()}`,
    displayName: `本地模型 ${index}`,
    modelType: 'custom',
  }, index)

  emitSettings({
    ...normalizedSettings.value,
    selectedModelId: newModel.id,
    localModels: [...normalizedSettings.value.localModels, newModel],
  })
}

function removeLocalModel(id: string) {
  const localModels = normalizedSettings.value.localModels.filter(item => item.id !== id)
  emitSettings({
    ...normalizedSettings.value,
    selectedModelId: normalizedSettings.value.selectedModelId === id ? localModels[0]?.id || '' : normalizedSettings.value.selectedModelId,
    localModels,
  })
}

watch(
  () => promptTemplateSettings.value.contractTypeOverrides,
  (overrides) => {
    promptOverridesDraft.value = JSON.stringify(overrides || {}, null, 2)
  },
  { immediate: true, deep: true },
)

async function browseLocalPath(id: string, field: 'modelPath' | 'executablePath') {
  const filters = field === 'modelPath'
    ? [{ name: 'GGUF Model', extensions: ['gguf'] }]
    : [{ name: 'Executable', extensions: ['exe', 'bin'] }]

  const result = await window.electronAPI.fs.selectFile({
    properties: ['openFile'],
    filters,
  })

  if (!result.success || !result.data || (result.data as any).canceled) {
    return
  }

  const selectedPath = String((result.data as any).filePaths?.[0] || '')
  if (!selectedPath) {
    return
  }

  updateLocalModelField(id, field, selectedPath as AILocalModelConfig[typeof field])
}

async function browseEmbeddingPath(field: 'embeddingModelPath' | 'embeddingExecutablePath') {
  const filters = field === 'embeddingModelPath'
    ? [{ name: 'Model File', extensions: ['gguf', 'bin'] }]
    : [{ name: 'Executable', extensions: ['exe', 'bin'] }]
  const result = await window.electronAPI.fs.selectFile({
    properties: ['openFile'],
    filters,
  })
  if (!result.success || !result.data || (result.data as any).canceled) return
  const selectedPath = String((result.data as any).filePaths?.[0] || '')
  if (!selectedPath) return
  updateField(field, selectedPath as AISettings[typeof field])
}

async function handleValidateLocalModel() {
  const currentModel = normalizedSettings.value.localModels.find(item => item.id === normalizedSettings.value.selectedModelId)
  if (!currentModel) {
    testSuccess.value = false
    testResult.value = '未找到当前本地模型配置'
    return
  }

  isValidating.value = true
  try {
    const result = await window.electronAPI.ai.validateLocalModel({ localModel: currentModel })
    testSuccess.value = Boolean(result.success && result.data?.valid)
    testResult.value = result.success
      ? (result.data?.valid ? '模型路径与执行器路径校验通过' : result.data?.errors.join('；'))
      : (result.error || '校验失败')
  } finally {
    isValidating.value = false
  }
}

async function handleTestConnection() {
  isTesting.value = true
  testResult.value = '正在测试...'
  testSuccess.value = true

  try {
    const result = await window.electronAPI.ai.testConnection(
      normalizedSettings.value.mode === 'cloud'
        ? {
            mode: 'cloud',
            provider: normalizedSettings.value.provider,
            apiKey: normalizedSettings.value.apiKey,
            baseUrl: normalizedSettings.value.baseUrl,
            timeoutMs: normalizedSettings.value.timeoutMs,
          }
        : {
            mode: 'local',
            timeoutMs: normalizedSettings.value.timeoutMs,
            localModel: normalizedSettings.value.localModels.find(item => item.id === normalizedSettings.value.selectedModelId),
          }
    )

    if (result.success && result.data?.success) {
      testSuccess.value = true
      testResult.value = result.data.message || '测试成功'
    } else {
      testSuccess.value = false
      testResult.value = result.data?.message || result.error || '测试失败'
    }
  } catch (error) {
    testSuccess.value = false
    testResult.value = error instanceof Error ? error.message : String(error)
  } finally {
    isTesting.value = false
  }
}
</script>
