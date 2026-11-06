<template>
  <main class="flex flex-col h-full overflow-hidden bg-[var(--content-bg)] text-[var(--content-text)]">
    <header class="flex items-center justify-between px-6 h-16 shrink-0 bg-[var(--content-bg)]/80 backdrop-blur-md border-b border-[var(--content-border)] z-40" style="-webkit-app-region: drag;">
      <div class="flex items-center flex-1 gap-4">
        <div class="flex items-center gap-3">
          <button
            @click="$router.back()"
            class="p-2 rounded-lg transition-colors hover:bg-[var(--sidebar-hover-bg)] text-[var(--content-text-secondary)]"
            style="-webkit-app-region: no-drag;"
          >
            <i class="pi pi-arrow-left"></i>
          </button>
          <div class="w-px h-5 bg-[var(--content-border)]"></div>
          <h2 class="text-lg font-bold text-[var(--content-text)] tracking-tight whitespace-nowrap" style="-webkit-app-region: no-drag;">乙方单位</h2>
        </div>
        <div class="flex items-center gap-3" style="-webkit-app-region: no-drag;">
          <div class="relative w-[420px] max-w-[45vw] focus-within:ring-2 focus-within:ring-blue-500/20 rounded-lg">
            <i class="pi pi-search absolute left-3 top-1/2 -translate-y-1/2 text-[var(--content-text-secondary)] cursor-pointer" @click="handleSearch"></i>
            <input
              v-model="searchQuery"
              @keyup.enter="handleSearch"
              class="w-full bg-[var(--input-bg)] border border-[var(--input-border)] rounded-lg pl-9 pr-4 py-2 focus:outline-none focus:border-blue-500 text-[var(--content-text)] placeholder-[var(--content-text-secondary)] transition-colors"
              placeholder="搜索供应商、联系人、电话..."
              type="text"
            />
          </div>
        </div>
        <div class="flex-1 h-full"></div>
      </div>

      <div class="flex items-center gap-2" style="-webkit-app-region: no-drag;">
        <div class="flex items-center gap-2 pr-2">
          <Button icon="pi pi-plus" class="p-button-sm p-button-secondary p-button-text !w-8 !h-8 !p-0 custom-icon-btn" v-tooltip.bottom="'新增'" @click="openAddDialog" />
          <Button icon="pi pi-trash" class="p-button-sm p-button-secondary p-button-text !w-8 !h-8 !p-0 custom-icon-btn hover:!bg-red-50 hover:!text-red-500 dark:hover:!bg-red-900/30" v-tooltip.bottom="'删除'" :disabled="!selectedRow" @click="deleteRow(selectedRow)" />
          <Button icon="pi pi-download" class="p-button-sm p-button-secondary p-button-text !w-8 !h-8 !p-0 custom-icon-btn" v-tooltip.bottom="'导出'" @click="handleExport" />
          <Button
            icon="pi pi-list"
            class="p-button-sm p-button-secondary p-button-text !w-8 !h-8 !p-0 custom-icon-btn"
            :class="viewMode === 'list' ? '!bg-[var(--sidebar-active-bg)] !text-blue-600' : ''"
            v-tooltip.bottom="'列表'"
            @click="setViewMode('list')"
          />
          <Button
            icon="pi pi-th-large"
            class="p-button-sm p-button-secondary p-button-text !w-8 !h-8 !p-0 custom-icon-btn"
            :class="viewMode === 'card' ? '!bg-[var(--sidebar-active-bg)] !text-blue-600' : ''"
            v-tooltip.bottom="'卡片'"
            @click="setViewMode('card')"
          />
        </div>
        <WindowControls />
      </div>
    </header>

    <div class="flex-1 overflow-hidden p-6 bg-[var(--content-bg)]">
      <div class="h-full flex flex-col min-h-0">
        <div class="relative flex-1 min-h-0 overflow-y-auto">
          <div v-if="loading" class="absolute inset-0 flex items-center justify-center bg-[var(--content-bg)]/50 z-10 rounded-2xl backdrop-blur-sm">
            <ProgressSpinner style="width: 40px; height: 40px" strokeWidth="3" />
          </div>
          
          <div v-if="tableData.length === 0 && !loading" class="flex flex-col items-center justify-center h-full py-20 text-[var(--content-text-secondary)]">
            <i class="pi pi-inbox text-4xl mb-4 opacity-50"></i>
            <p>没有找到符合条件的供应商</p>
          </div>

          <DataTable
            v-else-if="viewMode === 'list'"
            :value="tableData"
            v-model:selection="selectedRow"
            dataKey="id"
            :loading="loading"
            class="custom-datatable p-datatable-sm"
            stripedRows
            selectionMode="single"
            @row-click="(e) => (selectedRow = e.data)"
            @row-dblclick="(e) => openUnitLibrary(e.data)"
          >
            <template #header>
              <div class="flex justify-end pb-2">
                <MultiSelect
                  v-model="selectedSupplierColumns"
                  :options="availableColumns"
                  optionLabel="header"
                  optionValue="field"
                  placeholder="选择显示的列"
                  selectedItemsLabel="已选择 {0} 项"
                  :showToggleAll="false"
                  :maxSelectedLabels="2"
                  class="w-full md:w-64 bg-transparent"
                />
              </div>
            </template>
            <template #empty>
              <div class="flex flex-col items-center justify-center py-10 text-[var(--content-text-secondary)]">
                <i class="pi pi-inbox text-3xl mb-3 opacity-50"></i>
                <p>没有找到符合条件的供应商</p>
              </div>
            </template>

            <Column v-if="selectedSupplierColumns.includes('code')" field="code" header="编号">
              <template #body="slotProps">
                <span>{{ slotProps.data.code || '-' }}</span>
              </template>
            </Column>
            <Column v-if="selectedSupplierColumns.includes('name')" field="name" header="供应商名称">
              <template #body="slotProps">
                <span
                  class="font-medium cursor-pointer hover:underline hover:text-blue-600"
                  @click.stop="openDetailDrawer(slotProps.data)"
                  @dblclick.stop.prevent="openUnitLibrary(slotProps.data)"
                >{{ slotProps.data.name || '-' }}</span>
              </template>
            </Column>
            <Column v-if="selectedSupplierColumns.includes('contact')" field="contact" header="联系人">
              <template #body="slotProps">
                <span>{{ slotProps.data.contact || '-' }}</span>
              </template>
            </Column>
            <Column v-if="selectedSupplierColumns.includes('phone')" field="phone" header="电话">
              <template #body="slotProps">
                <span>{{ slotProps.data.phone || '-' }}</span>
              </template>
            </Column>
            <Column v-if="selectedSupplierColumns.includes('bank_name')" field="bank_name" header="开户行">
              <template #body="slotProps">
                <span>{{ slotProps.data.bank_name || '-' }}</span>
              </template>
            </Column>
            <Column header="操作" :exportable="false" style="min-width: 9rem">
              <template #body="slotProps">
                <div class="flex gap-2">
                  <Button icon="pi pi-pencil" class="p-button-text p-button-sm p-button-rounded" v-tooltip.bottom="'编辑'" @click="editRow(slotProps.data)" />
                  <Button icon="pi pi-eye" class="p-button-text p-button-sm p-button-rounded" v-tooltip.bottom="'查看详情'" @click="openDetailDrawer(slotProps.data)" />
                  <Button icon="pi pi-folder-open" class="p-button-text p-button-sm p-button-rounded" v-tooltip.bottom="'进入资料库'" @click="openUnitLibrary(slotProps.data)" />
                  <Button icon="pi pi-trash" class="p-button-text p-button-sm p-button-rounded p-button-danger" v-tooltip.bottom="'删除'" @click="deleteRow(slotProps.data)" />
                </div>
              </template>
            </Column>
          </DataTable>

          <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6">
              <div
                v-for="supplier in tableData"
                :key="supplier.id"
                class="group bg-[var(--content-card-bg)] rounded-2xl p-6 shadow-sm hover:shadow-md transition-all duration-300 border border-[var(--content-border)] relative overflow-hidden flex flex-col cursor-pointer"
                :class="selectedRow?.id === supplier.id ? '!border-blue-500 ring-2 ring-blue-500/30' : ''"
                @click="selectedRow = supplier"
                @dblclick="openUnitLibrary(supplier)"
              >
                <div class="flex justify-between items-start mb-4">
                  <div class="space-y-1 overflow-hidden">
                    <span class="text-[var(--content-text-secondary)] uppercase tracking-wider">{{ supplier.code }}</span>
                    <h3
                      class="text-xl font-bold text-[var(--content-text)] group-hover:text-blue-600 transition-colors line-clamp-1 cursor-pointer hover:underline"
                      :title="supplier.name"
                      @click.stop="openDetailDrawer(supplier)"
                      @dblclick.stop.prevent="openUnitLibrary(supplier)"
                    >{{ supplier.name }}</h3>
                  </div>
                  <div class="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-2">
                    <button @click.stop="copySupplierInfo(supplier)" class="p-1.5 text-[var(--content-text-secondary)] hover:text-green-600 hover:bg-green-50 dark:hover:bg-green-900/30 rounded-lg transition-all" title="复制信息">
                      <i class="pi pi-copy text-base"></i>
                    </button>
                    <button @click.stop="editRow(supplier)" class="p-1.5 text-[var(--content-text-secondary)] hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-all" title="编辑">
                      <i class="pi pi-file-edit text-base"></i>
                    </button>
                    <button @click.stop="deleteRow(supplier)" class="p-1.5 text-[var(--content-text-secondary)] hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-all" title="删除">
                      <i class="pi pi-trash text-base"></i>
                    </button>
                    <button @click.stop="openDetailDrawer(supplier)" class="p-1.5 text-[var(--content-text-secondary)] hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-all" title="查看详情">
                      <i class="pi pi-eye text-base"></i>
                    </button>
                    <button @click.stop="openUnitLibrary(supplier)" class="p-1.5 text-[var(--content-text-secondary)] hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/30 rounded-lg transition-all" title="进入资料库">
                      <i class="pi pi-folder-open text-base"></i>
                    </button>
                  </div>
                </div>

                <div class="grid grid-cols-2 gap-4 mb-6">
                  <div class="flex items-center gap-2 text-[var(--content-text)]">
                    <i class="pi pi-user text-lg text-blue-500 opacity-60"></i>
                    <span class=" font-bold truncate" :title="supplier.contact" v-if="supplier.contact">{{ supplier.contact }}</span>
                    <span class=" italic text-[var(--content-text-muted)]" v-else>未填写联系人</span>
                  </div>
                  <div class="flex items-center gap-2 text-[var(--content-text)]">
                    <i class="pi pi-phone text-lg text-blue-500 opacity-60"></i>
                    <span class=" font-medium truncate" :title="supplier.phone" v-if="supplier.phone">{{ supplier.phone }}</span>
                    <span class=" italic text-[var(--content-text-muted)]" v-else>未填写电话</span>
                  </div>
                </div>

                <div class="p-4 bg-[var(--sidebar-bg)] rounded-xl space-y-3 mb-3">
                  <div class="flex items-start gap-2">
                    <i class="pi pi-building-columns text-lg text-[var(--content-text-secondary)] mt-0.5"></i>
                    <div class="flex flex-col overflow-hidden">
                      <span class=" text-[var(--content-text-secondary)] uppercase font-bold tracking-tight">银行账户</span>
                      <span class=" font-bold text-[var(--content-text)] truncate" :title="supplier.bank_account" v-if="supplier.bank_account">{{ supplier.bank_account }}</span>
                      <span class=" font-medium text-[var(--content-text-secondary)] italic" v-else>未提供银行信息</span>
                      <span class=" text-[var(--content-text-secondary)] truncate" :title="supplier.bank_name" v-if="supplier.bank_name">{{ supplier.bank_name }}</span>
                    </div>
                  </div>
                  <div class="flex items-start gap-2">
                    <i class="pi pi-map-marker text-lg text-[var(--content-text-secondary)] mt-0.5"></i>
                    <div class="flex flex-col overflow-hidden">
                      <span class=" text-[var(--content-text-secondary)] uppercase font-bold tracking-tight">单位地址</span>
                      <span class=" font-medium text-[var(--content-text)] line-clamp-2" :title="supplier.address" v-if="supplier.address">{{ supplier.address }}</span>
                      <span class=" font-medium text-[var(--content-text-secondary)] italic" v-else>未填写地址</span>
                    </div>
                  </div>
                </div>


              </div>
            </div>
          </div>

          <!-- Pagination -->
          <div class="flex items-center justify-between py-4 border-t border-[var(--content-border)] shrink-0">
            <span class=" font-bold text-[var(--content-text-secondary)] uppercase tracking-widest">
              显示 {{ Math.min((pagination.page - 1) * pagination.pageSize + 1, pagination.total || 1) }} 
              到 {{ Math.min(pagination.page * pagination.pageSize, pagination.total) }} 
              共 {{ pagination.total }} 条记录
            </span>
            <Paginator
              :first="(pagination.page - 1) * pagination.pageSize"
              :rows="pagination.pageSize"
              :totalRecords="pagination.total"
              :rowsPerPageOptions="[10, 20, 30, 50]"
              class="bg-transparent border-none custom-paginator !p-0"
              @page="onPageChange"
            ></Paginator>
          </div>
      </div>
    </div>

    <!-- 弹窗 -->
    <SupplierDialog
      v-model:visible="dialogVisible"
      :isEdit="isEditMode"
      :initialData="editingData"
      :groupOptions="dialogGroupOptions"
      @save="handleDialogSave"
    />
    
    <!-- 详情抽屉 -->
    <SupplierDetailDrawer
      v-model="detailDrawerVisible"
      :supplierData="detailData"
      @edit="editRow"
      @open-library="openUnitLibrary"
    />
  </main>
</template>

<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import SupplierDialog from './components/SupplierDialog.vue'
import SupplierDetailDrawer from './components/SupplierDetailDrawer.vue'
import { Supplier, SupplierQueryDTO } from '../../../../shared/types/supplier.types'
import { createRendererLogger } from '@/utils/logger'
import WindowControls from '../../../components/WindowControls.vue'
import { formatSupplierInfoForClipboard } from './utils/clipboard'
import { buildUnitLibraryRouteLocation } from '../unit-library/unitLibrary'

const logger = createRendererLogger('SupplierManagement')
const route = useRoute()
const router = useRouter()

import ProgressSpinner from 'primevue/progressspinner'
import Button from 'primevue/button'
import Column from 'primevue/column'
import DataTable from 'primevue/datatable'
import Paginator from 'primevue/paginator'
import { useToast } from 'primevue/usetoast'
import { useConfirm } from 'primevue/useconfirm'
import MultiSelect from 'primevue/multiselect'

const toast = useToast()
const confirm = useConfirm()

type ViewMode = 'list' | 'card'

const VIEW_MODE_SETTING_KEY = 'supplier_management_view_mode'
const viewMode = ref<ViewMode>('card')

const SUPPLIER_COLUMNS_SETTING_KEY = 'supplier_table_columns'
let supplierColumnsSettingExists = false
let supplierColumnsHydrating = true

const setViewMode = (mode: ViewMode) => {
  viewMode.value = mode
  localStorage.setItem(VIEW_MODE_SETTING_KEY, mode)
}

const handleExport = () => {
  toast.add({ severity: 'info', summary: '提示', detail: '当前版本暂未接入导出功能', life: 3000 })
}

onMounted(async () => {
  const savedMode = localStorage.getItem(VIEW_MODE_SETTING_KEY)
  if (savedMode === 'list' || savedMode === 'card') {
    viewMode.value = savedMode
  }

  await loadSupplierTableColumns()
  await loadData()
})

const dialogGroupOptions = computed(() => [
  { name: '采购供应商' },
  { name: '工程分包商' },
  { name: '其他供应商' }
])

// ─── 搜索区域状态 ──────────────────────────────────────────────────────────
const searchFields = ref([
  { name: '名称', code: 'name', checked: false },
  { name: '编号', code: 'code', checked: false },
  { name: '联系人', code: 'contact', checked: false },
  { name: '联系电话', code: 'phone', checked: false },
  { name: '公司地址', code: 'address', checked: false }
])
const searchQuery = ref('')
let searchDebounceTimer: number | undefined

const readQueryText = (value: unknown) => {
  if (typeof value === 'string') return value.trim()
  if (Array.isArray(value)) return String(value[0] || '').trim()
  return ''
}

watch(
  () => route.query.q,
  (v) => {
    const q = readQueryText(v)
    if (q !== searchQuery.value) {
      searchQuery.value = q
    }
  },
  { immediate: true }
)

const tableData = ref<Supplier[]>([])
const selectedRow = ref<Supplier | null>(null)
const loading = ref(false)
const pagination = ref({
  page: 1,
  pageSize: 20,
  total: 0
})

const onPageChange = (event: any) => {
  pagination.value.page = event.page + 1
  pagination.value.pageSize = event.rows
  loadData()
}

const handleSearch = () => {
  if (searchDebounceTimer !== undefined) {
    window.clearTimeout(searchDebounceTimer)
    searchDebounceTimer = undefined
  }
  pagination.value.page = 1
  loadData()
}

watch(searchQuery, () => {
  if (searchDebounceTimer !== undefined) window.clearTimeout(searchDebounceTimer)
  searchDebounceTimer = window.setTimeout(() => {
    pagination.value.page = 1
    loadData()
  }, 300)
})

const loadData = async () => {
  loading.value = true
  try {
    const search = searchQuery.value.trim()
    const query: SupplierQueryDTO = {
      page: pagination.value.page,
      pageSize: pagination.value.pageSize,
      ...(search ? { search } : {})
    }
    
    const activeFields = searchFields.value.filter(f => f.checked).map(f => f.code)
    if (activeFields.length > 0) {
      query.searchFields = activeFields
    } else {
      query.searchFields = ['name', 'code', 'contact', 'phone']
    }
    
    const res = await window.electronAPI.supplier.getList(query)
    if (res.success && res.data) {
      tableData.value = res.data.data
      pagination.value.total = res.data.total
      if (selectedRow.value && !tableData.value.some((supplier) => supplier.id === selectedRow.value?.id)) {
        selectedRow.value = null
      }
    }
  } catch (error) {
    logger.error('Failed to load suppliers', error)
  } finally {
    loading.value = false
  }
}

const availableColumns = [
  { field: 'code', header: '编号' },
  { field: 'name', header: '供应商名称' },
  { field: 'contact', header: '联系人' },
  { field: 'phone', header: '电话' },
  { field: 'bank_name', header: '开户行' },
]
const defaultColumns = availableColumns.map((c) => c.field)
const selectedSupplierColumns = ref<string[]>([...defaultColumns])

const saveSupplierTableColumns = async () => {
  const db = window.electronAPI?.db
  if (!db) return
  const json = JSON.stringify(selectedSupplierColumns.value)
  if (supplierColumnsSettingExists) {
    await db.updateSetting(SUPPLIER_COLUMNS_SETTING_KEY, json, '供应商管理列表显示列')
    return
  }
  await db.insertSetting(SUPPLIER_COLUMNS_SETTING_KEY, json, '供应商管理列表显示列')
  supplierColumnsSettingExists = true
}

const loadSupplierTableColumns = async () => {
  const db = window.electronAPI?.db
  if (!db) {
    supplierColumnsHydrating = false
    return
  }
  try {
    const result = await db.getSetting(SUPPLIER_COLUMNS_SETTING_KEY)
    if (result.success && result.data?.value) {
      supplierColumnsSettingExists = true
      const parsed = JSON.parse(result.data.value) as unknown
      if (Array.isArray(parsed)) {
        const allowed = new Set(availableColumns.map((c) => c.field))
        selectedSupplierColumns.value = parsed.map(String).filter((f) => allowed.has(f))
      }
      supplierColumnsHydrating = false
      return
    }
  } catch {
  }

  const legacy = localStorage.getItem(SUPPLIER_COLUMNS_SETTING_KEY)
  if (legacy) {
    try {
      const parsed = JSON.parse(legacy) as unknown
      if (Array.isArray(parsed)) {
        const allowed = new Set(availableColumns.map((c) => c.field))
        selectedSupplierColumns.value = parsed.map(String).filter((f) => allowed.has(f))
      }
      await saveSupplierTableColumns()
      localStorage.removeItem(SUPPLIER_COLUMNS_SETTING_KEY)
    } catch {
    }
  }
  supplierColumnsHydrating = false
}

watch(selectedSupplierColumns, () => {
  if (supplierColumnsHydrating) return
  void saveSupplierTableColumns()
}, { deep: true })
// ─── 弹窗控制 ──────────────────────────────────────────────────────────
const dialogVisible = ref(false)
const isEditMode = ref(false)
const editingData = ref<Supplier | null>(null)

// 详情抽屉状态
const detailDrawerVisible = ref(false)
const detailData = ref<Supplier | null>(null)

const openAddDialog = () => {
  isEditMode.value = false
  editingData.value = null
  dialogVisible.value = true
}

const handleDialogSave = () => {
  loadData()
}

const editRow = (row: any) => {
  if (row) {
    isEditMode.value = true
    editingData.value = row
    dialogVisible.value = true
  }
}

const openDetailDrawer = (row: any) => {
  if (row) {
    detailData.value = row
    detailDrawerVisible.value = true
  }
}

const openUnitLibrary = async (row: Supplier | null) => {
  const unitId = String(row?.id || '').trim()
  if (!unitId) return
  await router.push(buildUnitLibraryRouteLocation('party-b', unitId))
}

const copySupplierInfo = async (supplier: Supplier) => {
  const textToCopy = formatSupplierInfoForClipboard(supplier)
  
  try {
    await navigator.clipboard.writeText(textToCopy)
    toast.add({ severity: 'success', summary: '复制成功', detail: '供应商信息已复制到剪贴板', life: 2000 })
  } catch (err) {
    logger.error('Failed to copy to clipboard', err)
    toast.add({ severity: 'error', summary: '复制失败', detail: '请手动复制', life: 3000 })
  }
}

const deleteRow = async (row: Supplier | null) => {
  if (!row) return
  confirm.require({
    message: `确定要删除供应商 ${row.name} 吗？此操作不可撤销。`,
    header: '删除确认',
    icon: 'pi pi-exclamation-triangle',
    acceptClass: 'p-button-danger',
    acceptLabel: '删除',
    rejectClass: 'p-button-text',
    rejectLabel: '取消',
    accept: async () => {
      try {
        const res = await window.electronAPI.supplier.delete(row.id)
        if (res.success) {
          toast.add({ severity: 'success', summary: '成功', detail: '已删除', life: 3000 })
          if (selectedRow.value?.id === row.id) {
            selectedRow.value = null
          }
          loadData()
        } else {
          toast.add({ severity: 'error', summary: '删除失败', detail: res.error || '未知错误', life: 3000 })
        }
      } catch (error) {
        logger.error('Delete failed', error)
        toast.add({ severity: 'error', summary: '删除失败', detail: '出现异常', life: 3000 })
      }
    }
  })
}
</script>

<style scoped>
/* 自定义图标按钮悬停样式 */
.custom-icon-btn:hover {
  background-color: var(--sidebar-hover-bg) !important;
  color: var(--content-text) !important;
}

:deep(.custom-datatable) {
  background: transparent !important;
}

:deep(.custom-datatable .p-datatable-thead > tr > th) {
  background: var(--sidebar-bg) !important;
  color: var(--content-text-secondary) !important;
  border-color: var(--content-border) !important;
  font-weight: 600;
}

:deep(.custom-datatable .p-datatable-tbody > tr) {
  background: transparent !important;
  color: var(--content-text) !important;
}

:deep(.custom-datatable.p-datatable-striped .p-datatable-tbody > tr:nth-child(even)) {
  background: var(--sidebar-bg) !important;
}

:deep(.custom-datatable .p-datatable-tbody > tr:hover) {
  background: var(--sidebar-hover-bg) !important;
}

:deep(.custom-datatable .p-datatable-tbody > tr > td) {
  border-color: var(--content-border) !important;
}

:deep(.p-popover) {
  background: var(--content-bg) !important;
  border: 1px solid var(--content-border) !important;
  color: var(--content-text) !important;
}
:deep(.p-popover-content) {
  background: transparent !important;
  color: var(--content-text) !important;
}

:deep(.p-tree) {
  background: transparent !important;
  border: none !important;
}
:deep(.p-tree-root) {
  background: transparent !important;
}
:deep(.p-tree-root-children) {
  padding: 0 !important;
  background: transparent !important;
}
:deep(.p-tree-node) {
  width: 100%;
}
:deep(.p-tree-node-content) {
  padding: 0 !important;
  background: transparent !important;
  border-radius: 0.5rem;
  width: 100%;
  color: var(--content-text) !important;
}
:deep(.p-tree-node-label) {
  color: var(--content-text) !important;
}
:deep(.p-tree-node-content.p-tree-node-selectable:hover) {
  background-color: var(--sidebar-hover-bg) !important;
}
:deep(.p-tree-node-content.p-tree-node-selected) {
  background-color: var(--sidebar-active-bg) !important;
  color: var(--content-text) !important;
}
:deep(.p-tree-node-content.p-tree-node-selected .p-tree-node-icon) {
  color: var(--btn-primary-bg) !important;
}
:deep(.p-tree-node-toggle-button) {
  color: var(--content-text-secondary) !important;
}
:deep(.p-tree-node-icon) {
  color: var(--content-text-secondary) !important;
}
:deep(.p-tree-node-content.p-tree-node-selected .p-tree-node-toggle-button) {
  color: var(--btn-primary-bg) !important;
}

:deep(.custom-paginator) {
  background: var(--content-card-bg) !important;
  border: 1px solid var(--content-border) !important;
  border-radius: 12px !important;
}
:deep(.custom-paginator .p-paginator-page),
:deep(.custom-paginator .p-paginator-first),
:deep(.custom-paginator .p-paginator-prev),
:deep(.custom-paginator .p-paginator-next),
:deep(.custom-paginator .p-paginator-last) {
  color: var(--content-text) !important;
}
:deep(.custom-paginator .p-paginator-page.p-highlight) {
  background: var(--sidebar-active-bg) !important;
  color: var(--content-text) !important;
}
:deep(.custom-paginator .p-dropdown),
:deep(.custom-paginator .p-select) {
  background: var(--input-bg) !important;
  border-color: var(--input-border) !important;
  color: var(--input-text) !important;
}

:deep(.p-splitter-gutter) {
  background: #fff !important;
}
:deep(.p-splitter-gutter-handle) {
  background: #fff !important;
}
</style>
