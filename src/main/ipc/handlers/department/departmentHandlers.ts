import { IpcMainInvokeEvent } from 'electron';
import {
  DEPARTMENT_CREATE,
  DEPARTMENT_UPDATE,
  DEPARTMENT_DELETE,
  DEPARTMENT_RESTORE,
  DEPARTMENT_PURGE,
  DEPARTMENT_GET,
  DEPARTMENT_GET_LIST,
} from '../../channels';
import { DatabaseService } from '../../../services/system/DatabaseService';
import { ok, fail } from '../../../../shared/types/ipc.types';
import { createLogger } from '../../../utils/logger';
import { DepartmentCreateDTO, DepartmentUpdateDTO, DepartmentQueryDTO } from '../../../../shared/types/department.types';

const logger = createLogger('DepartmentHandlers');

export const departmentHandlers = {
  [DEPARTMENT_CREATE]: async (_event: IpcMainInvokeEvent, dto: DepartmentCreateDTO) => {
    logger.info('DEPARTMENT_CREATE IPC received:', dto);
    try {
      const db = DatabaseService.getInstance();
      const result = db.createDepartment(dto);
      logger.info('DEPARTMENT_CREATE Success:', result.id);
      return ok(result);
    } catch (error) {
      logger.error('创建部门失败 (IPC Handler):', error);
      return fail(error);
    }
  },

  [DEPARTMENT_UPDATE]: async (_event: IpcMainInvokeEvent, dto: DepartmentUpdateDTO) => {
    logger.info('DEPARTMENT_UPDATE IPC received:', dto);
    try {
      const db = DatabaseService.getInstance();
      const result = db.updateDepartment(dto);
      logger.info('DEPARTMENT_UPDATE Success:', result.id);
      return ok(result);
    } catch (error) {
      logger.error('更新部门失败 (IPC Handler):', error);
      return fail(error);
    }
  },

  [DEPARTMENT_DELETE]: async (_event: IpcMainInvokeEvent, id: string) => {
    try {
      const db = DatabaseService.getInstance();
      db.deleteDepartment(id);
      return ok({ success: true });
    } catch (error) {
      logger.error('删除部门失败:', error);
      return fail(error);
    }
  },

  [DEPARTMENT_RESTORE]: async (_event: IpcMainInvokeEvent, id: string) => {
    try {
      const db = DatabaseService.getInstance();
      db.restoreDepartment(id);
      return ok({ success: true });
    } catch (error) {
      logger.error('还原部门失败:', error);
      return fail(error);
    }
  },

  [DEPARTMENT_PURGE]: async (_event: IpcMainInvokeEvent, id: string) => {
    try {
      const db = DatabaseService.getInstance();
      db.purgeDepartment(id);
      return ok({ success: true });
    } catch (error) {
      logger.error('彻底删除部门失败:', error);
      return fail(error);
    }
  },

  [DEPARTMENT_GET]: async (_event: IpcMainInvokeEvent, id: string) => {
    try {
      const db = DatabaseService.getInstance();
      const result = db.getDepartmentById(id);
      return ok(result);
    } catch (error) {
      logger.error('获取部门详情失败:', error);
      return fail(error);
    }
  },

  [DEPARTMENT_GET_LIST]: async (_event: IpcMainInvokeEvent, query: DepartmentQueryDTO) => {
    try {
      const db = DatabaseService.getInstance();
      const result = db.getDepartments(query || {});
      return ok(result);
    } catch (error) {
      logger.error('获取部门列表失败:', error);
      return fail(error);
    }
  },
};
