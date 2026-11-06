import { IpcMainInvokeEvent } from 'electron';
import {
  CUSTOMER_CREATE,
  CUSTOMER_UPDATE,
  CUSTOMER_DELETE,
  CUSTOMER_RESTORE,
  CUSTOMER_PURGE,
  CUSTOMER_GET,
  CUSTOMER_GET_LIST,
} from '../../channels';
import { DatabaseService } from '../../../services/system/DatabaseService';
import { ok, fail } from '../../../../shared/types/ipc.types';
import { createLogger } from '../../../utils/logger';
import { CustomerCreateDTO, CustomerUpdateDTO, CustomerQueryDTO } from '../../../../shared/types/customer.types';
import { ensureUnitLibraryDirectory, resolveLibraryRootPathFromDbPath } from '../../../utils/unitLibrary';
import { getUnitLibraryPartyMeta } from '../../../../shared/utils/unitLibrary';

const logger = createLogger('CustomerHandlers');
const customerLibraryMeta = getUnitLibraryPartyMeta('party-a');

export const customerHandlers = {
  [CUSTOMER_CREATE]: async (_event: IpcMainInvokeEvent, dto: CustomerCreateDTO) => {
    try {
      const db = DatabaseService.getInstance();
      const result = db.createCustomer(dto);
      const libraryRootPath = resolveLibraryRootPathFromDbPath(db.getDbPath());

      try {
        const directoryResult = ensureUnitLibraryDirectory('party-a', result.name, libraryRootPath);
        logger.info(
          `${customerLibraryMeta.unitLabel}资料库目录${directoryResult.status === 'created' ? '已创建' : '已复用'}: id=${result.id}, name=${result.name}, folder=${directoryResult.folderName}, path=${directoryResult.directoryPath}`,
        );
      } catch (directoryError) {
        logger.error(
          `创建客户后准备${customerLibraryMeta.unitLabel}资料库目录失败: id=${result.id}, name=${result.name}, libraryRoot=${libraryRootPath}`,
          directoryError,
        );

        try {
          db.purgeCustomer(result.id);
          logger.warn(`已回滚客户创建记录: id=${result.id}, name=${result.name}`);
        } catch (rollbackError) {
          logger.error(`回滚客户创建记录失败: id=${result.id}, name=${result.name}`, rollbackError);
        }

        const detail = directoryError instanceof Error ? directoryError.message : String(directoryError);
        return fail(new Error(`创建客户失败：${customerLibraryMeta.unitLabel}资料库目录准备失败，请检查资源库目录权限或路径状态。${detail}`));
      }

      return ok(result);
    } catch (error) {
      logger.error('创建客户失败:', error);
      return fail(error);
    }
  },

  [CUSTOMER_UPDATE]: async (_event: IpcMainInvokeEvent, dto: CustomerUpdateDTO) => {
    try {
      const db = DatabaseService.getInstance();
      const result = db.updateCustomer(dto);
      return ok(result);
    } catch (error) {
      logger.error('更新客户失败:', error);
      return fail(error);
    }
  },

  [CUSTOMER_DELETE]: async (_event: IpcMainInvokeEvent, id: string) => {
    try {
      const db = DatabaseService.getInstance();
      db.deleteCustomer(id);
      return ok({ success: true });
    } catch (error) {
      logger.error('删除客户失败:', error);
      return fail(error);
    }
  },

  [CUSTOMER_RESTORE]: async (_event: IpcMainInvokeEvent, id: string) => {
    try {
      const db = DatabaseService.getInstance();
      db.restoreCustomer(id);
      return ok({ success: true });
    } catch (error) {
      logger.error('还原客户失败:', error);
      return fail(error);
    }
  },

  [CUSTOMER_PURGE]: async (_event: IpcMainInvokeEvent, id: string) => {
    try {
      const db = DatabaseService.getInstance();
      db.purgeCustomer(id);
      return ok({ success: true });
    } catch (error) {
      logger.error('彻底删除客户失败:', error);
      return fail(error);
    }
  },

  [CUSTOMER_GET]: async (_event: IpcMainInvokeEvent, id: string) => {
    try {
      const db = DatabaseService.getInstance();
      const result = db.getCustomerById(id);
      return ok(result);
    } catch (error) {
      logger.error('获取客户详情失败:', error);
      return fail(error);
    }
  },

  [CUSTOMER_GET_LIST]: async (_event: IpcMainInvokeEvent, query: CustomerQueryDTO) => {
    try {
      const db = DatabaseService.getInstance();
      const result = db.getCustomers(query);
      return ok(result);
    } catch (error) {
      logger.error('获取客户列表失败:', error);
      return fail(error);
    }
  },
};
