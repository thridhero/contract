import Database from 'better-sqlite3';
import { migrateDictionarySchema, migrateTreeDictionarySchema } from './dictionarySchemas';
import {
  migrateContractExecutionSchema,
  migrateContractInvoicesSchema,
  migrateContractProductSchema,
  migrateContractReceiptPaymentSchema,
  migrateCustomerSchema,
  migrateDepartmentSchema,
  migratePersonnelSchema,
  migrateSupplierSchema,
  migrateUnitDocumentSchema,
} from './relatedSchemas';
import { migrateAiWorkbenchSchema } from './aiWorkbenchSchemas';
import { ensureColumns, sanitizeFolderName } from './shared';

const SOFTWARE_COPYRIGHT_SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS software_copyright (
    id TEXT PRIMARY KEY,
    project_name TEXT NOT NULL,
    software_name TEXT NOT NULL,
    version TEXT NOT NULL,
    completion_date DATE NOT NULL,
    copyright_owner TEXT NOT NULL,
    software_category TEXT NOT NULL,
    technical_features TEXT NOT NULL,
    project_icon TEXT,
    project_color TEXT,
    deleted_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`;

const SOFTWARE_COPYRIGHT_UPDATED_AT_TRIGGER_SQL = `
  CREATE TRIGGER IF NOT EXISTS trg_software_copyright_updated_at
  AFTER UPDATE ON software_copyright
  FOR EACH ROW
  WHEN NEW.updated_at <= OLD.updated_at
  BEGIN
    UPDATE software_copyright
    SET updated_at = CURRENT_TIMESTAMP
    WHERE id = OLD.id;
  END
`;

const SOFTWARE_COPYRIGHT_COLUMNS: Array<{ name: string; ddl: string }> = [
  { name: 'id', ddl: 'TEXT' },
  { name: 'project_name', ddl: "TEXT NOT NULL DEFAULT ''" },
  { name: 'software_name', ddl: "TEXT NOT NULL DEFAULT ''" },
  { name: 'version', ddl: "TEXT NOT NULL DEFAULT ''" },
  { name: 'completion_date', ddl: 'DATE' },
  { name: 'copyright_owner', ddl: "TEXT NOT NULL DEFAULT ''" },
  { name: 'software_category', ddl: "TEXT NOT NULL DEFAULT ''" },
  { name: 'technical_features', ddl: "TEXT NOT NULL DEFAULT ''" },
  { name: 'project_icon', ddl: 'TEXT' },
  { name: 'project_color', ddl: 'TEXT' },
  { name: 'deleted_at', ddl: 'DATETIME' },
  { name: 'created_at', ddl: 'DATETIME' },
  { name: 'updated_at', ddl: 'DATETIME' },
];

const CONTRACT_INFO_SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS contract_info (
    id TEXT PRIMARY KEY,
    contract_name TEXT NOT NULL,
    contract_code TEXT NOT NULL,
    signing_date DATE NOT NULL,
    contract_type TEXT NOT NULL,
    group_name TEXT,
    currency TEXT,
    client_name TEXT NOT NULL,
    party_a_contact TEXT,
    party_a_contact_mobile TEXT,
    party_a_contact_phone TEXT,
    party_a_contact_email TEXT,
    party_a_contact_id_number TEXT,
    party_b_name TEXT NOT NULL,
    party_b_contact TEXT,
    party_b_contact_mobile TEXT,
    party_b_contact_phone TEXT,
    party_b_contact_email TEXT,
    party_b_contact_id_number TEXT,
    contract_summary TEXT NOT NULL,
    contract_amount REAL,
    contract_status TEXT,
    department TEXT,
    responsible_person TEXT,
    end_date DATE,
    settlement_method TEXT,
    signing_form TEXT,
    procurement_source TEXT,
    execution_method TEXT,
    remark TEXT,
    contract_tags TEXT,
    ext_data TEXT,
    folder_name TEXT NOT NULL DEFAULT '',
    project_icon TEXT,
    project_color TEXT,
    sort_order INTEGER DEFAULT 0,
    trash_path TEXT NOT NULL DEFAULT '',
    deleted_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`;

const CONTRACT_INFO_UPDATED_AT_TRIGGER_SQL = `
  CREATE TRIGGER IF NOT EXISTS trg_contract_info_updated_at
  AFTER UPDATE ON contract_info
  FOR EACH ROW
  WHEN NEW.updated_at <= OLD.updated_at
  BEGIN
    UPDATE contract_info
    SET updated_at = CURRENT_TIMESTAMP
    WHERE id = OLD.id;
  END
`;

const CONTRACT_INFO_COLUMNS: Array<{ name: string; ddl: string }> = [
  { name: 'id', ddl: 'TEXT' },
  { name: 'contract_name', ddl: "TEXT NOT NULL DEFAULT ''" },
  { name: 'contract_code', ddl: "TEXT NOT NULL DEFAULT ''" },
  { name: 'signing_date', ddl: 'DATE' },
  { name: 'contract_type', ddl: "TEXT NOT NULL DEFAULT ''" },
  { name: 'group_name', ddl: "TEXT DEFAULT ''" },
  { name: 'currency', ddl: "TEXT DEFAULT ''" },
  { name: 'client_name', ddl: "TEXT NOT NULL DEFAULT ''" },
  { name: 'party_a_contact', ddl: "TEXT DEFAULT ''" },
  { name: 'party_a_contact_mobile', ddl: "TEXT DEFAULT ''" },
  { name: 'party_a_contact_phone', ddl: "TEXT DEFAULT ''" },
  { name: 'party_a_contact_email', ddl: "TEXT DEFAULT ''" },
  { name: 'party_a_contact_id_number', ddl: "TEXT DEFAULT ''" },
  { name: 'party_b_name', ddl: "TEXT NOT NULL DEFAULT ''" },
  { name: 'party_b_contact', ddl: "TEXT DEFAULT ''" },
  { name: 'party_b_contact_mobile', ddl: "TEXT DEFAULT ''" },
  { name: 'party_b_contact_phone', ddl: "TEXT DEFAULT ''" },
  { name: 'party_b_contact_email', ddl: "TEXT DEFAULT ''" },
  { name: 'party_b_contact_id_number', ddl: "TEXT DEFAULT ''" },
  { name: 'contract_summary', ddl: "TEXT NOT NULL DEFAULT ''" },
  { name: 'contract_amount', ddl: 'REAL' },
  { name: 'contract_status', ddl: "TEXT DEFAULT ''" },
  { name: 'department', ddl: "TEXT DEFAULT ''" },
  { name: 'responsible_person', ddl: "TEXT DEFAULT ''" },
  { name: 'end_date', ddl: 'DATE' },
  { name: 'settlement_method', ddl: "TEXT DEFAULT ''" },
  { name: 'signing_form', ddl: "TEXT DEFAULT ''" },
  { name: 'procurement_source', ddl: "TEXT DEFAULT ''" },
  { name: 'execution_method', ddl: "TEXT DEFAULT ''" },
  { name: 'remark', ddl: "TEXT DEFAULT ''" },
  { name: 'contract_tags', ddl: "TEXT DEFAULT ''" },
  { name: 'ext_data', ddl: "TEXT DEFAULT ''" },
  { name: 'folder_name', ddl: "TEXT NOT NULL DEFAULT ''" },
  { name: 'project_icon', ddl: 'TEXT' },
  { name: 'project_color', ddl: 'TEXT' },
  { name: 'sort_order', ddl: "INTEGER DEFAULT 0" },
  { name: 'trash_path', ddl: "TEXT NOT NULL DEFAULT ''" },
  { name: 'deleted_at', ddl: 'DATETIME' },
  { name: 'created_at', ddl: 'DATETIME' },
  { name: 'updated_at', ddl: 'DATETIME' },
];

const CONTRACT_FILES_SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS contract_files (
    file_id TEXT PRIMARY KEY,
    contract_id TEXT NOT NULL,
    contract_no TEXT NOT NULL,
    path TEXT NOT NULL,
    original_path TEXT NOT NULL DEFAULT '',
    trash_path TEXT NOT NULL DEFAULT '',
    name TEXT NOT NULL,
    name_upper TEXT NOT NULL,
    type TEXT NOT NULL,
    size INTEGER,
    mtime INTEGER,
    sha256 TEXT,
    first_page_thumb TEXT,
    preview_status TEXT,
    deleted_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`;

const CONTRACT_FILES_UPDATED_AT_TRIGGER_SQL = `
  CREATE TRIGGER IF NOT EXISTS trg_contract_files_updated_at
  AFTER UPDATE ON contract_files
  FOR EACH ROW
  WHEN NEW.updated_at <= OLD.updated_at
  BEGIN
    UPDATE contract_files
    SET updated_at = CURRENT_TIMESTAMP
    WHERE file_id = OLD.file_id;
  END
`;

const OTHER_FILES_SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS other_files (
    file_id TEXT PRIMARY KEY,
    path TEXT NOT NULL,
    original_path TEXT NOT NULL DEFAULT '',
    trash_path TEXT NOT NULL DEFAULT '',
    name TEXT NOT NULL,
    name_upper TEXT NOT NULL,
    type TEXT NOT NULL,
    size INTEGER,
    mtime INTEGER,
    sha256 TEXT,
    first_page_thumb TEXT,
    preview_status TEXT,
    deleted_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`;

const OTHER_FILES_UPDATED_AT_TRIGGER_SQL = `
  CREATE TRIGGER IF NOT EXISTS trg_other_files_updated_at
  AFTER UPDATE ON other_files
  FOR EACH ROW
  WHEN NEW.updated_at <= OLD.updated_at
  BEGIN
    UPDATE other_files
    SET updated_at = CURRENT_TIMESTAMP
    WHERE file_id = OLD.file_id;
  END
`;

const CALENDAR_EVENTS_SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS calendar_events (
    id TEXT PRIMARY KEY,
    source_type TEXT NOT NULL,
    source_id TEXT NOT NULL,
    event_key TEXT NOT NULL,
    event_date TEXT NOT NULL,
    title TEXT NOT NULL,
    content TEXT,
    severity TEXT NOT NULL DEFAULT 'info',
    meta TEXT,
    deleted_at DATETIME, 
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(source_type, source_id, event_key)
  )
`;

const CALENDAR_EVENTS_UPDATED_AT_TRIGGER_SQL = `
  CREATE TRIGGER IF NOT EXISTS trg_calendar_events_updated_at
  AFTER UPDATE ON calendar_events
  FOR EACH ROW
  WHEN NEW.updated_at <= OLD.updated_at
  BEGIN
    UPDATE calendar_events
    SET updated_at = CURRENT_TIMESTAMP
    WHERE id = OLD.id;
  END
`;

const CONTRACT_FILES_COLUMNS: Array<{ name: string; ddl: string }> = [
  { name: 'file_id', ddl: 'TEXT' },
  { name: 'contract_id', ddl: "TEXT NOT NULL DEFAULT ''" },
  { name: 'contract_no', ddl: "TEXT NOT NULL DEFAULT ''" },
  { name: 'path', ddl: "TEXT NOT NULL DEFAULT ''" },
  { name: 'original_path', ddl: "TEXT NOT NULL DEFAULT ''" },
  { name: 'trash_path', ddl: "TEXT NOT NULL DEFAULT ''" },
  { name: 'name', ddl: "TEXT NOT NULL DEFAULT ''" },
  { name: 'name_upper', ddl: "TEXT NOT NULL DEFAULT ''" },
  { name: 'type', ddl: "TEXT NOT NULL DEFAULT 'file'" },
  { name: 'size', ddl: 'INTEGER' },
  { name: 'mtime', ddl: 'INTEGER' },
  { name: 'sha256', ddl: 'TEXT' },
  { name: 'first_page_thumb', ddl: 'TEXT' },
  { name: 'preview_status', ddl: 'TEXT' },
  { name: 'deleted_at', ddl: 'DATETIME' },
  { name: 'created_at', ddl: 'DATETIME' },
  { name: 'updated_at', ddl: 'DATETIME' },
];

const OTHER_FILES_COLUMNS: Array<{ name: string; ddl: string }> = [
  { name: 'file_id', ddl: 'TEXT' },
  { name: 'path', ddl: "TEXT NOT NULL DEFAULT ''" },
  { name: 'original_path', ddl: "TEXT NOT NULL DEFAULT ''" },
  { name: 'trash_path', ddl: "TEXT NOT NULL DEFAULT ''" },
  { name: 'name', ddl: "TEXT NOT NULL DEFAULT ''" },
  { name: 'name_upper', ddl: "TEXT NOT NULL DEFAULT ''" },
  { name: 'type', ddl: "TEXT NOT NULL DEFAULT 'file'" },
  { name: 'size', ddl: 'INTEGER' },
  { name: 'mtime', ddl: 'INTEGER' },
  { name: 'sha256', ddl: 'TEXT' },
  { name: 'first_page_thumb', ddl: 'TEXT' },
  { name: 'preview_status', ddl: 'TEXT' },
  { name: 'deleted_at', ddl: 'DATETIME' },
  { name: 'created_at', ddl: 'DATETIME' },
  { name: 'updated_at', ddl: 'DATETIME' },
];

const CALENDAR_EVENTS_COLUMNS: Array<{ name: string; ddl: string }> = [
  { name: 'id', ddl: 'TEXT' },
  { name: 'source_type', ddl: "TEXT NOT NULL DEFAULT ''" },
  { name: 'source_id', ddl: "TEXT NOT NULL DEFAULT ''" },
  { name: 'event_key', ddl: "TEXT NOT NULL DEFAULT ''" },
  { name: 'event_date', ddl: "TEXT NOT NULL DEFAULT ''" },
  { name: 'title', ddl: "TEXT NOT NULL DEFAULT ''" },
  { name: 'content', ddl: 'TEXT' },
  { name: 'severity', ddl: "TEXT NOT NULL DEFAULT 'info'" },
  { name: 'meta', ddl: 'TEXT' },
  { name: 'deleted_at', ddl: 'DATETIME' },
  { name: 'created_at', ddl: 'DATETIME' },
  { name: 'updated_at', ddl: 'DATETIME' },
];

export function migrateContractInfoSchema(db: Database.Database): void {
  db.exec(CONTRACT_INFO_SCHEMA_SQL);
  ensureColumns(db, 'contract_info', CONTRACT_INFO_COLUMNS);

  const contractInfoColumns = new Set(
    (db.prepare('PRAGMA table_info(contract_info)').all() as Array<{ name: string }>).map((col) => col.name)
  );
  if (contractInfoColumns.has('start_date')) {
    db.exec(`UPDATE contract_info SET start_date = NULL`);
  }
  if (contractInfoColumns.has('delivery_date')) {
    db.exec(`UPDATE contract_info SET delivery_date = NULL`);
  }
  if (contractInfoColumns.has('main_content')) {
    db.exec(`UPDATE contract_info SET main_content = NULL`);
  }
  if (contractInfoColumns.has('payment_direction')) {
    db.exec(`UPDATE contract_info SET payment_direction = NULL`);
  }
  if (contractInfoColumns.has('abnormal_description')) {
    db.exec(`UPDATE contract_info SET abnormal_description = NULL`);
  }

  db.exec(`
    UPDATE contract_info
    SET id = CAST(rowid AS TEXT)
    WHERE id IS NULL OR id = ''
  `);
  db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_contract_info_id ON contract_info(id)');
  db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_contract_info_contract_code ON contract_info(contract_code)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_contract_info_deleted_at ON contract_info(deleted_at)');
  db.exec(`
    UPDATE contract_info
    SET created_at = CURRENT_TIMESTAMP
    WHERE created_at IS NULL OR created_at = ''
  `);
  db.exec(`
    UPDATE contract_info
    SET updated_at = CURRENT_TIMESTAMP
    WHERE updated_at IS NULL OR updated_at = ''
  `);
  db.exec(`
    UPDATE contract_info
    SET sort_order = 0
    WHERE sort_order IS NULL
  `);

  const missingFolderRows = db.prepare(`
    SELECT id, contract_name, created_at, folder_name
    FROM contract_info
    WHERE folder_name IS NULL OR folder_name = ''
  `).all() as Array<{ id: string; contract_name: string; created_at: string | null; folder_name: string | null }>;

  if (missingFolderRows.length > 0) {
    const stmt = db.prepare('UPDATE contract_info SET folder_name = ? WHERE id = ?');
    for (const row of missingFolderRows) {
      const datePart = String(row.created_at || '').slice(0, 10).replace(/-/g, '') || new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const folderName = `${sanitizeFolderName(row.contract_name)}_${datePart}_${row.id}`;
      stmt.run(folderName, row.id);
    }
  }

  const sortStats = db.prepare(`
    SELECT
      COUNT(1) as total,
      SUM(CASE WHEN sort_order IS NOT NULL AND sort_order != 0 THEN 1 ELSE 0 END) as nonZero
    FROM contract_info
  `).get() as { total: number; nonZero: number } | undefined;

  const total = Number(sortStats?.total || 0);
  const nonZero = Number(sortStats?.nonZero || 0);
  if (total > 0 && nonZero === 0) {
    const ids = db.prepare(`
      SELECT id
      FROM contract_info
      ORDER BY datetime(updated_at) DESC, datetime(created_at) DESC
    `).all() as Array<{ id: string }>;

    const tx = db.transaction((orderedIds: Array<{ id: string }>) => {
      const stmt = db.prepare('UPDATE contract_info SET sort_order = ? WHERE id = ?');
      orderedIds.forEach((row, index) => {
        stmt.run(index + 1, row.id);
      });
    });

    tx(ids);
  }

  db.exec(CONTRACT_INFO_UPDATED_AT_TRIGGER_SQL);
}

export function migrateContractFilesSchema(db: Database.Database): void {
  db.exec(CONTRACT_FILES_SCHEMA_SQL);
  ensureColumns(db, 'contract_files', CONTRACT_FILES_COLUMNS);
  db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_contract_files_file_id ON contract_files(file_id)');
  db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_contract_files_contract_no_path ON contract_files(contract_no, path)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_contract_files_contract_id ON contract_files(contract_id)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_contract_files_name_upper ON contract_files(name_upper)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_contract_files_deleted_at ON contract_files(deleted_at)');
  db.exec(CONTRACT_FILES_UPDATED_AT_TRIGGER_SQL);
}

export function migrateOtherFilesSchema(db: Database.Database): void {
  db.exec(OTHER_FILES_SCHEMA_SQL);
  ensureColumns(db, 'other_files', OTHER_FILES_COLUMNS);
  db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_other_files_file_id ON other_files(file_id)');
  db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_other_files_path ON other_files(path)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_other_files_name_upper ON other_files(name_upper)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_other_files_deleted_at ON other_files(deleted_at)');
  db.exec(OTHER_FILES_UPDATED_AT_TRIGGER_SQL);
}

export function migrateCalendarEventsSchema(db: Database.Database): void {
  db.exec(CALENDAR_EVENTS_SCHEMA_SQL);
  ensureColumns(db, 'calendar_events', CALENDAR_EVENTS_COLUMNS);
  db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_calendar_events_id ON calendar_events(id)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_calendar_events_event_date ON calendar_events(event_date)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_calendar_events_deleted_at ON calendar_events(deleted_at)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_calendar_events_source ON calendar_events(source_type, source_id)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_calendar_events_source_date ON calendar_events(source_type, source_id, event_date)');
  db.exec(CALENDAR_EVENTS_UPDATED_AT_TRIGGER_SQL);
}

export function migrateSoftwareCopyrightSchema(db: Database.Database): void {
  db.exec(SOFTWARE_COPYRIGHT_SCHEMA_SQL);
  ensureColumns(db, 'software_copyright', SOFTWARE_COPYRIGHT_COLUMNS);

  db.exec(`
    UPDATE software_copyright
    SET id = CAST(rowid AS TEXT)
    WHERE id IS NULL OR id = ''
  `);
  db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_software_copyright_id ON software_copyright(id)');
  db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_software_copyright_project_name ON software_copyright(project_name)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_software_copyright_deleted_at ON software_copyright(deleted_at)');
  db.exec(`
    UPDATE software_copyright
    SET created_at = CURRENT_TIMESTAMP
    WHERE created_at IS NULL OR created_at = ''
  `);
  db.exec(`
    UPDATE software_copyright
    SET updated_at = CURRENT_TIMESTAMP
    WHERE updated_at IS NULL OR updated_at = ''
  `);
  db.exec(SOFTWARE_COPYRIGHT_UPDATED_AT_TRIGGER_SQL);
  migrateContractInfoSchema(db);
  migrateContractFilesSchema(db);
  migrateOtherFilesSchema(db);
  migrateCalendarEventsSchema(db);
  migrateSupplierSchema(db);
  migrateCustomerSchema(db);
  migrateUnitDocumentSchema(db);
  migrateDepartmentSchema(db);
  migratePersonnelSchema(db);
  migrateContractProductSchema(db);
  migrateContractExecutionSchema(db);
  migrateDictionarySchema(db);
  migrateTreeDictionarySchema(db);
  migrateContractReceiptPaymentSchema(db);
  migrateContractInvoicesSchema(db);
  migrateAiWorkbenchSchema(db);
}
