import { IpcMainInvokeEvent } from 'electron';
import * as channels from '../../channels';
import { WindowManager } from '../../../windows/WindowManager';
import { ok } from '../../../../shared/types/ipc.types';

/**
 * 窗口控制 IPC Handler 映射
 * 注意：所有 handler 内部通过 WindowManager 获取窗口引用，
 * 不直接持有 BrowserWindow 实例，避免循环依赖。
 */
export const windowHandlers: Record<string, (event: IpcMainInvokeEvent, ...args: unknown[]) => Promise<unknown>> = {

  [channels.WIN_MINIMIZE]: async () => {
    WindowManager.getMainWindow()?.minimize();
    return ok();
  },

  [channels.WIN_TOGGLE_MAXIMIZE]: async () => {
    const win = WindowManager.getMainWindow();
    if (!win) return ok();
    win.isMaximized() ? win.unmaximize() : win.maximize();
    return ok();
  },

  [channels.WIN_CLOSE]: async () => {
    WindowManager.getMainWindow()?.close();
    return ok();
  },

  [channels.WIN_IS_MAXIMIZED]: async () => {
    return ok(WindowManager.getMainWindow()?.isMaximized() ?? false);
  },

  [channels.WIN_TOGGLE_FULLSCREEN]: async () => {
    const win = WindowManager.getMainWindow();
    if (!win) return ok();
    win.setFullScreen(!win.isFullScreen());
    return ok({ isFullscreen: win.isFullScreen() });
  },

  [channels.WIN_IS_FULLSCREEN]: async () => {
    return ok(WindowManager.getMainWindow()?.isFullScreen() ?? false);
  },

  [channels.WEB_FIND_IN_PAGE]: async (_event, payload: { text: string; options?: { forward?: boolean; findNext?: boolean; matchCase?: boolean } }) => {
    const win = WindowManager.getMainWindow();
    if (!win) return ok({ requestId: 0 });
    const text = String(payload?.text || '').trim();
    if (!text) return ok({ requestId: 0 });
    const opts = payload?.options || {};
    const requestId = win.webContents.findInPage(text, {
      forward: opts.forward !== false,
      findNext: !!opts.findNext,
      matchCase: !!opts.matchCase,
    } as any);
    return ok({ requestId });
  },

  [channels.WEB_STOP_FIND_IN_PAGE]: async (_event, payload: { action?: 'clearSelection' | 'keepSelection' | 'activateSelection' }) => {
    const win = WindowManager.getMainWindow();
    if (!win) return ok();
    const action = payload?.action || 'clearSelection';
    win.webContents.stopFindInPage(action as any);
    return ok();
  },
};
