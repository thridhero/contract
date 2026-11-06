import { IpcMainInvokeEvent } from 'electron';
import {
  CONTRACT_PRODUCT_CREATE,
  CONTRACT_PRODUCT_UPDATE,
  CONTRACT_PRODUCT_DELETE,
  CONTRACT_PRODUCT_RESTORE,
  CONTRACT_PRODUCT_PURGE,
  CONTRACT_PRODUCT_GET,
  CONTRACT_PRODUCT_GET_LIST,
} from '../../channels';
import { DatabaseService } from '../../../services/system/DatabaseService';
import { ok, fail } from '../../../../shared/types/ipc.types';
import { createLogger } from '../../../utils/logger';
import { ContractProductCreateDTO, ContractProductUpdateDTO, ContractProductQueryDTO } from '../../../../shared/types/contractProduct.types';

const logger = createLogger('ContractProductHandlers');

export const contractProductHandlers = {
  [CONTRACT_PRODUCT_CREATE]: async (_event: IpcMainInvokeEvent, dto: ContractProductCreateDTO) => {
    try {
      const db = DatabaseService.getInstance();
      const result = db.createContractProduct(dto);
      return ok(result);
    } catch (error) {
      logger.error('创建合同产品失败:', error);
      return fail(error);
    }
  },

  [CONTRACT_PRODUCT_UPDATE]: async (_event: IpcMainInvokeEvent, dto: ContractProductUpdateDTO) => {
    try {
      const db = DatabaseService.getInstance();
      const result = db.updateContractProduct(dto);
      return ok(result);
    } catch (error) {
      logger.error('更新合同产品失败:', error);
      return fail(error);
    }
  },

  [CONTRACT_PRODUCT_DELETE]: async (_event: IpcMainInvokeEvent, id: string) => {
    try {
      const db = DatabaseService.getInstance();
      db.deleteContractProduct(id);
      return ok({ success: true });
    } catch (error) {
      logger.error('删除合同产品失败:', error);
      return fail(error);
    }
  },

  [CONTRACT_PRODUCT_RESTORE]: async (_event: IpcMainInvokeEvent, id: string) => {
    try {
      const db = DatabaseService.getInstance();
      db.restoreContractProduct(id);
      return ok({ success: true });
    } catch (error) {
      logger.error('还原合同产品失败:', error);
      return fail(error);
    }
  },

  [CONTRACT_PRODUCT_PURGE]: async (_event: IpcMainInvokeEvent, id: string) => {
    try {
      const db = DatabaseService.getInstance();
      db.purgeContractProduct(id);
      return ok({ success: true });
    } catch (error) {
      logger.error('彻底删除合同产品失败:', error);
      return fail(error);
    }
  },

  [CONTRACT_PRODUCT_GET]: async (_event: IpcMainInvokeEvent, id: string) => {
    try {
      const db = DatabaseService.getInstance();
      const result = db.getContractProductById(id);
      return ok(result);
    } catch (error) {
      logger.error('获取合同产品详情失败:', error);
      return fail(error);
    }
  },

  [CONTRACT_PRODUCT_GET_LIST]: async (_event: IpcMainInvokeEvent, query: ContractProductQueryDTO) => {
    try {
      const db = DatabaseService.getInstance();
      const result = db.getContractProducts(query);
      return ok(result);
    } catch (error) {
      logger.error('获取合同产品列表失败:', error);
      return fail(error);
    }
  },
};
