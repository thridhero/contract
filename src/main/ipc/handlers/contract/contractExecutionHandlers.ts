import { IpcMainInvokeEvent } from 'electron';
import {
  CONTRACT_EXECUTION_CREATE,
  CONTRACT_EXECUTION_UPDATE,
  CONTRACT_EXECUTION_DELETE,
  CONTRACT_EXECUTION_RESTORE,
  CONTRACT_EXECUTION_PURGE,
  CONTRACT_EXECUTION_GET,
  CONTRACT_EXECUTION_GET_LIST,
} from '../../channels';
import { DatabaseService } from '../../../services/system/DatabaseService';
import { ok, fail } from '../../../../shared/types/ipc.types';
import { createLogger } from '../../../utils/logger';
import { ContractExecutionCreateDTO, ContractExecutionQueryDTO, ContractExecutionUpdateDTO } from '../../../../shared/types/contractExecution.types';

const logger = createLogger('ContractExecutionHandlers');

export const contractExecutionHandlers = {
  [CONTRACT_EXECUTION_CREATE]: async (_event: IpcMainInvokeEvent, dto: ContractExecutionCreateDTO) => {
    try {
      const db = DatabaseService.getInstance();
      const result = db.createContractExecution(dto);
      return ok(result);
    } catch (error) {
      logger.error('创建合同执行失败:', error);
      return fail(error);
    }
  },

  [CONTRACT_EXECUTION_UPDATE]: async (_event: IpcMainInvokeEvent, dto: ContractExecutionUpdateDTO) => {
    try {
      const db = DatabaseService.getInstance();
      const result = db.updateContractExecution(dto);
      return ok(result);
    } catch (error) {
      logger.error('更新合同执行失败:', error);
      return fail(error);
    }
  },

  [CONTRACT_EXECUTION_DELETE]: async (_event: IpcMainInvokeEvent, id: string) => {
    try {
      const db = DatabaseService.getInstance();
      db.deleteContractExecution(id);
      return ok({ success: true });
    } catch (error) {
      logger.error('删除合同执行失败:', error);
      return fail(error);
    }
  },

  [CONTRACT_EXECUTION_RESTORE]: async (_event: IpcMainInvokeEvent, id: string) => {
    try {
      const db = DatabaseService.getInstance();
      db.restoreContractExecution(id);
      return ok({ success: true });
    } catch (error) {
      logger.error('还原合同执行失败:', error);
      return fail(error);
    }
  },

  [CONTRACT_EXECUTION_PURGE]: async (_event: IpcMainInvokeEvent, id: string) => {
    try {
      const db = DatabaseService.getInstance();
      db.purgeContractExecution(id);
      return ok({ success: true });
    } catch (error) {
      logger.error('彻底删除合同执行失败:', error);
      return fail(error);
    }
  },

  [CONTRACT_EXECUTION_GET]: async (_event: IpcMainInvokeEvent, id: string) => {
    try {
      const db = DatabaseService.getInstance();
      const result = db.getContractExecutionById(id);
      return ok(result);
    } catch (error) {
      logger.error('获取合同执行详情失败:', error);
      return fail(error);
    }
  },

  [CONTRACT_EXECUTION_GET_LIST]: async (_event: IpcMainInvokeEvent, query: ContractExecutionQueryDTO) => {
    try {
      const db = DatabaseService.getInstance();
      const result = db.getContractExecutions(query);
      return ok(result);
    } catch (error) {
      logger.error('获取合同执行列表失败:', error);
      return fail(error);
    }
  },
};
