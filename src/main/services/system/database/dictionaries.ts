import * as crypto from 'crypto';
import type Database from 'better-sqlite3';
import type { DictionaryCreateDTO, DictionaryItem, DictionaryQueryDTO, DictionaryQueryResult, DictionaryUpdateDTO } from '../../../../shared/types/dictionary.types';

export type DictionariesMethods = {
  createDictionary: (dto: DictionaryCreateDTO) => DictionaryItem;
  updateDictionary: (dto: DictionaryUpdateDTO) => DictionaryItem;
  deleteDictionary: (id: string) => void;
  restoreDictionary: (id: string) => void;
  purgeDictionary: (id: string) => void;
  getDictionaryById: (id: string) => DictionaryItem;
  getDictionaries: (query: DictionaryQueryDTO) => DictionaryQueryResult;
  renameDictionaryGroup: (oldName: string, newName: string) => number;
  clearDictionaryGroups: (groupNames: string[]) => number;
  countDictionariesInGroups: (groupNames: string[]) => number;
  moveDictionariesToGroup: (ids: string[], groupName: string) => number;
  moveDictionaryToTop: (id: string) => number;
  moveDictionaryToBottom: (id: string) => number;
};

export function createDictionariesMethods(getDb: () => Database.Database): DictionariesMethods {
  const getNextGroupCode = (groupName: string): string => {
    const db = getDb();
    const rows = db.prepare(
      'SELECT code, value FROM dictionaries WHERE deleted_at IS NULL AND group_name = ?',
    ).all(groupName) as Array<{ code?: string | null; value?: string | null }>;

    let maxCode = 0;
    for (const row of rows) {
      const candidates = [String(row.code ?? '').trim(), String(row.value ?? '').trim()];
      for (const candidate of candidates) {
        if (!/^\d{4}$/.test(candidate)) continue;
        const num = Number(candidate);
        if (Number.isFinite(num) && num > maxCode) maxCode = num;
      }
    }
    return String(maxCode + 1).padStart(4, '0');
  };

  const getDictionaryByIdUnsafe = (id: string): DictionaryItem | null => {
    const db = getDb();
    return (db.prepare('SELECT * FROM dictionaries WHERE id = ?').get(id) as DictionaryItem) || null;
  };

  const getDictionaryById = (id: string): DictionaryItem => {
    const db = getDb();
    return (db.prepare('SELECT * FROM dictionaries WHERE id = ? AND deleted_at IS NULL').get(id) as DictionaryItem) || null;
  };

  return {
    createDictionary: (dto) => {
      const db = getDb();
      const id = crypto.randomUUID();
      const normalizedGroupName = String(dto.group_name || '').trim();
      const inputCode = String(dto.code || '').trim();
      const inputValue = String(dto.value || '').trim();
      const autoCode = getNextGroupCode(normalizedGroupName);
      const finalCode = inputCode || autoCode;
      const finalValue = inputValue || finalCode;

      const sortOrder = Number.isFinite(Number(dto.sort_order))
        ? Number(dto.sort_order)
        : ((db.prepare(
            'SELECT COALESCE(MAX(sort_order), 0) as maxSortOrder FROM dictionaries WHERE deleted_at IS NULL AND group_name = ?',
          ).get(normalizedGroupName) as { maxSortOrder: number })?.maxSortOrder || 0) + 1;

      db.prepare(`
      INSERT INTO dictionaries (
        id, name, code, abbreviation, bg_color, sort_order, value, remark, group_name
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
        id,
        dto.name,
        finalCode,
        dto.abbreviation || '',
        dto.bg_color || '',
        sortOrder,
        finalValue,
        dto.remark || '',
        normalizedGroupName,
      );
      return getDictionaryById(id);
    },

    updateDictionary: (dto) => {
      const db = getDb();
      const fields: string[] = [];
      const values: unknown[] = [];

      const addField = (col: string, val: unknown) => {
        if (val !== undefined) { fields.push(`${col} = ?`); values.push(val); }
      };

      addField('name', dto.name);
      addField('code', dto.code);
      addField('abbreviation', dto.abbreviation);
      addField('bg_color', dto.bg_color);
      addField('sort_order', dto.sort_order);
      addField('value', dto.value);
      addField('remark', dto.remark);
      addField('group_name', dto.group_name);

      if (fields.length === 0) return getDictionaryById(dto.id);

      fields.push('updated_at = CURRENT_TIMESTAMP');
      values.push(dto.id);

      db.prepare(`UPDATE dictionaries SET ${fields.join(', ')} WHERE id = ?`).run(...values);
      return getDictionaryById(dto.id);
    },

    deleteDictionary: (id) => {
      const db = getDb();
      db.prepare('UPDATE dictionaries SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?').run(id);
    },

    restoreDictionary: (id) => {
      const db = getDb();
      db.prepare('UPDATE dictionaries SET deleted_at = NULL WHERE id = ?').run(id);
    },

    purgeDictionary: (id) => {
      const db = getDb();
      db.prepare('DELETE FROM dictionaries WHERE id = ?').run(id);
    },

    getDictionaryById,

    getDictionaries: (query) => {
      const db = getDb();
      let sql = 'SELECT * FROM dictionaries WHERE deleted_at IS NULL';
      let countSql = 'SELECT COUNT(*) as total FROM dictionaries WHERE deleted_at IS NULL';
      const params: unknown[] = [];

      if (query.group_name && query.group_name !== '所有分组') {
        sql += ' AND group_name = ?';
        countSql += ' AND group_name = ?';
        params.push(query.group_name);
      }

      if (query.search && query.searchFields && query.searchFields.length > 0) {
        const searchTerms = query.searchFields.map((field: string) => `${field} LIKE ?`).join(' OR ');
        sql += ` AND (${searchTerms})`;
        countSql += ` AND (${searchTerms})`;
        const searchPattern = `%${query.search}%`;
        for (let i = 0; i < query.searchFields.length; i++) {
          params.push(searchPattern);
        }
      }

      sql += ' ORDER BY sort_order ASC, created_at DESC';

      const totalRow = db.prepare(countSql).get(...params) as { total: number };
      const total = totalRow.total;

      if (query.page !== undefined && query.pageSize !== undefined) {
        const offset = (query.page - 1) * query.pageSize;
        sql += ' LIMIT ? OFFSET ?';
        params.push(query.pageSize, offset);
      }

      const data = db.prepare(sql).all(...params) as DictionaryItem[];
      return { data, total };
    },

    renameDictionaryGroup: (oldName, newName) => {
      const db = getDb();
      if (!oldName || !newName) return 0;
      const info = db.prepare(
        'UPDATE dictionaries SET group_name = ?, updated_at = CURRENT_TIMESTAMP WHERE group_name = ?',
      ).run(newName, oldName);
      return Number(info.changes || 0);
    },

    clearDictionaryGroups: (groupNames) => {
      const db = getDb();
      const names = (groupNames || []).map(String).filter((n) => n && n !== '所有分组');
      if (names.length === 0) return 0;

      const placeholders = names.map(() => '?').join(', ');
      const info = db.prepare(
        `UPDATE dictionaries SET group_name = '', updated_at = CURRENT_TIMESTAMP WHERE group_name IN (${placeholders})`,
      ).run(...names);
      return Number(info.changes || 0);
    },

    countDictionariesInGroups: (groupNames) => {
      const db = getDb();
      const names = (groupNames || []).map(String).filter((n) => n && n !== '所有分组');
      if (names.length === 0) return 0;
      const placeholders = names.map(() => '?').join(', ');
      const row = db.prepare(
        `SELECT COUNT(*) as total FROM dictionaries WHERE group_name IN (${placeholders}) AND deleted_at IS NULL`,
      ).get(...names) as { total: number };
      return Number(row?.total || 0);
    },

    moveDictionariesToGroup: (ids, groupName) => {
      const db = getDb();
      const list = (ids || []).map(String).filter(Boolean);
      if (list.length === 0) return 0;
      const placeholders = list.map(() => '?').join(', ');
      const info = db.prepare(
        `UPDATE dictionaries SET group_name = ?, updated_at = CURRENT_TIMESTAMP WHERE id IN (${placeholders})`,
      ).run(groupName, ...list);
      return Number(info.changes || 0);
    },

    moveDictionaryToTop: (id) => {
      const db = getDb();
      const item = getDictionaryByIdUnsafe(id);
      if (!item || item.deleted_at) return 0;

      const row = db.prepare(
        'SELECT COALESCE(MIN(sort_order), 0) as minSortOrder FROM dictionaries WHERE deleted_at IS NULL AND group_name = ?',
      ).get(item.group_name || '') as { minSortOrder: number };
      const nextSortOrder = Number(row?.minSortOrder ?? 0) - 1;

      const info = db.prepare(
        'UPDATE dictionaries SET sort_order = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      ).run(nextSortOrder, id);
      return Number(info.changes || 0);
    },

    moveDictionaryToBottom: (id) => {
      const db = getDb();
      const item = getDictionaryByIdUnsafe(id);
      if (!item || item.deleted_at) return 0;

      const row = db.prepare(
        'SELECT COALESCE(MAX(sort_order), 0) as maxSortOrder FROM dictionaries WHERE deleted_at IS NULL AND group_name = ?',
      ).get(item.group_name || '') as { maxSortOrder: number };
      const nextSortOrder = Number(row?.maxSortOrder ?? 0) + 1;

      const info = db.prepare(
        'UPDATE dictionaries SET sort_order = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      ).run(nextSortOrder, id);
      return Number(info.changes || 0);
    },
  };
}
