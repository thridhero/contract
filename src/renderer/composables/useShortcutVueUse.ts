import { onMounted, onUnmounted, ref, watch, computed } from 'vue';
import { useMagicKeys, useEventListener, whenever } from '@vueuse/core';
import { createRendererLogger } from '@/utils/logger';
import type { MaybeRef } from 'vue';

const logger = createRendererLogger('UseShortcutVueUse');

/** 快捷键配置接口 */
export interface ShortcutConfig {
  /** 快捷键 ID，唯一标识 */
  id: string;
  /**
   * 快捷键组合
   * 支持格式：'p', 'ctrl+p', 'shift+ctrl+f', 'f11', 'escape' 等
   * 参考: https://vueuse.org/core/useMagicKeys/
   */
  keys: string;
  /** 快捷键描述 */
  description?: string;
  /** 是否在输入框中禁用 */
  disableInInput?: boolean;
  /** 是否只触发一次 */
  once?: boolean;
}

/** 快捷键处理器类型 */
export type ShortcutHandler = (event: KeyboardEvent) => void;

/**
 * 使用 VueUse 的快捷键管理组合式函数
 *
 * 使用示例：
 * ```ts
 * // 在组件中使用
 * const { register, onShortcut } = useShortcutVueUse();
 *
 * // 注册快捷键
 * onMounted(() => {
 *   register({
 *     id: 'toggle-fullscreen',
 *     keys: 'f11',
 *     description: '切换全屏'
 *   });
 * });
 *
 * // 监听特定快捷键
 * onShortcut('toggle-fullscreen', () => {
 *   console.log('F11 被按下');
 * });
 * ```
 */
export function useShortcutVueUse() {
  const isReady = ref(true);
  const registeredShortcuts = ref<Map<string, ShortcutConfig>>(new Map());
  const handlers = ref<Map<string, ShortcutHandler[]>>(new Map());

  // 使用 VueUse 的 useMagicKeys
  const magicKeys = useMagicKeys();

  /**
   * 检查当前是否在输入框中
   */
  const isInInputElement = (): boolean => {
    const activeElement = document.activeElement;
    if (!activeElement) return false;

    const tagName = activeElement.tagName.toLowerCase();
    const isInput = tagName === 'input' || tagName === 'textarea';
    const isContentEditable = activeElement.getAttribute('contenteditable') === 'true';

    return isInput || isContentEditable;
  };

  /**
   * 注册快捷键
   */
  const register = (config: ShortcutConfig): boolean => {
    if (!config.id || !config.keys) {
      logger.warn('Shortcut ID and keys cannot be empty');
      return false;
    }

    // 检查是否已注册
    if (registeredShortcuts.value.has(config.id)) {
      logger.warn(`Shortcut ${config.id} already exists, overwriting`);
    }

    registeredShortcuts.value.set(config.id, config);
    logger.debug(`Shortcut registered: ${config.id} (${config.keys})`);
    return true;
  };

  /**
   * 注销指定快捷键
   */
  const unregister = (id: string): boolean => {
    if (!registeredShortcuts.value.has(id)) {
      return false;
    }

    registeredShortcuts.value.delete(id);
    handlers.value.delete(id);
    logger.debug(`Shortcut unregistered: ${id}`);
    return true;
  };

  /**
   * 注销所有快捷键
   */
  const unregisterAll = (): void => {
    registeredShortcuts.value.clear();
    handlers.value.clear();
    logger.debug('Unregistered all shortcuts');
  };

  /**
   * 检查快捷键是否已注册
   */
  const isRegistered = (id: string): boolean => {
    return registeredShortcuts.value.has(id);
  };

  /**
   * 监听特定快捷键触发
   */
  const onShortcut = (id: string, handler: ShortcutHandler): (() => void) => {
    if (!handlers.value.has(id)) {
      handlers.value.set(id, []);
    }

    const handlerList = handlers.value.get(id)!;
    handlerList.push(handler);

    // 返回取消监听函数
    return () => {
      const index = handlerList.indexOf(handler);
      if (index > -1) {
        handlerList.splice(index, 1);
      }
    };
  };

  /**
   * 监听所有快捷键触发
   */
  const onAnyShortcut = (handler: (id: string, event: KeyboardEvent) => void): (() => void) => {
    const unsubscribeList: (() => void)[] = [];

    registeredShortcuts.value.forEach((config) => {
      const unsubscribe = onShortcut(config.id, (event) => {
        handler(config.id, event);
      });
      unsubscribeList.push(unsubscribe);
    });

    return () => {
      unsubscribeList.forEach(unsubscribe => unsubscribe());
    };
  };

  // 使用 watch 监听所有已注册的快捷键
  watch(
    () => Array.from(registeredShortcuts.value.values()),
    (shortcuts) => {
      // 清理旧的监听
      // 为每个快捷键设置监听
      shortcuts.forEach((config) => {
        const currentKey = magicKeys[config.keys];

        if (currentKey) {
          whenever(currentKey, (pressed) => {
            if (!pressed) return;

            // 检查是否在输入框中
            if (config.disableInInput !== false && isInInputElement()) {
              return;
            }

            logger.info(`Shortcut triggered: ${config.id} (${config.keys})`);

            // 获取事件对象
            const event = magicKeys.current;

            // 执行所有处理器
            const handlerList = handlers.value.get(config.id);
            if (handlerList) {
              handlerList.forEach(handler => {
                try {
                  handler(event as unknown as KeyboardEvent);
                } catch (err) {
                  logger.error('Handler execution failed:', err);
                }
              });
            }
          }, { once: config.once });
        }
      });
    },
    { immediate: true, deep: true }
  );

  // 组件卸载时自动清理
  onUnmounted(() => {
    unregisterAll();
  });

  return {
    isReady,
    register,
    unregister,
    unregisterAll,
    isRegistered,
    onShortcut,
    onAnyShortcut,
    // 暴露 magicKeys 以便高级使用
    magicKeys,
  };
}

/**
 * 简化的快捷键使用方式
 * 直接监听按键，无需注册
 *
 * 使用示例：
 * ```ts
 * useKeyStroke('ctrl+s', (event) => {
 *   event.preventDefault();
 *   console.log('Ctrl+S 被按下');
 * });
 * ```
 */
export function useKeyStroke(
  keys: MaybeRef<string | string[]>,
  handler: (event: KeyboardEvent) => void,
  options?: { disableInInput?: boolean }
) {
  const magicKeys = useMagicKeys();

  const keyRef = computed(() => {
    const keyValue = typeof keys === 'string' ? keys : keys;
    return magicKeys[keyValue as string];
  });

  whenever(keyRef, (pressed) => {
    if (!pressed) return;

    // 检查是否在输入框中
    if (options?.disableInInput !== false) {
      const activeElement = document.activeElement;
      if (activeElement) {
        const tagName = activeElement.tagName.toLowerCase();
        if (tagName === 'input' || tagName === 'textarea' || activeElement.getAttribute('contenteditable') === 'true') {
          return;
        }
      }
    }

    handler(magicKeys.current as unknown as KeyboardEvent);
  });
}

export default useShortcutVueUse;
