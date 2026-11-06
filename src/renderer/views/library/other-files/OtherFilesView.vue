<template>
  <main class="flex h-full w-full flex-col overflow-hidden bg-[var(--content-bg)] text-[var(--content-text)]">
    <div v-if="!libraryPath" class="flex flex-1 items-center justify-center text-sm text-[var(--content-text-secondary)]">
      请先选择资源库
    </div>

    <div
      v-else
      class="flex min-h-0 flex-1 overflow-hidden"
    >
      <aside
        class="other-files-tree-panel relative shrink-0 overflow-hidden border-r border-[var(--content-border)] bg-[var(--content-card-bg)]/60 backdrop-blur-md"
        :style="{ width: `${treePanelWidth}px` }"
        @contextmenu.stop.prevent
      >
        <div class="flex h-full flex-col min-h-0">
          <div class="flex h-14 items-center justify-between px-6 border-b border-[var(--content-border)]" style="-webkit-app-region: drag;">
            <div class="whitespace-nowrap text-lg font-bold tracking-tight text-[var(--content-text)]" style="-webkit-app-region: no-drag;">
              目录树
            </div>
          </div>

          <div class="p-3 flex flex-col gap-3 flex-1 overflow-hidden">
            <div class="relative w-full" style="-webkit-app-region: no-drag;">
              <InputText
                v-model="treeSearchQuery"
                placeholder="搜索目录树..."
                class="w-full !pl-10 h-9 !bg-[var(--input-bg)] !border-[var(--input-border)] !text-[var(--content-text)] placeholder:!text-[var(--content-text-secondary)] focus:!border-[var(--btn-primary-bg)]"
              />
              <i class="pi pi-search absolute left-3 top-1/2 -translate-y-1/2 text-[var(--content-text-secondary)] text-xs"></i>
            </div>

            <div class="flex-1 min-h-0 overflow-auto">
              <Tree
                :value="filteredTreeNodes"
                selectionMode="single"
                :selectionKeys="treeSelectionKeys"
                @update:selectionKeys="onTreeSelectionChange"
                v-model:expandedKeys="treeExpandedKeys"
                class="bg-transparent border-none p-0 text-sm !text-[var(--content-text)]"
              >
                <template #default="slotProps">
                  <div
                    class="flex items-center justify-between w-full px-2 py-1.5 rounded-lg group transition-colors"
                    @dblclick.stop="onTreeNodeDblclick(slotProps.node)"
                    @contextmenu.prevent.stop="onTreeNodeContextMenu($event, slotProps.node)"
                  >
                    <div class="flex items-center min-w-0 gap-2">
                      <i
                        class="pi pi-folder text-xs"
                        :style="getTreeFolderIconStyle(slotProps.node)"
                      />
                      <span class="truncate text-sm" :title="slotProps.node.label">{{ slotProps.node.label }}</span>
                    </div>
                    <Button
                      icon="pi pi-refresh"
                      severity="secondary"
                      text
                      size="small"
                      class="opacity-0 group-hover:opacity-100 !p-1"
                      v-tooltip.bottom="'刷新'"
                      @click.stop="onTreeNodeRefresh(slotProps.node)"
                    />
                  </div>
                </template>
              </Tree>

              <ContextMenu ref="treeCm" :model="treeMenuModel" @show="treeContextMenuOpen = true" @hide="() => { treeContextMenuOpen = false; treeContextMenuTarget = null }">
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
        <div class="other-files-tree-resizer" :class="{ 'is-resizing': isResizingTreePanel }" @mousedown.prevent="startTreePanelResize" />
      </aside>

      <section class="flex min-w-0 flex-1 flex-col overflow-hidden">
        <div
          class="flex shrink-0 flex-col border-b border-[var(--content-border)] bg-[var(--content-bg)]/80 backdrop-blur-md"
        >
          <div class="flex h-16 items-center justify-between px-6" style="-webkit-app-region: drag;">
            <div class="flex min-w-0 flex-1 items-center gap-4">
              <div class="flex items-center gap-3" style="-webkit-app-region: no-drag;">
                <Button
                  icon="pi pi-arrow-left"
                  text
                  rounded
                  severity="secondary"
                  class="!w-8 !h-8 !p-0"
                  v-tooltip.bottom="'返回'"
                  @click="handleBack"
                />
                <div class="min-w-0">
                  <h2 class="whitespace-nowrap text-lg font-bold tracking-tight text-[var(--content-text)]">
                    {{ pageTitle }}
                  </h2>
                  <p v-if="pageSubtitle" class="truncate text-xs text-[var(--content-text-secondary)]">
                    {{ pageSubtitle }}
                  </p>
                </div>
              </div>

              <div class="relative w-[420px] max-w-[42vw] rounded-lg focus-within:ring-2 focus-within:ring-blue-500/20" style="-webkit-app-region: no-drag;">
                <i class="pi pi-search absolute left-3 top-1/2 -translate-y-1/2 text-[var(--content-text-secondary)]"></i>
                <InputText
                  v-model="search"
                  class="w-full !rounded-lg !border !border-[var(--input-border)] !bg-[var(--input-bg)] !py-2 !pl-9 !pr-4 !text-[var(--content-text)] placeholder:!text-[var(--content-text-secondary)] focus:!border-blue-500"
                  :placeholder="searchPlaceholder"
                />
              </div>
            </div>

            <div class="flex items-center gap-2" style="-webkit-app-region: no-drag;">
              <Button icon="pi pi-search-plus" severity="secondary" text v-tooltip.bottom="'全文搜索'" @click="openFullTextSearch" />
              <Button icon="pi pi-refresh" severity="secondary" text v-tooltip.bottom="'刷新'" @click="refresh" />
              <WindowControls />
            </div>
          </div>
        </div>

        <div
          class="flex min-h-0 flex-1 flex-col overflow-hidden p-6 relative"
          @dragenter.prevent="handleDragEnter"
          @dragover.prevent="handleDragOver"
          @dragleave.prevent="handleDragLeave"
          @drop.prevent="handleDrop"
          @contextmenu.prevent="onFileAreaContextMenu"
        >
          <div
            v-if="isDragActive"
            class="absolute inset-0 z-50 flex items-center justify-center pointer-events-none transition-colors duration-200"
            :style="{ backgroundColor: 'rgba(13, 110, 253, 0.08)' }"
          >
            <div class="text-center">
              <i class="pi pi-cloud-upload text-6xl mb-4" :style="{ color: 'var(--btn-primary-bg)' }"></i>
              <p class="text-xl font-semibold" :style="{ color: 'var(--btn-primary-bg)' }">
                拖拽文件到此处导入
              </p>
              <p class="text-sm mt-2 opacity-70" :style="{ color: 'var(--btn-primary-bg)' }">
                支持批量拖入
              </p>
            </div>
          </div>

          <div v-if="rootDir" class="mb-3">
            <ContractFilesBreadcrumb
              :items="folderBreadcrumbItems"
              :canGoUp="canGoUpFolder"
              @go-up="goUpFolder"
              @navigate="navigateToFolder"
            />
          </div>

          <div v-if="errorMessage" class="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
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
              :value="filteredItems"
              dataKey="fileId"
              :contextMenuSelection="contextMenuSelection"
              :scrollable="true"
              :virtualScrollerOptions="{ itemSize: 44 }"
              scrollHeight="flex"
              class="h-full custom-datatable p-datatable-sm"
              stripedRows
              rowHover
              :rowClass="rowClass"
              @row-click="onRowClick"
              @row-dblclick="onRowDblclick"
              @rowContextmenu="onRowContextMenu"
            >
              <template #empty>
                <div class="flex flex-col items-center justify-center py-10 text-[var(--content-text-secondary)]" @contextmenu.prevent.stop="onBlankContextMenu">
                  <i class="pi pi-inbox mb-3 text-3xl opacity-50"></i>
                  <p>没有找到文件</p>
                </div>
              </template>

              <Column header="名称" field="name" sortable style="min-width: 18rem">
                <template #body="{ data }">
                  <div class="flex min-w-0 items-center gap-2 cursor-pointer" draggable="true" :data-other-file-id="data.fileId">
                    <img :src="getContractFileIconUrl(data)" class="h-4 w-4 shrink-0 object-contain" alt="" decoding="async" loading="lazy" />
                    <span class="truncate text-[var(--content-text)]" :title="data.name">{{ data.name }}</span>
                  </div>
                </template>
              </Column>

              <Column header="所在目录" field="path" style="min-width: 16rem">
                <template #body="{ data }">
                  <div class="truncate text-xs text-[var(--content-text-secondary)]" :title="getRelativeDir(data.path)">
                    {{ getRelativeDir(data.path) || '-' }}
                  </div>
                </template>
              </Column>

              <Column header="类型" field="type" style="width: 7rem">
                <template #body="{ data }">
                  <div class="cursor-pointer" draggable="true" :data-other-file-id="data.fileId">
                    <span class="text-xs text-[var(--content-text-secondary)]">{{ data.type === 'folder' ? '文件夹' : (getExt(data.name) || '文件') }}</span>
                  </div>
                </template>
              </Column>

              <Column header="大小" field="size" style="width: 7rem">
                <template #body="{ data }">
                  <div class="cursor-pointer" draggable="true" :data-other-file-id="data.fileId">
                    <span class="text-xs text-[var(--content-text-secondary)]">{{ data.type === 'folder' ? '-' : formatSize(data.size) }}</span>
                  </div>
                </template>
              </Column>

              <Column header="修改时间" field="mtime" style="width: 12rem">
                <template #body="{ data }">
                  <div class="cursor-pointer" draggable="true" :data-other-file-id="data.fileId">
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
      :parentPath="createFolderDialogParentPath || rootDir"
      :submitting="createFolderDialogSubmitting"
      :submitError="createFolderDialogError"
      @confirm="confirmCreateFolder"
      @clear-submit-error="() => (createFolderDialogError = '')"
    />

    <ImportProgressFooter v-if="libraryPath" :contextKey="importContextKey" />

    <AllContractFilesStatusBar
      :currentPath="currentListDir || rootDir"
      :totalItems="filteredItems.length"
      :folderCount="filteredFolderCount"
      :fileCount="filteredFileCount"
      :selectedCount="selectedRecordId ? 1 : 0"
    />
  </main>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import Button from 'primevue/button'
import Column from 'primevue/column'
import ContextMenu from 'primevue/contextmenu'
import DataTable from 'primevue/datatable'
import InputText from 'primevue/inputtext'
import ProgressSpinner from 'primevue/progressspinner'
import Tree from 'primevue/tree'
import type { TreeNode } from 'primevue/treenode'
import { useConfirm } from 'primevue/useconfirm'
import { useToast } from 'primevue/usetoast'
import WindowControls from '../../../components/WindowControls.vue'
import type { OtherFileRecord } from '../../../../shared/types/otherFile.types'
import type { FileSystemEntry } from '../../../../shared/types/fileSystem.types'
import { getContractFileIconUrl } from '../../../utils/contractFileIcons'
import RenameDialog from '../contract-files/components/RenameDialog.vue'
import FilePropertiesDialog from '../contract-files/components/FilePropertiesDialog.vue'
import CreateFolderDialog from '../contract-files/components/CreateFolderDialog.vue'
import ImportProgressFooter from '../contract-files/components/ImportProgressFooter.vue'
import AllContractFilesStatusBar from '../contract-files/components/AllContractFilesStatusBar.vue'
import ContractFilesBreadcrumb from '../contract-files/components/ContractFilesBreadcrumb.vue'
import { copyTextToClipboard, dirname, formatSize, formatTime, getExt, normalizePathForCompare, getRelativeParts, joinPath } from '../contract-files/contractFilesHelpers'
import { collectDroppedFiles } from '../../../utils/dragDrop'
import { useImportTaskStore } from '../../../stores/system/importTaskStore'
import {
  getUnitLibraryPartyMeta,
  isUnitLibraryPartyType,
  sanitizeUnitLibraryFolderName,
  type UnitLibraryPartyType,
} from '../unit-library/unitLibrary'

const route = useRoute()
const router = useRouter()
const confirm = useConfirm()
const toast = useToast()
const importTaskStore = useImportTaskStore()

const libraryPath = computed(() => String(localStorage.getItem('currentLibraryPath') || '').trim())
const treePanelStorageKey = computed(() => {
  const lp = String(libraryPath.value || '').trim()
  if (!lp) return 'other-files:tree-panel-width'
  return `other-files:tree-panel-width:${lp}`
})
const TREE_PANEL_WIDTH_DEFAULT = 300
const TREE_PANEL_WIDTH_MIN = 240
const TREE_PANEL_WIDTH_MAX = 520
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

const handleBack = () => {
  router.back()
}

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

const importContextKey = computed(() => {
  if (!libraryPath.value) return ''
  return `other-files:${libraryPath.value}`
})

const search = ref('')
const loading = ref(false)
const errorMessage = ref('')
const items = ref<OtherFileRecord[]>([])
const storageRootDir = ref('')
const rootDir = ref('')
const currentListDir = ref('')
const fileAreaEl = ref<HTMLElement | null>(null)
const cm = ref()
const selectedRecordId = ref('')
const contextMenuSelection = ref<OtherFileRecord | null>(null)
const contextMenuTarget = ref<OtherFileRecord | null>(null)
const treeCm = ref()
const treeContextMenuTarget = ref<TreeNode | null>(null)
const treeContextMenuOpen = ref(false)
const treeSearchQuery = ref('')

const renameDialogVisible = ref(false)
const renameDialogSubmitting = ref(false)
const renameDialogRecord = ref<OtherFileRecord | null>(null)
const renameDialogError = ref('')
const propertiesDialogVisible = ref(false)
const propertiesDialogRecord = ref<OtherFileRecord | null>(null)

const createFolderDialogVisible = ref(false)
const createFolderDialogSubmitting = ref(false)
const createFolderDialogError = ref('')
const createFolderDialogParentPath = ref('')

const isDragActive = ref(false)
const dragCounter = ref(0)

interface UnitLibraryContext {
  partyType: UnitLibraryPartyType
  unitId: string
  unitName: string
  unitLabel: string
  pageTitle: string
  rootDirName: string
  unitFolderName: string
}

const unitLibraryContext = ref<UnitLibraryContext | null>(null)

const getRouteUnitId = (value: unknown) => {
  if (typeof value === 'string') return value.trim()
  if (Array.isArray(value)) return String(value[0] || '').trim()
  return ''
}

const currentUnitLibraryPartyType = computed<UnitLibraryPartyType | null>(() => {
  const raw = Array.isArray(route.params.partyType) ? route.params.partyType[0] : route.params.partyType
  return isUnitLibraryPartyType(raw) ? raw : null
})

const currentUnitLibraryUnitId = computed(() => getRouteUnitId(route.params.unitId))

const unitLibraryRouteKey = computed(() => {
  const partyType = currentUnitLibraryPartyType.value
  const unitId = currentUnitLibraryUnitId.value
  if (!partyType || !unitId) return ''
  return `${partyType}:${unitId}`
})

const getRouteQueryString = (value: unknown) => {
  if (typeof value === 'string') return value.trim()
  if (Array.isArray(value)) return String(value[0] || '').trim()
  return ''
}

const customRootDir = computed(() => getRouteQueryString(route.query.rootDir))
const customCurrentDir = computed(() => getRouteQueryString(route.query.currentDir))
const customPageTitle = computed(() => getRouteQueryString(route.query.title))
const customPageSubtitle = computed(() => getRouteQueryString(route.query.subtitle))
const isCustomBrowseMode = computed(() => !!customRootDir.value)
const customRouteKey = computed(() => [
  customRootDir.value,
  customCurrentDir.value,
  customPageTitle.value,
  customPageSubtitle.value,
].join('|'))

const pageTitle = computed(() => customPageTitle.value || unitLibraryContext.value?.pageTitle || '资料管理')
const pageSubtitle = computed(() => {
  if (customPageSubtitle.value) return customPageSubtitle.value
  const context = unitLibraryContext.value
  if (!context) return ''
  return `${context.unitLabel} / ${context.unitName}`
})
const searchPlaceholder = computed(() => {
  if (customPageTitle.value) return `搜索${customPageTitle.value}...`
  const context = unitLibraryContext.value
  if (!context) return '搜索文件名...'
  return `搜索${context.unitName}资料...`
})

const isPathWithinRoot = (targetPath: string, rootPath: string) => {
  const target = normalizePathForCompare(targetPath)
  const root = normalizePathForCompare(rootPath)
  if (!target || !root) return false
  return target === root || target.startsWith(`${root}/`)
}

const hasFolderRecord = (records: OtherFileRecord[], absPath: string) => {
  const target = normalizePathForCompare(absPath)
  return records.some((record) => {
    return record.type === 'folder' && normalizePathForCompare(String(record.path || '')) === target
  })
}

const loadUnitLibraryContext = async (): Promise<UnitLibraryContext | null> => {
  const partyType = currentUnitLibraryPartyType.value
  const unitId = currentUnitLibraryUnitId.value
  if (!partyType || !unitId) {
    unitLibraryContext.value = null
    return null
  }

  const partyMeta = getUnitLibraryPartyMeta(partyType)
  const result = partyType === 'party-a'
    ? await window.electronAPI.customer.get(unitId)
    : await window.electronAPI.supplier.get(unitId)

  const unitName = String(result.data?.name || '').trim()
  if (!result.success || !result.data || !unitName) {
    throw new Error(result.error || `${partyMeta.unitLabel}不存在或已被删除`)
  }

  const context: UnitLibraryContext = {
    partyType,
    unitId,
    unitName,
    unitLabel: partyMeta.unitLabel,
    pageTitle: partyMeta.pageTitle,
    rootDirName: partyMeta.rootDirName,
    unitFolderName: sanitizeUnitLibraryFolderName(unitName),
  }
  unitLibraryContext.value = context
  return context
}

const applyUnitLibraryContext = async (records: OtherFileRecord[]) => {
  const context = await loadUnitLibraryContext()
  const libraryRoot = String(storageRootDir.value || '').trim()
  if (!context || !libraryRoot) {
    rootDir.value = libraryRoot
    if (!currentListDir.value || !isPathWithinRoot(currentListDir.value, libraryRoot)) {
      currentListDir.value = libraryRoot
    }
    return false
  }

  let parentPath = libraryRoot
  const folderSegments = [context.rootDirName, context.unitFolderName]
  let createdFolder = false

  for (const folderName of folderSegments) {
    const targetPath = joinPath(parentPath, folderName)
    if (!hasFolderRecord(records, targetPath)) {
      const createRes = await window.electronAPI.otherFiles.createFolder({
        libraryPath: libraryPath.value,
        parentPath,
        folderName,
      })
      if (!createRes.success) {
        throw new Error(createRes.error || `创建目录失败: ${folderName}`)
      }
      createdFolder = true
    }
    parentPath = targetPath
  }

  if (createdFolder) {
    await load()
    return true
  }

  rootDir.value = parentPath
  if (!currentListDir.value || !isPathWithinRoot(currentListDir.value, rootDir.value)) {
    currentListDir.value = rootDir.value
  }
  return false
}

const applyCustomRouteContext = (records: OtherFileRecord[]) => {
  const routeRoot = customRootDir.value
  if (!routeRoot) return false
  const normalizedRouteRoot = normalizePathForCompare(routeRoot)
  if (!normalizedRouteRoot) return false

  const hasMatchingFolder = records.some(record => {
    const recordPath = normalizePathForCompare(String(record.path || '').trim())
    return recordPath === normalizedRouteRoot || recordPath.startsWith(`${normalizedRouteRoot}/`)
  })
  if (!hasMatchingFolder) {
    throw new Error('未找到该员工对应的文件目录')
  }

  rootDir.value = routeRoot
  currentListDir.value = customCurrentDir.value || routeRoot
  return true
}

const mapFsEntryToOtherFileRecord = (entry: FileSystemEntry): OtherFileRecord => {
  const absPath = String(entry.path || '').trim()
  const type = entry.kind === 'directory' ? 'folder' : 'file'
  const nowIso = new Date().toISOString()
  return {
    fileId: absPath,
    path: absPath,
    originalPath: null,
    trashPath: null,
    name: String(entry.name || '').trim(),
    nameUpper: String(entry.name || '').trim().toUpperCase(),
    type,
    size: type === 'file' ? Number(entry.size || 0) : 0,
    mtime: Number(entry.lastModified || 0),
    sha256: null,
    firstPageThumb: null,
    previewStatus: null,
    createdAt: nowIso,
    updatedAt: nowIso,
  }
}

const loadCustomBrowseRecords = async (rootPath: string) => {
  const normalizedRoot = String(rootPath || '').trim()
  if (!normalizedRoot) return { rootDir: '', items: [] as OtherFileRecord[] }
  const items: OtherFileRecord[] = []
  const queue = [normalizedRoot]
  while (queue.length > 0) {
    const dirPath = String(queue.shift() || '').trim()
    if (!dirPath) continue
    const res = await window.electronAPI.fs.listDir(dirPath)
    if (!res.success || !Array.isArray(res.data)) {
      throw new Error(res.error || `读取目录失败: ${dirPath}`)
    }
    for (const entry of res.data) {
      const record = mapFsEntryToOtherFileRecord(entry)
      items.push(record)
      if (record.type === 'folder') {
        queue.push(record.path)
      }
    }
  }
  return { rootDir: normalizedRoot, items }
}

type OtherFilesTreeNodeData = {
  path?: string
  type?: 'folder'
}

type OtherFilesTreeNode = TreeNode & {
  data?: OtherFilesTreeNodeData
  children?: OtherFilesTreeNode[]
}

const treeSelectionKeys = ref<Record<string, boolean>>({})
const treeExpandedKeys = ref<Record<string, boolean>>({})

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
  return `other-files:folder-colors:${lp}`
})

const folderColorMap = ref<Record<string, FolderColorKey>>({})

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
      scope: 'other-files',
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
    const res = await window.electronAPI.ui.getFolderColorMap({ libraryPath: lp, scope: 'other-files' })
    if (res?.success) {
      dbMap = (res.data?.map || {}) as Record<string, FolderColorKey>
      canPersist = true
    }
  } catch {}

  const merged = { ...(legacy || {}), ...(dbMap || {}) }
  folderColorMap.value = merged

  if (canPersist && Object.keys(legacy || {}).length > 0) {
    try {
      const setRes = await window.electronAPI.ui.setFolderColorMap({ libraryPath: lp, scope: 'other-files', map: merged })
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

const getFolderColorKeyByPath = (path: string) => {
  const n = normalizePathForCompare(String(path || '').trim())
  if (!n) return ''
  return folderColorMap.value[n] || ''
}

const getFolderColorHexByPath = (path: string) => {
  const key = getFolderColorKeyByPath(path)
  if (!key) return ''
  return folderColorOptions.find((c) => c.key === key)?.colorHex || ''
}

const setFolderColorForPath = (path: string, colorKey: FolderColorKey) => {
  const n = normalizePathForCompare(String(path || '').trim())
  if (!n) return
  folderColorMap.value = { ...(folderColorMap.value || {}), [n]: colorKey }
  void persistFolderColorMapToDb()
}

const clearFolderColorForPath = (path: string) => {
  const n = normalizePathForCompare(String(path || '').trim())
  if (!n) return
  const next = { ...(folderColorMap.value || {}) }
  delete next[n]
  folderColorMap.value = next
  void persistFolderColorMapToDb()
}

const getTreeFolderIconStyle = (node: OtherFilesTreeNode) => {
  const hex = getFolderColorHexByPath(getTreeNodePath(node))
  return { color: hex || 'var(--content-text-secondary)' }
}

const getTreeNodePath = (node: TreeNode | OtherFilesTreeNode | null | undefined) => {
  return String(node?.data?.path || '').trim()
}

const getTreeNodeLabel = (node: TreeNode | OtherFilesTreeNode | null | undefined) => {
  return String(node?.label || '').trim()
}

const rootLabel = computed(() => {
  const root = String(rootDir.value || '').trim()
  if (!root) return '资料管理'
  const tokens = root.replace(/\\\\/g, '/').split('/').filter(Boolean)
  return tokens[tokens.length - 1] || '资料管理'
})

const folderBreadcrumbItems = computed(() => {
  const root = String(rootDir.value || '').trim()
  if (!root) return []
  const current = String(currentListDir.value || root).trim() || root

  const parts = getRelativeParts(current, root)
  const items: Array<{ label: string; path: string }> = [{ label: rootLabel.value, path: root }]
  let acc = root
  for (const part of parts) {
    acc = joinPath(acc, part)
    items.push({ label: part, path: acc })
  }
  return items
})

const treeIndex = computed(() => {
  const rootRaw = String(rootDir.value || '').trim()
  const nodes: OtherFilesTreeNode[] = []
  const byKey = new Map<string, OtherFilesTreeNode>()
  if (!rootRaw) return { nodes, byKey }

  const rootKey = normalizePathForCompare(rootRaw) || '__root__'
  const rootNode: OtherFilesTreeNode = {
    key: rootKey,
    label: rootLabel.value,
    data: { path: rootRaw, type: 'folder' },
    children: [],
  }
  nodes.push(rootNode)
  byKey.set(rootKey, rootNode)

  const ensureChild = (parent: OtherFilesTreeNode, absPath: string, label: string) => {
    const key = normalizePathForCompare(absPath) || absPath
    const existing = byKey.get(key)
    if (existing) {
      if (!existing.children) existing.children = []
      return existing
    }
    const node: OtherFilesTreeNode = {
      key,
      label,
      data: { path: absPath, type: 'folder' },
      children: [],
    }
    if (!parent.children) parent.children = []
    parent.children.push(node)
    byKey.set(key, node)
    return node
  }

  const nRoot = normalizePathForCompare(rootRaw)
  for (const r of items.value) {
    const absPath = String(r?.path || '').trim()
    if (!absPath) continue
    const nAbsPath = normalizePathForCompare(absPath)
    if (!nAbsPath || !nRoot || !nAbsPath.startsWith(nRoot)) continue

    const folderPath = r.type === 'file' ? dirname(absPath) : absPath
    const relParts = getRelativeParts(folderPath, rootRaw)
    if (relParts.length === 0) continue

    let parent = rootNode
    let acc = rootRaw
    for (let i = 0; i < relParts.length; i += 1) {
      const part = relParts[i]
      acc = joinPath(acc, part)
      const isLeaf = i === relParts.length - 1
      const label = isLeaf && r.type === 'folder' ? String(r.name || part) : part
      const node = ensureChild(parent, acc, label)
      if (isLeaf) node.label = label
      parent = node
    }
  }

  const sortChildren = (node: OtherFilesTreeNode) => {
    if (!Array.isArray(node.children) || node.children.length === 0) return
    node.children.sort((a, b) => {
      return getTreeNodeLabel(a).localeCompare(getTreeNodeLabel(b), 'zh-CN', { numeric: true, sensitivity: 'base' })
    })
    node.children.forEach(sortChildren)
  }
  sortChildren(rootNode)

  return { nodes, byKey }
})

const treeNodes = computed(() => treeIndex.value.nodes)
const treeNodeByKey = computed(() => treeIndex.value.byKey)

const filteredTreeNodes = computed<OtherFilesTreeNode[]>(() => {
  const q = String(treeSearchQuery.value || '').trim().toLowerCase()
  if (!q) return treeNodes.value
  const nodes = treeNodes.value || []
  if (nodes.length === 0) return []

  const filterNode = (node: OtherFilesTreeNode, forceInclude = false): OtherFilesTreeNode | null => {
    const label = getTreeNodeLabel(node).toLowerCase()
    const children = (Array.isArray(node.children) ? node.children : [])
      .map((child) => filterNode(child, false))
      .filter(Boolean) as OtherFilesTreeNode[]
    const matched = forceInclude || label.includes(q) || children.length > 0
    if (!matched) return null
    return { ...(node as OtherFilesTreeNode), children }
  }

  const root = nodes[0]
  const filteredRoot = filterNode(root, true)
  return filteredRoot ? [filteredRoot] : []
})

const getFirstSelectedKey = (keys: Record<string, boolean>) => {
  for (const k of Object.keys(keys || {})) {
    if (keys[k]) return k
  }
  return ''
}

const folderRecordByPath = computed(() => {
  const map = new Map<string, OtherFileRecord>()
  for (const r of items.value) {
    if (r?.type !== 'folder') continue
    const key = normalizePathForCompare(String(r.path || '').trim())
    if (!key) continue
    map.set(key, r)
  }
  return map
})

const getActiveTreeNode = () => {
  if (treeContextMenuTarget.value) return treeContextMenuTarget.value
  const key = getFirstSelectedKey(treeSelectionKeys.value)
  if (!key) return null
  return treeNodeByKey.value.get(key) || null
}

const isRootTreeNode = (node: TreeNode | OtherFilesTreeNode | null) => {
  const root = normalizePathForCompare(rootDir.value)
  const cur = normalizePathForCompare(getTreeNodePath(node))
  if (!root || !cur) return false
  return root === cur
}

const openCreateFolderDialogAt = (parentPath: string) => {
  createFolderDialogParentPath.value = String(parentPath || '').trim()
  createFolderDialogSubmitting.value = false
  createFolderDialogError.value = ''
  createFolderDialogVisible.value = true
}

const syncTreeByCurrentDir = () => {
  const dir = String(currentListDir.value || rootDir.value || '').trim()
  if (!dir) {
    treeSelectionKeys.value = {}
    return
  }
  const key = normalizePathForCompare(dir) || dir
  treeSelectionKeys.value = { [key]: true }

  const root = String(rootDir.value || '').trim()
  if (!root) return
  const out: Record<string, boolean> = { ...(treeExpandedKeys.value || {}) }
  const rootKey = normalizePathForCompare(root) || root
  out[rootKey] = true
  let acc = root
  for (const part of getRelativeParts(dir, root)) {
    acc = joinPath(acc, part)
    const k = normalizePathForCompare(acc) || acc
    out[k] = true
  }
  treeExpandedKeys.value = out
}

watch(
  () => rootDir.value,
  () => {
    syncTreeByCurrentDir()
  },
)

watch(
  () => currentListDir.value,
  () => {
    syncTreeByCurrentDir()
  },
  { immediate: true },
)

const onTreeSelectionChange = (keys: Record<string, boolean>) => {
  treeSelectionKeys.value = keys || {}
  const key = getFirstSelectedKey(treeSelectionKeys.value)
  if (!key) return
  const node = treeNodeByKey.value.get(key)
  if (!node) return
  currentListDir.value = node.data.path
  search.value = ''
}

const onTreeNodeContextMenu = (event: MouseEvent, node: TreeNode) => {
  treeContextMenuTarget.value = node
  treeCm.value?.show(event)
}

const onTreeNodeRefresh = async (node: TreeNode) => {
  const path = getTreeNodePath(node)
  if (node?.data?.type === 'folder' && path) {
    currentListDir.value = path
    search.value = ''
  }
  await refresh()
}

const onTreeNodeDblclick = async (node: TreeNode) => {
  const path = getTreeNodePath(node)
  if (!path) return
  currentListDir.value = path
  search.value = ''
}

const addSiblingFolderFromTree = () => {
  const node = getActiveTreeNode()
  if (!node) return
  if (isRootTreeNode(node)) return
  const parentPath = dirname(getTreeNodePath(node))
  if (!parentPath) return
  openCreateFolderDialogAt(parentPath)
}

const addChildFolderFromTree = () => {
  const node = getActiveTreeNode()
  if (!node) return
  openCreateFolderDialogAt(getTreeNodePath(node))
}

const renameFolderFromTree = () => {
  const node = getActiveTreeNode()
  if (!node) return
  if (isRootTreeNode(node)) return
  const n = normalizePathForCompare(getTreeNodePath(node))
  if (!n) return
  const record = folderRecordByPath.value.get(n)
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
  const isRoot = hasNode ? isRootTreeNode(node) : false
  const n = normalizePathForCompare(String(node?.data?.path || '').trim())
  const canRename = !!(n && folderRecordByPath.value.get(n) && !isRoot)

  return [
    { label: '新增同级', icon: 'pi pi-plus', shortcut: 'Ctrl+Alt+N', disabled: !hasNode || isRoot || isCustomBrowseMode.value, command: () => addSiblingFolderFromTree() },
    { label: '新增子级', icon: 'pi pi-plus', shortcut: 'Ctrl+Shift+N', disabled: !hasNode || isCustomBrowseMode.value, command: () => addChildFolderFromTree() },
    { separator: true },
    { label: '重命名', icon: 'pi pi-pencil', shortcut: 'F2', disabled: !canRename || isCustomBrowseMode.value, command: () => renameFolderFromTree() },
    { separator: true },
    {
      label: '标记颜色',
      icon: 'pi pi-palette',
      disabled: !hasNode,
      items: [
        ...folderColorOptions.map((c) => ({
          label: c.label,
          colorHex: c.colorHex,
          shortcut: c.shortcut,
          command: () => applyColorToActiveTreeNode(c.key),
        })),
        { separator: true },
        { label: '取消标记', icon: 'pi pi-times', shortcut: 'Alt+0', command: () => clearColorOnActiveTreeNode() },
      ],
    },
  ] as any
})

const canGoUpFolder = computed(() => {
  const root = normalizePathForCompare(rootDir.value)
  const current = normalizePathForCompare(currentListDir.value || rootDir.value)
  if (!root || !current) return false
  return current !== root
})

const goUpFolder = () => {
  const rootRaw = String(rootDir.value || '').trim()
  const currentRaw = String(currentListDir.value || rootRaw || '').trim()
  const nRoot = normalizePathForCompare(rootRaw)
  const nCurrent = normalizePathForCompare(currentRaw)
  if (!nRoot || !nCurrent || nCurrent === nRoot) return

  const parentRaw = dirname(currentRaw)
  const nParent = normalizePathForCompare(parentRaw)
  if (!nParent || !nParent.startsWith(nRoot)) {
    currentListDir.value = rootRaw
    return
  }
  currentListDir.value = parentRaw
}

const navigateToFolder = (path: string) => {
  const rootRaw = String(rootDir.value || '').trim()
  const nRoot = normalizePathForCompare(rootRaw)
  const targetRaw = String(path || '').trim() || rootRaw
  const nTarget = normalizePathForCompare(targetRaw)
  if (!nRoot || !nTarget || !nTarget.startsWith(nRoot)) return
  currentListDir.value = targetRaw
}

const filteredItems = computed(() => {
  const q = String(search.value || '').trim().toLowerCase()
  const currentDir = normalizePathForCompare(currentListDir.value || rootDir.value)

  return items.value.filter((it) => {
    const pathKey = normalizePathForCompare(it.path)
    const itemDir = normalizePathForCompare(dirname(it.path))

    // 如果有搜索词，全局搜索
    if (q) {
      const name = String(it?.name || '').toLowerCase()
      const p = String(it?.path || '').toLowerCase()
      const tokens = q.split(/\s+/).filter(Boolean)
      return tokens.every((t) => name.includes(t) || p.includes(t))
    }

    // 如果没有搜索词，只显示当前目录下的直接子项
    return itemDir === currentDir
  })
})

const filteredFolderCount = computed(() => filteredItems.value.filter((item) => item?.type === 'folder').length)
const filteredFileCount = computed(() => filteredItems.value.filter((item) => item?.type === 'file').length)

const selectedRecord = computed(() => filteredItems.value.find((item) => String(item.fileId) === selectedRecordId.value) || null)
const activeMenuRecord = computed(() => contextMenuTarget.value || selectedRecord.value || null)

const rowClass = (data: any) => {
  const record = data as OtherFileRecord
  if (!record) return ''
  return String(record.fileId) === selectedRecordId.value ? 'contract-file-list-row-selected' : ''
}

const getRelativeDir = (absPath: string) => {
  const r = String(rootDir.value || '').trim()
  const p = String(absPath || '').trim()
  if (!r || !p) return ''
  const rel = normalizePathForCompare(p).replace(normalizePathForCompare(r), '').replace(/^\/+/, '')
  const dir = dirname(rel)
  return dir === '.' ? '' : dir
}

const load = async () => {
  if (!libraryPath.value) return
  loading.value = true
  errorMessage.value = ''
  try {
    if (isCustomBrowseMode.value) {
      const customData = await loadCustomBrowseRecords(customRootDir.value)
      storageRootDir.value = String(libraryPath.value || '')
      items.value = customData.items
      rootDir.value = customData.rootDir
      currentListDir.value = customCurrentDir.value || customData.rootDir
      syncTreeByCurrentDir()
      return
    }
    const res = await window.electronAPI.otherFiles.getList({
      libraryPath: libraryPath.value,
      search: search.value.trim() || undefined,
      includeDeleted: false,
    })
    if (!res.success || !res.data) {
      throw new Error(res.error || '加载失败')
    }
    storageRootDir.value = String(res.data.rootDir || '')
    items.value = Array.isArray(res.data.items) ? (res.data.items as OtherFileRecord[]) : []
    const contextReloaded = await applyUnitLibraryContext(items.value)
    if (contextReloaded) return
    const customContextApplied = applyCustomRouteContext(items.value)
    if (customContextApplied) {
      syncTreeByCurrentDir()
      return
    }
    if (!rootDir.value) {
      rootDir.value = storageRootDir.value
    }
    syncTreeByCurrentDir()
  } catch (e: any) {
    storageRootDir.value = ''
    rootDir.value = ''
    currentListDir.value = ''
    items.value = []
    unitLibraryContext.value = null
    errorMessage.value = e?.message || '加载失败'
  } finally {
    loading.value = false
  }
}

const refresh = async () => {
  await load()
}

watch(
  () => libraryPath.value,
  () => {
    selectedRecordId.value = ''
    contextMenuSelection.value = null
    contextMenuTarget.value = null
    void load()
  },
  { immediate: true },
)

watch(
  () => unitLibraryRouteKey.value,
  () => {
    selectedRecordId.value = ''
    contextMenuSelection.value = null
    contextMenuTarget.value = null
    treeSelectionKeys.value = {}
    treeExpandedKeys.value = {}
    currentListDir.value = ''
    unitLibraryContext.value = null
    if (!libraryPath.value) return
    void load()
  },
)

watch(
  () => customRouteKey.value,
  () => {
    selectedRecordId.value = ''
    contextMenuSelection.value = null
    contextMenuTarget.value = null
    treeSelectionKeys.value = {}
    treeExpandedKeys.value = {}
    currentListDir.value = ''
    if (!libraryPath.value) return
    void load()
  },
)

const openFullTextSearch = async () => {
  if (!libraryPath.value) return
  const baseDir = currentListDir.value || rootDir.value || libraryPath.value
  await router.push({
    name: 'OtherFilesFullTextSearch',
    query: {
      baseDir,
      q: search.value.trim(),
    },
  })
}

const openPreview = async (record: OtherFileRecord) => {
  const p = String(record?.path || '').trim()
  if (!p) return
  await router.push({
    name: 'OtherFilesPreview',
    query: {
      path: p,
      name: String(record?.name || ''),
      fileId: String(record?.fileId || ''),
    },
  })
}

const openFile = async (record: OtherFileRecord) => {
  if (!record || record.type !== 'file') return
  const res = await window.electronAPI.fs.openFile(record.path)
  if (!res.success) {
    toast.add({ severity: 'error', summary: '打开失败', detail: res.error || '打开文件失败', life: 3000 })
  }
}

const openContainingFolder = async (record: OtherFileRecord) => {
  if (!record) return
  const folderPath = record.type === 'file' ? dirname(record.path) : record.path
  if (!folderPath) return
  const res = await window.electronAPI.fs.openFolder(folderPath)
  if (!res.success) {
    toast.add({ severity: 'error', summary: '打开失败', detail: res.error || '打开文件夹失败', life: 3000 })
  }
}

const copyPath = async (record: OtherFileRecord) => {
  if (!record?.path) return
  const ok = await copyTextToClipboard(record.path)
  if (!ok) {
    toast.add({ severity: 'error', summary: '复制失败', detail: '未能写入剪贴板', life: 2500 })
    return
  }
  toast.add({ severity: 'success', summary: '已复制路径', detail: record.path, life: 2000 })
}

const openCurrentFolder = async () => {
  const dirPath = String(currentListDir.value || rootDir.value || '').trim()
  if (!dirPath) return
  const res = await window.electronAPI.fs.openFolder(dirPath)
  if (!res.success) {
    toast.add({ severity: 'error', summary: '打开失败', detail: res.error || '打开文件夹失败', life: 3000 })
  }
}

const copyCurrentFolderPath = async () => {
  const dirPath = String(currentListDir.value || rootDir.value || '').trim()
  if (!dirPath) return
  const ok = await copyTextToClipboard(dirPath)
  if (!ok) {
    toast.add({ severity: 'error', summary: '复制失败', detail: '未能写入剪贴板', life: 2500 })
    return
  }
  toast.add({ severity: 'success', summary: '已复制路径', detail: dirPath, life: 2000 })
}

const openPropertiesDialog = (record: OtherFileRecord) => {
  propertiesDialogRecord.value = record
  propertiesDialogVisible.value = true
}

const openCreateFolderDialog = () => {
  const parentPath = String(currentListDir.value || rootDir.value || '').trim()
  openCreateFolderDialogAt(parentPath)
}

const confirmCreateFolder = async (folderName: string) => {
  if (createFolderDialogSubmitting.value) return
  const parentPath = String(createFolderDialogParentPath.value || currentListDir.value || rootDir.value || '').trim()
  if (!parentPath) {
    createFolderDialogError.value = '父目录路径为空'
    return
  }
  createFolderDialogSubmitting.value = true
  createFolderDialogError.value = ''
  try {
    const res = await window.electronAPI.otherFiles.createFolder({
      libraryPath: libraryPath.value,
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

const openRenameDialog = (record: OtherFileRecord) => {
  renameDialogRecord.value = record
  renameDialogSubmitting.value = false
  renameDialogError.value = ''
  renameDialogVisible.value = true
}

const confirmRename = async (newName: string) => {
  const record = renameDialogRecord.value
  if (!record || renameDialogSubmitting.value) return
  renameDialogSubmitting.value = true
  renameDialogError.value = ''
  try {
    const res = await window.electronAPI.otherFiles.rename({
      libraryPath: libraryPath.value,
      fileId: record.fileId,
      newName: String(newName || '').trim(),
    })
    if (!res.success) {
      renameDialogError.value = res.error || '重命名失败'
      return
    }
    closeRenameDialog()
    toast.add({ severity: 'success', summary: '重命名成功', detail: newName, life: 2000 })
    await refresh()
  } finally {
    renameDialogSubmitting.value = false
  }
}

const copyFile = async (record: OtherFileRecord) => {
  if (!record || record.type !== 'file') return
  const res = await window.electronAPI.otherFiles.copy({ libraryPath: libraryPath.value, fileId: record.fileId })
  if (!res.success) {
    toast.add({ severity: 'error', summary: '复制失败', detail: res.error || '复制文件失败', life: 3000 })
    return
  }
  toast.add({ severity: 'success', summary: '复制成功', detail: '已创建副本', life: 2000 })
  await refresh()
}

const deleteFile = async (record: OtherFileRecord) => {
  if (!record) return
  confirm.require({
    message: record.type === 'folder' ? '确认将该文件夹移入回收站？' : '确认将该文件移入回收站？',
    header: '移入回收站确认',
    icon: 'pi pi-exclamation-triangle',
    acceptLabel: '是',
    rejectLabel: '否',
    accept: async () => {
      const res = await window.electronAPI.otherFiles.delete({ libraryPath: libraryPath.value, fileId: record.fileId })
      if (!res.success) {
        toast.add({ severity: 'error', summary: '移入回收站失败', detail: res.error || '移入回收站失败', life: 3000 })
        return
      }
      toast.add({ severity: 'success', summary: '已移入回收站', detail: '', life: 2000 })
      await refresh()
    },
  })
}

const beginDragOutFromRecord = (event: DragEvent, record: OtherFileRecord) => {
  const fileId = String(record?.fileId || '').trim()
  if (!libraryPath.value || !fileId) return
  event.preventDefault()
  if (event.dataTransfer) event.dataTransfer.effectAllowed = 'copy'
  void window.electronAPI.otherFiles.startDragOut({
    libraryPath: libraryPath.value,
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
  const el = target.closest('[data-other-file-id]') as HTMLElement | null
  const fileId = String(el?.getAttribute('data-other-file-id') || '').trim()
  if (!fileId) return
  const record = items.value.find((item) => String(item.fileId) === fileId)
  if (!record) return
  beginDragOutFromRecord(event, record)
}

const onFileAreaDragEnd = (event: DragEvent) => {
  event.preventDefault()
}

const onRowClick = (event: { data?: OtherFileRecord }) => {
  const record = event?.data
  if (!record) return
  selectedRecordId.value = String(record.fileId || '')
  contextMenuTarget.value = record
}

const onRowContextMenu = (event: { originalEvent: MouseEvent; data?: OtherFileRecord }) => {
  const record = event?.data
  if (!record) return
  selectedRecordId.value = String(record.fileId || '')
  contextMenuSelection.value = record
  contextMenuTarget.value = record
  cm.value?.show(event.originalEvent)
}

const showBlankContextMenu = (event: MouseEvent) => {
  selectedRecordId.value = ''
  contextMenuSelection.value = null
  contextMenuTarget.value = null
  cm.value?.show(event)
}

const onBlankContextMenu = (event: MouseEvent) => {
  showBlankContextMenu(event)
}

const onFileAreaContextMenu = (event: MouseEvent) => {
  const target = event.target as HTMLElement | null
  if (target?.closest('[data-other-file-id]')) return
  if (target?.closest('.p-datatable-tbody tr')) return
  showBlankContextMenu(event)
}

const onRowDblclick = async (event: { data?: OtherFileRecord }) => {
  if (!event?.data) return
  selectedRecordId.value = String(event.data.fileId || '')
  if (event.data.type === 'file') {
    await openPreview(event.data)
    return
  }
  // 双击文件夹时，进入该文件夹
  currentListDir.value = event.data.path
  // 清除搜索词，以便看到文件夹内容
  search.value = ''
}

const menuState = computed(() => {
  const record = activeMenuRecord.value
  return {
    hasRecord: !!record,
    isFile: record?.type === 'file',
    hasRootDir: !!String(rootDir.value || '').trim(),
    readOnly: isCustomBrowseMode.value,
  }
})

const menuModel = computed(() => {
  const record = activeMenuRecord.value
  if (!record) {
    return [
      { label: '新建文件夹', icon: 'pi pi-plus', disabled: !menuState.value.hasRootDir || menuState.value.readOnly, command: () => void openCreateFolderDialog() },
      { separator: true },
      { label: '打开当前文件夹', icon: 'pi pi-folder-open', disabled: !menuState.value.hasRootDir, command: () => void openCurrentFolder() },
      { label: '复制当前路径', icon: 'pi pi-copy', disabled: !menuState.value.hasRootDir, command: () => void copyCurrentFolderPath() },
      { separator: true },
      { label: '刷新', icon: 'pi pi-refresh', command: () => void refresh() },
    ]
  }
  return [
    { label: '预览', icon: 'pi pi-eye', disabled: !menuState.value.isFile || !record, shortcut: 'Enter', command: () => record && void openPreview(record) },
    { label: '打开文件', icon: 'pi pi-file', disabled: !menuState.value.isFile || !record, command: () => record && void openFile(record) },
    { label: '打开所在文件夹', icon: 'pi pi-folder-open', disabled: !menuState.value.hasRecord || !record, command: () => record && void openContainingFolder(record) },
    { label: '复制路径', icon: 'pi pi-copy', disabled: !menuState.value.hasRecord || !record, command: () => record && void copyPath(record) },
    { label: '属性', icon: 'pi pi-info-circle', disabled: !menuState.value.hasRecord || !record, command: () => record && openPropertiesDialog(record) },
    { separator: true },
      { label: '新建文件夹', icon: 'pi pi-plus', disabled: !menuState.value.hasRootDir || menuState.value.readOnly, command: () => void openCreateFolderDialog() },
      { separator: true },
      { label: '重命名', icon: 'pi pi-pencil', disabled: !menuState.value.hasRecord || !record || menuState.value.readOnly, command: () => record && openRenameDialog(record) },
      { label: '复制文件', icon: 'pi pi-copy', disabled: !menuState.value.isFile || !record || menuState.value.readOnly, command: () => record && void copyFile(record) },
      { label: '移入回收站', icon: 'pi pi-trash', class: 'text-red-600', disabled: !menuState.value.hasRecord || !record || menuState.value.readOnly, command: () => record && void deleteFile(record) },
  ]
})

const handleDragEnter = (event: DragEvent) => {
  if (!libraryPath.value) return
  dragCounter.value += 1
  if (event.dataTransfer?.types?.includes('Files')) {
    isDragActive.value = true
  }
}

const handleDragOver = (event: DragEvent) => {
  if (!libraryPath.value) return
  if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy'
  if (event.dataTransfer?.types?.includes('Files')) {
    isDragActive.value = true
  }
}

const handleDragLeave = () => {
  dragCounter.value = Math.max(0, dragCounter.value - 1)
  if (dragCounter.value === 0) {
    isDragActive.value = false
  }
}

const startImport = async (files: Array<{ src: string; name: string; relativePath?: string }>) => {
  const destDir = String(currentListDir.value || rootDir.value || '').trim()
  if (!libraryPath.value || !destDir) return
  const key = importContextKey.value
  if (!key) return
  await importTaskStore.startImport({
    contextKey: key,
    destDir,
    files,
    libraryPath: libraryPath.value,
  })
}

const handleDrop = async (event: DragEvent) => {
  dragCounter.value = 0
  isDragActive.value = false
  const dt = event.dataTransfer
  if (!dt) return
  const destDir = String(currentListDir.value || rootDir.value || '').trim()
  if (!libraryPath.value || !destDir) return

  const progress = importTaskStore.peekProgress(importContextKey.value)
  if (progress && (progress.stage === 'copying' || progress.stage === 'converting' || progress.stage === 'indexing')) {
    toast.add({ severity: 'info', summary: '正在导入中', detail: '请等待当前导入完成', life: 2000 })
    return
  }

  const filePaths: string[] = []
  if (dt.files && dt.files.length > 0) {
    for (const f of Array.from(dt.files)) {
      const p = await window.electronAPI.fs.getFilePath(f as any)
      if (typeof p === 'string' && p.trim()) filePaths.push(p.trim())
    }
  }

  let filesToImport: Array<{ src: string; name: string; relativePath?: string }> = []
  if (filePaths.length > 0) {
    const res = await window.electronAPI.fileCopy.expandSources(filePaths)
    if (res.success && res.data) {
      if (res.data.truncated) {
        toast.add({ severity: 'warn', summary: '文件过多', detail: '已达到最大展开数量，部分文件未导入', life: 3500 })
      }
      filesToImport = (res.data.items || [])
        .filter((it) => !!it?.src)
        .map((it) => ({
          src: String(it.src || '').trim(),
          name: String(it.name || '').trim(),
          relativePath: it.relativePath ? String(it.relativePath).trim() || undefined : undefined,
        }))
    } else {
      filesToImport = filePaths.map((p) => ({ src: p, name: p.split(/[\\/]/).pop() || '' }))
    }
  } else {
    const dropped = await collectDroppedFiles(dt)
    filesToImport = dropped
      .map((it) => {
        const src = String(it?.file?.path || '').trim()
        if (!src) return null
        return { src, name: String(it?.file?.name || '').trim(), relativePath: String(it?.relativePath || '').trim() || undefined }
      })
      .filter(Boolean) as Array<{ src: string; name: string; relativePath?: string }>
  }

  if (filesToImport.length === 0) return
  try {
    await startImport(filesToImport)
    toast.add({ severity: 'success', summary: '开始导入', detail: `共 ${filesToImport.length} 个文件`, life: 2000 })
  } catch (err: any) {
    toast.add({ severity: 'error', summary: '导入失败', detail: err?.message || '导入失败', life: 3000 })
  }
}

const progressRef = computed(() => importTaskStore.peekProgress(importContextKey.value))
watch(
  () => progressRef.value?.stage,
  (stage) => {
    if (stage === 'completed' || stage === 'completed-with-errors') {
      void load()
    }
  },
)

onMounted(() => {
  importTaskStore.ensureSubscribed()
})

const isEditableTarget = (t: EventTarget | null) => {
  const el = t as HTMLElement | null
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
    const idx = Number(key) - 1
    const opt = folderColorOptions[idx]
    if (!opt) return
    applyColorToActiveTreeNode(opt.key)
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

.other-files-tree-resizer {
  position: absolute;
  top: 0;
  right: -3px;
  height: 100%;
  width: 6px;
  cursor: col-resize;
  z-index: 30;
  -webkit-app-region: no-drag;
}

.other-files-tree-resizer:hover,
.other-files-tree-resizer.is-resizing {
  background: color-mix(in srgb, var(--btn-primary-bg) 18%, transparent);
}
</style>
