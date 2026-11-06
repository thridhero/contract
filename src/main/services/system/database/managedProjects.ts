import * as crypto from 'crypto';
import type Database from 'better-sqlite3';
import type {
  ProjectManagementCreateDTO,
  ProjectManagementDeleteByQueryDTO,
  ProjectManagementItem,
  ProjectManagementMoveDTO,
  ProjectManagementQueryDTO,
  ProjectManagementQueryResult,
  ProjectManagementRecodeResult,
  ProjectManagementSortField,
  ProjectManagementSummary,
  ProjectManagementUpdateDTO,
} from '../../../../shared/types/projectManagement.types';

export type ManagedProjectsMethods = {
  createManagedProject: (dto: ProjectManagementCreateDTO) => ProjectManagementItem;
  updateManagedProject: (dto: ProjectManagementUpdateDTO) => ProjectManagementItem;
  deleteManagedProject: (id: string) => void;
  deleteManagedProjectsByQuery: (dto?: ProjectManagementDeleteByQueryDTO) => { deletedCount: number };
  restoreManagedProject: (id: string) => void;
  restoreManagedProjectsByQuery: (dto?: ProjectManagementDeleteByQueryDTO) => { restoredCount: number };
  purgeManagedProject: (id: string) => void;
  purgeManagedProjectsByQuery: (dto?: ProjectManagementDeleteByQueryDTO) => { purgedCount: number };
  getManagedProjectById: (id: string) => ProjectManagementItem | null;
  getManagedProjects: (query?: ProjectManagementQueryDTO) => ProjectManagementQueryResult;
  moveManagedProject: (dto: ProjectManagementMoveDTO) => ProjectManagementItem;
  recodeManagedProjects: (query?: ProjectManagementQueryDTO) => ProjectManagementRecodeResult;
  renameManagedProjectGroup: (groupKey: string, oldName: string, newName: string) => { updatedCount: number };
  countManagedProjectsInGroups: (groupKeys?: string[], groupNames?: string[]) => number;
  getManagedProjectSummary: (query?: ProjectManagementQueryDTO) => ProjectManagementSummary;
};

export function createManagedProjectsMethods(getDb: () => Database.Database): ManagedProjectsMethods {
  const normalizeManagedProjectText = (value: unknown): string | null => {
    if (value === undefined || value === null) return null;
    const text = String(value).trim();
    return text === '' ? null : text;
  };

  const normalizeManagedProjectNumber = (value: unknown): number | null => {
    if (value === undefined || value === null || value === '') return null;
    const num = Number(value);
    return Number.isFinite(num) ? num : null;
  };

  const toManagedProjectCodeDate = (value?: string | null): string => {
    const normalized = normalizeManagedProjectText(value)?.replace(/\D/g, '');
    if (normalized && normalized.length >= 8) {
      return normalized.slice(0, 8);
    }

    const now = new Date();
    const yyyy = String(now.getFullYear());
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    return `${yyyy}${mm}${dd}`;
  };

  const getManagedProjectSortField = (field?: ProjectManagementSortField): string => {
    const mapping: Record<ProjectManagementSortField, string> = {
      sort_order: 'sort_order',
      code: 'code',
      name: 'name',
      project_date: 'project_date',
      approval_date: 'approval_date',
      contract_deadline: 'contract_deadline',
      created_at: 'created_at',
      updated_at: 'updated_at',
      building_area: 'building_area',
      counted_area: 'counted_area',
    };

    if (!field) return 'sort_order';
    return mapping[field] ?? 'sort_order';
  };

  const buildManagedProjectWhereClause = (query: ProjectManagementQueryDTO = {}, values: unknown[] = []): string => {
    const conditions: string[] = [];
    const groupConditions: string[] = [];
    const groupKeys = Array.isArray(query.groupKeys) ? query.groupKeys.filter(Boolean) : [];
    const groupNames = Array.isArray(query.groupNames) ? query.groupNames.filter(Boolean) : [];

    if (!query.includeDeleted) {
      conditions.push('deleted_at IS NULL');
    }

    if (groupKeys.length > 0) {
      groupConditions.push(`group_key IN (${groupKeys.map(() => '?').join(', ')})`);
      values.push(...groupKeys);
    }

    if (groupNames.length > 0) {
      groupConditions.push(`group_name IN (${groupNames.map(() => '?').join(', ')})`);
      values.push(...groupNames);
    }

    if (groupConditions.length > 0) {
      conditions.push(`(${groupConditions.join(' OR ')})`);
    }

    const search = normalizeManagedProjectText(query.search);
    if (search) {
      const pattern = `%${search}%`;
      const searchField = query.searchField ?? 'all';
      const fieldMap: Record<string, string> = {
        code: 'code',
        name: 'name',
        content: 'content',
        group_name: 'group_name',
        engineering_location: 'engineering_location',
        country: 'country',
        province: 'province',
        city: 'city',
      };

      if (searchField === 'all') {
        const allFields = ['code', 'name', 'content', 'group_name', 'engineering_location', 'country', 'province', 'city'];
        conditions.push(`(${allFields.map((field) => `${field} LIKE ?`).join(' OR ')})`);
        values.push(...allFields.map(() => pattern));
      } else {
        const column = fieldMap[searchField] ?? 'name';
        conditions.push(`${column} LIKE ?`);
        values.push(pattern);
      }
    }

    return conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  };

  const buildManagedProjectOrderBy = (query: ProjectManagementQueryDTO = {}): string => {
    const sortField = getManagedProjectSortField(query.sortField);
    const sortOrder = query.sortOrder === 'desc' ? 'DESC' : 'ASC';
    if (sortField === 'sort_order') {
      return `ORDER BY sort_order ${sortOrder}, datetime(created_at) DESC`;
    }
    return `ORDER BY ${sortField} ${sortOrder}, sort_order ASC, datetime(created_at) DESC`;
  };

  const generateManagedProjectCode = (baseDate?: string | null, excludeId?: string): string => {
    const db = getDb();
    const datePart = toManagedProjectCodeDate(baseDate);
    const prefix = `XM${datePart}`;
    const params: unknown[] = [`${prefix}%`];
    let sql = 'SELECT code FROM managed_projects WHERE code LIKE ?';

    if (excludeId) {
      sql += ' AND id <> ?';
      params.push(excludeId);
    }

    const rows = db.prepare(sql).all(...params) as Array<{ code: string }>;
    const codeSet = new Set(rows.map((row) => row.code));

    for (let index = 1; index < 1000000; index += 1) {
      const code = `${prefix}${String(index).padStart(3, '0')}`;
      if (!codeSet.has(code)) {
        return code;
      }
    }

    throw new Error('项目编号生成失败');
  };

  const getManagedProjectIdsByQuery = (query: ProjectManagementQueryDTO = {}): string[] => {
    const db = getDb();
    const values: unknown[] = [];
    const where = buildManagedProjectWhereClause(query, values);
    const orderBy = buildManagedProjectOrderBy(query);
    const rows = db.prepare(`SELECT id FROM managed_projects ${where} ${orderBy}`).all(...values) as Array<{ id: string }>;
    return rows.map((row) => row.id);
  };

  const getManagedProjectById = (id: string): ProjectManagementItem | null => {
    const db = getDb();
    return (db.prepare('SELECT * FROM managed_projects WHERE id = ? AND deleted_at IS NULL').get(id) as ProjectManagementItem) ?? null;
  };

  const getManagedProjects = (query: ProjectManagementQueryDTO = {}): ProjectManagementQueryResult => {
    const db = getDb();
    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.max(1, query.pageSize ?? 20);
    const values: unknown[] = [];
    const where = buildManagedProjectWhereClause(query, values);
    const totalRow = db.prepare(`SELECT COUNT(*) as count FROM managed_projects ${where}`).get(...values) as { count: number };
    const orderBy = buildManagedProjectOrderBy(query);
    const offset = (page - 1) * pageSize;
    const data = db.prepare(`
      SELECT * FROM managed_projects
      ${where}
      ${orderBy}
      LIMIT ? OFFSET ?
    `).all(...values, pageSize, offset) as ProjectManagementItem[];
    return {
      data,
      total: totalRow.count,
    };
  };

  return {
    createManagedProject: (dto) => {
      const db = getDb();
      const name = normalizeManagedProjectText(dto.name);
      if (!name) {
        throw new Error('项目名称不能为空');
      }

      const manualCode = normalizeManagedProjectText(dto.code);
      const code = manualCode ?? generateManagedProjectCode(dto.project_date ?? null);
      const existed = db.prepare('SELECT id FROM managed_projects WHERE code = ? LIMIT 1').get(code) as { id?: string } | undefined;
      if (existed?.id) {
        throw new Error('项目编号已存在');
      }

      const sortOrderRow = db.prepare('SELECT COALESCE(MAX(sort_order), 0) as maxSortOrder FROM managed_projects').get() as { maxSortOrder: number };
      const id = crypto.randomUUID();

      db.prepare(`
      INSERT INTO managed_projects (
        id, code, name, content, group_key, group_name, project_date, approval_date, contract_deadline,
        engineering_location, project_days, building_area, started_building_area, counted_area,
        started_counted_area, country, province, city, sort_order
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
        id,
        code,
        name,
        normalizeManagedProjectText(dto.content) ?? '',
        normalizeManagedProjectText(dto.group_key),
        normalizeManagedProjectText(dto.group_name),
        normalizeManagedProjectText(dto.project_date),
        normalizeManagedProjectText(dto.approval_date),
        normalizeManagedProjectText(dto.contract_deadline),
        normalizeManagedProjectText(dto.engineering_location),
        normalizeManagedProjectNumber(dto.project_days),
        normalizeManagedProjectNumber(dto.building_area),
        normalizeManagedProjectNumber(dto.started_building_area),
        normalizeManagedProjectNumber(dto.counted_area),
        normalizeManagedProjectNumber(dto.started_counted_area),
        normalizeManagedProjectText(dto.country),
        normalizeManagedProjectText(dto.province),
        normalizeManagedProjectText(dto.city),
        sortOrderRow.maxSortOrder + 1,
      );

      return getManagedProjectById(id)!;
    },

    updateManagedProject: (dto) => {
      const db = getDb();
      const fields: string[] = [];
      const values: unknown[] = [];

      const addField = (column: string, value: unknown) => {
        if (value !== undefined) {
          fields.push(`${column} = ?`);
          values.push(value);
        }
      };

      if (dto.code !== undefined) {
        const code = normalizeManagedProjectText(dto.code);
        if (!code) {
          throw new Error('项目编号不能为空');
        }
        const existed = db.prepare('SELECT id FROM managed_projects WHERE code = ? AND id <> ? LIMIT 1').get(code, dto.id) as { id?: string } | undefined;
        if (existed?.id) {
          throw new Error('项目编号已存在');
        }
        addField('code', code);
      }

      if (dto.name !== undefined) {
        const name = normalizeManagedProjectText(dto.name);
        if (!name) {
          throw new Error('项目名称不能为空');
        }
        addField('name', name);
      }

      if (dto.content !== undefined) addField('content', normalizeManagedProjectText(dto.content) ?? '');
      if (dto.group_key !== undefined) addField('group_key', normalizeManagedProjectText(dto.group_key));
      if (dto.group_name !== undefined) addField('group_name', normalizeManagedProjectText(dto.group_name));
      if (dto.project_date !== undefined) addField('project_date', normalizeManagedProjectText(dto.project_date));
      if (dto.approval_date !== undefined) addField('approval_date', normalizeManagedProjectText(dto.approval_date));
      if (dto.contract_deadline !== undefined) addField('contract_deadline', normalizeManagedProjectText(dto.contract_deadline));
      if (dto.engineering_location !== undefined) addField('engineering_location', normalizeManagedProjectText(dto.engineering_location));
      if (dto.project_days !== undefined) addField('project_days', normalizeManagedProjectNumber(dto.project_days));
      if (dto.building_area !== undefined) addField('building_area', normalizeManagedProjectNumber(dto.building_area));
      if (dto.started_building_area !== undefined) addField('started_building_area', normalizeManagedProjectNumber(dto.started_building_area));
      if (dto.counted_area !== undefined) addField('counted_area', normalizeManagedProjectNumber(dto.counted_area));
      if (dto.started_counted_area !== undefined) addField('started_counted_area', normalizeManagedProjectNumber(dto.started_counted_area));
      if (dto.country !== undefined) addField('country', normalizeManagedProjectText(dto.country));
      if (dto.province !== undefined) addField('province', normalizeManagedProjectText(dto.province));
      if (dto.city !== undefined) addField('city', normalizeManagedProjectText(dto.city));

      if (fields.length === 0) {
        return getManagedProjectById(dto.id)!;
      }

      fields.push('updated_at = CURRENT_TIMESTAMP');
      values.push(dto.id);
      db.prepare(`UPDATE managed_projects SET ${fields.join(', ')} WHERE id = ?`).run(...values);
      return getManagedProjectById(dto.id)!;
    },

    deleteManagedProject: (id) => {
      const db = getDb();
      db.prepare('UPDATE managed_projects SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?').run(id);
    },

    deleteManagedProjectsByQuery: (dto = {}) => {
      const db = getDb();
      const ids = getManagedProjectIdsByQuery(dto.query ?? {});
      if (ids.length === 0) {
        return { deletedCount: 0 };
      }

      const tx = db.transaction((targetIds: string[]) => {
        const statement = db.prepare('UPDATE managed_projects SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?');
        let changes = 0;
        for (const id of targetIds) {
          const info = statement.run(id);
          changes += info.changes;
        }
        return changes;
      });

      const changes = tx(ids);
      return { deletedCount: changes };
    },

    restoreManagedProject: (id) => {
      const db = getDb();
      db.prepare('UPDATE managed_projects SET deleted_at = NULL WHERE id = ?').run(id);
    },

    restoreManagedProjectsByQuery: (dto = {}) => {
      const db = getDb();
      const ids = getManagedProjectIdsByQuery({ ...(dto.query ?? {}), includeDeleted: true });
      if (ids.length === 0) {
        return { restoredCount: 0 };
      }

      const tx = db.transaction((targetIds: string[]) => {
        const statement = db.prepare('UPDATE managed_projects SET deleted_at = NULL WHERE id = ?');
        let changes = 0;
        for (const id of targetIds) {
          const info = statement.run(id);
          changes += info.changes;
        }
        return changes;
      });

      const changes = tx(ids);
      return { restoredCount: changes };
    },

    purgeManagedProject: (id) => {
      const db = getDb();
      db.prepare('DELETE FROM managed_projects WHERE id = ?').run(id);
    },

    purgeManagedProjectsByQuery: (dto = {}) => {
      const db = getDb();
      const ids = getManagedProjectIdsByQuery({ ...(dto.query ?? {}), includeDeleted: true });
      if (ids.length === 0) {
        return { purgedCount: 0 };
      }

      const tx = db.transaction((targetIds: string[]) => {
        const statement = db.prepare('DELETE FROM managed_projects WHERE id = ?');
        let changes = 0;
        for (const id of targetIds) {
          const info = statement.run(id);
          changes += info.changes;
        }
        return changes;
      });

      const changes = tx(ids);
      return { purgedCount: changes };
    },

    getManagedProjectById,

    getManagedProjects,

    moveManagedProject: (dto) => {
      const db = getDb();
      const ids = getManagedProjectIdsByQuery({
        ...(dto.query ?? {}),
        page: undefined,
        pageSize: undefined,
      });

      const currentIndex = ids.findIndex((id) => id === dto.id);
      if (currentIndex === -1) {
        throw new Error('未找到待排序项目');
      }

      let nextIndex = currentIndex;
      if (dto.direction === 'top') nextIndex = 0;
      if (dto.direction === 'up') nextIndex = Math.max(0, currentIndex - 1);
      if (dto.direction === 'down') nextIndex = Math.min(ids.length - 1, currentIndex + 1);
      if (dto.direction === 'bottom') nextIndex = ids.length - 1;

      if (nextIndex === currentIndex) {
        return getManagedProjectById(dto.id)!;
      }

      const [targetId] = ids.splice(currentIndex, 1);
      ids.splice(nextIndex, 0, targetId);

      const tx = db.transaction((orderedIds: string[]) => {
        const statement = db.prepare('UPDATE managed_projects SET sort_order = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?');
        orderedIds.forEach((id, index) => {
          statement.run(index + 1, id);
        });
      });

      tx(ids);
      return getManagedProjectById(dto.id)!;
    },

    recodeManagedProjects: (query = {}) => {
      const db = getDb();
      const selected = getManagedProjects({
        ...query,
        page: 1,
        pageSize: Number.MAX_SAFE_INTEGER,
        sortField: 'project_date',
        sortOrder: 'asc',
      }).data;

      if (selected.length === 0) {
        return { updatedCount: 0 };
      }

      const selectedIds = new Set(selected.map((item) => item.id));
      const existingRows = db.prepare('SELECT id, code FROM managed_projects').all() as Array<{ id: string; code: string }>;
      const codeSet = new Set(existingRows.filter((row) => !selectedIds.has(row.id)).map((row) => row.code));
      const dailyCounters = new Map<string, number>();

      const updates = selected.map((item) => {
        const datePart = toManagedProjectCodeDate(item.project_date ?? item.created_at);
        const prefix = `XM${datePart}`;
        let counter = dailyCounters.get(datePart) ?? 0;
        let nextCode = '';

        do {
          counter += 1;
          nextCode = `${prefix}${String(counter).padStart(3, '0')}`;
        } while (codeSet.has(nextCode));

        dailyCounters.set(datePart, counter);
        codeSet.add(nextCode);
        return { id: item.id, code: nextCode };
      });

      const tx = db.transaction((rows: Array<{ id: string; code: string }>) => {
        const tempStatement = db.prepare('UPDATE managed_projects SET code = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?');
        const finalStatement = db.prepare('UPDATE managed_projects SET code = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?');

        for (const row of rows) {
          tempStatement.run(`TMP_${row.id}`, row.id);
        }

        for (const row of rows) {
          finalStatement.run(row.code, row.id);
        }
      });

      tx(updates);
      return { updatedCount: updates.length };
    },

    renameManagedProjectGroup: (groupKey, oldName, newName) => {
      const db = getDb();
      const result = db.prepare(`
      UPDATE managed_projects
      SET group_name = ?, updated_at = CURRENT_TIMESTAMP
      WHERE group_key = ? OR (group_key IS NULL AND group_name = ?)
    `).run(newName, groupKey, oldName);
      return { updatedCount: result.changes };
    },

    countManagedProjectsInGroups: (groupKeys: string[] = [], groupNames: string[] = []) => {
      const db = getDb();
      const conditions: string[] = [];
      const values: unknown[] = [];

      if (groupKeys.length > 0) {
        conditions.push(`group_key IN (${groupKeys.map(() => '?').join(', ')})`);
        values.push(...groupKeys);
      }

      if (groupNames.length > 0) {
        conditions.push(`group_name IN (${groupNames.map(() => '?').join(', ')})`);
        values.push(...groupNames);
      }

      if (conditions.length === 0) {
        return 0;
      }

      const row = db.prepare(`
      SELECT COUNT(*) as count
      FROM managed_projects
      WHERE deleted_at IS NULL AND (${conditions.join(' OR ')})
    `).get(...values) as { count: number };

      return row.count;
    },

    getManagedProjectSummary: (query = {}) => {
      const db = getDb();
      const values: unknown[] = [];
      const where = buildManagedProjectWhereClause(query, values);
      const row = db.prepare(`
      SELECT
        COUNT(*) as total,
        COALESCE(SUM(project_days), 0) as totalProjectDays,
        COALESCE(SUM(building_area), 0) as totalBuildingArea,
        COALESCE(SUM(started_building_area), 0) as totalStartedBuildingArea,
        COALESCE(SUM(counted_area), 0) as totalCountedArea,
        COALESCE(SUM(started_counted_area), 0) as totalStartedCountedArea
      FROM managed_projects
      ${where}
    `).get(...values) as ProjectManagementSummary;

      return {
        total: Number(row.total ?? 0),
        totalProjectDays: Number(row.totalProjectDays ?? 0),
        totalBuildingArea: Number(row.totalBuildingArea ?? 0),
        totalStartedBuildingArea: Number(row.totalStartedBuildingArea ?? 0),
        totalCountedArea: Number(row.totalCountedArea ?? 0),
        totalStartedCountedArea: Number(row.totalStartedCountedArea ?? 0),
      };
    },
  };
}

