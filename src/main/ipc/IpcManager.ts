import { ipcMain, IpcMainInvokeEvent } from 'electron';
import { IS_DEV } from '../config/app.config';
import { fail } from '../../shared/types/ipc.types';
import { createLogger } from '../utils/logger';
import { LOG_WRITE } from './channels';

const logger = createLogger('IpcManager');

/** Handler 函数签名：接收 event 和任意参数，返回 Promise */
type IpcHandler = (event: IpcMainInvokeEvent, ...args: unknown[]) => Promise<unknown>;

/** 已注册的 channel 集合，防止重复注册 */
const registeredChannels = new Set<string>();

/**
 * IPC 管理器
 *
 * 统一管理所有 ipcMain.handle 的注册与注销，提供：
 * - 重复注册检测
 * - 统一的 try/catch 错误边界（handler 内部抛出异常会被捕获并以标准格式返回）
 * - 日志追踪
 */
export class IpcManager {
  /**
   * 注册一个 invoke handler
   * @param channel  使用 channels.ts 中的常量
   * @param handler  业务处理函数，可直接 throw Error，由此处统一捕获
   */
  static register(channel: string, handler: IpcHandler): void {
    if (registeredChannels.has(channel)) {
      logger.warn(`Channel "${channel}" 已注册，跳过重复注册`);
      return;
    }

    ipcMain.handle(channel, async (event, ...args) => {
      const startedAt = Date.now();
      if (channel !== LOG_WRITE) {
        logger.debug(`IPC ← ${channel}`, args);
      }
      try {
        const result = await handler(event, ...args);
        if (channel !== LOG_WRITE) {
          logger.debug(`IPC → ${channel} (ok)`, {
            elapsedMs: Date.now() - startedAt,
            result,
          });
        }
        return result;
      } catch (err) {
        logger.error(`IPC → ${channel} (error)`, {
          elapsedMs: Date.now() - startedAt,
          error: err,
        });
        return fail(err, IS_DEV);
      }
    });

    registeredChannels.add(channel);
    logger.debug(`已注册 channel: ${channel}`);
  }

  /**
   * 批量注册，传入 { [channel]: handler } 映射对象
   */
  static registerAll(handlers: Record<string, IpcHandler>): void {
    for (const [channel, handler] of Object.entries(handlers)) {
      IpcManager.register(channel, handler);
    }
  }

  /**
   * 注销指定 channel（通常在窗口销毁时调用）
   */
  static unregister(channel: string): void {
    ipcMain.removeHandler(channel);
    registeredChannels.delete(channel);
    logger.debug(`已注销 channel: ${channel}`);
  }

  /**
   * 注销所有已注册的 channel
   */
  static unregisterAll(): void {
    for (const channel of Array.from(registeredChannels)) {
      ipcMain.removeHandler(channel);
    }
    registeredChannels.clear();
    logger.info('已注销全部 IPC handler');
  }
}
