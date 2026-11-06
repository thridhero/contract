<template>
  <Dialog
    :visible="visible"
    @update:visible="(v) => emit('update:visible', v)"
    modal
    header="合同产品"
    :style="{ width: '760px' }"
    :closable="true"
    class="custom-dialog"
  >
    <div class="relative min-h-[320px]">
      <div class="flex flex-col py-2 px-1">
        <div class="grid grid-cols-2 gap-x-6 gap-y-2">
          <div class="flex items-start col-span-2">
            <label class="w-24 text-right mr-3 mt-2 text-[var(--content-text)]"><span class="text-red-500">*</span> 合同</label>
            <div class="flex-1 flex flex-col">
              <Dropdown
                v-model="contractSelection"
                :options="contractOptions"
                optionLabel="label"
                optionValue="id"
                placeholder="选择合同编号/名称"
                class="w-full"
                :class="{ 'p-invalid': hasTriedSave && errors.contract_id }"
              />
              <small class="text-red-500 mt-1 text-xs min-h-[16px]">{{ hasTriedSave ? errors.contract_id : '' }}</small>
            </div>
          </div>

          <div class="flex items-start">
            <label class="w-24 text-right mr-3 mt-2 text-[var(--content-text)]">合同编号</label>
            <div class="flex-1 flex flex-col">
              <InputText :modelValue="form.contract_code || ''" disabled class="w-full" />
              <small class="text-red-500 mt-1 text-xs min-h-[16px]"></small>
            </div>
          </div>
          <div class="flex items-start">
            <label class="w-24 text-right mr-3 mt-2 text-[var(--content-text)]">合同名称</label>
            <div class="flex-1 flex flex-col">
              <InputText :modelValue="form.contract_name || ''" disabled class="w-full" />
              <small class="text-red-500 mt-1 text-xs min-h-[16px]"></small>
            </div>
          </div>

          <div class="flex items-start">
            <label class="w-24 text-right mr-3 mt-2 text-[var(--content-text)]">编号</label>
            <div class="flex-1 flex flex-col">
              <InputText v-model="form.code" placeholder="系统自动生成" class="w-full" />
              <small class="text-red-500 mt-1 text-xs min-h-[16px]"></small>
            </div>
          </div>
          <div class="flex items-start">
            <label class="w-24 text-right mr-3 mt-2 text-[var(--content-text)]"><span class="text-red-500">*</span> 名称</label>
            <div class="flex-1 flex flex-col">
              <InputText v-model="form.name" class="w-full" :class="{ 'p-invalid': hasTriedSave && errors.name }" />
              <small class="text-red-500 mt-1 text-xs min-h-[16px]">{{ hasTriedSave ? errors.name : '' }}</small>
            </div>
          </div>

          <template v-for="field in autoFields" :key="field.key">
            <div class="flex items-start" :class="field.colSpan2 ? 'col-span-2' : ''">
              <label class="w-24 text-right mr-3 mt-2 text-[var(--content-text)]">{{ field.label }}</label>
              <div class="flex-1 flex flex-col">
                <InputText v-if="field.inputType === 'text'" v-model="(form as any)[field.key]" class="w-full" />
                <DatePicker
                  v-else-if="field.key === 'purchase_date'"
                  v-model="purchaseDateValue"
                  date-format="yy-mm-dd"
                  show-icon
                  class="w-full"
                />
                <DatePicker
                  v-else-if="field.key === 'warranty_date'"
                  v-model="warrantyDateValue"
                  date-format="yy-mm-dd"
                  show-icon
                  class="w-full"
                />
                <InputNumber
                  v-else
                  v-model="(form as any)[field.key]"
                  :min="0"
                  :minFractionDigits="field.key === 'quantity' ? 0 : 0"
                  :maxFractionDigits="field.key === 'quantity' ? 0 : 2"
                  mode="decimal"
                  inputClass="w-full"
                  class="w-full"
                  :disabled="field.key === 'total_price'"
                />
                <small class="text-red-500 mt-1 text-xs min-h-[16px]">{{ hasTriedSave ? ((errors as any)[field.key] || '') : '' }}</small>
              </div>
            </div>
          </template>
        </div>
      </div>
    </div>

    <template #footer>
      <div class="flex items-center justify-end gap-2">
        <Button label="取消" class="p-button-text" @click="emit('update:visible', false)" :disabled="saving" />
        <Button label="保存" class="p-button-primary" @click="save" :disabled="saving || !form.name?.trim()" :loading="saving" />
      </div>
    </template>
  </Dialog>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import Dialog from 'primevue/dialog'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import InputNumber from 'primevue/inputnumber'
import DatePicker from 'primevue/datepicker'
import { useToast } from 'primevue/usetoast'
import Dropdown from 'primevue/dropdown'
import { useForm } from 'vee-validate'
import * as yup from 'yup'
import type { ContractProduct, ContractProductCreateDTO, ContractProductUpdateDTO } from '../../../../../shared/types/contractProduct.types'
import type { ContractInfoEntity } from '../../../../../shared/types/contractInfo.types'
import { IdGenerator } from '../../../../../shared/utils/idGenerator'

const props = defineProps<{ visible: boolean; initialData: ContractProduct | null }>()
const emit = defineEmits<{ (e: 'update:visible', v: boolean): void; (e: 'saved'): void }>()

const toast = useToast()
const saving = ref(false)
const hasTriedSave = ref(false)

type ContractOption = { id: string; contract_code: string; contract_name: string; label: string }

const contractOptions = ref<ContractOption[]>([])
const contractSelection = ref<string>('')

const numberFieldKeys = new Set(['unit_price', 'quantity', 'cost_price', 'total_price'])
const dateFieldKeys = new Set(['purchase_date', 'warranty_date'])
const autoFields = computed(() => {
  const fields = [
    { key: 'specification', label: '型号规格' },
    { key: 'unit', label: '单位' },
    { key: 'unit_price', label: '单价' },
    { key: 'quantity', label: '数量' },
    { key: 'cost_price', label: '成本价' },
    { key: 'total_price', label: '总价' },
    { key: 'purchase_date', label: '采购日期' },
    { key: 'warranty_date', label: '维保日期' },
    { key: 'origin', label: '产地' },
    { key: 'customer_name', label: '客户' },
    { key: 'supplier_name', label: '供应商' },
    { key: 'remark', label: '备注' },
  ] as Array<{ key: string; label: string }>

  return fields.map((f) => ({
    ...f,
    inputType: numberFieldKeys.has(f.key) ? 'number' : dateFieldKeys.has(f.key) ? 'date' : 'text',
    colSpan2: false,
  }))
})

const form = reactive<ContractProductCreateDTO>({
  contract_id: '',
  contract_code: '',
  contract_name: '',
  code: '',
  name: '',
  specification: '',
  unit: '',
  unit_price: null,
  quantity: null,
  cost_price: null,
  total_price: null,
  purchase_date: '',
  warranty_date: '',
  origin: '',
  customer_name: '',
  supplier_name: '',
  remark: '',
});

const purchaseDateValue = ref<Date | null>(null)
const warrantyDateValue = ref<Date | null>(null)

const toDateValue = (value?: string | null) => {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

const toDateString = (value: Date | null) => {
  if (!value) return ''
  const yyyy = value.getFullYear()
  const mm = String(value.getMonth() + 1).padStart(2, '0')
  const dd = String(value.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

const schema = yup.object({
  contract_id: yup.string().trim().required('请选择合同'),
  name: yup.string().trim().required('请输入名称'),
  unit_price: yup.number().nullable().min(0, '单价不能小于 0'),
  quantity: yup.number().nullable().min(0, '数量不能小于 0'),
  cost_price: yup.number().nullable().min(0, '成本价不能小于 0'),
  total_price: yup.number().nullable().min(0, '总价不能小于 0'),
})

const { errors, validate, resetForm, setValues } = useForm({
  validationSchema: schema,
  initialValues: form as any,
  validateOnMount: false,
})

const selectedContract = computed(() => contractOptions.value.find(o => o.id === contractSelection.value) || null)

const syncContractToForm = () => {
  const c = selectedContract.value
  if (!c) {
    form.contract_id = ''
    form.contract_code = ''
    form.contract_name = ''
    return
  }
  form.contract_id = c.id
  form.contract_code = c.contract_code || ''
  form.contract_name = c.contract_name || ''
}

watch(contractSelection, () => {
  syncContractToForm()
})

const loadContracts = async () => {
  let libraryPath = localStorage.getItem('currentLibraryPath') || ''
  if (!libraryPath) {
    const status = await window.electronAPI.bootstrap.getInitStatus()
    if (status.success && status.data?.initialized && status.data.projectPath) {
      libraryPath = status.data.projectPath
      localStorage.setItem('currentLibraryPath', libraryPath)
    }
  }
  if (!libraryPath) {
    const db = window.electronAPI?.db
    if (db) {
      const res = await db.getSetting('project_path')
      if (res.success && res.data?.value) {
        libraryPath = res.data.value
        localStorage.setItem('currentLibraryPath', libraryPath)
      }
    }
  }
  if (!libraryPath) {
    contractOptions.value = []
    return
  }
  const res = await window.electronAPI.library.getContractInfos(libraryPath)
  if (res.success && Array.isArray(res.data)) {
    contractOptions.value = res.data.map((c: ContractInfoEntity) => ({
      id: c.id,
      contract_code: c.contract_code || '',
      contract_name: c.contract_name || '',
      label: `${c.contract_code || '-'}  ${c.contract_name || ''}`.trim(),
    }))
    return
  }
  const res2 = await window.electronAPI.library.queryContractInfos({
    libraryPath,
    page: 1,
    pageSize: 9999,
    searchQuery: '',
    searchField: 'all',
  })
  if (!res2.success || !res2.data) {
    contractOptions.value = []
    return
  }
  contractOptions.value = (res2.data.items || []).map((c: ContractInfoEntity) => ({
    id: c.id,
    contract_code: c.contract_code || '',
    contract_name: c.contract_name || '',
    label: `${c.contract_code || '-'}  ${c.contract_name || ''}`.trim(),
  }))
}

watch(() => props.initialData, (row) => {
  hasTriedSave.value = false
  if (!row) {
    Object.assign(form, {
      contract_id: '',
      contract_code: '',
      contract_name: '',
      code: IdGenerator.generateCode('CP'),
      name: '',
      specification: '',
      unit: '',
      unit_price: null,
      quantity: null,
      cost_price: null,
      total_price: null,
      purchase_date: '',
      warranty_date: '',
      origin: '',
      customer_name: '',
      supplier_name: '',
      remark: '',
    });
    purchaseDateValue.value = null
    warrantyDateValue.value = null
    contractSelection.value = ''
    resetForm({ values: { ...(form as any) }, errors: {} })
    return;
  }
  Object.assign(form, {
    contract_id: row.contract_id || '',
    contract_code: row.contract_code || '',
    contract_name: row.contract_name || '',
    code: row.code || '',
    name: row.name || '',
    specification: row.specification || '',
    unit: row.unit || '',
    unit_price: row.unit_price ?? null,
    quantity: row.quantity ?? null,
    cost_price: row.cost_price ?? null,
    total_price: row.total_price ?? null,
    purchase_date: row.purchase_date || '',
    warranty_date: row.warranty_date || '',
    origin: row.origin || '',
    customer_name: row.customer_name || '',
    supplier_name: row.supplier_name || '',
    remark: row.remark || '',
  });
  purchaseDateValue.value = toDateValue(row.purchase_date)
  warrantyDateValue.value = toDateValue(row.warranty_date)
  contractSelection.value = row.contract_id || ''
  resetForm({ values: { ...(form as any) }, errors: {} })
}, { immediate: true });

watch(() => props.visible, (v) => {
  if (!v) return
  void loadContracts()
  if (props.initialData) return
  hasTriedSave.value = false
  Object.assign(form, {
    contract_id: '',
    contract_code: '',
    contract_name: '',
    code: IdGenerator.generateCode('CP'),
    name: '',
    specification: '',
    unit: '',
    unit_price: null,
    quantity: null,
    cost_price: null,
    total_price: null,
    purchase_date: '',
    warranty_date: '',
    origin: '',
    customer_name: '',
    supplier_name: '',
    remark: '',
  })
  purchaseDateValue.value = null
  warrantyDateValue.value = null
  contractSelection.value = ''
  resetForm({ values: { ...(form as any) }, errors: {} })
})

watch(() => [form.unit_price, form.quantity], ([price, qty]) => {
  if (price == null || qty == null) {
    form.total_price = null
    return
  }
  const total = Number(price) * Number(qty)
  form.total_price = Number.isFinite(total) ? Number(total.toFixed(2)) : null
});

watch(purchaseDateValue, (value) => {
  form.purchase_date = toDateString(value)
})

watch(warrantyDateValue, (value) => {
  form.warranty_date = toDateString(value)
})

async function save() {
  if (saving.value) return
  hasTriedSave.value = true
  syncContractToForm()
  setValues({ ...(form as any) }, false)
  const vr = await validate()
  if (!vr.valid) return
  saving.value = true
  try {
    const dto: ContractProductCreateDTO | ContractProductUpdateDTO = props.initialData?.id
      ? { id: props.initialData.id, ...form }
      : { ...form }

    const res = props.initialData?.id
      ? await window.electronAPI.contractProduct.update(dto as ContractProductUpdateDTO)
      : await window.electronAPI.contractProduct.create(dto as ContractProductCreateDTO)

    if (!res.success) {
      toast.add({ severity: 'error', summary: '保存失败', detail: res.error || '保存合同产品失败', life: 3000 })
      return
    }
    toast.add({ severity: 'success', summary: '已保存', detail: '合同产品已保存', life: 2000 })
    emit('update:visible', false)
    emit('saved')
  } finally {
    saving.value = false
  }
}

onMounted(loadContracts)
</script>
