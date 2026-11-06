<template>
  <Dialog
    :visible="visible"
    @update:visible="(v) => emit('update:visible', v)"
    modal
    :header="dialogHeader"
    :style="{ width: '760px' }"
    :closable="true"
    :closeOnEscape="false"
    class="custom-dialog"
  >
    <div class="relative min-h-[280px]">
      <div class="flex flex-col py-2 px-1">
        <div class="grid grid-cols-2 gap-x-6 gap-y-2">
          <div class="flex items-start col-span-2">
            <label class="w-32 text-right mr-3 mt-2 text-[var(--content-text)]"><span class="text-red-500">*</span> 合同</label>
            <div class="flex-1 flex flex-col">
              <Dropdown
                v-model="contractSelection"
                :options="contractOptions"
                optionLabel="label"
                optionValue="id"
                placeholder="选择合同编号/名称"
                class="w-full"
                :disabled="readonly"
                :class="{ 'p-invalid': hasTriedSave && errors.contract_id }"
              />
              <small class="text-red-500 mt-1 text-xs min-h-[16px]">{{ hasTriedSave ? errors.contract_id : '' }}</small>
            </div>
          </div>

          <div class="flex items-start">
            <label class="w-32 text-right mr-3 mt-2 text-[var(--content-text)]">合同编号</label>
            <div class="flex-1 flex flex-col">
              <InputText :modelValue="form.contract_code || ''" disabled class="w-full" />
              <small class="text-red-500 mt-1 text-xs min-h-[16px]"></small>
            </div>
          </div>
          <div class="flex items-start">
            <label class="w-32 text-right mr-3 mt-2 text-[var(--content-text)]">合同名称</label>
            <div class="flex-1 flex flex-col">
              <InputText :modelValue="form.contract_name || ''" disabled class="w-full" />
              <small class="text-red-500 mt-1 text-xs min-h-[16px]"></small>
            </div>
          </div>

          <div class="flex items-start">
            <label class="w-32 text-right mr-3 mt-2 text-[var(--content-text)]"><span class="text-red-500">*</span> 合同收付方向</label>
            <div class="flex-1 flex flex-col">
              <Dropdown
                v-if="directionOptions.length > 0"
                v-model="form.direction"
                :options="directionOptions"
                optionLabel="name"
                optionValue="name"
                placeholder="选择收/付款方向"
                class="w-full"
                :disabled="readonly"
                :class="{ 'p-invalid': hasTriedSave && errors.direction }"
              />
              <Dropdown
                v-else
                v-model="form.direction"
                :options="fallbackDirections"
                placeholder="选择收/付款方向"
                class="w-full"
                :disabled="readonly"
                :class="{ 'p-invalid': hasTriedSave && errors.direction }"
              />
              <small class="text-red-500 mt-1 text-xs min-h-[16px]">{{ hasTriedSave ? errors.direction : '' }}</small>
            </div>
          </div>

          <div class="flex items-start">
            <label class="w-32 text-right mr-3 mt-2 text-[var(--content-text)]">收付频率</label>
            <div class="flex-1 flex flex-col">
              <Dropdown
                v-model="form.receipt_frequency"
                :options="receiptFrequencyOptions"
                optionLabel="name"
                optionValue="name"
                placeholder="选择收付频率"
                class="w-full"
                showClear
                :disabled="readonly"
              />
              <small class="text-red-500 mt-1 text-xs min-h-[16px]"></small>
            </div>
          </div>

          <div class="flex items-start">
            <label class="w-32 text-right mr-3 mt-2 text-[var(--content-text)]">收付款名称</label>
            <div class="flex-1 flex flex-col">
              <InputText v-model="form.plan_name" class="w-full" :disabled="readonly" />
              <small class="text-red-500 mt-1 text-xs min-h-[16px]"></small>
            </div>
          </div>

          <div class="flex items-start">
            <label class="w-32 text-right mr-3 mt-2 text-[var(--content-text)]">应收(付)款</label>
            <div class="flex-1 flex flex-col">
              <InputText v-model="form.expected_amount" type="number" inputmode="decimal" class="w-full" :disabled="readonly" />
              <small class="text-red-500 mt-1 text-xs min-h-[16px]"></small>
            </div>
          </div>

          <div class="flex items-start">
            <label class="w-32 text-right mr-3 mt-2 text-[var(--content-text)]">应收(付)日期</label>
            <div class="flex-1 flex flex-col">
              <DatePicker v-model="expectedDateValue" date-format="yy-mm-dd" show-icon class="w-full" :disabled="readonly" />
              <small class="text-red-500 mt-1 text-xs min-h-[16px]"></small>
            </div>
          </div>

          <div v-if="isEditing" class="flex items-start col-span-2">
            <label class="w-32 text-right mr-3 mt-2 text-[var(--content-text)]">已收(付)款</label>
            <div class="flex-1 flex flex-col">
              <div class="flex items-start gap-2">
                <InputText v-model="form.received_amount" type="number" inputmode="decimal" class="w-full" :disabled="readonly" />
                <Button
                  v-if="!readonly"
                  icon="pi pi-copy"
                  severity="secondary"
                  outlined
                  rounded
                  text
                  aria-label="复制应收(付)款到已收(付)款"
                  v-tooltip.top="'复制应收(付)款'"
                  @click="copyExpectedAmountToReceived"
                />
              </div>
              <small class="text-red-500 mt-1 text-xs min-h-[16px]"></small>
            </div>
          </div>

          <div class="flex items-start col-span-2">
            <label class="w-32 text-right mr-3 mt-2 text-[var(--content-text)]">备注</label>
            <div class="flex-1 flex flex-col">
              <Textarea v-model="form.remark" class="w-full" autoResize rows="4" :disabled="readonly" />
              <small class="text-red-500 mt-1 text-xs min-h-[16px]"></small>
            </div>
          </div>

          <div class="flex items-start col-span-2">
            <label class="w-32 text-right mr-3 mt-2 text-[var(--content-text)]">自定义1</label>
            <div class="flex-1 flex flex-col">
              <InputText v-model="form.custom1" class="w-full" :disabled="readonly" />
              <small class="text-red-500 mt-1 text-xs min-h-[16px]"></small>
            </div>
          </div>
        </div>
      </div>
    </div>

    <template #footer>
      <div class="flex items-center justify-end gap-2">
        <Button v-if="readonly" label="关闭" class="p-button-text" @click="emit('update:visible', false)" />
        <template v-else>
          <Button label="取消" class="p-button-text" @click="emit('update:visible', false)" :disabled="saving" />
          <Button label="保存" class="p-button-primary" @click="save" :disabled="saving" :loading="saving" />
        </template>
      </div>
    </template>
  </Dialog>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import Dialog from 'primevue/dialog'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import Dropdown from 'primevue/dropdown'
import Textarea from 'primevue/textarea'
import DatePicker from 'primevue/datepicker'
import { useToast } from 'primevue/usetoast'
import { useForm } from 'vee-validate'
import * as yup from 'yup'
import type { DictionaryItem } from '../../../../../shared/types/dictionary.types'
import type { ContractInfoEntity } from '../../../../../shared/types/contractInfo.types'

type ReceiptPlan = {
  id: string
  contract_id: string
  contract_code: string
  contract_name: string
  direction: string
  plan_name: string
  receipt_frequency: string
  expected_amount: number
  expected_date: string
  received_amount: number
  remark: string
  custom1: string
}

const props = defineProps<{ visible: boolean; initialData: ReceiptPlan | null; readonly?: boolean }>()
const emit = defineEmits<{
  (e: 'update:visible', v: boolean): void
  (e: 'saved', payload: { mode: 'create' | 'update'; row: ReceiptPlan }): void
}>()

const toast = useToast()
const saving = ref(false)
const hasTriedSave = ref(false)

type ContractOption = { id: string; contract_code: string; contract_name: string; label: string }
const contractOptions = ref<ContractOption[]>([])
const contractSelection = ref<string>('')

const directionOptions = ref<DictionaryItem[]>([])
const fallbackDirections = ['收款', '付款']
const receiptFrequencyOptions = ref<DictionaryItem[]>([])

const form = reactive({
  contract_id: '',
  contract_code: '',
  contract_name: '',
  direction: '',
  plan_name: '',
  receipt_frequency: '',
  expected_amount: '',
  expected_date: '',
  received_amount: '',
  remark: '',
  custom1: '',
})

const expectedDateValue = ref<Date | null>(null)

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
  direction: yup.string().trim().required('请选择合同收付方向'),
})

const { errors, validate, resetForm, setFieldValue, setValues } = useForm({
  validationSchema: schema,
  initialValues: form as any,
  validateOnMount: false,
})

const isEditing = computed(() => Boolean(props.initialData?.id))

const dialogHeader = computed(() => {
  if (props.readonly) return '收款详情'
  return '收款计划'
})

const sanitizeMoney = (value: unknown) => {
  const n = Number(String(value ?? '').trim() || 0)
  return Number.isFinite(n) ? n : 0
}

const copyExpectedAmountToReceived = () => {
  form.received_amount = String(form.expected_amount ?? '').trim()
  toast.add({ severity: 'success', summary: '已复制', detail: '已将应收(付)款复制到已收(付)款', life: 2000 })
}

const fillFromRow = (row: ReceiptPlan | null) => {
  hasTriedSave.value = false
  if (!row) {
    Object.assign(form, {
      contract_id: '',
      contract_code: '',
      contract_name: '',
      direction: '',
      plan_name: '',
      receipt_frequency: '',
      expected_amount: '',
      expected_date: '',
      received_amount: '',
      remark: '',
      custom1: '',
    })
    resetForm({ values: form as any, errors: {} })
    contractSelection.value = ''
    return
  }

  Object.assign(form, {
    contract_id: row.contract_id ?? '',
    contract_code: row.contract_code ?? '',
    contract_name: row.contract_name ?? '',
    direction: row.direction ?? '',
    plan_name: row.plan_name ?? '',
    receipt_frequency: row.receipt_frequency ?? '',
    expected_amount: String(row.expected_amount ?? ''),
    expected_date: row.expected_date ?? '',
    received_amount: String(row.received_amount ?? ''),
    remark: row.remark ?? '',
    custom1: row.custom1 ?? '',
  })
  resetForm({ values: form as any, errors: {} })
  contractSelection.value = form.contract_id || ''
  expectedDateValue.value = toDateValue(form.expected_date)
}

watch(() => props.initialData, (row) => {
  fillFromRow(row)
}, { immediate: true })

watch(() => props.visible, (v) => {
  if (v) fillFromRow(props.initialData)
})

watch(expectedDateValue, (value) => {
  form.expected_date = toDateString(value)
})

const loadDirections = async () => {
  const res = await window.electronAPI.dictionary.getList({
    group_name: '合同收付方向',
    page: 1,
    pageSize: 9999,
  })
  if (!res.success || !res.data) {
    directionOptions.value = []
    return
  }
  directionOptions.value = res.data.data || []
}

const loadReceiptFrequencies = async () => {
  const res = await window.electronAPI.dictionary.getList({
    group_name: '收付频率',
    page: 1,
    pageSize: 9999,
  })
  if (!res.success || !res.data) {
    receiptFrequencyOptions.value = []
    return
  }
  receiptFrequencyOptions.value = res.data.data || []
}

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

watch(() => form.contract_id, (value) => {
  setFieldValue('contract_id', String(value || '').trim())
})
watch(() => form.direction, (value) => {
  setFieldValue('direction', String(value || '').trim())
})

const save = async () => {
  if (saving.value) return
  hasTriedSave.value = true
  setValues({ ...(form as any) }, false)
  const { valid } = await validate()
  if (!valid) return

  saving.value = true
  try {
    const row: ReceiptPlan = {
      id: props.initialData?.id || window.crypto.randomUUID(),
      contract_id: form.contract_id,
      contract_code: form.contract_code,
      contract_name: form.contract_name,
      direction: form.direction,
      plan_name: form.plan_name,
      receipt_frequency: form.receipt_frequency,
      expected_amount: sanitizeMoney(form.expected_amount),
      expected_date: form.expected_date,
      received_amount: isEditing.value ? sanitizeMoney(form.received_amount) : 0,
      remark: form.remark,
      custom1: form.custom1,
    }
    toast.add({ severity: 'success', summary: '已保存', detail: isEditing.value ? '收款计划已更新' : '收款计划已创建', life: 2000 })
    emit('saved', { mode: isEditing.value ? 'update' : 'create', row })
  } catch (e: any) {
    toast.add({ severity: 'error', summary: '保存失败', detail: e?.message || '保存收款计划失败', life: 3000 })
  } finally {
    saving.value = false
  }
}

onMounted(async () => {
  await loadDirections()
  await loadReceiptFrequencies()
  await loadContracts()
})
</script>
