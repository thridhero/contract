<template>
  <div class="flex flex-col items-center justify-center p-8 bg-[var(--content-bg)] rounded-xl border border-[var(--content-border)] shadow-sm min-w-[320px]">
    <i :class="getFileIcon(ext)" class="text-6xl mb-4"></i>
    <h3 class="text-lg font-bold text-[var(--content-text)] mb-2 text-center break-all">{{ displayName }}</h3>
    <p class="text-sm text-[var(--content-text-secondary)] mb-6">暂不支持预览该格式，请复制或在外部打开</p>
    <div class="flex gap-3">
      <Button label="复制" icon="pi pi-copy" @click="emit('copy')" class="p-button-outlined" />
      <Button label="外部打开" icon="pi pi-external-link" @click="emit('openExternal')" />
    </div>
  </div>
</template>

<script setup lang="ts">
import Button from 'primevue/button'

const props = defineProps<{
  ext: string
  displayName: string
}>()

const emit = defineEmits<{
  (e: 'copy'): void
  (e: 'openExternal'): void
}>()

const getFileIcon = (e: string) => {
  if (['doc', 'docx'].includes(e)) return 'pi pi-file-word text-blue-600'
  if (['xls', 'xlsx'].includes(e)) return 'pi pi-file-excel text-green-600'
  if (['ppt', 'pptx'].includes(e)) return 'pi pi-file-powerpoint text-orange-600'
  if (['zip', 'rar', '7z', 'tar'].includes(e)) return 'pi pi-file-zip text-yellow-600'
  if (['txt', 'md', 'json'].includes(e)) return 'pi pi-file text-gray-600'
  if (['pdf'].includes(e)) return 'pi pi-file-pdf text-red-600'
  return 'pi pi-file text-gray-400'
}
</script>
