import { BrowserWindow, screen, ipcMain } from 'electron';
import * as path from 'path';
import { APP_ICON_PATH } from './config/app.config';

// 判断是否为开发模式
const isDev = process.env.NODE_ENV === 'development';

export function createWindow() {
  const options: Electron.BrowserWindowConstructorOptions = {
    height: 1080,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      webviewTag: true, // 启用webview标签支持
      allowRunningInsecureContent: true, // 允许不安全内容运行
    },
    resizable: true,
    icon: APP_ICON_PATH,
    width: 1440,
    frame: false, // 禁用默认窗口框架，使用自定义标题栏
    titleBarStyle: 'hidden', // 在macOS上隐藏原生标题栏
  };

  const mainWindow = new BrowserWindow(options);

  // 设置额外的安全策略以允许加载外部网站
  mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          "default-src 'self' 'unsafe-inline' 'unsafe-eval' data: blob: filesystem: *",
        ],
      },
    });
  });

  // 处理窗口控制请求
  ipcMain.handle('minimize-window', () => {
    mainWindow.minimize();
  });

  ipcMain.handle('toggle-maximize-window', () => {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  });

  ipcMain.handle('close-window', () => {
    mainWindow.close();
  });
  
  // 检查窗口是否最大化
  ipcMain.handle('is-window-maximized', () => {
    return mainWindow.isMaximized();
  });
  
  // 监听窗口最大化/还原事件并发送状态给渲染进程
  mainWindow.on('maximize', () => {
    mainWindow.webContents.send('maximize-status-change', true);
  });
  
  mainWindow.on('unmaximize', () => {
    mainWindow.webContents.send('maximize-status-change', false);
  });

  // 注册快捷键：F12 打开/关闭开发者工具
  mainWindow.webContents.on('before-input-event', (event, input) => {
    // F12 切换开发者工具
    if (input.key === 'F12') {
      event.preventDefault();
      if (mainWindow.webContents.isDevToolsOpened()) {
        mainWindow.webContents.closeDevTools();
      } else {
        mainWindow.webContents.openDevTools();
      }
      return;
    }
  });

  // 根据环境加载不同的内容
  if (isDev) {
    // 开发模式：加载webpack dev server
    mainWindow.loadURL('http://localhost:5174');
    // 打开开发者工具
    mainWindow.webContents.openDevTools();
  } else {
    // 生产模式：加载本地文件
    mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  }
  
  // 监听webpack热更新事件
  if (isDev) {
    mainWindow.webContents.on('did-finish-load', () => {
      console.log('热更新：页面加载完成');
    });
    
    mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
      console.error('热更新：页面加载失败', errorCode, errorDescription);
    });
  }
}
