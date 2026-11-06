<template>
  <div
    class="flex items-center gap-1"
    :class="showDivider ? 'border-l border-[var(--content-border)] pl-2' : ''"
    style="-webkit-app-region: no-drag;"
    @dblclick.stop
  >
    <Button
      v-if="showMinimize"
      icon="pi pi-minus"
      aria-label="最小化"
      class="p-button-sm p-button-text p-button-secondary !w-8 !h-8 !p-0 custom-icon-btn"
      v-tooltip.bottom="'最小化'"
      @click="minimizeWindow"
    />
    <Button
      v-if="showMaximize"
      :icon="windowStateStore.getIsMaximized ? 'pi pi-window-minimize' : 'pi pi-window-maximize'"
      :aria-label="windowStateStore.getIsMaximized ? '还原' : '最大化'"
      class="p-button-sm p-button-text p-button-secondary !w-8 !h-8 !p-0 custom-icon-btn"
      v-tooltip.bottom="windowStateStore.getIsMaximized ? '还原' : '最大化'"
      @click="toggleMaximize"
    />
    <Button
      v-if="showClose"
      icon="pi pi-times"
      aria-label="关闭"
      class="p-button-sm p-button-text p-button-secondary !w-8 !h-8 !p-0 custom-icon-btn hover:!bg-red-50 hover:!text-red-500 dark:hover:!bg-red-900/30"
      v-tooltip.bottom="'关闭'"
      @click="closeWindow"
    />
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import Button from 'primevue/button'
import { useWindowStateStore } from '../stores/ui/windowState'

withDefaults(defineProps<{
  showMinimize?: boolean
  showMaximize?: boolean
  showClose?: boolean
  showDivider?: boolean
}>(), {
  showMinimize: true,
  showMaximize: true,
  showClose: true,
  showDivider: true,
})

const windowStateStore = useWindowStateStore()

let unlistenMaximizeChanged: null | (() => void) = null

const minimizeWindow = (): void => {
  window.electronAPI?.window?.minimize?.() ?? window.electronAPI?.minimizeWindow?.()
}

const toggleMaximize = (): void => {
  window.electronAPI?.window?.toggleMaximize?.() ?? window.electronAPI?.toggleMaximizeWindow?.()
}

const closeWindow = (): void => {
  window.electronAPI?.window?.close?.() ?? window.electronAPI?.closeWindow?.()
}

onMounted(async () => {
  unlistenMaximizeChanged = window.electronAPI?.window?.onMaximizeChanged?.((status) => {
    windowStateStore.setMaximized(status)
  }) ?? null

  const statusPromise = window.electronAPI?.window?.isMaximized?.()
  if (statusPromise) {
    const res = await statusPromise
    windowStateStore.setMaximized(Boolean(res?.success && res?.data))
  }
})

onUnmounted(() => {
  unlistenMaximizeChanged?.()
  unlistenMaximizeChanged = null
})
</script>
