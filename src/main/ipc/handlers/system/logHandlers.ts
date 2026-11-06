import { app, IpcMainInvokeEvent, shell } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import * as channels from '../../channels';
import { fail, ok, IpcResponse } from '../../../../shared/types/ipc.types';
import type { LoggingSettings, LogWritePayload } from '../../../../shared/types/log.types';
import { getLoggingSettings, saveLoggingSettings, writeRendererLog } from '../../../utils/logger';

export const logHandlers: Record<string, (event: IpcMainInvokeEvent, ...args: unknown[]) => Promise<unknown>> = {
  [channels.LOG_WRITE]: async (_, payload: unknown): Promise<IpcResponse<{ logged: true }>> => {
    writeRendererLog(payload as LogWritePayload);
    return ok({ logged: true });
  },
  [channels.LOG_GET_SETTINGS]: async (): Promise<IpcResponse<LoggingSettings>> => {
    return ok(getLoggingSettings());
  },
  [channels.LOG_SAVE_SETTINGS]: async (_, settings: unknown): Promise<IpcResponse<LoggingSettings>> => {
    return ok(saveLoggingSettings(settings as LoggingSettings));
  },
  [channels.LOG_OPEN_FOLDER]: async (): Promise<IpcResponse<{ opened: true; path: string }>> => {
    try {
      const directory = path.join(app.getPath('userData'), 'logs');
      fs.mkdirSync(directory, { recursive: true });
      const result = await shell.openPath(directory);
      if (result) {
        return fail(new Error(result));
      }
      return ok({ opened: true, path: directory });
    } catch (error) {
      return fail(error, true);
    }
  },
};
