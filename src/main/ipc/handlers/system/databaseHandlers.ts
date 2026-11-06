import { IpcMainInvokeEvent } from 'electron';
import * as channels from '../../channels';
import { DatabaseService } from '../../../services/system/DatabaseService';
import { ok, IpcResponse } from '../../../../shared/types/ipc.types';
import { Setting, SettingInsertParams, SettingUpdateParams } from '../../../../shared/types/database.types';
import { TagEntity, TagGroupEntity } from '../../../../shared/types/tag.types';

const getDb = () => DatabaseService.getInstance();

export const databaseHandlers: Record<string, (event: IpcMainInvokeEvent, ...args: unknown[]) => Promise<unknown>> = {

  [channels.DB_INSERT_SETTING]: async (_, key: unknown, value: unknown, description: unknown): Promise<IpcResponse<Setting>> => {
    const params: SettingInsertParams = {
      key: String(key),
      value: String(value),
      description: description !== undefined ? String(description) : '',
    };
    const result = getDb().insertSetting(params);
    return ok(result);
  },

  [channels.DB_UPDATE_SETTING]: async (_, key: unknown, value: unknown, description: unknown): Promise<IpcResponse<Setting>> => {
    const params: SettingUpdateParams = {
      key: String(key),
      value: String(value),
      description: description !== undefined ? String(description) : undefined,
    };
    const result = getDb().updateSetting(params);
    return ok(result);
  },

  [channels.DB_DELETE_SETTING]: async (_, key: unknown): Promise<IpcResponse> => {
    getDb().deleteSetting(String(key));
    return ok();
  },

  [channels.DB_GET_SETTING]: async (_, key: unknown): Promise<IpcResponse<Setting | null>> => {
    const result = getDb().getSetting(String(key));
    return ok(result);
  },

  [channels.DB_GET_ALL]: async (): Promise<IpcResponse<Setting[]>> => {
    return ok(getDb().getAllSettings());
  },

  [channels.DB_SEARCH]: async (_, searchTerm: unknown): Promise<IpcResponse<Setting[]>> => {
    return ok(getDb().searchSettings(String(searchTerm)));
  },

  [channels.DB_GET_TAGS]: async (): Promise<IpcResponse<TagEntity[]>> => {
    return ok(getDb().getAllTags());
  },

  [channels.DB_GET_TAG_GROUPS]: async (): Promise<IpcResponse<TagGroupEntity[]>> => {
    return ok(getDb().getAllTagGroups());
  },
};
