import * as crypto from 'crypto';
import type Database from 'better-sqlite3';
import type { Customer, CustomerCreateDTO, CustomerQueryDTO, CustomerQueryResult, CustomerUpdateDTO } from '../../../../shared/types/customer.types';

export type CustomersMethods = {
  createCustomer: (dto: CustomerCreateDTO) => Customer;
  updateCustomer: (dto: CustomerUpdateDTO) => Customer;
  deleteCustomer: (id: string) => void;
  restoreCustomer: (id: string) => void;
  purgeCustomer: (id: string) => void;
  getCustomerById: (id: string) => Customer;
  getCustomers: (query: CustomerQueryDTO) => CustomerQueryResult;
};

export function createCustomersMethods(getDb: () => Database.Database): CustomersMethods {
  const getCustomerById = (id: string): Customer => {
    const db = getDb();
    return (db.prepare('SELECT * FROM customers WHERE id = ? AND deleted_at IS NULL').get(id) as Customer) || null;
  };

  return {
    createCustomer: (dto) => {
      const db = getDb();
      const id = crypto.randomUUID();
      db.prepare(`
      INSERT INTO customers (
        id, group_name, code, name, contact, department, mobile, wechat, phone, fax, email, address, msn, company_type, industry, products, website, capital, country, province, city, reg_date, legal_rep_name, legal_rep_id_number, legal_rep_mobile, legal_rep_email, tax_number, bank_name, bank_account, invoice_type, custom1, custom2, custom3, custom4, contacts
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
        id,
        dto.group_name || '',
        dto.code || '',
        dto.name || '',
        dto.contact || '',
        dto.department || '',
        dto.mobile || '',
        dto.wechat || '',
        dto.phone || '',
        dto.fax || '',
        dto.email || '',
        dto.address || '',
        dto.msn || '',
        dto.company_type || '',
        dto.industry || '',
        dto.products || '',
        dto.website || '',
        dto.capital || '',
        dto.country || '',
        dto.province || '',
        dto.city || '',
        dto.reg_date || '',
        dto.legal_rep_name || '',
        dto.legal_rep_id_number || '',
        dto.legal_rep_mobile || '',
        dto.legal_rep_email || '',
        dto.tax_number || '',
        dto.bank_name || '',
        dto.bank_account || '',
        dto.invoice_type || '',
        dto.custom1 || '',
        dto.custom2 || '',
        dto.custom3 || '',
        dto.custom4 || '',
        dto.contacts || '[]',
      );
      return getCustomerById(id);
    },

    updateCustomer: (dto) => {
      const db = getDb();
      const fields: string[] = [];
      const values: unknown[] = [];

      const addField = (col: string, val: unknown) => {
        if (val !== undefined) { fields.push(`${col} = ?`); values.push(val); }
      };

      addField('group_name', dto.group_name);
      addField('code', dto.code);
      addField('name', dto.name);
      addField('contact', dto.contact);
      addField('department', dto.department);
      addField('mobile', dto.mobile);
      addField('wechat', dto.wechat);
      addField('phone', dto.phone);
      addField('fax', dto.fax);
      addField('email', dto.email);
      addField('address', dto.address);
      addField('msn', dto.msn);
      addField('company_type', dto.company_type);
      addField('industry', dto.industry);
      addField('products', dto.products);
      addField('website', dto.website);
      addField('capital', dto.capital);
      addField('country', dto.country);
      addField('province', dto.province);
      addField('city', dto.city);
      addField('reg_date', dto.reg_date);
      addField('legal_rep_name', dto.legal_rep_name);
      addField('legal_rep_id_number', dto.legal_rep_id_number);
      addField('legal_rep_mobile', dto.legal_rep_mobile);
      addField('legal_rep_email', dto.legal_rep_email);
      addField('tax_number', dto.tax_number);
      addField('bank_name', dto.bank_name);
      addField('bank_account', dto.bank_account);
      addField('invoice_type', dto.invoice_type);
      addField('custom1', dto.custom1);
      addField('custom2', dto.custom2);
      addField('custom3', dto.custom3);
      addField('custom4', dto.custom4);
      addField('contacts', dto.contacts);

      if (fields.length === 0) return getCustomerById(dto.id);

      fields.push('updated_at = CURRENT_TIMESTAMP');
      values.push(dto.id);

      db.prepare(`UPDATE customers SET ${fields.join(', ')} WHERE id = ?`).run(...values);
      return getCustomerById(dto.id);
    },

    deleteCustomer: (id) => {
      const db = getDb();
      db.prepare('UPDATE customers SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?').run(id);
    },

    restoreCustomer: (id) => {
      const db = getDb();
      db.prepare('UPDATE customers SET deleted_at = NULL WHERE id = ?').run(id);
    },

    purgeCustomer: (id) => {
      const db = getDb();
      db.prepare('DELETE FROM customers WHERE id = ?').run(id);
    },

    getCustomerById,

    getCustomers: (query) => {
      const db = getDb();

      let sql = 'SELECT * FROM customers WHERE deleted_at IS NULL';
      let countSql = 'SELECT COUNT(*) as total FROM customers WHERE deleted_at IS NULL';
      const params: unknown[] = [];

      if (query.useGroupFilter && query.group_name && query.group_name !== '所有分组') {
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

      const data = db.prepare(sql).all(...params) as Customer[];
      return { data, total };
    },
  };
}
