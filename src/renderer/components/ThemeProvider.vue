<template>
  <div class="theme-provider" :class="[themeClasses]">
    <slot></slot>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useTheme } from '../themes/useTheme';

const { currentThemeId } = useTheme();

// 暴露给业务组件可用的类名或直接通过 data-theme 由全局接管
const themeClasses = computed(() => {
  return `theme-${currentThemeId.value}`;
});
</script>

<style scoped>
.theme-provider {
  /* 确保根组件占满全屏并应用平滑过渡 */
  min-height: 100vh;
  width: 100%;
  transition: background-color var(--theme-animation-transitionNormal) ease-in-out,
              color var(--theme-animation-transitionNormal) ease-in-out;
  background-color: var(--theme-color-background);
  color: var(--theme-color-textPrimary);
}
</style>
