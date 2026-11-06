import { onUnmounted } from 'vue';
import { eventBus, EventBusEvents } from '../utils/eventBus';

/**
 * 使用 EventBus 的组合式函数
 * 在组件中自动清理事件监听
 * @example
 * ```ts
 * // 在组件中使用
 * const { emit, on, once } = useEventBus();
 *
 * // 发送事件
 * emit('project:refresh');
 *
 * // 监听事件（自动清理）
 * on('project:selected', (data) => {
 *   console.log('选中项目:', data);
 * });
 * ```
 */
export function useEventBus() {
  const handlers: Array<{ type: keyof EventBusEvents; handler: Function }> = [];

  /**
   * 发送事件
   */
  const emit = <T extends keyof EventBusEvents>(
    type: T,
    event?: EventBusEvents[T]
  ) => {
    eventBus.emit(type, event);
  };

  /**
   * 监听事件（自动清理）
   */
  const on = <T extends keyof EventBusEvents>(
    type: T,
    handler: (event: EventBusEvents[T]) => void
  ) => {
    eventBus.on(type, handler);
    handlers.push({ type, handler });
  };

  /**
   * 监听一次性事件
   */
  const once = <T extends keyof EventBusEvents>(
    type: T,
    handler: (event: EventBusEvents[T]) => void
  ) => {
    const wrapper = (event: EventBusEvents[T]) => {
      handler(event);
      eventBus.off(type, wrapper);
      const index = handlers.findIndex(h => h.type === type && h.handler === wrapper);
      if (index > -1) handlers.splice(index, 1);
    };
    eventBus.on(type, wrapper);
    handlers.push({ type, handler: wrapper });
  };

  // 组件卸载时自动清理所有监听
  onUnmounted(() => {
    handlers.forEach(({ type, handler }) => {
      eventBus.off(type, handler as any);
    });
    handlers.length = 0;
  });

  return {
    emit,
    on,
    once,
  };
}

export default useEventBus;
