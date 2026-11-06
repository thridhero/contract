<template>
  <div class="flex h-8 shrink-0 items-center justify-between border-t border-[var(--content-border)] bg-[var(--content-bg)] px-4 text-xs text-[var(--content-text-secondary)]">
    <div class="flex items-center gap-4">
      <span class="truncate max-w-md" :title="currentPath">当前路径: {{ currentPath || '未知路径' }}</span>
    </div>
    <div class="flex items-center gap-4">
      <span>共 {{ totalItems }} 个项目</span>
      <span v-if="contractCount > 0">合同 {{ contractCount }}</span>
      <span v-if="folderCount > 0">文件夹 {{ folderCount }}</span>
      <span v-if="fileCount > 0">文件 {{ fileCount }}</span>
      <span v-if="selectedCount > 0">已选中 {{ selectedCount }} 个项目</span>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  currentPath: string
  totalItems: number
  contractCount?: number
  folderCount?: number
  fileCount?: number
  selectedCount: number
}>()
</script>
