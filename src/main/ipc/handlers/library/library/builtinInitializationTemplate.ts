import {
  DICTIONARY_GROUPS_TREE_SETTING_KEY,
} from '../../../../services/system/librarySchemaMigration/dictionarySchemas';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import {
  getDefaultContractFormSchemaConfig,
  serializeContractFormSchema,
} from '../../../../../shared/utils/contractFormSchema';

export type LibraryInitializationSettingKey =
  | 'contract_form_schema'
  | 'dictionary_groups_tree'
  | 'tree_dictionary_groups_tree';

export interface LibraryInitializationSettingRecord {
  key: LibraryInitializationSettingKey;
  value: string;
  description: string;
}

export interface LibraryInitializationTagGroupRecord {
  id: string;
  name: string;
  sort_order: number;
}

export interface LibraryInitializationTagRecord {
  id: string;
  name: string;
  initial: string;
  initial_letter: string;
  code: string | null;
  color: string | null;
  is_common: number;
  group_id: string | null;
  use_count: number;
  sort_order: number;
  is_system: number;
}

export interface LibraryInitializationDictionaryRecord {
  id: string;
  name: string;
  code: string;
  abbreviation: string;
  bg_color: string;
  sort_order: number;
  value: string;
  remark: string;
  group_name: string;
}

export interface LibraryInitializationTreeDictionaryRecord {
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
}

export interface LibraryInitializationTemplateData {
  settings: LibraryInitializationSettingRecord[];
  tagGroups: LibraryInitializationTagGroupRecord[];
  tags: LibraryInitializationTagRecord[];
  dictionaries: LibraryInitializationDictionaryRecord[];
  treeDictionaries: LibraryInitializationTreeDictionaryRecord[];
}

type GroupTreeNode = {
  key: string;
  label: string;
  data: string;
  icon: string;
  children: GroupTreeNode[];
};

const ROOT_NODE_KEY = '0';
const ROOT_NODE_ICON = 'pi pi-fw pi-folder';
const PROJECT_STATUS_GROUP_ID = 'project_status';
const DEPARTMENT_GROUP_NAME = '部门';
const DEPARTMENT_ROOT_ID = 'builtin-tree-department-root';

const DEPARTMENT_CHILDREN = ['综合管理部', '市场部', '研发部', '财务部'];
const CONTRACT_SETTINGS_SEED_FILENAME = 'contract_settings_20260511.json';

type ContractSettingsSeedJson = {
  schemaVersion?: number;
  root?: { name?: string; children?: Array<{ name?: string; children?: unknown[] }> };
  dictionaries?: Record<string, Array<{
    name?: string;
    code?: string;
    abbreviation?: string;
    bg_color?: string;
    sort_order?: number;
    value?: string;
    remark?: string;
  }>>;
};

function createGroupNode(key: string, label: string, children: GroupTreeNode[] = []): GroupTreeNode {
  return {
    key,
    label,
    data: label,
    icon: ROOT_NODE_ICON,
    children,
  };
}

function stableSeedId(prefix: string, value: string): string {
  const digest = crypto.createHash('sha1').update(value).digest('hex').slice(0, 16);
  return `${prefix}-${digest}`;
}

function tryLoadContractSettingsSeedJson(): ContractSettingsSeedJson | null {
  const candidates = [
    path.join(process.resourcesPath || '', 'dictionary', CONTRACT_SETTINGS_SEED_FILENAME),
    path.join(process.cwd(), 'resources', 'dictionary', CONTRACT_SETTINGS_SEED_FILENAME),
    path.join(process.cwd(), 'docs', '合同设置_20260511.json'),
  ];

  for (const candidate of candidates) {
    try {
      if (!candidate || !fs.existsSync(candidate)) continue;
      const raw = fs.readFileSync(candidate, 'utf8');
      const parsed = JSON.parse(raw) as ContractSettingsSeedJson;
      if (!parsed || typeof parsed !== 'object') continue;
      return parsed;
    } catch {
      continue;
    }
  }
  return null;
}

function buildDictionaryGroupsTreeValue(
  seed: ContractSettingsSeedJson,
): string {
  const rootName = String(seed.root?.name || '').trim();
  const childNames = (seed.root?.children || [])
    .map((child) => String(child?.name || '').trim())
    .filter(Boolean);
  const dictionaryGroupNames = Object.keys(seed.dictionaries || {}).map((name) => String(name || '').trim()).filter(Boolean);
  const groupNames = Array.from(new Set([...childNames, ...dictionaryGroupNames]))
    .filter((name) => name && name !== rootName && name !== '所有分组');
  const tree: GroupTreeNode[] = [createGroupNode(ROOT_NODE_KEY, '所有分组', [])];
  const rootNode = tree[0];
  const parentNode = rootName
    ? createGroupNode('seed-contract-settings-root', rootName, [])
    : rootNode;

  if (rootName) {
    rootNode.children.push(parentNode);
  }

  for (const name of groupNames) {
    parentNode.children.push(createGroupNode(stableSeedId('seed-contract-settings-group', name), name, []));
  }

  return JSON.stringify(tree);
}

function buildDictionariesFromContractSettings(
  seed: ContractSettingsSeedJson,
): LibraryInitializationDictionaryRecord[] {
  const dictionaries = seed.dictionaries || {};
  const groups = Object.keys(dictionaries).map((g) => String(g || '').trim()).filter(Boolean);
  const records: LibraryInitializationDictionaryRecord[] = [];

  for (const groupName of groups) {
    const items = Array.isArray(dictionaries[groupName]) ? dictionaries[groupName] : [];
    for (const item of items) {
      const name = String(item?.name || '').trim();
      if (!name) continue;
      records.push({
        id: stableSeedId('seed-contract-settings-dict', `${groupName}|${name}`),
        name,
        code: String(item?.code || ''),
        abbreviation: String(item?.abbreviation || ''),
        bg_color: String(item?.bg_color || ''),
        sort_order: Number.isFinite(item?.sort_order as number) ? Number(item?.sort_order) : 0,
        value: String(item?.value || ''),
        remark: String(item?.remark || ''),
        group_name: groupName,
      });
    }
  }

  return records;
}

function buildTreeDictionaryGroupsTreeValue(): string {
  const departmentChildren = DEPARTMENT_CHILDREN.map((name, index) =>
    createGroupNode(`builtin-tree-department-node-${index + 1}`, name),
  );
  return JSON.stringify([
    createGroupNode(ROOT_NODE_KEY, '所有分组', [
      createGroupNode('builtin-tree-group-department', DEPARTMENT_GROUP_NAME, departmentChildren),
    ]),
  ]);
}

function buildBuiltinTagGroups(): LibraryInitializationTagGroupRecord[] {
  return [
    { id: PROJECT_STATUS_GROUP_ID, name: '项目状态', sort_order: 0 },
  ];
}

function buildBuiltinTags(): LibraryInitializationTagRecord[] {
  return [
    {
      id: 'builtin-tag-important',
      name: '重要',
      initial: 'Z',
      initial_letter: 'Z',
      code: null,
      color: null,
      is_common: 1,
      group_id: null,
      use_count: 0,
      sort_order: 0,
      is_system: 0,
    },
    {
      id: 'builtin-tag-urgent',
      name: '紧急',
      initial: 'J',
      initial_letter: 'J',
      code: null,
      color: null,
      is_common: 1,
      group_id: null,
      use_count: 0,
      sort_order: 0,
      is_system: 0,
    },
    {
      id: 'builtin-tag-project-preparing',
      name: '准备材料',
      initial: 'P',
      initial_letter: 'Z',
      code: 'preparing',
      color: 'blue',
      is_common: 0,
      group_id: PROJECT_STATUS_GROUP_ID,
      use_count: 0,
      sort_order: 1,
      is_system: 1,
    },
    {
      id: 'builtin-tag-project-submitted',
      name: '已提交',
      initial: 'S',
      initial_letter: 'Y',
      code: 'submitted',
      color: 'purple',
      is_common: 0,
      group_id: PROJECT_STATUS_GROUP_ID,
      use_count: 0,
      sort_order: 2,
      is_system: 1,
    },
    {
      id: 'builtin-tag-project-accepted',
      name: '已受理',
      initial: 'A',
      initial_letter: 'Y',
      code: 'accepted',
      color: 'green',
      is_common: 0,
      group_id: PROJECT_STATUS_GROUP_ID,
      use_count: 0,
      sort_order: 3,
      is_system: 1,
    },
    {
      id: 'builtin-tag-project-examining',
      name: '审查中',
      initial: 'E',
      initial_letter: 'S',
      code: 'examining',
      color: 'yellow',
      is_common: 0,
      group_id: PROJECT_STATUS_GROUP_ID,
      use_count: 0,
      sort_order: 4,
      is_system: 1,
    },
    {
      id: 'builtin-tag-project-correction',
      name: '补正中',
      initial: 'C',
      initial_letter: 'B',
      code: 'correction',
      color: 'orange',
      is_common: 0,
      group_id: PROJECT_STATUS_GROUP_ID,
      use_count: 0,
      sort_order: 5,
      is_system: 1,
    },
    {
      id: 'builtin-tag-project-fee-pending',
      name: '待缴费',
      initial: 'F',
      initial_letter: 'D',
      code: 'fee_pending',
      color: 'red',
      is_common: 0,
      group_id: PROJECT_STATUS_GROUP_ID,
      use_count: 0,
      sort_order: 6,
      is_system: 1,
    },
    {
      id: 'builtin-tag-project-fee-paid',
      name: '已缴费',
      initial: 'F',
      initial_letter: 'Y',
      code: 'fee_paid',
      color: 'green',
      is_common: 0,
      group_id: PROJECT_STATUS_GROUP_ID,
      use_count: 0,
      sort_order: 7,
      is_system: 1,
    },
    {
      id: 'builtin-tag-project-certificated',
      name: '已下证',
      initial: 'C',
      initial_letter: 'Y',
      code: 'certificated',
      color: 'purple',
      is_common: 0,
      group_id: PROJECT_STATUS_GROUP_ID,
      use_count: 0,
      sort_order: 8,
      is_system: 1,
    },
    {
      id: 'builtin-tag-project-completed',
      name: '已完成',
      initial: 'C',
      initial_letter: 'Y',
      code: 'completed',
      color: 'success',
      is_common: 0,
      group_id: PROJECT_STATUS_GROUP_ID,
      use_count: 0,
      sort_order: 9,
      is_system: 1,
    },
    {
      id: 'builtin-tag-project-rejected',
      name: '被驳回',
      initial: 'R',
      initial_letter: 'B',
      code: 'rejected',
      color: 'danger',
      is_common: 0,
      group_id: PROJECT_STATUS_GROUP_ID,
      use_count: 0,
      sort_order: 10,
      is_system: 1,
    },
    {
      id: 'builtin-tag-project-cancelled',
      name: '已取消',
      initial: 'C',
      initial_letter: 'Y',
      code: 'cancelled',
      color: 'gray',
      is_common: 0,
      group_id: PROJECT_STATUS_GROUP_ID,
      use_count: 0,
      sort_order: 11,
      is_system: 1,
    },
  ];
}

function buildBuiltinDictionaries(seed: ContractSettingsSeedJson | null): LibraryInitializationDictionaryRecord[] {
  if (!seed) return [];
  return buildDictionariesFromContractSettings(seed);
}

function buildBuiltinTreeDictionaries(): LibraryInitializationTreeDictionaryRecord[] {
  const records: LibraryInitializationTreeDictionaryRecord[] = [
    {
      id: DEPARTMENT_ROOT_ID,
      parent_id: '0',
      name: '默认根目录',
      code: '__ROOT__',
      abbreviation: '',
      bg_color: '',
      sort_order: 0,
      value: '',
      remark: '',
      group_name: DEPARTMENT_GROUP_NAME,
    },
  ];

  DEPARTMENT_CHILDREN.forEach((name, index) => {
    records.push({
      id: `builtin-tree-department-${index + 1}`,
      parent_id: DEPARTMENT_ROOT_ID,
      name,
      code: `DEPT_${index + 1}`,
      abbreviation: '',
      bg_color: '',
      sort_order: index + 1,
      value: name,
      remark: '',
      group_name: DEPARTMENT_GROUP_NAME,
    });
  });

  return records;
}

export function getBuiltinLibraryInitializationTemplate(): LibraryInitializationTemplateData {
  const seed = tryLoadContractSettingsSeedJson();
  const template: LibraryInitializationTemplateData = {
    settings: [
      {
        key: 'contract_form_schema',
        value: serializeContractFormSchema(getDefaultContractFormSchemaConfig()),
        description: '合同动态表单 schema 配置',
      },
      {
        key: DICTIONARY_GROUPS_TREE_SETTING_KEY,
        value: buildDictionaryGroupsTreeValue(seed || {}),
        description: '字典分组树结构',
      },
      {
        key: 'tree_dictionary_groups_tree',
        value: buildTreeDictionaryGroupsTreeValue(),
        description: '树形字典分组',
      },
    ],
    tagGroups: buildBuiltinTagGroups(),
    tags: buildBuiltinTags(),
    dictionaries: buildBuiltinDictionaries(seed),
    treeDictionaries: buildBuiltinTreeDictionaries(),
  };
  return template;
}
