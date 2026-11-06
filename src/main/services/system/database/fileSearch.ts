import * as fs from 'fs';
import * as path from 'path';
import type Database from 'better-sqlite3';
import { buildCjkAwareMatchQuery, buildCjkTokensString, isSingleCjkQuery } from '../../../utils/ftsCjk';

export type FileSearchIndexMethods = {
  getFileMetadata: (filePath: string) => { file_size: number; mtime: number } | null;
  updateFileIndex: (filePath: string, content: string, stats: fs.Stats, metadata?: Record<string, unknown>) => void;
  searchFullText: (
    query: string,
    options?: { baseDir?: string; recursive?: boolean; limit?: number; sourceType?: 'contract' | 'other' },
  ) => Array<{ file_path: string; snippet: string }>;
  searchFullTextPaged: (
    query: string,
    options?: { baseDir?: string; recursive?: boolean; limit?: number; offset?: number; sourceType?: 'contract' | 'other' },
  ) => { total: number; items: Array<{ file_path: string; snippet: string }> };
};

type FileSearchSourceType = 'contract' | 'other';

function normalizeSourceType(value: unknown): FileSearchSourceType | undefined {
  return value === 'contract' || value === 'other' ? value : undefined;
}

function buildSourceJoinSql(targetTable: string, sourceType?: FileSearchSourceType): string {
  if (sourceType === 'contract') {
    return ` INNER JOIN contract_files fs_source ON fs_source.path = ${targetTable}.file_path AND fs_source.deleted_at IS NULL AND fs_source.type = 'file' `;
  }
  if (sourceType === 'other') {
    return ` INNER JOIN other_files fs_source ON fs_source.path = ${targetTable}.file_path AND fs_source.deleted_at IS NULL AND fs_source.type = 'file' `;
  }
  return '';
}

export function migrateFtsV2IfNeeded(
  db: Database.Database,
  logger: { info: (message: string, ...meta: unknown[]) => void; warn: (message: string, ...meta: unknown[]) => void },
): void {
  if (!hasDbObject(db, 'file_content_fts_v2')) return;
  if (!hasDbObject(db, 'file_content_fts')) return;

  const v2Count = countTableRows(db, 'file_content_fts_v2');
  if (v2Count > 0) return;

  const oldCount = countTableRows(db, 'file_content_fts');
  if (oldCount <= 0) return;

  logger.info(`开始迁移全文索引数据到 v2 (存量: ${oldCount} 条)...`);
  const rows = db.prepare('SELECT file_path, content, metadata FROM file_content_fts').all() as any[];
  if (!rows || rows.length === 0) return;

  const tx = db.transaction((data: any[]) => {
    const insert = db.prepare(
      'INSERT INTO file_content_fts_v2 (file_path, content, cjk_tokens, metadata) VALUES (?, ?, ?, ?)',
    );
    for (const row of data) {
      const filePath = String(row?.file_path || '');
      const content = String(row?.content || '');
      const metadata = row?.metadata ?? null;
      const cjkTokens = buildCjkTokensString(content);
      insert.run(filePath, content, cjkTokens, metadata);
    }
  });

  try {
    tx(rows);
    logger.info('全文索引 v2 迁移完成');
  } catch (e) {
    logger.warn('全文索引 v2 迁移失败:', e);
    throw e;
  }
}

export function createFileSearchIndexMethods(
  getDb: () => Database.Database,
  logger: { error: (message: string, ...meta: unknown[]) => void },
): FileSearchIndexMethods {
  return {
    getFileMetadata: (filePath) => {
      const db = getDb();
      return db.prepare('SELECT file_size, mtime FROM file_metadata WHERE file_path = ?').get(filePath) as any;
    },

    updateFileIndex: (filePath, content, stats, metadata) => {
      const db = getDb();
      const transaction = db.transaction(() => {
        db.prepare(
          'INSERT OR REPLACE INTO file_metadata (file_path, file_size, mtime, indexed_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)',
        ).run(filePath, stats.size, stats.mtime.getTime());

        const metaJson = JSON.stringify({
          size: stats.size,
          mtime: stats.mtime.getTime(),
          ...(metadata || {}),
        });

        if (hasDbObject(db, 'file_content_fts_v2')) {
          const cjkTokens = buildCjkTokensString(content);
          db.prepare('DELETE FROM file_content_fts_v2 WHERE file_path = ?').run(filePath);
          db.prepare(
            'INSERT INTO file_content_fts_v2 (file_path, content, cjk_tokens, metadata) VALUES (?, ?, ?, ?)',
          ).run(filePath, content, cjkTokens, metaJson);
        }

        if (hasDbObject(db, 'file_content_fts')) {
          db.prepare('DELETE FROM file_content_fts WHERE file_path = ?').run(filePath);
          db.prepare(
            'INSERT INTO file_content_fts (file_path, content, metadata) VALUES (?, ?, ?)',
          ).run(filePath, content, metaJson);
        }
      });
      transaction();
    },

    searchFullText: (query, options) => {
      const db = getDb();
      try {
        const q = String(query || '').trim();
        if (!q) return [];

        const baseDirRaw = String(options?.baseDir || '').trim();
        const recursive = options?.recursive !== false;
        const limit = Number.isFinite(options?.limit as any) ? Math.max(1, Number(options?.limit)) : 200;

        const baseDir = path.normalize(baseDirRaw);
        const basePrefix = baseDir.endsWith(path.sep) ? baseDir : (baseDir + path.sep);
        const likePrefix = `${basePrefix}%`;
        const notLikeDeeper = `${basePrefix}%${path.sep}%`;

        const hasV2 = hasDbObject(db, 'file_content_fts_v2');
        const cjkChars = q.replace(/[^\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF]/g, '');
        const hasCjkPhrase = cjkChars.length >= 2;
        const targetTable = hasV2 ? 'file_content_fts_v2' : 'file_content_fts';
        const sourceJoinSql = buildSourceJoinSql(targetTable, normalizeSourceType(options?.sourceType));

        if (isSingleCjkQuery(q)) {
          const ch = q.replace(/\s+/g, '');
          const sql = baseDirRaw
            ? `SELECT ${targetTable}.file_path, ${targetTable}.content FROM ${targetTable}${sourceJoinSql} WHERE ${targetTable}.file_path LIKE ? AND instr(${targetTable}.content, ?) > 0 LIMIT ?`
            : `SELECT ${targetTable}.file_path, ${targetTable}.content FROM ${targetTable}${sourceJoinSql} WHERE instr(${targetTable}.content, ?) > 0 LIMIT ?`;
          const rows = baseDirRaw
            ? (db.prepare(sql).all(likePrefix, ch, limit) as any[])
            : (db.prepare(sql).all(ch, limit) as any[]);
          return rows.map((r) => ({
            file_path: String(r?.file_path || ''),
            snippet: buildManualSnippet(String(r?.content || ''), q),
          }));
        }

        if (!hasCjkPhrase) {
          if (!baseDirRaw) {
            return db.prepare(`
              SELECT ${targetTable}.file_path, snippet(${targetTable}, 1, '<b>', '</b>', '...', 20) as snippet 
              FROM ${targetTable}
              ${sourceJoinSql}
              WHERE ${targetTable} MATCH ?
              ORDER BY rank
              LIMIT ?
            `).all(q, limit) as any;
          }
          if (recursive) {
            return db.prepare(`
              SELECT ${targetTable}.file_path, snippet(${targetTable}, 1, '<b>', '</b>', '...', 20) as snippet 
              FROM ${targetTable}
              ${sourceJoinSql}
              WHERE ${targetTable} MATCH ?
                AND ${targetTable}.file_path LIKE ?
              ORDER BY rank
              LIMIT ?
            `).all(q, likePrefix, limit) as any;
          }
          return db.prepare(`
            SELECT ${targetTable}.file_path, snippet(${targetTable}, 1, '<b>', '</b>', '...', 20) as snippet 
            FROM ${targetTable}
            ${sourceJoinSql}
            WHERE ${targetTable} MATCH ?
              AND ${targetTable}.file_path LIKE ?
              AND ${targetTable}.file_path NOT LIKE ?
            ORDER BY rank
            LIMIT ?
          `).all(q, likePrefix, notLikeDeeper, limit) as any;
        }

        const matchQuery = hasV2 ? buildCjkAwareMatchQuery(q) : q;
        const baseFilterSql = baseDirRaw
          ? (recursive ? ` AND ${targetTable}.file_path LIKE ? ` : ` AND ${targetTable}.file_path LIKE ? AND ${targetTable}.file_path NOT LIKE ? `)
          : '';
        const sql = `
          SELECT ${targetTable}.file_path, ${targetTable}.content
          FROM ${targetTable}
          ${sourceJoinSql}
          WHERE ${targetTable} MATCH ?
          ${baseFilterSql}
          ORDER BY rank
          LIMIT ?
        `;

        const rows = baseDirRaw
          ? (recursive
              ? (db.prepare(sql).all(matchQuery, likePrefix, limit) as any[])
              : (db.prepare(sql).all(matchQuery, likePrefix, notLikeDeeper, limit) as any[]))
          : (db.prepare(sql).all(matchQuery, limit) as any[]);

        return rows.map((r) => ({
          file_path: String(r?.file_path || ''),
          snippet: buildManualSnippet(String(r?.content || ''), q),
        }));
      } catch (error) {
        logger.error('FTS Search Error:', error);
        return [];
      }
    },

    searchFullTextPaged: (query, options) => {
      const db = getDb();
      try {
        const q = String(query || '').trim();
        if (!q) return { total: 0, items: [] };

        const baseDirRaw = String(options?.baseDir || '').trim();
        const recursive = options?.recursive !== false;
        const limit = Number.isFinite(options?.limit as any) ? Math.max(1, Number(options?.limit)) : 200;
        const offset = Number.isFinite(options?.offset as any) ? Math.max(0, Number(options?.offset)) : 0;

        const baseDir = path.normalize(baseDirRaw);
        const basePrefix = baseDir.endsWith(path.sep) ? baseDir : (baseDir + path.sep);
        const likePrefix = `${basePrefix}%`;
        const notLikeDeeper = `${basePrefix}%${path.sep}%`;

        const hasV2 = hasDbObject(db, 'file_content_fts_v2');
        const cjkChars = q.replace(/[^\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF]/g, '');
        const hasCjkPhrase = cjkChars.length >= 2;
        const targetTable = hasV2 ? 'file_content_fts_v2' : 'file_content_fts';
        const sourceJoinSql = buildSourceJoinSql(targetTable, normalizeSourceType(options?.sourceType));

        if (isSingleCjkQuery(q)) {
          const ch = q.replace(/\s+/g, '');
          const countSql = baseDirRaw
            ? `SELECT count(*) as total FROM ${targetTable}${sourceJoinSql} WHERE ${targetTable}.file_path LIKE ? AND instr(${targetTable}.content, ?) > 0`
            : `SELECT count(*) as total FROM ${targetTable}${sourceJoinSql} WHERE instr(${targetTable}.content, ?) > 0`;
          const countRow = baseDirRaw
            ? (db.prepare(countSql).get(likePrefix, ch) as any)
            : (db.prepare(countSql).get(ch) as any);
          const total = Math.max(0, Number(countRow?.total ?? 0));

          const sql = baseDirRaw
            ? `SELECT ${targetTable}.file_path, ${targetTable}.content FROM ${targetTable}${sourceJoinSql} WHERE ${targetTable}.file_path LIKE ? AND instr(${targetTable}.content, ?) > 0 LIMIT ? OFFSET ?`
            : `SELECT ${targetTable}.file_path, ${targetTable}.content FROM ${targetTable}${sourceJoinSql} WHERE instr(${targetTable}.content, ?) > 0 LIMIT ? OFFSET ?`;
          const rows = baseDirRaw
            ? (db.prepare(sql).all(likePrefix, ch, limit, offset) as any[])
            : (db.prepare(sql).all(ch, limit, offset) as any[]);
          const items = rows.map((r) => ({
            file_path: String(r?.file_path || ''),
            snippet: buildManualSnippet(String(r?.content || ''), q),
          }));
          return { total, items };
        }

        if (!hasCjkPhrase) {
          if (!baseDirRaw) {
            const countRow = db.prepare(`SELECT count(*) as total FROM ${targetTable}${sourceJoinSql} WHERE ${targetTable} MATCH ?`).get(q) as any;
            const total = Math.max(0, Number(countRow?.total ?? 0));
            const items = db.prepare(`
              SELECT ${targetTable}.file_path, snippet(${targetTable}, 1, '<b>', '</b>', '...', 20) as snippet 
              FROM ${targetTable}
              ${sourceJoinSql}
              WHERE ${targetTable} MATCH ?
              ORDER BY rank
              LIMIT ? OFFSET ?
            `).all(q, limit, offset) as any;
            return { total, items: items as any[] };
          }
          if (recursive) {
            const countRow = db.prepare(`
              SELECT count(*) as total
              FROM ${targetTable}
              ${sourceJoinSql}
              WHERE ${targetTable} MATCH ?
                AND ${targetTable}.file_path LIKE ?
            `).get(q, likePrefix) as any;
            const total = Math.max(0, Number(countRow?.total ?? 0));
            const items = db.prepare(`
              SELECT ${targetTable}.file_path, snippet(${targetTable}, 1, '<b>', '</b>', '...', 20) as snippet 
              FROM ${targetTable}
              ${sourceJoinSql}
              WHERE ${targetTable} MATCH ?
                AND ${targetTable}.file_path LIKE ?
              ORDER BY rank
              LIMIT ? OFFSET ?
            `).all(q, likePrefix, limit, offset) as any;
            return { total, items: items as any[] };
          }

          const countRow = db.prepare(`
            SELECT count(*) as total
            FROM ${targetTable}
            ${sourceJoinSql}
            WHERE ${targetTable} MATCH ?
              AND ${targetTable}.file_path LIKE ?
              AND ${targetTable}.file_path NOT LIKE ?
          `).get(q, likePrefix, notLikeDeeper) as any;
          const total = Math.max(0, Number(countRow?.total ?? 0));
          const items = db.prepare(`
            SELECT ${targetTable}.file_path, snippet(${targetTable}, 1, '<b>', '</b>', '...', 20) as snippet 
            FROM ${targetTable}
            ${sourceJoinSql}
            WHERE ${targetTable} MATCH ?
              AND ${targetTable}.file_path LIKE ?
              AND ${targetTable}.file_path NOT LIKE ?
            ORDER BY rank
            LIMIT ? OFFSET ?
          `).all(q, likePrefix, notLikeDeeper, limit, offset) as any;
          return { total, items: items as any[] };
        }

        const matchQuery = hasV2 ? buildCjkAwareMatchQuery(q) : q;
        const baseFilterSql = baseDirRaw
          ? (recursive ? ` AND ${targetTable}.file_path LIKE ? ` : ` AND ${targetTable}.file_path LIKE ? AND ${targetTable}.file_path NOT LIKE ? `)
          : '';
        const countSql = `
          SELECT count(*) as total
          FROM ${targetTable}
          ${sourceJoinSql}
          WHERE ${targetTable} MATCH ?
          ${baseFilterSql}
        `;
        const countRow = baseDirRaw
          ? (recursive
              ? (db.prepare(countSql).get(matchQuery, likePrefix) as any)
              : (db.prepare(countSql).get(matchQuery, likePrefix, notLikeDeeper) as any))
          : (db.prepare(countSql).get(matchQuery) as any);
        const total = Math.max(0, Number(countRow?.total ?? 0));

        const sql = `
          SELECT ${targetTable}.file_path, ${targetTable}.content
          FROM ${targetTable}
          ${sourceJoinSql}
          WHERE ${targetTable} MATCH ?
          ${baseFilterSql}
          ORDER BY rank
          LIMIT ? OFFSET ?
        `;
        const rows = baseDirRaw
          ? (recursive
              ? (db.prepare(sql).all(matchQuery, likePrefix, limit, offset) as any[])
              : (db.prepare(sql).all(matchQuery, likePrefix, notLikeDeeper, limit, offset) as any[]))
          : (db.prepare(sql).all(matchQuery, limit, offset) as any[]);

        const items = rows.map((r) => ({
          file_path: String(r?.file_path || ''),
          snippet: buildManualSnippet(String(r?.content || ''), q),
        }));
        return { total, items };
      } catch (error) {
        logger.error('FTS Search Error:', error);
        return { total: 0, items: [] };
      }
    },
  };
}

function hasDbObject(db: Database.Database, name: string): boolean {
  const row = db.prepare('SELECT 1 FROM sqlite_master WHERE name = ? LIMIT 1').get(name) as any;
  return !!row;
}

function countTableRows(db: Database.Database, name: string): number {
  try {
    const row = db.prepare(`SELECT COUNT(1) as c FROM ${name}`).get() as any;
    const v = Number(row?.c ?? 0);
    return Number.isFinite(v) ? v : 0;
  } catch {
    return 0;
  }
}

export function buildManualSnippet(content: string, query: string): string {
  const q = String(query || '').trim();
  if (!q) return '';
  const parts = q.split(/\s+/).map((p) => String(p || '').trim()).filter(Boolean);
  if (parts.length === 0) return '';

  const unique = Array.from(new Set(parts)).filter(Boolean);
  unique.sort((a, b) => b.length - a.length);
  const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(unique.map(escapeRegex).join('|'), 'gi');
  const match = re.exec(content);
  const idx = match ? match.index : -1;

  const windowBefore = 60;
  const windowAfter = 140;
  const start = idx >= 0 ? Math.max(0, idx - windowBefore) : 0;
  const end = idx >= 0 ? Math.min(content.length, idx + windowAfter) : Math.min(content.length, windowBefore + windowAfter);
  let slice = content.slice(start, end);
  if (start > 0) slice = `...${slice}`;
  if (end < content.length) slice = `${slice}...`;
  return slice.replace(re, (m) => `<b>${m}</b>`);
}
