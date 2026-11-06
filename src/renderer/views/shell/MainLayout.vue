<template>
  <div class="flex h-screen w-screen overflow-hidden">
    <!-- 左侧分类栏：固定宽度 240px -->
    <div
      class="left-sidebar relative flex flex-col flex-shrink-0 h-full transition-colors duration-200"
      :style="{
        width: sidebarStore.sidebarWidth + 'px',
        backgroundColor: 'var(--sidebar-bg)',
        borderRight: '1px solid var(--sidebar-divider)'
      }"
    >
      <ResourceSidebar
        :sidebarWidth="sidebarStore.sidebarWidth"
        :isSidebarCollapsed="sidebarStore.isSidebarCollapsed"
        :searchQuery="searchQuery"
        :selectedCategory="selectedCategory"
        :selectedFolderId="selectedFolderId"
        :expandedFolders="expandedFolders"
        :quickCategories="sidebarStore.quickCategories"
        :quickAccess="sidebarStore.quickAccess"
        :smartFolders="sidebarStore.smartFolders"
        :folders="sidebarStore.folderTree"
        @search="handleSearch"
        @select-category="selectCategory"
        @toggle-folder="toggleFolder"
        @select-folder="selectFolder"
        @create-contract="openCreateContractModal"
        @menu-action="handleMenuAction"
        @toggle-sidebar-collapse="sidebarStore.toggleSidebarCollapsed"
        @open-filter="openFilter"
      />
      <div
        class="sidebar-resizer"
        :class="{ 'is-resizing': isResizingSidebar }"
        @mousedown.prevent="startSidebarResize"
      />
    </div>

    <!-- 中间内容区：flex-1 自适应 -->
    <div
      class="main-content flex flex-col flex-1 h-full overflow-hidden transition-colors duration-200"
      :style="{ backgroundColor: 'var(--content-bg)' }"
    >
      <router-view v-slot="{ Component }">
        <component
          :is="Component"
          v-if="Component && route.meta.layoutContent === 'resource'"
          :search-query="searchQuery"
          :selected-category="selectedCategory"
          :selected-folder-id="selectedFolderId"
          :refresh-token="resourceRefreshToken"
          :batch-import-active="isBatchImportRunning"
          :has-batch-import-result="hasBatchImportSession"
          @search="handleSearch"
          @select-category="selectCategory"
          @select-resource="selectResource"
          @open-resource="openResourceDetail"
          @move-resource="moveResource"
          @edit-resource="editResourceWithPayload"
          @delete-resource="deleteResourceWithPayload"
          @batch-delete-resources="batchDeleteResourcesWithPayload"
          @create-contract="openCreateContractModal"
          @batch-import-contracts="openBatchImportDialog"
          @view-batch-import-progress="openBatchImportProgress"
        />
        <component :is="Component" v-else-if="Component" />
      </router-view>
    </div>

    <!-- 右侧属性面板：固定宽度 280px -->
    <div
      v-if="showPropertiesPanel"
      class="right-panel flex-shrink-0 h-full overflow-hidden transition-colors duration-200"
      :style="{
        width: '320px',
        backgroundColor: 'var(--sidebar-bg)',
        borderLeft: '1px solid var(--content-border)'
      }"
    >
      <PropertiesPanel
        :selectedResource="selectedResource"
        @close="closeProperties"
        @edit="editResource"
        @delete="deleteResource"
        @add-tag="addTag"
        @save-description="saveDescription"
      />
    </div>

    <CreateContractInfoModal
      v-model:visible="showCreateContractModal"
      :mode="contractModalMode"
      :initial="editingContract"
      @confirm="handleContractSubmit"
    />

    <Dialog
      v-model:visible="showBatchImportDialog"
      modal
      header="批量增加合同"
      :style="{ width: '860px', maxWidth: '92vw' }"
      :closable="!isBatchImportRunning"
      :draggable="true"
      class="theme-dialog"
    >
      <div class="flex flex-col gap-4">
        <div
          v-if="batchImportState.stage === 'idle'"
          class="rounded-xl border p-4"
          :style="{ borderColor: 'var(--content-border)', backgroundColor: 'var(--content-card-bg)' }"
        >
          <div class="flex items-start justify-between gap-3">
            <div>
              <div class="text-base font-semibold text-[var(--content-text)]">批量扫描文件夹并逐条入库</div>
              <div class="mt-1 text-sm text-[var(--content-text-secondary)]">
                选择一个文件夹后，系统会先统计合同文件总数，再逐个调用 AI 识别并立即入库。
              </div>
            </div>
            <Button
              v-if="isBatchImportRunning"
              label="最小化运行"
              severity="secondary"
              icon="pi pi-minus"
              @click="minimizeBatchImportDialog"
            />
          </div>
          <div class="mt-4 flex flex-wrap items-center gap-3">
            <Button
              label="选择文件夹并开始"
              icon="pi pi-folder-open"
              :loading="batchImportState.stage === 'scanning'"
              :disabled="isBatchImportRunning"
              @click="startBatchImport"
            />
            <Button
              v-if="hasBatchImportSession"
              label="刷新当前进度"
              severity="secondary"
              icon="pi pi-sync"
              :disabled="batchImportState.stage === 'scanning'"
              @click="openBatchImportProgress"
            />
          </div>
        </div>

        <div
          v-if="batchImportState.stage !== 'idle'"
          class="rounded-xl border p-4"
          :style="{ borderColor: 'var(--content-border)', backgroundColor: 'var(--content-card-bg)' }"
        >
          <div class="flex flex-col gap-2">
            <div class="flex flex-wrap items-center gap-3">
              <Tag :severity="batchImportTagSeverity" :value="batchImportTagText" />
              <div class="min-w-0 flex-1">
                <div class="text-sm text-[var(--content-text-secondary)]">{{ batchImportStatusText }}</div>
              </div>
            </div>
            <div
              v-if="batchImportState.folderPath"
              class="truncate text-sm text-[var(--content-text)]"
              :title="batchImportState.folderPath"
            >
              当前文件夹：<span class="font-bold">{{ batchImportState.folderPath }}</span>
            </div>
          </div>
          <div class="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
            <div class="rounded-lg border px-3 py-2" :style="{ borderColor: 'var(--content-border)' }">
              <div class="text-xs text-[var(--content-text-secondary)]">识别总数</div>
              <div class="mt-1 text-xl font-semibold text-[var(--content-text)]">{{ batchImportState.total }}</div>
            </div>
            <div class="rounded-lg border px-3 py-2" :style="{ borderColor: 'var(--content-border)' }">
              <div class="text-xs text-[var(--content-text-secondary)]">已完成</div>
              <div class="mt-1 text-xl font-semibold text-[var(--content-text)]">{{ batchImportState.completed }}</div>
            </div>
            <div class="rounded-lg border px-3 py-2" :style="{ borderColor: 'var(--content-border)' }">
              <div class="text-xs text-[var(--content-text-secondary)]">成功入库</div>
              <div class="mt-1 text-xl font-semibold text-emerald-600">{{ batchImportState.successCount }}</div>
            </div>
            <div class="rounded-lg border px-3 py-2" :style="{ borderColor: 'var(--content-border)' }">
              <div class="text-xs text-[var(--content-text-secondary)]">失败数量</div>
              <div class="mt-1 text-xl font-semibold text-rose-600">{{ batchImportState.failedCount }}</div>
            </div>
          </div>

          <div
            class="mt-4 rounded-xl border px-4 py-5"
            :style="{ borderColor: 'var(--content-border)', backgroundColor: 'var(--content-bg)' }"
          >
            <div class="flex flex-col items-center text-center">
              <div class="batch-import-scanner" :class="{ 'is-active': isBatchImportRunning }" aria-hidden="true">
                <div class="batch-import-scanner__icon">
                  <div class="batch-import-scanner__lens">
                    <div class="batch-import-scanner__glow"></div>
                    <div class="batch-import-scanner__scanline"></div>
                  </div>
                  <div class="batch-import-scanner__handle"></div>
                </div>
                <div class="batch-import-scanner__file-name" :title="batchImportScannerFileName">
                  {{ batchImportScannerFileName }}
                </div>
              </div>
              <div class="mt-3 text-xs tracking-[0.2em] text-[var(--content-text-secondary)]">Ai正在识别中</div>
              <div v-if="batchImportLogs.length > 0" class="mt-2 flex max-w-full items-center justify-center gap-1.5 px-4">
                <span
                  class="h-1.5 w-1.5 shrink-0 rounded-full"
                  :class="{
                    'bg-sky-500': batchImportLogs[0].level === 'info',
                    'bg-emerald-500': batchImportLogs[0].level === 'success',
                    'bg-rose-500': batchImportLogs[0].level === 'error',
                  }"
                ></span>
                <span class="truncate text-xs text-[var(--content-text-secondary)]" :title="batchImportLogs[0].text">
                  {{ batchImportLogs[0].text }}
                </span>
              </div>
            </div>
          </div>

          <div class="mt-4">
            <div class="mb-2 flex items-center justify-between text-sm">
              <span class="text-[var(--content-text)]">整体进度</span>
              <span class="text-[var(--content-text-secondary)]">{{ batchImportProgressPercent }}%</span>
            </div>
            <ProgressBar :value="batchImportProgressPercent" style="height: 10px" />
          </div>

          <div class="mt-4 flex items-center gap-2 text-sm text-[var(--content-text-secondary)]">
            <i v-if="batchImportState.stage === 'scanning'" class="pi pi-spin pi-spinner"></i>
            <i v-else-if="isBatchImportRunning" class="pi pi-spin pi-cog"></i>
            <i v-else-if="batchImportState.stage === 'completed'" class="pi pi-check-circle text-emerald-600"></i>
            <i v-else class="pi pi-exclamation-circle text-rose-600"></i>
            <span>{{ batchImportCurrentFileText }}</span>
          </div>

          <div
            class="mt-4 rounded-xl border p-3"
            :style="{ borderColor: 'var(--content-border)', backgroundColor: 'var(--content-bg)' }"
          >
            <div class="mb-3 flex items-center justify-between gap-3">
              <div class="text-sm font-medium text-[var(--content-text)]">输出日志</div>
              <div class="text-xs text-[var(--content-text-secondary)]">最近 {{ batchImportLogs.length }} 条</div>
            </div>
            <div v-if="batchImportLogs.length > 0" class="max-h-40 space-y-2 overflow-auto pr-1">
              <div
                v-for="item in batchImportLogs"
                :key="item.id"
                class="flex items-start gap-2 rounded-lg px-2 py-1.5 text-xs"
                :style="{ backgroundColor: 'var(--content-card-bg)' }"
              >
                <span
                  class="mt-1 inline-block h-2 w-2 shrink-0 rounded-full"
                  :class="{
                    'bg-sky-500': item.level === 'info',
                    'bg-emerald-500': item.level === 'success',
                    'bg-rose-500': item.level === 'error',
                  }"
                ></span>
                <span class="shrink-0 text-[var(--content-text-secondary)]">[{{ item.time }}]</span>
                <span class="min-w-0 flex-1 break-words text-[var(--content-text)]">{{ item.text }}</span>
              </div>
            </div>
            <div v-else class="rounded-lg px-2 py-4 text-center text-xs text-[var(--content-text-secondary)]">
              等待任务开始后输出日志
            </div>
          </div>
        </div>

        <div
          v-if="batchImportImportedContracts.length > 0 || batchImportFailedItems.length > 0"
          class="grid grid-cols-1 gap-4 md:grid-cols-2"
        >
          <div
            v-if="batchImportImportedContracts.length > 0"
            class="rounded-xl border p-4"
            :style="{ borderColor: 'var(--content-border)', backgroundColor: 'var(--content-card-bg)' }"
          >
            <div class="mb-3 flex items-center justify-between gap-3">
              <div class="text-base font-semibold text-[var(--content-text)]">已入库合同</div>
              <div class="text-sm text-[var(--content-text-secondary)]">共 {{ batchImportImportedContracts.length }} 条</div>
            </div>
            <div class="max-h-56 space-y-2 overflow-auto pr-1">
              <div
                v-for="item in batchImportImportedContracts"
                :key="item.filePath"
                class="flex items-center justify-between gap-3 rounded-lg border px-3 py-2"
                :style="{ borderColor: 'var(--content-border)' }"
              >
                <div class="min-w-0">
                  <div class="truncate text-sm font-medium text-[var(--content-text)]">
                    {{ item.contractName || item.fileName }}
                  </div>
                  <div class="truncate text-xs text-[var(--content-text-secondary)]">
                    {{ item.contractCode || '未生成编号' }}
                  </div>
                </div>
                <Button
                  v-if="item.contractId"
                  label="打开"
                  severity="secondary"
                  text
                  size="small"
                  @click="openImportedContract(item.contractId)"
                />
              </div>
            </div>
          </div>

          <div
            v-if="batchImportFailedItems.length > 0"
            class="rounded-xl border p-4"
            :style="{ borderColor: 'var(--content-border)', backgroundColor: 'var(--content-card-bg)' }"
          >
            <div class="mb-3 flex items-center justify-between gap-3">
              <div class="text-base font-semibold text-[var(--content-text)]">失败记录</div>
              <div class="flex items-center gap-2">
                <div class="text-sm text-[var(--content-text-secondary)]">共 {{ batchImportFailedItems.length }} 条</div>
              </div>
            </div>
            <div class="max-h-56 space-y-2 overflow-auto pr-1">
              <div
                v-for="item in batchImportFailedItems"
                :key="item.filePath"
                class="rounded-lg border px-3 py-2"
                :style="{ borderColor: 'var(--content-border)' }"
              >
                <div class="truncate text-sm font-medium text-[var(--content-text)]">{{ item.fileName }}</div>
                <div class="mt-1 text-xs text-rose-600 whitespace-pre-wrap break-words">{{ item.message || '识别或入库失败' }}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <template #footer>
        <div class="flex items-center justify-between gap-3 w-full">
          <span class="text-sm text-[var(--content-text-secondary)]">{{ batchImportFooterText }}</span>
          <div class="flex items-center gap-2">
            <Button
              v-if="batchImportFailedItems.length > 0"
              label="导出错误"
              icon="pi pi-file-excel"
              severity="secondary"
              @click="exportBatchImportFailedItems"
            />
            <Button
              v-if="isBatchImportRunning"
              label="最小化到后台"
              severity="secondary"
              @click="minimizeBatchImportDialog"
            />
            <Button
              v-else
              label="关闭"
              severity="secondary"
              @click="showBatchImportDialog = false"
            />
          </div>
        </div>
      </template>
    </Dialog>

    <Dialog
      v-model:visible="showContractDetailModal"
      modal
      header="合同详情"
      :style="{ width: '720px' }"
      :closable="true"
      :draggable="false"
      class="theme-dialog"
    >
      <div v-if="contractDetail" class="grid grid-cols-2 gap-3">
        <div class="flex items-center gap-2">
          <span class="text-sm text-[var(--content-text-secondary)] w-24">合同名称</span>
          <span class="text-sm text-[var(--content-text)] font-semibold truncate">{{ contractDetail.contract_name }}</span>
        </div>
        <div class="flex items-center gap-2">
          <span class="text-sm text-[var(--content-text-secondary)] w-24">合同编号</span>
          <span class="text-sm text-[var(--content-text)] font-semibold truncate">{{ contractDetail.contract_code }}</span>
        </div>
        <div class="flex items-center gap-2">
          <span class="text-sm text-[var(--content-text-secondary)] w-24">甲方</span>
          <span class="text-sm text-[var(--content-text)] truncate">{{ contractDetail.client_name }}</span>
        </div>
        <div class="flex items-center gap-2">
          <span class="text-sm text-[var(--content-text-secondary)] w-24">乙方</span>
          <span class="text-sm text-[var(--content-text)] truncate">{{ contractDetail.party_b_name }}</span>
        </div>
        <div class="flex items-center gap-2">
          <span class="text-sm text-[var(--content-text-secondary)] w-24">合同类型</span>
          <span class="text-sm text-[var(--content-text)] truncate">{{ contractDetail.contract_type }}</span>
        </div>
        <div class="flex items-center gap-2">
          <span class="text-sm text-[var(--content-text-secondary)] w-24">签约日期</span>
          <span class="text-sm text-[var(--content-text)] truncate">{{ contractDetail.signing_date }}</span>
        </div>
        <div class="col-span-2">
          <div class="text-sm text-[var(--content-text-secondary)] mb-1">合同摘要</div>
          <div class="text-sm text-[var(--content-text)] whitespace-pre-wrap break-words rounded-md border p-2" :style="{ borderColor: 'var(--content-border)' }">
            {{ contractDetail.contract_summary || '-' }}
          </div>
        </div>
      </div>
      <div v-else class="text-sm text-[var(--content-text-secondary)]">暂无详情</div>
      <template #footer>
        <Button label="关闭" severity="secondary" @click="showContractDetailModal = false" />
      </template>
    </Dialog>

    <AggregatedSearchDialog v-model:visible="showAggregatedSearchDialog" />
    <NotificationCenterDialog v-model:visible="showNotificationCenterDialog" />
    <BillingDialog
      v-model:visible="showBillingDialog"
      @payment-success="onBillingPaymentSuccess"
    />
    <SettingsDialog v-model="showSettingsDialog" />
  </div>
</template>

<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref, shallowRef, computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import ResourceSidebar from '../library/resource/components/ResourceSidebar.vue'
import PropertiesPanel from '../library/resource/components/PropertiesPanel.vue'
import CreateContractInfoModal from '../library/resource/components/CreateContractInfoModal.vue'
import SettingsDialog from '../../components/SettingsDialog.vue'
import { useSidebarStore } from '../../stores/ui/sidebarStore'
import { useReceiptPlanStore } from '../../stores/contract/receiptPlanStore'
import { useTaskMonitorStore } from '../../stores/system/taskMonitorStore'
import { useAIStore } from '../../stores/system/aiStore'
import { useAuthStore } from '../../stores/system/authStore'
import { useSubscriptionStore } from '../../stores/system/subscriptionStore'
import { useShortcut } from '../../composables/useShortcutSimple'
import { createRendererLogger } from '@/utils/logger'
import { eventBus } from '../../utils/eventBus'
import AggregatedSearchDialog from './components/AggregatedSearchDialog.vue'
import NotificationCenterDialog from './components/NotificationCenterDialog.vue'
import BillingDialog from './components/BillingDialog.vue'
import ProgressBar from 'primevue/progressbar'
import Tag from 'primevue/tag'
import { exportToExcel, type ExcelColumn } from '../../utils/excelExport'
import {
  assertBatchImportContractCandidate,
  buildBatchAiRequest,
  buildBatchCreatePayload,
  loadBatchImportPreparation,
  reserveBatchPayloadIdentity,
  type BatchAiReceiptPlan,
  type BatchImportPreparation,
} from '../library/resource/components/batchContractImportUtils'

const logger = createRendererLogger('MainLayout')
import type { ContractInfoCreateDTO, ContractInfoEntity, ContractInfoUpdateDTO } from '../../../shared/types/contractInfo.types'
import type { ContractResource } from '../library/resource/types/contractResource'

// PrimeVue 组件
import Dialog from 'primevue/dialog'
import Button from 'primevue/button'
import { useToast } from 'primevue/usetoast'
import { useConfirm } from 'primevue/useconfirm'

// 路由
const route = useRoute()
const router = useRouter()
const toast = useToast()
const confirm = useConfirm()
const showPropertiesPanel = computed(() => selectedCategory.value === 'all' && !route.meta.hidePropertiesPanel)
const BILLING_PROMPT_PENDING_KEY = 'billingPromptPending'

// Store
const sidebarStore = useSidebarStore()
const receiptPlanStore = useReceiptPlanStore()
const taskMonitorStore = useTaskMonitorStore()
const aiStore = useAIStore()
const authStore = useAuthStore()
const subscriptionStore = useSubscriptionStore()

type BatchImportStage = 'idle' | 'scanning' | 'running' | 'completed' | 'failed'

type BatchImportResultItem = {
  filePath: string
  fileName: string
  status: 'success' | 'failed'
  contractId?: string
  contractName?: string
  contractCode?: string
  message?: string
}

type BatchImportLogItem = {
  id: string
  time: string
  text: string
  level: 'info' | 'success' | 'error'
}

// ─── 响应式状态 ─────────────────────────────────────────────────

/** 搜索关键词 */
const searchQuery = ref('')

/** 当前选中的分类 */
const selectedCategory = ref('all')

/** 当前选中的文件夹ID */
const selectedFolderId = ref<number | null>(null)

/** 展开的文件夹集合 */
const expandedFolders = ref<Set<number>>(new Set())

/** 当前选中的资源 */
const selectedResource = ref<any>(null)

/** 聚合搜索弹窗显示状态 */
const showAggregatedSearchDialog = ref(false)

/** 通知中心弹窗显示状态 */
const showNotificationCenterDialog = ref(false)

/** 会员服务弹窗显示状态 */
const showBillingDialog = ref(false)

/** 偏好设置弹窗显示状态 */
const showSettingsDialog = ref(false)

/** 合同信息弹窗显示状态 */
const showCreateContractModal = ref(false)
const contractModalMode = ref<'create' | 'edit'>('create')
const editingContract = ref<ContractInfoEntity | null>(null)

const showContractDetailModal = ref(false)
const contractDetail = ref<ContractInfoEntity | null>(null)

/** 资源刷新令牌 */
const resourceRefreshToken = ref(0)

const showBatchImportDialog = ref(false)
const batchImportPreparation = shallowRef<BatchImportPreparation | null>(null)
const batchImportLogs = ref<BatchImportLogItem[]>([])
const batchImportState = ref<{
  taskId: string
  stage: BatchImportStage
  folderPath: string
  total: number
  completed: number
  successCount: number
  failedCount: number
  currentFile: string
  currentIndex: number
  message: string
  results: BatchImportResultItem[]
  startedAt: number | null
  finishedAt: number | null
}>({
  taskId: '',
  stage: 'idle',
  folderPath: '',
  total: 0,
  completed: 0,
  successCount: 0,
  failedCount: 0,
  currentFile: '',
  currentIndex: 0,
  message: '',
  results: [],
  startedAt: null,
  finishedAt: null,
})
let batchImportRunToken = 0

const isResizingSidebar = ref(false)
let resizeStartX = 0
let resizeStartWidth = 0
let bodyCursorBeforeResize = ''
let bodyUserSelectBeforeResize = ''

const isBatchImportRunning = computed(() => batchImportState.value.stage === 'running' || batchImportState.value.stage === 'scanning')
const hasBatchImportSession = computed(() => {
  return batchImportState.value.stage !== 'idle' || batchImportState.value.results.length > 0
})
const batchImportProgressPercent = computed(() => {
  if (batchImportState.value.stage === 'scanning') return 0
  if (batchImportState.value.total <= 0) return 0
  return Math.max(0, Math.min(100, Math.round((batchImportState.value.completed / batchImportState.value.total) * 100)))
})
const batchImportImportedContracts = computed(() => batchImportState.value.results.filter((item) => item.status === 'success'))
const batchImportFailedItems = computed(() => batchImportState.value.results.filter((item) => item.status === 'failed'))
const batchImportTagText = computed(() => {
  if (batchImportState.value.stage === 'scanning') return '扫描中'
  if (batchImportState.value.stage === 'running') return '识别入库中'
  if (batchImportState.value.stage === 'completed') return '已完成'
  if (batchImportState.value.stage === 'failed') return '已失败'
  return '未开始'
})
const batchImportTagSeverity = computed<'info' | 'success' | 'danger' | 'secondary'>(() => {
  if (batchImportState.value.stage === 'completed') return 'success'
  if (batchImportState.value.stage === 'failed') return 'danger'
  if (batchImportState.value.stage === 'idle') return 'secondary'
  return 'info'
})
const batchImportStatusText = computed(() => {
  if (batchImportState.value.stage === 'scanning') {
    return batchImportState.value.message || '正在扫描文件夹中的合同文件...'
  }
  if (batchImportState.value.stage === 'running') {
    return `正在识别第 ${Math.min(batchImportState.value.currentIndex + 1, Math.max(batchImportState.value.total, 1))} / ${batchImportState.value.total} 个文件`
  }
  if (batchImportState.value.stage === 'completed') {
    return `共识别 ${batchImportState.value.total} 个文件，成功 ${batchImportState.value.successCount} 个，失败 ${batchImportState.value.failedCount} 个`
  }
  if (batchImportState.value.stage === 'failed') {
    return batchImportState.value.message || '批量导入失败'
  }
  return '请选择文件夹开始批量导入'
})
const batchImportCurrentFileText = computed(() => {
  if (batchImportState.value.stage === 'scanning') {
    return batchImportState.value.message || '正在扫描文件夹...'
  }
  if (batchImportState.value.currentFile) {
    return `当前文件：${batchImportState.value.currentFile}`
  }
  if (batchImportState.value.stage === 'completed') {
    return '全部文件处理完成'
  }
  if (batchImportState.value.stage === 'failed') {
    return batchImportState.value.message || '批量导入失败'
  }
  return '等待开始'
})
const batchImportScannerFileName = computed(() => {
  if (batchImportState.value.currentFile) {
    return batchImportState.value.currentFile
  }
  if (batchImportState.value.stage === 'scanning') {
    return '正在扫描合同文件...'
  }
  if (batchImportState.value.stage === 'completed') {
    return '全部合同文件扫描完成'
  }
  if (batchImportState.value.stage === 'failed') {
    return '扫描任务已中断'
  }
  return '等待开始扫描'
})
const batchImportFooterText = computed(() => {
  if (isBatchImportRunning.value) return '任务在后台持续运行，可最小化后稍后再回来查看。'
  if (batchImportState.value.stage === 'completed') return '批量导入已结束，可关闭窗口或重新选择文件夹继续导入。'
  if (batchImportState.value.stage === 'failed') return '当前任务已终止，可修正文件后重新执行。'
  return '开始前请确认当前资源库已正确打开。'
})

const formatBatchImportLogTime = () => {
  const now = new Date()
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`
}

const pushBatchImportLog = (text: string, level: BatchImportLogItem['level'] = 'info') => {
  const message = String(text || '').trim()
  if (!message) return
  batchImportLogs.value.unshift({
    id: crypto.randomUUID(),
    time: formatBatchImportLogTime(),
    text: message,
    level,
  })
  if (batchImportLogs.value.length > 80) {
    batchImportLogs.value = batchImportLogs.value.slice(0, 80)
  }
}

const getBatchImportFailedExportFilename = () => {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  const hours = String(now.getHours()).padStart(2, '0')
  const minutes = String(now.getMinutes()).padStart(2, '0')
  const seconds = String(now.getSeconds()).padStart(2, '0')
  return `批量识别失败记录_${year}${month}${day}_${hours}${minutes}${seconds}.xlsx`
}

const exportBatchImportFailedItems = async () => {
  if (batchImportFailedItems.value.length === 0) {
    toast.add({
      severity: 'warn',
      summary: '暂无可导出记录',
      detail: '当前没有失败或拦截的识别记录',
      life: 2500,
    })
    return
  }

  const columns: ExcelColumn[] = [
    { field: 'fileName', header: '文件名称' },
    { field: 'filePath', header: '文件路径' },
    {
      field: 'message',
      header: '错误原因',
      format: (value: unknown) => String(value || '识别或入库失败').trim(),
    },
  ]

  const rows = batchImportFailedItems.value.map((item) => ({
    fileName: item.fileName,
    filePath: item.filePath,
    message: item.message || '识别或入库失败',
  }))

  try {
    const result = await exportToExcel(rows, columns, getBatchImportFailedExportFilename())
    if (!result.success) return
    toast.add({
      severity: 'success',
      summary: '导出成功',
      detail: result.filePath ? `已导出到：${result.filePath}` : '失败记录已导出为 Excel',
      life: 3500,
    })
  } catch (error: any) {
    toast.add({
      severity: 'error',
      summary: '导出失败',
      detail: error?.message || '导出失败记录 Excel 时发生错误',
      life: 4000,
    })
  }
}

const stopSidebarResize = () => {
  if (!isResizingSidebar.value) {
    return
  }
  isResizingSidebar.value = false
  window.removeEventListener('mousemove', onSidebarResizeMove)
  window.removeEventListener('mouseup', stopSidebarResize)
  document.body.style.cursor = bodyCursorBeforeResize
  document.body.style.userSelect = bodyUserSelectBeforeResize
}

const onSidebarResizeMove = (event: MouseEvent) => {
  if (!isResizingSidebar.value) {
    return
  }
  const deltaX = event.clientX - resizeStartX
  sidebarStore.setSidebarWidth(resizeStartWidth + deltaX)
}

const startSidebarResize = (event: MouseEvent) => {
  isResizingSidebar.value = true
  resizeStartX = event.clientX
  resizeStartWidth = sidebarStore.sidebarWidth
  bodyCursorBeforeResize = document.body.style.cursor
  bodyUserSelectBeforeResize = document.body.style.userSelect
  document.body.style.cursor = 'col-resize'
  document.body.style.userSelect = 'none'
  window.addEventListener('mousemove', onSidebarResizeMove)
  window.addEventListener('mouseup', stopSidebarResize)
}

const parseRouteQueryText = (value: unknown) => {
  if (typeof value === 'string') return value.trim()
  if (Array.isArray(value)) return String(value[0] || '').trim()
  return ''
}

const parseRouteFolderId = (value: unknown) => {
  const text = parseRouteQueryText(value)
  if (!text) return null
  const folderId = Number(text)
  return Number.isFinite(folderId) ? folderId : null
}

const getResourceRouteQuery = (category: string, folderId: number | null) => {
  const query: Record<string, string> = {}
  if (folderId !== null) {
    query.folderId = String(folderId)
    return query
  }
  if (category && category !== 'all') {
    query.category = category
  }
  return query
}

const syncSelectionFromRoute = () => {
  if (route.meta.preserveSidebarSelection) {
    return
  }

  const folderId = parseRouteFolderId(route.query.folderId)
  const categoryFromQuery = parseRouteQueryText(route.query.category)
  const q = parseRouteQueryText(route.query.q)
  const categoryFromRoute = typeof route.meta.sidebarCategory === 'string' ? route.meta.sidebarCategory : ''

  if (route.meta.layoutContent === 'resource') {
    selectedFolderId.value = folderId
    selectedCategory.value = folderId !== null ? '' : (categoryFromQuery || categoryFromRoute || 'all')
  } else {
    selectedFolderId.value = null
    selectedCategory.value = categoryFromQuery || categoryFromRoute || ''
  }
  selectedResource.value = null
  searchQuery.value = q
}

// ─── 方法 ───────────────────────────────────────────────────────

/**
 * 处理搜索
 * @param value 搜索关键词
 */
const handleSearch = (value: string) => {
  searchQuery.value = value
}

/**
 * 选择分类
 * @param key 分类键值
 */
const selectCategory = async (key: string) => {
  selectedCategory.value = key
  selectedFolderId.value = null
  selectedResource.value = null
  if (key === 'untagged') {
    await router.push({ name: 'AllContractFiles' })
    return
  }
  if (key === 'other-files') {
    await router.push({ name: 'OtherFiles' })
    return
  }
  if (key === 'ai-workbench') {
    await router.push({ name: 'AIWorkbench' })
    return
  }
  if (key === 'toolbox') {
    await router.push({ name: 'ToolboxHome' })
    return
  }
  if (key === 'feedback') {
    await router.push({ name: 'Feedback' })
    return
  }
  if (key === 'trash') {
    await router.push({
      name: 'ContractFiles',
      params: { contractId: '__trash__' },
      query: { category: 'trash' }
    })
    return
  }
  await router.push({
    name: 'Resource',
    query: getResourceRouteQuery(key, null)
  })
}

/**
 * 切换文件夹展开状态
 * @param folderId 文件夹ID
 */
const toggleFolder = (folderId: number) => {
  if (expandedFolders.value.has(folderId)) {
    expandedFolders.value.delete(folderId)
  } else {
    expandedFolders.value.add(folderId)
  }
}

/**
 * 选择文件夹
 * @param folderId 文件夹ID
 */
const selectFolder = async (folderId: number) => {
  selectedFolderId.value = folderId
  selectedCategory.value = ''
  selectedResource.value = null
  await router.push({
    name: 'Resource',
    query: getResourceRouteQuery('', folderId)
  })
}

/**
 * 选择资源
 * @param resource 资源对象
 */
const selectResource = (resource: any) => {
  selectedResource.value = resource
}

/**
 * 关闭属性面板
 */
const closeProperties = () => {
  selectedResource.value = null
}

/**
 * 编辑资源
 * @param resource 资源对象
 */
const editResource = async (resource: any) => {
  const libraryPath = localStorage.getItem('currentLibraryPath') || ''
  const id = String(resource?.id || '').trim()
  if (!libraryPath || !id) {
    toast.add({
      severity: 'warn',
      summary: '编辑合同失败',
      detail: '请先选择资源库',
      life: 3000
    })
    return
  }

  const res = await window.electronAPI.library.getContractInfo({ libraryPath, id })
  if (!res.success || !res.data) {
    toast.add({
      severity: 'error',
      summary: '读取合同失败',
      detail: res.error || '读取合同信息失败',
      life: 4000
    })
    return
  }

  contractModalMode.value = 'edit'
  editingContract.value = res.data
  showCreateContractModal.value = true
}

/**
 * 删除资源
 * @param resource 资源对象
 */
const deleteResource = async (resource: any) => {
  const libraryPath = localStorage.getItem('currentLibraryPath') || ''
  const id = String(resource?.id || '').trim()
  const name = String(resource?.name || resource?.contractName || '').trim()
  if (!libraryPath || !id) {
    toast.add({
      severity: 'warn',
      summary: '删除合同失败',
      detail: '请先选择资源库',
      life: 3000
    })
    return
  }

  // 检查合同下是否有文件
  try {
    const fileListRes = await window.electronAPI.contractFiles.getList({ libraryPath, contractId: id })
    if (fileListRes.success && fileListRes.data && fileListRes.data.items && fileListRes.data.items.length > 0) {
      toast.add({
        severity: 'warn',
        summary: '无法删除',
        detail: `合同“${name}”下还有文件，请先删除文件。`,
        life: 5000
      })
      return
    }
  } catch (error) {
    logger.error('检查合同文件失败:', error)
  }

  confirm.require({
    header: '删除确认',
    message: `是否删除 ${name || '该'} 的合同？该操作不可恢复。`,
    icon: 'pi pi-exclamation-triangle',
    acceptClass: 'p-button-danger',
    acceptLabel: '删除',
    rejectLabel: '取消',
    accept: async () => {
      const result = await window.electronAPI.library.deleteContractInfo({ libraryPath, id })
      if (!result.success) {
        toast.add({
          severity: 'error',
          summary: '删除合同失败',
          detail: result.error || '删除失败',
          life: 4000
        })
        return
      }
      if (selectedResource.value && String(selectedResource.value.id) === id) {
        selectedResource.value = null
      }
      resourceRefreshToken.value += 1
      toast.add({
        severity: 'success',
        summary: '已删除',
        detail: name ? `已删除：${name}` : '已删除',
        life: 3000
      })
    }
  })
}

/**
 * 添加标签
 * @param resource 资源对象
 */
const addTag = (resource: any) => {
  logger.info('添加标签:', resource)
  // TODO: 实现添加标签功能
}

/**
 * 保存描述
 * @param description 描述文本
 */
const saveDescription = (description: string) => {
  logger.info('保存描述:', description)
  // TODO: 实现保存描述功能
}

const openCreateContractModal = () => {
  contractModalMode.value = 'create'
  editingContract.value = null
  showCreateContractModal.value = true
}

const ensureBatchImportAiEnabled = async () => {
  if (!aiStore.isInitialized) {
    await aiStore.initAISettings()
  }
  if (!aiStore.enabled) {
    toast.add({
      severity: 'warn',
      summary: '未启用 AI',
      detail: '批量扫描需要 AI 识别，请在偏好设置中启用并配置 AI。',
      life: 4500,
    })
    return false
  }

  const mode = String(aiStore.mode || '').trim()
  if (mode === 'cloud') {
    if (!String(aiStore.apiKey || '').trim()) {
      toast.add({
        severity: 'warn',
        summary: 'AI 未配置',
        detail: '当前为云端模式，但未填写 API Key，请在偏好设置中完成配置后再试。',
        life: 5000,
      })
      return false
    }
    return true
  }

  const modelId = String(aiStore.selectedModelId || '').trim()
  const localModels = Array.isArray(aiStore.localModels) ? aiStore.localModels : []
  const selectedModel = localModels.find((m: any) => String(m?.id || '').trim() === modelId)
  if (!modelId || !selectedModel) {
    toast.add({
      severity: 'warn',
      summary: 'AI 未配置',
      detail: '当前为本地模式，但未选择可用的本地模型，请在偏好设置中完成配置后再试。',
      life: 5000,
    })
    return false
  }
  const executablePath = String((selectedModel as any).executablePath || '').trim()
  const modelPath = String((selectedModel as any).modelPath || '').trim()
  if (!executablePath || !modelPath) {
    toast.add({
      severity: 'warn',
      summary: 'AI 未配置',
      detail: '当前为本地模式，但 llama.cpp 可执行文件或模型路径未配置，请在偏好设置中完成配置后再试。',
      life: 5500,
    })
    return false
  }
  return true
}

const openBatchImportDialog = async () => {
  if (!isBatchImportRunning.value && (batchImportState.value.stage === 'completed' || batchImportState.value.stage === 'failed')) {
    resetBatchImportState()
  }
  if (!isBatchImportRunning.value && !hasBatchImportSession.value) {
    const ok = await ensureBatchImportAiEnabled()
    if (!ok) return
  }
  showBatchImportDialog.value = true
}

const openBatchImportProgress = () => {
  if (!hasBatchImportSession.value) return
  if (!isBatchImportRunning.value && (batchImportState.value.stage === 'completed' || batchImportState.value.stage === 'failed')) {
    resetBatchImportState()
  }
  showBatchImportDialog.value = true
}

const minimizeBatchImportDialog = () => {
  showBatchImportDialog.value = false
}

const resetBatchImportState = () => {
  batchImportLogs.value = []
  batchImportState.value = {
    taskId: '',
    stage: 'idle',
    folderPath: '',
    total: 0,
    completed: 0,
    successCount: 0,
    failedCount: 0,
    currentFile: '',
    currentIndex: 0,
    message: '',
    results: [],
    startedAt: null,
    finishedAt: null,
  }
  batchImportPreparation.value = null
}

const getCurrentLibraryPath = () => localStorage.getItem('currentLibraryPath') || ''

type ContractSubmitPayload =
  | {
    mode: 'create'
    payload: Omit<ContractInfoCreateDTO, 'libraryPath'>
    uploadedFile?: { tempPath: string; originalName: string }
    aiReceiptPlans?: Array<{
      plan_name: string
      direction: '收款' | '付款'
      receipt_frequency?: string
      ratio?: number
      expected_amount?: number
      expected_date?: string
      remark?: string
    }>
    aiReceiptPlanSyncToCalendar?: boolean
  }
  | {
    mode: 'edit'
    payload: Omit<ContractInfoUpdateDTO, 'libraryPath'>
    uploadedFile?: { tempPath: string; originalName: string }
    aiReceiptPlans?: Array<{
      plan_name: string
      direction: '收款' | '付款'
      receipt_frequency?: string
      ratio?: number
      expected_amount?: number
      expected_date?: string
      remark?: string
    }>
    aiReceiptPlanSyncToCalendar?: boolean
  }

const persistUploadedContractFile = async (
  libraryPath: string,
  contractId: string,
  uploadedFile?: { tempPath: string; originalName: string },
) => {
  if (!uploadedFile?.tempPath) return
  const listRes = await window.electronAPI.contractFiles.getList({
    libraryPath,
    contractId,
    search: undefined,
  })
  if (!listRes.success || !listRes.data) {
    throw new Error(listRes.error || '获取合同文件目录失败')
  }
  const rootDir = String((listRes.data as any).rootDir || '').trim()
  const contractNo = String((listRes.data as any).contractNo || '').trim()
  if (!rootDir || !contractNo) {
    throw new Error('合同文件目录信息缺失')
  }
  const copyRes = await window.electronAPI.fs.copyFiles(
    [uploadedFile.tempPath],
    rootDir,
    { destNames: [uploadedFile.originalName] },
  )
  if (!copyRes.success || !copyRes.data || !Array.isArray(copyRes.data) || !copyRes.data[0]?.destPath) {
    throw new Error(copyRes.error || '拷贝文件到合同目录失败')
  }
  const destPath = String((copyRes.data as any)[0]?.destPath || '').trim()
  const upsertRes = await window.electronAPI.contractFiles.upsertFromPaths({
    libraryPath,
    contractId,
    contractNo,
    paths: [destPath],
  })
  if (!upsertRes.success) {
    throw new Error(upsertRes.error || '写入合同文件索引失败')
  }
  await window.electronAPI.fs.deleteFile(uploadedFile.tempPath)
}

const persistAiReceiptPlans = (
  payload: Extract<ContractSubmitPayload, { mode: 'create' }>,
  contractId: string,
  showToastMessage: boolean,
) => {
  if (!Array.isArray(payload.aiReceiptPlans) || payload.aiReceiptPlans.length === 0) return
  const contractCode = String(payload.payload.contractCode || '').trim()
  const contractName = String(payload.payload.contractName || '').trim()
  const createdPlans = payload.aiReceiptPlans
    .map((plan) => ({
      id: crypto.randomUUID(),
      contract_id: contractId,
      contract_code: contractCode,
      contract_name: contractName,
      direction: String(plan.direction || '').trim() || '收款',
      plan_name: String(plan.plan_name || '').trim(),
      receipt_frequency: String((plan as any).receipt_frequency || '').trim(),
      expected_amount: Number.isFinite(Number(plan.expected_amount)) ? Number(plan.expected_amount) : 0,
      expected_date: String(plan.expected_date || '').trim(),
      received_amount: 0,
      remark: String(plan.remark || '').trim(),
      custom1: '',
    }))
    .filter((row) => Boolean(row.plan_name))

  const createdCount = createdPlans.length
  if (createdPlans.length > 0) {
    const createdIds = new Set(createdPlans.map((row) => row.id))
    receiptPlanStore.plans = [
      ...createdPlans,
      ...receiptPlanStore.plans.filter((row) => !createdIds.has(String(row?.id || '').trim())),
    ]
  }

  if (!showToastMessage) return
  if (createdCount > 0) {
    toast.add({
      severity: 'success',
      summary: '收款计划已回填',
      detail: `已自动创建 ${createdCount} 条收款计划`,
      life: 2600,
    })
    return
  }
  toast.add({
    severity: 'warn',
    summary: '收款计划未写入',
    detail: '已创建合同，但收款计划自动写入失败，请在收款计划中补录',
    life: 3200,
  })
}

const saveContractSubmission = async (
  payload: ContractSubmitPayload,
  options?: {
    closeModal?: boolean
    showToastMessage?: boolean
    refreshResources?: boolean
    archiveWarningToast?: boolean
  },
) => {
  const libraryPath = getCurrentLibraryPath()
  if (!libraryPath) {
    throw new Error('请先选择资源库')
  }

  const result = payload.mode === 'edit'
    ? await window.electronAPI.library.updateContractInfo({ libraryPath, ...(payload.payload as any) })
    : await window.electronAPI.library.createContractInfo({ libraryPath, ...(payload.payload as any) })

  if (!result.success || !result.data) {
    throw new Error(result.error || '写入数据库或创建目录失败')
  }

  if (payload.mode === 'create' && payload.uploadedFile?.tempPath) {
    try {
      const contractId = String((result.data as any).id || '').trim()
      if (contractId) {
        await persistUploadedContractFile(libraryPath, contractId, payload.uploadedFile)
        await window.electronAPI.ai.promoteContractVectors({
          filePath: payload.uploadedFile.tempPath,
          contractId,
        })
      }
    } catch (err: any) {
      if (options?.archiveWarningToast !== false) {
        toast.add({
          severity: 'warn',
          summary: '文件归档失败',
          detail: err?.message || '已创建合同，但上传文件未能写入合同目录，请稍后在合同文件中手动导入',
          life: 4500,
        })
      }
    }
  }

  if (options?.closeModal !== false) {
    showCreateContractModal.value = false
    contractModalMode.value = 'create'
    editingContract.value = null
  }
  if (options?.refreshResources !== false) {
    resourceRefreshToken.value += 1
  }
  if (payload.mode === 'create') {
    persistAiReceiptPlans(payload, String((result.data as any).id || '').trim(), options?.showToastMessage !== false)
  }
  if (options?.showToastMessage !== false) {
    toast.add({
      severity: 'success',
      summary: payload.mode === 'edit' ? '编辑合同成功' : '新增合同成功',
      detail: `ID：${(result.data as any).id}`,
      life: 3000,
    })
  }

  try {
    const contractId = String((result.data as any).id || '').trim()
    if (contractId) {
      eventBus.emit('calendar-events:changed', { libraryPath, contractId, mode: payload.mode })
    }
  } catch {
  }

  return result.data as { id: string }
}

const handleContractSubmit = async (payload: ContractSubmitPayload) => {
  try {
    await saveContractSubmission(payload, {
      closeModal: true,
      showToastMessage: true,
      refreshResources: true,
      archiveWarningToast: true,
    })
  } catch (error: any) {
    toast.add({
      severity: 'error',
      summary: payload.mode === 'edit' ? '编辑合同失败' : '新增合同失败',
      detail: error?.message || '写入数据库或创建目录失败',
      life: 4000,
    })
  }
}

class BatchImportOcrTimeoutError extends Error {
  public readonly timeoutMs: number
  public readonly fileName: string

  constructor(fileName: string, timeoutMs: number) {
    super(`OCR 处理超时（>${Math.round(timeoutMs / 1000)} 秒）：${fileName}`)
    this.name = 'BatchImportOcrTimeoutError'
    this.timeoutMs = timeoutMs
    this.fileName = fileName
  }
}

const withTimeout = async <T>(promise: Promise<T>, timeoutMs: number, timeoutErrorFactory: () => Error): Promise<T> => {
  let timer: ReturnType<typeof setTimeout> | null = null
  return await new Promise<T>((resolve, reject) => {
    timer = setTimeout(() => reject(timeoutErrorFactory()), timeoutMs)
    promise
      .then(resolve)
      .catch(reject)
      .finally(() => {
        if (timer) clearTimeout(timer)
      })
  })
}

const BATCH_IMPORT_OCR_TIMEOUT_MS = 8 * 60 * 1000

const buildBatchImportTaskId = () => `batch-contract-import-${Date.now()}`

const updateBatchTaskProgress = (message?: string) => {
  if (!batchImportState.value.taskId) return
  taskMonitorStore.updateProgress(batchImportState.value.taskId, {
    progress: batchImportProgressPercent.value,
    current: batchImportState.value.completed,
    total: batchImportState.value.total,
    message: message || batchImportStatusText.value,
  })
}

const startBatchImport = async () => {
  const libraryPath = getCurrentLibraryPath()
  if (!libraryPath) {
    toast.add({
      severity: 'warn',
      summary: '批量增加合同失败',
      detail: '请先选择资源库',
      life: 3000,
    })
    return
  }
  if (isBatchImportRunning.value) {
    showBatchImportDialog.value = true
    return
  }
  const ok = await ensureBatchImportAiEnabled()
  if (!ok) return

  const selected = await window.electronAPI.fs.selectFile({ properties: ['openDirectory'] })
  if (!selected.success || !selected.data) {
    toast.add({
      severity: 'error',
      summary: '选择文件夹失败',
      detail: selected.error || '无法打开文件夹选择器',
      life: 4000,
    })
    return
  }
  if ((selected.data as any).canceled) return

  const folderPath = String((selected.data as any).filePaths?.[0] || '').trim()
  if (!folderPath) return

  resetBatchImportState()
  showBatchImportDialog.value = true
  batchImportRunToken += 1
  const runToken = batchImportRunToken
  batchImportState.value.taskId = buildBatchImportTaskId()
  batchImportState.value.stage = 'scanning'
  batchImportState.value.folderPath = folderPath
  batchImportState.value.message = '正在扫描文件夹中的合同文件...'
  batchImportState.value.startedAt = Date.now()
  pushBatchImportLog(`开始扫描文件夹：${folderPath}`)

  try {
    const scanRes = await window.electronAPI.contract.scanFolder(folderPath)
    if (runToken !== batchImportRunToken) return
    if (!scanRes.success || !scanRes.data) {
      throw new Error(scanRes.error || '扫描文件夹失败')
    }
    if (Number(scanRes.data.total || 0) <= 0 || !Array.isArray(scanRes.data.filePaths) || scanRes.data.filePaths.length === 0) {
      batchImportState.value.stage = 'idle'
      batchImportState.value.folderPath = folderPath
      batchImportState.value.message = ''
      pushBatchImportLog('扫描完成，但未发现可识别的合同文件', 'error')
      toast.add({
        severity: 'warn',
        summary: '未发现可识别文件',
        detail: '所选文件夹中没有可用于合同识别的文件',
        life: 3500,
      })
      return
    }

    batchImportPreparation.value = await loadBatchImportPreparation(libraryPath)
    batchImportState.value.total = scanRes.data.filePaths.length
    batchImportState.value.stage = 'running'
    batchImportState.value.message = `已扫描到 ${scanRes.data.filePaths.length} 个合同文件，开始逐个识别`
    pushBatchImportLog(`扫描完成，共发现 ${scanRes.data.filePaths.length} 个合同文件`)
    taskMonitorStore.register({
      id: batchImportState.value.taskId,
      name: `批量增加合同（${scanRes.data.filePaths.length}个）`,
      type: 'import',
      total: scanRes.data.filePaths.length,
    })
    updateBatchTaskProgress(batchImportState.value.message)

    for (let index = 0; index < scanRes.data.filePaths.length; index += 1) {
      if (runToken !== batchImportRunToken) return
      const filePath = String(scanRes.data.filePaths[index] || '').trim()
      const fileName = filePath.replace(/\\/g, '/').split('/').pop() || `文件${index + 1}`
      batchImportState.value.currentIndex = index
      batchImportState.value.currentFile = fileName
      batchImportState.value.message = `正在识别第 ${index + 1} / ${scanRes.data.filePaths.length} 个文件`
      pushBatchImportLog(`开始识别：${fileName}`)
      updateBatchTaskProgress(batchImportState.value.message)
      let tempUploadPath = ''

      try {
        if (!batchImportPreparation.value) {
          throw new Error('批量导入上下文初始化失败')
        }
        const uploadRes = await window.electronAPI.contract.upload(filePath)
        if (!uploadRes.success || !uploadRes.data) {
          throw new Error(uploadRes.error || '上传合同文件失败')
        }
        const aiPath = String((uploadRes.data as any).tempPath || '').trim()
        tempUploadPath = aiPath
        const fileId = String((uploadRes.data as any).fileId || '').trim()
        if (!aiPath || !fileId) {
          throw new Error('AI 提取所需的临时文件信息缺失')
        }

        const parsed = await withTimeout(
          window.electronAPI.ai.extractContractInfo(
            buildBatchAiRequest(aiPath, fileId, batchImportPreparation.value),
          ),
          BATCH_IMPORT_OCR_TIMEOUT_MS,
          () => new BatchImportOcrTimeoutError(fileName, BATCH_IMPORT_OCR_TIMEOUT_MS),
        )
        if (!parsed.success || !parsed.data) {
          throw new Error(parsed.error || 'AI 识别失败')
        }

        assertBatchImportContractCandidate(parsed.data, fileName, batchImportPreparation.value)
        const { payload: createPayload, aiReceiptPlans } = buildBatchCreatePayload(parsed.data, batchImportPreparation.value)
        const saveResult = await saveContractSubmission({
          mode: 'create',
          payload: {
            ...createPayload,
            autoCreatePartyUnits: true,
            skipRequiredValidation: true,
          },
          uploadedFile: { tempPath: aiPath, originalName: fileName },
          aiReceiptPlans: aiReceiptPlans as BatchAiReceiptPlan[],
          aiReceiptPlanSyncToCalendar: true,
        }, {
          closeModal: false,
          showToastMessage: false,
          refreshResources: true,
          archiveWarningToast: true,
        })

        reserveBatchPayloadIdentity(createPayload, batchImportPreparation.value)
        batchImportState.value.successCount += 1
        batchImportState.value.results.unshift({
          filePath,
          fileName,
          status: 'success',
          contractId: String((saveResult as any).id || '').trim(),
          contractName: createPayload.contractName,
          contractCode: createPayload.contractCode,
          message: '已识别并入库',
        })
        pushBatchImportLog(`识别完成并已入库：${createPayload.contractName || fileName}`, 'success')
        tempUploadPath = ''
      } catch (error: any) {
        try {
          if (tempUploadPath) {
            await window.electronAPI.fs.deleteFile(tempUploadPath)
          }
        } catch {
        }
        const isOcrTimeout = error instanceof BatchImportOcrTimeoutError
        batchImportState.value.failedCount += 1
        batchImportState.value.results.unshift({
          filePath,
          fileName,
          status: 'failed',
          message: error?.message || '识别或入库失败',
        })
        pushBatchImportLog(`处理失败：${fileName}，${error?.message || '识别或入库失败'}`, 'error')
        if (isOcrTimeout) {
          toast.add({
            severity: 'error',
            summary: 'OCR 超时',
            detail: error?.message || `OCR 处理超时：${fileName}`,
            life: 5000,
          })
        }
      } finally {
        batchImportState.value.completed += 1
        updateBatchTaskProgress(batchImportState.value.message)
      }
    }

    batchImportState.value.stage = 'completed'
    batchImportState.value.currentFile = ''
    batchImportState.value.finishedAt = Date.now()
    batchImportState.value.message = `已完成 ${batchImportState.value.total} 个文件的识别与入库`
    pushBatchImportLog(
      `任务完成：共 ${batchImportState.value.total} 个，成功 ${batchImportState.value.successCount} 个，失败 ${batchImportState.value.failedCount} 个`,
      batchImportState.value.failedCount > 0 ? 'info' : 'success',
    )
    updateBatchTaskProgress(batchImportState.value.message)
    taskMonitorStore.complete(batchImportState.value.taskId, {
      total: batchImportState.value.total,
      successCount: batchImportState.value.successCount,
      failedCount: batchImportState.value.failedCount,
    })
    toast.add({
      severity: batchImportState.value.failedCount > 0 ? 'warn' : 'success',
      summary: '批量增加合同完成',
      detail: `共 ${batchImportState.value.total} 个，成功 ${batchImportState.value.successCount} 个，失败 ${batchImportState.value.failedCount} 个`,
      life: 5000,
    })
  } catch (error: any) {
    batchImportState.value.stage = 'failed'
    batchImportState.value.finishedAt = Date.now()
    batchImportState.value.message = error?.message || '批量导入失败'
    pushBatchImportLog(`任务终止：${batchImportState.value.message}`, 'error')
    updateBatchTaskProgress(batchImportState.value.message)
    if (batchImportState.value.taskId) {
      taskMonitorStore.fail(batchImportState.value.taskId, batchImportState.value.message)
    }
    toast.add({
      severity: 'error',
      summary: '批量增加合同失败',
      detail: batchImportState.value.message,
      life: 5000,
    })
  }
}

const openImportedContract = async (contractId: string) => {
  const id = String(contractId || '').trim()
  if (!id) return
  await router.push({
    name: 'ContractFiles',
    params: { contractId: id },
    query: getResourceRouteQuery(selectedCategory.value, selectedFolderId.value),
  })
  showBatchImportDialog.value = false
}

const openResourceDetail = async (payload: { libraryPath: string; resource: ContractResource }) => {
  if (payload.resource?.type === 'file' && payload.resource.path) {
    await window.electronAPI.fs.openFile(payload.resource.path)
    return
  }
  console.log('openResourceDetail', payload)
  const libraryPath = payload.libraryPath || localStorage.getItem('currentLibraryPath') || ''
  const id = String(payload.resource?.id || '').trim()
  console.log('id', id)
  if (!libraryPath || !id) return
  localStorage.setItem('currentLibraryPath', libraryPath)
  console.log('router.push', {
    name: 'ContractFiles',
    params: { contractId: id },
    query: getResourceRouteQuery(selectedCategory.value, selectedFolderId.value)
  })
  try {
    await router.push({
      name: 'ContractFiles',
      params: { contractId: id },
      query: getResourceRouteQuery(selectedCategory.value, selectedFolderId.value)
    })
  } catch (e) {
    logger.error('导航到合同文件页失败:', e)
  }
}

const moveResource = async (payload: { libraryPath: string; resource: ContractResource; direction: 'top' | 'up' | 'down' | 'bottom' }) => {
  const libraryPath = payload.libraryPath || localStorage.getItem('currentLibraryPath') || ''
  const id = String(payload.resource?.id || '').trim()
  if (!libraryPath || !id) {
    toast.add({
      severity: 'warn',
      summary: '排序失败',
      detail: '请先选择资源库',
      life: 3000
    })
    return
  }
  const res = await window.electronAPI.library.moveContractInfo({ libraryPath, id, direction: payload.direction })
  if (!res.success) {
    toast.add({
      severity: 'error',
      summary: '排序失败',
      detail: res.error || '排序失败',
      life: 4000
    })
    return
  }
  resourceRefreshToken.value += 1
}

const editResourceWithPayload = async (payload: { libraryPath: string; resource: ContractResource }) => {
  localStorage.setItem('currentLibraryPath', payload.libraryPath || localStorage.getItem('currentLibraryPath') || '')
  await editResource(payload.resource)
}

const deleteResourceWithPayload = (payload: { libraryPath: string; resource: ContractResource }) => {
  localStorage.setItem('currentLibraryPath', payload.libraryPath || localStorage.getItem('currentLibraryPath') || '')
  deleteResource(payload.resource)
}

const batchDeleteResourcesWithPayload = (payload: { libraryPath: string; resources: ContractResource[] }) => {
  localStorage.setItem('currentLibraryPath', payload.libraryPath || localStorage.getItem('currentLibraryPath') || '')
  batchDeleteResources(payload.resources)
}

const batchDeleteResources = async (resources: ContractResource[]) => {
  const libraryPath = localStorage.getItem('currentLibraryPath') || ''
  const ids = (resources || []).map((r) => String(r?.id || '').trim()).filter(Boolean)
  if (!libraryPath || !ids.length) {
    toast.add({
      severity: 'warn',
      summary: '批量删除失败',
      detail: '请先选择资源库并选择要删除的合同',
      life: 3000
    })
    return
  }

  // 检查是否有合同下还有文件
  try {
    const checks = await Promise.all(
      resources.map(async (r) => {
        const id = String(r.id).trim()
        const res = await window.electronAPI.contractFiles.getList({ libraryPath, contractId: id })
        const hasFiles = res.success && res.data && res.data.items && res.data.items.length > 0
        return { resource: r, hasFiles }
      })
    )

    const withFiles = checks.filter((c) => c.hasFiles).map((c) => c.resource)
    if (withFiles.length > 0) {
      const names = withFiles.map((r) => r.name || r.contractName).slice(0, 3).join('、')
      const more = withFiles.length > 3 ? `等 ${withFiles.length} 个` : ''
      toast.add({
        severity: 'warn',
        summary: '批量删除受阻',
        detail: `合同“${names}”${more}下还有文件，请先删除文件。`,
        life: 5000
      })
      return
    }
  } catch (error) {
    logger.error('批量检查合同文件失败:', error)
  }

  confirm.require({
    header: '批量删除确认',
    message: `是否删除选中的 ${ids.length} 个合同？该操作不可恢复。`,
    icon: 'pi pi-exclamation-triangle',
    acceptClass: 'p-button-danger',
    acceptLabel: '删除',
    rejectLabel: '取消',
    accept: async () => {
      const result = await window.electronAPI.library.deleteContractInfos({ libraryPath, ids })
      if (!result.success) {
        toast.add({
          severity: 'error',
          summary: '批量删除失败',
          detail: result.error || '删除失败',
          life: 5000
        })
        return
      }
      if (selectedResource.value && ids.includes(String(selectedResource.value.id))) {
        selectedResource.value = null
      }
      resourceRefreshToken.value += 1
      toast.add({
        severity: 'success',
        summary: '已删除',
        detail: `已删除 ${result.data?.deleted ?? ids.length} 个合同`,
        life: 3000
      })
    }
  })
}

/**
 * 处理菜单动作
 * @param key 菜单项键值
 */
const handleMenuAction = (key: string) => {
  switch (key) {
    case 'switch':
      logger.info('切换资源库')
      break
    case 'notification':
      showNotificationCenterDialog.value = true
      break
    case 'billing':
      showBillingDialog.value = true
      break
    case 'settings':
      showSettingsDialog.value = true
      break
    case 'exit':
      window.electronAPI?.window?.close()
      break
  }
}

/**
 * 打开筛选弹窗
 */
const openFilter = () => {
  showAggregatedSearchDialog.value = true
}

const consumeBillingPromptPending = () => {
  try {
    const pending = window.sessionStorage.getItem(BILLING_PROMPT_PENDING_KEY) === '1'
    if (pending) {
      window.sessionStorage.removeItem(BILLING_PROMPT_PENDING_KEY)
    }
    return pending
  } catch {
    return false
  }
}

const openBillingDialogIfNeeded = async (force = false) => {
  await authStore.init()
  if (!authStore.isLoggedIn) return
  try {
    await subscriptionStore.init()
    await subscriptionStore.refreshIfStale(0)
  } catch {
  }
  if (subscriptionStore.isActive) return
  if (!force && !consumeBillingPromptPending()) return
  showBillingDialog.value = true
}

/**
 * 会员服务支付成功回调
 */
const onBillingPaymentSuccess = () => {
  showBillingDialog.value = false
  try {
    window.sessionStorage.removeItem(BILLING_PROMPT_PENDING_KEY)
  } catch {
  }
  toast.add({ severity: 'success', summary: '订阅已生效', detail: '感谢您的购买', life: 3000 })
}

const shortcutDefaults: Record<string, string> = {
  'open-library-menu': 'Ctrl+Shift+L',
  'toggle-sidebar-collapse': 'Ctrl+B',
  'open-aggregated-search': 'Ctrl+Shift+F',
  'open-preferences': 'Ctrl+,',
  'app-exit': 'Ctrl+Q',
  'open-ai-workbench': 'Ctrl+Shift+A',
  'open-contract-tab': 'Ctrl+Shift+C',
}

const normalizeAcceleratorText = (input: string): string => {
  const raw = String(input || '').trim()
  if (!raw) return ''
  const parts = raw.split('+').map(s => s.trim()).filter(Boolean)
  const mods = new Set<string>()
  let key = ''
  for (const p of parts) {
    const lower = p.toLowerCase()
    if (lower === 'ctrl' || lower === 'control') mods.add('Ctrl')
    else if (lower === 'shift') mods.add('Shift')
    else if (lower === 'alt' || lower === 'option') mods.add('Alt')
    else if (lower === 'cmd' || lower === 'command' || lower === 'meta') mods.add('Cmd')
    else key = p.length === 1 ? p.toUpperCase() : p
  }
  const orderedMods = ['Ctrl', 'Shift', 'Alt', 'Cmd'].filter(m => mods.has(m))
  if (!key) return orderedMods.join('+')
  return orderedMods.length ? `${orderedMods.join('+')}+${key}` : key
}

const normalizeShortcutSettings = (input: unknown): Record<string, string> => {
  const raw = (input && typeof input === 'object') ? (input as Record<string, unknown>) : {}
  const out: Record<string, string> = {}
  Object.keys(shortcutDefaults).forEach((id) => {
    const v = raw[id]
    const text = typeof v === 'string' && v.trim() ? v.trim() : shortcutDefaults[id]
    out[id] = normalizeAcceleratorText(text)
  })
  return out
}

const registerShortcut = async (id: string, accelerator: string, description: string) => {
  if (!window.electronAPI?.shortcut) return
  const acc = normalizeAcceleratorText(accelerator)
  if (!acc) return
  await window.electronAPI.shortcut.register({ id, accelerator: acc, description })
}

const applyShortcutSettings = async (settings?: Record<string, string>) => {
  const shortcutSettings = settings || (() => {
    return shortcutDefaults
  })()

  const normalized = normalizeShortcutSettings(shortcutSettings)
  const used = new Set<string>()
  const ordered: Array<{ id: string; description: string }> = [
    { id: 'open-library-menu', description: '打开资源库菜单' },
    { id: 'toggle-sidebar-collapse', description: '折叠/展开左侧菜单' },
    { id: 'open-aggregated-search', description: '打开聚合搜索' },
    { id: 'open-preferences', description: '打开偏好设置' },
    { id: 'app-exit', description: '退出应用' },
    { id: 'open-ai-workbench', description: '打开 AI 工作台' },
    { id: 'open-contract-tab', description: '打开合同选项卡' },
  ]
  for (const item of ordered) {
    const acc = normalized[item.id]
    if (!acc) continue
    const key = acc.toLowerCase()
    if (used.has(key)) {
      logger.warn(`快捷键冲突，已跳过：${item.id} (${acc})`)
      continue
    }
    used.add(key)
    await registerShortcut(item.id, acc, item.description)
  }
}

let unsubscribeShortcutTriggered: null | (() => void) = null
let unsubscribeConfigChanged: null | (() => void) = null

watch(() => route.fullPath, async () => {
  syncSelectionFromRoute()
  try {
    await sidebarStore.load()
  } catch {
    // ignore sidebar refresh failures
  }
}, { immediate: true })

watch(resourceRefreshToken, async () => {
  try {
    await sidebarStore.load()
  } catch {
    // ignore sidebar refresh failures
  }
})

// ─── 生命周期钩子 ───────────────────────────────────────────────

onMounted(async () => {
  // 加载侧边栏数据
  try {
    await sidebarStore.load()
  } catch {
    // 未初始化时不强制加载
  }

  // 注册快捷键
  useShortcut('escape', () => {
    if (showAggregatedSearchDialog.value) {
      showAggregatedSearchDialog.value = false
    } else {
      selectedResource.value = null
    }
  })

  unsubscribeShortcutTriggered = window.electronAPI?.shortcut?.onTriggered?.(async (payload) => {
    if (!payload || typeof payload !== 'object') return
    const id = String((payload as any).id || '')
    if (id === 'app-exit') {
      window.electronAPI?.window?.close()
      return
    }
    if (showSettingsDialog.value) return

    eventBus.emit('shortcut:triggered', payload as any)

    if (id === 'open-library-menu') {
      return
    }
    if (id === 'toggle-sidebar-collapse') {
      sidebarStore.toggleSidebarCollapsed()
      return
    }
    if (id === 'open-aggregated-search') {
      openFilter()
      return
    }
    if (id === 'open-preferences') {
      showSettingsDialog.value = true
      return
    }
    if (id === 'open-ai-workbench') {
      try {
        await router.push({ name: 'AIWorkbench' })
      } catch {}
      return
    }
    if (id === 'open-contract-tab') {
      await selectCategory('all')
    }
  }) || null

  unsubscribeConfigChanged = window.electronAPI?.config?.onChanged?.((config) => {
    const raw = (config && typeof config === 'object') ? (config as any).shortcutSettings : undefined
    void applyShortcutSettings(raw)
  }) || null

  try {
    const res = await window.electronAPI?.config?.getItem?.('shortcutSettings')
    const raw = (res && (res as any).success) ? (res as any).data : undefined
    await applyShortcutSettings(raw)
  } catch {
    await applyShortcutSettings()
  }

  await openBillingDialogIfNeeded(true)
})

onBeforeUnmount(() => {
  stopSidebarResize()
  unsubscribeShortcutTriggered?.()
  unsubscribeConfigChanged?.()
})
</script>

<style scoped>
/* 左侧边栏样式 */
.left-sidebar {
  flex-shrink: 0;
}

.sidebar-resizer {
  position: absolute;
  top: 0;
  right: -3px;
  height: 100%;
  width: 6px;
  cursor: col-resize;
  z-index: 30;
  -webkit-app-region: no-drag;
}

.sidebar-resizer:hover,
.sidebar-resizer.is-resizing {
  background: rgba(0, 0, 0, 0.06);
}

/* 中间内容区样式 */
.main-content {
  flex: 1;
  min-width: 0;
}

.batch-import-scanner {
  position: relative;
  width: 88px;
  height: 88px;
}

.batch-import-scanner__icon {
  position: absolute;
  inset: 0;
  transform-origin: 68% 76%;
}

.batch-import-scanner.is-active .batch-import-scanner__icon {
  animation: batch-import-scanner-search 2s ease-in-out infinite;
}

.batch-import-scanner__lens {
  position: absolute;
  top: 8px;
  left: 8px;
  width: 58px;
  height: 58px;
  border: 4px solid var(--btn-primary-bg);
  border-radius: 9999px;
  background: radial-gradient(circle at 32% 32%, rgba(255, 255, 255, 0.95), rgba(255, 255, 255, 0.2) 38%, rgba(99, 102, 241, 0.14) 100%);
  box-shadow: 0 10px 24px rgba(99, 102, 241, 0.18);
  overflow: visible;
}

.batch-import-scanner__glow {
  position: absolute;
  inset: 6px;
  border-radius: 9999px;
  background: linear-gradient(135deg, rgba(99, 102, 241, 0.22), rgba(14, 165, 233, 0.06));
}

.batch-import-scanner__file-name {
  position: absolute;
  top: 50%;
  left: 50%;
  z-index: 3;
  transform: translate(-50%, -50%);
  text-align: center;
  font-size: 9px;
  line-height: 1.2;
  font-weight: 600;
  color: var(--content-text);
  white-space: nowrap;
  word-break: normal;
  overflow: visible;
  max-width: none;
  padding: 0 4px;
  pointer-events: none;
}

.batch-import-scanner__scanline {
  position: absolute;
  left: 10px;
  width: 34px;
  height: 3px;
  border-radius: 9999px;
  background: linear-gradient(90deg, rgba(14, 165, 233, 0.1), rgba(14, 165, 233, 0.95), rgba(14, 165, 233, 0.1));
  box-shadow: 0 0 14px rgba(14, 165, 233, 0.55);
  opacity: 0.45;
}

.batch-import-scanner.is-active .batch-import-scanner__scanline {
  animation: batch-import-scan-line 1.5s ease-in-out infinite;
}

.batch-import-scanner__handle {
 position: absolute;
  right: 3px;
  bottom: 18px;
  width: 30px;
  height: 8px;
  border-radius: 9999px;
  background: linear-gradient(205deg, var(--btn-primary-bg), rgba(99, 102, 241, 0.72));
  transform: rotate(58deg);
  transform-origin: left center;
  box-shadow: 0 6px 18px rgba(99, 102, 241, 0.18);
}

@keyframes batch-import-scan-line {
  0% {
    top: 14px;
    opacity: 0.2;
  }

  50% {
    top: 28px;
    opacity: 1;
  }

  100% {
    top: 44px;
    opacity: 0.2;
  }
}

@keyframes batch-import-scanner-search {
  0%,
  100% {
    transform: translateX(-16px) translateY(-4px) rotate(-4deg);
  }

  50% {
    transform: translateX(16px) translateY(4px) rotate(4deg);
  }
}

/* 右侧面板样式 */
.right-panel {
  flex-shrink: 0;
}

/*
 * PrimeVue 组件主题适配已迁移到 styles/primevue-theme.css
 * 仅保留布局相关的 scoped 样式
 */
</style>
