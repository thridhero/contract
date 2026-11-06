<template>
  <Panel :style="themeVars" class="h-full">
    <template #header>
      <div class="flex items-center">
        <h1 class="text-xl font-semibold m-0" :style="{ color: theme.content.text }">宏起助手 - 浏览器与聊天</h1>
      </div>
    </template>
    <div class="flex flex-grow overflow-hidden h-full">
      <BrowserPanel :style="{ width: `${panelStore.getLeftPanelWidth}%` }" />
      <Separator
        @resize="handleResize"
        :left-width="panelStore.getLeftPanelWidth"
      />
      <ChatPanel :style="{ width: `${panelStore.getRightPanelWidth}%` }" />
    </div>
  </Panel>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { usePanelStore } from '@renderer/stores/ui/panel'
import BrowserPanel from '@renderer/components/Browser.vue'
import ChatPanel from '@renderer/components/Chat.vue'
import Separator from '@renderer/components/Separator.vue'
import { defaultTheme } from '@renderer/themes/default'
import Panel from 'primevue/panel'

// Store
const panelStore = usePanelStore()

// 数据
const theme = defaultTheme

// 计算属性
const themeVars = computed(() => ({
  '--sidebar-bg': theme.sidebar.background,
  '--sidebar-text': theme.sidebar.text,
  '--sidebar-hover-bg': theme.sidebar.hoverBackground,
  '--sidebar-active-bg': theme.sidebar.activeBackground,
  '--sidebar-active-border': theme.sidebar.activeBorder,
  '--titlebar-bg': theme.titlebar.background,
  '--content-bg': theme.content.background,
  '--card-bg': theme.content.cardBackground,
  '--text-color': theme.content.text,
  '--border-color': theme.content.border,
  '--primary-btn-bg': theme.button.primary.background,
  '--primary-btn-hover': theme.button.primary.hover,
  '--primary-btn-text': theme.button.primary.text,
  '--secondary-btn-bg': theme.button.secondary.background,
  '--secondary-btn-hover': theme.button.secondary.hover,
  '--separator-color': theme.separator.color
}))

// 方法 - 箭头函数
const handleResize = (newLeftWidth: number): void => {
  panelStore.updatePanelSizes(newLeftWidth)
}
</script>
