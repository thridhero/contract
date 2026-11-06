import * as crypto from 'crypto';
import Database from 'better-sqlite3';
import { openLibraryDb } from './shared';

type CalendarEventSeverity = 'info' | 'warning' | 'danger';

type ContractCalendarSourceRow = {
  id: string;
  contract_name: string;
  contract_code: string;
  signing_date: string | null;
  end_date: string | null;
  ext_data: string | null;
  deleted_at: string | null;
};

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

function parseExtData(raw: string | null): Record<string, unknown> {
  const text = String(raw || '').trim();
  if (!text) return {};
  try {
    const parsed = JSON.parse(text);
    if (parsed && typeof parsed === 'object') return parsed as Record<string, unknown>;
    return {};
  } catch {
    return {};
  }
}

function severityForEventKey(eventKey: string): CalendarEventSeverity {
  if (eventKey === 'contract:end_date' || eventKey === 'contract:lease_end_date') return 'danger';
  if (eventKey === 'contract:lease_start_date') return 'warning';
  if (eventKey === 'product:warranty_date') return 'warning';
  return 'info';
}

function buildContractEvents(row: ContractCalendarSourceRow): Array<{
  event_key: string;
  event_date: string;
  title: string;
  content: string | null;
  severity: CalendarEventSeverity;
  meta: string | null;
}> {
  const baseMeta = {
    source_type: 'contract_info',
    source_id: row.id,
    source_category: 'contract',
    contract_id: row.id,
    contract_code: row.contract_code,
    contract_name: row.contract_name,
  };
  const ext = parseExtData(row.ext_data);

  const events: Array<{
    event_key: string;
    raw_date: unknown;
    titlePrefix: string;
  }> = [
    { event_key: 'contract:signing_date', raw_date: row.signing_date, titlePrefix: '合同签约' },
    { event_key: 'contract:end_date', raw_date: row.end_date, titlePrefix: '合同到期' },
    { event_key: 'contract:lease_start_date', raw_date: ext.leaseStartDate, titlePrefix: '租赁开始' },
    { event_key: 'contract:lease_end_date', raw_date: ext.leaseEndDate, titlePrefix: '租赁到期' },
  ];

  const result: Array<{
    event_key: string;
    event_date: string;
    title: string;
    content: string | null;
    severity: CalendarEventSeverity;
    meta: string | null;
  }> = [];

  for (const e of events) {
    const date = normalizeToYmd(e.raw_date);
    if (!date) continue;
    const meta = JSON.stringify({ ...baseMeta, event_key: e.event_key });
    result.push({
      event_key: e.event_key,
      event_date: date,
      title: `${e.titlePrefix}：${row.contract_name}`,
      content: row.contract_code ? `合同编号：${row.contract_code}` : null,
      severity: severityForEventKey(e.event_key),
      meta,
    });
  }

  return result;
}

function buildProductEvents(row: ProductCalendarSourceRow): Array<{
  event_key: string;
  event_date: string;
  title: string;
  content: string | null;
  severity: CalendarEventSeverity;
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

  const events: Array<{
    event_key: string;
    raw_date: unknown;
    titlePrefix: string;
  }> = [
    { event_key: 'product:purchase_date', raw_date: row.purchase_date, titlePrefix: '产品采购' },
    { event_key: 'product:warranty_date', raw_date: row.warranty_date, titlePrefix: '产品维保' },
  ];

  const result: Array<{
    event_key: string;
    event_date: string;
    title: string;
    content: string | null;
    severity: CalendarEventSeverity;
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
      severity: severityForEventKey(e.event_key),
      meta,
    });
  }

  return result;
}

export function markContractCalendarEventsDeleted(db: Database.Database, contractId: string): void {
  const id = String(contractId || '').trim();
  if (!id) return;
  db.prepare(`
    UPDATE calendar_events
    SET deleted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
    WHERE source_type = 'contract_info' AND source_id = ? AND deleted_at IS NULL
  `).run(id);
}

export function markProductCalendarEventsDeletedByProductId(db: Database.Database, productId: string): void {
  const id = String(productId || '').trim();
  if (!id) return;
  db.prepare(`
    UPDATE calendar_events
    SET deleted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
    WHERE source_type = 'contract_product' AND source_id = ? AND deleted_at IS NULL
  `).run(id);
}

export function markProductCalendarEventsDeletedByContractId(db: Database.Database, contractId: string): void {
  const id = String(contractId || '').trim();
  if (!id) return;
  db.prepare(`
    UPDATE calendar_events
    SET deleted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
    WHERE source_type = 'contract_product'
      AND source_id IN (
        SELECT id FROM contract_products WHERE contract_id = ?
      )
      AND deleted_at IS NULL
  `).run(id);
}

export function syncContractCalendarEventsById(db: Database.Database, contractId: string): void {
  const id = String(contractId || '').trim();
  if (!id) return;

  const row = db.prepare(`
    SELECT
      id,
      contract_name,
      contract_code,
      signing_date,
      end_date,
      ext_data,
      deleted_at
    FROM contract_info
    WHERE id = ?
    LIMIT 1
  `).get(id) as ContractCalendarSourceRow | undefined;

  if (!row || row.deleted_at) {
    markContractCalendarEventsDeleted(db, id);
    return;
  }

  const nextEvents = buildContractEvents(row);
  const keys = nextEvents.map(e => e.event_key);

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
      ?, 'contract_info', ?, ?, ?, ?, ?, ?, ?, NULL
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

  const tx = db.transaction(() => {
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
      db.prepare(`
        UPDATE calendar_events
        SET deleted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
        WHERE source_type = 'contract_info' AND source_id = ? AND deleted_at IS NULL
      `).run(id);
      return;
    }

    const placeholders = keys.map(() => '?').join(',');
    db.prepare(`
      UPDATE calendar_events
      SET deleted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
      WHERE source_type = 'contract_info'
        AND source_id = ?
        AND event_key NOT IN (${placeholders})
        AND deleted_at IS NULL
    `).run(id, ...keys);
  });

  tx();
}

export function syncProductCalendarEventsById(db: Database.Database, productId: string): void {
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
    markProductCalendarEventsDeletedByProductId(db, id);
    return;
  }

  const nextEvents = buildProductEvents(row);
  const keys = nextEvents.map(e => e.event_key);

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

  const tx = db.transaction(() => {
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
      markProductCalendarEventsDeletedByProductId(db, id);
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
  });

  tx();
}

export function getCalendarEventsByRange(db: Database.Database, startDate: string, endDate: string, includeDeleted = false): unknown[] {
  const start = String(startDate || '').trim();
  const end = String(endDate || '').trim();
  const where: string[] = [];
  const params: unknown[] = [];

  where.push('event_date >= ?');
  params.push(start);
  where.push('event_date <= ?');
  params.push(end);
  if (!includeDeleted) {
    where.push('deleted_at IS NULL');
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  return db.prepare(`
    SELECT
      id,
      source_type,
      source_id,
      event_key,
      event_date,
      title,
      content,
      severity,
      meta,
      deleted_at,
      created_at,
      updated_at
    FROM calendar_events
    ${whereSql}
    ORDER BY event_date ASC, datetime(updated_at) DESC
  `).all(...params) as unknown[];
}

export function rebuildCalendarEventsFromContracts(libraryPath: string): { processed: number } {
  const db = openLibraryDb(libraryPath);
  try {
    const contracts = db.prepare(`
      SELECT
        id,
        contract_name,
        contract_code,
        signing_date,
        end_date,
        ext_data,
        deleted_at
      FROM contract_info
    `).all() as ContractCalendarSourceRow[];

    const activeContracts = contracts.filter(c => !c.deleted_at);
    const products = db.prepare(`
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
    `).all() as ProductCalendarSourceRow[];
    const activeProducts = products.filter((p) => !p.deleted_at);
    const activeIds = activeContracts.map(c => c.id).filter(Boolean);
    const activeProductIds = activeProducts.map((p) => p.id).filter(Boolean);

    const tx = db.transaction(() => {
      if (!activeIds.length) {
        db.prepare(`
          UPDATE calendar_events
          SET deleted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
          WHERE source_type = 'contract_info' AND deleted_at IS NULL
        `).run();
      } else {
        const placeholders = activeIds.map(() => '?').join(',');
        db.prepare(`
          UPDATE calendar_events
          SET deleted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
          WHERE source_type = 'contract_info' AND source_id NOT IN (${placeholders}) AND deleted_at IS NULL
        `).run(...activeIds);
      }

      if (!activeProductIds.length) {
        db.prepare(`
          UPDATE calendar_events
          SET deleted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
          WHERE source_type = 'contract_product' AND deleted_at IS NULL
        `).run();
      } else {
        const placeholders = activeProductIds.map(() => '?').join(',');
        db.prepare(`
          UPDATE calendar_events
          SET deleted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
          WHERE source_type = 'contract_product' AND source_id NOT IN (${placeholders}) AND deleted_at IS NULL
        `).run(...activeProductIds);
      }

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
          ?, 'contract_info', ?, ?, ?, ?, ?, ?, ?, NULL
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

      for (const c of activeContracts) {
        const nextEvents = buildContractEvents(c);
        const keys = nextEvents.map(e => e.event_key);

        for (const ev of nextEvents) {
          upsert.run(
            crypto.randomUUID(),
            c.id,
            ev.event_key,
            ev.event_date,
            ev.title,
            ev.content,
            ev.severity,
            ev.meta,
          );
        }

        if (!keys.length) {
          db.prepare(`
            UPDATE calendar_events
            SET deleted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
            WHERE source_type = 'contract_info' AND source_id = ? AND deleted_at IS NULL
          `).run(c.id);
          continue;
        }

        const keyPlaceholders = keys.map(() => '?').join(',');
        db.prepare(`
          UPDATE calendar_events
          SET deleted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
          WHERE source_type = 'contract_info'
            AND source_id = ?
            AND event_key NOT IN (${keyPlaceholders})
            AND deleted_at IS NULL
        `).run(c.id, ...keys);
      }

      const upsertProduct = db.prepare(`
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

      for (const p of activeProducts) {
        const nextEvents = buildProductEvents(p);
        const keys = nextEvents.map((e) => e.event_key);

        for (const ev of nextEvents) {
          upsertProduct.run(
            crypto.randomUUID(),
            p.id,
            ev.event_key,
            ev.event_date,
            ev.title,
            ev.content,
            ev.severity,
            ev.meta,
          );
        }

        if (!keys.length) {
          markProductCalendarEventsDeletedByProductId(db, p.id);
          continue;
        }

        const keyPlaceholders = keys.map(() => '?').join(',');
        db.prepare(`
          UPDATE calendar_events
          SET deleted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
          WHERE source_type = 'contract_product'
            AND source_id = ?
            AND event_key NOT IN (${keyPlaceholders})
            AND deleted_at IS NULL
        `).run(p.id, ...keys);
      }
    });

    tx();
    return { processed: activeContracts.length + activeProducts.length };
  } finally {
    db.close();
  }
}

export function getCalendarEventsByRangeFromLibrary(libraryPath: string, startDate: string, endDate: string, includeDeleted = false): unknown[] {
  const db = openLibraryDb(libraryPath);
  try {
    return getCalendarEventsByRange(db, startDate, endDate, includeDeleted);
  } finally {
    db.close();
  }
}
