<template>
  <Dialog
    :visible="visible"
    @update:visible="emit('update:visible', $event)"
    modal
    :header="isEdit ? '编辑字典项' : '新增字典项'"
    :style="{ width: '500px' }"
    :closable="true"
    class="custom-dialog"
  >
    <div class="flex flex-col gap-4 py-4" @keydown.enter="onEnterKey">
      <div class="flex items-start">
        <label class="w-24 shrink-0 text-right mr-4 mt-2 text-[var(--content-text)]"><span class="text-red-500">*</span> 名称</label>
        <div class="flex-1 flex flex-col">
          <InputText v-model="name" :class="{ 'p-invalid': errors.name }" placeholder="请输入名称" />
          <small class="text-red-500 mt-1 min-h-[16px]">{{ errors.name }}</small>
        </div>
      </div>

      <div class="flex items-center">
        <label class="w-24 shrink-0 text-right mr-4 text-[var(--content-text)]">编码</label>
        <div class="flex-1">
          <InputText v-model="code" class="w-full" placeholder="请输入编码" />
        </div>
      </div>

      <div class="flex items-center">
        <label class="w-24 shrink-0 text-right mr-4 text-[var(--content-text)]">简称</label>
        <div class="flex-1">
          <InputText v-model="abbreviation" class="w-full" placeholder="请输入简称" />
        </div>
      </div>

      <div class="flex items-center">
        <label class="w-24 shrink-0 text-right mr-4 text-[var(--content-text)]">背景色</label>
        <div class="flex-1 flex items-center gap-2">
          <InputText v-model="bg_color" class="flex-1" placeholder="如 #FF0000 或 red" />
          <input type="color" v-model="bg_color" class="w-8 h-8 p-0 border-0 cursor-pointer rounded overflow-hidden" />
        </div>
      </div>

      <div class="flex items-center">
        <label class="w-24 shrink-0 text-right mr-4 text-[var(--content-text)]">排序</label>
        <div class="flex-1">
          <InputNumber v-model="sort_order" class="w-full" :min="0" placeholder="数字越小越靠前" />
        </div>
      </div>

      <div class="flex items-center">
        <label class="w-24 shrink-0 text-right mr-4 text-[var(--content-text)]">对应值</label>
        <div class="flex-1">
          <InputText v-model="value" class="w-full" placeholder="请输入对应值" />
        </div>
      </div>

      <div class="flex items-start">
        <label class="w-24 shrink-0 text-right mr-4 mt-2 text-[var(--content-text)]">备注</label>
        <div class="flex-1">
          <Textarea v-model="remark" rows="3" class="w-full" placeholder="请输入备注信息" />
        </div>
      </div>

      <div class="flex items-center">
        <label class="w-24 shrink-0 text-right mr-4 text-[var(--content-text)]">所属分组</label>
        <div class="flex-1">
          <Select 
            v-model="group_name" 
            :options="groupOptions" 
            placeholder="选择分组" 
            class="w-full" 
            showClear
          />
        </div>
      </div>
    </div>

    <template #footer>
      <div class="flex justify-end gap-2 mt-4">
        <Button label="取消" icon="pi pi-times" @click="emit('update:visible', false)" class="p-button-text p-button-sm" />
        <Button label="保存" icon="pi pi-check" @click="handleSave" :loading="saving" class="p-button-primary p-button-sm" />
      </div>
    </template>
  </Dialog>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import InputNumber from 'primevue/inputnumber'
import Textarea from 'primevue/textarea'
import Select from 'primevue/select'
import Button from 'primevue/button'
import { useForm } from 'vee-validate'
import * as yup from 'yup'
import { useToast } from 'primevue/usetoast'
import { createRendererLogger } from '@/utils/logger'
import type { DictionaryItem, DictionaryCreateDTO, DictionaryUpdateDTO } from '../../../../../shared/types/dictionary.types'

const logger = createRendererLogger('DictionaryDialog')

const props = defineProps<{
  visible: boolean
  isEdit: boolean
  initialData: DictionaryItem | null
  groupOptions: string[]
  defaultGroup?: string
}>()

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void
  (e: 'save'): void
}>()

const toast = useToast()
const saving = ref(false)

const schema = yup.object({
  name: yup.string().required('名称不能为空').trim(),
})

const { defineField, handleSubmit, resetForm, errors, setValues } = useForm({
  validationSchema: schema,
  initialValues: {
    name: '',
    code: '',
    abbreviation: '',
    bg_color: '',
    sort_order: 0,
    value: '',
    remark: '',
    group_name: ''
  }
})

const [name] = defineField('name')
const [code] = defineField('code')
const [abbreviation] = defineField('abbreviation')
const [bg_color] = defineField('bg_color')
const [sort_order] = defineField('sort_order')
const [value] = defineField('value')
const [remark] = defineField('remark')
const [group_name] = defineField('group_name')

watch(() => props.visible, (newVal) => {
  if (newVal) {
    if (props.isEdit && props.initialData) {
      setValues({
        name: props.initialData.name,
        code: props.initialData.code || '',
        abbreviation: props.initialData.abbreviation || '',
        bg_color: props.initialData.bg_color || '',
        sort_order: props.initialData.sort_order || 0,
        value: props.initialData.value || '',
        remark: props.initialData.remark || '',
        group_name: props.initialData.group_name || ''
      })
    } else {
      resetForm()
      const defaultGroup = String(props.defaultGroup || '').trim()
      setValues({
        sort_order: 0,
        group_name: defaultGroup && defaultGroup !== '所有分组' && props.groupOptions.includes(defaultGroup) ? defaultGroup : ''
      })
    }
  }
})

const handleSave = handleSubmit(async (values) => {
  saving.value = true
  try {
    if (props.isEdit && props.initialData) {
      const dto: DictionaryUpdateDTO = {
        id: props.initialData.id,
        ...values,
        sort_order: values.sort_order ?? 0
      }
      const res = await window.electronAPI.dictionary.update(dto)
      if (res.success) {
        toast.add({ severity: 'success', summary: '成功', detail: '修改成功', life: 3000 })
        emit('save')
        emit('update:visible', false)
      } else {
        toast.add({ severity: 'error', summary: '失败', detail: res.error || '修改失败', life: 3000 })
      }
    } else {
      const dto: DictionaryCreateDTO = {
        ...values,
        sort_order: values.sort_order ?? 0
      }
      const res = await window.electronAPI.dictionary.create(dto)
      if (res.success) {
        toast.add({ severity: 'success', summary: '成功', detail: '新增成功', life: 3000 })
        emit('save')
        emit('update:visible', false)
      } else {
        toast.add({ severity: 'error', summary: '失败', detail: res.error || '新增失败', life: 3000 })
      }
    }
  } catch (error) {
    logger.error('Save dictionary failed', error)
    toast.add({ severity: 'error', summary: '失败', detail: '操作出现异常', life: 3000 })
  } finally {
    saving.value = false
  }
})

const onEnterKey = (event: KeyboardEvent) => {
  if (saving.value) return
  if (event.isComposing) return
  const target = event.target as HTMLElement | null
  if (!target) return
  if (target.tagName === 'TEXTAREA') return
  if (typeof target.closest === 'function' && target.closest('.p-select')) return
  event.preventDefault()
  void handleSave()
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
.custom-dialog .p-inputnumber-input,
.custom-dialog .p-textarea,
.custom-dialog .p-select {
  background: var(--input-bg) !important;
  border-color: var(--input-border) !important;
  color: var(--input-text) !important;
}
.custom-dialog .p-inputtext::placeholder,
.custom-dialog .p-textarea::placeholder {
  color: var(--input-placeholder) !important;
}
</style>
