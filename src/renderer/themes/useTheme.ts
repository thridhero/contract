import { ref, watch, onMounted, readonly } from 'vue';
import { defineStore } from 'pinia';
import { useStorage, usePreferredDark } from '@vueuse/core';
import { createRendererLogger } from '@/utils/logger';
import type { IThemeConfig } from '../config/theme.config';
import { defaultThemeConfig } from '../config/theme.config';

const logger = createRendererLogger('ThemeStoreV2');

// 动态注入外部 JSON 主题
const injectThemeCSSVariables = (theme: IThemeConfig) => {
  if (typeof window === 'undefined') return; // SSR 兼容
  
  const root = document.documentElement;
  // 设置 data-theme 属性，以便 SCSS 中的样式生效
  root.setAttribute('data-theme', theme.id);

  // 动态创建 style 标签以支持运行时完全自定义 JSON 主题的覆盖
  let styleEl = document.getElementById('dynamic-theme-styles');
  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = 'dynamic-theme-styles';
    document.head.appendChild(styleEl);
  }

  // 转换为 CSS 变量字符串
  const cssVars = [
    ...Object.entries(theme.colors).map(([k, v]) => `--theme-color-${k}: ${v};`),
    ...Object.entries(theme.typography).map(([k, v]) => `--theme-typography-${k}: ${v};`),
    ...Object.entries(theme.spacing).map(([k, v]) => `--theme-spacing-${k}: ${v};`),
    ...Object.entries(theme.shadows).map(([k, v]) => `--theme-shadow-${k}: ${v};`),
    ...Object.entries(theme.animations).map(([k, v]) => `--theme-animation-${k}: ${v};`)
  ].join('');

  // 通过 requestAnimationFrame + CSS Transition 确保无闪烁过渡 (200ms)
  requestAnimationFrame(() => {
    root.style.setProperty('transition', 'all 200ms ease-in-out');
    styleEl!.innerHTML = `[data-theme="${theme.id}"] { ${cssVars} }`;
  });
};

// 定义 Pinia Store 管理主题状态
export const useThemeStore = defineStore('theme-store', () => {
  // 使用 useStorage 实现 localStorage 持久化
  const currentThemeId = useStorage('app-theme-id', 'theme-light');
  const customThemes = useStorage<Record<string, IThemeConfig>>('app-custom-themes', {});
  const isAutoAdapt = useStorage('app-theme-auto', true);

  // 预设主题 ID 列表
  const presetThemes = ['theme-light', 'theme-dark', 'theme-high-contrast', 'theme-brand'];

  // 监听系统偏好
  const preferredDark = usePreferredDark();

  const getThemeConfig = (id: string): IThemeConfig | null => {
    if (customThemes.value[id]) return customThemes.value[id];
    // 预设主题通过 SCSS 实现，这里返回基本配置对象（实际项目中可能需要完整的预设 JSON 配置用于导出）
    if (presetThemes.includes(id)) {
      return { ...defaultThemeConfig, id, name: id }; // 简化处理
    }
    return null;
  };

  const setTheme = (id: string) => {
    isAutoAdapt.value = false; // 手动切换则关闭自动适配
    currentThemeId.value = id;
  };

  const applyTheme = (id: string) => {
    if (typeof window === 'undefined') return;
    
    // 检查是否为自定义主题，自定义主题需要注入 CSS 变量
    const customConfig = customThemes.value[id];
    if (customConfig) {
      injectThemeCSSVariables(customConfig);
    } else {
      // 预设主题，直接切换 data-theme 即可
      requestAnimationFrame(() => {
        document.documentElement.setAttribute('data-theme', id);
      });
    }
  };

  // 自动适配逻辑
  const applyAutoTheme = () => {
    if (!isAutoAdapt.value) return;
    if (preferredDark.value) {
      currentThemeId.value = 'theme-dark';
    } else {
      currentThemeId.value = 'theme-light';
    }
  };

  // 监听切换
  watch(currentThemeId, (newId) => {
    applyTheme(newId);
  }, { immediate: true });

  watch(preferredDark, () => {
    if (isAutoAdapt.value) {
      applyAutoTheme();
    }
  });

  // 导入/上传主题 JSON
  const importTheme = (themeJson: string | IThemeConfig) => {
    try {
      const config: IThemeConfig = typeof themeJson === 'string' ? JSON.parse(themeJson) : themeJson;
      if (!config.id || !config.colors) throw new Error('Invalid theme config');
      customThemes.value[config.id] = config;
      return config.id;
    } catch (e) {
      logger.error('Failed to import theme:', e);
      return null;
    }
  };

  // 导出/下载主题 JSON
  const exportTheme = (id: string) => {
    const config = getThemeConfig(id);
    if (!config) return null;
    return JSON.stringify(config, null, 2);
  };

  // 删除自定义主题
  const removeCustomTheme = (id: string) => {
    if (customThemes.value[id]) {
      delete customThemes.value[id];
      if (currentThemeId.value === id) {
        setTheme('theme-light');
      }
    }
  };

  return {
    currentThemeId,
    customThemes: readonly(customThemes),
    isAutoAdapt,
    setTheme,
    importTheme,
    exportTheme,
    removeCustomTheme,
    applyAutoTheme,
  };
});

// 组合式 API 导出
export function useTheme() {
  const themeStore = useThemeStore();
  
  onMounted(() => {
    if (themeStore.isAutoAdapt) {
      themeStore.applyAutoTheme();
    }
  });

  return {
    currentThemeId: themeStore.currentThemeId,
    customThemes: themeStore.customThemes,
    isAutoAdapt: themeStore.isAutoAdapt,
    setTheme: themeStore.setTheme,
    importTheme: themeStore.importTheme,
    exportTheme: themeStore.exportTheme,
    removeCustomTheme: themeStore.removeCustomTheme,
    enableAutoAdapt: () => {
      themeStore.isAutoAdapt = true;
      themeStore.applyAutoTheme();
    }
  };
}
