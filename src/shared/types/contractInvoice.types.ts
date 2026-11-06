export type ContractInvoiceSearchField =
  | 'contract_code'
  | 'contract_name'
  | 'source_path'
  | 'invoice_type'
  | 'invoice_code'
  | 'invoice_no'
  | 'seller_name'
  | 'seller_tax_no'
  | 'buyer_name'
  | 'buyer_tax_no'
  | 'currency'
  | 'parse_status'
  | 'parse_engine'
  | 'parse_error'
  | 'parse_errors';

export interface ContractInvoice {
  id: string;
  contract_id: string;
  contract_code: string;
  contract_name: string;
  file_id: string;
  source_sha256: string;
  source_path?: string | null;
  invoice_type?: string | null;
  invoice_code?: string | null;
  invoice_no?: string | null;
  invoice_date?: string | null;
  issue_date?: string | null;
  seller_name?: string | null;
  seller_tax_no?: string | null;
  buyer_name?: string | null;
  buyer_tax_no?: string | null;
  amount_without_tax?: number | null;
  tax_amount?: number | null;
  amount_with_tax?: number | null;
  total_amount?: number | null;
  invoice_items_json?: string | null;
  remark?: string | null;
  issuer_name?: string | null;
  currency?: string | null;
  parse_status?: string | null;
  parse_confidence?: number | null;
  parse_error?: string | null;
  parse_errors?: string | null;
  parse_engine?: string | null;
  parse_result_json?: string | null;
  raw_text_excerpt?: string | null;
  parse_started_at?: string | null;
  parse_finished_at?: string | null;
  deleted_at?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface ContractInvoiceCreateDTO {
  contract_id: string;
  contract_code: string;
  contract_name: string;
  file_id: string;
  source_sha256: string;
  source_path?: string;
  invoice_type?: string;
  invoice_code?: string;
  invoice_no?: string;
  invoice_date?: string;
  issue_date?: string;
  seller_name?: string;
  seller_tax_no?: string;
  buyer_name?: string;
  buyer_tax_no?: string;
  amount_without_tax?: number;
  tax_amount?: number;
  amount_with_tax?: number;
  total_amount?: number;
  invoice_items_json?: string;
  remark?: string;
  issuer_name?: string;
  currency?: string;
  parse_status?: string;
  parse_confidence?: number;
  parse_error?: string;
  parse_errors?: string;
  parse_engine?: string;
  parse_result_json?: string;
  raw_text_excerpt?: string;
  parse_started_at?: string;
  parse_finished_at?: string;
}

export interface ContractInvoiceUpdateDTO extends Partial<ContractInvoiceCreateDTO> {
  id: string;
}

export interface ContractInvoiceQueryDTO {
  contractId?: string;
  contractCode?: string;
  fileId?: string;
  sourceSha256?: string;
  invoiceNo?: string;
  sellerName?: string;
  buyerName?: string;
  invoiceType?: string;
  parseStatus?: string;
  currency?: string;
  search?: string;
  searchFields?: ContractInvoiceSearchField[];
  includeDeleted?: boolean;
  sortBy?:
    | 'contract_code'
    | 'contract_name'
    | 'invoice_no'
    | 'issue_date'
    | 'amount_without_tax'
    | 'tax_amount'
    | 'total_amount'
    | 'created_at'
    | 'updated_at';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  pageSize?: number;
}

export interface ContractInvoiceQueryResult {
  data: ContractInvoice[];
  total: number;
}
