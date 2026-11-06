<template>
  <div
    ref="scrollRef"
    class="virtual-masonry-view w-full h-full overflow-y-auto"
    @scroll="onScroll"
  >
    <div v-if="items.length === 0" class="h-full flex items-center justify-center">
      <slot name="empty">暂无数据</slot>
    </div>

    <div v-else class="min-h-full">
      <div
        class="sticky top-2 z-10 pointer-events-none"
        v-if="showDebug"
      >
        <div
          class="ml-auto w-fit mr-2 px-3 py-2 rounded-md border border-[var(--content-border)] bg-[var(--content-bg)]/90 backdrop-blur text-xs text-[var(--content-text-secondary)]"
        >
          <div class="flex items-center gap-3">
            <span>cols {{ columnCount }}</span>
            <span>render {{ visibleEntries.length }}</span>
            <span>total {{ items.length }}</span>
            <span>recalc {{ layoutRecalcCount }}</span>
          </div>
        </div>
      </div>

      <div
        class="relative w-full"
        :style="{ height: `${containerHeight}px`, padding: `${gap}px` }"
      >
        <div
          v-for="entry in visibleEntries"
          :key="entry.key"
          class="absolute will-change-transform"
          :style="{
            width: `${entry.width}px`,
            height: `${entry.height}px`,
            transform: `translate3d(${entry.left}px, ${entry.top}px, 0)`
          }"
        >
          <slot name="item" :item="entry.item" :index="entry.index"></slot>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import { useElementSize } from '@vueuse/core'

type Breakpoints = {
  xl: number
  lg: number
  md: number
}

type PositionedEntry<T> = {
  key: string
  item: T
  index: number
  top: number
  left: number
  width: number
  height: number
}

const props = withDefaults(defineProps<{
  items: any[]
  itemKey?: string
  gap?: number
  overscanScreens?: number
  breakpoints?: Partial<Breakpoints>
  imageAspectRatioHeight?: number
  metaBarHeightRem?: number
  debug?: boolean
}>(), {
  items: () => [],
  itemKey: 'id',
  gap: 16,
  overscanScreens: 2.5,
  breakpoints: () => ({}),
  imageAspectRatioHeight: 0.75,
  metaBarHeightRem: 3.5,
  debug: false
})

const scrollRef = ref<HTMLElement | null>(null)
const { width: containerWidth, height: containerHeightPx } = useElementSize(scrollRef)

const scrollTop = ref(0)
let rafId: number | null = null

const layoutColumns = shallowRef<Array<Array<PositionedEntry<any>>>>([])
const containerHeight = ref(0)
const layoutRecalcCount = ref(0)

const getRootFontSize = () => {
  const v = Number.parseFloat(getComputedStyle(document.documentElement).fontSize || '16')
  return Number.isFinite(v) && v > 0 ? v : 16
}

const columnCount = computed(() => {
  const w = containerWidth.value || window.innerWidth
  const bp = {
    xl: props.breakpoints.xl ?? 1920,
    lg: props.breakpoints.lg ?? 1200,
    md: props.breakpoints.md ?? 768,
  }
  if (w >= bp.xl) return 6
  if (w >= bp.lg) return 4
  if (w >= bp.md) return 3
  return 2
})

const recalcLayout = () => {
  const cols = columnCount.value
  const gap = props.gap
  const padding = gap
  const w = containerWidth.value || 0
  const usable = w - padding * 2 - gap * (cols - 1)
  const colWidth = usable > 0 ? usable / cols : 0

  const metaHeightPx = getRootFontSize() * props.metaBarHeightRem
  const itemHeight = colWidth * props.imageAspectRatioHeight + metaHeightPx

  const colHeights = Array.from({ length: cols }, () => 0)
  const next: Array<Array<PositionedEntry<any>>> = Array.from({ length: cols }, () => [])

  for (let index = 0; index < props.items.length; index++) {
    const item = props.items[index]
    const key = String(item?.[props.itemKey] ?? index)

    let colIndex = 0
    let minH = colHeights[0] ?? 0
    for (let i = 1; i < cols; i++) {
      const h = colHeights[i] ?? 0
      if (h < minH) {
        minH = h
        colIndex = i
      }
    }

    const top = padding + minH
    const left = padding + colIndex * (colWidth + gap)

    next[colIndex].push({
      key,
      item,
      index,
      top,
      left,
      width: colWidth,
      height: itemHeight
    })

    colHeights[colIndex] = minH + itemHeight + gap
  }

  const maxCol = colHeights.length ? Math.max(...colHeights) : 0
  const contentH = props.items.length > 0 ? Math.max(0, maxCol - gap) : 0
  containerHeight.value = padding * 2 + contentH
  layoutColumns.value = next
  layoutRecalcCount.value += 1
}

watch(
  [() => props.items, () => columnCount.value, () => props.gap, () => containerWidth.value],
  () => {
    recalcLayout()
    scheduleVisibleUpdate()
  },
  { deep: false }
)

const lowerBoundByBottom = (arr: Array<PositionedEntry<any>>, startY: number) => {
  let lo = 0
  let hi = arr.length
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    const e = arr[mid]
    const bottom = e.top + e.height
    if (bottom < startY) lo = mid + 1
    else hi = mid
  }
  return lo
}

const visibleEntries = computed(() => {
  const vh = containerHeightPx.value || 0
  const over = vh * props.overscanScreens
  const startY = Math.max(0, scrollTop.value - over)
  const endY = scrollTop.value + vh + over

  const out: Array<PositionedEntry<any>> = []
  for (const col of layoutColumns.value) {
    if (!col.length) continue
    const startIdx = lowerBoundByBottom(col, startY)
    for (let i = startIdx; i < col.length; i++) {
      const e = col[i]
      if (e.top > endY) break
      out.push(e)
    }
  }

  out.sort((a, b) => (a.top - b.top) || (a.left - b.left))
  return out
})

const scheduleVisibleUpdate = () => {
  if (rafId !== null) return
  rafId = window.requestAnimationFrame(() => {
    rafId = null
    scrollTop.value = Number(scrollRef.value?.scrollTop || 0)
  })
}

const onScroll = () => {
  scheduleVisibleUpdate()
}

const showDebug = computed(() => {
  return !!props.debug && process.env.NODE_ENV !== 'production'
})

onMounted(() => {
  recalcLayout()
  scrollTop.value = Number(scrollRef.value?.scrollTop || 0)
})

onBeforeUnmount(() => {
  if (rafId !== null) {
    window.cancelAnimationFrame(rafId)
    rafId = null
  }
})
</script>

<style scoped>
.virtual-masonry-view {
  overscroll-behavior: contain;
}
</style>
