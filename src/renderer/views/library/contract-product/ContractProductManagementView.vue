<template>
  <main class="flex h-full flex-col overflow-hidden bg-[var(--content-bg)] text-[var(--content-text)]">
    <header
      class="flex h-16 shrink-0 items-center justify-between border-b border-[var(--content-border)] bg-[var(--content-bg)]/80 px-6 backdrop-blur-md"
      style="-webkit-app-region: drag;"
      @dblclick="handleTitleBarDblClick"
    >
      <div class="flex min-w-0 flex-1 items-center gap-4">
        <div class="flex items-center gap-3">
          <button
            @click="$router.back()"
            class="rounded-lg p-2 text-[var(--content-text-secondary)] transition-colors hover:bg-[var(--sidebar-hover-bg)]"
            style="-webkit-app-region: no-drag;"
          >
            <i class="pi pi-arrow-left"></i>
          </button>
          <div class="h-5 w-px bg-[var(--content-border)]"></div>
          <h2 class="whitespace-nowrap text-lg font-bold tracking-tight text-[var(--content-text)]" style="-webkit-app-region: no-drag;">合同产品管理</h2>
        </div>

        <div class="flex items-center gap-3" style="-webkit-app-region: no-drag;">
          <div class="relative w-[420px] max-w-[45vw] rounded-lg focus-within:ring-2 focus-within:ring-blue-500/20">
            <i class="pi pi-search absolute left-3 top-1/2 -translate-y-1/2 text-[var(--content-text-secondary)]" @click="handleSearch"></i>
            <input
              v-model="searchQuery"
              @keyup.enter="handleSearch"
              class="w-full rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] py-2 pl-9 pr-4 text-[var(--content-text)] transition-colors placeholder-[var(--content-text-secondary)] focus:border-blue-500 focus:outline-none"
              placeholder="搜索合同编号、名称、编码、供应商/客户..."
              type="text"
            />
          </div>
        </div>

        <div class="h-full flex-1"></div>
      </div>

      <div class="flex items-center gap-2" style="-webkit-app-region: no-drag;">
        <div ref="columnPopoverTrigger" class="relative flex" style="-webkit-app-region: no-drag;">
          <button
            class="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--content-text-secondary)] transition-colors hover:bg-[var(--sidebar-hover-bg)]"
            @click="toggleColumnPopover"
          >
            <i class="pi pi-sliders-h"></i>
          </button>
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
                {{ visibleColumns.length }}/{{ availableColumns.length }}
              </span>
            </div>
            <MultiSelect
              v-model="visibleColumns"
              :options="availableColumns"
              optionLabel="header"
              optionValue="field"
              placeholder="选择显示的列"
              selectedItemsLabel="已选择 {0} 项"
              :showToggleAll="false"
              appendTo="self"
              :maxSelectedLabels="2"
              class="w-full"
            />
          </div>
        </div>
        <button class="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--content-text-secondary)] transition-colors hover:bg-[var(--sidebar-hover-bg)]" @click="openAddDialog">
          <i class="pi pi-plus"></i>
        </button>
        <button
          class="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--content-text-secondary)] transition-colors hover:bg-[var(--sidebar-hover-bg)] disabled:opacity-40 disabled:cursor-not-allowed"
          :disabled="selectedRows.length === 0"
          title="批量删除"
          @click="batchDeleteRows()"
        >
          <i class="pi pi-trash"></i>
        </button>
        <button class="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--content-text-secondary)] transition-colors hover:bg-[var(--sidebar-hover-bg)]" @click="refresh">
          <i class="pi pi-refresh"></i>
        </button>
        <WindowControls />
      </div>
    </header>

    <section class="flex-1 overflow-hidden p-6 flex flex-col gap-4">
      <DataTable
        :value="tableData"
        dataKey="id"
        v-model:selection="selectedRows"
        v-model:contextMenuSelection="contextMenuSelection"
        :loading="loading"
        stripedRows
        class="flex-1 custom-datatable p-datatable-sm"
        :scrollable="true"
        scrollHeight="flex"
        @row-contextmenu="onRowContextMenu"
      >
          <template #header>
            <div class="flex items-center justify-between gap-3">
              <div class="flex items-center gap-2"></div>
              <div class="flex items-center gap-2"></div>
            </div>
          </template>

          <template #empty>
            <div class="flex flex-col items-center justify-center py-12 text-[var(--content-text-secondary)]">
              <i class="pi pi-inbox text-3xl mb-3 opacity-50"></i>
              <p>暂无合同产品数据</p>
            </div>
          </template>

          <Column selectionMode="multiple" headerStyle="width: 3rem" style="width: 4%" />

          <Column v-if="visibleColumns.includes('contract_code')" field="contract_code" header="合同编号" style="width: 8%">
            <template #body="slotProps">
              <span>{{ formatCell('contract_code', slotProps.data) }}</span>
            </template>
          </Column>
          <Column v-if="visibleColumns.includes('contract_name')" field="contract_name" header="合同名称" style="width: 13%">
            <template #body="slotProps">
              <span class="truncate block" :title="String(slotProps.data.contract_name || '')">{{ formatCell('contract_name', slotProps.data) }}</span>
            </template>
          </Column>
          <Column v-if="visibleColumns.includes('code')" field="code" header="编码" style="width: 8%">
            <template #body="slotProps">
              <span>{{ formatCell('code', slotProps.data) }}</span>
            </template>
          </Column>
          <Column v-if="visibleColumns.includes('name')" field="name" header="名称" style="width: 10%">
            <template #body="slotProps">
              <span class="font-medium">{{ formatCell('name', slotProps.data) }}</span>
            </template>
          </Column>
          <Column v-if="visibleColumns.includes('specification')" field="specification" header="型号规格" style="width: 8%">
            <template #body="slotProps">
              <span>{{ formatCell('specification', slotProps.data) }}</span>
            </template>
          </Column>
          <Column v-if="visibleColumns.includes('unit')" field="unit" header="单位" style="width: 5%">
            <template #body="slotProps">
              <span>{{ formatCell('unit', slotProps.data) }}</span>
            </template>
          </Column>
          <Column v-if="visibleColumns.includes('unit_price')" field="unit_price" header="单价" style="width: 7%">
            <template #body="slotProps">
              <span class="block text-right tabular-nums">{{ formatCell('unit_price', slotProps.data) }}</span>
            </template>
          </Column>
          <Column v-if="visibleColumns.includes('quantity')" field="quantity" header="数量" style="width: 6%">
            <template #body="slotProps">
              <span class="block text-right tabular-nums">{{ formatCell('quantity', slotProps.data) }}</span>
            </template>
          </Column>
          <Column v-if="visibleColumns.includes('cost_price')" field="cost_price" header="成本价" style="width: 7%">
            <template #body="slotProps">
              <span class="block text-right tabular-nums">{{ formatCell('cost_price', slotProps.data) }}</span>
            </template>
          </Column>
          <Column v-if="visibleColumns.includes('total_price')" field="total_price" header="总价" style="width: 7%">
            <template #body="slotProps">
              <span class="block text-right tabular-nums">{{ formatCell('total_price', slotProps.data) }}</span>
            </template>
          </Column>
          <Column v-if="visibleColumns.includes('purchase_date')" field="purchase_date" header="采购日期" style="width: 8%">
            <template #body="slotProps">
              <span>{{ formatCell('purchase_date', slotProps.data) }}</span>
            </template>
          </Column>
          <Column v-if="visibleColumns.includes('warranty_date')" field="warranty_date" header="维保日期" style="width: 8%">
            <template #body="slotProps">
              <span>{{ formatCell('warranty_date', slotProps.data) }}</span>
            </template>
          </Column>
          <Column v-if="visibleColumns.includes('origin')" field="origin" header="产地" style="width: 7%">
            <template #body="slotProps">
              <span>{{ formatCell('origin', slotProps.data) }}</span>
            </template>
          </Column>
          <Column v-if="visibleColumns.includes('remark')" field="remark" header="备注" style="width: 10%">
            <template #body="slotProps">
              <span class="truncate block" :title="String(slotProps.data.remark || '')">{{ formatCell('remark', slotProps.data) }}</span>
            </template>
          </Column>
          <Column v-if="visibleColumns.includes('customer_name')" field="customer_name" header="客户" style="width: 8%">
            <template #body="slotProps">
              <span>{{ formatCell('customer_name', slotProps.data) }}</span>
            </template>
          </Column>
          <Column v-if="visibleColumns.includes('supplier_name')" field="supplier_name" header="供应商" style="width: 8%">
            <template #body="slotProps">
              <span>{{ formatCell('supplier_name', slotProps.data) }}</span>
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

      <ContextMenu ref="contextMenuRef" :model="contextMenuItems" />

      <div class="shrink-0 border-t border-[var(--content-border)] bg-transparent">
        <div class="flex items-center justify-between px-4 py-2">
          <div class="text-xs font-semibold text-[var(--content-text-secondary)] tracking-widest flex items-center gap-4">
            <span>
              显示
              {{ total ? Math.min((page - 1) * pageSize + 1, total) : 0 }}
              到
              {{ total ? Math.min(page * pageSize, total) : 0 }}
              共 {{ total }} 条
            </span>
            <span>
              本页合计
              数量：<span class="tabular-nums">{{ pageQuantitySumText }}</span>
              总价：<span class="tabular-nums">{{ pageTotalSumText }}</span>
            </span>
          </div>
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

    <ContractProductDialog v-model:visible="dialogVisible" :initialData="editingRow" @saved="onSaved" />
  </main>
</template>

<script setup lang="ts">
import { ref, computed, onBeforeUnmount, onMounted, watch } from 'vue'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Button from 'primevue/button'
import MultiSelect from 'primevue/multiselect'
import Paginator from 'primevue/paginator'
import ContextMenu from 'primevue/contextmenu'
import { useToast } from 'primevue/usetoast'
import { useConfirm } from 'primevue/useconfirm'
import Checkbox from 'primevue/checkbox'
import WindowControls from '../../../components/WindowControls.vue'
import ContractProductDialog from './components/ContractProductDialog.vue'
import type { ContractProduct, ContractProductQueryDTO, ContractProductSearchField } from '../../../../shared/types/contractProduct.types'
import { IdGenerator } from '../../../../shared/utils/idGenerator'
import type { ContractInfoEntity } from '../../../../shared/types/contractInfo.types'

const toast = useToast()
const confirm = useConfirm()

const tableData = ref<ContractProduct[]>([])
const loading = ref(false)
const total = ref(0)
const page = ref(1)
const pageSize = ref(10)
const searchQuery = ref('')
const selectedRows = ref<ContractProduct[]>([])
const contextMenuSelection = ref<ContractProduct | null>(null)
const dialogVisible = ref(false)
const editingRow = ref<ContractProduct | null>(null)
const contextMenuRef = ref<any>(null)

const CONTRACT_PRODUCT_COLUMNS_SETTING_KEY = 'contract_product_table_columns'
let contractProductColumnsSettingExists = false
let contractProductColumnsHydrating = true

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

const availableColumns: Array<{ field: keyof ContractProduct; header: string }> = [
  { field: 'contract_code', header: '合同编号' },
  { field: 'contract_name', header: '合同名称' },
  { field: 'code', header: '编码' },
  { field: 'name', header: '名称' },
  { field: 'specification', header: '型号规格' },
  { field: 'unit', header: '单位' },
  { field: 'unit_price', header: '单价' },
  { field: 'quantity', header: '数量' },
  { field: 'cost_price', header: '成本价' },
  { field: 'total_price', header: '总价' },
  { field: 'purchase_date', header: '采购日期' },
  { field: 'warranty_date', header: '维保日期' },
  { field: 'origin', header: '产地' },
  { field: 'remark', header: '备注' },
  { field: 'customer_name', header: '客户' },
  { field: 'supplier_name', header: '供应商' },
]

const defaultColumns = [
  'contract_code',
  'contract_name',
  'code',
  'name',
  'specification',
  'unit',
  'unit_price',
  'quantity',
  'total_price',
  'purchase_date',
  'warranty_date',
  'customer_name',
  'supplier_name',
] as Array<keyof ContractProduct>
const visibleColumns = ref<Array<keyof ContractProduct>>([...defaultColumns])

const maxPage = computed(() => Math.max(1, Math.ceil(total.value / pageSize.value)))

const pageQuantitySum = computed(() => {
  return tableData.value.reduce((sum, row) => sum + (Number(row.quantity ?? 0) || 0), 0)
})

const pageTotalSum = computed(() => {
  return tableData.value.reduce((sum, row) => sum + (Number(row.total_price ?? 0) || 0), 0)
})

const pageQuantitySumText = computed(() => {
  const v = pageQuantitySum.value
  return Number.isFinite(v) ? v.toFixed(2) : '0.00'
})

const pageTotalSumText = computed(() => {
  const v = pageTotalSum.value
  return Number.isFinite(v) ? v.toFixed(2) : '0.00'
})

const isAllSelected = computed(() => visibleColumns.value.length > 0 && visibleColumns.value.length === availableColumns.length)

const toggleSelectAll = (checked: boolean) => {
  if (checked) {
    visibleColumns.value = availableColumns.map(c => c.field)
  } else {
    visibleColumns.value = []
  }
}

function formatCell(field: keyof ContractProduct, row: ContractProduct) {
  const v = (row as any)[field]
  if (v === undefined || v === null || v === '') return '-'
  if (field === 'unit_price' || field === 'cost_price' || field === 'total_price') return Number(v).toFixed(2)
  if (field === 'quantity') return Number(v).toFixed(2)
  return v
}

const loadContractProductTableColumns = async () => {
  const db = window.electronAPI?.db
  if (!db) {
    contractProductColumnsHydrating = false
    return
  }
  try {
    const result = await db.getSetting(CONTRACT_PRODUCT_COLUMNS_SETTING_KEY)
    if (result.success && result.data?.value) {
      contractProductColumnsSettingExists = true
      const parsed = JSON.parse(result.data.value) as unknown
      if (Array.isArray(parsed)) {
        const allowed = new Set(availableColumns.map(c => String(c.field)))
        const next = parsed.map(String).filter((f) => allowed.has(String(f)))
        visibleColumns.value = (next.length ? next : defaultColumns) as Array<keyof ContractProduct>
      }
      contractProductColumnsHydrating = false
      return
    }
  } catch {
  }

  const legacy = localStorage.getItem(CONTRACT_PRODUCT_COLUMNS_SETTING_KEY)
  if (legacy) {
    try {
      const parsed = JSON.parse(legacy) as unknown
      if (Array.isArray(parsed)) {
        const allowed = new Set(availableColumns.map(c => String(c.field)))
        const next = parsed.map(String).filter((f) => allowed.has(String(f)))
        visibleColumns.value = (next.length ? next : defaultColumns) as Array<keyof ContractProduct>
      }
      await saveContractProductTableColumns()
      localStorage.removeItem(CONTRACT_PRODUCT_COLUMNS_SETTING_KEY)
    } catch {
    }
  }
  contractProductColumnsHydrating = false
}

const saveContractProductTableColumns = async () => {
  const db = window.electronAPI?.db
  if (!db) return
  const json = JSON.stringify(visibleColumns.value)
  if (contractProductColumnsSettingExists) {
    await db.updateSetting(CONTRACT_PRODUCT_COLUMNS_SETTING_KEY, json, '合同产品表格显示列')
    return
  }
  await db.insertSetting(CONTRACT_PRODUCT_COLUMNS_SETTING_KEY, json, '合同产品表格显示列')
  contractProductColumnsSettingExists = true
}

async function loadData() {
  loading.value = true
  try {
    const query: ContractProductQueryDTO = {
      page: page.value,
      pageSize: pageSize.value,
      search: searchQuery.value.trim() || undefined,
      searchFields: ['contract_code','contract_name','code','name','specification','unit','purchase_date','warranty_date','customer_name','supplier_name','origin','remark'] as ContractProductSearchField[],
    }
    const res = await window.electronAPI.contractProduct.getList(query)
    if (!res.success) {
      tableData.value = []
      total.value = 0
      toast.add({ severity: 'error', summary: '加载失败', detail: res.error || '获取合同产品列表失败', life: 3000 })
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

function editRow(row: ContractProduct) {
  editingRow.value = row
  dialogVisible.value = true
}

async function batchDeleteRows(rows?: ContractProduct[]) {
  const targetRows = (rows && rows.length ? rows : selectedRows.value).filter((row) => row?.id)
  if (!targetRows.length) return

  const ids = targetRows.map((row) => String(row.id))
  confirm.require({
    message: `确定要删除选中的 ${ids.length} 条合同产品记录吗？该操作不可恢复。`,
    header: '删除确认',
    icon: 'pi pi-exclamation-triangle',
    acceptLabel: '删除',
    rejectLabel: '取消',
    acceptClass: 'p-button-danger',
    accept: async () => {
      let failed = 0
      for (const id of ids) {
        const res = await window.electronAPI.contractProduct.delete(id)
        if (!res.success) failed += 1
      }
      if (failed > 0) {
        toast.add({ severity: 'warn', summary: '部分删除失败', detail: `成功 ${ids.length - failed} 条，失败 ${failed} 条`, life: 3000 })
      } else {
        toast.add({ severity: 'success', summary: '已删除', detail: `已删除 ${ids.length} 条合同产品记录`, life: 2000 })
      }
      selectedRows.value = []
      await loadData()
    },
  })
}

async function deleteRow(row: ContractProduct) {
  if (!row?.id) return
  await batchDeleteRows([row])
}

const contextMenuItems = computed(() => {
  const row = contextMenuSelection.value
  const selectedCount = selectedRows.value.length
  const items: any[] = []
  if (row && selectedCount <= 1) {
    items.push({
      label: '单个修改',
      icon: 'pi pi-pencil',
      command: () => editRow(row),
    })
  }
  items.push({
    label: selectedCount > 1 ? `批量删除（${selectedCount} 条）` : '删除',
    icon: 'pi pi-trash',
    command: () => {
      if (selectedCount > 1) {
        void batchDeleteRows()
      } else if (row) {
        void batchDeleteRows([row])
      }
    },
  })
  return items
})

const onRowContextMenu = (event: any) => {
  contextMenuSelection.value = event.data
  const exists = selectedRows.value.some((row) => String(row.id) === String(event.data?.id))
  if (!exists && event.data) {
    selectedRows.value = [event.data]
  }
  contextMenuRef.value?.show(event.originalEvent)
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

onMounted(async () => {
  await loadContractProductTableColumns()
  document.addEventListener('pointerdown', handleDocumentPointerDown, true)
  document.addEventListener('keydown', handleDocumentKeydown, true)
  await loadData()
})

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', handleDocumentPointerDown, true)
  document.removeEventListener('keydown', handleDocumentKeydown, true)
})

watch(visibleColumns, () => {
  if (contractProductColumnsHydrating) return
  void saveContractProductTableColumns()
}, { deep: true })
</script>
