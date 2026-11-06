import { IpcMainInvokeEvent } from 'electron';
import * as channels from '../../channels';
import { DatabaseService } from '../../../services/system/DatabaseService';
import { ok, IpcResponse } from '../../../../shared/types/ipc.types';
import { Document, DocumentInsertDTO } from '../../../../shared/types/document.types';

const getDb = () => DatabaseService.getInstance();

export const documentHandlers: Record<string, (event: IpcMainInvokeEvent, ...args: unknown[]) => Promise<unknown>> = {

  [channels.DOC_INSERT]: async (_, dto: unknown): Promise<IpcResponse<Document>> => {
    return ok(getDb().insertDocument(dto as DocumentInsertDTO));
  },

  [channels.DOC_UPDATE]: async (_, id: unknown, updates: unknown): Promise<IpcResponse<Document>> => {
    return ok(getDb().updateDocument(String(id), updates as Parameters<DatabaseService['updateDocument']>[1]));
  },

  [channels.DOC_DELETE]: async (_, id: unknown): Promise<IpcResponse> => {
    getDb().deleteDocument(String(id));
    return ok();
  },

  [channels.DOC_GET_BY_PROJECT]: async (_, projectId: unknown): Promise<IpcResponse<Document[]>> => {
    return ok(getDb().getDocumentsByProject(String(projectId)));
  },
};
