import * as crypto from 'crypto';
import type Database from 'better-sqlite3';
import { migratePersonnelSchema } from '../librarySchemaMigration/relatedSchemas';
import type {
  Personnel,
  PersonnelDocument,
  PersonnelDocumentApplyDraftDTO,
  PersonnelDocumentCreateRequest,
  PersonnelDocumentCreateResult,
  PersonnelDocumentPatchDraft,
  PersonnelDocumentUpdateDTO,
  PersonnelCreateDTO,
  PersonnelQueryDTO,
  PersonnelQueryResult,
  PersonnelSortOrderUpdate,
  PersonnelUpdateDTO,
} from '../../../../shared/types/personnel.types';

type PersonnelRow = Omit<Personnel, 'department_ids' | 'department_names'> & {
  department_ids?: string[];
  department_names?: string[];
};

const PERSONNEL_SEARCH_FIELDS = new Set(['code', 'name', 'position', 'phone', 'email', 'status', 'id_card_number']);

const normalizeDepartmentIds = (ids: unknown): string[] => {
  if (!Array.isArray(ids)) return [];
  const unique = new Set<string>();
  for (const id of ids) {
    const v = String(id || '').trim();
    if (v) unique.add(v);
  }
  return Array.from(unique);
};

const normalizeNullableNumber = (value: unknown): number | null => {
  if (value === undefined || value === null || value === '') return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
};

type PersonnelDocumentRow = Omit<PersonnelDocument, 'file_paths'> & {
  file_paths_json: string;
};

export type PersonnelsMethods = {
  createPersonnel: (dto: PersonnelCreateDTO) => Personnel;
  updatePersonnel: (dto: PersonnelUpdateDTO) => Personnel;
  deletePersonnel: (id: string) => void;
  restorePersonnel: (id: string) => void;
  purgePersonnel: (id: string) => void;
  getPersonnelById: (id: string) => Personnel | null;
  getPersonnels: (query: PersonnelQueryDTO) => PersonnelQueryResult;
  updatePersonnelSortOrder: (updates: PersonnelSortOrderUpdate[]) => number;
  addPersonnelDocument: (payload: PersonnelDocumentCreateRequest & { storedRelativePaths: string[]; previewImageRelativePath?: string; aiExtractJson?: string; draft?: PersonnelDocumentPatchDraft }) => PersonnelDocumentCreateResult;
  listPersonnelDocuments: (personnelId: string) => PersonnelDocument[];
  updatePersonnelDocument: (dto: PersonnelDocumentUpdateDTO) => PersonnelDocument | null;
  deletePersonnelDocument: (id: string) => void;
  applyPersonnelDocumentDraft: (dto: PersonnelDocumentApplyDraftDTO) => Personnel | null;
  rejectPersonnelDocumentDraft: (documentId: string) => PersonnelDocument | null;
};

export function createPersonnelsMethods(getDb: () => Database.Database): PersonnelsMethods {
  let sortOrderChecked = false;
  let personnelDocumentsSchemaChecked = false;

  const ensurePersonnelSortOrder = () => {
    if (sortOrderChecked) return;
    const db = getDb();
    const missingCount = Number(
      (db.prepare('SELECT COUNT(1) as c FROM personnel WHERE deleted_at IS NULL AND (sort_order IS NULL OR sort_order = 0)')
        .get() as { c?: number } | undefined)?.c || 0,
    );
    if (missingCount <= 0) {
      sortOrderChecked = true;
      return;
    }

    const ordered = db.prepare(`
      SELECT id
      FROM personnel
      WHERE deleted_at IS NULL
      ORDER BY
        CASE WHEN sort_order IS NULL OR sort_order = 0 THEN 1 ELSE 0 END ASC,
        sort_order ASC,
        created_at DESC
    `).all() as Array<{ id: string }>;

    const updateStmt = db.prepare('UPDATE personnel SET sort_order = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?');
    db.transaction(() => {
      for (let i = 0; i < ordered.length; i++) {
        updateStmt.run((i + 1) * 10, ordered[i]!.id);
      }
    })();

    sortOrderChecked = true;
  };

  const loadDepartmentsMap = (personnelIds: string[]): Map<string, { ids: string[]; names: string[] }> => {
    const db = getDb();
    const result = new Map<string, { ids: string[]; names: string[] }>();
    if (!personnelIds.length) return result;

    const placeholders = personnelIds.map(() => '?').join(', ');
    const rows = db.prepare(`
      SELECT pd.personnel_id, d.id as department_id, d.name as department_name
      FROM personnel_departments pd
      INNER JOIN departments d ON d.id = pd.department_id
      WHERE pd.personnel_id IN (${placeholders})
        AND d.deleted_at IS NULL
      ORDER BY d.sort_order ASC, d.created_at ASC
    `).all(...personnelIds) as Array<{
      personnel_id: string;
      department_id: string;
      department_name: string;
    }>;

    for (const row of rows) {
      const current = result.get(row.personnel_id) || { ids: [], names: [] };
      current.ids.push(row.department_id);
      current.names.push(row.department_name || '');
      result.set(row.personnel_id, current);
    }
    return result;
  };

  const mapPersonnelRows = (rows: PersonnelRow[]): Personnel[] => {
    const ids = rows.map(row => row.id);
    const departmentMap = loadDepartmentsMap(ids);
    return rows.map((row) => {
      const linked = departmentMap.get(row.id) || { ids: [], names: [] };
      return {
        ...row,
        department_ids: linked.ids,
        department_names: linked.names,
      } as Personnel;
    });
  };

  const getPersonnelById = (id: string): Personnel | null => {
    const db = getDb();
    const row = db.prepare('SELECT * FROM personnel WHERE id = ? AND deleted_at IS NULL').get(id) as PersonnelRow | undefined;
    if (!row) return null;
    return mapPersonnelRows([row])[0] || null;
  };

  const ensurePersonnelDocumentsSchema = () => {
    if (personnelDocumentsSchemaChecked) return;
    const db = getDb();
    migratePersonnelSchema(db);
    personnelDocumentsSchemaChecked = true;
  };

  const mapDocumentRows = (rows: PersonnelDocumentRow[]): PersonnelDocument[] => rows.map((row) => {
    let filePaths: string[] = [];
    try {
      const parsed = JSON.parse(String(row.file_paths_json || '[]'));
      filePaths = Array.isArray(parsed) ? parsed.map(item => String(item || '').trim()).filter(Boolean) : [];
    } catch {
      filePaths = [];
    }
    return {
      ...row,
      file_paths: filePaths,
      preview_image_path: String(row.preview_image_path || '').trim() || undefined,
    };
  });

  const replacePersonnelDepartments = (db: Database.Database, personnelId: string, departmentIds: string[]) => {
    db.prepare('DELETE FROM personnel_departments WHERE personnel_id = ?').run(personnelId);
    if (!departmentIds.length) return;
    const insertStmt = db.prepare('INSERT OR IGNORE INTO personnel_departments (personnel_id, department_id) VALUES (?, ?)');
    for (const departmentId of departmentIds) {
      insertStmt.run(personnelId, departmentId);
    }
  };

  return {
    createPersonnel: (dto) => {
      ensurePersonnelSortOrder();
      const db = getDb();
      const id = crypto.randomUUID();
      const departmentIds = normalizeDepartmentIds(dto.department_ids);
      const nextSortOrder = Number(
        (db.prepare('SELECT COALESCE(MAX(sort_order), 0) as maxSortOrder FROM personnel WHERE deleted_at IS NULL')
          .get() as { maxSortOrder?: number } | undefined)?.maxSortOrder || 0,
      ) + 10;
      const tx = db.transaction(() => {
        db.prepare(`
          INSERT INTO personnel (
            id, code, name, position, phone, email, entry_date, status,
            salary_base, salary_monthly, salary_currency, salary_bank_name, salary_bank_account,
            archive_no, gender, birth_date, id_card_number, photo_file_path, address, education, graduate_school, major,
            emergency_contact, emergency_contact_phone, resume_file_path, resume_text, work_experience,
            remark, sort_order
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          id,
          String(dto.code || '').trim(),
          String(dto.name || '').trim(),
          String(dto.position || '').trim(),
          String(dto.phone || '').trim(),
          String(dto.email || '').trim(),
          String(dto.entry_date || '').trim(),
          String(dto.status || '').trim(),
          normalizeNullableNumber(dto.salary_base),
          normalizeNullableNumber(dto.salary_monthly),
          String(dto.salary_currency || 'CNY').trim() || 'CNY',
          String(dto.salary_bank_name || '').trim(),
          String(dto.salary_bank_account || '').trim(),
          String(dto.archive_no || '').trim(),
          String(dto.gender || '').trim(),
          String(dto.birth_date || '').trim(),
          String(dto.id_card_number || '').trim(),
          String(dto.photo_file_path || '').trim(),
          String(dto.address || '').trim(),
          String(dto.education || '').trim(),
          String(dto.graduate_school || '').trim(),
          String(dto.major || '').trim(),
          String(dto.emergency_contact || '').trim(),
          String(dto.emergency_contact_phone || '').trim(),
          String(dto.resume_file_path || '').trim(),
          String(dto.resume_text || '').trim(),
          String(dto.work_experience || '').trim(),
          String(dto.remark || '').trim(),
          nextSortOrder,
        );
        replacePersonnelDepartments(db, id, departmentIds);
      });
      tx();
      return getPersonnelById(id)!;
    },

    updatePersonnel: (dto) => {
      const db = getDb();
      const fields: string[] = [];
      const values: unknown[] = [];
      const addField = (col: string, val: unknown) => {
        if (val === undefined) return;
        fields.push(`${col} = ?`);
        if (col === 'sort_order') {
          values.push(Number(val ?? 0));
        } else if (col === 'salary_base' || col === 'salary_monthly') {
          values.push(normalizeNullableNumber(val));
        } else {
          values.push(String(val ?? '').trim());
        }
      };

      addField('code', dto.code);
      addField('name', dto.name);
      addField('position', dto.position);
      addField('phone', dto.phone);
      addField('email', dto.email);
      addField('entry_date', dto.entry_date);
      addField('status', dto.status);
      addField('salary_base', dto.salary_base);
      addField('salary_monthly', dto.salary_monthly);
      addField('salary_currency', dto.salary_currency);
      addField('salary_bank_name', dto.salary_bank_name);
      addField('salary_bank_account', dto.salary_bank_account);
      addField('archive_no', dto.archive_no);
      addField('gender', dto.gender);
      addField('birth_date', dto.birth_date);
      addField('id_card_number', dto.id_card_number);
      addField('photo_file_path', dto.photo_file_path);
      addField('address', dto.address);
      addField('education', dto.education);
      addField('graduate_school', dto.graduate_school);
      addField('major', dto.major);
      addField('emergency_contact', dto.emergency_contact);
      addField('emergency_contact_phone', dto.emergency_contact_phone);
      addField('resume_file_path', dto.resume_file_path);
      addField('resume_text', dto.resume_text);
      addField('work_experience', dto.work_experience);
      addField('remark', dto.remark);
      addField('sort_order', dto.sort_order);

      const tx = db.transaction(() => {
        if (fields.length > 0) {
          fields.push('updated_at = CURRENT_TIMESTAMP');
          values.push(dto.id);
          db.prepare(`UPDATE personnel SET ${fields.join(', ')} WHERE id = ?`).run(...values);
        }
        if (dto.department_ids !== undefined) {
          replacePersonnelDepartments(db, dto.id, normalizeDepartmentIds(dto.department_ids));
        }
      });
      tx();
      return getPersonnelById(dto.id)!;
    },

    deletePersonnel: (id) => {
      const db = getDb();
      db.prepare('UPDATE personnel SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?').run(id);
    },

    restorePersonnel: (id) => {
      const db = getDb();
      db.prepare('UPDATE personnel SET deleted_at = NULL WHERE id = ?').run(id);
    },

    purgePersonnel: (id) => {
      const db = getDb();
      const tx = db.transaction(() => {
        db.prepare('DELETE FROM personnel_departments WHERE personnel_id = ?').run(id);
        db.prepare('DELETE FROM personnel WHERE id = ?').run(id);
      });
      tx();
    },

    getPersonnelById,

    getPersonnels: (query) => {
      ensurePersonnelSortOrder();
      const db = getDb();
      let sql = 'SELECT p.* FROM personnel p WHERE p.deleted_at IS NULL';
      let countSql = 'SELECT COUNT(DISTINCT p.id) as total FROM personnel p WHERE p.deleted_at IS NULL';
      const params: unknown[] = [];

      if (query.department_id) {
        sql += ` AND EXISTS (
          SELECT 1 FROM personnel_departments pd
          INNER JOIN departments d ON d.id = pd.department_id
          WHERE pd.personnel_id = p.id
            AND pd.department_id = ?
            AND d.deleted_at IS NULL
        )`;
        countSql += ` AND EXISTS (
          SELECT 1 FROM personnel_departments pd
          INNER JOIN departments d ON d.id = pd.department_id
          WHERE pd.personnel_id = p.id
            AND pd.department_id = ?
            AND d.deleted_at IS NULL
        )`;
        params.push(query.department_id);
      }

      if (query.search) {
        const searchFields = (query.searchFields || [])
          .map(field => String(field || '').trim())
          .filter(field => PERSONNEL_SEARCH_FIELDS.has(field));
        const fields = searchFields.length ? searchFields : ['name', 'code', 'position', 'phone', 'id_card_number'];
        const terms = fields.map((field) => `p.${field} LIKE ?`).join(' OR ');
        sql += ` AND (${terms})`;
        countSql += ` AND (${terms})`;
        const pattern = `%${query.search}%`;
        for (let i = 0; i < fields.length; i++) params.push(pattern);
      }

      sql += ' ORDER BY p.sort_order ASC, p.created_at DESC';
      const total = Number((db.prepare(countSql).get(...params) as { total: number } | undefined)?.total || 0);

      if (query.page !== undefined && query.pageSize !== undefined) {
        const offset = (query.page - 1) * query.pageSize;
        sql += ' LIMIT ? OFFSET ?';
        params.push(query.pageSize, offset);
      }

      const rows = db.prepare(sql).all(...params) as PersonnelRow[];
      const data = mapPersonnelRows(rows);
      return { data, total };
    },

    updatePersonnelSortOrder: (updates) => {
      ensurePersonnelSortOrder();
      const db = getDb();
      let changes = 0;
      const updateStmt = db.prepare('UPDATE personnel SET sort_order = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?');
      db.transaction(() => {
        for (const item of updates) {
          const info = updateStmt.run(item.sort_order, item.id);
          changes += info.changes;
        }
      })();
      return changes;
    },
    addPersonnelDocument: (payload) => {
      ensurePersonnelDocumentsSchema();
      const db = getDb();
      const id = crypto.randomUUID();
      const tx = db.transaction(() => {
        db.prepare(`
          INSERT INTO personnel_documents (
            id, personnel_id, doc_type, doc_name, doc_number, issuer, issue_date, expiry_date,
            file_paths_json, preview_image_path, ai_extract_json, ai_fill_status, is_primary
          ) VALUES (?, ?, ?, ?, '', '', '', '', ?, ?, ?, 'pending', 0)
        `).run(
          id,
          payload.personnelId,
          payload.docType,
          String(payload.manualDocName || '').trim() || '未命名证件',
          JSON.stringify(Array.isArray(payload.storedRelativePaths) ? payload.storedRelativePaths : []),
          String(payload.previewImageRelativePath || '').trim(),
          String(payload.aiExtractJson || '').trim(),
        );
      });
      tx();
      const row = db.prepare('SELECT * FROM personnel_documents WHERE id = ? LIMIT 1').get(id) as PersonnelDocumentRow | undefined;
      const document = row ? mapDocumentRows([row])[0] : null;
      if (!document) throw new Error('创建证件记录失败');
      return {
        document,
        draft: payload.draft || {},
      };
    },
    listPersonnelDocuments: (personnelId) => {
      ensurePersonnelDocumentsSchema();
      const db = getDb();
      const rows = db.prepare(`
        SELECT *
        FROM personnel_documents
        WHERE personnel_id = ?
          AND deleted_at IS NULL
        ORDER BY is_primary DESC, created_at DESC
      `).all(personnelId) as PersonnelDocumentRow[];
      return mapDocumentRows(rows);
    },
    updatePersonnelDocument: (dto) => {
      ensurePersonnelDocumentsSchema();
      const db = getDb();
      const fields: string[] = [];
      const values: unknown[] = [];
      const addField = (col: string, val: unknown) => {
        if (val === undefined) return;
        fields.push(`${col} = ?`);
        if (col === 'is_primary') {
          values.push(Number(val) ? 1 : 0);
        } else {
          values.push(String(val ?? '').trim());
        }
      };
      addField('doc_name', dto.doc_name);
      addField('doc_number', dto.doc_number);
      addField('issuer', dto.issuer);
      addField('issue_date', dto.issue_date);
      addField('expiry_date', dto.expiry_date);
      const row = db.prepare('SELECT * FROM personnel_documents WHERE id = ? AND deleted_at IS NULL LIMIT 1').get(dto.id) as PersonnelDocumentRow | undefined;
      if (!row) return null;
      const tx = db.transaction(() => {
        if (dto.is_primary !== undefined && Number(dto.is_primary) === 1) {
          db.prepare('UPDATE personnel_documents SET is_primary = 0 WHERE personnel_id = ? AND doc_type = ?').run(row.personnel_id, row.doc_type);
          fields.push('is_primary = ?');
          values.push(1);
        } else if (dto.is_primary !== undefined) {
          fields.push('is_primary = ?');
          values.push(0);
        }
        if (fields.length > 0) {
          fields.push('updated_at = CURRENT_TIMESTAMP');
          values.push(dto.id);
          db.prepare(`UPDATE personnel_documents SET ${fields.join(', ')} WHERE id = ?`).run(...values);
        }
      });
      tx();
      const updated = db.prepare('SELECT * FROM personnel_documents WHERE id = ? LIMIT 1').get(dto.id) as PersonnelDocumentRow | undefined;
      return updated ? mapDocumentRows([updated])[0] : null;
    },
    deletePersonnelDocument: (id) => {
      ensurePersonnelDocumentsSchema();
      const db = getDb();
      db.prepare('UPDATE personnel_documents SET deleted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(id);
    },
    applyPersonnelDocumentDraft: (dto) => {
      ensurePersonnelDocumentsSchema();
      const db = getDb();
      const fields: string[] = [];
      const values: unknown[] = [];
      const patch = dto.approvedPatch || {};
      const addPersonnelField = (col: string, val: unknown) => {
        if (val === undefined || val === null) return;
        const text = String(val).trim();
        if (!text) return;
        fields.push(`${col} = ?`);
        values.push(text);
      };
      addPersonnelField('id_card_number', patch.id_card_number);
      addPersonnelField('address', patch.address);
      addPersonnelField('birth_date', patch.birth_date);
      addPersonnelField('graduate_school', patch.graduate_school);
      addPersonnelField('education', patch.education);
      const docRow = db.prepare('SELECT * FROM personnel_documents WHERE id = ? AND deleted_at IS NULL LIMIT 1').get(dto.documentId) as PersonnelDocumentRow | undefined;
      if (!docRow) return null;
      const tx = db.transaction(() => {
        if (fields.length > 0) {
          fields.push('updated_at = CURRENT_TIMESTAMP');
          values.push(docRow.personnel_id);
          db.prepare(`UPDATE personnel SET ${fields.join(', ')} WHERE id = ?`).run(...values);
        }
        db.prepare(`UPDATE personnel_documents SET ai_fill_status = 'confirmed', updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(dto.documentId);
      });
      tx();
      return getPersonnelById(docRow.personnel_id);
    },
    rejectPersonnelDocumentDraft: (documentId) => {
      ensurePersonnelDocumentsSchema();
      const db = getDb();
      db.prepare(`UPDATE personnel_documents SET ai_fill_status = 'rejected', updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(documentId);
      const row = db.prepare('SELECT * FROM personnel_documents WHERE id = ? LIMIT 1').get(documentId) as PersonnelDocumentRow | undefined;
      return row ? mapDocumentRows([row])[0] : null;
    },
  };
}
