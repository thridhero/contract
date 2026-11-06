<template>
  <div
    class="masonry-item-wrapper"
    ref="wrapperRef"
    :style="wrapperStyle"
  >
    <div v-if="isVisible" ref="contentRef" class="masonry-item-content">
      <slot></slot>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onBeforeUnmount } from 'vue'
import { useIntersectionObserver, useResizeObserver } from '@vueuse/core'

const props = defineProps<{
  gap?: number
}>()

const wrapperRef = ref<HTMLElement | null>(null)
const contentRef = ref<HTMLElement | null>(null)

const isVisible = ref(false)
const cachedHeight = ref<number | null>(null)

const { stop: stopIntersection } = useIntersectionObserver(
  wrapperRef,
  ([{ isIntersecting }]) => {
    isVisible.value = isIntersecting
  },
  {
    rootMargin: '400px 0px 400px 0px',
    threshold: 0
  }
)

const { stop: stopResize } = useResizeObserver(contentRef, (entries) => {
  const entry = entries[0]
  if (entry) {
    const { height } = entry.contentRect
    if (height > 0) {
      cachedHeight.value = height
    }
  }
})

const wrapperStyle = computed(() => {
  const gap = typeof props.gap === 'number' ? props.gap : 0
  if (isVisible.value) {
    return { height: 'auto', minHeight: '200px', marginBottom: `${gap}px` } as any
  }
  if (cachedHeight.value) {
    const h = `${cachedHeight.value}px`
    return { height: h, minHeight: h, marginBottom: `${gap}px` } as any
  }
  return { height: 'auto', minHeight: '200px', marginBottom: `${gap}px` } as any
})

onBeforeUnmount(() => {
  stopIntersection()
  stopResize()
})
</script>

<style scoped>
.masonry-item-wrapper {
  width: 100%;
  box-sizing: border-box;
}
.masonry-item-content {
  width: 100%;
}
</style>
