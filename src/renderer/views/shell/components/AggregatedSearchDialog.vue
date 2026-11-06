<template>
  <Dialog
    v-model:visible="visibleProxy"
    modal
    header="聚合搜索"
    :style="{ width: '80vw' }"
    :closable="true"
    :draggable="true"
    class="theme-dialog"
  >
    <div class="flex flex-col gap-3">
      <div class="relative">
        <i class="pi pi-search absolute left-3 top-1/2 -translate-y-1/2 text-[var(--content-text-secondary)]"></i>
        <InputText
          ref="inputEl"
          v-model="query"
          class="w-full !pl-9 !bg-[var(--input-bg)] !border-[var(--input-border)] !text-[var(--content-text)] placeholder:!text-[var(--content-text-secondary)] focus:!border-[var(--btn-primary-bg)]"
          placeholder="搜索任意信息"
          @keydown.enter.prevent
        />
      </div>

      <TabView v-model:activeIndex="activeIndex">
        <TabPanel header="甲方单位">
          <ResultPanel
            :query="query"
            :loading="tabState.customers.loading"
            :error="tabState.customers.error"
            :items="tabState.customers.items"
            :total="tabState.customers.total"
            :hasMore="tabState.customers.hasMore"
            emptyText="暂无匹配客户"
            @loadMore="loadMore('customers')"
            @selectRow="selectRow('customers', $event)"
          >
            <DataTable
              :value="tabState.customers.items"
              dataKey="id"
              :scrollable="true"
              :virtualScrollerOptions="{ itemSize: 44 }"
              scrollHeight="420px"
              class="custom-datatable p-datatable-sm"
              stripedRows
              rowHover
              @row-click="(e) => selectRow('customers', e.data)"
            >
              <Column header="名称" field="name" style="min-width: 16rem" />
              <Column header="编号" field="code" style="width: 10rem" />
              <Column header="联系人" field="contact" style="min-width: 10rem" />
              <Column header="电话" field="mobile" style="min-width: 10rem" />
            </DataTable>
          </ResultPanel>
        </TabPanel>

        <TabPanel header="乙方单位">
          <ResultPanel
            :query="query"
            :loading="tabState.suppliers.loading"
            :error="tabState.suppliers.error"
            :items="tabState.suppliers.items"
            :total="tabState.suppliers.total"
            :hasMore="tabState.suppliers.hasMore"
            emptyText="暂无匹配供应商"
            @loadMore="loadMore('suppliers')"
            @selectRow="selectRow('suppliers', $event)"
          >
            <DataTable
              :value="tabState.suppliers.items"
              dataKey="id"
              :scrollable="true"
              :virtualScrollerOptions="{ itemSize: 44 }"
              scrollHeight="420px"
              class="custom-datatable p-datatable-sm"
              stripedRows
              rowHover
              @row-click="(e) => selectRow('suppliers', e.data)"
            >
              <Column header="名称" field="name" style="min-width: 16rem" />
              <Column header="编号" field="code" style="width: 10rem" />
              <Column header="联系人" field="contact" style="min-width: 10rem" />
              <Column header="电话" field="phone" style="min-width: 10rem" />
            </DataTable>
          </ResultPanel>
        </TabPanel>

        <TabPanel header="项目管理">
          <ResultPanel
            :query="query"
            :loading="tabState.projectManagement.loading"
            :error="tabState.projectManagement.error"
            :items="tabState.projectManagement.items"
            :total="tabState.projectManagement.total"
            :hasMore="tabState.projectManagement.hasMore"
            emptyText="暂无匹配项目"
            @loadMore="loadMore('projectManagement')"
            @selectRow="selectRow('projectManagement', $event)"
          >
            <DataTable
              :value="tabState.projectManagement.items"
              dataKey="id"
              :scrollable="true"
              :virtualScrollerOptions="{ itemSize: 44 }"
              scrollHeight="420px"
              class="custom-datatable p-datatable-sm"
              stripedRows
              rowHover
              @row-click="(e) => selectRow('projectManagement', e.data)"
            >
              <Column header="项目名称" field="name" style="min-width: 18rem" />
              <Column header="编号" field="code" style="width: 10rem" />
              <Column header="分组" field="group_name" style="min-width: 10rem" />
            </DataTable>
          </ResultPanel>
        </TabPanel>

        <TabPanel header="合同信息">
          <ResultPanel
            :query="query"
            :loading="tabState.contracts.loading"
            :error="tabState.contracts.error"
            :items="tabState.contracts.items"
            :total="tabState.contracts.total"
            :hasMore="tabState.contracts.hasMore"
            emptyText="暂无匹配合同"
            @loadMore="loadMore('contracts')"
            @selectRow="selectRow('contracts', $event)"
          >
            <DataTable
              :value="tabState.contracts.items"
              dataKey="id"
              :scrollable="true"
              :virtualScrollerOptions="{ itemSize: 44 }"
              scrollHeight="420px"
              class="custom-datatable p-datatable-sm"
              stripedRows
              rowHover
              @row-click="(e) => selectRow('contracts', e.data)"
            >
              <Column header="合同名称" field="contract_name" style="min-width: 18rem" />
              <Column header="合同编号" field="contract_code" style="width: 12rem" />
              <Column header="甲方" field="client_name" style="min-width: 12rem" />
              <Column header="乙方" field="party_b_name" style="min-width: 12rem" />
            </DataTable>
          </ResultPanel>
        </TabPanel>

        <TabPanel header="关联文件【关键词检索】">
          <ResultPanel
            :query="query"
            :loading="tabState.files.loading"
            :error="tabState.files.error"
            :items="tabState.files.items"
            :total="tabState.files.total"
            :hasMore="tabState.files.hasMore"
            emptyText="暂无匹配文件"
            @loadMore="loadMore('files')"
            @selectRow="selectRow('files', $event)"
          >
            <DataTable
              :value="tabState.files.items"
              dataKey="file_path"
              :scrollable="true"
              :virtualScrollerOptions="{ itemSize: 64 }"
              scrollHeight="420px"
              class="custom-datatable p-datatable-sm"
              stripedRows
              rowHover
              @row-click="(e) => selectRow('files', e.data)"
            >
              <Column header="路径" field="file_path" style="min-width: 24rem" />
              <Column header="摘要" field="snippet" style="min-width: 18rem" />
            </DataTable>
          </ResultPanel>
        </TabPanel>

        <TabPanel header="日历">
          <ResultPanel
            :query="query"
            :loading="tabState.calendar.loading"
            :error="tabState.calendar.error"
            :items="tabState.calendar.items"
            :total="tabState.calendar.total"
            :hasMore="tabState.calendar.hasMore"
            emptyText="暂无匹配事件"
            @loadMore="loadMore('calendar')"
            @selectRow="selectRow('calendar', $event)"
          >
            <DataTable
              :value="tabState.calendar.items"
              dataKey="id"
              :scrollable="true"
              :virtualScrollerOptions="{ itemSize: 44 }"
              scrollHeight="420px"
              class="custom-datatable p-datatable-sm"
              stripedRows
              rowHover
              @row-click="(e) => selectRow('calendar', e.data)"
            >
              <Column header="日期" field="event_date" style="width: 10rem" />
              <Column header="标题" field="title" style="min-width: 18rem" />
              <Column header="内容" field="content" style="min-width: 18rem" />
            </DataTable>
          </ResultPanel>
        </TabPanel>
      </TabView>
    </div>
  </Dialog>
</template>

<script setup lang="ts">
import { computed, defineComponent, h, nextTick, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useDebounceFn } from '@vueuse/core'
import Dialog from 'primevue/dialog'
import TabView from 'primevue/tabview'
import TabPanel from 'primevue/tabpanel'
import InputText from 'primevue/inputtext'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Button from 'primevue/button'
import ProgressSpinner from 'primevue/progressspinner'
import type { Customer } from '../../../../shared/types/customer.types'
import type { Supplier } from '../../../../shared/types/supplier.types'
import type { ProjectManagementItem } from '../../../../shared/types/projectManagement.types'
import type { ContractInfoEntity } from '../../../../shared/types/contractInfo.types'
import type { LibraryCalendarEventEntity } from '../../../../shared/types/libraryCalendarEvent.types'

type FileSearchRow = { file_path: string; snippet: string }

type TabKey = 'customers' | 'suppliers' | 'projectManagement' | 'contracts' | 'files' | 'calendar'

type TabState<T> = {
  loading: boolean
  error: string
  items: T[]
  total: number
  page: number
  pageSize: number
  hasMore: boolean
  lastQuery: string
  requestSeq: number
}

const props = defineProps<{
  visible: boolean
}>()

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void
}>()

const router = useRouter()

const visibleProxy = computed({
  get: () => props.visible,
  set: (v: boolean) => emit('update:visible', v),
})

const inputEl = ref<any>(null)
const query = ref('')
const activeIndex = ref(0)

const makeTabState = <T,>(pageSize: number): TabState<T> => ({
  loading: false,
  error: '',
  items: [],
  total: 0,
  page: 1,
  pageSize,
  hasMore: false,
  lastQuery: '',
  requestSeq: 0,
})

const tabState = ref({
  customers: makeTabState<Customer>(50),
  suppliers: makeTabState<Supplier>(50),
  projectManagement: makeTabState<ProjectManagementItem>(50),
  contracts: makeTabState<ContractInfoEntity>(50),
  files: makeTabState<FileSearchRow>(100),
  calendar: makeTabState<LibraryCalendarEventEntity>(200),
})

const activeTabKey = computed<TabKey>(() => {
  const idx = activeIndex.value
  if (idx === 0) return 'customers'
  if (idx === 1) return 'suppliers'
  if (idx === 2) return 'projectManagement'
  if (idx === 3) return 'contracts'
  if (idx === 4) return 'files'
  return 'calendar'
})

const close = () => {
  visibleProxy.value = false
}

const focusInput = async () => {
  await nextTick()
  const el = inputEl.value?.$el?.querySelector?.('input') || inputEl.value?.$el || inputEl.value
  if (el && typeof el.focus === 'function') el.focus()
}

watch(
  () => props.visible,
  async (v) => {
    if (v) await focusInput()
  }
)

onMounted(async () => {
  if (props.visible) await focusInput()
})

const libraryPath = computed(() => localStorage.getItem('currentLibraryPath') || '')

const resetTabForQuery = <T,>(state: TabState<T>, q: string) => {
  state.loading = false
  state.error = ''
  state.items = []
  state.total = 0
  state.page = 1
  state.hasMore = false
  state.lastQuery = q
}

const runCustomerQuery = async (q: string, append: boolean) => {
  const state = tabState.value.customers
  const current = ++state.requestSeq
  state.loading = true
  state.error = ''
  try {
    const res = await window.electronAPI.customer.getList({
      search: q,
      searchFields: ['name', 'contact', 'phone', 'mobile'],
      page: state.page,
      pageSize: state.pageSize,
    })
    if (current !== state.requestSeq) return
    if (!res?.success) throw new Error(res?.error || '查询客户失败')
    const rows = Array.isArray(res.data?.data) ? res.data.data : []
    const total = Number(res.data?.total || 0)
    state.total = total
    state.items = append ? [...state.items, ...rows] : rows
    state.hasMore = state.items.length < total
  } catch (e: any) {
    if (current !== state.requestSeq) return
    state.error = e?.message || '查询客户失败'
  } finally {
    if (current === state.requestSeq) state.loading = false
  }
}

const runSupplierQuery = async (q: string, append: boolean) => {
  const state = tabState.value.suppliers
  const current = ++state.requestSeq
  state.loading = true
  state.error = ''
  try {
    const res = await window.electronAPI.supplier.getList({
      search: q,
      searchFields: ['name', 'contact', 'phone'],
      page: state.page,
      pageSize: state.pageSize,
    })
    if (current !== state.requestSeq) return
    if (!res?.success) throw new Error(res?.error || '查询供应商失败')
    const rows = Array.isArray(res.data?.data) ? res.data.data : []
    const total = Number(res.data?.total || 0)
    state.total = total
    state.items = append ? [...state.items, ...rows] : rows
    state.hasMore = state.items.length < total
  } catch (e: any) {
    if (current !== state.requestSeq) return
    state.error = e?.message || '查询供应商失败'
  } finally {
    if (current === state.requestSeq) state.loading = false
  }
}

const runProjectManagementQuery = async (q: string, append: boolean) => {
  const state = tabState.value.projectManagement
  const current = ++state.requestSeq
  state.loading = true
  state.error = ''
  try {
    const res = await window.electronAPI.projectManagement.getList({
      search: q,
      searchField: 'all',
      page: state.page,
      pageSize: state.pageSize,
    })
    if (current !== state.requestSeq) return
    if (!res?.success) throw new Error(res?.error || '查询项目管理失败')
    const rows = Array.isArray(res.data?.data) ? res.data.data : []
    const total = Number(res.data?.total || 0)
    state.total = total
    state.items = append ? [...state.items, ...rows] : rows
    state.hasMore = state.items.length < total
  } catch (e: any) {
    if (current !== state.requestSeq) return
    state.error = e?.message || '查询项目管理失败'
  } finally {
    if (current === state.requestSeq) state.loading = false
  }
}

const runContractQuery = async (q: string, append: boolean) => {
  const state = tabState.value.contracts
  const current = ++state.requestSeq
  state.loading = true
  state.error = ''
  try {
    const lp = libraryPath.value
    if (!lp) throw new Error('请先选择资源库')
    const res = await window.electronAPI.library.queryContractInfos({
      libraryPath: lp,
      page: state.page,
      pageSize: state.pageSize,
      searchQuery: q,
      searchFields: ['contract_name', 'contract_type'],
    })
    if (current !== state.requestSeq) return
    if (!res?.success) throw new Error(res?.error || '查询合同失败')
    const rows = Array.isArray(res.data?.items) ? res.data.items : []
    const total = Number(res.data?.total || 0)
    state.total = total
    state.items = append ? [...state.items, ...rows] : rows
    state.hasMore = state.items.length < total
  } catch (e: any) {
    if (current !== state.requestSeq) return
    state.error = e?.message || '查询合同失败'
  } finally {
    if (current === state.requestSeq) state.loading = false
  }
}

const runFileQuery = async (q: string, append: boolean) => {
  const state = tabState.value.files
  const current = ++state.requestSeq
  state.loading = true
  state.error = ''
  try {
    const lp = libraryPath.value
    if (!lp) throw new Error('请先选择资源库')
    const limit = state.pageSize
    const offset = (state.page - 1) * state.pageSize
    const res = await window.electronAPI.search.fullTextInPath({
      query: q,
      baseDir: lp,
      recursive: true,
      ensureIndexed: true,
      limit,
      offset,
    })
    if (current !== state.requestSeq) return
    const rows = Array.isArray(res?.items) ? res.items : []
    const total = Number(res?.total || 0)
    state.total = total
    state.items = append ? [...state.items, ...rows] : rows
    state.hasMore = state.items.length < total
  } catch (e: any) {
    if (current !== state.requestSeq) return
    state.error = e?.message || '查询关联文件失败'
  } finally {
    if (current === state.requestSeq) state.loading = false
  }
}

const includesIgnoreCase = (source: string, q: string) => {
  const a = String(source || '').toLowerCase()
  const b = String(q || '').toLowerCase()
  return b ? a.includes(b) : true
}

const runCalendarQuery = async (q: string) => {
  const state = tabState.value.calendar
  const current = ++state.requestSeq
  state.loading = true
  state.error = ''
  try {
    const lp = libraryPath.value
    if (!lp) throw new Error('请先选择资源库')
    const now = new Date()
    const start = new Date(now.getFullYear(), now.getMonth() - 6, 1)
    const end = new Date(now.getFullYear(), now.getMonth() + 7, 0)
    
    // pad to 'YYYY-MM-DD' properly, using local time to avoid UTC shift
    const toYmd = (d: Date) => {
      const y = d.getFullYear()
      const m = String(d.getMonth() + 1).padStart(2, '0')
      const day = String(d.getDate()).padStart(2, '0')
      return `${y}-${m}-${day}`
    }

    let res = await window.electronAPI.library.getCalendarEvents({
      libraryPath: lp,
      startDate: toYmd(start),
      endDate: toYmd(end),
      includeDeleted: false,
    })
    if (current !== state.requestSeq) return
    if (!res?.success) throw new Error(res?.error || '查询日历事件失败')

    let rows = Array.isArray(res.data) ? res.data : []
    
    // Auto-rebuild if empty (same as CalendarView logic)
    if (!rows.length) {
      const rebuild = await window.electronAPI.library.rebuildCalendarEvents({ libraryPath: lp })
      if (rebuild?.success) {
        res = await window.electronAPI.library.getCalendarEvents({
          libraryPath: lp,
          startDate: toYmd(start),
          endDate: toYmd(end),
          includeDeleted: false,
        })
        if (res?.success) {
          rows = Array.isArray(res.data) ? res.data : []
        }
      }
    }

    const filtered = rows.filter(r => includesIgnoreCase(r.title, q) || includesIgnoreCase(r.content || '', q))
    state.total = filtered.length
    state.items = filtered
    state.hasMore = false
  } catch (e: any) {
    if (current !== state.requestSeq) return
    state.error = e?.message || '查询日历事件失败'
  } finally {
    if (current === state.requestSeq) state.loading = false
  }
}

const runActiveTabSearch = async (force: boolean) => {
  const q = query.value.trim()
  if (!q) return
  const key = activeTabKey.value
  if (key === 'customers') {
    const state = tabState.value.customers
    if (force || state.lastQuery !== q) resetTabForQuery(state, q)
    await runCustomerQuery(q, false)
    return
  }
  if (key === 'suppliers') {
    const state = tabState.value.suppliers
    if (force || state.lastQuery !== q) resetTabForQuery(state, q)
    await runSupplierQuery(q, false)
    return
  }
  if (key === 'projectManagement') {
    const state = tabState.value.projectManagement
    if (force || state.lastQuery !== q) resetTabForQuery(state, q)
    await runProjectManagementQuery(q, false)
    return
  }
  if (key === 'contracts') {
    const state = tabState.value.contracts
    if (force || state.lastQuery !== q) resetTabForQuery(state, q)
    await runContractQuery(q, false)
    return
  }
  if (key === 'files') {
    const state = tabState.value.files
    if (force || state.lastQuery !== q) resetTabForQuery(state, q)
    await runFileQuery(q, false)
    return
  }
  const state = tabState.value.calendar
  if (force || state.lastQuery !== q) resetTabForQuery(state, q)
  await runCalendarQuery(q)
}

const debouncedSearch = useDebounceFn(async () => {
  await runActiveTabSearch(false)
}, 250)

watch(query, async (v) => {
  const q = String(v || '').trim()
  if (!q) {
    for (const key of Object.keys(tabState.value) as TabKey[]) {
      const state: any = (tabState.value as any)[key]
      state.loading = false
      state.error = ''
      state.items = []
      state.total = 0
      state.page = 1
      state.hasMore = false
      state.lastQuery = ''
      state.requestSeq += 1
    }
    return
  }
  debouncedSearch()
})

watch(activeIndex, async () => {
  await runActiveTabSearch(false)
})

const loadMore = async (key: TabKey) => {
  const q = query.value.trim()
  if (!q) return
  if (key === 'calendar') return
  const state: any = (tabState.value as any)[key]
  if (!state.hasMore || state.loading) return
  state.page += 1
  if (key === 'customers') await runCustomerQuery(q, true)
  else if (key === 'suppliers') await runSupplierQuery(q, true)
  else if (key === 'projectManagement') await runProjectManagementQuery(q, true)
  else if (key === 'contracts') await runContractQuery(q, true)
  else await runFileQuery(q, true)
}

const selectRow = async (key: TabKey, row: any) => {
  const q = query.value.trim()
  if (key === 'customers') {
    const name = String(row?.name || q).trim() || q
    await router.push({ name: 'Resource', query: { category: 'customers', q: name } })
    close()
    return
  }
  if (key === 'suppliers') {
    const name = String(row?.name || q).trim() || q
    await router.push({ name: 'Resource', query: { category: 'suppliers', q: name } })
    close()
    return
  }
  if (key === 'projectManagement') {
    const name = String(row?.name || row?.code || q).trim() || q
    await router.push({ name: 'Resource', query: { category: 'project-management', q: name } })
    close()
    return
  }
  if (key === 'contracts') {
    const name = String(row?.contract_name || row?.contract_code || q).trim() || q
    await router.push({ name: 'Resource', query: { q: name } })
    close()
    return
  }
  if (key === 'files') {
    const lp = libraryPath.value
    if (!lp) return
    const filePath = String(row?.file_path || '').trim()
    const tokens = filePath.replace(/\\/g, '/').split('/').filter(Boolean)
    const fileName = tokens[tokens.length - 1] || filePath
    await router.push({
      name: 'ContractFilesFullTextSearch',
      params: { contractId: '__all__' },
      query: { baseDir: lp, q, filePath, name: fileName },
    })
    close()
    return
  }
  const title = String(row?.title || q).trim() || q
  await router.push({ name: 'Resource', query: { category: 'calendar', q: title } })
  close()
}

const ResultPanel = defineComponent({
  name: 'AggregatedSearchResultPanel',
  props: {
    query: { type: String, required: true },
    loading: { type: Boolean, required: true },
    error: { type: String, required: true },
    items: { type: Array as any, required: true },
    total: { type: Number, required: true },
    hasMore: { type: Boolean, required: true },
    emptyText: { type: String, required: true },
  },
  emits: ['loadMore', 'selectRow'],
  setup(props, { emit, slots }) {
    const hasQuery = computed(() => !!String(props.query || '').trim())
    const hasItems = computed(() => Array.isArray(props.items) && props.items.length > 0)
    return () => {
      if (!hasQuery.value) {
        return h(
          'div',
          { class: 'py-10 text-center text-sm text-[var(--content-text-secondary)]' },
          '请输入关键词'
        )
      }
      if (props.error) {
        return h(
          'div',
          { class: 'py-10 text-center text-sm text-red-500/90' },
          String(props.error || '')
        )
      }
      return h('div', { class: 'flex flex-col gap-3' }, [
        h('div', { class: 'flex items-center justify-between text-xs text-[var(--content-text-secondary)]' }, [
          h('div', {}, `共 ${props.total} 条`),
          h('div', { class: 'flex items-center gap-2' }, [
            props.loading ? h(ProgressSpinner, { style: { width: '18px', height: '18px' }, strokeWidth: '3' }) : null,
            props.hasMore
              ? h(Button, {
                label: '加载更多',
                size: 'small',
                severity: 'secondary',
                onClick: () => emit('loadMore'),
              })
              : null,
          ].filter(Boolean as any)),
        ]),
        hasItems.value
          ? (slots.default ? slots.default() : null)
          : h(
            'div',
            { class: 'py-10 text-center text-sm text-[var(--content-text-secondary)]' },
            String(props.emptyText || '')
          ),
      ].filter(Boolean as any))
    }
  },
})
</script>
