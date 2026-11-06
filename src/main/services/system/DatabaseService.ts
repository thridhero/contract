import Database from 'better-sqlite3';
import * as path from 'path';
import * as fs from 'fs';
import { DATABASE_FILE } from '../../config/app.config';
import { Setting, SettingInsertParams, SettingUpdateParams } from '../../../shared/types/database.types';
import { Project, ProjectCreateDTO, ProjectUpdateDTO } from '../../../shared/types/project.types';
import {
  ProjectManagementCreateDTO,
  ProjectManagementDeleteByQueryDTO,
  ProjectManagementItem,
  ProjectManagementMoveDTO,
  ProjectManagementQueryDTO,
  ProjectManagementQueryResult,
  ProjectManagementRecodeResult,
  ProjectManagementSortField,
  ProjectManagementSummary,
  ProjectManagementUpdateDTO,
} from '../../../shared/types/projectManagement.types';
import { Document, DocumentInsertDTO } from '../../../shared/types/document.types';
import { WorkflowNode, DEFAULT_WORKFLOW_NODES } from '../../../shared/types/workflow.types';
import { Reminder, ReminderCreateDTO } from '../../../shared/types/reminder.types';
import { Library } from '../../../shared/types/library.types';
import { TagEntity, TagGroupEntity } from '../../../shared/types/tag.types';
import { Supplier, SupplierCreateDTO, SupplierUpdateDTO, SupplierQueryDTO, SupplierQueryResult } from '../../../shared/types/supplier.types';
import { Customer, CustomerCreateDTO, CustomerUpdateDTO, CustomerQueryDTO, CustomerQueryResult } from '../../../shared/types/customer.types';
import { Department, DepartmentCreateDTO, DepartmentUpdateDTO, DepartmentQueryDTO, DepartmentQueryResult } from '../../../shared/types/department.types';
import { Personnel, PersonnelCreateDTO, PersonnelUpdateDTO, PersonnelQueryDTO, PersonnelQueryResult } from '../../../shared/types/personnel.types';
import { ContractProduct, ContractProductCreateDTO, ContractProductUpdateDTO, ContractProductQueryDTO, ContractProductQueryResult } from '../../../shared/types/contractProduct.types';
import { ContractExecution, ContractExecutionCreateDTO, ContractExecutionQueryDTO, ContractExecutionQueryResult, ContractExecutionUpdateDTO } from '../../../shared/types/contractExecution.types';
import { DictionaryItem, DictionaryCreateDTO, DictionaryUpdateDTO, DictionaryQueryDTO, DictionaryQueryResult } from '../../../shared/types/dictionary.types';
import { TreeDictionaryItem, TreeDictionaryCreateDTO, TreeDictionaryUpdateDTO, TreeDictionaryQueryDTO, TreeDictionaryQueryResult } from '../../../shared/types/treeDictionary.types';
import { createLogger } from '../../utils/logger';
import { buildCjkAwareMatchQuery, buildCjkTokensString, isSingleCjkQuery } from '../../utils/ftsCjk';
import * as crypto from 'crypto';
import { migrateSoftwareCopyrightSchema } from './librarySchemaMigration';
import { migrateCustomerSchema, migrateSupplierSchema } from './librarySchemaMigration/relatedSchemas';
import {
  getLibrarySchemaBackupHistory,
  getLibrarySchemaMigrationHistory,
  getLibrarySchemaRebuildHistory,
  getLibrarySchemaVersion,
  LibrarySchemaBackupHistoryEntry,
  LibrarySchemaMigrationHistoryEntry,
  LibrarySchemaMigrationResult,
  LibrarySchemaRebuildHistoryEntry,
  migrateLibrarySchema,
} from './librarySchemaVersioning';
import { createSettingsTagsMethods } from './database/settingsTags';
import type { SettingsTagsMethods } from './database/settingsTags';
import { createProjectsMethods } from './database/projects';
import type { ProjectsMethods } from './database/projects';
import { createDocumentsMethods } from './database/documents';
import type { DocumentsMethods } from './database/documents';
import { createWorkflowMethods } from './database/workflow';
import type { WorkflowMethods } from './database/workflow';
import { createRemindersMethods } from './database/reminders';
import type { RemindersMethods } from './database/reminders';
import { createSuppliersMethods } from './database/suppliers';
import type { SuppliersMethods } from './database/suppliers';
import { createCustomersMethods } from './database/customers';
import type { CustomersMethods } from './database/customers';
import { createDepartmentsMethods } from './database/departments';
import type { DepartmentsMethods } from './database/departments';
import { createPersonnelsMethods } from './database/personnels';
import type { PersonnelsMethods } from './database/personnels';
import { createUnitDocumentsMethods } from './database/unitDocuments';
import type { UnitDocumentsMethods } from './database/unitDocuments';
import { createManagedProjectsMethods } from './database/managedProjects';
import type { ManagedProjectsMethods } from './database/managedProjects';
import { createStatsMethods } from './database/stats';
import type { StatsMethods } from './database/stats';
import { createContractProductsMethods } from './database/contractProducts';
import type { ContractProductsMethods } from './database/contractProducts';
import { createContractExecutionsMethods } from './database/contractExecutions';
import type { ContractExecutionsMethods } from './database/contractExecutions';
import { createContractInvoicesMethods } from './database/contractInvoices';
import type { ContractInvoicesMethods } from './database/contractInvoices';
import { createDictionariesMethods } from './database/dictionaries';
import type { DictionariesMethods } from './database/dictionaries';
import { createTreeDictionariesMethods } from './database/treeDictionaries';
import type { TreeDictionariesMethods } from './database/treeDictionaries';
import { createAiLogMethods } from './database/aiLog';
import type { AiLogMethods } from './database/aiLog';
import { createFileSearchIndexMethods, migrateFtsV2IfNeeded } from './database/fileSearch';
import type { FileSearchIndexMethods } from './database/fileSearch';
import { createVectorStoreMethods } from './database/vectorStore';
import type { VectorStoreMethods } from './database/vectorStore';

const logger = createLogger('DatabaseService');

const SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key TEXT UNIQUE NOT NULL,
    value TEXT,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    short_name TEXT,
    version TEXT DEFAULT 'V1.0',
    folder_path TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'preparing',
    applicant_type TEXT NOT NULL DEFAULT 'individual',
    applicant_name TEXT NOT NULL,
    applicant_cert_no TEXT,
    contact_person TEXT,
    contact_phone TEXT,
    contact_email TEXT,
    developer_name TEXT,
    completion_date DATE NOT NULL,
    software_type TEXT DEFAULT 'application',
    application_no TEXT,
    registration_no TEXT,
    certificate_no TEXT,
    submit_date DATE,
    accept_date DATE,
    approval_date DATE,
    fee_amount DECIMAL(10,2),
    fee_paid_date DATE,
    remark TEXT,
    is_archived BOOLEAN DEFAULT 0,
    deleted_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS managed_projects (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    content TEXT DEFAULT '',
    group_key TEXT,
    group_name TEXT,
    project_date DATE,
    approval_date DATE,
    contract_deadline DATE,
    engineering_location TEXT,
    project_days INTEGER,
    building_area REAL,
    started_building_area REAL,
    counted_area REAL,
    started_counted_area REAL,
    country TEXT,
    province TEXT,
    city TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    deleted_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS documents (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    category TEXT NOT NULL,
    name TEXT NOT NULL,
    file_name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_size INTEGER,
    file_type TEXT,
    version INTEGER DEFAULT 1,
    is_required BOOLEAN DEFAULT 0,
    status TEXT DEFAULT 'active',
    checksum TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS workflow_nodes (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    node_code TEXT NOT NULL,
    node_name TEXT NOT NULL,
    sort_order INTEGER DEFAULT 0,
    status TEXT DEFAULT 'pending',
    deadline_days INTEGER,
    actual_date DATE,
    expected_date DATE,
    completed_at DATETIME,
    remark TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS reminders (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    node_id TEXT,
    title TEXT NOT NULL,
    content TEXT,
    reminder_date DATETIME NOT NULL,
    is_read BOOLEAN DEFAULT 0,
    is_completed BOOLEAN DEFAULT 0,
    priority TEXT DEFAULT 'normal',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS tag_groups (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    sort_order INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS tags (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    initial TEXT NOT NULL,
    initial_letter TEXT NOT NULL DEFAULT '#',
    is_common INTEGER DEFAULT 0,
    group_id TEXT,
    use_count INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (group_id) REFERENCES tag_groups(id) ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS contract_ai_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    file_id TEXT NOT NULL,
    extract_json TEXT,
    status TEXT NOT NULL,
    error_msg TEXT,
    created_time DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS contract_ai_chunks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    file_id TEXT NOT NULL,
    file_path TEXT NOT NULL DEFAULT '',
    chunk_id TEXT NOT NULL,
    chunk_index INTEGER NOT NULL DEFAULT 0,
    title TEXT NOT NULL DEFAULT '',
    section_type TEXT NOT NULL DEFAULT 'unknown',
    importance_score REAL NOT NULL DEFAULT 0,
    is_noise INTEGER NOT NULL DEFAULT 0,
    keywords_json TEXT NOT NULL DEFAULT '[]',
    content TEXT NOT NULL DEFAULT '',
    compact_content TEXT NOT NULL DEFAULT '',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS contract_field_evidence (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    file_id TEXT NOT NULL,
    field_key TEXT NOT NULL,
    field_value TEXT NOT NULL DEFAULT '',
    chunk_id TEXT NOT NULL DEFAULT '',
    chunk_index INTEGER NOT NULL DEFAULT 0,
    evidence_text TEXT NOT NULL DEFAULT '',
    confidence REAL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS contract_vector_chunks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    contract_id TEXT NOT NULL DEFAULT '',
    file_id TEXT NOT NULL DEFAULT '',
    file_path TEXT NOT NULL DEFAULT '',
    chunk_id TEXT NOT NULL DEFAULT '',
    chunk_index INTEGER NOT NULL DEFAULT 0,
    source_text TEXT NOT NULL DEFAULT '',
    compact_text TEXT NOT NULL DEFAULT '',
    keywords_json TEXT NOT NULL DEFAULT '[]',
    embedding_json TEXT NOT NULL DEFAULT '[]',
    embedding_model_id TEXT NOT NULL DEFAULT '',
    content_hash TEXT NOT NULL DEFAULT '',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE VIRTUAL TABLE IF NOT EXISTS file_content_fts USING fts5(
    file_path, 
    content, 
    metadata,
    tokenize='unicode61'
  );

  CREATE VIRTUAL TABLE IF NOT EXISTS file_content_fts_v2 USING fts5(
    file_path,
    content,
    cjk_tokens,
    metadata,
    tokenize='unicode61'
  );

  CREATE TABLE IF NOT EXISTS file_metadata (
    file_path TEXT PRIMARY KEY,
    file_size INTEGER,
    mtime INTEGER,
    indexed_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`;

function ensureColumn(db: Database.Database, tableName: string, columnName: string, ddl: string): void {
  const columns = db.prepare(`PRAGMA table_info(${tableName})`).all() as Array<{ name: string }>;
  const exists = columns.some((column) => column.name === columnName);
  if (exists) return;
  db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${ddl}`);
}

function ensureSoftDeleteColumns(db: Database.Database): void {
  ensureColumn(db, 'projects', 'deleted_at', 'DATETIME');
  ensureColumn(db, 'managed_projects', 'deleted_at', 'DATETIME');
  db.exec('CREATE INDEX IF NOT EXISTS idx_projects_deleted_at ON projects(deleted_at)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_managed_projects_deleted_at ON managed_projects(deleted_at)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_contract_ai_chunks_file_id ON contract_ai_chunks(file_id, chunk_index)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_contract_field_evidence_file_id ON contract_field_evidence(file_id, field_key)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_contract_vector_chunks_file_id ON contract_vector_chunks(file_id, chunk_index)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_contract_vector_chunks_contract_id ON contract_vector_chunks(contract_id)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_contract_vector_chunks_embedding_model_id ON contract_vector_chunks(embedding_model_id)');
}

function ensureTagsInitialLetterColumn(db: Database.Database): void {
  const columns = db.prepare('PRAGMA table_info(tags)').all() as { name: string }[];
  const hasInitialLetter = columns.some(column => column.name === 'initial_letter');
  if (!hasInitialLetter) {
    db.prepare("ALTER TABLE tags ADD COLUMN initial_letter TEXT NOT NULL DEFAULT '#'").run();
  }
  db.prepare(`
    UPDATE tags
    SET initial_letter = CASE
      WHEN initial IS NULL OR initial = '' THEN '#'
      ELSE UPPER(SUBSTR(initial, 1, 1))
    END
    WHERE initial_letter IS NULL
       OR initial_letter = ''
       OR initial_letter = '#'
  `).run();
}

function getLibrarySchemaMigrationSteps(loggerLike: typeof logger): Array<{
  version: number;
  key: string;
  description: string;
  apply: (db: Database.Database) => void;
}> {
  return [
    {
      version: 1,
      key: 'core-base',
      description: '初始化 settings.db 核心表与兼容列',
      apply: (db) => {
        db.exec(SCHEMA_SQL);
        ensureSoftDeleteColumns(db);
        ensureTagsInitialLetterColumn(db);
      },
    },
    {
      version: 2,
      key: 'fts-v2',
      description: '升级全文索引与兼容 FTS v2 查询',
      apply: (db) => {
        try {
          migrateFtsV2IfNeeded(db, loggerLike);
        } catch (e) {
          loggerLike.warn('FTS v2 迁移失败，将回退旧索引。', e);
        }
      },
    },
    {
      version: 3,
      key: 'library-domain',
      description: '迁移资源库业务表、索引、触发器与默认数据',
      apply: (db) => {
        migrateSoftwareCopyrightSchema(db);
      },
    },
    {
      version: 4,
      key: 'customers-add-wechat',
      description: '客户(甲方单位)表新增微信字段',
      apply: (db) => {
        const hasCustomers = db.prepare(`
          SELECT 1
          FROM sqlite_master
          WHERE type = 'table'
            AND name = 'customers'
          LIMIT 1
        `).get();
        if (!hasCustomers) return;
        ensureColumn(db, 'customers', 'wechat', "TEXT DEFAULT ''");
        db.exec('CREATE INDEX IF NOT EXISTS idx_customers_wechat ON customers(wechat)');
      },
    },
    {
      version: 5,
      key: 'party-unit-legal-rep-columns',
      description: '补齐甲方/乙方单位法人信息列',
      apply: (db) => {
        migrateCustomerSchema(db);
        migrateSupplierSchema(db);
      },
    },
    {
      version: 6,
      key: 'contract-vector-chunks',
      description: '新增合同向量检索数据表',
      apply: (db) => {
        db.exec(SCHEMA_SQL);
        ensureSoftDeleteColumns(db);
      },
    },
  ];
}

function bootstrapLatestLibrarySchema(db: Database.Database): void {
  db.exec(SCHEMA_SQL);
  ensureSoftDeleteColumns(db);
  ensureTagsInitialLetterColumn(db);
  migrateSoftwareCopyrightSchema(db);
}

function runLibrarySchemaMigration(db: Database.Database, dbPath: string): LibrarySchemaMigrationResult {
  return migrateLibrarySchema({
    db,
    dbPath,
    logger,
    steps: getLibrarySchemaMigrationSteps(logger),
    bootstrapLatest: bootstrapLatestLibrarySchema,
  });
}

export interface OpenLibraryDatabaseOptions {
  readonly?: boolean;
  enableWal?: boolean;
  busyTimeoutMs?: number;
}

function applyConnectionPragmas(
  db: Database.Database,
  options: { enableWal?: boolean; busyTimeoutMs?: number },
): void {
  db.pragma('foreign_keys = ON');
  if (options.enableWal) {
    db.pragma('journal_mode = WAL');
  }
  if (typeof options.busyTimeoutMs === 'number' && Number.isFinite(options.busyTimeoutMs) && options.busyTimeoutMs > 0) {
    db.pragma(`busy_timeout = ${Math.trunc(options.busyTimeoutMs)}`);
  }
}

export function openLibraryDatabase(
  dbPath: string,
  options: OpenLibraryDatabaseOptions = {},
): { db: Database.Database; migrationResult: LibrarySchemaMigrationResult } {
  const resolvedDbPath = path.resolve(dbPath);

  if (options.readonly) {
    if (!fs.existsSync(resolvedDbPath)) {
      throw new Error('资源库数据库不存在');
    }
    const writableDb = new Database(resolvedDbPath);
    let writableClosed = false;
    try {
      applyConnectionPragmas(writableDb, { busyTimeoutMs: options.busyTimeoutMs });
      const migrationResult = runLibrarySchemaMigration(writableDb, resolvedDbPath);
      writableDb.close();
      writableClosed = true;

      const readonlyDb = new Database(resolvedDbPath, { readonly: true });
      applyConnectionPragmas(readonlyDb, { busyTimeoutMs: options.busyTimeoutMs });
      return {
        db: readonlyDb,
        migrationResult,
      };
    } catch (error) {
      if (!writableClosed) {
        writableDb.close();
      }
      throw error;
    }
  }

  const db = new Database(resolvedDbPath);
  applyConnectionPragmas(db, { busyTimeoutMs: options.busyTimeoutMs });
  const migrationResult = runLibrarySchemaMigration(db, resolvedDbPath);
  if (options.enableWal) {
    db.pragma('journal_mode = WAL');
  }
  return { db, migrationResult };
}

/**
 * 数据库服务（单例）
 *
 * 基于 better-sqlite3（同步 API），所有操作直接读写磁盘文件，无需手动持久化。
 */
export interface DatabaseService extends SettingsTagsMethods, ProjectsMethods, DocumentsMethods, WorkflowMethods, RemindersMethods, SuppliersMethods, CustomersMethods, DepartmentsMethods, PersonnelsMethods, UnitDocumentsMethods, ManagedProjectsMethods, StatsMethods, ContractProductsMethods, ContractExecutionsMethods, ContractInvoicesMethods, DictionariesMethods, TreeDictionariesMethods, AiLogMethods, FileSearchIndexMethods, VectorStoreMethods {}

export class DatabaseService {
  private static instance: DatabaseService;
  private db: Database.Database | null = null;
  private dbPath: string | null = null;

  private constructor() {
    Object.assign(this, createSettingsTagsMethods(() => this.requireDb()));
    Object.assign(this, createProjectsMethods(() => this.requireDb()));
    Object.assign(this, createDocumentsMethods(() => this.requireDb()));
    Object.assign(this, createWorkflowMethods(() => this.requireDb()));
    Object.assign(this, createRemindersMethods(() => this.requireDb()));
    Object.assign(this, createSuppliersMethods(() => this.requireDb()));
    Object.assign(this, createCustomersMethods(() => this.requireDb()));
    Object.assign(this, createDepartmentsMethods(() => this.requireDb()));
    Object.assign(this, createPersonnelsMethods(() => this.requireDb()));
    Object.assign(this, createUnitDocumentsMethods(() => this.requireDb(), (id) => this.getCustomerById(id), (id) => this.getSupplierById(id)));
    Object.assign(this, createManagedProjectsMethods(() => this.requireDb()));
    Object.assign(this, createStatsMethods(() => this.requireDb()));
    Object.assign(this, createContractProductsMethods(() => this.requireDb()));
    Object.assign(this, createContractExecutionsMethods(() => this.requireDb()));
    Object.assign(this, createContractInvoicesMethods(() => this.requireDb()));
    Object.assign(this, createDictionariesMethods(() => this.requireDb()));
    Object.assign(this, createTreeDictionariesMethods(() => this.requireDb()));
    Object.assign(this, createAiLogMethods(() => this.requireDb(), (message, error) => logger.error(message, error)));
    Object.assign(this, createFileSearchIndexMethods(() => this.requireDb(), logger));
    Object.assign(this, createVectorStoreMethods(() => this.requireDb()));
  }

  static getInstance(): DatabaseService {
    if (!DatabaseService.instance) {
      DatabaseService.instance = new DatabaseService();
    }
    return DatabaseService.instance;
  }

  // ─── 初始化 ────────────────────────────────────────────────────

  init(dbPath: string): void {
    if (this.db) {
      try {
        this.db.close();
      } catch (e) {
        logger.warn('关闭旧数据库连接失败:', e);
      }
    }
    this.dbPath = dbPath;
    const { db, migrationResult } = openLibraryDatabase(dbPath, { enableWal: true });
    this.db = db;
    logger.info(`数据库已加载: ${dbPath}`, {
      schemaVersion: migrationResult.toVersion,
      appliedSteps: migrationResult.appliedSteps,
      backupPath: migrationResult.backupPath,
    });
  }

  isReady(): boolean {
    return Boolean(this.db);
  }

  getDbPath(): string | null {
    return this.dbPath;
  }

  close(): void {
    if (!this.db) return;
    try {
      this.db.close();
    } finally {
      this.db = null;
      this.dbPath = null;
    }
  }

  async backupTo(destPath: string): Promise<void> {
    this.assertReady();
    await this.db!.backup(destPath);
  }

  getSchemaVersion(): number {
    this.assertReady();
    return getLibrarySchemaVersion(this.db!);
  }

  getSchemaMigrationHistory(limit = 50): LibrarySchemaMigrationHistoryEntry[] {
    this.assertReady();
    return getLibrarySchemaMigrationHistory(this.db!, limit);
  }

  getSchemaBackupHistory(limit = 20): LibrarySchemaBackupHistoryEntry[] {
    this.assertReady();
    return getLibrarySchemaBackupHistory(this.db!, limit);
  }

  getTableRebuildHistory(limit = 20): LibrarySchemaRebuildHistoryEntry[] {
    this.assertReady();
    return getLibrarySchemaRebuildHistory(this.db!, limit);
  }

  /**
   * 创建新项目并初始化数据库
   * @returns 数据库文件的绝对路径
   */
  createProjectDatabase(basePath: string, projectName: string): { dbPath: string } {
    const projectPath = path.join(basePath, projectName);

    if (!fs.existsSync(projectPath)) {
      fs.mkdirSync(projectPath, { recursive: true });
    }

    const dbPath = path.join(projectPath, DATABASE_FILE);
    if (fs.existsSync(dbPath)) {
      throw new Error('该位置已存在数据库，请选择其他路径或名称');
    }

    this.init(dbPath);
    this.insertSetting({ key: 'project_path', value: projectPath, description: '项目根目录路径' });
    logger.info(`项目数据库已创建: ${dbPath}`);

    return { dbPath };
  }

  // ─── 路径工具 ──────────────────────────────────────────────────

  isValidLibraryPath(libraryPath: string): boolean {
    if (!fs.existsSync(libraryPath)) return false;
    if (!fs.statSync(libraryPath).isDirectory()) return false;
    return fs.existsSync(path.join(libraryPath, DATABASE_FILE));
  }

  getLibraryDbPath(libraryPath: string): string {
    return path.join(libraryPath, DATABASE_FILE);
  }

  readProjectNameFromLibrary(libraryPath: string): string {
    const bootstrapFile = path.join(libraryPath, 'bootstrap.json');
    if (fs.existsSync(bootstrapFile)) {
      try {
        const data = JSON.parse(fs.readFileSync(bootstrapFile, 'utf-8'));
        if (data.projectName) return data.projectName;
      } catch {
        logger.warn('读取资源库 bootstrap.json 失败，使用目录名作为项目名');
      }
    }
    return path.basename(libraryPath);
  }

  // ─── Documents CRUD ────────────────────────────────────────────

  // ─── Reminders CRUD ────────────────────────────────────────────

  // ─── 统计查询 ──────────────────────────────────────────────────

  // ─── Suppliers CRUD ──────────────────────────────────────────────

  // ─── Customers CRUD ──────────────────────────────────────────────

  // ─── Dictionaries CRUD ───────────────────────────────────────────

  // ─── AI 日志记录 ────────────────────────────────────────────────

  // ─── 私有工具 ──────────────────────────────────────────────────

  private requireDb(): Database.Database {
    this.assertReady();
    return this.db!;
  }

  private assertReady(): void {
    if (!this.db) throw new Error('数据库未初始化，请先调用 init()');
  }
}
