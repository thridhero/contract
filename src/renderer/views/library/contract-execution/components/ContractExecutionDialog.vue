<template>
  <Dialog
    :visible="visible"
    @update:visible="(v) => emit('update:visible', v)"
    modal
    header="合同执行"
    :style="{ width: '760px' }"
    :closable="true"
    class="custom-dialog"
  >
    <div class="relative min-h-[320px]">
      <div class="flex flex-col py-2 px-1">
        <div class="grid grid-cols-2 gap-x-6 gap-y-2">
          <div class="flex items-start col-span-2">
            <label class="w-24 text-right mr-3 mt-2 text-[var(--content-text)]">合同</label>
            <div class="flex-1 flex flex-col">
              <Dropdown
                v-model="contractSelection"
                :options="contractOptions"
                optionLabel="label"
                optionValue="id"
                placeholder="选择合同编号/名称"
                class="w-full"
              />
              <small class="text-red-500 mt-1 text-xs min-h-[16px]"></small>
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
            <label class="w-24 text-right mr-3 mt-2 text-[var(--content-text)]"><span class="text-red-500">*</span> 执行时间</label>
            <div class="flex-1 flex flex-col">
              <DatePicker
                v-model="executionTimeValue"
                date-format="yy-mm-dd"
                show-icon
                class="w-full"
                :class="{ 'p-invalid': hasTriedSave && errors.execution_time }"
              />
              <small class="text-red-500 mt-1 text-xs min-h-[16px]">{{ hasTriedSave ? errors.execution_time : '' }}</small>
            </div>
          </div>

          <div class="flex items-start">
            <label class="w-24 text-right mr-3 mt-2 text-[var(--content-text)]"><span class="text-red-500">*</span> 执行情况</label>
            <div class="flex-1 flex flex-col">
              <Dropdown
                v-if="executionStatusOptions.length > 0"
                v-model="form.execution_status"
                :options="executionStatusOptions"
                optionLabel="name"
                optionValue="name"
                placeholder="选择执行情况"
                class="w-full"
                :class="{ 'p-invalid': hasTriedSave && errors.execution_status }"
              />
              <InputText
                v-else
                v-model="form.execution_status"
                class="w-full"
                :class="{ 'p-invalid': hasTriedSave && errors.execution_status }"
              />
              <small class="text-red-500 mt-1 text-xs min-h-[16px]">{{ hasTriedSave ? errors.execution_status : '' }}</small>
            </div>
          </div>

          <div class="flex items-start">
            <label class="w-24 text-right mr-3 mt-2 text-[var(--content-text)]">业务员</label>
            <div class="flex-1 flex flex-col">
              <InputText v-model="form.salesperson" class="w-full" />
              <small class="text-red-500 mt-1 text-xs min-h-[16px]"></small>
            </div>
          </div>

          <div class="flex items-start">
            <label class="w-24 text-right mr-3 mt-2 text-[var(--content-text)]">登记日期</label>
            <div class="flex-1 flex flex-col">
              <DatePicker v-model="registerDateValue" date-format="yy-mm-dd" show-icon class="w-full" />
              <small class="text-red-500 mt-1 text-xs min-h-[16px]"></small>
            </div>
          </div>

          <div class="flex items-start">
            <label class="w-24 text-right mr-3 mt-2 text-[var(--content-text)]">执行进度</label>
            <div class="flex-1 flex flex-col">
              <Slider v-model="progressValue" :min="0" :max="100" :step="1" class="w-full mt-2" />
              <div class="mt-1 text-xs tabular-nums text-[var(--content-text-secondary)]">{{ progressValue }}%</div>
              <small class="text-red-500 mt-1 text-xs min-h-[16px]"></small>
            </div>
          </div>

          <div class="flex items-start">
            <label class="w-24 text-right mr-3 mt-2 text-[var(--content-text)]">自定义2</label>
            <div class="flex-1 flex flex-col">
              <InputText v-model="form.custom2" class="w-full" />
              <small class="text-red-500 mt-1 text-xs min-h-[16px]"></small>
            </div>
          </div>

          <div class="flex items-start col-span-2">
            <label class="w-24 text-right mr-3 mt-2 text-[var(--content-text)]">内容</label>
            <div class="flex-1 flex flex-col">
              <Textarea v-model="form.content" class="w-full" autoResize rows="5" />
              <small class="text-red-500 mt-1 text-xs min-h-[16px]"></small>
            </div>
          </div>

          <div class="flex items-start col-span-2">
            <label class="w-24 text-right mr-3 mt-2 text-[var(--content-text)]">备注</label>
            <div class="flex-1 flex flex-col">
              <Textarea v-model="form.remark" class="w-full" autoResize rows="4" />
              <small class="text-red-500 mt-1 text-xs min-h-[16px]"></small>
            </div>
          </div>

          <div class="flex items-start">
            <label class="w-24 text-right mr-3 mt-2 text-[var(--content-text)]">自定义3</label>
            <div class="flex-1 flex flex-col">
              <InputText v-model="form.custom3" class="w-full" />
              <small class="text-red-500 mt-1 text-xs min-h-[16px]"></small>
            </div>
          </div>

          <div class="flex items-start">
            <label class="w-24 text-right mr-3 mt-2 text-[var(--content-text)]">自定义4</label>
            <div class="flex-1 flex flex-col">
              <InputText v-model="form.custom4" class="w-full" />
              <small class="text-red-500 mt-1 text-xs min-h-[16px]"></small>
            </div>
          </div>
        </div>
      </div>
    </div>

    <template #footer>
      <div class="flex items-center justify-end gap-2">
        <Button label="取消" class="p-button-text" @click="emit('update:visible', false)" :disabled="saving" />
        <Button label="保存" class="p-button-primary" @click="save" :disabled="saving" :loading="saving" />
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
import Slider from 'primevue/slider'
import DatePicker from 'primevue/datepicker'
import { useToast } from 'primevue/usetoast'
import { useForm } from 'vee-validate'
import * as yup from 'yup'
import type { DictionaryItem } from '../../../../../shared/types/dictionary.types'
import type { ContractExecution, ContractExecutionCreateDTO, ContractExecutionUpdateDTO } from '../../../../../shared/types/contractExecution.types'
import type { ContractInfoEntity } from '../../../../../shared/types/contractInfo.types'

const props = defineProps<{ visible: boolean; initialData: ContractExecution | null }>()
const emit = defineEmits<{ (e: 'update:visible', v: boolean): void; (e: 'saved'): void }>()

const toast = useToast()
const saving = ref(false)
const hasTriedSave = ref(false)

const executionStatusOptions = ref<DictionaryItem[]>([])
type ContractOption = { id: string; contract_code: string; contract_name: string; label: string }
const contractOptions = ref<ContractOption[]>([])
const contractSelection = ref<string>('')
const progressValue = ref(0)
const executionTimeValue = ref<Date | null>(null)
const registerDateValue = ref<Date | null>(null)

const form = reactive<ContractExecutionCreateDTO>({
  contract_id: '',
  contract_code: '',
  contract_name: '',
  execution_time: '',
  execution_status: '',
  salesperson: 'Admin',
  content: '',
  register_date: '',
  progress: '',
  remark: '',
  custom2: '',
  custom3: '',
  custom4: '',
})

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

const parseProgressValue = (value: unknown) => {
  const raw = String(value ?? '').trim()
  if (!raw) return 0
  const n = Number(raw.replace('%', ''))
  if (!Number.isFinite(n)) return 0
  return Math.max(0, Math.min(100, n))
}

const schema = yup.object({
  execution_time: yup.string().trim().required('请选择执行时间'),
  execution_status: yup.string().trim().required('请选择执行情况'),
})

const { errors, validate, resetForm, setFieldValue } = useForm({
  validationSchema: schema,
  initialValues: form as any,
  validateOnMount: false,
})

const isEditing = computed(() => Boolean(props.initialData?.id))

const loadExecutionStatusOptions = async () => {
  const res = await window.electronAPI.dictionary.getList({
    group_name: '合同执行情况',
    page: 1,
    pageSize: 9999,
  })
  if (!res.success || !res.data) {
    executionStatusOptions.value = []
    return
  }
  executionStatusOptions.value = res.data.data || []
}

const fillFromRow = (row: ContractExecution | null) => {
  hasTriedSave.value = false
  if (!row) {
    Object.assign(form, {
      contract_id: '',
      contract_code: '',
      contract_name: '',
      execution_time: '',
      execution_status: '',
      salesperson: 'Admin',
      content: '',
      register_date: '',
      progress: '',
      remark: '',
      custom2: '',
      custom3: '',
      custom4: '',
    })
    resetForm({ values: form as any, errors: {} })
    contractSelection.value = ''
    progressValue.value = 0
    executionTimeValue.value = null
    registerDateValue.value = null
    return
  }
  Object.assign(form, {
    contract_id: row.contract_id ?? '',
    contract_code: row.contract_code ?? '',
    contract_name: row.contract_name ?? '',
    execution_time: row.execution_time ?? '',
    execution_status: row.execution_status ?? '',
    salesperson: row.salesperson ?? 'Admin',
    content: row.content ?? '',
    register_date: row.register_date ?? '',
    progress: row.progress ?? '',
    remark: row.remark ?? '',
    custom2: row.custom2 ?? '',
    custom3: row.custom3 ?? '',
    custom4: row.custom4 ?? '',
  })
  resetForm({ values: form as any, errors: {} })
  contractSelection.value = form.contract_id || ''
  progressValue.value = parseProgressValue(form.progress)
  executionTimeValue.value = toDateValue(form.execution_time)
  registerDateValue.value = toDateValue(form.register_date)
}

watch(() => props.initialData, (row) => {
  fillFromRow(row)
}, { immediate: true })

watch(() => props.visible, (v) => {
  if (v) fillFromRow(props.initialData)
})

watch(executionTimeValue, (value) => {
  const v = toDateString(value)
  form.execution_time = v
  setFieldValue('execution_time', v)
})
watch(registerDateValue, (value) => {
  form.register_date = toDateString(value)
})
watch(() => form.execution_status, (value) => {
  setFieldValue('execution_status', String(value || '').trim())
})

const save = async () => {
  if (saving.value) return
  hasTriedSave.value = true
  const { valid } = await validate()
  if (!valid) return

  form.progress = `${progressValue.value}%`
  saving.value = true
  try {
    if (isEditing.value) {
      const dto: ContractExecutionUpdateDTO = { id: props.initialData!.id, ...form }
      const res = await window.electronAPI.contractExecution.update(dto)
      if (!res.success) {
        toast.add({ severity: 'error', summary: '保存失败', detail: res.error || '更新合同执行失败', life: 3000 })
        return
      }
      toast.add({ severity: 'success', summary: '已保存', detail: '合同执行已更新', life: 2000 })
      emit('saved')
      return
    }

    const dto: ContractExecutionCreateDTO = { ...form }
    const res = await window.electronAPI.contractExecution.create(dto)
    if (!res.success) {
      toast.add({ severity: 'error', summary: '保存失败', detail: res.error || '创建合同执行失败', life: 3000 })
      return
    }
    toast.add({ severity: 'success', summary: '已保存', detail: '合同执行已创建', life: 2000 })
    emit('saved')
  } finally {
    saving.value = false
  }
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

onMounted(async () => {
  await loadExecutionStatusOptions()
  await loadContracts()
})
</script>
