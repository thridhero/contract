import { IpcMainInvokeEvent } from 'electron';
import * as channels from '../../channels';
import { DatabaseService } from '../../../services/system/DatabaseService';
import { ok, IpcResponse } from '../../../../shared/types/ipc.types';
import { WorkflowNode } from '../../../../shared/types/workflow.types';

const getDb = () => DatabaseService.getInstance();

export const workflowHandlers: Record<string, (event: IpcMainInvokeEvent, ...args: unknown[]) => Promise<unknown>> = {

  [channels.WORKFLOW_INIT]: async (_, projectId: unknown): Promise<IpcResponse<WorkflowNode[]>> => {
    return ok(getDb().initDefaultWorkflow(String(projectId)));
  },

  [channels.WORKFLOW_GET]: async (_, projectId: unknown): Promise<IpcResponse<WorkflowNode[]>> => {
    return ok(getDb().getWorkflowByProject(String(projectId)));
  },

  [channels.WORKFLOW_UPDATE]: async (_, id: unknown, updates: unknown): Promise<IpcResponse<WorkflowNode>> => {
    return ok(getDb().updateWorkflowNode(String(id), updates as Parameters<DatabaseService['updateWorkflowNode']>[1]));
  },
};
