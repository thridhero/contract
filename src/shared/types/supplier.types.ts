export interface SupplierContact {
  id: string;
  name: string;
  department: string;
  mobile: string;
  phone: string;
  email: string;
  id_number: string;
  wechat: string;
  is_legal_representative: boolean;
  is_primary: boolean;
}

export interface Supplier {
  id: string;
  code: string;
  name: string;
  contact: string;
  group_name: string;
  bank_account: string;
  bank_name: string;
  phone: string;
  address: string;
  tax_number: string;
  invoice_type: string;
  reg_date: string;
  legal_rep_name: string;
  legal_rep_id_number: string;
  legal_rep_mobile: string;
  legal_rep_email: string;
  contacts?: string; // JSON string of SupplierContact[]
  deleted_at?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface SupplierCreateDTO {
  code?: string;
  name: string;
  contact?: string;
  group_name?: string;
  bank_account?: string;
  bank_name?: string;
  phone?: string;
  address?: string;
  tax_number?: string;
  invoice_type?: string;
  reg_date?: string;
  legal_rep_name?: string;
  legal_rep_id_number?: string;
  legal_rep_mobile?: string;
  legal_rep_email?: string;
  contacts?: string; // JSON string
}

export interface SupplierUpdateDTO extends Partial<SupplierCreateDTO> {
  id: string;
}

export interface SupplierQueryDTO {
  search?: string;
  searchFields?: string[];
  group_name?: string;
  page?: number;
  pageSize?: number;
}

export interface SupplierQueryResult {
  data: Supplier[];
  total: number;
}
