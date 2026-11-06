import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { TaskInfo, TaskType, RegisterTaskInput, ActiveTasksResponse } from '../../../shared/types/taskMonitor.types';

let taskIdCounter = 0;
function generateTaskId(): string {
  return `task_${Date.now()}_${++taskIdCounter}`;
}

export const useTaskMonitorStore = defineStore('taskMonitor', () => {
  const tasks = ref<Map<string, TaskInfo>>(new Map());
  const listeners = ref<Map<string, () => void>>(new Map());

  const syncToMain = (action: () => Promise<unknown>) => {
    action().catch(() => undefined);
  };

  const activeTasks = computed<TaskInfo[]>(() => {
    return Array.from(tasks.value.values()).filter(
      t => t.status === 'pending' || t.status === 'running'
    );
  });

  const hasActiveTasks = computed<boolean>(() => activeTasks.value.length > 0);

  const getActiveTasksResponse = computed<ActiveTasksResponse>(() => ({
    tasks: activeTasks.value,
    hasActiveTasks: hasActiveTasks.value,
  }));

  function register(input: RegisterTaskInput | Omit<RegisterTaskInput, 'id'>): string {
    const id = input.id || generateTaskId();
    const now = Date.now();
    const normalizedInput: RegisterTaskInput = {
      ...input,
      id,
    };

    const taskInfo: TaskInfo = {
      id,
      name: normalizedInput.name,
      type: normalizedInput.type,
      status: 'pending',
      progress: 0,
      total: normalizedInput.total,
      current: 0,
      message: '等待开始...',
      startedAt: now,
      updatedAt: now,
    };

    tasks.value.set(id, taskInfo);

    if (normalizedInput.onProgress) {
      const wrappedCallback = (progress: Partial<TaskInfo>) => {
        updateProgress(id, progress);
        normalizedInput.onProgress?.(progress);
      };
      listeners.value.set(`${id}_progress`, wrappedCallback as () => void);
    }

    taskInfo.status = 'running';
    taskInfo.updatedAt = Date.now();
    tasks.value.set(id, { ...taskInfo });
    syncToMain(() => window.electronAPI.taskMonitor.registerTask(normalizedInput));

    return id;
  }

  function updateProgress(taskId: string, progress: Partial<TaskInfo>): void {
    const task = tasks.value.get(taskId);
    if (!task) return;

    const updated: TaskInfo = {
      ...task,
      ...progress,
      updatedAt: Date.now(),
    };

    if (progress.progress !== undefined) {
      updated.progress = progress.progress;
    }

    tasks.value.set(taskId, updated);
    syncToMain(() => window.electronAPI.taskMonitor.updateTask(taskId, progress));
  }

  function complete(taskId: string, result?: unknown): void {
    const task = tasks.value.get(taskId);
    if (!task) return;

    const updated: TaskInfo = {
      ...task,
      status: 'completed',
      progress: 100,
      message: '已完成',
      updatedAt: Date.now(),
    };

    tasks.value.set(taskId, updated);
    syncToMain(() => window.electronAPI.taskMonitor.completeTask(taskId, result));
    cleanupTask(taskId);
  }

  function fail(taskId: string, error?: unknown): void {
    const task = tasks.value.get(taskId);
    if (!task) return;

    const updated: TaskInfo = {
      ...task,
      status: 'failed',
      message: error instanceof Error ? error.message : String(error || '任务失败'),
      updatedAt: Date.now(),
    };

    tasks.value.set(taskId, updated);
    syncToMain(() => window.electronAPI.taskMonitor.failTask(taskId, error));
    cleanupTask(taskId);
  }

  function cancel(taskId: string): void {
    const task = tasks.value.get(taskId);
    if (!task) return;

    const updated: TaskInfo = {
      ...task,
      status: 'cancelled',
      message: '已取消',
      updatedAt: Date.now(),
    };

    tasks.value.set(taskId, updated);
    syncToMain(() => window.electronAPI.taskMonitor.cancelTask(taskId));
    cleanupTask(taskId);
  }

  function cleanupTask(taskId: string): void {
    setTimeout(() => {
      tasks.value.delete(taskId);
      listeners.value.delete(`${taskId}_progress`);
    }, 5000);
  }

  function unregister(taskId: string): void {
    tasks.value.delete(taskId);
    listeners.value.delete(`${taskId}_progress`);
    syncToMain(() => window.electronAPI.taskMonitor.unregisterTask(taskId));
  }

  function getTask(taskId: string): TaskInfo | undefined {
    return tasks.value.get(taskId);
  }

  function getAllTasks(): TaskInfo[] {
    return Array.from(tasks.value.values());
  }

  function clear(): void {
    tasks.value.clear();
    listeners.value.clear();
  }

  return {
    tasks,
    activeTasks,
    hasActiveTasks,
    getActiveTasksResponse,
    register,
    updateProgress,
    complete,
    fail,
    cancel,
    unregister,
    getTask,
    getAllTasks,
    clear,
  };
});
