import type Database from 'better-sqlite3';
import { createDepartmentsMethods } from '../../database/departments';
import { createPersonnelsMethods } from '../../database/personnels';
import type { Personnel } from '../../../../../shared/types/personnel.types';
import type {
  AIAgentPersonnelSearchArgs,
  AIAgentPersonnelSearchItem,
  AIAgentPersonnelSearchQueryType,
  AIAgentPersonnelSearchResult,
} from '../../../../../shared/types/aiAgent.types';

const PERSONNEL_QUERY_FIELDS: Record<Exclude<AIAgentPersonnelSearchQueryType, 'department' | 'document'>, string[]> = {
  name: ['name'],
  phone: ['phone'],
  id_card_number: ['id_card_number'],
};

const DEPARTMENT_KEYWORD_SUFFIX = /(部门|中心|办公室|办事处|项目组|项目部|小组|班组|科室|科|处|室|队)$/;
const DEPARTMENT_QUERY_PREFIX = /^(请|帮我|麻烦|想|我想|需要|帮忙)?\s*(帮我|麻烦)?\s*(查一下|查询一下|查询|查下|查一查|查查|查|帮我查一下|帮我查|帮我查询)?\s*/;
const DEPARTMENT_QUERY_SUFFIX = /(的)?\s*(有哪些人|有什么人|有哪些员工|员工信息|人员信息|用户信息|部门信息|员工名单|人员名单|员工|人员|用户|同事|名单|情况)\s*$/;

const normalizeKeyword = (value: string) => String(value || '').replace(/\s+/g, ' ').trim();

const dedupeById = <T extends { id: string }>(items: T[]): T[] => {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.id)) {
      return false;
    }
    seen.add(item.id);
    return true;
  });
};

const countDistinctPersonnelByDepartmentIds = (
  db: Database.Database,
  departmentIds: string[],
): number => {
  const normalizedIds = departmentIds
    .map(id => String(id || '').trim())
    .filter(Boolean);
  if (normalizedIds.length === 0) {
    return 0;
  }
  const placeholders = normalizedIds.map(() => '?').join(', ');
  const row = db.prepare(`
    SELECT COUNT(DISTINCT p.id) AS total
    FROM personnel p
    INNER JOIN personnel_departments pd ON pd.personnel_id = p.id
    INNER JOIN departments d ON d.id = pd.department_id
    WHERE pd.department_id IN (${placeholders})
      AND p.deleted_at IS NULL
      AND d.deleted_at IS NULL
  `).get(...normalizedIds) as { total?: number } | undefined;
  return Number(row?.total || 0);
};

const isLikelyDepartmentQuery = (value: string): boolean => {
  const normalized = normalizeKeyword(value);
  if (!normalized) {
    return false;
  }
  if (/部门|科室|项目组|项目部|办公室|中心/.test(normalized)) {
    return true;
  }
  if (/(有哪些人|有什么人|员工信息|人员信息|用户信息|员工名单|人员名单|同事|名单)/.test(normalized)) {
    return true;
  }
  return DEPARTMENT_KEYWORD_SUFFIX.test(normalized);
};

const cleanDepartmentKeyword = (value: string): string => {
  let normalized = normalizeKeyword(value);
  normalized = normalized.replace(DEPARTMENT_QUERY_PREFIX, '');
  normalized = normalized.replace(DEPARTMENT_QUERY_SUFFIX, '');
  normalized = normalized.replace(/[？?。！!，,；;：:]+$/g, '').trim();
  normalized = normalized.replace(/^关于/, '').trim();
  normalized = normalized.replace(/^(一下|一下子)/, '').trim();
  normalized = normalized.replace(/^(部门|科室|中心)/, '').trim();
  normalized = normalized.replace(/的$/, '').trim();
  const fuzzyKeyword = normalized.replace(DEPARTMENT_KEYWORD_SUFFIX, '').trim();
  if (fuzzyKeyword.length >= 2) {
    normalized = fuzzyKeyword;
  }
  return normalized || normalizeKeyword(value);
};

const maskPhone = (phone?: string | null): string => {
  const value = String(phone || '').trim();
  if (value.length < 7) {
    return value || '-';
  }
  return `${value.slice(0, 3)}****${value.slice(-4)}`;
};

const maskIdCard = (idCard?: string | null): string => {
  const value = String(idCard || '').trim();
  if (!value) {
    return '-';
  }
  if (value.length <= 8) {
    return value;
  }
  return `${value.slice(0, 4)}********${value.slice(-4)}`;
};

const mapPersonnelItem = (
  item: Personnel,
  matchedDepartmentNames?: string[],
  extra?: { documentNames?: string[]; documentTypes?: string[] },
): AIAgentPersonnelSearchItem => ({
  id: item.id,
  name: String(item.name || '').trim(),
  position: String(item.position || '').trim(),
  phone: String(item.phone || '').trim(),
  email: String(item.email || '').trim(),
  idCardNumber: String(item.id_card_number || '').trim(),
  departmentNames: Array.isArray(item.department_names) ? item.department_names.map(name => String(name || '').trim()).filter(Boolean) : [],
  matchedDepartmentNames: Array.isArray(matchedDepartmentNames) && matchedDepartmentNames.length > 0
    ? matchedDepartmentNames.map(name => String(name || '').trim()).filter(Boolean)
    : undefined,
  documentNames: extra?.documentNames,
  documentTypes: extra?.documentTypes,
});

const buildDepartmentSummary = (result: AIAgentPersonnelSearchResult): string => {
  const matchedDepartments = Array.isArray(result.matchedDepartments) ? result.matchedDepartments : [];
  if (result.emptyReason === 'no_department') {
    return '未找到匹配部门，请尝试更完整的部门名称后重试。';
  }
  if (result.emptyReason === 'department_without_personnel') {
    const departmentNames = matchedDepartments.map(item => item.name).join('、');
    return `已匹配部门 ${departmentNames || result.keyword}，但该部门下暂无员工，请确认部门名称或稍后重试。`;
  }
  const departmentSummary = matchedDepartments
    .map(item => `${item.name}（${item.personnelCount} 人）`)
    .join('、');
  const personnelSummary = result.items
    .slice(0, 10)
    .map(item => [
      `${item.name || '-'}（岗位：${item.position || '-'}）`,
      `手机号：${maskPhone(item.phone)}`,
      `身份证：${maskIdCard(item.idCardNumber)}`,
      `部门：${item.matchedDepartmentNames?.join('、') || item.departmentNames.join('、') || '-'}`,
    ].join('，'))
    .join('\n');
  return [
    `匹配部门 ${matchedDepartments.length} 个：${departmentSummary}`,
    `共命中 ${result.total} 位员工，优先返回前 ${result.items.length} 位：`,
    personnelSummary,
  ].filter(Boolean).join('\n');
};

const buildKeywordSummary = (result: AIAgentPersonnelSearchResult): string => {
  if (result.emptyReason === 'no_match') {
    return '未找到匹配员工，建议尝试姓名、手机号、身份证号或更完整的部门名称重新查询。';
  }
  const summary = result.items
    .slice(0, 10)
    .map(item => [
      `${item.name || '-'}（岗位：${item.position || '-'}）`,
      `手机号：${maskPhone(item.phone)}`,
      `身份证：${maskIdCard(item.idCardNumber)}`,
      `部门：${item.departmentNames.join('、') || '-'}`,
      item.documentNames?.length ? `证件：${item.documentNames.join('、')}` : '',
    ].join('，'))
    .join('\n');
  return `共命中 ${result.total} 位员工，优先返回前 ${result.items.length} 位：\n${summary}`;
};

export const summarizePersonnelSearchResult = (result: AIAgentPersonnelSearchResult): string => (
  result.queryType === 'department'
    ? buildDepartmentSummary(result)
    : buildKeywordSummary(result)
);

type ExecutePersonnelSearchOptions = {
  db: Database.Database;
  args: Pick<AIAgentPersonnelSearchArgs, 'searchQuery'> & Partial<Pick<AIAgentPersonnelSearchArgs, 'queryType'>>;
  pageSize?: number;
  departmentPageSize?: number;
};

export const executePersonnelSearchTool = ({
  db,
  args,
  pageSize = 10,
  departmentPageSize = 10,
}: ExecutePersonnelSearchOptions): AIAgentPersonnelSearchResult => {
  const normalizedQuery = normalizeKeyword(args.searchQuery || '');
  const queryType = resolvePersonnelQueryType(normalizedQuery, args.queryType);
  const personnelsMethods = createPersonnelsMethods(() => db);
  const departmentsMethods = createDepartmentsMethods(() => db);

  if (queryType === 'department') {
    const departmentKeyword = cleanDepartmentKeyword(normalizedQuery);
    const matchedDepartments = departmentsMethods.getDepartments({
      page: 1,
      pageSize: departmentPageSize,
      search: departmentKeyword,
      searchFields: ['name'],
    }).data || [];

    if (matchedDepartments.length === 0) {
      return {
        queryType,
        keyword: departmentKeyword,
        total: 0,
        items: [],
        matchedDepartments: [],
        emptyReason: 'no_department',
      };
    }

    const matchedDepartmentStats = matchedDepartments.map((department) => {
      const personnelResult = personnelsMethods.getPersonnels({
        page: 1,
        pageSize,
        department_id: department.id,
      });
      return {
        department,
        personnelResult,
      };
    });

    const mergedPersonnelMap = new Map<string, AIAgentPersonnelSearchItem>();
    for (const { department, personnelResult } of matchedDepartmentStats) {
      for (const item of personnelResult.data || []) {
        const existing = mergedPersonnelMap.get(item.id);
        const nextMatchedNames = dedupeById([
          { id: department.id, name: department.name },
          ...((existing?.matchedDepartmentNames || []).map((name) => ({ id: name, name }))),
        ]).map(entry => entry.name);
        mergedPersonnelMap.set(item.id, {
          ...(existing || mapPersonnelItem(item)),
          matchedDepartmentNames: nextMatchedNames,
        });
      }
    }

    const items = Array.from(mergedPersonnelMap.values());
    const total = countDistinctPersonnelByDepartmentIds(
      db,
      matchedDepartmentStats.map(({ department }) => department.id),
    );

    return {
      queryType,
      keyword: departmentKeyword,
      total,
      items,
      matchedDepartments: matchedDepartmentStats.map(({ department, personnelResult }) => ({
        id: department.id,
        name: department.name,
        personnelCount: Number(personnelResult.total || 0),
      })),
      emptyReason: total > 0 ? undefined : 'department_without_personnel',
    };
  }

  if (queryType === 'document') {
    const keyword = normalizedQuery;
    const rows = db.prepare(`
      SELECT
        p.*,
        pd.doc_name,
        pd.doc_type,
        pd.id AS document_id
      FROM personnel p
      INNER JOIN personnel_documents pd ON pd.personnel_id = p.id
      WHERE p.deleted_at IS NULL
        AND pd.deleted_at IS NULL
        AND (
          p.name LIKE ?
          OR pd.doc_name LIKE ?
          OR pd.doc_type LIKE ?
          OR (pd.doc_type = 'id_card' AND p.address LIKE ?)
        )
      ORDER BY p.sort_order ASC, p.created_at DESC
      LIMIT ?
    `).all(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`, `%${keyword}%`, pageSize) as Array<Record<string, unknown>>;
    const byId = new Map<string, AIAgentPersonnelSearchItem>();
    for (const row of rows) {
      const personnelId = String(row.id || '').trim();
      if (!personnelId) continue;
      const base = byId.get(personnelId) || mapPersonnelItem(row as unknown as Personnel);
      const docNames = new Set(base.documentNames || []);
      const docTypes = new Set(base.documentTypes || []);
      if (row.doc_name) docNames.add(String(row.doc_name));
      if (row.doc_type) docTypes.add(String(row.doc_type));
      byId.set(personnelId, {
        ...base,
        documentNames: Array.from(docNames),
        documentTypes: Array.from(docTypes),
      });
    }
    const items = Array.from(byId.values());
    return {
      queryType,
      keyword,
      total: items.length,
      items,
      emptyReason: items.length > 0 ? undefined : 'no_match',
    };
  }

  const searchFields = PERSONNEL_QUERY_FIELDS[queryType];
  const personnelResult = personnelsMethods.getPersonnels({
    page: 1,
    pageSize,
    search: normalizedQuery,
    searchFields,
  });
  const items = (personnelResult.data || []).map(item => mapPersonnelItem(item));

  return {
    queryType,
    keyword: normalizedQuery,
    total: Number(personnelResult.total || 0),
    items,
    emptyReason: items.length > 0 ? undefined : 'no_match',
  };
};

export const resolvePersonnelQueryType = (
  searchQuery: string,
  preferredType?: AIAgentPersonnelSearchQueryType,
): AIAgentPersonnelSearchQueryType => {
  if (preferredType === 'department' || preferredType === 'name' || preferredType === 'phone' || preferredType === 'id_card_number' || preferredType === 'document') {
    return preferredType;
  }

  const normalized = normalizeKeyword(searchQuery);
  const compact = normalized.replace(/\s+/g, '');

  if (isLikelyDepartmentQuery(normalized)) {
    return 'department';
  }
  if (/证件|毕业证|身份证|有什么证/.test(normalized)) {
    return 'document';
  }
  if (/^\d{7,11}$/.test(compact)) {
    return 'phone';
  }
  if (/^[0-9Xx]{6,18}$/.test(compact)) {
    return compact.length >= 12 ? 'id_card_number' : 'phone';
  }
  return 'name';
};
