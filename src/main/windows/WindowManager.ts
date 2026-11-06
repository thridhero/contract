import { BrowserWindow, screen, nativeImage } from 'electron';
import { IS_DEV, DEV_SERVER_URL, RENDERER_HTML_PATH, PRELOAD_PATH, WINDOW_CONFIG, APP_ICON_PATH } from '../config/app.config';
import { WIN_MAXIMIZE_CHANGED, WIN_FULLSCREEN_CHANGED, SHORTCUT_TRIGGERED, WEB_FOUND_IN_PAGE } from '../ipc/channels';
import { findShortcutByAccelerator } from '../ipc/handlers/system/shortcutHandlers';
import { createLogger } from '../utils/logger';
import { getTaskMonitor } from '../ipc/handlers/system/taskMonitorHandlers';
import { ConfigService } from '../services/system/ConfigService';

const logger = createLogger('WindowManager');
const WINDOW_STATE_CONFIG_KEY = 'windowState';
const WINDOW_STATE_SAVE_DELAY_MS = 300;

let pendingClose = false;

interface PersistedWindowState {
  width: number;
  height: number;
  x?: number;
  y?: number;
  isMaximized: boolean;
}

export function setCloseGuardPending(value: boolean): void {
  pendingClose = value;
}

export function isCloseGuardPending(): boolean {
  return pendingClose;
}

/**
 * 窗口管理器（单例）
 *
 * 职责：窗口创建、加载 URL/文件、窗口生命周期事件监听。
 * 不处理任何 IPC 逻辑（IPC handler 在 windowHandlers.ts 中注册）。
 */
export class WindowManager {
  private static mainWindow: BrowserWindow | null = null;

  /** 获取主窗口实例（可能为 null） */
  static getMainWindow(): BrowserWindow | null {
    return WindowManager.mainWindow;
  }

  /** 创建并展示主窗口 */
  static createMainWindow(): BrowserWindow {
    const restoredState = WindowManager.readWindowState();
    // 加载应用图标：nativeImage.createFromPath 失败时会返回空图像，这里做诊断
    const iconImage = nativeImage.createFromPath(APP_ICON_PATH);
    if (iconImage.isEmpty()) {
      logger.error(`应用图标加载失败，路径无效或无法解析: ${APP_ICON_PATH}`);
    } else {
      logger.info(`应用图标加载成功: ${APP_ICON_PATH} (${iconImage.getSize().width}x${iconImage.getSize().height})`);
    }
    const win = new BrowserWindow({
      width: restoredState.width,
      height: restoredState.height,
      ...(WindowManager.hasStoredPosition(restoredState)
        ? { x: restoredState.x, y: restoredState.y }
        : {}),
      minWidth: WINDOW_CONFIG.minWidth,
      minHeight: WINDOW_CONFIG.minHeight,
      icon: iconImage,
      frame: false,           // 自定义标题栏
      titleBarStyle: 'hidden',
      show: false,            // 等待 ready-to-show 再显示，避免白屏闪烁
      webPreferences: {
        nodeIntegration: false,        // 安全：禁止渲染进程访问 Node
        contextIsolation: true,        // 安全：隔离渲染进程上下文
        sandbox: false,                // sql.js WASM 需要关闭沙盒
        preload: PRELOAD_PATH,
        webviewTag: false,             // 安全：禁用 webview 标签
        allowRunningInsecureContent: false,
        experimentalFeatures: false,
      },
    });

    WindowManager.mainWindow = win;
    WindowManager.setupSecurityHeaders(win);
    WindowManager.setupLifecycleEvents(win);
    WindowManager.setupShortcuts(win);

    if (restoredState.isMaximized) {
      win.maximize();
    }

    WindowManager.loadContent(win);

    return win;
  }

  // ─── 私有辅助 ──────────────────────────────────────────────────

  /**
   * 设置 CSP 安全头
   * 开发模式允许 localhost dev server；生产模式使用更严格的默认策略。
   */
  private static setupSecurityHeaders(win: BrowserWindow): void {
    win.webContents.session.webRequest.onHeadersReceived((details, callback) => {
      const imgSrc =
        "img-src 'self' data: blob: https://minio.hongqikeji.cn https://thirdwx.qlogo.cn https://contract.hongqikeji.cn;";
      const devUrl = DEV_SERVER_URL;
      const devWsUrl = DEV_SERVER_URL.replace(/^http/, 'ws');
      const csp = IS_DEV
        ? [
            `default-src 'self' ${devUrl}`,
            `script-src 'self' ${devUrl}`,
            `style-src 'self' 'unsafe-inline' ${devUrl}`,
            imgSrc,
            `font-src 'self' data: ${devUrl}`,
            `connect-src 'self' ${devUrl} ${devWsUrl} http://localhost:8080 http://127.0.0.1:8080 https://contract.hongqikeji.cn ws://localhost:8080 ws://127.0.0.1:8080 ws://contract.hongqikeji.cn wss://contract.hongqikeji.cn`,
            `worker-src 'self' blob:`,
            `object-src 'none'`,
            `base-uri 'self'`,
          ].join('; ')
        : [
            `default-src 'self'`,
            `script-src 'self'`,
            `style-src 'self' 'unsafe-inline'`,
            imgSrc,
            `font-src 'self' data:`,
            `connect-src 'self' https://contract.hongqikeji.cn ws://contract.hongqikeji.cn wss://contract.hongqikeji.cn`,
            `worker-src 'self' blob:`,
            `object-src 'none'`,
            `base-uri 'self'`,
          ].join('; ');

      callback({
        responseHeaders: {
          ...details.responseHeaders,
          'Content-Security-Policy': [csp],
        },
      });
    });
  }

  /** 绑定窗口生命周期事件 */
  private static setupLifecycleEvents(win: BrowserWindow): void {
    let saveTimer: ReturnType<typeof setTimeout> | null = null;
    const scheduleWindowStateSave = () => {
      if (saveTimer) {
        clearTimeout(saveTimer);
      }
      saveTimer = setTimeout(() => {
        saveTimer = null;
        WindowManager.saveWindowState(win);
      }, WINDOW_STATE_SAVE_DELAY_MS);
    };

    // 渲染完成后再显示，消除白屏
    win.once('ready-to-show', () => {
      win.show();
      logger.info('主窗口已显示');
    });

    // 最大化/还原状态推送到渲染进程
    win.on('maximize', () => {
      WindowManager.saveWindowState(win);
      win.webContents.send(WIN_MAXIMIZE_CHANGED, true);
    });
    win.on('unmaximize', () => {
      scheduleWindowStateSave();
      win.webContents.send(WIN_MAXIMIZE_CHANGED, false);
    });

    // 全屏状态推送到渲染进程
    win.on('enter-full-screen', () => {
      win.webContents.send(WIN_FULLSCREEN_CHANGED, true);
    });
    win.on('leave-full-screen', () => {
      win.webContents.send(WIN_FULLSCREEN_CHANGED, false);
    });

    win.on('resize', () => {
      if (!win.isMaximized() && !win.isFullScreen()) {
        scheduleWindowStateSave();
      }
    });

    win.on('move', () => {
      if (!win.isMaximized() && !win.isFullScreen()) {
        scheduleWindowStateSave();
      }
    });

    win.webContents.on('render-process-gone', (_event, details) => {
      logger.error('渲染进程异常退出', details);
    });

    win.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
      logger.error('窗口内容加载失败', {
        errorCode,
        errorDescription,
        validatedURL,
      });
    });

    win.webContents.on('found-in-page', (_event, result) => {
      win.webContents.send(WEB_FOUND_IN_PAGE, result);
    });

    win.on('closed', () => {
      if (saveTimer) {
        clearTimeout(saveTimer);
      }
      pendingClose = false;
      WindowManager.mainWindow = null;
      logger.info('主窗口已关闭');
    });

    win.on('close', (event) => {
      const activeTasks = getTaskMonitor().getActive();
      if (activeTasks.length === 0) {
        if (saveTimer) {
          clearTimeout(saveTimer);
          saveTimer = null;
        }
        WindowManager.saveWindowState(win);
        pendingClose = false;
        return;
      }

      if (!pendingClose) {
        event.preventDefault();
        pendingClose = true;
        win.webContents.send('close-guard:show-confirm', {
          hasActiveTasks: true,
          tasks: activeTasks,
        });
        logger.info(`窗口关闭被取消，有 ${activeTasks.length} 个任务进行中`);
      }
    });
  }

  private static readWindowState(): PersistedWindowState {
    const fallback: PersistedWindowState = {
      width: WINDOW_CONFIG.width,
      height: WINDOW_CONFIG.height,
      isMaximized: false,
    };
    const raw = ConfigService.getInstance().getConfigItem(WINDOW_STATE_CONFIG_KEY);
    if (!raw || typeof raw !== 'object') {
      return fallback;
    }

    const nextState: PersistedWindowState = {
      width: WindowManager.normalizeWindowSize((raw as Record<string, unknown>).width, WINDOW_CONFIG.width, WINDOW_CONFIG.minWidth),
      height: WindowManager.normalizeWindowSize((raw as Record<string, unknown>).height, WINDOW_CONFIG.height, WINDOW_CONFIG.minHeight),
      isMaximized: Boolean((raw as Record<string, unknown>).isMaximized),
    };

    const x = WindowManager.toFiniteNumber((raw as Record<string, unknown>).x);
    const y = WindowManager.toFiniteNumber((raw as Record<string, unknown>).y);
    if (typeof x === 'number' && typeof y === 'number') {
      nextState.x = Math.round(x);
      nextState.y = Math.round(y);
    }

    if (!WindowManager.hasStoredPosition(nextState)) {
      return nextState;
    }

    return WindowManager.isBoundsVisible(nextState)
      ? nextState
      : { ...nextState, x: undefined, y: undefined };
  }

  private static saveWindowState(win: BrowserWindow): void {
    if (win.isDestroyed()) {
      return;
    }

    const bounds = win.isMaximized() || win.isFullScreen()
      ? win.getNormalBounds()
      : win.getBounds();

    const nextState: PersistedWindowState = {
      x: bounds.x,
      y: bounds.y,
      width: Math.max(Math.round(bounds.width), WINDOW_CONFIG.minWidth),
      height: Math.max(Math.round(bounds.height), WINDOW_CONFIG.minHeight),
      isMaximized: win.isMaximized(),
    };

    ConfigService.getInstance().updateConfigItem(WINDOW_STATE_CONFIG_KEY, nextState);
  }

  private static hasStoredPosition(state: PersistedWindowState): state is PersistedWindowState & { x: number; y: number } {
    return typeof state.x === 'number' && typeof state.y === 'number';
  }

  private static normalizeWindowSize(value: unknown, fallback: number, min: number): number {
    const numericValue = WindowManager.toFiniteNumber(value);
    if (typeof numericValue !== 'number') {
      return fallback;
    }
    return Math.max(Math.round(numericValue), min);
  }

  private static toFiniteNumber(value: unknown): number | undefined {
    const numericValue = Number(value);
    return Number.isFinite(numericValue) ? numericValue : undefined;
  }

  private static isBoundsVisible(bounds: PersistedWindowState & { x: number; y: number }): boolean {
    return screen.getAllDisplays().some(display => {
      const area = display.workArea;
      return (
        bounds.x < area.x + area.width &&
        bounds.x + bounds.width > area.x &&
        bounds.y < area.y + area.height &&
        bounds.y + bounds.height > area.y
      );
    });
  }

  /**
   * 设置快捷键监听
   * 通过 before-input-event 监听应用内快捷键
   */
  private static setupShortcuts(win: BrowserWindow): void {
    win.webContents.on('before-input-event', (event, input) => {
      // F12 切换 DevTools
      if (input.key === 'F12') {
        event.preventDefault();
        win.webContents.isDevToolsOpened()
          ? win.webContents.closeDevTools()
          : win.webContents.openDevTools();
        return;
      }

      // 构建 accelerator 字符串
      const accelerator = WindowManager.buildAccelerator(input);

      // 查找匹配的快捷键配置
      const shortcut = findShortcutByAccelerator(accelerator);

      if (shortcut) {
        event.preventDefault();
        logger.info(`快捷键触发: ${shortcut.id} (${accelerator})`);

        // 通知渲染进程
        win.webContents.send(SHORTCUT_TRIGGERED, {
          id: shortcut.id,
          accelerator: shortcut.accelerator,
        });
      }
    });
  }

  /**
   * 构建 accelerator 字符串
   * 将 Electron 的 input 对象转换为 accelerator 格式
   */
  private static buildAccelerator(input: Electron.Input): string {
    const modifiers: string[] = [];

    if (input.control) modifiers.push('Ctrl');
    if (input.shift) modifiers.push('Shift');
    if (input.alt) modifiers.push('Alt');
    if (input.meta) modifiers.push('Cmd');

    // 特殊键映射
    const keyMap: Record<string, string> = {
      ' ': 'Space',
      'plus': 'Plus',
      'minus': 'Minus',
      'equal': 'Equal',
      'bracketleft': 'BracketLeft',
      'bracketright': 'BracketRight',
      'semicolon': 'Semicolon',
      'quote': 'Quote',
      'backquote': 'Backquote',
      'backslash': 'Backslash',
      'comma': 'Comma',
      'period': 'Period',
      'slash': 'Slash',
      'arrowup': 'Up',
      'arrowdown': 'Down',
      'arrowleft': 'Left',
      'arrowright': 'Right',
    };

    let key = input.key;
    if (keyMap[key.toLowerCase()]) {
      key = keyMap[key.toLowerCase()];
    }

    // 首字母大写
    if (key.length === 1) {
      key = key.toUpperCase();
    }

    if (modifiers.length > 0) {
      return `${modifiers.join('+')}+${key}`;
    }

    return key;
  }

  /** 根据环境加载渲染内容 */
  private static loadContent(win: BrowserWindow): void {
    if (IS_DEV) {
      win.loadURL(DEV_SERVER_URL);
      win.webContents.openDevTools();
      logger.info(`开发模式：加载 ${DEV_SERVER_URL}`);
    } else {
      win.loadFile(RENDERER_HTML_PATH);
      logger.info(`生产模式：加载 ${RENDERER_HTML_PATH}`);
    }
  }
}
