<template>
  <Transition name="slide-up">
    <div
      v-if="visible && status !== 'idle'"
      class="shrink-0 border-t border-[var(--content-border)] bg-[var(--content-bg)]/90 backdrop-blur-md px-6 py-3"
      style="-webkit-app-region: no-drag;"
    >
      <div class="flex items-center gap-4">
        <div class="flex items-center gap-2 min-w-[170px]">
          <i v-if="status === 'deleting'" class="pi pi-trash text-[var(--content-text-secondary)]"></i>
          <i v-else class="pi pi-check-circle text-[var(--green-500)]"></i>
          <span class="text-sm font-medium text-[var(--content-text)]">{{ title }}</span>
          <button
            v-if="status === 'completed'"
            class="ml-auto p-1 rounded hover:bg-[var(--sidebar-hover-bg)] text-[var(--content-text-secondary)]"
            @click="emit('dismiss')"
            title="关闭"
          >
            <i class="pi pi-times"></i>
          </button>
        </div>

        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-3">
            <div class="flex-1 h-2 rounded-full bg-[var(--content-border)] overflow-hidden">
              <div class="h-full bg-[var(--btn-primary-bg)] transition-[width] duration-150" :style="{ width: percent + '%' }"></div>
            </div>
            <button
              v-if="status === 'deleting' && !isCancelled"
              class="shrink-0 px-2 py-0.5 rounded text-[10px] bg-[var(--content-border)] hover:bg-[var(--sidebar-hover-bg)] text-[var(--content-text-secondary)] border border-[var(--content-border)] transition-colors"
              @click="emit('cancel')"
              title="取消后续移入回收站"
            >
              取消
            </button>
            <span
              v-else-if="status === 'deleting' && isCancelled"
              class="shrink-0 text-[10px] text-[var(--content-text-secondary)] italic"
            >
              正在取消...
            </span>
          </div>
          <div class="mt-2 flex items-center justify-between gap-3 text-xs text-[var(--content-text-secondary)]">
            <div class="flex items-center gap-3 whitespace-nowrap tabular-nums">
              <span v-if="fractionText">{{ fractionText }}</span>
              <span v-if="status === 'completed' && failCount > 0">失败 {{ failCount }}</span>
            </div>
            <div class="flex items-center gap-2 min-w-0">
              <span v-if="percentText" class="tabular-nums">{{ percentText }}</span>
              <span v-if="currentName" class="truncate" :title="currentName">{{ currentName }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
defineProps<{
  visible: boolean
  status: 'idle' | 'deleting' | 'completed'
  title: string
  percent: number
  fractionText: string
  percentText: string
  currentName: string
  failCount: number
  isCancelled?: boolean
}>()

const emit = defineEmits<{
  (e: 'dismiss'): void
  (e: 'cancel'): void
}>()
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
