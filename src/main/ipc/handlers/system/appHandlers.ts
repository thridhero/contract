import { app, IpcMainInvokeEvent } from 'electron';
import * as channels from '../../channels';
import { APP_USER_MODEL_ID } from '../../../config/app.config';
import { ConfigService } from '../../../services/system/ConfigService';
import { ok } from '../../../../shared/types/ipc.types';

const configService = ConfigService.getInstance();

export const appHandlers: Record<string, (event: IpcMainInvokeEvent, ...args: unknown[]) => Promise<unknown>> = {
  [channels.APP_GET_INFO]: async () => {
    return ok({
      appId: APP_USER_MODEL_ID,
      appName: app.getName(),
      appVersion: app.getVersion(),
      isPackaged: app.isPackaged,
      platform: process.platform,
      arch: process.arch,
      locale: app.getLocale(),
      execPath: process.execPath,
      appPath: app.getAppPath(),
      userDataPath: app.getPath('userData'),
      backendBaseUrl: String(configService.getConfigItem('baseUrl') || configService.getConfigItem('backendAuth')?.baseUrl || ''),
      versions: {
        electron: process.versions.electron,
        chrome: process.versions.chrome,
      node: process.versions.node,
      v8: process.versions.v8,
      },
    });
  },

  [channels.APP_GET_AUTO_START]: async () => {
    const settings = app.getLoginItemSettings?.() as { openAtLogin?: boolean } | undefined;
    return ok({
      enabled: Boolean(settings?.openAtLogin),
      openAtLogin: Boolean(settings?.openAtLogin),
    });
  },

  [channels.APP_SET_AUTO_START]: async (_event, enabled: boolean) => {
    app.setLoginItemSettings({ openAtLogin: Boolean(enabled) });
    return ok({
      enabled: Boolean(enabled),
      openAtLogin: Boolean(enabled),
    });
  },
};
