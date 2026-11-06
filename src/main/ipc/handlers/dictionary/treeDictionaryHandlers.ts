import { BrowserWindow, IpcMainInvokeEvent } from 'electron';
import {
  TREE_DICTIONARY_CREATE,
  TREE_DICTIONARY_UPDATE,
  TREE_DICTIONARY_DELETE,
  TREE_DICTIONARY_RESTORE,
  TREE_DICTIONARY_PURGE,
  TREE_DICTIONARY_GET,
  TREE_DICTIONARY_GET_LIST,
  TREE_DICTIONARY_IMPORT_CSV,
  TREE_DICTIONARY_IMPORT_PROGRESS,
  TREE_DICTIONARY_RENAME_GROUP,
  TREE_DICTIONARY_CLEAR_GROUPS,
  TREE_DICTIONARY_UPDATE_SORT,
} from '../../channels';
import { DatabaseService } from '../../../services/system/DatabaseService';
import { ok, fail } from '../../../../shared/types/ipc.types';
import { createLogger } from '../../../utils/logger';
import { TreeDictionaryCreateDTO, TreeDictionaryUpdateDTO, TreeDictionaryQueryDTO } from '../../../../shared/types/treeDictionary.types';
import { parseCsv } from '../../../utils/csvParser';

const logger = createLogger('TreeDictionaryHandlers');

export const treeDictionaryHandlers = {
  [TREE_DICTIONARY_CREATE]: async (_event: IpcMainInvokeEvent, dto: TreeDictionaryCreateDTO) => {
    try {
      const db = DatabaseService.getInstance();
      const result = db.createTreeDictionary(dto);
      return ok(result);
    } catch (error) {
      logger.error('创建树形字典失败:', error);
      return fail(error);
    }
  },

  [TREE_DICTIONARY_UPDATE]: async (_event: IpcMainInvokeEvent, dto: TreeDictionaryUpdateDTO) => {
    try {
      const db = DatabaseService.getInstance();
      const result = db.updateTreeDictionary(dto);
      return ok(result);
    } catch (error) {
      logger.error('更新树形字典失败:', error);
      return fail(error);
    }
  },

  [TREE_DICTIONARY_DELETE]: async (_event: IpcMainInvokeEvent, id: string) => {
    try {
      const db = DatabaseService.getInstance();
      db.deleteTreeDictionary(id);
      return ok({ success: true });
    } catch (error) {
      logger.error('删除树形字典失败:', error);
      return fail(error);
    }
  },

  [TREE_DICTIONARY_RESTORE]: async (_event: IpcMainInvokeEvent, id: string) => {
    try {
      const db = DatabaseService.getInstance();
      db.restoreTreeDictionary(id);
      return ok({ success: true });
    } catch (error) {
      logger.error('还原树形字典失败:', error);
      return fail(error);
    }
  },

  [TREE_DICTIONARY_PURGE]: async (_event: IpcMainInvokeEvent, id: string) => {
    try {
      const db = DatabaseService.getInstance();
      db.purgeTreeDictionary(id);
      return ok({ success: true });
    } catch (error) {
      logger.error('彻底删除树形字典失败:', error);
      return fail(error);
    }
  },

  [TREE_DICTIONARY_GET]: async (_event: IpcMainInvokeEvent, id: string) => {
    try {
      const db = DatabaseService.getInstance();
      const result = db.getTreeDictionaryById(id);
      return ok(result);
    } catch (error) {
      logger.error('获取树形字典详情失败:', error);
      return fail(error);
    }
  },

  [TREE_DICTIONARY_GET_LIST]: async (_event: IpcMainInvokeEvent, query: TreeDictionaryQueryDTO) => {
    try {
      const db = DatabaseService.getInstance();
      const result = db.getTreeDictionaries(query);
      return ok(result);
    } catch (error) {
      logger.error('获取树形字典列表失败:', error);
      return fail(error);
    }
  },

  [TREE_DICTIONARY_RENAME_GROUP]: async (_event: IpcMainInvokeEvent, oldName: string, newName: string) => {
    try {
      const db = DatabaseService.getInstance();
      const updatedCount = db.renameTreeDictionaryGroup(oldName, newName);
      return ok({ updatedCount });
    } catch (error) {
      logger.error('重命名树形字典分组失败:', error);
      return fail(error);
    }
  },

  [TREE_DICTIONARY_CLEAR_GROUPS]: async (_event: IpcMainInvokeEvent, groupNames: string[]) => {
    try {
      const db = DatabaseService.getInstance();
      const updatedCount = db.clearTreeDictionaryGroups(groupNames);
      return ok({ updatedCount });
    } catch (error) {
      logger.error('清空树形字典分组失败:', error);
      return fail(error);
    }
  },

  [TREE_DICTIONARY_UPDATE_SORT]: async (_event: IpcMainInvokeEvent, updates: { id: string; sort_order: number }[]) => {
    try {
      const db = DatabaseService.getInstance();
      const updatedCount = db.updateTreeDictionarySortOrder(updates);
      return ok({ updatedCount });
    } catch (error) {
      logger.error('更新树形字典排序失败:', error);
      return fail(error);
    }
  },

  [TREE_DICTIONARY_IMPORT_CSV]: async (_event: IpcMainInvokeEvent, filePath: string, groupName: string) => {
    try {
      const win = BrowserWindow.fromWebContents(_event.sender);

      if (!groupName || groupName === '所有分组') {
        throw new Error('请先选择分组再导入');
      }

      win?.webContents.send(TREE_DICTIONARY_IMPORT_PROGRESS, { status: 'reading', current: 0, total: 0, percent: 0 });

      const records = await parseCsv<Record<string, any>>(filePath);
      const total = records.length;

      win?.webContents.send(TREE_DICTIONARY_IMPORT_PROGRESS, { status: 'importing', current: 0, total, percent: 0 });

      const db = DatabaseService.getInstance();
      const root = db.ensureTreeDictionaryRootByGroup(groupName);

      const dtos: TreeDictionaryCreateDTO[] = [];
      for (const row of records) {
        const name = row['名称(类型)'] || row['名称'] || '';
        if (!name) continue;

        const parentIdRaw = String(row['ParentID'] || row['父ID'] || '0').trim();
        const normalizedParentId =
          parentIdRaw === '0' || parentIdRaw === '' ? root.id : parentIdRaw;

        const code = String(row['编码'] || '').trim();
        const trimmedName = String(name).trim();
        if (trimmedName === '默认根目录' && (code === '__ROOT__' || parentIdRaw === '0')) {
          continue;
        }

        dtos.push({
          parent_id: normalizedParentId,
          name: trimmedName,
          code,
          abbreviation: (row['缩写'] || '').trim(),
          bg_color: (row['背景色'] || '').trim(),
          sort_order: parseInt(row['序号'], 10) || 0,
          value: (row['数值'] || '').trim(),
          remark: (row['备注'] || '').trim(),
          group_name: groupName
        });
      }

      // Perform batch import using the service method
      const importedCount = db.importTreeDictionaryCsv(dtos, groupName);

      win?.webContents.send(TREE_DICTIONARY_IMPORT_PROGRESS, {
        status: 'completed',
        current: importedCount,
        total,
        percent: total > 0 ? 100 : 0
      });

      return ok({ importedCount });
    } catch (error) {
      logger.error('导入树形字典 CSV 失败:', error);
      return fail(error);
    }
  },
};
