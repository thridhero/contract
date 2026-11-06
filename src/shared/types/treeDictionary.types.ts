export interface TreeDictionaryItem {
  id: string;
  parent_id: string;
  name: string;
  code: string;
  abbreviation: string;
  bg_color: string;
  sort_order: number;
  value: string;
  remark: string;
  group_name: string;
  deleted_at?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface TreeDictionaryCreateDTO {
  parent_id?: string;
  name: string;
  code?: string;
  abbreviation?: string;
  bg_color?: string;
  sort_order?: number;
  value?: string;
  remark?: string;
  group_name?: string;
}

export interface TreeDictionaryUpdateDTO extends Partial<TreeDictionaryCreateDTO> {
  id: string;
}

export interface TreeDictionaryQueryDTO {
  search?: string;
  searchFields?: string[];
  group_name?: string;
  parent_id?: string;
  page?: number;
  pageSize?: number;
}

export interface TreeDictionaryQueryResult {
  data: TreeDictionaryItem[];
  total: number;
}
