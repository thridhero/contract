import { IpcMainInvokeEvent } from 'electron';
import * as channels from '../../channels';
import { DatabaseService } from '../../../services/system/DatabaseService';
import { ok, IpcResponse } from '../../../../shared/types/ipc.types';
import { Reminder, ReminderCreateDTO } from '../../../../shared/types/reminder.types';

const getDb = () => DatabaseService.getInstance();

export const reminderHandlers: Record<string, (event: IpcMainInvokeEvent, ...args: unknown[]) => Promise<unknown>> = {

  [channels.REMINDER_CREATE]: async (_, dto: unknown): Promise<IpcResponse<Reminder>> => {
    return ok(getDb().insertReminder(dto as ReminderCreateDTO));
  },

  [channels.REMINDER_UPDATE]: async (_, id: unknown, updates: unknown): Promise<IpcResponse<Reminder>> => {
    return ok(getDb().updateReminder(String(id), updates as Parameters<DatabaseService['updateReminder']>[1]));
  },

  [channels.REMINDER_DELETE]: async (_, id: unknown): Promise<IpcResponse> => {
    getDb().deleteReminder(String(id));
    return ok();
  },

  [channels.REMINDER_GET]: async (_, projectId: unknown): Promise<IpcResponse<Reminder[]>> => {
    const pid = projectId ? String(projectId) : undefined;
    return ok(getDb().getReminders(pid));
  },

  [channels.REMINDER_MARK_READ]: async (_, id: unknown): Promise<IpcResponse> => {
    getDb().markReminderRead(String(id));
    return ok();
  },
};
