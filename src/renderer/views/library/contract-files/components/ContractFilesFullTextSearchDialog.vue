<template>
  <Dialog
    :visible="visible"
    modal
    header="全文搜索"
    class="w-[760px] max-w-[92vw]"
    @update:visible="(v) => emit('update:visible', v)"
  >
    <div class="flex items-center gap-2">
      <div class="flex-1">
        <InputText
          v-model="query"
          class="w-full !bg-[var(--input-bg)] !border-[var(--input-border)] !text-[var(--content-text)] placeholder:!text-[var(--content-text-secondary)] focus:!border-[var(--btn-primary-bg)]"
          placeholder="输入要搜索的内容（包含子目录）"
          @keydown.enter.prevent="runSearch"
        />
      </div>
      <Button
        icon="pi pi-search"
        label="搜索"
        class="p-button-sm"
        :disabled="loading || !query.trim() || !baseDir.trim()"
        @click="runSearch"
      />
    </div>

    <div class="mt-3 text-xs text-[var(--content-text-secondary)] break-all">
      当前范围：{{ baseDirDisplay }}
    </div>

    <div class="mt-4 min-h-40">
      <div v-if="loading" class="py-10 flex items-center justify-center">
        <ProgressSpinner style="width: 36px; height: 36px" strokeWidth="3" />
      </div>

      <div v-else-if="errorMessage" class="py-10 text-center text-sm text-[var(--content-text-secondary)]">
        {{ errorMessage }}
      </div>

      <div v-else-if="results.length === 0" class="py-10 text-center text-sm text-[var(--content-text-secondary)]">
        无匹配结果
      </div>

      <div v-else class="max-h-[52vh] overflow-auto pr-1">
        <button
          v-for="row in viewResults"
          :key="row.file_path"
          type="button"
          class="w-full text-left rounded-lg px-3 py-2 mb-2 border border-[var(--content-border)] hover:bg-[var(--sidebar-hover-bg)] transition-colors"
          @click="emit('open', { filePath: row.file_path })"
        >
          <div class="flex items-center justify-between gap-3">
            <div class="min-w-0">
              <div class="text-sm text-[var(--content-text)] truncate">
                {{ row.fileName }}
              </div>
              <div v-if="row.relativeDir" class="text-xs text-[var(--content-text-secondary)] truncate">
                {{ row.relativeDir }}
              </div>
            </div>
          </div>
          <div class="mt-1 text-xs text-[var(--content-text-secondary)] leading-5 break-words" v-html="row.snippetHtml"></div>
        </button>
      </div>
    </div>
  </Dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import Button from 'primevue/button'
import ProgressSpinner from 'primevue/progressspinner'
import { normalizePathForCompare } from '../contractFilesHelpers'

const props = defineProps<{
  visible: boolean
  baseDir: string
}>()

const emit = defineEmits<{
  (e: 'update:visible', v: boolean): void
  (e: 'open', payload: { filePath: string }): void
}>()

const query = ref('')
const loading = ref(false)
const errorMessage = ref('')
const results = ref<Array<{ file_path: string; snippet: string }>>([])

const baseDirDisplay = computed(() => String(props.baseDir || '').trim() || '-')

const escapeHtml = (input: string) => {
  return String(input || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

const toSafeSnippetHtml = (snippet: string) => {
  const escaped = escapeHtml(snippet)
  return escaped.replaceAll('&lt;b&gt;', '<mark>').replaceAll('&lt;/b&gt;', '</mark>')
}

const viewResults = computed(() => {
  const base = normalizePathForCompare(props.baseDir)
  const prefix = base ? `${base}/` : ''
  return (results.value || []).map((row) => {
    const filePath = String(row?.file_path || '')
    const normalized = normalizePathForCompare(filePath)
    const rel = prefix && normalized.startsWith(prefix) ? normalized.slice(prefix.length) : ''
    const parts = (rel || normalized).split('/').filter(Boolean)
    const fileName = parts[parts.length - 1] || filePath
    const relativeDir = parts.length > 1 ? parts.slice(0, -1).join('/') : ''
    return {
      file_path: filePath,
      fileName,
      relativeDir,
      snippetHtml: toSafeSnippetHtml(String(row?.snippet || '')),
    }
  })
})

const resetState = () => {
  query.value = ''
  loading.value = false
  errorMessage.value = ''
  results.value = []
}

watch(
  () => props.visible,
  (v) => {
    if (!v) resetState()
  }
)

const runSearch = async () => {
  const q = String(query.value || '').trim()
  const baseDir = String(props.baseDir || '').trim()
  if (!q || !baseDir) {
    results.value = []
    return
  }
  if (loading.value) return
  loading.value = true
  errorMessage.value = ''
  try {
    const res = await window.electronAPI.search.fullTextInPath({
      query: q,
      baseDir,
      recursive: true,
      ensureIndexed: true,
      limit: 200,
      offset: 0,
      sourceType: 'contract',
    })
    results.value = Array.isArray((res as any)?.items) ? ((res as any).items as any[]) : []
  } catch (e: any) {
    errorMessage.value = e?.message || '全文搜索失败'
    results.value = []
  } finally {
    loading.value = false
  }
}
</script>
