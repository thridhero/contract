export interface DictionaryItem {
  id: string;
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

export interface DictionaryCreateDTO {
  name: string;
  code?: string;
  abbreviation?: string;
  bg_color?: string;
  sort_order?: number;
  value?: string;
  remark?: string;
  group_name?: string;
}

export interface DictionaryUpdateDTO extends Partial<DictionaryCreateDTO> {
  id: string;
}

export interface DictionaryQueryDTO {
  search?: string;
  searchFields?: string[];
  group_name?: string;
  page?: number;
  pageSize?: number;
}

export interface DictionaryQueryResult {
  data: DictionaryItem[];
  total: number;
}

export interface DictionaryGroupBundleNode {
  name: string;
  children?: DictionaryGroupBundleNode[];
}

export interface DictionaryGroupBundleItem {
  name: string;
  code?: string;
  abbreviation?: string;
  bg_color?: string;
  sort_order?: number;
  value?: string;
  remark?: string;
}

export interface DictionaryGroupBundleV1 {
  schemaVersion: 1;
  exportedAt: string;
  root: DictionaryGroupBundleNode;
  dictionaries: Record<string, DictionaryGroupBundleItem[]>;
}

export interface DictionaryGroupBundleExportResult {
  groupCount: number;
  dictionaryCount: number;
  filePath: string;
}

export interface DictionaryGroupBundleImportResult {
  groupsAdded: number;
  groupsRenamed: number;
  dictionariesImported: number;
  dictionariesSkipped: number;
}
