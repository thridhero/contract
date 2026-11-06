import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import Database from 'better-sqlite3';
import * as channels from '../../../channels';
import { ok, fail } from '../../../../../shared/types/ipc.types';
import {
  SoftwareCopyrightCreateDTO,
  SoftwareCopyrightCreateResult,
  SoftwareCopyrightProject,
} from '../../../../../shared/types/softwareCopyright.types';
import {
  ContractFormSchemaExportDTO,
  ContractFormSchemaExportResult,
  ContractFormSchemaGetDTO,
  ContractFormSchemaImportDTO,
  ContractFormSchemaSaveDTO,
} from '../../../../../shared/types/contractFormSchema.types';
import {
  getDefaultContractFormSchemaConfig,
  normalizeContractFormSchemaConfig,
} from '../../../../../shared/utils/contractFormSchema';
import {
  LibraryHandlerMap,
  logger,
  openLibraryDb,
  saveContractFormSchemaSetting,
  sanitizeFolderName,
  formatCompactDate,
  getContractFormSchemaSetting,
} from './shared';

export const libraryProjectHandlers: LibraryHandlerMap = {
  [channels.LIBRARY_CREATE_SOFTWARE_PROJECT]: async (_event, dto: unknown) => {
    let db: Database.Database | null = null;
    try {
      const createDto = dto as SoftwareCopyrightCreateDTO;
      const libraryPath = createDto.libraryPath?.trim();
      if (!libraryPath) {
        return fail(new Error('资源库路径不能为空'));
      }
      if (!createDto.softwareName?.trim()) {
        return fail(new Error('软件名称不能为空'));
      }
      if (!createDto.version?.trim()) {
        return fail(new Error('版本号不能为空'));
      }
      if (!createDto.completionDate?.trim()) {
        return fail(new Error('开发完成日期不能为空'));
      }
      if (!createDto.copyrightOwner?.trim()) {
        return fail(new Error('著作权人不能为空'));
      }
      if (!createDto.softwareCategory?.trim()) {
        return fail(new Error('软件分类不能为空'));
      }
      if (!createDto.technicalFeatures?.trim()) {
        return fail(new Error('技术特点简述不能为空'));
      }

      db = openLibraryDb(libraryPath);

      const existed = db.prepare('SELECT id FROM software_copyright WHERE project_name = ? LIMIT 1')
        .get(createDto.softwareName.trim()) as { id?: string } | undefined;
      if (existed && existed.id) {
        return fail(new Error('项目名称已存在'));
      }

      const id = crypto.randomUUID();
      const projectName = createDto.softwareName.trim();
      db.prepare(`
        INSERT INTO software_copyright (
          id, project_name, software_name, version, completion_date, copyright_owner,
          software_category, technical_features, project_icon, project_color
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id,
        projectName,
        createDto.softwareName.trim(),
        createDto.version.trim(),
        createDto.completionDate.trim(),
        createDto.copyrightOwner.trim(),
        createDto.softwareCategory.trim(),
        createDto.technicalFeatures.trim(),
        createDto.projectIcon?.trim() || null,
        createDto.projectColor?.trim() || null,
      );

      const folderName = `${sanitizeFolderName(projectName)}_${formatCompactDate()}_${id}`;
      const projectPath = path.join(path.resolve(libraryPath), folderName);

      try {
        fs.mkdirSync(path.join(projectPath, 'documents'), { recursive: true });
        fs.mkdirSync(path.join(projectPath, 'source_code'), { recursive: true });
        fs.mkdirSync(path.join(projectPath, 'certificates'), { recursive: true });
      } catch (error) {
        db.prepare('DELETE FROM software_copyright WHERE id = ?').run(id);
        throw error;
      }

      const result: SoftwareCopyrightCreateResult = {
        id,
        folderName,
        projectPath,
      };
      return ok(result);
    } catch (error) {
      logger.error('创建软著项目失败:', error);
      return fail(error);
    } finally {
      db?.close();
    }
  },

  [channels.LIBRARY_GET_SOFTWARE_PROJECTS]: async (_event, libraryPath: unknown) => {
    let db: Database.Database | null = null;
    try {
      const value = String(libraryPath || '').trim();
      if (!value) {
        return fail(new Error('资源库路径不能为空'));
      }

      db = openLibraryDb(value);
      const rows = db.prepare(`
        SELECT
          id,
          project_name,
          software_name,
          version,
          completion_date,
          copyright_owner,
          software_category,
          technical_features,
          project_icon,
          project_color,
          created_at,
          updated_at
        FROM software_copyright
        ORDER BY datetime(updated_at) DESC, datetime(created_at) DESC
      `).all() as SoftwareCopyrightProject[];
      return ok(rows);
    } catch (error) {
      logger.error('读取软著项目列表失败:', error);
      return fail(error);
    } finally {
      db?.close();
    }
  },

  [channels.LIBRARY_GET_CONTRACT_FORM_SCHEMA]: async (_event, dto: unknown) => {
    let db: Database.Database | null = null;
    try {
      const query = (dto || {}) as Partial<ContractFormSchemaGetDTO>;
      const libraryPath = String(query.libraryPath || '').trim();
      if (!libraryPath) {
        return fail(new Error('资源库路径不能为空'));
      }

      db = openLibraryDb(libraryPath);
      return ok(getContractFormSchemaSetting(db));
    } catch (error) {
      logger.error('读取合同 schema 配置失败:', error);
      return fail(error);
    } finally {
      db?.close();
    }
  },

  [channels.LIBRARY_SAVE_CONTRACT_FORM_SCHEMA]: async (_event, dto: unknown) => {
    let db: Database.Database | null = null;
    try {
      const payload = (dto || {}) as Partial<ContractFormSchemaSaveDTO>;
      const libraryPath = String(payload.libraryPath || '').trim();
      if (!libraryPath) {
        return fail(new Error('资源库路径不能为空'));
      }

      db = openLibraryDb(libraryPath);
      return ok(saveContractFormSchemaSetting(db, payload.schema || getDefaultContractFormSchemaConfig()));
    } catch (error) {
      logger.error('保存合同 schema 配置失败:', error);
      return fail(error);
    } finally {
      db?.close();
    }
  },

  [channels.LIBRARY_EXPORT_CONTRACT_FORM_SCHEMA]: async (_event, dto: unknown) => {
    let db: Database.Database | null = null;
    try {
      const payload = (dto || {}) as Partial<ContractFormSchemaExportDTO>;
      const libraryPath = String(payload.libraryPath || '').trim();
      const filePath = String(payload.filePath || '').trim();
      if (!libraryPath) {
        return fail(new Error('资源库路径不能为空'));
      }
      if (!filePath) {
        return fail(new Error('导出文件路径不能为空'));
      }

      db = openLibraryDb(libraryPath);
      const schema = normalizeContractFormSchemaConfig(getContractFormSchemaSetting(db));
      const parentDir = path.dirname(filePath);
      if (parentDir && !fs.existsSync(parentDir)) {
        fs.mkdirSync(parentDir, { recursive: true });
      }
      fs.writeFileSync(filePath, `${JSON.stringify(schema, null, 2)}\n`, 'utf8');
      const result: ContractFormSchemaExportResult = { filePath };
      return ok(result);
    } catch (error) {
      logger.error('导出合同 schema 配置失败:', error);
      return fail(error);
    } finally {
      db?.close();
    }
  },

  [channels.LIBRARY_IMPORT_CONTRACT_FORM_SCHEMA]: async (_event, dto: unknown) => {
    let db: Database.Database | null = null;
    try {
      const payload = (dto || {}) as Partial<ContractFormSchemaImportDTO>;
      const libraryPath = String(payload.libraryPath || '').trim();
      const filePath = String(payload.filePath || '').trim();
      if (!libraryPath) {
        return fail(new Error('资源库路径不能为空'));
      }
      if (!filePath) {
        return fail(new Error('导入文件路径不能为空'));
      }
      if (!fs.existsSync(filePath)) {
        return fail(new Error('导入文件不存在'));
      }

      const raw = fs.readFileSync(filePath, 'utf8');
      const parsed = JSON.parse(raw);
      const schema = normalizeContractFormSchemaConfig(parsed);

      db = openLibraryDb(libraryPath);
      return ok(saveContractFormSchemaSetting(db, schema));
    } catch (error) {
      logger.error('导入合同 schema 配置失败:', error);
      return fail(error);
    } finally {
      db?.close();
    }
  },
};
