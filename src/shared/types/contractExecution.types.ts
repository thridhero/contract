export type ContractExecutionSearchField =
  | 'execution_time'
  | 'execution_status'
  | 'salesperson'
  | 'content'
  | 'register_date'
  | 'progress'
  | 'remark'
  | 'custom2'
  | 'custom3'
  | 'custom4'
  | 'contract_code'
  | 'contract_name';

export interface ContractExecution {
  id: string;
  contract_id?: string | null;
  contract_code?: string | null;
  contract_name?: string | null;
  execution_time?: string | null;
  execution_status?: string | null;
  salesperson?: string | null;
  content?: string | null;
  register_date?: string | null;
  progress?: string | null;
  remark?: string | null;
  custom2?: string | null;
  custom3?: string | null;
  custom4?: string | null;
  deleted_at?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface ContractExecutionCreateDTO {
  contract_id?: string | null;
  contract_code?: string | null;
  contract_name?: string | null;
  execution_time?: string | null;
  execution_status?: string | null;
  salesperson?: string | null;
  content?: string | null;
  register_date?: string | null;
  progress?: string | null;
  remark?: string | null;
  custom2?: string | null;
  custom3?: string | null;
  custom4?: string | null;
}

export interface ContractExecutionUpdateDTO extends Partial<ContractExecutionCreateDTO> {
  id: string;
}

export interface ContractExecutionQueryDTO {
  contractId?: string;
  contractCode?: string;
  search?: string;
  searchFields?: ContractExecutionSearchField[];
  includeDeleted?: boolean;
  page?: number;
  pageSize?: number;
}

export interface ContractExecutionQueryResult {
  data: ContractExecution[];
  total: number;
}
