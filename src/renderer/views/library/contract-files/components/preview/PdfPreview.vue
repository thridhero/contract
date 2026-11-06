<template>
  <div class="mx-auto w-full max-w-[980px]">
    <div v-for="page in pageNumbers" :key="page" class="mb-6 flex justify-center">
      <div class="relative" :data-pdf-page="page">
        <canvas :ref="(el) => onCanvasRef(el, page - 1)" class="shadow-sm border border-[var(--content-border)] bg-white rounded"></canvas>
        <div :ref="(el) => onTextLayerRef(el, page - 1)" class="absolute inset-0 overflow-hidden rounded pdf-text-layer"></div>
        <div class="absolute inset-0 pointer-events-none overflow-hidden rounded">
          <div
            v-for="highlight in getPageHighlights(page)"
            :key="highlight.id"
            class="absolute rounded border transition-colors duration-150 mix-blend-multiply"
            :data-highlight-id="highlight.id"
            :class="highlight.active ? 'bg-[#ff9632]/50 border-[#ff9632]' : 'bg-[#ffff00]/40 border-[#ffff00]/80'"
            :style="{
              left: `${highlight.left * 100}%`,
              top: `${highlight.top * 100}%`,
              width: `${highlight.width * 100}%`,
              height: `${highlight.height * 100}%`,
            }"
          ></div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
  pageNumbers: number[]
  pageHighlights?: Record<number, Array<{
    id: string
    left: number
    top: number
    width: number
    height: number
    active: boolean
  }>>
}>()

const emit = defineEmits<{
  (e: 'setCanvasRef', el: Element | null, index: number): void
  (e: 'setTextLayerRef', el: Element | null, index: number): void
}>()

const onCanvasRef = (el: Element | null, index: number) => {
  emit('setCanvasRef', el, index)
}

const onTextLayerRef = (el: Element | null, index: number) => {
  emit('setTextLayerRef', el, index)
}

const getPageHighlights = (pageNumber: number) => props.pageHighlights?.[pageNumber] || []
</script>

<style scoped>
.pdf-text-layer :deep(.textLayer) {
  position: absolute;
  inset: 0;
  overflow: clip;
  opacity: 1;
  outline: none;
  line-height: 1;
  transform-origin: 0 0;
  -webkit-text-size-adjust: none;
  text-size-adjust: none;
  forced-color-adjust: none;
  caret-color: CanvasText;
  z-index: 0;
  --min-font-size: 1;
  --text-scale-factor: calc(var(--total-scale-factor) * var(--min-font-size));
  --min-font-size-inv: calc(1 / var(--min-font-size));
}

.pdf-text-layer :deep(.textLayer :is(span, br)) {
  color: transparent;
  position: absolute;
  white-space: pre;
  cursor: text;
  transform-origin: 0% 0%;
}

.pdf-text-layer :deep(.textLayer > :not(.markedContent)),
.pdf-text-layer :deep(.textLayer .markedContent span:not(.markedContent)) {
  z-index: 1;
  font-size: calc(var(--text-scale-factor) * var(--font-height));
  transform: rotate(var(--rotate)) scaleX(var(--scale-x)) scale(var(--min-font-size-inv));
}

.pdf-text-layer :deep(.textLayer .markedContent) {
  display: contents;
}

.pdf-text-layer :deep(.textLayer ::selection) {
  background: rgba(0, 0, 255, 0.25);
}
</style>
