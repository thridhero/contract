<template>
  <div
    class="file-card-wrapper group relative flex flex-col bg-[var(--content-card-bg)] border border-[var(--content-border)] rounded-lg overflow-hidden cursor-pointer transition-all duration-300 hover:shadow-lg hover:border-[var(--btn-primary-bg)]"
    :class="selected ? '!border-[var(--btn-primary-bg)] shadow-[0_0_0_1px_var(--btn-primary-bg)]' : ''"
    :style="fill ? { height: '100%' } : undefined"
    draggable="true"
    :data-contract-file-id="props.item?.fileId"
    @click="emit('click', { item: props.item, event: $event })"
    @contextmenu.prevent.stop="emit('contextmenu', { item: props.item, event: $event })"
    @dblclick="emit('open', props.item)"
  >
    <div class="file-card-image-container relative w-full bg-[var(--content-bg)] shrink-0" :style="containerStyle">
      <div v-if="status === 'error' || status === 'failed'" class="absolute inset-0 flex flex-col items-center justify-center p-4 bg-[var(--content-bg)]">
        <img
          v-if="iconSrc"
          :src="iconSrc"
          class="w-16 h-16 object-contain opacity-80 mb-2"
          alt=""
          decoding="async"
          loading="lazy"
        />
        <i v-else class="pi pi-file text-6xl text-[var(--content-text-muted)] mb-2"></i>
        <Button
          v-if="!isDevelopmentFile"
          label="重新生成"
          icon="pi pi-refresh"
          size="small"
          severity="secondary"
          @click.stop="handleRetry"
          class="!py-1 !px-3 text-xs z-10 relative"
        />
      </div>

      <div v-else-if="thumbnailSrc" class="absolute inset-0">
        <img
          :src="thumbnailSrc"
          class="w-full h-full"
          :class="thumbnailFitClass"
          loading="lazy"
          decoding="async"
          referrerpolicy="no-referrer"
          alt="Thumbnail"
          @load="handleImageLoad"
          @error="handleImageError"
        />
      </div>

      <div v-else-if="!isFolder && (status === 'pending' || status === 'processing')" class="absolute inset-0 flex items-center justify-center p-4">
        <Skeleton width="100%" height="100%" class="opacity-50" />
        <div v-if="status === 'processing'" class="absolute flex flex-col items-center gap-2">
          <i class="pi pi-spin pi-spinner text-2xl" style="color: var(--btn-primary-bg)"></i>
          <span class="text-xs text-[var(--content-text-secondary)]">生成中...</span>
        </div>
      </div>
      
      <div v-else class="absolute inset-0 flex items-center justify-center p-4 bg-[var(--content-bg)]">
        <img
          v-if="iconSrc"
          :src="iconSrc"
          class="w-16 h-16 object-contain opacity-80"
          alt=""
          decoding="async"
          loading="lazy"
        />
        <i v-else class="pi pi-file text-6xl text-[var(--content-text-muted)]"></i>
      </div>

      <div class="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-3 text-white pointer-events-none">
        <div class="font-medium truncate mb-1" :title="item.name">{{ item.name }}</div>
        <div class="flex justify-between text-xs opacity-80">
          <span>{{ formatSize(item.size) }}</span>
          <span>{{ formatTime(item.mtime) }}</span>
        </div>
      </div>

      <div
        v-if="selected"
        class="absolute top-2 right-2 w-5 h-5 rounded-full flex items-center justify-center text-white text-[10px] font-semibold shadow-sm"
        style="background-color: var(--btn-primary-bg)"
      >
        ✓
      </div>
    </div>

    <!-- File Info (Bottom bar) -->
    <div class="h-14 px-3 py-2 border-t border-[var(--content-border)] bg-[var(--content-card-bg)] shrink-0">
      <div class="flex items-center gap-2">
        <img
          v-if="iconSrc"
          :src="iconSrc"
          class="w-4 h-4 shrink-0 object-contain"
          alt=""
          decoding="async"
          loading="lazy"
        />
        <i v-else class="pi pi-file text-[var(--content-text-secondary)] text-sm"></i>
        <span class="text-sm font-medium text-[var(--content-text)] truncate flex-1" :title="item.name">
          {{ item.name }}
        </span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import Skeleton from 'primevue/skeleton'
import Button from 'primevue/button'
import { getContractFileIconUrl } from '../../utils/contractFileIcons'

const props = defineProps<{
  item: any
  selected?: boolean
  iconUrl?: string
  fill?: boolean
  lockAspectRatio?: boolean
}>()

const emit = defineEmits<{
  open: [item: any]
  retry: [item: any]
  click: [payload: { item: any; event: MouseEvent }]
  contextmenu: [payload: { item: any; event: MouseEvent }]
}>()

// 'pending' | 'processing' | 'completed' | 'failed'
const status = computed(() => {
  return props.item.previewStatus || (props.item.firstPageThumb ? 'completed' : 'pending')
})

const thumbnailSrc = computed(() => {
  if (props.item.firstPageThumb) {
    // If it's an absolute path, convert to local:// or file://
    if (props.item.firstPageThumb.startsWith('http') || props.item.firstPageThumb.startsWith('data:')) {
      return props.item.firstPageThumb
    }
    const normalized = String(props.item.firstPageThumb || '').replace(/\\/g, '/')
    return `file:///${encodeURI(normalized)}`
  }
  const ext = getExt(props.item?.name || '')
  if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext) && props.item?.path) {
    const normalized = String(props.item.path || '').replace(/\\/g, '/')
    return `file:///${encodeURI(normalized)}`
  }
  return ''
})

const iconSrc = computed(() => {
  const explicit = String(props.iconUrl || '').trim()
  if (explicit) return explicit
  return String(getContractFileIconUrl(props.item) || '').trim()
})

const aspectRatio = ref('4 / 3')

const isImageFile = computed(() => {
  const ext = getExt(props.item?.name || '')
  return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg', 'avif'].includes(ext)
})

const thumbnailFitClass = computed(() => {
  return isImageFile.value ? 'object-cover' : 'object-contain'
})

const isFolder = computed(() => {
  return String(props.item?.type || '').toLowerCase() === 'folder'
})

const isDevelopmentFile = computed(() => {
  if (isFolder.value) return false
  const filePath = String(props.item?.path || '')
  const normalizedPath = filePath.replace(/\\/g, '/').toLowerCase()
  if (normalizedPath.includes('/source_code/')) return true
  const ext = getExt(String(props.item?.name || props.item?.path || ''))
  const devExts = new Set([
    'js', 'jsx', 'ts', 'tsx', 'vue',
    'java', 'kt', 'kts',
    'c', 'cpp', 'h', 'hpp',
    'cs', 'go', 'rs', 'py', 'php', 'rb', 'swift',
    'json', 'xml', 'yml', 'yaml', 'ini', 'cfg', 'conf',
    'md', 'txt', 'log', 'sql', 'sh', 'bat', 'ps1',
  ])
  return devExts.has(ext)
})

const containerStyle = computed(() => {
  return {
    aspectRatio: aspectRatio.value,
  } as any
})

const handleImageError = () => {
  if (props.lockAspectRatio) return
  aspectRatio.value = '4 / 3'
}

const handleImageLoad = (e: Event) => {
  if (props.lockAspectRatio) return
  const img = e.target as HTMLImageElement | null
  const w = Number(img?.naturalWidth || 0)
  const h = Number(img?.naturalHeight || 0)
  if (w > 0 && h > 0) {
    aspectRatio.value = `${w} / ${h}`
  }
}

const handleRetry = () => {
  emit('retry', props.item)
}

const getExt = (name: string) => {
  const idx = String(name || '').lastIndexOf('.')
  if (idx <= 0) return ''
  return String(name).slice(idx + 1).toLowerCase()
}

const formatSize = (size: number | null) => {
  if (size === null || size === undefined) return '-'
  if (size < 1024) return `${size} B`
  const kb = size / 1024
  if (kb < 1024) return `${kb.toFixed(1)} KB`
  const mb = kb / 1024
  if (mb < 1024) return `${mb.toFixed(1)} MB`
  const gb = mb / 1024
  return `${gb.toFixed(1)} GB`
}

const formatTime = (mtime: number | null) => {
  if (!mtime) return '-'
  const d = new Date(mtime)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
</script>

<style scoped>
.file-card-wrapper {
  /* Use fixed aspect ratio container for masonry flow */
  transform: translateZ(0); /* hardware acceleration */
}

.file-card-wrapper[draggable='true'] {
  cursor: pointer !important;
}
</style>
