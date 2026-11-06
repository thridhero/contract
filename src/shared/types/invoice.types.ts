export type InvoiceFieldKey =
  | 'invoiceType'
  | 'invoiceCode'
  | 'invoiceNo'
  | 'issueDate'
  | 'checkCode'
  | 'machineNo'
  | 'buyerName'
  | 'buyerTaxNo'
  | 'sellerName'
  | 'sellerTaxNo'
  | 'amountWithoutTax'
  | 'taxAmount'
  | 'totalAmount'
  | 'invoiceItems'
  | 'remark'
  | 'issuerName';

export interface InvoiceFieldResult<T> {
  value?: T;
  confidence: number;
  evidence?: string;
}

export interface InvoiceParseError {
  code: string;
  message: string;
  field?: InvoiceFieldKey;
  evidence?: string;
}

export interface InvoiceItem {
  projectName?: string;
  unitPrice?: number;
  quantity?: number;
  amount?: number;
  taxRate?: string;
  taxAmount?: number;
}

export interface InvoiceParsedData {
  invoiceType?: string;
  invoiceCode?: string;
  invoiceNo?: string;
  issueDate?: string;
  checkCode?: string;
  machineNo?: string;
  buyerName?: string;
  buyerTaxNo?: string;
  sellerName?: string;
  sellerTaxNo?: string;
  amountWithoutTax?: number;
  taxAmount?: number;
  totalAmount?: number;
  invoiceItems?: InvoiceItem[];
  remark?: string;
  issuerName?: string;
}

export interface InvoiceParsedFields {
  invoiceType: InvoiceFieldResult<string>;
  invoiceCode: InvoiceFieldResult<string>;
  invoiceNo: InvoiceFieldResult<string>;
  issueDate: InvoiceFieldResult<string>;
  checkCode: InvoiceFieldResult<string>;
  machineNo: InvoiceFieldResult<string>;
  buyerName: InvoiceFieldResult<string>;
  buyerTaxNo: InvoiceFieldResult<string>;
  sellerName: InvoiceFieldResult<string>;
  sellerTaxNo: InvoiceFieldResult<string>;
  amountWithoutTax: InvoiceFieldResult<number>;
  taxAmount: InvoiceFieldResult<number>;
  totalAmount: InvoiceFieldResult<number>;
  invoiceItems: InvoiceFieldResult<InvoiceItem[]>;
  remark: InvoiceFieldResult<string>;
  issuerName: InvoiceFieldResult<string>;
}

export interface InvoiceParseResult {
  isInvoice: boolean;
  confidence: number;
  data: InvoiceParsedData;
  fields: InvoiceParsedFields;
  errors: InvoiceParseError[];
}
