<template>
  <header class="flex flex-col shrink-0 bg-[var(--content-bg)]/80 backdrop-blur-md border-b border-[var(--content-border)] z-40">
    <div class="flex items-center justify-between px-6 h-16" style="-webkit-app-region: drag;">
      <div class="flex items-center flex-1 gap-4">
        <div class="flex items-center gap-3">
          <button
            @click="emit('back')"
            class="p-2 rounded-lg transition-colors hover:bg-[var(--sidebar-hover-bg)] text-[var(--content-text-secondary)]"
            style="-webkit-app-region: no-drag;"
          >
            <i class="pi pi-arrow-left"></i>
          </button>
          <div class="w-px h-5 bg-[var(--content-border)]"></div>
          <h2 class="text-lg font-bold text-[var(--content-text)] tracking-tight whitespace-nowrap" style="-webkit-app-region: no-drag;">
            {{ title }}
            <span v-if="titleSuffix" class="text-[var(--content-text-secondary)] font-medium ml-2">{{ titleSuffix }}</span>
          </h2>
        </div>

        <div class="flex items-center gap-3" style="-webkit-app-region: no-drag;">
          <div class="relative w-[420px] max-w-[45vw] focus-within:ring-2 focus-within:ring-blue-500/20 rounded-lg">
            <i class="pi pi-search absolute left-3 top-1/2 -translate-y-1/2 text-[var(--content-text-secondary)]"></i>
            <input
              :value="searchQuery"
              @input="emit('update:searchQuery', ($event.target as HTMLInputElement).value)"
              class="w-full bg-[var(--input-bg)] border border-[var(--input-border)] rounded-lg pl-9 pr-4 py-2 focus:outline-none focus:border-blue-500 text-[var(--content-text)] placeholder-[var(--content-text-secondary)] transition-colors"
              placeholder="搜索文件名..."
              type="text"
            />
          </div>
        </div>

        <div class="flex-1 h-full"></div>
      </div>

      <div class="flex items-center gap-2" style="-webkit-app-region: no-drag;">
        <div class="flex items-center gap-2 pr-2">
          <Button
            v-if="showImport"
            icon="pi pi-upload"
            class="p-button-sm p-button-secondary p-button-text !w-8 !h-8 !p-0 custom-icon-btn hover:!bg-[var(--sidebar-hover-bg)]"
            v-tooltip.bottom="'导入文件'"
            @click="emit('import-files')"
          />
          <Button
            v-if="showFullTextSearch"
            icon="pi pi-search-plus"
            class="p-button-sm p-button-secondary p-button-text !w-8 !h-8 !p-0 custom-icon-btn hover:!bg-[var(--sidebar-hover-bg)]"
            v-tooltip.bottom="'全文搜索'"
            @click="emit('open-full-text-search')"
          />
          <Button icon="pi pi-filter" :class="filterBtnClass" v-tooltip.bottom="'过滤'" @click="emit('toggle-filter')" />
          <Button icon="pi pi-sitemap" :class="treeModeBtnClass" v-tooltip.bottom="'树形'" @click="emit('switch-view-mode', 'tree')" />
          <Button icon="pi pi-list" :class="listModeBtnClass" v-tooltip.bottom="'列表'" @click="emit('switch-view-mode', 'list')" />
          <Button icon="pi pi-chart-bar" :class="waterfallModeBtnClass" v-tooltip.bottom="'瀑布流'" @click="emit('switch-view-mode', 'waterfall')" />
          <Button
            icon="pi pi-refresh"
            class="p-button-sm p-button-secondary p-button-text !w-8 !h-8 !p-0 custom-icon-btn hover:!bg-[var(--sidebar-hover-bg)]"
            v-tooltip.bottom="'刷新'"
            @click="emit('refresh')"
          />
        </div>
        <WindowControls />
      </div>
    </div>

    <!-- 面包屑导航行 -->
    <div v-if="breadcrumbItems && breadcrumbItems.length > 0" class="px-6 pb-3" style="-webkit-app-region: no-drag;">
      <ContractFilesBreadcrumb
        :items="breadcrumbItems"
        :canGoUp="!!canGoUp"
        @go-up="emit('go-up')"
        @navigate="(p) => emit('navigate', p)"
      />
    </div>
  </header>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import Button from 'primevue/button'
import WindowControls from '../../../../components/WindowControls.vue'
import ContractFilesBreadcrumb from './ContractFilesBreadcrumb.vue'

type ContractFilesViewMode = 'tree' | 'list' | 'waterfall'

const props = defineProps<{
  title?: string
  titleSuffix: string
  searchQuery: string
  filterActive?: boolean
  showImport?: boolean
  showFullTextSearch?: boolean
  viewMode: ContractFilesViewMode
  breadcrumbItems?: Array<{ label: string; path: string }>
  canGoUp?: boolean
}>()

const title = computed(() => String(props.title || '').trim() || '合同文件')

const emit = defineEmits<{
  (e: 'back'): void
  (e: 'import-files'): void
  (e: 'open-full-text-search'): void
  (e: 'refresh'): void
  (e: 'toggle-filter'): void
  (e: 'switch-view-mode', mode: ContractFilesViewMode): void
  (e: 'update:searchQuery', value: string): void
  (e: 'go-up'): void
  (e: 'navigate', path: string): void
}>()

const filterBtnClass = computed(() => {
  const active = !!props.filterActive
  return [
    'p-button-sm',
    'p-button-secondary',
    'p-button-text',
    '!w-8',
    '!h-8',
    '!p-0',
    'custom-icon-btn',
    'hover:!bg-[var(--sidebar-hover-bg)]',
    active ? '!bg-[var(--sidebar-active-bg)] !text-[var(--btn-primary-bg)]' : '',
  ].join(' ')
})

const treeModeBtnClass = computed(() => {
  const active = props.viewMode === 'tree'
  return [
    'p-button-sm',
    'p-button-secondary',
    'p-button-text',
    '!w-8',
    '!h-8',
    '!p-0',
    'custom-icon-btn',
    'hover:!bg-[var(--sidebar-hover-bg)]',
    active ? '!bg-[var(--sidebar-active-bg)] !text-[var(--btn-primary-bg)]' : '',
  ].join(' ')
})

const listModeBtnClass = computed(() => {
  const active = props.viewMode === 'list'
  return [
    'p-button-sm',
    'p-button-secondary',
    'p-button-text',
    '!w-8',
    '!h-8',
    '!p-0',
    'custom-icon-btn',
    'hover:!bg-[var(--sidebar-hover-bg)]',
    active ? '!bg-[var(--sidebar-active-bg)] !text-[var(--btn-primary-bg)]' : '',
  ].join(' ')
})

const waterfallModeBtnClass = computed(() => {
  const active = props.viewMode === 'waterfall'
  return [
    'p-button-sm',
    'p-button-secondary',
    'p-button-text',
    '!w-8',
    '!h-8',
    '!p-0',
    'custom-icon-btn',
    'hover:!bg-[var(--sidebar-hover-bg)]',
    active ? '!bg-[var(--sidebar-active-bg)] !text-[var(--btn-primary-bg)]' : '',
  ].join(' ')
})
</script>
