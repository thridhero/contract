export interface Department {
  id: string;
  parent_id?: string | null;
  code: string;
  name: string;
  leader: string;
  phone: string;
  email: string;
  sort_order: number;
  remark: string;
  deleted_at?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface DepartmentCreateDTO {
  parent_id?: string | null;
  code: string;
  name: string;
  leader?: string;
  phone?: string;
  email?: string;
  sort_order?: number;
  remark?: string;
}

export interface DepartmentUpdateDTO extends Partial<DepartmentCreateDTO> {
  id: string;
}

export interface DepartmentQueryDTO {
  search?: string;
  searchFields?: string[];
  page?: number;
  pageSize?: number;
}

export interface DepartmentQueryResult {
  data: Department[];
  total: number;
}
