<template>
  <Dialog
    :visible="visible"
    modal
    :closable="true"
    :draggable="false"
    :style="{ width: '420px' }"
    header="新增文件夹"
    class="custom-dialog"
    @update:visible="(v) => emit('update:visible', v)"
    @hide="handleHide"
  >
    <div class="flex flex-col gap-4 py-2">
      <div class="flex items-start">
        <label class="w-20 shrink-0 whitespace-nowrap text-right mr-3 mt-2 text-[var(--content-text)]"><span class="text-red-500">*</span> 名称</label>
        <div class="flex-1 flex flex-col">
          <InputText ref="inputEl" v-model="name" class="w-full" placeholder="请输入文件夹名称" @input="emit('clear-submit-error')" @keydown.enter.prevent="handleConfirm" />
          <small class="text-red-500 mt-1 text-xs min-h-[16px]">{{ error || submitError }}</small>
        </div>
      </div>
    </div>

    <template #footer>
      <div class="flex justify-end gap-2 mt-4">
        <Button label="取消" icon="pi pi-times" class="p-button-text p-button-sm" :disabled="submitting" @click="emit('update:visible', false)" />
        <Button label="确定" icon="pi pi-check" class="p-button-primary p-button-sm" :loading="submitting" @click="handleConfirm" />
      </div>
    </template>
  </Dialog>
</template>

<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'

const props = defineProps<{
  visible: boolean
  parentPath: string
  contractNo?: string
  submitting: boolean
  submitError: string
}>()

const emit = defineEmits<{
  (e: 'update:visible', v: boolean): void
  (e: 'confirm', folderName: string): void
  (e: 'clear-submit-error'): void
}>()

const name = ref('')
const error = ref('')
const inputEl = ref()

const validate = (folderName: string) => {
  const v = String(folderName || '').trim()
  if (!v) return '请输入文件夹名称'
  if (/[\\/]/.test(v) || v === '.' || v === '..') return '名称不合法：不能包含路径分隔符'
  return ''
}

const reset = () => {
  name.value = ''
  error.value = ''
}

const focusInput = async () => {
  await nextTick()
  const el = (inputEl.value as any)?.$el as HTMLElement | undefined
  const input = (el?.querySelector?.('input') as HTMLInputElement | null) || (el as any as HTMLInputElement | null)
  input?.focus?.()
}

watch(
  () => props.visible,
  async (v) => {
    if (!v) {
      reset()
      return
    }
    name.value = ''
    error.value = ''
    await focusInput()
  }
)

watch(name, () => {
  if (error.value) error.value = ''
})

const handleHide = () => {
  emit('update:visible', false)
}

const handleConfirm = () => {
  if (props.submitting) return
  const parentPath = String(props.parentPath || '').trim()
  if (!parentPath) return
  const folderName = String(name.value || '').trim()
  const err = validate(folderName)
  if (err) {
    error.value = err
    return
  }
  emit('confirm', folderName)
}
</script>
