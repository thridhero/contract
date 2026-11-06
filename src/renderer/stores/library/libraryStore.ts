/**
 * Library Store
 * 资源库状态管理
 */

import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import { createRendererLogger } from '@/utils/logger'
import type { Library, LibraryCreateDTO } from '../../../shared/types/library.types'

const logger = createRendererLogger('LibraryStore')

/**
 * 资源库 Store
 * 管理资源库的创建、切换和列表
 */
export const useLibraryStore = defineStore('library', () => {
  // ─── State ───────────────────────────────────────────────────────
  
  /** 当前激活的资源库 */
  const currentLibrary = ref<Library | null>(null)
  
  /** 所有资源库列表 */
  const libraries = ref<Library[]>([])
  
  /** 加载状态 */
  const loading = ref(false)
  
  // ─── Getters ─────────────────────────────────────────────────────
  
  /** 是否有当前资源库 */
  const hasCurrentLibrary = computed(() => currentLibrary.value !== null)
  
  /** 资源库数量 */
  const libraryCount = computed(() => libraries.value.length)
  
  // ─── Actions ─────────────────────────────────────────────────────
  
  /**
   * 创建资源库
   * @param dto 创建参数
   * @returns 创建的资源库或 null（失败时）
   */
  async function createLibrary(dto: LibraryCreateDTO): Promise<Library | null> {
    loading.value = true
    try {
      const result = await window.electronAPI.library.create(dto)
      if (result.success && result.data) {
        const library = result.data
        libraries.value.unshift(library)
        return library
      } else {
        throw new Error(result.error || '创建资源库失败')
      }
    } catch (error) {
      logger.error('创建资源库失败:', error)
      return null
    } finally {
      loading.value = false
    }
  }
  
  /**
   * 获取所有资源库
   */
  async function fetchLibraries(): Promise<void> {
    try {
      const result = await window.electronAPI.library.getAll()
      if (result.success && result.data) {
        libraries.value = result.data
      }
    } catch (error) {
      logger.error('获取资源库列表失败:', error)
    }
  }
  
  /**
   * 切换到指定资源库
   * @param library 目标资源库
   */
  async function switchLibrary(library: Library): Promise<void> {
    try {
      // 必须先通知后端切换数据库和更新 bootstrap.json
      const loadResult = await window.electronAPI.bootstrap.loadExistingLibrary(library.path)
      if (!loadResult.success) {
        throw new Error(loadResult.error || '加载资源库失败')
      }

      // 保存当前资源库信息到配置
      currentLibrary.value = library
      
      // 存储到 localStorage 以便页面刷新后恢复
      localStorage.setItem('currentLibraryId', library.id)
      localStorage.setItem('currentLibraryPath', library.path)
      localStorage.setItem('currentLibraryName', library.name)
      
      // 重新加载应用以应用新资源库 (改为通过事件总线或依赖注入让 App 重绘，或者简单地触发一次 router 跳转和全应用级别的 key 刷新)
      // 这里我们在 window 上派发一个自定义事件，让 App.vue 去处理组件重建
      window.dispatchEvent(new CustomEvent('library-switched'))

    } catch (error) {
      logger.error('切换资源库失败:', error)
      throw error
    }
  }
  
  /**
   * 删除资源库
   * @param id 资源库ID
   * @returns 是否删除成功
   */
  async function deleteLibrary(id: string): Promise<boolean> {
    try {
      const result = await window.electronAPI.library.delete(id)
      if (result.success) {
        libraries.value = libraries.value.filter(lib => lib.id !== id)
        
        // 如果删除的是当前资源库，清空当前资源库
        if (currentLibrary.value?.id === id) {
          currentLibrary.value = null
          localStorage.removeItem('currentLibraryId')
          localStorage.removeItem('currentLibraryPath')
          localStorage.removeItem('currentLibraryName')
        }
        
        return true
      } else {
        throw new Error(result.error || '删除资源库失败')
      }
    } catch (error) {
      logger.error('删除资源库失败:', error)
      return false
    }
  }
  
  /**
   * 恢复上次使用的资源库
   */
  function restoreLastLibrary(): void {
    const libraryId = localStorage.getItem('currentLibraryId')
    const libraryPath = localStorage.getItem('currentLibraryPath')
    const libraryName = localStorage.getItem('currentLibraryName')
    
    if (libraryId && libraryPath && libraryName) {
      currentLibrary.value = {
        id: libraryId,
        name: libraryName,
        path: libraryPath,
        createdAt: '',
        updatedAt: ''
      }
    }
  }
  
  /**
   * 清除当前资源库（用于退出时）
   */
  function clearCurrentLibrary(): void {
    currentLibrary.value = null
    localStorage.removeItem('currentLibraryId')
    localStorage.removeItem('currentLibraryPath')
    localStorage.removeItem('currentLibraryName')
  }
  
  // 初始化时恢复上次使用的资源库
  restoreLastLibrary()
  
  return {
    // State
    currentLibrary,
    libraries,
    loading,
    
    // Getters
    hasCurrentLibrary,
    libraryCount,
    
    // Actions
    createLibrary,
    fetchLibraries,
    switchLibrary,
    deleteLibrary,
    restoreLastLibrary,
    clearCurrentLibrary
  }
})