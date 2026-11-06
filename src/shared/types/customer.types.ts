export interface CustomerContact {
  id: string;
  name: string;
  department: string;
  mobile: string;
  phone: string;
  email: string;
  id_number: string;
  is_legal_representative: boolean;
  is_primary: boolean;
}

export interface Customer {
  id: string;
  group_name: string;
  code: string;
  name: string;
  contact: string;
  department: string;
  mobile: string;
  wechat: string;
  phone: string;
  fax: string;
  email: string;
  address: string;
  msn: string;
  company_type: string;
  industry: string;
  products: string;
  website: string;
  capital: string;
  country: string;
  province: string;
  city: string;
  reg_date: string;
  legal_rep_name: string;
  legal_rep_id_number: string;
  legal_rep_mobile: string;
  legal_rep_email: string;
  tax_number: string;
  bank_name: string;
  bank_account: string;
  invoice_type: string;
  custom1: string;
  custom2: string;
  custom3: string;
  custom4: string;
  contacts?: string; // JSON string of CustomerContact[]
  deleted_at?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface CustomerCreateDTO {
  group_name?: string;
  code?: string;
  name: string;
  contact?: string;
  department?: string;
  mobile?: string;
  wechat?: string;
  phone?: string;
  fax?: string;
  email?: string;
  address?: string;
  msn?: string;
  company_type?: string;
  industry?: string;
  products?: string;
  website?: string;
  capital?: string;
  country?: string;
  province?: string;
  city?: string;
  reg_date?: string;
  legal_rep_name?: string;
  legal_rep_id_number?: string;
  legal_rep_mobile?: string;
  legal_rep_email?: string;
  tax_number?: string;
  bank_name?: string;
  bank_account?: string;
  invoice_type?: string;
  custom1?: string;
  custom2?: string;
  custom3?: string;
  custom4?: string;
  contacts?: string; // JSON string
}

export interface CustomerUpdateDTO extends Partial<CustomerCreateDTO> {
  id: string;
}

export interface CustomerQueryDTO {
  search?: string;
  searchFields?: string[];
  group_name?: string;
  /**
   * 为 true 时才会在主进程附加 group_name 过滤。
   * 默认不传/false，避免客户列表初始、搜索、分页被分组条件影响。
   */
  useGroupFilter?: boolean;
  page?: number;
  pageSize?: number;
}

export interface CustomerQueryResult {
  data: Customer[];
  total: number;
}
