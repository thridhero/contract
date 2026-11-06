<template>
  <div
    class="title-bar flex flex-col w-full border-0 rounded-none select-none py-2 transition-colors duration-200"
  >
    <!-- 顶部标题栏 -->
    <div class="flex items-center justify-end px-2" style="-webkit-app-region: drag; height: 32px;">
      <!-- 窗口控制按钮 -->
      <div class="flex items-center" style="-webkit-app-region: no-drag">
        <!-- 固定属性面板按钮 -->
        <Button
          @click="togglePropertiesPanel"
          class="title-bar-button transition-colors duration-200"
          :class="{ 'text-blue-500': panelVisibilityStore.alwaysShowPanel }"
          :title="panelVisibilityStore.alwaysShowPanel ? '取消固定' : '固定面板'"
          text
          size="small"
          :icon="panelVisibilityStore.alwaysShowPanel ? 'pi pi-thumbtack-fill' : 'pi pi-thumbtack'"
        />
        <Button
          @click="minimizeWindow"
          class="title-bar-button transition-colors duration-200"
          title="最小化"
          text
          size="small"
          icon="pi pi-minus"
        />
        <Button
          @click="toggleMaximize"
          class="title-bar-button transition-colors duration-200"
          :title="windowStateStore.getIsMaximized ? '还原' : '最大化'"
          text
          size="small"
          :icon="windowStateStore.getIsMaximized ? 'pi pi-window-minimize' : 'pi pi-window-maximize'"
        />
        <Button
          @click="closeWindow"
          class="title-bar-button close-button transition-colors duration-200"
          title="关闭"
          text
          size="small"
          icon="pi pi-times"
        />
      </div>
    </div>

    <!-- 基本信息区域 -->
    <div
      class="px-3 py-2 border-t transition-colors duration-200"
      style="border-color: var(--content-divider)"
    >
      <div class="flex items-center justify-between mb-2">
        <span class="text-xs font-medium opacity-70 transition-colors duration-200" style="color: var(--sidebar-text)">
          基本信息
        </span>
        <i class="pi pi-chevron-up text-xs opacity-50 transition-colors duration-200" style="color: var(--sidebar-text)"></i>
      </div>
      <div class="space-y-1">
        <div class="flex items-center justify-between text-xs">
          <span class="opacity-60 transition-colors duration-200" style="color: var(--sidebar-text-secondary)">文件数</span>
          <span class="transition-colors duration-200" style="color: var(--sidebar-text)">{{ formatNumber(fileCount) }}</span>
        </div>
        <div class="flex items-center justify-between text-xs">
          <span class="opacity-60 transition-colors duration-200" style="color: var(--sidebar-text-secondary)">占用空间</span>
          <span class="transition-colors duration-200" style="color: var(--sidebar-text)">{{ fileSize }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import Button from 'primevue/button'
import { useWindowStateStore } from '../stores/ui/windowState'
import { usePanelVisibilityStore } from '../stores/ui/panelVisibility'

// Props
const props = defineProps({
  currentTitle: {
    type: String,
    default: '全部'
  },
  fileCount: {
    type: Number,
    default: 1158
  },
  fileSize: {
    type: String,
    default: '2.75 GB'
  }
})

// Stores
const windowStateStore = useWindowStateStore()
const panelVisibilityStore = usePanelVisibilityStore()

// 格式化数字
const formatNumber = (num: number): string => {
  return num.toLocaleString()
}

// 窗口控制方法
const minimizeWindow = (): void => {
  window.electronAPI?.minimizeWindow?.()
}

const toggleMaximize = (): void => {
  window.electronAPI?.toggleMaximizeWindow?.()
}

const closeWindow = (): void => {
  window.electronAPI?.closeWindow?.()
}

const togglePropertiesPanel = (): void => {
  panelVisibilityStore.toggleAlwaysShowPanel()
}

// 生命周期
onMounted(() => {
  // 监听窗口状态变化
  window.electronAPI?.onMaximizeStatusChange?.((event: any, status: boolean) => {
    windowStateStore.setMaximized(status)
  })

  // 获取初始窗口状态
  window.electronAPI?.isWindowMaximized?.().then((status: boolean) => {
    windowStateStore.setMaximized(status)
  })
})
</script>

<style scoped>
.title-bar {
  user-select: none;
}

.title-bar-button {
  width: 28px;
  height: 28px;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  color: var(--sidebar-text);
}

.title-bar-button:hover {
  background-color: var(--sidebar-hover-bg);
}

.close-button:hover {
  background-color: var(--btn-danger-bg);
  color: var(--btn-danger-text);
}

:deep(.title-bar-button.p-button) {
  background: transparent;
  border: none;
}

:deep(.title-bar-button.p-button .p-button-icon) {
  font-size: 12px;
  color: var(--sidebar-text);
}

:deep(.title-bar-button.p-button:hover .p-button-icon) {
  color: inherit;
}
</style>
