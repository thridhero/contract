import * as channels from '../../../channels';
import * as crypto from 'crypto';
import { fail, ok } from '../../../../../shared/types/ipc.types';
import {
  LibraryCalendarEventEntity,
  LibraryCalendarEventQueryDTO,
  LibraryCalendarManualReminderCreateDTO,
  LibraryCalendarEventRebuildDTO,
} from '../../../../../shared/types/libraryCalendarEvent.types';
import { LibraryHandlerMap, logger, openLibraryDb } from './shared';
import { getCalendarEventsByRangeFromLibrary, rebuildCalendarEventsFromContracts } from './calendarEvents';

export const libraryCalendarEventHandlers: LibraryHandlerMap = {
  [channels.LIBRARY_GET_CALENDAR_EVENTS]: async (_event, dto: unknown) => {
    try {
      const query = (dto || {}) as Partial<LibraryCalendarEventQueryDTO>;
      const libraryPath = String(query.libraryPath || '').trim();
      const startDate = String(query.startDate || '').trim();
      const endDate = String(query.endDate || '').trim();
      const includeDeleted = Boolean(query.includeDeleted);

      if (!libraryPath) return fail(new Error('资源库路径不能为空'));
      if (!startDate || !endDate) return fail(new Error('日期范围不能为空'));

      const rows = getCalendarEventsByRangeFromLibrary(libraryPath, startDate, endDate, includeDeleted) as LibraryCalendarEventEntity[];
      return ok(rows);
    } catch (error) {
      logger.error('读取日历事件失败:', error);
      return fail(error);
    }
  },

  [channels.LIBRARY_REBUILD_CALENDAR_EVENTS]: async (_event, dto: unknown) => {
    try {
      const input = (dto || {}) as Partial<LibraryCalendarEventRebuildDTO>;
      const libraryPath = String(input.libraryPath || '').trim();
      if (!libraryPath) return fail(new Error('资源库路径不能为空'));

      const result = rebuildCalendarEventsFromContracts(libraryPath);
      return ok(result);
    } catch (error) {
      logger.error('重建日历事件失败:', error);
      return fail(error);
    }
  },

  [channels.LIBRARY_CREATE_MANUAL_CALENDAR_REMINDER]: async (_event, dto: unknown) => {
    try {
      const input = (dto || {}) as Partial<LibraryCalendarManualReminderCreateDTO>;
      const libraryPath = String(input.libraryPath || '').trim();
      const eventDate = String(input.eventDate || '').trim();
      const title = String(input.title || '').trim();
      const content = input.content == null ? null : String(input.content);
      const severity = String(input.severity || 'warning').trim() as LibraryCalendarEventEntity['severity'];
      const meta = input.meta && typeof input.meta === 'object' ? input.meta : null;

      if (!libraryPath) return fail(new Error('资源库路径不能为空'));
      if (!/^\d{4}-\d{2}-\d{2}$/.test(eventDate)) return fail(new Error('日期格式不正确，应为 YYYY-MM-DD'));
      if (!title) return fail(new Error('标题不能为空'));
      if (!['info', 'warning', 'danger'].includes(severity)) return fail(new Error('优先级不正确'));

      const db = openLibraryDb(libraryPath);
      const id = crypto.randomUUID();
      const sourceId = crypto.randomUUID();
      const metaText = meta ? JSON.stringify(meta) : null;

      db.prepare(`
        INSERT INTO calendar_events (
          id,
          source_type,
          source_id,
          event_key,
          event_date,
          title,
          content,
          severity,
          meta,
          deleted_at
        ) VALUES (
          ?, 'manual', ?, 'manual_reminder', ?, ?, ?, ?, ?, NULL
        )
      `).run(id, sourceId, eventDate, title, content, severity, metaText);

      const row = db.prepare(`
        SELECT
          id,
          source_type,
          source_id,
          event_key,
          event_date,
          title,
          content,
          severity,
          meta,
          deleted_at,
          created_at,
          updated_at
        FROM calendar_events
        WHERE id = ?
        LIMIT 1
      `).get(id) as LibraryCalendarEventEntity | undefined;

      if (!row) return fail(new Error('创建提醒失败'));
      return ok(row);
    } catch (error) {
      logger.error('创建手动提醒失败:', error);
      return fail(error);
    }
  },
};

