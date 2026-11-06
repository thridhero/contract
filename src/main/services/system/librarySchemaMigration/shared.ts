import Database from 'better-sqlite3';

export function sanitizeFolderName(value: string): string {
  const normalized = String(value || '')
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '_')
    .replace(/[. ]+$/g, '')
    .trim();
  return normalized ? normalized.slice(0, 60) : 'untitled';
}

export function quoteIdentifier(identifier: string): string {
  return `"${String(identifier || '').replace(/"/g, '""')}"`;
}

export function tableExists(db: Database.Database, tableName: string): boolean {
  const row = db.prepare(`
    SELECT 1
    FROM sqlite_master
    WHERE type = 'table'
      AND name = ?
    LIMIT 1
  `).get(tableName);
  return Boolean(row);
}

export function getTableColumns(db: Database.Database, tableName: string): string[] {
  return (db.prepare(`PRAGMA table_info(${quoteIdentifier(tableName)})`).all() as Array<{ name: string }>)
    .map((column) => column.name);
}

export function ensureColumns(
  db: Database.Database,
  tableName: string,
  columns: Array<{ name: string; ddl: string }>,
): void {
  const tableInfo = db.prepare(`PRAGMA table_info(${quoteIdentifier(tableName)})`).all() as Array<{ name: string }>;
  const hasColumn = (columnName: string): boolean => tableInfo.some(column => column.name === columnName);

  for (const column of columns) {
    if (!hasColumn(column.name)) {
      db.exec(`ALTER TABLE ${quoteIdentifier(tableName)} ADD COLUMN ${quoteIdentifier(column.name)} ${column.ddl}`);
    }
  }
}

export function rebuildTable(
  db: Database.Database,
  options: {
    tableName: string;
    createReplacementTableSql: (tempTableName: string) => string;
    copyColumns: string[];
    reason?: string;
    droppedColumns?: string[];
  },
): { copiedRows: number; droppedColumns: string[] } {
  const { tableName, createReplacementTableSql, copyColumns } = options;
  const existingColumns = getTableColumns(db, tableName);
  const selectedColumns = copyColumns.filter((column) => existingColumns.includes(column));

  if (selectedColumns.length === 0) {
    throw new Error(`重建表 ${tableName} 失败：没有可复制的列`);
  }

  const tempTableName = `${tableName}__tmp_rebuild`;
  const droppedColumns = options.droppedColumns ?? existingColumns.filter((column) => !selectedColumns.includes(column));
  const columnListSql = selectedColumns.map((column) => quoteIdentifier(column)).join(', ');

  db.exec('BEGIN');
  try {
    db.exec(`DROP TABLE IF EXISTS ${quoteIdentifier(tempTableName)}`);
    db.exec(createReplacementTableSql(tempTableName));
    const copyResult = db.prepare(`
      INSERT INTO ${quoteIdentifier(tempTableName)} (${columnListSql})
      SELECT ${columnListSql}
      FROM ${quoteIdentifier(tableName)}
    `).run();
    db.exec(`DROP TABLE ${quoteIdentifier(tableName)}`);
    db.exec(`ALTER TABLE ${quoteIdentifier(tempTableName)} RENAME TO ${quoteIdentifier(tableName)}`);
    db.exec('COMMIT');

    if (tableExists(db, 'schema_rebuild_history')) {
      db.prepare(`
        INSERT INTO schema_rebuild_history (
          table_name,
          reason,
          copied_rows,
          dropped_columns_json,
          detail_json
        )
        VALUES (?, ?, ?, ?, ?)
      `).run(
        tableName,
        options.reason ?? null,
        copyResult.changes,
        JSON.stringify(droppedColumns),
        JSON.stringify({
          keptColumns: selectedColumns,
          tempTableName,
        }),
      );
    }

    return {
      copiedRows: copyResult.changes,
      droppedColumns,
    };
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}
