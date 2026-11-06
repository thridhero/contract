import { IpcMainInvokeEvent } from 'electron';
import * as channels from '../../channels';
import { ConfigService } from '../../../services/system/ConfigService';
import { ok, fail } from '../../../../shared/types/ipc.types';

const configService = ConfigService.getInstance();

export const configHandlers: Record<string, (event: IpcMainInvokeEvent, ...args: any[]) => Promise<unknown>> = {
  [channels.CONFIG_GET_ALL]: async () => {
    return ok(configService.readConfig());
  },

  [channels.CONFIG_GET_ITEM]: async (_, key: string) => {
    return ok(configService.getConfigItem(key));
  },

  [channels.CONFIG_SAVE]: async (_, config: Record<string, any>) => {
    configService.saveConfig(config);
    return ok(true);
  },

  [channels.CONFIG_UPDATE_ITEM]: async (_, key: string, value: any) => {
    configService.updateConfigItem(key, value);
    return ok(true);
  },

  [channels.CONFIG_GET_DEFAULT]: async () => {
    return ok(configService.getDefaultConfig());
  },
};
