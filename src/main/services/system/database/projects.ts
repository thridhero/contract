import * as crypto from 'crypto';
import type Database from 'better-sqlite3';
import type { Project, ProjectCreateDTO, ProjectUpdateDTO } from '../../../../shared/types/project.types';

export type ProjectsMethods = {
  createProject: (dto: ProjectCreateDTO) => Project;
  updateProject: (dto: ProjectUpdateDTO) => Project;
  deleteProject: (id: string) => void;
  restoreProject: (id: string) => void;
  purgeProject: (id: string) => void;
  getProject: (id: string) => Project | null;
  getAllProjects: (includeArchived?: boolean) => Project[];
  searchProjects: (term: string) => Project[];
  getProjectsByStatus: (status: string) => Project[];
};

export function createProjectsMethods(getDb: () => Database.Database): ProjectsMethods {
  const getProject = (id: string): Project | null => {
    const db = getDb();
    return (db.prepare('SELECT * FROM projects WHERE id = ? AND deleted_at IS NULL').get(id) as Project) ?? null;
  };

  return {
    createProject: (dto) => {
      const db = getDb();
      const id = crypto.randomUUID();
      db.prepare(`
      INSERT INTO projects (
        id, name, short_name, version, folder_path, status,
        applicant_type, applicant_name, applicant_cert_no,
        contact_person, contact_phone, contact_email, developer_name,
        completion_date, software_type, remark
      ) VALUES (
        ?, ?, ?, ?, ?, 'preparing',
        ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?
      )
    `).run(
        id,
        dto.name,
        dto.short_name ?? null,
        dto.version ?? 'V1.0',
        dto.folder_path,
        dto.applicant_type,
        dto.applicant_name,
        dto.applicant_cert_no ?? null,
        dto.contact_person ?? null,
        dto.contact_phone ?? null,
        dto.contact_email ?? null,
        dto.developer_name ?? null,
        dto.completion_date,
        dto.software_type ?? 'application',
        dto.remark ?? null,
      );
      return getProject(id)!;
    },

    updateProject: (dto) => {
      const db = getDb();
      const fields: string[] = [];
      const values: unknown[] = [];

      const addField = (col: string, val: unknown) => {
        if (val !== undefined) { fields.push(`${col} = ?`); values.push(val); }
      };

      addField('name', dto.name);
      addField('short_name', dto.short_name);
      addField('version', dto.version);
      addField('status', dto.status);
      addField('applicant_type', dto.applicant_type);
      addField('applicant_name', dto.applicant_name);
      addField('applicant_cert_no', dto.applicant_cert_no);
      addField('contact_person', dto.contact_person);
      addField('contact_phone', dto.contact_phone);
      addField('contact_email', dto.contact_email);
      addField('developer_name', dto.developer_name);
      addField('completion_date', dto.completion_date);
      addField('software_type', dto.software_type);
      addField('application_no', dto.application_no);
      addField('registration_no', dto.registration_no);
      addField('certificate_no', dto.certificate_no);
      addField('submit_date', dto.submit_date);
      addField('accept_date', dto.accept_date);
      addField('approval_date', dto.approval_date);
      addField('fee_amount', dto.fee_amount);
      addField('fee_paid_date', dto.fee_paid_date);
      addField('remark', dto.remark);
      addField('is_archived', dto.is_archived);

      if (fields.length === 0) return getProject(dto.id)!;

      fields.push('updated_at = CURRENT_TIMESTAMP');
      values.push(dto.id);

      db.prepare(
        `UPDATE projects SET ${fields.join(', ')} WHERE id = ?`,
      ).run(...values);

      return getProject(dto.id)!;
    },

    deleteProject: (id) => {
      const db = getDb();
      db.prepare('UPDATE projects SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?').run(id);
    },

    restoreProject: (id) => {
      const db = getDb();
      db.prepare('UPDATE projects SET deleted_at = NULL WHERE id = ?').run(id);
    },

    purgeProject: (id) => {
      const db = getDb();
      db.prepare('DELETE FROM projects WHERE id = ?').run(id);
    },

    getProject,

    getAllProjects: (includeArchived = false) => {
      const db = getDb();
      const whereParts = ['deleted_at IS NULL', includeArchived ? '' : 'is_archived = 0'].filter(Boolean);
      const where = whereParts.length > 0 ? `WHERE ${whereParts.join(' AND ')}` : '';
      const sql = `SELECT * FROM projects ${where} ORDER BY created_at DESC`;
      return db.prepare(sql).all() as Project[];
    },

    searchProjects: (term) => {
      const db = getDb();
      const pattern = `%${term}%`;
      const whereParts = [
        '(name LIKE ? OR applicant_name LIKE ? OR application_no LIKE ?)',
        'is_archived = 0',
        'deleted_at IS NULL',
      ].filter(Boolean);
      return db.prepare(
        `SELECT * FROM projects WHERE ${whereParts.join(' AND ')} ORDER BY created_at DESC`,
      ).all(pattern, pattern, pattern) as Project[];
    },

    getProjectsByStatus: (status) => {
      const db = getDb();
      const whereParts = ['status = ?', 'is_archived = 0', 'deleted_at IS NULL'].filter(Boolean);
      return db.prepare(
        `SELECT * FROM projects WHERE ${whereParts.join(' AND ')} ORDER BY created_at DESC`,
      ).all(status) as Project[];
    },
  };
}

