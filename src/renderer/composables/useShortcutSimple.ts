import { onUnmounted, unref } from 'vue';
import { useMagicKeys, whenever } from '@vueuse/core';
import { createRendererLogger } from '@/utils/logger';
import type { MaybeRef } from 'vue';

const logger = createRendererLogger('UseShortcutSimple');

/**
 * 简化的快捷键组合式函数 - 基于 VueUse
 *
 * 使用示例：
 * ```ts
 * // 在组件中直接使用
 * import { useShortcut } from './composables/useShortcutSimple'
 *
 * // 方式1：直接监听
 * useShortcut('p', () => {
 *   console.log('P 键被按下');
 * });
 *
 * // 方式2：带修饰键
 * useShortcut('ctrl+s', (e) => {
 *   e.preventDefault();
 *   console.log('Ctrl+S 保存');
 * });
 *
 * // 方式3：多个快捷键
 * useShortcut(['ctrl+c', 'ctrl+v'], (e) => {
 *   console.log('复制或粘贴');
 * });
 * ```
 */
export function useShortcut(
  keys: MaybeRef<string | string[]>,
  handler: (event: KeyboardEvent) => void,
  options?: {
    /** 是否在输入框中禁用（默认 true） */
    disableInInput?: boolean;
    /** 是否只触发一次（默认 false） */
    once?: boolean;
  }
) {
  const magicKeys = useMagicKeys();
  const unsubscribeList: (() => void)[] = [];

  const unrefKeys = unref(keys);
  const keyArray = Array.isArray(unrefKeys) ? unrefKeys : [unrefKeys];

  keyArray.forEach((key) => {
    const current = magicKeys[key];
    logger.debug(`Registering shortcut: ${key}`);

    const stop = whenever(current, (pressed) => {
      if (!pressed) return;
      logger.info(`Shortcut triggered: ${key}`);

      // 检查是否在输入框中
      if (options?.disableInInput !== false) {
        const activeElement = document.activeElement;
        if (activeElement) {
          const tagName = activeElement.tagName.toLowerCase();
          const isInput = tagName === 'input' || tagName === 'textarea';
          const isContentEditable = activeElement.getAttribute('contenteditable') === 'true';

          if (isInput || isContentEditable) {
            return;
          }
        }
      }

      handler(magicKeys.current as unknown as KeyboardEvent);
    }, { once: options?.once });

    unsubscribeList.push(stop);
  });

  // 组件卸载时自动清理
  onUnmounted(() => {
    unsubscribeList.forEach(stop => stop());
  });

  // 返回手动清理函数
  return () => {
    unsubscribeList.forEach(stop => stop());
    unsubscribeList.length = 0;
  };
}

/**
 * 使用示例 - 在 MainLayout.vue 中：
 *
 * ```ts
 * import { useShortcut } from '../composables/useShortcutSimple'
 *
 * // 在 setup 中直接使用
 * useShortcut('p', () => {
 *   console.log('P 键被按下，切换全屏');
 *   toggleFullscreen();
 * });
 *
 * useShortcut('ctrl+f', (e) => {
 *   e.preventDefault();
 *   console.log('Ctrl+F 聚焦搜索');
 *   focusSearch();
 * });
 *
 * useShortcut('ctrl+n', (e) => {
 *   e.preventDefault();
 *   console.log('Ctrl+N 新建文件夹');
 *   showAddFolderModal.value = true;
 * });
 *
 * // F11 全屏
 * useShortcut('f11', (e) => {
 *   e.preventDefault();
 *   toggleFullscreen();
 * });
 *
 * // Escape 关闭弹窗
 * useShortcut('escape', () => {
 *   showAddFolderModal.value = false;
 * });
 * ```
 */

export default useShortcut;
