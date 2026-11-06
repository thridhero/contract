<template>
  <div class="shrink-0 border-t border-[var(--content-border)] bg-[var(--content-bg)]/90 backdrop-blur-md px-6 py-2" style="-webkit-app-region: no-drag;">
    <div class="flex items-center justify-between gap-3 text-xs">
      <div class="flex-1 min-w-0 truncate text-[var(--content-text-secondary)]" :title="statusPath">
        {{ statusPath || '-' }}
      </div>
      <div class="flex items-center gap-3 shrink-0 whitespace-nowrap text-[var(--content-text-secondary)]">
        <span>文件夹 {{ folderCount }} | 文件 {{ fileCount }} | 共 {{ visibleEntryCount }} 项</span>
        <span v-if="selectedCount > 1" class="text-[var(--content-text)]">已选中 {{ selectedCount }} 项</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  statusPath: string
  folderCount: number
  fileCount: number
  visibleEntryCount: number
  selectedCount: number
}>()
</script>

