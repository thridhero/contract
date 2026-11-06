import type { ProjectManagementDesignConfig, ProjectManagementGroupNode, ProjectManagementQueryPreferences, ProjectManagementSortConfig } from '../../../../shared/types/projectManagement.types'

export const GROUPS_SETTING_KEY = 'project_management_groups_tree'
export const GROUPS_SOURCE_SETTING_KEY = 'project_management_groups_source'
export const TREE_DICTIONARY_GROUPS_SETTING_KEY = 'tree_dictionary_groups_tree'
export const DESIGN_SETTING_KEY = 'project_management_design'
export const SORT_SETTING_KEY = 'project_management_sort'
export const QUERY_SETTING_KEY = 'project_management_query_preferences'
export const VIEW_MODE_SETTING_KEY = 'project_management_view_mode'

export const defaultTreeData: ProjectManagementGroupNode[] = [
  {
    key: '0',
    label: '所有分组',
    data: '所有分组',
    icon: 'pi pi-folder',
    children: [],
  },
]

export const defaultDesignConfig: ProjectManagementDesignConfig = {
  listFields: [
    { field: 'code', label: '项目编号', visible: true, order: 1 },
    { field: 'name', label: '项目名称', visible: true, order: 2 },
    { field: 'group_name', label: '项目分组', visible: true, order: 3 },
    { field: 'project_date', label: '立项日期', visible: true, order: 4 },
    { field: 'approval_date', label: '概算批复时间', visible: false, order: 5 },
    { field: 'contract_deadline', label: '合同截止日期', visible: false, order: 6 },
    { field: 'engineering_location', label: '工程地点', visible: true, order: 7 },
    { field: 'building_area', label: '建筑面积', visible: true, order: 8 },
    { field: 'counted_area', label: '计容面积', visible: false, order: 9 },
    { field: 'country', label: '所在国家', visible: false, order: 10 },
    { field: 'province', label: '所在省份', visible: false, order: 11 },
    { field: 'city', label: '所在城市', visible: true, order: 12 },
    { field: 'updated_at', label: '更新时间', visible: true, order: 13 },
  ],
  formFields: [
    { field: 'code', label: '项目编号', visible: true, order: 1 },
    { field: 'name', label: '项目名称', visible: true, order: 2 },
    { field: 'content', label: '项目内容', visible: true, order: 3 },
    { field: 'group_name', label: '项目分组', visible: true, order: 4 },
    { field: 'project_date', label: '立项日期', visible: true, order: 5 },
    { field: 'approval_date', label: '概算批复时间', visible: true, order: 6 },
    { field: 'contract_deadline', label: '合同截止日期', visible: true, order: 7 },
    { field: 'engineering_location', label: '工程地点', visible: true, order: 8 },
    { field: 'project_days', label: '项目天数', visible: true, order: 9 },
    { field: 'building_area', label: '建筑面积', visible: true, order: 10 },
    { field: 'started_building_area', label: '已开工建筑面积', visible: true, order: 11 },
    { field: 'counted_area', label: '计容面积', visible: true, order: 12 },
    { field: 'started_counted_area', label: '开工计容面积', visible: true, order: 13 },
    { field: 'country', label: '所在国家', visible: true, order: 14 },
    { field: 'province', label: '所在省份', visible: true, order: 15 },
    { field: 'city', label: '所在城市', visible: true, order: 16 },
  ],
  formLayout: 'double-column',
}

export const defaultSortConfig: ProjectManagementSortConfig = {
  field: 'sort_order',
  order: 'asc',
}

export const defaultQueryPreferences: ProjectManagementQueryPreferences = {
  searchField: 'all',
  onlySelectedGroup: false,
  autoCombineGroupQuery: true,
  showSummary: true,
  pageSize: 20,
}

export const searchFieldOptions = [
  { label: '全部字段', value: 'all' },
  { label: '项目编号', value: 'code' },
  { label: '项目名称', value: 'name' },
  { label: '项目内容', value: 'content' },
  { label: '项目分组', value: 'group_name' },
  { label: '工程地点', value: 'engineering_location' },
  { label: '所在国家', value: 'country' },
  { label: '所在省份', value: 'province' },
  { label: '所在城市', value: 'city' },
]

export const sortFieldOptions = [
  { label: '手动排序', value: 'sort_order' },
  { label: '项目编号', value: 'code' },
  { label: '项目名称', value: 'name' },
  { label: '立项日期', value: 'project_date' },
  { label: '概算批复时间', value: 'approval_date' },
  { label: '合同截止日期', value: 'contract_deadline' },
  { label: '建筑面积', value: 'building_area' },
  { label: '计容面积', value: 'counted_area' },
  { label: '创建时间', value: 'created_at' },
  { label: '更新时间', value: 'updated_at' },
]

export const sortOrderOptions = [
  { label: '升序', value: 'asc' },
  { label: '降序', value: 'desc' },
]

export const columnLabelMap: Record<string, string> = {
  code: '项目编号',
  name: '项目名称',
  content: '项目内容',
  group_name: '项目分组',
  project_date: '立项日期',
  approval_date: '概算批复时间',
  contract_deadline: '合同截止日期',
  engineering_location: '工程地点',
  project_days: '项目天数',
  building_area: '建筑面积',
  started_building_area: '已开工建筑面积',
  counted_area: '计容面积',
  started_counted_area: '开工计容面积',
  country: '所在国家',
  province: '所在省份',
  city: '所在城市',
  created_at: '创建时间',
  updated_at: '更新时间',
}

export const dateFields = new Set(['project_date', 'approval_date', 'contract_deadline', 'created_at', 'updated_at'])
export const numberFields = new Set(['project_days', 'building_area', 'started_building_area', 'counted_area', 'started_counted_area'])
