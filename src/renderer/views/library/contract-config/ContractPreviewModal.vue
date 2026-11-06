<template>
  <Dialog :visible="visible" modal header="表单预览" :style="{ width: '760px' }" @update:visible="$emit('update:visible', $event)">
    <div class="mb-4 text-[var(--content-text-secondary)]">
      当前合同类型将按此 schema 在弹窗与详情中展示字段
    </div>
    <Tabs value="base">
      <TabList>
        <Tab v-for="section in previewSections" :key="section.key" :value="section.key">
          <span class="flex items-center gap-2"><span>{{ section.title }}</span></span>
        </Tab>
      </TabList>

      <TabPanels>
        <TabPanel v-for="section in previewSections" :key="section.key" :value="section.key">
          <div class="max-h-[60vh] overflow-y-auto py-4 pr-2">
            <div v-if="section.fields.length === 0" class="flex min-h-48 items-center justify-center rounded-xl border border-dashed border-[var(--content-border)] text-sm text-[var(--content-text-secondary)]">
              当前分区没有可展示字段
            </div>
            <div v-else class="grid grid-cols-2 gap-4">
              <div
                v-for="field in section.fields"
                :key="field.key"
                class="flex flex-col gap-1"
                :class="field.span === 2 ? 'col-span-2' : ''"
              >
                <div class="flex items-center gap-2">
                  <label class="text-sm font-medium text-[var(--content-text)]">
                    {{ field.label }}
                    <span v-if="field.required" class="text-red-500">*</span>
                  </label>
                </div>
                <InputText
                  v-if="field.type === 'text'"
                  v-model="previewData[field.key]"
                  :placeholder="field.placeholder || `请输入${field.label}`"
                  class="w-full"
                />
                <InputNumber
                  v-else-if="field.type === 'number'"
                  v-model="previewData[field.key]"
                  :placeholder="field.placeholder || `请输入${field.label}`"
                  class="w-full"
                />
                <Textarea
                  v-else-if="field.type === 'textarea'"
                  v-model="previewData[field.key]"
                  :placeholder="field.placeholder || `请输入${field.label}`"
                  rows="3"
                  class="w-full"
                />
                <Select
                  v-else-if="field.type === 'select'"
                  v-model="previewData[field.key]"
                  :options="getFieldOptions(field)"
                  option-label="label"
                  option-value="value"
                  filter
                  :placeholder="field.placeholder || `请选择${field.label}`"
                  class="w-full"
                />
                <MultiSelect
                  v-else-if="field.type === 'multiselect'"
                  v-model="previewData[field.key]"
                  :options="getFieldOptions(field)"
                  option-label="label"
                  option-value="value"
                  display="chip"
                  filter
                  :placeholder="field.placeholder || `请选择${field.label}`"
                  class="w-full"
                />
                <TreeSelect
                  v-else-if="field.type === 'tree'"
                  v-model="previewData[field.key]"
                  :options="getFieldTreeOptions(field)"
                  selectionMode="single"
                  filter
                  showClear
                  :placeholder="field.placeholder || `请选择${field.label}`"
                  class="w-full"
                />
                <Editor
                  v-else-if="field.type === 'richtext'"
                  v-model="previewData[field.key]"
                  editor-style="height: 120px"
                  class="w-full"
                />
                <DatePicker
                  v-else-if="field.type === 'date'"
                  v-model="previewData[field.key]"
                  date-format="yy-mm-dd"
                  show-icon
                  :placeholder="field.placeholder || `请选择${field.label}`"
                  class="w-full"
                />
              </div>
            </div>
          </div>
        </TabPanel>
      </TabPanels>
    </Tabs>
  </Dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import Dialog from 'primevue/dialog'
import Tabs from 'primevue/tabs'
import TabList from 'primevue/tablist'
import Tab from 'primevue/tab'
import TabPanels from 'primevue/tabpanels'
import TabPanel from 'primevue/tabpanel'
import InputText from 'primevue/inputtext'
import InputNumber from 'primevue/inputnumber'
import Textarea from 'primevue/textarea'
import Select from 'primevue/select'
import MultiSelect from 'primevue/multiselect'
import TreeSelect from 'primevue/treeselect'
import Editor from 'primevue/editor'
import DatePicker from 'primevue/datepicker'
import { createRendererLogger } from '@/utils/logger'
import type { ContractFormSchemaField } from '../../../../shared/types/contractFormSchema.types'
import { isContractFieldInDefaultTab, isContractFieldInExtendedTab, normalizeContractFormSchema } from '../../../../shared/utils/contractFormSchema'

const logger = createRendererLogger('ContractPreviewModal')

type SelectOption = {
  label: string
  value: string
}

type TreeDictionaryItem = {
  id: string
  parent_id: string
  name: string
  value?: string | null
}

type TreeNodeOption = {
  key: string
  label: string
  data: string
  children?: TreeNodeOption[]
}

const props = defineProps<{
  visible: boolean
  fields: ContractFormSchemaField[]
  title?: string
}>()

defineEmits<{
  (e: 'update:visible', value: boolean): void
}>()

const previewData = ref<Record<string, any>>({})
const dynamicOptionsMap = ref<Record<string, SelectOption[]>>({})
const dynamicTreeOptionsMap = ref<Record<string, TreeNodeOption[]>>({})
const rawCustomers = ref<any[]>([])
const rawSuppliers = ref<any[]>([])

const toSelectOptions = (items: Array<{ name?: string; value?: string | null }>): SelectOption[] => {
  return items
    .map(item => {
      const rawValue = String(item.value || '').trim()
      const value = rawValue || String(item.name || '').trim()
      const label = String(item.name || value).trim()
      return value && label ? { label, value } : null
    })
    .filter((item): item is SelectOption => Boolean(item))
}

const toPartyAUnitOptions = (items: Array<{ name?: string; client_name?: string }>): SelectOption[] => {
  return items
    .map(item => {
      const value = String(item.name || item.client_name || '').trim()
      return value ? { label: value, value } : null
    })
    .filter((item): item is SelectOption => Boolean(item))
}

const toPartyBUnitOptions = (items: Array<{ name?: string }>): SelectOption[] => {
  return items
    .map(item => {
      const value = String(item.name || '').trim()
      return value ? { label: value, value } : null
    })
    .filter((item): item is SelectOption => Boolean(item))
}

const buildIndentedTreeOptions = (items: TreeDictionaryItem[]): SelectOption[] => {
  const grouped = new Map<string, TreeDictionaryItem[]>()
  for (const item of items) {
    const parentId = String(item.parent_id || '')
    const list = grouped.get(parentId) ?? []
    list.push(item)
    grouped.set(parentId, list)
  }
  const itemIds = new Set(items.map(item => String(item.id)))
  const rootParents = new Set<string>()
  for (const item of items) {
    const parentId = String(item.parent_id || '')
    if (!parentId || parentId === '0' || !itemIds.has(parentId)) {
      rootParents.add(parentId)
    }
  }
  const roots: TreeDictionaryItem[] = []
  for (const parentId of rootParents) {
    roots.push(...(grouped.get(parentId) ?? []))
  }
  const options: SelectOption[] = []
  const visit = (node: TreeDictionaryItem, level: number) => {
    const rawValue = String(node.value || '').trim()
    const value = rawValue || String(node.name || '').trim()
    if (value) {
      options.push({
        label: `${'—'.repeat(level)}${node.name}`,
        value,
      })
    }
    for (const child of grouped.get(String(node.id)) ?? []) {
      visit(child, level + 1)
    }
  }
  roots.forEach(root => visit(root, 0))
  return options
}

const buildFlatTreeNodes = (options: SelectOption[]): TreeNodeOption[] => {
  return options.map(option => ({
    key: option.value,
    label: option.label,
    data: option.value,
    children: [],
  }))
}

const buildTreeSelectNodes = (items: TreeDictionaryItem[]): TreeNodeOption[] => {
  const grouped = new Map<string, TreeDictionaryItem[]>()
  for (const item of items) {
    const parentId = String(item.parent_id || '')
    const list = grouped.get(parentId) ?? []
    list.push(item)
    grouped.set(parentId, list)
  }
  const itemIds = new Set(items.map(item => String(item.id)))
  const rootParents = new Set<string>()
  for (const item of items) {
    const parentId = String(item.parent_id || '')
    if (!parentId || parentId === '0' || !itemIds.has(parentId)) {
      rootParents.add(parentId)
    }
  }
  const visit = (node: TreeDictionaryItem): TreeNodeOption => {
    const rawValue = String(node.value || '').trim()
    const value = rawValue || String(node.name || '').trim()
    return {
      key: value,
      label: String(node.name || value).trim(),
      data: value,
      children: (grouped.get(String(node.id)) ?? []).map(visit),
    }
  }
  const roots: TreeNodeOption[] = []
  for (const parentId of rootParents) {
    roots.push(...(grouped.get(parentId) ?? []).map(visit))
  }
  return roots
}

const getManualFieldOptions = (field: ContractFormSchemaField): SelectOption[] => {
  if (Array.isArray(field.options) && field.options.length > 0) {
    return field.options.map(option => ({ label: option, value: option }))
  }
  return [
    { label: '示例选项1', value: '示例选项1' },
    { label: '示例选项2', value: '示例选项2' },
    { label: '示例选项3', value: '示例选项3' },
  ]
}

const onPartyAChange = (unitName: string) => {
  const selectedName = String(unitName || '').trim()
  const customer = rawCustomers.value.find(item => (item.name || item.client_name) === selectedName)
  if (!customer) {
    dynamicOptionsMap.value['partyAContact'] = []
    if (previewData.value['partyAContact']) previewData.value['partyAContact'] = ''
    return
  }
  const contactText = customer.contact || customer.contact_person || customer.responsible_person || ''
  const contacts = String(contactText).split(/[,，、/ ]/).filter(Boolean)
  const options = contacts.map((item: string) => ({ label: item, value: item }))
  dynamicOptionsMap.value['partyAContact'] = options
  if (contacts.length > 0 && !previewData.value['partyAContact']) {
    previewData.value['partyAContact'] = contacts[0]
  }
}

const onPartyBChange = (unitName: string) => {
  const selectedName = String(unitName || '').trim()
  const supplier = rawSuppliers.value.find(item => item.name === selectedName)
  if (!supplier) {
    dynamicOptionsMap.value['partyBContact'] = []
    if (previewData.value['partyBContact']) previewData.value['partyBContact'] = ''
    return
  }
  let parsedContacts: string[] = []
  try {
    if (supplier.contacts) {
      const parsed = JSON.parse(supplier.contacts)
      if (Array.isArray(parsed)) {
        parsedContacts = parsed.map((c: any) => c.name).filter(Boolean)
      }
    }
  } catch (e) {
    logger.error('解析乙方联系人失败:', e)
  }

  if (parsedContacts.length === 0) {
    const contactText = supplier.contact || supplier.contact_person || supplier.responsible_person || ''
    parsedContacts = String(contactText).split(/[,，、/ ]/).filter(Boolean)
  }

  const options = parsedContacts.map((item: string) => ({ label: item, value: item }))
  dynamicOptionsMap.value['partyBContact'] = options
  if (parsedContacts.length > 0 && !previewData.value['partyBContact']) {
    previewData.value['partyBContact'] = parsedContacts[0]
  }
}

const loadDynamicFieldOptions = async () => {
  const targetFields = normalizedFields.value.filter(field => {
    if (field.type !== 'select' && field.type !== 'multiselect' && field.type !== 'tree') {
      return false
    }
    return Boolean(field.optionSource?.groupName)
  })
  if (targetFields.length === 0) {
    dynamicOptionsMap.value = {}
    dynamicTreeOptionsMap.value = {}
    return
  }

  const sourceTasks = Array.from(
    new Map(
      targetFields.map(field => {
        const source = field.optionSource!
        return [`${source.type}:${source.groupName}`, source] as const
      }),
    ).values(),
  )

  const taskResults = await Promise.all(
    sourceTasks.map(async source => {
      if (source.type === 'partyAUnit') {
        const result = await window.electronAPI.customer.getList({ page: 1, pageSize: 1000 })
        if (result.success && result.data) {
          rawCustomers.value = result.data.data as any[]
        }
        const options = result.success && result.data ? toPartyAUnitOptions(result.data.data as Array<{ name?: string; client_name?: string }>) : []
        return {
          cacheKey: `${source.type}:${source.groupName}`,
          options,
          treeNodes: buildFlatTreeNodes(options),
        }
      }
      if (source.type === 'partyBUnit') {
        const result = await window.electronAPI.supplier.getList({ page: 1, pageSize: 1000 })
        if (result.success && result.data) {
          rawSuppliers.value = result.data.data as any[]
        }
        const options = result.success && result.data ? toPartyBUnitOptions(result.data.data as Array<{ name?: string }>) : []
        return {
          cacheKey: `${source.type}:${source.groupName}`,
          options,
          treeNodes: buildFlatTreeNodes(options),
        }
      }
      if (source.type === 'treeDictionary') {
        const result = await window.electronAPI.treeDictionary.getList({ group_name: source.groupName, page: 1, pageSize: 1000 })
        if (!result.success || !result.data) {
          return {
            cacheKey: `${source.type}:${source.groupName}`,
            options: [],
            treeNodes: [],
          }
        }
        const items = result.data.data as unknown as TreeDictionaryItem[]
        return {
          cacheKey: `${source.type}:${source.groupName}`,
          options: buildIndentedTreeOptions(items),
          treeNodes: buildTreeSelectNodes(items),
        }
      }
      const result = await window.electronAPI.dictionary.getList({ group_name: source.groupName, page: 1, pageSize: 1000 })
      if (!result.success || !result.data) {
        return {
          cacheKey: `${source.type}:${source.groupName}`,
          options: [],
          treeNodes: [],
        }
      }
      const options = toSelectOptions(result.data.data)
      return {
        cacheKey: `${source.type}:${source.groupName}`,
        options,
        treeNodes: buildFlatTreeNodes(options),
      }
    }),
  )

  const optionSourceMap = new Map<string, { options: SelectOption[]; treeNodes: TreeNodeOption[] }>()
  taskResults.forEach(result => {
    optionSourceMap.set(result.cacheKey, {
      options: result.options,
      treeNodes: result.treeNodes,
    })
  })

  dynamicOptionsMap.value = Object.fromEntries(
    targetFields.map(field => {
      const source = field.optionSource!
      const cacheKey = `${source.type}:${source.groupName}`
      return [field.key, optionSourceMap.get(cacheKey)?.options ?? []]
    }),
  )
  dynamicTreeOptionsMap.value = Object.fromEntries(
    targetFields.map(field => {
      const source = field.optionSource!
      const cacheKey = `${source.type}:${source.groupName}`
      return [field.key, optionSourceMap.get(cacheKey)?.treeNodes ?? []]
    }),
  )

  // 初始触发一次联动
  if (previewData.value['clientName']) {
    onPartyAChange(previewData.value['clientName'])
  }
  if (previewData.value['partyBName']) {
    onPartyBChange(previewData.value['partyBName'])
  }
}

const getFieldOptions = (field: ContractFormSchemaField): SelectOption[] => {
  const dynamicOptions = dynamicOptionsMap.value[field.key]
  if (dynamicOptions && dynamicOptions.length > 0) {
    return dynamicOptions
  }
  return getManualFieldOptions(field)
}

const getFieldTreeOptions = (field: ContractFormSchemaField): TreeNodeOption[] => {
  const dynamicOptions = dynamicTreeOptionsMap.value[field.key]
  if (dynamicOptions && dynamicOptions.length > 0) {
    return dynamicOptions
  }
  return buildFlatTreeNodes(getManualFieldOptions(field))
}

watch(() => previewData.value['clientName'], (newVal) => {
  onPartyAChange(newVal)
})

watch(() => previewData.value['partyBName'], (newVal) => {
  onPartyBChange(newVal)
})

watch(() => props.visible, (newVal) => {
  if (newVal) {
    previewData.value = {}
    void loadDynamicFieldOptions()
  }
})

watch(() => props.fields, () => {
  if (props.visible) {
    void loadDynamicFieldOptions()
  }
}, { deep: true })

const sectionOptions = [
  { label: '基础信息', value: 'base' },
  { label: '合同内容', value: 'content' },
]

const normalizedFields = computed(() => {
  return normalizeContractFormSchema(props.fields).fields
})

const previewSections = computed(() => {
  const visibleFields = normalizedFields.value.filter(field => field.visible)

  return [
    {
      key: 'base',
      title: '基础信息',
      fields: visibleFields.filter(field => field.section === 'base' && isContractFieldInDefaultTab(field)),
    },
    {
      key: 'extended',
      title: props.title || '拓展字段',
      fields: visibleFields.filter(field => isContractFieldInExtendedTab(field)),
    },
    ...sectionOptions
      .filter(section => section.value !== 'base')
      .map(section => ({
        key: section.value,
        title: section.label,
        fields: visibleFields.filter(field => field.section === section.value && isContractFieldInDefaultTab(field)),
      })),
  ]
})
</script>
