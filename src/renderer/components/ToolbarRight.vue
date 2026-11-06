<template>
  <div :class="['flex items-center', sidebarStore.isSidebarCollapsed ? 'justify-center w-full' : 'gap-2']" style="-webkit-app-region: drag">
    <!-- 折叠状态下的展开按钮（替代汉堡菜单位置） -->
    <Button
      v-if="sidebarStore.isSidebarCollapsed"
      severity="secondary"
      text
      :title="sidebarCollapseTitle"
      size="small"
      class="toolbar-btn transition-colors duration-200"
      style="-webkit-app-region: no-drag; color: var(--content-text)"
      @click="emit('toggle-sidebar-collapse')"
      :aria-label="sidebarCollapseTitle"
    >
      <template #icon>
        <svg width="1.1rem" height="1.1rem" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M3.5 18.5V5.5C3.5 4.39543 4.39543 3.5 5.5 3.5H18.5C19.6046 3.5 20.5 4.39543 20.5 5.5V18.5C20.5 19.6046 19.6046 20.5 18.5 20.5H5.5C4.39543 20.5 3.5 19.6046 3.5 18.5Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          <path d="M15.5 3.5V20.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        </svg>
      </template>
    </Button>

    <!-- 汉堡菜单按钮（仅展开时显示） -->
    <Button
      v-else
      ref="menuButtonRef"
      severity="secondary"
      text
      title="菜单"
      icon="pi pi-bars"
      size="small"
      class="toolbar-btn transition-colors duration-200"
      style="-webkit-app-region: no-drag; color: var(--content-text)"
      @click="toggleMenu"
      aria-label="菜单"
    />

    <!-- 层级菜单（支持 hover 展开子菜单） -->
    <TieredMenu
      ref="menuRef"
      :model="menuItems"
      popup
      class="toolbar-tiered-menu"
    >
      <template #item="{ item, props }">
        <a v-ripple v-bind="props.action" class="flex items-center justify-between gap-4 w-full">
          <span class="flex items-center gap-2 min-w-0">
            <i v-if="item.icon" :class="item.icon" />
            <span class="truncate">{{ item.label }}</span>
          </span>
          <span class="flex items-center gap-2 shrink-0">
            <span v-if="item.shortcut" class="text-xs opacity-70 font-mono">{{ item.shortcut }}</span>
            <span v-if="item.items" class="pi pi-angle-right text-xs opacity-70" />
          </span>
        </a>
      </template>
    </TieredMenu>

    <!-- 创建资源库对话框 -->
    <CreateLibraryModal
      v-model:visible="showCreateLibraryModal"
      @created="handleLibraryCreated"
      @cancel="handleCreateLibraryCancel"
    />

    <Dialog
      v-model:visible="showFeedbackDialog"
      modal
      header="意见反馈"
      :draggable="true"
      :resizable="true"
      :style="{ width: '920px', maxWidth: '95vw' }"
      class="theme-dialog feedback-dialog"
    >
      <div class="h-[78vh] max-h-[78vh] overflow-hidden">
        <FeedbackView @submitted="handleFeedbackSubmitted" />
      </div>
    </Dialog>

    <Dialog
      v-model:visible="showAboutDialog"
      modal
      :header="aboutDialogTitle"
      :draggable="false"
      :style="{ width: '680px' }"
    >
      <div v-if="aboutLoading" class="py-10 text-sm text-center" :style="{ color: 'var(--content-text-secondary)' }">
        正在加载关于我们…
      </div>
      <div v-else-if="aboutLoadError" class="py-6 flex flex-col items-center gap-4">
        <div class="text-sm text-center" :style="{ color: 'var(--danger-color)' }">
          {{ aboutLoadError }}
        </div>
        <button
          type="button"
          class="px-4 py-2 rounded text-sm"
          :style="{ backgroundColor: 'var(--primary-color)', color: '#fff' }"
          @click="loadAboutContent(true)"
        >
          重新加载
        </button>
      </div>
      <div
        v-else-if="aboutContentHtml"
        class="cms-html-content max-h-[60vh] overflow-y-auto pr-1 text-sm leading-6"
        :style="{ color: 'var(--content-text)' }"
        v-html="aboutContentHtml"
      ></div>
      <div v-else class="py-10 text-sm text-center" :style="{ color: 'var(--content-text-secondary)' }">
        暂无关于我们内容
      </div>
    </Dialog>

    <Dialog
      v-model:visible="showPrivacyDialog"
      modal
      :header="privacyDialogTitle"
      :draggable="false"
      :style="{ width: '680px' }"
    >
      <div v-if="privacyLoading" class="py-10 text-sm text-center" :style="{ color: 'var(--content-text-secondary)' }">
        正在加载隐私协议…
      </div>
      <div v-else-if="privacyLoadError" class="py-6 flex flex-col items-center gap-4">
        <div class="text-sm text-center" :style="{ color: 'var(--danger-color)' }">
          {{ privacyLoadError }}
        </div>
        <button
          type="button"
          class="px-4 py-2 rounded text-sm"
          :style="{ backgroundColor: 'var(--primary-color)', color: '#fff' }"
          @click="loadPrivacyContent(true)"
        >
          重新加载
        </button>
      </div>
      <div
        v-else-if="privacyContentHtml"
        class="cms-html-content max-h-[60vh] overflow-y-auto pr-1 text-sm leading-6"
        :style="{ color: 'var(--content-text)' }"
        v-html="privacyContentHtml"
      ></div>
      <div v-else class="py-10 text-sm text-center" :style="{ color: 'var(--content-text-secondary)' }">
        暂无隐私协议内容
      </div>
    </Dialog>

    <!-- 右侧按钮组（仅展开时显示） -->
    <div v-if="!sidebarStore.isSidebarCollapsed" class="flex items-center gap-2 ml-auto" style="-webkit-app-region: no-drag">
      <Button
        severity="secondary"
        text
        title="搜索"
        icon="pi pi-search"
        size="small"
        class="toolbar-btn transition-colors duration-200"
        style="color: var(--content-text)"
        @click="emit('search-click')"
        aria-label="搜索"
      />
      <!-- 折叠/展开 -->
      <Button
        severity="secondary"
        text
        :title="sidebarCollapseTitle"
        size="small"
        class="toolbar-btn transition-colors duration-200"
        style="color: var(--content-text)"
        @click="emit('toggle-sidebar-collapse')"
        :aria-label="sidebarCollapseTitle"
      >
        <template #icon>
          <svg width="1.1rem" height="1.1rem" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M20.5 18.5V5.5C20.5 4.39543 19.6046 3.5 18.5 3.5H5.5C4.39543 3.5 3.5 4.39543 3.5 5.5V18.5C3.5 19.6046 4.39543 20.5 5.5 20.5H18.5C19.6046 20.5 20.5 19.6046 20.5 18.5Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
            <path d="M8.5 3.5V20.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          </svg>
        </template>
      </Button>
      <!-- 通知中心 -->
      <Button
        severity="secondary"
        text
        title="通知中心"
        icon="pi pi-bell"
        size="small"
        class="toolbar-btn transition-colors duration-200"
        style="color: var(--content-text)"
        @click="emit('notification-click')"
        aria-label="通知中心"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { eventBus } from '../utils/eventBus'

// ─── PrimeVue 组件 ──────────────────────────────────────────────
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import TieredMenu from 'primevue/tieredmenu'

// ─── 自定义组件 ─────────────────────────────────────────────────
import CreateLibraryModal from './CreateLibraryModal.vue'
import FeedbackView from '../views/feedback/FeedbackView.vue'
import { createRendererLogger } from '@/utils/logger'
import { fetchCmsContentByKey, getBackendAuthConfig } from '@/utils/backendAuth'

const logger = createRendererLogger('ToolbarRight')

// ─── Store ──────────────────────────────────────────────────────
import { useLibraryStore } from '../stores/library/libraryStore'
import { useSidebarStore } from '../stores/ui/sidebarStore'

/**
 * ToolbarRight 组件
 * 右侧工具栏，包含菜单按钮和常用操作按钮
 * 使用 TieredMenu 支持 hover 展开子菜单
 */

// ─── Emits 定义 ─────────────────────────────────────────────────
const emit = defineEmits<{
  (e: 'menu-click'): void
  (e: 'notification-click'): void
  (e: 'search-click'): void
  (e: 'open-settings'): void
  (e: 'sync'): void
  (e: 'toggle-sidebar'): void
  (e: 'toggle-sidebar-collapse'): void
}>()

// ─── Store ──────────────────────────────────────────────────────
const libraryStore = useLibraryStore()
const sidebarStore = useSidebarStore()

// ─── 响应式状态 ─────────────────────────────────────────────────
/** 菜单引用 */
const menuRef = ref<InstanceType<typeof TieredMenu>>()
const menuButtonRef = ref<any>()

/** 创建资源库对话框显示状态 */
const showCreateLibraryModal = ref(false)
const showFeedbackDialog = ref(false)
const showAboutDialog = ref(false)
const aboutDialogTitle = ref('关于软件')
const aboutContentHtml = ref('')
const aboutLoading = ref(false)
const aboutLoadError = ref('')
const showPrivacyDialog = ref(false)
const privacyDialogTitle = ref('隐私协议')
const privacyContentHtml = ref('')
const privacyLoading = ref(false)
const privacyLoadError = ref('')
const ABOUT_CONTENT_KEY = 'about_us'
const PRIVACY_CONTENT_KEY = 'privacy_agreement'

import { useToast } from 'primevue/usetoast'
import type { Library } from '../../shared/types/library.types'

const toast = useToast()

const sidebarCollapseTitle = computed(() => (sidebarStore.isSidebarCollapsed ? '展开菜单' : '折叠菜单'))

const shortcutDefaults: Record<string, string> = {
  'open-library-menu': 'Ctrl+Shift+L',
  'open-aggregated-search': 'Ctrl+Shift+F',
  'open-preferences': 'Ctrl+,',
  'app-exit': 'Ctrl+Q',
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

const normalizeShortcutSettingsLocal = (input: unknown): Record<string, string> => {
  const raw = (input && typeof input === 'object') ? (input as Record<string, unknown>) : {}
  const out: Record<string, string> = {}
  Object.keys(shortcutDefaults).forEach((id) => {
    const v = raw[id]
    const text = typeof v === 'string' && v.trim() ? v.trim() : shortcutDefaults[id]
    out[id] = normalizeAcceleratorText(text)
  })
  return out
}

const shortcutSettings = ref<Record<string, string>>(normalizeShortcutSettingsLocal(undefined))
const shortcutText = (id: keyof typeof shortcutDefaults) => shortcutSettings.value[id] || shortcutDefaults[id]

const openMenuFromShortcut = async () => {
  if (sidebarStore.isSidebarCollapsed) {
    emit('toggle-sidebar-collapse')
    await nextTick()
  }
  const el = menuButtonRef.value?.$el as HTMLElement | undefined
  el?.click()
}

let unsubscribeConfigChanged: null | (() => void) = null
let unsubscribeShortcutTriggered: null | (() => void) = null

onMounted(async () => {
  if (libraryStore.libraries.length === 0) {
    await libraryStore.fetchLibraries()
  }

  const apply = (settings?: unknown) => {
    shortcutSettings.value = normalizeShortcutSettingsLocal(settings)
  }

  try {
    const res = await window.electronAPI?.config?.getItem?.('shortcutSettings')
    const raw = (res && (res as any).success) ? (res as any).data : undefined
    apply(raw)
  } catch {
    apply(undefined)
  }

  unsubscribeConfigChanged = window.electronAPI?.config?.onChanged?.((config) => {
    const raw = (config && typeof config === 'object') ? (config as any).shortcutSettings : undefined
    apply(raw)
  }) || null

  const handler = (payload: { id: string; accelerator: string }) => {
    if (payload.id === 'open-library-menu') {
      void openMenuFromShortcut()
    }
  }
  eventBus.on('shortcut:triggered', handler)
  unsubscribeShortcutTriggered = () => eventBus.off('shortcut:triggered', handler)
})

// ─── 菜单项配置 ─────────────────────────────────────────────────
const menuItems = computed(() => {
  const libraryItems: any[] = [
    {
      label: '创建资源库...',
      icon: 'pi pi-plus-circle',
      command: () => {
        handleCreateLibrary()
      }
    },
    {
      label: '打开其他资源库...',
      icon: 'pi pi-folder-open',
      command: () => handleOpenLibrary()
    }
  ]

  if (libraryStore.libraries && libraryStore.libraries.length > 0) {
    libraryItems.push({ separator: true })
    libraryStore.libraries.forEach(lib => {
      const isCurrent = libraryStore.currentLibrary?.id === lib.id
      libraryItems.push({
        label: `${lib.name} (${lib.path})`,
        icon: isCurrent ? 'pi pi-check' : 'pi pi-folder',
        command: () => handleSwitchLibrary(lib)
      })
    })
  }

  return [
    {
      label: '资源库',
      icon: 'pi pi-folder',
      shortcut: shortcutText('open-library-menu'),
      items: libraryItems
    },
    {
      label: '聚合搜索',
      icon: 'pi pi-search',
      shortcut: shortcutText('open-aggregated-search'),
      command: () => handleSearch()
    },
    { separator: true },
    {
      label: '偏好设置',
      icon: 'pi pi-cog',
      shortcut: shortcutText('open-preferences'),
      command: () => handlePreferences()
    },
    {
      label: '意见反馈',
      icon: 'pi pi-comment',
      command: () => handleFeedback()
    },
    {
      label: '隐私协议',
      icon: 'pi pi-shield',
      command: () => handlePrivacy()
    },
    {
      label: '关于软件',
      icon: 'pi pi-info-circle',
      command: () => handleAbout()
    },
    { separator: true },
    {
      label: '退出',
      icon: 'pi pi-sign-out',
      shortcut: shortcutText('app-exit'),
      command: () => handleExit()
    }
  ]
})

// ─── 方法 ───────────────────────────────────────────────────────
/**
 * 切换菜单显示状态
 */
const toggleMenu = (event: Event) => {
  menuRef.value?.toggle(event)
}

/**
 * 创建资源库 - 打开创建对话框
 */
const handleCreateLibrary = () => {
  logger.debug('handleCreateLibrary called')
  showCreateLibraryModal.value = true
  emit('menu-click')
}

/**
 * 资源库创建成功回调
 */
const handleLibraryCreated = async (library: { id: string; name: string; path: string }) => {
  // 切换到新创建的资源库
  await libraryStore.switchLibrary(library)
  emit('menu-click')
}

/**
 * 创建资源库取消回调
 */
const handleCreateLibraryCancel = () => {
  logger.info('取消创建资源库')
}

/**
 * 打开其他资源库
 */
const handleOpenLibrary = async () => {
  try {
    const folderResult = await window.electronAPI.bootstrap.selectFolder()
    if (!folderResult.success || !folderResult.data || folderResult.data.canceled || folderResult.data.filePaths.length === 0) {
      return
    }
    const selectedPath = folderResult.data.filePaths[0]
    const validateResult = await window.electronAPI.bootstrap.validateLibraryPath(selectedPath)
    if (!validateResult.success || !validateResult.data) {
      toast.add({
        severity: 'warn',
        summary: '打开失败',
        detail: '所选目录不是有效资源库',
        life: 3000
      })
      return
    }

    const loadResult = await window.electronAPI.bootstrap.loadExistingLibrary(selectedPath)
    if (!loadResult.success || !loadResult.data) {
      toast.add({
        severity: 'error',
        summary: '打开失败',
        detail: loadResult.error || '无法加载该资源库',
        life: 3000
      })
      return
    }

    const openedLibrary = loadResult.data.library
    if (openedLibrary) {
      await handleSwitchLibrary(openedLibrary)
    }
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: '打开失败',
      detail: error instanceof Error ? error.message : '打开资源库时发生错误',
      life: 3000
    })
  } finally {
    emit('menu-click')
  }
}

/**
 * 切换资源库
 */
const handleSwitchLibrary = async (library: Library) => {
  if (libraryStore.currentLibrary?.id === library.id) {
    emit('menu-click')
    return
  }
  
  try {
    await libraryStore.switchLibrary(library)
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: '切换失败',
      detail: error instanceof Error ? error.message : '切换资源库时发生错误',
      life: 3000
    })
  }
  emit('menu-click')
}

/**
 * 查找
 */
const handleSearch = () => {
  logger.info('聚合搜索菜单点击')
  emit('search-click')
  emit('menu-click')
}

/**
 * 偏好设置 - 打开设置对话框
 */
const handlePreferences = () => {
  emit('open-settings')
  emit('menu-click')
}

/**
 * 关于软件
 */
const handleAbout = () => {
  logger.info('关于软件点击')
  showAboutDialog.value = true
  void loadAboutContent()
  emit('menu-click')
}

/**
 * 意见反馈
 */
const handleFeedback = () => {
  logger.info('意见反馈点击')
  showFeedbackDialog.value = true
  emit('menu-click')
}

const handleFeedbackSubmitted = () => {
  showFeedbackDialog.value = false
}

const handlePrivacy = () => {
  logger.info('隐私协议点击')
  void openPrivacyDialog()
  emit('menu-click')
}

const sanitizeCmsHtml = (html: string) => {
  const rawHtml = String(html || '').trim()
  if (!rawHtml) return ''
  const parser = new DOMParser()
  const doc = parser.parseFromString(rawHtml, 'text/html')
  doc.querySelectorAll('script, iframe, object, embed').forEach((node) => node.remove())
  doc.querySelectorAll('*').forEach((element) => {
    Array.from(element.attributes).forEach((attr) => {
      const name = attr.name.toLowerCase()
      const value = attr.value.trim()
      if (name.startsWith('on')) {
        element.removeAttribute(attr.name)
        return
      }
      if ((name === 'href' || name === 'src') && /^javascript:/i.test(value)) {
        element.removeAttribute(attr.name)
      }
    })
  })
  return doc.body.innerHTML.trim()
}

const loadAboutContent = async (forceReload = false) => {
  if (aboutLoading.value) return
  if (!forceReload && aboutContentHtml.value && !aboutLoadError.value) return
  aboutLoading.value = true
  aboutLoadError.value = ''
  try {
    const cfg = await getBackendAuthConfig()
    const content = await fetchCmsContentByKey(cfg, ABOUT_CONTENT_KEY)
    aboutDialogTitle.value = String(content.title || '关于软件')
    aboutContentHtml.value = sanitizeCmsHtml(String(content.contentText || ''))
    logger.info('关于我们内容加载成功', {
      contentKey: ABOUT_CONTENT_KEY,
      htmlLength: aboutContentHtml.value.length,
      hasTitle: Boolean(content.title),
    })
  } catch (error) {
    logger.error('关于我们内容加载失败', error)
    aboutLoadError.value = (error as Error)?.message || '加载关于我们失败，请稍后重试'
    aboutContentHtml.value = ''
  } finally {
    aboutLoading.value = false
  }
}

const loadPrivacyContent = async (forceReload = false) => {
  if (privacyLoading.value) return
  if (!forceReload && privacyContentHtml.value && !privacyLoadError.value) return
  privacyLoading.value = true
  privacyLoadError.value = ''
  try {
    const cfg = await getBackendAuthConfig()
    const content = await fetchCmsContentByKey(cfg, PRIVACY_CONTENT_KEY)
    privacyDialogTitle.value = String(content.title || '隐私协议')
    privacyContentHtml.value = sanitizeCmsHtml(String(content.contentText || ''))
    logger.info('隐私协议内容加载成功', {
      contentKey: PRIVACY_CONTENT_KEY,
      htmlLength: privacyContentHtml.value.length,
      hasTitle: Boolean(content.title),
    })
  } catch (error) {
    logger.error('隐私协议内容加载失败', error)
    privacyLoadError.value = (error as Error)?.message || '加载隐私协议失败，请稍后重试'
    privacyContentHtml.value = ''
  } finally {
    privacyLoading.value = false
  }
}

const openPrivacyDialog = async () => {
  showPrivacyDialog.value = true
  await loadPrivacyContent()
}

/**
 * 退出应用
 */
const handleExit = () => {
  logger.info('退出应用')
  window.electronAPI?.window?.close()
}

onBeforeUnmount(() => {
  unsubscribeConfigChanged?.()
  unsubscribeConfigChanged = null
  unsubscribeShortcutTriggered?.()
  unsubscribeShortcutTriggered = null
})
</script>

<style scoped>
/* 修复按钮 hover 跳动问题 */
.toolbar-btn {
  border: 1px solid transparent !important;
  padding: 0.5rem !important;
  min-height: 32px;
  min-width: 32px;
  background: transparent !important;
}

.toolbar-btn:hover {
  border-color: transparent !important;
  padding: 0.5rem !important;
  background-color: var(--sidebar-hover-bg) !important;
}

.cms-html-content :deep(h1),
.cms-html-content :deep(h2),
.cms-html-content :deep(h3),
.cms-html-content :deep(h4),
.cms-html-content :deep(h5),
.cms-html-content :deep(h6) {
  margin: 0 0 0.75rem;
  font-weight: 600;
  color: var(--content-text);
}

.cms-html-content :deep(p) {
  margin: 0 0 0.75rem;
  white-space: pre-wrap;
  word-break: break-word;
}

.cms-html-content :deep(ul),
.cms-html-content :deep(ol) {
  margin: 0 0 0.75rem 1.25rem;
  padding: 0;
}

.cms-html-content :deep(li) {
  margin-bottom: 0.375rem;
}

.cms-html-content :deep(a) {
  color: var(--primary-color);
  text-decoration: underline;
}

.cms-html-content :deep(table) {
  width: 100%;
  border-collapse: collapse;
  margin-bottom: 0.75rem;
}

.cms-html-content :deep(th),
.cms-html-content :deep(td) {
  border: 1px solid var(--content-border);
  padding: 0.5rem;
  vertical-align: top;
}

.cms-html-content :deep(img) {
  max-width: 100%;
  height: auto;
}
</style>

<style>
/* TieredMenu 全局样式 - 支持主题变量 */
.toolbar-tiered-menu {
  background-color: var(--content-card-bg) !important;
  border-color: var(--content-border) !important;
  min-width: 280px;
}

.toolbar-tiered-menu .p-tieredmenu-item-link {
  color: var(--content-text) !important;
}

.toolbar-tiered-menu .p-tieredmenu-item-content:hover,
.toolbar-tiered-menu .p-tieredmenu-item-link:hover {
  background-color: var(--sidebar-hover-bg) !important;
}

.toolbar-tiered-menu .p-tieredmenu-submenu {
  background-color: var(--content-card-bg) !important;
  border-color: var(--content-border) !important;
  min-width: 280px;
}

.toolbar-tiered-menu .p-tieredmenu-separator {
  border-color: var(--content-border) !important;
}

.toolbar-tiered-menu .p-tieredmenu-item-icon {
  color: var(--content-text-secondary) !important;
}

.feedback-dialog .max-w-5xl {
  max-width: none !important;
}

.feedback-dialog .mx-auto {
  margin-left: 0 !important;
  margin-right: 0 !important;
}
</style>
