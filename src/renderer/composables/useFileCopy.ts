/**
 * 文件拷贝 Composable
 * 提供智能文件拷贝功能，支持大文件断点续传、进度跟踪和取消操作
 */

import { ref, computed, onUnmounted } from 'vue';
import { createRendererLogger } from '@/utils/logger';

const logger = createRendererLogger('UseFileCopy');

export interface FileCopyItem {
  src: string;
  name: string;
  relativePath?: string;
}

export interface CopyProgress {
  current: number;
  total: number;
  percent: string;
  currentFile?: string;
  bytesCopied?: number;
  totalBytes?: number;
  speed?: string;
}

export interface CopyResult {
  taskId: string;
  strategy: string;
  success: FileCopyItem[];
  failed: Array<{ file: FileCopyItem; error: string }>;
  total: number;
  completed: number;
}

export type CopyStatus = 'idle' | 'copying' | 'paused' | 'completed' | 'failed' | 'cancelled';

/**
 * 文件拷贝组合式函数
 * @example
 * const { copy, cancel, status, progress, isCopying } = useFileCopy();
 * await copy(files, '/dest/path');
 */
export function useFileCopy() {
  // 状态
  const status = ref<CopyStatus>('idle');
  const progress = ref<CopyProgress>({
    current: 0,
    total: 0,
    percent: '0.00'
  });
  const currentTaskId = ref<string | null>(null);
  const error = ref<string | null>(null);
  const lastResult = ref<CopyResult | null>(null);

  // 计算属性
  const isCopying = computed(() => status.value === 'copying');
  const isPaused = computed(() => status.value === 'paused');
  const isCompleted = computed(() => status.value === 'completed');
  const isFailed = computed(() => status.value === 'failed');
  const isCancelled = computed(() => status.value === 'cancelled');
  const hasError = computed(() => error.value !== null);
  const percentNumber = computed(() => parseFloat(progress.value.percent));

  // 监听清理函数
  let unlistenProgress: (() => void) | null = null;
  let unlistenCompleted: (() => void) | null = null;
  let unlistenCancelled: (() => void) | null = null;

  /**
   * 注册事件监听
   */
  function setupListeners() {
    // 清理旧的监听
    cleanupListeners();

    // 监听进度
    unlistenProgress = window.electronAPI.fileCopy.onProgress((data) => {
      progress.value = {
        current: data.current,
        total: data.total,
        percent: data.percent,
        currentFile: data.currentFile,
        bytesCopied: data.bytesCopied,
        totalBytes: data.totalBytes,
        speed: data.speed
      };
    });

    // 监听完成
    unlistenCompleted = window.electronAPI.fileCopy.onCompleted((data) => {
      status.value = 'completed';
      lastResult.value = data.result as CopyResult;
      cleanupListeners();
    });

    // 监听取消
    unlistenCancelled = window.electronAPI.fileCopy.onCancelled(() => {
      status.value = 'cancelled';
      cleanupListeners();
    });
  }

  /**
   * 清理事件监听
   */
  function cleanupListeners() {
    unlistenProgress?.();
    unlistenCompleted?.();
    unlistenCancelled?.();
    unlistenProgress = null;
    unlistenCompleted = null;
    unlistenCancelled = null;
  }

  /**
   * 开始文件拷贝
   * @param files 要拷贝的文件列表
   * @param destDir 目标目录
   * @param options 可选配置
   */
  async function copy(
    files: FileCopyItem[],
    destDir: string,
    options?: {
      taskId?: string;
      chunkSize?: number;
      concurrency?: number;
      largeFileThreshold?: number;
    }
  ): Promise<CopyResult> {
    if (files.length === 0) {
      throw new Error('文件列表不能为空');
    }

    // 重置状态
    status.value = 'copying';
    error.value = null;
    lastResult.value = null;
    progress.value = {
      current: 0,
      total: files.length,
      percent: '0.00'
    };

    // 设置监听
    setupListeners();

    try {
      const plainFiles = files.map(f => ({
        src: String(f.src),
        name: String(f.name),
        relativePath: f.relativePath ? String(f.relativePath) : undefined,
      }));
      const plainOptions = options ? {
        taskId: options.taskId ? String(options.taskId) : undefined,
        chunkSize: options.chunkSize,
        concurrency: options.concurrency,
        largeFileThreshold: options.largeFileThreshold,
      } : undefined;
      const resp = await window.electronAPI.fileCopy.start(plainFiles, String(destDir), plainOptions) as any;
      const normalized = (resp && typeof resp === 'object' && 'success' in resp && 'data' in resp)
        ? resp
        : { success: true, data: resp };
      if (!normalized.success) {
        throw new Error(normalized.error || '拷贝失败');
      }
      const result = normalized.data as CopyResult & { taskId: string };
      currentTaskId.value = result.taskId;
      
      const failed = Array.isArray((result as any).failed) ? (result as any).failed : [];
      const success = Array.isArray((result as any).success) ? (result as any).success : [];
      if (failed.length > 0) {
        status.value = success.length > 0 ? 'completed' : 'failed';
        error.value = `有 ${failed.length} 个文件拷贝失败`;
      } else {
        status.value = 'completed';
      }
      
      lastResult.value = { ...(result as any), success, failed };
      return lastResult.value as CopyResult;
    } catch (err: any) {
      status.value = 'failed';
      error.value = err.message || '拷贝失败';
      throw err;
    } finally {
      cleanupListeners();
    }
  }

  /**
   * 取消当前拷贝任务
   */
  async function cancel(): Promise<boolean> {
    if (!currentTaskId.value || status.value !== 'copying') {
      return false;
    }

    try {
      const resp = await window.electronAPI.fileCopy.cancel(currentTaskId.value) as any;
      const normalized = (resp && typeof resp === 'object' && 'success' in resp && 'data' in resp)
        ? resp
        : { success: true, data: resp };
      const cancelled = Boolean(normalized.data?.success ?? normalized.success);
      if (cancelled) {
        status.value = 'cancelled';
        cleanupListeners();
      }
      return cancelled;
    } catch (err: any) {
      logger.error('取消拷贝失败:', err);
      return false;
    }
  }

  /**
   * 重置状态
   */
  function reset() {
    status.value = 'idle';
    progress.value = {
      current: 0,
      total: 0,
      percent: '0.00'
    };
    currentTaskId.value = null;
    error.value = null;
    lastResult.value = null;
    cleanupListeners();
  }

  /**
   * 获取进行中的任务列表
   */
  async function getActiveTasks(): Promise<string[]> {
    return await window.electronAPI.fileCopy.getActiveTasks();
  }

  // 组件卸载时清理
  onUnmounted(() => {
    // 如果正在拷贝，尝试取消
    if (status.value === 'copying' && currentTaskId.value) {
      cancel().catch(err => logger.error('Failed to cancel copy on unmount', err));
    }
    cleanupListeners();
  });

  return {
    // 状态
    status,
    progress,
    error,
    currentTaskId,
    lastResult,
    
    // 计算属性
    isCopying,
    isPaused,
    isCompleted,
    isFailed,
    isCancelled,
    hasError,
    percentNumber,
    
    // 方法
    copy,
    cancel,
    reset,
    getActiveTasks
  };
}

export default useFileCopy;
