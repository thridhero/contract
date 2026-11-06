<template>
  <main class="flex h-full overflow-hidden bg-[var(--content-bg)] text-[var(--content-text)]">
    <aside
      class="dictionary-tree-panel relative flex flex-col border-r border-[var(--content-border)] bg-[var(--sidebar-bg)] overflow-hidden"
      :style="{ width: `${treePanelWidth}px` }"
    >
      <header class="flex items-center justify-between px-4 h-14 shrink-0 border-b border-[var(--content-border)] bg-[var(--sidebar-bg)]/50 backdrop-blur-sm" style="-webkit-app-region: drag;">
        <div class="flex items-center gap-2" style="-webkit-app-region: no-drag;">
          <i class="pi pi-folder-open text-[var(--btn-primary-bg)]"></i>
          <h2 class="font-bold">字典分组</h2>
        </div>
        <div class="flex items-center gap-1" style="-webkit-app-region: no-drag;">
          <Button icon="pi pi-plus" class="p-button-text p-button-sm !w-8 !h-8" v-tooltip.bottom="'新增分组'" @click="handleAddRootGroup" />
        </div>
      </header>

      <div class="p-3 flex flex-col gap-3 flex-1 overflow-hidden">
        <div class="flex-1 overflow-auto bg-[var(--sidebar-bg)] relative">
          <div v-if="treeLoading" class="absolute inset-0 flex items-center justify-center bg-[var(--content-card-bg)]/50 z-10">
            <ProgressSpinner style="width: 30px; height: 30px" strokeWidth="3" />
          </div>

          <ContextMenu ref="treeCm" :model="treeMenuModel">
            <template #item="{ item, props }">
              <a class="flex items-center w-full" v-bind="props.action">
                <span :class="[item.icon, item.danger ? 'text-red-600' : '']" />
                <span :class="['ml-2', item.danger ? 'text-red-600' : '']">{{ item.label }}</span>
              </a>
            </template>
          </ContextMenu>

          <Tree
            v-model:value="treeData"
            :selectionKeys="selectedKey"
            @update:selectionKeys="onNodeSelect"
            selectionMode="single"
            filter
            filterPlaceholder="搜索分组..."
            :draggableNodes="!treeLoading && groupFilterValue.trim().length === 0"
            :droppableNodes="!treeLoading && groupFilterValue.trim().length === 0"
            :validateDrop="true"
            @filter="onGroupFilter"
            @node-drop="onGroupNodeDrop"
            class="custom-tree !text-[var(--content-text)]"
            :pt="treePt"
          >
            <template #default="slotProps">
              <div class="flex items-center justify-between w-full py-1" @contextmenu.prevent.stop="openTreeActionMenu($event, slotProps.node)">
                <div class="flex items-center min-w-0">
                  <span class="font-medium truncate" :class="{ 'text-[var(--btn-primary-bg)]': selectedKey[String(slotProps.node.key)] }">{{ slotProps.node.label }}</span>
                </div>
              </div>
            </template>
          </Tree>
        </div>

        <div class="flex items-center justify-between py-1 px-1 border-t border-[var(--content-border)]/50">
          <span class="text-[var(--content-text-secondary)]">共 {{ groupCount }} 个分组</span>
          <span class="text-xs px-2 py-0.5 rounded bg-[var(--sidebar-active-bg)] text-[var(--btn-primary-bg)] truncate max-w-[180px]">
            {{ currentGroupName }}
          </span>
        </div>
      </div>
      <div class="dictionary-tree-resizer" :class="{ 'is-resizing': isResizingTreePanel }" @mousedown.prevent="startTreePanelResize" />
    </aside>

    <section class="flex-1 flex flex-col bg-[var(--content-bg)] overflow-hidden">
      <header class="flex items-center justify-between px-6 h-14 shrink-0 border-b border-[var(--content-border)] bg-[var(--content-bg)]/80 backdrop-blur-md" style="-webkit-app-region: drag;">
        <div class="flex items-center gap-4 min-w-0" style="-webkit-app-region: no-drag;">
          <button @click="$router.back()" class="p-2 rounded-lg transition-colors hover:bg-[var(--sidebar-hover-bg)] text-[var(--content-text-secondary)] shrink-0">
            <i class="pi pi-arrow-left"></i>
          </button>
          <h2 class="font-bold flex items-center gap-2 min-w-0">
            <i class="pi pi-book text-[var(--btn-primary-bg)]"></i>
            字典设置
            <span
              v-if="currentGroupName !== '所有分组'"
              class="font-normal text-[var(--content-text-secondary)] bg-[var(--sidebar-active-bg)] px-2 py-0.5 rounded ml-1 max-w-[220px] truncate"
            >
              {{ currentGroupName }}
            </span>
          </h2>
          <div class="relative w-80 max-w-full">
            <InputText v-model="searchQuery" class="w-full !pl-10 h-9" placeholder="搜索名称/编码/值/备注..." @keyup.enter="handleSearch" />
            <i class="pi pi-search absolute left-3 top-1/2 -translate-y-1/2 text-[var(--content-text-secondary)] text-xs cursor-pointer" @click="handleSearch"></i>
          </div>
        </div>

        <div class="flex items-center gap-1" style="-webkit-app-region: no-drag;">
          <div class="flex items-center gap-1 pr-3 mr-3 border-r border-[var(--content-border)]">
            <Button icon="pi pi-plus" aria-label="新增字典" class="p-button-text p-button-sm !w-8 !h-8" v-tooltip.bottom="'新增字典'" @click="openAddDialog" />
            <Button icon="pi pi-trash" aria-label="批量删除" class="p-button-text p-button-sm p-button-danger !w-8 !h-8" v-tooltip.bottom="'批量删除'" @click="deleteSelected" :disabled="selectedRowCount === 0" />
            <Button icon="pi pi-arrow-right-arrow-left" aria-label="迁移分组" class="p-button-text p-button-sm !w-8 !h-8" v-tooltip.bottom="'迁移分组'" @click="openMoveDialog" :disabled="selectedRowCount === 0" />
            <Button icon="pi pi-upload" aria-label="导入" class="p-button-text p-button-sm !w-8 !h-8" v-tooltip.bottom="'导入'" @click="handleImport" />
            <Button icon="pi pi-download" aria-label="导出" class="p-button-text p-button-sm !w-8 !h-8" v-tooltip.bottom="'导出'" @click="handleExport" />
          </div>

          <div class="flex items-center gap-1">
            <Button icon="pi pi-minus" aria-label="最小化" class="p-button-text p-button-secondary p-button-sm !w-8 !h-8" v-tooltip.bottom="'最小化'" @click="minimizeWindow" />
            <Button :icon="windowStateStore.getIsMaximized ? 'pi pi-window-minimize' : 'pi pi-window-maximize'" :aria-label="windowStateStore.getIsMaximized ? '还原' : '最大化'" class="p-button-text p-button-secondary p-button-sm !w-8 !h-8" v-tooltip.bottom="windowStateStore.getIsMaximized ? '还原' : '最大化'" @click="toggleMaximize" />
            <Button icon="pi pi-times" aria-label="关闭" class="p-button-text p-button-danger p-button-sm !w-8 !h-8" v-tooltip.bottom="'关闭'" @click="closeWindow" />
          </div>
        </div>
      </header>

      <div class="p-6 flex-1 overflow-hidden flex flex-col gap-4">
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4 shrink-0">
          <div class="rounded-lg border border-[var(--content-border)] bg-[var(--content-card-bg)] p-4">
            <div class="text-xs text-[var(--content-text-secondary)]">当前结果数</div>
            <div class="text-2xl font-semibold mt-1">{{ pagination.total }}</div>
          </div>
          <div class="rounded-lg border border-[var(--content-border)] bg-[var(--content-card-bg)] p-4">
            <div class="text-xs text-[var(--content-text-secondary)]">已选字典项</div>
            <div class="text-2xl font-semibold mt-1">{{ selectedRowCount }}</div>
          </div>
          <div class="rounded-lg border border-[var(--content-border)] bg-[var(--content-card-bg)] p-4">
            <div class="text-xs text-[var(--content-text-secondary)]">分组数量</div>
            <div class="text-2xl font-semibold mt-1">{{ groupCount }}</div>
          </div>
        </div>

        <div class="flex-1 flex flex-col rounded-xl border border-[var(--content-border)] bg-[var(--content-card-bg)] overflow-hidden">
          <ContextMenu ref="cm" :model="menuModel" @hide="selectedRow = null">
            <template #item="{ item, props }">
              <a class="flex items-center w-full" v-bind="props.action">
                <span :class="[item.icon, item.danger ? 'text-red-600' : '']" />
                <span :class="['ml-2', item.danger ? 'text-red-600' : '']">{{ item.label }}</span>
              </a>
            </template>
          </ContextMenu>

          <DataTable
            :value="tableData"
            v-model:selection="selectedRows"
            v-model:contextMenuSelection="selectedRow"
            @rowContextmenu="onRowContextMenu"
            :loading="loading"
            dataKey="id"
            :scrollable="true"
            scrollHeight="flex"
            class="flex-1 custom-datatable p-datatable-sm"
            stripedRows
            @row-dblclick="onRowDblclick"
          >
            <template #empty>
              <div class="flex flex-col items-center justify-center py-20 text-[var(--content-text-secondary)]">
                <i class="pi pi-inbox text-4xl mb-3 opacity-30"></i>
                <p>没有找到符合条件的字典项</p>
              </div>
            </template>

            <Column selectionMode="multiple" headerStyle="width: 3rem"></Column>
            <Column field="name" header="名称" sortable></Column>
            <Column field="code" header="编码" sortable></Column>
            <Column field="value" header="值" sortable></Column>
            <Column field="group_name" header="分组" sortable></Column>
            <Column field="sort_order" header="排序" sortable></Column>
            <Column field="remark" header="备注"></Column>
            <Column header="操作" :exportable="false" style="min-width: 8rem">
              <template #body="slotProps">
                <div class="flex gap-2">
                  <Button icon="pi pi-pencil" class="p-button-text p-button-sm p-button-rounded" @click="editRow(slotProps.data)" />
                  <Button icon="pi pi-trash" class="p-button-text p-button-sm p-button-rounded p-button-danger" @click="deleteRow(slotProps.data)" />
                </div>
              </template>
            </Column>
          </DataTable>

          <div class="flex items-center justify-between py-2 px-4 border-t border-[var(--content-border)] bg-[var(--content-card-bg)]">
            <span class="text-[var(--content-text-secondary)]">
              显示 {{ currentRangeStart }} 到 {{ currentRangeEnd }}，共 {{ pagination.total }} 条
            </span>
            <Paginator
              :first="(pagination.page - 1) * pagination.pageSize"
              :rows="pagination.pageSize"
              :totalRecords="pagination.total"
              :rowsPerPageOptions="[10, 20, 30, 50, 100]"
              class="custom-paginator !p-0"
              @page="onPageChange"
            ></Paginator>
          </div>
        </div>
      </div>
    </section>

    <!-- 弹窗 -->
    <DictionaryDialog
      v-model:visible="dialogVisible"
      :isEdit="isEditMode"
      :initialData="editingData"
      :groupOptions="dialogGroupOptions"
      :defaultGroup="currentGroupName"
      @save="handleDialogSave"
    />
    <DictionaryGroupDialog ref="groupDialogRef" />

    <Dialog
      :visible="moveDialogVisible"
      modal
      :closable="true"
      :draggable="false"
      :style="{ width: '420px' }"
      header="迁移分组"
      class="custom-dialog"
      @update:visible="(v) => (moveDialogVisible.value = v)"
    >
      <div class="flex flex-col gap-4 py-2">
        <div class="text-sm text-[var(--content-text-secondary)]">
          已选择 {{ selectedRows?.length || 0 }} 条数据
        </div>
        <div class="flex items-start">
          <label class="w-24 shrink-0 whitespace-nowrap text-right mr-3 mt-2 text-[var(--content-text)]"><span class="text-red-500">*</span> 目标分组</label>
          <div class="flex-1 flex flex-col">
            <Dropdown
              v-model="moveTargetGroup"
              :options="dialogGroupOptions"
              placeholder="选择目标分组"
              class="w-full"
            />
            <small class="text-red-500 mt-1 text-xs min-h-[16px]">{{ moveGroupError }}</small>
          </div>
        </div>
      </div>

      <template #footer>
        <div class="flex justify-end gap-2 mt-4">
          <Button label="取消" icon="pi pi-times" class="p-button-text p-button-sm" @click="closeMoveDialog" />
          <Button label="确定" icon="pi pi-check" class="p-button-primary p-button-sm" @click="confirmMoveGroup" :disabled="moving" />
        </div>
      </template>
    </Dialog>

    <Dialog
      :visible="importing"
      modal
      :closable="false"
      :draggable="false"
      :style="{ width: '420px' }"
      header="正在导入"
      class="custom-dialog"
    >
      <div class="flex flex-col items-center justify-center gap-4 py-4">
        <ProgressSpinner style="width: 42px; height: 42px" strokeWidth="3" />
        <div class="text-center">
          <div class="font-bold text-[var(--content-text)]">{{ importProgressText }}</div>
          <div class="text-sm text-[var(--content-text-secondary)]" v-if="importProgress.total > 0">
            {{ importProgress.current }} / {{ importProgress.total }}（{{ importProgress.percent }}%）
          </div>
        </div>
      </div>
    </Dialog>
  </main>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, watch, nextTick } from 'vue'
import { useWindowStateStore } from '../../../stores/ui/windowState'
import DictionaryDialog from './components/DictionaryDialog.vue'
import DictionaryGroupDialog from './components/DictionaryGroupDialog.vue'
import { createRendererLogger } from '@/utils/logger'
import { collectNodeDataStrings, ensureRootFirst, findNodeByKey, getSelectedSingleKey } from './utils/groupTree'
import { dictionaryGroupsTreePt } from './utils/treePt'
import type { DictionaryItem, DictionaryQueryDTO, DictionaryUpdateDTO } from '../../../../shared/types/dictionary.types'
const logger = createRendererLogger('DictionarySettings')
import Tree from 'primevue/tree'
import type { TreeFilterEvent, TreeNodeDropEvent } from 'primevue/tree'
import ProgressSpinner from 'primevue/progressspinner'
import Button from 'primevue/button'
import Paginator from 'primevue/paginator'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Dialog from 'primevue/dialog'
import Dropdown from 'primevue/dropdown'
import ContextMenu from 'primevue/contextmenu'
import InputText from 'primevue/inputtext'
import { useToast } from 'primevue/usetoast'
import { useConfirm } from 'primevue/useconfirm'

const windowStateStore = useWindowStateStore()
const toast = useToast()
const confirm = useConfirm()

const TREE_PANEL_WIDTH_STORAGE_KEY = 'dictionary-settings:tree-panel-width'
const TREE_PANEL_WIDTH_DEFAULT = 360
const TREE_PANEL_WIDTH_MIN = 260
const TREE_PANEL_WIDTH_MAX = 560
const clampTreePanelWidth = (width: number) =>
  Math.min(TREE_PANEL_WIDTH_MAX, Math.max(TREE_PANEL_WIDTH_MIN, Math.round(width)))
const getInitialTreePanelWidth = () => {
  const saved = Number(localStorage.getItem(TREE_PANEL_WIDTH_STORAGE_KEY))
  if (Number.isFinite(saved) && saved > 0) return clampTreePanelWidth(saved)
  return TREE_PANEL_WIDTH_DEFAULT
}
const treePanelWidth = ref<number>(getInitialTreePanelWidth())

const isResizingTreePanel = ref(false)
let treePanelResizeStartX = 0
let treePanelResizeStartWidth = 0
let bodyCursorBeforeTreePanelResize = ''
let bodyUserSelectBeforeTreePanelResize = ''

const stopTreePanelResize = () => {
  if (!isResizingTreePanel.value) return
  isResizingTreePanel.value = false
  window.removeEventListener('mousemove', onTreePanelResizeMove)
  window.removeEventListener('mouseup', stopTreePanelResize)
  document.body.style.cursor = bodyCursorBeforeTreePanelResize
  document.body.style.userSelect = bodyUserSelectBeforeTreePanelResize
  localStorage.setItem(TREE_PANEL_WIDTH_STORAGE_KEY, String(treePanelWidth.value))
}

const onTreePanelResizeMove = (event: MouseEvent) => {
  if (!isResizingTreePanel.value) return
  const deltaX = event.clientX - treePanelResizeStartX
  treePanelWidth.value = clampTreePanelWidth(treePanelResizeStartWidth + deltaX)
}

const startTreePanelResize = (event: MouseEvent) => {
  isResizingTreePanel.value = true
  treePanelResizeStartX = event.clientX
  treePanelResizeStartWidth = treePanelWidth.value
  bodyCursorBeforeTreePanelResize = document.body.style.cursor
  bodyUserSelectBeforeTreePanelResize = document.body.style.userSelect
  document.body.style.cursor = 'col-resize'
  document.body.style.userSelect = 'none'
  window.addEventListener('mousemove', onTreePanelResizeMove)
  window.addEventListener('mouseup', stopTreePanelResize)
}

const minimizeWindow = (): void => {
  window.electronAPI?.window?.minimize?.()
}
const toggleMaximize = (): void => {
  window.electronAPI?.window?.toggleMaximize?.()
}
const closeWindow = (): void => {
  window.electronAPI?.window?.close?.()
}

onMounted(async () => {
  await loadTreeData()
  loadData()

  unlistenImportProgress = window.electronAPI.dictionary.onImportProgress((payload) => {
    importProgress.value = payload
  })
})

onUnmounted(() => {
  unlistenImportProgress?.()
  unlistenImportProgress = null
  stopTreePanelResize()
})

const treeLoading = ref(false)
const defaultTreeData = [
  {
    key: '0',
    label: '所有分组',
    data: '所有分组',
    icon: 'pi pi-fw pi-folder',
    children: []
  }
]
const treeData = ref<any[]>([])
const groupFilterValue = ref('')
const selectedKey = ref<Record<string, boolean>>({ '0': true })
const groupDialogRef = ref()
const importing = ref(false)
const importProgress = ref({ status: 'idle', current: 0, total: 0, percent: 0 })
let unlistenImportProgress: null | (() => void) = null

const treePt = dictionaryGroupsTreePt

const importProgressText = computed(() => {
  if (importProgress.value.status === 'reading') return '正在读取文件...'
  if (importProgress.value.status === 'importing') return '正在导入数据...'
  if (importProgress.value.status === 'completed') return '导入完成'
  return '正在导入...'
})

const currentGroupName = computed(() => {
  const key = getSelectedSingleKey(selectedKey.value)
  if (!key || key === '0') return '所有分组'
  const node = findNodeByKey(treeData.value, key)
  return node ? String(node.data ?? '') : '所有分组'
})

const hideTreeContextMenu = () => {
  treeCm.value?.hide?.()
}

const onNodeSelect = (keys: any) => {
  hideTreeContextMenu()
  selectedKey.value = keys
  pagination.value.page = 1
  loadData()
}

const onGroupFilter = (event: TreeFilterEvent) => {
  hideTreeContextMenu()
  groupFilterValue.value = event.value || ''
}

type TreeNodeDropEventWithAccept = TreeNodeDropEvent & { accept?: () => void }

const onGroupNodeDrop = async (event: TreeNodeDropEventWithAccept) => {
  hideTreeContextMenu()
  const dragKey = String((event.dragNode as any)?.key ?? '')
  if (!dragKey || dragKey === '0') return
  if (typeof event.accept === 'function') {
    event.accept()
    await nextTick()
  } else {
    treeData.value = event.value as any
    await nextTick()
  }
  treeData.value = ensureRootFirst(treeData.value)
  await saveTreeData(true, '分组位置已调整')
}

const dialogGroupOptions = computed(() => {
  return collectNodeDataStrings(treeData.value, { excludeKey: '0' })
})

const groupCount = computed(() => dialogGroupOptions.value.length)

const saveTreeData = async (showToast = false, msg = '分组保存成功') => {
  treeLoading.value = true
  try {
    const jsonStr = JSON.stringify(treeData.value)
    localStorage.setItem('dictionary_groups_tree', jsonStr)
    const res = await window.electronAPI.db.getSetting('dictionary_groups_tree')
    if (res.success && res.data) {
      await window.electronAPI.db.updateSetting('dictionary_groups_tree', jsonStr, '字典分组树结构')
    } else {
      await window.electronAPI.db.insertSetting('dictionary_groups_tree', jsonStr, '字典分组树结构')
    }
    if (showToast) toast.add({ severity: 'success', summary: '成功', detail: msg, life: 3000 })
    return true
  } catch (error) {
    logger.error('Failed to save tree data', error)
    if (showToast) toast.add({ severity: 'error', summary: '失败', detail: '分组保存失败', life: 3000 })
    return false
  } finally {
    treeLoading.value = false
  }
}

const loadTreeData = async () => {
  treeLoading.value = true
  try {
    const res = await window.electronAPI.db.getSetting('dictionary_groups_tree')
    if (res.success && res.data && res.data.value) {
      treeData.value = JSON.parse(res.data.value)
      localStorage.setItem('dictionary_groups_tree', res.data.value)
      return
    }
    const cached = localStorage.getItem('dictionary_groups_tree')
    if (cached) {
      treeData.value = JSON.parse(cached)
      return
    }
    treeData.value = JSON.parse(JSON.stringify(defaultTreeData))
    await saveTreeData()
  } catch (error) {
    logger.error('Failed to load dictionary groups', error)
    treeData.value = JSON.parse(JSON.stringify(defaultTreeData))
  } finally {
    treeLoading.value = false
  }
}

const generateKey = () => `node-${Date.now()}-${Math.floor(Math.random() * 1000)}`
const activeTreeNode = ref<any | null>(null)
const treeCm = ref()

const treeMenuModel = computed(() => {
  const isRoot = String(activeTreeNode.value?.key ?? '') === '0'
  return [
    { label: '新增子分组', icon: 'pi pi-plus', command: () => activeTreeNode.value && handleAddChild(activeTreeNode.value) },
    { label: '新增同级', icon: 'pi pi-file-plus', disabled: isRoot, command: () => activeTreeNode.value && handleAddSibling(activeTreeNode.value) },
    { label: '编辑分组', icon: 'pi pi-file-edit', disabled: isRoot, command: () => activeTreeNode.value && handleEditGroup(activeTreeNode.value) },
    { separator: true },
    { label: '导出分组及字典', icon: 'pi pi-download', command: () => activeTreeNode.value && handleExportGroupBundle(activeTreeNode.value) },
    { label: '导入分组及字典', icon: 'pi pi-upload', command: () => activeTreeNode.value && handleImportGroupBundle(activeTreeNode.value) },
    { separator: true },
    {
      label: '删除分组',
      icon: 'pi pi-trash',
      danger: true,
      disabled: isRoot,
      command: () => activeTreeNode.value && handleDeleteGroup(activeTreeNode.value)
    }
  ]
})

const openTreeActionMenu = async (event: MouseEvent, node: any) => {
  activeTreeNode.value = node
  selectedKey.value = { [String(node.key)]: true }
  hideTreeContextMenu()
  await nextTick()
  treeCm.value?.show?.(event)
}

async function handleExportGroupBundle(node: any) {
  hideTreeContextMenu()
  try {
    const groupName = String(node?.data ?? node?.label ?? '全部分组') || '全部分组'
    const safeName = groupName.replace(/[\\/:*?"<>|]/g, '_')
    const now = new Date()
    const yyyy = String(now.getFullYear())
    const mm = String(now.getMonth() + 1).padStart(2, '0')
    const dd = String(now.getDate()).padStart(2, '0')
    const defaultName = `${safeName}_${yyyy}${mm}${dd}.json`

    const saveRes = await window.electronAPI.fs.saveFile({
      title: '导出分组及字典',
      defaultPath: defaultName,
      filters: [{ name: 'JSON Files', extensions: ['json'] }]
    })
    if (!saveRes.success || saveRes.data.canceled || !saveRes.data.filePath) return

    const res = await window.electronAPI.dictionary.exportGroupBundle(String(node.key ?? '0'), saveRes.data.filePath)
    if (res.success) {
      toast.add({ severity: 'success', summary: '导出成功', detail: `已导出 ${res.data.groupCount} 个分组、${res.data.dictionaryCount} 条字典`, life: 3000 })
    } else {
      toast.add({ severity: 'error', summary: '导出失败', detail: res.error || '未知错误', life: 3000 })
    }
  } catch (error: any) {
    logger.error('Export group bundle failed', error)
    toast.add({ severity: 'error', summary: '导出异常', detail: error.message || '出现异常', life: 3000 })
  }
}

async function handleImportGroupBundle(node: any) {
  hideTreeContextMenu()
  try {
    const result = await window.electronAPI.fs.selectFile({
      title: '选择分组及字典 JSON 文件',
      filters: [{ name: 'JSON Files', extensions: ['json'] }]
    })
    if (!result.success || result.data.canceled || result.data.filePaths.length === 0) return

    const filePath = result.data.filePaths[0]
    importing.value = true
    importProgress.value = { status: 'reading', current: 0, total: 0, percent: 0 }
    try {
      const importRes = await window.electronAPI.dictionary.importGroupBundle(filePath, String(node?.key ?? '0'))
      if (importRes.success) {
        const d = importRes.data
        const renameText = d.groupsRenamed > 0 ? `（重命名 ${d.groupsRenamed} 个）` : ''
        toast.add({ severity: 'success', summary: '导入成功', detail: `新增 ${d.groupsAdded} 个分组${renameText}，导入 ${d.dictionariesImported} 条字典（跳过 ${d.dictionariesSkipped} 条）`, life: 4000 })
        await loadTreeData()
        loadData()
      } else {
        toast.add({ severity: 'error', summary: '导入失败', detail: importRes.error || '未知错误', life: 3000 })
      }
    } finally {
      importing.value = false
      importProgress.value = { status: 'idle', current: 0, total: 0, percent: 0 }
    }
  } catch (error: any) {
    logger.error('Import group bundle failed', error)
    toast.add({ severity: 'error', summary: '导入异常', detail: error.message || '出现异常', life: 3000 })
    importing.value = false
    importProgress.value = { status: 'idle', current: 0, total: 0, percent: 0 }
  }
}

const handleAddRootGroup = async () => {
  const names = collectNodeDataStrings(treeData.value, { excludeKey: '0' })
  const name = await groupDialogRef.value?.open('add', '', names)
  if (!name) return
  
  const newNode = { key: generateKey(), label: name, data: name, icon: 'pi pi-folder', children: [] }
  treeData.value.push(newNode)
  await saveTreeData(true, '新增分组成功')
  selectedKey.value = { [String(newNode.key)]: true }
  loadData()
}

const handleAddSibling = async (node: any) => {
  const names = collectNodeDataStrings(treeData.value, { excludeKey: '0' })
  const name = await groupDialogRef.value?.open('add', '', names)
  if (!name) return
  
  const findAndAdd = (nodes: any[]): boolean => {
    for (let i = 0; i < nodes.length; i++) {
      if (nodes[i].key === node.key) {
        nodes.splice(i + 1, 0, { key: generateKey(), label: name, data: name, icon: 'pi pi-folder', children: [] })
        return true
      }
      if (nodes[i].children && findAndAdd(nodes[i].children)) return true
    }
    return false
  }
  
  if (findAndAdd(treeData.value)) {
    treeCm.value?.hide?.()
    await saveTreeData(true, '新增同级分组成功')
    loadData()
  }
}

const handleAddChild = async (node: any) => {
  const names = collectNodeDataStrings(treeData.value, { excludeKey: '0' })
  const name = await groupDialogRef.value?.open('add', '', names)
  if (!name) return
  
  const findAndAddChild = (nodes: any[]): boolean => {
    for (const n of nodes) {
      if (n.key === node.key) {
        if (!n.children) n.children = []
        n.children.push({ key: generateKey(), label: name, data: name, icon: 'pi pi-folder', children: [] })
        return true
      }
      if (n.children && findAndAddChild(n.children)) return true
    }
    return false
  }
  
  if (findAndAddChild(treeData.value)) {
    treeCm.value?.hide?.()
    await saveTreeData(true, '新增子分组成功')
    loadData()
  }
}

const handleEditGroup = async (node: any) => {
  const names = collectNodeDataStrings(treeData.value, { excludeKey: '0' })
  const oldName = String(node.data || '')
  const newName = await groupDialogRef.value?.open('edit', oldName, names)
  if (!newName || newName === oldName) return
  
  const findAndEdit = (nodes: any[]): boolean => {
    for (const n of nodes) {
      if (n.key === node.key) {
        n.label = newName
        n.data = newName
        return true
      }
      if (n.children && findAndEdit(n.children)) return true
    }
    return false
  }
  
  if (findAndEdit(treeData.value)) {
    treeCm.value?.hide?.()
    await saveTreeData(true, '修改分组成功')
    await window.electronAPI.dictionary.renameGroup(oldName, newName)
    loadData()
  }
}

const handleDeleteGroup = async (node: any) => {
  treeCm.value?.hide?.()
  const collectNames = (n: any, acc: string[]) => {
    const name = String(n?.data || '').trim()
    if (name && name !== '所有分组') acc.push(name)
    if (Array.isArray(n?.children)) {
      for (const child of n.children) collectNames(child, acc)
    }
  }

  const groupNamesToCheck: string[] = []
  collectNames(node, groupNamesToCheck)

  try {
    if (groupNamesToCheck.length > 0) {
      const res = await window.electronAPI.dictionary.countInGroups(groupNamesToCheck)
      if (res.success && res.data.count > 0) {
        toast.add({ severity: 'warn', summary: '无法删除', detail: '该分组下存在字典数据，请先删除或迁移数据后再删除分组', life: 3000 })
        return
      }
    }
  } catch (error) {
    logger.error('Count group dictionaries failed', error)
    toast.add({ severity: 'error', summary: '失败', detail: '校验分组数据失败', life: 3000 })
    return
  }

  confirm.require({
    message: `确定要删除分组 "${node.label}" 吗？其下的子分组也将被删除。`,
    header: '删除确认',
    icon: 'pi pi-exclamation-triangle',
    acceptClass: 'p-button-danger',
    acceptLabel: '确定',
    rejectLabel: '取消',
    accept: async () => {
      const findAndDelete = (nodes: any[]): boolean => {
        for (let i = 0; i < nodes.length; i++) {
          if (nodes[i].key === node.key) {
            nodes.splice(i, 1)
            return true
          }
          if (nodes[i].children && findAndDelete(nodes[i].children)) return true
        }
        return false
      }
      
      if (findAndDelete(treeData.value)) {
        if (selectedKey.value[node.key]) {
          selectedKey.value = { '0': true }
        }
        await saveTreeData(true, '分组已删除')
        loadData()
      }
    }
  })
}

const searchQuery = ref('')
const tableData = ref<DictionaryItem[]>([])
const loading = ref(false)
const selectedRows = ref<DictionaryItem[]>([])
const moveDialogVisible = ref(false)
const moveTargetGroup = ref<string | null>(null)
const moveGroupError = ref('')
const moving = ref(false)
const pagination = ref({
  page: 1,
  pageSize: 20,
  total: 0
})
let searchDebounceTimer: number | undefined

const selectedRowCount = computed(() => selectedRows.value?.length || 0)
const currentRangeStart = computed(() => (pagination.value.total > 0 ? (pagination.value.page - 1) * pagination.value.pageSize + 1 : 0))
const currentRangeEnd = computed(() => (pagination.value.total > 0 ? Math.min(pagination.value.page * pagination.value.pageSize, pagination.value.total) : 0))

const onPageChange = (event: any) => {
  pagination.value.page = event.page + 1
  pagination.value.pageSize = event.rows
  loadData()
}

const handleSearch = () => {
  if (searchDebounceTimer !== undefined) window.clearTimeout(searchDebounceTimer)
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
    const query: DictionaryQueryDTO = {
      page: pagination.value.page,
      pageSize: pagination.value.pageSize,
      group_name: currentGroupName.value === '所有分组' ? undefined : currentGroupName.value,
      ...(search ? { search } : {})
    }
    
    query.searchFields = ['name', 'code', 'value', 'remark']
    
    const res = await window.electronAPI.dictionary.getList(query)
    if (res.success && res.data) {
      tableData.value = res.data.data
      pagination.value.total = res.data.total
      const selectedIds = new Set(selectedRows.value.map(r => r.id))
      selectedRows.value = tableData.value.filter(r => selectedIds.has(r.id))
    }
  } catch (error) {
    logger.error('Failed to load dictionaries', error)
  } finally {
    loading.value = false
  }
}

const dialogVisible = ref(false)
const isEditMode = ref(false)
const editingData = ref<DictionaryItem | null>(null)

// ─── 右键菜单 ──────────────────────────────────────────────────────────
const cm = ref()
const selectedRow = ref<DictionaryItem | null>(null)

const menuModel = computed(() => {
  const row = selectedRow.value
  return [
    { label: '修改', icon: 'pi pi-pencil', command: () => { if (row) editRow(row) } },
    { label: '置顶', icon: 'pi pi-angle-double-up', command: () => { if (row) moveTopRow(row) } },
    { label: '置底', icon: 'pi pi-angle-double-down', command: () => { if (row) moveBottomRow(row) } },
    { separator: true },
    { label: '向上', icon: 'pi pi-angle-up', command: () => { if (row) moveUpRow(row) } },
    { label: '向下', icon: 'pi pi-angle-down', command: () => { if (row) moveDownRow(row) } },
    { label: '删除', icon: 'pi pi-trash', danger: true, command: () => { if (row) deleteRow(row) } }
  ]
})

const onRowContextMenu = (event: any) => {
  cm.value.show(event.originalEvent)
}

const updateSortOrder = async (item: DictionaryItem, newOrder: number) => {
  const dto: DictionaryUpdateDTO = { id: item.id, sort_order: newOrder }
  await window.electronAPI.dictionary.update(dto)
}

const moveTopRow = async (item: DictionaryItem) => {
  await window.electronAPI.dictionary.moveToTop(item.id)
  loadData()
}

const moveBottomRow = async (item: DictionaryItem) => {
  await window.electronAPI.dictionary.moveToBottom(item.id)
  loadData()
}

const moveUpRow = async (item: DictionaryItem) => {
  const index = tableData.value.findIndex(r => r.id === item.id)
  if (index > 0) {
    const prevItem = tableData.value[index - 1]
    let newCurrentOrder = prevItem.sort_order
    let newPrevOrder = item.sort_order
    
    if (newCurrentOrder === newPrevOrder) {
      newCurrentOrder = Math.max(0, item.sort_order - 1)
      newPrevOrder = item.sort_order + 1
    }

    await Promise.all([
      updateSortOrder(item, newCurrentOrder),
      updateSortOrder(prevItem, newPrevOrder)
    ])
    loadData()
  } else {
    await updateSortOrder(item, Math.max(0, item.sort_order - 1))
    loadData()
  }
}

const moveDownRow = async (item: DictionaryItem) => {
  const index = tableData.value.findIndex(r => r.id === item.id)
  if (index >= 0 && index < tableData.value.length - 1) {
    const nextItem = tableData.value[index + 1]
    let newCurrentOrder = nextItem.sort_order
    let newNextOrder = item.sort_order
    
    if (newCurrentOrder === newNextOrder) {
      newCurrentOrder = item.sort_order + 1
      newNextOrder = Math.max(0, item.sort_order - 1)
    }

    await Promise.all([
      updateSortOrder(item, newCurrentOrder),
      updateSortOrder(nextItem, newNextOrder)
    ])
    loadData()
  } else {
    await updateSortOrder(item, item.sort_order + 1)
    loadData()
  }
}

const openAddDialog = () => {
  isEditMode.value = false
  editingData.value = null
  dialogVisible.value = true
}

const handleDialogSave = () => {
  loadData()
}

const editRow = (row: DictionaryItem) => {
  isEditMode.value = true
  editingData.value = row
  dialogVisible.value = true
}

const onRowDblclick = (event: any) => {
  editRow(event.data)
}

const deleteRow = (row: DictionaryItem) => {
  confirm.require({
    message: `确定要删除字典项 "${row.name}" 吗？此操作不可恢复。`,
    header: '删除确认',
    icon: 'pi pi-exclamation-triangle',
    acceptClass: 'p-button-danger',
    acceptLabel: '删除',
    rejectLabel: '取消',
    accept: async () => {
      try {
        const res = await window.electronAPI.dictionary.delete(row.id)
        if (res.success) {
          toast.add({ severity: 'success', summary: '成功', detail: '已删除', life: 3000 })
          selectedRows.value = selectedRows.value.filter(r => r.id !== row.id)
          loadData()
        } else {
          toast.add({ severity: 'error', summary: '操作失败', detail: res.error || '未知错误', life: 3000 })
        }
      } catch (error) {
        logger.error('Delete failed', error)
        toast.add({ severity: 'error', summary: '操作失败', detail: '出现异常', life: 3000 })
      }
    }
  })
}

const deleteSelected = () => {
  if (!selectedRows.value || selectedRows.value.length === 0) return
  const rows = [...selectedRows.value]
  confirm.require({
    message: `确定要删除选中的 ${rows.length} 个字典项吗？此操作不可恢复。`,
    header: '批量删除确认',
    icon: 'pi pi-exclamation-triangle',
    acceptClass: 'p-button-danger',
    acceptLabel: '删除',
    rejectLabel: '取消',
    accept: async () => {
      try {
        let deletedCount = 0
        for (const row of rows) {
          const res = await window.electronAPI.dictionary.delete(row.id)
          if (res.success) deletedCount++
        }
        toast.add({ severity: 'success', summary: '成功', detail: `已删除 ${deletedCount} 条`, life: 3000 })
        selectedRows.value = []
        loadData()
      } catch (error) {
        logger.error('Batch delete failed', error)
        toast.add({ severity: 'error', summary: '操作失败', detail: '出现异常', life: 3000 })
      }
    }
  })
}

const openMoveDialog = () => {
  if (!selectedRows.value || selectedRows.value.length === 0) return
  moveGroupError.value = ''
  moveTargetGroup.value = null
  moveDialogVisible.value = true
}

const closeMoveDialog = () => {
  moveDialogVisible.value = false
  moveGroupError.value = ''
  moveTargetGroup.value = null
}

const confirmMoveGroup = async () => {
  moveGroupError.value = ''
  const target = moveTargetGroup.value
  if (!target || target === '所有分组' || String(target).trim() === '') {
    moveGroupError.value = '请选择目标分组'
    return
  }
  if (!selectedRows.value || selectedRows.value.length === 0) {
    moveDialogVisible.value = false
    return
  }

  moving.value = true
  try {
    const ids = selectedRows.value.map((r) => r.id)
    const res = await window.electronAPI.dictionary.moveToGroup(ids, String(target))
    if (res.success) {
      toast.add({ severity: 'success', summary: '成功', detail: `已迁移 ${res.data.updatedCount} 条数据到 "${target}"`, life: 3000 })
      selectedRows.value = []
      moveDialogVisible.value = false
      loadData()
    } else {
      toast.add({ severity: 'error', summary: '失败', detail: res.error || '迁移失败', life: 3000 })
    }
  } catch (error) {
    logger.error('Move group failed', error)
    toast.add({ severity: 'error', summary: '失败', detail: '迁移出现异常', life: 3000 })
  } finally {
    moving.value = false
  }
}

const handleImport = async () => {
  try {
    if (currentGroupName.value === '所有分组') {
      toast.add({ severity: 'warn', summary: '提示', detail: '请选择分组后再导入', life: 3000 })
      return
    }

    const result = await window.electronAPI.fs.selectFile({
      title: '选择字典 CSV 文件',
      filters: [{ name: 'CSV Files', extensions: ['csv'] }]
    })
    
    if (result.success && !result.data.canceled && result.data.filePaths.length > 0) {
      const filePath = result.data.filePaths[0]
      const groupName = currentGroupName.value

      importing.value = true
      importProgress.value = { status: 'reading', current: 0, total: 0, percent: 0 }
      
      try {
        const importRes = await window.electronAPI.dictionary.importCsv(filePath, groupName)
        if (importRes.success) {
          toast.add({ severity: 'success', summary: '导入成功', detail: `成功导入 ${importRes.data.importedCount} 条记录到 "${groupName}" 分组`, life: 3000 })
          loadData()
        } else {
          toast.add({ severity: 'error', summary: '导入失败', detail: importRes.error || '未知错误', life: 3000 })
        }
      } finally {
        importing.value = false
        importProgress.value = { status: 'idle', current: 0, total: 0, percent: 0 }
      }
    }
  } catch (error: any) {
    logger.error('Import failed', error)
    toast.add({ severity: 'error', summary: '导入异常', detail: error.message || '出现异常', life: 3000 })
    importing.value = false
    importProgress.value = { status: 'idle', current: 0, total: 0, percent: 0 }
  }
}
const handleExport = () => {
  ;(async () => {
    try {
      if (currentGroupName.value === '所有分组') {
        toast.add({ severity: 'warn', summary: '提示', detail: '请选择分组后再导出', life: 3000 })
        return
      }

      const groupName = currentGroupName.value
      const safeName = groupName.replace(/[\\/:*?"<>|]/g, '_')
      const now = new Date()
      const yyyy = String(now.getFullYear())
      const mm = String(now.getMonth() + 1).padStart(2, '0')
      const dd = String(now.getDate()).padStart(2, '0')
      const defaultName = `${safeName}_${yyyy}${mm}${dd}.csv`

      const saveRes = await window.electronAPI.fs.saveFile({
        title: '导出字典 CSV',
        defaultPath: defaultName,
        filters: [{ name: 'CSV Files', extensions: ['csv'] }]
      })

      if (!saveRes.success || saveRes.data.canceled || !saveRes.data.filePath) return

      const exportRes = await window.electronAPI.dictionary.exportCsv(groupName, saveRes.data.filePath)
      if (exportRes.success) {
        toast.add({ severity: 'success', summary: '导出成功', detail: `已导出 ${exportRes.data.exportedCount} 条记录`, life: 3000 })
      } else {
        toast.add({ severity: 'error', summary: '导出失败', detail: exportRes.error || '未知错误', life: 3000 })
      }
    } catch (error: any) {
      logger.error('Export failed', error)
      toast.add({ severity: 'error', summary: '导出异常', detail: error.message || '出现异常', life: 3000 })
    }
  })()
}
</script>

<style scoped>
:deep(.custom-tree) {
  border: none;
  background: transparent;
  padding: 0;
}

:deep(.p-tree) {
  background: transparent !important;
}
:deep(.p-tree-container) {
  padding: 0.5rem;
}
:deep(.p-tree-node-content) {
  background: transparent !important;
  color: var(--content-text) !important;
  padding: 0.35rem 0.5rem !important;
  border-radius: 0.375rem;
}
:deep(.p-tree-node-content:hover) {
  background: var(--sidebar-hover-bg) !important;
}
:deep(.p-tree-node-content.p-tree-node-selected) {
  background: var(--sidebar-active-bg) !important;
  color: var(--content-text) !important;
  font-weight: bold;
}
:deep(.p-tree-node-icon),
:deep(.p-tree-node-toggle-button) {
  color: var(--content-text-secondary) !important;
}
:deep(.p-tree-node-content.p-tree-node-selected .p-tree-node-toggle-button) {
  color: var(--btn-primary-bg) !important;
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

:deep(.custom-datatable) {
  background: transparent !important;
}
:deep(.custom-datatable .p-datatable-header) {
  background: transparent !important;
  border-bottom: 1px solid var(--content-border) !important;
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
:deep(.custom-datatable .p-datatable-tbody > tr.p-highlight) {
  background: var(--sidebar-active-bg) !important;
  color: var(--content-text) !important;
}

:deep(.p-datatable-sm .p-datatable-thead > tr > th) {
  padding: 0.5rem 0.75rem;
}
:deep(.p-datatable-sm .p-datatable-tbody > tr > td) {
  padding: 0.5rem 0.75rem;
}

.custom-scrollbar::-webkit-scrollbar {
  width: 6px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background-color: var(--content-border);
  border-radius: 3px;
}
.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background-color: var(--content-text-muted);
}

.dictionary-tree-resizer {
  position: absolute;
  top: 0;
  right: -3px;
  height: 100%;
  width: 6px;
  cursor: col-resize;
  z-index: 30;
  -webkit-app-region: no-drag;
}

.dictionary-tree-resizer:hover,
.dictionary-tree-resizer.is-resizing {
  background: color-mix(in srgb, var(--btn-primary-bg) 18%, transparent);
}
</style>
