import { IpcMainInvokeEvent, BrowserWindow } from 'electron';
import * as channels from '../../channels';
import { ok, IpcResponse } from '../../../../shared/types/ipc.types';
import type { TaskInfo, TaskType, RegisterTaskInput, TaskStatus } from '../../../../shared/types/taskMonitor.types';

interface TaskCallbacks {
  onProgress?: (progress: Partial<TaskInfo>) => void;
  onComplete?: (result?: unknown) => void;
  onFail?: (error?: unknown) => void;
}

class TaskMonitor {
  private static instance: TaskMonitor;
  private tasks = new Map<string, TaskInfo>();
  private callbacks = new Map<string, TaskCallbacks>();
  private windowIds = new Map<string, number>();

  private constructor() {}

  static getInstance(): TaskMonitor {
    if (!TaskMonitor.instance) {
      TaskMonitor.instance = new TaskMonitor();
    }
    return TaskMonitor.instance;
  }

  register(input: RegisterTaskInput, windowId?: number): void {
    const now = Date.now();
    const taskInfo: TaskInfo = {
      id: input.id,
      name: input.name,
      type: input.type,
      status: 'running',
      progress: 0,
      total: input.total,
      current: 0,
      startedAt: now,
      updatedAt: now,
    };
    this.tasks.set(input.id, taskInfo);
    this.callbacks.set(input.id, {
      onProgress: input.onProgress,
      onComplete: input.onComplete,
      onFail: input.onFail,
    });
    if (typeof windowId === 'number') {
      this.windowIds.set(input.id, windowId);
    }
    this.notifyActiveChanged();
  }

  update(taskId: string, progress: Partial<TaskInfo>): void {
    const task = this.tasks.get(taskId);
    if (!task) return;

    const updated: TaskInfo = {
      ...task,
      ...progress,
      updatedAt: Date.now(),
    };
    this.tasks.set(taskId, updated);

    const callbacks = this.callbacks.get(taskId);
    if (callbacks?.onProgress) {
      callbacks.onProgress(progress);
    }
    this.notifyActiveChanged();
  }

  complete(taskId: string, result?: unknown): void {
    const task = this.tasks.get(taskId);
    if (!task) return;

    const completed: TaskInfo = {
      ...task,
      status: 'completed',
      progress: 100,
      updatedAt: Date.now(),
    };
    this.tasks.set(taskId, completed);

    const callbacks = this.callbacks.get(taskId);
    if (callbacks?.onComplete) {
      callbacks.onComplete(result);
    }

    this.sendToWindow(taskId, channels.TASK_MONITOR_ACTIVE_CHANGED, { taskId, status: 'completed' });
    this.cleanup(taskId);
    this.notifyActiveChanged();
  }

  fail(taskId: string, error?: unknown): void {
    const task = this.tasks.get(taskId);
    if (!task) return;

    const failed: TaskInfo = {
      ...task,
      status: 'failed',
      message: error instanceof Error ? error.message : String(error),
      updatedAt: Date.now(),
    };
    this.tasks.set(taskId, failed);

    const callbacks = this.callbacks.get(taskId);
    if (callbacks?.onFail) {
      callbacks.onFail(error);
    }

    this.sendToWindow(taskId, channels.TASK_MONITOR_ACTIVE_CHANGED, { taskId, status: 'failed', error: failed.message });
    this.cleanup(taskId);
    this.notifyActiveChanged();
  }

  cancel(taskId: string): void {
    const task = this.tasks.get(taskId);
    if (!task) return;

    const cancelled: TaskInfo = {
      ...task,
      status: 'cancelled',
      updatedAt: Date.now(),
    };
    this.tasks.set(taskId, cancelled);

    this.sendToWindow(taskId, channels.TASK_MONITOR_ACTIVE_CHANGED, { taskId, status: 'cancelled' });
    this.cleanup(taskId);
    this.notifyActiveChanged();
  }

  unregister(taskId: string): void {
    this.cleanup(taskId);
    this.notifyActiveChanged();
  }

  getActive(): TaskInfo[] {
    return Array.from(this.tasks.values()).filter(
      (t) => t.status === 'running' || t.status === 'pending'
    );
  }

  getAll(): TaskInfo[] {
    return Array.from(this.tasks.values());
  }

  get(taskId: string): TaskInfo | undefined {
    return this.tasks.get(taskId);
  }

  private cleanup(taskId: string): void {
    this.tasks.delete(taskId);
    this.callbacks.delete(taskId);
    this.windowIds.delete(taskId);
  }

  private sendToWindow(taskId: string, channel: string, payload: unknown): void {
    const windowId = this.windowIds.get(taskId);
    if (!windowId) return;
    const win = BrowserWindow.fromId(windowId);
    if (!win || win.isDestroyed()) return;
    win.webContents.send(channel, payload);
  }

  private notifyActiveChanged(): void {
    const active = this.getActive();
    BrowserWindow.getAllWindows().forEach((win) => {
      if (!win.isDestroyed()) {
        win.webContents.send(channels.TASK_MONITOR_ACTIVE_CHANGED, { activeTasks: active });
      }
    });
  }
}

let taskMonitorInstance: TaskMonitor | null = null;

export function getTaskMonitor(): TaskMonitor {
  if (!taskMonitorInstance) {
    taskMonitorInstance = TaskMonitor.getInstance();
  }
  return taskMonitorInstance;
}

export const taskMonitorHandlers: Record<string, (event: IpcMainInvokeEvent, ...args: unknown[]) => Promise<unknown>> = {
  [channels.TASK_MONITOR_GET_ACTIVE]: async (): Promise<IpcResponse<TaskInfo[]>> => {
    return ok(getTaskMonitor().getActive());
  },

  [channels.TASK_MONITOR_REGISTER]: async (
    event,
    payload: unknown
  ): Promise<IpcResponse<{ taskId: string }>> => {
    const data = (payload || {}) as RegisterTaskInput;
    if (!data.id || !data.name || !data.type) {
      return ok({ taskId: '' });
    }
    const windowId = BrowserWindow.fromWebContents(event.sender)?.id;
    getTaskMonitor().register(data, windowId);
    return ok({ taskId: data.id });
  },

  [channels.TASK_MONITOR_UPDATE]: async (
    _event,
    payload: unknown
  ): Promise<IpcResponse<{ success: boolean }>> => {
    const data = (payload || {}) as { taskId?: string } & Partial<TaskInfo>;
    if (!data.taskId) return ok({ success: false });
    getTaskMonitor().update(data.taskId, data);
    return ok({ success: true });
  },

  [channels.TASK_MONITOR_COMPLETE]: async (
    _event,
    payload: unknown
  ): Promise<IpcResponse<{ success: boolean }>> => {
    const data = (payload || {}) as { taskId?: string; result?: unknown };
    if (!data.taskId) return ok({ success: false });
    getTaskMonitor().complete(data.taskId, data.result);
    return ok({ success: true });
  },

  [channels.TASK_MONITOR_FAIL]: async (
    _event,
    payload: unknown
  ): Promise<IpcResponse<{ success: boolean }>> => {
    const data = (payload || {}) as { taskId?: string; error?: unknown };
    if (!data.taskId) return ok({ success: false });
    getTaskMonitor().fail(data.taskId, data.error);
    return ok({ success: true });
  },

  [channels.TASK_MONITOR_CANCEL]: async (
    _event,
    payload: unknown
  ): Promise<IpcResponse<{ success: boolean }>> => {
    const data = (payload || {}) as { taskId?: string };
    if (!data.taskId) return ok({ success: false });
    getTaskMonitor().cancel(data.taskId);
    return ok({ success: true });
  },

  [channels.TASK_MONITOR_UNREGISTER]: async (
    _event,
    payload: unknown
  ): Promise<IpcResponse<{ success: boolean }>> => {
    const data = (payload || {}) as { taskId?: string };
    if (!data.taskId) return ok({ success: false });
    getTaskMonitor().unregister(data.taskId);
    return ok({ success: true });
  },
};
