import { IpcMainInvokeEvent } from 'electron';
import * as fs from 'fs';
import {
  PROJECT_MANAGEMENT_COUNT_IN_GROUPS,
  PROJECT_MANAGEMENT_CREATE,
  PROJECT_MANAGEMENT_DELETE,
  PROJECT_MANAGEMENT_DELETE_BY_QUERY,
  PROJECT_MANAGEMENT_RESTORE,
  PROJECT_MANAGEMENT_PURGE,
  PROJECT_MANAGEMENT_RESTORE_BY_QUERY,
  PROJECT_MANAGEMENT_PURGE_BY_QUERY,
  PROJECT_MANAGEMENT_EXPORT_CSV,
  PROJECT_MANAGEMENT_GET,
  PROJECT_MANAGEMENT_GET_LIST,
  PROJECT_MANAGEMENT_GET_SUMMARY,
  PROJECT_MANAGEMENT_IMPORT_CSV,
  PROJECT_MANAGEMENT_MOVE,
  PROJECT_MANAGEMENT_RECODE,
  PROJECT_MANAGEMENT_RENAME_GROUP,
  PROJECT_MANAGEMENT_UPDATE,
} from '../../channels';
import { DatabaseService } from '../../../services/system/DatabaseService';
import { ok, fail } from '../../../../shared/types/ipc.types';
import { createLogger } from '../../../utils/logger';
import type {
  ProjectManagementCreateDTO,
  ProjectManagementDeleteByQueryDTO,
  ProjectManagementItem,
  ProjectManagementMoveDTO,
  ProjectManagementQueryDTO,
  ProjectManagementUpdateDTO,
} from '../../../../shared/types/projectManagement.types';
import { parseCsv } from '../../../utils/csvParser';

const logger = createLogger('ProjectManagementHandlers');

function escapeCsvCell(value: unknown): string {
  const text = value === null || value === undefined ? '' : String(value);
  if (/[",\r\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function buildProjectManagementCsv(rows: ProjectManagementItem[]): string {
  const header = [
    '项目编号',
    '项目名称',
    '项目内容',
    '项目分组',
    '立项日期',
    '概算批复时间',
    '合同截止日期',
    '工程地点',
    '项目天数',
    '建筑面积',
    '已开工建筑面积',
    '计容面积',
    '开工计容面积',
    '所在国家',
    '所在省份',
    '所在城市',
  ];

  const lines = [
    header.join(','),
    ...rows.map((row) => ([
      escapeCsvCell(row.code),
      escapeCsvCell(row.name),
      escapeCsvCell(row.content),
      escapeCsvCell(row.group_name),
      escapeCsvCell(row.project_date),
      escapeCsvCell(row.approval_date),
      escapeCsvCell(row.contract_deadline),
      escapeCsvCell(row.engineering_location),
      escapeCsvCell(row.project_days),
      escapeCsvCell(row.building_area),
      escapeCsvCell(row.started_building_area),
      escapeCsvCell(row.counted_area),
      escapeCsvCell(row.started_counted_area),
      escapeCsvCell(row.country),
      escapeCsvCell(row.province),
      escapeCsvCell(row.city),
    ].join(','))),
  ];

  return `\uFEFF${lines.join('\r\n')}\r\n`;
}

export const projectManagementHandlers = {
  [PROJECT_MANAGEMENT_CREATE]: async (_event: IpcMainInvokeEvent, dto: ProjectManagementCreateDTO) => {
    try {
      const db = DatabaseService.getInstance();
      return ok(db.createManagedProject(dto));
    } catch (error) {
      logger.error('创建项目管理记录失败:', error);
      return fail(error);
    }
  },

  [PROJECT_MANAGEMENT_UPDATE]: async (_event: IpcMainInvokeEvent, dto: ProjectManagementUpdateDTO) => {
    try {
      const db = DatabaseService.getInstance();
      return ok(db.updateManagedProject(dto));
    } catch (error) {
      logger.error('更新项目管理记录失败:', error);
      return fail(error);
    }
  },

  [PROJECT_MANAGEMENT_DELETE]: async (_event: IpcMainInvokeEvent, id: string) => {
    try {
      const db = DatabaseService.getInstance();
      db.deleteManagedProject(id);
      return ok({ success: true });
    } catch (error) {
      logger.error('删除项目管理记录失败:', error);
      return fail(error);
    }
  },

  [PROJECT_MANAGEMENT_RESTORE]: async (_event: IpcMainInvokeEvent, id: string) => {
    try {
      const db = DatabaseService.getInstance();
      db.restoreManagedProject(id);
      return ok({ success: true });
    } catch (error) {
      logger.error('还原项目管理记录失败:', error);
      return fail(error);
    }
  },

  [PROJECT_MANAGEMENT_PURGE]: async (_event: IpcMainInvokeEvent, id: string) => {
    try {
      const db = DatabaseService.getInstance();
      db.purgeManagedProject(id);
      return ok({ success: true });
    } catch (error) {
      logger.error('彻底删除项目管理记录失败:', error);
      return fail(error);
    }
  },

  [PROJECT_MANAGEMENT_GET]: async (_event: IpcMainInvokeEvent, id: string) => {
    try {
      const db = DatabaseService.getInstance();
      return ok(db.getManagedProjectById(id));
    } catch (error) {
      logger.error('获取项目管理详情失败:', error);
      return fail(error);
    }
  },

  [PROJECT_MANAGEMENT_GET_LIST]: async (_event: IpcMainInvokeEvent, query: ProjectManagementQueryDTO) => {
    try {
      const db = DatabaseService.getInstance();
      return ok(db.getManagedProjects(query));
    } catch (error) {
      logger.error('获取项目管理列表失败:', error);
      return fail(error);
    }
  },

  [PROJECT_MANAGEMENT_DELETE_BY_QUERY]: async (_event: IpcMainInvokeEvent, dto: ProjectManagementDeleteByQueryDTO) => {
    try {
      const db = DatabaseService.getInstance();
      return ok(db.deleteManagedProjectsByQuery(dto));
    } catch (error) {
      logger.error('批量删空项目管理记录失败:', error);
      return fail(error);
    }
  },

  [PROJECT_MANAGEMENT_RESTORE_BY_QUERY]: async (_event: IpcMainInvokeEvent, dto: ProjectManagementDeleteByQueryDTO) => {
    try {
      const db = DatabaseService.getInstance();
      return ok(db.restoreManagedProjectsByQuery(dto));
    } catch (error) {
      logger.error('批量还原项目管理记录失败:', error);
      return fail(error);
    }
  },

  [PROJECT_MANAGEMENT_PURGE_BY_QUERY]: async (_event: IpcMainInvokeEvent, dto: ProjectManagementDeleteByQueryDTO) => {
    try {
      const db = DatabaseService.getInstance();
      return ok(db.purgeManagedProjectsByQuery(dto));
    } catch (error) {
      logger.error('批量彻底删除项目管理记录失败:', error);
      return fail(error);
    }
  },

  [PROJECT_MANAGEMENT_MOVE]: async (_event: IpcMainInvokeEvent, dto: ProjectManagementMoveDTO) => {
    try {
      const db = DatabaseService.getInstance();
      return ok(db.moveManagedProject(dto));
    } catch (error) {
      logger.error('调整项目管理排序失败:', error);
      return fail(error);
    }
  },

  [PROJECT_MANAGEMENT_RECODE]: async (_event: IpcMainInvokeEvent, query: ProjectManagementQueryDTO) => {
    try {
      const db = DatabaseService.getInstance();
      return ok(db.recodeManagedProjects(query));
    } catch (error) {
      logger.error('重新编码项目管理记录失败:', error);
      return fail(error);
    }
  },

  [PROJECT_MANAGEMENT_RENAME_GROUP]: async (_event: IpcMainInvokeEvent, groupKey: string, oldName: string, newName: string) => {
    try {
      const db = DatabaseService.getInstance();
      return ok(db.renameManagedProjectGroup(groupKey, oldName, newName));
    } catch (error) {
      logger.error('重命名项目分组失败:', error);
      return fail(error);
    }
  },

  [PROJECT_MANAGEMENT_COUNT_IN_GROUPS]: async (_event: IpcMainInvokeEvent, groupKeys: string[], groupNames: string[]) => {
    try {
      const db = DatabaseService.getInstance();
      return ok({ count: db.countManagedProjectsInGroups(groupKeys, groupNames) });
    } catch (error) {
      logger.error('统计项目分组数据失败:', error);
      return fail(error);
    }
  },

  [PROJECT_MANAGEMENT_GET_SUMMARY]: async (_event: IpcMainInvokeEvent, query: ProjectManagementQueryDTO) => {
    try {
      const db = DatabaseService.getInstance();
      return ok(db.getManagedProjectSummary(query));
    } catch (error) {
      logger.error('获取项目汇总失败:', error);
      return fail(error);
    }
  },

  [PROJECT_MANAGEMENT_IMPORT_CSV]: async (
    _event: IpcMainInvokeEvent,
    filePath: string,
    defaultGroupKey?: string,
    defaultGroupName?: string
  ) => {
    try {
      const records = await parseCsv<Record<string, string>>(filePath);
      const db = DatabaseService.getInstance();
      let importedCount = 0;

      for (const record of records) {
        const name = String(record['项目名称'] || '').trim();
        if (!name) {
          continue;
        }

        db.createManagedProject({
          code: String(record['项目编号'] || '').trim() || undefined,
          name,
          content: String(record['项目内容'] || '').trim() || undefined,
          group_key: defaultGroupKey || undefined,
          group_name: String(record['项目分组'] || '').trim() || defaultGroupName || undefined,
          project_date: String(record['立项日期'] || '').trim() || undefined,
          approval_date: String(record['概算批复时间'] || '').trim() || undefined,
          contract_deadline: String(record['合同截止日期'] || '').trim() || undefined,
          engineering_location: String(record['工程地点'] || '').trim() || undefined,
          project_days: record['项目天数'] ? Number(record['项目天数']) : undefined,
          building_area: record['建筑面积'] ? Number(record['建筑面积']) : undefined,
          started_building_area: record['已开工建筑面积'] ? Number(record['已开工建筑面积']) : undefined,
          counted_area: record['计容面积'] ? Number(record['计容面积']) : undefined,
          started_counted_area: record['开工计容面积'] ? Number(record['开工计容面积']) : undefined,
          country: String(record['所在国家'] || '').trim() || undefined,
          province: String(record['所在省份'] || '').trim() || undefined,
          city: String(record['所在城市'] || '').trim() || undefined,
        });

        importedCount += 1;
      }

      return ok({ importedCount });
    } catch (error) {
      logger.error('导入项目 CSV 失败:', error);
      return fail(error);
    }
  },

  [PROJECT_MANAGEMENT_EXPORT_CSV]: async (_event: IpcMainInvokeEvent, query: ProjectManagementQueryDTO, filePath: string) => {
    try {
      if (!filePath) {
        throw new Error('缺少导出文件路径');
      }

      const db = DatabaseService.getInstance();
      const result = db.getManagedProjects({
        ...query,
        page: 1,
        pageSize: Number.MAX_SAFE_INTEGER,
      });
      const csv = buildProjectManagementCsv(result.data);
      fs.writeFileSync(filePath, csv, { encoding: 'utf8' });
      return ok({ exportedCount: result.data.length, filePath });
    } catch (error) {
      logger.error('导出项目 CSV 失败:', error);
      return fail(error);
    }
  },
};
