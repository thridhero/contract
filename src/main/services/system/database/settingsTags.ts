import type Database from 'better-sqlite3';
import type { Setting, SettingInsertParams, SettingUpdateParams } from '../../../../shared/types/database.types';
import type { TagEntity, TagGroupEntity } from '../../../../shared/types/tag.types';

export type SettingsTagsMethods = {
  insertSetting: (params: SettingInsertParams) => Setting;
  updateSetting: (params: SettingUpdateParams) => Setting;
  deleteSetting: (key: string) => void;
  getSetting: (key: string) => Setting | null;
  getAllSettings: () => Setting[];
  searchSettings: (term: string) => Setting[];
  getAllTagGroups: () => TagGroupEntity[];
  getAllTags: () => TagEntity[];
};

export function createSettingsTagsMethods(getDb: () => Database.Database): SettingsTagsMethods {
  const getSetting = (key: string): Setting | null => {
    const db = getDb();
    return (db.prepare('SELECT * FROM settings WHERE key = ?').get(key) as Setting) ?? null;
  };

  return {
    insertSetting: (params) => {
      const db = getDb();
      db.prepare(
        'INSERT INTO settings (key, value, description) VALUES (?, ?, ?)',
      ).run(params.key, params.value, params.description ?? '');
      return getSetting(params.key)!;
    },

    updateSetting: (params) => {
      const db = getDb();
      if (params.description !== undefined) {
        db.prepare(
          'UPDATE settings SET value = ?, description = ?, updated_at = CURRENT_TIMESTAMP WHERE key = ?',
        ).run(params.value, params.description, params.key);
      } else {
        db.prepare(
          'UPDATE settings SET value = ?, updated_at = CURRENT_TIMESTAMP WHERE key = ?',
        ).run(params.value, params.key);
      }
      return getSetting(params.key)!;
    },

    deleteSetting: (key) => {
      const db = getDb();
      db.prepare('DELETE FROM settings WHERE key = ?').run(key);
    },

    getSetting,

    getAllSettings: () => {
      const db = getDb();
      return db.prepare('SELECT * FROM settings ORDER BY key').all() as Setting[];
    },

    searchSettings: (term) => {
      const db = getDb();
      const pattern = `%${term}%`;
      return db.prepare(
        'SELECT * FROM settings WHERE key LIKE ? OR description LIKE ? ORDER BY key',
      ).all(pattern, pattern) as Setting[];
    },

    getAllTagGroups: () => {
      const db = getDb();
      return db.prepare(
        'SELECT id, name, sort_order, created_at, updated_at FROM tag_groups ORDER BY sort_order ASC, created_at ASC',
      ).all() as TagGroupEntity[];
    },

    getAllTags: () => {
      const db = getDb();
      return db.prepare(
        'SELECT id, name, initial, initial_letter, is_common, group_id, use_count, created_at, updated_at FROM tags ORDER BY initial_letter ASC, name COLLATE NOCASE ASC',
      ).all() as TagEntity[];
    },
  };
}

