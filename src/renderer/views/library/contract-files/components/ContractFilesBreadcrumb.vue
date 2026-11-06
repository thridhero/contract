<template>
  <div
    v-if="items.length > 0"
    class="flex items-center gap-2 px-4 py-2 rounded-lg border border-[var(--content-border)] bg-[var(--content-bg)]/70 backdrop-blur-md"
    style="-webkit-app-region: no-drag;"
  >
    <button
      class="p-2 rounded-lg transition-colors hover:bg-[var(--sidebar-hover-bg)] text-[var(--content-text-secondary)] disabled:opacity-40 disabled:hover:bg-transparent"
      :disabled="!canGoUp"
      title="上一级目录"
      @click="emit('go-up')"
    >
      <i class="pi pi-arrow-left"></i>
    </button>

    <div class="flex items-center gap-1 min-w-0 overflow-x-auto whitespace-nowrap scrollbar-none">
      <template v-for="(it, idx) in items" :key="it.path">
        <button
          class="max-w-[240px] truncate px-2 py-1 rounded-md transition-colors hover:bg-[var(--sidebar-hover-bg)] text-sm text-[var(--content-text)]"
          :title="it.path"
          @click="emit('navigate', it.path)"
        >
          {{ it.label }}
        </button>
        <i v-if="idx !== items.length - 1" class="pi pi-angle-right text-xs text-[var(--content-text-secondary)]"></i>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  items: Array<{ label: string; path: string }>
  canGoUp: boolean
}>()

const emit = defineEmits<{
  (e: 'go-up'): void
  (e: 'navigate', path: string): void
}>()
</script>

