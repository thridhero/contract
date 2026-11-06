import Database from 'better-sqlite3';
import * as channels from '../../../channels';
import { ok, fail } from '../../../../../shared/types/ipc.types';
import {
  ContractInfoEntity,
  ContractInfoGetDTO,
  ContractInfoQueryDTO,
  ContractInfoQueryResult,
  ContractInfoSummaryStatsDTO,
  ContractInfoSummaryStatsResult,
} from '../../../../../shared/types/contractInfo.types';
import type {
  ContractStatisticsAIPlan,
  ContractStatisticsExecutionResult,
} from '../../../../../shared/types/contractStatistics.types';
import {
  LibraryHandlerMap,
  logger,
  openLibraryDb,
} from './shared';
import { executeContractStatisticsPlan } from '../../../../services/system/ai/contractStatistics';

type NormalizedContractQuery = {
  whereSql: string;
  whereParams: unknown[];
};

const buildContractTypeSearchClause = (likeParam: string) => ({
  sql: `(
    LOWER(COALESCE(contract_type, '')) LIKE ?
    OR EXISTS (
      SELECT 1
      FROM dictionaries d
      WHERE d.deleted_at IS NULL
        AND d.group_name = '合同类型'
        AND (
          d.name = contract_info.contract_type
          OR d.value = contract_info.contract_type
          OR d.code = contract_info.contract_type
        )
        AND (
          LOWER(COALESCE(d.name, '')) LIKE ?
          OR LOWER(COALESCE(d.value, '')) LIKE ?
          OR LOWER(COALESCE(d.code, '')) LIKE ?
        )
    )
  )`,
  params: [likeParam, likeParam, likeParam, likeParam] as unknown[],
});

const buildContractTypeFilterClause = (values: string[]) => {
  const placeholders = values.map(() => '?').join(', ');
  return {
    sql: `(
      contract_type IN (${placeholders})
      OR EXISTS (
        SELECT 1
        FROM dictionaries d
        WHERE d.deleted_at IS NULL
          AND d.group_name = '合同类型'
          AND (
            d.name = contract_info.contract_type
            OR d.value = contract_info.contract_type
            OR d.code = contract_info.contract_type
          )
          AND (
            d.name IN (${placeholders})
            OR d.value IN (${placeholders})
            OR d.code IN (${placeholders})
          )
      )
    )`,
    params: [...values, ...values, ...values, ...values] as unknown[],
  };
};

const normalizeContractQuery = (query: Partial<ContractInfoQueryDTO | ContractInfoSummaryStatsDTO>): NormalizedContractQuery => {
  const searchQuery = String(query.searchQuery || '').trim();
  const searchField = String((query as ContractInfoQueryDTO).searchField || 'all').trim();
  const searchFieldsInput = (query as ContractInfoQueryDTO).searchFields;
  const filters = query.filters || {};

  const allowedSingleFieldMap: Record<string, string> = {
    contract_name: 'contract_name',
    contract_code: 'contract_code',
    client_name: 'client_name',
    party_b_name: 'party_b_name',
    contract_type: 'contract_type',
  };

  const whereParts: string[] = [];
  const whereParams: unknown[] = [];
  whereParts.push('deleted_at IS NULL');

  if (searchQuery) {
    const normalizedQuery = searchQuery.toLowerCase();
    const likeParam = `%${normalizedQuery}%`;

    let fields: string[] = [];
    if (Array.isArray(searchFieldsInput)) {
      fields = searchFieldsInput.map((v: unknown) => String(v || '').trim()).filter(Boolean);
    } else if (searchField) {
      fields = [searchField];
    }

    const allFields = Object.keys(allowedSingleFieldMap);
    if (!fields.length || fields.includes('all')) {
      fields = [...allFields];
    } else {
      fields = fields.filter((f) => Boolean(allowedSingleFieldMap[f]));
      if (!fields.length) {
        throw new Error('searchField 参数不合法');
      }
    }

    const searchClauses = fields.map((f) => {
      if (f === 'contract_type') {
        return buildContractTypeSearchClause(likeParam);
      }
      return {
        sql: `LOWER(COALESCE(${allowedSingleFieldMap[f]}, '')) LIKE ?`,
        params: [likeParam] as unknown[],
      };
    });

    whereParts.push(`(${searchClauses.map((item) => item.sql).join(' OR ')})`);
    searchClauses.forEach((item) => whereParams.push(...item.params));
  }

  if (filters.client_name && Array.isArray(filters.client_name) && filters.client_name.length > 0) {
    whereParts.push(`client_name IN (${filters.client_name.map(() => '?').join(', ')})`);
    whereParams.push(...filters.client_name);
  }

  if (filters.party_b_name && Array.isArray(filters.party_b_name) && filters.party_b_name.length > 0) {
    whereParts.push(`party_b_name IN (${filters.party_b_name.map(() => '?').join(', ')})`);
    whereParams.push(...filters.party_b_name);
  }

  if (filters.contract_type && Array.isArray(filters.contract_type) && filters.contract_type.length > 0) {
    const normalizedTypes = filters.contract_type
      .map((item) => String(item || '').trim())
      .filter(Boolean);
    if (normalizedTypes.length > 0) {
      const clause = buildContractTypeFilterClause(normalizedTypes);
      whereParts.push(clause.sql);
      whereParams.push(...clause.params);
    }
  }

  const endDateStart = String(filters.end_date_start || '').trim();
  if (endDateStart) {
    whereParts.push(`date(NULLIF(TRIM(end_date), '')) >= date(?)`);
    whereParams.push(endDateStart);
  }

  const endDateEnd = String(filters.end_date_end || '').trim();
  if (endDateEnd) {
    whereParts.push(`date(NULLIF(TRIM(end_date), '')) <= date(?)`);
    whereParams.push(endDateEnd);
  }

  return {
    whereSql: whereParts.length ? `WHERE ${whereParts.join(' AND ')}` : '',
    whereParams,
  };
};

export const libraryContractReadHandlers: LibraryHandlerMap = {
  [channels.LIBRARY_GET_CONTRACT_INFOS]: async (_event, libraryPath: unknown, options?: unknown) => {
    let db: Database.Database | null = null;
    try {
      const value = String(libraryPath || '').trim();
      if (!value) {
        return fail(new Error('资源库路径不能为空'));
      }

      db = openLibraryDb(value);
      const rows = db.prepare(`
        SELECT
          id,
          contract_name,
          contract_code,
          signing_date,
          contract_type,
          group_name,
          currency,
          client_name,
          party_a_contact,
          party_a_contact_mobile,
          party_a_contact_phone,
          party_a_contact_email,
          party_a_contact_id_number,
          party_b_name,
          party_b_contact,
          party_b_contact_mobile,
          party_b_contact_phone,
          party_b_contact_email,
          party_b_contact_id_number,
          contract_summary,
          contract_amount,
          contract_status,
          department,
          responsible_person,
          end_date,
          settlement_method,
          signing_form,
          procurement_source,
          execution_method,
          remark,
          contract_tags,
          ext_data,
          folder_name,
          project_icon,
          project_color,
          sort_order,
          trash_path,
          deleted_at,
          created_at,
          updated_at
        FROM contract_info
        WHERE deleted_at IS NULL
        ORDER BY sort_order ASC, datetime(updated_at) DESC, datetime(created_at) DESC
      `).all() as ContractInfoEntity[];
      return ok(rows);
    } catch (error) {
      logger.error('读取合同信息列表失败:', error);
      return fail(error);
    } finally {
      db?.close();
    }
  },

  [channels.LIBRARY_QUERY_CONTRACT_INFOS]: async (_event, dto: unknown) => {
    let db: Database.Database | null = null;
    try {
      const query = (dto || {}) as Partial<ContractInfoQueryDTO>;
      const libraryPath = String(query.libraryPath || '').trim();
      const page = Number(query.page || 1);
      const pageSize = Number(query.pageSize || 20);
      if (!libraryPath) {
        return fail(new Error('资源库路径不能为空'));
      }
      if (!Number.isFinite(page) || page < 1) {
        return fail(new Error('page 参数不合法'));
      }
      if (!Number.isFinite(pageSize) || pageSize < 1 || pageSize > 1000) {
        return fail(new Error('pageSize 参数不合法'));
      }

      db = openLibraryDb(libraryPath);
      const { whereSql, whereParams } = normalizeContractQuery(query);
      const totalRow = db.prepare(`SELECT COUNT(1) as total FROM contract_info ${whereSql}`).get(...whereParams) as { total: number } | undefined;
      const total = Number(totalRow?.total || 0);

      const offset = (page - 1) * pageSize;
      const rows = db.prepare(`
        SELECT
          id,
          contract_name,
          contract_code,
          signing_date,
          contract_type,
          group_name,
          currency,
          client_name,
          party_a_contact,
          party_a_contact_mobile,
          party_a_contact_phone,
          party_a_contact_email,
          party_a_contact_id_number,
          party_b_name,
          party_b_contact,
          party_b_contact_mobile,
          party_b_contact_phone,
          party_b_contact_email,
          party_b_contact_id_number,
          contract_summary,
          contract_amount,
          contract_status,
          department,
          responsible_person,
          end_date,
          settlement_method,
          signing_form,
          procurement_source,
          execution_method,
          remark,
          contract_tags,
          ext_data,
          folder_name,
          project_icon,
          project_color,
          sort_order,
          trash_path,
          deleted_at,
          created_at,
          updated_at
        FROM contract_info
        ${whereSql}
        ORDER BY sort_order ASC, datetime(NULLIF(signing_date, '')) DESC, datetime(updated_at) DESC, datetime(created_at) DESC
        LIMIT ? OFFSET ?
      `).all(...whereParams, pageSize, offset) as ContractInfoEntity[];

      const result: ContractInfoQueryResult = {
        items: rows,
        total,
        page,
        pageSize,
      };

      return ok(result);
    } catch (error) {
      logger.error('分页读取合同信息失败:', error);
      return fail(error);
    } finally {
      db?.close();
    }
  },

  [channels.LIBRARY_GET_CONTRACT_SUMMARY_STATS]: async (_event, dto: unknown) => {
    let db: Database.Database | null = null;
    try {
      const query = (dto || {}) as Partial<ContractInfoSummaryStatsDTO>;
      const libraryPath = String(query.libraryPath || '').trim();
      if (!libraryPath) {
        return fail(new Error('资源库路径不能为空'));
      }

      db = openLibraryDb(libraryPath);
      const { whereSql, whereParams } = normalizeContractQuery(query);

      const contractStatsRow = db.prepare(`
        SELECT
          COUNT(1) AS totalContracts,
          COUNT(DISTINCT NULLIF(TRIM(client_name), '')) AS totalPartyAUnits,
          COUNT(DISTINCT NULLIF(TRIM(party_b_name), '')) AS totalPartyBUnits,
          SUM(
            CASE
              WHEN contract_status IN ('完结', '已完结', '完成', '已完成', '结束', '已结束', 'closed', 'completed')
              THEN 1
              ELSE 0
            END
          ) AS totalFinishedContracts
        FROM contract_info
        ${whereSql}
      `).get(...whereParams) as {
        totalContracts?: number;
        totalPartyAUnits?: number;
        totalPartyBUnits?: number;
        totalFinishedContracts?: number;
      } | undefined;

      const receiptStatsRow = db.prepare(`
        WITH filtered_contracts AS (
          SELECT
            id,
            COALESCE(contract_amount, 0) AS contract_amount
          FROM contract_info
          ${whereSql}
        ),
        receipt_totals AS (
          SELECT
            contract_id,
            SUM(
              CASE
                WHEN (
                  TRIM(direction) = '收款'
                  OR (TRIM(direction) LIKE '%收%' AND TRIM(direction) NOT LIKE '%付%')
                )
                THEN COALESCE(current_amount, 0)
                ELSE 0
              END
            ) AS received_total
          FROM contract_receipt_payment
          WHERE deleted_at IS NULL
          GROUP BY contract_id
        )
        SELECT
          SUM(COALESCE(rt.received_total, 0)) AS totalReceivedReceipts,
          SUM(
            CASE
              WHEN (fc.contract_amount - COALESCE(rt.received_total, 0)) > 0
              THEN (fc.contract_amount - COALESCE(rt.received_total, 0))
              ELSE 0
            END
          ) AS totalPendingReceipts
        FROM filtered_contracts fc
        LEFT JOIN receipt_totals rt ON rt.contract_id = fc.id
      `).get(...whereParams) as {
        totalPendingReceipts?: number;
        totalReceivedReceipts?: number;
      } | undefined;

      const result: ContractInfoSummaryStatsResult = {
        totalContracts: Number(contractStatsRow?.totalContracts || 0),
        totalPartyAUnits: Number(contractStatsRow?.totalPartyAUnits || 0),
        totalPartyBUnits: Number(contractStatsRow?.totalPartyBUnits || 0),
        totalPendingReceipts: Number(receiptStatsRow?.totalPendingReceipts || 0),
        totalReceivedReceipts: Number(receiptStatsRow?.totalReceivedReceipts || 0),
        totalFinishedContracts: Number(contractStatsRow?.totalFinishedContracts || 0),
      };

      return ok(result);
    } catch (error) {
      logger.error('读取合同汇总统计失败:', error);
      return fail(error);
    } finally {
      db?.close();
    }
  },

  [channels.LIBRARY_GET_SIDEBAR_STATS]: async (_event, libraryPath: unknown) => {
    let db: Database.Database | null = null;
    try {
      const value = String(libraryPath || '').trim();
      if (!value) {
        return fail(new Error('资源库路径不能为空'));
      }

      db = openLibraryDb(value);

      const contractRow = db.prepare(`
        SELECT
          SUM(CASE WHEN deleted_at IS NULL THEN 1 ELSE 0 END) AS activeContracts,
          SUM(CASE WHEN deleted_at IS NOT NULL THEN 1 ELSE 0 END) AS trashContracts
        FROM contract_info
      `).get() as { activeContracts?: number; trashContracts?: number } | undefined;

      const tagRow = db.prepare(`
        SELECT COUNT(1) AS totalTags
        FROM tags
      `).get() as { totalTags?: number } | undefined;

      return ok({
        activeContracts: Number(contractRow?.activeContracts || 0),
        trashContracts: Number(contractRow?.trashContracts || 0),
        totalTags: Number(tagRow?.totalTags || 0),
      });
    } catch (error) {
      logger.error('读取侧边栏统计失败:', error);
      return fail(error);
    } finally {
      db?.close();
    }
  },

  [channels.LIBRARY_GET_CONTRACT_INFO]: async (_event, dto: unknown) => {
    let db: Database.Database | null = null;
    try {
      const query = (dto || {}) as Partial<ContractInfoGetDTO> & { includeDeleted?: boolean };
      const libraryPath = String(query.libraryPath || '').trim();
      const id = String(query.id || '').trim();
      if (!libraryPath) {
        return fail(new Error('资源库路径不能为空'));
      }
      if (!id) {
        return fail(new Error('合同ID不能为空'));
      }

      db = openLibraryDb(libraryPath);

      const row = db.prepare(`
        SELECT
          id,
          contract_name,
          contract_code,
          signing_date,
          contract_type,
          group_name,
          currency,
          client_name,
          party_a_contact,
          party_b_name,
          party_b_contact,
          contract_summary,
          contract_amount,
          contract_status,
          department,
          responsible_person,
          end_date,
          settlement_method,
          signing_form,
          procurement_source,
          execution_method,
          remark,
          contract_tags,
          ext_data,
          folder_name,
          project_icon,
          project_color,
          sort_order,
          trash_path,
          deleted_at,
          created_at,
          updated_at
        FROM contract_info
        WHERE id = ?
          AND deleted_at IS NULL
        LIMIT 1
      `).get(id) as ContractInfoEntity | undefined;

      if (!row) {
        return fail(new Error('未找到合同信息'));
      }
      return ok(row);
    } catch (error) {
      logger.error('读取合同信息详情失败:', error);
      return fail(error);
    } finally {
      db?.close();
    }
  },

  [channels.LIBRARY_EXECUTE_CONTRACT_STATISTICS]: async (_event, payload: unknown) => {
    let db: Database.Database | null = null;
    try {
      const libraryPath = String((payload as { libraryPath?: unknown })?.libraryPath || '').trim();
      const aiPlan = (payload as { aiPlan?: ContractStatisticsAIPlan })?.aiPlan;
      if (!libraryPath) {
        return fail(new Error('资源库路径不能为空'));
      }
      if (!aiPlan) {
        return fail(new Error('统计方案不能为空'));
      }
      db = openLibraryDb(libraryPath);
      const outcome: ContractStatisticsExecutionResult = executeContractStatisticsPlan(db, aiPlan);
      return ok(outcome);
    } catch (error) {
      logger.error('执行合同统计失败:', error);
      return fail(error);
    } finally {
      db?.close();
    }
  },
};
