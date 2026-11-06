import * as crypto from 'crypto';
import type Database from 'better-sqlite3';
import type {
  ContractProduct,
  ContractProductCreateDTO,
  ContractProductQueryDTO,
  ContractProductQueryResult,
  ContractProductUpdateDTO,
} from '../../../../shared/types/contractProduct.types';

export type ContractProductsMethods = {
  createContractProduct: (dto: ContractProductCreateDTO) => ContractProduct;
  updateContractProduct: (dto: ContractProductUpdateDTO) => ContractProduct;
  deleteContractProduct: (id: string) => void;
  restoreContractProduct: (id: string) => void;
  purgeContractProduct: (id: string) => void;
  getContractProductById: (id: string, includeDeleted?: boolean) => ContractProduct;
  getContractProducts: (query: ContractProductQueryDTO) => ContractProductQueryResult;
};

type ProductCalendarEventSeverity = 'info' | 'warning' | 'danger';

type ProductCalendarSourceRow = {
  id: string;
  contract_id: string | null;
  contract_code: string | null;
  contract_name: string | null;
  code: string | null;
  name: string | null;
  purchase_date: string | null;
  warranty_date: string | null;
  customer_name: string | null;
  supplier_name: string | null;
  deleted_at: string | null;
  contract_type: string | null;
};

function normalizeToYmd(value: unknown): string | null {
  const raw = String(value || '').trim();
  if (!raw) return null;
  const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) {
    const year = Number(m[1]);
    const month = Number(m[2]);
    const day = Number(m[3]);
    if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null;
    if (month < 1 || month > 12) return null;
    if (day < 1 || day > 31) return null;
    return `${m[1]}-${m[2]}-${m[3]}`;
  }
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return null;
  const y = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${y}-${mm}-${dd}`;
}

function severityForProductEventKey(eventKey: string): ProductCalendarEventSeverity {
  if (eventKey === 'product:warranty_date') return 'warning';
  return 'info';
}

function buildProductEvents(row: ProductCalendarSourceRow): Array<{
  event_key: string;
  event_date: string;
  title: string;
  content: string | null;
  severity: ProductCalendarEventSeverity;
  meta: string | null;
}> {
  const productName = String(row.name || '').trim() || '未命名产品';
  const productCode = String(row.code || '').trim();
  const contractCode = String(row.contract_code || '').trim();
  const contractName = String(row.contract_name || '').trim();

  const baseMeta = {
    source_type: 'contract_product',
    source_id: row.id,
    source_category: 'product',
    contract_id: String(row.contract_id || '').trim(),
    contract_code: contractCode,
    contract_name: contractName,
    contract_type: String(row.contract_type || '').trim(),
    party_a: String(row.customer_name || '').trim(),
    party_b: String(row.supplier_name || '').trim(),
    product_id: row.id,
    product_code: productCode,
    product_name: productName,
  };

  const events: Array<{ event_key: string; raw_date: unknown; titlePrefix: string }> = [
    { event_key: 'product:purchase_date', raw_date: row.purchase_date, titlePrefix: '产品采购' },
    { event_key: 'product:warranty_date', raw_date: row.warranty_date, titlePrefix: '产品维保' },
  ];

  const result: Array<{
    event_key: string;
    event_date: string;
    title: string;
    content: string | null;
    severity: ProductCalendarEventSeverity;
    meta: string | null;
  }> = [];

  for (const e of events) {
    const date = normalizeToYmd(e.raw_date);
    if (!date) continue;
    const meta = JSON.stringify({ ...baseMeta, event_key: e.event_key });
    result.push({
      event_key: e.event_key,
      event_date: date,
      title: `${e.titlePrefix}：${productName}`,
      content: contractCode ? `合同编号：${contractCode}` : null,
      severity: severityForProductEventKey(e.event_key),
      meta,
    });
  }

  return result;
}

function markProductCalendarEventsDeletedById(db: Database.Database, productId: string): void {
  const id = String(productId || '').trim();
  if (!id) return;
  db.prepare(`
    UPDATE calendar_events
    SET deleted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
    WHERE source_type = 'contract_product' AND source_id = ? AND deleted_at IS NULL
  `).run(id);
}

function syncProductCalendarEventsById(db: Database.Database, productId: string): void {
  const id = String(productId || '').trim();
  if (!id) return;

  const row = db.prepare(`
    SELECT
      p.id,
      p.contract_id,
      p.contract_code,
      p.contract_name,
      p.code,
      p.name,
      p.purchase_date,
      p.warranty_date,
      p.customer_name,
      p.supplier_name,
      p.deleted_at,
      c.contract_type
    FROM contract_products p
    LEFT JOIN contract_info c ON c.id = p.contract_id
    WHERE p.id = ?
    LIMIT 1
  `).get(id) as ProductCalendarSourceRow | undefined;

  if (!row || row.deleted_at) {
    markProductCalendarEventsDeletedById(db, id);
    return;
  }

  const nextEvents = buildProductEvents(row);
  const keys = nextEvents.map((e) => e.event_key);

  const upsert = db.prepare(`
    INSERT INTO calendar_events (
      id,
      source_type,
      source_id,
      event_key,
      event_date,
      title,
      content,
      severity,
      meta,
      deleted_at
    ) VALUES (
      ?, 'contract_product', ?, ?, ?, ?, ?, ?, ?, NULL
    )
    ON CONFLICT(source_type, source_id, event_key) DO UPDATE SET
      event_date = excluded.event_date,
      title = excluded.title,
      content = excluded.content,
      severity = excluded.severity,
      meta = excluded.meta,
      deleted_at = NULL,
      updated_at = CURRENT_TIMESTAMP
  `);

  for (const ev of nextEvents) {
    upsert.run(
      crypto.randomUUID(),
      id,
      ev.event_key,
      ev.event_date,
      ev.title,
      ev.content,
      ev.severity,
      ev.meta,
    );
  }

  if (!keys.length) {
    markProductCalendarEventsDeletedById(db, id);
    return;
  }

  const placeholders = keys.map(() => '?').join(',');
  db.prepare(`
    UPDATE calendar_events
    SET deleted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
    WHERE source_type = 'contract_product'
      AND source_id = ?
      AND event_key NOT IN (${placeholders})
      AND deleted_at IS NULL
  `).run(id, ...keys);
}

export function createContractProductsMethods(getDb: () => Database.Database): ContractProductsMethods {
  const getContractProductById = (id: string, includeDeleted = false): ContractProduct => {
    const db = getDb();
    const sql = includeDeleted
      ? 'SELECT * FROM contract_products WHERE id = ?'
      : 'SELECT * FROM contract_products WHERE id = ? AND deleted_at IS NULL';
    return (db.prepare(sql).get(id) as ContractProduct) || null;
  };

  return {
    createContractProduct: (dto) => {
      const db = getDb();
      const name = String(dto.name || '').trim();
      if (name) {
        const existed = db.prepare('SELECT id FROM contract_products WHERE name = ? AND deleted_at IS NULL LIMIT 1').get(name) as { id?: string } | undefined;
        if (existed?.id) {
          throw new Error('名称已存在');
        }
      }
      const id = crypto.randomUUID();
      db.prepare(`
      INSERT INTO contract_products (
        id, contract_id, contract_code, contract_name, code, name, category, specification, unit, unit_price, quantity, cost_price, total_price, purchase_date, warranty_date, origin, customer_name, supplier_name, remark
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
        id,
        dto.contract_id || '',
        dto.contract_code || '',
        dto.contract_name || '',
        dto.code || '',
        name || '',
        dto.category || '',
        dto.specification || '',
        dto.unit || '',
        dto.unit_price ?? null,
        dto.quantity ?? null,
        dto.cost_price ?? null,
        dto.total_price ?? null,
        dto.purchase_date || '',
        dto.warranty_date || '',
        dto.origin || '',
        dto.customer_name || '',
        dto.supplier_name || '',
        dto.remark || '',
      );
      syncProductCalendarEventsById(db, id);
      return getContractProductById(id);
    },

    updateContractProduct: (dto) => {
      const db = getDb();
      const fields: string[] = [];
      const values: unknown[] = [];

      const addField = (col: string, val: unknown) => {
        if (val !== undefined) { fields.push(`${col} = ?`); values.push(val); }
      };

      if (dto.name !== undefined) {
        const nextName = String(dto.name || '').trim();
        if (nextName) {
          const existed = db.prepare('SELECT id FROM contract_products WHERE name = ? AND id <> ? AND deleted_at IS NULL LIMIT 1').get(nextName, dto.id) as { id?: string } | undefined;
          if (existed?.id) {
            throw new Error('名称已存在');
          }
        }
      }

      addField('code', dto.code);
      addField('name', dto.name !== undefined ? String(dto.name || '').trim() : undefined);
      addField('contract_id', dto.contract_id);
      addField('contract_code', dto.contract_code);
      addField('contract_name', dto.contract_name);
      addField('category', dto.category);
      addField('specification', dto.specification);
      addField('unit', dto.unit);
      addField('unit_price', dto.unit_price);
      addField('quantity', dto.quantity);
      addField('cost_price', dto.cost_price);
      addField('total_price', dto.total_price);
      addField('purchase_date', dto.purchase_date);
      addField('warranty_date', dto.warranty_date);
      addField('origin', dto.origin);
      addField('customer_name', dto.customer_name);
      addField('supplier_name', dto.supplier_name);
      addField('remark', dto.remark);

      if (fields.length === 0) return getContractProductById(dto.id);

      fields.push('updated_at = CURRENT_TIMESTAMP');
      values.push(dto.id);

      db.prepare(`UPDATE contract_products SET ${fields.join(', ')} WHERE id = ?`).run(...values);
      syncProductCalendarEventsById(db, dto.id);
      return getContractProductById(dto.id);
    },

    deleteContractProduct: (id) => {
      const db = getDb();
      db.prepare('UPDATE contract_products SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?').run(id);
      markProductCalendarEventsDeletedById(db, id);
    },

    restoreContractProduct: (id) => {
      const db = getDb();
      db.prepare('UPDATE contract_products SET deleted_at = NULL WHERE id = ?').run(id);
      syncProductCalendarEventsById(db, id);
    },

    purgeContractProduct: (id) => {
      const db = getDb();
      markProductCalendarEventsDeletedById(db, id);
      db.prepare('DELETE FROM contract_products WHERE id = ?').run(id);
    },

    getContractProductById,

    getContractProducts: (query) => {
      const db = getDb();
      let sql = 'SELECT * FROM contract_products WHERE 1=1';
      let countSql = 'SELECT COUNT(*) as total FROM contract_products WHERE 1=1';
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

      if (query.category && query.category !== '所有分类') {
        sql += ' AND category = ?';
        countSql += ' AND category = ?';
        params.push(query.category);
      }

      if (query.warrantyStatus === 'expired') {
        sql += " AND TRIM(COALESCE(warranty_date, '')) <> '' AND date(substr(warranty_date, 1, 10)) < date('now', 'localtime')";
        countSql += " AND TRIM(COALESCE(warranty_date, '')) <> '' AND date(substr(warranty_date, 1, 10)) < date('now', 'localtime')";
      } else if (query.warrantyStatus === 'notExpired') {
        sql += " AND TRIM(COALESCE(warranty_date, '')) <> '' AND date(substr(warranty_date, 1, 10)) >= date('now', 'localtime')";
        countSql += " AND TRIM(COALESCE(warranty_date, '')) <> '' AND date(substr(warranty_date, 1, 10)) >= date('now', 'localtime')";
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

      const data = db.prepare(sql).all(...params) as ContractProduct[];
      return { data, total };
    },
  };
}
