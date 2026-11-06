import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import * as channels from '../../../channels';
import { ConfigService } from '../../../../services/system/ConfigService';
import { ok, fail } from '../../../../../shared/types/ipc.types';
import { Library, LibraryCreateDTO } from '../../../../../shared/types/library.types';
import {
  applyLibraryInitializationTemplate,
  createLibraryDatabase,
  ensureTagsInitialLetterColumn,
  generateInitialLetter,
  LibraryHandlerMap,
  logger,
  openLibraryDb,
  resolveLibraryInitializationTemplate,
  resolveLibraryDbPath,
} from './shared';

export const libraryGeneralHandlers: LibraryHandlerMap = {
  [channels.LIBRARY_CREATE]: async (_event, dto: unknown) => {
    try {
      const createDto = dto as LibraryCreateDTO;
      if (!createDto.name?.trim()) {
        return fail(new Error('资源库名称不能为空'));
      }
      if (!createDto.path?.trim()) {
        return fail(new Error('保存路径不能为空'));
      }

      const libraryName = createDto.name.trim();
      const basePath = path.resolve(createDto.path.trim());
      const libraryPath = path.join(basePath, libraryName);
      const dbPath = path.join(libraryPath, 'settings.db');
      if (fs.existsSync(dbPath)) {
        return fail(new Error('该路径已存在资源库'));
      }

      const configSvc = ConfigService.getInstance();
      const libraries = configSvc.getConfigItem('libraries') || [];
      const existed = libraries.find((l: any) => l.path === libraryPath);
      if (existed) {
        return fail(new Error('该路径已存在资源库记录'));
      }

      if (fs.existsSync(libraryPath) && !fs.statSync(libraryPath).isDirectory()) {
        return fail(new Error('目标资源库路径不是文件夹'));
      }

      createLibraryDatabase(libraryPath, libraryName);
      const initializationTemplate = resolveLibraryInitializationTemplate();
      if (initializationTemplate.data) {
        try {
          applyLibraryInitializationTemplate(libraryPath, initializationTemplate.data);
          logger.info(`资源库初始化模板应用成功: source=${initializationTemplate.source}, path=${libraryPath}`);
        } catch (applyError) {
          logger.warn(`资源库初始化模板应用失败，已回退默认建库数据: ${applyError}`);
        }
      } else {
        logger.info(`未找到可用初始化模板，保留默认建库数据: ${libraryPath}`);
      }

      const library: Library = {
        id: crypto.randomUUID(),
        name: libraryName,
        path: libraryPath,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      libraries.unshift(library);
      configSvc.updateConfigItem('libraries', libraries);

      logger.info(`资源库创建成功: ${libraryName} at ${libraryPath}`);
      return ok(library);
    } catch (error) {
      logger.error('创建资源库失败:', error);
      return fail(error);
    }
  },

  [channels.LIBRARY_GET_ALL]: async () => {
    try {
      const configSvc = ConfigService.getInstance();
      const libraries = configSvc.getConfigItem('libraries') || [];
      return ok(libraries);
    } catch (error) {
      logger.error('获取资源库列表失败:', error);
      return fail(error);
    }
  },

  [channels.LIBRARY_DELETE]: async (_event, id: unknown) => {
    try {
      const configSvc = ConfigService.getInstance();
      const libraries = configSvc.getConfigItem('libraries') || [];
      const updatedLibraries = libraries.filter((l: any) => l.id !== id);
      configSvc.updateConfigItem('libraries', updatedLibraries);

      logger.info(`资源库记录已删除: ${id}`);
      return ok({ success: true });
    } catch (error) {
      logger.error('删除资源库记录失败:', error);
      return fail(error);
    }
  },

  [channels.LIBRARY_GET_TAGS]: async (_event, libraryPath: unknown) => {
    try {
      const db = openLibraryDb(String(libraryPath || ''));
      ensureTagsInitialLetterColumn(db);
      const rows = db.prepare('SELECT id, name, initial, initial_letter, is_common, group_id, use_count, created_at, updated_at FROM tags ORDER BY initial_letter ASC, name COLLATE NOCASE ASC').all();
      db.close();
      return ok(rows);
    } catch (error) {
      logger.error('读取资源库标签失败:', error);
      return fail(error);
    }
  },

  [channels.LIBRARY_GET_TAG_GROUPS]: async (_event, libraryPath: unknown) => {
    try {
      const db = openLibraryDb(String(libraryPath || ''));
      const rows = db.prepare('SELECT id, name, sort_order, created_at, updated_at FROM tag_groups ORDER BY sort_order ASC, created_at ASC').all();
      db.close();
      return ok(rows);
    } catch (error) {
      logger.error('读取资源库标签分组失败:', error);
      return fail(error);
    }
  },

  [channels.LIBRARY_CREATE_TAG_GROUP]: async (_event, libraryPath: unknown, name: unknown) => {
    try {
      resolveLibraryDbPath(String(libraryPath || ''));
      const db = openLibraryDb(String(libraryPath || ''));
      const id = crypto.randomUUID();
      const groupName = String(name).trim();

      db.prepare('INSERT INTO tag_groups (id, name, sort_order) VALUES (?, ?, ?)').run(id, groupName, 0);
      const newGroup = db.prepare('SELECT id, name, sort_order, created_at, updated_at FROM tag_groups WHERE id = ?').get(id);
      db.close();
      return ok(newGroup);
    } catch (error) {
      logger.error('创建资源库标签分组失败:', error);
      return fail(error);
    }
  },

  [channels.LIBRARY_CREATE_TAG]: async (_event, libraryPath: unknown, dto: { name: string; groupId?: string }) => {
    try {
      resolveLibraryDbPath(String(libraryPath || ''));
      const db = openLibraryDb(String(libraryPath || ''));

      const id = crypto.randomUUID();
      const tagName = String(dto.name).trim();
      const initialLetter = generateInitialLetter(tagName);
      const initial = initialLetter;
      const groupId = dto.groupId || null;

      db.prepare(`
        INSERT INTO tags (id, name, initial, initial_letter, is_common, group_id, use_count, sort_order, is_system)
        VALUES (?, ?, ?, ?, 0, ?, 0, 0, 0)
      `).run(id, tagName, initial, initialLetter, groupId);

      const newTag = db.prepare('SELECT id, name, initial, initial_letter, is_common, group_id, use_count, created_at, updated_at FROM tags WHERE id = ?').get(id);
      db.close();
      return ok(newTag);
    } catch (error) {
      logger.error('创建资源库标签失败:', error);
      return fail(error);
    }
  },
};
