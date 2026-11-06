<template>
  <main class="flex h-full flex-col overflow-hidden bg-[var(--content-bg)] text-[var(--content-text)]">
    <header
      class="flex h-16 shrink-0 items-center justify-between border-b border-[var(--content-border)] bg-[var(--content-bg)]/80 px-6 backdrop-blur-md"
      style="-webkit-app-region: drag;" @dblclick="handleTitleBarDblClick">
      <div class="flex min-w-0 flex-1 items-center gap-4">
        <div class="flex items-center gap-3">
          <button @click="$router.back()"
            class="rounded-lg p-2 text-[var(--content-text-secondary)] transition-colors hover:bg-[var(--sidebar-hover-bg)]"
            style="-webkit-app-region: no-drag;">
            <i class="pi pi-arrow-left"></i>
          </button>
          <div class="h-5 w-px bg-[var(--content-border)]"></div>
          <h2 class="whitespace-nowrap text-lg font-bold tracking-tight text-[var(--content-text)]"
            style="-webkit-app-region: no-drag;">合同执行管理</h2>
        </div>

        <div class="flex items-center gap-3" style="-webkit-app-region: no-drag;">
          <div class="relative w-[420px] max-w-[45vw] rounded-lg focus-within:ring-2 focus-within:ring-blue-500/20">
            <i class="pi pi-search absolute left-3 top-1/2 -translate-y-1/2 text-[var(--content-text-secondary)]"
              @click="handleSearch"></i>
            <input v-model="searchQuery" @keyup.enter="handleSearch"
              class="w-full rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] py-2 pl-9 pr-4 text-[var(--content-text)] transition-colors placeholder-[var(--content-text-secondary)] focus:border-blue-500 focus:outline-none"
              placeholder="搜索合同编号、合同名称、执行情况、业务员、内容..." type="text" />
          </div>
        </div>

        <div class="h-full flex-1"></div>
      </div>

      <div class="flex items-center gap-2" style="-webkit-app-region: no-drag;">
        <div ref="columnPopoverTrigger" class="relative flex" style="-webkit-app-region: no-drag;">
          <button
            class="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--content-text-secondary)] transition-colors hover:bg-[var(--sidebar-hover-bg)]"
            @click="toggleColumnPopover">
            <i class="pi pi-sliders-h"></i>
          </button>
          <div v-if="isColumnPopoverOpen" ref="columnPopoverPanel"
            class="absolute right-0 top-full z-[70] mt-2 w-72 rounded-xl border border-[var(--content-border)] bg-[var(--content-bg)] p-3 shadow-xl"
            style="-webkit-app-region: no-drag;">
            <div class="mb-3 flex items-center justify-between gap-3">
              <div class="flex items-center gap-2">
                <Checkbox :modelValue="isAllSelected" binary @update:modelValue="toggleSelectAll" />
                <span class="text-sm font-medium text-[var(--content-text)]">全选</span>
              </div>
              <span class="text-xs text-[var(--content-text-secondary)]">
                {{ visibleColumns.length }}/{{ availableColumns.length }}
              </span>
            </div>
            <MultiSelect v-model="visibleColumns" :options="availableColumns" optionLabel="header" optionValue="field"
              placeholder="选择显示的列" selectedItemsLabel="已选择 {0} 项" :showToggleAll="false" appendTo="self"
              :maxSelectedLabels="2" class="w-full" />
          </div>
        </div>
        <button
          class="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--content-text-secondary)] transition-colors hover:bg-[var(--sidebar-hover-bg)]"
          @click="openAddDialog">
          <i class="pi pi-plus"></i>
        </button>
        <button
          class="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--content-text-secondary)] transition-colors hover:bg-[var(--sidebar-hover-bg)]"
          @click="refresh">
          <i class="pi pi-refresh"></i>
        </button>
        <WindowControls />
      </div>
    </header>
    <section class="flex-1 overflow-hidden p-6 flex flex-col gap-4">
      <DataTable :value="tableData" dataKey="id" v-model:selection="selectedRow" selectionMode="single" :loading="loading"
      stripedRows class="flex-1 custom-datatable p-datatable-sm" :scrollable="true" scrollHeight="flex" @row-click="(e) => (selectedRow = e.data)">
      <template #header>
        <div class="flex items-center justify-between gap-3">
          <div class="flex items-center gap-2"></div>
          <div class="flex items-center gap-2"></div>
        </div>
      </template>

      <template #empty>
        <div class="flex flex-col items-center justify-center py-12 text-[var(--content-text-secondary)]">
          <i class="pi pi-inbox text-3xl mb-3 opacity-50"></i>
          <p>暂无合同执行数据</p>
        </div>
      </template>

      <Column v-if="visibleColumns.includes('contract_code')" field="contract_code" header="合同编号" style="width: 9%">
        <template #body="slotProps">
          <span>{{ formatCell('contract_code', slotProps.data) }}</span>
        </template>
      </Column>
      <Column v-if="visibleColumns.includes('contract_name')" field="contract_name" header="合同名称" style="width: 16%">
        <template #body="slotProps">
          <span class="truncate block" :title="String(slotProps.data.contract_name || '')">{{ formatCell('contract_name', slotProps.data) }}</span>
        </template>
      </Column>
      <Column v-if="visibleColumns.includes('execution_time')" field="execution_time" header="执行时间" style="width: 10%">
        <template #body="slotProps">
          <span>{{ formatCell('execution_time', slotProps.data) }}</span>
        </template>
      </Column>
      <Column v-if="visibleColumns.includes('execution_status')" field="execution_status" header="执行情况" style="width: 8%">
        <template #body="slotProps">
          <div class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1"
            :class="getStatusTagClass(slotProps.data.execution_status)">
            {{ slotProps.data.execution_status || '-' }}
          </div>
        </template>
      </Column>
      <Column v-if="visibleColumns.includes('salesperson')" field="salesperson" header="业务员" style="width: 7%">
        <template #body="slotProps">
          <span>{{ formatCell('salesperson', slotProps.data) }}</span>
        </template>
      </Column>
      <Column v-if="visibleColumns.includes('content')" field="content" header="内容" style="width: 12%">
        <template #body="slotProps">
          <span>{{ formatCell('content', slotProps.data) }}</span>
        </template>
      </Column>
      <Column v-if="visibleColumns.includes('register_date')" field="register_date" header="登记日期" style="width: 9%">
        <template #body="slotProps">
          <span>{{ formatCell('register_date', slotProps.data) }}</span>
        </template>
      </Column>
      <Column v-if="visibleColumns.includes('progress')" field="progress" header="执行进度" style="width: 12%">
        <template #body="slotProps">
          <div class="flex min-w-[140px] flex-col gap-1">
            <div class="h-2 w-full rounded-full bg-slate-200">
              <div class="h-2 rounded-full transition-all" :class="getProgressColorClass(slotProps.data.progress)"
                :style="{ width: getProgressValue(slotProps.data.progress) + '%' }"></div>
            </div>
            <span class="text-xs tabular-nums" :class="getProgressTextColorClass(slotProps.data.progress)">
              {{ getProgressText(slotProps.data.progress) }}
            </span>
          </div>
        </template>
      </Column>
      <Column v-if="visibleColumns.includes('remark')" field="remark" header="备注" style="width: 10%">
        <template #body="slotProps">
          <span class="truncate block" :title="String(slotProps.data.remark || '')">{{ formatCell('remark', slotProps.data) }}</span>
        </template>
      </Column>
      <Column v-if="visibleColumns.includes('custom2')" field="custom2" header="自定义2" style="width: 8%">
        <template #body="slotProps">
          <span>{{ formatCell('custom2', slotProps.data) }}</span>
        </template>
      </Column>
      <Column v-if="visibleColumns.includes('custom3')" field="custom3" header="自定义3" style="width: 8%">
        <template #body="slotProps">
          <span>{{ formatCell('custom3', slotProps.data) }}</span>
        </template>
      </Column>
      <Column v-if="visibleColumns.includes('custom4')" field="custom4" header="自定义4" style="width: 8%">
        <template #body="slotProps">
          <span>{{ formatCell('custom4', slotProps.data) }}</span>
        </template>
      </Column>

      <Column header="操作" :exportable="false" style="width: 7%; min-width: 9rem">
        <template #body="slotProps">
          <div class="flex gap-2">
            <Button icon="pi pi-pencil" class="p-button-text p-button-sm p-button-rounded" @click="editRow(slotProps.data)" />
            <Button icon="pi pi-trash" class="p-button-text p-button-sm p-button-rounded p-button-danger" @click="deleteRow(slotProps.data)" />
          </div>
        </template>
      </Column>
    </DataTable>
    <div class="shrink-0 border-t border-[var(--content-border)] bg-transparent">
      <div class="flex items-center justify-between px-4 py-2">
        <span class="text-xs font-semibold text-[var(--content-text-secondary)] uppercase tracking-widest">
          显示
          {{ total ? Math.min((page - 1) * pageSize + 1, total) : 0 }}
          到
          {{ total ? Math.min(page * pageSize, total) : 0 }}
          共 {{ total }} 条
        </span>
        <Paginator
          :rows="pageSize"
          :totalRecords="total"
          :first="(page - 1) * pageSize"
          class="bg-transparent border-none custom-paginator !p-0"
          @page="onPageChange"
        />
      </div>
    </div>
    </section>
  </main>
  <ContractExecutionDialog v-model:visible="dialogVisible" :initialData="editingRow" @saved="onSaved" />
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Button from 'primevue/button'
import MultiSelect from 'primevue/multiselect'
import Checkbox from 'primevue/checkbox'
import Paginator from 'primevue/paginator'
import { useToast } from 'primevue/usetoast'
import { useConfirm } from 'primevue/useconfirm'
import WindowControls from '../../../components/WindowControls.vue'
import type { ContractExecution, ContractExecutionQueryDTO, ContractExecutionSearchField } from '../../../../shared/types/contractExecution.types'
import ContractExecutionDialog from './components/ContractExecutionDialog.vue'
import type { ContractInfoEntity } from '../../../../shared/types/contractInfo.types'


const toast = useToast()
const confirm = useConfirm()

const tableData = ref<ContractExecution[]>([])
const loading = ref(false)
const total = ref(0)
const page = ref(1)
const pageSize = ref(10)
const searchQuery = ref('')
const selectedRow = ref<ContractExecution | null>(null)
const dialogVisible = ref(false)
const editingRow = ref<ContractExecution | null>(null)

const CONTRACT_EXECUTION_COLUMNS_SETTING_KEY = 'contract_execution_table_columns'
let contractExecutionColumnsSettingExists = false
let contractExecutionColumnsHydrating = true

const columnPopoverTrigger = ref<HTMLElement | null>(null)
const columnPopoverPanel = ref<HTMLElement | null>(null)
const isColumnPopoverOpen = ref(false)

const closeColumnPopover = () => {
  isColumnPopoverOpen.value = false
}

const toggleColumnPopover = () => {
  isColumnPopoverOpen.value = !isColumnPopoverOpen.value
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
}

const availableColumns: Array<{ field: keyof ContractExecution; header: string }> = [
  { field: 'contract_code', header: '合同编号' },
  { field: 'contract_name', header: '合同名称' },
  { field: 'execution_time', header: '执行时间' },
  { field: 'execution_status', header: '执行情况' },
  { field: 'salesperson', header: '业务员' },
  { field: 'content', header: '内容' },
  { field: 'register_date', header: '登记日期' },
  { field: 'progress', header: '执行进度' },
  { field: 'remark', header: '备注' },
  { field: 'custom2', header: '自定义2' },
  { field: 'custom3', header: '自定义3' },
  { field: 'custom4', header: '自定义4' },
]

const defaultColumns = [
  'contract_code',
  'contract_name',
  'execution_time',
  'execution_status',
  'salesperson',
  'content',
  'register_date',
  'progress',
] as Array<keyof ContractExecution>
const visibleColumns = ref<Array<keyof ContractExecution>>([...defaultColumns])

const maxPage = computed(() => Math.max(1, Math.ceil(total.value / pageSize.value)))

const isAllSelected = computed(() => visibleColumns.value.length > 0 && visibleColumns.value.length === availableColumns.length)

const toggleSelectAll = (checked: boolean) => {
  if (checked) {
    visibleColumns.value = availableColumns.map(c => c.field)
  } else {
    visibleColumns.value = []
  }
}

function formatCell(field: keyof ContractExecution, row: ContractExecution) {
  const v = (row as any)[field]
  if (v === undefined || v === null || v === '') return '-'
  return v
}

const getProgressValue = (value: unknown) => {
  const raw = String(value ?? '').trim()
  if (!raw) return 0
  const n = Number(raw.replace('%', ''))
  if (!Number.isFinite(n)) return 0
  return Math.max(0, Math.min(100, n))
}

const getProgressText = (value: unknown) => {
  const raw = String(value ?? '').trim()
  if (!raw) return '-'
  return `${getProgressValue(raw)}%`
}

const getProgressColorClass = (value: unknown) => {
  const v = getProgressValue(value)
  if (v < 30) return 'bg-red-500'
  if (v < 70) return 'bg-orange-500'
  return 'bg-green-500'
}

const getProgressTextColorClass = (value: unknown) => {
  const v = getProgressValue(value)
  if (v < 30) return 'text-red-500'
  if (v < 70) return 'text-orange-500'
  return 'text-green-600'
}

const getStatusTagClass = (value: unknown) => {
  const s = String(value ?? '').trim()
  switch (s) {
    case '已完成':
      return 'bg-green-100 text-green-700 ring-green-200'
    case '执行中':
      return 'bg-blue-100 text-blue-700 ring-blue-200'
    case '已启动':
      return 'bg-sky-100 text-sky-700 ring-sky-200'
    case '待确认':
      return 'bg-slate-100 text-slate-700 ring-slate-200'
    case '需补充':
      return 'bg-yellow-100 text-yellow-800 ring-yellow-200'
    case '延期':
      return 'bg-red-100 text-red-700 ring-red-200'
    default:
      return 'bg-gray-100 text-gray-700 ring-gray-200'
  }
}

const loadContractExecutionTableColumns = async () => {
  const db = window.electronAPI?.db
  if (!db) {
    contractExecutionColumnsHydrating = false
    return
  }
  try {
    const result = await db.getSetting(CONTRACT_EXECUTION_COLUMNS_SETTING_KEY)
    if (result.success && result.data?.value) {
      contractExecutionColumnsSettingExists = true
      const parsed = JSON.parse(result.data.value) as unknown
      if (Array.isArray(parsed)) {
        const allowed = new Set(availableColumns.map(c => String(c.field)))
        const next = parsed.map(String).filter((f) => allowed.has(String(f)))
        visibleColumns.value = (next.length ? next : defaultColumns) as Array<keyof ContractExecution>
      }
      contractExecutionColumnsHydrating = false
      return
    }
  } catch {
  }

  const legacy = localStorage.getItem(CONTRACT_EXECUTION_COLUMNS_SETTING_KEY)
  if (legacy) {
    try {
      const parsed = JSON.parse(legacy) as unknown
      if (Array.isArray(parsed)) {
        const allowed = new Set(availableColumns.map(c => String(c.field)))
        const next = parsed.map(String).filter((f) => allowed.has(String(f)))
        visibleColumns.value = (next.length ? next : defaultColumns) as Array<keyof ContractExecution>
      }
      await saveContractExecutionTableColumns()
      localStorage.removeItem(CONTRACT_EXECUTION_COLUMNS_SETTING_KEY)
    } catch {
    }
  }
  contractExecutionColumnsHydrating = false
}

const saveContractExecutionTableColumns = async () => {
  const db = window.electronAPI?.db
  if (!db) return
  const json = JSON.stringify(visibleColumns.value)
  if (contractExecutionColumnsSettingExists) {
    await db.updateSetting(CONTRACT_EXECUTION_COLUMNS_SETTING_KEY, json, '合同执行表格显示列')
    return
  }
  await db.insertSetting(CONTRACT_EXECUTION_COLUMNS_SETTING_KEY, json, '合同执行表格显示列')
  contractExecutionColumnsSettingExists = true
}

async function loadData() {
  loading.value = true
  try {
    const query: ContractExecutionQueryDTO = {
      page: page.value,
      pageSize: pageSize.value,
      search: searchQuery.value.trim() || undefined,
      searchFields: ['contract_code', 'contract_name', 'execution_time', 'execution_status', 'salesperson', 'content', 'register_date', 'progress', 'remark', 'custom2', 'custom3', 'custom4'] as ContractExecutionSearchField[],
    }
    let res = await window.electronAPI.contractExecution.getList(query)
    if (!res.success) {
      tableData.value = []
      total.value = 0
      toast.add({ severity: 'error', summary: '加载失败', detail: res.error || '获取合同执行列表失败', life: 3000 })
      return
    }
    tableData.value = res.data.data
    total.value = res.data.total
  } finally {
    loading.value = false
  }
}

function onPageChange(e: any) {
  page.value = Math.floor(e.first / e.rows) + 1
  pageSize.value = e.rows
  loadData()
}

function handleSearch() {
  page.value = 1
  loadData()
}

function refresh() {
  loadData()
}

function openAddDialog() {
  editingRow.value = null
  dialogVisible.value = true
}

function editRow(row: ContractExecution) {
  editingRow.value = row
  dialogVisible.value = true
}

async function deleteRow(row: ContractExecution) {
  if (!row?.id) return
  confirm.require({
    message: '确定要删除该合同执行记录吗？该操作不可恢复。',
    header: '删除确认',
    icon: 'pi pi-exclamation-triangle',
    acceptLabel: '删除',
    rejectLabel: '取消',
    acceptClass: 'p-button-danger',
    accept: async () => {
      const res = await window.electronAPI.contractExecution.delete(row.id)
      if (!res.success) {
        toast.add({ severity: 'error', summary: '删除失败', detail: res.error || '删除合同执行失败', life: 3000 })
        return
      }
      toast.add({ severity: 'success', summary: '已删除', detail: '合同执行记录已删除', life: 2000 })
      await loadData()
    },
  })
}

async function onSaved() {
  dialogVisible.value = false
  await loadData()
}

const handleTitleBarDblClick = async () => {
  try {
    await window.electronAPI?.window?.toggleMaximize?.()
  } catch {
  }
}

const getCurrentLibraryPath = async (): Promise<string> => {
  let libraryPath = localStorage.getItem('currentLibraryPath') || ''
  if (!libraryPath) {
    const status = await window.electronAPI.bootstrap.getInitStatus()
    if (status.success && status.data?.initialized && status.data.projectPath) {
      libraryPath = status.data.projectPath
      localStorage.setItem('currentLibraryPath', libraryPath)
    }
  }
  if (!libraryPath) {
    const db = window.electronAPI?.db
    if (db) {
      const res = await db.getSetting('project_path')
      if (res.success && res.data?.value) {
        libraryPath = res.data.value
        localStorage.setItem('currentLibraryPath', libraryPath)
      }
    }
  }
  return libraryPath
}

onMounted(async () => {
  await loadContractExecutionTableColumns()
  await loadData()
  document.addEventListener('pointerdown', handleDocumentPointerDown, true)
  document.addEventListener('keydown', handleDocumentKeydown, true)
})

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', handleDocumentPointerDown, true)
  document.removeEventListener('keydown', handleDocumentKeydown, true)
})

watch(visibleColumns, async () => {
  if (contractExecutionColumnsHydrating) return
  await saveContractExecutionTableColumns()
}, { deep: true })
</script>
