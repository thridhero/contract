import { IpcMainInvokeEvent } from 'electron';
import {
  SUPPLIER_CREATE,
  SUPPLIER_UPDATE,
  SUPPLIER_DELETE,
  SUPPLIER_RESTORE,
  SUPPLIER_PURGE,
  SUPPLIER_GET,
  SUPPLIER_GET_LIST,
} from '../../channels';
import { DatabaseService } from '../../../services/system/DatabaseService';
import { ok, fail } from '../../../../shared/types/ipc.types';
import { createLogger } from '../../../utils/logger';
import { SupplierCreateDTO, SupplierUpdateDTO, SupplierQueryDTO } from '../../../../shared/types/supplier.types';
import { ensureUnitLibraryDirectory, resolveLibraryRootPathFromDbPath } from '../../../utils/unitLibrary';
import { getUnitLibraryPartyMeta } from '../../../../shared/utils/unitLibrary';

const logger = createLogger('SupplierHandlers');
const supplierLibraryMeta = getUnitLibraryPartyMeta('party-b');

export const supplierHandlers = {
  [SUPPLIER_CREATE]: async (_event: IpcMainInvokeEvent, dto: SupplierCreateDTO) => {
    try {
      const db = DatabaseService.getInstance();
      const result = db.createSupplier(dto);
      const libraryRootPath = resolveLibraryRootPathFromDbPath(db.getDbPath());

      try {
        const directoryResult = ensureUnitLibraryDirectory('party-b', result.name, libraryRootPath);
        logger.info(
          `${supplierLibraryMeta.unitLabel}资料库目录${directoryResult.status === 'created' ? '已创建' : '已复用'}: id=${result.id}, name=${result.name}, folder=${directoryResult.folderName}, path=${directoryResult.directoryPath}`,
        );
      } catch (directoryError) {
        logger.error(
          `创建供应商后准备${supplierLibraryMeta.unitLabel}资料库目录失败: id=${result.id}, name=${result.name}, libraryRoot=${libraryRootPath}`,
          directoryError,
        );

        try {
          db.purgeSupplier(result.id);
          logger.warn(`已回滚供应商创建记录: id=${result.id}, name=${result.name}`);
        } catch (rollbackError) {
          logger.error(`回滚供应商创建记录失败: id=${result.id}, name=${result.name}`, rollbackError);
        }

        const detail = directoryError instanceof Error ? directoryError.message : String(directoryError);
        return fail(new Error(`创建供应商失败：${supplierLibraryMeta.unitLabel}资料库目录准备失败，请检查资源库目录权限或路径状态。${detail}`));
      }

      return ok(result);
    } catch (error) {
      logger.error('创建供应商失败:', error);
      return fail(error);
    }
  },

  [SUPPLIER_UPDATE]: async (_event: IpcMainInvokeEvent, dto: SupplierUpdateDTO) => {
    try {
      const db = DatabaseService.getInstance();
      const result = db.updateSupplier(dto);
      return ok(result);
    } catch (error) {
      logger.error('更新供应商失败:', error);
      return fail(error);
    }
  },

  [SUPPLIER_DELETE]: async (_event: IpcMainInvokeEvent, id: string) => {
    try {
      const db = DatabaseService.getInstance();
      db.deleteSupplier(id);
      return ok({ success: true });
    } catch (error) {
      logger.error('删除供应商失败:', error);
      return fail(error);
    }
  },

  [SUPPLIER_RESTORE]: async (_event: IpcMainInvokeEvent, id: string) => {
    try {
      const db = DatabaseService.getInstance();
      db.restoreSupplier(id);
      return ok({ success: true });
    } catch (error) {
      logger.error('还原供应商失败:', error);
      return fail(error);
    }
  },

  [SUPPLIER_PURGE]: async (_event: IpcMainInvokeEvent, id: string) => {
    try {
      const db = DatabaseService.getInstance();
      db.purgeSupplier(id);
      return ok({ success: true });
    } catch (error) {
      logger.error('彻底删除供应商失败:', error);
      return fail(error);
    }
  },

  [SUPPLIER_GET]: async (_event: IpcMainInvokeEvent, id: string) => {
    try {
      const db = DatabaseService.getInstance();
      const result = db.getSupplierById(id);
      return ok(result);
    } catch (error) {
      logger.error('获取供应商详情失败:', error);
      return fail(error);
    }
  },

  [SUPPLIER_GET_LIST]: async (_event: IpcMainInvokeEvent, query: SupplierQueryDTO) => {
    try {
      const db = DatabaseService.getInstance();
      const result = db.getSuppliers(query);
      return ok(result);
    } catch (error) {
      logger.error('获取供应商列表失败:', error);
      return fail(error);
    }
  },
};
