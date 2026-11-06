<template>
  <div
    class="resource-view h-full relative transition-colors duration-200"
    :style="{ backgroundColor: 'var(--content-bg)' }"
    @dragenter.prevent="handleDragEnter"
    @dragover.prevent="handleDragOver"
    @dragleave.prevent="handleDragLeave"
    @drop.prevent="handleDrop"
    :class="{ 'drag-active': isDragActive && isResourceView }"
  >
    <!-- 拖拽激活覆盖层（仅在资源视图显示） -->
    <div
      v-if="isDragActive && isResourceView"
      class="drag-overlay absolute inset-0 z-50 flex items-center justify-center pointer-events-none transition-colors duration-200"
      :style="{ backgroundColor: 'rgba(13, 110, 253, 0.1)' }"
    >
      <div class="text-center">
        <div class="text-6xl mb-4">📁</div>
        <p class="text-xl font-semibold" :style="{ color: 'var(--btn-primary-bg)' }">
          拖拽文件或文件夹到此处上传
        </p>
        <p class="text-sm mt-2 opacity-70" :style="{ color: 'var(--btn-primary-bg)' }">
          支持批量拖入，大文件自动断点续传
        </p>
      </div>
    </div>

    <!-- 文件拷贝进度对话框 -->
    <FileCopyDialog
      v-model="showCopyDialog"
      :files="filesToCopy"
      :dest-dir="copyDestDir || projectPath"
      @completed="onCopyCompleted"
      @cancelled="onCopyCancelled"
      @failed="onCopyFailed"
    />

    <Dialog
      v-model:visible="exportSuccessDialogVisible"
      modal
      header="导出成功"
      :style="{ width: '30rem' }"
    >
      <div class="space-y-3">
        <p class="m-0 text-sm text-[var(--content-text)]">
          Excel 已导出成功，是否立即打开或复制该文件？
        </p>
        <div
          class="rounded-lg border border-[var(--content-border)] bg-[var(--content-card-bg)] px-3 py-2 text-xs break-all"
          :style="{ color: 'var(--content-text-secondary)' }"
        >
          {{ exportedExcelFilePath }}
        </div>
      </div>
      <template #footer>
        <div class="flex justify-end gap-2">
          <Button label="取消" text @click="closeExportSuccessDialog" />
          <Button label="复制" severity="secondary" @click="copyExportedExcelFile" />
          <Button label="打开" @click="openExportedExcelFile" />
        </div>
      </template>
    </Dialog>

    <!-- 根据当前分类动态切换视图 -->
    <template v-if="currentView === 'calendar'">
      <CalendarView />
    </template>

    <template v-else-if="currentView === 'templates'">
      <TemplatesView />
    </template>


    <template v-else-if="currentView === 'suppliers'">
      <SupplierManagementView />
    </template>

    <template v-else-if="currentView === 'customers'">
      <CustomerManagementView />
    </template>

    <template v-else-if="currentView === 'department-personnel'">
      <DepartmentPersonnelManagementView />
    </template>

    <template v-else-if="currentView === 'contract-products'">
      <ContractProductManagementView />
    </template>

    <template v-else-if="currentView === 'contract-executions'">
      <ContractExecutionManagementView />
    </template>

    <template v-else-if="currentView === 'receipt-plans'">
      <ReceiptPlanManagementView />
    </template>

    <template v-else-if="currentView === 'contract-invoices'">
      <ContractInvoiceManagementView />
    </template>

    <template v-else-if="currentView === 'contract-config'">
      <ContractConfigView />
    </template>

    <template v-else-if="currentView === 'project-management'">
      <ProjectManagementView />
    </template>

    <template v-else-if="currentView === 'dictionaries'">
      <DictionarySettingsView />
    </template>

    <template v-else-if="currentView === 'tree-dictionaries'">
      <TreeDictionarySettingsView />
    </template>

    <!-- 默认资源网格视图 -->
    <template v-else>
      <ContractContent
        :title="currentTitle"
        :library-path="currentLibraryPath"
        :zoom-level="zoomLevel"
        :has-cloud-notification="hasCloudNotification"
        v-model:search-query="localSearchQuery"
        v-model:search-fields="localSearchFields"
        v-model:filters="localFilters"
        :resources="resources"
        :summary-stats="contractSummaryStats"
        :view-mode="viewMode"
        @update:viewMode="viewMode = $event"
        :total-records="pagination.total"
        :page="pagination.page"
        :page-size="pagination.pageSize"
        @page-change="handlePageChange"
        :selected-resource-id="selectedResourceId"
        :loading="isLoadingResources"
        :load-error="resourceLoadError"
        :is-drag-active="isDragActive"
        :is-uploading="isUploading"
        :upload-progress="uploadProgress"
        :batch-import-active="batchImportActive"
        :has-batch-import-result="hasBatchImportResult"
        @create-contract="handleCreateContract"
        @batch-import-contracts="handleBatchImportContracts"
        @export-excel="handleExportContractsToExcel"
        @view-batch-import-progress="handleViewBatchImportProgress"
        @navigate-back="handleNavigateBack"
        @navigate-forward="handleNavigateForward"
        @zoom-out="handleZoomOut"
        @zoom-in="handleZoomIn"
        @cloud-sync="handleCloudSync"
        @quick-action="handleQuickAction"
        @filter="handleFilter"
        @select="selectResource"
        @open="openResource"
        @view-details="openContractDetailDrawer"
        @move-resource="handleMoveResource"
        @edit-resource="handleEditResource"
        @delete-resource="handleDeleteResource"
        @batch-delete="handleBatchDeleteResources"
        @retry="handleRetryLoadResources"
        @cancel-upload="cancelUpload"
      />

      <ContractDetailDrawer
        v-model:visible="contractDetailDrawerVisible"
        :library-path="currentLibraryPath"
        :contract-id="contractDetailDrawerContractId"
        :resource="contractDetailDrawerResource"
        :refresh-token="props.refreshToken"
        :has-previous="contractDetailHasPrevious"
        :has-next="contractDetailHasNext"
        @navigate-previous="navigateContractDetail('previous')"
        @navigate-next="navigateContractDetail('next')"
        @edit="handleEditContractDetail"
      />
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useToast } from 'primevue/usetoast'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import ContractContent from './components/ContractContent.vue'
import CalendarView from '../CalendarView.vue'
import TemplatesView from '../TemplatesView.vue'
import SupplierManagementView from '../supplier/SupplierManagementView.vue'
import CustomerManagementView from '../customer/CustomerManagementView.vue'
import DepartmentPersonnelManagementView from '../department-personnel/DepartmentPersonnelManagementView.vue'
import ContractProductManagementView from '../contract-product/ContractProductManagementView.vue'
import ContractExecutionManagementView from '../contract-execution/ContractExecutionManagementView.vue'
import ReceiptPlanManagementView from '../receipt-plan/ReceiptPlanManagementView.vue'
import ContractInvoiceManagementView from '../contract-invoice/ContractInvoiceManagementView.vue'
import ContractConfigView from '../contract-config/ContractConfigView.vue'
import ProjectManagementView from '../project-management/ProjectManagementView.vue'
import DictionarySettingsView from '../dictionary/DictionarySettingsView.vue'
import TreeDictionarySettingsView from '../tree-dictionary/TreeDictionarySettingsView.vue'
import FileCopyDialog from '../../../components/FileCopyDialog.vue'
import ContractDetailDrawer from './components/ContractDetailDrawer.vue'
import { createRendererLogger } from '@/utils/logger'
import { useThumbnailQueueStore } from '../../../stores/file/thumbnailQueueStore'
import { exportToExcel, type ExcelColumn } from '../../../utils/excelExport'

const logger = createRendererLogger('ResourceView')
import type { FileCopyItem } from '../../../composables/useFileCopy'
import { collectDroppedFiles } from '../../../utils/dragDrop'
import type { ContractResource } from './types/contractResource'
import type { ContractInfoEntity, ContractInfoQueryFilters, ContractInfoSummaryStatsResult } from '../../../../shared/types/contractInfo.types'

/**
 * 资源视图组件
 * 根据当前选中的分类动态切换显示不同的视图
 * - 日历视图 (calendar)
 * - 模板管理 (templates)
 * - 资源网格 (默认)
 */

// Props 定义
interface Props {
  /** 搜索关键词 */
  searchQuery?: string
  /** 当前选中的分类 */
  selectedCategory?: string
  /** 当前选中的文件夹ID */
  selectedFolderId?: number | null
  /** 列表刷新令牌 */
  refreshToken?: number
  batchImportActive?: boolean
  hasBatchImportResult?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  searchQuery: '',
  selectedCategory: 'all',
  selectedFolderId: null,
  refreshToken: 0,
  batchImportActive: false,
  hasBatchImportResult: false,
})

// Emits 定义
const emit = defineEmits<{
  (e: 'search', value: string): void
  (e: 'select-category', key: string): void
  (e: 'select-resource', resource: any): void
  (e: 'create-contract'): void
  (e: 'batch-import-contracts'): void
  (e: 'view-batch-import-progress'): void
  (e: 'open-resource', payload: { libraryPath: string; resource: ContractResource }): void
  (e: 'move-resource', payload: { libraryPath: string; resource: ContractResource; direction: 'top' | 'up' | 'down' | 'bottom' }): void
  (e: 'edit-resource', payload: { libraryPath: string; resource: ContractResource }): void
  (e: 'delete-resource', payload: { libraryPath: string; resource: ContractResource }): void
  (e: 'batch-delete-resources', payload: { libraryPath: string; resources: ContractResource[] }): void
}>()

// ─── 响应式状态 ─────────────────────────────────────────────────

/** 当前选中的资源ID */
const selectedResourceId = ref<number | string | null>(null)
const selectedResource = ref<ContractResource | null>(null)

/** 视图模式：grid | list */
type ContractViewMode = 'grid' | 'list'

const normalizeViewMode = (value: unknown): ContractViewMode => {
  if (value === 'list' || value === 'grid') return value
  return 'grid'
}

const viewMode = ref<ContractViewMode>(normalizeViewMode(localStorage.getItem('contract_view_mode')))

watch(viewMode, (newMode) => {
  localStorage.setItem('contract_view_mode', newMode)
})

/** 缩放级别 */
const zoomLevel = ref(60)

/** 本地搜索关键词 */
const localSearchQuery = ref('')
const localSearchFields = ref<string[]>(['all'])
const localFilters = ref<ContractInfoQueryFilters>({})
const fullTextResults = ref<Array<{ file_path: string; snippet: string }>>([])
const isSearchingFullText = ref(false)

/** 合同状态字典标签映射表（code/value/name -> display name） */
const contractStatusLabelMap = ref<Record<string, string>>({})
let contractStatusDictLoaded = false

/**
 * 构建字典值到显示标签的映射表
 * 与 useContractDetailDrawer.ts 中的 buildValueLabelMap 逻辑一致
 */
const buildValueLabelMap = (items: Array<{ name: string; value?: string | null; code?: string }>) => {
  const map: Record<string, string> = {}
  for (const item of items || []) {
    const label = String((item as any)?.name || '').trim()
    const rawValue = String((item as any)?.value ?? '').trim()
    const value = rawValue || label
    if (!label || !value) continue
    map[value] = label
    map[label] = label
    const code = String((item as any)?.code ?? '').trim()
    if (code) map[code] = label
  }
  return map
}

/** 加载"合同状态"字典并构建标签映射（仅加载一次，缓存结果） */
const loadContractStatusDictionary = async () => {
  if (contractStatusDictLoaded) return
  try {
    const res = await window.electronAPI.dictionary.getList({ group_name: '合同状态', page: 1, pageSize: 5000 })
    if (res.success && (res.data as any)?.data) {
      contractStatusLabelMap.value = buildValueLabelMap((res.data as any).data as any[])
      contractStatusDictLoaded = true
    }
  } catch (error) {
    logger.error('加载合同状态字典失败:', error)
  }
}

/** 根据字典映射解析合同状态的显示文本 */
const resolveContractStatusDisplay = (rawStatus?: string): string => {
  if (!rawStatus) return '-'
  const trimmed = rawStatus.trim()
  if (!trimmed) return '-'
  const map = contractStatusLabelMap.value
  // 先尝试通过原始值查找映射表
  if (map[trimmed]) return map[trimmed]
  // 如果映射表中没有，直接返回原始值（可能用户手动输入了不在字典中的值）
  return trimmed
}

watch(
  () => props.searchQuery,
  (v) => {
    const q = String(v || '').trim()
    if (q && q !== localSearchQuery.value) {
      localSearchQuery.value = q
    }
  },
  { immediate: true }
)

const normalizeSearchFieldsForIpc = (value: unknown): string[] => {
  const fields = Array.isArray(value) ? value.map((v) => String(v || '').trim()).filter(Boolean) : []
  if (!fields.length) return ['all']
  if (fields.includes('all')) return ['all']
  return fields
}

/** 云同步通知状态 */
const hasCloudNotification = ref(true)

/** 拖拽激活状态 */
const isDragActive = ref(false)

/** 上传状态 */
const isUploading = ref(false)

/** 上传进度 */
const uploadProgress = ref({
  current: 0,
  total: 0,
  transferred: 0,
  totalSize: 0,
  percentage: 0,
  speed: '0 KB',
  eta: '0 秒'
})

/** 拖拽计数器 */
const dragCounter = ref(0)

/** 已上传文件列表 */
const uploadedFiles = ref<{ name: string; path: string; size: number }[]>([])

/** 项目路径 */
const projectPath = ref('')
const currentLibraryPath = ref('')
const copyDestDir = ref('')

/** 文件拷贝对话框显示状态 */
const showCopyDialog = ref(false)

const thumbnailQueueStore = useThumbnailQueueStore()
const toast = useToast()

/** 待拷贝文件列表 */
const filesToCopy = ref<FileCopyItem[]>([])
const exportingContracts = ref(false)
const exportSuccessDialogVisible = ref(false)
const exportedExcelFilePath = ref('')

// ─── 计算属性 ───────────────────────────────────────────────────

/** 当前视图类型 */
const currentView = computed(() => {
  switch (props.selectedCategory) {
    case 'calendar':
      return 'calendar'
    case 'templates':
      return 'templates'
    case 'suppliers':
      return 'suppliers'
    case 'customers':
      return 'customers'
    case 'department-personnel':
      return 'department-personnel'
    case 'contract-products':
      return 'contract-products'
    case 'contract-executions':
      return 'contract-executions'
    case 'receipt-plans':
      return 'receipt-plans'
    case 'contract-invoices':
      return 'contract-invoices'
    case 'contract-config':
      return 'contract-config'
    case 'project-management':
      return 'project-management'
    case 'dictionaries':
      return 'dictionaries'
    case 'tree-dictionaries':
      return 'tree-dictionaries'
    default:
      return 'resource'
  }
})

/** 是否是资源视图 */
const isResourceView = computed(() => {
  return currentView.value === 'resource'
})

/** 快捷分类（用于显示标题） */
const quickCategories = ref<any[]>([])

/** 文件夹数据 */
const folders = [
  { id: 2, name: '园林', count: 19, children: [] },
  { id: 3, name: 'AI', count: 30, children: [] },
  { id: 4, name: '电商零售', count: 319, children: [] },
  { id: 5, name: '知识库', count: 15, children: [] }
]

/** 资源数据 */
const resources = ref<ContractResource[]>([])
const contractSummaryStats = ref<ContractInfoSummaryStatsResult>({
  totalContracts: 0,
  totalPartyAUnits: 0,
  totalPartyBUnits: 0,
  totalPendingReceipts: 0,
  totalReceivedReceipts: 0,
  totalFinishedContracts: 0,
})
const isLoadingResources = ref(false)
const resourceLoadError = ref<string | null>(null)

const pagination = ref({
  page: 1,
  pageSize: 20,
  total: 0,
})

/** 当前标题 */
const currentTitle = computed(() => {
  if (props.selectedFolderId) {
    const folder = findFolderById(props.selectedFolderId)
    if (folder) return folder.name
  }
  const category = quickCategories.value.find(c => c.key === props.selectedCategory)
  return category ? category.name : '全部'
})

// ─── 方法 ───────────────────────────────────────────────────────

/**
 * 加载快捷分类配置
 */
const loadQuickCategories = async () => {
  try {
    const res = await window.electronAPI.config.getItem('quickCategories')
    if (res.success && res.data) {
      quickCategories.value = res.data.filter((c: any) => c && c.key !== 'recent')
    }
  } catch (error) {
    logger.error('加载快捷分类失败:', error)
  }
}

let cleanupConfigListener: (() => void) | null = null

/**
 * 获取项目路径
 */
const loadProjectPath = async () => {
  try {
    const status = await window.electronAPI.bootstrap.getInitStatus()
    if (status.initialized && status.projectPath) {
      projectPath.value = status.projectPath
    }
  } catch (error) {
    logger.error('获取项目路径失败:', error)
  }
}

const mapContractInfoToResource = (contract: ContractInfoEntity): ContractResource => ({
  id: contract.id,
  name: contract.contract_name,
  type: 'contract-info',
  size: contract.contract_code || '-',
  date: contract.signing_date || contract.updated_at || contract.created_at || '',
  path: `/${contract.client_name || '未命名甲方'}/${contract.contract_name}`,
  thumbnail: '',
  tags: [],
  description: contract.contract_summary || '',
  projectIcon: contract.project_icon,
  projectColor: contract.project_color,
  folderName: contract.folder_name,
  trashPath: contract.trash_path ?? null,
  deletedAt: contract.deleted_at ?? null,
  version: contract.contract_code,
  completionDate: contract.signing_date,
  softwareCategory: contract.contract_type,
  copyrightOwner: contract.client_name,
  partyBName: contract.party_b_name,
  technicalFeatures: contract.contract_summary,
  contractCode: contract.contract_code,
  contractName: contract.contract_name,
  contractType: contract.contract_type,
  clientName: contract.client_name,
  endDate: contract.end_date || undefined,
  signingDate: contract.signing_date,
  contractSummary: contract.contract_summary,
  contractAmount: contract.contract_amount,
  currency: contract.currency,
  contractStatus: contract.contract_status,
  createdAt: contract.created_at,
  updatedAt: contract.updated_at,
})

const loadContractInfos = async (libraryPath?: string) => {
  const targetLibraryPath = libraryPath || currentLibraryPath.value || localStorage.getItem('currentLibraryPath') || ''
  isLoadingResources.value = true
  resourceLoadError.value = null
  if (!targetLibraryPath) {
    resources.value = []
    contractSummaryStats.value = {
      totalContracts: 0,
      totalPartyAUnits: 0,
      totalPartyBUnits: 0,
      totalPendingReceipts: 0,
      totalReceivedReceipts: 0,
      totalFinishedContracts: 0,
    }
    pagination.value.total = 0
    isLoadingResources.value = false
    return
  }
  currentLibraryPath.value = targetLibraryPath
  void loadContractSummaryStats(targetLibraryPath)

  // 全文本搜索
  if (localSearchFields.value.includes('full_text') && localSearchQuery.value.trim()) {
    try {
      isSearchingFullText.value = true
      const results = await window.electronAPI.search.fullText(localSearchQuery.value)
      fullTextResults.value = results

      // 映射全文本结果为资源对象，以便在列表中展示
      const ftsResources: ContractResource[] = results.map((res, index) => ({
        id: `fts-${index}`,
        name: res.file_path.split(/[/\\]/).pop() || res.file_path,
        type: 'file',
        size: '-',
        date: '-',
        path: res.file_path,
        thumbnail: '',
        tags: [],
        description: res.snippet, // 将片段存入描述字段
        fullPath: res.file_path,
      }))

      resources.value = ftsResources
      pagination.value.total = ftsResources.length
      isLoadingResources.value = false
      return
    } catch (error) {
      logger.error('全文本搜索失败:', error)
      resourceLoadError.value = '全文本搜索失败'
    } finally {
      isSearchingFullText.value = false
    }
  } else {
    fullTextResults.value = []
  }

  try {
    const result = await window.electronAPI.library.queryContractInfos({
      libraryPath: targetLibraryPath,
      page: pagination.value.page,
      pageSize: pagination.value.pageSize,
      searchQuery: localSearchQuery.value,
      searchFields: normalizeSearchFieldsForIpc(localSearchFields.value) as any,
      filters: JSON.parse(JSON.stringify(localFilters.value || {})),
    })
    if (result.success && result.data) {
      const realResources = result.data.items.map(mapContractInfoToResource)
      // 通过字典解析合同状态显示文本
      await loadContractStatusDictionary()
      for (const r of realResources) {
        r.contractStatusDisplay = resolveContractStatusDisplay(r.contractStatus)
      }
      resources.value = realResources
      pagination.value.total = result.data.total
      if (!resources.value.some(item => item.id === selectedResourceId.value)) {
        selectedResourceId.value = null
      }
      return
    }
    resources.value = []
    pagination.value.total = 0
    resourceLoadError.value = result.error || '合同信息加载失败，请稍后重试'
  } catch (error) {
    logger.error('加载合同信息列表失败:', error)
    resources.value = []
    pagination.value.total = 0
    resourceLoadError.value = error instanceof Error ? error.message : '合同信息加载失败，请稍后重试'
  } finally {
    isLoadingResources.value = false
  }
}

const normalizeStatsSearchFields = (value: unknown): Array<'all' | 'contract_name' | 'contract_code' | 'client_name' | 'party_b_name' | 'contract_type'> => {
  const valid = new Set(['contract_name', 'contract_code', 'client_name', 'party_b_name', 'contract_type'])
  const fields = Array.isArray(value) ? value.map((v) => String(v || '').trim()).filter(Boolean) : []
  if (!fields.length || fields.includes('all') || fields.includes('full_text')) return ['all']
  const normalized = fields.filter((f) => valid.has(f)) as Array<'contract_name' | 'contract_code' | 'client_name' | 'party_b_name' | 'contract_type'>
  return normalized.length ? normalized : ['all']
}

const loadContractSummaryStats = async (libraryPath?: string) => {
  const targetLibraryPath = libraryPath || currentLibraryPath.value || localStorage.getItem('currentLibraryPath') || ''
  if (!targetLibraryPath) return
  try {
    const result = await window.electronAPI.library.getContractSummaryStats({
      libraryPath: targetLibraryPath,
      searchQuery: localSearchQuery.value,
      searchFields: normalizeStatsSearchFields(localSearchFields.value),
      filters: JSON.parse(JSON.stringify(localFilters.value || {})),
    })
    if (result.success && result.data) {
      contractSummaryStats.value = result.data
    }
  } catch (error) {
    logger.error('加载合同统计失败:', error)
  }
}

// 组件挂载时加载项目路径
onMounted(() => {
  loadProjectPath()
  loadQuickCategories()
  loadContractInfos()

  // 监听配置变化
  cleanupConfigListener = window.electronAPI.config.onChanged((config) => {
    if (config && config.quickCategories) {
      quickCategories.value = config.quickCategories
    }
  })
})

onUnmounted(() => {
  if (cleanupConfigListener) {
    cleanupConfigListener()
  }
})

watch(
  () => props.refreshToken,
  () => {
    if (props.refreshToken && props.refreshToken > 0) {
      loadContractInfos(currentLibraryPath.value)
    }
  }
)

let searchDebounceTimer: number | null = null
watch([localSearchQuery, localSearchFields, localFilters], () => {
  pagination.value.page = 1
  if (searchDebounceTimer) {
    window.clearTimeout(searchDebounceTimer)
  }
  searchDebounceTimer = window.setTimeout(() => {
    loadContractInfos(currentLibraryPath.value)
  }, 300)
}, { deep: true })

const handlePageChange = (payload: { page: number; pageSize: number }) => {
  pagination.value.page = payload.page
  pagination.value.pageSize = payload.pageSize
  loadContractInfos(currentLibraryPath.value)
}

/**
 * 根据ID查找文件夹
 */
const findFolderById = (id: number) => {
  for (const folder of folders) {
    if (folder.id === id) return folder
    if (folder.children) {
      const child = folder.children.find((c: any) => c.id === id)
      if (child) return child
    }
  }
  return null
}

/**
 * 选择资源
 */
const selectResource = (resource: ContractResource) => {
  selectedResourceId.value = resource.id
  selectedResource.value = resource
  emit('select-resource', resource)
}

const contractDetailDrawerVisible = ref(false)
const contractDetailDrawerContractId = ref<string | null>(null)
const contractDetailDrawerResource = ref<ContractResource | null>(null)
const contractDetailNavigationLoading = ref(false)

const totalPages = computed(() => {
  const total = Number(pagination.value.total || 0)
  const pageSize = Math.max(1, Number(pagination.value.pageSize || 1))
  return Math.max(1, Math.ceil(total / pageSize))
})

const getContractDetailCurrentIndex = () => {
  const currentId = String(contractDetailDrawerContractId.value || contractDetailDrawerResource.value?.id || '').trim()
  if (!currentId) return -1
  return resources.value.findIndex((item) => String(item.id || '').trim() === currentId)
}

const contractDetailHasPrevious = computed(() => {
  const currentIndex = getContractDetailCurrentIndex()
  if (currentIndex > 0) return true
  return pagination.value.page > 1
})

const contractDetailHasNext = computed(() => {
  const currentIndex = getContractDetailCurrentIndex()
  if (currentIndex >= 0 && currentIndex < resources.value.length - 1) return true
  return pagination.value.page < totalPages.value
})

watch(contractDetailDrawerVisible, (v) => {
  if (v) return
  contractDetailDrawerContractId.value = null
  contractDetailDrawerResource.value = null
})

/**
 * 打开资源
 */
const openResource = (resource: ContractResource) => {
  selectedResourceId.value = resource.id
  selectedResource.value = resource
  emit('select-resource', resource)
  emit('open-resource', { libraryPath: currentLibraryPath.value || '', resource })
  console.log('openResource', resource)
}

const openContractDetailDrawer = (resource: ContractResource) => {
  selectResource(resource)
  contractDetailDrawerContractId.value = String(resource.id)
  contractDetailDrawerResource.value = resource
  contractDetailDrawerVisible.value = true
}

const setContractDetailResource = (resource: ContractResource) => {
  selectResource(resource)
  contractDetailDrawerContractId.value = String(resource.id)
  contractDetailDrawerResource.value = resource
  contractDetailDrawerVisible.value = true
}

const handleEditContractDetail = () => {
  const resource = contractDetailDrawerResource.value
  if (!resource) {
    toast.add({ severity: 'warn', summary: '提示', detail: '未找到当前合同，无法编辑', life: 2500 })
    return
  }
  handleEditResource(resource)
}

const navigateContractDetail = async (direction: 'previous' | 'next') => {
  if (contractDetailNavigationLoading.value) return
  const currentIndex = getContractDetailCurrentIndex()
  if (currentIndex < 0) {
    toast.add({ severity: 'warn', summary: '提示', detail: '当前合同不在列表中，无法切换', life: 2500 })
    return
  }

  const step = direction === 'previous' ? -1 : 1
  const targetIndex = currentIndex + step
  if (targetIndex >= 0 && targetIndex < resources.value.length) {
    setContractDetailResource(resources.value[targetIndex])
    return
  }

  const targetPage = pagination.value.page + step
  if (targetPage < 1 || targetPage > totalPages.value) {
    toast.add({
      severity: 'info',
      summary: '提示',
      detail: direction === 'previous' ? '没有上一个合同了' : '没有下一个合同了',
      life: 2000,
    })
    return
  }

  contractDetailNavigationLoading.value = true
  try {
    pagination.value.page = targetPage
    await loadContractInfos(currentLibraryPath.value)
    if (!resources.value.length) {
      toast.add({ severity: 'warn', summary: '提示', detail: '目标页没有可切换的合同', life: 2500 })
      return
    }
    const targetResource = direction === 'previous' ? resources.value[resources.value.length - 1] : resources.value[0]
    if (!targetResource) {
      toast.add({ severity: 'warn', summary: '提示', detail: '未找到可切换的合同', life: 2500 })
      return
    }
    setContractDetailResource(targetResource)
  } finally {
    contractDetailNavigationLoading.value = false
  }
}

const handleMoveResource = (payload: { resource: ContractResource; direction: 'top' | 'up' | 'down' | 'bottom' }) => {
  selectResource(payload.resource)
  emit('move-resource', { libraryPath: currentLibraryPath.value || '', resource: payload.resource, direction: payload.direction })
}

const handleEditResource = (resource: ContractResource) => {
  selectResource(resource)
  emit('edit-resource', { libraryPath: currentLibraryPath.value || '', resource })
}

const handleDeleteResource = (resource: ContractResource) => {
  selectResource(resource)
  emit('delete-resource', { libraryPath: currentLibraryPath.value || '', resource })
}

const handleBatchDeleteResources = (resources: ContractResource[]) => {
  if (!resources.length) return
  emit('batch-delete-resources', { libraryPath: currentLibraryPath.value || '', resources })
}

/**
 * 取消上传
 */
const cancelUpload = () => {
  isUploading.value = false
  uploadProgress.value = {
    current: 0,
    total: 0,
    transferred: 0,
    totalSize: 0,
    percentage: 0,
    speed: '0 KB',
    eta: '0 秒'
  }
}

// ─── 拖拽上传处理 ───────────────────────────────────────────────

const handleDragEnter = (e: DragEvent) => {
  if (!isResourceView.value) return
  e.preventDefault()
  dragCounter.value++
  if (e.dataTransfer?.items?.length > 0) {
    isDragActive.value = true
  }
}

const handleDragOver = (e: DragEvent) => {
  if (!isResourceView.value) return
  e.preventDefault()
  if (e.dataTransfer) {
    e.dataTransfer.dropEffect = 'copy'
  }
}

const handleDragLeave = (e: DragEvent) => {
  if (!isResourceView.value) return
  e.preventDefault()
  dragCounter.value--
  if (dragCounter.value === 0) {
    isDragActive.value = false
  }
}

const handleDrop = async (e: DragEvent) => {
  if (!isResourceView.value) return
  e.preventDefault()
  isDragActive.value = false
  dragCounter.value = 0

  if (!e.dataTransfer) return

  // 检查项目路径
  if (!projectPath.value) {
    alert('请先初始化或加载项目')
    return
  }

  const droppedEntries = await collectDroppedFiles(e.dataTransfer)
  const picked: FileCopyItem[] = []
  for (const { file, relativePath } of droppedEntries) {
    const filePath = window.electronAPI.fs.getFilePath(file)
    if (!filePath) continue
    picked.push({ src: filePath, name: file.name, relativePath })
  }
  if (picked.length === 0) return
  filesToCopy.value = picked

  const fallbackDocumentsDir = (() => {
    if (!selectedResource.value?.folderName) return ''
    if (!currentLibraryPath.value) return ''
    return `${currentLibraryPath.value}/${selectedResource.value.folderName}/documents`.replace(/\/+/g, '/')
  })()

  copyDestDir.value = fallbackDocumentsDir || projectPath.value

  // 显示拷贝对话框
  showCopyDialog.value = true
}

/**
 * 拷贝完成回调
 */
const onCopyCompleted = async (result: { success: FileCopyItem[]; failed: Array<{ file: FileCopyItem; error: string }> }) => {
  logger.info('拷贝完成:', result)
  filesToCopy.value = []
  const libraryPath = currentLibraryPath.value || localStorage.getItem('currentLibraryPath') || ''
  const contractId = String(selectedResource.value?.id || '').trim()
  const contractNo = String(selectedResource.value?.contractCode || '').trim()
  const destDir = String(copyDestDir.value || projectPath.value || '').trim()
  if (libraryPath && contractId && contractNo && destDir && result.success.length > 0) {
    const destPaths = result.success.map((file) => `${destDir}/${file.relativePath || file.name}`.replace(/\/+/g, '/'))
    await window.electronAPI.contractFiles.upsertFromPaths({
      libraryPath,
      contractId,
      contractNo,
      paths: destPaths,
    })

    // Fetch the updated file list and queue thumbnails
    const listRes = await window.electronAPI.contractFiles.getList({
      libraryPath,
      contractId
    })
    if (listRes.success && listRes.data) {
      thumbnailQueueStore.enqueue(libraryPath, listRes.data.items)
    }
  }
  await loadContractInfos(currentLibraryPath.value)
}

/**
 * 拷贝取消回调
 */
const onCopyCancelled = () => {
  logger.info('拷贝已取消')
  filesToCopy.value = []
}

/**
 * 拷贝失败回调
 */
const onCopyFailed = (error: string) => {
  logger.error('拷贝失败:', error)
  alert(`拷贝失败: ${error}`)
  filesToCopy.value = []
}

const handleRetryLoadResources = () => {
  loadContractInfos(currentLibraryPath.value)
}


// ─── 工具栏事件处理 ─────────────────────────────────────────────

const handleNavigateBack = () => {
  logger.info('返回')
}

const handleNavigateForward = () => {
  logger.info('前进')
}

const handleZoomOut = () => {
  zoomLevel.value = Math.max(20, zoomLevel.value - 20)
}

const handleZoomIn = () => {
  zoomLevel.value = Math.min(100, zoomLevel.value + 20)
}

const handleCloudSync = () => {
  logger.info('云同步')
  hasCloudNotification.value = false
}

const handleQuickAction = () => {
  logger.info('快捷操作')
}

const handleArchive = () => {
  logger.info('归档')
}

const handleFilter = () => {
  logger.info('筛选')
}

const handleCreateContract = () => {
  emit('create-contract')
}

const handleBatchImportContracts = () => {
  emit('batch-import-contracts')
}

const handleViewBatchImportProgress = () => {
  emit('view-batch-import-progress')
}

const closeExportSuccessDialog = () => {
  exportSuccessDialogVisible.value = false
  exportedExcelFilePath.value = ''
}

const openExportedExcelFile = async () => {
  const filePath = String(exportedExcelFilePath.value || '').trim()
  if (!filePath) {
    closeExportSuccessDialog()
    return
  }
  const result = await window.electronAPI.fs.openFile(filePath)
  if (!result.success) {
    toast.add({ severity: 'error', summary: '打开失败', detail: result.error || '无法打开导出的 Excel 文件', life: 3000 })
    return
  }
  closeExportSuccessDialog()
}

const copyExportedExcelFile = async () => {
  const filePath = String(exportedExcelFilePath.value || '').trim()
  if (!filePath) {
    closeExportSuccessDialog()
    return
  }
  const result = await window.electronAPI.fs.clipboardWriteFile(filePath)
  if (!result.success) {
    toast.add({ severity: 'error', summary: '复制失败', detail: result.error || '无法复制导出的 Excel 文件', life: 3000 })
    return
  }
  toast.add({ severity: 'success', summary: '复制成功', detail: 'Excel 文件已复制到剪贴板', life: 2500 })
  closeExportSuccessDialog()
}

const getDefaultContractExportFilename = () => {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `合同台账导出_${year}${month}${day}.xlsx`
}

const buildContractExportColumns = (): ExcelColumn[] => [
  { field: 'contract_code', header: '合同编号' },
  { field: 'contract_name', header: '合同名称' },
  { field: 'contract_type', header: '合同类型' },
  { field: 'client_name', header: '甲方' },
  { field: 'party_b_name', header: '乙方' },
  {
    field: 'contract_amount',
    header: '合同金额',
    format: (value: unknown) => {
      const amount = Number(value)
      if (!Number.isFinite(amount)) return ''
      return amount.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    },
  },
  { field: 'currency', header: '币种' },
  { field: 'signing_date', header: '签约日期' },
  { field: 'end_date', header: '截止日期' },
  { field: 'contract_status', header: '合同状态' },
  { field: 'department', header: '所属部门' },
  { field: 'responsible_person', header: '负责人' },
  { field: 'settlement_method', header: '结算方式' },
  { field: 'procurement_source', header: '采购来源' },
  { field: 'execution_method', header: '执行方式' },
  { field: 'folder_name', header: '文件夹' },
  { field: 'contract_summary', header: '合同摘要' },
  { field: 'remark', header: '备注' },
  { field: 'created_at', header: '创建时间' },
  { field: 'updated_at', header: '更新时间' },
]

const handleExportContractsToExcel = async () => {
  if (exportingContracts.value) return

  if (localSearchFields.value.includes('full_text') && localSearchQuery.value.trim()) {
    toast.add({ severity: 'warn', summary: '暂不支持', detail: '全文检索结果暂不支持导出合同 Excel，请切换为合同字段搜索后再导出', life: 3500 })
    return
  }

  const libraryPath = String(currentLibraryPath.value || localStorage.getItem('currentLibraryPath') || '').trim()
  if (!libraryPath) {
    toast.add({ severity: 'warn', summary: '提示', detail: '当前未加载资源库，无法导出', life: 2500 })
    return
  }

  if (!pagination.value.total) {
    toast.add({ severity: 'info', summary: '提示', detail: '当前没有可导出的合同数据', life: 2500 })
    return
  }

  exportingContracts.value = true
  try {
    const exportPageSize = 1000
    const totalPages = Math.max(1, Math.ceil(pagination.value.total / exportPageSize))
    const allContracts: ContractInfoEntity[] = []

    for (let page = 1; page <= totalPages; page += 1) {
      const result = await window.electronAPI.library.queryContractInfos({
        libraryPath,
        page,
        pageSize: exportPageSize,
        searchQuery: localSearchQuery.value,
        searchFields: normalizeSearchFieldsForIpc(localSearchFields.value) as any,
        filters: JSON.parse(JSON.stringify(localFilters.value || {})),
      })

      if (!result.success || !result.data) {
        throw new Error(result.error || `第 ${page} 页合同数据获取失败`)
      }

      allContracts.push(...result.data.items)
    }

    const exportResult = await exportToExcel(
      allContracts,
      buildContractExportColumns(),
      getDefaultContractExportFilename()
    )

    if (!exportResult.success || !exportResult.filePath) {
      return
    }

    exportedExcelFilePath.value = exportResult.filePath
    exportSuccessDialogVisible.value = true
  } catch (error) {
    logger.error('导出合同 Excel 失败:', error)
    toast.add({
      severity: 'error',
      summary: '导出失败',
      detail: error instanceof Error ? error.message : '导出合同 Excel 时发生异常',
      life: 3500,
    })
  } finally {
    exportingContracts.value = false
  }
}

</script>

<style scoped>
/* 拖拽激活状态 - 组件特定状态样式 */
.resource-view.drag-active {
  background-color: rgba(13, 110, 253, 0.05);
}
</style>
