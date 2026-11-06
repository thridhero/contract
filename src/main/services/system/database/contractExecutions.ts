import * as crypto from 'crypto';
import type Database from 'better-sqlite3';
import type { ContractExecution, ContractExecutionCreateDTO, ContractExecutionQueryDTO, ContractExecutionQueryResult, ContractExecutionUpdateDTO } from '../../../../shared/types/contractExecution.types';

export type ContractExecutionsMethods = {
  createContractExecution: (dto: ContractExecutionCreateDTO) => ContractExecution;
  updateContractExecution: (dto: ContractExecutionUpdateDTO) => ContractExecution;
  deleteContractExecution: (id: string) => void;
  restoreContractExecution: (id: string) => void;
  purgeContractExecution: (id: string) => void;
  getContractExecutionById: (id: string, includeDeleted?: boolean) => ContractExecution;
  getContractExecutions: (query: ContractExecutionQueryDTO) => ContractExecutionQueryResult;
};

export function createContractExecutionsMethods(getDb: () => Database.Database): ContractExecutionsMethods {
  const getContractExecutionById = (id: string, includeDeleted = false): ContractExecution => {
    const db = getDb();
    return (db.prepare('SELECT * FROM contract_executions WHERE id = ? AND deleted_at IS NULL').get(id) as ContractExecution) || null;
  };

  return {
    createContractExecution: (dto) => {
      const db = getDb();
      const id = crypto.randomUUID();
      db.prepare(`
      INSERT INTO contract_executions (
        id, contract_id, contract_code, contract_name, execution_time, execution_status, salesperson, content, register_date, progress, remark, custom2, custom3, custom4
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
        id,
        dto.contract_id ?? '',
        dto.contract_code ?? '',
        dto.contract_name ?? '',
        dto.execution_time ?? '',
        dto.execution_status ?? '',
        dto.salesperson ?? '',
        dto.content ?? '',
        dto.register_date ?? '',
        dto.progress ?? '',
        dto.remark ?? '',
        dto.custom2 ?? '',
        dto.custom3 ?? '',
        dto.custom4 ?? '',
      );
      return getContractExecutionById(id);
    },

    updateContractExecution: (dto) => {
      const db = getDb();
      const fields: string[] = [];
      const values: unknown[] = [];

      const addField = (col: string, val: unknown) => {
        if (val !== undefined) { fields.push(`${col} = ?`); values.push(val); }
      };

      addField('contract_id', dto.contract_id);
      addField('contract_code', dto.contract_code);
      addField('contract_name', dto.contract_name);
      addField('execution_time', dto.execution_time);
      addField('execution_status', dto.execution_status);
      addField('salesperson', dto.salesperson);
      addField('content', dto.content);
      addField('register_date', dto.register_date);
      addField('progress', dto.progress);
      addField('remark', dto.remark);
      addField('custom2', dto.custom2);
      addField('custom3', dto.custom3);
      addField('custom4', dto.custom4);

      if (fields.length === 0) return getContractExecutionById(dto.id);

      fields.push('updated_at = CURRENT_TIMESTAMP');
      values.push(dto.id);

      db.prepare(`UPDATE contract_executions SET ${fields.join(', ')} WHERE id = ?`).run(...values);
      return getContractExecutionById(dto.id);
    },

    deleteContractExecution: (id) => {
      const db = getDb();
      db.prepare('UPDATE contract_executions SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?').run(id);
    },

    restoreContractExecution: (id) => {
      const db = getDb();
      db.prepare('UPDATE contract_executions SET deleted_at = NULL WHERE id = ?').run(id);
    },

    purgeContractExecution: (id) => {
      const db = getDb();
      db.prepare('DELETE FROM contract_executions WHERE id = ?').run(id);
    },

    getContractExecutionById,

    getContractExecutions: (query) => {
      const db = getDb();
      let sql = 'SELECT * FROM contract_executions WHERE 1=1';
      let countSql = 'SELECT COUNT(*) as total FROM contract_executions WHERE 1=1';
      const params: unknown[] = [];

      sql += ' AND deleted_at IS NULL';
      countSql += ' AND deleted_at IS NULL';

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

      const data = db.prepare(sql).all(...params) as ContractExecution[];
      return { data, total };
    },
  };
}

