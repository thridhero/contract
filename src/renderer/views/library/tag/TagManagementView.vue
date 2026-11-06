<template>
  <div class="flex h-full w-full bg-white text-gray-800 font-sans overflow-hidden">
    <!-- ─── 左侧边栏 ──────────────────────────────────────────────────────── -->
    <div class="w-[240px] flex flex-col h-full shrink-0 border-r border-gray-200 bg-[#fafafa]">
      <!-- 返回头部 -->
      <div class="h-[52px] flex items-center px-4 shrink-0 border-b border-gray-200 text-gray-600" style="-webkit-app-region: drag;">
        <button @click="$router.back()" class="mr-2 hover:bg-gray-200 p-1 rounded transition-colors" style="-webkit-app-region: no-drag;">
          <i class="pi pi-angle-left text-lg"></i>
        </button>
        <span class="font-medium text-[14px]">标签管理 ({{ totalTags }})</span>
      </div>

      <!-- 导航列表 -->
      <div class="flex-1 overflow-y-auto py-2">
        <!-- 固定分类 -->
        <div class="px-2 mb-4">
          <div
            v-for="item in fixedCategories"
            :key="item.id"
            @click="activeCategory = item.id"
            class="flex items-center justify-between px-3 py-2 mb-0.5 rounded cursor-pointer transition-colors text-[13px]"
            :class="activeCategory === item.id ? 'bg-[#e5e5e5] text-gray-900 font-medium' : 'text-gray-700 hover:bg-[#f0f0f0]'"
          >
            <div class="flex items-center gap-2">
              <i :class="item.icon" class="text-gray-500 w-4 text-center"></i>
              <span>{{ item.label }}</span>
            </div>
            <span v-if="item.count !== undefined" class="text-gray-400 text-xs">{{ item.count }}</span>
          </div>
        </div>

        <!-- 标签群组 -->
        <div class="px-2">
          <div class="flex items-center justify-between px-3 py-1 mb-1 text-gray-500 text-xs">
            <span>标签群组({{ tagGroups.length }})</span>
            <button class="hover:text-gray-800 transition-colors" @click="addGroup">
              <i class="pi pi-plus"></i>
            </button>
          </div>
          <div
            v-for="group in tagGroups"
            :key="group.id"
            @click="activeCategory = group.id"
            class="flex items-center justify-between px-3 py-2 mb-0.5 rounded cursor-pointer transition-colors text-[13px]"
            :class="activeCategory === group.id ? 'bg-[#e5e5e5] text-gray-900 font-medium' : 'text-gray-700 hover:bg-[#f0f0f0]'"
          >
            <div class="flex items-center gap-2">
              <i class="pi pi-bookmark text-gray-500 w-4 text-center"></i>
              <span class="truncate max-w-[120px]">{{ group.name }}</span>
            </div>
            <span class="text-gray-400 text-xs">{{ group.count }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- ─── 右侧内容区 ────────────────────────────────────────────────────── -->
    <div class="flex-1 flex flex-col h-full bg-white relative min-w-0">
      <!-- 顶部工具栏 -->
      <div class="h-[52px] flex items-center justify-between px-6 shrink-0 border-b border-gray-100" style="-webkit-app-region: drag;">
        <!-- 左侧标题与操作 -->
        <div class="flex items-center gap-2" style="-webkit-app-region: no-drag;">
          <span class="text-lg font-medium text-gray-800">{{ currentCategoryName }}</span>
          <button 
            v-if="isGroupCategory" 
            class="w-6 h-6 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-500 hover:text-gray-800 transition-colors"
            @click="showAddTagPopover"
          >
            <i class="pi pi-plus text-sm"></i>
          </button>
        </div>

        <!-- 右侧操作区 -->
        <div class="flex items-center gap-3" style="-webkit-app-region: no-drag;">
          <!-- 视图切换 -->
          <div class="flex items-center bg-gray-100 rounded-md p-0.5">
            <button class="p-1.5 rounded bg-white shadow-sm text-gray-700">
              <i class="pi pi-th-large text-sm"></i>
            </button>
            <button class="p-1.5 rounded text-gray-500 hover:text-gray-700">
              <i class="pi pi-list text-sm"></i>
            </button>
          </div>
          
          <!-- 排序 -->
          <button class="w-8 h-8 flex items-center justify-center rounded hover:bg-gray-100 text-gray-600 transition-colors">
            <i class="pi pi-sort-alt text-sm"></i>
          </button>

          <!-- 搜索 -->
          <div class="w-64">
            <IconField>
              <InputIcon class="pi pi-search text-gray-400 text-sm" />
              <InputText 
                v-model="searchQuery" 
                placeholder="搜索" 
                class="w-full text-sm py-1.5 rounded-md border-gray-200 bg-gray-50 focus:bg-white transition-colors" 
              />
            </IconField>
          </div>

          <!-- 窗口控制 -->
          <div class="flex items-center gap-1 ml-2 border-l border-gray-200 pl-2" style="-webkit-app-region: no-drag;">
            <Button
              icon="pi pi-minus"
              aria-label="最小化"
              class="p-button-sm p-button-text p-button-secondary !w-8 !h-8 !p-0 text-gray-500 hover:text-gray-800"
              v-tooltip.bottom="'最小化'"
              @click="minimizeWindow"
            />
            <Button
              :icon="windowStateStore.getIsMaximized ? 'pi pi-window-minimize' : 'pi pi-window-maximize'"
              :aria-label="windowStateStore.getIsMaximized ? '还原' : '最大化'"
              class="p-button-sm p-button-text p-button-secondary !w-8 !h-8 !p-0 text-gray-500 hover:text-gray-800"
              v-tooltip.bottom="windowStateStore.getIsMaximized ? '还原' : '最大化'"
              @click="toggleMaximize"
            />
            <Button
              icon="pi pi-times"
              aria-label="关闭"
              class="p-button-sm p-button-text p-button-secondary !w-8 !h-8 !p-0 text-gray-500 hover:!bg-red-50 hover:!text-red-500"
              v-tooltip.bottom="'关闭'"
              @click="closeWindow"
            />
          </div>
        </div>
      </div>

      <!-- 标签展示区 -->
      <div class="flex-1 overflow-y-auto p-8">
        <div class="max-w-5xl mx-auto">
          <!-- 按字母分组显示 -->
          <div v-for="group in groupedTags" :key="group.letter" class="mb-8">
            <div class="flex items-baseline mb-4 border-b border-gray-100 pb-2">
              <h2 class="text-xl font-normal text-gray-800 mr-2">{{ group.letter }}</h2>
              <span class="text-sm text-gray-400">({{ group.tags.length }})</span>
            </div>
            
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-y-4 gap-x-6">
              <div 
                v-for="tag in group.tags" 
                :key="tag.id"
                class="flex items-center group cursor-pointer"
              >
                <div class="w-1.5 h-1.5 rounded-full bg-gray-300 mr-3 group-hover:bg-blue-500 transition-colors"></div>
                <span class="text-[14px] text-gray-700 group-hover:text-blue-600 transition-colors truncate mr-1">{{ tag.name }}</span>
                <span class="text-xs text-gray-400">({{ tag.count }})</span>
              </div>
            </div>
          </div>
          
          <!-- 空状态 -->
          <div v-if="groupedTags.length === 0" class="flex flex-col items-center justify-center py-20 text-gray-400">
            <i class="pi pi-tags text-4xl mb-4 opacity-50"></i>
            <p class="text-sm">没有找到相关标签</p>
          </div>
        </div>
      </div>
    </div>

    <!-- 添加标签群组弹窗 -->
    <Dialog 
      v-model:visible="isAddGroupDialogVisible" 
      modal 
      header="新增标签群组" 
      :style="{ width: '400px' }"
    >
      <div class="flex flex-col gap-4 py-4">
        <div class="flex flex-col gap-2">
          <label for="groupName" class="text-sm text-gray-700">群组名称</label>
          <InputText 
            id="groupName" 
            v-model="newGroupName" 
            placeholder="请输入群组名称" 
            @keyup.enter="confirmAddGroup"
            autofocus
          />
        </div>
      </div>
      <template #footer>
        <Button label="取消" text severity="secondary" @click="isAddGroupDialogVisible = false" autofocus />
        <Button label="确定" @click="confirmAddGroup" :disabled="!newGroupName.trim()" />
      </template>
    </Dialog>

    <!-- 标签选择弹窗 -->
    <TagSelectionPopover 
      ref="tagSelectionPopover"
      @add="handleTagAdd"
      @select="handleTagSelect"
    />
  </div>
</template>

<script setup lang="ts">
/**
 * 标签管理页面
 * 负责展示和管理系统内的所有标签，支持按字母分组显示和分类筛选
 */
import { ref, computed, onMounted } from 'vue'
import InputText from 'primevue/inputtext'
import IconField from 'primevue/iconfield'
import InputIcon from 'primevue/inputicon'
import Dialog from 'primevue/dialog'
import Button from 'primevue/button'
import TagSelectionPopover from './components/TagSelectionPopover.vue'
import { createRendererLogger } from '@/utils/logger'
import { useWindowStateStore } from '../../../stores/ui/windowState'

const logger = createRendererLogger('TagManagement')
import type { FixedCategoryId, TagEntity, TagGroupEntity, TagGroupViewModel, TagViewModel } from '../../../../shared/types/tag.types'

// ─── 窗口控制 ─────────────────────────────────────────────────────────────
const windowStateStore = useWindowStateStore()
const minimizeWindow = () => window.electronAPI.window.minimize()
const toggleMaximize = () => window.electronAPI.window.toggleMaximize()
const closeWindow = () => window.electronAPI.window.close()

// ─── 响应式状态 ─────────────────────────────────────────────────
const searchQuery = ref('')
const activeCategory = ref<FixedCategoryId | string>('all')
const tags = ref<TagViewModel[]>([])
const rawTagGroups = ref<TagGroupEntity[]>([])
const libraryPath = ref<string | null>(null)

// 弹窗状态
const isAddGroupDialogVisible = ref(false)
const newGroupName = ref('')
const tagSelectionPopover = ref<InstanceType<typeof TagSelectionPopover> | null>(null)

const tagGroups = computed<TagGroupViewModel[]>(() =>
  rawTagGroups.value.map(group => ({
    id: group.id,
    name: group.name,
    count: tags.value.filter(tag => tag.groupId === group.id).length
  }))
)

// 模拟的固定分类
const fixedCategories = computed(() => [
  { id: 'all', label: '全部', icon: 'pi pi-bookmark', count: totalTags.value },
  { id: 'uncategorized', label: '未分类', icon: 'pi pi-folder', count: tags.value.filter(t => t.groupId === null).length },
  { id: 'common', label: '常用标签', icon: 'pi pi-star', count: tags.value.filter(t => t.isCommon).length }
])

const totalTags = computed(() => tags.value.length)

const isGroupCategory = computed(() => {
  return activeCategory.value !== 'all' && activeCategory.value !== 'uncategorized' && activeCategory.value !== 'common'
})

const currentCategoryName = computed(() => {
  if (activeCategory.value === 'all') return '全部'
  if (activeCategory.value === 'uncategorized') return '未分类'
  if (activeCategory.value === 'common') return '常用标签'
  const group = rawTagGroups.value.find(g => g.id === activeCategory.value)
  return group ? group.name : ''
})

// 按字母分组的计算属性
const groupedTags = computed(() => {
  // 先过滤
  let filtered = tags.value
  
  if (searchQuery.value) {
    const q = searchQuery.value.toLowerCase()
    filtered = filtered.filter(t => t.name.toLowerCase().includes(q))
  }
  
  if (activeCategory.value === 'uncategorized') {
    filtered = filtered.filter(t => t.groupId === null)
  } else if (activeCategory.value === 'common') {
    filtered = filtered.filter(t => t.isCommon)
  } else if (activeCategory.value !== 'all') {
    // 按群组过滤
    filtered = filtered.filter(t => t.groupId === activeCategory.value)
  }

  // 再分组
  const groups: Record<string, TagViewModel[]> = {}
  filtered.forEach(tag => {
    const letter = tag.initialLetter.toUpperCase()
    if (!groups[letter]) {
      groups[letter] = []
    }
    groups[letter].push(tag)
  })

  // 转换为数组并排序
  return Object.keys(groups)
    .sort((a, b) => {
      if (a === '#') return 1
      if (b === '#') return -1
      return a.localeCompare(b, 'en')
    })
    .map(letter => ({
      letter,
      tags: groups[letter].sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'))
    }))
})

// ─── 方法 ───────────────────────────────────────────────────────
const addGroup = () => {
  newGroupName.value = ''
  isAddGroupDialogVisible.value = true
}

const confirmAddGroup = async () => {
  if (!newGroupName.value.trim()) return
  if (!libraryPath.value) return
  
  try {
    const res = await window.electronAPI.library.createTagGroup(libraryPath.value, newGroupName.value)
    if (res.success && res.data) {
      isAddGroupDialogVisible.value = false
      await loadTagsData()
      activeCategory.value = res.data.id
    }
  } catch (err) {
    logger.error('Failed to create tag group', err)
  }
}

const showAddTagPopover = (event: Event) => {
  tagSelectionPopover.value?.toggle(event)
}

const handleTagAdd = async (tagName: string) => {
  if (!libraryPath.value) return
  try {
    const res = await window.electronAPI.library.createTag(libraryPath.value, {
      name: tagName,
      groupId: activeCategory.value !== 'all' && activeCategory.value !== 'uncategorized' && activeCategory.value !== 'common' ? activeCategory.value as string : undefined
    })
    if (res.success) {
      await loadTagsData()
    }
  } catch (err) {
    logger.error('Failed to add new tag', err)
  }
}

const handleTagSelect = async (tag: any) => {
  // If we just want to associate an existing tag with this group, 
  // we would need an updateTag API. But since prompt says "在搜索的内容输入的标签，没有搜索到，那么则显示新增 xxx，回车键后，可以实现添加"
  // We mainly focus on adding new tags. If a user selects an existing tag, we could maybe move it to this group, but that requires an update API.
  // We'll leave it as a no-op or just log it for now if update is not requested.
  logger.info('Selected tag:', tag)
}

const loadTagsData = async () => {
  try {
    // 优先从当前资源库读取
    const lp = localStorage.getItem('currentLibraryPath')
    libraryPath.value = lp

    if (lp) {
      const [tagsResp, groupsResp] = await Promise.all([
        window.electronAPI.library.getTags(lp),
        window.electronAPI.library.getTagGroups(lp)
      ])

      if (!tagsResp.success) {
        throw new Error(tagsResp.error || '读取标签失败')
      }
      if (!groupsResp.success) {
        throw new Error(groupsResp.error || '读取标签群组失败')
      }

      tags.value = (tagsResp.data || []).map((item: TagEntity) => ({
        id: item.id,
        name: item.name,
        count: item.use_count,
        groupId: item.group_id,
        isCommon: item.is_common === 1,
        initialLetter: (item.initial_letter || item.initial || '#').toUpperCase()
      }))
      rawTagGroups.value = groupsResp.data || []
      return
    }

    // Fallback：读取主数据库（无当前资源库时）
    const [tagsResp2, groupsResp2] = await Promise.all([
      window.electronAPI.db.getTags(),
      window.electronAPI.db.getTagGroups()
    ])
    if (!tagsResp2.success) {
      throw new Error(tagsResp2.error || '读取标签失败')
    }
    if (!groupsResp2.success) {
      throw new Error(groupsResp2.error || '读取标签群组失败')
    }
    tags.value = (tagsResp2.data || []).map((item: TagEntity) => ({
      id: item.id,
      name: item.name,
      count: item.use_count,
      groupId: item.group_id,
      isCommon: item.is_common === 1,
      initialLetter: (item.initial_letter || item.initial || '#').toUpperCase()
    }))
    rawTagGroups.value = groupsResp2.data || []
  } catch (error) {
    logger.error('加载标签数据失败:', error)
  }
}

// ─── 生命周期钩子 ───────────────────────────────────────────────
onMounted(() => {
  loadTagsData()
})
</script>

<style scoped>
/* 隐藏主滚动条，但内容可滚动 */
.overflow-y-auto::-webkit-scrollbar {
  width: 6px;
}
.overflow-y-auto::-webkit-scrollbar-thumb {
  background-color: #e5e7eb;
  border-radius: 3px;
}
.overflow-y-auto::-webkit-scrollbar-track {
  background: transparent;
}
</style>
