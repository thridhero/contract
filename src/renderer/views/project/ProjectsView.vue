<template>
  <div
    class="projects-container flex flex-col h-full"
    :style="{ backgroundColor: theme.content.background }"
    @dragover.prevent="handleDragOver"
    @dragleave.prevent="handleDragLeave"
    @drop.prevent="handleDrop"
  >
    <!-- 顶部工具栏 -->
    <div
      class="toolbar flex items-center justify-between px-4 py-2"
      :style="{
        backgroundColor: theme.content.cardBackground,
        borderBottom: `1px solid ${theme.content.border}`
      }"
    >
      <div class="toolbar-left flex items-center">
        <Button
          text
          size="small"
          class="toolbar-btn transition-colors duration-200"
          :style="{ color: theme.content.text, '-webkit-app-region': 'no-drag' }"
          @click="sidebarCollapsed = !sidebarCollapsed"
          title="收起/展开侧边栏"
        >
          <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </Button>
      </div>
      <div class="toolbar-right flex items-center gap-2">
        <Button
          text
          size="small"
          class="toolbar-btn transition-colors duration-200"
          :style="{ color: theme.content.text, '-webkit-app-region': 'no-drag' }"
          title="新建项目"
          @click="showCreateModal = true"
        >
          <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </Button>
        <!-- 视图切换 -->
        <Button
          text
          size="small"
          class="toolbar-btn transition-colors duration-200"
          :style="{ color: viewMode === 'grid' ? theme.button.primary.background : theme.content.text, '-webkit-app-region': 'no-drag' }"
          title="网格视图"
          @click="viewMode = 'grid'"
        >
          <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
          </svg>
        </Button>
        <Button
          text
          size="small"
          class="toolbar-btn transition-colors duration-200"
          :style="{ color: viewMode === 'list' ? theme.button.primary.background : theme.content.text, '-webkit-app-region': 'no-drag' }"
          title="列表视图"
          @click="viewMode = 'list'"
        >
          <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>
          </svg>
        </Button>
      </div>
    </div>

    <!-- 三栏布局区域 -->
    <div class="content-area flex flex-1 overflow-hidden">
      <!-- 左侧分类栏 -->
      <div
        class="nav-list flex flex-col"
        :style="{
          width: sidebarCollapsed ? '0' : '220px',
          backgroundColor: theme.sidebar.background,
          borderRight: `1px solid ${theme.content.border}`,
          overflow: 'hidden',
          transition: 'width 0.3s ease',
          flexShrink: 0
        }"
      >
        <div class="nav-content flex-1 overflow-y-auto p-2">
          <!-- 快捷分类 -->
          <div class="mb-3">
            <p class="text-xs font-semibold px-3 pb-1 opacity-50" :style="{ color: theme.content.text }">快捷分类</p>
            <div
              v-for="item in quickCategories"
              :key="item.key"
              class="category-item flex items-center px-3 py-2 rounded-lg cursor-pointer mb-0.5"
              :style="{
                backgroundColor: selectedCategory === item.key ? theme.sidebar.activeBackground : 'transparent',
                color: theme.sidebar.text
              }"
              @click="selectCategory(item.key)"
            >
              <span class="mr-2 text-base">{{ item.icon }}</span>
              <span class="flex-1 text-sm">{{ item.name }}</span>
              <span class="text-xs opacity-60">{{ item.count }}</span>
            </div>
          </div>

          <!-- 智能文件夹 -->
          <div class="mb-3">
            <p class="text-xs font-semibold px-3 pb-1 opacity-50" :style="{ color: theme.content.text }">智能文件夹</p>
            <div
              v-for="item in smartFolders"
              :key="item.key"
              class="category-item flex items-center px-3 py-2 rounded-lg cursor-pointer mb-0.5"
              :style="{
                backgroundColor: selectedCategory === item.key ? theme.sidebar.activeBackground : 'transparent',
                color: theme.sidebar.text
              }"
              @click="selectCategory(item.key)"
            >
              <span class="mr-2 text-base">{{ item.icon }}</span>
              <span class="flex-1 text-sm">{{ item.name }}</span>
              <span v-if="item.count > 0" class="text-xs opacity-60">{{ item.count }}</span>
            </div>
          </div>

          <!-- 按状态分组 -->
          <div>
            <p class="text-xs font-semibold px-3 pb-1 opacity-50" :style="{ color: theme.content.text }">按状态</p>
            <div
              v-for="s in statusList"
              :key="s.value"
              class="category-item flex items-center px-3 py-2 rounded-lg cursor-pointer mb-0.5"
              :style="{
                backgroundColor: selectedCategory === `status:${s.value}` ? theme.sidebar.activeBackground : 'transparent',
                color: theme.sidebar.text
              }"
              @click="selectCategory(`status:${s.value}`)"
            >
              <span class="w-2 h-2 rounded-full mr-2 flex-shrink-0" :style="{ backgroundColor: s.color }"></span>
              <span class="flex-1 text-sm">{{ s.label }}</span>
              <span class="text-xs opacity-60">{{ store.stats.by_status[s.value] ?? 0 }}</span>
            </div>
          </div>
        </div>

        <!-- 底部新建按钮 -->
        <div class="p-2" :style="{ borderTop: `1px solid ${theme.content.border}` }">
          <button
            class="w-full flex items-center justify-center px-3 py-2 rounded-lg text-sm"
            :style="{ backgroundColor: theme.button.primary.background, color: theme.button.primary.text }"
            @click="showCreateModal = true"
          >
            <span class="mr-1">+</span> 新建项目
          </button>
        </div>
      </div>

      <!-- 中间项目列表 -->
      <div
        class="detail-area flex-1 flex flex-col overflow-hidden relative"
        :class="{ 'drag-active': isDragging }"
        :style="{ backgroundColor: isDragging ? '#e3f2fd' : theme.content.background, transition: 'background-color 0.3s' }"
      >
        <!-- 拖拽提示 -->
        <div
          v-if="isDragging"
          class="drag-overlay absolute inset-0 flex items-center justify-center pointer-events-none z-10"
        >
          <div
            class="text-center p-8 rounded-2xl border-2 border-dashed"
            :style="{ borderColor: theme.button.primary.background, backgroundColor: 'rgba(255,255,255,0.9)' }"
          >
            <div class="text-6xl mb-4">📁</div>
            <p class="text-lg font-medium" :style="{ color: theme.content.text }">释放鼠标上传文件</p>
          </div>
        </div>

        <!-- 中间头部 -->
        <div
          class="detail-header flex items-center justify-between px-4 py-2.5"
          :style="{ backgroundColor: theme.content.cardBackground, borderBottom: `1px solid ${theme.content.border}` }"
        >
          <h2 class="text-base font-semibold" :style="{ color: theme.content.text }">
            {{ currentTitle }} <span class="text-sm font-normal opacity-50">({{ filteredProjects.length }})</span>
          </h2>
          <div class="flex items-center gap-2">
            <div class="relative">
              <input
                v-model="searchQuery"
                type="text"
                placeholder="搜索项目..."
                class="w-44 px-3 py-1.5 pl-8 text-sm rounded-lg border-none outline-none"
                :style="{ backgroundColor: theme.content.background, color: theme.content.text }"
                @input="onSearch"
              />
              <svg class="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 opacity-40" :style="{ color: theme.content.text }" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
              </svg>
            </div>
            <!-- 排序 -->
            <select
              v-model="sortBy"
              class="text-sm px-2 py-1.5 rounded-lg border-none outline-none"
              :style="{ backgroundColor: theme.content.background, color: theme.content.text }"
            >
              <option value="created_at">创建时间</option>
              <option value="updated_at">更新时间</option>
              <option value="name">名称</option>
              <option value="status">状态</option>
            </select>
          </div>
        </div>

        <!-- 项目卡片区域 -->
        <div class="detail-content flex-1 overflow-y-auto p-4">
          <!-- 加载中 -->
          <div v-if="store.loading" class="flex items-center justify-center h-32">
            <span class="text-sm opacity-50" :style="{ color: theme.content.text }">加载中...</span>
          </div>

          <!-- 空状态 -->
          <div
            v-else-if="filteredProjects.length === 0"
            class="empty-state flex flex-col items-center justify-center h-64"
          >
            <div class="text-6xl mb-4">📋</div>
            <p class="text-base opacity-60" :style="{ color: theme.content.text }">暂无项目</p>
            <p class="text-sm opacity-40 mt-1 mb-4" :style="{ color: theme.content.text }">点击「新建项目」开始申请软著</p>
            <button
              class="px-4 py-2 rounded-lg text-sm"
              :style="{ backgroundColor: theme.button.primary.background, color: theme.button.primary.text }"
              @click="showCreateModal = true"
            >新建项目</button>
          </div>

          <!-- 网格视图 -->
          <div v-else-if="viewMode === 'grid'" class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
            <div
              v-for="project in filteredProjects"
              :key="project.id"
              class="project-card rounded-xl overflow-hidden cursor-pointer transition-all hover:shadow-lg"
              :style="{
                backgroundColor: theme.content.cardBackground,
                border: store.selectedProject?.id === project.id
                  ? `2px solid ${theme.button.primary.background}`
                  : `1px solid ${theme.content.border}`
              }"
              @click="store.selectProject(project)"
              @dblclick="openProjectFolder(project)"
            >
              <!-- 顶部彩色条 -->
              <div class="h-1.5 w-full" :style="{ backgroundColor: getStatusColor(project.status) }"></div>
              <div class="p-3">
                <!-- 状态徽标 -->
                <div class="flex items-start justify-between mb-2">
                  <span
                    class="text-xs px-2 py-0.5 rounded-full font-medium"
                    :style="{ backgroundColor: getStatusBg(project.status), color: getStatusColor(project.status) }"
                  >{{ getStatusLabel(project.status) }}</span>
                  <span class="text-xs opacity-50" :style="{ color: theme.content.text }">{{ project.version }}</span>
                </div>
                <!-- 软件名称 -->
                <h3 class="text-sm font-semibold mb-1 truncate" :style="{ color: theme.content.text }">{{ project.name }}</h3>
                <p class="text-xs opacity-60 truncate mb-3" :style="{ color: theme.content.text }">{{ project.applicant_name }}</p>
                <!-- 进度条 -->
                <div class="progress-section">
                  <div class="flex justify-between text-xs opacity-50 mb-1" :style="{ color: theme.content.text }">
                    <span>申请进度</span>
                    <span>{{ getStatusProgress(project.status) }}%</span>
                  </div>
                  <div class="h-1.5 rounded-full overflow-hidden" :style="{ backgroundColor: theme.content.background }">
                    <div
                      class="h-full rounded-full transition-all"
                      :style="{ width: `${getStatusProgress(project.status)}%`, backgroundColor: getStatusColor(project.status) }"
                    ></div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- 列表视图 -->
          <div v-else class="flex flex-col gap-2">
            <div
              v-for="project in filteredProjects"
              :key="project.id"
              class="project-row flex items-center px-4 py-3 rounded-xl cursor-pointer transition-all"
              :style="{
                backgroundColor: theme.content.cardBackground,
                border: store.selectedProject?.id === project.id
                  ? `2px solid ${theme.button.primary.background}`
                  : `1px solid ${theme.content.border}`
              }"
              @click="store.selectProject(project)"
              @dblclick="openProjectFolder(project)"
            >
              <div class="w-2 h-2 rounded-full mr-3 flex-shrink-0" :style="{ backgroundColor: getStatusColor(project.status) }"></div>
              <div class="flex-1 min-w-0">
                <span class="text-sm font-medium" :style="{ color: theme.content.text }">{{ project.name }}</span>
                <span class="text-xs opacity-50 ml-2" :style="{ color: theme.content.text }">{{ project.version }}</span>
              </div>
              <span class="text-xs opacity-60 mr-4 w-20 truncate" :style="{ color: theme.content.text }">{{ project.applicant_name }}</span>
              <span
                class="text-xs px-2 py-0.5 rounded-full mr-4"
                :style="{ backgroundColor: getStatusBg(project.status), color: getStatusColor(project.status) }"
              >{{ getStatusLabel(project.status) }}</span>
              <span class="text-xs opacity-40 w-24 text-right" :style="{ color: theme.content.text }">{{ formatDate(project.created_at) }}</span>
            </div>
          </div>
        </div>

        <!-- 上传进度条 -->
        <div
          v-if="uploadProgress.show"
          class="upload-progress-bar px-4 py-3"
          :style="{ backgroundColor: theme.content.cardBackground, borderTop: `1px solid ${theme.content.border}` }"
        >
          <div class="flex items-center justify-between mb-1">
            <span class="text-sm font-medium" :style="{ color: theme.content.text }">{{ uploadProgress.status }}</span>
            <span class="text-sm" :style="{ color: theme.content.text }">{{ uploadProgress.percentage }}%</span>
          </div>
          <div class="h-2 rounded-full overflow-hidden" :style="{ backgroundColor: theme.content.background }">
            <div
              class="h-full rounded-full transition-all duration-300"
              :style="{ width: `${uploadProgress.percentage}%`, backgroundColor: theme.button.primary.background }"
            ></div>
          </div>
        </div>
      </div>

      <!-- 右侧属性面板 -->
      <div
        class="properties-panel flex flex-col"
        :style="{
          width: '280px',
          flexShrink: 0,
          backgroundColor: theme.sidebar.background,
          borderLeft: `1px solid ${theme.content.border}`
        }"
      >
        <div class="properties-content flex-1 overflow-y-auto p-3">
          <!-- 有选中项目时 -->
          <template v-if="store.selectedProject">
            <div
              class="preview-section mb-3 rounded-xl flex items-center justify-center h-24"
              :style="{ backgroundColor: getStatusBg(store.selectedProject.status) }"
            >
              <div class="text-center">
                <div class="text-3xl mb-1">📋</div>
                <span
                  class="text-xs font-medium px-3 py-1 rounded-full"
                  :style="{ backgroundColor: getStatusColor(store.selectedProject.status), color: '#fff' }"
                >{{ getStatusLabel(store.selectedProject.status) }}</span>
              </div>
            </div>

            <!-- 基本信息 -->
            <div class="info-section mb-3">
              <h4 class="text-xs font-semibold mb-2" :style="{ color: theme.content.text }">基本信息</h4>
              <div class="space-y-1.5">
                <InfoRow label="软件名称" :value="store.selectedProject.name" :theme="theme" />
                <InfoRow label="版本号" :value="store.selectedProject.version" :theme="theme" />
                <InfoRow label="申请人" :value="store.selectedProject.applicant_name" :theme="theme" />
                <InfoRow
                  label="申请类型"
                  :value="store.selectedProject.applicant_type === 'individual' ? '个人' : '企业'"
                  :theme="theme"
                />
                <InfoRow label="完成日期" :value="store.selectedProject.completion_date" :theme="theme" />
                <InfoRow v-if="store.selectedProject.application_no" label="申请号" :value="store.selectedProject.application_no" :theme="theme" />
                <InfoRow v-if="store.selectedProject.registration_no" label="登记号" :value="store.selectedProject.registration_no" :theme="theme" />
                <InfoRow label="创建时间" :value="formatDate(store.selectedProject.created_at)" :theme="theme" />
              </div>
            </div>

            <!-- 进度 -->
            <div class="info-section mb-3">
              <h4 class="text-xs font-semibold mb-2" :style="{ color: theme.content.text }">申请进度</h4>
              <div class="h-2 rounded-full overflow-hidden mb-1" :style="{ backgroundColor: theme.content.border }">
                <div
                  class="h-full rounded-full"
                  :style="{ width: `${getStatusProgress(store.selectedProject.status)}%`, backgroundColor: getStatusColor(store.selectedProject.status) }"
                ></div>
              </div>
              <p class="text-xs opacity-50 text-right" :style="{ color: theme.content.text }">
                {{ getStatusProgress(store.selectedProject.status) }}%
              </p>
            </div>

            <!-- 状态推进 -->
            <div class="info-section mb-3">
              <h4 class="text-xs font-semibold mb-2" :style="{ color: theme.content.text }">更新状态</h4>
              <Select
                v-model="editingStatus"
                :options="statusList"
                option-label="label"
                option-value="value"
                class="w-full text-xs"
                @change="onStatusChange"
              />
            </div>

            <!-- 备注 -->
            <div class="info-section mb-3">
              <h4 class="text-xs font-semibold mb-2" :style="{ color: theme.content.text }">备注</h4>
              <Textarea
                v-model="editingRemark"
                rows="3"
                class="w-full text-xs"
                placeholder="添加备注..."
                autoResize
                @blur="saveRemark"
              />
            </div>

            <!-- 操作按钮 -->
            <div class="space-y-1.5">
              <Button
                label="打开项目文件夹"
                icon="pi pi-folder-open"
                severity="secondary"
                class="w-full"
                size="small"
                @click="openProjectFolder(store.selectedProject!)"
              />
              <Button
                label="删除"
                icon="pi pi-trash"
                severity="danger"
                outlined
                class="w-full"
                size="small"
                @click="confirmDelete"
              />
            </div>
          </template>

          <!-- 空状态 -->
          <div v-else class="flex flex-col items-center justify-center h-full">
            <div class="text-3xl mb-2 opacity-30">📋</div>
            <p class="text-xs opacity-40" :style="{ color: theme.content.text }">选择项目查看详情</p>
          </div>
        </div>
      </div>
    </div>

    <!-- 新建项目弹窗 -->
    <CreateProjectModal v-model:visible="showCreateModal" @created="onProjectCreated" />

    <!-- 确认删除 -->
    <ConfirmDialog />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, defineComponent, h, type PropType } from 'vue'
import { useConfirm } from 'primevue/useconfirm'
import Button from 'primevue/button'
import Textarea from 'primevue/textarea'
import Select from 'primevue/select'
import ConfirmDialog from 'primevue/confirmdialog'
import { defaultTheme } from '../../themes/default'
import { useProjectStore } from '../../stores/project/projectStore'
import CreateProjectModal from './components/CreateProjectModal.vue'
import type { Project, ProjectStatus } from '@shared/types/project.types'

// Simple InfoRow component
const InfoRow = defineComponent({
  props: {
    label: String,
    value: String,
    theme: Object as PropType<typeof defaultTheme>,
  },
  setup(props) {
    return () => h('div', { class: 'flex' }, [
      h('span', { class: 'w-16 text-xs opacity-50', style: { color: props.theme?.content?.text } }, props.label),
      h('span', { class: 'flex-1 text-xs', style: { color: props.theme?.content?.text } }, props.value ?? '-'),
    ])
  }
})

const theme = defaultTheme
const store = useProjectStore()
const confirm = useConfirm()

const sidebarCollapsed = ref(false)
const showCreateModal = ref(false)
const searchQuery = ref('')
const selectedCategory = ref('all')
const viewMode = ref<'grid' | 'list'>('grid')
const sortBy = ref('created_at')
const editingStatus = ref<ProjectStatus>('preparing')
const editingRemark = ref('')

// 拖拽 & 上传
const isDragging = ref(false)
const dragCounter = ref(0)
const uploadProgress = ref({ show: false, percentage: 0, status: '' })

// ─── 状态配置 ──────────────────────────────────────────────────

const statusList = [
  { value: 'preparing',   label: '准备材料', color: '#6366f1' },
  { value: 'submitted',   label: '已提交',   color: '#3b82f6' },
  { value: 'accepted',    label: '已受理',   color: '#0ea5e9' },
  { value: 'correction',  label: '需补正',   color: '#f59e0b' },
  { value: 'approved',    label: '已批准',   color: '#10b981' },
  { value: 'registered',  label: '已登记',   color: '#22c55e' },
  { value: 'rejected',    label: '已驳回',   color: '#ef4444' },
]

const STATUS_PROGRESS: Record<string, number> = {
  preparing: 10, submitted: 30, accepted: 50, correction: 40,
  approved: 80, registered: 100, rejected: 60,
}

function getStatusLabel(status: string) {
  return statusList.find(s => s.value === status)?.label ?? status
}

function getStatusColor(status: string) {
  return statusList.find(s => s.value === status)?.color ?? '#999'
}

function getStatusBg(status: string) {
  const color = getStatusColor(status)
  return color + '20'  // 12% opacity
}

function getStatusProgress(status: string) {
  return STATUS_PROGRESS[status] ?? 0
}

// ─── 分类导航数据 ──────────────────────────────────────────────

const quickCategories = computed(() => [
  { key: 'all',           name: '全部项目', icon: '📚', count: store.totalCount },
  { key: 'recent',        name: '最近更新', icon: '🕐', count: 0 },
])

const smartFolders = computed(() => [
  {
    key: 'status:correction',
    name: '需要补正',
    icon: '⚠️',
    count: store.stats.by_status['correction'] ?? 0
  },
])

// ─── 过滤 & 排序 ───────────────────────────────────────────────

const filteredProjects = computed(() => {
  let list = [...store.projects]

  // 按分类过滤
  if (selectedCategory.value.startsWith('status:')) {
    const status = selectedCategory.value.split(':')[1]
    list = list.filter(p => p.status === status)
  } else if (selectedCategory.value === 'recent') {
    list = [...list].sort((a, b) => b.updated_at.localeCompare(a.updated_at)).slice(0, 20)
  }

  // 搜索过滤
  if (searchQuery.value.trim()) {
    const q = searchQuery.value.toLowerCase()
    list = list.filter(p =>
      p.name.toLowerCase().includes(q) ||
      p.applicant_name.toLowerCase().includes(q) ||
      (p.application_no && p.application_no.toLowerCase().includes(q))
    )
  }

  // 排序
  list.sort((a, b) => {
    if (sortBy.value === 'name') return a.name.localeCompare(b.name)
    if (sortBy.value === 'status') return a.status.localeCompare(b.status)
    if (sortBy.value === 'updated_at') return b.updated_at.localeCompare(a.updated_at)
    return b.created_at.localeCompare(a.created_at)
  })

  return list
})

const currentTitle = computed(() => {
  if (selectedCategory.value.startsWith('status:')) {
    const status = selectedCategory.value.split(':')[1]
    return getStatusLabel(status)
  }
  const cat = quickCategories.value.find(c => c.key === selectedCategory.value)
    || smartFolders.value.find(c => c.key === selectedCategory.value)
  return cat?.name ?? '项目'
})

// ─── 方法 ─────────────────────────────────────────────────────

function selectCategory(key: string) {
  selectedCategory.value = key
}

let searchTimer: ReturnType<typeof setTimeout> | null = null
function onSearch() {
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    // 本地过滤，无需异步调用
  }, 300)
}

function formatDate(dt: string) {
  if (!dt) return ''
  return dt.slice(0, 10)
}

function openProjectFolder(project: Project) {
  window.electronAPI.fs.openFolder(project.folder_path)
}

async function onStatusChange() {
  if (!store.selectedProject) return
  await store.updateProject({ id: store.selectedProject.id, status: editingStatus.value })
}

async function saveRemark() {
  if (!store.selectedProject) return
  if (editingRemark.value === (store.selectedProject.remark ?? '')) return
  await store.updateProject({ id: store.selectedProject.id, remark: editingRemark.value })
}

function confirmDelete() {
  if (!store.selectedProject) return
  confirm.require({
    message: `确定要删除项目「${store.selectedProject.name}」吗？此操作不可恢复。`,
    header: '删除确认',
    icon: 'pi pi-exclamation-triangle',
    rejectProps: { label: '取消', severity: 'secondary', outlined: true },
    acceptProps: { label: '删除', severity: 'danger' },
    accept: async () => {
      if (store.selectedProject) {
        await store.deleteProject(store.selectedProject.id)
      }
    },
  })
}

function onProjectCreated(projectId: string) {
  const project = store.projects.find(p => p.id === projectId)
  if (project) store.selectProject(project)
}

// 监听选中项目变化，同步编辑字段
watch(() => store.selectedProject, (p) => {
  if (p) {
    editingStatus.value = p.status
    editingRemark.value = p.remark ?? ''
  }
})

// ─── 拖拽处理 ─────────────────────────────────────────────────

function handleDragOver(e: DragEvent) {
  e.preventDefault()
  dragCounter.value++
  if (!isDragging.value) isDragging.value = true
}

function handleDragLeave(e: DragEvent) {
  e.preventDefault()
  dragCounter.value--
  if (dragCounter.value === 0) isDragging.value = false
}

function handleDrop(e: DragEvent) {
  e.preventDefault()
  isDragging.value = false
  dragCounter.value = 0
  const files = e.dataTransfer?.files
  if (files && files.length > 0 && store.selectedProject) {
    handleFilesUpload(files)
  }
}

async function handleFilesUpload(files: FileList) {
  if (!store.selectedProject) return

  const destDir = store.selectedProject.folder_path
  const srcPaths: string[] = []
  for (let i = 0; i < files.length; i++) {
    srcPaths.push((files[i] as File & { path: string }).path)
  }

  uploadProgress.value = { show: true, percentage: 0, status: '准备上传...' }

  // 监听进度
  const unsubscribe = window.electronAPI.fs.onCopyProgress((progress: unknown) => {
    const p = progress as { percent: number; fileName: string; fileIndex: number; totalFiles: number }
    uploadProgress.value.percentage = p.percent
    uploadProgress.value.status = `上传 ${p.fileName} (${p.fileIndex + 1}/${p.totalFiles})`
  })

  try {
    const res = await window.electronAPI.fs.copyFiles(srcPaths, destDir)
    if (res.success && res.data) {
      uploadProgress.value.percentage = 100
      uploadProgress.value.status = `上传完成 (${res.data.length} 个文件)`

      // 插入文档记录到数据库
      for (const result of res.data) {
        const fileName = result.destPath.split(/[\\/]/).pop() ?? ''
        const ext = fileName.split('.').pop()?.toLowerCase() ?? ''
        await window.electronAPI.document.insert({
          id: window.crypto.randomUUID(),
          project_id: store.selectedProject!.id,
          category: '04-documents',
          name: fileName,
          file_name: fileName,
          file_path: result.destPath,
          file_size: result.fileSize,
          file_type: ext,
          checksum: result.checksum,
        })
      }
    }
  } finally {
    unsubscribe()
    setTimeout(() => { uploadProgress.value.show = false }, 3000)
  }
}

// ─── 初始化 ───────────────────────────────────────────────────

onMounted(async () => {
  await store.loadProjects(false)
})
</script>

<style scoped>
/* 组件特定样式 */
</style>
