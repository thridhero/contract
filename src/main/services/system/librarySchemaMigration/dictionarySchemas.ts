import Database from 'better-sqlite3';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { ensureColumns } from './shared';

const DICTIONARY_SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS dictionaries (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    code TEXT,
    abbreviation TEXT,
    bg_color TEXT,
    sort_order INTEGER DEFAULT 0,
    value TEXT,
    remark TEXT,
    group_name TEXT,
    deleted_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`;

const DICTIONARY_UPDATED_AT_TRIGGER_SQL = `
  CREATE TRIGGER IF NOT EXISTS trg_dictionaries_updated_at
  AFTER UPDATE ON dictionaries
  FOR EACH ROW
  WHEN NEW.updated_at <= OLD.updated_at
  BEGIN
    UPDATE dictionaries
    SET updated_at = CURRENT_TIMESTAMP
    WHERE id = OLD.id;
  END
`;

const DICTIONARY_COLUMNS: Array<{ name: string; ddl: string }> = [
  { name: 'id', ddl: 'TEXT' },
  { name: 'name', ddl: "TEXT NOT NULL DEFAULT ''" },
  { name: 'code', ddl: "TEXT DEFAULT ''" },
  { name: 'abbreviation', ddl: "TEXT DEFAULT ''" },
  { name: 'bg_color', ddl: "TEXT DEFAULT ''" },
  { name: 'sort_order', ddl: "INTEGER DEFAULT 0" },
  { name: 'value', ddl: "TEXT DEFAULT ''" },
  { name: 'remark', ddl: "TEXT DEFAULT ''" },
  { name: 'group_name', ddl: "TEXT DEFAULT ''" },
  { name: 'deleted_at', ddl: 'DATETIME' },
  { name: 'created_at', ddl: 'DATETIME' },
  { name: 'updated_at', ddl: 'DATETIME' },
];

const NORMALIZE_DICTIONARY_VALUE_4DIGIT_SETTING_KEY = 'normalize_dictionary_value_4digit_v1';
const CONTRACT_SETTINGS_20260511_SEED_SETTING_KEY = 'seed_contract_settings_20260511_v1';
export const DICTIONARY_GROUPS_TREE_SETTING_KEY = 'dictionary_groups_tree';
export const POSITION_PARENT_GROUP_NAME = '字段管理';
export const POSITION_GROUP_NAME = '岗位管理';
export const CONTRACT_STATUS_GROUP_NAME = '合同状态';
const CONTRACT_SETTINGS_SEED_FILENAME = 'contract_settings_20260511.json';

function formatFourDigitCode(index: number): string {
  return String(Math.max(1, index)).padStart(4, '0');
}

type DictionaryGroupTreeNode = {
  key: string;
  label: string;
  data: string;
  icon: string;
  children: DictionaryGroupTreeNode[];
};

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

const ROOT_GROUP_NODE: DictionaryGroupTreeNode = {
  key: '0',
  label: '所有分组',
  data: '所有分组',
  icon: 'pi pi-fw pi-folder',
  children: [],
};

function normalizeGroupTreeNode(raw: unknown): DictionaryGroupTreeNode | null {
  if (!raw || typeof raw !== 'object') return null;
  const source = raw as Record<string, unknown>;
  const key = String(source.key ?? '');
  const data = String(source.data ?? source.label ?? '').trim();
  const label = String(source.label ?? source.data ?? '').trim();
  if (!key || !label || !data) return null;
  const icon = String(source.icon ?? 'pi pi-folder');
  const childrenRaw = Array.isArray(source.children) ? source.children : [];
  const children: DictionaryGroupTreeNode[] = [];
  for (const childRaw of childrenRaw) {
    const child = normalizeGroupTreeNode(childRaw);
    if (child) children.push(child);
  }
  return { key, label, data, icon, children };
}

function parseDictionaryGroupsTree(rawValue: string | null): DictionaryGroupTreeNode[] {
  if (!rawValue || !rawValue.trim()) return [{ ...ROOT_GROUP_NODE, children: [] }];
  try {
    const parsed = JSON.parse(rawValue);
    if (!Array.isArray(parsed)) return [{ ...ROOT_GROUP_NODE, children: [] }];
    const nodes = parsed.map(normalizeGroupTreeNode).filter((node): node is DictionaryGroupTreeNode => Boolean(node));
    if (nodes.length === 0) return [{ ...ROOT_GROUP_NODE, children: [] }];
    return nodes;
  } catch {
    return [{ ...ROOT_GROUP_NODE, children: [] }];
  }
}

function findNodeByName(nodes: DictionaryGroupTreeNode[], name: string): DictionaryGroupTreeNode | null {
  for (const node of nodes) {
    const nodeName = String(node.data || node.label || '').trim();
    if (nodeName === name) return node;
    const child = findNodeByName(node.children || [], name);
    if (child) return child;
  }
  return null;
}

function detachNodeByName(nodes: DictionaryGroupTreeNode[], name: string): DictionaryGroupTreeNode | null {
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    const nodeName = String(node.data || node.label || '').trim();
    if (nodeName === name && String(node.key || '') !== '0') {
      nodes.splice(i, 1);
      return node;
    }
    const child = detachNodeByName(node.children || [], name);
    if (child) return child;
  }
  return null;
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

function ensureContractSettingsGroupsTree(
  db: Database.Database,
  seed: ContractSettingsSeedJson,
): void {
  const rootName = String(seed.root?.name || '').trim();
  const childNames = (seed.root?.children || [])
    .map((child) => String(child?.name || '').trim())
    .filter(Boolean);
  const dictionaryGroupNames = Object.keys(seed.dictionaries || {})
    .map((name) => String(name || '').trim())
    .filter(Boolean);
  const groupNames = Array.from(new Set([...childNames, ...dictionaryGroupNames]))
    .filter((name) => name && name !== rootName && name !== '所有分组');
  if (!rootName && groupNames.length === 0) return;

  const settingRow = db
    .prepare('SELECT value FROM settings WHERE key = ?')
    .get(DICTIONARY_GROUPS_TREE_SETTING_KEY) as { value?: string } | undefined;
  const tree = parseDictionaryGroupsTree(settingRow?.value ?? null);

  let rootNode = tree.find((node) => String(node.key || '') === '0');
  if (!rootNode) {
    rootNode = { ...ROOT_GROUP_NODE, children: [] };
    tree.unshift(rootNode);
  }

  let contractSettingsNode = rootName ? findNodeByName(tree, rootName) : null;
  if (!contractSettingsNode && rootName) {
    contractSettingsNode = {
      key: 'seed-contract-settings-root',
      label: rootName,
      data: rootName,
      icon: 'pi pi-folder',
      children: [],
    };
    rootNode.children.push(contractSettingsNode);
  }
  const parentNode = contractSettingsNode || rootNode;

  for (const name of groupNames) {
    const existing = detachNodeByName(tree, name) || {
      key: `seed-contract-settings-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      label: name,
      data: name,
      icon: 'pi pi-folder',
      children: [],
    };
    existing.label = name;
    existing.data = name;
    existing.icon = existing.icon || 'pi pi-folder';
    existing.children = Array.isArray(existing.children) ? existing.children : [];
    const alreadyInParent = parentNode.children.some((child) => String(child.data || '').trim() === name);
    if (!alreadyInParent) parentNode.children.push(existing);
  }

  const value = JSON.stringify(tree);
  db.prepare(`
    INSERT INTO settings (key, value, description)
    VALUES (?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET
      value = excluded.value,
      description = excluded.description,
      updated_at = CURRENT_TIMESTAMP
  `).run(DICTIONARY_GROUPS_TREE_SETTING_KEY, value, '字典分组树结构');
}

function seedContractSettingsFromJsonWhenEmpty(db: Database.Database): void {
  const seeded = db.prepare('SELECT 1 FROM settings WHERE key = ? LIMIT 1').get(CONTRACT_SETTINGS_20260511_SEED_SETTING_KEY);
  if (seeded) return;

  const total = db.prepare('SELECT COUNT(1) AS cnt FROM dictionaries WHERE deleted_at IS NULL').get() as { cnt?: number } | undefined;
  if ((total?.cnt || 0) > 0) return;

  const seed = tryLoadContractSettingsSeedJson();
  if (!seed) return;

  const dictionaries = seed.dictionaries || {};
  const groupNames = Object.keys(dictionaries).map((g) => String(g || '').trim()).filter(Boolean);
  if (groupNames.length === 0) return;

  const insertDictionaryStmt = db.prepare(`
    INSERT INTO dictionaries (
      id, name, code, abbreviation, bg_color, sort_order, value, remark, group_name
    )
    SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?
    WHERE NOT EXISTS (
      SELECT 1
      FROM dictionaries
      WHERE group_name = ? AND name = ?
    )
  `);

  const tx = db.transaction(() => {
    ensureContractSettingsGroupsTree(db, seed);
    for (const groupName of groupNames) {
      const items = Array.isArray(dictionaries[groupName]) ? dictionaries[groupName] : [];
      for (const item of items) {
        const name = String(item?.name || '').trim();
        if (!name) continue;
        insertDictionaryStmt.run(
          crypto.randomUUID(),
          name,
          String(item?.code || ''),
          String(item?.abbreviation || ''),
          String(item?.bg_color || ''),
          Number.isFinite(item?.sort_order as number) ? Number(item?.sort_order) : 0,
          String(item?.value || ''),
          String(item?.remark || ''),
          groupName,
          groupName,
          name,
        );
      }
    }

    db.prepare(`
      INSERT INTO settings (key, value, description)
      VALUES (?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET
        value = excluded.value,
        description = excluded.description,
        updated_at = CURRENT_TIMESTAMP
    `).run(CONTRACT_SETTINGS_20260511_SEED_SETTING_KEY, new Date().toISOString(), '合同设置默认字典初始化标记(20260511)');
  });

  tx();
}

function normalizeDictionaryValueToFourDigitsByGroup(db: Database.Database): void {
  const normalized = db
    .prepare('SELECT 1 FROM settings WHERE key = ? LIMIT 1')
    .get(NORMALIZE_DICTIONARY_VALUE_4DIGIT_SETTING_KEY);
  if (normalized) return;

  const rows = db.prepare(`
    SELECT id, group_name
    FROM dictionaries
    WHERE deleted_at IS NULL
    ORDER BY group_name ASC, sort_order ASC, created_at ASC, id ASC
  `).all() as Array<{ id: string; group_name?: string | null }>;

  const updateStmt = db.prepare('UPDATE dictionaries SET value = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?');

  const tx = db.transaction(() => {
    let currentGroup = '__INIT__';
    let sequence = 0;

    for (const row of rows) {
      const groupName = String(row.group_name ?? '');
      if (groupName !== currentGroup) {
        currentGroup = groupName;
        sequence = 1;
      } else {
        sequence += 1;
      }
      updateStmt.run(formatFourDigitCode(sequence), row.id);
    }

    db.prepare(`
      INSERT INTO settings (key, value, description)
      VALUES (?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET
        value = excluded.value,
        description = excluded.description,
        updated_at = CURRENT_TIMESTAMP
    `).run(
      NORMALIZE_DICTIONARY_VALUE_4DIGIT_SETTING_KEY,
      new Date().toISOString(),
      '普通字典按分组将 value 统一初始化为 4 位编码',
    );
  });

  tx();
}

export function migrateDictionarySchema(db: Database.Database): void {
  db.exec(DICTIONARY_SCHEMA_SQL);
  ensureColumns(db, 'dictionaries', DICTIONARY_COLUMNS);
  db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_dictionaries_id ON dictionaries(id)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_dictionaries_deleted_at ON dictionaries(deleted_at)');
  db.exec(DICTIONARY_UPDATED_AT_TRIGGER_SQL);
  normalizeDictionaryValueToFourDigitsByGroup(db);
  seedContractSettingsFromJsonWhenEmpty(db);
}

const TREE_DICTIONARY_SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS tree_dictionaries (
    id TEXT PRIMARY KEY,
    parent_id TEXT DEFAULT '0',
    name TEXT NOT NULL,
    code TEXT,
    abbreviation TEXT,
    bg_color TEXT,
    sort_order INTEGER DEFAULT 0,
    value TEXT,
    remark TEXT,
    group_name TEXT,
    deleted_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`;

const TREE_DICTIONARY_UPDATED_AT_TRIGGER_SQL = `
  CREATE TRIGGER IF NOT EXISTS trg_tree_dictionaries_updated_at
  AFTER UPDATE ON tree_dictionaries
  FOR EACH ROW
  WHEN NEW.updated_at <= OLD.updated_at
  BEGIN
    UPDATE tree_dictionaries
    SET updated_at = CURRENT_TIMESTAMP
    WHERE id = OLD.id;
  END
`;

const TREE_DICTIONARY_COLUMNS: Array<{ name: string; ddl: string }> = [
  { name: 'id', ddl: 'TEXT' },
  { name: 'parent_id', ddl: "TEXT DEFAULT '0'" },
  { name: 'name', ddl: "TEXT NOT NULL DEFAULT ''" },
  { name: 'code', ddl: "TEXT DEFAULT ''" },
  { name: 'abbreviation', ddl: "TEXT DEFAULT ''" },
  { name: 'bg_color', ddl: "TEXT DEFAULT ''" },
  { name: 'sort_order', ddl: "INTEGER DEFAULT 0" },
  { name: 'value', ddl: "TEXT DEFAULT ''" },
  { name: 'remark', ddl: "TEXT DEFAULT ''" },
  { name: 'group_name', ddl: "TEXT DEFAULT ''" },
  { name: 'deleted_at', ddl: 'DATETIME' },
  { name: 'created_at', ddl: 'DATETIME' },
  { name: 'updated_at', ddl: 'DATETIME' },
];

export function migrateTreeDictionarySchema(db: Database.Database): void {
  db.exec(TREE_DICTIONARY_SCHEMA_SQL);
  ensureColumns(db, 'tree_dictionaries', TREE_DICTIONARY_COLUMNS);
  db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_tree_dictionaries_id ON tree_dictionaries(id)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_tree_dictionaries_deleted_at ON tree_dictionaries(deleted_at)');
  db.exec(TREE_DICTIONARY_UPDATED_AT_TRIGGER_SQL);
}
