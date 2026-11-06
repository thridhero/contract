<template>
  <Dialog
    :visible="visible"
    @update:visible="emit('update:visible', $event)"
    modal
    :header="isEdit ? '编辑树形字典项' : '新增树形字典项'"
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
        <label class="w-24 shrink-0 text-right mr-4 text-[var(--content-text)]">上级节点</label>
        <div class="flex-1">
          <TreeSelect 
            v-model="selectedParent" 
            :options="treeNodes" 
            selectionMode="single"
            placeholder="请选择上级节点 (为空则为顶级节点)" 
            class="w-full"
            showClear
          />
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
import Textarea from 'primevue/textarea'
import Select from 'primevue/select'
import TreeSelect from 'primevue/treeselect'
import Button from 'primevue/button'
import { useForm } from 'vee-validate'
import * as yup from 'yup'
import { useToast } from 'primevue/usetoast'
import { createRendererLogger } from '@/utils/logger'
import type { TreeDictionaryItem, TreeDictionaryCreateDTO, TreeDictionaryUpdateDTO } from '../../../../../shared/types/treeDictionary.types'

const logger = createRendererLogger('TreeDictionaryDialog')

const props = defineProps<{
  visible: boolean
  isEdit: boolean
  initialData: TreeDictionaryItem | null
  groupOptions: string[]
  treeNodes: any[]
}>()

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void
  (e: 'save'): void
}>()

const toast = useToast()
const saving = ref(false)
const selectedParent = ref<any>(null)

const schema = yup.object({
  name: yup.string().required('名称不能为空').trim(),
})

const { defineField, handleSubmit, resetForm, errors, setValues } = useForm({
  validationSchema: schema,
  initialValues: {
    name: '',
    parent_id: '',
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
const [parent_id] = defineField('parent_id')
const [code] = defineField('code')
const [abbreviation] = defineField('abbreviation')
const [bg_color] = defineField('bg_color')
const [sort_order] = defineField('sort_order')
const [value] = defineField('value')
const [remark] = defineField('remark')
const [group_name] = defineField('group_name')

const resolveGroupNameFromParent = async (pid: string) => {
  if (!pid) return ''
  try {
    const res = await window.electronAPI.treeDictionary.get(pid)
    if (res.success && res.data?.group_name) return String(res.data.group_name)
  } catch (error) {
    logger.error('Failed to resolve group_name from parent_id', error)
  }
  return ''
}

watch(selectedParent, (newVal) => {
  if (!newVal) {
    parent_id.value = ''
  } else if (typeof newVal === 'object') {
    parent_id.value = Object.keys(newVal)[0]
  } else {
    parent_id.value = String(newVal)
  }
})

watch(parent_id, async (pid) => {
  if (props.isEdit) return
  if (group_name.value) return
  const group = await resolveGroupNameFromParent(String(pid || ''))
  if (group) group_name.value = group
})

watch(() => props.visible, (newVal) => {
  if (newVal) {
    if (props.isEdit && props.initialData) {
      setValues({
        name: props.initialData.name,
        parent_id: props.initialData.parent_id || '',
        code: props.initialData.code || '',
        abbreviation: props.initialData.abbreviation || '',
        bg_color: props.initialData.bg_color || '',
        sort_order: props.initialData.sort_order || 0,
        value: props.initialData.value || '',
        remark: props.initialData.remark || '',
        group_name: props.initialData.group_name || ''
      })
      selectedParent.value = props.initialData.parent_id ? { [props.initialData.parent_id]: true } : null
    } else {
      resetForm()
      setValues({
        sort_order: 0,
        parent_id: props.initialData?.parent_id || '', // pre-fill parent_id if adding child
        group_name: props.initialData?.group_name || '',
      })
      selectedParent.value = props.initialData?.parent_id ? { [props.initialData.parent_id]: true } : null
    }
  }
})

const handleSave = handleSubmit(async (values) => {
  saving.value = true
  try {
    if (props.isEdit && props.initialData) {
      const dto: TreeDictionaryUpdateDTO = {
        id: props.initialData.id,
        ...values,
        parent_id: values.parent_id || undefined,
        sort_order: values.sort_order ?? 0
      }
      const res = await window.electronAPI.treeDictionary.update(dto)
      if (res.success) {
        toast.add({ severity: 'success', summary: '成功', detail: '修改成功', life: 3000 })
        emit('save')
        emit('update:visible', false)
      } else {
        toast.add({ severity: 'error', summary: '失败', detail: res.error || '修改失败', life: 3000 })
      }
    } else {
      const dto: TreeDictionaryCreateDTO = {
        ...values,
        parent_id: values.parent_id || undefined,
        sort_order: values.sort_order ?? 0
      }
      const res = await window.electronAPI.treeDictionary.create(dto)
      if (res.success) {
        toast.add({ severity: 'success', summary: '成功', detail: '新增成功', life: 3000 })
        emit('save')
        emit('update:visible', false)
      } else {
        toast.add({ severity: 'error', summary: '失败', detail: res.error || '新增失败', life: 3000 })
      }
    }
  } catch (error) {
    logger.error('Save tree dictionary failed', error)
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
  if (typeof target.closest === 'function' && target.closest('.p-treeselect')) return
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
.custom-dialog .p-select,
.custom-dialog .p-treeselect {
  background: var(--input-bg) !important;
  border-color: var(--input-border) !important;
  color: var(--input-text) !important;
}
.custom-dialog .p-inputtext::placeholder,
.custom-dialog .p-textarea::placeholder,
.custom-dialog .p-treeselect-label-empty {
  color: var(--input-placeholder) !important;
}
</style>
