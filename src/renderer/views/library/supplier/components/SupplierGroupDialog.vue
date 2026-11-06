<template>
  <Dialog
    :visible="visible"
    @update:visible="handleUpdateVisible"
    modal
    :header="mode === 'edit' ? '编辑分组' : '新建分组'"
    :style="{ width: '400px' }"
    :closable="true"
    class="custom-dialog"
  >
    <div class="flex flex-col py-2 px-1">
      <div class="flex items-start">
        <label class="w-28 shrink-0 whitespace-nowrap text-right mr-3 mt-2 text-[var(--content-text)]"><span class="text-red-500">*</span> 分组名称</label>
        <div class="flex-1 flex flex-col">
          <InputText v-model="groupName" :class="{ 'p-invalid': errors.groupName }" autofocus @keyup.enter="handleSave" />
          <small class="text-red-500 mt-1 text-xs min-h-[16px]">{{ errors.groupName }}</small>
        </div>
      </div>
    </div>

    <template #footer>
      <div class="flex justify-end gap-2 mt-4">
        <Button label="取消" icon="pi pi-times" @click="handleCancel" class="p-button-text p-button-sm" />
        <Button label="确定" icon="pi pi-check" @click="handleSave" class="p-button-primary p-button-sm" />
      </div>
    </template>
  </Dialog>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import Button from 'primevue/button'
import { useForm } from 'vee-validate'
import * as yup from 'yup'

const visible = ref(false)
const mode = ref<'add' | 'edit'>('add')
const existingNamesList = ref<string[]>([])
const initialName = ref('')

let resolvePromise: ((value: string | null) => void) | null = null

// Form schema
const schema = yup.object({
  groupName: yup
    .string()
    .required('分组名称不能为空')
    .trim()
    .test('unique', '分组名称已存在', (value) => {
      if (!value) return true
      const trimmedValue = value.trim()
      // If editing and the name hasn't changed, it's valid
      if (mode.value === 'edit' && trimmedValue === initialName.value) {
        return true
      }
      return !existingNamesList.value.includes(trimmedValue)
    })
})

const { defineField, handleSubmit, resetForm, errors } = useForm({
  validationSchema: schema,
  initialValues: {
    groupName: ''
  }
})

const [groupName] = defineField('groupName')

// Expose open method
const open = (
  modeParam: 'add' | 'edit',
  currentName: string = '',
  existingNames: string[] = []
): Promise<string | null> => {
  mode.value = modeParam
  initialName.value = currentName
  existingNamesList.value = existingNames
  
  resetForm({
    values: {
      groupName: currentName
    }
  })
  
  visible.value = true
  
  return new Promise((resolve) => {
    resolvePromise = resolve
  })
}

const closeDialog = (result: string | null) => {
  visible.value = false
  if (resolvePromise) {
    resolvePromise(result)
    resolvePromise = null
  }
}

const handleUpdateVisible = (v: boolean) => {
  if (!v) {
    closeDialog(null)
  }
}

const handleCancel = () => {
  closeDialog(null)
}

const handleSave = handleSubmit((values) => {
  closeDialog(values.groupName.trim())
})

defineExpose({
  open
})
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
.custom-dialog .p-inputtext {
  background: var(--input-bg) !important;
  border-color: var(--input-border) !important;
  color: var(--input-text) !important;
}
.custom-dialog .p-inputtext::placeholder {
  color: var(--input-placeholder) !important;
}
</style>
