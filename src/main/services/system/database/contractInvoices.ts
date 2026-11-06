import * as crypto from 'crypto';
import type Database from 'better-sqlite3';
import type {
  ContractInvoice,
  ContractInvoiceCreateDTO,
  ContractInvoiceQueryDTO,
  ContractInvoiceQueryResult,
  ContractInvoiceUpdateDTO,
} from '../../../../shared/types/contractInvoice.types';

export type ContractInvoicesMethods = {
  createContractInvoice: (dto: ContractInvoiceCreateDTO) => ContractInvoice;
  updateContractInvoice: (dto: ContractInvoiceUpdateDTO) => ContractInvoice;
  deleteContractInvoice: (id: string) => void;
  restoreContractInvoice: (id: string) => void;
  purgeContractInvoice: (id: string) => void;
  getContractInvoiceById: (id: string, includeDeleted?: boolean) => ContractInvoice | null;
  getContractInvoices: (query: ContractInvoiceQueryDTO) => ContractInvoiceQueryResult;
  batchDeleteContractInvoice: (ids: string[]) => number;
  batchRestoreContractInvoice: (ids: string[]) => number;
  batchPurgeContractInvoice: (ids: string[]) => number;
};

export function createContractInvoicesMethods(getDb: () => Database.Database): ContractInvoicesMethods {
  const getContractInvoiceById = (id: string, includeDeleted = false): ContractInvoice | null => {
    const db = getDb();
    const sql = includeDeleted
      ? 'SELECT * FROM contract_invoices WHERE id = ?'
      : 'SELECT * FROM contract_invoices WHERE id = ? AND deleted_at IS NULL';
    return (db.prepare(sql).get(id) as ContractInvoice) || null;
  };

  return {
    createContractInvoice: (dto) => {
      const db = getDb();
      const id = crypto.randomUUID();
      db.prepare(`
        INSERT INTO contract_invoices (
          id,
          contract_id,
          contract_code,
          contract_name,
          file_id,
          source_sha256,
          source_path,
          invoice_type,
          invoice_code,
          invoice_no,
          invoice_date,
          issue_date,
          seller_name,
          seller_tax_no,
          buyer_name,
          buyer_tax_no,
          amount_without_tax,
          tax_amount,
          amount_with_tax,
          total_amount,
          invoice_items_json,
          remark,
          issuer_name,
          currency,
          parse_status,
          parse_confidence,
          parse_error,
          parse_errors,
          parse_engine,
          parse_result_json,
          raw_text_excerpt,
          parse_started_at,
          parse_finished_at
        ) VALUES (
          ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?,
          ?, ?, ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?,
          ?, ?, ?, ?
        )
      `).run(
        id,
        dto.contract_id,
        dto.contract_code,
        dto.contract_name,
        dto.file_id,
        dto.source_sha256,
        dto.source_path ?? null,
        dto.invoice_type ?? null,
        dto.invoice_code ?? null,
        dto.invoice_no ?? null,
        dto.invoice_date ?? null,
        dto.issue_date ?? null,
        dto.seller_name ?? null,
        dto.seller_tax_no ?? null,
        dto.buyer_name ?? null,
        dto.buyer_tax_no ?? null,
        dto.amount_without_tax ?? null,
        dto.tax_amount ?? null,
        dto.amount_with_tax ?? null,
        dto.total_amount ?? null,
        dto.invoice_items_json ?? null,
        dto.remark ?? null,
        dto.issuer_name ?? null,
        dto.currency ?? null,
        dto.parse_status ?? null,
        dto.parse_confidence ?? null,
        dto.parse_error ?? null,
        dto.parse_errors ?? null,
        dto.parse_engine ?? null,
        dto.parse_result_json ?? null,
        dto.raw_text_excerpt ?? null,
        dto.parse_started_at ?? null,
        dto.parse_finished_at ?? null,
      );
      return getContractInvoiceById(id);
    },

    updateContractInvoice: (dto) => {
      const db = getDb();
      const fields: string[] = [];
      const values: unknown[] = [];

      const addField = (col: string, val: unknown) => {
        if (val !== undefined) {
          fields.push(`${col} = ?`);
          values.push(val);
        }
      };

      addField('contract_id', dto.contract_id);
      addField('contract_code', dto.contract_code);
      addField('contract_name', dto.contract_name);
      addField('file_id', dto.file_id);
      addField('source_sha256', dto.source_sha256);
      addField('source_path', dto.source_path);
      addField('invoice_type', dto.invoice_type);
      addField('invoice_code', dto.invoice_code);
      addField('invoice_no', dto.invoice_no);
      addField('invoice_date', dto.invoice_date);
      addField('issue_date', dto.issue_date);
      addField('seller_name', dto.seller_name);
      addField('seller_tax_no', dto.seller_tax_no);
      addField('buyer_name', dto.buyer_name);
      addField('buyer_tax_no', dto.buyer_tax_no);
      addField('amount_without_tax', dto.amount_without_tax);
      addField('tax_amount', dto.tax_amount);
      addField('amount_with_tax', dto.amount_with_tax);
      addField('total_amount', dto.total_amount);
      addField('invoice_items_json', dto.invoice_items_json);
      addField('remark', dto.remark);
      addField('issuer_name', dto.issuer_name);
      addField('currency', dto.currency);
      addField('parse_status', dto.parse_status);
      addField('parse_confidence', dto.parse_confidence);
      addField('parse_error', dto.parse_error);
      addField('parse_errors', dto.parse_errors);
      addField('parse_engine', dto.parse_engine);
      addField('parse_result_json', dto.parse_result_json);
      addField('raw_text_excerpt', dto.raw_text_excerpt);
      addField('parse_started_at', dto.parse_started_at);
      addField('parse_finished_at', dto.parse_finished_at);

      if (fields.length === 0) return getContractInvoiceById(dto.id);

      fields.push('updated_at = CURRENT_TIMESTAMP');
      values.push(dto.id);

      db.prepare(`UPDATE contract_invoices SET ${fields.join(', ')} WHERE id = ?`).run(...values);
      return getContractInvoiceById(dto.id, true);
    },

    deleteContractInvoice: (id) => {
      const db = getDb();
      db.prepare('UPDATE contract_invoices SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?').run(id);
    },

    restoreContractInvoice: (id) => {
      const db = getDb();
      db.prepare('UPDATE contract_invoices SET deleted_at = NULL WHERE id = ?').run(id);
    },

    purgeContractInvoice: (id) => {
      const db = getDb();
      db.prepare('DELETE FROM contract_invoices WHERE id = ?').run(id);
    },

    getContractInvoiceById,

    getContractInvoices: (query) => {
      const db = getDb();
      let sql = 'SELECT * FROM contract_invoices WHERE 1=1';
      let countSql = 'SELECT COUNT(*) as total FROM contract_invoices WHERE 1=1';
      const params: unknown[] = [];

      if (!query.includeDeleted) {
        sql += ' AND deleted_at IS NULL';
        countSql += ' AND deleted_at IS NULL';
      }

      const contractId = String(query.contractId || '').trim();
      if (contractId) {
        sql += ' AND contract_id = ?';
        countSql += ' AND contract_id = ?';
        params.push(contractId);
      }

      const contractCode = String(query.contractCode || '').trim();
      if (contractCode) {
        sql += ' AND contract_code = ?';
        countSql += ' AND contract_code = ?';
        params.push(contractCode);
      }

      const fileId = String(query.fileId || '').trim();
      if (fileId) {
        sql += ' AND file_id = ?';
        countSql += ' AND file_id = ?';
        params.push(fileId);
      }

      const sourceSha256 = String(query.sourceSha256 || '').trim();
      if (sourceSha256) {
        sql += ' AND source_sha256 = ?';
        countSql += ' AND source_sha256 = ?';
        params.push(sourceSha256);
      }

      const invoiceNo = String(query.invoiceNo || '').trim();
      if (invoiceNo) {
        sql += ' AND invoice_no LIKE ?';
        countSql += ' AND invoice_no LIKE ?';
        params.push(`%${invoiceNo}%`);
      }

      const sellerName = String(query.sellerName || '').trim();
      if (sellerName) {
        sql += ' AND seller_name LIKE ?';
        countSql += ' AND seller_name LIKE ?';
        params.push(`%${sellerName}%`);
      }

      const buyerName = String(query.buyerName || '').trim();
      if (buyerName) {
        sql += ' AND buyer_name LIKE ?';
        countSql += ' AND buyer_name LIKE ?';
        params.push(`%${buyerName}%`);
      }

      const invoiceType = String(query.invoiceType || '').trim();
      if (invoiceType) {
        sql += ' AND invoice_type = ?';
        countSql += ' AND invoice_type = ?';
        params.push(invoiceType);
      }

      const parseStatus = String(query.parseStatus || '').trim();
      if (parseStatus) {
        sql += ' AND parse_status = ?';
        countSql += ' AND parse_status = ?';
        params.push(parseStatus);
      }

      const currency = String(query.currency || '').trim();
      if (currency) {
        sql += ' AND currency = ?';
        countSql += ' AND currency = ?';
        params.push(currency);
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

      const sortFieldMap: Record<string, string> = {
        contract_code: 'contract_code',
        contract_name: 'contract_name',
        invoice_no: 'invoice_no',
        issue_date: 'issue_date',
        amount_without_tax: 'amount_without_tax',
        tax_amount: 'tax_amount',
        total_amount: 'total_amount',
        created_at: 'created_at',
        updated_at: 'updated_at',
      };
      const requestedSortBy = String(query.sortBy || '').trim();
      const sortBy = sortFieldMap[requestedSortBy] || 'created_at';
      const sortOrder = String(query.sortOrder || '').toLowerCase() === 'asc' ? 'ASC' : 'DESC';
      sql += ` ORDER BY ${sortBy} ${sortOrder}`;

      const totalRow = db.prepare(countSql).get(...params) as { total: number };
      const total = totalRow.total;

      if (query.page !== undefined && query.pageSize !== undefined) {
        const offset = (query.page - 1) * query.pageSize;
        sql += ' LIMIT ? OFFSET ?';
        params.push(query.pageSize, offset);
      }

      const data = db.prepare(sql).all(...params) as ContractInvoice[];
      return { data, total };
    },

    batchDeleteContractInvoice: (ids) => {
      const db = getDb();
      if (!Array.isArray(ids) || ids.length === 0) return 0;
      const placeholders = ids.map(() => '?').join(',');
      const result = db.prepare(`UPDATE contract_invoices SET deleted_at = CURRENT_TIMESTAMP WHERE id IN (${placeholders})`).run(...ids);
      return result.changes;
    },

    batchRestoreContractInvoice: (ids) => {
      const db = getDb();
      if (!Array.isArray(ids) || ids.length === 0) return 0;
      const placeholders = ids.map(() => '?').join(',');
      const result = db.prepare(`UPDATE contract_invoices SET deleted_at = NULL WHERE id IN (${placeholders})`).run(...ids);
      return result.changes;
    },

    batchPurgeContractInvoice: (ids) => {
      const db = getDb();
      if (!Array.isArray(ids) || ids.length === 0) return 0;
      const placeholders = ids.map(() => '?').join(',');
      const result = db.prepare(`DELETE FROM contract_invoices WHERE id IN (${placeholders})`).run(...ids);
      return result.changes;
    },
  };
}
