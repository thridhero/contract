<template>
  <header class="flex items-center justify-between px-6 h-16 shrink-0 bg-[var(--content-bg)]/80 backdrop-blur-md border-b border-[var(--content-border)] z-40" style="-webkit-app-region: drag;" @dblclick="handleTitleBarDblClick">
      <div class="flex items-center gap-3" style="-webkit-app-region: no-drag;">
        <div class="flex items-center gap-3">
          <button @click="$router.back()" class="p-2 rounded-lg transition-colors hover:bg-[var(--sidebar-hover-bg)] text-[var(--content-text-secondary)]" style="-webkit-app-region: no-drag;">
            <i class="pi pi-arrow-left"></i>
          </button>
          <div class="w-px h-5 bg-[var(--content-border)]"></div>
          <h2 class="text-lg font-bold text-[var(--content-text)] tracking-tight whitespace-nowrap" style="-webkit-app-region: no-drag;">合同管理</h2>
        </div>
        <div class="w-72 max-w-[30vw] focus-within:ring-2 focus-within:ring-[color:var(--btn-primary-bg)]/20 rounded-lg">
          <div style="-webkit-app-region: no-drag;">
            <InputGroup class="w-56">
              <InputGroupAddon class="!p-0">
                <button
                  type="button"
                  class="h-full px-3 flex items-center justify-center text-[var(--content-text-secondary)] hover:text-[var(--content-text)] transition-colors"
                  @click.stop="toggleSearchFieldPopover"
                >
                  <i class="pi pi-search"></i>
                  <i class="pi pi-chevron-down ml-1 text-xs text-[var(--content-text-secondary)]"></i>
                </button>
              </InputGroupAddon>
              <InputText
                :modelValue="props.searchQuery"
                class="w-full !bg-[var(--input-bg)] !border-[var(--input-border)] !text-[var(--content-text)] placeholder:!text-[var(--content-text-secondary)] focus:!border-[var(--btn-primary-bg)]"
                placeholder="搜索合同..."
                @update:modelValue="emit('update:search-query', $event)"
              />
            </InputGroup>
            <Popover ref="searchFieldPopover" style="background: transparent; border: none; box-shadow: none;">
              <div
                class="w-56 rounded-xl border border-[var(--content-border)] bg-[var(--content-bg)] p-1 shadow-xl"
                style="-webkit-app-region: no-drag;"
              >
                <button
                  v-for="opt in searchFieldOptions"
                  :key="opt.value"
                  type="button"
                  class="w-full flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors text-[var(--content-text)] hover:bg-[var(--sidebar-hover-bg)]"
                  @click="toggleSearchField(opt.value)"
                >
                  <span class="flex items-center gap-2 min-w-0">
                    <Checkbox :modelValue="isSearchFieldChecked(opt.value)" binary @click.stop @update:modelValue="toggleSearchField(opt.value)" />
                    <span class="truncate">{{ opt.label }}</span>
                  </span>
                  <i v-if="opt.value === 'all' && isSearchFieldChecked('all')" class="pi pi-check text-xs text-[var(--btn-primary-bg)]"></i>
                </button>
              </div>
            </Popover>
          </div>
        </div>
      </div>
    <div class="flex items-center gap-2" style="-webkit-app-region: no-drag;">
      <div class="flex items-center gap-2">
        <div v-if="props.viewMode === 'list'" ref="columnPopoverTrigger" class="relative flex" style="-webkit-app-region: no-drag;">
          <Button
            icon="pi pi-sliders-h"
            class="p-button-sm p-button-secondary p-button-text !w-8 !h-8 !p-0 custom-icon-btn"
            v-tooltip.bottom="'列设置'"
            @click="toggleColumnPopover"
          />
          <div
            v-if="isColumnPopoverOpen"
            ref="columnPopoverPanel"
            class="absolute right-0 top-full z-[70] mt-2 w-72 rounded-xl border border-[var(--content-border)] bg-[var(--content-bg)] p-3 shadow-xl"
            style="-webkit-app-region: no-drag;"
          >
            <div class="mb-3 flex items-center justify-between gap-3">
              <div class="flex items-center gap-2">
                <Checkbox :modelValue="isAllSelected" binary @update:modelValue="toggleSelectAll" />
                <span class="text-sm font-medium text-[var(--content-text)]">全选</span>
              </div>
              <span class="text-xs text-[var(--content-text-secondary)]">
                {{ props.visibleColumns.length }}/{{ props.columnOptions.length }}
              </span>
            </div>
            <MultiSelect
              :modelValue="props.visibleColumns"
              :options="props.columnOptions"
              optionLabel="header"
              optionValue="field"
              placeholder="选择显示的列"
              selectedItemsLabel="已选择 {0} 项"
              :showToggleAll="false"
              appendTo="self"
              :maxSelectedLabels="2"
              class="w-full"
              @update:modelValue="$emit('update:visible-columns', $event)"
            />
          </div>
        </div>
        <div class="relative flex" style="-webkit-app-region: no-drag;">
          <Button
            icon="pi pi-filter"
            class="p-button-sm p-button-secondary p-button-text !w-8 !h-8 !p-0 custom-icon-btn"
            :class="props.filterActive ? '!bg-[var(--sidebar-active-bg)] !text-[var(--btn-primary-bg)]' : ''"
            v-tooltip.bottom="'过滤'"
            @click="$emit('filter')"
          />
        </div>
        <Button
          icon="pi pi-folder-open"
          class="p-button-sm p-button-secondary p-button-text !w-8 !h-8 !p-0 custom-icon-btn"
          v-tooltip.bottom="'批量增加合同'"
          :style="{ color: 'var(--btn-primary-bg)' }"
          @click="$emit('batch-import-contracts')"
        />
        <Button
          icon="pi pi-file-excel"
          class="p-button-sm p-button-secondary p-button-text !w-8 !h-8 !p-0 custom-icon-btn"
          v-tooltip.bottom="'导出 Excel'"
          :style="{ color: 'var(--btn-primary-bg)' }"
          @click="$emit('export-excel')"
        />
        <Button
          v-if="props.batchImportActive || props.hasBatchImportResult"
          :icon="props.batchImportActive ? 'pi pi-spin pi-spinner' : 'pi pi-clock'"
          class="p-button-sm p-button-secondary p-button-text !w-8 !h-8 !p-0 custom-icon-btn"
          :style="{ color: 'var(--btn-primary-bg)' }"
          v-tooltip.bottom="'查看批量导入进度'"
          @click="$emit('view-batch-import-progress')"
        />
        <Button
          icon="pi pi-plus"
          class="p-button-sm p-button-secondary p-button-text !w-8 !h-8 !p-0 custom-icon-btn"
          :style="{ color: 'var(--btn-primary-bg)' }"
          v-tooltip.bottom="'新增'"
          @click="$emit('create-contract')"
        />
        <Button
          icon="pi pi-eye"
          class="p-button-sm p-button-secondary p-button-text !w-8 !h-8 !p-0 custom-icon-btn"
          :class="showAllAmounts ? '!bg-[var(--sidebar-active-bg)] !text-[var(--btn-primary-bg)]' : ''"
          v-tooltip.bottom="showAllAmounts ? '隐藏全部金额' : '显示全部金额'"
          @click="$emit('toggle-all-amounts')"
        />
        <div class="flex items-center gap-1 rounded-xl border border-[var(--content-border)] bg-[var(--content-bg)] p-1">
          <button
            type="button"
            class="flex h-8 w-8 items-center justify-center rounded-lg transition-colors"
            :class="props.viewMode === 'grid' ? 'bg-[var(--sidebar-active-bg)] text-[var(--btn-primary-bg)]' : 'text-[var(--content-text-secondary)] hover:bg-[var(--sidebar-hover-bg)]'"
            v-tooltip.bottom="'卡片'"
            @click="$emit('update:view-mode', 'grid')"
          >
            <i class="pi pi-th-large"></i>
          </button>
          <button
            type="button"
            class="flex h-8 w-8 items-center justify-center rounded-lg transition-colors"
            :class="props.viewMode === 'list' ? 'bg-[var(--sidebar-active-bg)] text-[var(--btn-primary-bg)]' : 'text-[var(--content-text-secondary)] hover:bg-[var(--sidebar-hover-bg)]'"
            v-tooltip.bottom="'列表'"
            @click="$emit('update:view-mode', 'list')"
          >
            <i class="pi pi-list"></i>
          </button>
        </div>
        </div>
    </div>
  </header>
</template>

<script setup lang="ts">
import Button from 'primevue/button'
import MultiSelect from 'primevue/multiselect'
import Checkbox from 'primevue/checkbox'
import InputGroup from 'primevue/inputgroup'
import InputGroupAddon from 'primevue/inputgroupaddon'
import InputText from 'primevue/inputtext'
import Popover from 'primevue/popover'
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'

const props = defineProps({
  title: {
    type: String,
    default: '全部'
  },
  zoomLevel: {
    type: Number,
    default: 60
  },
  hasCloudNotification: {
    type: Boolean,
    default: false
  },
  searchQuery: {
    type: String,
    default: ''
  },
  searchFields: {
    type: Array,
    default: () => ['all']
  },
  filters: {
    type: Object,
    default: () => ({})
  },
  viewMode: {
    type: String,
    default: 'grid'
  },
  filterActive: {
    type: Boolean,
    default: false
  },
  columnOptions: {
    type: Array,
    default: () => []
  },
  visibleColumns: {
    type: Array,
    default: () => []
  },
  batchImportActive: {
    type: Boolean,
    default: false,
  },
  hasBatchImportResult: {
    type: Boolean,
    default: false,
  },
  showAllAmounts: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits([
  'navigate-back',
  'navigate-forward',
  'zoom-out',
  'zoom-in',
  'create-contract',
  'cloud-sync',
  'quick-action',
  'archive',
  'filter',
  'update:search-query',
  'update:search-fields',
  'update:search-field',
  'update:filters',
  'update:view-mode',
  'update:visible-columns',
  'batch-import-contracts',
  'export-excel',
  'view-batch-import-progress',
  'toggle-all-amounts',
])

const columnPopoverTrigger = ref<HTMLElement | null>(null)
const columnPopoverPanel = ref<HTMLElement | null>(null)
const isColumnPopoverOpen = ref(false)
const searchFieldPopover = ref<InstanceType<typeof Popover> | null>(null)
const closeColumnPopover = () => {
  isColumnPopoverOpen.value = false
}

const toggleColumnPopover = () => {
  isColumnPopoverOpen.value = !isColumnPopoverOpen.value
}

const toggleSearchFieldPopover = (event: Event) => {
  searchFieldPopover.value?.toggle(event)
}

const closeSearchFieldPopover = () => {
  searchFieldPopover.value?.hide()
}

const isPopoverTarget = (event: Event) => {
  const path = typeof event.composedPath === 'function' ? event.composedPath() : []
  return path.includes(columnPopoverTrigger.value as EventTarget) || path.includes(columnPopoverPanel.value as EventTarget)
}

const handleDocumentPointerDown = (event: Event) => {
  if (!isColumnPopoverOpen.value) return
  if (isPopoverTarget(event)) return
  closeColumnPopover()
}

const handleDocumentKeydown = (event: KeyboardEvent) => {
  if (event.key !== 'Escape') return
  closeColumnPopover()
  closeSearchFieldPopover()
}

const isAllSelected = computed(() => {
  const fields = Array.isArray(props.columnOptions) ? props.columnOptions.map((o: any) => o?.field).filter(Boolean) : []
  return Array.isArray(props.visibleColumns) && props.visibleColumns.length > 0 && props.visibleColumns.length === fields.length
})

const toggleSelectAll = (checked: boolean) => {
  const fields = Array.isArray(props.columnOptions) ? props.columnOptions.map((o: any) => o?.field).filter(Boolean) : []
  if (checked) {
    emit('update:visible-columns', fields)
  } else {
    emit('update:visible-columns', [])
  }
}

watch(() => props.viewMode, (mode) => {
  if (mode !== 'list') {
    closeColumnPopover()
  }
})

onMounted(() => {
  document.addEventListener('pointerdown', handleDocumentPointerDown)
  document.addEventListener('keydown', handleDocumentKeydown)
})

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', handleDocumentPointerDown)
  document.removeEventListener('keydown', handleDocumentKeydown)
})

const searchFieldOptions = [
  { label: '全部字段', value: 'all' },
  { label: '合同名称', value: 'contract_name' },
  { label: '合同编号', value: 'contract_code' },
  { label: '甲方', value: 'client_name' },
  { label: '乙方', value: 'party_b_name' },
  { label: '合同类型', value: 'contract_type' },
  { label: '内容全文', value: 'full_text' },
]

const selectedSearchFieldLabel = computed(() => {
  const selected = Array.isArray(props.searchFields) ? props.searchFields.map(String).map(v => v.trim()).filter(Boolean) : []
  if (!selected.length || selected.includes('all')) return '全部字段'
  const labels = selected
    .map((v) => searchFieldOptions.find(opt => opt.value === v)?.label)
    .filter(Boolean) as string[]
  if (!labels.length) return '全部字段'
  if (labels.length <= 2) return labels.join('、')
  return `${labels.slice(0, 2).join('、')} +${labels.length - 2}`
})

const normalizeSearchFields = (fields: unknown): string[] => {
  if (!Array.isArray(fields)) return []
  return fields.map((v) => String(v || '').trim()).filter(Boolean)
}

const isSearchFieldChecked = (value: string) => {
  const current = normalizeSearchFields(props.searchFields)
  return current.includes('all') ? value === 'all' : current.includes(value)
}

const toggleSearchField = (value: string) => {
  const current = normalizeSearchFields(props.searchFields)
  if (value === 'all') {
    emit('update:search-fields', ['all'])
    emit('update:search-field', 'all')
    return
  }

  if (current.includes('all')) {
    emit('update:search-fields', [value])
    emit('update:search-field', value)
    return
  }

  const next = current.includes(value) ? current.filter((f) => f !== value) : [...current, value]
  const normalizedNext = next.length ? next : ['all']
  emit('update:search-fields', normalizedNext)
  emit('update:search-field', normalizedNext.includes('all') ? 'all' : normalizedNext[0])
}

const handleTitleBarDblClick = (event: MouseEvent) => {
  const target = event.target as HTMLElement | null
  if (!target) return
  const blocked = target.closest('input, textarea, button, a, [role="button"], .p-inputtext, .p-button, .p-select, .p-checkbox')
  if (blocked) return
  window.electronAPI?.window?.toggleMaximize?.() ?? window.electronAPI?.toggleMaximizeWindow?.()
}
</script>

<style scoped>
.custom-icon-btn {
  border: 1px solid transparent !important;
}
.custom-icon-btn:hover {
  border-color: transparent !important;
  background-color: var(--sidebar-hover-bg) !important;
}

:deep(.p-select) {
  height: 40px;
  align-items: center;
}

:deep(.p-select-label) {
  display: flex;
  align-items: center;
  height: 100%;
}
</style>
