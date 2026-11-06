export interface ContractInfoCreateDTO {
  libraryPath: string;
  skipRequiredValidation?: boolean;
  autoCreatePartyUnits?: boolean;
  partyAPhone?: string;
  partyAAddress?: string;
  partyATaxNumber?: string;
  partyABankName?: string;
  partyABankAccount?: string;
  partyAInvoiceType?: string;
  partyBPhone?: string;
  partyBAddress?: string;
  partyBTaxNumber?: string;
  partyBBankName?: string;
  partyBBankAccount?: string;
  partyBInvoiceType?: string;
  partyBLegalRepName?: string;
  partyBLegalRepMobile?: string;
  partyBLegalRepEmail?: string;
  partyBLegalRepIdNumber?: string;
  contractName: string;
  contractCode: string;
  signingDate: string;
  contractType: string;
  groupName: string;
  currency: string;
  clientName: string;
  partyAContact?: string;
  partyAContactMobile?: string;
  partyAContactPhone?: string;
  partyAContactEmail?: string;
  partyAContactIdNumber?: string;
  partyBName: string;
  partyBContact?: string;
  partyBContactMobile?: string;
  partyBContactPhone?: string;
  partyBContactEmail?: string;
  partyBContactIdNumber?: string;
  contractSummary: string;
  contractAmount?: number | null;
  contractStatus?: string;
  department?: string;
  responsiblePerson?: string;
  endDate?: string;
  settlementMethod?: string;
  signingForm?: string;
  procurementSource?: string;
  executionMethod?: string;
  remark?: string;
  contractTags?: string[];
  extData?: Record<string, string | number | string[] | null> | null;
  projectIcon: string;
  projectColor: string;
}

export interface ContractInfoEntity {
  id: string;
  contract_name: string;
  contract_code: string;
  signing_date: string;
  contract_type: string;
  group_name: string | null;
  currency: string | null;
  client_name: string;
  party_a_contact: string | null;
  party_a_contact_mobile?: string | null;
  party_a_contact_phone?: string | null;
  party_a_contact_email?: string | null;
  party_a_contact_id_number?: string | null;
  party_b_name: string;
  party_b_contact: string | null;
  party_b_contact_mobile?: string | null;
  party_b_contact_phone?: string | null;
  party_b_contact_email?: string | null;
  party_b_contact_id_number?: string | null;
  contract_summary: string;
  contract_amount: number | null;
  contract_status: string | null;
  department: string | null;
  responsible_person: string | null;
  end_date: string | null;
  settlement_method: string | null;
  signing_form: string | null;
  procurement_source: string | null;
  execution_method: string | null;
  remark: string | null;
  contract_tags: string | null;
  ext_data: string | null;
  folder_name: string;
  project_icon: string | null;
  project_color: string | null;
  sort_order: number;
  trash_path?: string | null;
  deleted_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ContractInfoCreateResult {
  id: string;
  folderName: string;
  projectPath: string;
}

export interface ContractInfoUpdateDTO {
  libraryPath: string;
  id: string;
  skipRequiredValidation?: boolean;
  partyAPhone?: string;
  partyAAddress?: string;
  partyATaxNumber?: string;
  partyABankName?: string;
  partyABankAccount?: string;
  partyAInvoiceType?: string;
  partyBPhone?: string;
  partyBAddress?: string;
  partyBTaxNumber?: string;
  partyBBankName?: string;
  partyBBankAccount?: string;
  partyBInvoiceType?: string;
  partyBLegalRepName?: string;
  partyBLegalRepMobile?: string;
  partyBLegalRepEmail?: string;
  partyBLegalRepIdNumber?: string;
  contractName: string;
  contractCode: string;
  signingDate: string;
  contractType: string;
  groupName: string;
  currency: string;
  clientName: string;
  partyAContact?: string;
  partyAContactMobile?: string;
  partyAContactPhone?: string;
  partyAContactEmail?: string;
  partyAContactIdNumber?: string;
  partyBName: string;
  partyBContact?: string;
  partyBContactMobile?: string;
  partyBContactPhone?: string;
  partyBContactEmail?: string;
  partyBContactIdNumber?: string;
  contractSummary: string;
  contractAmount?: number | null;
  contractStatus?: string;
  department?: string;
  responsiblePerson?: string;
  endDate?: string;
  settlementMethod?: string;
  signingForm?: string;
  procurementSource?: string;
  executionMethod?: string;
  remark?: string;
  contractTags?: string[];
  extData?: Record<string, string | number | string[] | null> | null;
  projectIcon?: string;
  projectColor?: string;
}

export interface ContractInfoDeleteDTO {
  libraryPath: string;
  id: string;
}

export interface ContractInfoBatchDeleteDTO {
  libraryPath: string;
  ids: string[];
}

export interface ContractInfoRestoreDTO {
  libraryPath: string;
  id: string;
}

export interface ContractInfoBatchRestoreDTO {
  libraryPath: string;
  ids: string[];
}

export interface ContractInfoPurgeDTO {
  libraryPath: string;
  id: string;
}

export interface ContractInfoBatchPurgeDTO {
  libraryPath: string;
  ids: string[];
}

export type ContractInfoMoveDirection = 'top' | 'up' | 'down' | 'bottom';

export interface ContractInfoMoveDTO {
  libraryPath: string;
  id: string;
  direction: ContractInfoMoveDirection;
}

export interface ContractInfoGetDTO {
  libraryPath: string;
  id: string;
  includeDeleted?: boolean;
}

export type ContractInfoSearchField =
  | 'all'
  | 'contract_name'
  | 'contract_code'
  | 'client_name'
  | 'party_b_name'
  | 'contract_type';

export interface ContractInfoQueryFilters {
  client_name?: string[];
  party_b_name?: string[];
  contract_type?: string[];
  end_date_start?: string;
  end_date_end?: string;
}

export interface ContractInfoQueryDTO {
  libraryPath: string;
  page: number;
  pageSize: number;
  searchQuery?: string;
  searchFields?: ContractInfoSearchField[];
  searchField?: ContractInfoSearchField;
  includeDeleted?: boolean;
  filters?: ContractInfoQueryFilters;
}

export interface ContractInfoQueryResult {
  items: ContractInfoEntity[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ContractInfoSummaryStatsDTO {
  libraryPath: string;
  searchQuery?: string;
  searchFields?: ContractInfoSearchField[];
  searchField?: ContractInfoSearchField;
  filters?: ContractInfoQueryFilters;
}

export interface ContractInfoSummaryStatsResult {
  totalContracts: number;
  totalPartyAUnits: number;
  totalPartyBUnits: number;
  totalPendingReceipts: number;
  totalReceivedReceipts: number;
  totalFinishedContracts: number;
}
