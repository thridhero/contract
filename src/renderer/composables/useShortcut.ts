import { onMounted, onUnmounted, ref } from 'vue';
import { eventBus } from '../utils/eventBus';
import { createRendererLogger } from '@/utils/logger';

const logger = createRendererLogger('UseShortcut');

/** 快捷键配置接口 */
export interface ShortcutConfig {
  /** 快捷键 ID，唯一标识 */
  id: string;
  /** 快捷键组合，如 'Ctrl+P', 'F11', 'Ctrl+Shift+S' */
  accelerator: string;
  /** 快捷键描述 */
  description?: string;
  /** 是否全局快捷键 */
  global?: boolean;
}

/** 快捷键处理器类型 */
export type ShortcutHandler = (payload: { id: string; accelerator: string }) => void;

/**
 * 快捷键管理组合式函数
 *
 * 使用示例：
 * ```ts
 * // 在组件中注册和使用快捷键
 * const { register, unregister, onShortcut } = useShortcut();
 *
 * // 注册快捷键
 * onMounted(async () => {
 *   await register({
 *     id: 'toggle-fullscreen',
 *     accelerator: 'F11',
 *     description: '切换全屏'
 *   });
 * });
 *
 * // 监听特定快捷键
 * onShortcut('toggle-fullscreen', () => {
 *   console.log('F11 被按下');
 * });
 *
 * // 组件卸载时自动注销
 * onUnmounted(() => {
 *   unregister('toggle-fullscreen');
 * });
 * ```
 */
export function useShortcut() {
  const isReady = ref(false);
  const registeredIds = new Set<string>();

  /**
   * 注册快捷键
   */
  const register = async (config: ShortcutConfig): Promise<boolean> => {
    if (!window.electronAPI?.shortcut) {
      logger.warn('electronAPI.shortcut not available');
      return false;
    }

    try {
      const result = await window.electronAPI.shortcut.register(config);
      if (result.success) {
        registeredIds.add(config.id);
        return true;
      }
      logger.error('Shortcut registration failed:', result.error);
      return false;
    } catch (err) {
      logger.error('Shortcut registration exception:', err);
      return false;
    }
  };

  /**
   * 注销指定快捷键
   */
  const unregister = async (id: string): Promise<boolean> => {
    if (!window.electronAPI?.shortcut) {
      return false;
    }

    try {
      const result = await window.electronAPI.shortcut.unregister(id);
      if (result.success) {
        registeredIds.delete(id);
        return true;
      }
      return false;
    } catch (err) {
      logger.error('Shortcut unregistration exception:', err);
      return false;
    }
  };

  /**
   * 注销所有已注册的快捷键
   */
  const unregisterAll = async (): Promise<boolean> => {
    if (!window.electronAPI?.shortcut) {
      return false;
    }

    try {
      const result = await window.electronAPI.shortcut.unregisterAll();
      if (result.success) {
        registeredIds.clear();
        return true;
      }
      return false;
    } catch (err) {
      logger.error('Shortcut unregisterAll exception:', err);
      return false;
    }
  };

  /**
   * 检查快捷键是否已注册
   */
  const isRegistered = async (id: string): Promise<boolean> => {
    if (!window.electronAPI?.shortcut) {
      return false;
    }

    try {
      const result = await window.electronAPI.shortcut.isRegistered(id);
      return result.success && result.data?.registered;
    } catch (err) {
      return false;
    }
  };

  /**
   * 监听特定快捷键触发
   */
  const onShortcut = (id: string, handler: ShortcutHandler): (() => void) => {
    const wrapper = (payload: { id: string; accelerator: string }) => {
      if (payload.id === id) {
        handler(payload);
      }
    };

    // 通过 EventBus 分发，支持组件级别的监听
    eventBus.on('shortcut:triggered', wrapper);

    // 返回取消监听函数
    return () => {
      eventBus.off('shortcut:triggered', wrapper);
    };
  };

  /**
   * 监听所有快捷键触发
   */
  const onAnyShortcut = (handler: ShortcutHandler): (() => void) => {
    eventBus.on('shortcut:triggered', handler);
    return () => {
      eventBus.off('shortcut:triggered', handler);
    };
  };

  // 组件卸载时自动清理本组件注册的快捷键
  onUnmounted(async () => {
    for (const id of Array.from(registeredIds)) {
      await unregister(id);
    }
  });

  return {
    isReady,
    register,
    unregister,
    unregisterAll,
    isRegistered,
    onShortcut,
    onAnyShortcut,
  };
}

/**
 * 全局快捷键管理组合式函数
 * 用于在应用级别管理快捷键，通常在 App.vue 或 MainLayout 中使用
 */
export function useGlobalShortcut() {
  const unsubscribeList: Array<() => void> = [];

  /**
   * 初始化全局快捷键监听
   * 应该在应用启动时调用一次
   */
  const init = () => {
    if (!window.electronAPI?.shortcut) {
      logger.warn('electronAPI.shortcut not available (global)');
      return;
    }

    // 订阅主进程的快捷键触发事件
    const unsubscribe = window.electronAPI.shortcut.onTriggered((payload) => {
      // 通过 EventBus 分发给所有监听器
      eventBus.emit('shortcut:triggered', payload);
    });

    unsubscribeList.push(unsubscribe);
    logger.info('Global shortcut listener initialized');
  };

  /**
   * 清理所有监听
   */
  const cleanup = () => {
    unsubscribeList.forEach(unsubscribe => unsubscribe());
    unsubscribeList.length = 0;
  };

  // 组件卸载时自动清理
  onUnmounted(() => {
    cleanup();
  });

  return {
    init,
    cleanup,
  };
}

export default useShortcut;
