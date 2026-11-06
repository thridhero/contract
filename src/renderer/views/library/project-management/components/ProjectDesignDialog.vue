<template>
  <Dialog
    v-model:visible="visible"
    modal
    header="设计"
    :style="{ width: '720px' }"
    :draggable="false"
    class="custom-dialog"
  >
    <div class="flex flex-col gap-5 py-2">
      <div>
        <div class="text-sm font-medium mb-3 text-[var(--content-text)]">列表字段</div>
        <div class="grid grid-cols-2 gap-3">
          <div
            v-for="field in listFields"
            :key="`list-${field.field}`"
            class="flex items-center gap-3 rounded-lg border p-3"
            :style="{ borderColor: 'var(--content-border)' }"
          >
            <Checkbox v-model="field.visible" binary />
            <span class="flex-1 text-sm text-[var(--content-text)]">{{ field.label }}</span>
            <InputNumber v-model="field.order" :min="1" input-class="w-16" />
          </div>
        </div>
      </div>

      <div>
        <div class="text-sm font-medium mb-3 text-[var(--content-text)]">表单字段</div>
        <div class="grid grid-cols-2 gap-3">
          <div
            v-for="field in formFields"
            :key="`form-${field.field}`"
            class="flex items-center gap-3 rounded-lg border p-3"
            :style="{ borderColor: 'var(--content-border)' }"
          >
            <Checkbox v-model="field.visible" binary />
            <span class="flex-1 text-sm text-[var(--content-text)]">{{ field.label }}</span>
            <InputNumber v-model="field.order" :min="1" input-class="w-16" />
          </div>
        </div>
      </div>

      <div class="flex items-center gap-3">
        <span class="text-sm text-[var(--content-text)]">表单布局</span>
        <Select
          v-model="formLayout"
          :options="layoutOptions"
          option-label="label"
          option-value="value"
          class="w-56"
        />
      </div>
    </div>

    <template #footer>
      <div class="flex justify-end gap-2">
        <Button label="取消" severity="secondary" @click="visible = false" />
        <Button label="保存" @click="handleSave" />
      </div>
    </template>
  </Dialog>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import Dialog from 'primevue/dialog'
import Checkbox from 'primevue/checkbox'
import Button from 'primevue/button'
import InputNumber from 'primevue/inputnumber'
import Select from 'primevue/select'
import type { ProjectManagementDesignConfig, ProjectManagementDesignField } from '../../../../../shared/types/projectManagement.types'

const visible = defineModel<boolean>('visible', { default: false })

const props = defineProps<{
  config: ProjectManagementDesignConfig
}>()

const emit = defineEmits<{
  (e: 'save', value: ProjectManagementDesignConfig): void
}>()

const listFields = ref<ProjectManagementDesignField[]>([])
const formFields = ref<ProjectManagementDesignField[]>([])
const formLayout = ref<ProjectManagementDesignConfig['formLayout']>('double-column')

const layoutOptions = [
  { label: '双列布局', value: 'double-column' },
  { label: '单列布局', value: 'single-column' },
]

const syncConfig = () => {
  listFields.value = props.config.listFields.map((field) => ({ ...field }))
  formFields.value = props.config.formFields.map((field) => ({ ...field }))
  formLayout.value = props.config.formLayout
}

watch(() => props.config, syncConfig, { immediate: true, deep: true })
watch(visible, (value) => {
  if (value) {
    syncConfig()
  }
})

const sortFields = (fields: ProjectManagementDesignField[]) => {
  return [...fields].sort((a, b) => a.order - b.order || a.label.localeCompare(b.label))
}

const handleSave = () => {
  emit('save', {
    listFields: sortFields(listFields.value),
    formFields: sortFields(formFields.value),
    formLayout: formLayout.value,
  })
  visible.value = false
}
</script>
