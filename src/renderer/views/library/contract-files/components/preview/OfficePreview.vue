<template>
  <div ref="containerRef" class="h-full w-full">
    <!-- Word -->
    <div v-if="ext === 'docx'" class="office-preview office-docx h-full w-full rounded-xl border border-[var(--content-border)] bg-[var(--content-bg)]">
      <VueOfficeDocx :key="officeKey" :src="officeBuffer" class="office-preview-inner w-full" @rendered="onOfficeRendered" @error="emit('error', $event)" />
    </div>

    <!-- Excel -->
    <div v-else-if="['xlsx', 'xls', 'ods', 'fods', 'ots'].includes(ext)" class="office-preview h-full w-full rounded-xl border border-[var(--content-border)] bg-[var(--content-bg)]">
      <VueOfficeExcel
        v-if="excelViewMode === 'vue-office'"
        :key="officeKey"
        :src="officeBuffer"
        class="office-preview-inner w-full"
        @rendered="onOfficeRendered"
        @error="emit('error', $event)"
      />
      <div v-else class="h-full w-full overflow-auto p-4 text-[var(--content-text)]">
        <div class="text-xs text-[var(--content-text-secondary)] mb-3">仅展示前 200 行、前 50 列</div>
        <div v-for="sheet in excelSheets" :key="sheet.name" class="mb-6">
          <div class="font-semibold mb-2 break-all">{{ sheet.name }}</div>
          <div class="overflow-auto border border-[var(--content-border)] rounded bg-white">
            <table class="min-w-full text-sm">
              <tbody>
                <tr v-for="(row, rIdx) in sheet.rows" :key="rIdx" class="border-b border-[var(--content-border)] last:border-b-0">
                  <td
                    v-for="(cell, cIdx) in row"
                    :key="cIdx"
                    class="px-2 py-1 border-r border-[var(--content-border)] last:border-r-0 whitespace-nowrap align-top"
                  >{{ cell }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>

    <!-- PowerPoint -->
    <div v-else-if="['pptx', 'ppt'].includes(ext)" class="office-preview h-full w-full rounded-xl border border-[var(--content-border)] bg-[var(--content-bg)]">
      <VueOfficePptx :key="officeKey" :src="officeBuffer" class="office-preview-inner w-full" @rendered="onOfficeRendered" @error="emit('error', $event)" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onBeforeUnmount } from 'vue'
import Mark from 'mark.js'
import VueOfficeDocx from '@vue-office/docx'
import '@vue-office/docx/lib/index.css'
import VueOfficeExcel from '@vue-office/excel'
import '@vue-office/excel/lib/index.css'
import VueOfficePptx from '@vue-office/pptx'

const props = defineProps<{
  ext: string
  officeBuffer: ArrayBuffer | SharedArrayBuffer | null
  officeKey: string
  excelViewMode: 'vue-office' | 'fallback'
  excelSheets: Array<{ name: string; rows: string[][] }>
}>()

const emit = defineEmits<{
  (e: 'rendered'): void
  (e: 'error', err: any): void
}>()

const containerRef = ref<HTMLElement | null>(null)
let markInstance: Mark | null = null
const currentMatchIndex = ref(-1)
const matches = ref<HTMLElement[]>([])

const initMark = () => {
  if (!markInstance && containerRef.value) {
    markInstance = new Mark(containerRef.value)
  }
}

const clearSearch = () => {
  if (markInstance) {
    markInstance.unmark()
  }
  matches.value = []
  currentMatchIndex.value = -1
}

const search = (keyword: string): Promise<{ matches: number; activeMatchOrdinal: number }> => {
  clearSearch()
  if (!keyword) return Promise.resolve({ matches: 0, activeMatchOrdinal: 0 })
  initMark()
  if (!markInstance) return Promise.resolve({ matches: 0, activeMatchOrdinal: 0 })

  return new Promise((resolve) => {
    markInstance!.mark(keyword, {
      done: () => {
        matches.value = Array.from(containerRef.value!.querySelectorAll('mark'))
        if (matches.value.length > 0) {
          currentMatchIndex.value = 0
          highlightCurrent()
          scrollToCurrent()
        }
        resolve({
          matches: matches.value.length,
          activeMatchOrdinal: matches.value.length > 0 ? 1 : 0
        })
      }
    })
  })
}

const highlightCurrent = () => {
  matches.value.forEach((el, index) => {
    if (index === currentMatchIndex.value) {
      el.classList.add('active-match')
      el.style.backgroundColor = '#ff9632'
    } else {
      el.classList.remove('active-match')
      el.style.backgroundColor = '#ffff00'
    }
  })
}

const scrollToCurrent = () => {
  if (currentMatchIndex.value >= 0 && currentMatchIndex.value < matches.value.length) {
    matches.value[currentMatchIndex.value].scrollIntoView({
      behavior: 'smooth',
      block: 'center'
    })
  }
}

const findNext = () => {
  if (matches.value.length === 0) return { matches: 0, activeMatchOrdinal: 0 }
  currentMatchIndex.value = (currentMatchIndex.value + 1) % matches.value.length
  highlightCurrent()
  scrollToCurrent()
  return {
    matches: matches.value.length,
    activeMatchOrdinal: currentMatchIndex.value + 1
  }
}

const findPrevious = () => {
  if (matches.value.length === 0) return { matches: 0, activeMatchOrdinal: 0 }
  currentMatchIndex.value = (currentMatchIndex.value - 1 + matches.value.length) % matches.value.length
  highlightCurrent()
  scrollToCurrent()
  return {
    matches: matches.value.length,
    activeMatchOrdinal: currentMatchIndex.value + 1
  }
}

const onOfficeRendered = () => {
  emit('rendered')
}

onBeforeUnmount(() => {
  clearSearch()
})

defineExpose({
  search,
  findNext,
  findPrevious,
  clearSearch
})
</script>

<style scoped>
.office-preview {
  min-height: 100%;
}

.office-preview-inner {
  min-height: 100%;
}

.office-docx :deep(.docx-wrapper) {
  background: transparent;
  padding: 24px 0;
}

.office-docx :deep(.docx) {
  margin: 0 auto 20px;
  padding: 40px;
  border-radius: 12px;
  border: 1px solid var(--content-border);
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.10);
  overflow: hidden;
}

.office-docx :deep(.docx .docx-body) {
  padding: 0;
}

.office-docx :deep(a) {
  color: inherit;
}
</style>
