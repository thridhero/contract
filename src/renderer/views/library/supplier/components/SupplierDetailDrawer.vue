<template>
  <Drawer
    v-model:visible="visible"
    position="right"
    class="!w-[520px] p-0 custom-drawer"
    :showCloseIcon="false"
    @hide="onHide"
  >
    <template #header>
      <div class="flex items-center justify-between w-full h-20 px-8 border-b border-[var(--content-border)] bg-[var(--content-bg)]">
        <div class="flex items-center gap-4">
          <div class="w-10 h-10 rounded-lg bg-[var(--sidebar-active-bg)] flex items-center justify-center text-[var(--btn-primary-bg)]">
            <i class="pi pi-briefcase text-2xl"></i>
          </div>
          <div>
            <h2 class="text-xl font-bold tracking-tight text-[var(--content-text)]">乙方单位详情</h2>
            <p class="text-xs font-semibold uppercase tracking-widest text-[var(--content-text-secondary)]">Supplier Information View</p>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <button
            type="button"
            class="p-2 hover:bg-[var(--sidebar-hover-bg)] rounded-full transition-colors text-[var(--content-text-secondary)] disabled:opacity-40 disabled:hover:bg-transparent"
            title="一键复制信息"
            :disabled="!supplier || copyingInfo"
            @click="copySupplierInfo"
          >
            <i :class="copyingInfo ? 'pi pi-spin pi-spinner' : 'pi pi-copy'"></i>
          </button>
          <button
            type="button"
            @click="visible = false"
            class="p-2 hover:bg-[var(--sidebar-hover-bg)] rounded-full transition-colors text-[var(--content-text-secondary)]"
          >
            <i class="pi pi-times"></i>
          </button>
        </div>
      </div>
    </template>

    <div class="flex flex-col h-full bg-[var(--content-bg)]" v-if="supplier">
      <div class="flex-1 overflow-y-auto px-8 py-8 space-y-6 scroll-smooth custom-scrollbar">
        <!-- Hero Info Card -->
        <section class="relative p-6 rounded-xl bg-[var(--content-card-bg)] border border-[var(--content-border)] overflow-hidden shadow-sm">
          <div class="relative z-10">
            <div class="flex items-center gap-3 mb-3">
              <span class="px-2.5 py-1 rounded bg-[var(--btn-primary-bg)] text-[var(--btn-primary-text)] text-[10px] font-bold tracking-wider">
                {{ supplier.code }}
              </span>
              <span class="px-2.5 py-1 rounded bg-[var(--sidebar-active-bg)] text-[var(--btn-primary-bg)] text-[10px] font-bold tracking-wider">
                {{ supplier.group_name || '未分组' }}
              </span>
            </div>
            <h1 class="text-3xl font-black text-[var(--content-text)] tracking-tighter">{{ supplier.name }}</h1>
          </div>
          <div class="absolute -right-4 -bottom-4 w-32 h-32 bg-[var(--btn-primary-bg)] opacity-10 rounded-full blur-3xl"></div>
        </section>

        <div class="grid grid-cols-1 gap-6">
          
          <div
            v-if="supplier.reg_date || supplier.legal_rep_name || supplier.legal_rep_id_number || supplier.legal_rep_mobile || supplier.legal_rep_email"
            class="space-y-4 p-6 rounded-xl bg-[var(--content-card-bg)] border border-[var(--content-border)] shadow-sm"
          >
            <div class="flex items-center gap-2 mb-2">
              <i class="pi pi-id-card text-[var(--btn-primary-bg)] text-lg"></i>
              <h3 class="font-bold text-[var(--content-text)] tracking-wide uppercase">法人信息</h3>
            </div>
            <div class="grid grid-cols-2 gap-x-8 gap-y-4">
              <div class="space-y-1">
                <label class="block text-[10px] font-bold text-[var(--content-text-secondary)] uppercase tracking-widest">法人姓名</label>
                <p class="font-semibold text-[var(--content-text)]">{{ supplier.legal_rep_name || '-' }}</p>
              </div>
              <div class="space-y-1">
                <label class="block text-[10px] font-bold text-[var(--content-text-secondary)] uppercase tracking-widest">注册日期</label>
                <p class="font-semibold text-[var(--content-text)]">{{ supplier.reg_date || '-' }}</p>
              </div>
              <div class="space-y-1">
                <label class="block text-[10px] font-bold text-[var(--content-text-secondary)] uppercase tracking-widest">法人身份证号</label>
                <p class="font-semibold text-[var(--content-text)]">{{ supplier.legal_rep_id_number || '-' }}</p>
              </div>
              <div class="space-y-1">
                <label class="block text-[10px] font-bold text-[var(--content-text-secondary)] uppercase tracking-widest">法人手机号</label>
                <p class="font-semibold text-[var(--content-text)]">{{ supplier.legal_rep_mobile || '-' }}</p>
              </div>
              <div class="space-y-1 col-span-2">
                <label class="block text-[10px] font-bold text-[var(--content-text-secondary)] uppercase tracking-widest">法人邮箱</label>
                <p class="font-semibold text-[var(--content-text)]">{{ supplier.legal_rep_email || '-' }}</p>
              </div>
            </div>
          </div>

          <!-- Contact Section -->
          <div class="space-y-4 p-6 rounded-xl bg-[var(--content-card-bg)] border border-[var(--content-border)] shadow-sm">
            <div class="flex items-center justify-between mb-2">
              <div class="flex items-center gap-2">
                <i class="pi pi-user text-[var(--btn-primary-bg)] text-lg"></i>
                <h3 class="font-bold text-[var(--content-text)] tracking-wide uppercase">联系人</h3>
              </div>
              <span class="text-xs text-[var(--content-text-secondary)]" v-if="parsedContacts.length > 0">共 {{ parsedContacts.length }} 个联系人</span>
            </div>
            
            <div v-if="parsedContacts.length === 0" class="text-center py-6 bg-[var(--sidebar-bg)] rounded-lg text-[var(--content-text-secondary)] italic">
              未录入联系人信息
            </div>
            
            <div v-else class="space-y-3">
              <div v-for="c in parsedContacts" :key="c.id" class="p-4 rounded-lg bg-[var(--sidebar-bg)] border border-[var(--content-border)] relative">
                <div v-if="c.is_primary" class="absolute right-3 top-3 px-2 py-0.5 rounded bg-blue-500 text-white text-[10px] font-bold uppercase">主</div>
                <div v-if="c.is_legal_representative" class="absolute right-12 top-3 px-2 py-0.5 rounded bg-amber-500 text-white text-[10px] font-bold uppercase">法</div>
                <div class="flex items-center gap-3 mb-2">
                  <span class="font-bold text-[var(--content-text)] text-lg">{{ c.name }}</span>
                  <span class="px-2 py-0.5 rounded bg-[var(--content-border)] text-[var(--content-text-secondary)] text-[10px] font-bold" v-if="c.department">{{ c.department }}</span>
                </div>
                <div class="grid grid-cols-1 gap-2 text-[var(--content-text)]">
                  <div class="flex items-center gap-2" v-if="c.mobile">
                    <i class="pi pi-mobile text-blue-500/60"></i>
                    <span class="font-medium">{{ c.mobile }}</span>
                  </div>
                  <div class="flex items-center gap-2" v-if="c.phone">
                    <i class="pi pi-phone text-blue-500/60"></i>
                    <span class="font-medium">{{ c.phone }}</span>
                  </div>
                  <div class="flex items-center gap-2" v-if="c.email">
                    <i class="pi pi-envelope text-blue-500/60"></i>
                    <span class="font-medium">{{ c.email }}</span>
                  </div>
                  <div class="flex items-center gap-2" v-if="c.id_number">
                    <i class="pi pi-id-card text-blue-500/60"></i>
                    <span class="font-medium">{{ c.id_number }}</span>
                  </div>
                  <div class="flex items-center gap-2" v-if="c.wechat">
                    <i class="pi pi-comment text-green-500/60"></i>
                    <span class="font-medium">微信: {{ c.wechat }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Financial Section -->
          <div class="space-y-4 p-6 rounded-xl bg-[var(--content-card-bg)] border border-[var(--content-border)] shadow-sm">
            <div class="flex items-center gap-2 mb-2">
              <i class="pi pi-building-columns text-[var(--btn-primary-bg)] text-lg"></i>
              <h3 class="font-bold text-[var(--content-text)] tracking-wide uppercase">财务信息</h3>
            </div>
            <div class="grid grid-cols-2 gap-x-8 gap-y-4">
              <div class="space-y-1">
                <label class="block text-[10px] font-bold text-[var(--content-text-secondary)] uppercase tracking-widest">税号</label>
                <p class="font-semibold text-[var(--content-text)]">{{ supplier.tax_number || '-' }}</p>
              </div>
              <div class="space-y-1">
                <label class="block text-[10px] font-bold text-[var(--content-text-secondary)] uppercase tracking-widest">发票类型</label>
                <p class="font-semibold text-[var(--content-text)]">{{ supplier.invoice_type || '-' }}</p>
              </div>
              <div class="space-y-1">
                <label class="block text-[10px] font-bold text-[var(--content-text-secondary)] uppercase tracking-widest">开户行</label>
                <p class="font-semibold text-[var(--content-text)]">{{ supplier.bank_name || '-' }}</p>
              </div>
              <div class="space-y-1">
                <label class="block text-[10px] font-bold text-[var(--content-text-secondary)] uppercase tracking-widest">银行账号</label>
                <p class="font-semibold text-[var(--content-text)]">{{ supplier.bank_account || '-' }}</p>
              </div>
            </div>
          </div>

          <UnitDocumentSection owner-type="supplier" :owner-data="supplier" @owner-updated="handleOwnerUpdated" />

          <!-- Location Section -->
          <div class="space-y-4 p-6 rounded-xl bg-[var(--content-card-bg)] border border-[var(--content-border)] shadow-sm">
            <div class="flex items-center gap-2 mb-2">
              <i class="pi pi-map-marker text-[var(--btn-primary-bg)] text-lg"></i>
              <h3 class="font-bold text-[var(--content-text)] tracking-wide uppercase">地址信息</h3>
            </div>
            <div class="space-y-4">
              <div class="pt-3">
                <label class="block text-[10px] font-bold text-[var(--content-text-secondary)] uppercase tracking-widest mb-1">详细地址</label>
                <p class="leading-relaxed text-[var(--content-text)] font-medium">{{ supplier.address || '未填写' }}</p>
              </div>
            </div>
          </div>

        </div>
      </div>

      <!-- Drawer Footer -->
      <footer class="p-8 bg-[var(--content-bg)] border-t border-[var(--content-border)] flex items-center gap-3 shrink-0">
        <button @click="onEdit" class="flex-1 h-12 bg-[var(--btn-primary-bg)] hover:bg-[var(--btn-primary-hover)] active:bg-[var(--btn-primary-active)] text-[var(--btn-primary-text)] font-bold rounded-lg shadow-sm active:scale-[0.98] transition-all flex items-center justify-center gap-2">
          <i class="pi pi-file-edit text-lg"></i>
          <span>编辑</span>
        </button>
        <button @click="onOpenLibrary" class="px-6 h-12 border border-[var(--content-border)] text-[var(--content-text)] font-bold rounded-lg hover:bg-[var(--sidebar-hover-bg)] transition-colors flex items-center justify-center gap-2">
          <i class="pi pi-folder-open"></i>
          <span>进入资料库</span>
        </button>
        <button @click="visible = false" class="px-6 h-12 border border-[var(--content-border)] text-[var(--content-text)] font-bold rounded-lg hover:bg-[var(--sidebar-hover-bg)] transition-colors flex items-center justify-center gap-2">
          <span>关闭</span>
        </button>
      </footer>
    </div>
  </Drawer>
</template>

<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import Drawer from 'primevue/drawer'
import { useToast } from 'primevue/usetoast'
import { Supplier, SupplierContact } from '../../../../../shared/types/supplier.types'
import { copyTextToClipboard } from '../../contract-files/contractFilesHelpers'
import UnitDocumentSection from '@/components/unit-document/UnitDocumentSection.vue'

const props = defineProps<{
  modelValue: boolean
  supplierData: Supplier | null
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'edit', supplier: Supplier): void
  (e: 'open-library', supplier: Supplier): void
}>()

const toast = useToast()
const visible = ref(props.modelValue)
const supplier = ref<Supplier | null>(null)
const copyingInfo = ref(false)

const parsedContacts = computed<SupplierContact[]>(() => {
  if (!supplier.value?.contacts) return []
  try {
    const raw = JSON.parse(supplier.value.contacts) as unknown
    if (!Array.isArray(raw)) return []
    return raw.map((c: any) => ({
      id: String(c?.id || crypto.randomUUID()),
      name: String(c?.name || ''),
      department: String(c?.department || ''),
      mobile: String(c?.mobile || ''),
      phone: String(c?.phone || ''),
      email: String(c?.email || ''),
      id_number: String(c?.id_number || ''),
      wechat: String(c?.wechat || ''),
      is_primary: Boolean(c?.is_primary),
      is_legal_representative: Boolean(c?.is_legal_representative)
    }))
  } catch (e) {
    return []
  }
})

watch(() => props.modelValue, (newVal) => {
  visible.value = newVal
})

watch(() => props.supplierData, (newVal) => {
  supplier.value = newVal
}, { deep: true, immediate: true })

watch(visible, (newVal) => {
  emit('update:modelValue', newVal)
})

const onHide = () => {
  emit('update:modelValue', false)
}

const handleOwnerUpdated = (updated: Supplier | null) => {
  if (updated) {
    supplier.value = updated
  }
}

const onEdit = () => {
  if (supplier.value) {
    emit('edit', supplier.value)
    visible.value = false
  }
}

const onOpenLibrary = () => {
  if (supplier.value) {
    emit('open-library', supplier.value)
    visible.value = false
  }
}

const normalizeText = (value: unknown) => String(value ?? '').trim()

const isMeaningfulValue = (value: unknown) => {
  const text = normalizeText(value)
  if (!text) return false
  const lowered = text.toLowerCase()
  return text !== '-' && lowered !== 'null' && lowered !== 'undefined'
}

const appendKV = (lines: string[], label: string, value: unknown) => {
  if (!isMeaningfulValue(value)) return
  lines.push(`${label}: ${normalizeText(value)}`)
}

const buildSupplierCopyText = (info: Supplier, contacts: SupplierContact[]) => {
  const lines: string[] = []
  lines.push('乙方单位信息')
  appendKV(lines, '单位名称', info.name)
  appendKV(lines, '单位编号', info.code)
  appendKV(lines, '分组', info.group_name)
  appendKV(lines, '注册日期', info.reg_date)
  appendKV(lines, '联系人', info.contact)
  appendKV(lines, '电话', info.phone)
  appendKV(lines, '地址', info.address)
  appendKV(lines, '税号', info.tax_number)
  appendKV(lines, '发票类型', info.invoice_type)
  appendKV(lines, '开户行', info.bank_name)
  appendKV(lines, '银行账号', info.bank_account)

  if (
    isMeaningfulValue(info.legal_rep_name) ||
    isMeaningfulValue(info.legal_rep_id_number) ||
    isMeaningfulValue(info.legal_rep_mobile) ||
    isMeaningfulValue(info.legal_rep_email)
  ) {
    lines.push('')
    lines.push('法人信息')
    appendKV(lines, '法人姓名', info.legal_rep_name)
    appendKV(lines, '法人身份证号', info.legal_rep_id_number)
    appendKV(lines, '法人手机号', info.legal_rep_mobile)
    appendKV(lines, '法人邮箱', info.legal_rep_email)
  }

  if (contacts.length > 0) {
    lines.push('')
    lines.push(`联系人列表(${contacts.length})`)
    contacts.forEach((c, idx) => {
      const marks: string[] = []
      if (c.is_primary) marks.push('主')
      if (c.is_legal_representative) marks.push('法')
      const titleParts = [normalizeText(c.name), marks.length ? `[${marks.join(',')}]` : ''].filter(Boolean)

      const details: string[] = []
      if (isMeaningfulValue(c.department)) details.push(`部门:${normalizeText(c.department)}`)
      if (isMeaningfulValue(c.mobile)) details.push(`手机:${normalizeText(c.mobile)}`)
      if (isMeaningfulValue(c.phone)) details.push(`电话:${normalizeText(c.phone)}`)
      if (isMeaningfulValue(c.email)) details.push(`邮箱:${normalizeText(c.email)}`)
      if (isMeaningfulValue(c.wechat)) details.push(`微信:${normalizeText(c.wechat)}`)
      if (isMeaningfulValue(c.id_number)) details.push(`证件:${normalizeText(c.id_number)}`)

      lines.push(`${idx + 1}. ${titleParts.join(' ')}${details.length ? ` ${details.join(' ')}` : ''}`)
    })
  }

  return lines.join('\n').trim()
}

const copySupplierInfo = async () => {
  if (!supplier.value || copyingInfo.value) return
  copyingInfo.value = true
  try {
    const text = buildSupplierCopyText(supplier.value, parsedContacts.value)
    const ok = await copyTextToClipboard(text)
    if (ok) {
      toast.add({ severity: 'success', summary: '已复制', detail: '已复制乙方单位信息到剪贴板', life: 2000 })
    } else {
      toast.add({ severity: 'error', summary: '复制失败', detail: '无法写入剪贴板，请检查系统权限', life: 2500 })
    }
  } finally {
    copyingInfo.value = false
  }
}
</script>

<style>
/* 去除 Drawer 默认的 header padding */
.custom-drawer .p-drawer-header {
  padding: 0 !important;
}
.custom-drawer .p-drawer-content {
  padding: 0 !important;
  display: flex;
  flex-direction: column;
}
</style>
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
