<template>
  <div class="masonry-view w-full h-full overflow-y-auto" ref="containerRef">
    <div class="masonry-layout flex items-start" :style="{ gap: `${gap}px`, padding: `${gap}px` }">
      <div
        v-for="(col, colIndex) in columns"
        :key="colIndex"
        class="masonry-column flex-1 flex flex-col min-w-0"
      >
        <MasonryItem
          v-for="entry in col"
          :key="entry.item[itemKey]"
          :gap="gap"
        >
          <slot name="item" :item="entry.item" :index="entry.index"></slot>
        </MasonryItem>
      </div>
    </div>
    
    <div v-if="items.length === 0" class="h-full flex items-center justify-center">
      <slot name="empty">暂无数据</slot>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useElementSize } from '@vueuse/core'
import MasonryItem from './MasonryItem.vue'

const props = withDefaults(defineProps<{
  items: any[]
  itemKey?: string
  gap?: number
}>(), {
  items: () => [],
  itemKey: 'id',
  gap: 16
})

const containerRef = ref<HTMLElement | null>(null)
const { width } = useElementSize(containerRef)

// ≥1920px:6, ≥1200px:4, ≥768px:3, <768px:2
const columnCount = computed(() => {
  const w = width.value || window.innerWidth
  if (w >= 1920) return 6
  if (w >= 1200) return 4
  if (w >= 768) return 3
  return 2
})

// Distribute items round-robin
const columns = computed(() => {
  const cols: Array<Array<{ item: any; index: number }>> = Array.from({ length: columnCount.value }, () => [])
  props.items.forEach((item, index) => {
    cols[index % columnCount.value].push({ item, index })
  })
  return cols
})
</script>

<style scoped>
.masonry-view {
  /* Scroll container */
}
.masonry-layout {
  width: 100%;
}
</style>
