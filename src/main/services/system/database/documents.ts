import type Database from 'better-sqlite3';
import type { Document, DocumentInsertDTO } from '../../../../shared/types/document.types';

export type DocumentsMethods = {
  insertDocument: (dto: DocumentInsertDTO) => Document;
  updateDocument: (id: string, updates: Partial<Pick<Document, 'name' | 'status' | 'checksum'>>) => Document;
  deleteDocument: (id: string) => void;
  getDocumentsByProject: (projectId: string) => Document[];
};

export function createDocumentsMethods(getDb: () => Database.Database): DocumentsMethods {
  return {
    insertDocument: (dto) => {
      const db = getDb();
      db.prepare(`
      INSERT INTO documents (id, project_id, category, name, file_name, file_path, file_size, file_type, is_required, checksum)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
        dto.id,
        dto.project_id,
        dto.category,
        dto.name,
        dto.file_name,
        dto.file_path,
        dto.file_size ?? null,
        dto.file_type ?? null,
        dto.is_required ?? 0,
        dto.checksum ?? null,
      );
      return db.prepare('SELECT * FROM documents WHERE id = ?').get(dto.id) as Document;
    },

    updateDocument: (id, updates) => {
      const db = getDb();
      const fields: string[] = [];
      const values: unknown[] = [];
      if (updates.name !== undefined) { fields.push('name = ?'); values.push(updates.name); }
      if (updates.status !== undefined) { fields.push('status = ?'); values.push(updates.status); }
      if (updates.checksum !== undefined) { fields.push('checksum = ?'); values.push(updates.checksum); }
      if (fields.length > 0) {
        fields.push('updated_at = CURRENT_TIMESTAMP');
        values.push(id);
        db.prepare(`UPDATE documents SET ${fields.join(', ')} WHERE id = ?`).run(...values);
      }
      return db.prepare('SELECT * FROM documents WHERE id = ?').get(id) as Document;
    },

    deleteDocument: (id) => {
      const db = getDb();
      db.prepare('DELETE FROM documents WHERE id = ?').run(id);
    },

    getDocumentsByProject: (projectId) => {
      const db = getDb();
      return db.prepare(
        "SELECT * FROM documents WHERE project_id = ? AND status = 'active' ORDER BY category, created_at",
      ).all(projectId) as Document[];
    },
  };
}

