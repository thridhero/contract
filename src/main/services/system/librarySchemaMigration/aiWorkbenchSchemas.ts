import Database from 'better-sqlite3';
import { ensureColumns } from './shared';

const AI_WORKBENCH_SESSIONS_SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS ai_workbench_sessions (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    library_path TEXT NOT NULL DEFAULT '',
    last_message_preview TEXT NOT NULL DEFAULT '',
    last_summary TEXT NOT NULL DEFAULT '',
    compression_summary TEXT,
    compression_key_entities_json TEXT NOT NULL DEFAULT '[]',
    compression_recent_focus TEXT,
    compression_compressed_at DATETIME,
    deleted_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`;

const AI_WORKBENCH_MESSAGES_SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS ai_workbench_messages (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    role TEXT NOT NULL,
    content TEXT NOT NULL DEFAULT '',
    tool_calls_json TEXT NOT NULL DEFAULT '[]',
    sort_order INTEGER NOT NULL,
    deleted_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES ai_workbench_sessions(id) ON DELETE CASCADE
  )
`;

const AI_WORKBENCH_SESSIONS_UPDATED_AT_TRIGGER_SQL = `
  CREATE TRIGGER IF NOT EXISTS trg_ai_workbench_sessions_updated_at
  AFTER UPDATE ON ai_workbench_sessions
  FOR EACH ROW
  WHEN NEW.updated_at <= OLD.updated_at
  BEGIN
    UPDATE ai_workbench_sessions
    SET updated_at = CURRENT_TIMESTAMP
    WHERE id = OLD.id;
  END
`;

const AI_WORKBENCH_MESSAGES_UPDATED_AT_TRIGGER_SQL = `
  CREATE TRIGGER IF NOT EXISTS trg_ai_workbench_messages_updated_at
  AFTER UPDATE ON ai_workbench_messages
  FOR EACH ROW
  WHEN NEW.updated_at <= OLD.updated_at
  BEGIN
    UPDATE ai_workbench_messages
    SET updated_at = CURRENT_TIMESTAMP
    WHERE id = OLD.id;
  END
`;

const AI_WORKBENCH_SESSIONS_COLUMNS: Array<{ name: string; ddl: string }> = [
  { name: 'id', ddl: 'TEXT' },
  { name: 'title', ddl: "TEXT NOT NULL DEFAULT ''" },
  { name: 'library_path', ddl: "TEXT NOT NULL DEFAULT ''" },
  { name: 'last_message_preview', ddl: "TEXT NOT NULL DEFAULT ''" },
  { name: 'last_summary', ddl: "TEXT NOT NULL DEFAULT ''" },
  { name: 'compression_summary', ddl: 'TEXT' },
  { name: 'compression_key_entities_json', ddl: "TEXT NOT NULL DEFAULT '[]'" },
  { name: 'compression_recent_focus', ddl: 'TEXT' },
  { name: 'compression_compressed_at', ddl: 'DATETIME' },
  { name: 'deleted_at', ddl: 'DATETIME' },
  { name: 'created_at', ddl: 'DATETIME' },
  { name: 'updated_at', ddl: 'DATETIME' },
];

const AI_WORKBENCH_MESSAGES_COLUMNS: Array<{ name: string; ddl: string }> = [
  { name: 'id', ddl: 'TEXT' },
  { name: 'session_id', ddl: "TEXT NOT NULL DEFAULT ''" },
  { name: 'role', ddl: "TEXT NOT NULL DEFAULT 'user'" },
  { name: 'content', ddl: "TEXT NOT NULL DEFAULT ''" },
  { name: 'tool_calls_json', ddl: "TEXT NOT NULL DEFAULT '[]'" },
  { name: 'sort_order', ddl: 'INTEGER NOT NULL DEFAULT 0' },
  { name: 'deleted_at', ddl: 'DATETIME' },
  { name: 'created_at', ddl: 'DATETIME' },
  { name: 'updated_at', ddl: 'DATETIME' },
];

export function migrateAiWorkbenchSchema(db: Database.Database): void {
  db.exec(AI_WORKBENCH_SESSIONS_SCHEMA_SQL);
  db.exec(AI_WORKBENCH_MESSAGES_SCHEMA_SQL);

  ensureColumns(db, 'ai_workbench_sessions', AI_WORKBENCH_SESSIONS_COLUMNS);
  ensureColumns(db, 'ai_workbench_messages', AI_WORKBENCH_MESSAGES_COLUMNS);

  db.exec(`
    UPDATE ai_workbench_sessions
    SET created_at = CURRENT_TIMESTAMP
    WHERE created_at IS NULL OR created_at = ''
  `);
  db.exec(`
    UPDATE ai_workbench_sessions
    SET updated_at = CURRENT_TIMESTAMP
    WHERE updated_at IS NULL OR updated_at = ''
  `);
  db.exec(`
    UPDATE ai_workbench_messages
    SET created_at = CURRENT_TIMESTAMP
    WHERE created_at IS NULL OR created_at = ''
  `);
  db.exec(`
    UPDATE ai_workbench_messages
    SET updated_at = CURRENT_TIMESTAMP
    WHERE updated_at IS NULL OR updated_at = ''
  `);

  db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_ai_workbench_sessions_id ON ai_workbench_sessions(id)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_ai_workbench_sessions_deleted_at ON ai_workbench_sessions(deleted_at)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_ai_workbench_sessions_updated_at ON ai_workbench_sessions(updated_at)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_ai_workbench_sessions_library_updated ON ai_workbench_sessions(library_path, deleted_at, updated_at DESC)');

  db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_ai_workbench_messages_id ON ai_workbench_messages(id)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_ai_workbench_messages_deleted_at ON ai_workbench_messages(deleted_at)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_ai_workbench_messages_session_created ON ai_workbench_messages(session_id, deleted_at, sort_order ASC, created_at ASC)');

  db.exec(AI_WORKBENCH_SESSIONS_UPDATED_AT_TRIGGER_SQL);
  db.exec(AI_WORKBENCH_MESSAGES_UPDATED_AT_TRIGGER_SQL);
}
