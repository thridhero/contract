<template>
  <Dialog
    :visible="visible"
    @update:visible="(v) => emit('update:visible', v)"
    modal
    :header="isEdit ? '乙方单位管理_修改' : '乙方单位管理_增加'"
    :style="{ width: '860px' }"
    :closable="true"
    class="custom-dialog"
  >
    <BlockUI :blocked="saving">
      <div class="relative min-h-[420px] max-h-[70vh] overflow-y-auto custom-scrollbar pr-2">
        <div class="flex flex-col py-2 px-1 space-y-4">

          <Tabs v-model:value="activeTab" class="sticky top-0 z-10 bg-[var(--content-bg)] pt-2">
            <TabList>
              <Tab value="basic">基础信息</Tab>
              <Tab value="contact">联系人</Tab>
            </TabList>
            <TabPanels class="pt-4">
              <TabPanel value="basic">
                <div class="grid grid-cols-2 gap-x-6 gap-y-2">
                  <div class="flex items-start">
                    <label class="w-24 text-right mr-3 mt-2 text-[var(--content-text)]">编号</label>
                    <div class="flex-1 flex flex-col">
                      <InputText v-model="code" :class="{ 'p-invalid': errors.code }" placeholder="系统自动生成" />
                      <small class="text-red-500 mt-1 text-xs min-h-[16px]">{{ errors.code }}</small>
                    </div>
                  </div>
                  <div class="flex items-start">
                    <label class="w-24 text-right mr-3 mt-2 text-[var(--content-text)]"><span class="text-red-500">*</span> 名称</label>
                    <div class="flex-1 flex flex-col">
                      <InputText v-model="name" :class="{ 'p-invalid': errors.name }" />
                      <small class="text-red-500 mt-1 text-xs min-h-[16px]">{{ errors.name }}</small>
                    </div>
                  </div>
                  <div class="flex items-start">
                    <label class="w-24 text-right mr-3 mt-2 text-[var(--content-text)]">法人姓名</label>
                    <div class="flex-1 flex flex-col">
                      <InputText v-model="legal_rep_name" :class="{ 'p-invalid': errors.legal_rep_name }" placeholder="姓名" />
                      <small class="text-red-500 mt-1 text-xs min-h-[16px]">{{ errors.legal_rep_name }}</small>
                    </div>
                  </div>
                  <div class="flex items-start">
                    <label class="w-24 text-right mr-3 mt-2 text-[var(--content-text)]">单位分组</label>
                    <div class="flex-1 flex flex-col">
                      <Dropdown
                        v-model="group_name"
                        :options="groupOptions"
                        optionLabel="name"
                        optionValue="name"
                        placeholder="选择分组"
                        :class="{ 'p-invalid': errors.group_name }"
                      />
                      <small class="text-red-500 mt-1 text-xs min-h-[16px]">{{ errors.group_name }}</small>
                    </div>
                  </div>
                  <div class="flex items-start">
                    <label class="w-24 text-right mr-3 mt-2 text-[var(--content-text)]">法人身份证号</label>
                    <div class="flex-1 flex flex-col">
                      <InputText v-model="legal_rep_id_number" :class="{ 'p-invalid': errors.legal_rep_id_number }" placeholder="身份证号" />
                      <small class="text-red-500 mt-1 text-xs min-h-[16px]">{{ errors.legal_rep_id_number }}</small>
                    </div>
                  </div>
                  <div class="flex items-start">
                    <label class="w-24 text-right mr-3 mt-2 text-[var(--content-text)]">注册日期</label>
                    <div class="flex-1 flex flex-col">
                      <DatePicker
                        v-model="regDateValue"
                        date-format="yy-mm-dd"
                        class="w-full"
                        :invalid="!!errors.reg_date"
                        show-icon
                        @update:modelValue="syncRegDateFromPicker"
                      />
                      <small class="text-red-500 mt-1 text-xs min-h-[16px]">{{ errors.reg_date }}</small>
                    </div>
                  </div>
                  <div class="flex items-start">
                    <label class="w-24 text-right mr-3 mt-2 text-[var(--content-text)]">法人手机号</label>
                    <div class="flex-1 flex flex-col">
                      <InputText v-model="legal_rep_mobile" :class="{ 'p-invalid': errors.legal_rep_mobile }" placeholder="手机号" inputmode="tel" />
                      <small class="text-red-500 mt-1 text-xs min-h-[16px]">{{ errors.legal_rep_mobile }}</small>
                    </div>
                  </div>
                  <div class="flex items-start">
                    <label class="w-24 text-right mr-3 mt-2 text-[var(--content-text)]">法人邮箱</label>
                    <div class="flex-1 flex flex-col">
                      <InputText v-model="legal_rep_email" :class="{ 'p-invalid': errors.legal_rep_email }" placeholder="邮箱" inputmode="email" />
                      <small class="text-red-500 mt-1 text-xs min-h-[16px]">{{ errors.legal_rep_email }}</small>
                    </div>
                  </div>
                  <div class="flex items-start">
                    <label class="w-24 text-right mr-3 mt-2 text-[var(--content-text)]">税务登记证号</label>
                    <div class="flex-1 flex flex-col">
                      <InputText v-model="tax_number" :class="{ 'p-invalid': errors.tax_number }" placeholder="统一社会信用代码" />
                      <small class="text-red-500 mt-1 text-xs min-h-[16px]">{{ errors.tax_number }}</small>
                    </div>
                  </div>
                  <div class="flex items-start">
                    <label class="w-24 text-right mr-3 mt-2 text-[var(--content-text)]">开户行</label>
                    <div class="flex-1 flex flex-col">
                      <InputText v-model="bank_name" :class="{ 'p-invalid': errors.bank_name }" placeholder="银行名称" />
                      <small class="text-red-500 mt-1 text-xs min-h-[16px]">{{ errors.bank_name }}</small>
                    </div>
                  </div>
                  <div class="flex items-start">
                    <label class="w-24 text-right mr-3 mt-2 text-[var(--content-text)]">银行账号</label>
                    <div class="flex-1 flex flex-col">
                      <InputText v-model="bank_account" :class="{ 'p-invalid': errors.bank_account }" placeholder="银行账号" />
                      <small class="text-red-500 mt-1 text-xs min-h-[16px]">{{ errors.bank_account }}</small>
                    </div>
                  </div>
                  <div class="flex items-start">
                    <label class="w-24 text-right mr-3 mt-2 text-[var(--content-text)]">发票类型</label>
                    <div class="flex-1 flex flex-col">
                      <Dropdown
                        v-model="invoice_type"
                        :options="invoiceTypeOptions"
                        optionLabel="label"
                        optionValue="value"
                        placeholder="选择发票类型"
                        :class="{ 'p-invalid': errors.invoice_type }"
                      />
                      <small class="text-red-500 mt-1 text-xs min-h-[16px]">{{ errors.invoice_type }}</small>
                    </div>
                  </div>
                  <div class="flex items-start col-span-2">
                    <label class="w-24 text-right mr-3 mt-2 text-[var(--content-text)]">公司地址</label>
                    <div class="flex-1 flex flex-col">
                      <InputText v-model="address" :class="{ 'p-invalid': errors.address }" />
                      <small class="text-red-500 mt-1 text-xs min-h-[16px]">{{ errors.address }}</small>
                    </div>
                  </div>
                </div>
              </TabPanel>

              <TabPanel value="contact">
                <div class="space-y-4">
                  <div class="flex items-center justify-between px-1">
                    <h4 class="font-bold text-[var(--content-text)]">联系人列表</h4>
                    <Button icon="pi pi-plus" label="添加联系人" class="p-button-sm p-button-outlined" @click="addContact" />
                  </div>
                  
                  <div v-if="contacts.length === 0" class="text-center py-8 border-2 border-dashed border-[var(--content-border)] rounded-xl text-[var(--content-text-secondary)]">
                    暂无联系人，点击上方按钮添加
                  </div>
                  
                  <div v-for="(item, index) in contacts" :key="item.id" class="p-4 rounded-xl border border-[var(--content-border)] bg-[var(--sidebar-bg)] space-y-3 relative group">
                    <div class="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button icon="pi pi-trash" class="p-button-danger p-button-text p-button-sm" @click="removeContact(index)" />
                    </div>
                    
                    <div class="grid grid-cols-3 gap-4">
                      <div class="flex flex-col gap-1">
                        <label class="text-xs font-bold text-[var(--content-text-secondary)] uppercase">姓名</label>
                        <InputText v-model="item.name" placeholder="姓名" class="p-inputtext-sm" />
                      </div>
                      <div class="flex flex-col gap-1">
                        <label class="text-xs font-bold text-[var(--content-text-secondary)] uppercase">身份证号</label>
                        <InputText v-model="item.id_number" placeholder="身份证号" class="p-inputtext-sm" />
                      </div>
                      <div class="flex flex-col gap-1">
                        <label class="text-xs font-bold text-[var(--content-text-secondary)] uppercase">部门</label>
                        <InputText v-model="item.department" placeholder="部门" class="p-inputtext-sm" />
                      </div>
                      <div class="flex flex-col gap-1">
                        <label class="text-xs font-bold text-[var(--content-text-secondary)] uppercase">手机</label>
                        <InputText v-model="item.mobile" placeholder="手机" class="p-inputtext-sm" inputmode="tel" />
                      </div>
                      <div class="flex flex-col gap-1">
                        <label class="text-xs font-bold text-[var(--content-text-secondary)] uppercase">电话</label>
                        <InputText v-model="item.phone" placeholder="电话" class="p-inputtext-sm" />
                      </div>
                      <div class="flex flex-col gap-1">
                        <label class="text-xs font-bold text-[var(--content-text-secondary)] uppercase">邮箱</label>
                        <InputText v-model="item.email" placeholder="邮箱" class="p-inputtext-sm" inputmode="email" />
                      </div>
                      <div class="flex flex-col gap-1">
                        <label class="text-xs font-bold text-[var(--content-text-secondary)] uppercase">微信</label>
                        <InputText v-model="item.wechat" placeholder="微信号" class="p-inputtext-sm" />
                      </div>
                      <div class="flex items-end pb-1 col-span-3">
                        <div class="flex items-center gap-6">
                          <div class="flex items-center gap-2">
                            <Checkbox v-model="item.is_primary" :binary="true" @change="handlePrimaryChange(index)" />
                            <label class="text-xs font-bold text-[var(--content-text-secondary)]">主联系人</label>
                          </div>
                          <div class="flex items-center gap-2">
                            <Checkbox v-model="item.is_legal_representative" :binary="true" @change="handleLegalRepChange(index)" />
                            <label class="text-xs font-bold text-[var(--content-text-secondary)]">法人</label>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </TabPanel>
            </TabPanels>
          </Tabs>
          
        </div>
        <div v-if="saving" class="absolute inset-0 flex items-center justify-center bg-white/50 z-10 rounded-lg">
          <ProgressSpinner style="width: 50px; height: 50px" strokeWidth="4" />
        </div>
      </div>
    </BlockUI>

    <template #footer>
      <div class="flex justify-end gap-2 mt-4 pt-4">
        <Button label="取消" icon="pi pi-times" @click="handleCancel" class="p-button-text p-button-sm" :disabled="saving" />
        <Button label="确定" icon="pi pi-check" @click="handleSave" class="p-button-primary p-button-sm" :loading="saving" />
      </div>
    </template>
  </Dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import Dropdown from 'primevue/dropdown'
import Button from 'primevue/button'
import BlockUI from 'primevue/blockui'
import ProgressSpinner from 'primevue/progressspinner'
import DatePicker from 'primevue/datepicker'
import Tabs from 'primevue/tabs'
import TabList from 'primevue/tablist'
import Tab from 'primevue/tab'
import TabPanels from 'primevue/tabpanels'
import TabPanel from 'primevue/tabpanel'
import Checkbox from 'primevue/checkbox'
import { useToast } from 'primevue/usetoast'
import { createRendererLogger } from '@/utils/logger'
import { SupplierCreateDTO, SupplierUpdateDTO, Supplier, SupplierContact } from '../../../../../shared/types/supplier.types'

const logger = createRendererLogger('SupplierDialog')
import { useForm } from 'vee-validate'
import * as yup from 'yup'
import { IdGenerator } from '../../../../../shared/utils/idGenerator'

const props = defineProps<{
  visible: boolean
  isEdit?: boolean
  initialData?: Supplier | null
  groupOptions?: { name: string }[]
}>()

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void
  (e: 'save', data: Supplier): void
}>()

const toast = useToast()
const saving = ref(false)
const groupOptions = computed(() => props.groupOptions ?? [])
const activeTab = ref<'basic' | 'contact'>('basic')
const contacts = ref<SupplierContact[]>([])
const regDateValue = ref<Date | null>(null)
const syncingLegal = ref(false)

const addContact = () => {
  contacts.value.push({
    id: crypto.randomUUID(),
    name: '',
    department: '',
    mobile: '',
    phone: '',
    email: '',
    id_number: '',
    wechat: '',
    is_legal_representative: false,
    is_primary: contacts.value.length === 0
  })
}

const removeContact = (index: number) => {
  const wasPrimary = contacts.value[index].is_primary
  contacts.value.splice(index, 1)
  if (wasPrimary && contacts.value.length > 0) {
    contacts.value[0].is_primary = true
  }
}

const handlePrimaryChange = (index: number) => {
  if (contacts.value[index].is_primary) {
    contacts.value.forEach((c, i) => {
      if (i !== index) c.is_primary = false
    })
  } else {
    // If user tries to uncheck the only primary, keep it checked
    const hasPrimary = contacts.value.some(c => c.is_primary)
    if (!hasPrimary) {
      contacts.value[index].is_primary = true
    }
  }
}

const handleLegalRepChange = (index: number) => {
  if (contacts.value[index].is_legal_representative) {
    contacts.value.forEach((c, i) => {
      if (i !== index) c.is_legal_representative = false
    })
  }
}

const isValidEmail = (value: unknown): boolean => {
  const s = String(value ?? '').trim()
  if (!s) return true
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)
}

const isValidMobile11 = (value: unknown): boolean => {
  const s = String(value ?? '').trim()
  if (!s) return true
  const compact = s.replace(/\D/g, '')
  return /^1[3-9]\d{9}$/.test(compact)
}

const isValidChineseIdCard = (value: unknown): boolean => {
  const s = String(value ?? '').trim().toUpperCase()
  if (!s) return true
  if (!/^\d{17}[\dX]$/.test(s)) return false
  const weights = [7, 9, 10, 5, 8, 4, 2, 1, 6, 3, 7, 9, 10, 5, 8, 4, 2]
  const charset = '10X98765432'
  let sum = 0
  for (let i = 0; i < 17; i += 1) sum += Number(s[i]) * weights[i]
  const check = sum % 11
  const expected = charset[check]
  return expected === s[17]
}

const normalizeContact = (c: Partial<SupplierContact>): SupplierContact => ({
  id: String(c.id || crypto.randomUUID()),
  name: String(c.name || ''),
  department: String(c.department || ''),
  mobile: String((c as SupplierContact).mobile || ''),
  phone: String(c.phone || ''),
  email: String((c as SupplierContact).email || ''),
  id_number: String((c as SupplierContact).id_number || ''),
  wechat: String(c.wechat || ''),
  is_legal_representative: Boolean((c as SupplierContact).is_legal_representative),
  is_primary: Boolean(c.is_primary)
})

const findLegalContactIndex = (): number => {
  const byFlag = contacts.value.findIndex(c => c.is_legal_representative)
  if (byFlag >= 0) return byFlag
  return contacts.value.findIndex(c => String(c.department || '').trim() === '法人')
}

const hydrateLegalFieldsFromContacts = () => {
  const idx = findLegalContactIndex()
  if (idx < 0) {
    legal_rep_name.value = ''
    legal_rep_id_number.value = ''
    legal_rep_mobile.value = ''
    legal_rep_email.value = ''
    return
  }
  const c = contacts.value[idx]
  legal_rep_name.value = c.name || ''
  legal_rep_id_number.value = c.id_number || ''
  legal_rep_mobile.value = c.mobile || ''
  legal_rep_email.value = c.email || ''
}

const syncLegalFieldsToContacts = () => {
  const name = String(legal_rep_name.value || '').trim()
  const idNumber = String(legal_rep_id_number.value || '').trim()
  const mobile = String(legal_rep_mobile.value || '').trim()
  const email = String(legal_rep_email.value || '').trim()
  const hasAny = Boolean(name || idNumber || mobile || email)

  const idx = findLegalContactIndex()
  if (idx < 0) {
    if (!hasAny) return
    contacts.value.unshift({
      id: crypto.randomUUID(),
      name,
      department: '法人',
      mobile,
      phone: '',
      email,
      id_number: idNumber,
      wechat: '',
      is_legal_representative: true,
      is_primary: contacts.value.length === 0
    })
    return
  }

  const c = contacts.value[idx]
  c.is_legal_representative = true
  if (!c.department) c.department = '法人'
  c.name = name
  c.id_number = idNumber
  c.mobile = mobile
  c.email = email

  const allEmpty = !String(c.name || '').trim() && !String(c.id_number || '').trim() && !String(c.mobile || '').trim() && !String(c.email || '').trim() && !String(c.phone || '').trim() && !String(c.wechat || '').trim() && !String(c.department || '').trim()
  if (allEmpty) {
    const wasPrimary = c.is_primary
    contacts.value.splice(idx, 1)
    if (wasPrimary && contacts.value.length > 0) {
      contacts.value[0].is_primary = true
    }
  }
}

const normalizeContactsForSave = (raw: SupplierContact[]): SupplierContact[] => {
  const cleaned = raw.map(c => ({
    ...c,
    name: String(c.name ?? '').trim(),
    department: String(c.department ?? '').trim(),
    mobile: String(c.mobile ?? '').trim(),
    phone: String(c.phone ?? '').trim(),
    email: String(c.email ?? '').trim(),
    id_number: String(c.id_number ?? '').trim(),
    wechat: String(c.wechat ?? '').trim()
  }))

  const nonEmpty = cleaned.filter(c => {
    const allEmpty = !c.name && !c.department && !c.mobile && !c.phone && !c.email && !c.id_number && !c.wechat
    return !allEmpty
  })
  if (nonEmpty.length === 0) return []

  const primaryCount = nonEmpty.filter(c => c.is_primary).length
  if (primaryCount !== 1) {
    nonEmpty.forEach((c, idx) => { c.is_primary = idx === 0 })
  }
  const legalCount = nonEmpty.filter(c => c.is_legal_representative).length
  if (legalCount > 1) {
    let kept = false
    nonEmpty.forEach((c) => {
      if (!c.is_legal_representative) return
      if (!kept) { kept = true; return }
      c.is_legal_representative = false
    })
  }
  return nonEmpty
}

const schema = yup.object({
  code: yup.string().optional(),
  name: yup.string().required('名称不能为空').trim(),
  group_name: yup.string().optional(),
  contact: yup.string().optional(),
  phone: yup.string().optional().matches(/^[\d\-\+\s()]*$/, '联系电话格式不正确'),
  bank_account: yup.string().optional(),
  bank_name: yup.string().optional(),
  tax_number: yup.string().optional(),
  invoice_type: yup.string().optional(),
  address: yup.string().optional(),
  reg_date: yup.string().optional().trim().matches(/^\d{4}-\d{2}-\d{2}$/, { message: '日期格式应为 YYYY-MM-DD', excludeEmptyString: true }),
  legal_rep_name: yup.string().optional().trim(),
  legal_rep_id_number: yup.string().optional().trim().test('idcard', '身份证号格式不正确', isValidChineseIdCard),
  legal_rep_mobile: yup.string().optional().trim().test('mobile11', '手机号必须为11位', isValidMobile11),
  legal_rep_email: yup.string().optional().trim().test('email', '邮箱格式不正确', isValidEmail)
})

const invoiceTypeOptions = [
  { label: '请选择', value: '' },
  { label: '增值税专用发票', value: '专票' },
  { label: '增值税普通发票', value: '普票' }
]

const defaultForm: SupplierCreateDTO = {
  code: '',
  name: '',
  contact: '',
  group_name: '',
  bank_account: '',
  bank_name: '',
  phone: '',
  address: '',
  tax_number: '',
  invoice_type: '',
  reg_date: '',
  legal_rep_name: '',
  legal_rep_id_number: '',
  legal_rep_mobile: '',
  legal_rep_email: ''
}

const { defineField, handleSubmit, resetForm, errors } = useForm<SupplierCreateDTO>({
  validationSchema: schema,
  initialValues: defaultForm
})

const [code] = defineField('code')
const [name] = defineField('name')
const [group_name] = defineField('group_name')
const [contact] = defineField('contact')
const [phone] = defineField('phone')
const [bank_account] = defineField('bank_account')
const [bank_name] = defineField('bank_name')
const [tax_number] = defineField('tax_number')
const [invoice_type] = defineField('invoice_type')
const [address] = defineField('address')
const [reg_date] = defineField('reg_date')
const [legal_rep_name] = defineField('legal_rep_name')
const [legal_rep_id_number] = defineField('legal_rep_id_number')
const [legal_rep_mobile] = defineField('legal_rep_mobile')
const [legal_rep_email] = defineField('legal_rep_email')

const toDate = (value?: string | null): Date | null => {
  const v = String(value ?? '').trim()
  if (!v) return null
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v)
  if (!m) return null
  const y = Number(m[1])
  const mo = Number(m[2])
  const d = Number(m[3])
  const dt = new Date(y, mo - 1, d)
  if (Number.isNaN(dt.getTime())) return null
  return dt
}

const toDateString = (date: Date): string => {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

const syncRegDateFromPicker = (date: Date | null) => {
  if (!date) {
    reg_date.value = ''
    return
  }
  reg_date.value = toDateString(date)
}

watch(() => props.visible, (newVal) => {
  if (newVal) {
    activeTab.value = 'basic'
    if (props.isEdit && props.initialData) {
      resetForm({
        values: {
          code: props.initialData.code || '',
          name: props.initialData.name || '',
          contact: props.initialData.contact || '',
          group_name: props.initialData.group_name || '',
          bank_account: props.initialData.bank_account || '',
          bank_name: props.initialData.bank_name || '',
          phone: props.initialData.phone || '',
          address: props.initialData.address || '',
          tax_number: props.initialData.tax_number || '',
          invoice_type: props.initialData.invoice_type || '',
          reg_date: props.initialData.reg_date || '',
          legal_rep_name: props.initialData.legal_rep_name || '',
          legal_rep_id_number: props.initialData.legal_rep_id_number || '',
          legal_rep_mobile: props.initialData.legal_rep_mobile || '',
          legal_rep_email: props.initialData.legal_rep_email || ''
        }
      })
      regDateValue.value = toDate(props.initialData.reg_date)
      try {
        const raw = props.initialData.contacts ? JSON.parse(props.initialData.contacts) : []
        contacts.value = Array.isArray(raw) ? raw.map((c) => normalizeContact(c)) : []
      } catch (e) {
        contacts.value = []
      }
      if (contacts.value.length > 0 && !contacts.value.some(c => c.is_primary)) {
        contacts.value[0].is_primary = true
      }
      syncingLegal.value = true
      hydrateLegalFieldsFromContacts()
      syncingLegal.value = false
    } else {
      resetForm({ values: { ...defaultForm, code: IdGenerator.generateCode('SUP') } })
      regDateValue.value = null
      contacts.value = []
    }
  }
})

watch([legal_rep_name, legal_rep_id_number, legal_rep_mobile, legal_rep_email], () => {
  if (syncingLegal.value) return
  syncingLegal.value = true
  syncLegalFieldsToContacts()
  syncingLegal.value = false
})

watch(contacts, () => {
  if (syncingLegal.value) return
  syncingLegal.value = true
  hydrateLegalFieldsFromContacts()
  syncingLegal.value = false
}, { deep: true })

const handleCancel = () => {
  emit('update:visible', false)
}

const handleSave = handleSubmit(async (values) => {
  saving.value = true
  try {
    contacts.value = normalizeContactsForSave(contacts.value)
    const primaryContact = contacts.value.find(c => c.is_primary) || contacts.value[0]
    const payload: SupplierCreateDTO = {
      ...values,
      name: values.name.trim(),
      code: values.code?.trim() || IdGenerator.generateCode('SUP'),
      // Sync primary contact info to top-level fields for compatibility
      contact: primaryContact?.name || '',
      phone: primaryContact?.mobile || primaryContact?.phone || '',
      group_name: values.group_name?.trim(),
      bank_account: values.bank_account?.trim(),
      bank_name: values.bank_name?.trim(),
      address: values.address?.trim(),
      tax_number: values.tax_number?.trim(),
      invoice_type: values.invoice_type?.trim(),
      reg_date: values.reg_date?.trim(),
      legal_rep_name: values.legal_rep_name?.trim(),
      legal_rep_id_number: values.legal_rep_id_number?.trim(),
      legal_rep_mobile: values.legal_rep_mobile?.trim(),
      legal_rep_email: values.legal_rep_email?.trim(),
      contacts: JSON.stringify(contacts.value)
    }

    let result
    if (props.isEdit && props.initialData) {
      const updateDto: SupplierUpdateDTO = {
        id: props.initialData.id,
        ...payload
      }
      result = await window.electronAPI.supplier.update(updateDto)
    } else {
      result = await window.electronAPI.supplier.create(payload)
    }
    
    if (result.success) {
      toast.add({ severity: 'success', summary: '成功', detail: props.isEdit ? '修改成功' : '新增成功', life: 3000 })
      emit('save', result.data)
      emit('update:visible', false)
    } else {
      toast.add({ severity: 'error', summary: '保存失败', detail: result.error || '未知错误', life: 3000 })
    }
  } catch (error) {
    logger.error('Failed to save supplier', error)
    toast.add({ severity: 'error', summary: '保存失败', detail: '出现异常', life: 3000 })
  } finally {
    saving.value = false
  }
})
</script>

<style scoped>
.custom-scrollbar::-webkit-scrollbar {
  width: 6px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background-color: var(--content-border);
  border-radius: 10px;
}
</style>

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
.custom-dialog .p-tablist {
  background: var(--content-bg) !important;
  border-bottom: 1px solid var(--content-border) !important;
}
.custom-dialog .p-tab {
  color: var(--content-text-secondary) !important;
}
.custom-dialog .p-tab.p-tab-active {
  color: var(--content-text) !important;
}
.custom-dialog .p-tabpanels,
.custom-dialog .p-tabpanel {
  background: var(--content-bg) !important;
  color: var(--content-text) !important;
}
.custom-dialog .p-inputtext {
  background: var(--input-bg) !important;
  border-color: var(--input-border) !important;
  color: var(--input-text) !important;
}
.custom-dialog .p-inputtext::placeholder {
  color: var(--input-placeholder) !important;
}
.custom-dialog .p-dropdown,
.custom-dialog .p-select {
  background: var(--input-bg) !important;
  border-color: var(--input-border) !important;
  color: var(--input-text) !important;
}
.custom-dialog .p-dropdown-label,
.custom-dialog .p-select-label {
  color: var(--input-text) !important;
}
</style>
