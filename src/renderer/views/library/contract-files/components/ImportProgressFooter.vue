<template>
  <Transition name="slide-up">
    <div
      v-if="visible"
      class="shrink-0 border-t border-[var(--content-border)] bg-[var(--content-bg)]/90 backdrop-blur-md px-6 py-3"
      style="-webkit-app-region: no-drag;"
    >
      <div class="flex items-center gap-4">
        <div class="flex items-center gap-2 min-w-[170px]">
          <i v-if="isWorking" class="pi pi-sync text-[var(--content-text-secondary)] animate-spin"></i>
          <i v-else-if="isOk" class="pi pi-check-circle text-[var(--green-500)]"></i>
          <i v-else-if="progress?.stage === 'cancelled'" class="pi pi-ban text-[var(--content-text-secondary)]"></i>
          <i v-else class="pi pi-times-circle text-[var(--red-500)]"></i>
          <span class="text-sm font-medium text-[var(--content-text)]">{{ title }}</span>
          <button
            v-if="canDismiss"
            class="ml-auto p-1 rounded hover:bg-[var(--sidebar-hover-bg)] text-[var(--content-text-secondary)]"
            @click="dismiss"
            title="关闭"
          >
            <i class="pi pi-times"></i>
          </button>
        </div>

        <div class="flex-1 min-w-0">
          <div class="h-2 rounded-full bg-[var(--content-border)] overflow-hidden">
            <div class="h-full bg-[var(--btn-primary-bg)] transition-[width] duration-150" :style="{ width: percentBar + '%' }"></div>
          </div>
          <div class="mt-2 flex items-center justify-between gap-3 text-xs text-[var(--content-text-secondary)]">
            <div class="flex items-center gap-3 whitespace-nowrap tabular-nums">
              <span>阶段 {{ stageText }}</span>
              <span v-if="fractionText">{{ fractionText }}</span>
              <span v-if="speedText" class="text-[var(--blue-500)]">{{ speedText }}</span>
              <button
                v-if="errorCount > 0"
                class="text-[var(--red-500)] hover:underline cursor-pointer bg-transparent border-none p-0 text-xs"
                @click="showErrorList = true"
              >
                错误 {{ errorCount }}
              </button>
            </div>
            <div class="flex items-center gap-2 min-w-0">
              <span class="tabular-nums">{{ percentText }}</span>
              <span v-if="progress?.currentFile" class="truncate" :title="progress.currentFile">{{ progress.currentFile }}</span>
            </div>
          </div>
        </div>

        <div class="flex items-center gap-2">
          <button
            v-if="isWorking && progress?.taskId"
            class="px-3 py-1.5 rounded-lg border border-[var(--content-border)] text-xs text-[var(--content-text)] hover:bg-[var(--sidebar-hover-bg)]"
            @click="cancel"
          >
            取消
          </button>
        </div>
      </div>
    </div>
  </Transition>

  <Dialog
    v-model:visible="showErrorList"
    modal
    header="导入错误详情"
    :style="{ width: '800px' }"
    :contentStyle="{ padding: '0' }"
  >
    <div v-if="progress?.errors?.length" class="h-[40vh]">
      <DataTable
        :value="progress.errors"
        scrollable
        scrollHeight="flex"
        stripedRows
        class="h-full text-sm compact-errors"
        dataKey="filePath"
        :virtualScrollerOptions="{ itemSize: 40 }"
      >
        <Column header="状态" :style="{ width: '80px', flex: '0 0 80px' }" class="text-center" headerClass="text-center">
          <template #body="{ data }">
            <div class="flex justify-center">
              <span v-tooltip.top="data.stage === 'copying' ? '正在拷贝文件' : '正在转换格式'" class="px-2 py-0.5 rounded text-[10px] font-medium cursor-default" :class="data.stage === 'copying' ? 'bg-blue-50 text-blue-600 border border-blue-100' : 'bg-orange-50 text-orange-600 border border-orange-100'">
                {{ data.stage === 'copying' ? '拷贝' : '转换' }}
              </span>
            </div>
          </template>
        </Column>
        <Column header="文件路径" field="filePath" :style="{ width: '240px', flex: '0 0 240px' }">
          <template #body="{ data }">
            <div v-tooltip.top="data.filePath" class="truncate font-mono text-[11px] text-[var(--content-text-secondary)] cursor-default" style="max-width: 340px;">
              {{ data.filePath }}
            </div>
          </template>
        </Column>
        <Column header="错误原因" field="message" :style="{ width: '240px', flex: '0 0 240px' }">
          <template #body="{ data }">
            <div v-tooltip.top="data.message" class="truncate cursor-default text-[var(--red-500)] text-[11px]" style="max-width: 340px;">
              {{ data.message }}
            </div>
          </template>
        </Column>
      </DataTable>
    </div>
    <div v-else class="text-center py-12 text-[var(--content-text-secondary)]">
      暂无错误详情
    </div>
    <template #footer>
      <div class="flex items-center justify-between w-full px-4 py-2 border-t border-[var(--content-border)]">
        <span class="text-xs text-[var(--content-text-secondary)]">共 {{ errorCount }} 条错误记录</span>
        <button
          class="px-6 py-2 rounded-lg bg-[var(--btn-primary-bg)] text-white text-sm font-medium hover:opacity-90 transition-opacity"
          @click="showErrorList = false"
        >
          确定
        </button>
      </div>
    </template>
  </Dialog>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import Dialog from 'primevue/dialog'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import { useImportTaskStore } from '../../../../stores/system/importTaskStore'

const props = defineProps<{
  contextKey: string
}>()

const store = useImportTaskStore()
const dismissed = ref(false)
const showErrorList = ref(false)

onMounted(() => {
  store.ensureSubscribed()
  store.syncStatus(props.contextKey)
})

watch(
  () => props.contextKey,
  (key) => {
    dismissed.value = false
    store.syncStatus(key)
  }
)

const progressRef = store.getProgress(props.contextKey)
const visibleRef = store.isVisible(props.contextKey)

const progress = computed(() => progressRef.value)
const visible = computed(() => visibleRef.value && !dismissed.value && Boolean(progress.value))

const percentBar = computed(() => {
  const n = Number(progress.value?.percent || 0)
  return Math.min(100, Math.max(0, n))
})

const percentText = computed(() => `${percentBar.value.toFixed(0)}%`)

const isWorking = computed(() => progress.value?.stage === 'copying' || progress.value?.stage === 'converting' || progress.value?.stage === 'indexing')
const isOk = computed(() => progress.value?.stage === 'completed')
const canDismiss = computed(() => !isWorking.value)

const stageText = computed(() => {
  const s = progress.value?.stage
  if (s === 'copying') return '拷贝'
  if (s === 'converting') return '转换'
  if (s === 'indexing') return '索引'
  if (s === 'completed') return '完成'
  if (s === 'completed-with-errors') return '已完成（有错误）'
  if (s === 'cancelled') return '已取消'
  if (s === 'failed') return '失败'
  return ''
})

const fractionText = computed(() => {
  const total = Number(progress.value?.totalFiles || 0)
  const done = Number(progress.value?.completedFiles || 0)
  return total > 0 ? `${Math.min(done, total)}/${total}` : ''
})

const errorCount = computed(() => (Array.isArray(progress.value?.errors) ? progress.value?.errors.length : 0))

const speedText = computed(() => {
  if (!isWorking.value) return ''
  return progress.value?.speed || ''
})

const title = computed(() => {
  const s = progress.value?.stage
  if (s === 'copying') return '导入中（拷贝）'
  if (s === 'converting') return '导入中（转换）'
  if (s === 'indexing') return '导入中（索引）'
  if (s === 'completed') return '导入完成'
  if (s === 'completed-with-errors') return '导入完成（有错误）'
  if (s === 'cancelled') return '导入已取消'
  if (s === 'failed') return '导入失败'
  return ''
})

const cancel = async () => {
  if (!progress.value?.taskId) return
  await store.cancelImport(progress.value.taskId)
}

const dismiss = () => {
  dismissed.value = true
}
</script>

<style scoped>
.slide-up-enter-active,
.slide-up-leave-active {
  transition: transform 0.18s ease, opacity 0.18s ease;
}
.slide-up-enter-from,
.slide-up-leave-to {
  transform: translateY(8px);
  opacity: 0;
}

:deep(.compact-errors .p-datatable-tbody > tr > td) {
  padding: 0.5rem 0.75rem !important;
}

:deep(.compact-errors .p-datatable-thead > tr > th) {
  padding: 0.5rem 0.75rem !important;
  font-size: 11px;
  background: var(--sidebar-hover-bg);
}
</style>
