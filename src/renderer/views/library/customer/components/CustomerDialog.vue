<template>
  <Dialog
    :visible="visible"
    @update:visible="(v) => emit('update:visible', v)"
    modal
    :header="isEdit ? '客户管理_修改' : '客户管理_增加'"
    :style="{ width: '860px' }"
    :closable="true"
    class="custom-dialog"
  >
    <BlockUI :blocked="saving">
      <div ref="scrollContainer" class="relative min-h-[420px] max-h-[70vh] overflow-y-auto custom-scrollbar pr-2">
        <div class="flex flex-col py-2 px-1 space-y-4">

          <Tabs v-model:value="activeTab" class="sticky top-0 z-10 bg-[var(--content-bg)] pt-2">
            <TabList>
              <Tab value="basic">基础信息</Tab>
              <Tab value="contact">联系方式</Tab>
              <Tab value="company">公司与地址</Tab>
              <Tab value="custom">自定义</Tab>
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
                  <InputText v-model="legalRepName" placeholder="姓名" :class="{ 'p-invalid': !!legalErrors.name }" />
                  <small class="text-red-500 mt-1 text-xs min-h-[16px]">{{ legalErrors.name }}</small>
                </div>
              </div>
              <div class="flex items-start">
                <label class="w-24 text-right mr-3 mt-2 text-[var(--content-text)]">客户分组</label>
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
                  <InputText v-model="legalRepIdNumber" placeholder="身份证号" :class="{ 'p-invalid': !!legalErrors.idNumber }" />
                  <small class="text-red-500 mt-1 text-xs min-h-[16px]">{{ legalErrors.idNumber }}</small>
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
                  <InputText v-model="legalRepMobile" placeholder="手机号" inputmode="tel" :class="{ 'p-invalid': !!legalErrors.mobile }" />
                  <small class="text-red-500 mt-1 text-xs min-h-[16px]">{{ legalErrors.mobile }}</small>
                </div>
              </div>
              <div class="flex items-start">
                <label class="w-24 text-right mr-3 mt-2 text-[var(--content-text)]">法人邮箱</label>
                <div class="flex-1 flex flex-col">
                  <InputText v-model="legalRepEmail" placeholder="邮箱" inputmode="email" :class="{ 'p-invalid': !!legalErrors.email }" />
                  <small class="text-red-500 mt-1 text-xs min-h-[16px]">{{ legalErrors.email }}</small>
                </div>
              </div>
              <div class="flex items-start">
                <label class="w-24 text-right mr-3 mt-2 text-[var(--content-text)]">税号</label>
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
                        <InputText v-model="item.name" placeholder="姓名" class="p-inputtext-sm" :class="{ 'p-invalid': !!contactErrors[item.id]?.name }" />
                        <small class="text-red-500 text-xs min-h-[16px]">{{ contactErrors[item.id]?.name }}</small>
                      </div>
                    <div class="flex flex-col gap-1">
                      <label class="text-xs font-bold text-[var(--content-text-secondary)] uppercase">身份证号</label>
                      <InputText v-model="item.id_number" placeholder="身份证号" class="p-inputtext-sm" :class="{ 'p-invalid': !!contactErrors[item.id]?.id_number }" />
                      <small class="text-red-500 text-xs min-h-[16px]">{{ contactErrors[item.id]?.id_number }}</small>
                    </div>
                      <div class="flex flex-col gap-1">
                        <label class="text-xs font-bold text-[var(--content-text-secondary)] uppercase">部门</label>
                        <InputText v-model="item.department" placeholder="部门" class="p-inputtext-sm" :class="{ 'p-invalid': !!contactErrors[item.id]?.department }" />
                        <small class="text-red-500 text-xs min-h-[16px]">{{ contactErrors[item.id]?.department }}</small>
                      </div>
                      <div class="flex flex-col gap-1">
                        <label class="text-xs font-bold text-[var(--content-text-secondary)] uppercase">手机</label>
                        <InputText v-model="item.mobile" placeholder="手机" class="p-inputtext-sm" :class="{ 'p-invalid': !!contactErrors[item.id]?.mobile }" />
                        <small class="text-red-500 text-xs min-h-[16px]">{{ contactErrors[item.id]?.mobile }}</small>
                      </div>
                      <div class="flex flex-col gap-1">
                        <label class="text-xs font-bold text-[var(--content-text-secondary)] uppercase">电话</label>
                        <InputText v-model="item.phone" placeholder="电话" class="p-inputtext-sm" :class="{ 'p-invalid': !!contactErrors[item.id]?.phone }" />
                        <small class="text-red-500 text-xs min-h-[16px]">{{ contactErrors[item.id]?.phone }}</small>
                      </div>
                      <div class="flex flex-col gap-1">
                        <label class="text-xs font-bold text-[var(--content-text-secondary)] uppercase">邮箱</label>
                        <InputText v-model="item.email" placeholder="邮箱" class="p-inputtext-sm" :class="{ 'p-invalid': !!contactErrors[item.id]?.email }" />
                        <small class="text-red-500 text-xs min-h-[16px]">{{ contactErrors[item.id]?.email }}</small>
                      </div>
                      <div class="flex items-end pb-1">
                        <div class="flex items-center gap-2">
                          <Checkbox v-model="item.is_primary" :binary="true" @change="handlePrimaryChange(index)" />
                          <label class="text-xs font-bold text-[var(--content-text-secondary)]">主联系人</label>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </TabPanel>

              <TabPanel value="company">
            <div class="grid grid-cols-2 gap-x-6 gap-y-2">
              <div class="flex items-start">
                <label class="w-24 text-right mr-3 mt-2 text-[var(--content-text)]">公司类型</label>
                <div class="flex-1 flex flex-col">
                  <InputText v-model="company_type" :class="{ 'p-invalid': errors.company_type }" />
                  <small class="text-red-500 mt-1 text-xs min-h-[16px]">{{ errors.company_type }}</small>
                </div>
              </div>
              <div class="flex items-start">
                <label class="w-24 text-right mr-3 mt-2 text-[var(--content-text)]">所属行业</label>
                <div class="flex-1 flex flex-col">
                  <InputText v-model="industry" :class="{ 'p-invalid': errors.industry }" />
                  <small class="text-red-500 mt-1 text-xs min-h-[16px]">{{ errors.industry }}</small>
                </div>
              </div>
              <div class="flex items-start">
                <label class="w-24 text-right mr-3 mt-2 text-[var(--content-text)]">主营产品</label>
                <div class="flex-1 flex flex-col">
                  <InputText v-model="products" :class="{ 'p-invalid': errors.products }" />
                  <small class="text-red-500 mt-1 text-xs min-h-[16px]">{{ errors.products }}</small>
                </div>
              </div>
              <div class="flex items-start">
                <label class="w-24 text-right mr-3 mt-2 text-[var(--content-text)]">公司网址</label>
                <div class="flex-1 flex flex-col">
                  <InputText v-model="website" :class="{ 'p-invalid': errors.website }" inputmode="url" />
                  <small class="text-red-500 mt-1 text-xs min-h-[16px]">{{ errors.website }}</small>
                </div>
              </div>
              <div class="flex items-start">
                <label class="w-24 text-right mr-3 mt-2 text-[var(--content-text)]">注册资本</label>
                <div class="flex-1 flex flex-col">
                  <InputText v-model="capital" :class="{ 'p-invalid': errors.capital }" inputmode="decimal" />
                  <small class="text-red-500 mt-1 text-xs min-h-[16px]">{{ errors.capital }}</small>
                </div>
              </div>
              <div class="flex items-start">
                <label class="w-24 text-right mr-3 mt-2 text-[var(--content-text)]">国家</label>
                <div class="flex-1 flex flex-col">
                  <InputText v-model="country" :class="{ 'p-invalid': errors.country }" />
                  <small class="text-red-500 mt-1 text-xs min-h-[16px]">{{ errors.country }}</small>
                </div>
              </div>
              <div class="flex items-start">
                <label class="w-24 text-right mr-3 mt-2 text-[var(--content-text)]">省份</label>
                <div class="flex-1 flex flex-col">
                  <InputText v-model="province" :class="{ 'p-invalid': errors.province }" />
                  <small class="text-red-500 mt-1 text-xs min-h-[16px]">{{ errors.province }}</small>
                </div>
              </div>
              <div class="flex items-start">
                <label class="w-24 text-right mr-3 mt-2 text-[var(--content-text)]">城市</label>
                <div class="flex-1 flex flex-col">
                  <InputText v-model="city" :class="{ 'p-invalid': errors.city }" />
                  <small class="text-red-500 mt-1 text-xs min-h-[16px]">{{ errors.city }}</small>
                </div>
              </div>
              <div class="flex items-start col-span-2">
                <label class="w-24 text-right mr-3 mt-2 text-[var(--content-text)]">详细地址</label>
                <div class="flex-1 flex flex-col">
                  <InputText v-model="address" :class="{ 'p-invalid': errors.address }" />
                  <small class="text-red-500 mt-1 text-xs min-h-[16px]">{{ errors.address }}</small>
                </div>
              </div>
            </div>
              </TabPanel>

              <TabPanel value="custom">
            <div class="grid grid-cols-2 gap-x-6 gap-y-2">
              <div class="flex items-start">
                <label class="w-24 text-right mr-3 mt-2 text-[var(--content-text)]">自定义1</label>
                <div class="flex-1 flex flex-col">
                  <InputText v-model="custom1" :class="{ 'p-invalid': errors.custom1 }" />
                  <small class="text-red-500 mt-1 text-xs min-h-[16px]">{{ errors.custom1 }}</small>
                </div>
              </div>
              <div class="flex items-start">
                <label class="w-24 text-right mr-3 mt-2 text-[var(--content-text)]">自定义2</label>
                <div class="flex-1 flex flex-col">
                  <InputText v-model="custom2" :class="{ 'p-invalid': errors.custom2 }" />
                  <small class="text-red-500 mt-1 text-xs min-h-[16px]">{{ errors.custom2 }}</small>
                </div>
              </div>
              <div class="flex items-start">
                <label class="w-24 text-right mr-3 mt-2 text-[var(--content-text)]">自定义3</label>
                <div class="flex-1 flex flex-col">
                  <InputText v-model="custom3" :class="{ 'p-invalid': errors.custom3 }" />
                  <small class="text-red-500 mt-1 text-xs min-h-[16px]">{{ errors.custom3 }}</small>
                </div>
              </div>
              <div class="flex items-start">
                <label class="w-24 text-right mr-3 mt-2 text-[var(--content-text)]">自定义4</label>
                <div class="flex-1 flex flex-col">
                  <InputText v-model="custom4" :class="{ 'p-invalid': errors.custom4 }" />
                  <small class="text-red-500 mt-1 text-xs min-h-[16px]">{{ errors.custom4 }}</small>
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
import { computed, nextTick, ref, watch } from 'vue'
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
import { useForm } from 'vee-validate'
import * as yup from 'yup'
import { createRendererLogger } from '@/utils/logger'
import { CustomerCreateDTO, CustomerUpdateDTO, Customer, CustomerContact } from '../../../../../shared/types/customer.types'
import { IdGenerator } from '../../../../../shared/utils/idGenerator'

const logger = createRendererLogger('CustomerDialog')

const props = defineProps<{
  visible: boolean
  isEdit?: boolean
  initialData?: Customer | null
  groupOptions?: { name: string }[]
}>()

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void
  (e: 'save', data: Customer): void
}>()

const toast = useToast()
const saving = ref(false)
const groupOptions = computed(() => props.groupOptions ?? [])
const activeTab = ref<'basic' | 'contact' | 'company' | 'custom'>('basic')
const scrollContainer = ref<HTMLElement | null>(null)
const regDateValue = ref<Date | null>(null)
const contacts = ref<CustomerContact[]>([])
const legalRepName = ref('')
const legalRepIdNumber = ref('')
const legalRepMobile = ref('')
const legalRepEmail = ref('')
const syncingLegal = ref(false)
type ContactErrorField = 'name' | 'department' | 'mobile' | 'phone' | 'email' | 'id_number'
const contactErrors = ref<Record<string, Partial<Record<ContactErrorField, string>>>>({})
const legalErrors = ref<{ name?: string; idNumber?: string; mobile?: string; email?: string }>({})

const normalizeContact = (c: Partial<CustomerContact>): CustomerContact => ({
  id: String(c.id || crypto.randomUUID()),
  name: String(c.name || ''),
  department: String(c.department || ''),
  mobile: String(c.mobile || ''),
  phone: String(c.phone || ''),
  email: String(c.email || ''),
  id_number: String((c as CustomerContact).id_number || ''),
  is_legal_representative: Boolean((c as CustomerContact).is_legal_representative),
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
    legalRepName.value = ''
    legalRepIdNumber.value = ''
    legalRepMobile.value = ''
    legalRepEmail.value = ''
    return
  }

  const c = contacts.value[idx]
  legalRepName.value = c.name || ''
  legalRepIdNumber.value = c.id_number || ''
  legalRepMobile.value = c.mobile || ''
  legalRepEmail.value = c.email || ''
}

const syncLegalFieldsToContacts = () => {
  const name = String(legalRepName.value || '').trim()
  const idNumber = String(legalRepIdNumber.value || '').trim()
  const mobile = String(legalRepMobile.value || '').trim()
  const email = String(legalRepEmail.value || '').trim()
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

  const allEmpty = !String(c.name || '').trim() && !String(c.id_number || '').trim() && !String(c.mobile || '').trim() && !String(c.email || '').trim() && !String(c.phone || '').trim()
  if (allEmpty) {
    const wasPrimary = c.is_primary
    contacts.value.splice(idx, 1)
    if (wasPrimary && contacts.value.length > 0) {
      contacts.value[0].is_primary = true
    }
  }
}

const addContact = () => {
  contacts.value.push({
    id: crypto.randomUUID(),
    name: '',
    department: '',
    mobile: '',
    phone: '',
    email: '',
    id_number: '',
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

const countDigits = (s: string): number => String(s || '').replace(/\D/g, '').length

const isValidMobile11 = (value: unknown): boolean => {
  const s = String(value ?? '').trim()
  if (!s) return true
  const compact = s.replace(/\D/g, '')
  return /^1[3-9]\d{9}$/.test(compact)
}

const isValidPhoneLike = (value: unknown): boolean => {
  const s = String(value ?? '').trim()
  if (!s) return true
  if (!/^[\d\-\+\s()]*$/.test(s)) return false
  const digits = countDigits(s)
  if (digits < 5 || digits > 20) return false
  const compact = s.replace(/\D/g, '')
  if (compact.length === 11 && compact.startsWith('1')) {
    return /^1[3-9]\d{9}$/.test(compact)
  }
  return true
}

const isValidDateString = (value: unknown): boolean => {
  const s = String(value ?? '').trim()
  if (!s) return true
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s)
  if (!m) return false
  const y = Number(m[1])
  const mo = Number(m[2])
  const d = Number(m[3])
  const dt = new Date(y, mo - 1, d)
  if (Number.isNaN(dt.getTime())) return false
  return dt.getFullYear() === y && dt.getMonth() + 1 === mo && dt.getDate() === d
}

const isValidChineseIdCard = (value: unknown): boolean => {
  const s = String(value ?? '').trim().toUpperCase()
  if (!s) return true
  return /^\d{15}$/.test(s) || /^\d{17}[\dX]$/.test(s)
}

const isValidEmail = (value: unknown): boolean => {
  const s = String(value ?? '').trim()
  if (!s) return true
  return yup.string().trim().email().isValidSync(s)
}

const isValidUscc = (value: unknown): boolean => {
  const s = String(value ?? '').trim().toUpperCase()
  if (!s) return true
  if (!/^[0-9A-Z]{18}$/.test(s)) return false
  const charset = '0123456789ABCDEFGHJKLMNPQRTUWXY'
  for (const ch of s) {
    if (!charset.includes(ch)) return false
  }
  const map: Record<string, number> = {}
  charset.split('').forEach((ch, i) => { map[ch] = i })
  const weights = [1, 3, 9, 27, 19, 26, 16, 17, 20, 29, 25, 13, 8, 24, 10, 30, 28]
  const sum = s
    .slice(0, 17)
    .split('')
    .reduce((acc, ch, idx) => acc + map[ch] * weights[idx], 0)
  const logic = 31
  const mod = sum % logic
  const check = (logic - mod) % logic
  const expected = charset[check]
  return expected === s[17]
}

const isValidBankAccount = (value: unknown): boolean => {
  const s = String(value ?? '').trim()
  if (!s) return true
  const compact = s.replace(/\s+/g, '')
  if (!/^\d+$/.test(compact)) return false
  return compact.length >= 8 && compact.length <= 30
}

const isValidWebsite = (value: unknown): boolean => {
  const s = String(value ?? '').trim()
  if (!s) return true
  const candidate = /^https?:\/\//i.test(s) ? s : `http://${s}`
  try {
    const u = new URL(candidate)
    return Boolean(u.hostname)
  } catch {
    return false
  }
}

const syncRegDateFromPicker = (date: Date | null) => {
  if (!date) {
    reg_date.value = ''
    return
  }
  reg_date.value = toDateString(date)
}

const schema = yup.object({
  code: yup.string().optional().trim().max(50, '编号最多50字符'),
  name: yup.string().required('名称不能为空').trim().max(100, '名称最多100字符'),
  group_name: yup.string().optional().trim().max(50, '客户分组最多50字符'),
  contact: yup.string().optional(),
  department: yup.string().optional(),
  mobile: yup.string().optional().trim().test('mobile11', '手机号必须为11位', isValidMobile11),
  phone: yup.string().optional().trim().test('phoneLike', '电话格式不正确', isValidPhoneLike),
  fax: yup.string().optional().trim().test('phoneLike', '传真格式不正确', isValidPhoneLike),
  email: yup.string().email('邮箱格式不正确').optional().trim().max(100, '邮箱最多100字符'),
  address: yup.string().optional().trim().max(200, '详细地址最多200字符'),
  msn: yup.string().optional().trim().max(100, 'MSN最多100字符'),
  company_type: yup.string().optional().trim().max(50, '公司类型最多50字符'),
  industry: yup.string().optional().trim().max(50, '所属行业最多50字符'),
  products: yup.string().optional().trim().max(200, '主营产品最多200字符'),
  website: yup.string().optional().trim().test('url', '网址格式不正确', isValidWebsite).max(200, '公司网址最多200字符'),
  capital: yup.string().optional().trim().matches(/^\d+(\.\d+)?$/, { message: '注册资本必须为数字', excludeEmptyString: true }).max(20, '注册资本最多20字符'),
  country: yup.string().optional().trim().max(50, '国家最多50字符'),
  province: yup.string().optional().trim().max(50, '省份最多50字符'),
  city: yup.string().optional().trim().max(50, '城市最多50字符'),
  reg_date: yup.string().optional().trim().test('date', '日期格式应为 YYYY-MM-DD', isValidDateString),
  custom1: yup.string().optional().trim().max(200, '自定义1最多200字符'),
  custom2: yup.string().optional().trim().max(200, '自定义2最多200字符'),
  custom3: yup.string().optional().trim().max(200, '自定义3最多200字符'),
  custom4: yup.string().optional().trim().max(200, '自定义4最多200字符'),
  tax_number: yup.string().optional().trim().test('uscc', '统一社会信用代码格式不正确', isValidUscc),
  bank_name: yup.string().optional().trim().max(100, '开户行最多100字符'),
  bank_account: yup.string().optional().trim().test('bankAccount', '银行账号格式不正确', isValidBankAccount),
  invoice_type: yup.string().optional().trim().oneOf(['', '专票', '普票'], '发票类型不正确')
})

const invoiceTypeOptions = [
  { label: '请选择', value: '' },
  { label: '增值税专用发票', value: '专票' },
  { label: '增值税普通发票', value: '普票' }
]

const defaultForm: CustomerCreateDTO = {
  code: '',
  name: '',
  group_name: '',
  contact: '',
  department: '',
  mobile: '',
  phone: '',
  fax: '',
  email: '',
  address: '',
  msn: '',
  company_type: '',
  industry: '',
  products: '',
  website: '',
  capital: '',
  country: '',
  province: '',
  city: '',
  reg_date: '',
  legal_rep_name: '',
  legal_rep_id_number: '',
  legal_rep_mobile: '',
  legal_rep_email: '',
  tax_number: '',
  bank_name: '',
  bank_account: '',
  invoice_type: '',
  custom1: '',
  custom2: '',
  custom3: '',
  custom4: ''
}

const { defineField, handleSubmit, resetForm, errors } = useForm<CustomerCreateDTO>({
  validationSchema: schema,
  initialValues: defaultForm
})

const [code] = defineField('code')
const [name] = defineField('name')
const [group_name] = defineField('group_name')
const [contact] = defineField('contact')
const [department] = defineField('department')
const [mobile] = defineField('mobile')
const [phone] = defineField('phone')
const [fax] = defineField('fax')
const [email] = defineField('email')
const [address] = defineField('address')
const [msn] = defineField('msn')
const [company_type] = defineField('company_type')
const [industry] = defineField('industry')
const [products] = defineField('products')
const [website] = defineField('website')
const [capital] = defineField('capital')
const [country] = defineField('country')
const [province] = defineField('province')
const [city] = defineField('city')
const [reg_date] = defineField('reg_date')
const [tax_number] = defineField('tax_number')
const [bank_name] = defineField('bank_name')
const [bank_account] = defineField('bank_account')
const [invoice_type] = defineField('invoice_type')
const [custom1] = defineField('custom1')
const [custom2] = defineField('custom2')
const [custom3] = defineField('custom3')
const [custom4] = defineField('custom4')

const contactItemSchema: yup.ObjectSchema<Pick<CustomerContact, 'name' | 'department' | 'mobile' | 'phone' | 'email' | 'id_number' | 'is_primary' | 'is_legal_representative'>> = yup.object({
  name: yup.string().trim().max(50, '姓名最多50字符').when(['department', 'mobile', 'phone', 'email', 'id_number'], {
    is: (...vals: unknown[]) => vals.some(v => String(v ?? '').trim() !== ''),
    then: s => s.required('联系人姓名不能为空'),
    otherwise: s => s.optional()
  }),
  department: yup.string().trim().max(50, '部门最多50字符').optional(),
  mobile: yup.string().trim().test('mobile11', '手机号必须为11位', isValidMobile11).optional(),
  phone: yup.string().trim().test('phoneLike', '电话格式不正确', isValidPhoneLike).optional(),
  email: yup.string().trim().test('email', '邮箱格式不正确', isValidEmail).max(100, '邮箱最多100字符').optional(),
  id_number: yup.string().trim().test('idcard', '身份证号格式不正确', isValidChineseIdCard).optional(),
  is_primary: yup.boolean().required(),
  is_legal_representative: yup.boolean().required()
})

const validateLegalFields = (): boolean => {
  const name = String(legalRepName.value ?? '').trim()
  const idNumber = String(legalRepIdNumber.value ?? '').trim()
  const mobileValue = String(legalRepMobile.value ?? '').trim()
  const emailValue = String(legalRepEmail.value ?? '').trim()
  const hasAny = Boolean(name || idNumber || mobileValue || emailValue)

  const nextErrors: { name?: string; idNumber?: string; mobile?: string; email?: string } = {}
  if (hasAny && !name) nextErrors.name = '法人姓名不能为空'
  if (idNumber && !isValidChineseIdCard(idNumber)) nextErrors.idNumber = '身份证号格式不正确'
  if (mobileValue && !isValidMobile11(mobileValue)) nextErrors.mobile = '手机号必须为11位'
  if (emailValue && !isValidEmail(emailValue)) nextErrors.email = '邮箱格式不正确'
  legalErrors.value = nextErrors
  return Object.keys(nextErrors).length === 0
}

const normalizeContactsForSave = (raw: CustomerContact[]): CustomerContact[] => {
  const cleaned = raw.map(c => ({
    ...c,
    name: String(c.name ?? '').trim(),
    department: String(c.department ?? '').trim(),
    mobile: String(c.mobile ?? '').trim(),
    phone: String(c.phone ?? '').trim(),
    email: String(c.email ?? '').trim(),
    id_number: String(c.id_number ?? '').trim()
  }))
  const nonEmpty = cleaned.filter(c => {
    const allEmpty = !c.name && !c.department && !c.mobile && !c.phone && !c.email && !c.id_number
    return !allEmpty
  })
  if (nonEmpty.length === 0) return []

  const primaryCount = nonEmpty.filter(c => c.is_primary).length
  if (primaryCount !== 1) {
    nonEmpty.forEach((c, idx) => { c.is_primary = idx === 0 })
  }
  return nonEmpty
}

const validateContacts = async (): Promise<boolean> => {
  contactErrors.value = {}
  const cleaned = normalizeContactsForSave(contacts.value)
  contacts.value = cleaned
  if (cleaned.length === 0) return true

  const nextErrors: Record<string, Partial<Record<ContactErrorField, string>>> = {}

  const primaryCount = cleaned.filter(c => c.is_primary).length
  if (primaryCount !== 1) {
    const firstId = cleaned[0]?.id
    if (firstId) {
      nextErrors[firstId] = { ...(nextErrors[firstId] || {}), name: '必须设置一个主联系人' }
    }
  }

  const legalCount = cleaned.filter(c => c.is_legal_representative).length
  if (legalCount > 1) {
    cleaned
      .filter(c => c.is_legal_representative)
      .forEach((c, idx) => {
        if (idx === 0) return
        nextErrors[c.id] = { ...(nextErrors[c.id] || {}), department: '法人联系人只能有一个' }
      })
  }

  for (let i = 0; i < cleaned.length; i += 1) {
    try {
      await contactItemSchema.validate(cleaned[i], { abortEarly: false })
    } catch (e) {
      const err = e as yup.ValidationError
      for (const inner of err.inner || []) {
        const field = String(inner.path || '').split('.').pop() as ContactErrorField
        if (!field) continue
        nextErrors[cleaned[i].id] = { ...(nextErrors[cleaned[i].id] || {}), [field]: inner.message }
      }
    }
  }

  contactErrors.value = nextErrors
  return Object.keys(nextErrors).length === 0
}

watch(() => props.visible, (newVal) => {
  if (newVal) {
    activeTab.value = 'basic'
    contactErrors.value = {}
    legalErrors.value = {}
    if (props.isEdit && props.initialData) {
      resetForm({
        values: {
          code: props.initialData.code || '',
          name: props.initialData.name || '',
          group_name: props.initialData.group_name || '',
          address: props.initialData.address || '',
          msn: props.initialData.msn || '',
          company_type: props.initialData.company_type || '',
          industry: props.initialData.industry || '',
          products: props.initialData.products || '',
          website: props.initialData.website || '',
          capital: props.initialData.capital || '',
          country: props.initialData.country || '',
          province: props.initialData.province || '',
          city: props.initialData.city || '',
          reg_date: props.initialData.reg_date || '',
          legal_rep_name: props.initialData.legal_rep_name || '',
          legal_rep_id_number: props.initialData.legal_rep_id_number || '',
          legal_rep_mobile: props.initialData.legal_rep_mobile || '',
          legal_rep_email: props.initialData.legal_rep_email || '',
          tax_number: props.initialData.tax_number || '',
          bank_name: props.initialData.bank_name || '',
          bank_account: props.initialData.bank_account || '',
          invoice_type: props.initialData.invoice_type || '',
          custom1: props.initialData.custom1 || '',
          custom2: props.initialData.custom2 || '',
          custom3: props.initialData.custom3 || '',
          custom4: props.initialData.custom4 || ''
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
      resetForm({ values: { ...defaultForm, code: IdGenerator.generateCode('CUS') } })
      regDateValue.value = null
      contacts.value = []
      legalRepName.value = ''
      legalRepIdNumber.value = ''
      legalRepMobile.value = ''
      legalRepEmail.value = ''
    }
  }
})

watch([legalRepName, legalRepIdNumber, legalRepMobile, legalRepEmail], () => {
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

const getTabForField = (field: string): 'basic' | 'contact' | 'company' | 'custom' => {
  const basicFields = new Set(['code', 'name', 'group_name', 'reg_date', 'tax_number', 'bank_name', 'bank_account', 'invoice_type'])
  const contactFields = new Set(['contact', 'department', 'mobile', 'phone', 'fax', 'email'])
  const companyFields = new Set(['address', 'msn', 'company_type', 'industry', 'products', 'website', 'capital', 'country', 'province', 'city'])
  const customFields = new Set(['custom1', 'custom2', 'custom3', 'custom4'])

  if (basicFields.has(field)) return 'basic'
  if (contactFields.has(field)) return 'contact'
  if (companyFields.has(field)) return 'company'
  if (customFields.has(field)) return 'custom'
  return 'basic'
}

const focusFirstInvalid = async () => {
  await nextTick()
  const root = scrollContainer.value
  if (!root) return
  const el = root.querySelector('.p-invalid, [aria-invalid="true"]') as HTMLElement | null
  if (!el) return
  el.scrollIntoView({ block: 'center' })
  if (typeof (el as any).focus === 'function') (el as any).focus()
}

const handleSave = handleSubmit(async (values) => {
  try {
    const legalOk = validateLegalFields()
    if (!legalOk) {
      activeTab.value = 'basic'
      toast.add({ severity: 'warn', summary: '校验未通过', detail: legalErrors.value.name || legalErrors.value.idNumber || legalErrors.value.mobile || legalErrors.value.email || '请检查表单填写', life: 3000 })
      await focusFirstInvalid()
      return
    }

    const contactsOk = await validateContacts()
    if (!contactsOk) {
      activeTab.value = 'contact'
      toast.add({ severity: 'warn', summary: '校验未通过', detail: '请检查联系人信息填写', life: 3000 })
      await focusFirstInvalid()
      return
    }

    saving.value = true
    const primaryContact = contacts.value.find(c => c.is_primary) || contacts.value[0]
    const payload: CustomerCreateDTO = {
      ...values,
      name: values.name.trim(),
      code: values.code?.trim() || IdGenerator.generateCode('CUS'),
      group_name: values.group_name?.trim(),
      // Sync primary contact info to top-level fields for compatibility
      contact: primaryContact?.name || '',
      department: primaryContact?.department || '',
      mobile: primaryContact?.mobile || '',
      phone: primaryContact?.phone || '',
      email: primaryContact?.email || '',
      
      address: values.address?.trim(),
      msn: values.msn?.trim(),
      company_type: values.company_type?.trim(),
      industry: values.industry?.trim(),
      products: values.products?.trim(),
      website: values.website?.trim(),
      capital: values.capital?.trim(),
      country: values.country?.trim(),
      province: values.province?.trim(),
      city: values.city?.trim(),
      reg_date: values.reg_date?.trim(),
      legal_rep_name: legalRepName.value.trim(),
      legal_rep_id_number: legalRepIdNumber.value.trim(),
      legal_rep_mobile: legalRepMobile.value.trim(),
      legal_rep_email: legalRepEmail.value.trim(),
      tax_number: values.tax_number?.trim(),
      bank_name: values.bank_name?.trim(),
      bank_account: values.bank_account?.trim(),
      invoice_type: values.invoice_type?.trim(),
      custom1: values.custom1?.trim(),
      custom2: values.custom2?.trim(),
      custom3: values.custom3?.trim(),
      custom4: values.custom4?.trim(),
      contacts: JSON.stringify(contacts.value)
    }

    let result
    if (props.isEdit && props.initialData) {
      const updateDto: CustomerUpdateDTO = {
        id: props.initialData.id,
        ...payload
      }
      result = await window.electronAPI.customer.update(updateDto)
    } else {
      result = await window.electronAPI.customer.create(payload)
    }
    
    if (result.success) {
      toast.add({ severity: 'success', summary: '成功', detail: props.isEdit ? '修改成功' : '新增成功', life: 3000 })
      emit('save', result.data)
      emit('update:visible', false)
    } else {
      toast.add({ severity: 'error', summary: '保存失败', detail: result.error || '未知错误', life: 3000 })
    }
  } catch (error) {
    logger.error('Failed to save customer', error)
    toast.add({ severity: 'error', summary: '保存失败', detail: '出现异常', life: 3000 })
  } finally {
    saving.value = false
  }
}, async ({ errors }) => {
  const keys = Object.keys(errors || {})
  const firstKey = keys[0]
  if (firstKey) {
    activeTab.value = getTabForField(firstKey)
    toast.add({ severity: 'warn', summary: '校验未通过', detail: errors[firstKey] || '请检查表单填写', life: 3000 })
    await focusFirstInvalid()
  } else {
    toast.add({ severity: 'warn', summary: '校验未通过', detail: '请检查表单填写', life: 3000 })
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
