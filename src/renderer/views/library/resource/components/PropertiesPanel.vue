<template>
  <div
    class="properties-panel flex flex-col h-full overflow-hidden transition-colors duration-200"
    :style="{ backgroundColor: 'var(--sidebar-bg)' }"
  >
    <!-- 标题栏：窗口控制按钮 -->
    <div
      class="title-bar flex items-center justify-end px-3 py-2 transition-colors duration-200"
      style="-webkit-app-region: drag"
    >
      <div class="flex items-center gap-2" style="-webkit-app-region: no-drag">
        <Button
          severity="secondary"
          text
          title="置顶"
          icon="pi pi-thumbtack"
          size="small"
          class="toolbar-btn transition-colors duration-200 "
          style="color: var(--content-text)"
          @click="togglePin"
        />
        <Button
          severity="secondary"
          text
          title="最小化"
          icon="pi pi-minus"
          size="small"
          class="toolbar-btn transition-colors duration-200 "
          style="color: var(--sidebar-text)"
          @click="minimizeWindow"
        />
        <Button
          severity="secondary"
          text
          title="最大化"
          :icon="isMaximized ? 'pi pi-window-minimize' : 'pi pi-window-maximize'"
          size="small"
          class="toolbar-btn transition-colors duration-200 "
          style="color: var(--sidebar-text)"
          @click="toggleMaximize"
        />
        <Button
          severity="secondary"
          text
          title="关闭"
          icon="pi pi-times"
          size="small"
          class="toolbar-btn transition-colors duration-200 "
          style="color: var(--sidebar-text)"
          @click="closeWindow"
        />
      </div>
    </div>

    <!-- 内容区 -->
    <div class="properties-content flex-1 overflow-y-auto p-3">
      <div v-if="selectedResource" class="properties-content-inner">
        <!-- 预览区 -->
        <div class="preview-section mb-3 rounded-lg overflow-hidden transition-colors duration-200">
          <img
            v-if="selectedResource.type === 'image' && selectedResource.thumbnail"
            :src="selectedResource.thumbnail"
            class="w-full h-24 object-cover"
            :alt="selectedResource.name"
          />
          <img
            v-else-if="selectedResource.type === 'contract-info' && selectedResource.thumbnail"
            :src="selectedResource.thumbnail"
            class="w-full h-24 object-cover"
            :alt="selectedResource.name"
          />
          <div v-else-if="selectedResource.type === 'contract-info'" class="h-24 flex items-center justify-center">
            <i
              v-if="selectedResource.projectIcon"
              :class="selectedResource.projectIcon"
              class="text-3xl"
              :style="{ color: selectedResource.projectColor || 'var(--btn-primary-bg)' }"
            ></i>
            <img v-else :src="contractPreviewPlaceholder" class="w-8 h-8 opacity-60" alt="合同预览" />
          </div>
          <div v-else class="h-24 flex items-center justify-center text-5xl">
            {{ getResourceIcon(selectedResource.type) }}
          </div>
        </div>

        <template v-if="selectedResource.type === 'contract-info'">
          <div class="info-section mb-4">
            <h4
              class=" font-semibold mb-2 uppercase tracking-wide transition-colors duration-200"
              :style="{ color: 'var(--content-text-secondary)' }"
            >
              关键信息
            </h4>
            <div class="space-y-2">
               <div class="flex items-center">
                <span class="w-16  transition-colors duration-200" :style="{ color: 'var(--content-text-secondary)' }">名称</span>
                <span class="flex-1  font-bold transition-colors duration-200" :style="{ color: 'var(--content-text-secondary)' }">
                  {{ selectedResource.name }}
                </span>
              </div>
              <div class="flex items-center">
                <span class="w-16  transition-colors duration-200" :style="{ color: 'var(--content-text-secondary)' }">合同编号</span>
                <span class="flex-1  font-bold transition-colors duration-200" :style="{ color: 'var(--content-text-secondary)' }">
                  {{ selectedResource.version || selectedResource.size || '-' }}
                </span>
              </div>
              <div class="flex items-center">
                <span class="w-16  transition-colors duration-200" :style="{ color: 'var(--content-text-secondary)' }">甲方</span>
                <span class="flex-1  font-bold truncate transition-colors duration-200" :style="{ color: 'var(--content-text-secondary)' }">
                  {{ selectedResource.copyrightOwner || '-' }}
                </span>
              </div>
              <div class="flex items-center">
                <span class="w-16  transition-colors duration-200" :style="{ color: 'var(--content-text-secondary)' }">乙方</span>
                <span class="flex-1  truncate transition-colors duration-200" :style="{ color: 'var(--content-text-secondary)' }">
                  {{ selectedResource.partyBName || '-' }}
                </span>
              </div>
              <div class="flex items-center">
                <span class="w-16  transition-colors duration-200" :style="{ color: 'var(--content-text-secondary)' }">金额</span>
                <button
                  type="button"
                  class="flex-1 text-left  font-bold truncate transition-colors duration-200"
                  :style="{ color: 'var(--content-text-secondary)' }"
                  @click="isContractAmountRevealed = !isContractAmountRevealed"
                >
                  {{ isContractAmountRevealed ? formatMoney(selectedResource.contractAmount) : '***' }}
                </button>
              </div>
              <div class="flex items-center">
                <span class="w-16  transition-colors duration-200" :style="{ color: 'var(--content-text-secondary)' }">类型</span>
                <span class="flex-1  transition-colors duration-200" :style="{ color: 'var(--content-text-secondary)' }">
                  {{ getContractTypeText(selectedResource) }}
                </span>
              </div>
              <div class="flex items-center">
                <span class="w-16  transition-colors duration-200" :style="{ color: 'var(--content-text-secondary)' }">签约日期</span>
                <span class="flex-1  transition-colors duration-200" :style="{ color: 'var(--content-text-secondary)' }">
                  {{ selectedResource.completionDate || selectedResource.date || '-' }}
                </span>
              </div>
            </div>
          </div>

          <div v-if="selectedResource.technicalFeatures || selectedResource.description" class="info-section mb-4">
            <div class="border-t border-[var(--content-border)] mb-3"></div>
            <div class="flex items-center justify-between gap-3 mb-2">
              <h4
                class=" font-semibold uppercase tracking-wide transition-colors duration-200"
                :style="{ color: 'var(--content-text-secondary)' }"
              >
                合同摘要
              </h4>
              <button
                v-if="isSummaryLong"
                type="button"
                class="text-xs font-medium transition-colors duration-200"
                :style="{ color: 'var(--content-text-secondary)' }"
                @click="isSummaryExpanded = !isSummaryExpanded"
              >
                {{ isSummaryExpanded ? '收起' : '展开' }}
              </button>
            </div>
            <div
              class=" leading-relaxed whitespace-pre-wrap break-words transition-colors duration-200"
              :class="{ 'summary-collapsed': !isSummaryExpanded }"
              :style="{ color: 'var(--content-text-secondary)' }"
            >
              {{ contractSummaryText }}
            </div>
          </div>
        </template>

        <template v-else>
          <div class="info-section mb-4">
            <h4
              class=" font-semibold mb-2 uppercase tracking-wide transition-colors duration-200"
              :style="{ color: 'var(--content-text-secondary)' }"
            >
              基本信息
            </h4>
            <div class="space-y-2">
              <div class="flex items-center">
                <span class="w-16  transition-colors duration-200" :style="{ color: 'var(--content-text-secondary)' }">名称</span>
                <span class="flex-1  font-medium transition-colors duration-200" :style="{ color: 'var(--content-text)' }">
                  {{ selectedResource.name }}
                </span>
              </div>
              <div class="flex items-center">
                <span class="w-16  transition-colors duration-200" :style="{ color: 'var(--content-text-secondary)' }">类型</span>
                <span class="flex-1  transition-colors duration-200" :style="{ color: 'var(--content-text)' }">
                  {{ selectedResource.type }}
                </span>
              </div>
              <div class="flex items-center">
                <span class="w-16  transition-colors duration-200" :style="{ color: 'var(--content-text-secondary)' }">大小</span>
                <span class="flex-1  transition-colors duration-200" :style="{ color: 'var(--content-text)' }">
                  {{ selectedResource.size }}
                </span>
              </div>
              <div class="flex items-center">
                <span class="w-16  transition-colors duration-200" :style="{ color: 'var(--content-text-secondary)' }">日期</span>
                <span class="flex-1  transition-colors duration-200" :style="{ color: 'var(--content-text)' }">
                  {{ selectedResource.date }}
                </span>
              </div>
              <div class="flex items-center">
                <span class="w-16  transition-colors duration-200" :style="{ color: 'var(--content-text-secondary)' }">路径</span>
                <span class="flex-1  truncate transition-colors duration-200" :style="{ color: 'var(--content-text)' }">
                  {{ selectedResource.path }}
                </span>
              </div>
            </div>
          </div>

          <div class="info-section mb-4">
            <h4
              class=" font-semibold mb-2 uppercase tracking-wide transition-colors duration-200"
              :style="{ color: 'var(--content-text-secondary)' }"
            >
              标签
            </h4>
            <div class="flex flex-wrap gap-1.5">
              <Chip
                v-for="tag in (selectedResource.tags || [])"
                :key="tag"
                :label="tag"
                class=" transition-colors duration-200"
                removable
                @remove="removeTag(tag)"
              />
              <Button
                label="+ 添加标签"
                severity="secondary"
                text
                size="small"
                @click="handleAddTag($event)"
                class=" transition-colors duration-200"
              />
            </div>

            <TagSelectionPopover
              ref="tagPopoverRef"
              @select="onTagSelected"
            />
          </div>

          <div class="info-section">
            <h4
              class=" font-semibold mb-2 uppercase tracking-wide transition-colors duration-200"
              :style="{ color: 'var(--content-text-secondary)' }"
            >
              描述
            </h4>
            <Textarea
              v-model="localDescription"
              class="w-full  transition-colors duration-200"
              rows="4"
              placeholder="添加描述..."
              autoResize
              @blur="handleSaveDescription"
            />
          </div>
        </template>

      </div>

      <!-- 空状态 -->
      <div v-else class="empty-state flex flex-col items-center justify-center h-full">
        <div class="text-4xl mb-3 opacity-40">📋</div>
        <p
          class=" opacity-40 transition-colors duration-200"
          :style="{ color: 'var(--content-text)' }"
        >
          选择项目查看属性
        </p>
        <p
          class="text-xs mt-2 opacity-30 transition-colors duration-200"
          :style="{ color: 'var(--content-text-secondary)' }"
        >
          点击中间区域的资源卡片
        </p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import Button from 'primevue/button'
import Chip from 'primevue/chip'
import Textarea from 'primevue/textarea'
import TagSelectionPopover from '../../tag/components/TagSelectionPopover.vue'
import { createRendererLogger } from '@/utils/logger'
import type { ContractResource } from '../types/contractResource'

const logger = createRendererLogger('PropertiesPanel')
import contractPreviewPlaceholder from '../../../../assets/Frame.svg'

/**
 * 属性面板组件
 * 三栏式布局的右侧区域，显示选中资源的详细信息
 * 包含：窗口控制按钮、预览、基本信息、标签、描述、操作按钮
 */

// Props 定义
interface Props {
  /** 当前选中的资源 */
  selectedResource: ContractResource | null
}

const props = defineProps<Props>()

// Emits 定义
const emit = defineEmits<{
  (e: 'close'): void
  (e: 'edit', resource: ContractResource): void
  (e: 'delete', resource: ContractResource): void
  (e: 'add-tag', resource: ContractResource): void
  (e: 'remove-tag', resource: ContractResource, tag: string): void
  (e: 'save-description', description: string): void
}>()

// ─── 响应式状态 ─────────────────────────────────────────────────

/** 本地描述文本 */
const localDescription = ref('')
const isSummaryExpanded = ref(false)
const isContractAmountRevealed = ref(false)
const contractTypeLabelMap = ref<Record<string, string>>({})

/** 置顶状态 */
const isPinned = ref(false)

/** 最大化状态 */
const isMaximized = ref(false)

// ─── 监听 ───────────────────────────────────────────────────────

watch(() => props.selectedResource, (newResource) => {
  if (newResource) {
    localDescription.value = newResource.description || ''
    isSummaryExpanded.value = false
    isContractAmountRevealed.value = false
  } else {
    localDescription.value = ''
    isSummaryExpanded.value = false
    isContractAmountRevealed.value = false
  }
}, { immediate: true })

const contractSummaryText = computed(() => {
  const r = props.selectedResource
  return String(r?.technicalFeatures || r?.description || '')
})

const isSummaryLong = computed(() => contractSummaryText.value.length > 160)

const formatMoney = (value: number | null | undefined) => {
  if (value === null || value === undefined) return '-'
  if (!Number.isFinite(value)) return '-'
  return new Intl.NumberFormat('zh-CN', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(value)
}

const contractTypeLabels: Record<string, string> = {
  rd_contract: '研发合同',
  entrusted_development: '委托开发合同',
  technical_service: '技术服务合同',
  software_procurement: '软件采购合同',
  maintenance_service: '维护服务合同',
}

const buildContractTypeLabelMap = (items: any[]) => {
  const map: Record<string, string> = {}
  for (const item of items || []) {
    const label = String(item?.name || '').trim()
    if (!label) continue
    const value = String(item?.value ?? '').trim()
    const code = String(item?.code ?? '').trim()
    map[label] = label
    if (value) map[value] = label
    if (code) map[code] = label
  }
  return map
}

const loadContractTypeLabelMap = async () => {
  try {
    const res = await window.electronAPI.dictionary.getList({ group_name: '合同类型', page: 1, pageSize: 1000 })
    const items = (res.success && res.data)
      ? ((res.data as any).data || (res.data as any).items || [])
      : []
    contractTypeLabelMap.value = buildContractTypeLabelMap(items)
  } catch (err) {
    contractTypeLabelMap.value = {}
    logger.warn('加载合同类型字典失败:', err)
  }
}

const getContractTypeText = (resource: ContractResource) => {
  const rawType = String(resource.contractType || resource.softwareCategory || '').trim()
  if (!rawType) return '合同信息'
  return contractTypeLabelMap.value[rawType] || contractTypeLabels[rawType] || rawType
}

void loadContractTypeLabelMap()

// ─── 方法 ───────────────────────────────────────────────────────

/**
 * 获取资源图标
 */
const getResourceIcon = (type: string): string => {
  const icons: Record<string, string> = {
    image: '🖼️',
    video: '🎬',
    audio: '🎵',
    document: '📄',
    folder: '📁',
    other: '📦'
  }
  return icons[type] || icons.other
}

/**
 * 切换置顶状态
 */
const togglePin = () => {
  isPinned.value = !isPinned.value
}

/**
 * 最小化窗口
 */
const minimizeWindow = async () => {
  try {
    await window.electronAPI?.window?.minimize()
  } catch (err) {
    logger.error('最小化窗口失败:', err)
  }
}

/** 切换最大化状态 */
const toggleMaximize = async () => {
  try {
    const result = await window.electronAPI?.window?.toggleMaximize()
    if (result?.success) {
      isMaximized.value = !isMaximized.value
    }
  } catch (err) {
    logger.error('切换最大化失败:', err)
  }
}

/** 关闭窗口 */
const closeWindow = async () => {
  try {
    await window.electronAPI?.window?.close()
  } catch (err) {
    logger.error('关闭窗口失败:', err)
  }
}

/** 标签选择弹出层 Ref */
const tagPopoverRef = ref<InstanceType<typeof TagSelectionPopover> | null>(null)

/** 处理添加标签按钮点击 */
const handleAddTag = (event: Event) => {
  tagPopoverRef.value?.toggle(event)
}

/** 标签被选中时 */
const onTagSelected = (tag: any) => {
  if (props.selectedResource) {
    // 这里触发外部事件，将整个 tag 对象或名称传递出去，视需求而定
    // 为兼容原有的 emit，先传递选中资源的原始数据，并将标签追加（或者由外部处理）
    // 当前业务中可能是触发 add-tag 并传递所选标签。
    emit('add-tag', props.selectedResource)
    // 注意：如果有需要更新本地资源标签列表的逻辑，可以直接修改
    if (!props.selectedResource.tags.includes(tag.name)) {
      props.selectedResource.tags.push(tag.name)
    }
  }
}

/** 处理编辑 */
const handleEdit = () => {
  if (props.selectedResource) {
    emit('edit', props.selectedResource)
  }
}

/**
 * 处理删除
 */
const handleDelete = () => {
  if (props.selectedResource) {
    emit('delete', props.selectedResource)
  }
}

/**
 * 移除标签
 */
const removeTag = (tag: string) => {
  if (props.selectedResource) {
    emit('remove-tag', props.selectedResource, tag)
  }
}

/**
 * 处理保存描述
 */
const handleSaveDescription = () => {
  emit('save-description', localDescription.value)
}

/**
 * 关闭属性面板
 */
const handleClose = () => {
  emit('close')
}
</script>

<style scoped>
.properties-panel {
  flex-shrink: 0;
}

.summary-collapsed {
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 4;
  overflow: hidden;
}
</style>
