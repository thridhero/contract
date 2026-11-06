<template>
  <div class="first-run-container">
    <div class="modal-overlay">
      <div class="window-controls-host">
        <WindowControls class="first-run-window-controls" />
      </div>
      <div class="modal-content">
        <!-- 头部图标和标题 -->
        <div class="modal-header">
          <div class="icon-wrapper">
            <svg class="folder-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M3 7C3 5.89543 3.89543 5 5 5H9L11 7H19C20.1046 7 21 7.89543 21 9V17C21 18.1046 20.1046 19 19 19H5C3.89543 19 3 18.1046 3 17V7Z"
                    fill="#3B82F6" stroke="#3B82F6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M7 13H9V15H7V13Z" fill="white"/>
              <path d="M11 13H13V15H11V13Z" fill="white"/>
              <path d="M15 13H17V15H15V13Z" fill="white"/>
            </svg>
          </div>
          <h1 class="title">创建资源库</h1>
        </div>

        <!-- 说明文字 -->
        <p class="description">
          请输入资源库的名称（例：xxx公司合同集），并点击下方按钮选择资源库保存的路径。
        </p>

        <!-- 资源库名称输入框 -->
        <div class="input-group">
          <InputText
            v-model="projectName"
            placeholder="资源库名称"
            class="name-input w-full"
            :class="{ 'p-invalid': showError }"
            @input="clearError"
          />
          <Message v-if="showError" severity="error" :closable="false">{{ errorMessage }}</Message>
        </div>

        <!-- 显示已选择的路径 -->
        <div v-if="selectedPath" class="path-display">
          <div class="path-label">
            <i class="pi pi-folder"></i>
            已选择路径：
          </div>
          <div class="path-value">{{ selectedPath }}</div>
        </div>

        <!-- 按钮区域 -->
        <div class="button-group">
          <Button
            label="取消"
            severity="secondary"
            outlined
            rounded
            @click="handleCancel"
          />
          <Button
            :disabled="!projectName.trim()"
            label="选择保存路径"
            icon="pi pi-folder-open"
            iconPos="right"
            severity="info"
            rounded
            @click="handleSelectPath"
          />
        </div>

        <!-- 确认创建区域（选择路径后显示） -->
        <div v-if="selectedPath" class="confirm-section">
          <Card class="path-info-card">
            <template #content>
              <div class="path-info-content">
                <div class="info-item">
                  <span class="info-label">资源库名称：</span>
                  <span class="info-value">{{ projectName }}</span>
                </div>
                <div class="info-item">
                  <span class="info-label">保存路径：</span>
                  <span class="info-value">{{ selectedPath }}</span>
                </div>
                <div class="info-item">
                  <span class="info-label">完整项目路径：</span>
                  <span class="info-value">{{ fullPath }}</span>
                </div>
              </div>
            </template>
          </Card>
          <Button
            :disabled="isInitializing"
            :label="isInitializing ? '创建中...' : '确认创建'"
            icon="pi pi-check"
            severity="success"
            rounded
            size="large"
            @click="handleInitialize"
          />
        </div>

        <!-- 加载提示 -->
        <div v-if="isInitializing" class="loading-overlay">
          <ProgressSpinner
            animationDuration=".5s"
            strokeWidth="4"
            style="width: 50px; height: 50px"
          />
          <p>正在初始化数据库...</p>
        </div>

        <!-- 已有资源库提示 -->
        <div v-if="!isInitializing" class="existing-library-tip">
          <span class="tip-text">已有资源库，</span>
          <span class="tip-link" @click="handleSelectExistingFolder">选择文件夹</span>
        </div>

        <!-- 历史资源库列表 -->
        <div v-if="!isInitializing && recentLibraries.length > 0" class="recent-libraries-section mt-6">
          <div class="text-sm text-gray-500 mb-2 font-medium">最近使用的资源库</div>
          <div class="recent-libraries-list">
            <div 
              v-for="lib in recentLibraries" 
              :key="lib.id"
              class="recent-library-item"
              @click="handleOpenRecentLibrary(lib)"
            >
              <div class="lib-info">
                <div class="lib-name">{{ lib.name }}</div>
                <div class="lib-path" :title="lib.path">{{ lib.path }}</div>
              </div>
              <i class="pi pi-chevron-right text-gray-400 text-xs"></i>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import InputText from 'primevue/inputtext'
import Button from 'primevue/button'
import Card from 'primevue/card'
import ProgressSpinner from 'primevue/progressspinner'
import Message from 'primevue/message'
import WindowControls from '@/components/WindowControls.vue'
import { createRendererLogger } from '@/utils/logger'
import type { Library } from '../../../shared/types/library.types'

const logger = createRendererLogger('FirstRun')

const router = useRouter()

// 响应式数据
const projectName = ref('')
const selectedPath = ref('')
const showError = ref(false)
const errorMessage = ref('')
const isInitializing = ref(false)
const recentLibraries = ref<Library[]>([])

// 计算属性
const fullPath = computed(() => {
  if (!projectName.value || !selectedPath.value) return ''
  return `${selectedPath.value}\\${projectName.value}`
})

// 方法
const clearError = () => {
  showError.value = false
  errorMessage.value = ''
}

const checkInitStatus = async () => {
  try {
    const status = await window.electronAPI.bootstrap.getInitStatus()
    if (status.success && status.data?.initialized) {
      // 已初始化，跳转到默认主界面
      router.push({ name: 'Home' })
    } else {
      // 未初始化时加载历史记录
      loadRecentLibraries()
    }
  } catch (error) {
    logger.error('检查初始化状态失败:', error)
  }
}

const loadRecentLibraries = async () => {
  try {
    const result = await window.electronAPI.library.getAll()
    if (result.success && result.data) {
      recentLibraries.value = result.data
    }
  } catch (error) {
    logger.error('加载历史资源库失败:', error)
  }
}

const handleSelectPath = async () => {
  if (!projectName.value.trim()) {
    showError.value = true
    errorMessage.value = '请输入资源库名称'
    return
  }

  try {
    const result = await window.electronAPI.bootstrap.selectFolder()

    if (result.success && result.data && !result.data.canceled && result.data.filePaths.length > 0) {
      selectedPath.value = result.data.filePaths[0]
    }
  } catch (error) {
    logger.error('选择文件夹失败:', error)
    alert('选择文件夹失败：' + (error as Error).message)
  }
}

const handleInitialize = async () => {
  if (!projectName.value.trim() || !selectedPath.value) {
    return
  }

  isInitializing.value = true

  try {
    const result = await window.electronAPI.bootstrap.initProject(
      projectName.value.trim(),
      selectedPath.value
    )

    if (result.success && result.data) {
      // 更新本地状态，以便进入系统后能够正确选中该资源库
      const library = result.data.library
      if (library) {
        localStorage.setItem('currentLibraryId', library.id)
        localStorage.setItem('currentLibraryPath', library.path)
        localStorage.setItem('currentLibraryName', library.name)
      }
      
      // 初始化成功，跳转到默认主界面
      router.push({ name: 'Home' })
    } else {
      // 初始化失败
      alert('初始化失败：' + result.error)
    }
  } catch (error) {
    logger.error('初始化项目失败:', error)
    alert('初始化失败：' + (error as Error).message)
  } finally {
    isInitializing.value = false
  }
}

const handleSelectExistingFolder = async () => {
  try {
    const result = await window.electronAPI.bootstrap.selectFolder()

    if (result.success && result.data && !result.data.canceled && result.data.filePaths.length > 0) {
      const selectedPathValue = result.data.filePaths[0]

      // 加载现有资源库
      const loadResult = await window.electronAPI.bootstrap.loadExistingLibrary(selectedPathValue)

      if (loadResult.success && loadResult.data) {
        // 更新本地状态，以便进入系统后能够正确选中该资源库
        const openedLibrary = loadResult.data.library
        if (openedLibrary) {
          localStorage.setItem('currentLibraryId', openedLibrary.id)
          localStorage.setItem('currentLibraryPath', openedLibrary.path)
          localStorage.setItem('currentLibraryName', openedLibrary.name)
        }
        
        // 加载成功，跳转到默认主界面
        router.push({ name: 'Home' })
      } else {
        alert('加载资源库失败：' + loadResult.error)
      }
    }
  } catch (error) {
    logger.error('选择已有资源库失败:', error)
    alert('选择文件夹失败：' + (error as Error).message)
  }
}

const handleOpenRecentLibrary = async (library: Library) => {
  try {
    const loadResult = await window.electronAPI.bootstrap.loadExistingLibrary(library.path)

    if (loadResult.success && loadResult.data) {
      const openedLibrary = loadResult.data.library || library
      localStorage.setItem('currentLibraryId', openedLibrary.id)
      localStorage.setItem('currentLibraryPath', openedLibrary.path)
      localStorage.setItem('currentLibraryName', openedLibrary.name)
      
      router.push({ name: 'Home' })
    } else {
      alert('加载资源库失败：' + loadResult.error)
    }
  } catch (error) {
    logger.error('打开资源库失败:', error)
    alert('打开资源库失败：' + (error as Error).message)
  }
}

const handleCancel = () => {
  // 用户取消，可以选择关闭应用或返回
  const confirmExit = confirm('确定要取消初始化吗？应用将无法正常使用。')
  if (confirmExit) {
    window.electronAPI.closeWindow()
  }
}

// 在 onMounted 钩子中调用，确保 DOM 和 API 都已准备好
onMounted(() => {
  checkInitStatus()
})
</script>

<style scoped>
.first-run-container {
  width: 100%;
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: #f3f4f6;
}

.modal-overlay {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  position: relative;
}

.window-controls-host {
  position: absolute;
  top: 12px;
  right: 12px;
  z-index: 10;
}

:deep(.first-run-window-controls) {
  border-left: none !important;
  padding-left: 0 !important;
}

.modal-content {
  background: #ffffff;
  border-radius: 12px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.1);
  padding: 32px;
  width: 100%;
  max-width: 480px;
  position: relative;
}

.modal-header {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: 24px;
}

.icon-wrapper {
  width: 64px;
  height: 64px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 16px;
}

.folder-icon {
  width: 100%;
  height: 100%;
}

.title {
  font-size: 1.5rem;
  font-weight: 600;
  color: #1f2937;
  margin: 0;
}

.description {
  font-size: 0.875rem;
  color: #6b7280;
  line-height: 1.6;
  text-align: center;
  margin-bottom: 24px;
}

.input-group {
  margin-bottom: 16px;
}

.name-input {
  width: 100%;
}

.path-display {
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 12px 16px;
  margin-bottom: 24px;
}

.path-label {
  font-size: 0.75rem;
  color: #6b7280;
  margin-bottom: 4px;
  display: flex;
  align-items: center;
  gap: 4px;
}

.path-value {
  font-size: 0.875rem;
  color: #1f2937;
  word-break: break-all;
}

.button-group {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
}


.btn-cancel {
  background: #e5e7eb;
  color: #374151;
  border: none;
}

.btn-cancel:hover {
  background: #d1d5db;
}

.btn-select-path {
  background: #3B82F6;
  color: #ffffff;
  border: none;
}

.btn-select-path:hover:not(:disabled) {
  background: #2563eb;
}

.confirm-section {
  margin-top: 20px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
}

.path-info-card {
  width: 100%;
  background: #f0f9ff;
  border: 1px solid #bae6fd;
  border-radius: 8px;
}

.path-info-content {
  text-align: left;
}

.info-item {
  margin: 8px 0;
}

.info-label {
  font-size: 0.8125rem;
  color: #0369a1;
  font-weight: 500;
}

.info-value {
  color: #0c4a6e;
  font-weight: 400;
  word-break: break-all;
}

.btn-confirm {
  background: #10b981;
  color: #ffffff;
  border: none;
  padding: 14px 32px;
  font-size: 1rem;
  font-weight: 600;
}

.btn-confirm:hover:not(:disabled) {
  background: #059669;
}

.btn-confirm:disabled {
  background: #9ca3af;
}

.loading-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(255, 255, 255, 0.9);
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.loading-overlay p {
  font-size: 0.875rem;
  color: #6b7280;
  margin-top: 16px;
}

.existing-library-tip {
  margin-top: 20px;
  text-align: center;
  font-size: 0.875rem;
}

.tip-text {
  color: #9ca3af;
}

.tip-link {
  color: #1f2937;
  font-weight: 500;
  cursor: pointer;
  text-decoration: underline;
  transition: color 0.2s;
}

.tip-link:hover {
  color: #3B82F6;
}

.recent-libraries-section {
  width: 100%;
  border-top: 1px solid #e5e7eb;
  padding-top: 16px;
}

.recent-libraries-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 200px;
  overflow-y: auto;
}

.recent-library-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px;
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
}

.recent-library-item:hover {
  background: #f3f4f6;
  border-color: #d1d5db;
}

.lib-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
  overflow: hidden;
}

.lib-name {
  font-size: 0.875rem;
  font-weight: 500;
  color: #374151;
}

.lib-path {
  font-size: 0.75rem;
  color: #9ca3af;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.w-full {
  width: 100%;
}
</style>
