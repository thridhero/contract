<template>
  <div :data-field-key="field.key" class="flex flex-col gap-1" :class="field.span === 2 ? 'col-span-2' : ''">
    <label class="text-sm font-medium text-[var(--content-text)]">
      {{ field.label }}
      <span v-if="field.required" class="text-red-500">*</span>
    </label>

    <InputText
      v-if="field.type === 'text'"
      :modelValue="textValue"
      :placeholder="field.placeholder || `请输入${field.label}`"
      class="w-full"
      :invalid="invalid"
      @update:modelValue="emit('update:modelValue', $event)"
    />

    <Textarea
      v-else-if="field.type === 'textarea'"
      :modelValue="textValue"
      :placeholder="field.placeholder || `请输入${field.label}`"
      rows="3"
      autoResize
      class="w-full"
      :invalid="invalid"
      @update:modelValue="emit('update:modelValue', $event)"
    />

    <InputNumber
      v-else-if="field.type === 'number'"
      :modelValue="numberValue"
      class="w-full"
      :min="0"
      :minFractionDigits="0"
      :maxFractionDigits="2"
      :invalid="invalid"
      @update:modelValue="emit('update:modelValue', $event)"
    />

    <DatePicker
      v-else-if="field.type === 'date'"
      :modelValue="dateValue"
      date-format="yy-mm-dd"
      class="w-full no-focus-shadow"
      show-icon
      :invalid="invalid"
      @update:modelValue="emit('update:modelValue', $event)"
    />

    <MultiSelect
      v-else-if="field.type === 'multiselect'"
      :modelValue="multiValue"
      :options="options"
      option-label="label"
      option-value="value"
      display="chip"
      filter
      showClear
      class="w-full"
      :placeholder="field.placeholder || `请选择${field.label}`"
      :invalid="invalid"
      @update:modelValue="emit('update:modelValue', $event)"
      @change="emit('change', $event)"
    />

    <TreeSelect
      v-else-if="field.type === 'tree'"
      :modelValue="treeValue"
      :options="treeOptions"
      selectionMode="single"
      filter
      showClear
      class="w-full"
      :placeholder="field.placeholder || `请选择${field.label}`"
      @update:modelValue="emit('update:modelValue', $event)"
      @change="emit('change', $event)"
    />

    <Select
      v-else-if="field.type === 'select'"
      :modelValue="textValue"
      :options="options"
      option-label="label"
      option-value="value"
      :placeholder="field.placeholder || `请选择${field.label}`"
      class="w-full"
      :invalid="invalid"
      :editable="selectEditable"
      :filter="selectFilter"
      showClear
      @update:modelValue="emit('update:modelValue', $event)"
      @change="emit('change', $event)"
    />

    <div v-else-if="field.type === 'richtext' && field.key === 'contractSummary'" class="flex flex-col gap-2">
      <Textarea
        :modelValue="textValue"
        :placeholder="field.placeholder || `请输入${field.label} Markdown 内容`"
        rows="8"
        autoResize
        class="w-full font-mono"
        :invalid="invalid"
        @update:modelValue="emit('update:modelValue', $event)"
      />
      <div class="rounded-md border p-3" :style="{ borderColor: 'var(--content-border)', backgroundColor: 'var(--content-bg)' }">
        <div class="mb-2 text-xs font-medium text-[var(--content-text-secondary)]">Markdown 预览</div>
        <div
          class="summary-markdown-preview min-h-[96px] text-[var(--content-text)]"
          v-html="summaryPreviewHtml"
        ></div>
      </div>
    </div>

    <Editor
      v-else-if="field.type === 'richtext'"
      :modelValue="textValue"
      class="w-full"
      editor-style="height: 180px"
      @update:modelValue="emit('update:modelValue', $event)"
    />

    <InputText
      v-else
      :modelValue="textValue"
      :placeholder="field.placeholder || `请输入${field.label}`"
      class="w-full"
      :invalid="invalid"
      @update:modelValue="emit('update:modelValue', $event)"
    />

    <small class="text-red-500 min-h-[16px]">{{ error || '' }}</small>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import InputText from 'primevue/inputtext'
import InputNumber from 'primevue/inputnumber'
import DatePicker from 'primevue/datepicker'
import Textarea from 'primevue/textarea'
import Select from 'primevue/select'
import MultiSelect from 'primevue/multiselect'
import TreeSelect from 'primevue/treeselect'
import Editor from 'primevue/editor'
import type { ContractFormSchemaField } from '../../../../../shared/types/contractFormSchema.types'
import { renderContractSummaryToHtml } from '../../../../utils/contractSummaryMarkdown'

type SelectOption = {
  label: string
  value: string
}

type TreeNodeOption = {
  key: string
  label: string
  data: string
  children?: TreeNodeOption[]
}

const props = withDefaults(defineProps<{
  field: ContractFormSchemaField
  modelValue: unknown
  error?: string
  invalid?: boolean
  options?: SelectOption[]
  treeOptions?: TreeNodeOption[]
  selectEditable?: boolean
  selectFilter?: boolean
}>(), {
  error: '',
  invalid: false,
  options: () => [],
  treeOptions: () => [],
  selectEditable: false,
  selectFilter: false,
})

const emit = defineEmits<{
  (e: 'update:modelValue', value: unknown): void
  (e: 'change', value: unknown): void
}>()

const textValue = computed(() => String(props.modelValue ?? ''))
const summaryPreviewHtml = computed(() => {
  const rendered = renderContractSummaryToHtml(textValue.value)
  return rendered || '<p class="text-[var(--content-text-secondary)]">暂无预览内容</p>'
})
const numberValue = computed(() => {
  if (props.modelValue === null || props.modelValue === undefined || props.modelValue === '') return null
  const value = Number(props.modelValue)
  return Number.isFinite(value) ? value : null
})
const dateValue = computed(() => {
  if (props.modelValue instanceof Date) return props.modelValue
  const text = String(props.modelValue ?? '').trim()
  if (!text) return null
  const value = new Date(text)
  return Number.isNaN(value.getTime()) ? null : value
})
const multiValue = computed(() => Array.isArray(props.modelValue) ? props.modelValue : [])
const treeValue = computed(() => {
  const v = props.modelValue as any
  if (v === null || v === undefined || v === '') return null
  if (typeof v === 'object' && !Array.isArray(v)) return v
  const key = String(v ?? '').trim()
  return key ? { [key]: true } : null
})
</script>

<style scoped>
.summary-markdown-preview :deep(p) {
  margin: 0 0 0.5rem;
  white-space: pre-wrap;
}

.summary-markdown-preview :deep(p:last-child) {
  margin-bottom: 0;
}

.summary-markdown-preview :deep(table) {
  width: 100%;
  border-collapse: collapse;
  margin: 0.5rem 0;
  font-size: 0.875rem;
}

.summary-markdown-preview :deep(th),
.summary-markdown-preview :deep(td) {
  border: 1px solid var(--content-border);
  padding: 0.375rem 0.5rem;
  text-align: left;
  vertical-align: top;
}

.summary-markdown-preview :deep(th) {
  background: color-mix(in srgb, var(--content-border) 30%, var(--content-bg));
  font-weight: 600;
}

.summary-markdown-preview :deep(ul),
.summary-markdown-preview :deep(ol) {
  margin: 0.5rem 0;
  padding-left: 1.25rem;
}

.summary-markdown-preview :deep(li + li) {
  margin-top: 0.25rem;
}

.summary-markdown-preview :deep(code) {
  background: color-mix(in srgb, var(--content-border) 28%, var(--content-bg));
  border-radius: 0.25rem;
  padding: 0.1rem 0.25rem;
}
</style>
