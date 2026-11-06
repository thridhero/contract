<template>
  <Popover ref="popover" style="background: transparent; border: none; box-shadow: none;">
    <div
      class="tag-selection-popover flex flex-col w-[320px] rounded-lg overflow-hidden transition-colors duration-200"
      :style="{
        backgroundColor: 'var(--content-bg)',
        boxShadow: 'var(--p-popover-shadow, 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06))'
      }"
      @keydown="handleKeyDown"
      tabindex="-1"
    >
      <!-- Header: 搜索与工具栏 -->
      <div
        class="header flex items-center gap-2 p-2 border-b transition-colors duration-200"
        :style="{ borderColor: 'var(--content-border)' }"
      >
        <div class="flex-1 relative flex items-center">
          <i class="pi pi-search absolute left-2 z-10 text-sm" :style="{ color: 'var(--content-text-secondary)' }" />
          <InputText
            v-model="searchQuery"
            placeholder="搜索..."
            class="w-full text-sm !py-1.5 !pl-8 transition-colors duration-200"
            :style="{
              backgroundColor: 'var(--content-bg)',
              color: 'var(--content-text)',
              borderColor: 'transparent'
            }"
            @keydown.stop="handleSearchKeyDown"
          />
        </div>
        <Button
          text
          rounded
          :icon="isGridView ? 'pi pi-list' : 'pi pi-th-large'"
          size="small"
          class="!w-7 !h-7 !p-0 text-sm transition-colors duration-200"
          :style="{ color: 'var(--content-text-secondary)' }"
          title="切换视图"
          @click="toggleView"
        />
        <Button
          text
          rounded
          icon="pi pi-thumbtack"
          size="small"
          class="!w-7 !h-7 !p-0 text-sm transition-colors duration-200"
          :style="{ color: isPinned ? 'var(--primary-color, #3b82f6)' : 'var(--content-text-secondary)' }"
          title="固定"
          @click="togglePin"
        />
      </div>

      <!-- Body: 标签列表 -->
      <div
        class="body flex-1 overflow-y-auto p-2 max-h-[400px] transition-colors duration-200"
        ref="listContainer"
      >
        <!-- 新增标签提示 -->
        <div
          v-if="showAddPrompt"
          class="tag-item flex items-center px-2 py-1.5 rounded cursor-pointer select-none transition-colors duration-200 mb-2"
          :class="{
            'active': isActiveTag(-1, -1)
          }"
          :style="{
            color: 'var(--content-text)',
            backgroundColor: isActiveTag(-1, -1) ? 'var(--hover-bg, rgba(0,0,0,0.05))' : 'var(--sidebar-bg)'
          }"
          @click="addNewTag"
          @mouseenter="setActiveTag(-1, -1)"
        >
          <i class="pi pi-plus text-xs mr-2 opacity-70"></i>
          <span class="text-sm font-medium">新增 "<span class="underline underline-offset-2">{{ searchQuery }}</span>"</span>
        </div>

        <template v-for="(group, groupIndex) in filteredGroups" :key="group.id">
          <!-- 分组标题 -->
          <div
            v-if="group.tags.length > 0"
            class="group-title flex items-center justify-between text-xs mt-3 mb-2 px-1 transition-colors duration-200"
            :style="{ color: 'var(--content-text-secondary)' }"
          >
            <span>{{ group.name }} ({{ group.tags.length }})</span>
          </div>

          <!-- 标签容器 -->
          <div
            v-if="group.tags.length > 0"
            :class="[
              'gap-1.5',
              isGridView ? 'grid grid-cols-2' : 'flex flex-col'
            ]"
          >
            <div
              v-for="(tag, tagIndex) in group.tags"
              :key="tag.id"
              class="tag-item flex items-center justify-between px-2 py-1.5 rounded cursor-pointer select-none transition-colors duration-200"
              :class="{
                'active': isActiveTag(groupIndex, tagIndex)
              }"
              :style="{
                color: 'var(--content-text)',
                backgroundColor: isActiveTag(groupIndex, tagIndex) ? 'var(--hover-bg, rgba(0,0,0,0.05))' : 'transparent'
              }"
              @click="selectTag(tag)"
              @mouseenter="setActiveTag(groupIndex, tagIndex)"
            >
              <div class="flex items-center gap-2 truncate">
                <i
                  v-if="group.icon"
                  :class="['pi', group.icon, 'text-xs opacity-50']"
                />
                <span class="text-sm truncate">{{ tag.name }}</span>
              </div>
              <span class="text-xs opacity-50">{{ tag.use_count }}</span>
            </div>
          </div>
          
          <!-- 分组间分隔线 -->
          <div
            v-if="groupIndex < filteredGroups.length - 1 && group.tags.length > 0"
            class="h-px w-full my-2 transition-colors duration-200"
            :style="{ backgroundColor: 'var(--content-border)' }"
          ></div>
        </template>

        <!-- 空状态 -->
        <div
          v-if="filteredGroups.every(g => g.tags.length === 0)"
          class="flex flex-col items-center justify-center py-8 opacity-50"
        >
          <i class="pi pi-inbox text-2xl mb-2"></i>
          <span class="text-sm">暂无标签</span>
        </div>
      </div>

      <!-- Footer: 键盘提示 -->
      <div
        class="footer flex items-center justify-between p-2 text-xs border-t transition-colors duration-200"
        :style="{
          borderColor: 'var(--content-border)',
          color: 'var(--content-text-secondary)',
          backgroundColor: 'var(--sidebar-bg)'
        }"
      >
        <div class="flex items-center gap-2">
          <span>移动</span>
          <div class="flex gap-1">
            <span class="kbd">↑</span>
            <span class="kbd">↓</span>
            <span class="kbd">←</span>
            <span class="kbd">→</span>
          </div>
          <span class="ml-2">选中</span>
          <span class="kbd">↵</span>
        </div>
        <div class="flex items-center gap-1">
          <span>关闭</span>
          <span class="kbd">ESC</span>
        </div>
      </div>
    </div>
  </Popover>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, nextTick, watch } from 'vue'
import Popover from 'primevue/popover'
import InputText from 'primevue/inputtext'
import Button from 'primevue/button'
import { createRendererLogger } from '@/utils/logger'

const logger = createRendererLogger('TagSelectionPopover')

/**
 * TagSelectionPopover
 * 标签选择弹窗，支持按分组展示、搜索过滤、列表/网格视图切换、全键盘导航
 */

// ─── 类型定义 ───────────────────────────────────────────────────

interface TagItem {
  id: string | number
  name: string
  use_count: number
  group_id: string | number
}

interface TagGroup {
  id: string | number
  name: string
  icon?: string
  order?: number
}

interface GroupedTags extends TagGroup {
  tags: TagItem[]
}

// ─── Emits ──────────────────────────────────────────────────────

const emit = defineEmits<{
  (e: 'select', tag: TagItem): void
  (e: 'add', tagName: string): void
}>()

// ─── 状态 ───────────────────────────────────────────────────────

const popover = ref<InstanceType<typeof Popover> | null>(null)
const listContainer = ref<HTMLElement | null>(null)

const searchQuery = ref('')
const isGridView = ref(true)
const isPinned = ref(false)

const tags = ref<TagItem[]>([])
const groups = ref<TagGroup[]>([])

// 焦点管理：记录当前激活的分组索引和标签索引
const activeGroupIndex = ref(0)
const activeTagIndex = ref(0)

watch(searchQuery, () => {
  nextTick(() => {
    if (flatVisibleTags.value.length > 0) {
      const first = flatVisibleTags.value[0]
      activeGroupIndex.value = first.groupIndex
      activeTagIndex.value = first.tagIndex
    }
  })
})

// ─── 计算属性 ───────────────────────────────────────────────────

/** 是否有完全匹配的标签 */
const hasExactMatch = computed(() => {
  const query = searchQuery.value.trim().toLowerCase()
  if (!query) return true
  return tags.value.some(t => t.name.toLowerCase() === query)
})

/** 是否显示新增标签提示 */
const showAddPrompt = computed(() => {
  return searchQuery.value.trim().length > 0 && !hasExactMatch.value
})

/** 过滤并分组后的标签数据 */
const filteredGroups = computed<GroupedTags[]>(() => {
  const query = searchQuery.value.trim().toLowerCase()
  
  return groups.value.map(group => {
    const groupTags = tags.value
      .filter(t => t.group_id === group.id)
      .filter(t => !query || t.name.toLowerCase().includes(query))
      // 按使用次数或名称排序
      .sort((a, b) => b.use_count - a.use_count || a.name.localeCompare(b.name, 'zh-CN'))

    // 映射一些内置分组图标 (假设)
    let icon = group.icon
    if (group.name.includes('最近')) icon = 'pi-clock'
    if (group.name.includes('推荐')) icon = 'pi-sparkles'

    return {
      ...group,
      icon,
      tags: groupTags
    }
  }).filter(g => g.tags.length > 0)
})

/** 扁平化的可见标签列表（用于键盘上下移动计算） */
const flatVisibleTags = computed(() => {
  const flat: { isAdd?: boolean; groupIndex: number; tagIndex: number; tag?: TagItem }[] = []
  
  if (showAddPrompt.value) {
    flat.push({ isAdd: true, groupIndex: -1, tagIndex: -1 })
  }

  filteredGroups.value.forEach((g, gIdx) => {
    g.tags.forEach((t, tIdx) => {
      flat.push({ groupIndex: gIdx, tagIndex: tIdx, tag: t })
    })
  })
  return flat
})

// ─── 方法 ───────────────────────────────────────────────────────

/** 暴露给父组件的 toggle 方法 */
const toggle = (event: Event) => {
  popover.value?.toggle(event)
  if (popover.value) {
    // 弹窗打开时加载数据并重置状态
    loadData()
    searchQuery.value = ''
    // activeGroupIndex and activeTagIndex will be reset by watch when searchQuery is cleared (if flatVisibleTags updates)
    // but just to be safe:
    activeGroupIndex.value = 0
    activeTagIndex.value = 0
    
    // 聚焦到弹窗以便接收键盘事件
    nextTick(() => {
      const el = document.querySelector('.tag-selection-popover') as HTMLElement
      if (el) el.focus()
    })
  }
}

defineExpose({ toggle })

/** 加载标签数据 */
const loadData = async () => {
  try {
    const lp = localStorage.getItem('currentLibraryPath')
    if (!lp) return

    const [tagsResp, groupsResp] = await Promise.all([
      window.electronAPI.library.getTags(lp),
      window.electronAPI.library.getTagGroups(lp)
    ])

    if (tagsResp.success && tagsResp.data) {
      tags.value = tagsResp.data as any[]
    }
    
    if (groupsResp.success && groupsResp.data) {
      groups.value = groupsResp.data as any[]
    }
    
    // 如果没有数据，使用一些默认兜底（视实际业务需求而定）
  } catch (error) {
    logger.error('加载标签数据失败:', error)
  }
}

/** 切换视图 */
const toggleView = () => {
  isGridView.value = !isGridView.value
}

/** 切换置顶 */
const togglePin = () => {
  isPinned.value = !isPinned.value
}

/** 判断是否为当前激活的标签 */
const isActiveTag = (gIdx: number, tIdx: number) => {
  return activeGroupIndex.value === gIdx && activeTagIndex.value === tIdx
}

/** 设置激活标签 */
const setActiveTag = (gIdx: number, tIdx: number) => {
  activeGroupIndex.value = gIdx
  activeTagIndex.value = tIdx
}

/** 选中标签 */
const selectTag = (tag: TagItem) => {
  emit('select', tag)
  popover.value?.hide()
}

/** 新增标签 */
const addNewTag = () => {
  const tagName = searchQuery.value.trim()
  if (tagName) {
    emit('add', tagName)
    popover.value?.hide()
  }
}

/** 获取当前高亮项在 flat 列表中的索引 */
const getCurrentFlatIndex = () => {
  return flatVisibleTags.value.findIndex(
    item => item.groupIndex === activeGroupIndex.value && item.tagIndex === activeTagIndex.value
  )
}

/** 设置高亮项通过 flat 列表的索引 */
const setHighlightByFlatIndex = (index: number) => {
  if (index >= 0 && index < flatVisibleTags.value.length) {
    const target = flatVisibleTags.value[index]
    activeGroupIndex.value = target.groupIndex
    activeTagIndex.value = target.tagIndex
    scrollToActive()
  }
}

/** 滚动到高亮项 */
const scrollToActive = () => {
  nextTick(() => {
    if (!listContainer.value) return
    const activeEl = listContainer.value.querySelector('.tag-item.active') as HTMLElement
    if (activeEl) {
      activeEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    }
  })
}

/** 处理全局按键 */
const handleKeyDown = (e: KeyboardEvent) => {
  const flatLen = flatVisibleTags.value.length
  if (flatLen === 0) return

  let currentIndex = getCurrentFlatIndex()
  if (currentIndex === -1) currentIndex = 0

  switch (e.key) {
    case 'ArrowDown':
      e.preventDefault()
      if (isGridView.value) {
        // 网格视图下，向下移动约等于索引 + 2（假设2列）
        setHighlightByFlatIndex(Math.min(currentIndex + 2, flatLen - 1))
      } else {
        setHighlightByFlatIndex(Math.min(currentIndex + 1, flatLen - 1))
      }
      break
    case 'ArrowUp':
      e.preventDefault()
      if (isGridView.value) {
        setHighlightByFlatIndex(Math.max(currentIndex - 2, 0))
      } else {
        setHighlightByFlatIndex(Math.max(currentIndex - 1, 0))
      }
      break
    case 'ArrowRight':
      e.preventDefault()
      if (isGridView.value) {
        setHighlightByFlatIndex(Math.min(currentIndex + 1, flatLen - 1))
      }
      break
    case 'ArrowLeft':
      e.preventDefault()
      if (isGridView.value) {
        setHighlightByFlatIndex(Math.max(currentIndex - 1, 0))
      }
      break
    case 'Enter':
      e.preventDefault()
      if (currentIndex >= 0 && currentIndex < flatLen) {
        const item = flatVisibleTags.value[currentIndex]
        if (item.isAdd) {
          addNewTag()
        } else if (item.tag) {
          selectTag(item.tag)
        }
      }
      break
    case 'Escape':
      e.preventDefault()
      popover.value?.hide()
      break
  }
}

/** 搜索框按键处理 */
const handleSearchKeyDown = (e: KeyboardEvent) => {
  // 让上下左右和回车事件冒泡到外层处理焦点切换
  if (['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight', 'Enter'].includes(e.key)) {
    e.preventDefault() // 阻止光标移动
    handleKeyDown(e)
  }
  // ESC 键直接触发关闭
  if (e.key === 'Escape') {
    e.preventDefault()
    popover.value?.hide()
  }
}
</script>

<style scoped>
.tag-selection-popover:focus {
  outline: none;
}

/* 隐藏滚动条 */
.overflow-y-auto::-webkit-scrollbar {
  width: 4px;
}
.overflow-y-auto::-webkit-scrollbar-thumb {
  background-color: var(--content-border);
  border-radius: 2px;
}

/* 键盘提示按键样式 */
.kbd {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 18px;
  height: 18px;
  padding: 0 4px;
  border-radius: 3px;
  background-color: var(--content-bg);
  border: 1px solid var(--content-border);
  font-family: monospace;
  font-size: 10px;
  box-shadow: 0 1px 1px rgba(0,0,0,0.1);
  color: var(--content-text);
}
</style>
