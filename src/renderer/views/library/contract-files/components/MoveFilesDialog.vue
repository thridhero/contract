<template>
  <Dialog
    :visible="visible"
    modal
    :closable="true"
    :draggable="false"
    :style="{ width: '520px' }"
    :header="dialogTitle"
    class="custom-dialog"
    @update:visible="(v) => emit('update:visible', v)"
  >
    <div class="flex flex-col gap-4 py-2">
      <div class="text-sm text-[var(--content-text-secondary)]">
        已选择 {{ selectedCount }} 项
      </div>

      <div v-if="mode === 'other-contract'" class="flex items-start">
        <label class="w-24 shrink-0 whitespace-nowrap text-right mr-3 mt-2 text-[var(--content-text)]">
          <span class="text-red-500">*</span> 目标合同
        </label>
        <div class="flex-1">
          <Select
            v-model="targetContractId"
            :options="contractOptions"
            optionLabel="label"
            optionValue="value"
            class="w-full"
            placeholder="请选择目标合同"
            @update:modelValue="(v) => emit('change-contract', v)"
          />
        </div>
      </div>

      <div class="flex items-start">
        <label class="w-24 shrink-0 whitespace-nowrap text-right mr-3 mt-2 text-[var(--content-text)]">
          <span class="text-red-500">*</span> 目标文件夹
        </label>
        <div class="flex-1">
          <TreeSelect
            v-model="treeSelectValue"
            :options="folderTreeOptions"
            selectionMode="single"
            placeholder="请选择目标文件夹"
            class="w-full"
            :max-height="300"
          />
        </div>
      </div>

      <div class="flex items-start">
        <label class="w-24 shrink-0 whitespace-nowrap text-right mr-3 mt-2 text-[var(--content-text)]">
          冲突处理
        </label>
        <div class="flex-1">
          <Select
            v-model="conflictStrategy"
            :options="conflictStrategyOptions"
            optionLabel="label"
            optionValue="value"
            class="w-full"
            @update:modelValue="(v) => emit('update:conflictStrategy', String(v || 'rename'))"
          />
        </div>
      </div>

      <small v-if="submitError" class="text-red-500 text-xs">{{ submitError }}</small>
    </div>

    <template #footer>
      <div class="flex justify-end gap-2 mt-4">
        <Button label="取消" icon="pi pi-times" class="p-button-text p-button-sm" :disabled="submitting" @click="emit('update:visible', false)" />
        <Button label="确定" icon="pi pi-check" class="p-button-primary p-button-sm" :loading="submitting" @click="emit('confirm')" />
      </div>
    </template>
  </Dialog>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import Select from 'primevue/select'
import TreeSelect from 'primevue/treeselect'
import { watch } from 'vue'
import type { ContractFileMoveConflictStrategy } from '../../../../../shared/types/contractFile.types'

const props = defineProps<{
  visible: boolean
  mode: 'same-folder' | 'other-contract'
  selectedCount: number
  submitting: boolean
  submitError: string
  contractOptions: Array<{ label: string; value: string }>
  folderOptions: Array<{ label: string; value: string }>
  folderTreeOptions: any[]
}>()

const targetContractId = defineModel<string>('targetContractId', { required: true })
const targetDirPath = defineModel<string>('targetDirPath', { required: true })
const conflictStrategy = defineModel<ContractFileMoveConflictStrategy>('conflictStrategy', { required: true })

const emit = defineEmits<{
  (e: 'change-contract', v: string): void
  (e: 'confirm'): void
}>()

const dialogTitle = computed(() => (props.mode === 'other-contract' ? '移动到其他合同' : '移动到同项目文件夹'))
const conflictStrategyOptions: Array<{ label: string; value: ContractFileMoveConflictStrategy }> = [
  { label: '重命名后移动（推荐）', value: 'rename' },
  { label: '跳过冲突项', value: 'skip' },
  { label: '替换目标项', value: 'replace' },
  { label: '保留两者', value: 'keep-both' },
]

// TreeSelect value transformer: string <-> { [key]: true }
const treeSelectValue = computed<Record<string, boolean>>({
  get: () => {
    if (!targetDirPath.value) return {}
    return { [targetDirPath.value]: true }
  },
  set: (val: Record<string, boolean> | null) => {
    if (!val) {
      targetDirPath.value = ''
      return
    }
    const keys = Object.keys(val)
    targetDirPath.value = keys.length > 0 ? keys[0] : ''
  }
})

watch(() => props.visible, (v) => {
  if (v && props.folderTreeOptions?.length) {
    const firstNode = props.folderTreeOptions[0]
    if (firstNode?.key && !targetDirPath.value) {
      targetDirPath.value = firstNode.key
    }
  }
})
</script>
