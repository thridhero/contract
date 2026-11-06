<template>
  <header class="flex items-center justify-between px-6 h-16 shrink-0 bg-[var(--content-bg)]/80 backdrop-blur-md border-b border-[var(--content-border)] z-40" style="-webkit-app-region: drag;">
    <div class="flex items-center flex-1 gap-3 min-w-0">
      <button
        @click="emit('back')"
        class="p-2 rounded-lg transition-colors hover:bg-[var(--sidebar-hover-bg)] text-[var(--content-text-secondary)]"
        style="-webkit-app-region: no-drag;"
      >
        <i class="pi pi-arrow-left"></i>
      </button>
      <div class="w-px h-5 bg-[var(--content-border)]"></div>
      <div class="flex items-center gap-1" style="-webkit-app-region: no-drag;">
        <Button icon="pi pi-chevron-left" class="p-button-sm p-button-secondary p-button-text !w-8 !h-8 !p-0 custom-icon-btn" :disabled="!hasPrevious" @click="emit('previous')" v-tooltip.bottom="'上一个'" />
        <Button icon="pi pi-chevron-right" class="p-button-sm p-button-secondary p-button-text !w-8 !h-8 !p-0 custom-icon-btn" :disabled="!hasNext" @click="emit('next')" v-tooltip.bottom="'下一个'" />
      </div>
      <div class="w-px h-5 bg-[var(--content-border)] ml-1"></div>
      <h2
        class="text-lg font-bold text-[var(--content-text)] tracking-tight whitespace-nowrap min-w-0 truncate cursor-grab active:cursor-grabbing"
        style="-webkit-app-region: no-drag;"
        draggable="true"
        @dragstart="onDragStart"
      >
        文件预览
        <span v-if="displayName" class="text-[var(--content-text-secondary)] font-medium ml-2">{{ displayName }}</span>
      </h2>
      <div class="flex-1 h-full"></div>
    </div>

    <div class="flex items-center gap-2" style="-webkit-app-region: no-drag;">
      <template v-if="isZoomable">
        <Button icon="pi pi-search-minus" class="p-button-sm p-button-secondary p-button-text !w-8 !h-8 !p-0 custom-icon-btn" v-tooltip.bottom="'缩小'" :disabled="!isReady || scale <= 0.25" @click="emit('zoomOut')" />
        <Button icon="pi pi-search-plus" class="p-button-sm p-button-secondary p-button-text !w-8 !h-8 !p-0 custom-icon-btn" v-tooltip.bottom="'放大'" :disabled="!isReady || scale >= 3" @click="emit('zoomIn')" />
        <Button label="重置" class="p-button-sm p-button-secondary p-button-text !h-8 custom-icon-btn" :disabled="!isReady || scale === 1" @click="emit('resetZoom')" />
        <div class="w-px h-5 bg-[var(--content-border)] mx-1"></div>
      </template>
      <Button icon="pi pi-copy" class="p-button-sm p-button-secondary p-button-text !w-8 !h-8 !p-0 custom-icon-btn" v-tooltip.bottom="'复制'" :disabled="!filePath" @click="emit('copy')" />
      <Button icon="pi pi-external-link" class="p-button-sm p-button-secondary p-button-text !w-8 !h-8 !p-0 custom-icon-btn" v-tooltip.bottom="'在外部打开'" :disabled="!filePath" @click="emit('openExternal')" />
      <WindowControls />
    </div>
  </header>
</template>

<script setup lang="ts">
import Button from 'primevue/button'
import WindowControls from '@/components/WindowControls.vue'

const props = defineProps<{
  displayName: string
  filePath: string
  hasPrevious: boolean
  hasNext: boolean
  isZoomable: boolean
  isReady: boolean
  scale: number
  libraryPath: string
  contractId: string
  fileId: string
}>()

const emit = defineEmits<{
  (e: 'back'): void
  (e: 'previous'): void
  (e: 'next'): void
  (e: 'zoomIn'): void
  (e: 'zoomOut'): void
  (e: 'resetZoom'): void
  (e: 'copy'): void
  (e: 'openExternal'): void
}>()

const onDragStart = (e: DragEvent) => {
  if (!props.libraryPath || !props.contractId || !props.fileId) return
  
  e.preventDefault()
  if (e.dataTransfer) e.dataTransfer.effectAllowed = 'copy'

  const promise = window.electronAPI.contractFiles.startDragOut({
    libraryPath: props.libraryPath,
    contractId: props.contractId,
    fileIds: [props.fileId],
  })

  void promise.then((res) => {
    if (!res.success) {
      // Error handling is done in parent
    }
  })
}
</script>
