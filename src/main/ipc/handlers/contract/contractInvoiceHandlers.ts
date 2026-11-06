import { IpcMainInvokeEvent } from 'electron';
import {
  CONTRACT_INVOICE_CREATE,
  CONTRACT_INVOICE_UPDATE,
  CONTRACT_INVOICE_DELETE,
  CONTRACT_INVOICE_RESTORE,
  CONTRACT_INVOICE_PURGE,
  CONTRACT_INVOICE_GET,
  CONTRACT_INVOICE_GET_LIST,
  CONTRACT_INVOICE_BATCH_DELETE,
  CONTRACT_INVOICE_BATCH_RESTORE,
  CONTRACT_INVOICE_BATCH_PURGE,
} from '../../channels';
import { DatabaseService } from '../../../services/system/DatabaseService';
import { ok, fail } from '../../../../shared/types/ipc.types';
import { createLogger } from '../../../utils/logger';
import type { ContractInvoiceCreateDTO, ContractInvoiceQueryDTO, ContractInvoiceUpdateDTO } from '../../../../shared/types/contractInvoice.types';

const logger = createLogger('ContractInvoiceHandlers');

export const contractInvoiceHandlers = {
  [CONTRACT_INVOICE_CREATE]: async (_event: IpcMainInvokeEvent, dto: ContractInvoiceCreateDTO) => {
    try {
      const db = DatabaseService.getInstance();
      const result = db.createContractInvoice(dto);
      return ok(result);
    } catch (error) {
      logger.error('创建合同发票失败:', error);
      return fail(error);
    }
  },

  [CONTRACT_INVOICE_UPDATE]: async (_event: IpcMainInvokeEvent, dto: ContractInvoiceUpdateDTO) => {
    try {
      const db = DatabaseService.getInstance();
      const result = db.updateContractInvoice(dto);
      return ok(result);
    } catch (error) {
      logger.error('更新合同发票失败:', error);
      return fail(error);
    }
  },

  [CONTRACT_INVOICE_DELETE]: async (_event: IpcMainInvokeEvent, id: string) => {
    try {
      const db = DatabaseService.getInstance();
      db.deleteContractInvoice(id);
      return ok({ success: true });
    } catch (error) {
      logger.error('删除合同发票失败:', error);
      return fail(error);
    }
  },

  [CONTRACT_INVOICE_RESTORE]: async (_event: IpcMainInvokeEvent, id: string) => {
    try {
      const db = DatabaseService.getInstance();
      db.restoreContractInvoice(id);
      return ok({ success: true });
    } catch (error) {
      logger.error('还原合同发票失败:', error);
      return fail(error);
    }
  },

  [CONTRACT_INVOICE_PURGE]: async (_event: IpcMainInvokeEvent, id: string) => {
    try {
      const db = DatabaseService.getInstance();
      db.purgeContractInvoice(id);
      return ok({ success: true });
    } catch (error) {
      logger.error('彻底删除合同发票失败:', error);
      return fail(error);
    }
  },

  [CONTRACT_INVOICE_GET]: async (_event: IpcMainInvokeEvent, id: string) => {
    try {
      const db = DatabaseService.getInstance();
      const result = db.getContractInvoiceById(id);
      return ok(result);
    } catch (error) {
      logger.error('获取合同发票详情失败:', error);
      return fail(error);
    }
  },

  [CONTRACT_INVOICE_GET_LIST]: async (_event: IpcMainInvokeEvent, query: ContractInvoiceQueryDTO) => {
    try {
      const db = DatabaseService.getInstance();
      const result = db.getContractInvoices(query);
      return ok(result);
    } catch (error) {
      logger.error('获取合同发票列表失败:', error);
      return fail(error);
    }
  },

  [CONTRACT_INVOICE_BATCH_DELETE]: async (_event: IpcMainInvokeEvent, ids: unknown) => {
    try {
      if (!Array.isArray(ids)) return fail(new Error('ids must be an array'));
      const db = DatabaseService.getInstance();
      const count = db.batchDeleteContractInvoice(ids as string[]);
      return ok({ deletedCount: count });
    } catch (error) {
      logger.error('批量删除合同发票失败:', error);
      return fail(error);
    }
  },

  [CONTRACT_INVOICE_BATCH_RESTORE]: async (_event: IpcMainInvokeEvent, ids: unknown) => {
    try {
      if (!Array.isArray(ids)) return fail(new Error('ids must be an array'));
      const db = DatabaseService.getInstance();
      const count = db.batchRestoreContractInvoice(ids as string[]);
      return ok({ restoredCount: count });
    } catch (error) {
      logger.error('批量恢复合同发票失败:', error);
      return fail(error);
    }
  },

  [CONTRACT_INVOICE_BATCH_PURGE]: async (_event: IpcMainInvokeEvent, ids: unknown) => {
    try {
      if (!Array.isArray(ids)) return fail(new Error('ids must be an array'));
      const db = DatabaseService.getInstance();
      const count = db.batchPurgeContractInvoice(ids as string[]);
      return ok({ purgedCount: count });
    } catch (error) {
      logger.error('批量彻底删除合同发票失败:', error);
      return fail(error);
    }
  },
};

