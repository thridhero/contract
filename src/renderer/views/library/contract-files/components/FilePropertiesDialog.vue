<template>
  <Dialog
    :visible="visible"
    modal
    :closable="true"
    :draggable="true"
    :style="{ width: '520px' }"
    header="属性"
    class="custom-dialog"
    @update:visible="(v) => emit('update:visible', v)"
    @hide="handleHide"
  >
    <div class="py-2">
      <div v-if="loading" class="flex items-center justify-center py-8">
        <ProgressSpinner style="width: 28px; height: 28px" strokeWidth="3" />
      </div>

      <div v-else class="flex flex-col gap-3">
        <div v-if="error" class="text-sm text-red-500">{{ error }}</div>

        <table class="w-full text-sm border-separate border-spacing-0">
          <tbody>
            <tr class="even:bg-[var(--sidebar-hover-bg)]/50">
              <td class="px-3 py-2 text-[var(--content-text-secondary)] text-left align-top">名称</td>
              <td class="px-3 py-2 text-[var(--content-text)] break-all">{{ record?.name || '-' }}</td>
            </tr>
            <tr class="even:bg-[var(--sidebar-hover-bg)]/50">
              <td class="px-3 py-2 text-[var(--content-text-secondary)] text-left align-top">格式</td>
              <td class="px-3 py-2 text-[var(--content-text)]">{{ formatText }}</td>
            </tr>
            <tr class="even:bg-[var(--sidebar-hover-bg)]/50">
              <td class="px-3 py-2 text-[var(--content-text-secondary)] text-left align-top">大小</td>
              <td class="px-3 py-2 text-[var(--content-text)]">{{ sizeText }}</td>
            </tr>
            <tr class="even:bg-[var(--sidebar-hover-bg)]/50">
              <td class="px-3 py-2 text-[var(--content-text-secondary)] text-left align-top">添加日期</td>
              <td class="px-3 py-2 text-[var(--content-text)]">{{ createdAtText }}</td>
            </tr>
            <tr class="even:bg-[var(--sidebar-hover-bg)]/50">
              <td class="px-3 py-2 text-[var(--content-text-secondary)] text-left align-top">修改日期</td>
              <td class="px-3 py-2 text-[var(--content-text)]">{{ lastModifiedText }}</td>
            </tr>
            <tr v-if="imageSizeText !== '-'" class="even:bg-[var(--sidebar-hover-bg)]/50">
              <td class="px-3 py-2 text-[var(--content-text-secondary)] text-left align-top">图片尺寸</td>
              <td class="px-3 py-2 text-[var(--content-text)]">{{ imageSizeText }}</td>
            </tr>
            <tr class="even:bg-[var(--sidebar-hover-bg)]/50">
              <td class="px-3 py-2 text-[var(--content-text-secondary)] text-left align-top">路径</td>
              <td class="px-3 py-2 text-[var(--content-text)] min-w-0">
                <div class="flex items-start gap-2">
                  <div class="flex-1 break-all">{{ record?.path || '-' }}</div>
                  <Button
                    label="复制"
                    icon="pi pi-copy"
                    size="small"
                    class="p-button-text p-button-sm shrink-0"
                    :disabled="!record?.path"
                    @click="copyPath"
                  />
                </div>
                <div class="text-xs text-[var(--content-text-secondary)] min-h-[16px] mt-1">{{ copyHint }}</div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <template #footer>
      <div class="flex justify-end gap-2 mt-4">
        <Button
          label="复制文件"
          icon="pi pi-copy"
          class="p-button-sm"
          :disabled="!record?.path || record?.type !== 'file'"
          @click="copyFileToClipboard"
        />
        <Button
          label="打开"
          icon="pi pi-external-link"
          class="p-button-sm"
          :disabled="!record?.path"
          @click="openInSystem"
        />
        <Button label="关闭" icon="pi pi-times" class="p-button-text p-button-sm" @click="emit('update:visible', false)" />
      </div>
    </template>
  </Dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import ProgressSpinner from 'primevue/progressspinner'
import { useToast } from 'primevue/usetoast'
import type { ContractFileRecord } from '../../../../../shared/types/contractFile.types'
import type { FileInfo } from '../../../../types/electron-api'
import { copyTextToClipboard, formatSize, formatTime, getExt } from '../contractFilesHelpers'

const props = defineProps<{
  visible: boolean
  record: ContractFileRecord | null
}>()

const emit = defineEmits<{
  (e: 'update:visible', v: boolean): void
}>()

const loading = ref(false)
const error = ref('')
const info = ref<FileInfo | null>(null)
const copyHint = ref('')
const toast = useToast()

const reset = () => {
  loading.value = false
  error.value = ''
  info.value = null
  copyHint.value = ''
}

const load = async () => {
  const r = props.record
  if (!r?.path) {
    info.value = null
    error.value = ''
    return
  }
  loading.value = true
  error.value = ''
  info.value = null
  try {
    const res = await (window as any).electronAPI.fs.getFileInfo(r.path)
    const normalized = res && typeof res === 'object' && 'success' in res ? res : { success: true, data: res }
    if (!normalized.success) {
      throw new Error(normalized.error || '读取文件信息失败')
    }
    info.value = (normalized.data || null) as FileInfo | null
  } catch (e: any) {
    error.value = String(e?.message || '读取文件信息失败')
  } finally {
    loading.value = false
  }
}

watch(
  () => props.visible,
  (v) => {
    if (!v) {
      reset()
      return
    }
    void load()
  }
)

watch(
  () => String(props.record?.path || ''),
  () => {
    if (!props.visible) return
    void load()
  }
)

const formatText = computed(() => {
  const r = props.record
  if (!r) return '-'
  if (r.type === 'folder') return '文件夹'
  const ext = getExt(r.name)
  return ext || '文件'
})

const sizeText = computed(() => {
  const r = props.record
  if (!r) return '-'
  if (r.type === 'folder') return '-'
  const v = typeof info.value?.size === 'number' ? info.value?.size : (typeof r.size === 'number' ? r.size : null)
  return formatSize(v ?? null)
})

const createdAtText = computed(() => {
  const v = typeof info.value?.createdAt === 'number' ? info.value.createdAt : null
  return formatTime(v)
})

const lastModifiedText = computed(() => {
  const v = typeof info.value?.lastModified === 'number' ? info.value.lastModified : null
  return formatTime(v)
})

const imageSizeText = computed(() => {
  const w = typeof info.value?.imageWidth === 'number' ? info.value.imageWidth : 0
  const h = typeof info.value?.imageHeight === 'number' ? info.value.imageHeight : 0
  if (w > 0 && h > 0) return `${w} × ${h}`
  return '-'
})

const copyPath = async () => {
  const p = String(props.record?.path || '')
  if (!p) return
  const ok = await copyTextToClipboard(p)
  copyHint.value = ok ? '已复制' : '复制失败'
  window.setTimeout(() => {
    if (copyHint.value) copyHint.value = ''
  }, 1500)
}

const openInSystem = async () => {
  const r = props.record
  const p = String(r?.path || '').trim()
  if (!p) return
  const res = r?.type === 'folder' ? await window.electronAPI.fs.openFolder(p) : await window.electronAPI.fs.openFile(p)
  if (!res.success) {
    toast.add({ severity: 'error', summary: '打开失败', detail: res.error || '打开文件失败', life: 3000 })
  }
}

const copyFileToClipboard = async () => {
  const r = props.record
  const p = String(r?.path || '').trim()
  if (!p || r?.type !== 'file') return
  const res = await window.electronAPI.fs.clipboardWriteFile(p)
  if (res.success) {
    toast.add({ severity: 'success', summary: '已复制', detail: '文件已复制到剪贴板，可直接粘贴到微信或资源管理器', life: 2000 })
  } else {
    toast.add({ severity: 'error', summary: '复制失败', detail: res.error || '复制文件失败', life: 3000 })
  }
}

const handleHide = () => {
  emit('update:visible', false)
}
</script>

