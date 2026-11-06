<template>
  <main class="flex flex-col h-full overflow-hidden bg-[var(--content-bg)] text-[var(--content-text)]">
    <ContractFilesHeader
      :title="isTrashMode ? '回收站' : '合同文件'"
      :titleSuffix="titleSuffix"
      :searchQuery="searchQuery"
      :filterActive="filterBarVisible"
      :showImport="!isTrashMode"
      :showFullTextSearch="!isTrashMode"
      :viewMode="viewMode"
      :breadcrumbItems="showFolderBreadcrumb ? folderBreadcrumbItems : []"
      :canGoUp="canGoUpFolder"
      @update:searchQuery="(v) => (searchQuery = v)"
      @back="navigateBack"
      @import-files="importFiles"
      @open-full-text-search="openFullTextSearchPage"
      @toggle-filter="toggleFilterBar"
      @switch-view-mode="switchViewMode"
      @refresh="refresh"
      @go-up="goUpFolder"
      @navigate="navigateToFolder"
    />

    <div v-if="filterBarVisible" class="shrink-0 border-b border-[var(--content-border)] bg-[var(--content-bg)]/80 backdrop-blur-md px-6 py-2" style="-webkit-app-region: no-drag;">
      <div class="flex items-center gap-1.5 flex-wrap">
        <button
          v-for="item in filterBarItems"
          :key="item.key"
          type="button"
          class="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-sm text-[var(--content-text-secondary)] hover:bg-[var(--sidebar-hover-bg)] hover:text-[var(--content-text)] transition-colors"
          @click.stop="(event) => onFilterBarItemClick(item.key, event)"
        >
          <i :class="[item.icon, 'text-sm']"></i>
          <span class="flex items-center gap-1.5 min-w-0">
            <span>{{ item.label }}</span>
            <span
              v-if="item.key === 'folder' && selectedFolderDisplay"
              class="text-xs text-[var(--content-text-secondary)] truncate max-w-40"
            >
              {{ selectedFolderDisplay }}
            </span>
            <span
              v-if="item.key === 'folder' && selectedFolderDisplay"
              class="inline-flex items-center justify-center w-5 h-5 rounded-md text-[var(--content-text-secondary)] hover:bg-[var(--sidebar-hover-bg)] hover:text-[var(--content-text)] transition-colors"
              @click.stop="clearFolderSelection"
            >
              <i class="pi pi-times text-xs"></i>
            </span>
            <span
              v-if="item.key === 'format' && selectedFormatDisplay"
              class="text-xs text-[var(--content-text-secondary)] truncate max-w-40"
            >
              {{ selectedFormatDisplay }}
            </span>
            <span
              v-if="item.key === 'format' && selectedFormatDisplay"
              class="inline-flex items-center justify-center w-5 h-5 rounded-md text-[var(--content-text-secondary)] hover:bg-[var(--sidebar-hover-bg)] hover:text-[var(--content-text)] transition-colors"
              @click.stop="clearFormatSelection"
            >
              <i class="pi pi-times text-xs"></i>
            </span>
          </span>
        </button>

        <Popover ref="tagPopover" style="background: transparent; border: none; box-shadow: none;">
          <div class="w-64 rounded-xl border border-[var(--content-border)] bg-[var(--content-bg)] p-3 shadow-xl">
            <div class="text-sm text-[var(--content-text-secondary)]">标签过滤暂未实现</div>
          </div>
        </Popover>

        <Popover ref="folderPopover" style="background: transparent; border: none; box-shadow: none;">
          <div class="w-80 rounded-xl border border-[var(--content-border)] bg-[var(--content-bg)] p-2 shadow-xl">
            <div class="p-1">
              <div class="mb-2 flex items-center justify-between gap-2">
                <div class="text-sm font-medium text-[var(--content-text)]">文件夹</div>
                <button
                  v-if="selectedFolders.length"
                  type="button"
                  class="text-xs text-[var(--content-text-secondary)] hover:text-[var(--content-text)] transition-colors px-2 py-1 rounded-md hover:bg-[var(--sidebar-hover-bg)]"
                  @click="clearFolderSelection"
                >
                  清空
                </button>
              </div>
              <div class="mb-2">
                <InputText
                  v-model="folderSearchQuery"
                  class="w-full !bg-[var(--input-bg)] !border-[var(--input-border)] !text-[var(--content-text)] placeholder:!text-[var(--content-text-secondary)] focus:!border-[var(--btn-primary-bg)]"
                  placeholder="搜索文件夹..."
                />
              </div>
              <div class="max-h-72 overflow-auto">
                <button
                  v-for="opt in filteredFolderOptions"
                  :key="opt.key"
                  type="button"
                  class="w-full flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors text-[var(--content-text)] hover:bg-[var(--sidebar-hover-bg)]"
                  @click="toggleFolderSelection(opt.key)"
                >
                  <span class="flex items-center gap-2 min-w-0">
                    <Checkbox
                      :modelValue="isFolderSelected(opt.key)"
                      binary
                      @click.stop
                      @update:modelValue="toggleFolderSelection(opt.key)"
                    />
                    <span class="truncate" :title="opt.label">{{ opt.label }}</span>
                  </span>
                </button>
                <div v-if="filteredFolderOptions.length === 0" class="px-3 py-2 text-sm text-[var(--content-text-secondary)]">
                  无匹配文件夹
                </div>
              </div>
            </div>
          </div>
        </Popover>

        <Popover ref="formatPopover" style="background: transparent; border: none; box-shadow: none;">
          <div class="w-72 rounded-xl border border-[var(--content-border)] bg-[var(--content-bg)] p-2 shadow-xl">
            <div class="p-1">
              <div class="mb-2">
                <InputText
                  v-model="formatSearchQuery"
                  class="w-full !bg-[var(--input-bg)] !border-[var(--input-border)] !text-[var(--content-text)] placeholder:!text-[var(--content-text-secondary)] focus:!border-[var(--btn-primary-bg)]"
                  placeholder="搜索..."
                />
              </div>
              <div class="max-h-72 overflow-auto">
                <button
                  v-for="opt in filteredFileTypeStats"
                  :key="opt.ext || '__noext__'"
                  type="button"
                  class="w-full flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors text-[var(--content-text)] hover:bg-[var(--sidebar-hover-bg)]"
                  @click="toggleFormatSelection(opt.ext)"
                >
                  <span class="flex items-center gap-2 min-w-0">
                    <Checkbox
                      :modelValue="isFormatSelected(opt.ext)"
                      binary
                      @click.stop
                      @update:modelValue="toggleFormatSelection(opt.ext)"
                    />
                    <span class="truncate">{{ opt.ext || '无后缀' }}</span>
                  </span>
                  <span class="text-xs text-[var(--content-text-secondary)] tabular-nums">{{ opt.count }}</span>
                </button>
                <div v-if="filteredFileTypeStats.length === 0" class="px-3 py-2 text-sm text-[var(--content-text-secondary)]">
                  无匹配格式
                </div>
              </div>
            </div>
          </div>
        </Popover>

        <button
          type="button"
          class="inline-flex items-center justify-center w-8 h-8 rounded-lg text-[var(--content-text-secondary)] hover:bg-[var(--sidebar-hover-bg)] hover:text-[var(--content-text)] transition-colors"
        >
          <i class="pi pi-plus text-sm"></i>
        </button>
      </div>
    </div>

    <div
      class="flex-1 overflow-hidden p-6 bg-[var(--content-bg)] relative"
      @dragenter.prevent="handleDragEnter"
      @dragover.prevent="handleDragOver"
      @dragleave.prevent="handleDragLeave"
      @drop.prevent="handleDrop"
    >
      <div
        v-if="isDragActive"
        class="absolute inset-0 z-50 flex items-center justify-center pointer-events-none transition-colors duration-200"
        :style="{ backgroundColor: 'rgba(13, 110, 253, 0.08)' }"
      >
        <div class="text-center">
          <div class="text-6xl mb-4">📁</div>
          <p class="text-xl font-semibold" :style="{ color: 'var(--btn-primary-bg)' }">
            拖拽文件到此处上传到 documents
          </p>
          <p class="text-sm mt-2 opacity-70" :style="{ color: 'var(--btn-primary-bg)' }">
            支持批量拖入
          </p>
        </div>
      </div>
      <div v-if="loading" class="h-full flex items-center justify-center">
        <ProgressSpinner style="width: 40px; height: 40px" strokeWidth="3" />
      </div>

      <div v-else-if="errorMessage" class="h-full flex flex-col items-center justify-center text-[var(--content-text-secondary)]">
        <i class="pi pi-exclamation-triangle text-3xl mb-3 opacity-60"></i>
        <div class="text-sm">{{ errorMessage }}</div>
      </div>

      <div
        v-else
        ref="fileAreaEl"
        class="h-full flex flex-col min-h-0 overflow-hidden bg-[var(--content-bg)] focus:outline-none"
        tabindex="0"
        @dragstart.capture="onFileAreaDragStart"
        @dragend.capture="onFileAreaDragEnd"
        @keydown.capture="onFileAreaKeydown"
        @mousedown.capture="onFileAreaPointerDownCapture"
        @mousedown="onFileAreaMouseDown"
        @contextmenu.prevent="onFileAreaContextMenu"
      >
        <!-- 框选覆盖层 -->
        <div
          v-if="rubberBandActive"
          class="absolute pointer-events-none z-40 border-2 border-[var(--btn-primary-bg)]"
          :style="rubberBandStyle"
        ></div>

        <div class="flex-1 min-h-0 overflow-hidden">
          <div v-if="items.length === 0" class="h-full flex flex-col items-center justify-center text-[var(--content-text-secondary)]">
            <i class="pi pi-inbox text-3xl mb-3 opacity-60"></i>
            <div class="text-sm">暂无文件记录</div>
          </div>
          <div
            v-else
            class="h-full"
            @contextmenu.self.prevent="onBlankContextMenu"
          >
            <div v-if="activeRenderMode === null" class="h-full flex items-center justify-center text-[var(--content-text-secondary)]">
              <ProgressSpinner style="width: 36px; height: 36px" strokeWidth="3" />
            </div>
            <ContractFilesTreeMode
              v-else-if="activeRenderMode === 'tree'"
              :tableKey="`tree-${viewRenderKey}`"
              :nodes="flattenedTreeNodes"
              :rowClass="treeRowClass"
              :isSelectedKey="isTreeKeySelected"
              :getTypeText="getTypeText"
              :getSizeText="getSizeText"
              :formatDbTime="formatDbTime"
              @dragstart="onTreeDragStart"
              @row-click="onTreeRowClick"
              @row-dblclick="onTreeRowDblclick"
              @row-contextmenu="onTreeRowContextMenu"
              @toggle="toggleTreeNode"
              @open-context-menu="openTreeContextMenu"
              @node-click="onTreeNodeClick"
              @node-dblclick="onTreeNodeDblclick"
            />

            <ContractFilesListMode
              v-else-if="activeRenderMode === 'list'"
              :tableKey="`list-${viewRenderKey}`"
              :items="sortedListItems"
              v-model:contextMenuSelection="contextMenuSelection"
              :sortField="listSortField"
              :sortOrder="listSortOrder"
              :rowClass="listRowClass"
              :getExt="getExt"
              :formatSize="formatSize"
              :formatTime="formatTime"
              @row-contextmenu="onRowContextMenu"
              @row-click="onListRowClick"
              @row-dblclick="onListRowDblclick"
              @sort="onListSort"
            />

            <ContractFilesWaterfallMode
              v-else-if="activeRenderMode === 'waterfall'"
              :masonryKey="`waterfall-${viewRenderKey}`"
              :items="listItems"
              :isSelected="isWaterfallSelected"
              :debug="waterfallDebug"
              @open="openEntryFromWaterfall"
              @click="onWaterfallClick"
              @contextmenu="onWaterfallContextMenu"
              @retry="retryGenerateThumbnail"
            />
          </div>
          <ContextMenu ref="cm" :model="menuModel" @hide="treeContextMenuSelectionKey = null">
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
    </div>

    <ContractFilesStatusBar :statusPath="statusPath" :folderCount="visibleFolderCount" :fileCount="visibleFileCount" :visibleEntryCount="visibleEntryCount" :selectedCount="selectedCount" />

    <FileCopyFailedDialog v-model="showFailedDialog" :failures="copyFailures" :loading="retryingFailures" @retry-all="retryAllFailures" @retry-selected="retrySelectedFailures" />
    <RenameDialog v-model:visible="renameDialogVisible" :record="renameDialogRecord" :submitting="renameDialogSubmitting" :submitError="renameDialogError" @confirm="confirmRename" @clear-submit-error="() => (renameDialogError = '')" />
    <CreateFolderDialog v-model:visible="createFolderDialogVisible" :parentPath="createFolderDialogParentPath" :contractNo="effectiveContractNo" :submitting="createFolderDialogSubmitting" :submitError="createFolderDialogError" @confirm="confirmCreateFolder" @clear-submit-error="() => (createFolderDialogError = '')" />
    <MoveFilesDialog
      v-model:visible="moveDialogVisible"
      :mode="moveDialogMode"
      :selectedCount="selectedCount"
      :submitting="moveDialogSubmitting"
      :submitError="moveDialogError"
      :contractOptions="moveContractOptions"
      v-model:targetContractId="moveTargetContractId"
      :folderOptions="moveFolderOptions"
      :folderTreeOptions="moveFolderTreeOptions"
      v-model:targetDirPath="moveTargetDirPath"
      v-model:conflictStrategy="moveConflictStrategy"
      @change-contract="onMoveDialogContractChange"
      @confirm="confirmMove"
    />
    <FilePropertiesDialog v-model:visible="propertiesDialogVisible" :record="propertiesDialogRecord" />
    <DeleteProgressBar :visible="deleteProgress.visible.value" :status="deleteProgress.status.value" :title="deleteProgress.title.value" :percent="deleteProgress.percent.value" :fractionText="deleteProgress.fractionText.value" :percentText="deleteProgress.percentText.value" :currentName="deleteProgress.currentName.value" :failCount="deleteProgress.failCount.value" :isCancelled="deleteProgress.isCancelled.value" @dismiss="deleteProgress.dismiss" @cancel="deleteProgress.cancel" />
    <MoveProgressBar :visible="moveProgress.visible.value" :status="moveProgress.status.value" :title="moveProgress.title.value" :percent="moveProgress.percent.value" :fractionText="moveProgress.fractionText.value" :percentText="moveProgress.percentText.value" :currentName="moveProgress.currentName.value" :failCount="moveProgress.failCount.value" :isCancelled="moveProgress.isCancelled.value" @dismiss="moveProgress.dismiss" @cancel="moveProgress.cancel" />
    <ImportProgressFooter v-if="importContextKey" :contextKey="importContextKey" />
    <InvoiceImportConfirmDialog
      v-model:visible="invoiceImportDialogVisible"
      :candidates="pendingInvoiceCandidates"
      :submitting="invoiceImportSubmitting"
      @confirm="confirmImportInvoices"
      @cancel="cancelImportInvoices"
    />
    <FileCopyProgressFooter />
  </main>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import Checkbox from 'primevue/checkbox'
import InputText from 'primevue/inputtext'
import Popover from 'primevue/popover'
import ProgressSpinner from 'primevue/progressspinner'
import ContextMenu from 'primevue/contextmenu'
import { useConfirm } from 'primevue/useconfirm'
import { useToast } from 'primevue/usetoast'
import FileCopyProgressFooter from './components/FileCopyProgressFooter.vue'
import ImportProgressFooter from './components/ImportProgressFooter.vue'
import FileCopyFailedDialog from '../../../components/FileCopyFailedDialog.vue'
import ContractFilesHeader from './components/ContractFilesHeader.vue'
import ContractFilesStatusBar from './components/ContractFilesStatusBar.vue'
import ContractFilesTreeMode from './components/ContractFilesTreeMode.vue'
import ContractFilesListMode from './components/ContractFilesListMode.vue'
import ContractFilesWaterfallMode from './components/ContractFilesWaterfallMode.vue'
import ContractFilesBreadcrumb from './components/ContractFilesBreadcrumb.vue'
import RenameDialog from './components/RenameDialog.vue'
import CreateFolderDialog from './components/CreateFolderDialog.vue'
import MoveFilesDialog from './components/MoveFilesDialog.vue'
import FilePropertiesDialog from './components/FilePropertiesDialog.vue'
import DeleteProgressBar from './components/DeleteProgressBar.vue'
import MoveProgressBar from './components/MoveProgressBar.vue'
import InvoiceImportConfirmDialog from './components/InvoiceImportConfirmDialog.vue'
import { formatDbTime, formatSize, formatTime, getExt, getSizeText, getTypeText, joinPath, normalizePathForCompare } from './contractFilesHelpers'
import { useDeleteProgress } from './useDeleteProgress'
import { useMoveProgress } from './useMoveProgress'
import { useContractFilesTree } from './useContractFilesTree'
import { useContractFilesList } from './useContractFilesList'
import { useFileCopyTaskStore } from '../../../stores/file/fileCopyTaskStore'
import { useImportTaskStore } from '../../../stores/system/importTaskStore'
import { useThumbnailQueueStore } from '../../../stores/file/thumbnailQueueStore'
import eventBus from '../../../utils/eventBus'
import { createRendererLogger } from '../../../utils/logger'
import type { ContractInfoEntity } from '../../../../shared/types/contractInfo.types'
import type { ContractFileRecord } from '../../../../shared/types/contractFile.types'
import type { ImportTaskInvoiceCandidate } from '../../../../shared/types/importTask.types'
import type { ContractInvoiceCreateDTO, ContractInvoiceQueryDTO, ContractInvoiceUpdateDTO } from '../../../../shared/types/contractInvoice.types'
import type { Customer, CustomerCreateDTO } from '../../../../shared/types/customer.types'
import type { Supplier, SupplierCreateDTO } from '../../../../shared/types/supplier.types'
import { IdGenerator } from '../../../../shared/utils/idGenerator'
import { type ContractFilesViewMode, normalizeViewMode } from './contractFilesViewTypes'
import { useContractFilesFilters } from './useContractFilesFilters'
import { useContractFilesFolderNav } from './useContractFilesFolderNav'
import { useContractFilesSelection } from './useContractFilesSelection'
import { useContractFilesActions } from './useContractFilesActions'
import { useContractFilesImport } from './useContractFilesImport'
import { useFileAreaRubberBand } from './useFileAreaRubberBand'

const route = useRoute()
const router = useRouter()
const confirm = useConfirm()
const toast = useToast()
const invoiceImportLogger = createRendererLogger('InvoiceImport')

const contractId = computed(() => String(route.params.contractId || '').trim())
const isTrashMode = computed(() => contractId.value === '__trash__')
const libraryPath = computed(() => localStorage.getItem('currentLibraryPath') || '')

const parseRouteQueryText = (value: unknown) => {
  if (typeof value === 'string') return value.trim()
  if (Array.isArray(value)) return String(value[0] || '').trim()
  return ''
}

const getBackResourceQuery = () => {
  const folderId = parseRouteQueryText(route.query.folderId)
  if (folderId) return { folderId }
  const category = parseRouteQueryText(route.query.category)
  if (category && category !== 'all') return { category }
  return {}
}

const navigateBack = () => {
  if (isTrashMode.value) {
    router.push({ name: 'Resource' })
    return
  }
  router.push({ name: 'Resource', query: getBackResourceQuery() })
}
console.log('contractId contractFilesViews 被加载', contractId.value)
const searchQuery = ref('')
const filterBarVisible = ref(false)
const fileAreaEl = ref<HTMLElement | null>(null)
const tagPopover = ref<InstanceType<typeof Popover> | null>(null)
const folderPopover = ref<InstanceType<typeof Popover> | null>(null)
const folderSearchQuery = ref('')
const selectedFolders = ref<string[]>([])
const formatPopover = ref<InstanceType<typeof Popover> | null>(null)
const formatSearchQuery = ref('')
const selectedFormats = ref<string[]>([])

watch(
  () => filterBarVisible.value,
  (visible) => {
    if (visible) return
    tagPopover.value?.hide()
    folderPopover.value?.hide()
    formatPopover.value?.hide()
    folderSearchQuery.value = ''
    formatSearchQuery.value = ''
  }
)

const contractInfo = ref<ContractInfoEntity | null>(null)
const rootDir = ref('')
const contractNo = ref('')
const items = ref<ContractFileRecord[]>([])
const fileAreaRect = ref<DOMRect | null>(null)

const viewMode = ref<ContractFilesViewMode>(normalizeViewMode(localStorage.getItem('contract_files_view_mode')))
const activeRenderMode = ref<ContractFilesViewMode | null>(viewMode.value)
const viewRenderKey = ref(0)
let viewSwitchTimer: number | null = null
const currentListDir = ref('')
const treeExpandedKeys = ref<Record<string, boolean>>({})

const loading = ref(false)
const errorMessage = ref('')
const fileCopyTaskStore = useFileCopyTaskStore()
const importTaskStore = useImportTaskStore()
const thumbnailQueueStore = useThumbnailQueueStore()
const waterfallDebug = computed(() => process.env.NODE_ENV !== 'production' && localStorage.getItem('contract_files_waterfall_debug') === '1')
const invoiceImportDialogVisible = ref(false)
const invoiceImportSubmitting = ref(false)
const pendingInvoiceCandidates = ref<ImportTaskInvoiceCandidate[]>([])
const invoicePromptHandledTaskId = ref('')

const toInvoiceLogPayload = (candidate: ImportTaskInvoiceCandidate) => {
  const parsed = candidate.parseResult || ({} as any)
  const data = parsed.data || {}
  return {
    contractId: candidate.contractId,
    fileId: candidate.fileId,
    sourcePath: candidate.sourcePath,
    markdownPath: candidate.markdownPath,
    parseEngine: candidate.parseEngine,
    parseConfidence: candidate.parseConfidence,
    parseError: candidate.parseError,
    isInvoice: parsed.isInvoice,
    invoiceCode: data.invoiceCode,
    invoiceNo: data.invoiceNo,
    issueDate: data.issueDate,
    buyerName: data.buyerName,
    buyerTaxNo: data.buyerTaxNo,
    sellerName: data.sellerName,
    sellerTaxNo: data.sellerTaxNo,
    amountWithoutTax: data.amountWithoutTax,
    taxAmount: data.taxAmount,
    totalAmount: data.totalAmount,
    issuerName: (data as any).issuerName,
    remark: (data as any).remark,
    invoiceItemsCount: Array.isArray((data as any).invoiceItems) ? (data as any).invoiceItems.length : 0,
    errors: Array.isArray(parsed.errors)
      ? parsed.errors.map((item: any) => ({
        code: item?.code,
        field: item?.field,
        message: item?.message,
      }))
      : [],
    rawTextExcerpt: String(candidate.rawTextExcerpt || '').slice(0, 500),
  }
}

const deleteProgressKey = computed(() => `${libraryPath.value}::${contractId.value}`)
const deleteProgress = useDeleteProgress(deleteProgressKey)
const deleteProgressRef = ref(deleteProgress)

const moveProgressKey = computed(() => `${libraryPath.value}::${contractId.value}`)
const moveProgress = useMoveProgress(moveProgressKey)
const moveProgressRef = ref(moveProgress)

const effectiveContractNo = computed(() => {
  const v = String(contractNo.value || '').trim()
  if (v) return v
  return String(contractInfo.value?.contract_code || '').trim()
})

const titleSuffix = computed(() => {
  if (!contractInfo.value) return ''
  const name = contractInfo.value.contract_name || ''
  const code = contractInfo.value.contract_code || ''
  if (name && code) return `(${code}) ${name}`
  return name || code
})

const { listItems: listItemsBase, sortedListItems: sortedListItemsBase, listSortField, listSortOrder, onListSort } = useContractFilesList({
  items,
  rootDir,
  currentListDir,
  searchQuery,
  activeRenderMode,
  settingKey: 'contract_files_list_sort',
  trashMode: isTrashMode,
})

const {
  filterBarItems,
  toggleFilterBar,
  onFilterBarItemClick,
  filteredFolderOptions,
  selectedFolderDisplay,
  isFolderSelected,
  toggleFolderSelection,
  clearFolderSelection,
  filteredFileTypeStats,
  selectedFormatDisplay,
  isFormatSelected,
  toggleFormatSelection,
  clearFormatSelection,
  treeItems,
  listItems,
  sortedListItems,
} = useContractFilesFilters({
  rootDir,
  items,
  viewMode,
  currentListDir,
  searchQuery,
  filterBarVisible,
  tagPopover,
  folderPopover,
  formatPopover,
  selectedFolders,
  folderSearchQuery,
  selectedFormats,
  formatSearchQuery,
  listItemsBase,
  sortedListItemsBase,
})

const { treeRootKey, treeTableNodes, flattenedTreeNodes, toggleTreeNode } = useContractFilesTree({
  items: treeItems,
  rootDir,
  activeRenderMode,
  treeExpandedKeys,
})

const selection = useContractFilesSelection({
  viewMode,
  items,
  listItems,
  sortedListItems,
  treeTableNodes,
  treeRootKey,
  treeExpandedKeys,
  rootDir,
})

const {
  recordById,
  recordByPath,
  listAllSelected,
  listIncludedIds,
  listExcludedIds,
  listSelectionAnchorId,
  treeAllSelected,
  treeIncludedKeys,
  treeExcludedKeys,
  treeSelectionAnchorKey,
  waterfallAllSelected,
  waterfallIncludedIds,
  waterfallExcludedIds,
  isListSelected,
  listRowClass,
  isTreeKeySelected,
  treeRowClass,
  isWaterfallSelected,
  selectedCount,
  visibleEntryCount,
  visibleFolderCount,
  visibleFileCount,
  ensureSelectionForContext,
  onFileAreaPointerDownCapture: originalPointerDownCapture,
  onListRowClick,
  onTreeRowClick,
  getVisibleTreeKeys,
  toggleSelectAllCurrentMode,
  getSelectedRecordsForAction,
} = selection

const { openFullTextSearchPage, showFolderBreadcrumb, folderBreadcrumbItems, canGoUpFolder, goUpFolder, navigateToFolder } =
  useContractFilesFolderNav({
    router,
    contractId,
    isTrashMode,
    rootDir,
    currentListDir,
    viewMode,
    searchQuery,
  })

const statusPath = computed(() => {
  const root = String(rootDir.value || '')
  if (viewMode.value === 'tree') return root
  if (searchQuery.value.trim()) return root || String(currentListDir.value || '')
  return String(currentListDir.value || '') || root
})

const resetListAndWaterfallSelection = () => {
  listAllSelected.value = false
  listIncludedIds.value = new Set()
  listExcludedIds.value = new Set()
  listSelectionAnchorId.value = null
  waterfallAllSelected.value = false
  waterfallIncludedIds.value = new Set()
  waterfallExcludedIds.value = new Set()
}

let fileListRequestSeq = 0
const loadFileItems = async () => {
  if (!libraryPath.value) return
  if (!isTrashMode.value && !contractId.value) return
  const currentSeq = ++fileListRequestSeq
  try {
    const search = searchQuery.value.trim() || undefined
    const listRes = isTrashMode.value
      ? await window.electronAPI.contractFiles.getTrashList({ libraryPath: libraryPath.value, search })
      : await window.electronAPI.contractFiles.getList({ libraryPath: libraryPath.value, contractId: contractId.value, search })
    if (currentSeq !== fileListRequestSeq) return
    if (listRes.success && listRes.data) {
      contractNo.value = isTrashMode.value ? '' : String(listRes.data.contractNo || contractNo.value || '').trim()
      const nRoot = normalizePathForCompare(rootDir.value)
      items.value = nRoot ? listRes.data.items.filter((it) => normalizePathForCompare(it.path).startsWith(nRoot + '/')) : []
      resetListAndWaterfallSelection()
      scheduleThumbnailEnqueue()
    } else {
      items.value = []
    }
  } catch (err) {
    console.error('Failed to load file items:', err)
  }
}

const loadContract = async () => {
  errorMessage.value = ''
  if (!libraryPath.value || !contractId.value) return

  loading.value = true
  try {
    const prevRoot = rootDir.value
    if (isTrashMode.value) {
      contractInfo.value = null
      rootDir.value = libraryPath.value
      contractNo.value = ''
      items.value = []
      currentListDir.value = rootDir.value
      treeAllSelected.value = false
      treeIncludedKeys.value = new Set()
      treeExcludedKeys.value = new Set()
      treeSelectionAnchorKey.value = null
      treeExpandedKeys.value = {}
      resetListAndWaterfallSelection()
      await loadFileItems()
      return
    }
    const res = await window.electronAPI.library.getContractInfo({ libraryPath: libraryPath.value, id: contractId.value })
    if (!res.success || !res.data) {
      errorMessage.value = res.error || '读取合同信息失败'
      contractInfo.value = null
      rootDir.value = ''
      contractNo.value = ''
      items.value = []
      currentListDir.value = ''
      treeAllSelected.value = false
      treeIncludedKeys.value = new Set()
      treeExcludedKeys.value = new Set()
      treeSelectionAnchorKey.value = null
      treeExpandedKeys.value = {}
      resetListAndWaterfallSelection()
      return
    }
    contractInfo.value = res.data
    contractNo.value = String(res.data.contract_code || '').trim()
    const contractDir = joinPath(libraryPath.value, res.data.folder_name)
    rootDir.value = joinPath(contractDir, 'documents')
    const nPrevRoot = normalizePathForCompare(prevRoot)
    const nRoot = normalizePathForCompare(rootDir.value)
    const nCurrent = normalizePathForCompare(currentListDir.value)
    if (!nCurrent || !nCurrent.startsWith(nRoot) || nPrevRoot !== nRoot) {
      currentListDir.value = rootDir.value
    }
    if (viewMode.value === 'tree') {
      const rootKey = treeRootKey.value
      treeAllSelected.value = false
      treeExcludedKeys.value = new Set()
      treeIncludedKeys.value = new Set([rootKey])
      treeSelectionAnchorKey.value = rootKey
      if (!treeExpandedKeys.value || Object.keys(treeExpandedKeys.value).length === 0 || !treeExpandedKeys.value[rootKey]) {
        treeExpandedKeys.value = { [rootKey]: true }
      }
    }
    await loadFileItems()
  } finally {
    loading.value = false
  }
}

watch(searchQuery, () => {
  void loadFileItems()
})

const scanAndSyncFromDisk = async () => {
  if (!rootDir.value || !libraryPath.value || !contractId.value || !contractNo.value) return
  loading.value = true
  try {
    const maxEntries = 5000
    const queue: string[] = [rootDir.value]
    const paths: string[] = []
    while (queue.length > 0) {
      const dir = queue.shift() as string
      const res = await window.electronAPI.fs.listDir(dir)
      if (!res.success || !res.data) continue
      for (const entry of res.data as any[]) {
        if (!entry?.path) continue
        paths.push(String(entry.path))
        if (paths.length >= maxEntries) break
        if (entry.kind === 'directory') queue.push(String(entry.path))
      }
      if (paths.length >= maxEntries) break
    }
    if (paths.length >= maxEntries) {
      toast.add({ severity: 'warn', summary: '扫描已截断', detail: `已达到最大条目数 ${maxEntries}`, life: 3000 })
    }
    if (paths.length === 0) {
      toast.add({ severity: 'info', summary: '未发现文件', detail: '', life: 2000 })
      return
    }
    const upsertRes = await window.electronAPI.contractFiles.upsertFromPaths({
      libraryPath: libraryPath.value,
      contractId: contractId.value,
      contractNo: contractNo.value,
      paths,
    })
    if (!upsertRes.success) {
      toast.add({ severity: 'error', summary: '同步失败', detail: upsertRes.error || '写入文件记录失败', life: 3000 })
      return
    }
    toast.add({ severity: 'success', summary: '同步完成', detail: `写入/更新 ${upsertRes.data?.upserted || 0} 条记录`, life: 2500 })
    await loadContract()
  } finally {
    loading.value = false
  }
}

const refresh = async () => {
  await loadContract()
  if (isTrashMode.value) return
  if (!rootDir.value || !effectiveContractNo.value) return
  if (items.value.length > 0) return
  confirm.require({
    message: '数据库暂无文件记录，是否从磁盘扫描并写入文件记录？',
    header: '扫描同步',
    icon: 'pi pi-search',
    acceptLabel: '是',
    rejectLabel: '否',
    accept: async () => {
      await scanAndSyncFromDisk()
    },
  })
}

let offThumbnailUpdatedListener: null | (() => void) = null
let thumbnailEnqueueTimer: number | null = null
const itemIndexById = ref<Map<string, number>>(new Map())

watch(
  () => items.value,
  (arr) => {
    const map = new Map<string, number>()
    for (let i = 0; i < arr.length; i++) {
      map.set(String(arr[i]?.fileId), i)
    }
    itemIndexById.value = map
  },
  { deep: false, immediate: true }
)

const scheduleThumbnailEnqueue = () => {
  if (viewMode.value !== 'waterfall' || activeRenderMode.value !== 'waterfall') return
  const lp = String(libraryPath.value || '').trim()
  if (!lp) return
  if (!items.value.length) return

  if (thumbnailEnqueueTimer) window.clearTimeout(thumbnailEnqueueTimer)
  thumbnailEnqueueTimer = window.setTimeout(() => {
    const ric = (window as any).requestIdleCallback as undefined | ((cb: () => void, opts?: { timeout?: number }) => number)
    if (typeof ric === 'function') {
      ric(() => thumbnailQueueStore.enqueue(lp, items.value), { timeout: 800 })
    } else {
      thumbnailQueueStore.enqueue(lp, items.value)
    }
  }, 120)
}

const switchViewMode = (mode: ContractFilesViewMode) => {
  if (viewMode.value === mode && activeRenderMode.value === mode) return
  viewMode.value = mode
  if (viewSwitchTimer) window.clearTimeout(viewSwitchTimer)
  activeRenderMode.value = null
  viewSwitchTimer = window.setTimeout(() => {
    activeRenderMode.value = mode
    viewRenderKey.value += 1
    viewSwitchTimer = null
    scheduleThumbnailEnqueue()
  }, 34)
}

const actions = useContractFilesActions({
  router,
  confirm,
  toast,
  libraryPath,
  contractId,
  rootDir,
  currentListDir,
  viewMode,
  searchQuery,
  items,
  effectiveContractNo,
  refresh,
  deleteProgress: deleteProgressRef,
  moveProgress: moveProgressRef,
  selectedCount,
  getSelectedRecordsForAction,
  ensureSelectionForContext,
  getVisibleTreeKeys,
  treeAllSelected,
  treeIncludedKeys,
  treeExcludedKeys,
  treeSelectionAnchorKey,
  listAllSelected,
  listIncludedIds,
  listExcludedIds,
  listSelectionAnchorId,
  waterfallAllSelected,
  waterfallIncludedIds,
  waterfallExcludedIds,
  isListSelected,
  isTreeKeySelected,
  isWaterfallSelected,
  toggleSelectAllCurrentMode,
  sortedListItems,
  listItems,
  recordById,
  recordByPath,
  fileAreaEl,
  treeTableNodes,
  treeRootKey,
  flattenedTreeNodes,
  treeExpandedKeys,
  toggleTreeNode,
  fileAreaRect,
})

const {
  cm,
  menuModel,
  onRowContextMenu,
  onTreeRowContextMenu,
  openTreeContextMenu,
  onBlankContextMenu,
  onListRowDblclick,
  onTreeRowDblclick,
  onTreeDragStart,
  onFileAreaDragStart,
  onFileAreaDragEnd,
  onFileAreaKeydown,
  onGlobalKeydownCapture,
  onFileAreaMouseDown,
  onFileAreaContextMenu,
  contextMenuSelection,
  contextMenuTarget,
  treeContextMenuSelectionKey,
  previewRecord,
  renameDialogVisible,
  renameDialogRecord,
  renameDialogSubmitting,
  renameDialogError,
  confirmRename,
  createFolderDialogVisible,
  createFolderDialogParentPath,
  createFolderDialogSubmitting,
  createFolderDialogError,
  confirmCreateFolder,
  propertiesDialogVisible,
  propertiesDialogRecord,
  moveDialogVisible,
  moveDialogSubmitting,
  moveDialogMode,
  moveDialogError,
  moveContractOptions,
  moveTargetContractId,
  moveFolderOptions,
  moveFolderTreeOptions,
  moveTargetDirPath,
  moveConflictStrategy,
  confirmMove,
  onMoveDialogContractChange,
  openEntryFromWaterfall,
  retryGenerateThumbnail,
  internalDragOutActive,
} = actions

const importOps = useContractFilesImport({
  toast,
  importTaskStore,
  fileCopyTaskStore,
  libraryPath,
  contractId,
  contractNo,
  rootDir,
  currentListDir,
  viewMode,
  isTrashMode,
  internalDragOutActive,
  loadContract,
})

const {
  importContextKey,
  isDragActive,
  handleDragEnter,
  handleDragOver,
  handleDragLeave,
  handleDrop,
  importFiles,
  showFailedDialog,
  copyFailures,
  retryingFailures,
  retryAllFailures,
  retrySelectedFailures,
} = importOps

// 框选功能
const rubberBand = useFileAreaRubberBand({
  fileAreaEl,
  viewMode,
  items,
  listItems,
  sortedListItems,
  treeTableNodes,
  treeRootKey,
  treeExpandedKeys,
  rootDir,
  currentListDir,
  listAllSelected,
  listIncludedIds,
  listExcludedIds,
  listSelectionAnchorId,
  treeAllSelected,
  treeIncludedKeys,
  treeExcludedKeys,
  treeSelectionAnchorKey,
  waterfallAllSelected,
  waterfallIncludedIds,
  waterfallExcludedIds,
  isListSelected,
  isTreeKeySelected,
  isWaterfallSelected,
  recordById,
  recordByPath,
  onFileAreaPointerDownCapture: originalPointerDownCapture,
})

const {
  rubberBandActive,
  rubberBandStyle,
  onFileAreaPointerDownCapture,
} = rubberBand

watch(importContextKey, (key) => {
  if (!key) return
  void importTaskStore.syncStatus(key)
})

watch(
  () => (importContextKey.value ? importTaskStore.peekProgress(importContextKey.value)?.stage : null),
  async (stage, prevStage) => {
    if (!stage) return
    if (stage === 'completed' || stage === 'completed-with-errors') {
      const fromWorking = prevStage === 'copying' || prevStage === 'converting' || prevStage === 'indexing'
      if (fromWorking) {
        const progress = importContextKey.value ? importTaskStore.peekProgress(importContextKey.value) : null
        const taskId = String(progress?.taskId || '').trim()
        if (taskId && taskId !== invoicePromptHandledTaskId.value && importContextKey.value) {
          await importTaskStore.syncStatus(importContextKey.value)
          const candidates = importTaskStore.peekInvoiceCandidates(importContextKey.value)
          if (candidates.length > 0) {
            void invoiceImportLogger.info('检测到待确认发票候选', {
              taskId,
              contextKey: importContextKey.value,
              candidateCount: candidates.length,
              candidates: candidates.map(toInvoiceLogPayload),
            })
            pendingInvoiceCandidates.value = candidates
            invoiceImportDialogVisible.value = true
          }
          invoicePromptHandledTaskId.value = taskId
        }
      }
      void loadContract()
    }
  }
)

const toCreateInvoiceDto = (candidate: ImportTaskInvoiceCandidate): ContractInvoiceCreateDTO => {
  const parsed = candidate.parseResult
  const data = parsed?.data || {}
  const invoiceItemsJson = Array.isArray((data as any).invoiceItems)
    ? JSON.stringify((data as any).invoiceItems)
    : '[]'
  return {
    contract_id: candidate.contractId,
    contract_code: candidate.contractCode,
    contract_name: candidate.contractName,
    file_id: candidate.fileId || '',
    source_sha256: candidate.sourceSha256 || '',
    source_path: candidate.sourcePath || '',
    invoice_type: data.invoiceType,
    invoice_code: data.invoiceCode,
    invoice_no: data.invoiceNo,
    invoice_date: data.issueDate,
    issue_date: data.issueDate,
    seller_name: data.sellerName,
    seller_tax_no: data.sellerTaxNo,
    buyer_name: data.buyerName,
    buyer_tax_no: data.buyerTaxNo,
    amount_without_tax: data.amountWithoutTax,
    tax_amount: data.taxAmount,
    amount_with_tax: data.totalAmount,
    total_amount: data.totalAmount,
    invoice_items_json: invoiceItemsJson,
    remark: (data as any).remark,
    issuer_name: (data as any).issuerName,
    currency: candidate.currency,
    parse_status: 'parsed',
    parse_confidence: candidate.parseConfidence,
    parse_error: candidate.parseError,
    parse_errors: candidate.parseErrors || JSON.stringify(parsed?.errors || []),
    parse_engine: candidate.parseEngine || 'invoice-markdown-parser-v1',
    parse_result_json: JSON.stringify(parsed || {}),
    raw_text_excerpt: candidate.rawTextExcerpt,
    parse_started_at: candidate.parseStartedAt,
    parse_finished_at: candidate.parseFinishedAt,
  }
}

const findExistingInvoiceId = async (candidate: ImportTaskInvoiceCandidate) => {
  const baseQuery: Pick<ContractInvoiceQueryDTO, 'contractId' | 'includeDeleted' | 'page' | 'pageSize'> = {
    contractId: candidate.contractId,
    includeDeleted: true,
    page: 1,
    pageSize: 1,
  }
  if (candidate.sourceSha256) {
    const bySha = await window.electronAPI.contractInvoice.getList({
      ...baseQuery,
      sourceSha256: candidate.sourceSha256,
    })
    if (bySha.success && bySha.data?.data?.[0]?.id) {
      return String(bySha.data.data[0].id)
    }
  }
  if (candidate.fileId) {
    const byFile = await window.electronAPI.contractInvoice.getList({
      ...baseQuery,
      fileId: candidate.fileId,
    })
    if (byFile.success && byFile.data?.data?.[0]?.id) {
      return String(byFile.data.data[0].id)
    }
  }
  return ''
}

const normalizeName = (value: unknown) => String(value || '').trim().replace(/\s+/g, '').toLowerCase()
const normalizeTaxNo = (value: unknown) => String(value || '').trim().toUpperCase().replace(/[^0-9A-Z]/g, '')
const normalizeDisplay = (value: unknown) => String(value || '').trim()

const parseListRows = <T = any>(res: any): T[] => {
  const rows = res?.data?.data || res?.data?.items || []
  return Array.isArray(rows) ? rows as T[] : []
}

const hasCustomerMatch = (rows: Customer[], name: string, taxNo: string) => {
  const nName = normalizeName(name)
  const nTax = normalizeTaxNo(taxNo)
  if (!nName && !nTax) return true
  return rows.some((row: any) => {
    const rowName = normalizeName(row?.name)
    const rowTax = normalizeTaxNo(row?.tax_number)
    return (nName && rowName && nName === rowName) || (nTax && rowTax && nTax === rowTax)
  })
}

const hasSupplierMatch = (rows: Supplier[], name: string, taxNo: string) => {
  const nName = normalizeName(name)
  const nTax = normalizeTaxNo(taxNo)
  if (!nName && !nTax) return true
  return rows.some((row: any) => {
    const rowName = normalizeName(row?.name)
    const rowTax = normalizeTaxNo(row?.tax_number)
    return (nName && rowName && nName === rowName) || (nTax && rowTax && nTax === rowTax)
  })
}

const saveMissingParties = async (
  candidates: ImportTaskInvoiceCandidate[],
  actionMap: Record<string, { createCustomer?: boolean; createSupplier?: boolean }>,
) => {
  const [customerRes, supplierRes] = await Promise.all([
    window.electronAPI.customer.getList({ page: 1, pageSize: 10000 }),
    window.electronAPI.supplier.getList({ page: 1, pageSize: 10000 }),
  ])
  if (!customerRes.success || !supplierRes.success) {
    throw new Error(customerRes.error || supplierRes.error || '加载甲方/乙方单位数据失败')
  }

  const customers = parseListRows<Customer>(customerRes)
  const suppliers = parseListRows<Supplier>(supplierRes)
  const customerCreatedKeys = new Set<string>()
  const supplierCreatedKeys = new Set<string>()
  let createdCustomerCount = 0
  let createdSupplierCount = 0

  for (const candidate of candidates) {
    const data = candidate.parseResult?.data || {}
    const candidateKey = [
      String(candidate.contractId || ''),
      String(candidate.fileId || ''),
      String(candidate.sourcePath || ''),
      String(data.invoiceCode || ''),
      String(data.invoiceNo || ''),
    ].join('||')
    const action = actionMap[candidateKey] || {}

    const buyerName = normalizeDisplay(data.buyerName)
    const buyerTaxNo = normalizeDisplay(data.buyerTaxNo)
    if (action.createCustomer && (buyerName || buyerTaxNo)) {
      const createKey = `${normalizeName(buyerName)}||${normalizeTaxNo(buyerTaxNo)}`
      if (!customerCreatedKeys.has(createKey) && !hasCustomerMatch(customers, buyerName, buyerTaxNo)) {
        const payload: CustomerCreateDTO = {
          code: IdGenerator.generateCode('CUS'),
          name: buyerName || buyerTaxNo,
          tax_number: buyerTaxNo,
        }
        const createRes = await window.electronAPI.customer.create(payload)
        if (!createRes.success) {
          throw new Error(createRes.error || `新增甲方单位失败：${buyerName || buyerTaxNo}`)
        }
        customers.push(createRes.data as Customer)
        customerCreatedKeys.add(createKey)
        createdCustomerCount += 1
      }
    }

    const sellerName = normalizeDisplay(data.sellerName)
    const sellerTaxNo = normalizeDisplay(data.sellerTaxNo)
    if (action.createSupplier && (sellerName || sellerTaxNo)) {
      const createKey = `${normalizeName(sellerName)}||${normalizeTaxNo(sellerTaxNo)}`
      if (!supplierCreatedKeys.has(createKey) && !hasSupplierMatch(suppliers, sellerName, sellerTaxNo)) {
        const payload: SupplierCreateDTO = {
          code: IdGenerator.generateCode('SUP'),
          name: sellerName || sellerTaxNo,
          tax_number: sellerTaxNo,
        }
        const createRes = await window.electronAPI.supplier.create(payload)
        if (!createRes.success) {
          throw new Error(createRes.error || `新增乙方单位失败：${sellerName || sellerTaxNo}`)
        }
        suppliers.push(createRes.data as Supplier)
        supplierCreatedKeys.add(createKey)
        createdSupplierCount += 1
      }
    }
  }

  return { createdCustomerCount, createdSupplierCount }
}

const confirmImportInvoices = async (
  payload:
    | ImportTaskInvoiceCandidate[]
    | {
        candidates: ImportTaskInvoiceCandidate[]
        partyActions?: Array<{ candidateKey: string; createCustomer: boolean; createSupplier: boolean }>
      }
) => {
  const editedCandidates = Array.isArray(payload) ? payload : payload?.candidates || []
  const candidates = Array.isArray(editedCandidates) && editedCandidates.length
    ? editedCandidates
    : pendingInvoiceCandidates.value
  if (!candidates.length || invoiceImportSubmitting.value) {
    invoiceImportDialogVisible.value = false
    return
  }
  const actionMap: Record<string, { createCustomer?: boolean; createSupplier?: boolean }> = {}
  if (!Array.isArray(payload) && Array.isArray(payload.partyActions)) {
    for (const item of payload.partyActions) {
      actionMap[String(item.candidateKey || '')] = {
        createCustomer: Boolean(item.createCustomer),
        createSupplier: Boolean(item.createSupplier),
      }
    }
  }
  invoiceImportSubmitting.value = true
  let successCount = 0
  const failed: string[] = []
  void invoiceImportLogger.info('开始确认导入发票', {
    candidateCount: candidates.length,
    candidates: candidates.map(toInvoiceLogPayload),
  })
  try {
    try {
      const { createdCustomerCount, createdSupplierCount } = await saveMissingParties(candidates, actionMap)
      if (createdCustomerCount > 0 || createdSupplierCount > 0) {
        toast.add({
          severity: 'success',
          summary: '单位信息已补录',
          detail: `新增甲方 ${createdCustomerCount} 条，乙方 ${createdSupplierCount} 条`,
          life: 2600,
        })
      }
    } catch (error: any) {
      toast.add({
        severity: 'warn',
        summary: '单位信息补录失败',
        detail: error?.message || '将继续导入发票',
        life: 3600,
      })
    }

    for (const candidate of candidates) {
      try {
        const dto = toCreateInvoiceDto(candidate)
        const existingId = await findExistingInvoiceId(candidate)
        if (existingId) {
          const updatePayload: ContractInvoiceUpdateDTO = {
            id: existingId,
            ...dto,
          }
          const res = await window.electronAPI.contractInvoice.update(updatePayload)
          if (!res.success) {
            throw new Error(res.error || '更新发票失败')
          }
        } else {
          const res = await window.electronAPI.contractInvoice.create(dto)
          if (!res.success) {
            throw new Error(res.error || '创建发票失败')
          }
        }
        successCount += 1
      } catch (error: any) {
        void invoiceImportLogger.error('导入单条发票失败', {
          candidate: toInvoiceLogPayload(candidate),
          error: error?.message || '导入失败',
        })
        failed.push(`${candidate.sourcePath || '未知文件'}: ${error?.message || '导入失败'}`)
      }
    }

    if (successCount > 0) {
      toast.add({
        severity: 'success',
        summary: '发票导入成功',
        detail: `已写入 ${successCount} 条发票记录`,
        life: 2400,
      })
    }
    if (failed.length > 0) {
      toast.add({
        severity: 'warn',
        summary: '部分发票导入失败',
        detail: failed[0],
        life: 4200,
      })
    }
    void invoiceImportLogger.info('发票确认导入结束', {
      total: candidates.length,
      successCount,
      failedCount: failed.length,
      failedSamples: failed.slice(0, 5),
    })
    invoiceImportDialogVisible.value = false
    pendingInvoiceCandidates.value = []
  } finally {
    invoiceImportSubmitting.value = false
  }
}

const cancelImportInvoices = () => {
  if (!pendingInvoiceCandidates.value.length) return
  void invoiceImportLogger.warn('用户取消发票导入', {
    candidateCount: pendingInvoiceCandidates.value.length,
    candidates: pendingInvoiceCandidates.value.map(toInvoiceLogPayload),
  })
  toast.add({
    severity: 'info',
    summary: '已取消入库',
    detail: `跳过 ${pendingInvoiceCandidates.value.length} 条发票记录`,
    life: 2200,
  })
  pendingInvoiceCandidates.value = []
}

watch(viewMode, (m) => {
  localStorage.setItem('contract_files_view_mode', m)
  if ((m === 'list' || m === 'waterfall') && rootDir.value && !currentListDir.value) {
    currentListDir.value = rootDir.value
  }
  if (m === 'tree' && rootDir.value) {
    const rootKey = treeRootKey.value
    treeAllSelected.value = false
    treeExcludedKeys.value = new Set()
    treeIncludedKeys.value = new Set([rootKey])
    treeSelectionAnchorKey.value = rootKey
    if (!treeExpandedKeys.value || Object.keys(treeExpandedKeys.value).length === 0) {
      treeExpandedKeys.value = { [rootKey]: true }
    } else if (!treeExpandedKeys.value[rootKey]) {
      treeExpandedKeys.value = { ...treeExpandedKeys.value, [rootKey]: true }
    }
  }
  scheduleThumbnailEnqueue()
})

watch(
  () => contractId.value,
  () => {
    void loadContract()
  }
)

const onTreeNodeClick = (event: MouseEvent, node: any) => {
  selection.onTreeNodeClick({ originalEvent: event, node })
}

const onTreeNodeDblclick = async (node: any) => {
  const type = String(node?.data?.type || '')
  if (type !== 'file') return
  const record =
    (node?.data?.record as ContractFileRecord | null) ||
    recordByPath.value.get(String(node?.key || '')) ||
    recordByPath.value.get(String(node?.data?.path || '')) ||
    null
  if (record) {
    await previewRecord(record)
    return
  }
  const path = String(node?.data?.path || '')
  if (!path) return
  await router.push({
    name: 'ContractFilesPreview',
    params: { contractId: contractId.value },
    query: {
      path,
      name: String(node?.data?.name || node?.data?.label || ''),
      fileId: String(node?.data?.fileId || ''),
    },
  })
}

const onWaterfallClick = (event: MouseEvent, record: ContractFileRecord) => {
  selection.onWaterfallClick({ event, item: record })
}

const onWaterfallContextMenu = (event: MouseEvent, record: ContractFileRecord) => {
  actions.onWaterfallContextMenu({ event, item: record })
}

onMounted(() => {
  window.addEventListener('keydown', onGlobalKeydownCapture, true)
  importTaskStore.ensureSubscribed()
  if (importContextKey.value) {
    void importTaskStore.syncStatus(importContextKey.value)
  }
  offThumbnailUpdatedListener = eventBus.on('contract-files:thumbnails-updated', (payload: any) => {
    const updates = Array.isArray(payload) ? payload : [payload]
    if (!updates.length) return
    const lp = String(libraryPath.value || '')
    const indexMap = itemIndexById.value
    for (const raw of updates) {
      const p = raw as { libraryPath?: string; fileId?: string; firstPageThumb?: string | null; previewStatus?: string | null }
      const fileId = String(p?.fileId || '')
      if (!fileId) continue
      if (String(p.libraryPath || '') !== lp) continue
      const idx = indexMap.get(fileId)
      if (idx === undefined) continue
      const target = items.value[idx]
      if (!target) continue
      target.firstPageThumb = p.firstPageThumb ?? null
      target.previewStatus = p.previewStatus ?? null
    }
  })
  void loadContract()
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onGlobalKeydownCapture, true)
  if (thumbnailEnqueueTimer) window.clearTimeout(thumbnailEnqueueTimer)
  thumbnailEnqueueTimer = null
  if (viewSwitchTimer) window.clearTimeout(viewSwitchTimer)
  viewSwitchTimer = null
  offThumbnailUpdatedListener?.()
  offThumbnailUpdatedListener = null
})
</script>

<style scoped>
:deep(.custom-datatable .p-datatable-tbody > tr.p-highlight > td),
:deep(.custom-datatable .p-datatable-tbody > tr.contract-file-tree-row-selected > td) {
  background: color-mix(in srgb, var(--btn-primary-bg) 16%, var(--content-bg)) !important;
  color: var(--content-text) !important;
}

:deep(.custom-datatable .p-datatable-tbody > tr.p-highlight:hover > td),
:deep(.custom-datatable .p-datatable-tbody > tr.contract-file-tree-row-selected:hover > td) {
  background: color-mix(in srgb, var(--btn-primary-bg) 20%, var(--content-bg)) !important;
}

:deep(.custom-datatable .p-datatable-tbody > tr.p-highlight > td:first-child),
:deep(.custom-datatable .p-datatable-tbody > tr.contract-file-tree-row-selected > td:first-child) {
  box-shadow: inset 3px 0 0 var(--sidebar-active-border);
}
</style>
