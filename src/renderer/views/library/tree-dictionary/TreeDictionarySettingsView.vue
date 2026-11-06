<template>
  <main class="flex h-full overflow-hidden bg-[var(--content-bg)] text-[var(--content-text)]">
    <aside
      class="tree-dictionary-tree-panel relative flex flex-col border-r border-[var(--content-border)] bg-[var(--sidebar-bg)] overflow-hidden"
      :style="{ width: `${treePanelWidth}px` }"
    >
      <header
        class="flex items-center justify-between px-4 h-14 shrink-0 border-b border-[var(--content-border)] bg-[var(--sidebar-bg)]/50 backdrop-blur-sm"
        style="-webkit-app-region: drag;"
      >
        <div class="flex items-center gap-2" style="-webkit-app-region: no-drag;">
          <i class="pi pi-folder-open text-[var(--btn-primary-bg)]"></i>
          <h2 class="font-bold">字典分组</h2>
        </div>
        <div class="flex items-center gap-1" style="-webkit-app-region: no-drag;">
          <Button
            v-if="currentGroupName === '所有分组'"
            icon="pi pi-angle-double-down"
            class="p-button-text p-button-sm !w-8 !h-8"
            v-tooltip.bottom="'一键展开'"
            @click="expandAllGroups"
          />
          <Button
            v-if="currentGroupName === '所有分组'"
            icon="pi pi-angle-double-up"
            class="p-button-text p-button-sm !w-8 !h-8"
            v-tooltip.bottom="'一键折叠'"
            @click="collapseAllGroups"
          />
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
            :selectionKeys="selectedGroupKey"
            @update:selectionKeys="onGroupNodeSelect"
            v-model:expandedKeys="expandedKeys"
            filter
            filterMode="lenient"
            filterPlaceholder="搜索分组..."
            selectionMode="single"
            :draggableNodes="!treeLoading && groupFilterValue.trim().length === 0"
            :droppableNodes="!treeLoading && groupFilterValue.trim().length === 0"
            :validateDrop="true"
            @filter="onGroupFilter"
            @node-drop="onGroupNodeDrop"
            class="bg-transparent border-none p-0 !text-[var(--content-text)]"
            :pt="treePt"
          >
            <template #default="slotProps">
              <div
                class="flex items-center justify-between w-full px-2 py-1.5 rounded-lg group transition-colors"
                @contextmenu.prevent.stop="openTreeActionMenu($event, slotProps.node)"
              >
                <span class="font-medium text-[var(--content-text)] group-hover:text-[var(--btn-primary-bg)] transition-colors">
                  {{ slotProps.node.label }}
                </span>
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

      <div class="tree-dictionary-tree-resizer" :class="{ 'is-resizing': isResizingTreePanel }" @mousedown.prevent="startTreePanelResize" />
    </aside>

    <section class="flex-1 flex flex-col bg-[var(--content-bg)] overflow-hidden">
      <header
        class="flex items-center justify-between px-6 h-14 shrink-0 border-b border-[var(--content-border)] bg-[var(--content-bg)]/80 backdrop-blur-md"
        style="-webkit-app-region: drag;"
      >
        <div class="flex items-center gap-4 min-w-0" style="-webkit-app-region: no-drag;">
          <button @click="$router.back()" class="p-2 rounded-lg transition-colors hover:bg-[var(--sidebar-hover-bg)] text-[var(--content-text-secondary)] shrink-0">
            <i class="pi pi-arrow-left"></i>
          </button>
          <h2 class="font-bold flex items-center gap-2 min-w-0">
            <i class="pi pi-sitemap text-[var(--btn-primary-bg)]"></i>
            树形字典
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
            <Button icon="pi pi-plus" aria-label="新增" class="p-button-text p-button-sm !w-8 !h-8" v-tooltip.bottom="'新增'" @click="openAddDialog" />
            <Button
              icon="pi pi-trash"
              aria-label="批量删除"
              class="p-button-text p-button-sm p-button-danger !w-8 !h-8"
              v-tooltip.bottom="'批量删除'"
              @click="deleteSelected"
              :disabled="selectedRowCount === 0"
            />
            <Button
              v-if="currentGroupName === '所有分组'"
              icon="pi pi-angle-double-down"
              aria-label="一键展开"
              class="p-button-text p-button-sm !w-8 !h-8"
              v-tooltip.bottom="'一键展开'"
              @click="expandAllItems"
            />
            <Button
              v-if="currentGroupName === '所有分组'"
              icon="pi pi-angle-double-up"
              aria-label="一键折叠"
              class="p-button-text p-button-sm !w-8 !h-8"
              v-tooltip.bottom="'一键折叠'"
              @click="collapseAllItems"
            />
            <Button icon="pi pi-upload" aria-label="导入" class="p-button-text p-button-sm !w-8 !h-8" v-tooltip.bottom="'导入'" @click="handleImport" />
          </div>

          <div class="flex items-center gap-1">
            <Button icon="pi pi-minus" aria-label="最小化" class="p-button-text p-button-secondary p-button-sm !w-8 !h-8" v-tooltip.bottom="'最小化'" @click="minimizeWindow" />
            <Button
              :icon="windowStateStore.getIsMaximized ? 'pi pi-window-minimize' : 'pi pi-window-maximize'"
              :aria-label="windowStateStore.getIsMaximized ? '还原' : '最大化'"
              class="p-button-text p-button-secondary p-button-sm !w-8 !h-8"
              v-tooltip.bottom="windowStateStore.getIsMaximized ? '还原' : '最大化'"
              @click="toggleMaximize"
            />
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
          <ContextMenu ref="cm" :model="menuModel" @hide="selectedContextKey = null" />
          <TreeTable
            :value="tableData"
            v-model:selectionKeys="selectedKeys"
            v-model:contextMenuSelectionKey="selectedContextKey"
            v-model:expandedKeys="tableExpandedKeys"
            @rowContextmenu="onRowContextMenu"
            :loading="loading"
            selectionMode="checkbox"
            stripedRows
            :scrollable="true"
            scrollHeight="flex"
            class="flex-1 custom-treetable p-treetable-sm"
          >
            <template #empty>
              <div class="flex flex-col items-center justify-center py-20 text-[var(--content-text-secondary)]">
                <i class="pi pi-inbox text-4xl mb-3 opacity-30"></i>
                <p>没有找到符合条件的树形字典项</p>
              </div>
            </template>

            <Column field="name" header="名称" expander style="min-width: 200px"></Column>
            <Column field="code" header="编码"></Column>
            <Column field="value" header="值"></Column>
            <Column field="group_name" header="分组"></Column>
            <Column field="remark" header="备注"></Column>
            <Column header="操作" style="min-width: 12rem">
              <template #body="slotProps">
                <div class="flex gap-1">
                  <Button icon="pi pi-plus" class="p-button-text p-button-sm p-button-rounded p-button-success" v-tooltip.top="'新增子项'" @click="addDictChild(slotProps.node.data)" />
                  <Button icon="pi pi-pencil" class="p-button-text p-button-sm p-button-rounded" v-tooltip.top="'编辑'" @click="editRow(slotProps.node.data)" />
                  <Button icon="pi pi-arrow-up" class="p-button-text p-button-sm p-button-rounded p-button-secondary" v-tooltip.top="'上移'" :disabled="isRootItem(slotProps.node.data)" @click="moveUpRow(slotProps.node)" />
                  <Button icon="pi pi-arrow-down" class="p-button-text p-button-sm p-button-rounded p-button-secondary" v-tooltip.top="'下移'" :disabled="isRootItem(slotProps.node.data)" @click="moveDownRow(slotProps.node)" />
                  <Button icon="pi pi-trash" class="p-button-text p-button-sm p-button-rounded p-button-danger" v-tooltip.top="'删除'" :disabled="isRootItem(slotProps.node.data)" @click="deleteRow(slotProps.node.data)" />
                </div>
              </template>
            </Column>
          </TreeTable>

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

    <TreeDictionaryDialog
      v-model:visible="dialogVisible"
      :isEdit="isEditMode"
      :initialData="editingData"
      :groupOptions="dialogGroupOptions"
      :treeNodes="treeSelectNodes"
      @save="handleDialogSave"
    />
    <TreeDictionaryGroupDialog ref="groupDialogRef" />

    <TreeDictionaryImportDialog
      v-model:visible="importDialogVisible"
      :groupOptions="dialogGroupOptions"
      :defaultGroup="currentGroupName"
      @success="handleDialogSave"
    />
  </main>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, computed, watch, nextTick } from 'vue'
import { useWindowStateStore } from '../../../stores/ui/windowState'
import TreeDictionaryDialog from './components/TreeDictionaryDialog.vue'
import TreeDictionaryGroupDialog from './components/TreeDictionaryGroupDialog.vue'
import TreeDictionaryImportDialog from './components/TreeDictionaryImportDialog.vue'
import { createRendererLogger } from '@/utils/logger'
import type { TreeDictionaryItem, TreeDictionaryQueryDTO, TreeDictionaryUpdateDTO } from '../../../../shared/types/treeDictionary.types'

const logger = createRendererLogger('TreeDictionarySettings')

import Tree from 'primevue/tree'
import TreeTable from 'primevue/treetable'
import type { TreeFilterEvent, TreeNodeDropEvent } from 'primevue/tree'
import ProgressSpinner from 'primevue/progressspinner'
import Button from 'primevue/button'
import Paginator from 'primevue/paginator'
import Column from 'primevue/column'
import ContextMenu from 'primevue/contextmenu'
import Checkbox from 'primevue/checkbox'
import InputText from 'primevue/inputtext'
import { useToast } from 'primevue/usetoast'
import { useConfirm } from 'primevue/useconfirm'

const windowStateStore = useWindowStateStore()
const toast = useToast()
const confirm = useConfirm()

const TREE_PANEL_WIDTH_STORAGE_KEY = 'tree-dictionary-settings:tree-panel-width'
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

// ─── Window Controls ───────────────────────────────────────────────────────
const minimizeWindow = () => window.electronAPI?.window?.minimize?.()
const toggleMaximize = () => window.electronAPI?.window?.toggleMaximize?.()
const closeWindow = () => window.electronAPI?.window?.close?.()

// ─── Init ──────────────────────────────────────────────────────────────────
onMounted(async () => {
  await loadTreeData()
  loadData()
})

onBeforeUnmount(() => {
  stopTreePanelResize()
})

// ─── Group Tree ────────────────────────────────────────────────────────────
const treeLoading = ref(false)
const defaultTreeData = [{ key: '0', label: '所有分组', data: '所有分组', icon: 'pi pi-fw pi-folder', children: [] }]
const treeData = ref<any[]>([])
const selectedGroupKey = ref<Record<string, boolean>>({ '0': true })
const expandedKeys = ref<Record<string, boolean>>({})
const groupDialogRef = ref()
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

const currentGroupName = computed(() => {
  const keys = Object.keys(selectedGroupKey.value)
  if (keys.length === 0 || keys[0] === '0') return '所有分组'
  
  const findNode = (nodes: any[], key: string): any => {
    for (const node of nodes) {
      if (node.key === key) return node
      if (node.children) {
        const found = findNode(node.children, key)
        if (found) return found
      }
    }
    return null
  }
  const node = findNode(treeData.value, keys[0])
  return node ? node.data : '所有分组'
})

const hideTreeContextMenu = () => {
  treeCm.value?.hide?.()
}

const onGroupNodeSelect = async (keys: any) => {
  hideTreeContextMenu()
  selectedGroupKey.value = keys
  pagination.value.page = 1
  const groupName = currentGroupName.value === '所有分组' ? '' : currentGroupName.value
  if (groupName) await ensureGroupRootDirectory(groupName)
  loadData()
}

const collectExpandableKeys = (nodes: any[], out: Record<string, boolean>) => {
  for (const n of nodes) {
    if (Array.isArray(n.children) && n.children.length > 0) {
      out[String(n.key)] = true
      collectExpandableKeys(n.children, out)
    }
  }
}

const expandAllGroups = () => {
  const out: Record<string, boolean> = {}
  collectExpandableKeys(treeData.value, out)
  expandedKeys.value = out
}

const collapseAllGroups = () => {
  expandedKeys.value = {}
}

const getExistingGroupNames = (nodes: any[] = treeData.value, names: string[] = []): string[] => {
  for (const node of nodes) {
    if (node.key !== '0') names.push(node.data)
    if (node.children) getExistingGroupNames(node.children, names)
  }
  return names
}

const dialogGroupOptions = computed(() => getExistingGroupNames())
const groupCount = computed(() => dialogGroupOptions.value.length)

const saveTreeData = async (showToast = false, msg = '分组保存成功') => {
  treeLoading.value = true
  try {
    const jsonStr = JSON.stringify(treeData.value)
    localStorage.setItem('tree_dictionary_groups_tree', jsonStr)
    const res = await window.electronAPI.db.getSetting('tree_dictionary_groups_tree')
    if (res.success && res.data) {
      await window.electronAPI.db.updateSetting('tree_dictionary_groups_tree', jsonStr, '树形字典分组')
    } else {
      await window.electronAPI.db.insertSetting('tree_dictionary_groups_tree', jsonStr, '树形字典分组')
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
    const res = await window.electronAPI.db.getSetting('tree_dictionary_groups_tree')
    if (res.success && res.data && res.data.value) {
      treeData.value = JSON.parse(res.data.value)
      localStorage.setItem('tree_dictionary_groups_tree', res.data.value)
      return
    }
    const cached = localStorage.getItem('tree_dictionary_groups_tree')
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

// ─── Group Actions ─────────────────────────────────────────────────────────
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
  selectedGroupKey.value = { [String(node.key)]: true }
  hideTreeContextMenu()
  await nextTick()
  treeCm.value?.show?.(event)
}

const onGroupFilter = (event: TreeFilterEvent) => {
  hideTreeContextMenu()
  groupFilterValue.value = event.value || ''
}

const ensureRootFirst = (nodes: any[]) => {
  const index = nodes.findIndex((n) => String(n?.key) === '0')
  if (index <= 0) return nodes
  const reordered = [...nodes]
  const [root] = reordered.splice(index, 1)
  reordered.unshift(root)
  return reordered
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

const handleAddRootGroup = async () => {
  const names = getExistingGroupNames()
  const name = await groupDialogRef.value?.open('add', '', names)
  if (!name) return
  
  const newNode = { key: generateKey(), label: name, data: name, icon: 'pi pi-folder', children: [] }
  treeData.value.push(newNode)
  await saveTreeData(true, '新增分组成功')
  await ensureGroupRootDirectory(name)
  selectedGroupKey.value = { [String(newNode.key)]: true }
  loadData()
}

const handleAddSibling = async (node: any) => {
  const names = getExistingGroupNames()
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
    hideTreeContextMenu()
    await saveTreeData(true, '新增同级分组成功')
    await ensureGroupRootDirectory(name)
    loadData()
  }
}

const handleAddChild = async (node: any) => {
  const names = getExistingGroupNames()
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
    hideTreeContextMenu()
    await saveTreeData(true, '新增子分组成功')
    await ensureGroupRootDirectory(name)
    loadData()
  }
}

const handleEditGroup = async (node: any) => {
  const names = getExistingGroupNames()
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
    hideTreeContextMenu()
    await saveTreeData(true, '修改分组成功')
    loadData()
  }
}

const handleDeleteGroup = async (node: any) => {
  hideTreeContextMenu()
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
        if (selectedGroupKey.value[node.key]) {
          selectedGroupKey.value = { '0': true }
        }
        await saveTreeData(true, '分组已删除')
        loadData()
      }
    }
  })
}

// ─── TreeTable Data ────────────────────────────────────────────────────────
const searchQuery = ref('')
const tableData = ref<any[]>([])
const flatDataList = ref<TreeDictionaryItem[]>([])
const loading = ref(false)
const selectedKeys = ref<Record<string, boolean>>({})
const selectedRowCount = computed(() => Object.keys(selectedKeys.value || {}).length)

const pagination = ref({ page: 1, pageSize: 500, total: 0 })
const currentRangeStart = computed(() => {
  if (!pagination.value.total) return 0
  return (pagination.value.page - 1) * pagination.value.pageSize + 1
})
const currentRangeEnd = computed(() => Math.min(pagination.value.page * pagination.value.pageSize, pagination.value.total))
let searchDebounceTimer: number | undefined

const formatForTreeSelect = (nodes: any[]): any[] => {
  return nodes.map(node => ({
    key: node.key,
    label: node.data.name,
    children: node.children && node.children.length > 0 ? formatForTreeSelect(node.children) : []
  }))
}

const treeSelectNodes = computed(() => formatForTreeSelect(tableData.value))

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

const buildTreeTableData = (flatList: TreeDictionaryItem[]) => {
  const sorted = [...flatList].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
  
  const map = new Map();
  const roots: any[] = [];
  
  sorted.forEach(item => {
    map.set(item.id, {
      key: item.id,
      data: item,
      children: []
    });
  });
  
  sorted.forEach(item => {
    const node = map.get(item.id);
    if (item.parent_id && map.has(item.parent_id)) {
      map.get(item.parent_id).children.push(node);
    } else {
      roots.push(node);
    }
  });
  
  return roots;
}

const groupRootDirectory = ref<TreeDictionaryItem | null>(null)

const isRootItem = (row: TreeDictionaryItem) => row.code === '__ROOT__' || (row.parent_id === '0' && row.name === '默认根目录')

const tableExpandedKeys = ref<Record<string, boolean>>({})

const collectTreeTableExpandableKeys = (nodes: any[], out: Record<string, boolean>) => {
  for (const n of nodes) {
    if (Array.isArray(n.children) && n.children.length > 0) {
      out[String(n.key)] = true
      collectTreeTableExpandableKeys(n.children, out)
    }
  }
}

const expandAllItems = () => {
  const out: Record<string, boolean> = {}
  collectTreeTableExpandableKeys(tableData.value, out)
  tableExpandedKeys.value = out

  if (Object.keys(out).length === 0) {
    toast.add({ severity: 'info', summary: '提示', detail: '没有可展开的节点', life: 2000 })
  }
}

const collapseAllItems = () => {
  tableExpandedKeys.value = {}
}

const getNextSortOrder = (groupName: string, parentId: string) => {
  const siblings = flatDataList.value.filter((i) => i.group_name === groupName && i.parent_id === parentId)
  let max = 0
  for (const s of siblings) max = Math.max(max, Number(s.sort_order || 0))
  return max + 10
}

const ensureGroupRootDirectory = async (groupName: string) => {
  if (!groupName || groupName === '所有分组') {
    groupRootDirectory.value = null
    return null
  }

  try {
    const res = await window.electronAPI.treeDictionary.getList({
      group_name: groupName,
      parent_id: '0',
      page: 1,
      pageSize: 50,
    })

    const roots = res.success && res.data ? res.data.data : []
    const existing =
      roots.find((r) => r.code === '__ROOT__') ||
      roots.find((r) => r.name === '默认根目录') ||
      roots[0]

    if (existing) {
      groupRootDirectory.value = existing
      return existing
    }

    const created = await window.electronAPI.treeDictionary.create({
      parent_id: '0',
      name: '默认根目录',
      code: '__ROOT__',
      sort_order: 0,
      group_name: groupName,
    })
    if (created.success && created.data) {
      groupRootDirectory.value = created.data
      return created.data
    }
  } catch (error) {
    logger.error('Failed to ensure group root directory', error)
  }

  groupRootDirectory.value = null
  return null
}

const loadData = async () => {
  loading.value = true
  try {
    const search = searchQuery.value.trim()
    const query: TreeDictionaryQueryDTO = {
      page: pagination.value.page,
      pageSize: pagination.value.pageSize,
      group_name: currentGroupName.value === '所有分组' ? undefined : currentGroupName.value,
      ...(search ? { search } : {})
    }
    
    query.searchFields = ['name', 'code', 'value', 'remark']
    
    const res = await window.electronAPI.treeDictionary.getList(query)
    if (res.success && res.data) {
      flatDataList.value = res.data.data
      tableData.value = buildTreeTableData(flatDataList.value)
      pagination.value.total = res.data.total
    }
  } catch (error) {
    logger.error('Failed to load tree dictionaries', error)
  } finally {
    loading.value = false
  }
}

// ─── CRUD Actions ──────────────────────────────────────────────────────────
const dialogVisible = ref(false)
const importDialogVisible = ref(false)
const isEditMode = ref(false)
const editingData = ref<TreeDictionaryItem | null>(null)

const cm = ref()
const selectedContextKey = ref<string | null>(null)

const onRowContextMenu = (event: any) => {
  cm.value.show(event.originalEvent)
}

const getFlatItemByKey = (key: string) => flatDataList.value.find(item => item.id === key)

const menuModel = computed(() => {
  const item = selectedContextKey.value ? getFlatItemByKey(selectedContextKey.value) : null
  return [
    { label: '新增子项', icon: 'pi pi-plus', command: () => { if (selectedContextKey.value) handleAddChildFromContext() } },
    { label: '修改', icon: 'pi pi-pencil', command: () => { if (selectedContextKey.value) handleEditFromContext() } },
    { label: '删除', icon: 'pi pi-trash', command: () => { if (selectedContextKey.value) handleDeleteFromContext() } }
  ]
})

const handleAddChildFromContext = () => {
  const item = getFlatItemByKey(selectedContextKey.value!)
  if (item) addDictChild(item)
}

const handleEditFromContext = () => {
  const item = getFlatItemByKey(selectedContextKey.value!)
  if (item) editRow(item)
}

const handleDeleteFromContext = () => {
  const item = getFlatItemByKey(selectedContextKey.value!)
  if (item) deleteRow(item)
}

const openAddDialog = async () => {
  isEditMode.value = false
  const groupName = currentGroupName.value !== '所有分组' ? currentGroupName.value : ''
  let rootId: string | undefined
  if (groupName) {
    const root = await ensureGroupRootDirectory(groupName)
    rootId = root?.id
  }

  editingData.value = {
    group_name: groupName,
    parent_id: rootId || undefined,
    sort_order: groupName ? getNextSortOrder(groupName, rootId || '0') : 0,
  } as any
  dialogVisible.value = true
}

const addDictChild = (parent: TreeDictionaryItem) => {
  isEditMode.value = false
  const nextSort = parent.group_name ? getNextSortOrder(parent.group_name, parent.id) : 0
  editingData.value = { 
    parent_id: parent.id, 
    group_name: parent.group_name,
    sort_order: nextSort,
  } as any
  dialogVisible.value = true
}

const handleImport = () => {
  importDialogVisible.value = true
}

const handleDialogSave = () => {
  loadData()
}

const editRow = (row: TreeDictionaryItem) => {
  if (isRootItem(row)) {
    toast.add({ severity: 'warn', summary: '提示', detail: '根目录不支持编辑', life: 2500 })
    return
  }
  isEditMode.value = true
  editingData.value = row
  dialogVisible.value = true
}

const deleteRow = (row: TreeDictionaryItem) => {
  if (isRootItem(row)) {
    toast.add({ severity: 'warn', summary: '提示', detail: '根目录不支持删除', life: 2500 })
    return
  }
  confirm.require({
    message: `确定要删除 "${row.name}" 吗？（其子项也将被删除，且不可恢复）`,
    header: '删除确认',
    icon: 'pi pi-exclamation-triangle',
    acceptClass: 'p-button-danger',
    acceptLabel: '删除',
    accept: async () => {
      try {
        const res = await window.electronAPI.treeDictionary.delete(row.id)
        if (res.success) {
          toast.add({ severity: 'success', summary: '成功', detail: '已删除', life: 3000 })
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
  const keys = Object.keys(selectedKeys.value).filter(k => selectedKeys.value[k])
  if (keys.length === 0) return
  const items = keys.map((k) => getFlatItemByKey(k)).filter(Boolean) as TreeDictionaryItem[]
  const ignoredRootCount = items.filter((i) => isRootItem(i)).length
  const validItems = items.filter((i) => !isRootItem(i))
  if (validItems.length === 0) {
    toast.add({ severity: 'warn', summary: '提示', detail: '根目录不支持批量操作', life: 2500 })
    return
  }
  confirm.require({
    message: `确定要删除选中的 ${validItems.length} 个节点吗？（其子项也将被删除，且不可恢复）`,
    header: '批量删除确认',
    icon: 'pi pi-exclamation-triangle',
    acceptClass: 'p-button-danger',
    acceptLabel: '删除',
    accept: async () => {
      try {
        let deletedCount = 0
        for (const item of validItems) {
          const res = await window.electronAPI.treeDictionary.delete(item.id)
          if (res.success) deletedCount++
        }
        const detailParts: string[] = []
        if (deletedCount > 0) detailParts.push(`已删除 ${deletedCount} 个`)
        if (ignoredRootCount > 0) detailParts.push(`已忽略根目录 ${ignoredRootCount} 个`)
        toast.add({ severity: 'success', summary: '成功', detail: detailParts.join('，') || '操作完成', life: 3000 })
        selectedKeys.value = {}
        loadData()
      } catch (error) {
        logger.error('Batch delete failed', error)
        toast.add({ severity: 'error', summary: '操作失败', detail: '出现异常', life: 3000 })
      }
    }
  })
}

// ─── Move Up / Down ────────────────────────────────────────────────────────
const moveUpRow = async (node: any) => {
  const currentItem = node?.data as TreeDictionaryItem | undefined
  if (!currentItem || isRootItem(currentItem)) return

  const siblings = flatDataList.value
    .filter((i) => i.group_name === currentItem.group_name && i.parent_id === currentItem.parent_id)
    .sort((a, b) => {
      const sa = Number(a.sort_order || 0)
      const sb = Number(b.sort_order || 0)
      if (sa !== sb) return sa - sb
      return String(a.created_at || '').localeCompare(String(b.created_at || ''))
    })

  const idx = siblings.findIndex((i) => i.id === currentItem.id)
  if (idx <= 0) return

  const reordered = [...siblings]
  ;[reordered[idx - 1], reordered[idx]] = [reordered[idx], reordered[idx - 1]]

  const updates = reordered.map((item, index) => ({ id: item.id, sort_order: (index + 1) * 10 }))
  try {
    await window.electronAPI.treeDictionary.updateSort(updates)
    loadData()
  } catch (error) {
    logger.error('Move up failed', error)
  }
}

const moveDownRow = async (node: any) => {
  const currentItem = node?.data as TreeDictionaryItem | undefined
  if (!currentItem || isRootItem(currentItem)) return

  const siblings = flatDataList.value
    .filter((i) => i.group_name === currentItem.group_name && i.parent_id === currentItem.parent_id)
    .sort((a, b) => {
      const sa = Number(a.sort_order || 0)
      const sb = Number(b.sort_order || 0)
      if (sa !== sb) return sa - sb
      return String(a.created_at || '').localeCompare(String(b.created_at || ''))
    })

  const idx = siblings.findIndex((i) => i.id === currentItem.id)
  if (idx < 0 || idx >= siblings.length - 1) return

  const reordered = [...siblings]
  ;[reordered[idx], reordered[idx + 1]] = [reordered[idx + 1], reordered[idx]]

  const updates = reordered.map((item, index) => ({ id: item.id, sort_order: (index + 1) * 10 }))
  try {
    await window.electronAPI.treeDictionary.updateSort(updates)
    loadData()
  } catch (error) {
    logger.error('Move down failed', error)
  }
}
</script>

<style scoped>
.tree-dictionary-tree-resizer {
  position: absolute;
  top: 0;
  right: -3px;
  height: 100%;
  width: 6px;
  cursor: col-resize;
  z-index: 30;
  -webkit-app-region: no-drag;
}

.tree-dictionary-tree-resizer:hover,
.tree-dictionary-tree-resizer.is-resizing {
  background: color-mix(in srgb, var(--btn-primary-bg) 18%, transparent);
}

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
:deep(.p-tree-node-icon),
:deep(.p-tree-node-toggle-button) {
  color: var(--content-text-secondary) !important;
}
:deep(.p-tree-node-content.p-tree-node-selected .p-tree-node-toggle-button) {
  color: var(--btn-primary-bg) !important;
}

:deep(.custom-paginator) {
  background: var(--content-card-bg) !important;
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

/* TreeTable 适配 */
:deep(.custom-treetable) {
  background: transparent !important;
}
:deep(.custom-treetable .p-treetable-header) {
  background: transparent !important;
  border-bottom: 1px solid var(--content-border) !important;
}
:deep(.custom-treetable .p-treetable-thead > tr > th) {
  background: var(--sidebar-bg) !important;
  color: var(--content-text-secondary) !important;
  border-color: var(--content-border) !important;
  font-weight: 600;
}
:deep(.custom-treetable .p-treetable-tbody > tr) {
  background: transparent !important;
  color: var(--content-text) !important;
}
:deep(.custom-treetable .p-treetable-tbody > tr:hover) {
  background: var(--sidebar-hover-bg) !important;
}
:deep(.custom-treetable .p-treetable-tbody > tr > td) {
  border-color: var(--content-border) !important;
}
:deep(.custom-treetable .p-treetable-tbody > tr.p-highlight) {
  background: var(--sidebar-active-bg) !important;
  color: var(--content-text) !important;
}
:deep(.p-treetable-toggler) {
  color: var(--content-text-secondary) !important;
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
</style>
