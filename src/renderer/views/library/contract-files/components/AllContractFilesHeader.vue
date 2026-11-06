<template>
  <header
    class="flex h-14 shrink-0 items-center justify-between border-b border-[var(--content-border)] bg-[var(--content-bg)]/80 px-6 backdrop-blur-md"
    style="-webkit-app-region: drag;"
  >
    <div class="flex min-w-0 flex-1 items-center gap-4">
      <div class="flex items-center gap-3" style="-webkit-app-region: no-drag;">
        <div class="min-w-0">
          <h2 class="whitespace-nowrap text-lg font-bold tracking-tight text-[var(--content-text)]">
            全库合同文件
          </h2>
          <p v-if="currentScopeLabel" class="truncate text-xs text-[var(--content-text-secondary)]">
            当前目录：{{ currentScopeLabel }}
          </p>
        </div>
      </div>

      <div class="relative w-72" style="-webkit-app-region: no-drag;">
        <i class="pi pi-search absolute left-3 top-1/2 -translate-y-1/2 text-[var(--content-text-secondary)] text-xs"></i>
        <InputText
          v-model="searchValue"
          class="w-full !pl-10 h-9 !rounded-lg !border !border-[var(--input-border)] !bg-[var(--input-bg)] !text-[var(--content-text)] placeholder:!text-[var(--content-text-secondary)] focus:!border-[var(--btn-primary-bg)]"
          :placeholder="searchPlaceholder || '搜索当前目录...'"
        />
      </div>
    </div>

    <div class="flex items-center gap-2" style="-webkit-app-region: no-drag;">
      <Button
        icon="pi pi-arrow-up"
        severity="secondary"
        text
        class="p-button-sm !w-8 !h-8"
        :disabled="!canGoUp"
        v-tooltip.bottom="'返回上级目录'"
        @click="emit('goUp')"
      />
      <Button
        icon="pi pi-search-plus"
        severity="secondary"
        text
        class="p-button-sm !w-8 !h-8"
        v-tooltip.bottom="'全局搜索'"
        @click="emit('openGlobalSearch')"
      />
      <Button
        icon="pi pi-filter"
        :class="filterBtnClass"
        v-tooltip.bottom="'文件过滤'"
        @click="emit('toggleFilterBar')"
      />
      <WindowControls />
    </div>
  </header>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import WindowControls from '../../../../components/WindowControls.vue'

const props = defineProps<{
  search: string
  filterBtnClass: string
  currentScopeLabel?: string
  searchPlaceholder?: string
  canGoUp?: boolean
}>()

const emit = defineEmits<{
  (e: 'update:search', value: string): void
  (e: 'goUp'): void
  (e: 'openGlobalSearch'): void
  (e: 'toggleFilterBar'): void
}>()

const searchValue = computed({
  get: () => props.search,
  set: (val) => emit('update:search', val)
})
</script>
