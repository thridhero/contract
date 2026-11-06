import { IpcMainInvokeEvent } from 'electron';
import * as channels from '../../channels';
import { WindowManager } from '../../../windows/WindowManager';
import { ok, fail } from '../../../../shared/types/ipc.types';
import { createLogger } from '../../../utils/logger';

const logger = createLogger('ShortcutHandlers');

/** 快捷键配置接口 */
export interface ShortcutConfig {
  /** 快捷键 ID，唯一标识 */
  id: string;
  /** 快捷键组合，如 'Ctrl+P', 'F11', 'Ctrl+Shift+S' */
  accelerator: string;
  /** 快捷键描述 */
  description?: string;
  /** 是否全局快捷键（在应用失去焦点时仍然有效） */
  global?: boolean;
}

/** 已注册的快捷键映射 */
const registeredShortcuts = new Map<string, ShortcutConfig>();

/**
 * 快捷键 IPC Handler 映射
 *
 * 设计原则：
 * - 快捷键注册由渲染进程发起，主进程负责监听和分发
 * - 当快捷键被触发时，主进程通过 SHORTCUT_TRIGGERED 事件通知渲染进程
 * - 支持应用内快捷键和全局快捷键
 */
export const shortcutHandlers: Record<string, (event: IpcMainInvokeEvent, ...args: unknown[]) => Promise<unknown>> = {

  /**
   * 注册快捷键
   * @param config 快捷键配置
   */
  [channels.SHORTCUT_REGISTER]: async (_event, config: ShortcutConfig) => {
    try {
      if (!config.id || !config.accelerator) {
        return fail('快捷键 ID 和 accelerator 不能为空');
      }

      const win = WindowManager.getMainWindow();
      if (!win) {
        return fail('主窗口未创建');
      }

      // 检查是否已注册
      if (registeredShortcuts.has(config.id)) {
        logger.warn(`快捷键 ${config.id} 已存在，将覆盖`);
      }

      // 保存配置
      registeredShortcuts.set(config.id, config);

      logger.info(`快捷键已注册: ${config.id} (${config.accelerator})`);
      return ok({ id: config.id, accelerator: config.accelerator });
    } catch (err) {
      logger.error(`注册快捷键失败: ${err}`);
      return fail(err);
    }
  },

  /**
   * 注销指定快捷键
   * @param id 快捷键 ID
   */
  [channels.SHORTCUT_UNREGISTER]: async (_event, id: string) => {
    try {
      if (!registeredShortcuts.has(id)) {
        return fail(`快捷键 ${id} 未注册`);
      }

      registeredShortcuts.delete(id);
      logger.info(`快捷键已注销: ${id}`);
      return ok({ id });
    } catch (err) {
      logger.error(`注销快捷键失败: ${err}`);
      return fail(err);
    }
  },

  /**
   * 注销所有快捷键
   */
  [channels.SHORTCUT_UNREGISTER_ALL]: async () => {
    try {
      const count = registeredShortcuts.size;
      registeredShortcuts.clear();
      logger.info(`已注销所有快捷键 (${count} 个)`);
      return ok({ count });
    } catch (err) {
      logger.error(`注销所有快捷键失败: ${err}`);
      return fail(err);
    }
  },

  /**
   * 检查快捷键是否已注册
   * @param id 快捷键 ID
   */
  [channels.SHORTCUT_IS_REGISTERED]: async (_event, id: string) => {
    return ok({ registered: registeredShortcuts.has(id) });
  },
};

/**
 * 获取已注册的快捷键配置
 */
export function getRegisteredShortcuts(): Map<string, ShortcutConfig> {
  return registeredShortcuts;
}

/**
 * 根据快捷键组合查找配置
 */
export function findShortcutByAccelerator(accelerator: string): ShortcutConfig | undefined {
  const configs = Array.from(registeredShortcuts.values());
  for (const config of configs) {
    if (config.accelerator.toLowerCase() === accelerator.toLowerCase()) {
      return config;
    }
  }
  return undefined;
}
