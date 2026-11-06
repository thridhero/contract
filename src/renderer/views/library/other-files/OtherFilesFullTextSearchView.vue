<template>
  <main class="flex flex-col h-full overflow-hidden bg-[var(--content-bg)] text-[var(--content-text)]">
    <header class="flex items-center justify-between px-6 h-16 shrink-0 bg-[var(--content-bg)]/80 backdrop-blur-md border-b border-[var(--content-border)] z-40" style="-webkit-app-region: drag;">
      <div class="flex items-center gap-3 min-w-0" style="-webkit-app-region: no-drag;">
        <button
          type="button"
          class="p-2 rounded-lg transition-colors hover:bg-[var(--sidebar-hover-bg)] text-[var(--content-text-secondary)]"
          @click="goBack"
        >
          <i class="pi pi-arrow-left"></i>
        </button>
        <div class="w-px h-5 bg-[var(--content-border)]"></div>
        <div class="min-w-0">
          <div class="text-lg font-bold text-[var(--content-text)] tracking-tight whitespace-nowrap">全文搜索</div>
          <div class="text-xs text-[var(--content-text-secondary)] truncate max-w-[60vw]">范围：{{ baseDirDisplay }}</div>
        </div>
      </div>

      <div class="flex items-center gap-2" style="-webkit-app-region: no-drag;">
        <div class="relative w-[520px] max-w-[55vw] focus-within:ring-2 focus-within:ring-blue-500/20 rounded-lg">
          <i class="pi pi-search absolute left-3 top-1/2 -translate-y-1/2 text-[var(--content-text-secondary)]"></i>
          <input
            v-model="query"
            class="w-full bg-[var(--input-bg)] border border-[var(--input-border)] rounded-lg pl-9 pr-4 py-2 focus:outline-none focus:border-blue-500 text-[var(--content-text)] placeholder-[var(--content-text-secondary)] transition-colors"
            placeholder="输入要搜索的内容（包含子目录）"
            type="text"
          />
        </div>
        <WindowControls />
      </div>
    </header>

    <div class="flex-1 min-h-0 overflow-hidden">
      <div class="h-full grid grid-cols-12 gap-0">
        <section class="col-span-5 h-full min-h-0 border-r border-[var(--content-border)] flex flex-col">
          <div class="px-4 py-3 flex items-center justify-between gap-3">
            <div class="text-sm text-[var(--content-text-secondary)]">
              <span v-if="hasQuery">共 {{ total }} 条</span>
              <span v-else>输入关键词开始搜索</span>
            </div>
            <div class="flex items-center gap-3 min-w-0" v-if="hasQuery">
              <div class="text-xs text-[var(--content-text-secondary)] tabular-nums">
                已加载 {{ results.length }} / {{ total }}
              </div>
              <div class="text-xs text-[var(--content-text-secondary)] truncate max-w-[260px]" v-if="indexing">
                索引中…
              </div>
              <div class="text-xs text-[var(--content-text-secondary)] truncate max-w-[260px]" v-else-if="lastIndexedAt">
                最近索引：{{ formatTimestamp(lastIndexedAt) }}
              </div>
              <button
                type="button"
                class="px-2 py-1 rounded-lg text-xs border border-[var(--content-border)] hover:bg-[var(--sidebar-hover-bg)] transition-colors disabled:opacity-50"
                :disabled="indexing || !baseDir"
                @click="refreshIndex"
              >
                刷新索引
              </button>
            </div>
          </div>
          <div v-if="hasQuery && indexError" class="px-4 pb-2 text-xs text-red-500/90 truncate">
            索引失败：{{ indexError }}
          </div>

          <div v-if="errorMessage" class="flex-1 min-h-0 flex items-center justify-center text-sm text-[var(--content-text-secondary)] px-6 text-center">
            {{ errorMessage }}
          </div>

          <div v-else ref="listEl" class="flex-1 min-h-0 overflow-auto px-3 pb-3" @scroll="onListScroll">
            <div :style="{ height: `${virtualTotalHeight}px`, position: 'relative' }">
              <button
                v-for="row in virtualRows"
                :key="row.file_path"
                type="button"
                class="absolute left-0 right-0 text-left rounded-lg px-3 py-2 border border-[var(--content-border)] hover:bg-[var(--sidebar-hover-bg)] transition-colors"
                :class="isSelected(row.file_path) ? 'bg-[var(--sidebar-active-bg)] border-[var(--sidebar-active-border)]' : ''"
                :style="{ top: `${row.top}px`, height: `${itemHeight}px` }"
                @click="selectRow(row)"
              >
                <div class="flex items-start justify-between gap-3">
                  <div class="min-w-0 flex-1">
                    <div class="text-sm text-[var(--content-text)] truncate">
                      {{ row.fileName }}
                    </div>
                    <div v-if="row.relativeDir" class="text-xs text-[var(--content-text-secondary)] truncate">
                      {{ row.relativeDir }}
                    </div>
                  </div>
                </div>
                <div
                  class="mt-1 text-xs text-[var(--content-text-secondary)] leading-5 break-words"
                  style="display:-webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; overflow:hidden;"
                  v-html="row.snippetHtml"
                ></div>
              </button>
            </div>

            <div v-if="loading && hasQuery" class="py-8 flex items-center justify-center">
              <ProgressSpinner style="width: 32px; height: 32px" strokeWidth="3" />
            </div>

            <div v-else-if="hasQuery && results.length === 0" class="py-10 text-center text-sm text-[var(--content-text-secondary)]">
              无匹配结果
            </div>
          </div>

          <div v-if="hasQuery" class="px-4 py-3 border-t border-[var(--content-border)] flex items-center justify-between gap-3">
            <div class="text-xs text-[var(--content-text-secondary)] tabular-nums">
              {{ results.length }} / {{ total }}
            </div>
            <button
              type="button"
              class="px-3 py-1.5 rounded-lg text-sm border border-[var(--content-border)] hover:bg-[var(--sidebar-hover-bg)] transition-colors disabled:opacity-50"
              :disabled="loading || results.length >= total"
              @click="loadMore"
            >
              加载更多
            </button>
          </div>
        </section>

        <section class="col-span-7 h-full min-h-0">
          <ContractFilesPreviewPane :filePath="selectedFilePath" :displayName="selectedDisplayName" />
        </section>
      </div>
    </div>
  </main>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import ProgressSpinner from 'primevue/progressspinner'
import { useDebounceFn, useElementSize } from '@vueuse/core'
import WindowControls from '@/components/WindowControls.vue'
import { normalizePathForCompare } from '../contract-files/contractFilesHelpers'
import ContractFilesPreviewPane from '../contract-files/components/ContractFilesPreviewPane.vue'

const route = useRoute()
const router = useRouter()

const readQueryText = (value: unknown) => {
  if (typeof value === 'string') return value.trim()
  if (Array.isArray(value)) return String(value[0] || '').trim()
  return ''
}

const query = ref(readQueryText(route.query.q))
const baseDir = ref(readQueryText(route.query.baseDir))
const selectedFilePath = ref(readQueryText(route.query.filePath))

const hasQuery = computed(() => !!query.value.trim())
const baseDirDisplay = computed(() => baseDir.value || '-')

const selectedDisplayName = computed(() => {
  const qp = readQueryText(route.query.name)
  if (qp) return qp
  const p = String(selectedFilePath.value || '')
  const idx1 = p.lastIndexOf('/')
  const idx2 = p.lastIndexOf('\\')
  const idx = Math.max(idx1, idx2)
  return idx >= 0 ? p.slice(idx + 1) : p
})

const goBack = () => {
  if (window.history.length > 1) {
    router.back()
    return
  }
  router.push({ name: 'OtherFiles' })
}

const results = ref<Array<{ file_path: string; snippet: string }>>([])
const total = ref(0)
const loading = ref(false)
const errorMessage = ref('')
const indexing = ref(false)
const lastIndexedAt = ref<number | null>(null)
const indexError = ref('')
const ensuredIndex = ref(false)

const itemHeight = 104
const listEl = ref<HTMLElement | null>(null)
const scrollTop = ref(0)
const { height: listHeight } = useElementSize(listEl)

const virtualTotalHeight = computed(() => results.value.length * itemHeight)

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

const normalizeForKey = (p: string) => normalizePathForCompare(p).toLowerCase()

const basePrefix = computed(() => {
  const b = normalizePathForCompare(baseDir.value)
  return b ? `${b}/` : ''
})

const virtualRows = computed(() => {
  const source = results.value || []
  const h = Math.max(0, Math.floor(listHeight.value || 0))
  const visibleCount = Math.max(12, Math.ceil(h / itemHeight) + 12)
  const start = Math.max(0, Math.floor(scrollTop.value / itemHeight) - 6)
  const end = Math.min(source.length, start + visibleCount)
  const prefix = basePrefix.value
  const slice = source.slice(start, end)
  return slice.map((row, idx) => {
    const filePath = String(row?.file_path || '')
    const normalized = normalizePathForCompare(filePath)
    const rel = prefix && normalized.startsWith(prefix) ? normalized.slice(prefix.length) : ''
    const parts = (rel || normalized).split('/').filter(Boolean)
    const fileName = parts[parts.length - 1] || filePath
    const relativeDir = parts.length > 1 ? parts.slice(0, -1).join('/') : ''
    return {
      file_path: filePath,
      top: (start + idx) * itemHeight,
      fileName,
      relativeDir,
      snippetHtml: toSafeSnippetHtml(String(row?.snippet || '')),
    }
  })
})

const isSelected = (filePath: string) => {
  const a = normalizeForKey(filePath)
  const b = normalizeForKey(selectedFilePath.value)
  return !!a && a === b
}

const selectRow = async (row: { file_path: string; fileName: string }) => {
  const filePath = String(row?.file_path || '').trim()
  if (!filePath) return
  selectedFilePath.value = filePath
  await router.replace({
    name: 'OtherFilesFullTextSearch',
    query: {
      baseDir: baseDir.value,
      q: query.value,
      filePath,
      name: row.fileName,
    },
  })
}

const onListScroll = () => {
  const el = listEl.value
  if (!el) return
  scrollTop.value = el.scrollTop
  const nearBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - itemHeight * 6
  if (nearBottom) void loadMore()
}

let searchSeq = 0
const pageSize = 50
const shouldRerunAfterIndex = ref(false)

const formatTimestamp = (ts: number) => {
  try {
    const d = new Date(ts)
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    const hh = String(d.getHours()).padStart(2, '0')
    const mm = String(d.getMinutes()).padStart(2, '0')
    const ss = String(d.getSeconds()).padStart(2, '0')
    return `${y}-${m}-${day} ${hh}:${mm}:${ss}`
  } catch {
    return ''
  }
}

const runSearch = async (reset: boolean) => {
  const q = String(query.value || '').trim()
  const dir = String(baseDir.value || '').trim()
  if (!q || !dir) {
    results.value = []
    total.value = 0
    errorMessage.value = ''
    loading.value = false
    indexing.value = false
    lastIndexedAt.value = null
    indexError.value = ''
    ensuredIndex.value = false
    shouldRerunAfterIndex.value = false
    return
  }

  const current = ++searchSeq
  const offset = reset ? 0 : results.value.length
  if (reset) {
    results.value = []
    total.value = 0
    errorMessage.value = ''
  }
  loading.value = true
  try {
    const res = await window.electronAPI.search.fullTextInPath({
      query: q,
      baseDir: dir,
      recursive: true,
      ensureIndexed: reset ? !ensuredIndex.value : false,
      limit: pageSize,
      offset,
      sourceType: 'other',
    })
    if (current !== searchSeq) return

    const items = Array.isArray(res?.items) ? res.items : []
    total.value = Math.max(0, Number(res?.total ?? items.length))
    indexing.value = Boolean(res?.indexing)
    lastIndexedAt.value = typeof res?.lastIndexedAt === 'number' ? Number(res.lastIndexedAt) : lastIndexedAt.value
    indexError.value = String(res?.lastError || '')
    shouldRerunAfterIndex.value = Boolean(res?.indexing) && reset
    ensuredIndex.value = true

    if (reset) {
      results.value = items
      return
    }

    const next = [...results.value]
    const seen = new Set(next.map((r) => normalizeForKey(String(r?.file_path || ''))).filter(Boolean))
    for (const it of items) {
      const key = normalizeForKey(String(it?.file_path || ''))
      if (!key || seen.has(key)) continue
      seen.add(key)
      next.push(it)
    }
    results.value = next
  } catch (e: any) {
    if (current !== searchSeq) return
    errorMessage.value = e?.message || '全文搜索失败'
    results.value = []
    total.value = 0
  } finally {
    if (current === searchSeq) loading.value = false
  }
}

const searchDebounced = useDebounceFn(async () => {
  await router.replace({
    name: 'OtherFilesFullTextSearch',
    query: {
      baseDir: baseDir.value,
      q: query.value,
      filePath: selectedFilePath.value,
      name: selectedDisplayName.value,
    },
  })
  await runSearch(true)
}, 260) as ReturnType<typeof useDebounceFn> & { cancel?: () => void }

watch(
  () => query.value,
  () => {
    selectedFilePath.value = ''
    void searchDebounced()
  },
)

const loadMore = async () => {
  if (!hasQuery.value) return
  if (loading.value) return
  if (results.value.length >= total.value) return
  await runSearch(false)
}

const refreshIndex = async () => {
  const dir = String(baseDir.value || '').trim()
  if (!dir) return
  indexError.value = ''
  indexing.value = true
  shouldRerunAfterIndex.value = hasQuery.value
  ensuredIndex.value = true
  await window.electronAPI.search.reindex(dir)
}

let statusTimer: number | undefined

onMounted(() => {
  if (hasQuery.value && baseDir.value) {
    void runSearch(true)
  }
  statusTimer = window.setInterval(async () => {
    try {
      const dir = String(baseDir.value || '').trim()
      if (!dir) return
      const prevIndexing = indexing.value
      const s = await window.electronAPI.search.indexStatus(dir)
      indexing.value = Boolean(s?.indexing)
      lastIndexedAt.value = typeof s?.lastIndexedAt === 'number' ? Number(s.lastIndexedAt) : lastIndexedAt.value
      indexError.value = String(s?.lastError || '')
      if (prevIndexing && !indexing.value && shouldRerunAfterIndex.value && hasQuery.value) {
        shouldRerunAfterIndex.value = false
        await runSearch(true)
      }
    } catch {
    }
  }, 1000)
})

watch(
  () => route.query.filePath,
  (v) => {
    selectedFilePath.value = readQueryText(v)
  },
)

watch(
  () => route.query.baseDir,
  (v) => {
    const p = readQueryText(v)
    if (p && p !== baseDir.value) {
      baseDir.value = p
      ensuredIndex.value = false
    }
  },
)

watch(
  () => route.query.q,
  (v) => {
    const p = readQueryText(v)
    if (p !== query.value) query.value = p
  },
)

onBeforeUnmount(() => {
  searchSeq += 1
  if (statusTimer) window.clearInterval(statusTimer)
  searchDebounced.cancel?.()
})
</script>
