import * as crypto from 'crypto';
import type Database from 'better-sqlite3';
import type { Supplier, SupplierCreateDTO, SupplierQueryDTO, SupplierQueryResult, SupplierUpdateDTO } from '../../../../shared/types/supplier.types';

export type SuppliersMethods = {
  createSupplier: (dto: SupplierCreateDTO) => Supplier;
  updateSupplier: (dto: SupplierUpdateDTO) => Supplier;
  deleteSupplier: (id: string) => void;
  restoreSupplier: (id: string) => void;
  purgeSupplier: (id: string) => void;
  getSupplierById: (id: string) => Supplier;
  getSuppliers: (query: SupplierQueryDTO) => SupplierQueryResult;
};

export function createSuppliersMethods(getDb: () => Database.Database): SuppliersMethods {
  const getSupplierById = (id: string): Supplier => {
    const db = getDb();
    return (db.prepare('SELECT * FROM suppliers WHERE id = ? AND deleted_at IS NULL').get(id) as Supplier) || null;
  };

  return {
    createSupplier: (dto) => {
      const db = getDb();
      const id = crypto.randomUUID();
      db.prepare(`
      INSERT INTO suppliers (
        id, code, name, contact, group_name, bank_account, bank_name, phone, address, tax_number, invoice_type, reg_date, legal_rep_name, legal_rep_id_number, legal_rep_mobile, legal_rep_email, contacts
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
        id,
        dto.code || '',
        dto.name || '',
        dto.contact || '',
        dto.group_name || '',
        dto.bank_account || '',
        dto.bank_name || '',
        dto.phone || '',
        dto.address || '',
        dto.tax_number || '',
        dto.invoice_type || '',
        dto.reg_date || '',
        dto.legal_rep_name || '',
        dto.legal_rep_id_number || '',
        dto.legal_rep_mobile || '',
        dto.legal_rep_email || '',
        dto.contacts || '[]',
      );
      return getSupplierById(id);
    },

    updateSupplier: (dto) => {
      const db = getDb();
      const fields: string[] = [];
      const values: unknown[] = [];

      const addField = (col: string, val: unknown) => {
        if (val !== undefined) { fields.push(`${col} = ?`); values.push(val); }
      };

      addField('code', dto.code);
      addField('name', dto.name);
      addField('contact', dto.contact);
      addField('group_name', dto.group_name);
      addField('bank_account', dto.bank_account);
      addField('bank_name', dto.bank_name);
      addField('phone', dto.phone);
      addField('address', dto.address);
      addField('tax_number', dto.tax_number);
      addField('invoice_type', dto.invoice_type);
      addField('reg_date', dto.reg_date);
      addField('legal_rep_name', dto.legal_rep_name);
      addField('legal_rep_id_number', dto.legal_rep_id_number);
      addField('legal_rep_mobile', dto.legal_rep_mobile);
      addField('legal_rep_email', dto.legal_rep_email);
      addField('contacts', dto.contacts);

      if (fields.length === 0) return getSupplierById(dto.id);

      fields.push('updated_at = CURRENT_TIMESTAMP');
      values.push(dto.id);

      db.prepare(`UPDATE suppliers SET ${fields.join(', ')} WHERE id = ?`).run(...values);
      return getSupplierById(dto.id);
    },

    deleteSupplier: (id) => {
      const db = getDb();
      db.prepare('UPDATE suppliers SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?').run(id);
    },

    restoreSupplier: (id) => {
      const db = getDb();
      db.prepare('UPDATE suppliers SET deleted_at = NULL WHERE id = ?').run(id);
    },

    purgeSupplier: (id) => {
      const db = getDb();
      db.prepare('DELETE FROM suppliers WHERE id = ?').run(id);
    },

    getSupplierById,

    getSuppliers: (query) => {
      const db = getDb();

      let sql = 'SELECT * FROM suppliers WHERE deleted_at IS NULL';
      let countSql = 'SELECT COUNT(*) as total FROM suppliers WHERE deleted_at IS NULL';
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

      sql += ' ORDER BY created_at DESC';

      const totalRow = db.prepare(countSql).get(...params) as { total: number };
      const total = totalRow.total;

      if (query.page !== undefined && query.pageSize !== undefined) {
        const offset = (query.page - 1) * query.pageSize;
        sql += ' LIMIT ? OFFSET ?';
        params.push(query.pageSize, offset);
      }

      const data = db.prepare(sql).all(...params) as Supplier[];
      return { data, total };
    },
  };
}

