export type ContractProductSearchField =
  | 'code'
  | 'name'
  | 'category'
  | 'specification'
  | 'unit'
  | 'purchase_date'
  | 'warranty_date'
  | 'contract_id'
  | 'contract_code'
  | 'contract_name'
  | 'customer_name'
  | 'supplier_name'
  | 'origin'
  | 'remark';

export interface ContractProduct {
  id: string;
  contract_id?: string;
  contract_code?: string;
  contract_name?: string;
  code: string;
  name: string;
  category: string;
  specification: string;
  unit: string;
  unit_price: number | null;
  quantity?: number | null;
  cost_price?: number | null;
  total_price?: number | null;
  purchase_date?: string;
  warranty_date?: string;
  origin?: string;
  customer_name?: string;
  supplier_name?: string;
  remark: string;
  deleted_at?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface ContractProductCreateDTO {
  contract_id?: string;
  contract_code?: string;
  contract_name?: string;
  code?: string;
  name: string;
  category?: string;
  specification?: string;
  unit?: string;
  unit_price?: number | null;
  quantity?: number | null;
  cost_price?: number | null;
  total_price?: number | null;
  purchase_date?: string;
  warranty_date?: string;
  origin?: string;
  customer_name?: string;
  supplier_name?: string;
  remark?: string;
}

export interface ContractProductUpdateDTO extends Partial<ContractProductCreateDTO> {
  id: string;
}

export type ContractProductWarrantyStatus = 'expired' | 'notExpired';

export interface ContractProductQueryDTO {
  contractId?: string;
  contractCode?: string;
  search?: string;
  searchFields?: ContractProductSearchField[];
  category?: string;
  warrantyStatus?: ContractProductWarrantyStatus;
  includeDeleted?: boolean;
  page?: number;
  pageSize?: number;
}

export interface ContractProductQueryResult {
  data: ContractProduct[];
  total: number;
}
