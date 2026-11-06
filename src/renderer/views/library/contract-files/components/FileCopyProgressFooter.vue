<template>
  <Transition name="slide-up">
    <div
      v-if="visible && status !== 'idle'"
      class="shrink-0 border-t border-[var(--content-border)] bg-[var(--content-bg)]/90 backdrop-blur-md px-6 py-3"
      style="-webkit-app-region: no-drag;"
    >
      <div class="flex items-center gap-4">
        <div class="flex items-center gap-2 min-w-[170px]">
          <i v-if="status === 'copying'" class="pi pi-copy text-[var(--content-text-secondary)]"></i>
          <i v-else-if="status === 'completed'" class="pi pi-check-circle text-[var(--green-500)]"></i>
          <i v-else-if="status === 'cancelled'" class="pi pi-ban text-[var(--content-text-secondary)]"></i>
          <i v-else class="pi pi-times-circle text-[var(--red-500)]"></i>
          <span class="text-sm font-medium text-[var(--content-text)]">{{ title }}</span>
          <button
            v-if="isFinished"
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
              <span>total {{ total }}</span>
              <span>done {{ done }}</span>
              <span>remaining {{ remaining }}</span>
              <span v-if="fractionText">{{ fractionText }}</span>
            </div>
            <div class="flex items-center gap-2 min-w-0">
              <span class="tabular-nums">{{ percentText }}</span>
              <span v-if="currentFile" class="truncate" :title="currentFile">{{ currentFile }}</span>
            </div>
          </div>
          <div v-if="error" class="mt-1 text-xs text-[var(--red-500)] truncate" :title="error">{{ error }}</div>
        </div>

        <div class="flex items-center gap-2">
          <button
            v-if="status === 'copying' && taskId"
            class="px-3 py-1.5 rounded-lg border border-[var(--content-border)] text-xs text-[var(--content-text)] hover:bg-[var(--sidebar-hover-bg)]"
            @click="cancelCopy"
          >
            取消
          </button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useFileCopyTaskStore } from '../../../../stores/file/fileCopyTaskStore'

const store = useFileCopyTaskStore()

onMounted(() => {
  store.ensureSubscribed()
})

const visible = computed(() => store.visible)
const status = computed(() => store.status)
const taskId = computed(() => store.taskId)
const total = computed(() => store.total)
const done = computed(() => store.done)
const remaining = computed(() => store.remaining)
const currentFile = computed(() => store.currentFile)
const percentText = computed(() => store.percentText)
const fractionText = computed(() => store.fractionText)
const isFinished = computed(() => store.isFinished)
const error = computed(() => store.error)

const percentBar = computed(() => {
  const n = Number(store.percent || 0)
  return Math.min(100, Math.max(0, n))
})

const title = computed(() => {
  if (status.value === 'copying') return '拷贝中'
  if (status.value === 'completed') return '拷贝完成'
  if (status.value === 'cancelled') return '已取消'
  if (status.value === 'failed') return '拷贝失败'
  return ''
})

const dismiss = () => store.dismiss()

const cancelCopy = async () => {
  await store.cancelCopy()
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
</style>

