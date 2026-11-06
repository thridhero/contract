export type ProjectManagementSearchField =
  | 'all'
  | 'code'
  | 'name'
  | 'content'
  | 'group_name'
  | 'engineering_location'
  | 'country'
  | 'province'
  | 'city';

export type ProjectManagementSortField =
  | 'sort_order'
  | 'code'
  | 'name'
  | 'project_date'
  | 'approval_date'
  | 'contract_deadline'
  | 'created_at'
  | 'updated_at'
  | 'building_area'
  | 'counted_area';

export type ProjectManagementSortOrder = 'asc' | 'desc';

export type ProjectManagementMoveDirection = 'top' | 'up' | 'down' | 'bottom';

export interface ProjectManagementItem {
  id: string;
  code: string;
  name: string;
  content: string;
  group_key: string | null;
  group_name: string | null;
  project_date: string | null;
  approval_date: string | null;
  contract_deadline: string | null;
  engineering_location: string | null;
  project_days: number | null;
  building_area: number | null;
  started_building_area: number | null;
  counted_area: number | null;
  started_counted_area: number | null;
  country: string | null;
  province: string | null;
  city: string | null;
  sort_order: number;
  deleted_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProjectManagementCreateDTO {
  code?: string;
  name: string;
  content?: string;
  group_key?: string | null;
  group_name?: string | null;
  project_date?: string | null;
  approval_date?: string | null;
  contract_deadline?: string | null;
  engineering_location?: string | null;
  project_days?: number | null;
  building_area?: number | null;
  started_building_area?: number | null;
  counted_area?: number | null;
  started_counted_area?: number | null;
  country?: string | null;
  province?: string | null;
  city?: string | null;
}

export interface ProjectManagementUpdateDTO extends Partial<ProjectManagementCreateDTO> {
  id: string;
}

export interface ProjectManagementQueryDTO {
  search?: string;
  searchField?: ProjectManagementSearchField;
  groupKeys?: string[];
  groupNames?: string[];
  page?: number;
  pageSize?: number;
  sortField?: ProjectManagementSortField;
  sortOrder?: ProjectManagementSortOrder;
  includeDeleted?: boolean;
}

export interface ProjectManagementQueryResult {
  data: ProjectManagementItem[];
  total: number;
}

export interface ProjectManagementSummary {
  total: number;
  totalProjectDays: number;
  totalBuildingArea: number;
  totalStartedBuildingArea: number;
  totalCountedArea: number;
  totalStartedCountedArea: number;
}

export interface ProjectManagementMoveDTO {
  id: string;
  direction: ProjectManagementMoveDirection;
  query?: ProjectManagementQueryDTO;
}

export interface ProjectManagementRecodeResult {
  updatedCount: number;
}

export interface ProjectManagementDeleteByQueryDTO {
  query?: ProjectManagementQueryDTO;
}

export interface ProjectManagementDesignField {
  field: string;
  label: string;
  visible: boolean;
  order: number;
}

export interface ProjectManagementDesignConfig {
  listFields: ProjectManagementDesignField[];
  formFields: ProjectManagementDesignField[];
  formLayout: 'single-column' | 'double-column';
}

export interface ProjectManagementSortConfig {
  field: ProjectManagementSortField;
  order: ProjectManagementSortOrder;
}

export interface ProjectManagementQueryPreferences {
  searchField: ProjectManagementSearchField;
  onlySelectedGroup: boolean;
  autoCombineGroupQuery: boolean;
  showSummary: boolean;
  pageSize: number;
}

export interface ProjectManagementGroupNode {
  key: string;
  label: string;
  data: string;
  icon?: string;
  children?: ProjectManagementGroupNode[];
}
