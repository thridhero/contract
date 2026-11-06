import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import Database from 'better-sqlite3';
import { IpcMainInvokeEvent } from 'electron';
import { pinyin } from 'pinyin-pro';
import { createLogger } from '../../../../utils/logger';
import { BootstrapService } from '../../../../services/system/BootstrapService';
import { openLibraryDatabase } from '../../../../services/system/DatabaseService';
import { DefaultTagSeed } from '../../../../../shared/types/tag.types';
import {
  getBuiltinLibraryInitializationTemplate,
  LibraryInitializationDictionaryRecord,
  LibraryInitializationSettingKey,
  LibraryInitializationTagGroupRecord,
  LibraryInitializationTagRecord,
  LibraryInitializationTemplateData,
  LibraryInitializationTreeDictionaryRecord,
} from './builtinInitializationTemplate';
import {
  ContractFormSchemaConfig,
  ContractFormSchemaGetDTO,
  ContractFormSchemaSaveDTO,
} from '../../../../../shared/types/contractFormSchema.types';
import {
  ContractInfoCreateDTO,
  ContractInfoUpdateDTO,
} from '../../../../../shared/types/contractInfo.types';
import {
  extractContractExtData,
  getDefaultContractFormSchemaConfig,
  parseContractFormSchemaStorageValue,
  resolveContractFormSchema,
  serializeContractExtData,
  serializeContractFormSchema,
  validateContractFormValues,
} from '../../../../../shared/utils/contractFormSchema';

export type LibraryHandler = (event: IpcMainInvokeEvent, ...args: unknown[]) => Promise<unknown>;
export type LibraryHandlerMap = Record<string, LibraryHandler>;

export const logger = createLogger('LibraryHandlers');
export const CONTRACT_FORM_SCHEMA_SETTING_KEY = 'contract_form_schema';
const INITIALIZATION_SETTING_KEYS: LibraryInitializationSettingKey[] = [
  'contract_form_schema',
  'dictionary_groups_tree',
  'tree_dictionary_groups_tree',
];

export interface ResolvedLibraryInitializationTemplate {
  source: 'current' | 'builtin' | 'none';
  data: LibraryInitializationTemplateData | null;
}

interface DefaultProjectStatusSeed {
  name: string;
  initial: string;
  code: string;
  color: string;
  sortOrder: number;
}

export function hasTable(db: Database.Database, tableName: string): boolean {
  try {
    const row = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name = ? LIMIT 1").get(tableName) as { name?: string } | undefined;
    return Boolean(row?.name);
  } catch {
    return false;
  }
}

export function generateInitialLetter(name: string): string {
  const normalizedName = name.trim();
  if (!normalizedName) {
    return '#';
  }

  const firstChar = normalizedName[0];
  if (/[\u4e00-\u9fff]/.test(firstChar)) {
    const py = pinyin(firstChar, { toneType: 'none' });
    const initial = py.charAt(0).toUpperCase();
    if (/[A-Z]/.test(initial)) {
      return initial;
    }
  }

  const fallback = firstChar.toUpperCase();
  if (/[A-Z]/.test(fallback)) {
    return fallback;
  }

  if (/[0-9]/.test(firstChar)) {
    return firstChar;
  }

  return '#';
}

export function ensureTagsInitialLetterColumn(db: Database.Database): void {
  const columns = db.prepare('PRAGMA table_info(tags)').all() as { name: string }[];
  const hasInitialLetter = columns.some(column => column.name === 'initial_letter');
  if (!hasInitialLetter) {
    db.prepare("ALTER TABLE tags ADD COLUMN initial_letter TEXT NOT NULL DEFAULT '#'").run();
    db.prepare("UPDATE tags SET initial_letter = UPPER(SUBSTR(initial, 1, 1)) WHERE initial_letter IS NULL OR initial_letter = ''").run();
  }
}

export function sanitizeFolderName(value: string): string {
  const sanitized = value
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '_')
    .replace(/[. ]+$/g, '')
    .trim();
  return sanitized || 'unnamed_project';
}

export function formatCompactDate(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}${month}${day}`;
}

export function ensureValidFolderName(name: string): string {
  const n = String(name || '').trim();
  if (!n) {
    throw new Error('合同目录名称为空');
  }
  if (n === '.' || n === '..') {
    throw new Error('合同目录名称不合法');
  }
  if (/[\\/]/.test(n)) {
    throw new Error('合同目录名称不合法');
  }
  return n;
}

export function ensurePathWithin(rootPath: string, targetPath: string): void {
  const root = path.resolve(rootPath);
  const requested = path.resolve(targetPath);
  const rel = path.relative(root, requested);
  if (rel.startsWith('..') || path.isAbsolute(rel)) {
    throw new Error('无权限访问该路径');
  }
}

export async function ensureDir(dirPath: string): Promise<void> {
  await fs.promises.mkdir(dirPath, { recursive: true });
}

export async function makeUniquePath(targetPath: string): Promise<string> {
  const base = path.dirname(targetPath);
  const ext = path.extname(targetPath);
  const name = path.basename(targetPath, ext);
  let candidate = targetPath;
  let i = 2;
  while (fs.existsSync(candidate)) {
    candidate = path.join(base, `${name} (${i})${ext}`);
    i += 1;
  }
  return candidate;
}

export function makeUniqueContractFolderName(basePath: string, desiredName: string): string {
  const sanitizedBase = sanitizeFolderName(desiredName);
  let candidate = sanitizedBase;
  let counter = 1;
  
  while (fs.existsSync(path.join(basePath, candidate))) {
    candidate = `${sanitizedBase}_${String(counter).padStart(3, '0')}`;
    counter += 1;
  }
  
  return candidate;
}

export async function moveFolder(srcPath: string, destPath: string): Promise<void> {
  const src = path.resolve(String(srcPath || '').trim());
  const dest = path.resolve(String(destPath || '').trim());
  if (!src) throw new Error('源路径不能为空');
  if (!dest) throw new Error('目标路径不能为空');
  if (!fs.existsSync(src)) throw new Error('源目录不存在');
  await ensureDir(path.dirname(dest));
  try {
    await fs.promises.rename(src, dest);
    return;
  } catch {
    await fs.promises.cp(src, dest, { recursive: true });
    await fs.promises.rm(src, { recursive: true, force: true });
  }
}

export function getContractFormSchemaSetting(db: Database.Database): ContractFormSchemaConfig {
  const row = db.prepare('SELECT value FROM settings WHERE key = ? LIMIT 1')
    .get(CONTRACT_FORM_SCHEMA_SETTING_KEY) as { value?: string | null } | undefined;
  const schemaConfig = row?.value
    ? parseContractFormSchemaStorageValue(row.value)
    : getDefaultContractFormSchemaConfig();

  console.info('读取合同配置表 contract_form_schem', {
    hasStoredValue: Boolean(row?.value),
    rawValue: row?.value || null,
    parsedConfig: schemaConfig,
  });

  return schemaConfig;
}

export function saveContractFormSchemaSetting(db: Database.Database, schema: ContractFormSchemaConfig): ContractFormSchemaConfig {
  const normalizedSchema = parseContractFormSchemaStorageValue(serializeContractFormSchema(schema));
  const serializedSchema = serializeContractFormSchema(normalizedSchema);
  db.prepare(`
    INSERT INTO settings (key, value, description, updated_at)
    VALUES (?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(key) DO UPDATE SET
      value = excluded.value,
      description = excluded.description,
      updated_at = CURRENT_TIMESTAMP
  `).run(
    CONTRACT_FORM_SCHEMA_SETTING_KEY,
    serializedSchema,
    '合同动态表单 schema 配置',
  );
  return normalizedSchema;
}

export function buildContractFormValuesFromDto(dto: ContractInfoCreateDTO | ContractInfoUpdateDTO): Record<string, unknown> {
  return {
    contractName: dto.contractName,
    contractCode: dto.contractCode,
    signingDate: dto.signingDate,
    contractType: dto.contractType,
    groupName: dto.groupName,
    currency: dto.currency,
    clientName: dto.clientName,
    partyAContact: dto.partyAContact,
    partyAContactMobile: dto.partyAContactMobile,
    partyAContactPhone: dto.partyAContactPhone,
    partyAContactEmail: dto.partyAContactEmail,
    partyAContactIdNumber: dto.partyAContactIdNumber,
    partyBName: dto.partyBName,
    partyBContact: dto.partyBContact,
    partyBContactMobile: dto.partyBContactMobile,
    partyBContactPhone: dto.partyBContactPhone,
    partyBContactEmail: dto.partyBContactEmail,
    partyBContactIdNumber: dto.partyBContactIdNumber,
    contractSummary: dto.contractSummary,
    contractAmount: dto.contractAmount,
    contractStatus: dto.contractStatus,
    department: dto.department,
    responsiblePerson: dto.responsiblePerson,
    endDate: dto.endDate,
    settlementMethod: dto.settlementMethod,
    signingForm: dto.signingForm,
    procurementSource: dto.procurementSource,
    executionMethod: dto.executionMethod,
    remark: dto.remark,
    contractTags: dto.contractTags,
    ...(dto.extData || {}),
  };
}

export function resolveLibraryDbPath(libraryPath: string): string {
  const normalizedLibraryPath = String(libraryPath || '').trim();
  if (!normalizedLibraryPath) {
    throw new Error('资源库路径不能为空');
  }
  const dbPath = path.join(path.resolve(normalizedLibraryPath), 'settings.db');
  if (!fs.existsSync(dbPath)) {
    throw new Error('资源库数据库不存在');
  }
  return dbPath;
}

export function openLibraryDb(libraryPath: string): Database.Database {
  return openLibraryDatabase(resolveLibraryDbPath(libraryPath), { enableWal: true }).db;
}

function readLibraryInitializationTemplateFromDb(db: Database.Database): LibraryInitializationTemplateData {
  ensureTagsInitialLetterColumn(db);

  const settings = hasTable(db, 'settings')
    ? (db.prepare(
      `SELECT key, value, COALESCE(description, '') AS description
       FROM settings
       WHERE key IN (${INITIALIZATION_SETTING_KEYS.map(() => '?').join(', ')})
       ORDER BY key ASC`,
    ).all(...INITIALIZATION_SETTING_KEYS) as Array<{
      key: LibraryInitializationSettingKey;
      value?: string | null;
      description?: string | null;
    }>).map((row) => ({
      key: row.key,
      value: String(row.value ?? ''),
      description: String(row.description ?? ''),
    }))
    : [];

  const tagGroups = hasTable(db, 'tag_groups')
    ? (db.prepare(
      'SELECT id, name, sort_order FROM tag_groups ORDER BY sort_order ASC, created_at ASC, id ASC',
    ).all() as LibraryInitializationTagGroupRecord[])
    : [];

  const tags = hasTable(db, 'tags')
    ? (db.prepare(
      `SELECT
         id,
         name,
         initial,
         initial_letter,
         code,
         color,
         is_common,
         group_id,
         use_count,
         sort_order,
         is_system
       FROM tags
       ORDER BY sort_order ASC, created_at ASC, id ASC`,
    ).all() as LibraryInitializationTagRecord[])
    : [];

  const dictionaries = hasTable(db, 'dictionaries')
    ? (db.prepare(
      `SELECT
         id,
         name,
         COALESCE(code, '') AS code,
         COALESCE(abbreviation, '') AS abbreviation,
         COALESCE(bg_color, '') AS bg_color,
         sort_order,
         COALESCE(value, '') AS value,
         COALESCE(remark, '') AS remark,
         COALESCE(group_name, '') AS group_name
       FROM dictionaries
       WHERE deleted_at IS NULL
       ORDER BY group_name ASC, sort_order ASC, created_at ASC, id ASC`,
    ).all() as LibraryInitializationDictionaryRecord[])
    : [];

  const treeDictionaries = hasTable(db, 'tree_dictionaries')
    ? (db.prepare(
      `SELECT
         id,
         COALESCE(parent_id, '0') AS parent_id,
         name,
         COALESCE(code, '') AS code,
         COALESCE(abbreviation, '') AS abbreviation,
         COALESCE(bg_color, '') AS bg_color,
         sort_order,
         COALESCE(value, '') AS value,
         COALESCE(remark, '') AS remark,
         COALESCE(group_name, '') AS group_name
       FROM tree_dictionaries
       WHERE deleted_at IS NULL
       ORDER BY group_name ASC, sort_order ASC, created_at ASC, id ASC`,
    ).all() as LibraryInitializationTreeDictionaryRecord[])
    : [];

  return {
    settings,
    tagGroups,
    tags,
    dictionaries,
    treeDictionaries,
  };
}

function resolveCurrentLibraryInitializationTemplate(): LibraryInitializationTemplateData | null {
  const bootstrapConfig = BootstrapService.getInstance().readConfig();
  const currentLibraryPath = String(bootstrapConfig?.projectPath || '').trim();
  if (!currentLibraryPath) {
    return null;
  }

  let db: Database.Database | null = null;
  try {
    db = openLibraryDb(currentLibraryPath);
    const template = readLibraryInitializationTemplateFromDb(db);
    logger.info(
      `提取当前资源库初始化快照成功: ${currentLibraryPath} ` +
      `(settings=${template.settings.length}, tagGroups=${template.tagGroups.length}, ` +
      `tags=${template.tags.length}, dictionaries=${template.dictionaries.length}, ` +
      `treeDictionaries=${template.treeDictionaries.length})`,
    );
    return template;
  } catch (error) {
    logger.warn(`提取当前资源库初始化快照失败，将尝试回退内置模板: ${error}`);
    return null;
  } finally {
    db?.close();
  }
}

export function resolveLibraryInitializationTemplate(): ResolvedLibraryInitializationTemplate {
  const currentTemplate = resolveCurrentLibraryInitializationTemplate();
  if (currentTemplate) {
    return { source: 'current', data: currentTemplate };
  }

  try {
    const builtinTemplate = getBuiltinLibraryInitializationTemplate();
    logger.info(
      `使用应用内置初始化模板: ` +
      `(settings=${builtinTemplate.settings.length}, tagGroups=${builtinTemplate.tagGroups.length}, ` +
      `tags=${builtinTemplate.tags.length}, dictionaries=${builtinTemplate.dictionaries.length}, ` +
      `treeDictionaries=${builtinTemplate.treeDictionaries.length})`,
    );
    return { source: 'builtin', data: builtinTemplate };
  } catch (error) {
    logger.warn(`读取应用内置初始化模板失败，将保留默认建库逻辑: ${error}`);
    return { source: 'none', data: null };
  }
}

export function applyLibraryInitializationTemplate(
  libraryPath: string,
  template: LibraryInitializationTemplateData,
): void {
  const db = openLibraryDb(libraryPath);
  try {
    ensureTagsInitialLetterColumn(db);

    const upsertSettingStmt = db.prepare(`
      INSERT INTO settings (key, value, description, updated_at)
      VALUES (?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(key) DO UPDATE SET
        value = excluded.value,
        description = excluded.description,
        updated_at = CURRENT_TIMESTAMP
    `);
    const clearTagsStmt = db.prepare('DELETE FROM tags');
    const clearTagGroupsStmt = db.prepare('DELETE FROM tag_groups');
    const clearDictionariesStmt = db.prepare('DELETE FROM dictionaries');
    const clearTreeDictionariesStmt = db.prepare('DELETE FROM tree_dictionaries');
    const insertTagGroupStmt = db.prepare(`
      INSERT INTO tag_groups (id, name, sort_order)
      VALUES (?, ?, ?)
    `);
    const insertTagStmt = db.prepare(`
      INSERT INTO tags (
        id,
        name,
        initial,
        initial_letter,
        code,
        color,
        is_common,
        group_id,
        use_count,
        sort_order,
        is_system
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const insertDictionaryStmt = db.prepare(`
      INSERT INTO dictionaries (
        id,
        name,
        code,
        abbreviation,
        bg_color,
        sort_order,
        value,
        remark,
        group_name
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const insertTreeDictionaryStmt = db.prepare(`
      INSERT INTO tree_dictionaries (
        id,
        parent_id,
        name,
        code,
        abbreviation,
        bg_color,
        sort_order,
        value,
        remark,
        group_name
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    db.transaction(() => {
      for (const setting of template.settings) {
        upsertSettingStmt.run(setting.key, setting.value, setting.description);
      }

      clearTagsStmt.run();
      clearTagGroupsStmt.run();
      clearDictionariesStmt.run();
      clearTreeDictionariesStmt.run();

      for (const group of template.tagGroups) {
        insertTagGroupStmt.run(group.id, group.name, group.sort_order);
      }

      for (const tag of template.tags) {
        insertTagStmt.run(
          tag.id,
          tag.name,
          tag.initial,
          tag.initial_letter,
          tag.code,
          tag.color,
          tag.is_common,
          tag.group_id,
          tag.use_count,
          tag.sort_order,
          tag.is_system,
        );
      }

      for (const dictionary of template.dictionaries) {
        insertDictionaryStmt.run(
          dictionary.id,
          dictionary.name,
          dictionary.code,
          dictionary.abbreviation,
          dictionary.bg_color,
          dictionary.sort_order,
          dictionary.value,
          dictionary.remark,
          dictionary.group_name,
        );
      }

      for (const treeDictionary of template.treeDictionaries) {
        insertTreeDictionaryStmt.run(
          treeDictionary.id,
          treeDictionary.parent_id,
          treeDictionary.name,
          treeDictionary.code,
          treeDictionary.abbreviation,
          treeDictionary.bg_color,
          treeDictionary.sort_order,
          treeDictionary.value,
          treeDictionary.remark,
          treeDictionary.group_name,
        );
      }
    })();
  } finally {
    db.close();
  }
}

export function createLibraryDatabase(libraryPath: string, libraryName: string): void {
  if (!fs.existsSync(libraryPath)) {
    fs.mkdirSync(libraryPath, { recursive: true });
    logger.info(`创建资源库目录: ${libraryPath}`);
  }

  const dbPath = path.join(libraryPath, 'settings.db');
  if (!fs.existsSync(dbPath)) {
    const { db } = openLibraryDatabase(dbPath, { enableWal: true });
    saveContractFormSchemaSetting(db, getDefaultContractFormSchemaConfig());

    logger.info(`创建数据库: ${dbPath}`);

    const defaultSettings = [
      { key: 'library_name', value: libraryName, description: '资源库名称' },
      { key: 'library_path', value: libraryPath, description: '资源库路径' },
      { key: 'library_created_at', value: new Date().toISOString(), description: '创建时间' },
      { key: 'default_view', value: 'grid', description: '默认视图模式' },
      { key: 'theme_mode', value: 'auto', description: '主题模式' },
      {
        key: 'APP_TAGS_DATA',
        value: JSON.stringify({
          tags: [
            { name: '重要', initial: 'Z', initial_letter: 'Z', isCommon: true },
            { name: '紧急', initial: 'J', initial_letter: 'J', isCommon: true },
          ],
          groups: [],
        }),
        description: '系统标签默认设置',
      },
      {
        key: 'APP_PROJECT_STATUS_DATA',
        value: JSON.stringify({
          group: {
            id: 'project_status',
            name: '项目状态',
            sort_order: 0,
          },
          tags: [
            { name: '准备材料', initial: 'P', initial_letter: 'Z', code: 'preparing', color: 'blue', sort_order: 1, is_system: 1, group_id: 'project_status' },
            { name: '已提交', initial: 'S', initial_letter: 'Y', code: 'submitted', color: 'purple', sort_order: 2, is_system: 1, group_id: 'project_status' },
            { name: '已受理', initial: 'A', initial_letter: 'Y', code: 'accepted', color: 'green', sort_order: 3, is_system: 1, group_id: 'project_status' },
            { name: '审查中', initial: 'E', initial_letter: 'S', code: 'examining', color: 'yellow', sort_order: 4, is_system: 1, group_id: 'project_status' },
            { name: '补正中', initial: 'C', initial_letter: 'B', code: 'correction', color: 'orange', sort_order: 5, is_system: 1, group_id: 'project_status' },
            { name: '待缴费', initial: 'F', initial_letter: 'D', code: 'fee_pending', color: 'red', sort_order: 6, is_system: 1, group_id: 'project_status' },
            { name: '已缴费', initial: 'F', initial_letter: 'Y', code: 'fee_paid', color: 'green', sort_order: 7, is_system: 1, group_id: 'project_status' },
            { name: '已下证', initial: 'C', initial_letter: 'Y', code: 'certificated', color: 'purple', sort_order: 8, is_system: 1, group_id: 'project_status' },
            { name: '已完成', initial: 'C', initial_letter: 'Y', code: 'completed', color: 'success', sort_order: 9, is_system: 1, group_id: 'project_status' },
            { name: '被驳回', initial: 'R', initial_letter: 'B', code: 'rejected', color: 'danger', sort_order: 10, is_system: 1, group_id: 'project_status' },
            { name: '已取消', initial: 'C', initial_letter: 'Y', code: 'cancelled', color: 'gray', sort_order: 11, is_system: 1, group_id: 'project_status' },
          ],
        }),
        description: '项目状态默认设置',
      },
    ];

    for (const setting of defaultSettings) {
      try {
        db.prepare(
          'INSERT OR IGNORE INTO settings (key, value, description) VALUES (?, ?, ?)',
        ).run(setting.key, setting.value, setting.description);
      } catch (err) {
        logger.debug(`配置项 ${setting.key} 处理失败: ${err}`);
      }
    }

    const defaultTags: DefaultTagSeed[] = [
      { name: '重要', initial: 'Z', isCommon: 1 },
      { name: '紧急', initial: 'J', isCommon: 1 },
    ];

    for (const tag of defaultTags) {
      try {
        const initialLetter = generateInitialLetter(tag.name);
        db.prepare(
          'INSERT OR IGNORE INTO tags (id, name, initial, initial_letter, code, color, is_common, group_id, use_count, sort_order, is_system) VALUES (?, ?, ?, ?, NULL, NULL, ?, NULL, 0, 0, 0)',
        ).run(crypto.randomUUID(), tag.name, tag.initial, initialLetter, tag.isCommon);
      } catch (err) {
        logger.debug(`默认标签 ${tag.name} 处理失败: ${err}`);
      }
    }

    const projectStatusGroupId = 'project_status';
    try {
      db.prepare(
        'INSERT OR IGNORE INTO tag_groups (id, name, sort_order) VALUES (?, ?, ?)',
      ).run(projectStatusGroupId, '项目状态', 0);
    } catch (err) {
      logger.debug(`项目状态分组初始化失败: ${err}`);
    }

    const defaultProjectStatuses: DefaultProjectStatusSeed[] = [
      { name: '准备材料', initial: 'P', code: 'preparing', color: 'blue', sortOrder: 1 },
      { name: '已提交', initial: 'S', code: 'submitted', color: 'purple', sortOrder: 2 },
      { name: '已受理', initial: 'A', code: 'accepted', color: 'green', sortOrder: 3 },
      { name: '审查中', initial: 'E', code: 'examining', color: 'yellow', sortOrder: 4 },
      { name: '补正中', initial: 'C', code: 'correction', color: 'orange', sortOrder: 5 },
      { name: '待缴费', initial: 'F', code: 'fee_pending', color: 'red', sortOrder: 6 },
      { name: '已缴费', initial: 'F', code: 'fee_paid', color: 'green', sortOrder: 7 },
      { name: '已下证', initial: 'C', code: 'certificated', color: 'purple', sortOrder: 8 },
      { name: '已完成', initial: 'C', code: 'completed', color: 'success', sortOrder: 9 },
      { name: '被驳回', initial: 'R', code: 'rejected', color: 'danger', sortOrder: 10 },
      { name: '已取消', initial: 'C', code: 'cancelled', color: 'gray', sortOrder: 11 },
    ];

    for (const status of defaultProjectStatuses) {
      try {
        const initialLetter = generateInitialLetter(status.name);
        db.prepare(
          'INSERT OR IGNORE INTO tags (id, name, initial, initial_letter, code, color, is_common, group_id, use_count, sort_order, is_system) VALUES (?, ?, ?, ?, ?, ?, 0, ?, 0, ?, 1)',
        ).run(crypto.randomUUID(), status.name, status.initial, initialLetter, status.code, status.color, projectStatusGroupId, status.sortOrder);
      } catch (err) {
        logger.debug(`默认项目状态 ${status.code} 处理失败: ${err}`);
      }
    }

    db.close();
  }
}

export function validateContractFormDto(
  db: Database.Database,
  dto: ContractInfoCreateDTO | ContractInfoUpdateDTO,
): string | null {
  if (dto.skipRequiredValidation) {
    return null;
  }
  const contractSchema = resolveContractFormSchema(getContractFormSchemaSetting(db), dto.contractType);
  const errors = validateContractFormValues(contractSchema, buildContractFormValuesFromDto(dto));
  if (Object.keys(errors).length > 0) {
    return String(Object.values(errors)[0] || '');
  }
  return null;
}

export function serializeContractExtDataFromDto(
  db: Database.Database,
  dto: ContractInfoCreateDTO | ContractInfoUpdateDTO,
): string {
  const contractSchema = resolveContractFormSchema(getContractFormSchemaSetting(db), dto.contractType);
  return serializeContractExtData(
    extractContractExtData(contractSchema, buildContractFormValuesFromDto(dto)),
  );
}
