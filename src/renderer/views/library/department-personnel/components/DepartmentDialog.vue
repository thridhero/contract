<template>
  <Dialog
    :visible="visible"
    @update:visible="(v) => emit('update:visible', v)"
    modal
    :header="isEdit ? '编辑部门' : '新增部门'"
    :style="{ width: '680px' }"
  >
    <div class="grid grid-cols-2 gap-x-6 gap-y-2 py-2">
      <div class="flex items-start col-span-2">
        <label class="w-24 text-right mr-3 mt-2">上级部门</label>
        <div class="flex-1">
          <TreeSelect
            v-model="treeSelection"
            :options="departmentOptions"
            placeholder="请选择上级部门"
            class="w-full"
            :class="{ 'p-invalid': !!errors.parent_id }"
            selectionMode="single"
            showClear
          />
          <small class="text-red-500">{{ errors.parent_id }}</small>
        </div>
      </div>
      <div class="flex items-start">
        <label class="w-24 text-right mr-3 mt-2">编码</label>
        <div class="flex-1">
          <InputText v-model="code" class="w-full" :class="{ 'p-invalid': !!errors.code }" placeholder="不填则自动生成" />
          <small class="text-red-500">{{ errors.code }}</small>
        </div>
      </div>
      <div class="flex items-start">
        <label class="w-24 text-right mr-3 mt-2"><span class="text-red-500">*</span> 名称</label>
        <div class="flex-1">
          <InputText v-model="name" class="w-full" :class="{ 'p-invalid': !!errors.name }" />
          <small class="text-red-500">{{ errors.name }}</small>
        </div>
      </div>
      <div class="flex items-start">
        <label class="w-24 text-right mr-3 mt-2">负责人</label>
        <div class="flex-1">
          <InputText v-model="leader" class="w-full" :class="{ 'p-invalid': !!errors.leader }" />
          <small class="text-red-500">{{ errors.leader }}</small>
        </div>
      </div>
      <div class="flex items-start">
        <label class="w-24 text-right mr-3 mt-2">电话</label>
        <div class="flex-1">
          <InputText v-model="phone" class="w-full" :class="{ 'p-invalid': !!errors.phone }" />
          <small class="text-red-500">{{ errors.phone }}</small>
        </div>
      </div>
      <div class="flex items-start">
        <label class="w-24 text-right mr-3 mt-2">邮箱</label>
        <div class="flex-1">
          <InputText v-model="email" class="w-full" :class="{ 'p-invalid': !!errors.email }" />
          <small class="text-red-500">{{ errors.email }}</small>
        </div>
      </div>
      <div class="flex items-start">
        <label class="w-24 text-right mr-3 mt-2">排序号</label>
        <div class="flex-1">
          <InputNumber v-model="sort_order" class="w-full" :class="{ 'p-invalid': !!errors.sort_order }" :min="0" :useGrouping="false" />
          <small class="text-red-500">{{ errors.sort_order }}</small>
        </div>
      </div>
      <div class="flex items-start col-span-2">
        <label class="w-24 text-right mr-3 mt-2">备注</label>
        <div class="flex-1">
          <Textarea v-model="remark" class="w-full" :class="{ 'p-invalid': !!errors.remark }" rows="3" />
          <small class="text-red-500">{{ errors.remark }}</small>
        </div>
      </div>
    </div>

    <template #footer>
      <div class="flex justify-end gap-2">
        <Button label="取消" class="p-button-text" @click="emit('update:visible', false)" :disabled="saving" />
        <Button label="保存" class="p-button-primary" :loading="saving" @click="save" />
      </div>
    </template>
  </Dialog>
</template>

<script setup lang="ts">
import { watch, ref } from 'vue';
import Dialog from 'primevue/dialog';
import Button from 'primevue/button';
import InputText from 'primevue/inputtext';
import InputNumber from 'primevue/inputnumber';
import Textarea from 'primevue/textarea';
import TreeSelect from 'primevue/treeselect';
import { useToast } from 'primevue/usetoast';
import { useForm } from 'vee-validate';
import * as yup from 'yup';
import { IdGenerator } from '../../../../../shared/utils/idGenerator';
import type { Department, DepartmentCreateDTO, DepartmentUpdateDTO } from '../../../../../shared/types/department.types';

const props = defineProps<{
  visible: boolean;
  isEdit?: boolean;
  initialData?: Department | null;
  departmentOptions?: any[];
  defaultParentId?: string | null;
  companyRootKey?: string;
}>();

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void;
  (e: 'saved'): void;
}>();

const toast = useToast();
const saving = ref(false);

const schema = yup.object({
  parent_id: yup.string().nullable().optional(),
  code: yup.string().trim().optional(),
  name: yup.string().trim().required('请输入部门名称'),
  leader: yup.string().trim().optional(),
  phone: yup.string().trim().optional(),
  email: yup.string().trim().email('邮箱格式不正确').optional(),
  sort_order: yup.number().nullable().optional(),
  remark: yup.string().trim().optional(),
});

const { defineField, handleSubmit, resetForm, errors, validate, values: formValues } = useForm<DepartmentCreateDTO>({
  validationSchema: schema,
  initialValues: {
    parent_id: null,
    code: IdGenerator.generateCode('DEP'),
    name: '',
    leader: '',
    phone: '',
    email: '',
    sort_order: 0,
    remark: '',
  },
});

const [parent_id] = defineField('parent_id');
const [code] = defineField('code');
const [name] = defineField('name');
const [leader] = defineField('leader');
const [phone] = defineField('phone');
const [email] = defineField('email');
const [sort_order] = defineField('sort_order');
const [remark] = defineField('remark');

// 适配 TreeSelect 的选择映射对象
const treeSelection = ref<any>({});
let isSyncingParentSelection = false;

const companyRootKey = () => String(props.companyRootKey || '').trim();
const normalizeParentIdInput = (value?: string | null) => {
  const raw = String(value ?? '').trim();
  const rootKey = companyRootKey();
  if (!raw) return null;
  if (rootKey && raw === rootKey) return null;
  return raw;
};

// 将 parent_id 同步到 treeSelection
watch(parent_id, (newVal) => {
  if (isSyncingParentSelection) return;
  isSyncingParentSelection = true;
  try {
    const rootKey = companyRootKey();
    if (newVal && typeof newVal === 'string') {
      treeSelection.value = { [newVal]: true };
      return;
    }
    treeSelection.value = rootKey ? { [rootKey]: true } : {};
  } finally {
    isSyncingParentSelection = false;
  }
}, { immediate: true });

// 将 treeSelection 同步回 parent_id
watch(treeSelection, (newSelection) => {
  if (isSyncingParentSelection) return;
  isSyncingParentSelection = true;
  try {
    if (!newSelection) {
      parent_id.value = null;
      return;
    }
    const keys = Object.keys(newSelection).filter(key => newSelection[key] === true || newSelection[key]?.checked);
    const selectedKey = keys.length > 0 ? String(keys[0] || '').trim() : '';
    const rootKey = companyRootKey();
    parent_id.value = selectedKey && rootKey && selectedKey === rootKey ? null : (selectedKey || null);
  } finally {
    isSyncingParentSelection = false;
  }
});

watch(() => props.visible, (visible) => {
  if (!visible) return;
  if (props.isEdit && props.initialData) {
    resetForm({
      values: {
        parent_id: normalizeParentIdInput(props.initialData.parent_id || null),
        code: props.initialData.code || '',
        name: props.initialData.name || '',
        leader: props.initialData.leader || '',
        phone: props.initialData.phone || '',
        email: props.initialData.email || '',
        sort_order: Number(props.initialData.sort_order || 0),
        remark: props.initialData.remark || '',
      },
    });
    return;
  }
  resetForm({
    values: {
      parent_id: normalizeParentIdInput(props.defaultParentId || null),
      code: IdGenerator.generateCode('DEP'),
      name: '',
      leader: '',
      phone: '',
      email: '',
      sort_order: 0,
      remark: '',
    },
  });
});

const save = async () => {
  console.log('[DepartmentDialog] Save button clicked');
  try {
    const validation = await validate();
    console.log('[DepartmentDialog] Validation result:', validation);
    
    if (!validation.valid) {
      console.warn('[DepartmentDialog] Validation failed:', validation.errors);
      const firstError = Object.values(validation.errors)[0];
      toast.add({ severity: 'warn', summary: '校验未通过', detail: firstError, life: 3000 });
      return;
    }

    saving.value = true;
    const values = formValues;
    console.log('[DepartmentDialog] Form values:', values);

    const payload: DepartmentCreateDTO = {
      parent_id: values.parent_id || null,
      code: String(values.code || '').trim() || IdGenerator.generateCode('DEP'),
      name: String(values.name || '').trim(),
      leader: String(values.leader || '').trim(),
      phone: String(values.phone || '').trim(),
      email: String(values.email || '').trim(),
      sort_order: Number(values.sort_order || 0),
      remark: String(values.remark || '').trim(),
    };
    
    console.log('[DepartmentDialog] IPC Payload:', payload);
    
    const result = props.isEdit && props.initialData
      ? await window.electronAPI.department.update({ id: props.initialData.id, ...(payload as DepartmentUpdateDTO) })
      : await window.electronAPI.department.create(payload);
      
    console.log('[DepartmentDialog] IPC Result:', result);
    
    if (!result.success) {
      console.error('[DepartmentDialog] IPC Error:', result.error);
      toast.add({ severity: 'error', summary: '保存失败', detail: result.error || '未知错误', life: 5000 });
      return;
    }

    toast.add({ severity: 'success', summary: '成功', detail: props.isEdit ? '修改成功' : '新增成功', life: 2500 });
    emit('saved');
    emit('update:visible', false);
  } catch (error: any) {
    console.error('[DepartmentDialog] Exception during save:', error);
    toast.add({ severity: 'error', summary: '保存异常', detail: error.message || '未知错误', life: 5000 });
  } finally {
    saving.value = false;
  }
};
</script>
