import { Library } from './library.types';

/**
 * IPC 通用响应格式
 * 所有 ipcMain.handle 处理器必须返回此结构，确保渲染层处理逻辑一致。
 */
export interface IpcResponse<T = void> {
  success: boolean;
  data?: T;
  error?: string;
  /** 调试用的错误堆栈，仅在开发模式下附加 */
  stack?: string;
}

/** 创建成功响应 */
export function ok<T>(data?: T): IpcResponse<T> {
  return { success: true, data };
}

/** 创建失败响应 */
export function fail(error: unknown, includeStack = false): IpcResponse<never> {
  const message = error instanceof Error ? error.message : String(error);
  const stack = includeStack && error instanceof Error ? error.stack : undefined;
  return { success: false, error: message, stack };
}

// ─── 各域请求/响应类型 ─────────────────────────────────────────

/** 获取初始化状态的响应 */
export interface InitStatusData {
  initialized: boolean;
  projectPath: string | null;
  projectName: string | null;
}

/** 初始化项目的响应 */
export interface InitProjectData {
  projectPath: string;
  library?: Library;
}

/** 加载现有资源库的响应 */
export interface LoadLibraryData {
  projectPath: string;
  projectName: string;
  library?: Library;
}

/** 选择文件夹的响应（直接复用 Electron 的 OpenDialogReturnValue） */
export interface SelectFolderData {
  canceled: boolean;
  filePaths: string[];
}

/** 应用基础信息（用于“关于/检查更新”等弹窗展示） */
export interface AppInfoData {
  appId: string;
  appName: string;
  appVersion: string;
  isPackaged: boolean;
  platform: NodeJS.Platform;
  arch: string;
  locale: string;
  execPath: string;
  appPath: string;
  userDataPath: string;
  backendBaseUrl: string;
  versions: {
    electron?: string;
    chrome?: string;
    node?: string;
    v8?: string;
  };
}
