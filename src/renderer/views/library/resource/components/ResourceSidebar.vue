<template>
  <div class="resource-sidebar flex flex-col h-full select-none ">
    <div :class="isCollapsed ? 'px-2 py-3 mt-1 mb-2' : 'px-3 py-2 my-2'">
      <ToolbarRight
        @open-settings="emit('menu-action', 'settings')"
        @notification-click="handleMenuAction('notification')"
        @search-click="openFilter"
        @sync="handleMenuAction('sync')"
        @toggle-sidebar="handleMenuAction('toggle-sidebar')"
        @toggle-sidebar-collapse="emit('toggle-sidebar-collapse')"
      />
    </div>



    <Dialog
      v-model:visible="showLibraryPopup"
      modal
      header="资源库管理"
      class="library-switcher-popup"
      :style="{ width: '32rem' }"
      :closable="true"
      :closeOnEscape="true"
      :dismissableMask="true"
      :draggable="false"
    >
      <div class="flex flex-col gap-3">
        <div class="grid grid-cols-4 gap-2">
          <Button label="新增合同信息" size="small" icon="pi pi-plus" @click="openCreateContractInfo" />
          <Button label="创建资源库" size="small" @click="openCreateLibrary" />
          <Button label="打开其他资源库" size="small" :loading="openingLibrary" @click="handleOpenOtherLibrary" />
          <Button label="合并其他资源库" size="small" severity="secondary" :loading="mergingLibrary" @click="handleMergeOtherLibrary" />
        </div>
        <InputText
          v-model="librarySearchQuery"
          placeholder="搜索资源库名称"
          class="w-full"
        />
        <div class="library-list rounded-md border overflow-y-auto" :style="{ borderColor: 'var(--content-border)', maxHeight: '300px' }">
          <button
            v-for="library in filteredLibraries"
            :key="library.id"
            type="button"
            class="library-popup-item w-full text-left px-3 py-2 transition-colors duration-150"
            :class="{ active: libraryStore.currentLibrary?.id === library.id }"
            @click="handleSwitchLibrary(library)"
          >
            <div class="flex items-center justify-between gap-2">
              <span class="text-sm truncate">{{ library.name }}</span>
              <span v-if="libraryStore.currentLibrary?.id === library.id" class="text-xs opacity-80">当前</span>
            </div>
            <div class="text-xs opacity-60 truncate mt-0.5">{{ library.path }}</div>
          </button>
          <div v-if="filteredLibraries.length === 0" class="px-3 py-6 text-center text-sm opacity-60">
            未找到匹配的资源库
          </div>
        </div>
      </div>
    </Dialog>

    <CreateLibraryModal
      v-model:visible="showCreateLibraryModal"
      @created="handleLibraryCreated"
      @cancel="showCreateLibraryModal = false"
    />

    <template v-if="!isCollapsed">
      <div class="flex-1 overflow-y-auto">
        <div class="px-2 pb-2">
          <Menu :model="quickCategoriesMenu" class="w-full sidebar-menu">
            <template #item="{ item, props: menuProps }">
              <a
                v-ripple
                class="sidebar-menu-item"
                :class="{ 'sidebar-menu-item-active': item.active }"
                v-bind="getMenuActionAttrs(menuProps.action)"
                @click.prevent="activateMenuItem(item, $event)"
                @keydown.enter.prevent="activateMenuItem(item, $event)"
                @keydown.space.prevent="activateMenuItem(item, $event)"
              >
                <i v-if="item.icon" :class="[item.icon, 'sidebar-menu-item-icon']"></i>
                <span class="sidebar-menu-item-text">{{ item.label }}</span>
                <span v-if="item.badge" class="sidebar-menu-item-badge">{{ item.badge }}</span>
              </a>
            </template>
          </Menu>
        </div>

        <div v-if="contractMenu.length > 0" class="px-2 pb-2">
          <div class="px-3 py-1.5 text-sm opacity-60 mb-1" :style="{ color: 'var(--sidebar-text-secondary)' }">
            合同
          </div>
          <Menu :model="contractMenu" class="w-full sidebar-menu">
            <template #item="{ item, props: menuProps }">
              <a
                v-ripple
                class="sidebar-menu-item"
                :class="{ 'sidebar-menu-item-active': item.active }"
                v-bind="getMenuActionAttrs(menuProps.action)"
                @click.prevent="activateMenuItem(item, $event)"
                @keydown.enter.prevent="activateMenuItem(item, $event)"
                @keydown.space.prevent="activateMenuItem(item, $event)"
              >
                <i v-if="item.icon" :class="[item.icon, 'sidebar-menu-item-icon']"></i>
                <span class="sidebar-menu-item-text">{{ item.label }}</span>
                <span v-if="item.badge" class="sidebar-menu-item-badge">{{ item.badge }}</span>
              </a>
            </template>
          </Menu>
        </div>

        <div v-if="systemSettingsMenu.length > 0" class="px-2 pb-2">
          <div class="px-3 py-1.5 text-sm opacity-60 mb-1" :style="{ color: 'var(--sidebar-text-secondary)' }">
            系统设置
          </div>
          <Menu :model="systemSettingsMenu" class="w-full sidebar-menu">
            <template #item="{ item, props: menuProps }">
              <a
                v-if="!item.separator"
                v-ripple
                class="sidebar-menu-item"
                :class="{ 'sidebar-menu-item-active': item.active }"
                v-bind="getMenuActionAttrs(menuProps.action)"
                @click.prevent="activateMenuItem(item, $event)"
                @keydown.enter.prevent="activateMenuItem(item, $event)"
                @keydown.space.prevent="activateMenuItem(item, $event)"
              >
                <i v-if="item.icon" :class="[item.icon, 'sidebar-menu-item-icon']"></i>
                <span class="sidebar-menu-item-text">{{ item.label }}</span>
                <span v-if="item.badge" class="sidebar-menu-item-badge">{{ item.badge }}</span>
              </a>
              <div
                v-else
                class="sidebar-menu-separator"
                :style="{ borderTop: '1px solid var(--sidebar-divider)' }"
              />
            </template>
          </Menu>
        </div>
      </div>
    </template>

    <template v-else>
      <div class="flex-1 overflow-y-auto px-2 pb-2">
        <div class="flex flex-col gap-2 mt-2">
          <button
            v-for="item in primaryQuickCategories"
            :key="item.key"
            type="button"
            class="w-12 h-10 flex items-center justify-center rounded-lg transition-colors duration-150 mx-auto"
            :style="{
              backgroundColor: props.selectedCategory === item.key ? 'var(--sidebar-active-bg)' : 'transparent',
              color: props.selectedCategory === item.key ? 'var(--sidebar-active-border)' : 'var(--sidebar-text)'
            }"
            v-tooltip.right="item.name"
            @click="selectCategory(item.key)"
          >
            <i :class="`pi pi-${item.icon}`" class="text-xl"></i>
          </button>
        </div>

        <div
          v-if="contractCategories.length > 0"
          class="my-3 mx-2 border-t"
          :style="{ borderColor: 'var(--sidebar-divider)' }"
        />

        <div v-if="contractCategories.length > 0" class="flex flex-col gap-2">
          <button
            v-for="item in contractCategories"
            :key="item.key"
            type="button"
            class="w-12 h-10 flex items-center justify-center rounded-lg transition-colors duration-150 mx-auto"
            :style="{
              backgroundColor: props.selectedCategory === item.key ? 'var(--sidebar-active-bg)' : 'transparent',
              color: props.selectedCategory === item.key ? 'var(--sidebar-active-border)' : 'var(--sidebar-text)'
            }"
            v-tooltip.right="item.name"
            @click="selectCategory(item.key)"
          >
            <i :class="`pi pi-${item.icon}`" class="text-xl"></i>
          </button>
        </div>

        <div
          v-if="systemSettingsCategories.length > 0 || quickAccess.length > 0"
          class="my-3 mx-2 border-t"
          :style="{ borderColor: 'var(--sidebar-divider)' }"
        />

        <div v-if="systemSettingsCategories.length > 0" class="flex flex-col gap-2">
          <button
            v-for="item in systemSettingsCategories"
            :key="item.key"
            type="button"
            class="w-12 h-10 flex items-center justify-center rounded-lg transition-colors duration-150 mx-auto"
            :style="{
              backgroundColor: props.selectedCategory === item.key ? 'var(--sidebar-active-bg)' : 'transparent',
              color: props.selectedCategory === item.key ? 'var(--sidebar-active-border)' : 'var(--sidebar-text)'
            }"
            v-tooltip.right="item.name"
            @click="selectCategory(item.key)"
          >
            <i :class="`pi pi-${item.icon}`" class="text-xl"></i>
          </button>
        </div>

        <div v-if="quickAccess.length > 0" class="flex flex-col gap-2 mt-3">
          <button
            v-for="item in quickAccess"
            :key="item.key"
            type="button"
            class="w-12 h-10 flex items-center justify-center rounded-lg transition-colors duration-150 mx-auto"
            :style="{
              backgroundColor: props.selectedCategory === item.key ? 'var(--sidebar-active-bg)' : 'transparent',
              color: props.selectedCategory === item.key ? 'var(--sidebar-active-border)' : 'var(--sidebar-text)'
            }"
            v-tooltip.right="item.name"
            @click="selectCategory(item.key)"
          >
            <i :class="`pi pi-${item.icon}`" class="text-xl"></i>
          </button>
        </div>
      </div>
    </template>

    <div class="user-section px-3 py-3 border-t" :style="{ borderColor: 'var(--sidebar-divider)' }">
      <div v-if="!isCollapsed">
        <div
          class="user-panel rounded-xl px-3 py-3 cursor-pointer"
          :style="{
            backgroundColor: 'var(--sidebar-hover-bg)',
            border: '1px solid var(--sidebar-divider)'
          }"
          @click="(e) => userMenu?.toggle(e)"
        >
          <div class="flex items-center gap-3 min-w-0">
            <div
              class="user-avatar flex items-center justify-center rounded-full text-sm font-semibold shrink-0"
              :style="{
                backgroundColor: 'var(--sidebar-active-bg)',
                color: 'var(--sidebar-active-border)'
              }"
            >
              <img
                v-if="displayAvatarUrl"
                :src="displayAvatarUrl"
                alt="用户头像"
                class="w-full h-full rounded-full object-cover"
                @error="handleAvatarError"
              />
              <span v-else>{{ userInitial }}</span>
            </div>
            <div class="min-w-0 flex-1">
              <div class="text-sm font-medium truncate" :style="{ color: 'var(--sidebar-text)' }">
                {{ userPrimaryText }}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div v-else class="flex flex-col items-center gap-2">
        <button
          type="button"
          class="collapsed-user-btn"
          :title="userPrimaryText"
          v-tooltip.right="userPrimaryText"
          :style="{
            backgroundColor: 'var(--sidebar-hover-bg)',
            color: 'var(--sidebar-active-border)',
            border: '1px solid var(--sidebar-divider)'
          }"
          @click="(e) => userMenu?.toggle(e)"
        >
          <img
            v-if="displayAvatarUrl"
            :src="displayAvatarUrl"
            alt="用户头像"
            class="w-full h-full rounded-full object-cover"
            @error="handleAvatarError"
          />
          <span v-else>{{ userInitial }}</span>
        </button>
      </div>

      <Menu ref="userMenu" :model="userMenuItems" :popup="true" class="user-menu-popup">
        <template #item="{ item, props }">
          <a v-bind="props.action" class="flex items-center gap-2 w-full px-4 py-2.5">
            <i :class="item.icon" class="text-sm"></i>
            <span class="text-sm">{{ item.label }}</span>
          </a>
        </template>
      </Menu>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, type InstanceType } from 'vue'
import { useRouter } from 'vue-router'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import Menu from 'primevue/menu'
import { useToast } from 'primevue/usetoast'
import ToolbarRight from '../../../../components/ToolbarRight.vue'
import CreateLibraryModal from '../../../../components/CreateLibraryModal.vue'
import type { SidebarCategory, SidebarFolder } from '../../../../stores/ui/sidebarStore'
import { useLibraryStore } from '../../../../stores/library/libraryStore'
import { useAuthStore } from '../../../../stores/system/authStore'
import { backendFetch, extractUserProfileSnapshot, getBackendAuthConfig } from '../../../../utils/backendAuth'
import type { Library } from '../../../../../shared/types/library.types'

interface Props {
  sidebarWidth?: number
  isSidebarCollapsed?: boolean
  searchQuery?: string
  selectedCategory?: string
  selectedFolderId?: number | null
  expandedFolders?: Set<number>
  quickCategories?: SidebarCategory[]
  quickAccess?: SidebarCategory[]
  smartFolders?: SidebarCategory[]
  folders?: SidebarFolder[]
}

const props = withDefaults(defineProps<Props>(), {
  sidebarWidth: 240,
  isSidebarCollapsed: false,
  searchQuery: '',
  selectedCategory: 'all',
  selectedFolderId: null,
  expandedFolders: () => new Set(),
  quickCategories: () => [],
  quickAccess: () => [],
  smartFolders: () => [],
  folders: () => []
})

const emit = defineEmits<{
  (e: 'search', value: string): void
  (e: 'select-category', key: string): void
  (e: 'toggle-folder', folderId: number): void
  (e: 'select-folder', folderId: number): void
  (e: 'add-folder'): void
  (e: 'create-contract'): void
  (e: 'menu-action', key: string): void
  (e: 'toggle-sidebar-collapse'): void
  (e: 'open-filter'): void
}>()

const isCollapsed = computed(() => props.isSidebarCollapsed)
const quickAccess = computed(() => props.quickAccess)

const showLibraryPopup = ref(false)
const showCreateLibraryModal = ref(false)
const librarySearchQuery = ref('')
const openingLibrary = ref(false)
const mergingLibrary = ref(false)
const avatarLoadFailed = ref(false)
const userMenu = ref<InstanceType<typeof Menu>>()
const userMenuItems = computed(() => [
  { label: '设置', icon: 'pi pi-cog', command: () => emit('menu-action', 'settings') },
  { label: '会员服务', icon: 'pi pi-star', command: () => emit('menu-action', 'billing') },
  { separator: true },
  { label: '退出登录', icon: 'pi pi-sign-out', command: () => logout() }
])

const libraryStore = useLibraryStore()
const authStore = useAuthStore()
const toast = useToast()
const router = useRouter()

const userPrimaryText = computed(() => {
  return authStore.userProfile.nickname || authStore.userProfile.userName || '已登录用户'
})

const userAvatarUrl = computed(() => authStore.userProfile.avatarUrl || '')
const displayAvatarUrl = computed(() => avatarLoadFailed.value ? '' : userAvatarUrl.value)

const userInitial = computed(() => {
  const source = userPrimaryText.value.trim()
  return source ? source.slice(0, 1).toUpperCase() : 'U'
})

const filteredLibraries = computed(() => {
  const keyword = librarySearchQuery.value.trim().toLowerCase()
  if (!keyword) {
    return libraryStore.libraries
  }
  return libraryStore.libraries.filter(library => library.name.toLowerCase().includes(keyword))
})

watch(showLibraryPopup, async (visible) => {
  if (visible) {
    librarySearchQuery.value = ''
    await refreshLibraries()
  }
})

watch(userAvatarUrl, () => {
  avatarLoadFailed.value = false
})

const handleAvatarError = () => {
  avatarLoadFailed.value = true
}

const loadUserProfile = async () => {
  await authStore.init()
  if (!authStore.isLoggedIn) {
    return
  }
  try {
    const cfg = await getBackendAuthConfig()
    const response = await backendFetch(`${cfg.baseUrl.replace(/\/+$/, '')}/system/user/getInfo`, {
      method: 'GET',
      auth: {
        accessToken: authStore.accessToken,
        clientId: authStore.clientId,
      },
    })
    const json = await response.json().catch(() => null)
    if (!response.ok || json?.code !== 200 || !json?.data || typeof json.data !== 'object') {
      throw new Error(json?.msg || json?.message || '获取用户信息失败')
    }
    await authStore.syncUserProfile({
      ...authStore.userProfile,
      ...extractUserProfileSnapshot(json.data),
    })
  } catch {
    // 保留已有用户快照，避免短暂请求失败导致头像和昵称闪烁消失
  }
}

const ensureCurrentLibraryExists = () => {
  const current = libraryStore.currentLibrary
  if (!current) {
    return
  }
  if (!libraryStore.libraries.some(library => library.id === current.id)) {
    libraryStore.libraries = [current, ...libraryStore.libraries]
  }
}

const refreshLibraries = async () => {
  await libraryStore.fetchLibraries()
  ensureCurrentLibraryExists()
}

const openLibraryPopup = () => {
  showLibraryPopup.value = true
}

const handleSwitchLibrary = async (library: Library) => {
  showLibraryPopup.value = false
  await libraryStore.switchLibrary(library)
}

const openCreateLibrary = () => {
  showCreateLibraryModal.value = true
}

const openCreateContractInfo = () => {
  showLibraryPopup.value = false
  emit('create-contract')
}

const handleLibraryCreated = async (library: Library) => {
  showCreateLibraryModal.value = false
  await refreshLibraries()
  showLibraryPopup.value = false
  await libraryStore.switchLibrary(library)
}

const handleOpenOtherLibrary = async () => {
  if (openingLibrary.value) {
    return
  }
  openingLibrary.value = true
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
      libraryStore.currentLibrary = openedLibrary
      localStorage.setItem('currentLibraryId', openedLibrary.id)
      localStorage.setItem('currentLibraryPath', openedLibrary.path)
      localStorage.setItem('currentLibraryName', openedLibrary.name)
    }

    await refreshLibraries()
    showLibraryPopup.value = false
    window.location.reload()
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: '打开失败',
      detail: error instanceof Error ? error.message : '打开资源库时发生错误',
      life: 3000
    })
  } finally {
    openingLibrary.value = false
  }
}

const handleMergeOtherLibrary = async () => {
  if (mergingLibrary.value) {
    return
  }
  mergingLibrary.value = true
  try {
    const folderResult = await window.electronAPI.bootstrap.selectFolder()
    if (!folderResult.success || !folderResult.data || folderResult.data.canceled || folderResult.data.filePaths.length === 0) {
      return
    }
    const selectedPath = folderResult.data.filePaths[0]
    toast.add({
      severity: 'info',
      summary: '已触发合并入口',
      detail: `待合并资源库：${selectedPath}`,
      life: 3000
    })
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: '触发失败',
      detail: error instanceof Error ? error.message : '触发合并入口失败',
      life: 3000
    })
  } finally {
    mergingLibrary.value = false
  }
}

const handleMenuAction = (key: string) => {
  switch (key) {
    case 'notification':
      emit('menu-action', 'notification')
      break
    case 'sync':
      emit('menu-action', 'sync')
      break
    case 'toggle-sidebar':
      emit('menu-action', 'toggle-sidebar')
      break
    default:
      emit('menu-action', key)
  }
}

const logout = async () => {
  await authStore.clearAuth()
  await router.replace({ name: 'Home' })
}

const selectCategory = (key: string) => {
  emit('select-category', key)
}

const formatCount = (count: number): string => {
  if (count === undefined || count === null || count === 0) return ''
  return count.toLocaleString()
}

const getMenuActionAttrs = (action: Record<string, unknown> | undefined | null) => {
  const attrs: Record<string, unknown> = {}
  if (!action) return attrs
  for (const [key, value] of Object.entries(action)) {
    if (!key.startsWith('on')) {
      attrs[key] = value
    }
  }
  return attrs
}

const activateMenuItem = (item: any, event: Event) => {
  if (!item || item.separator) return
  if (typeof item.command === 'function') {
    item.command({ originalEvent: event, item })
  }
}

// === 将数组转换为 PrimeVue Menu 所需的格式 ===
const mapCategoryToMenu = (categories: SidebarCategory[]) => {
  return categories.map(item => ({
    label: item.name,
    icon: 'pi pi-' + item.icon,
    badge: formatCount(item.count),
    command: () => selectCategory(item.key),
    active: props.selectedCategory === item.key
  }))
}

const contractKeysOrder = ['contract-executions', 'contract-products', 'receipt-plans', 'contract-invoices']
const contractKeys = new Set(contractKeysOrder)
const systemSettingsKeysOrder = ['suppliers', 'customers', 'dictionaries', 'tree-dictionaries', 'department-personnel', 'contract-config', 'project-management', 'feedback']
const systemSettingsKeys = new Set(systemSettingsKeysOrder)
const primaryQuickKeysOrder = ['ai-workbench', 'toolbox']

const sortByKeyOrder = (items: SidebarCategory[], order: string[]) => {
  const indexMap = new Map(order.map((k, idx) => [k, idx]))
  return [...items].sort((a, b) => {
    const ai = indexMap.get(a.key)
    const bi = indexMap.get(b.key)
    if (ai === undefined && bi === undefined) return 0
    if (ai === undefined) return 1
    if (bi === undefined) return -1
    return ai - bi
  })
}

const primaryQuickCategories = computed(() => sortByKeyOrder(
  props.quickCategories.filter(cat => !contractKeys.has(cat.key) && !systemSettingsKeys.has(cat.key)),
  primaryQuickKeysOrder
))
const contractCategories = computed(() => sortByKeyOrder(props.quickCategories.filter(cat => contractKeys.has(cat.key)), contractKeysOrder))
const systemSettingsCategories = computed(() => sortByKeyOrder(props.quickCategories.filter(cat => systemSettingsKeys.has(cat.key)), systemSettingsKeysOrder))

const quickCategoriesMenu = computed(() => mapCategoryToMenu(primaryQuickCategories.value))
const contractMenu = computed(() => mapCategoryToMenu(contractCategories.value))

const systemSettingsMenu = computed(() => {
  const menu: any[] = [...mapCategoryToMenu(systemSettingsCategories.value)]
  if (props.quickAccess.length > 0) {
    menu.push({ separator: true }, ...mapCategoryToMenu(props.quickAccess))
  }
  return menu
})

const openFilter = () => {
  emit('open-filter')
}

onMounted(() => {
  void loadUserProfile()
})
</script>

<style scoped>
.resource-sidebar {
  flex-shrink: 0;
  user-select: none;
}

.library-popup-item {
  color: var(--sidebar-text);
  border-bottom: 1px solid var(--content-border);
  background-color: transparent;
}

.library-popup-item:last-child {
  border-bottom: none;
}

.library-popup-item:hover {
  background-color: var(--sidebar-hover-bg);
}

.library-popup-item.active {
  background-color: var(--sidebar-active-bg);
}

.user-avatar,
.collapsed-user-btn {
  width: 2.5rem;
  height: 2.5rem;
}

.collapsed-user-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 9999px;
  font-size: 0.875rem;
  font-weight: 600;
}
</style>

<style>
.user-menu-popup.p-menu {
  min-width: 12rem;
}
.user-menu-popup .p-menu-list {
  padding: 0.25rem 0;
}
.user-menu-popup .p-menuitem-link {
  width: 100%;
}
</style>

<style>
/* PrimeVue Menu 组件的侧边栏样式适配 */
.sidebar-menu {
  background: transparent !important;
  border: none !important;
  padding: 0 !important;
}

.sidebar-menu .p-menu-list {
  padding: 0 !important;
  display: flex;
  flex-direction: column;
  gap: 0.1875rem;
}

.sidebar-menu .p-menuitem {
  margin: 0 !important;
}

.sidebar-menu-item {
  padding: 0.4375rem 0.75rem;
  display: flex;
  align-items: center;
  min-height: 2.125rem;
  color: var(--sidebar-text);
  background: transparent;
  border-left: 3px solid transparent;
  border-radius: 0.375rem;
  transition: background-color 0.15s, border-color 0.15s, color 0.15s;
  text-decoration: none;
  cursor: pointer;
}

.sidebar-menu-item:hover {
  background-color: var(--sidebar-hover-bg);
}

.sidebar-menu-item:focus-visible {
  outline: none;
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--sidebar-active-border) 24%, transparent);
}

.sidebar-menu-item-active {
  background-color: var(--sidebar-active-bg) !important;
  border-left-color: var(--sidebar-active-border) !important;
  color: var(--sidebar-text) !important;
}

.sidebar-menu-item-active .sidebar-menu-item-icon,
.sidebar-menu-item-active .sidebar-menu-item-text {
  opacity: 1 !important;
}

.sidebar-menu-item-icon {
  margin-right: 0.5rem;
  font-size: 0.9375rem !important;
  opacity: 0.7;
}

.sidebar-menu-item-text {
  flex: 1;
  font-size: 1rem !important;
  line-height: 1.25;
  font-weight: 400;
}

.sidebar-menu-item-badge {
  background: transparent !important;
  color: var(--sidebar-text-secondary) !important;
  font-size: 0.875rem !important;
  min-width: auto;
  padding: 0;
  opacity: 0.6;
}

.sidebar-menu-separator {
  margin: 0.3125rem 0.75rem;
}
</style>
