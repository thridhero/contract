/**
 * Electron 主进程入口
 *
 * 职责仅限于：
 * 1. 处理 Squirrel 安装/卸载事件
 * 2. app 生命周期管理
 * 3. 协调各模块的启动顺序
 *
 * 业务逻辑全部委托给：
 * - WindowManager    窗口创建与管理
 * - IpcManager       IPC handler 注册与注销
 * - DatabaseService  数据库操作
 * - BootstrapService 初始化配置管理
 */
if (process.env.ELECTRON_RUN_AS_NODE === '1') {
  process.exit(0);
}

import { app, BrowserWindow } from 'electron';
import * as path from 'path';
import { WindowManager } from './windows/WindowManager';
import { APP_USER_MODEL_ID } from './config/app.config';
import { IpcManager } from './ipc/IpcManager';
import { appHandlers } from './ipc/handlers/system';
import { windowHandlers } from './ipc/handlers/system';
import { bootstrapHandlers } from './ipc/handlers/system';
import { databaseHandlers } from './ipc/handlers/system';
import { reminderHandlers } from './ipc/handlers/system';
import { shortcutHandlers } from './ipc/handlers/system';
import { configHandlers } from './ipc/handlers/system';
import { backupHandlers } from './ipc/handlers/system';
import { aiHandlers } from './ipc/handlers/system';
import { logHandlers } from './ipc/handlers/system';
import { searchHandlers } from './ipc/handlers/system';
import { importTaskHandlers } from './ipc/handlers/system';
import { closeGuardHandlers } from './ipc/handlers/system';
import { taskMonitorHandlers } from './ipc/handlers/system';

import { contractHandlers } from './ipc/handlers/contract';
import { contractProductHandlers } from './ipc/handlers/contract';
import { contractExecutionHandlers } from './ipc/handlers/contract';
import { contractInvoiceHandlers } from './ipc/handlers/contract';
import { contractFileHandlers } from './ipc/handlers/contract';

import { fileSystemHandlers } from './ipc/handlers/file';
import { fileCopyHandlers } from './ipc/handlers/file';
import { fileConversionHandlers } from './ipc/handlers/file';
import { documentHandlers } from './ipc/handlers/file';
import { otherFileHandlers } from './ipc/handlers/file';

import { invoiceHandlers } from './ipc/handlers/invoice';
import { toolboxHandlers } from './ipc/handlers/toolbox';

import { projectHandlers } from './ipc/handlers/project';
import { projectManagementHandlers } from './ipc/handlers/project';
import { workflowHandlers } from './ipc/handlers/project';

import { customerHandlers } from './ipc/handlers/customer';
import { supplierHandlers } from './ipc/handlers/supplier';
import { departmentHandlers } from './ipc/handlers/department';
import { personnelHandlers } from './ipc/handlers/personnel';
import { unitDocumentHandlers } from './ipc/handlers/unitDocument';

import { dictionaryHandlers } from './ipc/handlers/dictionary';
import { treeDictionaryHandlers } from './ipc/handlers/dictionary';

import { libraryHandlers } from './ipc/handlers/library';
import { BootstrapService } from './services/system/BootstrapService';
import { DatabaseService } from './services/system/DatabaseService';
import { ConfigService } from './services/system/ConfigService';
import { BackupSchedulerService } from './services/system/BackupSchedulerService';
import { TrashAutoPurgeService } from './services/system/TrashAutoPurgeService';
import { createLogger } from './utils/logger';

if (!app || typeof (app as unknown as { whenReady?: unknown }).whenReady !== 'function') {
  process.exit(0);
}

// 处理 Windows 安装/卸载时的快捷方式事件
if (require('electron-squirrel-startup')) app.quit();

try {
  const appDataPath = app.getPath('appData');
  app.setPath('userData', path.join(appDataPath, 'software-registration-manager'));
  app.setName('宏起助手');
  if (process.platform === 'win32') {
    app.setAppUserModelId(APP_USER_MODEL_ID);
  }
} catch {}

const logger = createLogger('Main');

// 全局异常兜底
process.on('unhandledRejection', (reason: unknown) => {
  try {
    logger.error('未处理的 Promise 拒绝', reason);
  } catch {
    // noop
  }
});
process.on('uncaughtException', (err: Error) => {
  try {
    logger.error('未捕获异常', err);
  } catch {
    // noop
  }
});

async function bootstrap(): Promise<void> {
  // 1. 注册全部 IPC handler（在窗口创建之前完成，避免竞态）
  IpcManager.registerAll({
    ...windowHandlers,
    ...appHandlers,
    ...bootstrapHandlers,
    ...databaseHandlers,
    ...projectHandlers,
    ...projectManagementHandlers,
    ...documentHandlers,
    ...workflowHandlers,
    ...reminderHandlers,
    ...fileSystemHandlers,
    ...otherFileHandlers,
    ...shortcutHandlers,
    ...fileCopyHandlers,
    ...libraryHandlers,
    ...configHandlers,
    ...backupHandlers,
    ...aiHandlers,
    ...contractHandlers,
    ...supplierHandlers,
    ...customerHandlers,
    ...departmentHandlers,
    ...personnelHandlers,
    ...unitDocumentHandlers,
    ...contractProductHandlers,
    ...contractExecutionHandlers,
    ...contractInvoiceHandlers,
    ...contractFileHandlers,
    ...dictionaryHandlers,
    ...treeDictionaryHandlers,
    ...logHandlers,
    ...fileConversionHandlers,
    ...invoiceHandlers,
    ...toolboxHandlers,
    ...importTaskHandlers,
    ...searchHandlers,
    ...closeGuardHandlers,
    ...taskMonitorHandlers,
  });

  // 2. 如果已初始化，提前加载数据库
  const bootstrapSvc = BootstrapService.getInstance();
  if (bootstrapSvc.isInitialized()) {
    const dbPath = bootstrapSvc.getDatabasePath();
    if (dbPath) {
      DatabaseService.getInstance().init(dbPath);
      logger.info(`数据库已预加载: ${dbPath}`);
    }
  }

  TrashAutoPurgeService.getInstance().startPeriodic();
  TrashAutoPurgeService.getInstance().runForAllLibraries('startup').catch(() => {});
  BackupSchedulerService.getInstance().startPeriodic();

  try {
    const enabled = Boolean(ConfigService.getInstance().getConfigItem('autoStartAtLogin'));
    app.setLoginItemSettings({ openAtLogin: enabled });
  } catch {}

  // 3. 创建主窗口
  WindowManager.createMainWindow();
  logger.info('应用启动完成');
}

// ─── App 生命周期 ──────────────────────────────────────────────────

app.whenReady().then(bootstrap).catch(err => {
  logger.error('启动失败', err);
  app.quit();
});

app.on('window-all-closed', () => {
  // macOS 惯例：关闭所有窗口不退出应用
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  // macOS：点击 Dock 图标时重新创建窗口
  if (BrowserWindow.getAllWindows().length === 0) {
    WindowManager.createMainWindow();
  }
});

app.on('will-quit', () => {
  IpcManager.unregisterAll();
  logger.info('应用退出，已清理所有 IPC handler');
});
