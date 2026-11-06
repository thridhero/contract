<template>
  <router-view :key="appKey" />
  <!-- 全局 Toast 容器 -->
  <Toast position="bottom-right" />

  <ConfirmDialog />
  <FileCopyConflictDialog />
  <TaskConfirmDialog
    :visible="showTaskConfirm"
    :tasks="taskConfirmTasks"
    @confirm="onConfirmClose"
    @cancel="onCancelClose"
  />
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import Toast from 'primevue/toast'
import ConfirmDialog from 'primevue/confirmdialog'
import { useToast } from 'primevue/usetoast'
import { useConfirm } from 'primevue/useconfirm'
import FileCopyConflictDialog from './components/FileCopyConflictDialog.vue'
import TaskConfirmDialog from './components/TaskConfirmDialog.vue'
import { useThemeStore } from './stores/ui/themeStore'
import { useAIStore } from './stores/system/aiStore'
import type { TaskInfo } from '../shared/types/taskMonitor.types'
import { createRendererLogger } from './utils/logger'
import { clearBusinessCacheOnVersionUpgrade } from './utils/businessCacheReset'

const router = useRouter()
const themeStore = useThemeStore()
const aiStore = useAIStore()
const toast = useToast()
const confirm = useConfirm()
const logger = createRendererLogger('App')
const showTaskConfirm = ref(false)
const taskConfirmTasks = ref<TaskInfo[]>([])
const appKey = ref(0)

let unsubscribeCloseGuard: (() => void) | null = null
const handleLibrarySwitched = async () => {
  // 当切换资源库时，跳回首页并刷新应用级别 key
  await router.push('/')
  appKey.value++
}

const runStartupBusinessCacheMaintenance = async () => {
  try {
    const changed = await clearBusinessCacheOnVersionUpgrade()
    if (changed) {
      window.location.reload()
    }
  } catch (error) {
    logger.warn('启动阶段自动清理业务缓存失败', error)
  }
}

onMounted(() => {
  void runStartupBusinessCacheMaintenance()
  themeStore.initTheme()
  aiStore.initAISettings()

  window.addEventListener('library-switched', handleLibrarySwitched)

  unsubscribeCloseGuard = window.electronAPI?.closeGuard?.onShowConfirm?.((data) => {
    if (data?.hasActiveTasks) {
      taskConfirmTasks.value = Array.isArray(data.tasks) ? data.tasks : []
      showTaskConfirm.value = true
    }
  })

})

onUnmounted(() => {
  window.removeEventListener('library-switched', handleLibrarySwitched)
  unsubscribeCloseGuard?.()
})

function onConfirmClose(): void {
  showTaskConfirm.value = false
  taskConfirmTasks.value = []
}

function onCancelClose(): void {
  showTaskConfirm.value = false
  taskConfirmTasks.value = []
}
</script>

<style>
/* App.vue 特定的全局样式 */
/* 注意：基础样式已迁移到 styles/base.css */
</style>
