import { IpcMainInvokeEvent } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import * as channels from '../../channels';
import { DatabaseService } from '../../../services/system/DatabaseService';
import { ok, IpcResponse } from '../../../../shared/types/ipc.types';
import { Project, ProjectCreateDTO, ProjectUpdateDTO } from '../../../../shared/types/project.types';
import { DOCUMENT_CATEGORIES } from '../../../../shared/types/document.types';

const getDb = () => DatabaseService.getInstance();

/** 在项目路径下创建标准 6 级文件夹 */
function createProjectFolderStructure(folderPath: string): void {
  const dirs = [
    '01-软件基本信息',
    '02-申请人材料',
    '03-源代码材料',
    '04-文档材料',
    '05-申请表格',
    '06-受理与证书',
  ];
  fs.mkdirSync(folderPath, { recursive: true });
  for (const dir of dirs) {
    fs.mkdirSync(path.join(folderPath, dir), { recursive: true });
  }
}

export const projectHandlers: Record<string, (event: IpcMainInvokeEvent, ...args: unknown[]) => Promise<unknown>> = {

  [channels.PROJECT_CREATE]: async (_, dto: unknown): Promise<IpcResponse<Project>> => {
    const createDto = dto as ProjectCreateDTO;
    // 创建项目文件夹结构
    createProjectFolderStructure(createDto.folder_path);
    // 插入数据库记录
    const project = getDb().createProject(createDto);
    // 初始化默认工作流
    getDb().initDefaultWorkflow(project.id);
    return ok(project);
  },

  [channels.PROJECT_UPDATE]: async (_, dto: unknown): Promise<IpcResponse<Project>> => {
    const updateDto = dto as ProjectUpdateDTO;
    const project = getDb().updateProject(updateDto);
    return ok(project);
  },

  [channels.PROJECT_DELETE]: async (_, id: unknown): Promise<IpcResponse> => {
    getDb().deleteProject(String(id));
    return ok();
  },

  [channels.PROJECT_RESTORE]: async (_, id: unknown): Promise<IpcResponse> => {
    getDb().restoreProject(String(id));
    return ok();
  },

  [channels.PROJECT_PURGE]: async (_, id: unknown): Promise<IpcResponse> => {
    getDb().purgeProject(String(id));
    return ok();
  },

  [channels.PROJECT_GET]: async (_, id: unknown): Promise<IpcResponse<Project | null>> => {
    return ok(getDb().getProject(String(id)));
  },

  [channels.PROJECT_GET_ALL]: async (_, includeArchived: unknown, _includeDeleted?: unknown): Promise<IpcResponse<Project[]>> => {
    return ok(getDb().getAllProjects(Boolean(includeArchived)));
  },

  [channels.PROJECT_SEARCH]: async (_, term: unknown): Promise<IpcResponse<Project[]>> => {
    return ok(getDb().searchProjects(String(term)));
  },

  [channels.PROJECT_GET_STATS]: async (): Promise<IpcResponse<{ total: number; by_status: Record<string, number> }>> => {
    return ok(getDb().getProjectStats());
  },

  [channels.PROJECT_GET_BY_STATUS]: async (_, status: unknown): Promise<IpcResponse<Project[]>> => {
    return ok(getDb().getProjectsByStatus(String(status)));
  },
};
