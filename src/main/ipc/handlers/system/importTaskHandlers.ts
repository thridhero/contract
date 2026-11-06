import type { IpcMainInvokeEvent } from 'electron';
import { ok, IpcResponse } from '../../../../shared/types/ipc.types';
import * as channels from '../../channels';
import type {
  ImportTaskCancelRequest,
  ImportTaskCancelResponse,
  ImportTaskGetStatusRequest,
  ImportTaskGetStatusResponse,
  ImportTaskStartRequest,
  ImportTaskStartResponse,
} from '../../../../shared/types/importTask.types';
import { ImportTaskService } from '../../../services/system/ImportTaskService';

export const importTaskHandlers: Record<string, (event: IpcMainInvokeEvent, ...args: unknown[]) => Promise<IpcResponse<any>>> = {
  [channels.IMPORT_TASK_START]: async (event, dto: unknown): Promise<IpcResponse<ImportTaskStartResponse>> => {
    const payload = dto as ImportTaskStartRequest;
    const taskId = ImportTaskService.getInstance().start(payload, event.sender.id);
    return ok({ taskId });
  },

  [channels.IMPORT_TASK_GET_STATUS]: async (_event, dto: unknown): Promise<IpcResponse<ImportTaskGetStatusResponse>> => {
    const payload = dto as ImportTaskGetStatusRequest;
    return ok(ImportTaskService.getInstance().getStatus(payload?.contextKey));
  },

  [channels.IMPORT_TASK_CANCEL]: async (_event, dto: unknown): Promise<IpcResponse<ImportTaskCancelResponse>> => {
    const payload = dto as ImportTaskCancelRequest;
    const success = ImportTaskService.getInstance().cancel(payload?.taskId);
    return ok({ success });
  },
};
