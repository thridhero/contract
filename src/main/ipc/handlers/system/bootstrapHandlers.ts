import { IpcMainInvokeEvent, dialog } from 'electron';
import * as path from 'path';
import * as crypto from 'crypto';
import * as channels from '../../channels';
import { BootstrapService } from '../../../services/system/BootstrapService';
import { DatabaseService } from '../../../services/system/DatabaseService';
import { ConfigService } from '../../../services/system/ConfigService';
import { TrashAutoPurgeService } from '../../../services/system/TrashAutoPurgeService';
import { ok, IpcResponse, InitStatusData, InitProjectData, LoadLibraryData, SelectFolderData } from '../../../../shared/types/ipc.types';
import { createLogger } from '../../../utils/logger';

const logger = createLogger('BootstrapHandlers');
const bootstrap = BootstrapService.getInstance();

export const bootstrapHandlers: Record<string, (event: IpcMainInvokeEvent, ...args: unknown[]) => Promise<unknown>> = {

  /** 获取初始化状态 */
  [channels.BOOT_GET_INIT_STATUS]: async (): Promise<IpcResponse<InitStatusData>> => {
    const config = bootstrap.readConfig();
    if (!config?.initialized) {
      return ok<InitStatusData>({ initialized: false, projectPath: null, projectName: null });
    }
    logger.info(`项目已初始化: ${config.projectPath}`);
    return ok<InitStatusData>({
      initialized: true,
      projectPath: config.projectPath,
      projectName: config.projectName,
    });
  },

  /** 打开系统文件夹选择对话框 */
  [channels.BOOT_SELECT_FOLDER]: async (): Promise<IpcResponse<SelectFolderData>> => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory'],
      title: '选择资源库保存路径',
    });
    return ok<SelectFolderData>(result);
  },

  /** 初始化新项目 */
  [channels.BOOT_INIT_PROJECT]: async (_, projectName: unknown, basePath: unknown): Promise<IpcResponse<InitProjectData>> => {
    if (typeof projectName !== 'string' || typeof basePath !== 'string') {
      throw new Error('参数类型错误：projectName 和 basePath 必须为字符串');
    }
    const db = DatabaseService.getInstance();
    const result = db.createProjectDatabase(basePath, projectName);

    const projectPath = path.join(basePath, projectName);
    bootstrap.saveConfig({
      projectName,
      projectPath,
      databasePath: result.dbPath,
      initialized: true,
      initializedAt: new Date().toISOString(),
    });

    // 将新初始化的项目注册到全局资源库列表
    const configSvc = ConfigService.getInstance();
    const libraries = configSvc.getConfigItem('libraries') || [];
    const library = {
      id: crypto.randomUUID(),
      name: projectName,
      path: projectPath,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    libraries.unshift(library);
    configSvc.updateConfigItem('libraries', libraries);

    return ok<InitProjectData>({ projectPath, library });
  },

  /** 验证路径是否为有效资源库 */
  [channels.BOOT_VALIDATE_PATH]: async (_, libraryPath: unknown): Promise<IpcResponse<boolean>> => {
    if (typeof libraryPath !== 'string') throw new Error('libraryPath 必须为字符串');
    const valid = DatabaseService.getInstance().isValidLibraryPath(libraryPath);
    return ok(valid);
  },

  /** 加载现有资源库 */
  [channels.BOOT_LOAD_LIBRARY]: async (_, libraryPath: unknown): Promise<IpcResponse<LoadLibraryData>> => {
    if (typeof libraryPath !== 'string') throw new Error('libraryPath 必须为字符串');

    const db = DatabaseService.getInstance();
    if (!db.isValidLibraryPath(libraryPath)) {
      throw new Error('无效的资源库路径');
    }

    const projectName = db.readProjectNameFromLibrary(libraryPath);
    const dbPath = db.getLibraryDbPath(libraryPath);

    bootstrap.saveConfig({
      projectName,
      projectPath: libraryPath,
      databasePath: dbPath,
      initialized: true,
      initializedAt: new Date().toISOString(),
    });

    db.init(dbPath);
    TrashAutoPurgeService.getInstance().runOnceForLibrary(libraryPath, 'load-library').catch(() => {});

    // Ensure it's in the global library list
    const configSvc = ConfigService.getInstance();
    const libraries = configSvc.getConfigItem('libraries') || [];
    let library = libraries.find((l: any) => l.path === libraryPath);
    
    if (!library) {
      library = {
        id: crypto.randomUUID(),
        name: projectName,
        path: libraryPath,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      libraries.unshift(library);
      configSvc.updateConfigItem('libraries', libraries);
    }

    logger.info(`已加载现有资源库: ${libraryPath}`);
    return ok<LoadLibraryData>({ projectPath: libraryPath, projectName, library });
  },
};
