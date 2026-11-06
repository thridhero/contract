import * as crypto from 'crypto';
import type Database from 'better-sqlite3';
import type {
  Department,
  DepartmentCreateDTO,
  DepartmentQueryDTO,
  DepartmentQueryResult,
  DepartmentUpdateDTO,
} from '../../../../shared/types/department.types';

const DEPARTMENT_SEARCH_FIELDS = new Set(['code', 'name', 'leader', 'phone', 'email']);

export type DepartmentsMethods = {
  createDepartment: (dto: DepartmentCreateDTO) => Department;
  updateDepartment: (dto: DepartmentUpdateDTO) => Department;
  deleteDepartment: (id: string) => void;
  restoreDepartment: (id: string) => void;
  purgeDepartment: (id: string) => void;
  getDepartmentById: (id: string) => Department | null;
  getDepartments: (query: DepartmentQueryDTO) => DepartmentQueryResult;
};

export function createDepartmentsMethods(getDb: () => Database.Database): DepartmentsMethods {
  const getDepartmentById = (id: string): Department | null => {
    const db = getDb();
    return (db.prepare('SELECT * FROM departments WHERE id = ? AND deleted_at IS NULL').get(id) as Department) || null;
  };

  const getActivePersonnelCountByDepartment = (departmentId: string): number => {
    const db = getDb();
    const row = db.prepare(`
      SELECT COUNT(DISTINCT p.id) as total
      FROM personnel p
      INNER JOIN personnel_departments pd ON pd.personnel_id = p.id
      INNER JOIN departments d ON d.id = pd.department_id
      WHERE pd.department_id = ?
        AND p.deleted_at IS NULL
        AND d.deleted_at IS NULL
    `).get(departmentId) as { total: number } | undefined;
    return Number(row?.total || 0);
  };

  return {
    createDepartment: (dto) => {
      console.log('[Database/Departments] createDepartment called with:', dto);
      const db = getDb();
      const id = crypto.randomUUID();
      try {
        const stmt = db.prepare(`
          INSERT INTO departments (
            id, parent_id, code, name, leader, phone, email, sort_order, remark
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        const result = stmt.run(
          id,
          dto.parent_id || null,
          String(dto.code || '').trim(),
          String(dto.name || '').trim(),
          String(dto.leader || '').trim(),
          String(dto.phone || '').trim(),
          String(dto.email || '').trim(),
          Number.isFinite(Number(dto.sort_order)) ? Number(dto.sort_order) : 0,
          String(dto.remark || '').trim(),
        );
        console.log('[Database/Departments] Insert result:', result);
        const department = getDepartmentById(id);
        if (!department) {
          throw new Error('部门插入成功但无法读取回刚才创建的部门数据');
        }
        return department;
      } catch (error) {
        console.error('[Database/Departments] Error in createDepartment:', error);
        throw error;
      }
    },

    updateDepartment: (dto) => {
      const db = getDb();
      const fields: string[] = [];
      const values: unknown[] = [];
      const addField = (col: string, val: unknown, trim = true) => {
        if (val === undefined) return;
        const normalized = trim ? (val === null ? null : String(val ?? '').trim()) : val;
        fields.push(`${col} = ?`);
        values.push(normalized);
      };

      addField('parent_id', dto.parent_id);
      addField('code', dto.code);
      addField('name', dto.name);
      addField('leader', dto.leader);
      addField('phone', dto.phone);
      addField('email', dto.email);
      if (dto.sort_order !== undefined) {
        fields.push('sort_order = ?');
        values.push(Number.isFinite(Number(dto.sort_order)) ? Number(dto.sort_order) : 0);
      }
      addField('remark', dto.remark);

      if (fields.length === 0) return getDepartmentById(dto.id)!;
      fields.push('updated_at = CURRENT_TIMESTAMP');
      values.push(dto.id);
      db.prepare(`UPDATE departments SET ${fields.join(', ')} WHERE id = ?`).run(...values);
      return getDepartmentById(dto.id)!;
    },

    deleteDepartment: (id) => {
      const db = getDb();
      // 检查人员引用
      const linkedCount = getActivePersonnelCountByDepartment(id);
      if (linkedCount > 0) {
        throw new Error('该部门已被人员引用，请先处理关联人员后再删除');
      }
      // 检查子部门
      const childCountRow = db.prepare('SELECT COUNT(*) as total FROM departments WHERE parent_id = ? AND deleted_at IS NULL').get(id) as { total: number } | undefined;
      if (Number(childCountRow?.total || 0) > 0) {
        throw new Error('该部门包含子部门，请先删除子部门后再操作');
      }
      db.prepare('UPDATE departments SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?').run(id);
    },

    restoreDepartment: (id) => {
      const db = getDb();
      db.prepare('UPDATE departments SET deleted_at = NULL WHERE id = ?').run(id);
    },

    purgeDepartment: (id) => {
      const db = getDb();
      const linkedCount = getActivePersonnelCountByDepartment(id);
      if (linkedCount > 0) {
        throw new Error('该部门已被人员引用，请先处理关联人员后再删除');
      }
      db.prepare('DELETE FROM personnel_departments WHERE department_id = ?').run(id);
      db.prepare('DELETE FROM departments WHERE id = ?').run(id);
    },

    getDepartmentById,

    getDepartments: (query) => {
      const db = getDb();
      let sql = 'SELECT * FROM departments WHERE deleted_at IS NULL';
      let countSql = 'SELECT COUNT(*) as total FROM departments WHERE deleted_at IS NULL';
      const params: unknown[] = [];

      if (query.search) {
        const searchFields = (query.searchFields || [])
          .map(field => String(field || '').trim())
          .filter(field => DEPARTMENT_SEARCH_FIELDS.has(field));
        const fields = searchFields.length ? searchFields : ['name', 'code', 'leader', 'phone'];
        const terms = fields.map((field) => `${field} LIKE ?`).join(' OR ');
        sql += ` AND (${terms})`;
        countSql += ` AND (${terms})`;
        const pattern = `%${query.search}%`;
        for (let i = 0; i < fields.length; i++) params.push(pattern);
      }

      sql += ' ORDER BY sort_order ASC, created_at DESC';
      const total = Number((db.prepare(countSql).get(...params) as { total: number } | undefined)?.total || 0);

      if (query.page !== undefined && query.pageSize !== undefined) {
        const offset = (query.page - 1) * query.pageSize;
        sql += ' LIMIT ? OFFSET ?';
        params.push(query.pageSize, offset);
      }

      const data = db.prepare(sql).all(...params) as Department[];
      return { data, total };
    },
  };
}
