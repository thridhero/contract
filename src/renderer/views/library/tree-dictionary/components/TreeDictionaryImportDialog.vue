<template>
  <Dialog
    :visible="visible"
    @update:visible="emit('update:visible', $event)"
    modal
    header="导入树形字典"
    :style="{ width: '450px' }"
    :closable="!importing"
    class="custom-dialog"
  >
    <div v-if="!importing" class="flex flex-col gap-4 py-4">
      <div class="flex items-center">
        <label class="w-24 shrink-0 text-right mr-4 text-[var(--content-text)]"><span class="text-red-500">*</span> 目标分组</label>
        <div class="flex-1">
          <Select 
            v-model="selectedGroup" 
            :options="groupOptions" 
            placeholder="请选择目标分组" 
            class="w-full" 
          />
        </div>
      </div>

      <div class="flex items-center">
        <label class="w-24 shrink-0 text-right mr-4 text-[var(--content-text)]"><span class="text-red-500">*</span> CSV 文件</label>
        <div class="flex-1 flex gap-2">
          <InputText :value="selectedFilePath" readonly placeholder="请选择 CSV 文件" class="flex-1" />
          <Button icon="pi pi-folder-open" @click="handleSelectFile" />
        </div>
      </div>
    </div>

    <div v-else class="flex flex-col items-center justify-center gap-4 py-8">
      <ProgressSpinner style="width: 42px; height: 42px" strokeWidth="3" />
      <div class="text-center">
        <div class="font-bold text-[var(--content-text)]">{{ importProgressText }}</div>
        <div class="text-sm text-[var(--content-text-secondary)]" v-if="importProgress.total > 0">
          {{ importProgress.current }} / {{ importProgress.total }}（{{ importProgress.percent }}%）
        </div>
      </div>
    </div>

    <template #footer v-if="!importing">
      <div class="flex justify-end gap-2 mt-4">
        <Button label="取消" icon="pi pi-times" @click="emit('update:visible', false)" class="p-button-text p-button-sm" />
        <Button label="开始导入" icon="pi pi-upload" @click="handleImport" :disabled="!canImport" class="p-button-primary p-button-sm" />
      </div>
    </template>
  </Dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import Dialog from 'primevue/dialog'
import Select from 'primevue/select'
import InputText from 'primevue/inputtext'
import Button from 'primevue/button'
import ProgressSpinner from 'primevue/progressspinner'
import { useToast } from 'primevue/usetoast'
import { createRendererLogger } from '@/utils/logger'

const logger = createRendererLogger('TreeDictionaryImportDialog')

const props = defineProps<{
  visible: boolean
  groupOptions: string[]
  defaultGroup?: string
}>()

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void
  (e: 'success'): void
}>()

const toast = useToast()

const selectedGroup = ref<string>('')
const selectedFilePath = ref<string>('')
const importing = ref(false)
const importProgress = ref({ status: 'idle', current: 0, total: 0, percent: 0 })

let unlistenImportProgress: null | (() => void) = null

onMounted(() => {
  if (window.electronAPI?.treeDictionary?.onImportProgress) {
    unlistenImportProgress = window.electronAPI.treeDictionary.onImportProgress((payload) => {
      importProgress.value = payload
    })
  }
})

onUnmounted(() => {
  unlistenImportProgress?.()
  unlistenImportProgress = null
})

watch(() => props.visible, (newVal) => {
  if (newVal) {
    selectedGroup.value = props.defaultGroup && props.defaultGroup !== '所有分组' ? props.defaultGroup : ''
    selectedFilePath.value = ''
    importing.value = false
    importProgress.value = { status: 'idle', current: 0, total: 0, percent: 0 }
  }
})

const canImport = computed(() => {
  return selectedGroup.value && selectedFilePath.value
})

const importProgressText = computed(() => {
  if (importProgress.value.status === 'reading') return '正在读取文件...'
  if (importProgress.value.status === 'importing') return '正在导入数据...'
  if (importProgress.value.status === 'completed') return '导入完成'
  return '正在导入...'
})

const handleSelectFile = async () => {
  try {
    const result = await window.electronAPI.fs.selectFile({
      title: '选择树形字典 CSV 文件',
      filters: [{ name: 'CSV Files', extensions: ['csv'] }]
    })
    
    if (result.success && !result.data.canceled && result.data.filePaths.length > 0) {
      selectedFilePath.value = result.data.filePaths[0]
    }
  } catch (error) {
    logger.error('Select file failed', error)
  }
}

const handleImport = async () => {
  if (!canImport.value) return

  importing.value = true
  importProgress.value = { status: 'reading', current: 0, total: 0, percent: 0 }
  
  try {
    const importRes = await window.electronAPI.treeDictionary.importCsv(selectedFilePath.value, selectedGroup.value)
    if (importRes.success) {
      toast.add({ severity: 'success', summary: '导入成功', detail: `成功导入 ${importRes.data.importedCount} 条记录到 "${selectedGroup.value}" 分组`, life: 3000 })
      emit('success')
      emit('update:visible', false)
    } else {
      toast.add({ severity: 'error', summary: '导入失败', detail: importRes.error || '未知错误', life: 3000 })
    }
  } catch (error: any) {
    logger.error('Import failed', error)
    toast.add({ severity: 'error', summary: '导入异常', detail: error.message || '出现异常', life: 3000 })
  } finally {
    importing.value = false
  }
}
</script>

<style>
.custom-dialog .p-dialog-header,
.custom-dialog .p-dialog-content,
.custom-dialog .p-dialog-footer {
  background: var(--content-bg) !important;
  color: var(--content-text) !important;
  border-color: var(--content-border) !important;
}
.custom-dialog .p-dialog {
  border: 1px solid var(--content-border) !important;
}
.custom-dialog .p-inputtext,
.custom-dialog .p-select {
  background: var(--input-bg) !important;
  border-color: var(--input-border) !important;
  color: var(--input-text) !important;
}
.custom-dialog .p-inputtext::placeholder {
  color: var(--input-placeholder) !important;
}
</style>
