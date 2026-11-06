import type Database from 'better-sqlite3';

export type StatsMethods = {
  getProjectStats: () => { total: number; by_status: Record<string, number> };
};

export function createStatsMethods(getDb: () => Database.Database): StatsMethods {
  return {
    getProjectStats: () => {
      const db = getDb();
      const total = (db.prepare(
        'SELECT COUNT(*) as count FROM projects WHERE is_archived = 0 AND deleted_at IS NULL',
      ).get() as { count: number }).count;
      const byStatus = db.prepare(
        'SELECT status, COUNT(*) as count FROM projects WHERE is_archived = 0 AND deleted_at IS NULL GROUP BY status',
      ).all() as { status: string; count: number }[];
      const by_status: Record<string, number> = {};
      for (const row of byStatus) by_status[row.status] = row.count;
      return { total, by_status };
    },
  };
}

