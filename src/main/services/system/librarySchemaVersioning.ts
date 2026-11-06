import Database from 'better-sqlite3';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

type LoggerLike = {
  info: (message: string, ...args: unknown[]) => void;
  warn: (message: string, ...args: unknown[]) => void;
  error: (message: string, ...args: unknown[]) => void;
};

export type LibrarySchemaMigrationStep = {
  version: number;
  key: string;
  description: string;
  apply: (db: Database.Database) => void;
};

export type LibrarySchemaMigrationHistoryEntry = {
  id: number;
  batch_id: string;
  migration_key: string;
  from_version: number;
  to_version: number;
  description: string;
  status: string;
  started_at: string;
  finished_at: string | null;
  backup_path: string | null;
  detail_json: string | null;
  error_message: string | null;
};

export type LibrarySchemaBackupHistoryEntry = {
  id: number;
  reason: string;
  backup_path: string;
  from_version: number;
  to_version: number;
  file_size: number;
  created_at: string;
  note: string | null;
};

export type LibrarySchemaRebuildHistoryEntry = {
  id: number;
  table_name: string;
  reason: string | null;
  copied_rows: number;
  dropped_columns_json: string | null;
  detail_json: string | null;
  created_at: string;
};

export type LibrarySchemaMigrationResult = {
  fromVersion: number;
  toVersion: number;
  latestVersion: number;
  appliedSteps: string[];
  backupPath: string | null;
};

type MigrationMetaPatch = {
  schemaVersion?: number;
  lastMigratedAt?: string | null;
  lastSuccessAt?: string | null;
  lastBackupPath?: string | null;
  lastBackupReason?: string | null;
  lastError?: string | null;
};

const MIGRATION_META_TABLE = 'schema_migration_meta';
const MIGRATION_HISTORY_TABLE = 'schema_migration_history';
const MIGRATION_BACKUP_HISTORY_TABLE = 'schema_backup_history';
const MIGRATION_REBUILD_HISTORY_TABLE = 'schema_rebuild_history';

const MIGRATION_META_SQL = `
  CREATE TABLE IF NOT EXISTS schema_migration_meta (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    schema_version INTEGER NOT NULL DEFAULT 0,
    last_migrated_at DATETIME,
    last_success_at DATETIME,
    last_backup_path TEXT,
    last_backup_reason TEXT,
    last_error TEXT
  );

  CREATE TABLE IF NOT EXISTS schema_migration_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    batch_id TEXT NOT NULL,
    migration_key TEXT NOT NULL,
    from_version INTEGER NOT NULL,
    to_version INTEGER NOT NULL,
    description TEXT NOT NULL,
    status TEXT NOT NULL,
    started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    finished_at DATETIME,
    backup_path TEXT,
    detail_json TEXT,
    error_message TEXT
  );

  CREATE TABLE IF NOT EXISTS schema_backup_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    reason TEXT NOT NULL,
    backup_path TEXT NOT NULL,
    from_version INTEGER NOT NULL DEFAULT 0,
    to_version INTEGER NOT NULL DEFAULT 0,
    file_size INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    note TEXT
  );

  CREATE TABLE IF NOT EXISTS schema_rebuild_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    table_name TEXT NOT NULL,
    reason TEXT,
    copied_rows INTEGER NOT NULL DEFAULT 0,
    dropped_columns_json TEXT,
    detail_json TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`;

function formatTimestamp(date = new Date()): string {
  const pad = (value: number): string => String(value).padStart(2, '0');
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
  ].join('') + `-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}

function escapeSqlString(value: string): string {
  return String(value || '').replace(/'/g, "''");
}

function tableExists(db: Database.Database, tableName: string): boolean {
  const row = db
    .prepare(`
      SELECT 1
      FROM sqlite_master
      WHERE type = 'table'
        AND name = ?
      LIMIT 1
    `)
    .get(tableName);
  return Boolean(row);
}

function getPragmaSchemaVersion(db: Database.Database): number {
  const version = db.pragma('user_version', { simple: true });
  return Number.isFinite(version) ? Number(version) : 0;
}

function setPragmaSchemaVersion(db: Database.Database, version: number): void {
  db.pragma(`user_version = ${Math.max(0, Math.trunc(version))}`);
}

function ensureMetaTables(db: Database.Database): void {
  db.exec(MIGRATION_META_SQL);
  db.prepare(`
    INSERT INTO schema_migration_meta (
      id,
      schema_version,
      last_migrated_at,
      last_success_at,
      last_backup_path,
      last_backup_reason,
      last_error
    )
    VALUES (1, 0, NULL, NULL, NULL, NULL, NULL)
    ON CONFLICT(id) DO NOTHING
  `).run();
}

function readMetaSchemaVersion(db: Database.Database): number {
  if (!tableExists(db, MIGRATION_META_TABLE)) return 0;
  const row = db.prepare(`SELECT schema_version FROM ${MIGRATION_META_TABLE} WHERE id = 1`).get() as
    | { schema_version?: number }
    | undefined;
  return Number.isFinite(row?.schema_version) ? Number(row?.schema_version) : 0;
}

function resolveCurrentSchemaVersion(db: Database.Database): number {
  return Math.max(getPragmaSchemaVersion(db), readMetaSchemaVersion(db));
}

function updateMeta(db: Database.Database, patch: MigrationMetaPatch): void {
  ensureMetaTables(db);
  const current = db.prepare(`SELECT * FROM ${MIGRATION_META_TABLE} WHERE id = 1`).get() as Record<string, unknown> | undefined;
  const next = {
    schemaVersion: patch.schemaVersion ?? Number(current?.schema_version ?? 0) ?? 0,
    lastMigratedAt: patch.lastMigratedAt ?? current?.last_migrated_at ?? null,
    lastSuccessAt: patch.lastSuccessAt ?? current?.last_success_at ?? null,
    lastBackupPath: patch.lastBackupPath ?? current?.last_backup_path ?? null,
    lastBackupReason: patch.lastBackupReason ?? current?.last_backup_reason ?? null,
    lastError: patch.lastError ?? current?.last_error ?? null,
  };
  db.prepare(`
    UPDATE ${MIGRATION_META_TABLE}
    SET
      schema_version = ?,
      last_migrated_at = ?,
      last_success_at = ?,
      last_backup_path = ?,
      last_backup_reason = ?,
      last_error = ?
    WHERE id = 1
  `).run(
    next.schemaVersion,
    next.lastMigratedAt,
    next.lastSuccessAt,
    next.lastBackupPath,
    next.lastBackupReason,
    next.lastError,
  );
}

function getUserTableCountForBackup(db: Database.Database): number {
  const row = db.prepare(`
    SELECT COUNT(1) AS count
    FROM sqlite_master
    WHERE type = 'table'
      AND name NOT LIKE 'sqlite_%'
      AND name NOT IN (?, ?, ?, ?)
  `).get(
    MIGRATION_META_TABLE,
    MIGRATION_HISTORY_TABLE,
    MIGRATION_BACKUP_HISTORY_TABLE,
    MIGRATION_REBUILD_HISTORY_TABLE,
  ) as { count?: number } | undefined;
  return Number(row?.count || 0);
}

function createMigrationBackup(
  db: Database.Database,
  dbPath: string,
  fromVersion: number,
  toVersion: number,
  logger: LoggerLike,
): { backupPath: string; fileSize: number; method: 'vacuum-into' | 'file-copy'; note?: string } {
  const backupDir = path.join(path.dirname(dbPath), 'backups', 'migrations');
  fs.mkdirSync(backupDir, { recursive: true });
  const backupPath = path.join(
    backupDir,
    `settings-migration-v${fromVersion}-to-v${toVersion}-${formatTimestamp()}.db`,
  );
  try {
    db.exec(`VACUUM INTO '${escapeSqlString(backupPath)}'`);
    const stat = fs.statSync(backupPath);
    return { backupPath, fileSize: stat.size, method: 'vacuum-into' };
  } catch (error) {
    const vacuumErrorMessage = error instanceof Error ? error.message : String(error || '未知错误');
    try {
      fs.copyFileSync(dbPath, backupPath);
      const stat = fs.statSync(backupPath);
      const note = `vacuum-into 失败，已改用原始文件复制备份：${vacuumErrorMessage}`;
      logger.warn('资源库迁移备份 VACUUM INTO 失败，已改为复制原始数据库文件', {
        dbPath,
        backupPath,
        fromVersion,
        toVersion,
        error: vacuumErrorMessage,
      });
      return { backupPath, fileSize: stat.size, method: 'file-copy', note };
    } catch (copyError) {
      const copyErrorMessage = copyError instanceof Error ? copyError.message : String(copyError || '未知错误');
      throw new Error(
        `创建迁移备份失败：VACUUM INTO 错误=${vacuumErrorMessage}；复制备份错误=${copyErrorMessage}`,
      );
    }
  }
}

function insertBackupHistory(
  db: Database.Database,
  info: {
    backupPath: string;
    fromVersion: number;
    toVersion: number;
    fileSize: number;
    note?: string;
  },
): void {
  db.prepare(`
    INSERT INTO ${MIGRATION_BACKUP_HISTORY_TABLE} (
      reason,
      backup_path,
      from_version,
      to_version,
      file_size,
      note
    )
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    'pre-migration',
    info.backupPath,
    info.fromVersion,
    info.toVersion,
    info.fileSize,
    info.note ?? null,
  );
}

function insertMigrationHistoryStart(
  db: Database.Database,
  step: LibrarySchemaMigrationStep,
  batchId: string,
  fromVersion: number,
  backupPath: string | null,
): number {
  const result = db.prepare(`
    INSERT INTO ${MIGRATION_HISTORY_TABLE} (
      batch_id,
      migration_key,
      from_version,
      to_version,
      description,
      status,
      backup_path
    )
    VALUES (?, ?, ?, ?, ?, 'running', ?)
  `).run(batchId, step.key, fromVersion, step.version, step.description, backupPath);
  return Number(result.lastInsertRowid);
}

function finishMigrationHistory(
  db: Database.Database,
  historyId: number,
  status: 'success' | 'failed',
  detailJson: string | null,
  errorMessage: string | null,
): void {
  db.prepare(`
    UPDATE ${MIGRATION_HISTORY_TABLE}
    SET
      status = ?,
      finished_at = CURRENT_TIMESTAMP,
      detail_json = ?,
      error_message = ?
    WHERE id = ?
  `).run(status, detailJson, errorMessage, historyId);
}

export function migrateLibrarySchema(params: {
  db: Database.Database;
  dbPath: string;
  steps: LibrarySchemaMigrationStep[];
  logger: LoggerLike;
  bootstrapLatest?: (db: Database.Database) => void;
}): LibrarySchemaMigrationResult {
  const { db, dbPath, steps, logger, bootstrapLatest } = params;
  const orderedSteps = [...steps].sort((a, b) => a.version - b.version);
  const latestVersion = orderedSteps.reduce((max, step) => Math.max(max, step.version), 0);
  const fromVersion = resolveCurrentSchemaVersion(db);
  const userTableCount = getUserTableCountForBackup(db);

  if (fromVersion === 0 && userTableCount === 0 && latestVersion > 0 && bootstrapLatest) {
    try {
      bootstrapLatest(db);
      ensureMetaTables(db);
      const now = new Date().toISOString();
      setPragmaSchemaVersion(db, latestVersion);
      updateMeta(db, {
        schemaVersion: latestVersion,
        lastMigratedAt: now,
        lastSuccessAt: now,
        lastBackupPath: null,
        lastBackupReason: null,
        lastError: null,
      });
      return {
        fromVersion,
        toVersion: latestVersion,
        latestVersion,
        appliedSteps: [],
        backupPath: null,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error || '未知错误');
      ensureMetaTables(db);
      updateMeta(db, {
        schemaVersion: 0,
        lastMigratedAt: new Date().toISOString(),
        lastError: message,
      });
      logger.error('资源库数据库初始化最新 schema 失败', {
        dbPath,
        latestVersion,
        error: message,
      });
      throw error;
    }
  }

  let backupPath: string | null = null;
  if (fromVersion < latestVersion && userTableCount > 0) {
    const backup = createMigrationBackup(db, dbPath, fromVersion, latestVersion, logger);
    backupPath = backup.backupPath;
    logger.info('资源库迁移前已创建备份', {
      backupPath: backup.backupPath,
      fromVersion,
      toVersion: latestVersion,
      fileSize: backup.fileSize,
      method: backup.method,
    });
    ensureMetaTables(db);
    insertBackupHistory(db, {
      backupPath: backup.backupPath,
      fromVersion,
      toVersion: latestVersion,
      fileSize: backup.fileSize,
      note: backup.note ?? `settings.db 版本迁移前自动备份（${backup.method}）`,
    });
    updateMeta(db, {
      lastBackupPath: backup.backupPath,
      lastBackupReason: 'pre-migration',
    });
  } else {
    ensureMetaTables(db);
  }

  let currentVersion = resolveCurrentSchemaVersion(db);
  if (currentVersion >= latestVersion) {
    updateMeta(db, {
      schemaVersion: currentVersion,
      lastError: null,
    });
    setPragmaSchemaVersion(db, currentVersion);
    return {
      fromVersion: currentVersion,
      toVersion: currentVersion,
      latestVersion,
      appliedSteps: [],
      backupPath,
    };
  }

  const batchId = crypto.randomUUID();
  const appliedSteps: string[] = [];

  for (const step of orderedSteps) {
    if (step.version <= currentVersion) continue;

    const historyId = insertMigrationHistoryStart(db, step, batchId, currentVersion, backupPath);
    try {
      step.apply(db);
      currentVersion = step.version;
      setPragmaSchemaVersion(db, currentVersion);
      updateMeta(db, {
        schemaVersion: currentVersion,
        lastMigratedAt: new Date().toISOString(),
        lastSuccessAt: new Date().toISOString(),
        lastError: null,
      });
      finishMigrationHistory(
        db,
        historyId,
        'success',
        JSON.stringify({
          migrationKey: step.key,
          toVersion: step.version,
        }),
        null,
      );
      appliedSteps.push(step.key);
      logger.info('资源库数据库迁移完成', {
        migrationKey: step.key,
        version: step.version,
        dbPath,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error || '未知错误');
      updateMeta(db, {
        schemaVersion: currentVersion,
        lastMigratedAt: new Date().toISOString(),
        lastError: message,
      });
      finishMigrationHistory(db, historyId, 'failed', null, message);
      logger.error('资源库数据库迁移失败', {
        migrationKey: step.key,
        version: step.version,
        dbPath,
        error: message,
      });
      throw error;
    }
  }

  updateMeta(db, {
    schemaVersion: currentVersion,
    lastMigratedAt: new Date().toISOString(),
    lastSuccessAt: new Date().toISOString(),
    lastError: null,
  });

  return {
    fromVersion,
    toVersion: currentVersion,
    latestVersion,
    appliedSteps,
    backupPath,
  };
}

export function getLibrarySchemaVersion(db: Database.Database): number {
  ensureMetaTables(db);
  const version = resolveCurrentSchemaVersion(db);
  setPragmaSchemaVersion(db, version);
  updateMeta(db, { schemaVersion: version });
  return version;
}

export function getLibrarySchemaMigrationHistory(
  db: Database.Database,
  limit = 50,
): LibrarySchemaMigrationHistoryEntry[] {
  ensureMetaTables(db);
  const safeLimit = Math.max(1, Math.trunc(limit || 50));
  return db.prepare(`
    SELECT
      id,
      batch_id,
      migration_key,
      from_version,
      to_version,
      description,
      status,
      started_at,
      finished_at,
      backup_path,
      detail_json,
      error_message
    FROM ${MIGRATION_HISTORY_TABLE}
    ORDER BY id DESC
    LIMIT ?
  `).all(safeLimit) as LibrarySchemaMigrationHistoryEntry[];
}

export function getLibrarySchemaBackupHistory(
  db: Database.Database,
  limit = 20,
): LibrarySchemaBackupHistoryEntry[] {
  ensureMetaTables(db);
  const safeLimit = Math.max(1, Math.trunc(limit || 20));
  return db.prepare(`
    SELECT
      id,
      reason,
      backup_path,
      from_version,
      to_version,
      file_size,
      created_at,
      note
    FROM ${MIGRATION_BACKUP_HISTORY_TABLE}
    ORDER BY id DESC
    LIMIT ?
  `).all(safeLimit) as LibrarySchemaBackupHistoryEntry[];
}

export function getLibrarySchemaRebuildHistory(
  db: Database.Database,
  limit = 20,
): LibrarySchemaRebuildHistoryEntry[] {
  ensureMetaTables(db);
  const safeLimit = Math.max(1, Math.trunc(limit || 20));
  return db.prepare(`
    SELECT
      id,
      table_name,
      reason,
      copied_rows,
      dropped_columns_json,
      detail_json,
      created_at
    FROM ${MIGRATION_REBUILD_HISTORY_TABLE}
    ORDER BY id DESC
    LIMIT ?
  `).all(safeLimit) as LibrarySchemaRebuildHistoryEntry[];
}
