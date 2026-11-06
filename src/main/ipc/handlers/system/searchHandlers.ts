import * as path from 'path';
import * as channels from '../../channels';
import { FileIndexerService } from '../../../services/file/FileIndexerService';
import { FileSearchService } from '../../../services/file/FileSearchService';
import { openLibraryDb } from '../contract/contract-files/shared';

export const searchHandlers = {
  [channels.SEARCH_FULL_TEXT]: async (_event: Electron.IpcMainInvokeEvent, query: string) => {
    return await FileSearchService.getInstance().searchFullText(query);
  },

  [channels.SEARCH_FULL_TEXT_IN_PATH]: async (
    _event: Electron.IpcMainInvokeEvent,
    payload: { query: string; baseDir: string; libraryPath?: string; recursive?: boolean; ensureIndexed?: boolean; limit?: number; offset?: number; sourceType?: 'contract' | 'other' }
  ) => {
    const p = payload || ({} as any);
    const baseDir = String(p.baseDir || '').trim();
    const libraryPath = String(p.libraryPath || '').trim();
    const ensureIndexed = p.ensureIndexed !== false;
    const sourceType = p.sourceType === 'contract' || p.sourceType === 'other' ? p.sourceType : undefined;
    if (ensureIndexed && baseDir) {
      FileIndexerService.getInstance().ensureIndexDirectory(baseDir, { allowOcr: false });
    }
    const searchResult = await FileSearchService.getInstance().searchFullTextInPath({
      query: String(p.query || ''),
      baseDir,
      recursive: p.recursive,
      limit: p.limit,
      offset: p.offset,
      sourceType,
    });
    let normalizedItems = Array.isArray(searchResult.items) ? searchResult.items : [];
    let normalizedTotal = Number(searchResult.total || 0);
    const pathToMeta = new Map<string, {
      source_type: 'contract' | 'other';
      file_id: string;
      contract_id: string;
      contract_no: string;
      contract_name: string;
      file_name: string;
    }>();
    let metaPrepared = false;

    const dbPath = libraryPath || baseDir;
    if (normalizedItems.length === 0 && dbPath) {
      const db = openLibraryDb(dbPath);
      try {
        const q = String(p.query || '').trim();
        const qUpper = q.toUpperCase();
        const like = `%${qUpper}%`;
        const limit = Number.isFinite(p.limit as any) ? Math.max(1, Number(p.limit)) : 200;
        const offset = Number.isFinite(p.offset as any) ? Math.max(0, Number(p.offset)) : 0;

        if (qUpper) {
          const contractTotalRow = sourceType === 'other'
            ? null
            : (db.prepare(`
              SELECT count(*) as total
              FROM contract_files
              WHERE deleted_at IS NULL
                AND type = 'file'
                AND (name_upper LIKE ? OR upper(path) LIKE ?)
            `).get(like, like) as { total?: number } | undefined);
          const contractTotal = sourceType === 'other' ? 0 : Math.max(0, Number(contractTotalRow?.total ?? 0));

          const otherTotalRow = sourceType === 'contract'
            ? null
            : (db.prepare(`
              SELECT count(*) as total
              FROM other_files
              WHERE deleted_at IS NULL
                AND type = 'file'
                AND (name_upper LIKE ? OR upper(path) LIKE ?)
            `).get(like, like) as { total?: number } | undefined);
          const otherTotal = sourceType === 'contract' ? 0 : Math.max(0, Number(otherTotalRow?.total ?? 0));
          normalizedTotal = contractTotal + otherTotal;

          let rows: Array<{
            file_path: string;
            snippet: string;
            source_type: 'contract' | 'other';
            file_id: string;
            contract_id: string;
            contract_no: string;
            contract_name: string;
            file_name: string;
          }> = [];

          if (normalizedTotal <= 0) {
            let ftsTable: 'file_content_fts_v2' | 'file_content_fts' | '' = 'file_content_fts_v2';
            try {
              db.prepare(`SELECT 1 AS ok FROM file_content_fts_v2 LIMIT 1`).get();
            } catch {
              try {
                db.prepare(`SELECT 1 AS ok FROM file_content_fts LIMIT 1`).get();
                ftsTable = 'file_content_fts';
              } catch {
                ftsTable = '';
              }
            }

            if (ftsTable) {
              const ftsCountRow = db.prepare(`SELECT count(*) as total FROM ${ftsTable} WHERE upper(file_path) LIKE ?`).get(like) as any;
              const ftsTotal = Math.max(0, Number(ftsCountRow?.total ?? 0));
              normalizedTotal = ftsTotal;
              if (ftsTotal > 0) {
                const ftsRows = db.prepare(`
                  SELECT file_path
                  FROM ${ftsTable}
                  WHERE upper(file_path) LIKE ?
                  ORDER BY file_path COLLATE NOCASE ASC
                  LIMIT ? OFFSET ?
                `).all(like, limit, offset) as Array<{ file_path: string }>;
                rows = ftsRows.map((r) => ({
                  file_path: String(r.file_path || '').trim(),
                  snippet: '<b>文件名匹配</b>',
                  source_type: 'other',
                  file_id: '',
                  contract_id: '',
                  contract_no: '',
                  contract_name: '',
                  file_name: path.basename(String(r.file_path || '')),
                }));
              }
            }
          } else {
            const selectSqlParts: string[] = [];
            const selectArgs: unknown[] = [];
            if (sourceType !== 'other') {
              selectSqlParts.push(`
                SELECT
                  cf.path AS file_path,
                  '<b>文件名匹配</b>' AS snippet,
                  'contract' AS source_type,
                  cf.file_id AS file_id,
                  cf.contract_id AS contract_id,
                  ci.contract_code AS contract_no,
                  ci.contract_name AS contract_name,
                  cf.name AS file_name,
                  cf.name_upper AS name_upper
                FROM contract_files cf
                JOIN contract_info ci ON ci.id = cf.contract_id
                WHERE cf.deleted_at IS NULL
                  AND cf.type = 'file'
                  AND (cf.name_upper LIKE ? OR upper(cf.path) LIKE ?)
              `);
              selectArgs.push(like, like);
            }
            if (sourceType !== 'contract') {
              selectSqlParts.push(`
                SELECT
                  of.path AS file_path,
                  '<b>文件名匹配</b>' AS snippet,
                  'other' AS source_type,
                  of.file_id AS file_id,
                  '' AS contract_id,
                  '' AS contract_no,
                  '' AS contract_name,
                  of.name AS file_name,
                  of.name_upper AS name_upper
                FROM other_files of
                WHERE of.deleted_at IS NULL
                  AND of.type = 'file'
                  AND (of.name_upper LIKE ? OR upper(of.path) LIKE ?)
              `);
              selectArgs.push(like, like);
            }
            rows = selectSqlParts.length
              ? db.prepare(`
                SELECT *
                FROM (
                  ${selectSqlParts.join('\nUNION ALL\n')}
                )
                ORDER BY name_upper COLLATE NOCASE ASC
                LIMIT ? OFFSET ?
              `).all(...selectArgs, limit, offset) as any
              : [];
          }

          normalizedItems = rows.map((row) => ({
            file_path: String(row.file_path || '').trim(),
            snippet: String(row.snippet || '').trim(),
          }));

          for (const row of rows) {
            const filePath = String(row.file_path || '').trim();
            if (!filePath || pathToMeta.has(filePath)) continue;
            pathToMeta.set(filePath, {
              source_type: row.source_type,
              file_id: String(row.file_id || ''),
              contract_id: String(row.contract_id || ''),
              contract_no: String(row.contract_no || ''),
              contract_name: String(row.contract_name || ''),
              file_name: String(row.file_name || ''),
            });
          }
          metaPrepared = true;
        }
      } finally {
        db.close();
      }
    }

    if (normalizedItems.length > 0) {
      const uniquePaths = Array.from(new Set(normalizedItems.map((item) => String(item?.file_path || '').trim()).filter(Boolean)));
      if (uniquePaths.length > 0 && dbPath && !metaPrepared) {
        const db = openLibraryDb(dbPath);
        try {
          const placeholders = uniquePaths.map(() => '?').join(', ');
          if (sourceType !== 'other') {
            const rows = db.prepare(`
              SELECT
                cf.path AS file_path,
                cf.file_id AS file_id,
                cf.contract_id AS contract_id,
                ci.contract_code AS contract_no,
                ci.contract_name AS contract_name,
                cf.name AS file_name
              FROM contract_files cf
              JOIN contract_info ci ON ci.id = cf.contract_id
              WHERE cf.deleted_at IS NULL
                AND cf.path IN (${placeholders})
            `).all(...uniquePaths) as Array<{
              file_path: string;
              file_id: string;
              contract_id: string;
              contract_no: string;
              contract_name: string;
              file_name: string;
            }>;

            for (const row of rows) {
              const filePath = String(row.file_path || '').trim();
              if (!filePath || pathToMeta.has(filePath)) {
                continue;
              }
              pathToMeta.set(filePath, {
                source_type: 'contract',
                file_id: String(row.file_id || ''),
                contract_id: String(row.contract_id || ''),
                contract_no: String(row.contract_no || ''),
                contract_name: String(row.contract_name || ''),
                file_name: String(row.file_name || ''),
              });
            }
          }

          const remainingPaths = uniquePaths.filter((filePath) => !pathToMeta.has(filePath));
          if (remainingPaths.length > 0 && sourceType !== 'contract') {
            const otherPlaceholders = remainingPaths.map(() => '?').join(', ');
            const otherRows = db.prepare(`
              SELECT
                path AS file_path,
                file_id AS file_id,
                name AS file_name
              FROM other_files
              WHERE deleted_at IS NULL
                AND type = 'file'
                AND path IN (${otherPlaceholders})
            `).all(...remainingPaths) as Array<{
            file_path: string;
            file_id: string;
            file_name: string;
          }>;
            for (const row of otherRows) {
              const filePath = String(row.file_path || '').trim();
              if (!filePath || pathToMeta.has(filePath)) {
                continue;
              }
              pathToMeta.set(filePath, {
                source_type: 'other',
                file_id: String(row.file_id || ''),
                contract_id: '',
                contract_no: '',
                contract_name: '',
                file_name: String(row.file_name || ''),
              });
            }
          }
        } finally {
          db.close();
        }
      }
    }

    const items = normalizedItems.map((item) => {
      const filePath = String(item?.file_path || '').trim();
      const meta = pathToMeta.get(filePath);
      const normalizedPath = filePath ? path.normalize(filePath) : '';
      const normalizedBaseDir = baseDir ? path.normalize(baseDir) : '';
      const relativePath = normalizedBaseDir && normalizedPath
        ? path.relative(normalizedBaseDir, normalizedPath)
        : '';
      const directoryLabel = relativePath
        ? (path.dirname(relativePath) === '.' ? '根目录' : path.dirname(relativePath))
        : '';
      const sourceType = meta?.source_type || '';
      return {
        ...item,
        source_type: sourceType,
        file_id: meta?.file_id || '',
        contract_id: meta?.contract_id || '',
        contract_no: meta?.contract_no || '',
        contract_name: meta?.contract_name || '',
        file_name: meta?.file_name || (normalizedPath ? path.basename(normalizedPath) : ''),
        relative_path: relativePath,
        directory_label: directoryLabel,
        can_preview: sourceType === 'contract'
          ? Boolean(meta?.contract_id && filePath)
          : sourceType === 'other'
            ? Boolean(meta?.file_id && filePath)
            : false,
      };
    });
    const statusTarget = baseDir || libraryPath;
    const status = statusTarget ? FileIndexerService.getInstance().getIndexStatus(statusTarget) : { indexing: false as const };
    return { ...searchResult, total: normalizedTotal || searchResult.total, items, ...status };
  },
  
  [channels.SEARCH_REINDEX]: async (_event: Electron.IpcMainInvokeEvent, libraryPath: string) => {
    const p = String(libraryPath || '').trim();
    if (p) FileIndexerService.getInstance().ensureIndexDirectory(p, { allowOcr: true, force: true });
    return { success: true };
  },

  [channels.SEARCH_INDEX_STATUS]: async (_event: Electron.IpcMainInvokeEvent, baseDir: string) => {
    return FileIndexerService.getInstance().getIndexStatus(String(baseDir || '').trim());
  },
};
