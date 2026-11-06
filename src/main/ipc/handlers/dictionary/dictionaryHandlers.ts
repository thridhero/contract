import { BrowserWindow, IpcMainInvokeEvent } from 'electron';
import * as crypto from 'crypto';
import * as fs from 'fs';
import {
  DICTIONARY_CREATE,
  DICTIONARY_UPDATE,
  DICTIONARY_DELETE,
  DICTIONARY_RESTORE,
  DICTIONARY_PURGE,
  DICTIONARY_GET,
  DICTIONARY_GET_LIST,
  DICTIONARY_IMPORT_CSV,
  DICTIONARY_IMPORT_PROGRESS,
  DICTIONARY_RENAME_GROUP,
  DICTIONARY_CLEAR_GROUPS,
  DICTIONARY_EXPORT_CSV,
  DICTIONARY_COUNT_IN_GROUPS,
  DICTIONARY_MOVE_TO_GROUP,
  DICTIONARY_MOVE_TO_TOP,
  DICTIONARY_MOVE_TO_BOTTOM,
  DICTIONARY_EXPORT_GROUP_BUNDLE,
  DICTIONARY_IMPORT_GROUP_BUNDLE,
} from '../../channels';
import { DatabaseService } from '../../../services/system/DatabaseService';
import { ok, fail } from '../../../../shared/types/ipc.types';
import { createLogger } from '../../../utils/logger';
import { DictionaryCreateDTO, DictionaryUpdateDTO, DictionaryQueryDTO, DictionaryGroupBundleExportResult, DictionaryGroupBundleImportResult, DictionaryGroupBundleV1, DictionaryGroupBundleNode, DictionaryGroupBundleItem } from '../../../../shared/types/dictionary.types';
import { parseCsv } from '../../../utils/csvParser';

const logger = createLogger('DictionaryHandlers');

function escapeCsvCell(value: unknown): string {
  const str = value === null || value === undefined ? '' : String(value);
  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function buildDictionaryCsv(rows: Array<Record<string, any>>): string {
  const header = [
    '',
    'ID',
    'ParentID',
    '名称(类型)',
    '编码',
    '缩写',
    '背景色',
    '序号',
    '数值',
    '备注',
  ];

  const lines: string[] = [];
  lines.push(header.join(','));

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const line = [
      escapeCsvCell(i + 1),
      escapeCsvCell(r.id),
      escapeCsvCell(0),
      escapeCsvCell(r.name),
      escapeCsvCell(r.code),
      escapeCsvCell(r.abbreviation),
      escapeCsvCell(r.bg_color),
      escapeCsvCell(r.sort_order),
      escapeCsvCell(r.value),
      escapeCsvCell(r.remark),
    ].join(',');
    lines.push(line);
  }

  return `\uFEFF${lines.join('\r\n')}\r\n`;
}

type StoredGroupTreeNode = {
  key?: unknown;
  label?: unknown;
  data?: unknown;
  icon?: unknown;
  children?: StoredGroupTreeNode[];
};

function ensureRootFirst(nodes: StoredGroupTreeNode[], rootKey = '0'): StoredGroupTreeNode[] {
  const index = nodes.findIndex((n) => String(n?.key) === rootKey);
  if (index <= 0) return nodes;
  const reordered = [...nodes];
  const [root] = reordered.splice(index, 1);
  if (root) reordered.unshift(root);
  return reordered;
}

function findNodeByKey(nodes: StoredGroupTreeNode[], key: string): StoredGroupTreeNode | null {
  for (const node of nodes) {
    if (String(node?.key) === key) return node;
    const children = node?.children;
    if (Array.isArray(children) && children.length) {
      const found = findNodeByKey(children, key);
      if (found) return found;
    }
  }
  return null;
}

function collectGroupNamesFromBundleNode(node: DictionaryGroupBundleNode, acc: Set<string>): void {
  const name = String(node?.name ?? '').trim();
  if (name && name !== '所有分组') acc.add(name);
  const children = node?.children;
  if (Array.isArray(children)) {
    for (const child of children) collectGroupNamesFromBundleNode(child, acc);
  }
}

function toBundleNode(node: StoredGroupTreeNode): DictionaryGroupBundleNode {
  const name = String(node?.data ?? node?.label ?? '').trim();
  const children = Array.isArray(node?.children) ? node.children.map(toBundleNode) : undefined;
  return children && children.length ? { name, children } : { name };
}

function loadGroupsTreeSetting(db: DatabaseService): StoredGroupTreeNode[] {
  const setting = db.getSetting('dictionary_groups_tree');
  if (setting?.value) {
    const parsed = JSON.parse(setting.value);
    if (Array.isArray(parsed)) return parsed as StoredGroupTreeNode[];
  }
  return [
    { key: '0', label: '所有分组', data: '所有分组', icon: 'pi pi-fw pi-folder', children: [] },
  ];
}

function collectExistingGroupNames(nodes: StoredGroupTreeNode[]): Set<string> {
  const res = new Set<string>();
  const walk = (list: StoredGroupTreeNode[]) => {
    for (const node of list) {
      if (String(node?.key) !== '0') {
        const name = String(node?.data ?? '').trim();
        if (name && name !== '所有分组') res.add(name);
      }
      const children = node?.children;
      if (Array.isArray(children) && children.length) walk(children);
    }
  };
  walk(nodes);
  return res;
}

export const dictionaryHandlers = {
  [DICTIONARY_CREATE]: async (_event: IpcMainInvokeEvent, dto: DictionaryCreateDTO) => {
    try {
      const db = DatabaseService.getInstance();
      const result = db.createDictionary(dto);
      return ok(result);
    } catch (error) {
      logger.error('创建字典失败:', error);
      return fail(error);
    }
  },

  [DICTIONARY_UPDATE]: async (_event: IpcMainInvokeEvent, dto: DictionaryUpdateDTO) => {
    try {
      const db = DatabaseService.getInstance();
      const result = db.updateDictionary(dto);
      return ok(result);
    } catch (error) {
      logger.error('更新字典失败:', error);
      return fail(error);
    }
  },

  [DICTIONARY_DELETE]: async (_event: IpcMainInvokeEvent, id: string) => {
    try {
      const db = DatabaseService.getInstance();
      db.deleteDictionary(id);
      return ok({ success: true });
    } catch (error) {
      logger.error('删除字典失败:', error);
      return fail(error);
    }
  },

  [DICTIONARY_RESTORE]: async (_event: IpcMainInvokeEvent, id: string) => {
    try {
      const db = DatabaseService.getInstance();
      db.restoreDictionary(id);
      return ok({ success: true });
    } catch (error) {
      logger.error('还原字典失败:', error);
      return fail(error);
    }
  },

  [DICTIONARY_PURGE]: async (_event: IpcMainInvokeEvent, id: string) => {
    try {
      const db = DatabaseService.getInstance();
      db.purgeDictionary(id);
      return ok({ success: true });
    } catch (error) {
      logger.error('彻底删除字典失败:', error);
      return fail(error);
    }
  },

  [DICTIONARY_GET]: async (_event: IpcMainInvokeEvent, id: string) => {
    try {
      const db = DatabaseService.getInstance();
      const result = db.getDictionaryById(id);
      return ok(result);
    } catch (error) {
      logger.error('获取字典详情失败:', error);
      return fail(error);
    }
  },

  [DICTIONARY_GET_LIST]: async (_event: IpcMainInvokeEvent, query: DictionaryQueryDTO) => {
    try {
      const db = DatabaseService.getInstance();
      const result = db.getDictionaries(query);
      return ok(result);
    } catch (error) {
      logger.error('获取字典列表失败:', error);
      return fail(error);
    }
  },

  [DICTIONARY_IMPORT_CSV]: async (_event: IpcMainInvokeEvent, filePath: string, groupName: string) => {
    try {
      const win = BrowserWindow.fromWebContents(_event.sender);

      if (!groupName || groupName === '所有分组') {
        throw new Error('请先选择分组再导入');
      }

      win?.webContents.send(DICTIONARY_IMPORT_PROGRESS, { status: 'reading', current: 0, total: 0, percent: 0 });

      const records = await parseCsv<Record<string, any>>(filePath);
      const db = DatabaseService.getInstance();
      let importedCount = 0;
      const total = records.length;

      win?.webContents.send(DICTIONARY_IMPORT_PROGRESS, { status: 'importing', current: 0, total, percent: 0 });

      for (const row of records) {
        // 根据表头映射数据
        const name = row['名称(类型)'] || row['名称'] || '';
        if (!name) continue; // 忽略没有名称的行

        const dto: DictionaryCreateDTO = {
          name: name.trim(),
          code: (row['编码'] || '').trim(),
          abbreviation: (row['缩写'] || '').trim(),
          bg_color: (row['背景色'] || '').trim(),
          sort_order: parseInt(row['序号'], 10) || 0,
          value: (row['数值'] || '').trim(),
          remark: (row['备注'] || '').trim(),
          group_name: groupName
        };

        db.createDictionary(dto);
        importedCount++;

        if (win && total > 0) {
          const percent = Math.round((importedCount / total) * 100);
          if (importedCount === total || importedCount % 10 === 0) {
            win.webContents.send(DICTIONARY_IMPORT_PROGRESS, {
              status: 'importing',
              current: importedCount,
              total,
              percent
            });
          }
        }
      }

      win?.webContents.send(DICTIONARY_IMPORT_PROGRESS, {
        status: 'completed',
        current: importedCount,
        total,
        percent: total > 0 ? 100 : 0
      });

      return ok({ importedCount });
    } catch (error) {
      logger.error('导入字典 CSV 失败:', error);
      return fail(error);
    }
  },

  [DICTIONARY_RENAME_GROUP]: async (_event: IpcMainInvokeEvent, oldName: string, newName: string) => {
    try {
      const db = DatabaseService.getInstance();
      const updatedCount = db.renameDictionaryGroup(oldName, newName);
      return ok({ updatedCount });
    } catch (error) {
      logger.error('重命名字典分组失败:', error);
      return fail(error);
    }
  },

  [DICTIONARY_CLEAR_GROUPS]: async (_event: IpcMainInvokeEvent, groupNames: string[]) => {
    try {
      const db = DatabaseService.getInstance();
      const updatedCount = db.clearDictionaryGroups(groupNames);
      return ok({ updatedCount });
    } catch (error) {
      logger.error('清空字典分组失败:', error);
      return fail(error);
    }
  },

  [DICTIONARY_EXPORT_CSV]: async (_event: IpcMainInvokeEvent, groupName: string, filePath: string) => {
    try {
      if (!groupName || groupName === '所有分组') {
        throw new Error('请先选择分组再导出');
      }
      if (!filePath) {
        throw new Error('缺少导出文件路径');
      }

      const db = DatabaseService.getInstance();
      const result = db.getDictionaries({ group_name: groupName });
      const csv = buildDictionaryCsv(result.data as any[]);
      fs.writeFileSync(filePath, csv, { encoding: 'utf8' });
      return ok({ exportedCount: result.data.length, filePath });
    } catch (error) {
      logger.error('导出字典 CSV 失败:', error);
      return fail(error);
    }
  },

  [DICTIONARY_EXPORT_GROUP_BUNDLE]: async (_event: IpcMainInvokeEvent, groupKey: string, filePath: string) => {
    try {
      const normalizedKey = String(groupKey || '0');
      if (!filePath) {
        throw new Error('缺少导出文件路径');
      }

      const db = DatabaseService.getInstance();
      const tree = loadGroupsTreeSetting(db);
      const rootNode = findNodeByKey(tree, '0') || { key: '0', label: '所有分组', data: '所有分组', children: [] };

      let bundleRoot: DictionaryGroupBundleNode;
      if (normalizedKey === '0') {
        const childrenNodes: StoredGroupTreeNode[] = [];
        if (Array.isArray(rootNode.children) && rootNode.children.length) childrenNodes.push(...rootNode.children);
        for (const n of tree) {
          if (String(n?.key) !== '0') childrenNodes.push(n);
        }
        const children = childrenNodes.map(toBundleNode);
        bundleRoot = children.length ? { name: '所有分组', children } : { name: '所有分组' };
      } else {
        const target = findNodeByKey(tree, normalizedKey);
        if (!target) {
          throw new Error('未找到要导出的分组');
        }
        bundleRoot = toBundleNode(target);
      }

      const groupNames = new Set<string>();
      collectGroupNamesFromBundleNode(bundleRoot, groupNames);

      const dictionaries: Record<string, DictionaryGroupBundleItem[]> = {};
      let dictionaryCount = 0;
      for (const groupName of groupNames) {
        const result = db.getDictionaries({ group_name: groupName });
        const rows = (result?.data || []) as any[];
        dictionaries[groupName] = rows.map((r) => ({
          name: String(r.name ?? ''),
          code: String(r.code ?? ''),
          abbreviation: String(r.abbreviation ?? ''),
          bg_color: String(r.bg_color ?? ''),
          sort_order: Number.isFinite(Number(r.sort_order)) ? Number(r.sort_order) : 0,
          value: String(r.value ?? ''),
          remark: String(r.remark ?? ''),
        }));
        dictionaryCount += dictionaries[groupName].length;
      }

      const bundle: DictionaryGroupBundleV1 = {
        schemaVersion: 1,
        exportedAt: new Date().toISOString(),
        root: bundleRoot,
        dictionaries,
      };

      fs.writeFileSync(filePath, JSON.stringify(bundle, null, 2), { encoding: 'utf8' });
      const res: DictionaryGroupBundleExportResult = {
        groupCount: groupNames.size,
        dictionaryCount,
        filePath,
      };
      return ok(res);
    } catch (error) {
      logger.error('导出分组+字典失败:', error);
      return fail(error);
    }
  },

  [DICTIONARY_IMPORT_GROUP_BUNDLE]: async (_event: IpcMainInvokeEvent, filePath: string, targetGroupKey: string) => {
    try {
      const win = BrowserWindow.fromWebContents(_event.sender);
      if (!filePath) {
        throw new Error('缺少导入文件路径');
      }

      win?.webContents.send(DICTIONARY_IMPORT_PROGRESS, { status: 'reading', current: 0, total: 0, percent: 0 });

      const raw = fs.readFileSync(filePath, { encoding: 'utf8' });
      const parsed = JSON.parse(raw) as DictionaryGroupBundleV1;
      if (!parsed || parsed.schemaVersion !== 1 || !parsed.root || typeof parsed.root.name !== 'string') {
        throw new Error('导入文件格式不正确');
      }

      const db = DatabaseService.getInstance();
      let tree = loadGroupsTreeSetting(db);
      if (!findNodeByKey(tree, '0')) {
        tree.unshift({ key: '0', label: '所有分组', data: '所有分组', icon: 'pi pi-fw pi-folder', children: [] });
      }
      tree = ensureRootFirst(tree, '0');

      const existingNames = collectExistingGroupNames(tree);
      const nameMap = new Map<string, string>();
      const importedOldNames = new Set<string>();
      let groupsRenamed = 0;
      let groupsAdded = 0;

      const allocateName = (original: string): string => {
        const base = String(original || '').trim();
        if (!base || base === '所有分组') return '';
        if (!existingNames.has(base)) {
          existingNames.add(base);
          return base;
        }
        let i = 1;
        while (true) {
          const candidate = `${base}（${i}）`;
          if (!existingNames.has(candidate)) {
            existingNames.add(candidate);
            groupsRenamed++;
            return candidate;
          }
          i++;
        }
      };

      const buildImportedNode = (node: DictionaryGroupBundleNode): StoredGroupTreeNode | null => {
        const oldName = String(node?.name ?? '').trim();
        if (!oldName || oldName === '所有分组') return null;

        const newName = allocateName(oldName);
        if (!newName) return null;
        nameMap.set(oldName, newName);
        importedOldNames.add(oldName);
        groupsAdded++;

        const children = Array.isArray(node?.children)
          ? node.children.map(buildImportedNode).filter(Boolean) as StoredGroupTreeNode[]
          : [];

        return {
          key: `node-${crypto.randomUUID()}`,
          label: newName,
          data: newName,
          icon: 'pi pi-folder',
          children,
        };
      };

      const attachList = Array.isArray(parsed.root.children) ? parsed.root.children : [];
      const importedTopNodes = attachList.map(buildImportedNode).filter(Boolean) as StoredGroupTreeNode[];
      if (importedTopNodes.length === 0) {
        throw new Error('没有可导入的子分组数据');
      }

      const normalizedTargetKey = String(targetGroupKey || '0');
      if (normalizedTargetKey === '0') {
        tree.push(...importedTopNodes);
      } else {
        const target = findNodeByKey(tree, normalizedTargetKey);
        const parent = target || findNodeByKey(tree, '0');
        if (!parent) {
          tree.push(...importedTopNodes);
        } else {
          if (!Array.isArray(parent.children)) parent.children = [];
          parent.children.push(...importedTopNodes);
        }
      }

      tree = ensureRootFirst(tree, '0');
      const treeJson = JSON.stringify(tree);
      const existingSetting = db.getSetting('dictionary_groups_tree');
      if (existingSetting) {
        db.updateSetting({ key: 'dictionary_groups_tree', value: treeJson, description: existingSetting.description });
      } else {
        db.insertSetting({ key: 'dictionary_groups_tree', value: treeJson, description: '字典分组树结构' });
      }

      const dictionaries = parsed.dictionaries && typeof parsed.dictionaries === 'object' ? parsed.dictionaries : {};
      let total = 0;
      for (const [originalGroupName, list] of Object.entries(dictionaries)) {
        const trimmed = String(originalGroupName || '').trim();
        if (!trimmed || trimmed === '所有分组') continue;
        if (!importedOldNames.has(trimmed)) continue;
        if (Array.isArray(list)) total += list.length;
      }

      let dictionariesImported = 0;
      let dictionariesSkipped = 0;

      win?.webContents.send(DICTIONARY_IMPORT_PROGRESS, { status: 'importing', current: 0, total, percent: 0 });

      for (const [originalGroupName, items] of Object.entries(dictionaries)) {
        const trimmed = String(originalGroupName || '').trim();
        if (!trimmed || trimmed === '所有分组') continue;
        if (!importedOldNames.has(trimmed)) continue;
        if (!Array.isArray(items) || items.length === 0) continue;

        const mappedGroupName = nameMap.get(trimmed) || trimmed;
        const existing = db.getDictionaries({ group_name: mappedGroupName }).data;
        const existingCodes = new Set(
          (existing || []).map((r) => String((r as any)?.code ?? '').trim()).filter(Boolean),
        );

        for (const it of items) {
          const code = String((it as any)?.code ?? '').trim();
          if (code && existingCodes.has(code)) {
            dictionariesSkipped++;
          } else {
            const dto: DictionaryCreateDTO = {
              name: String((it as any)?.name ?? '').trim(),
              code: code || undefined,
              abbreviation: String((it as any)?.abbreviation ?? '').trim(),
              bg_color: String((it as any)?.bg_color ?? '').trim(),
              sort_order: Number.isFinite(Number((it as any)?.sort_order)) ? Number((it as any)?.sort_order) : 0,
              value: String((it as any)?.value ?? '').trim(),
              remark: String((it as any)?.remark ?? '').trim(),
              group_name: mappedGroupName,
            };

            if (!dto.name) {
              dictionariesSkipped++;
            } else {
              db.createDictionary(dto);
              dictionariesImported++;
              if (code) existingCodes.add(code);
            }
          }

          const current = dictionariesImported + dictionariesSkipped;
          if (win && total > 0 && (current === total || current % 25 === 0)) {
            const percent = Math.round((current / total) * 100);
            win.webContents.send(DICTIONARY_IMPORT_PROGRESS, { status: 'importing', current, total, percent });
          }
        }
      }

      win?.webContents.send(DICTIONARY_IMPORT_PROGRESS, {
        status: 'completed',
        current: dictionariesImported + dictionariesSkipped,
        total,
        percent: total > 0 ? 100 : 0,
      });

      const res: DictionaryGroupBundleImportResult = {
        groupsAdded,
        groupsRenamed,
        dictionariesImported,
        dictionariesSkipped,
      };
      return ok(res);
    } catch (error) {
      logger.error('导入分组+字典失败:', error);
      return fail(error);
    }
  },

  [DICTIONARY_COUNT_IN_GROUPS]: async (_event: IpcMainInvokeEvent, groupNames: string[]) => {
    try {
      const db = DatabaseService.getInstance();
      const count = db.countDictionariesInGroups(groupNames);
      return ok({ count });
    } catch (error) {
      logger.error('统计分组下字典数量失败:', error);
      return fail(error);
    }
  },

  [DICTIONARY_MOVE_TO_GROUP]: async (_event: IpcMainInvokeEvent, ids: string[], targetGroupName: string) => {
    try {
      if (!targetGroupName || targetGroupName === '所有分组') {
        throw new Error('请选择目标分组');
      }
      const db = DatabaseService.getInstance();
      const updatedCount = db.moveDictionariesToGroup(ids, targetGroupName);
      return ok({ updatedCount });
    } catch (error) {
      logger.error('迁移字典分组失败:', error);
      return fail(error);
    }
  },

  [DICTIONARY_MOVE_TO_TOP]: async (_event: IpcMainInvokeEvent, id: string) => {
    try {
      const db = DatabaseService.getInstance();
      const updatedCount = db.moveDictionaryToTop(id);
      return ok({ updatedCount });
    } catch (error) {
      logger.error('字典置顶失败:', error);
      return fail(error);
    }
  },

  [DICTIONARY_MOVE_TO_BOTTOM]: async (_event: IpcMainInvokeEvent, id: string) => {
    try {
      const db = DatabaseService.getInstance();
      const updatedCount = db.moveDictionaryToBottom(id);
      return ok({ updatedCount });
    } catch (error) {
      logger.error('字典置底失败:', error);
      return fail(error);
    }
  },
};
