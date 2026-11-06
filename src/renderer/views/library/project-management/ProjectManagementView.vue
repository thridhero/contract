<template>
  <main class="flex flex-col h-full overflow-hidden bg-[var(--content-bg)] text-[var(--content-text)]">
    <header class="flex items-center justify-between px-6 h-16 shrink-0 bg-[var(--content-bg)]/80 backdrop-blur-md border-b border-[var(--content-border)] z-40" style="-webkit-app-region: drag;" @dblclick="handleTitleBarDblClick">
      <div class="flex items-center flex-1 gap-4">
        <div class="flex items-center gap-3">
          <button @click="$router.back()" class="p-2 rounded-lg transition-colors hover:bg-[var(--sidebar-hover-bg)] text-[var(--content-text-secondary)]" style="-webkit-app-region: no-drag;">
            <i class="pi pi-arrow-left"></i>
          </button>
          <div class="w-px h-5 bg-[var(--content-border)]"></div>
          <h2 class="text-lg font-bold text-[var(--content-text)] tracking-tight whitespace-nowrap" style="-webkit-app-region: no-drag;">项目管理</h2>
        </div>

        <div class="flex items-center gap-3" style="-webkit-app-region: no-drag;">
          <Select
            v-model="queryPreferences.searchField"
            :options="searchFieldOptions"
            option-label="label"
            option-value="value"
            class="w-40"
          />
          <div class="relative w-[420px] max-w-[45vw] focus-within:ring-2 focus-within:ring-blue-500/20 rounded-lg">
            <i class="pi pi-search absolute left-3 top-1/2 -translate-y-1/2 text-[var(--content-text-secondary)]"></i>
            <input
              v-model="searchQuery"
              class="w-full bg-[var(--input-bg)] border border-[var(--input-border)] rounded-lg pl-9 pr-4 py-2 focus:outline-none focus:border-blue-500 text-[var(--content-text)] placeholder-[var(--content-text-secondary)] transition-colors"
              placeholder="搜索项目名称、编号、地点..."
              type="text"
            />
          </div>
        </div>
        <div class="flex-1 h-full"></div>
      </div>

      <div class="flex items-center gap-2" style="-webkit-app-region: no-drag;">
        <div class="flex items-center gap-2 pr-2">
          <Button icon="pi pi-plus" class="p-button-sm p-button-secondary p-button-text !w-8 !h-8 !p-0 custom-icon-btn" v-tooltip.bottom="'新增'" @click="openAddDialog" />
          <Button icon="pi pi-copy" class="p-button-sm p-button-secondary p-button-text !w-8 !h-8 !p-0 custom-icon-btn" v-tooltip.bottom="'类似'" :disabled="!selectedRow" @click="openCopyDialog(selectedRow)" />
          <Button icon="pi pi-trash" class="p-button-sm p-button-secondary p-button-text !w-8 !h-8 !p-0 custom-icon-btn hover:!bg-red-50 hover:!text-red-500 dark:hover:!bg-red-900/30" v-tooltip.bottom="'删除'" :disabled="!selectedRow" @click="trashAction(selectedRow)" />
          <Button icon="pi pi-eraser" class="p-button-sm p-button-secondary p-button-text !w-8 !h-8 !p-0 custom-icon-btn" v-tooltip.bottom="'批量删除'" :disabled="store.total === 0" @click="clearCurrentRange" />
          <Button icon="pi pi-upload" class="p-button-sm p-button-secondary p-button-text !w-8 !h-8 !p-0 custom-icon-btn" v-tooltip.bottom="'导入'" @click="handleImport" />
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
          <Button icon="pi pi-cog" class="p-button-sm p-button-secondary p-button-text !w-8 !h-8 !p-0 custom-icon-btn" v-tooltip.bottom="'设计'" @click="designDialogVisible = true" />
        </div>
        <WindowControls />
      </div>
    </header>

    <div class="flex-1 overflow-hidden p-6 flex flex-col gap-4 bg-[var(--content-bg)]">
      <div class="h-full flex flex-col bg-transparent rounded-xl shadow-sm border border-[var(--content-border)] overflow-hidden">
        <ContextMenu ref="cm" :model="menuModel" />

        <div class="grid grid-cols-3 gap-4 p-4 border-b border-[var(--content-border)] bg-[var(--content-card-bg)]">
            <div class="rounded-lg border p-3" :style="{ borderColor: 'var(--content-border)' }">
              <div class="text-xs text-[var(--content-text-secondary)]">项目数量</div>
              <div class="text-xl font-semibold mt-1">{{ store.summary.total }}</div>
            </div>
            <div class="rounded-lg border p-3" :style="{ borderColor: 'var(--content-border)' }">
              <div class="text-xs text-[var(--content-text-secondary)]">建筑面积汇总</div>
              <div class="text-xl font-semibold mt-1">{{ formatNumber(store.summary.totalBuildingArea) }}</div>
            </div>
            <div class="rounded-lg border p-3" :style="{ borderColor: 'var(--content-border)' }">
              <div class="text-xs text-[var(--content-text-secondary)]">计容面积汇总</div>
              <div class="text-xl font-semibold mt-1">{{ formatNumber(store.summary.totalCountedArea) }}</div>
            </div>
          </div>

          <DataTable
            v-if="viewMode === 'list'"
            :value="store.items"
            v-model:selection="selectedRows"
            v-model:contextMenuSelection="selectedRow"
            dataKey="id"
            :loading="store.loading"
            :scrollable="true"
            scrollHeight="flex"
            class="flex-1 custom-datatable p-datatable-sm"
            stripedRows
            @row-contextmenu="onRowContextMenu"
            @row-dblclick="onRowDblclick"
            @row-click="onRowClick"
          >
            <template #empty>
              <div class="flex flex-col items-center justify-center py-10 text-[var(--content-text-secondary)]">
                <i class="pi pi-inbox text-3xl mb-3 opacity-50"></i>
                <p>没有找到符合条件的项目</p>
              </div>
            </template>

            <Column selectionMode="multiple" headerStyle="width: 3rem"></Column>
            <Column
              v-for="column in visibleColumns"
              :key="column.field"
              :field="column.field"
              :header="column.label"
              sortable
            >
              <template #body="slotProps">
                <span v-if="dateFields.has(column.field)">{{ formatDate(slotProps.data[column.field]) }}</span>
                <span v-else-if="numberFields.has(column.field)">{{ formatNumber(slotProps.data[column.field]) }}</span>
                <span v-else>{{ slotProps.data[column.field] || '-' }}</span>
              </template>
            </Column>
            <Column header="操作" :exportable="false" style="min-width: 13rem">
              <template #body="slotProps">
                <div class="flex gap-2">
                  <Button icon="pi pi-pencil" class="p-button-text p-button-sm p-button-rounded" @click="editRow(slotProps.data)" />
                  <Button icon="pi pi-copy" class="p-button-text p-button-sm p-button-rounded" @click="openCopyDialog(slotProps.data)" />
                  <Button icon="pi pi-arrow-up" class="p-button-text p-button-sm p-button-rounded" @click="moveRow(slotProps.data, 'up')" />
                  <Button icon="pi pi-arrow-down" class="p-button-text p-button-sm p-button-rounded" @click="moveRow(slotProps.data, 'down')" />
                  <Button icon="pi pi-trash" class="p-button-text p-button-sm p-button-rounded p-button-danger" v-tooltip.bottom="'删除'" @click="moveToTrashRow(slotProps.data)" />
                </div>
              </template>
            </Column>
          </DataTable>

          <div v-else class="flex-1 overflow-auto p-4">
            <div v-if="store.loading" class="flex items-center justify-center h-full text-[var(--content-text-secondary)]">
              正在加载...
            </div>
            <div v-else-if="store.items.length === 0" class="flex flex-col items-center justify-center py-10 text-[var(--content-text-secondary)]">
              <i class="pi pi-inbox text-3xl mb-3 opacity-50"></i>
              <p>没有找到符合条件的项目</p>
            </div>
            <div v-else class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              <div
                v-for="item in store.items"
                :key="item.id"
                class="group rounded-xl border bg-[var(--content-card-bg)] p-4 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
                :style="{ borderColor: selectedRow?.id === item.id ? '#3b82f6' : 'var(--content-border)' }"
                @click="onCardClick(item)"
                @dblclick="editRow(item)"
                @contextmenu.prevent.stop="onCardContextMenu($event, item)"
              >
                <div class="flex items-start justify-between gap-3">
                  <div class="min-w-0 flex-1">
                    <div class="font-semibold text-[var(--content-text)] truncate">{{ item.name || '-' }}</div>
                    <div class="text-xs text-[var(--content-text-secondary)] mt-1 truncate">
                      编号：<span class="font-semibold text-[var(--content-text)]">{{ item.code || '未编号' }}</span>
                    </div>
                  </div>
                  <div class="flex gap-1 shrink-0 opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-opacity">
                    <Button icon="pi pi-pencil" class="p-button-text p-button-sm !w-8 !h-8 !p-0" @click.stop="editRow(item)" />
                    <Button icon="pi pi-copy" class="p-button-text p-button-sm !w-8 !h-8 !p-0" @click.stop="openCopyDialog(item)" />
                    <Button icon="pi pi-arrow-up" class="p-button-text p-button-sm !w-8 !h-8 !p-0" @click.stop="moveRow(item, 'up')" />
                    <Button icon="pi pi-arrow-down" class="p-button-text p-button-sm !w-8 !h-8 !p-0" @click.stop="moveRow(item, 'down')" />
                    <Button icon="pi pi-trash" class="p-button-text p-button-sm !w-8 !h-8 !p-0 p-button-danger" v-tooltip.bottom="'删除'" @click.stop="moveToTrashRow(item)" />
                  </div>
                </div>

                <div class="mt-3 grid grid-cols-2 gap-x-3 gap-y-2">
                  <div v-for="col in cardColumns" :key="col.field" class="min-w-0">
                    <div class="text-[11px] text-[var(--content-text-secondary)] truncate">{{ col.label }}</div>
                    <div
                      class="text-sm text-[var(--content-text)] truncate font-semibold"
                      :class="isImportantCardField(col.field) ? 'font-bold text-base' : ''"
                    >
                      {{ getItemDisplayValue(item, col.field) }}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div class="flex items-center justify-between p-4 border-t border-[var(--content-border)] shrink-0 bg-transparent">
            <span class="font-bold text-[var(--content-text-secondary)] uppercase tracking-widest text-sm">
              显示 {{ Math.min((pagination.page - 1) * pagination.pageSize + 1, store.total || 1) }}
              到 {{ Math.min(pagination.page * pagination.pageSize, store.total) }}
              共 {{ store.total }} 条记录
            </span>
            <Paginator
              :first="(pagination.page - 1) * pagination.pageSize"
              :rows="pagination.pageSize"
              :totalRecords="store.total"
              :rowsPerPageOptions="[20, 50, 100, 200, 600]"
              class="bg-transparent border-none custom-paginator !p-0"
              @page="onPageChange"
            />
          </div>
      </div>
    </div>

    <ProjectItemDialog
      v-model:visible="dialogVisible"
      :mode="dialogMode"
      :initial-data="editingData"
      :group-options="groupOptions"
      :default-group-key="selectedGroupInfo.node?.key === '0' ? undefined : selectedGroupInfo.node?.key"
      :default-group-name="selectedGroupInfo.node?.key === '0' ? undefined : selectedGroupInfo.node?.label"
      :design-config="designConfig"
      @save="handleDialogSave"
    />
    <ProjectGroupDialog ref="groupDialogRef" />
    <ProjectDesignDialog v-model:visible="designDialogVisible" :config="designConfig" @save="saveDesignConfig" />
  </main>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import Button from 'primevue/button'
import Checkbox from 'primevue/checkbox'
import Column from 'primevue/column'
import ContextMenu from 'primevue/contextmenu'
import DataTable from 'primevue/datatable'
import Paginator from 'primevue/paginator'
import Select from 'primevue/select'
import { useConfirm } from 'primevue/useconfirm'
import { useToast } from 'primevue/usetoast'
import ProjectDesignDialog from './components/ProjectDesignDialog.vue'
import ProjectGroupDialog from './components/ProjectGroupDialog.vue'
import ProjectItemDialog from './components/ProjectItemDialog.vue'
import WindowControls from '../../../components/WindowControls.vue'
import { createRendererLogger } from '@/utils/logger'
import { useProjectManagementStore } from '../../../stores/project/projectManagementStore'
import { cloneConfig, readJsonSetting, writeJsonSetting } from './projectManagementSettings'
import { useProjectManagementGroups } from './useProjectManagementGroups'
import { useProjectManagementGroupEditor } from './useProjectManagementGroupEditor'
import { useProjectManagementPreferences } from './useProjectManagementPreferences'
import {
  DESIGN_SETTING_KEY,
  GROUPS_SETTING_KEY,
  GROUPS_SOURCE_SETTING_KEY,
  QUERY_SETTING_KEY,
  SORT_SETTING_KEY,
  TREE_DICTIONARY_GROUPS_SETTING_KEY,
  VIEW_MODE_SETTING_KEY,
  columnLabelMap,
  dateFields,
  defaultDesignConfig,
  defaultQueryPreferences,
  defaultSortConfig,
  defaultTreeData,
  numberFields,
  searchFieldOptions,
  sortFieldOptions,
  sortOrderOptions,
} from './projectManagementDefaults'

const logger = createRendererLogger('ProjectManagement')
const route = useRoute()
import type {
  ProjectManagementCreateDTO,
  ProjectManagementDesignConfig,
  ProjectManagementGroupNode,
  ProjectManagementItem,
  ProjectManagementMoveDirection,
  ProjectManagementQueryDTO,
  ProjectManagementQueryPreferences,
  ProjectManagementSortConfig,
  ProjectManagementUpdateDTO,
} from '../../../../shared/types/projectManagement.types'

const toast = useToast()
const confirm = useConfirm()
const store = useProjectManagementStore()

const treeData = ref<ProjectManagementGroupNode[]>([])
const groupSource = ref<'local' | 'tree_dictionary'>('local')
const viewMode = ref<'list' | 'card'>('list')
const selectedKey = ref<Record<string, boolean>>({ '0': true })
const activeTreeNode = ref<ProjectManagementGroupNode | null>(null)
const treeCm = ref()
const groupSourcePopover = ref()
const groupDialogRef = ref<InstanceType<typeof ProjectGroupDialog> | null>(null)
const cm = ref()
const groupFilterValue = ref('')

const treePt = {
  pcFilterContainer: {
    root: {
      class: 'mb-3'
    }
  },
  pcFilterInput: {
    root: {
      class:
        'w-full bg-[var(--input-bg)] border border-[var(--input-border)] rounded-lg px-3 py-2 text-sm !text-[var(--content-text)] placeholder-[var(--content-text-secondary)] focus:outline-none focus:border-blue-500 transition-colors'
    }
  }
} as const

const searchQuery = ref('')

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
const selectedRows = ref<ProjectManagementItem[]>([])
const selectedRow = ref<ProjectManagementItem | null>(null)
const designDialogVisible = ref(false)
const dialogVisible = ref(false)
const dialogMode = ref<'add' | 'edit' | 'copy'>('add')
const editingData = ref<ProjectManagementItem | null>(null)
const designConfig = ref<ProjectManagementDesignConfig>({ ...defaultDesignConfig, listFields: [...defaultDesignConfig.listFields], formFields: [...defaultDesignConfig.formFields] })
const sortConfig = ref<ProjectManagementSortConfig>({ ...defaultSortConfig })
const queryPreferences = ref<ProjectManagementQueryPreferences>({ ...defaultQueryPreferences })
const pagination = ref({
  page: 1,
  pageSize: defaultQueryPreferences.pageSize,
})

const visibleColumns = computed(() => {
  return [...designConfig.value.listFields]
    .filter((field) => field.visible)
    .sort((a, b) => a.order - b.order)
    .map((field) => ({
      field: field.field,
      label: columnLabelMap[field.field] || field.label,
    }))
})

const cardColumns = computed(() => {
  return visibleColumns.value.filter((col) => col.field !== 'name').slice(0, 6)
})

const importantCardFields = new Set(['code', 'group_name', 'project_date', 'engineering_location', 'city'])

const isImportantCardField = (field: string) => {
  return importantCardFields.has(field)
}

const groupOptions = computed(() => {
  const options: Array<{ key: string; label: string }> = []
  const walk = (nodes: ProjectManagementGroupNode[]) => {
    for (const node of nodes) {
      if (node.key !== '0') {
        options.push({ key: node.key, label: node.label })
      }
      if (node.children?.length) {
        walk(node.children)
      }
    }
  }
  walk(treeData.value)
  return options
})

const selectedGroupInfo = computed(() => {
  const key = Object.keys(selectedKey.value)[0] || '0'
  const findNode = (nodes: ProjectManagementGroupNode[]): ProjectManagementGroupNode | null => {
    for (const node of nodes) {
      if (node.key === key) return node
      if (node.children?.length) {
        const child = findNode(node.children)
        if (child) return child
      }
    }
    return null
  }

  const node = findNode(treeData.value)
  const collect = (current: ProjectManagementGroupNode | null): { keys: string[]; names: string[] } => {
    if (!current || current.key === '0') {
      return { keys: [], names: [] }
    }
    const keys: string[] = []
    const names: string[] = []
    const walk = (item: ProjectManagementGroupNode) => {
      keys.push(item.key)
      names.push(item.label)
      item.children?.forEach(walk)
    }
    walk(current)
    return { keys, names }
  }

  return {
    node,
    ...collect(node),
  }
})

const menuModel = computed(() => {
  const row = selectedRow.value
  const items = [
    { label: '编辑', icon: 'pi pi-pencil', command: () => row && editRow(row) },
    { label: '类似', icon: 'pi pi-copy', command: () => row && openCopyDialog(row) },
    { label: '顶部', icon: 'pi pi-angle-double-up', command: () => row && moveRow(row, 'top') },
    { label: '向上', icon: 'pi pi-angle-up', command: () => row && moveRow(row, 'up') },
    { label: '向下', icon: 'pi pi-angle-down', command: () => row && moveRow(row, 'down') },
    { label: '底部', icon: 'pi pi-angle-double-down', command: () => row && moveRow(row, 'bottom') },
  ]
  items.push({ label: '删除', icon: 'pi pi-trash', command: () => row && moveToTrashRow(row) })
  return items
})

const readSetting = async <T,>(key: string, fallback: T) => readJsonSetting(key, fallback, logger)

const handleTitleBarDblClick = (event: MouseEvent) => {
  const target = event.target as HTMLElement | null
  if (!target) return
  const blocked = target.closest('input, textarea, button, a, [role="button"], .p-inputtext, .p-button, .p-select, .p-checkbox')
  if (blocked) return
  window.electronAPI?.window?.toggleMaximize?.() ?? window.electronAPI?.toggleMaximizeWindow?.()
}

const generateKey = () => `node-${Date.now()}-${Math.floor(Math.random() * 1000)}`

const { loadPreferences, setViewMode } = useProjectManagementPreferences({
  designConfig,
  sortConfig,
  queryPreferences,
  viewMode,
  pagination,
  defaultDesignConfig,
  defaultSortConfig,
  defaultQueryPreferences,
  readJsonSetting: readSetting,
  writeJsonSetting,
  designSettingKey: DESIGN_SETTING_KEY,
  sortSettingKey: SORT_SETTING_KEY,
  querySettingKey: QUERY_SETTING_KEY,
  viewModeSettingKey: VIEW_MODE_SETTING_KEY,
})

const {
  saveTreeData,
  loadTreeData,
  openGroupSourceMenu,
  useTreeDictionaryGroups,
  useLocalGroups,
  copyTreeDictionaryGroupsToLocal,
  refreshGroupsFromTreeDictionary,
} = useProjectManagementGroups({
  treeData,
  groupSource,
  selectedKey,
  groupSourcePopover,
  toast,
  defaultTreeData,
  readJsonSetting: readSetting,
  writeJsonSetting,
  cloneConfig,
  groupsSettingKey: GROUPS_SETTING_KEY,
  groupsSourceSettingKey: GROUPS_SOURCE_SETTING_KEY,
  treeDictionaryGroupsSettingKey: TREE_DICTIONARY_GROUPS_SETTING_KEY,
  reloadData: async () => {
    await loadData()
  }
})

const {
  treeMenuModel,
  openTreeActionMenu,
  onGroupFilter,
  onGroupNodeDrop,
  handleAddRootGroup,
  handleAddSibling,
  handleAddChild,
  handleEditGroup,
  handleDeleteGroup,
} = useProjectManagementGroupEditor({
  treeData,
  groupSource,
  selectedKey,
  activeTreeNode,
  treeCm,
  groupFilterValue,
  groupDialogRef,
  toast,
  confirm,
  saveTreeData,
  reloadData: async () => {
    await loadData()
  },
  generateKey,
})

const onCardClick = (item: ProjectManagementItem) => {
  selectedRow.value = item
  store.selectItem(item)
}

const onCardContextMenu = (event: MouseEvent, item: ProjectManagementItem) => {
  selectedRow.value = item
  store.selectItem(item)
  cm.value.show(event)
}

const getItemDisplayValue = (item: ProjectManagementItem, field: string) => {
  const value = (item as any)[field]
  if (dateFields.has(field)) return formatDate(value)
  if (numberFields.has(field)) return formatNumber(value)
  if (value === null || value === undefined || value === '') return '-'
  return String(value)
}

const buildQuery = (withoutPagination = false): ProjectManagementQueryDTO => {
  const query: ProjectManagementQueryDTO = {
    search: searchQuery.value.trim() || undefined,
    searchField: queryPreferences.value.searchField,
    sortField: sortConfig.value.field,
    sortOrder: sortConfig.value.order,
  }

  const shouldApplyGroup = queryPreferences.value.onlySelectedGroup || queryPreferences.value.autoCombineGroupQuery
  if (shouldApplyGroup && selectedGroupInfo.value.keys.length > 0) {
    query.groupKeys = selectedGroupInfo.value.keys
    query.groupNames = selectedGroupInfo.value.names
  }

  if (!withoutPagination) {
    query.page = pagination.value.page
    query.pageSize = pagination.value.pageSize
  }

  return query
}

const loadData = async () => {
  await store.loadList(buildQuery())
  await store.loadSummary(buildQuery(true))
}

const moveToTrashRow = (row: ProjectManagementItem | null) => {
  if (!row) return
  confirm.require({
    message: `确定要删除项目 "${row.name}" 吗？此操作不可恢复。`,
    header: '删除确认',
    icon: 'pi pi-exclamation-triangle',
    acceptClass: 'p-button-danger',
    acceptLabel: '删除',
    rejectLabel: '取消',
    accept: async () => {
      const success = await store.deleteItem(row.id)
      if (!success) {
        toast.add({ severity: 'error', summary: '删除失败', detail: store.error || '删除失败', life: 3000 })
        return
      }
      toast.add({ severity: 'success', summary: '已删除', detail: '项目已删除', life: 2500 })
      await loadData()
    }
  })
}

const trashAction = (row: ProjectManagementItem | null) => {
  if (!row) return
  moveToTrashRow(row)
}

const toDateString = (date: Date) => {
  const yyyy = date.getFullYear()
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

const onPageChange = (event: { page: number; rows: number }) => {
  pagination.value.page = event.page + 1
  pagination.value.pageSize = event.rows
}

const onNodeSelect = (keys: Record<string, boolean>) => {
  treeCm.value?.hide?.()
  selectedKey.value = keys
  pagination.value.page = 1
}

const openAddDialog = () => {
  dialogMode.value = 'add'
  editingData.value = null
  dialogVisible.value = true
}

const openCopyDialog = (row: ProjectManagementItem | null) => {
  if (!row) return
  dialogMode.value = 'copy'
  editingData.value = row
  dialogVisible.value = true
}

const editRow = (row: ProjectManagementItem) => {
  dialogMode.value = 'edit'
  editingData.value = row
  dialogVisible.value = true
}

const handleDialogSave = async (payload: { data: ProjectManagementCreateDTO | ProjectManagementUpdateDTO; continuousAdd: boolean }) => {
  if (dialogMode.value === 'edit' && 'id' in payload.data) {
    const result = await store.updateItem(payload.data)
    if (!result) {
      toast.add({ severity: 'error', summary: '保存失败', detail: store.error || '更新项目失败', life: 3000 })
      return
    }
    toast.add({ severity: 'success', summary: '保存成功', detail: '项目已更新', life: 3000 })
    dialogVisible.value = false
  } else {
    const result = await store.createItem(payload.data as ProjectManagementCreateDTO)
    if (!result) {
      toast.add({ severity: 'error', summary: '保存失败', detail: store.error || '创建项目失败', life: 3000 })
      return
    }
    toast.add({ severity: 'success', summary: '保存成功', detail: '项目已创建', life: 3000 })
    if (!payload.continuousAdd) {
      dialogVisible.value = false
    } else {
      dialogVisible.value = false
      await nextTick()
      editingData.value = null
      dialogMode.value = 'add'
      dialogVisible.value = true
    }
  }

  pagination.value.page = 1
  await loadData()
}

const clearCurrentRange = () => {
  confirm.require({
    message: '确定要批量删除当前筛选范围内的项目吗？此操作不可恢复。',
    header: '批量删除确认',
    icon: 'pi pi-exclamation-triangle',
    acceptClass: 'p-button-danger',
    acceptLabel: '删除',
    rejectLabel: '取消',
    accept: async () => {
      const count = await store.deleteByQuery(buildQuery(true))
      if (count <= 0) {
        toast.add({ severity: 'warn', summary: '未处理', detail: store.error || '当前范围没有可删除项目', life: 3000 })
        return
      }
      toast.add({
        severity: 'success',
        summary: '已删除',
        detail: `已删除 ${count} 条项目`,
        life: 3000
      })
      pagination.value.page = 1
      await loadData()
    }
  })
}

const ensureManualSortForMove = async () => {
  if (sortConfig.value.field === 'sort_order' && sortConfig.value.order === 'asc') {
    return
  }
  sortConfig.value.field = 'sort_order'
  sortConfig.value.order = 'asc'
  await writeJsonSetting(SORT_SETTING_KEY, sortConfig.value, '项目管理排序设置')
}

const moveRow = async (row: ProjectManagementItem, direction: ProjectManagementMoveDirection) => {
  await ensureManualSortForMove()
  const result = await store.moveItem({
    id: row.id,
    direction,
    query: buildQuery(true),
  })
  if (!result) {
    toast.add({ severity: 'error', summary: '排序失败', detail: store.error || '排序失败', life: 3000 })
    return
  }
  await loadData()
}

const buildDefaultExportName = () => {
  const now = new Date()
  const yyyy = String(now.getFullYear())
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const dd = String(now.getDate()).padStart(2, '0')
  const groupName = selectedGroupInfo.value.node?.key && selectedGroupInfo.value.node.key !== '0' ? selectedGroupInfo.value.node.label : '项目管理'
  return `${groupName}_${yyyy}${mm}${dd}.csv`
}

const handleImport = async () => {
  const result = await window.electronAPI.fs.selectFile({
    title: '选择项目 CSV 文件',
    filters: [{ name: 'CSV Files', extensions: ['csv'] }],
  })
  if (!result.success || !result.data || result.data.canceled || result.data.filePaths.length === 0) {
    return
  }

  const filePath = result.data.filePaths[0]
  const selectedNode = selectedGroupInfo.value.node?.key === '0' ? null : selectedGroupInfo.value.node
  const importResult = await window.electronAPI.projectManagement.importCsv(filePath, selectedNode?.key, selectedNode?.label)
  if (!importResult.success || !importResult.data) {
    toast.add({ severity: 'error', summary: '导入失败', detail: importResult.error || '导入失败', life: 3000 })
    return
  }
  toast.add({ severity: 'success', summary: '导入成功', detail: `已导入 ${importResult.data.importedCount} 条项目`, life: 3000 })
  pagination.value.page = 1
  await loadData()
}

const handleExport = async () => {
  const saveResult = await window.electronAPI.fs.saveFile({
    title: '导出项目 CSV',
    defaultPath: buildDefaultExportName(),
    filters: [{ name: 'CSV Files', extensions: ['csv'] }],
  })

  if (!saveResult.success || !saveResult.data || saveResult.data.canceled || !saveResult.data.filePath) {
    return
  }

  const exportResult = await window.electronAPI.projectManagement.exportCsv(buildQuery(true), saveResult.data.filePath)
  if (!exportResult.success || !exportResult.data) {
    toast.add({ severity: 'error', summary: '导出失败', detail: exportResult.error || '导出失败', life: 3000 })
    return
  }
  toast.add({ severity: 'success', summary: '导出成功', detail: `已导出 ${exportResult.data.exportedCount} 条项目`, life: 3000 })
}

const saveDesignConfig = async (value: ProjectManagementDesignConfig) => {
  designConfig.value = value
  await writeJsonSetting(DESIGN_SETTING_KEY, value, '项目管理设计配置')
}

const onRowContextMenu = (event: { originalEvent: Event; data: ProjectManagementItem }) => {
  selectedRow.value = event.data
  store.selectItem(event.data)
  cm.value.show(event.originalEvent)
}

const onRowDblclick = (event: { data: ProjectManagementItem }) => {
  editRow(event.data)
}

const onRowClick = (event: { data: ProjectManagementItem }) => {
  selectedRow.value = event.data
  store.selectItem(event.data)
}

const formatDate = (value: string | null | undefined) => {
  if (!value) return '-'
  return String(value).slice(0, 10)
}

const formatNumber = (value: number | string | null | undefined) => {
  if (value === null || value === undefined || value === '') return '-'
  const num = Number(value)
  if (!Number.isFinite(num)) return String(value)
  return num.toLocaleString()
}

let searchTimer: number | undefined

watch(searchQuery, () => {
  if (searchTimer !== undefined) {
    window.clearTimeout(searchTimer)
  }
  searchTimer = window.setTimeout(() => {
    pagination.value.page = 1
    loadData()
  }, 250)
})

watch(
  () => [pagination.value.page, pagination.value.pageSize, selectedKey.value, sortConfig.value.field, sortConfig.value.order, queryPreferences.value.onlySelectedGroup, queryPreferences.value.autoCombineGroupQuery],
  async () => {
    await loadData()
  },
  { deep: true }
)

watch(
  () => [queryPreferences.value.searchField, pagination.value.pageSize],
  async () => {
    queryPreferences.value.pageSize = pagination.value.pageSize
    await writeJsonSetting(QUERY_SETTING_KEY, queryPreferences.value, '项目管理查询偏好')
  },
  { deep: true }
)

watch(
  () => [sortConfig.value.field, sortConfig.value.order],
  async () => {
    await writeJsonSetting(SORT_SETTING_KEY, sortConfig.value, '项目管理排序设置')
  },
  { deep: true }
)

onMounted(async () => {
  await loadTreeData()
  await loadPreferences()
  await loadData()
})
</script>

<style scoped>
:deep(.p-tree) {
  background: transparent !important;
}

:deep(.p-tree-node-content) {
  background: transparent !important;
  color: var(--content-text) !important;
}

:deep(.p-tree-node-content:hover) {
  background: var(--sidebar-hover-bg) !important;
}

:deep(.p-tree-node-content.p-tree-node-selected) {
  background: var(--sidebar-active-bg) !important;
  color: var(--content-text) !important;
  font-weight: bold;
}

:deep(.custom-paginator) {
  background: var(--content-card-bg) !important;
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
</style>
