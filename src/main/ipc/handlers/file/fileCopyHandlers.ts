/**
 * 文件拷贝 IPC 处理器
 * 智能混合策略：根据文件大小自动选择最佳拷贝策略
 */

import { IpcMainInvokeEvent, BrowserWindow, Notification } from 'electron';
import * as channels from '../../channels';
import { ok, IpcResponse } from '../../../../shared/types/ipc.types';
import { createLogger } from '../../../utils/logger';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { CopyAuditLogService } from '../../../services/file/CopyAuditLogService';
import {
  getFileCopyService,
  FileCopyItem,
  FileCopyOptions,
  FileCopyConflictDecision,
  ResolveConflictFn,
  FileCopyConflictContext,
} from '../../../services/file/FileCopyService';
import { getTaskMonitor } from '../system/taskMonitorHandlers';

const logger = createLogger('FileCopyHandlers');

// 存储进行中的任务
const activeTasks = new Map<string, number>(); // taskId -> window id
const taskMeta = new Map<string, { startedAt: number; destDir: string; total: number }>();
const pendingConflicts = new Map<
  string,
  { taskId: string; windowId: number; resolve: (d: FileCopyConflictDecision) => void; reject: (e: Error) => void }
>(); // requestId -> pending

/** 拷贝结果类型 */
interface CopyTaskResult {
  taskId: string;
  strategy: string;
  success: FileCopyItem[];
  failed: Array<{ file: FileCopyItem; error: string }>;
  total: number;
  completed: number;
  fileResults?: unknown[];
  retry?: unknown;
}

/**
 * 向渲染进程发送进度事件
 */
function sendProgress(windowId: number, taskId: string, progress: any): void {
  const win = BrowserWindow.fromId(windowId);
  if (win && !win.isDestroyed()) {
    win.webContents.send(channels.FILE_COPY_PROGRESS, { taskId, ...progress });
  }
  getTaskMonitor().update(taskId, {
    progress: Number(progress?.percent || 0),
    current: Number(progress?.current || 0),
    total: Number(progress?.total || 0),
    message: progress?.currentFile ? `copying:${String(progress.currentFile)}` : 'copying',
  });
}

function sendToTaskWindow(taskId: string, channel: string, payload: any): void {
  const windowId = activeTasks.get(taskId);
  if (!windowId) return;
  const win = BrowserWindow.fromId(windowId);
  if (!win || win.isDestroyed()) return;
  win.webContents.send(channel, payload);
}

function flushMainToRenderer(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}

/**
 * 向所有窗口发送事件
 */
function broadcastToAll(channel: string, data: any): void {
  BrowserWindow.getAllWindows().forEach((win) => {
    if (!win.isDestroyed()) {
      win.webContents.send(channel, data);
    }
  });
}

/**
 * 初始化文件拷贝服务的事件监听
 */
function initFileCopyServiceEvents(): void {
  const fileCopyService = getFileCopyService();

  fileCopyService.on('file-completed', (payload: any) => {
    const taskId = String(payload?.taskId || '');
    if (!taskId) return;
    sendToTaskWindow(taskId, channels.FILE_COPY_FILE_COMPLETED, payload);
  });

  fileCopyService.on('file-failed', (payload: any) => {
    const taskId = String(payload?.taskId || '');
    if (!taskId) return;
    sendToTaskWindow(taskId, channels.FILE_COPY_FILE_FAILED, payload);
  });

  // 监听完成事件
  fileCopyService.on('completed', ({ taskId, result }) => {
    sendToTaskWindow(taskId, channels.FILE_COPY_COMPLETED, { taskId, result });
    getTaskMonitor().complete(taskId, result);
    activeTasks.delete(taskId);
    const endedAt = Date.now();
    const meta = taskMeta.get(taskId);
    taskMeta.delete(taskId);

    const fileResults = Array.isArray((result as any)?.fileResults) ? ((result as any).fileResults as any[]) : [];
    const failedCount = Array.isArray((result as any)?.failed)
      ? ((result as any).failed as any[]).length
      : fileResults.filter((r) => String(r?.outcome || '') === 'failed').length;
    const total = typeof meta?.total === 'number' && meta.total > 0
      ? meta.total
      : Number((result as any)?.total || fileResults.length || 0);
    const succeeded = Math.max(0, total - failedCount);

    void CopyAuditLogService.getInstance()
      .append({
        type: 'file-copy',
        taskId,
        startedAt: meta?.startedAt || endedAt,
        endedAt,
        durationMs: Math.max(0, endedAt - (meta?.startedAt || endedAt)),
        destDir: meta?.destDir || '',
        total,
        succeeded,
        failed: failedCount,
        result,
      })
      .catch((e) => logger.error('写入拷贝审计日志失败:', e));

    try {
      new Notification({
        title: '文件拷贝完成',
        body: `成功 ${succeeded}，失败 ${failedCount}`,
      }).show();
    } catch (e) {
      logger.debug('系统通知发送失败:', e);
    }
    logger.info(`文件拷贝任务完成: ${taskId}`);
  });

  // 监听取消事件
  fileCopyService.on('cancelled', ({ taskId }) => {
    broadcastToAll(channels.FILE_COPY_CANCELLED, { taskId });
    getTaskMonitor().cancel(taskId);
    activeTasks.delete(taskId);
    const endedAt = Date.now();
    const meta = taskMeta.get(taskId);
    taskMeta.delete(taskId);
    void CopyAuditLogService.getInstance()
      .append({
        type: 'file-copy',
        taskId,
        startedAt: meta?.startedAt || endedAt,
        endedAt,
        durationMs: Math.max(0, endedAt - (meta?.startedAt || endedAt)),
        destDir: meta?.destDir || '',
        total: meta?.total || 0,
        succeeded: 0,
        failed: 0,
        cancelled: true,
      })
      .catch((e) => logger.error('写入拷贝审计日志失败:', e));
    pendingConflicts.forEach((pending, requestId) => {
      if (pending.taskId === taskId) {
        pending.reject(new Error('拷贝已取消'));
        pendingConflicts.delete(requestId);
      }
    });
    logger.info(`文件拷贝任务已取消: ${taskId}`);
  });
}

// 初始化事件监听（只执行一次）
let eventsInitialized = false;

const MAX_EXPANDED_FILES = 20000;

const normalizeRelativePath = (p: string) =>
  String(p || '')
    .replace(/\\/g, '/')
    .replace(/^\/+/g, '')
    .replace(/\/+/g, '/');

const expandSourcePaths = (srcPaths: string[]) => {
  const items: FileCopyItem[] = [];
  const pushFile = (src: string, relativePath: string) => {
    items.push({
      src,
      name: path.basename(src),
      relativePath: normalizeRelativePath(relativePath),
    });
  };

  for (const raw of srcPaths) {
    const root = String(raw || '').trim();
    if (!root) continue;
    if (!fs.existsSync(root)) continue;
    try {
      const stat = fs.statSync(root);
      if (stat.isDirectory()) {
        const rootName = path.basename(root.replace(/[\\/]+$/g, '')) || 'folder';
        const stack: string[] = [root];
        while (stack.length) {
          const dir = stack.pop() as string;
          let dirents: fs.Dirent[] = [];
          try {
            dirents = fs.readdirSync(dir, { withFileTypes: true });
          } catch {
            dirents = [];
          }
          for (const d of dirents) {
            const full = path.join(dir, d.name);
            if (d.isDirectory()) {
              stack.push(full);
              continue;
            }
            if (d.isFile()) {
              const rel = path.relative(root, full);
              pushFile(full, path.join(rootName, rel));
              if (items.length >= MAX_EXPANDED_FILES) {
                return { items, truncated: true };
              }
            }
          }
        }
        continue;
      }

      if (stat.isFile()) {
        pushFile(root, path.basename(root));
        if (items.length >= MAX_EXPANDED_FILES) {
          return { items, truncated: true };
        }
      }
    } catch {
      continue;
    }
  }

  return { items, truncated: false };
};

export const fileCopyHandlers: Record<string, (event: IpcMainInvokeEvent, ...args: unknown[]) => Promise<unknown>> = {
  [channels.FILE_COPY_EXPAND_SOURCES]: async (
    _event,
    sources: unknown
  ): Promise<IpcResponse<{ items: FileCopyItem[]; truncated: boolean }>> => {
    const srcPaths = Array.isArray(sources) ? sources.map((s) => String(s || '')) : [];
    const { items, truncated } = expandSourcePaths(srcPaths);
    return ok({ items, truncated });
  },

  [channels.FILE_COPY_CONFLICT_DECIDE]: async (
    event,
    payload: unknown
  ): Promise<IpcResponse<{ success: boolean }>> => {
    const data = (payload || {}) as { requestId?: string; decision?: FileCopyConflictDecision };
    const requestId = String(data.requestId || '').trim();
    if (!requestId) return ok({ success: false });

    const pending = pendingConflicts.get(requestId);
    if (!pending) return ok({ success: false });

    const senderWindowId = BrowserWindow.fromWebContents(event.sender)?.id;
    if (typeof senderWindowId === 'number' && senderWindowId !== pending.windowId) {
      return ok({ success: false });
    }

    const decision = data.decision as FileCopyConflictDecision;
    pending.resolve(decision);
    pendingConflicts.delete(requestId);
    return ok({ success: true });
  },

  /** 开始智能文件拷贝 */
  [channels.FILE_COPY_START]: async (
    event,
    files: unknown,
    destDir: unknown,
    options?: unknown
  ): Promise<IpcResponse<CopyTaskResult>> => {
    const fileList = files as FileCopyItem[];
    const targetDir = String(destDir);
    const opts = (options || {}) as FileCopyOptions & { taskId?: string };
    
    const taskId = opts.taskId || `copy-${Date.now()}`;
    const windowId = BrowserWindow.fromWebContents(event.sender)?.id;
    
    if (windowId) {
      activeTasks.set(taskId, windowId);
    }
    taskMeta.set(taskId, { startedAt: Date.now(), destDir: targetDir, total: fileList.length });
    getTaskMonitor().register({
      id: taskId,
      name: `文件拷贝（${fileList.length}个）`,
      type: 'copy',
      total: fileList.length,
    }, windowId);

    // 初始化事件监听
    if (!eventsInitialized) {
      initFileCopyServiceEvents();
      eventsInitialized = true;
    }

    logger.info(`开始文件拷贝任务: ${taskId}, 文件数: ${fileList.length}`);

    try {
      if (windowId) {
        const win = BrowserWindow.fromId(windowId);
        if (win && !win.isDestroyed()) {
          win.webContents.send(channels.FILE_COPY_STARTED, { taskId, total: fileList.length, destDir: targetDir });
        }
      }
      const fileCopyService = getFileCopyService();
      const resolveConflict: ResolveConflictFn | undefined = windowId
        ? async (ctx: FileCopyConflictContext) => {
            const requestId = crypto.randomUUID();
            const win = BrowserWindow.fromId(windowId);
            if (!win || win.isDestroyed()) {
              return ctx.defaultDecision;
            }

            const safePayload = {
              requestId,
              taskId: ctx.taskId,
              reason: ctx.reason,
              file: ctx.file,
              srcPath: ctx.srcPath,
              destPath: ctx.destPath,
              srcSize: ctx.srcSize,
              destSize: ctx.destSize,
              srcHashes: ctx.srcHashes,
              destHashes: ctx.destHashes,
              defaultDecision: ctx.defaultDecision,
            };

            win.webContents.send(channels.FILE_COPY_CONFLICT, safePayload);

            return await new Promise<FileCopyConflictDecision>((resolve, reject) => {
              pendingConflicts.set(requestId, { taskId, windowId, resolve, reject });
            });
          }
        : undefined;

      const result = await fileCopyService.copy(fileList, targetDir, {
        ...opts,
        taskId,
        resolveConflict,
        onProgress: (progress) => {
          if (windowId) {
            sendProgress(windowId, taskId, progress);
          }
        }
      });

      await flushMainToRenderer();
      return ok<CopyTaskResult>({
        taskId,
        ...result
      });
    } catch (error: any) {
      activeTasks.delete(taskId);
      getTaskMonitor().fail(taskId, error?.message || '文件拷贝失败');
      logger.error(`文件拷贝任务失败: ${taskId}, 错误: ${error.message}`);
      throw error;
    }
  },

  /** 取消拷贝任务 */
  [channels.FILE_COPY_CANCEL]: async (
    event,
    taskId: unknown
  ): Promise<IpcResponse<{ success: boolean }>> => {
    const id = String(taskId);
    const fileCopyService = getFileCopyService();
    const cancelled = fileCopyService.cancel(id);
    
    if (cancelled) {
      activeTasks.delete(id);
      pendingConflicts.forEach((pending, requestId) => {
        if (pending.taskId === id) {
          pending.reject(new Error('拷贝已取消'));
          pendingConflicts.delete(requestId);
        }
      });
      logger.info(`已取消文件拷贝任务: ${id}`);
    }
    
    return ok({ success: cancelled });
  },

  /** 获取进行中的任务列表 */
  [channels.FILE_COPY_ACTIVE_TASKS]: async (): Promise<IpcResponse<string[]>> => {
    return ok(Array.from(activeTasks.keys()));
  },
};
