<template>
  <div class="h-full w-full flex flex-col">
    <div
      v-if="hasMeta"
      class="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[var(--content-text-secondary)]"
    >
      <div v-if="encoding" class="flex items-center gap-1">
        <span>编码</span>
        <span class="tabular-nums">{{ encoding }}</span>
      </div>
      <div v-if="truncated" class="flex items-center gap-2">
        <span class="text-amber-600">内容已截断</span>
        <span v-if="bytesRead != null && fileSize != null" class="tabular-nums">
          {{ bytesRead }} / {{ fileSize }} bytes
        </span>
      </div>
      <button
        v-if="filePath"
        type="button"
        class="ml-auto text-xs text-[var(--btn-primary-bg)] hover:opacity-80 transition-opacity"
        @click="openExternal"
      >
        外部打开
      </button>
    </div>

    <pre class="text-sm leading-relaxed whitespace-pre-wrap break-words font-mono text-[var(--content-text)]">
{{ text }}
    </pre>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  filePath?: string
  text: string
  encoding?: string
  truncated?: boolean
  bytesRead?: number
  fileSize?: number
}>()

const hasMeta = computed(() => !!props.encoding || !!props.truncated)

const openExternal = async () => {
  const p = String(props.filePath || '').trim()
  if (!p) return
  await window.electronAPI.fs.openFile(p)
}
</script>
