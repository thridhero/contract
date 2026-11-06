/**
 * EventBus - 全局事件总线
 * 使用 mitt 库实现，支持 TypeScript
 * 适用于组件间通信、跨模块消息传递
 */
import mitt from 'mitt';

/** 事件类型定义 */
export type EventBusEvents = {
  // 应用级事件
  'app:ready': void;
  'app:error': Error;
  'app:theme-change': 'light' | 'dark';

  // 数据更新事件
  'data:updated': { type: string; id: string | number };
  'data:deleted': { type: string; id: string | number };
  'data:created': { type: string; data: any };

  // UI 交互事件
  'ui:sidebar-toggle': boolean;
  'ui:modal-open': { name: string; props?: Record<string, any> };
  'ui:modal-close': string;
  'ui:notification': { type: 'success' | 'error' | 'warning' | 'info'; message: string };

  // 项目特定事件
  'project:selected': { id: number; name: string };
  'project:status-changed': { id: number; oldStatus: string; newStatus: string };
  'project:refresh': void;

  // 快捷键事件
  'shortcut:triggered': { id: string; accelerator: string };

  // 自定义事件（允许动态扩展）
  [key: string]: any;
};

/** 创建 EventBus 实例 */
export const eventBus = mitt<EventBusEvents>();

/** EventBus 工具类 */
export class EventBus {
  private static instance = eventBus;

  /** 获取 EventBus 实例 */
  static getInstance() {
    return this.instance;
  }

  /** 触发事件 */
  static emit<T extends keyof EventBusEvents>(
    type: T,
    event?: EventBusEvents[T]
  ) {
    this.instance.emit(type, event);
  }

  /** 监听事件 */
  static on<T extends keyof EventBusEvents>(
    type: T,
    handler: (event: EventBusEvents[T]) => void
  ) {
    this.instance.on(type, handler);
    return () => this.instance.off(type, handler);
  }

  /** 监听一次性事件 */
  static once<T extends keyof EventBusEvents>(
    type: T,
    handler: (event: EventBusEvents[T]) => void
  ) {
    const wrapper = (event: EventBusEvents[T]) => {
      handler(event);
      this.instance.off(type, wrapper);
    };
    this.instance.on(type, wrapper);
  }

  /** 取消监听 */
  static off<T extends keyof EventBusEvents>(
    type: T,
    handler?: (event: EventBusEvents[T]) => void
  ) {
    this.instance.off(type, handler);
  }

  /** 清除所有监听 */
  static clear() {
    this.instance.all.clear();
  }
}

export default eventBus;
