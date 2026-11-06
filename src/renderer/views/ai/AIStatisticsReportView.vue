<template>
  <div class="h-full bg-content-bg text-content-text flex flex-col">
    <div class="shrink-0 px-6 py-6">
      <div class="flex items-center justify-between gap-3">
        <div>
          <div class="text-xs uppercase tracking-[0.18em] text-content-text-muted">AI 统计报表</div>
          <h1 class="mt-2 text-2xl font-semibold">{{ reportTitle }}</h1>
          <div class="mt-2 text-sm text-content-text-muted">{{ reportSubtitle }}</div>
        </div>
        <Button label="返回工作台" icon="pi pi-arrow-left" severity="secondary" outlined @click="router.push({ name: 'AIWorkbench' })" />
      </div>

      <div v-if="errorMessage" class="mt-4 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-4 text-sm text-red-500">
        {{ errorMessage }}
      </div>
    </div>

    <div v-if="!errorMessage" class="flex-1 min-h-0 px-6 pb-6">
      <div class="h-full rounded-2xl border border-content-border bg-content-card p-4 flex flex-col min-h-0">
        <div class="mb-4 text-sm text-content-text-muted">
          该页面仅展示已确认并执行过的受控统计结果，HTML 内容由应用模板生成并经过安全清洗。
        </div>
        <iframe
          v-if="sanitizedReportSrcdoc"
          class="ai-report-frame"
          :srcdoc="sanitizedReportSrcdoc"
          sandbox=""
          referrerpolicy="no-referrer"
          title="AI统计报表"
        ></iframe>
        <div v-else class="rounded-xl border border-content-border bg-content-bg px-4 py-6 text-sm text-content-text-muted">
          当前报表内容为空，请返回工作台重新生成。
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import DOMPurify from 'dompurify'
import Button from 'primevue/button'
import type { AIAgentContractStatisticsToolData, AIAgentToolCallRecord } from '../../../shared/types/aiAgent.types'

const route = useRoute()
const router = useRouter()

const errorMessage = ref('')
const htmlContent = ref('')
const reportTitle = ref('统计报表')
const reportSubtitle = ref('')

const sanitizedReportSrcdoc = computed(() => DOMPurify.sanitize(htmlContent.value, {
  WHOLE_DOCUMENT: true,
  USE_PROFILES: {
    html: true,
    svg: true,
  },
  ADD_TAGS: ['style'],
}))

async function loadReport() {
  errorMessage.value = ''
  const sessionId = String(route.params.sessionId || '').trim()
  const toolCallId = String(route.params.toolCallId || '').trim()
  if (!sessionId || !toolCallId) {
    errorMessage.value = '缺少报表定位参数，暂时无法打开。'
    return
  }

  const response = await window.electronAPI.aiAgent.getSession({ sessionId })
  if (!response.success || !response.data) {
    errorMessage.value = response.error || '读取会话失败，暂时无法恢复报表。'
    return
  }

  let matchedTool: AIAgentToolCallRecord | null = null
  for (const message of response.data.messages || []) {
    const tool = (message.toolCalls || []).find(item => item.id === toolCallId)
    if (tool) {
      matchedTool = tool
      break
    }
  }

  if (!matchedTool || matchedTool.toolName !== 'contract_statistics' || !matchedTool.rawData || typeof matchedTool.rawData !== 'object') {
    errorMessage.value = '对应统计结果已失效或不存在，请返回工作台重新生成。'
    return
  }

  const rawData = matchedTool.rawData as Partial<AIAgentContractStatisticsToolData>
  if (rawData.kind !== 'contract_statistics' || rawData.status !== 'executed' || !rawData.execution?.outcome?.ok || !rawData.execution.outcome.data?.report) {
    errorMessage.value = '当前统计结果尚未执行完成，暂时无法生成正式报表。'
    return
  }

  reportTitle.value = rawData.execution.outcome.data.report.title || '统计报表'
  reportSubtitle.value = rawData.execution.outcome.data.report.subtitle || ''
  htmlContent.value = rawData.execution.outcome.data.report.html || ''
}

onMounted(() => {
  void loadReport()
})
</script>

<style scoped>
.ai-report-frame {
  width: 100%;
  flex: 1;
  min-height: 0;
  border: 0;
  border-radius: 16px;
  background: #fff;
}
</style>
