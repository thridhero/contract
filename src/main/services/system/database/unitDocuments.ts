import * as crypto from 'crypto';
import type Database from 'better-sqlite3';
import { migrateCustomerSchema, migrateSupplierSchema, migrateUnitDocumentSchema } from '../librarySchemaMigration/relatedSchemas';
import { getTableColumns } from '../librarySchemaMigration/shared';
import type { Customer } from '../../../../shared/types/customer.types';
import type { Supplier } from '../../../../shared/types/supplier.types';
import type {
  UnitDocument,
  UnitDocumentApplyDraftDTO,
  UnitDocumentCreateRequest,
  UnitDocumentCreateResult,
  UnitDocumentOwnerType,
  UnitDocumentPatchDraft,
  UnitDocumentUpdateDTO,
} from '../../../../shared/types/unitDocument.types';

type UnitDocumentRow = Omit<UnitDocument, 'file_paths'> & {
  file_paths_json: string;
};

type UnitDocumentOwner = Customer | Supplier | null;

export type UnitDocumentsMethods = {
  addUnitDocument: (payload: UnitDocumentCreateRequest & { storedRelativePaths: string[]; previewImageRelativePath?: string; aiExtractJson?: string; draft?: UnitDocumentPatchDraft }) => UnitDocumentCreateResult;
  listUnitDocuments: (ownerType: UnitDocumentOwnerType, ownerId: string) => UnitDocument[];
  updateUnitDocument: (dto: UnitDocumentUpdateDTO) => UnitDocument | null;
  deleteUnitDocument: (id: string) => void;
  applyUnitDocumentDraft: (dto: UnitDocumentApplyDraftDTO) => UnitDocumentOwner;
  rejectUnitDocumentDraft: (documentId: string) => UnitDocument | null;
};

const mapUnitDocumentRows = (rows: UnitDocumentRow[]): UnitDocument[] => rows.map((row) => {
  let filePaths: string[] = [];
  try {
    const parsed = JSON.parse(String(row.file_paths_json || '[]')) as unknown;
    if (Array.isArray(parsed)) {
      filePaths = parsed.map(item => String(item || '').trim()).filter(Boolean);
    }
  } catch {}
  return {
    ...row,
    file_paths: filePaths,
  };
});

export function createUnitDocumentsMethods(
  getDb: () => Database.Database,
  getCustomerById: (id: string) => Customer | null,
  getSupplierById: (id: string) => Supplier | null,
): UnitDocumentsMethods {
  let schemaChecked = false;

  const ensureSchema = () => {
    if (schemaChecked) return;
    migrateCustomerSchema(getDb());
    migrateSupplierSchema(getDb());
    migrateUnitDocumentSchema(getDb());
    schemaChecked = true;
  };

  const getOwner = (ownerType: UnitDocumentOwnerType, ownerId: string): UnitDocumentOwner => (
    ownerType === 'customer' ? getCustomerById(ownerId) : getSupplierById(ownerId)
  );

  const getDocumentById = (id: string): UnitDocument | null => {
    ensureSchema();
    const row = getDb().prepare('SELECT * FROM unit_documents WHERE id = ? LIMIT 1').get(id) as UnitDocumentRow | undefined;
    return row ? mapUnitDocumentRows([row])[0] : null;
  };

  const syncLegalRepresentativeToContacts = (ownerType: UnitDocumentOwnerType, ownerId: string, legalRepName?: string) => {
    const normalizedName = String(legalRepName || '').trim();
    if (!normalizedName) return;
    const db = getDb();
    const tableName = ownerType === 'customer' ? 'customers' : 'suppliers';
    const row = db.prepare(`SELECT contacts FROM ${tableName} WHERE id = ? AND deleted_at IS NULL LIMIT 1`).get(ownerId) as { contacts?: string } | undefined;
    const rawContacts = String(row?.contacts || '[]').trim();
    let contacts: Array<Record<string, unknown>> = [];
    try {
      const parsed = JSON.parse(rawContacts) as unknown;
      if (Array.isArray(parsed)) {
        contacts = parsed
          .filter(item => item && typeof item === 'object')
          .map(item => ({ ...(item as Record<string, unknown>) }));
      }
    } catch {
      contacts = [];
    }

    let legalIndex = contacts.findIndex(item => Boolean(item.is_legal_representative));
    if (legalIndex < 0) {
      legalIndex = contacts.findIndex(item => String(item.department || '').trim() === '法人');
    }
    if (legalIndex < 0) {
      legalIndex = contacts.findIndex(item => String(item.name || '').trim() === normalizedName);
    }

    if (legalIndex >= 0) {
      const existing = contacts[legalIndex] || {};
      contacts[legalIndex] = {
        ...existing,
        id: String(existing.id || crypto.randomUUID()),
        name: normalizedName,
        department: String(existing.department || '').trim() || '法人',
        is_legal_representative: true,
        is_primary: Boolean(existing.is_primary),
      };
    } else {
      const hasPrimary = contacts.some(item => Boolean(item.is_primary));
      contacts.push({
        id: crypto.randomUUID(),
        name: normalizedName,
        department: '法人',
        mobile: '',
        phone: '',
        email: '',
        id_number: '',
        ...(ownerType === 'supplier' ? { wechat: '' } : {}),
        is_legal_representative: true,
        is_primary: !hasPrimary,
      });
    }

    db.prepare(`UPDATE ${tableName} SET contacts = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
      .run(JSON.stringify(contacts), ownerId);
  };

  return {
    addUnitDocument: (payload) => {
      ensureSchema();
      const db = getDb();
      const id = crypto.randomUUID();
      db.prepare(`
        INSERT INTO unit_documents (
          id, owner_type, owner_id, doc_type, doc_name, doc_number, issuer, issue_date, expiry_date,
          file_paths_json, preview_image_path, ai_extract_json, ai_fill_status, is_primary
        ) VALUES (?, ?, ?, ?, ?, '', '', '', '', ?, ?, ?, 'pending', 0)
      `).run(
        id,
        payload.ownerType,
        payload.ownerId,
        payload.docType,
        String(payload.manualDocName || '').trim() || '未命名证件',
        JSON.stringify(Array.isArray(payload.storedRelativePaths) ? payload.storedRelativePaths : []),
        String(payload.previewImageRelativePath || '').trim(),
        String(payload.aiExtractJson || '').trim(),
      );
      const document = getDocumentById(id);
      if (!document) throw new Error('创建单位证件记录失败');
      return { document, draft: payload.draft || {} };
    },
    listUnitDocuments: (ownerType, ownerId) => {
      ensureSchema();
      const rows = getDb().prepare(`
        SELECT *
        FROM unit_documents
        WHERE owner_type = ?
          AND owner_id = ?
          AND deleted_at IS NULL
        ORDER BY is_primary DESC, created_at DESC
      `).all(ownerType, ownerId) as UnitDocumentRow[];
      return mapUnitDocumentRows(rows);
    },
    updateUnitDocument: (dto) => {
      ensureSchema();
      const db = getDb();
      const row = db.prepare('SELECT * FROM unit_documents WHERE id = ? AND deleted_at IS NULL LIMIT 1').get(dto.id) as UnitDocumentRow | undefined;
      if (!row) return null;
      const fields: string[] = [];
      const values: unknown[] = [];
      const addField = (col: string, val: unknown) => {
        if (val === undefined) return;
        fields.push(`${col} = ?`);
        values.push(col === 'is_primary' ? (Number(val) ? 1 : 0) : String(val ?? '').trim());
      };
      addField('doc_name', dto.doc_name);
      addField('doc_number', dto.doc_number);
      addField('issuer', dto.issuer);
      addField('issue_date', dto.issue_date);
      addField('expiry_date', dto.expiry_date);
      const tx = db.transaction(() => {
        if (dto.is_primary !== undefined && Number(dto.is_primary) === 1) {
          db.prepare('UPDATE unit_documents SET is_primary = 0 WHERE owner_type = ? AND owner_id = ? AND doc_type = ?').run(row.owner_type, row.owner_id, row.doc_type);
          fields.push('is_primary = ?');
          values.push(1);
        } else if (dto.is_primary !== undefined) {
          fields.push('is_primary = ?');
          values.push(0);
        }
        if (fields.length > 0) {
          fields.push('updated_at = CURRENT_TIMESTAMP');
          values.push(dto.id);
          db.prepare(`UPDATE unit_documents SET ${fields.join(', ')} WHERE id = ?`).run(...values);
        }
      });
      tx();
      return getDocumentById(dto.id);
    },
    deleteUnitDocument: (id) => {
      ensureSchema();
      getDb().prepare('UPDATE unit_documents SET deleted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(id);
    },
    applyUnitDocumentDraft: (dto) => {
      ensureSchema();
      const db = getDb();
      const doc = db.prepare('SELECT * FROM unit_documents WHERE id = ? AND deleted_at IS NULL LIMIT 1').get(dto.documentId) as UnitDocumentRow | undefined;
      if (!doc) return null;
      const patch = dto.approvedPatch || {};
      const editableColumns = new Set(getTableColumns(db, doc.owner_type === 'customer' ? 'customers' : 'suppliers'));
      const fields: string[] = [];
      const values: unknown[] = [];
      const addField = (col: string, val: unknown) => {
        if (val === undefined || val === null) return;
        if (!editableColumns.has(col)) return;
        const text = String(val).trim();
        if (!text) return;
        fields.push(`${col} = ?`);
        values.push(text);
      };
      addField('name', patch.name);
      addField('tax_number', patch.tax_number);
      addField('legal_rep_name', patch.legal_rep_name);
      addField('address', patch.address);
      addField('reg_date', patch.reg_date);
      if (doc.owner_type === 'customer') {
        addField('company_type', patch.company_type);
      }
      const tableName = doc.owner_type === 'customer' ? 'customers' : 'suppliers';
      const tx = db.transaction(() => {
        if (fields.length > 0) {
          fields.push('updated_at = CURRENT_TIMESTAMP');
          values.push(doc.owner_id);
          db.prepare(`UPDATE ${tableName} SET ${fields.join(', ')} WHERE id = ?`).run(...values);
        }
        syncLegalRepresentativeToContacts(doc.owner_type, doc.owner_id, patch.legal_rep_name);
        db.prepare(`UPDATE unit_documents SET ai_fill_status = 'confirmed', updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(dto.documentId);
      });
      tx();
      return getOwner(doc.owner_type, doc.owner_id);
    },
    rejectUnitDocumentDraft: (documentId) => {
      ensureSchema();
      const db = getDb();
      db.prepare(`UPDATE unit_documents SET ai_fill_status = 'rejected', updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(documentId);
      return getDocumentById(documentId);
    },
  };
}
