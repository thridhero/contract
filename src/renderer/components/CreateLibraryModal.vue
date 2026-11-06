<template>
  <Dialog
    v-model:visible="visible"
    modal
    header="创建资源库"
    :style="{ width: '480px' }"
    :closable="true"
    :draggable="false"
    class="theme-dialog"
  >
    <div class="flex flex-col gap-4 pt-2">
      <!-- 资源库名称 -->
      <div class="flex flex-col gap-1">
        <label class="text-sm font-medium" :style="{ color: 'var(--content-text)' }">
          资源库名称 <span class="text-red-500">*</span>
        </label>
        <InputText
          v-model="form.name"
          placeholder="请输入资源库名称"
          class="w-full"
          :invalid="!!errors.name"
        />
        <small v-if="errors.name" class="text-red-500">{{ errors.name }}</small>
      </div>
    </div>

    <template #footer>
      <Button label="取消" severity="secondary" @click="handleCancel" />
      <Button
        label="选择保存路径"
        :loading="creating"
        :disabled="!form.name.trim()"
        @click="handleChooseAndCreate"
      />
    </template>
  </Dialog>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'

// ─── PrimeVue 组件 ──────────────────────────────────────────────
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import Button from 'primevue/button'
import { useToast } from 'primevue/usetoast'
import { createRendererLogger } from '@/utils/logger'

const logger = createRendererLogger('CreateLibraryModal')

// ─── Store ──────────────────────────────────────────────────────
import { useLibraryStore } from '../stores/library/libraryStore'

/**
 * CreateLibraryModal 组件
 * 创建资源库对话框
 */

// ─── Props & Emits ──────────────────────────────────────────────
const visible = defineModel<boolean>('visible', { default: false })

const emit = defineEmits<{
  (e: 'created', library: { id: string; name: string; path: string }): void
  (e: 'cancel'): void
}>()

// ─── Store & Toast ──────────────────────────────────────────────
const libraryStore = useLibraryStore()
const toast = useToast()

// ─── 响应式状态 ─────────────────────────────────────────────────
/** 创建中状态 */
const creating = ref(false)

/** 表单数据 */
const form = reactive({
  name: ''
})

/** 表单错误 */
const errors = reactive<Record<string, string>>({})

// ─── 方法 ───────────────────────────────────────────────────────
/**
 * 选择文件夹并创建资源库
 */
const handleChooseAndCreate = async () => {
  // 基础校验（仅名称）
  Object.keys(errors).forEach(key => delete errors[key])
  if (!form.name.trim()) {
    errors.name = '请输入资源库名称'
    return
  }

  try {
    const result = await window.electronAPI.bootstrap.selectFolder()
    if (result.success && result.data && !result.data.canceled && result.data.filePaths.length > 0) {
      const selectedPath = result.data.filePaths[0]
      creating.value = true
      const library = await libraryStore.createLibrary({
        name: form.name.trim(),
        path: selectedPath.trim()
      })
      if (library) {
        toast.add({
          severity: 'success',
          summary: '创建成功',
          detail: `资源库 "${library.name}" 创建成功`,
          life: 3000
        })
        form.name = ''
        visible.value = false
        emit('created', library)
      } else {
        toast.add({
          severity: 'error',
          summary: '创建失败',
          detail: '创建资源库失败，请重试',
          life: 5000
        })
      }
    } else {
      // 未选择路径则视为取消
      handleCancel()
    }
  } catch (error) {
    logger.error('选择文件夹失败:', error)
    toast.add({
      severity: 'error',
      summary: '创建失败',
      detail: '无法选择保存路径',
      life: 3000
    })
  } finally {
    creating.value = false
  }
}

/**
 * 取消创建
 */
const handleCancel = () => {
  // 重置表单
  form.name = ''
  Object.keys(errors).forEach(key => delete errors[key])
  
  // 关闭对话框
  visible.value = false
  
  // 通知父组件
  emit('cancel')
}
</script>
