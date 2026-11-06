<template>
  <Dialog
    v-model:visible="visible"
    modal
    :header="dialogTitle"
    :style="{ width: '900px' }"
    :draggable="true"
    class="custom-dialog"
  >
    <Tabs v-model:value="activeTabValue">
      <TabList>
        <Tab value="base">基础信息</Tab>
        <Tab value="other">其他信息</Tab>
      </TabList>

      <TabPanels>
        <TabPanel value="base">
          <div :class="formGridClass" class="gap-4 pt-2">
            <div v-if="isFieldVisible('code')" class="flex flex-col gap-1">
              <label class="text-sm font-medium text-[var(--content-text)]">项目编号</label>
              <InputText v-model="form.code" class="w-full" placeholder="留空时自动生成" />
            </div>

            <div v-if="isFieldVisible('name')" class="flex flex-col gap-1">
              <label class="text-sm font-medium text-[var(--content-text)]"><span class="text-red-500">*</span> 项目名称</label>
              <InputText v-model="form.name" class="w-full" :invalid="!!errors.name" />
              <small class="text-red-500 min-h-[16px]">{{ errors.name }}</small>
            </div>

            <div v-if="isFieldVisible('content')" :class="fullWidthClass" class="flex flex-col gap-1">
              <label class="text-sm font-medium text-[var(--content-text)]">项目内容</label>
              <Editor v-model="form.content" class="w-full" editor-style="height: 160px" />
            </div>

            <div v-if="isFieldVisible('group_name')" class="flex flex-col gap-1">
              <label class="text-sm font-medium text-[var(--content-text)]">项目分组</label>
              <Select
                v-model="selectedGroupKey"
                :options="groupOptions"
                option-label="label"
                option-value="key"
                class="w-full"
                placeholder="请选择分组"
              />
            </div>

            <div v-if="isFieldVisible('project_date')" class="flex flex-col gap-1">
              <label class="text-sm font-medium text-[var(--content-text)]">立项日期</label>
              <DatePicker v-model="projectDateValue" date-format="yy-mm-dd" show-icon class="w-full" />
            </div>

            <div v-if="isFieldVisible('approval_date')" class="flex flex-col gap-1">
              <label class="text-sm font-medium text-[var(--content-text)]">概算批复时间</label>
              <DatePicker v-model="approvalDateValue" date-format="yy-mm-dd" show-icon class="w-full" />
            </div>

            <div v-if="isFieldVisible('contract_deadline')" class="flex flex-col gap-1">
              <label class="text-sm font-medium text-[var(--content-text)]">合同截止日期</label>
              <DatePicker v-model="contractDeadlineValue" date-format="yy-mm-dd" show-icon class="w-full" />
            </div>

            <div v-if="mode !== 'edit'" :class="fullWidthClass" class="flex items-center gap-2">
              <Checkbox v-model="continuousAdd" binary input-id="continuous-add" />
              <label for="continuous-add" class="text-sm text-[var(--content-text)]">连续增加</label>
            </div>
          </div>
        </TabPanel>

        <TabPanel value="other">
          <div :class="formGridClass" class="gap-4 pt-2">
            <div v-if="isFieldVisible('engineering_location')" :class="fullWidthClass" class="flex flex-col gap-1">
              <label class="text-sm font-medium text-[var(--content-text)]">工程地点</label>
              <InputText v-model="form.engineering_location" class="w-full" />
            </div>

            <div v-if="isFieldVisible('project_days')" class="flex flex-col gap-1">
              <label class="text-sm font-medium text-[var(--content-text)]">项目天数</label>
              <InputNumber v-model="form.project_days" :min="0" class="w-full" />
            </div>

            <div v-if="isFieldVisible('building_area')" class="flex flex-col gap-1">
              <label class="text-sm font-medium text-[var(--content-text)]">建筑面积</label>
              <InputNumber v-model="form.building_area" :min="0" :minFractionDigits="0" :maxFractionDigits="2" class="w-full" />
            </div>

            <div v-if="isFieldVisible('started_building_area')" class="flex flex-col gap-1">
              <label class="text-sm font-medium text-[var(--content-text)]">已开工建筑面积</label>
              <InputNumber v-model="form.started_building_area" :min="0" :minFractionDigits="0" :maxFractionDigits="2" class="w-full" />
            </div>

            <div v-if="isFieldVisible('counted_area')" class="flex flex-col gap-1">
              <label class="text-sm font-medium text-[var(--content-text)]">计容面积</label>
              <InputNumber v-model="form.counted_area" :min="0" :minFractionDigits="0" :maxFractionDigits="2" class="w-full" />
            </div>

            <div v-if="isFieldVisible('started_counted_area')" class="flex flex-col gap-1">
              <label class="text-sm font-medium text-[var(--content-text)]">开工计容面积</label>
              <InputNumber v-model="form.started_counted_area" :min="0" :minFractionDigits="0" :maxFractionDigits="2" class="w-full" />
            </div>

            <div v-if="isFieldVisible('country')" class="flex flex-col gap-1">
              <label class="text-sm font-medium text-[var(--content-text)]">所在国家</label>
              <InputText v-model="form.country" class="w-full" />
            </div>

            <div v-if="isFieldVisible('province')" class="flex flex-col gap-1">
              <label class="text-sm font-medium text-[var(--content-text)]">所在省份</label>
              <InputText v-model="form.province" class="w-full" />
            </div>

            <div v-if="isFieldVisible('city')" class="flex flex-col gap-1">
              <label class="text-sm font-medium text-[var(--content-text)]">所在城市</label>
              <InputText v-model="form.city" class="w-full" />
            </div>
          </div>
        </TabPanel>
      </TabPanels>
    </Tabs>

    <template #footer>
      <div class="flex items-center justify-between w-full">
        <Button label="打印" icon="pi pi-print" severity="secondary" @click="handlePrint" />
        <div class="flex gap-2">
          <Button label="取消" severity="secondary" @click="visible = false" />
          <Button label="保存" @click="handleSubmit" />
        </div>
      </div>
    </template>
  </Dialog>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import Button from 'primevue/button'
import Editor from 'primevue/editor'
import Select from 'primevue/select'
import DatePicker from 'primevue/datepicker'
import InputNumber from 'primevue/inputnumber'
import Checkbox from 'primevue/checkbox'
import Tabs from 'primevue/tabs'
import TabList from 'primevue/tablist'
import Tab from 'primevue/tab'
import TabPanels from 'primevue/tabpanels'
import TabPanel from 'primevue/tabpanel'
import type {
  ProjectManagementCreateDTO,
  ProjectManagementDesignConfig,
  ProjectManagementItem,
  ProjectManagementUpdateDTO,
} from '../../../../../shared/types/projectManagement.types'

type DialogMode = 'add' | 'edit' | 'copy'

interface GroupOption {
  key: string
  label: string
}

const visible = defineModel<boolean>('visible', { default: false })

const props = defineProps<{
  mode: DialogMode
  initialData?: ProjectManagementItem | null
  groupOptions: GroupOption[]
  defaultGroupKey?: string
  defaultGroupName?: string
  designConfig: ProjectManagementDesignConfig
}>()

const emit = defineEmits<{
  (e: 'save', payload: { data: ProjectManagementCreateDTO | ProjectManagementUpdateDTO; continuousAdd: boolean }): void
}>()

const form = reactive({
  code: '',
  name: '',
  content: '',
  group_key: '',
  group_name: '',
  project_date: '',
  approval_date: '',
  contract_deadline: '',
  engineering_location: '',
  project_days: null as number | null,
  building_area: null as number | null,
  started_building_area: null as number | null,
  counted_area: null as number | null,
  started_counted_area: null as number | null,
  country: '',
  province: '',
  city: '',
})

const selectedGroupKey = ref<string | null>(null)
const projectDateValue = ref<Date | null>(null)
const approvalDateValue = ref<Date | null>(null)
const contractDeadlineValue = ref<Date | null>(null)
const continuousAdd = ref(false)
const errors = reactive<Record<string, string>>({})
const activeTabValue = ref<'base' | 'other'>('base')

const dialogTitle = computed(() => {
  if (props.mode === 'edit') return '编辑项目'
  if (props.mode === 'copy') return '类似复制项目'
  return '新增项目'
})

const formGridClass = computed(() => {
  return props.designConfig.formLayout === 'single-column' ? 'grid grid-cols-1' : 'grid grid-cols-2'
})

const fullWidthClass = computed(() => {
  return props.designConfig.formLayout === 'single-column' ? '' : 'col-span-2'
})

const visibleFormFields = computed(() => {
  return new Set(props.designConfig.formFields.filter((field) => field.visible).map((field) => field.field))
})

const isFieldVisible = (field: string) => {
  return visibleFormFields.value.has(field)
}

const baseTabFields = ['code', 'name', 'content', 'group_name', 'project_date', 'approval_date', 'contract_deadline'] as const
const otherTabFields = [
  'engineering_location',
  'project_days',
  'building_area',
  'started_building_area',
  'counted_area',
  'started_counted_area',
  'country',
  'province',
  'city',
] as const

const hasAnyVisibleField = (fields: readonly string[]) => {
  return fields.some((field) => isFieldVisible(field))
}

const getDefaultTab = () => {
  if (hasAnyVisibleField(baseTabFields)) return 'base'
  if (hasAnyVisibleField(otherTabFields)) return 'other'
  return 'base'
}

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

const resetForm = () => {
  form.code = props.mode === 'copy' ? '' : props.initialData?.code || ''
  form.name = props.initialData?.name || ''
  form.content = props.initialData?.content || ''
  form.group_key = props.initialData?.group_key || props.defaultGroupKey || ''
  form.group_name = props.initialData?.group_name || props.defaultGroupName || ''
  form.project_date = props.initialData?.project_date || ''
  form.approval_date = props.initialData?.approval_date || ''
  form.contract_deadline = props.initialData?.contract_deadline || ''
  form.engineering_location = props.initialData?.engineering_location || ''
  form.project_days = props.initialData?.project_days ?? null
  form.building_area = props.initialData?.building_area ?? null
  form.started_building_area = props.initialData?.started_building_area ?? null
  form.counted_area = props.initialData?.counted_area ?? null
  form.started_counted_area = props.initialData?.started_counted_area ?? null
  form.country = props.initialData?.country || ''
  form.province = props.initialData?.province || ''
  form.city = props.initialData?.city || ''
  selectedGroupKey.value = form.group_key || null
  projectDateValue.value = toDateValue(form.project_date)
  approvalDateValue.value = toDateValue(form.approval_date)
  contractDeadlineValue.value = toDateValue(form.contract_deadline)
  continuousAdd.value = false
  activeTabValue.value = getDefaultTab()
  Object.keys(errors).forEach((key) => delete errors[key])
}

watch(visible, (value) => {
  if (value) {
    resetForm()
  }
})

watch(selectedGroupKey, (value) => {
  const group = props.groupOptions.find((item) => item.key === value)
  form.group_key = group?.key || ''
  form.group_name = group?.label || ''
})

watch(projectDateValue, (value) => {
  form.project_date = toDateString(value)
})

watch(approvalDateValue, (value) => {
  form.approval_date = toDateString(value)
})

watch(contractDeadlineValue, (value) => {
  form.contract_deadline = toDateString(value)
})

const validate = () => {
  Object.keys(errors).forEach((key) => delete errors[key])
  if (!form.name.trim()) {
    errors.name = '项目名称不能为空'
  }
  return Object.keys(errors).length === 0
}

const htmlToPlainText = (value: string) => {
  return value
    .replace(/<\s*br\s*\/?>/gi, '\n')
    .replace(/<\/p\s*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+\n/g, '\n')
    .replace(/\n\s+/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim()
}

const normalizeRichTextValue = (value: string) => {
  const plainText = htmlToPlainText(value)
  return plainText ? value : ''
}

const handleSubmit = () => {
  if (!validate()) return

  const contentValue = normalizeRichTextValue(form.content)

  const payload: ProjectManagementCreateDTO = {
    code: form.code.trim() || undefined,
    name: form.name.trim(),
    content: contentValue || undefined,
    group_key: form.group_key || undefined,
    group_name: form.group_name || undefined,
    project_date: form.project_date || undefined,
    approval_date: form.approval_date || undefined,
    contract_deadline: form.contract_deadline || undefined,
    engineering_location: form.engineering_location.trim() || undefined,
    project_days: form.project_days,
    building_area: form.building_area,
    started_building_area: form.started_building_area,
    counted_area: form.counted_area,
    started_counted_area: form.started_counted_area,
    country: form.country.trim() || undefined,
    province: form.province.trim() || undefined,
    city: form.city.trim() || undefined,
  }

  if (props.mode === 'edit' && props.initialData) {
    emit('save', {
      data: {
        id: props.initialData.id,
        ...payload,
      },
      continuousAdd: false,
    })
    return
  }

  emit('save', {
    data: payload,
    continuousAdd: continuousAdd.value,
  })
}

const handlePrint = () => {
  const contentText = htmlToPlainText(form.content)
  const rows = [
    ['项目编号', form.code || '自动生成'],
    ['项目名称', form.name],
    ['项目内容', contentText],
    ['项目分组', form.group_name],
    ['立项日期', form.project_date],
    ['概算批复时间', form.approval_date],
    ['合同截止日期', form.contract_deadline],
    ['工程地点', form.engineering_location],
    ['项目天数', form.project_days],
    ['建筑面积', form.building_area],
    ['已开工建筑面积', form.started_building_area],
    ['计容面积', form.counted_area],
    ['开工计容面积', form.started_counted_area],
    ['所在国家', form.country],
    ['所在省份', form.province],
    ['所在城市', form.city],
  ]

  const printWindow = window.open('', '_blank', 'width=900,height=700')
  if (!printWindow) return

  const html = rows.map(([label, value]) => `
    <tr>
      <th style="text-align:left;padding:10px;border:1px solid #d1d5db;width:180px;">${label}</th>
      <td style="padding:10px;border:1px solid #d1d5db;">${value ?? ''}</td>
    </tr>
  `).join('')

  printWindow.document.write(`
    <html>
      <head>
        <title>${dialogTitle.value}</title>
      </head>
      <body style="font-family: Arial, sans-serif; padding: 24px;">
        <h1 style="margin-bottom: 16px;">${dialogTitle.value}</h1>
        <table style="width: 100%; border-collapse: collapse;">${html}</table>
      </body>
    </html>
  `)
  printWindow.document.close()
  printWindow.focus()
  printWindow.print()
}
</script>
