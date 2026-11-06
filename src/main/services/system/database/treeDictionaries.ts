import * as crypto from 'crypto';
import type Database from 'better-sqlite3';
import type { TreeDictionaryCreateDTO, TreeDictionaryItem, TreeDictionaryQueryDTO, TreeDictionaryQueryResult, TreeDictionaryUpdateDTO } from '../../../../shared/types/treeDictionary.types';

export type TreeDictionariesMethods = {
  createTreeDictionary: (dto: TreeDictionaryCreateDTO) => TreeDictionaryItem;
  updateTreeDictionary: (dto: TreeDictionaryUpdateDTO) => TreeDictionaryItem;
  deleteTreeDictionary: (id: string) => void;
  restoreTreeDictionary: (id: string) => void;
  purgeTreeDictionary: (id: string) => void;
  getTreeDictionaryById: (id: string) => TreeDictionaryItem;
  getTreeDictionaries: (query: TreeDictionaryQueryDTO) => TreeDictionaryQueryResult;
  getTreeDictionaryRootByGroup: (groupName: string) => TreeDictionaryItem | null;
  ensureTreeDictionaryRootByGroup: (groupName: string) => TreeDictionaryItem;
  renameTreeDictionaryGroup: (oldName: string, newName: string) => number;
  clearTreeDictionaryGroups: (groupNames: string[]) => number;
  updateTreeDictionarySortOrder: (updates: { id: string; sort_order: number }[]) => number;
  importTreeDictionaryCsv: (records: Array<TreeDictionaryCreateDTO>, groupName: string) => number;
};

export function createTreeDictionariesMethods(getDb: () => Database.Database): TreeDictionariesMethods {
  const getTreeDictionaryById = (id: string): TreeDictionaryItem => {
    const db = getDb();
    return (db.prepare('SELECT * FROM tree_dictionaries WHERE id = ? AND deleted_at IS NULL').get(id) as TreeDictionaryItem) || null;
  };

  const restoreTreeDictionary = (id: string): void => {
    const db = getDb();
    const tx = db.transaction((targetId: string) => {
      db.prepare(`
        WITH RECURSIVE subtree(id) AS (
          SELECT id FROM tree_dictionaries WHERE id = ?
          UNION ALL
          SELECT td.id FROM tree_dictionaries td
          INNER JOIN subtree s ON td.parent_id = s.id
        )
        UPDATE tree_dictionaries
        SET deleted_at = NULL
        WHERE id IN (SELECT id FROM subtree)
      `).run(targetId);
    });
    tx(id);
  };

  const createTreeDictionary = (dto: TreeDictionaryCreateDTO): TreeDictionaryItem => {
    const db = getDb();
    const id = crypto.randomUUID();
    db.prepare(`
      INSERT INTO tree_dictionaries (
        id, parent_id, name, code, abbreviation, bg_color, sort_order, value, remark, group_name
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      dto.parent_id || '0',
      dto.name,
      dto.code || '',
      dto.abbreviation || '',
      dto.bg_color || '',
      dto.sort_order || 0,
      dto.value || '',
      dto.remark || '',
      dto.group_name || '',
    );
    return getTreeDictionaryById(id);
  };

  return {
    createTreeDictionary,

    updateTreeDictionary: (dto) => {
      const db = getDb();
      const fields: string[] = [];
      const values: unknown[] = [];

      const addField = (col: string, val: unknown) => {
        if (val !== undefined) { fields.push(`${col} = ?`); values.push(val); }
      };

      addField('parent_id', dto.parent_id);
      addField('name', dto.name);
      addField('code', dto.code);
      addField('abbreviation', dto.abbreviation);
      addField('bg_color', dto.bg_color);
      addField('sort_order', dto.sort_order);
      addField('value', dto.value);
      addField('remark', dto.remark);
      addField('group_name', dto.group_name);

      if (fields.length === 0) return getTreeDictionaryById(dto.id);

      fields.push('updated_at = CURRENT_TIMESTAMP');
      values.push(dto.id);

      db.prepare(`UPDATE tree_dictionaries SET ${fields.join(', ')} WHERE id = ?`).run(...values);
      return getTreeDictionaryById(dto.id);
    },

    deleteTreeDictionary: (id) => {
      const db = getDb();
      const tx = db.transaction((targetId: string) => {
        db.prepare(`
        WITH RECURSIVE subtree(id) AS (
          SELECT id FROM tree_dictionaries WHERE id = ?
          UNION ALL
          SELECT td.id FROM tree_dictionaries td
          INNER JOIN subtree s ON td.parent_id = s.id
        )
        UPDATE tree_dictionaries
        SET deleted_at = CURRENT_TIMESTAMP
        WHERE id IN (SELECT id FROM subtree)
      `).run(targetId);
      });
      tx(id);
    },

    restoreTreeDictionary,

    purgeTreeDictionary: (id) => {
      const db = getDb();
      const tx = db.transaction((targetId: string) => {
        db.prepare(`
        WITH RECURSIVE subtree(id) AS (
          SELECT id FROM tree_dictionaries WHERE id = ?
          UNION ALL
          SELECT td.id FROM tree_dictionaries td
          INNER JOIN subtree s ON td.parent_id = s.id
        )
        DELETE FROM tree_dictionaries
        WHERE id IN (SELECT id FROM subtree)
      `).run(targetId);
      });
      tx(id);
    },

    getTreeDictionaryById,

    getTreeDictionaries: (query) => {
      const db = getDb();
      let sql = 'SELECT * FROM tree_dictionaries WHERE deleted_at IS NULL';
      let countSql = 'SELECT COUNT(*) as total FROM tree_dictionaries WHERE deleted_at IS NULL';
      const params: unknown[] = [];

      if (query.group_name && query.group_name !== '所有分组') {
        sql += ' AND group_name = ?';
        countSql += ' AND group_name = ?';
        params.push(query.group_name);
      }

      if (query.parent_id !== undefined) {
        sql += ' AND parent_id = ?';
        countSql += ' AND parent_id = ?';
        params.push(query.parent_id);
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

      const data = db.prepare(sql).all(...params) as TreeDictionaryItem[];
      return { data, total };
    },

    getTreeDictionaryRootByGroup: (groupName) => {
      const db = getDb();
      if (!groupName || groupName === '所有分组') return null;

      const byCode = db.prepare(
        'SELECT * FROM tree_dictionaries WHERE group_name = ? AND code = ? AND deleted_at IS NULL LIMIT 1',
      ).get(groupName, '__ROOT__') as TreeDictionaryItem | undefined;
      if (byCode) return byCode;

      const byName = db.prepare(
        "SELECT * FROM tree_dictionaries WHERE group_name = ? AND parent_id = ? AND name = ? AND deleted_at IS NULL ORDER BY created_at ASC LIMIT 1",
      ).get(groupName, '0', '默认根目录') as TreeDictionaryItem | undefined;
      return byName || null;
    },

    ensureTreeDictionaryRootByGroup: (groupName) => {
      const db = getDb();
      const existingAny = db.prepare(
        'SELECT * FROM tree_dictionaries WHERE group_name = ? AND code = ? LIMIT 1',
      ).get(groupName, '__ROOT__') as TreeDictionaryItem | undefined;
      const fallbackAny = existingAny
        ? undefined
        : (db.prepare(
            'SELECT * FROM tree_dictionaries WHERE group_name = ? AND parent_id = ? AND name = ? ORDER BY created_at ASC LIMIT 1',
          ).get(groupName, '0', '默认根目录') as TreeDictionaryItem | undefined);
      const existing = existingAny ?? fallbackAny;

      if (existing) {
        if ((existing as any).deleted_at) {
          restoreTreeDictionary(existing.id);
          return getTreeDictionaryById(existing.id)!;
        } else {
          return getTreeDictionaryById(existing.id)!;
        }
      }

      return createTreeDictionary({
        parent_id: '0',
        name: '默认根目录',
        code: '__ROOT__',
        sort_order: 0,
        group_name: groupName,
      });
    },

    renameTreeDictionaryGroup: (oldName, newName) => {
      const db = getDb();
      if (!oldName || !newName) return 0;
      const info = db.prepare(
        'UPDATE tree_dictionaries SET group_name = ?, updated_at = CURRENT_TIMESTAMP WHERE group_name = ?',
      ).run(newName, oldName);
      return Number(info.changes || 0);
    },

    clearTreeDictionaryGroups: (groupNames) => {
      const db = getDb();
      const names = (groupNames || []).map(String).filter((n) => n && n !== '所有分组');
      if (names.length === 0) return 0;

      const placeholders = names.map(() => '?').join(', ');
      const info = db.prepare(
        `UPDATE tree_dictionaries SET group_name = '', updated_at = CURRENT_TIMESTAMP WHERE group_name IN (${placeholders})`,
      ).run(...names);
      return Number(info.changes || 0);
    },

    updateTreeDictionarySortOrder: (updates) => {
      const db = getDb();
      let changes = 0;
      const updateStmt = db.prepare(
        'UPDATE tree_dictionaries SET sort_order = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      );
      db.transaction(() => {
        for (const item of updates) {
          const info = updateStmt.run(item.sort_order, item.id);
          changes += info.changes;
        }
      })();
      return changes;
    },

    importTreeDictionaryCsv: (records, groupName) => {
      const db = getDb();
      let count = 0;
      const insertStmt = db.prepare(`
      INSERT INTO tree_dictionaries (
        id, parent_id, name, code, abbreviation, bg_color, sort_order, value, remark, group_name
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

      db.transaction(() => {
        for (const dto of records) {
          insertStmt.run(
            crypto.randomUUID(),
            dto.parent_id || '0',
            dto.name,
            dto.code || '',
            dto.abbreviation || '',
            dto.bg_color || '',
            dto.sort_order || 0,
            dto.value || '',
            dto.remark || '',
            groupName,
          );
          count++;
        }
      })();

      return count;
    },
  };
}

