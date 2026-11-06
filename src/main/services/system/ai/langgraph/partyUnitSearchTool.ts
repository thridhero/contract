import type Database from 'better-sqlite3';
import { createCustomersMethods } from '../../database/customers';
import { createSuppliersMethods } from '../../database/suppliers';
import type { Customer } from '../../../../../shared/types/customer.types';
import type { Supplier } from '../../../../../shared/types/supplier.types';
import type {
  AIAgentPartyUnitSearchArgs,
  AIAgentPartyUnitSearchItem,
  AIAgentPartyUnitSearchPartyType,
  AIAgentPartyUnitSearchResult,
} from '../../../../../shared/types/aiAgent.types';

const CUSTOMER_SEARCH_FIELDS = [
  'name',
  'code',
  'contact',
  'department',
  'mobile',
  'phone',
  'email',
  'address',
  'tax_number',
  'bank_name',
  'bank_account',
] as const;

const SUPPLIER_SEARCH_FIELDS = [
  'name',
  'code',
  'contact',
  'group_name',
  'phone',
  'address',
  'tax_number',
  'bank_name',
  'bank_account',
  'legal_rep_name',
  'legal_rep_mobile',
  'legal_rep_email',
] as const;

const normalizeKeyword = (value: string): string => String(value || '').replace(/\s+/g, ' ').trim();

const getPartyLabel = (partyType: AIAgentPartyUnitSearchPartyType): string => (
  partyType === 'party_a' ? '甲方单位' : '乙方单位'
);

const mapCustomerItem = (item: Customer): AIAgentPartyUnitSearchItem => ({
  partyType: 'party_a',
  id: item.id,
  code: String(item.code || '').trim(),
  name: String(item.name || '').trim(),
  groupName: String(item.group_name || '').trim(),
  contact: String(item.contact || '').trim(),
  department: String(item.department || '').trim(),
  mobile: String(item.mobile || '').trim(),
  phone: String(item.phone || '').trim(),
  email: String(item.email || '').trim(),
  address: String(item.address || '').trim(),
  taxNumber: String(item.tax_number || '').trim(),
  bankName: String(item.bank_name || '').trim(),
  bankAccount: String(item.bank_account || '').trim(),
  invoiceType: String(item.invoice_type || '').trim(),
  legalRepName: '',
  legalRepMobile: '',
  legalRepEmail: '',
  legalRepIdNumber: '',
});

const mapSupplierItem = (item: Supplier): AIAgentPartyUnitSearchItem => ({
  partyType: 'party_b',
  id: item.id,
  code: String(item.code || '').trim(),
  name: String(item.name || '').trim(),
  groupName: String(item.group_name || '').trim(),
  contact: String(item.contact || '').trim(),
  department: '',
  mobile: '',
  phone: String(item.phone || '').trim(),
  email: String(item.legal_rep_email || '').trim(),
  address: String(item.address || '').trim(),
  taxNumber: String(item.tax_number || '').trim(),
  bankName: String(item.bank_name || '').trim(),
  bankAccount: String(item.bank_account || '').trim(),
  invoiceType: String(item.invoice_type || '').trim(),
  legalRepName: String(item.legal_rep_name || '').trim(),
  legalRepMobile: String(item.legal_rep_mobile || '').trim(),
  legalRepEmail: String(item.legal_rep_email || '').trim(),
  legalRepIdNumber: String(item.legal_rep_id_number || '').trim(),
});

export const summarizePartyUnitSearchResult = (result: AIAgentPartyUnitSearchResult): string => {
  const partyLabel = getPartyLabel(result.partyType);
  if (result.total === 0) {
    return `未找到匹配${partyLabel}，建议尝试单位名称、编码、联系人、电话、税号或开户行重新查询。`;
  }
  const summary = result.items
    .slice(0, 10)
    .map((item) => {
      const lines = [
        `${item.name || '-'}（编码：${item.code || '-'}）`,
        `联系人：${item.contact || '-'}`,
        `电话：${item.mobile || item.phone || '-'}`,
        `税号：${item.taxNumber || '-'}`,
        `开户行：${item.bankName || '-'}`,
      ];
      if (item.legalRepName || item.legalRepMobile) {
        lines.push(`法人：${item.legalRepName || '-'}${item.legalRepMobile ? ` / ${item.legalRepMobile}` : ''}`);
      }
      return lines.join('，');
    })
    .join('\n');
  return `共命中 ${result.total} 个${partyLabel}，优先返回前 ${result.items.length} 个：\n${summary}`;
};

type ExecutePartyUnitSearchOptions = {
  db: Database.Database;
  args: AIAgentPartyUnitSearchArgs;
  pageSize?: number;
};

export const executePartyUnitSearchTool = ({
  db,
  args,
  pageSize = 10,
}: ExecutePartyUnitSearchOptions): AIAgentPartyUnitSearchResult => {
  const keyword = normalizeKeyword(args.searchQuery || '');
  if (!keyword) {
    return {
      partyType: args.partyType,
      keyword,
      total: 0,
      items: [],
      emptyReason: 'no_match',
    };
  }

  if (args.partyType === 'party_a') {
    const methods = createCustomersMethods(() => db);
    const result = methods.getCustomers({
      page: 1,
      pageSize,
      search: keyword,
      searchFields: [...CUSTOMER_SEARCH_FIELDS],
    });
    return {
      partyType: 'party_a',
      keyword,
      total: Number(result.total || 0),
      items: (result.data || []).map(item => mapCustomerItem(item)),
      emptyReason: result.total > 0 ? undefined : 'no_match',
    };
  }

  const methods = createSuppliersMethods(() => db);
  const result = methods.getSuppliers({
    page: 1,
    pageSize,
    search: keyword,
    searchFields: [...SUPPLIER_SEARCH_FIELDS],
  });
  return {
    partyType: 'party_b',
    keyword,
    total: Number(result.total || 0),
    items: (result.data || []).map(item => mapSupplierItem(item)),
    emptyReason: result.total > 0 ? undefined : 'no_match',
  };
};
