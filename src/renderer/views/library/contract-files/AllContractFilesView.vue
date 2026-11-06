<template>
  <main class="flex h-full w-full flex-col overflow-hidden bg-[var(--content-bg)] text-[var(--content-text)]">
    <div v-if="!libraryPath" class="flex flex-1 items-center justify-center text-sm text-[var(--content-text-secondary)]">
      请先选择资源库
    </div>

    <div v-else class="flex flex-row min-h-0 flex-1 overflow-hidden">
      <aside
        class="tree-panel relative shrink-0 overflow-hidden border-r border-[var(--content-border)] bg-[var(--sidebar-bg)]"
        :style="{ width: `${treePanelWidth}px` }"
        @contextmenu.stop.prevent
      >
        <div class="flex h-full min-h-0 flex-col">
          <header
            class="flex items-center justify-between px-4 h-14 shrink-0 border-b border-[var(--content-border)] bg-[var(--sidebar-bg)]/50 backdrop-blur-sm"
            style="-webkit-app-region: drag;"
          >
            <div class="flex items-center gap-2" style="-webkit-app-region: no-drag;">
              <i class="pi pi-folder-open text-[var(--btn-primary-bg)] opacity-80"></i>
              <h2 class="font-bold">目录树</h2>
            </div>
          </header>

          <div class="p-3 flex flex-col gap-3 flex-1 overflow-hidden">
            <div class="relative w-full" style="-webkit-app-region: no-drag;">
              <InputText
                v-model="treeSearchQuery"
                placeholder="搜索目录树..."
                class="w-full !pl-10 h-9 !bg-[var(--input-bg)] !border-[var(--input-border)] !text-[var(--content-text)] placeholder:!text-[var(--content-text-secondary)] focus:!border-[var(--btn-primary-bg)]"
              />
              <i class="pi pi-search absolute left-3 top-1/2 -translate-y-1/2 text-[var(--content-text-secondary)] text-xs"></i>
            </div>

            <div class="flex-1 min-h-0 overflow-auto bg-[var(--sidebar-bg)]">
              <Tree
                :value="treeNodes"
                selectionMode="single"
                :selectionKeys="treeSelectionKeys"
                @update:selectionKeys="onTreeSelectionChange"
                v-model:expandedKeys="treeExpandedKeys"
                class="bg-transparent border-none p-0 text-sm !text-[var(--content-text)]"
              >
                <template #default="slotProps">
                  <div
                    class="flex items-center gap-2 py-1"
                    @dblclick.stop="onTreeNodeDblclick(slotProps.node)"
                    @contextmenu.prevent.stop="onTreeNodeContextMenu($event, slotProps.node)"
                  >
                    <i :class="[getTreeNodeIcon(slotProps.node), 'text-xs']" :style="getTreeNodeIconStyle(slotProps.node)" />
                    <span class="truncate text-sm" :title="slotProps.node.label">{{ slotProps.node.label }}</span>
                  </div>
                </template>
              </Tree>

              <ContextMenu ref="treeCm" :model="treeMenuModel" @hide="treeContextMenuTarget = null">
                <template #item="{ item, props }">
                  <a class="flex items-center justify-between w-full" v-bind="props.action">
                    <span class="flex items-center min-w-0">
                      <span v-if="(item as any).colorHex" class="w-2.5 h-2.5 rounded-sm shrink-0" :style="{ backgroundColor: (item as any).colorHex }" />
                      <span v-else :class="[(item as any).icon, (item as any).class]" />
                      <span :class="['ml-2 truncate', (item as any).class]">{{ (item as any).label }}</span>
                    </span>
                    <span v-if="(item as any).shortcut" class="ml-6 text-xs text-[var(--content-text-secondary)]">{{ (item as any).shortcut }}</span>
                  </a>
                </template>
              </ContextMenu>
            </div>
          </div>
        </div>
        <div class="tree-panel-resizer" :class="{ 'is-resizing': isResizingTreePanel }" @mousedown.prevent="startTreePanelResize" />
      </aside>

      <section class="flex min-w-0 flex-1 flex-col bg-[var(--content-bg)] overflow-hidden">
        <AllContractFilesHeader
          v-model:search="search"
          :filterBtnClass="filterBtnClass"
          :currentScopeLabel="currentScopeLabel"
          :searchPlaceholder="searchPlaceholder"
          :canGoUp="canGoUpFolder"
          @goUp="goUpFolder"
          @openGlobalSearch="openGlobalSearch"
          @toggleFilterBar="toggleFilterBar"
        />

        <AllContractFilesFilterBar
          :visible="filterBarVisible"
          :items="filterBarItems"
          :selectedContractDisplay="selectedContractDisplay"
          :selectedFormatDisplay="selectedFormatDisplay"
          v-model:contractSearchQuery="contractSearchQuery"
          v-model:formatSearchQuery="formatSearchQuery"
          :filteredContractOptions="filteredContractOptions"
          :filteredFileTypeStats="filteredFileTypeStats"
          :selectedContracts="selectedContracts"
          :selectedFormats="selectedFormats"
          @clearContractSelection="clearContractSelection"
          @clearFormatSelection="clearFormatSelection"
          @toggleContractSelection="toggleContractSelection"
          @toggleFormatSelection="toggleFormatSelection"
        />

        <div class="p-6 flex-1 overflow-hidden flex flex-col gap-3">
          <div v-if="breadcrumbItems.length" class="shrink-0">
            <ContractFilesBreadcrumb
              :items="breadcrumbItems"
              :canGoUp="canGoUpFolder"
              @go-up="goUpFolder"
              @navigate="navigateToFolder"
            />
          </div>

          <div v-if="errorMessage" class="shrink-0 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
            {{ errorMessage }}
          </div>

          <div v-if="loading" class="flex flex-1 items-center justify-center">
            <ProgressSpinner style="width: 36px; height: 36px" strokeWidth="3" />
          </div>

          <div
            v-else
            ref="fileAreaEl"
            class="flex-1 min-h-0"
            @dragstart.capture="onFileAreaDragStart"
            @dragend.capture="onFileAreaDragEnd"
          >
            <DataTable
              :value="sortedItems"
              dataKey="key"
              :contextMenuSelection="contextMenuSelection"
              sortMode="single"
              :sortField="sortField"
              :sortOrder="sortOrder"
              :customSort="true"
              :scrollable="true"
              :virtualScrollerOptions="{ itemSize: 44 }"
              scrollHeight="flex"
              class="h-full custom-datatable p-datatable-sm"
              stripedRows
              rowHover
              :rowClass="rowClass"
              @sort="onSort"
              @row-click="onRowClick"
              @row-dblclick="onRowDblclick"
              @rowContextmenu="onRowContextMenu"
            >
              <template #empty>
                <div class="flex flex-col items-center justify-center py-10 text-[var(--content-text-secondary)]">
                  <i class="pi pi-inbox mb-3 text-3xl opacity-50"></i>
                  <p>当前目录没有匹配项目</p>
                </div>
              </template>

              <Column header="名称" field="name" sortable style="min-width: 18rem">
                <template #body="{ data }">
                  <div
                    class="flex min-w-0 items-center gap-2 cursor-pointer"
                    :draggable="!!data.fileId"
                    :data-contract-file-id="data.fileId || undefined"
                  >
                    <i
                      v-if="data.type === 'contract'"
                      class="pi pi-briefcase text-sm text-[var(--btn-primary-bg)]"
                    />
                    <img
                      v-else
                      :src="getContractFileIconUrl(data.record || data)"
                      class="h-4 w-4 shrink-0 object-contain"
                      alt=""
                      decoding="async"
                      loading="lazy"
                    />
                    <div class="min-w-0">
                      <div class="truncate text-[var(--content-text)]" :title="data.name">{{ data.name }}</div>
                      <div
                        v-if="data.type === 'contract' && data.contractName && data.contractName !== data.name"
                        class="truncate text-xs text-[var(--content-text-secondary)]"
                        :title="data.contractName"
                      >
                        {{ data.contractName }}
                      </div>
                    </div>
                  </div>
                </template>
              </Column>

              <Column header="所属合同" field="contractNo" sortable style="min-width: 18rem">
                <template #body="{ data }">
                  <button
                    type="button"
                    class="flex min-w-0 flex-col items-start text-left cursor-pointer"
                    @click.stop="openContractFiles(data.contractId)"
                  >
                    <span class="truncate text-sm text-[var(--content-text)]" :title="data.contractNo || '-'">
                      {{ data.contractNo || '-' }}
                    </span>
                    <span class="truncate text-xs text-[var(--content-text-secondary)]" :title="data.contractName || ''">
                      {{ data.contractName || '未命名合同' }}
                    </span>
                  </button>
                </template>
              </Column>

              <Column header="类型" field="type" sortable style="width: 7rem">
                <template #body="{ data }">
                  <div class="cursor-pointer" :draggable="!!data.fileId" :data-contract-file-id="data.fileId || undefined">
                    <span class="text-xs text-[var(--content-text-secondary)]">{{ getListItemTypeText(data) }}</span>
                  </div>
                </template>
              </Column>

              <Column header="大小" field="size" sortable style="width: 7rem">
                <template #body="{ data }">
                  <div class="cursor-pointer" :draggable="!!data.fileId" :data-contract-file-id="data.fileId || undefined">
                    <span class="text-xs text-[var(--content-text-secondary)]">{{ data.type === 'file' ? formatSize(data.size) : '-' }}</span>
                  </div>
                </template>
              </Column>

              <Column header="修改时间" field="mtime" sortable style="width: 12rem">
                <template #body="{ data }">
                  <div class="cursor-pointer" :draggable="!!data.fileId" :data-contract-file-id="data.fileId || undefined">
                    <span class="text-xs text-[var(--content-text-secondary)]">{{ formatTime(data.mtime) }}</span>
                  </div>
                </template>
              </Column>
            </DataTable>

            <ContextMenu ref="cm" :model="menuModel" @hide="contextMenuSelection = null">
              <template #item="{ item, props }">
                <a class="flex items-center justify-between w-full" v-bind="props.action">
                  <span class="flex items-center min-w-0">
                    <span :class="[item.icon, item.class]" />
                    <span :class="['ml-2 truncate', item.class]">{{ item.label }}</span>
                  </span>
                  <span v-if="item.shortcut" class="ml-6 text-xs text-[var(--content-text-secondary)]">{{ item.shortcut }}</span>
                </a>
              </template>
            </ContextMenu>
          </div>
        </div>
      </section>
    </div>

    <RenameDialog
      v-model:visible="renameDialogVisible"
      :record="renameDialogRecord"
      :submitting="renameDialogSubmitting"
      :submitError="renameDialogError"
      @confirm="confirmRename"
      @clear-submit-error="() => (renameDialogError = '')"
    />
    <FilePropertiesDialog v-model:visible="propertiesDialogVisible" :record="propertiesDialogRecord" />
    <CreateFolderDialog
      v-model:visible="createFolderDialogVisible"
      :parentPath="createFolderDialogParentPath"
      :submitting="createFolderDialogSubmitting"
      :submitError="createFolderDialogError"
      @confirm="confirmCreateFolder"
      @clear-submit-error="() => (createFolderDialogError = '')"
    />
    <ContractDetailDrawer
      v-model:visible="contractDetailVisible"
      :libraryPath="libraryPath"
      :contractId="contractDetailContractId"
    />

    <AllContractFilesStatusBar
      :currentPath="currentDir || libraryRootDir || libraryPath"
      :totalItems="sortedItems.length"
      :contractCount="itemStats.contractCount"
      :folderCount="itemStats.folderCount"
      :fileCount="itemStats.fileCount"
      :selectedCount="selectedItemKey ? 1 : 0"
    />
  </main>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import Column from 'primevue/column'
import ContextMenu from 'primevue/contextmenu'
import DataTable from 'primevue/datatable'
import InputText from 'primevue/inputtext'
import ProgressSpinner from 'primevue/progressspinner'
import Tree from 'primevue/tree'
import type { TreeNode } from 'primevue/treenode'
import { useConfirm } from 'primevue/useconfirm'
import { useToast } from 'primevue/usetoast'
import type { DataTableSortEvent } from 'primevue/datatable'
import type {
  ContractFileAllGroup,
  ContractFileDirectoryListItem,
  ContractFileDirectoryTreeNode,
  ContractFileRecord,
  ContractFileRecordWithContractName,
} from '../../../../shared/types/contractFile.types'
import { getContractFileIconUrl } from '../../../utils/contractFileIcons'
import RenameDialog from './components/RenameDialog.vue'
import FilePropertiesDialog from './components/FilePropertiesDialog.vue'
import CreateFolderDialog from './components/CreateFolderDialog.vue'
import AllContractFilesHeader from './components/AllContractFilesHeader.vue'
import AllContractFilesFilterBar from './components/AllContractFilesFilterBar.vue'
import AllContractFilesStatusBar from './components/AllContractFilesStatusBar.vue'
import ContractFilesBreadcrumb from './components/ContractFilesBreadcrumb.vue'
import ContractDetailDrawer from '../resource/components/ContractDetailDrawer.vue'
import { copyTextToClipboard, dirname, formatSize, formatTime, getExt, normalizePathForCompare } from './contractFilesHelpers'
import { remapPathAfterFolderRename } from '../../../../shared/utils/pathRename'

type AllFilesTreeNode = TreeNode & {
  data?: {
    path: string
    nodeType: 'root' | 'contract' | 'folder'
    contractId?: string | null
    contractNo?: string | null
    contractName?: string | null
  }
  children?: AllFilesTreeNode[]
}

const router = useRouter()
const confirm = useConfirm()
const toast = useToast()

const libraryPath = computed(() => String(localStorage.getItem('currentLibraryPath') || '').trim())

const treePanelStorageKey = computed(() => {
  const lp = String(libraryPath.value || '').trim()
  if (!lp) return 'all-contract-files:tree-panel-width'
  return `all-contract-files:tree-panel-width:${lp}`
})
const TREE_PANEL_WIDTH_DEFAULT = 380
const TREE_PANEL_WIDTH_MIN = 260
const TREE_PANEL_WIDTH_MAX = 560
const clampTreePanelWidth = (width: number) =>
  Math.min(TREE_PANEL_WIDTH_MAX, Math.max(TREE_PANEL_WIDTH_MIN, Math.round(width)))
const treePanelWidth = ref<number>(TREE_PANEL_WIDTH_DEFAULT)

watch(
  () => treePanelStorageKey.value,
  () => {
    const saved = Number(localStorage.getItem(treePanelStorageKey.value))
    if (Number.isFinite(saved) && saved > 0) {
      treePanelWidth.value = clampTreePanelWidth(saved)
      return
    }
    treePanelWidth.value = TREE_PANEL_WIDTH_DEFAULT
  },
  { immediate: true },
)

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
  localStorage.setItem(treePanelStorageKey.value, String(treePanelWidth.value))
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

const search = ref('')
const loading = ref(false)
const errorMessage = ref('')
const groups = ref<ContractFileAllGroup[]>([])
const directoryTree = ref<ContractFileDirectoryTreeNode[]>([])
const libraryRootDir = ref('')
const currentDir = ref('')
const fileAreaEl = ref<HTMLElement | null>(null)

const filterBarVisible = ref(false)
const contractSearchQuery = ref('')
const selectedContracts = ref<string[]>([])
const formatSearchQuery = ref('')
const selectedFormats = ref<string[]>([])
const cm = ref()
const treeCm = ref()
const selectedItemKey = ref('')
const contextMenuSelection = ref<ContractFileDirectoryListItem | null>(null)
const contextMenuTarget = ref<ContractFileDirectoryListItem | null>(null)
const treeExpandedKeys = ref<Record<string, boolean>>({})
const treeSelectionKeys = ref<Record<string, boolean>>({})
const treeContextMenuTarget = ref<AllFilesTreeNode | null>(null)
const treeSearchQuery = ref('')

const renameDialogVisible = ref(false)
const renameDialogSubmitting = ref(false)
const renameDialogRecord = ref<ContractFileRecord | null>(null)
const renameDialogError = ref('')
const createFolderDialogVisible = ref(false)
const createFolderDialogSubmitting = ref(false)
const createFolderDialogError = ref('')
const createFolderDialogParentPath = ref('')
const createFolderDialogContractId = ref('')
const createFolderDialogContractNo = ref('')
const propertiesDialogVisible = ref(false)
const propertiesDialogRecord = ref<ContractFileRecord | null>(null)
const contractDetailVisible = ref(false)
const contractDetailContractId = ref<string | null>(null)

const sortField = ref('name')
const sortOrder = ref<1 | -1>(1)

type FolderColorKey = 'red' | 'orange' | 'yellow' | 'green' | 'blue' | 'purple'
type FolderColorOption = { key: FolderColorKey; label: string; colorHex: string; shortcut: string }

const folderColorOptions: FolderColorOption[] = [
  { key: 'red', label: '红色', colorHex: '#ef4444', shortcut: 'Alt+1' },
  { key: 'orange', label: '橙色', colorHex: '#f97316', shortcut: 'Alt+2' },
  { key: 'yellow', label: '黄色', colorHex: '#eab308', shortcut: 'Alt+3' },
  { key: 'green', label: '绿色', colorHex: '#22c55e', shortcut: 'Alt+4' },
  { key: 'blue', label: '蓝色', colorHex: '#3b82f6', shortcut: 'Alt+5' },
  { key: 'purple', label: '紫色', colorHex: '#a855f7', shortcut: 'Alt+6' },
]

const folderColorLegacyStorageKey = computed(() => {
  const lp = String(libraryPath.value || '').trim()
  if (!lp) return ''
  return `contract-files:all-folder-colors:${lp}`
})

const folderColorMap = ref<Record<string, FolderColorKey>>({})

const filterBtnClass = computed(() => [
  'p-button-sm',
  'p-button-secondary',
  'p-button-text',
  '!w-8',
  '!h-8',
  '!p-0',
  'custom-icon-btn',
  'hover:!bg-[var(--sidebar-hover-bg)]',
  filterBarVisible.value || selectedFormats.value.length || selectedContracts.value.length ? '!bg-[var(--sidebar-active-bg)] !text-[var(--btn-primary-bg)]' : '',
].join(' '))

const filterBarItems = computed(() => [
  { key: 'contract', icon: 'pi pi-briefcase', label: '合同' },
  { key: 'format', icon: 'pi pi-sliders-h', label: '格式' },
])

const toggleFilterBar = () => {
  filterBarVisible.value = !filterBarVisible.value
}

watch(
  () => filterBarVisible.value,
  (visible) => {
    if (visible) return
    contractSearchQuery.value = ''
    formatSearchQuery.value = ''
  }
)

const buildItemKey = (value: string) => normalizePathForCompare(value) || String(value || '').trim()

const isPathWithinRoot = (targetPath: string, rootPath: string) => {
  const target = normalizePathForCompare(targetPath)
  const root = normalizePathForCompare(rootPath)
  if (!target || !root) return false
  return target === root || target.startsWith(`${root}/`)
}

const toRecordWithContractName = (
  group: ContractFileAllGroup,
  record: ContractFileRecord,
): ContractFileRecordWithContractName => ({
  ...(record as ContractFileRecordWithContractName),
  contractName: String((record as ContractFileRecordWithContractName).contractName || group.contractName || ''),
})

const toDirectoryItemFromRecord = (
  group: ContractFileAllGroup,
  record: ContractFileRecord,
): ContractFileDirectoryListItem => {
  const withContractName = toRecordWithContractName(group, record)
  return {
    key: String(withContractName.fileId || `${withContractName.type}:${withContractName.path}`),
    fileId: String(withContractName.fileId || '').trim() || null,
    name: String(withContractName.name || ''),
    path: String(withContractName.path || ''),
    type: withContractName.type,
    contractId: String(withContractName.contractId || ''),
    contractNo: String(withContractName.contractNo || group.contractNo || ''),
    contractName: String(withContractName.contractName || group.contractName || ''),
    size: withContractName.size ?? null,
    mtime: withContractName.mtime ?? null,
    record: withContractName,
  }
}

const toContractRootItem = (group: ContractFileAllGroup): ContractFileDirectoryListItem => ({
  key: `contract:${group.contractId}`,
  fileId: null,
  name: String(group.contractNo || group.contractName || group.contractId),
  path: String(group.rootDir || ''),
  type: 'contract',
  contractId: String(group.contractId || ''),
  contractNo: String(group.contractNo || ''),
  contractName: String(group.contractName || ''),
  size: null,
  mtime: null,
  record: null,
})

const buildCurrentItemsForGroup = (group: ContractFileAllGroup, targetDir: string) => {
  const dirKey = normalizePathForCompare(targetDir)
  if (!dirKey) return [] as ContractFileDirectoryListItem[]
  return (Array.isArray(group.items) ? group.items : [])
    .filter((item) => normalizePathForCompare(dirname(String(item?.path || ''))) === dirKey)
    .map((item) => toDirectoryItemFromRecord(group, item))
}

const currentItemsBase = computed(() => {
  const root = String(libraryRootDir.value || '').trim()
  const dir = String(currentDir.value || root).trim() || root
  const nRoot = normalizePathForCompare(root)
  const nDir = normalizePathForCompare(dir)
  if (!nRoot || !nDir) return [] as ContractFileDirectoryListItem[]
  if (nRoot === nDir) {
    return groups.value
      .map((group) => toContractRootItem(group))
      .sort((a, b) => compareText(a.name, b.name))
  }
  const group = groups.value.find((item) => isPathWithinRoot(dir, item.rootDir))
  if (!group) return []
  return buildCurrentItemsForGroup(group, dir).sort((a, b) => compareByField(a, b, 'name'))
})

const recordByFileId = computed(() => {
  const map = new Map<string, ContractFileRecordWithContractName>()
  for (const group of groups.value) {
    for (const item of Array.isArray(group.items) ? group.items : []) {
      const fileId = String(item?.fileId || '').trim()
      if (!fileId) continue
      map.set(fileId, toRecordWithContractName(group, item))
    }
  }
  return map
})

const treeIndex = computed(() => {
  const byKey = new Map<string, AllFilesTreeNode>()
  const parentByKey = new Map<string, string | null>()

  const mapNode = (node: ContractFileDirectoryTreeNode, parentKey: string | null): AllFilesTreeNode => {
    const path = String(node.path || '').trim()
    const key = buildItemKey(path) || String(node.key || path || parentKey || '__tree__')
    
    let displayLabel = String(node.name || '')
    if (node.nodeType === 'contract') {
      const contractName = String(node.contractName || '').trim()
      const contractNo = String(node.contractNo || '').trim()
      if (contractName && contractNo) {
        displayLabel = `${contractName} (${contractNo})`
      } else if (contractName) {
        displayLabel = contractName
      } else if (contractNo) {
        displayLabel = contractNo
      }
    }
    
    const mapped: AllFilesTreeNode = {
      key,
      label: displayLabel,
      data: {
        path,
        nodeType: node.nodeType,
        contractId: node.contractId ?? null,
        contractNo: node.contractNo ?? null,
        contractName: node.contractName ?? null,
      },
      children: [],
    }
    byKey.set(key, mapped)
    parentByKey.set(key, parentKey)
    mapped.children = (Array.isArray(node.children) ? node.children : []).map((child) => mapNode(child, key))
    return mapped
  }

  const nodes = (Array.isArray(directoryTree.value) ? directoryTree.value : []).map((node) => mapNode(node, null))
  return { nodes, byKey, parentByKey }
})

const treeSearchTokens = computed(() => normalizeSearchTokens(treeSearchQuery.value))

const shouldShowNode = (node: AllFilesTreeNode, tokens: string[]): boolean => {
  if (!tokens.length) return true
  
  const haystack = [
    node?.label || '',
    node?.data?.path || '',
    node?.data?.contractNo || '',
    node?.data?.contractName || '',
  ].join(' ').toLowerCase()
  
  const nodeMatches = tokens.every((token) => haystack.includes(token))
  if (nodeMatches) return true
  
  if (node.children && node.children.length > 0) {
    return node.children.some((child) => shouldShowNode(child as AllFilesTreeNode, tokens))
  }
  
  return false
}

const filterTreeNodes = (nodes: AllFilesTreeNode[], tokens: string[]): AllFilesTreeNode[] => {
  if (!tokens.length) return nodes
  
  return nodes
    .filter((node) => shouldShowNode(node, tokens))
    .map((node) => ({
      ...node,
      children: node.children ? filterTreeNodes(node.children as AllFilesTreeNode[], tokens) : undefined,
    }))
}

const getExpandedKeysForSearch = (tokens: string[]): Record<string, boolean> => {
  if (!tokens.length) return treeExpandedKeys.value
  
  const expanded: Record<string, boolean> = {}
  const { byKey, parentByKey } = treeIndex.value
  
  const collectExpandedKeys = (nodes: AllFilesTreeNode[]) => {
    for (const node of nodes) {
      if (shouldShowNode(node, tokens)) {
        let currentKey: string | null = node.key
        while (currentKey) {
          expanded[currentKey] = true
          currentKey = parentByKey.get(currentKey) || null
        }
        if (node.children) {
          collectExpandedKeys(node.children as AllFilesTreeNode[])
        }
      }
    }
  }
  
  collectExpandedKeys(treeIndex.value.nodes)
  return expanded
}

const displayedTreeNodes = computed(() => filterTreeNodes(treeIndex.value.nodes, treeSearchTokens.value))
const treeNodes = computed(() => displayedTreeNodes.value)
const treeNodeByKey = computed(() => treeIndex.value.byKey)
const treeParentByKey = computed(() => treeIndex.value.parentByKey)

const getLegacyFolderColorMap = () => {
  const key = folderColorLegacyStorageKey.value
  if (!key) return {}
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Record<string, FolderColorKey>
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

const removeLegacyFolderColorMap = () => {
  const key = folderColorLegacyStorageKey.value
  if (!key) return
  try {
    localStorage.removeItem(key)
  } catch {}
}

const persistFolderColorMapToDb = async (nextMap?: Record<string, FolderColorKey>) => {
  const lp = String(libraryPath.value || '').trim()
  if (!lp) return
  const map = nextMap || (folderColorMap.value || {})
  try {
    await window.electronAPI.ui.setFolderColorMap({
      libraryPath: lp,
      scope: 'contract-files',
      map,
    })
  } catch {}
}

const loadFolderColorMapFromDb = async () => {
  const lp = String(libraryPath.value || '').trim()
  if (!lp) {
    folderColorMap.value = {}
    return
  }

  const legacy = getLegacyFolderColorMap()
  let dbMap: Record<string, FolderColorKey> = {}
  let canPersist = false
  try {
    const res = await window.electronAPI.ui.getFolderColorMap({ libraryPath: lp, scope: 'contract-files' })
    if (res?.success) {
      dbMap = (res.data?.map || {}) as Record<string, FolderColorKey>
      canPersist = true
    }
  } catch {}

  const merged = { ...(legacy || {}), ...(dbMap || {}) }
  folderColorMap.value = merged

  if (canPersist && Object.keys(legacy || {}).length > 0) {
    try {
      const setRes = await window.electronAPI.ui.setFolderColorMap({ libraryPath: lp, scope: 'contract-files', map: merged })
      if (setRes?.success) removeLegacyFolderColorMap()
    } catch {}
  }
}

watch(
  () => libraryPath.value,
  () => {
    void loadFolderColorMapFromDb()
  },
  { immediate: true },
)

const getFolderColorKeyByPath = (targetPath: string) => {
  const key = normalizePathForCompare(String(targetPath || '').trim())
  if (!key) return ''
  return folderColorMap.value[key] || ''
}

const getFolderColorHexByPath = (targetPath: string) => {
  const key = getFolderColorKeyByPath(targetPath)
  if (!key) return ''
  return folderColorOptions.find((item) => item.key === key)?.colorHex || ''
}

const setFolderColorForPath = (targetPath: string, colorKey: FolderColorKey) => {
  const key = normalizePathForCompare(String(targetPath || '').trim())
  if (!key) return
  folderColorMap.value = { ...(folderColorMap.value || {}), [key]: colorKey }
  void persistFolderColorMapToDb()
}

const clearFolderColorForPath = (targetPath: string) => {
  const key = normalizePathForCompare(String(targetPath || '').trim())
  if (!key) return
  const next = { ...(folderColorMap.value || {}) }
  delete next[key]
  folderColorMap.value = next
  void persistFolderColorMapToDb()
}

const remapFolderColorsAfterFolderRename = (oldPath: string, newPath: string) => {
  const oldKey = normalizePathForCompare(String(oldPath || '').trim())
  const newKey = normalizePathForCompare(String(newPath || '').trim())
  if (!oldKey || !newKey || oldKey === newKey) return

  const next: Record<string, FolderColorKey> = {}
  for (const [key, value] of Object.entries(folderColorMap.value || {})) {
    if (key === oldKey) {
      next[newKey] = value
      continue
    }
    if (key.startsWith(`${oldKey}/`)) {
      next[`${newKey}${key.slice(oldKey.length)}`] = value
      continue
    }
    next[key] = value
  }
  folderColorMap.value = next
  void persistFolderColorMapToDb(next)
}

const getFirstSelectedKey = (keys: Record<string, boolean>) => {
  for (const key of Object.keys(keys || {})) {
    if (keys[key]) return key
  }
  return ''
}

const getTreeNodePath = (node: TreeNode | AllFilesTreeNode | null | undefined) => String(node?.data?.path || '').trim()

const getTreeNodeContractId = (node: TreeNode | AllFilesTreeNode | null | undefined) => String(node?.data?.contractId || '').trim()

const getTreeNodeContractNo = (node: TreeNode | AllFilesTreeNode | null | undefined) => String(node?.data?.contractNo || '').trim()

const getTreeNodeType = (node: TreeNode | AllFilesTreeNode | null | undefined) => String(node?.data?.nodeType || '')

const getTreeNodeIconStyle = (node: TreeNode) => {
  const color = getFolderColorHexByPath(getTreeNodePath(node))
  return { color: color || 'var(--content-text-secondary)' }
}

const syncTreeByCurrentDir = () => {
  const root = String(libraryRootDir.value || '').trim()
  const dir = String(currentDir.value || root).trim() || root
  const rootKey = buildItemKey(root)
  const dirKey = buildItemKey(dir)
  if (!dirKey) {
    treeSelectionKeys.value = {}
    return
  }
  treeSelectionKeys.value = { [dirKey]: true }
  if (!rootKey) return

  const nextExpanded: Record<string, boolean> = { ...(treeExpandedKeys.value || {}), [rootKey]: true }
  let pointer: string | null = dirKey
  while (pointer) {
    nextExpanded[pointer] = true
    pointer = treeParentByKey.value.get(pointer) || null
  }
  treeExpandedKeys.value = nextExpanded
}

watch(
  () => [libraryRootDir.value, currentDir.value],
  () => {
    syncTreeByCurrentDir()
  },
  { immediate: true },
)

watch(
  treeSearchQuery,
  () => {
    const tokens = treeSearchTokens.value
    if (tokens.length > 0) {
      treeExpandedKeys.value = getExpandedKeysForSearch(tokens)
    }
  }
)

const onTreeSelectionChange = (keys: Record<string, boolean>) => {
  treeSelectionKeys.value = keys || {}
  const key = getFirstSelectedKey(treeSelectionKeys.value)
  if (!key) return
  const node = treeNodeByKey.value.get(key)
  const path = String(node?.data?.path || '').trim()
  if (!path) return
  currentDir.value = path
}

const onTreeNodeDblclick = async (node: TreeNode) => {
  const path = String((node as AllFilesTreeNode)?.data?.path || '').trim()
  if (!path) return
  currentDir.value = path
}

const onTreeNodeContextMenu = (event: MouseEvent, node: TreeNode) => {
  const currentNode = node as AllFilesTreeNode
  const key = String(currentNode?.key || '').trim()
  if (key) {
    treeSelectionKeys.value = { [key]: true }
  }
  treeContextMenuTarget.value = currentNode
  treeCm.value?.show(event)
}

const breadcrumbItems = computed(() => {
  const dirKey = buildItemKey(currentDir.value || libraryRootDir.value)
  if (!dirKey) return [] as Array<{ label: string; path: string }>
  const nodes: Array<{ label: string; path: string }> = []
  let pointer: string | null = dirKey
  while (pointer) {
    const node = treeNodeByKey.value.get(pointer)
    if (!node?.data?.path) break
    nodes.push({ label: String(node.label || ''), path: String(node.data.path || '') })
    pointer = treeParentByKey.value.get(pointer) || null
  }
  return nodes.reverse()
})

const currentScopeLabel = computed(() => {
  const last = breadcrumbItems.value[breadcrumbItems.value.length - 1]
  return String(last?.label || '').trim() || String(currentDir.value || libraryRootDir.value || libraryPath.value || '').trim()
})

const isLibraryRootSelected = computed(() => {
  const root = normalizePathForCompare(libraryRootDir.value)
  const dir = normalizePathForCompare(currentDir.value || libraryRootDir.value)
  return !!root && root === dir
})

const searchPlaceholder = computed(() => {
  const root = normalizePathForCompare(libraryRootDir.value)
  const dir = normalizePathForCompare(currentDir.value || libraryRootDir.value)
  if (!dir || !root || dir === root) {
    return '搜索当前目录下的合同、文件夹或文件...'
  }
  return '搜索当前目录下的文件夹或文件...'
})

const canGoUpFolder = computed(() => {
  const root = normalizePathForCompare(libraryRootDir.value)
  const dir = normalizePathForCompare(currentDir.value || libraryRootDir.value)
  if (!root || !dir) return false
  return root !== dir
})

const goUpFolder = () => {
  const root = String(libraryRootDir.value || '').trim()
  const dir = String(currentDir.value || root).trim()
  const nRoot = normalizePathForCompare(root)
  const nDir = normalizePathForCompare(dir)
  if (!root || !nRoot || !nDir || nRoot === nDir) return
  const parent = dirname(dir)
  const nParent = normalizePathForCompare(parent)
  if (!nParent || !nParent.startsWith(nRoot)) {
    currentDir.value = root
    return
  }
  currentDir.value = parent
}

const navigateToFolder = (path: string) => {
  const target = String(path || '').trim()
  if (!target || !isPathWithinRoot(target, libraryRootDir.value)) return
  currentDir.value = target
}

const getTreeNodeIcon = (node: TreeNode) => {
  const nodeType = String((node as AllFilesTreeNode)?.data?.nodeType || '')
  if (nodeType === 'contract') return 'pi pi-briefcase'
  if (nodeType === 'root') return 'pi pi-home'
  return 'pi pi-folder'
}

const folderRecordByPath = computed(() => {
  const map = new Map<string, ContractFileRecordWithContractName>()
  for (const group of groups.value) {
    for (const item of Array.isArray(group.items) ? group.items : []) {
      if (item?.type !== 'folder') continue
      const key = normalizePathForCompare(String(item.path || '').trim())
      if (!key) continue
      map.set(key, toRecordWithContractName(group, item))
    }
  }
  return map
})

const getActiveTreeNode = () => {
  if (treeContextMenuTarget.value) return treeContextMenuTarget.value
  const key = getFirstSelectedKey(treeSelectionKeys.value)
  if (!key) return null
  return treeNodeByKey.value.get(key) || null
}

const openCreateFolderDialogAt = (parentPath: string, contractId: string, contractNo: string) => {
  createFolderDialogParentPath.value = String(parentPath || '').trim()
  createFolderDialogContractId.value = String(contractId || '').trim()
  createFolderDialogContractNo.value = String(contractNo || '').trim()
  createFolderDialogSubmitting.value = false
  createFolderDialogError.value = ''
  createFolderDialogVisible.value = true
}

const isLibraryRootTreeNode = (node: TreeNode | AllFilesTreeNode | null) => getTreeNodeType(node) === 'root'

const isContractRootTreeNode = (node: TreeNode | AllFilesTreeNode | null) => getTreeNodeType(node) === 'contract'

const addSiblingFolderFromTree = () => {
  const node = getActiveTreeNode()
  if (!node || isLibraryRootTreeNode(node) || isContractRootTreeNode(node)) return
  const parentPath = dirname(getTreeNodePath(node))
  const contractId = getTreeNodeContractId(node)
  const contractNo = getTreeNodeContractNo(node)
  if (!parentPath || !contractId || !contractNo) return
  openCreateFolderDialogAt(parentPath, contractId, contractNo)
}

const addChildFolderFromTree = () => {
  const node = getActiveTreeNode()
  if (!node || isLibraryRootTreeNode(node)) return
  const parentPath = getTreeNodePath(node)
  const contractId = getTreeNodeContractId(node)
  const contractNo = getTreeNodeContractNo(node)
  if (!parentPath || !contractId || !contractNo) return
  openCreateFolderDialogAt(parentPath, contractId, contractNo)
}

const renameFolderFromTree = () => {
  const node = getActiveTreeNode()
  if (!node || getTreeNodeType(node) !== 'folder') return
  const key = normalizePathForCompare(getTreeNodePath(node))
  if (!key) return
  const record = folderRecordByPath.value.get(key)
  if (!record) {
    toast.add({ severity: 'warn', summary: '无法重命名', detail: '未找到该目录的记录', life: 2200 })
    return
  }
  openRenameDialog(record)
}

const applyColorToActiveTreeNode = (colorKey: FolderColorKey) => {
  const node = getActiveTreeNode()
  if (!node) return
  setFolderColorForPath(getTreeNodePath(node), colorKey)
}

const clearColorOnActiveTreeNode = () => {
  const node = getActiveTreeNode()
  if (!node) return
  clearFolderColorForPath(getTreeNodePath(node))
}

const treeMenuModel = computed(() => {
  const node = getActiveTreeNode()
  const hasNode = !!node
  const isRoot = hasNode ? isLibraryRootTreeNode(node) : false
  const isContractRoot = hasNode ? isContractRootTreeNode(node) : false
  const canCreateChild = !!(hasNode && !isRoot && getTreeNodeContractId(node) && getTreeNodeContractNo(node))
  const canCreateSibling = !!(hasNode && !isRoot && !isContractRoot && getTreeNodeContractId(node) && getTreeNodeContractNo(node))
  const folderPathKey = normalizePathForCompare(getTreeNodePath(node))
  const canRename = !!(hasNode && getTreeNodeType(node) === 'folder' && folderPathKey && folderRecordByPath.value.get(folderPathKey))

  return [
    { label: '新增同级', icon: 'pi pi-plus', shortcut: 'Ctrl+Alt+N', disabled: !canCreateSibling, command: () => addSiblingFolderFromTree() },
    { label: '新增子级', icon: 'pi pi-plus', shortcut: 'Ctrl+Shift+N', disabled: !canCreateChild, command: () => addChildFolderFromTree() },
    { separator: true },
    { label: '重命名', icon: 'pi pi-pencil', shortcut: 'F2', disabled: !canRename, command: () => renameFolderFromTree() },
    { separator: true },
    {
      label: '标记颜色',
      icon: 'pi pi-palette',
      disabled: !hasNode,
      items: [
        ...folderColorOptions.map((item) => ({
          label: item.label,
          colorHex: item.colorHex,
          shortcut: item.shortcut,
          command: () => applyColorToActiveTreeNode(item.key),
        })),
        { separator: true },
        { label: '取消标记', icon: 'pi pi-times', shortcut: 'Alt+0', command: () => clearColorOnActiveTreeNode() },
      ],
    },
  ] as any
})

const normalizeSearchTokens = (value: string) => {
  const raw = String(value || '').trim().toLowerCase()
  if (!raw) return []
  return raw.split(/\s+/).filter(Boolean)
}

const matchesSearch = (item: ContractFileDirectoryListItem, tokens: string[]) => {
  if (!tokens.length) return true
  const haystack = [
    item?.name || '',
    item?.path || '',
    item?.contractNo || '',
    item?.contractName || '',
  ].join(' ').toLowerCase()
  return tokens.every((token) => haystack.includes(token))
}

const searchTokens = computed(() => normalizeSearchTokens(search.value))

const searchFilteredItems = computed(() => {
  const tokens = searchTokens.value
  if (!tokens.length) return currentItemsBase.value
  return currentItemsBase.value.filter((item) => matchesSearch(item, tokens))
})

const contractOptions = computed(() => {
  const map = new Map<string, { contractId: string; contractNo: string; contractName: string; count: number }>()
  for (const item of searchFilteredItems.value) {
    const id = String(item?.contractId || '').trim()
    if (!id) continue
    const current = map.get(id)
    if (current) {
      current.count += 1
      continue
    }
    map.set(id, {
      contractId: id,
      contractNo: String(item?.contractNo || '').trim(),
      contractName: String(item?.contractName || '').trim(),
      count: 1,
    })
  }
  return Array.from(map.values()).sort((a, b) => {
    return compareText(a.contractNo, b.contractNo) || compareText(a.contractName, b.contractName)
  })
})

const filteredContractOptions = computed(() => {
  const keyword = String(contractSearchQuery.value || '').trim().toLowerCase()
  if (!keyword) return contractOptions.value
  return contractOptions.value.filter((opt) => `${opt.contractNo} ${opt.contractName}`.toLowerCase().includes(keyword))
})

const selectedContractSet = computed(() => {
  const set = new Set<string>()
  for (const raw of selectedContracts.value || []) {
    const value = String(raw || '').trim()
    if (value) set.add(value)
  }
  return set
})

const toggleContractSelection = (contractId: string) => {
  const id = String(contractId || '').trim()
  if (!id) return
  const next = new Set(selectedContractSet.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  selectedContracts.value = [...next]
}

const clearContractSelection = () => {
  selectedContracts.value = []
}

const selectedContractDisplay = computed(() => {
  if (!selectedContractSet.value.size) return ''
  const labelById = new Map(contractOptions.value.map((item) => [item.contractId, item.contractNo || item.contractName || item.contractId]))
  const labels = [...selectedContractSet.value].map((id) => labelById.get(id) || id)
  labels.sort(compareText)
  return labels.join('、')
})

const normalizeExtForFilter = (ext: string) => String(ext || '').trim().toLowerCase()

const selectedFormatSet = computed(() => {
  const set = new Set<string>()
  for (const raw of selectedFormats.value || []) {
    const value = normalizeExtForFilter(raw)
    if (value || raw === '') set.add(value)
  }
  return set
})

const toggleFormatSelection = (ext: string) => {
  const key = normalizeExtForFilter(ext)
  const next = new Set(selectedFormatSet.value)
  if (next.has(key)) next.delete(key)
  else next.add(key)
  selectedFormats.value = [...next]
}

const clearFormatSelection = () => {
  selectedFormats.value = []
}

const selectedFormatDisplay = computed(() => {
  if (!selectedFormats.value.length) return ''
  const labels = Array.from(new Set(selectedFormats.value.map((value) => normalizeExtForFilter(value)))).map((value) => value || '无后缀')
  return labels.join(',')
})

const applyContractFilter = (records: ContractFileDirectoryListItem[]) => {
  if (!selectedContractSet.value.size) return records
  return records.filter((item) => selectedContractSet.value.has(String(item?.contractId || '').trim()))
}

const applyFormatFilter = (records: ContractFileDirectoryListItem[]) => {
  if (!selectedFormatSet.value.size) return records
  return records.filter((item) => {
    if (!item) return false
    if (item.type === 'contract' || item.type === 'folder') return true
    return selectedFormatSet.value.has(normalizeExtForFilter(getExt(item.name)))
  })
}

const filteredItems = computed(() => applyFormatFilter(applyContractFilter(searchFilteredItems.value)))

const fileTypeStats = computed(() => {
  const stats = new Map<string, number>()
  for (const item of applyContractFilter(searchFilteredItems.value)) {
    if (!item || item.type !== 'file') continue
    const ext = normalizeExtForFilter(getExt(item.name))
    stats.set(ext, (stats.get(ext) || 0) + 1)
  }
  return Array.from(stats.entries())
    .map(([ext, count]) => ({ ext, count }))
    .sort((a, b) => (b.count - a.count) || compareText(a.ext, b.ext))
})

const filteredFileTypeStats = computed(() => {
  const keyword = String(formatSearchQuery.value || '').trim().toLowerCase()
  if (!keyword) return fileTypeStats.value
  return fileTypeStats.value.filter((item) => (item.ext || '无后缀').toLowerCase().includes(keyword))
})

const getTypeRank = (item: ContractFileDirectoryListItem) => {
  if (item.type === 'contract') return 0
  if (item.type === 'folder') return 1
  return 2
}

const compareText = (a: string | null | undefined, b: string | null | undefined) =>
  String(a || '').localeCompare(String(b || ''), 'zh-CN', { numeric: true, sensitivity: 'base' })

const compareNumber = (a: number | null | undefined, b: number | null | undefined) => {
  const left = Number.isFinite(Number(a)) ? Number(a) : -1
  const right = Number.isFinite(Number(b)) ? Number(b) : -1
  return left - right
}

const compareByField = (a: ContractFileDirectoryListItem, b: ContractFileDirectoryListItem, field: string) => {
  if (field === 'size') return compareNumber(a.size, b.size)
  if (field === 'mtime') return compareNumber(a.mtime, b.mtime)
  if (field === 'contractNo') {
    return compareText(a.contractNo, b.contractNo) || compareText(a.contractName, b.contractName) || compareText(a.name, b.name)
  }
  if (field === 'type') {
    const rankDiff = getTypeRank(a) - getTypeRank(b)
    if (rankDiff !== 0) return rankDiff
    return compareText(
      a.type === 'file' ? getExt(a.name) || 'file' : a.type,
      b.type === 'file' ? getExt(b.name) || 'file' : b.type,
    )
  }
  if (field === 'name') {
    const rankDiff = getTypeRank(a) - getTypeRank(b)
    if (rankDiff !== 0) return rankDiff
    return compareText(a.name, b.name)
  }
  return compareText(String((a as any)[field] || ''), String((b as any)[field] || ''))
}

const sortedItems = computed(() => {
  const list = [...filteredItems.value]
  const field = String(sortField.value || 'name')
  const order = sortOrder.value === -1 ? -1 : 1
  return list.sort((a, b) => compareByField(a, b, field) * order)
})

const itemStats = computed(() => {
  let contractCount = 0
  let folderCount = 0
  let fileCount = 0
  for (const item of sortedItems.value) {
    if (item.type === 'contract') contractCount += 1
    else if (item.type === 'folder') folderCount += 1
    else if (item.type === 'file') fileCount += 1
  }
  return { contractCount, folderCount, fileCount }
})

const selectedItem = computed(() => sortedItems.value.find((item) => String(item.key) === selectedItemKey.value) || null)
const activeMenuItem = computed(() => contextMenuTarget.value || selectedItem.value || null)

const rowClass = (data: ContractFileDirectoryListItem) =>
  String(data?.key || '') === selectedItemKey.value ? 'contract-file-list-row-selected' : ''

let requestSeq = 0
const load = async (resetError: boolean) => {
  const library = libraryPath.value
  if (!library) return
  const current = ++requestSeq
  if (resetError) errorMessage.value = ''
  loading.value = true
  try {
    const res = await window.electronAPI.contractFiles.getAllList({
      libraryPath: library,
      mode: 'grouped',
      currentDirPath: currentDir.value || undefined,
    })
    if (current !== requestSeq) return
    if (!res.success || !res.data || res.data.mode !== 'grouped') {
      groups.value = []
      directoryTree.value = []
      currentDir.value = ''
      selectedItemKey.value = ''
      contextMenuSelection.value = null
      contextMenuTarget.value = null
      errorMessage.value = res.error || '读取全库文件失败'
      return
    }

    groups.value = Array.isArray(res.data.groups) ? res.data.groups : []
    directoryTree.value = Array.isArray(res.data.directoryTree) ? res.data.directoryTree : []
    libraryRootDir.value = String(res.data.libraryRootDir || '').trim()
    currentDir.value = String(res.data.currentDir || libraryRootDir.value || '').trim()

    if (!currentItemsBase.value.some((item) => String(item.key) === selectedItemKey.value)) {
      selectedItemKey.value = ''
      contextMenuSelection.value = null
      contextMenuTarget.value = null
    }
  } catch (error: any) {
    if (current !== requestSeq) return
    groups.value = []
    directoryTree.value = []
    currentDir.value = ''
    selectedItemKey.value = ''
    contextMenuSelection.value = null
    contextMenuTarget.value = null
    errorMessage.value = error?.message || '读取全库文件失败'
  } finally {
    if (current === requestSeq) loading.value = false
  }
}

const onSort = (event: DataTableSortEvent) => {
  sortField.value = String(event.sortField || 'name')
  sortOrder.value = event.sortOrder === -1 ? -1 : 1
}

const refresh = async () => {
  await load(true)
}

const openGlobalSearch = async () => {
  const baseDir = isLibraryRootSelected.value
    ? ''
    : String(currentDir.value || libraryRootDir.value || '').trim()
  if (!baseDir && !libraryPath.value) return
  await router.push({
    name: 'ContractFilesFullTextSearch',
    params: { contractId: '__all__' },
    query: {
      baseDir,
      scope: isLibraryRootSelected.value ? 'contract-domain' : undefined,
      q: search.value.trim(),
    },
  })
}

const openContractFiles = async (contractId: string) => {
  const id = String(contractId || '').trim()
  if (!id) return
  await router.push({ name: 'ContractFiles', params: { contractId: id } })
}

const openPreview = async (record: ContractFileRecord) => {
  const filePath = String(record?.path || '').trim()
  if (!filePath) return
  await router.push({
    name: 'ContractFilesPreview',
    params: { contractId: String(record?.contractId || '__all__') },
    query: {
      path: filePath,
      name: String(record?.name || ''),
      fileId: String(record?.fileId || ''),
    },
  })
}

const openDirectoryItem = async (item: ContractFileDirectoryListItem) => {
  if (!item) return
  if (item.type === 'file' && item.record) {
    await openPreview(item.record)
    return
  }
  const target = String(item.path || '').trim()
  if (!target) return
  currentDir.value = target
}

const openFile = async (record: ContractFileRecord) => {
  if (!record || record.type !== 'file') return
  const res = await window.electronAPI.fs.openFile(record.path)
  if (!res.success) {
    toast.add({ severity: 'error', summary: '打开失败', detail: res.error || '打开文件失败', life: 3000 })
  }
}

const openContainingFolder = async (item: ContractFileDirectoryListItem) => {
  if (!item) return
  const target = item.type === 'file' ? dirname(item.path) : item.path
  const folderPath = String(target || '').trim()
  if (!folderPath) return
  const res = await window.electronAPI.fs.openFolder(folderPath)
  if (!res.success) {
    toast.add({ severity: 'error', summary: '打开失败', detail: res.error || '打开文件夹失败', life: 3000 })
  }
}

const copyPath = async (item: ContractFileDirectoryListItem) => {
  const targetPath = String(item?.path || '').trim()
  if (!targetPath) return
  const ok = await copyTextToClipboard(targetPath)
  if (!ok) {
    toast.add({ severity: 'error', summary: '复制失败', detail: '未能写入剪贴板', life: 2500 })
    return
  }
  toast.add({ severity: 'success', summary: '已复制路径', detail: targetPath, life: 2000 })
}

const openPropertiesDialog = (record: ContractFileRecord) => {
  propertiesDialogRecord.value = record
  propertiesDialogVisible.value = true
}

const confirmCreateFolder = async (folderName: string) => {
  if (createFolderDialogSubmitting.value) return
  const parentPath = String(createFolderDialogParentPath.value || '').trim()
  const contractId = String(createFolderDialogContractId.value || '').trim()
  const contractNo = String(createFolderDialogContractNo.value || '').trim()
  if (!parentPath || !contractId || !contractNo) {
    createFolderDialogError.value = '目录上下文不完整'
    return
  }

  createFolderDialogSubmitting.value = true
  createFolderDialogError.value = ''
  try {
    const res = await window.electronAPI.contractFiles.createFolder({
      libraryPath: libraryPath.value,
      contractId,
      contractNo,
      parentPath,
      folderName,
    })
    if (!res.success) {
      createFolderDialogError.value = res.error || '创建文件夹失败'
      return
    }
    createFolderDialogVisible.value = false
    toast.add({ severity: 'success', summary: '创建成功', detail: folderName, life: 2000 })
    await refresh()
  } finally {
    createFolderDialogSubmitting.value = false
  }
}

const closeRenameDialog = () => {
  renameDialogVisible.value = false
  renameDialogSubmitting.value = false
  renameDialogRecord.value = null
  renameDialogError.value = ''
}

const openRenameDialog = (record: ContractFileRecord) => {
  renameDialogRecord.value = record
  renameDialogSubmitting.value = false
  renameDialogError.value = ''
  renameDialogVisible.value = true
}

const confirmRename = async (newName: string) => {
  const record = renameDialogRecord.value
  if (!record || renameDialogSubmitting.value) return
  const oldPath = String(record.path || '').trim()
  renameDialogSubmitting.value = true
  renameDialogError.value = ''
  try {
    const res = await window.electronAPI.contractFiles.rename({
      libraryPath: libraryPath.value,
      fileId: record.fileId,
      newName: String(newName || '').trim(),
    })
    if (!res.success) {
      renameDialogError.value = res.error || '重命名失败'
      return
    }
    closeRenameDialog()
    const newPath = String(res.data?.record?.path || '').trim()
    if (record.type === 'folder' && oldPath && newPath) {
      remapFolderColorsAfterFolderRename(oldPath, newPath)
      currentDir.value = remapPathAfterFolderRename(currentDir.value, oldPath, newPath)
    }
    toast.add({ severity: 'success', summary: '重命名成功', detail: newName, life: 2000 })
    await refresh()
  } finally {
    renameDialogSubmitting.value = false
  }
}

const copyFile = async (record: ContractFileRecord) => {
  if (!record || record.type !== 'file') return
  const res = await window.electronAPI.contractFiles.copy({ libraryPath: libraryPath.value, fileId: record.fileId })
  if (!res.success) {
    toast.add({ severity: 'error', summary: '复制失败', detail: res.error || '复制文件失败', life: 3000 })
    return
  }
  toast.add({ severity: 'success', summary: '复制成功', detail: '已创建副本', life: 2000 })
  await refresh()
}

const deleteFile = async (item: ContractFileDirectoryListItem) => {
  const record = item?.record
  if (!record) return
  confirm.require({
    message: record.type === 'folder' ? '确认将该文件夹移入回收站？' : '确认将该文件移入回收站？',
    header: '移入回收站确认',
    icon: 'pi pi-exclamation-triangle',
    acceptLabel: '是',
    rejectLabel: '否',
    accept: async () => {
      const res = await window.electronAPI.contractFiles.delete({ libraryPath: libraryPath.value, fileId: record.fileId })
      if (!res.success) {
        toast.add({ severity: 'error', summary: '移入回收站失败', detail: res.error || '移入回收站失败', life: 3000 })
        return
      }
      toast.add({ severity: 'success', summary: '已移入回收站', detail: '', life: 2000 })
      await refresh()
    },
  })
}

const beginDragOutFromRecord = (event: DragEvent, record: ContractFileRecordWithContractName) => {
  const contractId = String(record?.contractId || '').trim()
  const fileId = String(record?.fileId || '').trim()
  if (!libraryPath.value || !contractId || !fileId) return
  event.preventDefault()
  if (event.dataTransfer) event.dataTransfer.effectAllowed = 'copy'
  void window.electronAPI.contractFiles.startDragOut({
    libraryPath: libraryPath.value,
    contractId,
    fileIds: [fileId],
  }).then((res) => {
    if (!res.success) {
      toast.add({ severity: 'error', summary: '拖拽失败', detail: res.error || '无法拖拽导出', life: 3000 })
      return
    }
    if (res.data?.mode === 'fallback-folder') {
      toast.add({ severity: 'warn', summary: '已降级为文件夹拖拽', detail: '受运行时限制，已转为临时文件夹拖出', life: 3500 })
    }
  })
}

const onFileAreaDragStart = (event: DragEvent) => {
  if (event.defaultPrevented) return
  const target = event.target as HTMLElement | null
  if (!target) return
  const el = target.closest('[data-contract-file-id]') as HTMLElement | null
  const fileId = String(el?.getAttribute('data-contract-file-id') || '').trim()
  if (!fileId) return
  const record = recordByFileId.value.get(fileId)
  if (!record) return
  beginDragOutFromRecord(event, record)
}

const onFileAreaDragEnd = (event: DragEvent) => {
  event.preventDefault()
}

const onRowClick = (event: { data?: ContractFileDirectoryListItem }) => {
  const item = event?.data
  if (!item) return
  selectedItemKey.value = String(item.key || '')
  contextMenuTarget.value = item
}

const onRowContextMenu = (event: { originalEvent: MouseEvent; data?: ContractFileDirectoryListItem }) => {
  const item = event?.data
  if (!item) return
  selectedItemKey.value = String(item.key || '')
  contextMenuSelection.value = item
  contextMenuTarget.value = item
  cm.value?.show(event.originalEvent)
}

const onRowDblclick = async (event: { data?: ContractFileDirectoryListItem }) => {
  const item = event?.data
  if (!item) return
  selectedItemKey.value = String(item.key || '')
  await openDirectoryItem(item)
}

const getListItemTypeText = (item: ContractFileDirectoryListItem) => {
  if (!item) return '-'
  if (item.type === 'contract') return '合同'
  if (item.type === 'folder') return '文件夹'
  return getExt(item.name) || '文件'
}

const openContractDetailDrawer = (item: ContractFileDirectoryListItem) => {
  const contractId = String(item?.contractId || '').trim()
  if (!contractId) {
    toast.add({ severity: 'warn', summary: '提示', detail: '当前项目未关联合同', life: 2000 })
    return
  }
  contractDetailContractId.value = contractId
  contractDetailVisible.value = true
}

watch(
  () => contractDetailVisible.value,
  (visible) => {
    if (visible) return
    contractDetailContractId.value = null
  }
)

const menuState = computed(() => {
  const item = activeMenuItem.value
  return {
    hasItem: !!item,
    hasRecord: !!item?.record,
    isContract: item?.type === 'contract',
    isFolder: item?.type === 'folder',
    isFile: item?.type === 'file',
    hasContractId: !!String(item?.contractId || '').trim(),
  }
})

const menuModel = computed(() => {
  const item = activeMenuItem.value
  const record = item?.record || null
  return [
    { label: '进入目录', icon: 'pi pi-folder-open', disabled: !item || !(menuState.value.isContract || menuState.value.isFolder), shortcut: 'Enter', command: () => item && void openDirectoryItem(item) },
    { label: '打开合同文件页', icon: 'pi pi-briefcase', disabled: !menuState.value.hasContractId || !item, command: () => item && void openContractFiles(item.contractId) },
    { label: '预览', icon: 'pi pi-eye', disabled: !menuState.value.isFile || !record, command: () => record && void openPreview(record) },
    { label: '打开文件', icon: 'pi pi-file', disabled: !menuState.value.isFile || !record, command: () => record && void openFile(record) },
    { label: '打开所在文件夹', icon: 'pi pi-folder', disabled: !menuState.value.hasItem || !item, command: () => item && void openContainingFolder(item) },
    { label: '查合同详情', icon: 'pi pi-id-card', disabled: !menuState.value.hasContractId || !item, command: () => item && openContractDetailDrawer(item) },
    { label: '复制路径', icon: 'pi pi-copy', disabled: !menuState.value.hasItem || !item, command: () => item && void copyPath(item) },
    { label: '属性', icon: 'pi pi-info-circle', disabled: !menuState.value.hasRecord || !record, command: () => record && openPropertiesDialog(record) },
    { separator: true },
    { label: '重命名', icon: 'pi pi-pencil', disabled: !menuState.value.hasRecord || !record, command: () => record && openRenameDialog(record) },
    { label: '复制文件', icon: 'pi pi-copy', disabled: !menuState.value.isFile || !record, command: () => record && void copyFile(record) },
    { label: '移入回收站', icon: 'pi pi-trash', class: 'text-red-600', disabled: !menuState.value.hasRecord || !item, command: () => item && void deleteFile(item) },
  ]
})

watch(
  () => libraryPath.value,
  () => {
    search.value = ''
    currentDir.value = ''
    selectedItemKey.value = ''
    contextMenuSelection.value = null
    contextMenuTarget.value = null
    if (!libraryPath.value) {
      groups.value = []
      directoryTree.value = []
      libraryRootDir.value = ''
      treeContextMenuTarget.value = null
      return
    }
    void load(true)
  },
  { immediate: true },
)

onMounted(() => {
  if (libraryPath.value && !groups.value.length) {
    void load(true)
  }
})

const isEditableTarget = (target: EventTarget | null) => {
  const el = target as HTMLElement | null
  if (!el) return false
  const tag = String(el.tagName || '').toLowerCase()
  if (tag === 'input' || tag === 'textarea' || tag === 'select') return true
  if ((el as any).isContentEditable) return true
  return false
}

const onGlobalKeydown = (event: KeyboardEvent) => {
  if (isEditableTarget(event.target)) return
  const node = getActiveTreeNode()
  if (!node) return

  const key = String(event.key || '')
  const lower = key.toLowerCase()

  if (key === 'F2' && !event.ctrlKey && !event.altKey && !event.metaKey && !event.shiftKey) {
    event.preventDefault()
    renameFolderFromTree()
    return
  }

  if (event.ctrlKey && event.shiftKey && !event.altKey && !event.metaKey && lower === 'n') {
    event.preventDefault()
    addChildFolderFromTree()
    return
  }

  if (event.ctrlKey && event.altKey && !event.shiftKey && !event.metaKey && lower === 'n') {
    event.preventDefault()
    addSiblingFolderFromTree()
    return
  }

  if (event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey && /^[0-6]$/.test(key)) {
    event.preventDefault()
    if (key === '0') {
      clearColorOnActiveTreeNode()
      return
    }
    const option = folderColorOptions[Number(key) - 1]
    if (!option) return
    applyColorToActiveTreeNode(option.key)
  }
}

window.addEventListener('keydown', onGlobalKeydown)
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onGlobalKeydown)
  stopTreePanelResize()
})
</script>

<style scoped>
:deep(.custom-datatable .p-datatable-tbody > tr:not(.contract-file-list-row-selected):hover > td) {
  background-color: var(--sidebar-hover-bg) !important;
}

:deep(.custom-datatable .p-datatable-tbody > tr.contract-file-list-row-selected > td) {
  background: color-mix(in srgb, var(--btn-primary-bg) 16%, var(--content-bg)) !important;
  color: var(--content-text) !important;
}

:deep(.custom-datatable .p-datatable-tbody > tr.contract-file-list-row-selected:hover > td) {
  background: color-mix(in srgb, var(--btn-primary-bg) 20%, var(--content-bg)) !important;
}

:deep(.custom-datatable .p-datatable-tbody > tr.contract-file-list-row-selected > td:first-child) {
  box-shadow: inset 3px 0 0 var(--sidebar-active-border);
}

:deep(.p-tree) {
  background: transparent !important;
  border: none !important;
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
}

:deep(.p-tree-node-toggle-button) {
  color: var(--content-text-secondary) !important;
}

.tree-panel-resizer {
  position: absolute;
  top: 0;
  right: -3px;
  height: 100%;
  width: 6px;
  cursor: col-resize;
  z-index: 30;
  -webkit-app-region: no-drag;
}

.tree-panel-resizer:hover,
.tree-panel-resizer.is-resizing {
  background: color-mix(in srgb, var(--btn-primary-bg) 18%, transparent);
}
</style>
