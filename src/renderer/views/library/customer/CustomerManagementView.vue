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
          <h2 class="text-lg font-bold text-[var(--content-text)] tracking-tight whitespace-nowrap" style="-webkit-app-region: no-drag;">甲方单位</h2>
        </div>

        <div class="flex items-center gap-3" style="-webkit-app-region: no-drag;">
          <div class="relative w-[420px] max-w-[45vw] focus-within:ring-2 focus-within:ring-blue-500/20 rounded-lg">
            <i class="pi pi-search absolute left-3 top-1/2 -translate-y-1/2 text-[var(--content-text-secondary)] cursor-pointer" @click="handleSearch"></i>
            <input
              v-model="searchQuery"
              @keyup.enter="handleSearch"
              class="w-full bg-[var(--input-bg)] border border-[var(--input-border)] rounded-lg pl-9 pr-4 py-2 focus:outline-none focus:border-blue-500 text-[var(--content-text)] placeholder-[var(--content-text-secondary)] transition-colors"
              placeholder="搜索客户、联系人、电话..."
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

    <!-- Main Content Area -->
    <div class="flex-1 overflow-hidden p-6 bg-[var(--content-bg)]">
      <div class="h-full flex flex-col min-h-0">
        <div class="relative flex-1 min-h-0 overflow-y-auto">
            <div v-if="loading" class="absolute inset-0 flex items-center justify-center bg-[var(--content-bg)]/50 z-10 rounded-2xl backdrop-blur-sm">
              <ProgressSpinner style="width: 40px; height: 40px" strokeWidth="3" />
            </div>
            
            <div v-if="tableData.length === 0 && !loading" class="flex flex-col items-center justify-center h-full py-20 text-[var(--content-text-secondary)]">
              <i class="pi pi-inbox text-4xl mb-4 opacity-50"></i>
              <p>没有找到符合条件的客户</p>
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
                    v-model="selectedCustomerColumns"
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
                  <p>没有找到符合条件的客户</p>
                </div>
              </template>

              <Column v-if="selectedCustomerColumns.includes('code')" field="code" header="编号">
                <template #body="slotProps">
                  <span>{{ slotProps.data.code || '-' }}</span>
                </template>
              </Column>
              <Column v-if="selectedCustomerColumns.includes('name')" field="name" header="客户名称">
                <template #body="slotProps">
                  <button
                    type="button"
                    class="font-medium text-left hover:underline text-blue-600 dark:text-blue-400"
                    @click="openDetailDrawer(slotProps.data)"
                    @dblclick.stop.prevent="openUnitLibrary(slotProps.data)"
                  >
                    {{ slotProps.data.name || '-' }}
                  </button>
                </template>
              </Column>
              <Column v-if="selectedCustomerColumns.includes('group_name')" field="group_name" header="分组">
                <template #body="slotProps">
                  <span>{{ slotProps.data.group_name || '未分组' }}</span>
                </template>
              </Column>
              <Column v-if="selectedCustomerColumns.includes('contact')" field="contact" header="联系人">
                <template #body="slotProps">
                  <span>{{ slotProps.data.contact || '-' }}</span>
                </template>
              </Column>
              <Column v-if="selectedCustomerColumns.includes('mobile')" field="mobile" header="手机">
                <template #body="slotProps">
                  <span>{{ slotProps.data.mobile || '-' }}</span>
                </template>
              </Column>
              <Column v-if="selectedCustomerColumns.includes('phone')" field="phone" header="电话">
                <template #body="slotProps">
                  <span>{{ slotProps.data.phone || '-' }}</span>
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
                v-for="customer in tableData"
                :key="customer.id"
                class="group bg-[var(--content-card-bg)] rounded-2xl p-6 shadow-sm hover:shadow-md transition-all duration-300 border border-[var(--content-border)] relative overflow-hidden flex flex-col cursor-pointer"
                :class="selectedRow?.id === customer.id ? '!border-blue-500 ring-2 ring-blue-500/30' : ''"
                @click="selectedRow = customer"
                @dblclick="openUnitLibrary(customer)"
              >
                <div class="mb-4">
                  <div class="flex justify-between items-start">
                    <div class="flex items-center gap-3 min-w-0">
                      <Tag :value="customer.group_name || '未分组'" severity="info" class="!!px-2.5 !py-1 !rounded-full shrink-0" />
                      <span class="text-[var(--content-text-secondary)] uppercase tracking-wider block leading-none truncate" :title="customer.code">{{ customer.code }}</span>
                    </div>
                    <div class="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-2">
                    <button @click.stop="copyCustomerInfo(customer)" class="p-1.5 text-[var(--content-text-secondary)] hover:text-green-600 hover:bg-green-50 dark:hover:bg-green-900/30 rounded-lg transition-all" title="复制信息">
                      <i class="pi pi-copy text-base"></i>
                    </button>
                    <button @click.stop="editRow(customer)" class="p-1.5 text-[var(--content-text-secondary)] hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-all" title="编辑">
                      <i class="pi pi-file-edit text-base"></i>
                    </button>
                    <button @click.stop="deleteRow(customer)" class="p-1.5 text-[var(--content-text-secondary)] hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-all" title="删除">
                      <i class="pi pi-trash text-base"></i>
                    </button>
                    <button @click.stop="openDetailDrawer(customer)" class="p-1.5 text-[var(--content-text-secondary)] hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-all" title="查看详情">
                      <i class="pi pi-eye text-base"></i>
                    </button>
                    <button @click.stop="openUnitLibrary(customer)" class="p-1.5 text-[var(--content-text-secondary)] hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/30 rounded-lg transition-all" title="进入资料库">
                      <i class="pi pi-folder-open text-base"></i>
                    </button>
                  </div>
                  </div>
                  <button
                    type="button"
                    class="mt-2 font-bold text-left text-[var(--content-text)] group-hover:text-blue-600 transition-colors line-clamp-2 hover:underline"
                    :title="customer.name"
                    @click.stop="openDetailDrawer(customer)"
                    @dblclick.stop.prevent="openUnitLibrary(customer)"
                  >
                    {{ customer.name }}
                  </button>
                </div>

                <div class="grid grid-cols-2 gap-4 mb-6">
                  <div class="flex items-center gap-2 text-[var(--content-text)]">
                    <i class="pi pi-user text-lg text-blue-500 opacity-60"></i>
                    <span class="font-bold truncate" :title="customer.contact" v-if="customer.contact">{{ customer.contact }}</span>
                    <span class="italic text-[var(--content-text-muted)]" v-else>未填写联系人</span>
                  </div>
                  <div class="flex items-center gap-2 text-[var(--content-text)]">
                    <i class="pi pi-mobile text-lg text-blue-500 opacity-60"></i>
                    <span class="font-medium truncate" :title="customer.mobile" v-if="customer.mobile">{{ customer.mobile }}</span>
                    <span class="italic text-[var(--content-text-muted)]" v-else>未填写手机</span>
                  </div>
                  <div class="flex items-center gap-2 text-[var(--content-text)]">
                    <i class="pi pi-phone text-lg text-blue-500 opacity-60"></i>
                    <span class="font-medium truncate" :title="customer.phone" v-if="customer.phone">{{ customer.phone }}</span>
                    <span class="italic text-[var(--content-text-muted)]" v-else>未填写电话</span>
                  </div>
                </div>

                <div class="p-4 bg-[var(--sidebar-bg)] rounded-xl space-y-3 mb-3">
                  <div class="flex items-start gap-2">
                    <i class="pi pi-building text-lg text-[var(--content-text-secondary)] mt-0.5"></i>
                    <div class="flex flex-col overflow-hidden">
                      <span class="font-bold text-[var(--content-text-secondary)] uppercase tracking-tight">公司类型</span>
                      <span class="font-medium text-[var(--content-text)] truncate" :title="customer.company_type" v-if="customer.company_type">{{ customer.company_type }}</span>
                      <span class="font-medium text-[var(--content-text-secondary)] italic" v-else>未填写</span>
                    </div>
                  </div>
                  <div class="flex items-start gap-2">
                    <i class="pi pi-map-marker text-lg text-[var(--content-text-secondary)] mt-0.5"></i>
                    <div class="flex flex-col overflow-hidden">
                      <span class="font-bold text-[var(--content-text-secondary)] uppercase tracking-tight">联系地址</span>
                      <span class="font-medium text-[var(--content-text)] line-clamp-2" :title="customer.address" v-if="customer.address">{{ customer.address }}</span>
                      <span class="font-medium text-[var(--content-text-secondary)] italic" v-else>未填写</span>
                    </div>
                  </div>
                </div>


              </div>
            </div>
          </div>

          <!-- Pagination -->
        <div class="flex items-center justify-between py-4 border-t border-[var(--content-border)] shrink-0">
            <span class="font-bold text-[var(--content-text-secondary)] uppercase tracking-widest">
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
    <CustomerDialog
      v-model:visible="dialogVisible"
      :isEdit="isEditMode"
      :initialData="editingData"
      :groupOptions="dialogGroupOptions"
      @save="handleDialogSave"
    />

    <!-- 详情抽屉 -->
    <CustomerDetailDrawer
      v-model="detailDrawerVisible"
      :customerData="detailData"
      @edit="editRow"
      @open-library="openUnitLibrary"
    />
  </main>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import CustomerDialog from './components/CustomerDialog.vue'
import CustomerDetailDrawer from './components/CustomerDetailDrawer.vue'
import { Customer, CustomerQueryDTO } from '../../../../shared/types/customer.types'
import { createRendererLogger } from '@/utils/logger'
import WindowControls from '../../../components/WindowControls.vue'
import { formatCustomerInfoForClipboard } from './utils/clipboard'
import { buildUnitLibraryRouteLocation } from '../unit-library/unitLibrary'
const logger = createRendererLogger('CustomerManagement')
const route = useRoute()
const router = useRouter()
import ProgressSpinner from 'primevue/progressspinner'
import Button from 'primevue/button'
import Column from 'primevue/column'
import DataTable from 'primevue/datatable'
import Paginator from 'primevue/paginator'
import Tag from 'primevue/tag'
import { useToast } from 'primevue/usetoast'
import { useConfirm } from 'primevue/useconfirm'
import MultiSelect from 'primevue/multiselect'
const toast = useToast()
const confirm = useConfirm()
type ViewMode = 'list' | 'card'
const VIEW_MODE_SETTING_KEY = 'customer_management_view_mode'
const viewMode = ref<ViewMode>('card')
const CUSTOMER_COLUMNS_SETTING_KEY = 'customer_table_columns'
let customerColumnsSettingExists = false
let customerColumnsHydrating = true
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
  await loadCustomerTableColumns()
  await loadGroupOptions()
  await loadData()
})

const dialogGroupOptions = ref<{ name: string }[]>([])

const loadGroupOptions = async () => {
  const set = new Set<string>()
  try {
    const res = await window.electronAPI.customer.getList({ page: 1, pageSize: 10000, useGroupFilter: false })
    if (res.success && res.data?.data) {
      for (const customer of res.data.data) {
        const name = String(customer.group_name || '').trim()
        if (name) set.add(name)
      }
    }
  } catch (error) {
    logger.error('Failed to load customer group options', error)
  }
  dialogGroupOptions.value = Array.from(set)
    .sort((a, b) => a.localeCompare(b, 'zh-CN'))
    .map((name) => ({ name }))
}

const searchFields = ref([
  { name: '名称', code: 'name', checked: false },
  { name: '编号', code: 'code', checked: false },
  { name: '联系人', code: 'contact', checked: false },
  { name: '手机', code: 'mobile', checked: false },
  { name: '电话', code: 'phone', checked: false },
  { name: '详细地址', code: 'address', checked: false }
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

const tableData = ref<Customer[]>([])
const selectedRow = ref<Customer | null>(null)
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
    const query: CustomerQueryDTO = {
      page: pagination.value.page,
      pageSize: pagination.value.pageSize,
      useGroupFilter: false,
      ...(search ? { search } : {})
    }
    
    const activeFields = searchFields.value.filter(f => f.checked).map(f => f.code)
    if (activeFields.length > 0) {
      query.searchFields = activeFields
    } else {
      query.searchFields = ['name', 'code', 'contact', 'phone', 'mobile']
    }
    
    const res = await window.electronAPI.customer.getList(query)
    if (res.success && res.data) {
      tableData.value = res.data.data
      pagination.value.total = res.data.total
      if (selectedRow.value && !tableData.value.some((c) => c.id === selectedRow.value?.id)) {
        selectedRow.value = null
      }
    }
  } catch (error) {
    logger.error('Failed to load customers', error)
  } finally {
    loading.value = false
  }
}

const availableColumns = [
  { field: 'code', header: '编号' },
  { field: 'name', header: '客户名称' },
  { field: 'group_name', header: '分组' },
  { field: 'contact', header: '联系人' },
  { field: 'mobile', header: '手机' },
  { field: 'phone', header: '电话' },
]
const defaultColumns = availableColumns.map((c) => c.field)
const selectedCustomerColumns = ref<string[]>([...defaultColumns])

const saveCustomerTableColumns = async () => {
  const db = window.electronAPI?.db
  if (!db) return
  const json = JSON.stringify(selectedCustomerColumns.value)
  if (customerColumnsSettingExists) {
    await db.updateSetting(CUSTOMER_COLUMNS_SETTING_KEY, json, '客户管理列表显示列')
    return
  }
  await db.insertSetting(CUSTOMER_COLUMNS_SETTING_KEY, json, '客户管理列表显示列')
  customerColumnsSettingExists = true
}

const loadCustomerTableColumns = async () => {
  const db = window.electronAPI?.db
  if (!db) {
    customerColumnsHydrating = false
    return
  }
  try {
    const result = await db.getSetting(CUSTOMER_COLUMNS_SETTING_KEY)
    if (result.success && result.data?.value) {
      customerColumnsSettingExists = true
      const parsed = JSON.parse(result.data.value) as unknown
      if (Array.isArray(parsed)) {
        selectedCustomerColumns.value = parsed.map(String)
      }
      customerColumnsHydrating = false
      return
    }
  } catch {
  }

  const legacy = localStorage.getItem(CUSTOMER_COLUMNS_SETTING_KEY)
  if (legacy) {
    try {
      const parsed = JSON.parse(legacy) as unknown
      if (Array.isArray(parsed)) {
        selectedCustomerColumns.value = parsed.map(String)
      }
      await saveCustomerTableColumns()
      localStorage.removeItem(CUSTOMER_COLUMNS_SETTING_KEY)
    } catch {
    }
  }
  customerColumnsHydrating = false
}

watch(selectedCustomerColumns, () => {
  if (customerColumnsHydrating) return
  void saveCustomerTableColumns()
}, { deep: true })
const dialogVisible = ref(false)
const isEditMode = ref(false)
const editingData = ref<Customer | null>(null)

const detailDrawerVisible = ref(false)
const detailData = ref<Customer | null>(null)

const openAddDialog = () => {
  isEditMode.value = false
  editingData.value = null
  dialogVisible.value = true
}

const handleDialogSave = () => {
  void loadGroupOptions()
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

const openUnitLibrary = async (row: Customer | null) => {
  const unitId = String(row?.id || '').trim()
  if (!unitId) return
  await router.push(buildUnitLibraryRouteLocation('party-a', unitId))
}

const copyCustomerInfo = async (customer: Customer) => {
  const textToCopy = formatCustomerInfoForClipboard(customer)
  
  try {
    await navigator.clipboard.writeText(textToCopy)
    toast.add({ severity: 'success', summary: '复制成功', detail: '客户信息已复制到剪贴板', life: 2000 })
  } catch (err) {
    logger.error('Failed to copy to clipboard', err)
    toast.add({ severity: 'error', summary: '复制失败', detail: '请手动复制', life: 3000 })
  }
}

const deleteRow = async (row: Customer | null) => {
  if (!row) return
  confirm.require({
    message: `确定要删除客户 ${row.name} 吗？此操作不可撤销。`,
    header: '删除确认',
    icon: 'pi pi-exclamation-triangle',
    acceptClass: 'p-button-danger',
    acceptLabel: '删除',
    rejectClass: 'p-button-text',
    rejectLabel: '取消',
    accept: async () => {
      try {
        const res = await window.electronAPI.customer.delete(row.id)
        if (res.success) {
          toast.add({ severity: 'success', summary: '成功', detail: '已删除', life: 3000 })
          if (selectedRow.value?.id === row.id) {
            selectedRow.value = null
          }
          await loadGroupOptions()
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
</style>
