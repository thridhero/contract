import { IpcMainInvokeEvent } from 'electron';
import * as channels from '../../channels';
import { WindowManager, isCloseGuardPending, setCloseGuardPending } from '../../../windows/WindowManager';
import { ok } from '../../../../shared/types/ipc.types';
import type { TaskInfo } from '../../../../shared/types/taskMonitor.types';
import { getTaskMonitor } from './taskMonitorHandlers';

export const closeGuardHandlers: Record<string, (event: IpcMainInvokeEvent, ...args: unknown[]) => Promise<unknown>> = {
  [channels.CLOSE_GUARD_CHECK]: async () => {
    const activeTasks = getTaskMonitor().getActive();
    setCloseGuardPending(activeTasks.length > 0);
    return ok({
      hasActiveTasks: activeTasks.length > 0,
      tasks: activeTasks,
    });
  },

  [channels.CLOSE_GUARD_FORCE_CLOSE]: async () => {
    setCloseGuardPending(false);
    WindowManager.getMainWindow()?.close();
    return ok();
  },

  [channels.CLOSE_GUARD_CANCEL]: async () => {
    setCloseGuardPending(false);
    return ok();
  },
};

export function isPendingClose(): boolean {
  return isCloseGuardPending();
}
