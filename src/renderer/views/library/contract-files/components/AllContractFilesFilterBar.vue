<template>
  <div v-if="visible" class="shrink-0 border-b border-[var(--content-border)] bg-[var(--content-bg)]/80 backdrop-blur-md px-6 py-2" style="-webkit-app-region: no-drag;">
    <div class="flex items-center gap-1.5 flex-wrap">
      <button
        v-for="item in items"
        :key="item.key"
        type="button"
        class="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-sm text-[var(--content-text-secondary)] hover:bg-[var(--sidebar-hover-bg)] hover:text-[var(--content-text)] transition-colors"
        @click.stop="(event) => onFilterBarItemClick(item.key, event)"
      >
        <i :class="[item.icon, 'text-sm']"></i>
        <span class="flex items-center gap-1.5 min-w-0">
          <span>{{ item.label }}</span>
          <span
            v-if="item.key === 'contract' && selectedContractDisplay"
            class="text-xs text-[var(--content-text-secondary)] truncate max-w-56"
          >
            {{ selectedContractDisplay }}
          </span>
          <span
            v-if="item.key === 'contract' && selectedContractDisplay"
            class="inline-flex items-center justify-center w-5 h-5 rounded-md text-[var(--content-text-secondary)] hover:bg-[var(--sidebar-hover-bg)] hover:text-[var(--content-text)] transition-colors"
            @click.stop="emit('clearContractSelection')"
          >
            <i class="pi pi-times text-xs"></i>
          </span>
          <span
            v-if="item.key === 'format' && selectedFormatDisplay"
            class="text-xs text-[var(--content-text-secondary)] truncate max-w-40"
          >
            {{ selectedFormatDisplay }}
          </span>
          <span
            v-if="item.key === 'format' && selectedFormatDisplay"
            class="inline-flex items-center justify-center w-5 h-5 rounded-md text-[var(--content-text-secondary)] hover:bg-[var(--sidebar-hover-bg)] hover:text-[var(--content-text)] transition-colors"
            @click.stop="emit('clearFormatSelection')"
          >
            <i class="pi pi-times text-xs"></i>
          </span>
        </span>
      </button>

      <Popover ref="contractPopover" style="background: transparent; border: none; box-shadow: none;">
        <div class="w-96 rounded-xl border border-[var(--content-border)] bg-[var(--content-bg)] p-2 shadow-xl">
          <div class="p-1">
            <div class="mb-2 flex items-center justify-between gap-2">
              <div class="text-sm font-medium text-[var(--content-text)]">合同</div>
              <button
                v-if="selectedContracts.length"
                type="button"
                class="text-xs text-[var(--content-text-secondary)] hover:text-[var(--content-text)] transition-colors px-2 py-1 rounded-md hover:bg-[var(--sidebar-hover-bg)]"
                @click="emit('clearContractSelection')"
              >
                清空
              </button>
            </div>
            <div class="mb-2">
              <InputText
                v-model="localContractSearchQuery"
                class="w-full !bg-[var(--input-bg)] !border-[var(--input-border)] !text-[var(--content-text)] placeholder:!text-[var(--content-text-secondary)] focus:!border-[var(--btn-primary-bg)]"
                placeholder="搜索合同..."
              />
            </div>
            <div class="max-h-72 overflow-auto">
              <button
                v-for="opt in filteredContractOptions"
                :key="opt.contractId"
                type="button"
                class="w-full flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors text-[var(--content-text)] hover:bg-[var(--sidebar-hover-bg)]"
                @click="emit('toggleContractSelection', opt.contractId)"
              >
                <span class="flex items-center gap-2 min-w-0">
                  <Checkbox
                    :modelValue="selectedContracts.includes(opt.contractId)"
                    binary
                    @click.stop
                    @update:modelValue="emit('toggleContractSelection', opt.contractId)"
                  />
                  <span class="min-w-0">
                    <div class="truncate" :title="opt.contractNo || '-'">{{ opt.contractNo || '-' }}</div>
                    <div class="truncate text-xs text-[var(--content-text-secondary)]" :title="opt.contractName || ''">{{ opt.contractName || '未命名合同' }}</div>
                  </span>
                </span>
                <span class="text-xs text-[var(--content-text-secondary)] tabular-nums">{{ opt.count }}</span>
              </button>
              <div v-if="filteredContractOptions.length === 0" class="px-3 py-2 text-sm text-[var(--content-text-secondary)]">
                无匹配合同
              </div>
            </div>
          </div>
        </div>
      </Popover>

      <Popover ref="formatPopover" style="background: transparent; border: none; box-shadow: none;">
        <div class="w-72 rounded-xl border border-[var(--content-border)] bg-[var(--content-bg)] p-2 shadow-xl">
          <div class="p-1">
            <div class="mb-2 flex items-center justify-between gap-2">
              <div class="text-sm font-medium text-[var(--content-text)]">文件格式</div>
              <button
                v-if="selectedFormats.length"
                type="button"
                class="text-xs text-[var(--content-text-secondary)] hover:text-[var(--content-text)] transition-colors px-2 py-1 rounded-md hover:bg-[var(--sidebar-hover-bg)]"
                @click="emit('clearFormatSelection')"
              >
                清空
              </button>
            </div>
            <div class="mb-2">
              <InputText
                v-model="localFormatSearchQuery"
                class="w-full !bg-[var(--input-bg)] !border-[var(--input-border)] !text-[var(--content-text)] placeholder:!text-[var(--content-text-secondary)] focus:!border-[var(--btn-primary-bg)]"
                placeholder="搜索..."
              />
            </div>
            <div class="max-h-72 overflow-auto">
              <button
                v-for="opt in filteredFileTypeStats"
                :key="opt.ext || '__noext__'"
                type="button"
                class="w-full flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors text-[var(--content-text)] hover:bg-[var(--sidebar-hover-bg)]"
                @click="emit('toggleFormatSelection', opt.ext)"
              >
                <span class="flex items-center gap-2 min-w-0">
                  <Checkbox
                    :modelValue="selectedFormats.some(f => f.toLowerCase() === (opt.ext || '').trim().toLowerCase())"
                    binary
                    @click.stop
                    @update:modelValue="emit('toggleFormatSelection', opt.ext)"
                  />
                  <span class="truncate">{{ opt.ext || '无后缀' }}</span>
                </span>
                <span class="text-xs text-[var(--content-text-secondary)] tabular-nums">{{ opt.count }}</span>
              </button>
              <div v-if="filteredFileTypeStats.length === 0" class="px-3 py-2 text-sm text-[var(--content-text-secondary)]">
                无匹配格式
              </div>
            </div>
          </div>
        </div>
      </Popover>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import Popover from 'primevue/popover'
import InputText from 'primevue/inputtext'
import Checkbox from 'primevue/checkbox'

const props = defineProps<{
  visible: boolean
  items: Array<{ key: string; icon: string; label: string }>
  selectedContractDisplay: string
  selectedFormatDisplay: string
  contractSearchQuery: string
  formatSearchQuery: string
  filteredContractOptions: Array<{ contractId: string; contractNo: string; contractName: string; count: number }>
  filteredFileTypeStats: Array<{ ext: string; count: number }>
  selectedContracts: string[]
  selectedFormats: string[]
}>()

const emit = defineEmits<{
  (e: 'update:contractSearchQuery', value: string): void
  (e: 'update:formatSearchQuery', value: string): void
  (e: 'clearContractSelection'): void
  (e: 'clearFormatSelection'): void
  (e: 'toggleContractSelection', contractId: string): void
  (e: 'toggleFormatSelection', ext: string): void
}>()

const localContractSearchQuery = computed({
  get: () => props.contractSearchQuery,
  set: (val) => emit('update:contractSearchQuery', val)
})

const localFormatSearchQuery = computed({
  get: () => props.formatSearchQuery,
  set: (val) => emit('update:formatSearchQuery', val)
})

const contractPopover = ref<InstanceType<typeof Popover> | null>(null)
const formatPopover = ref<InstanceType<typeof Popover> | null>(null)

watch(
  () => props.visible,
  (visible) => {
    if (visible) return
    contractPopover.value?.hide()
    formatPopover.value?.hide()
    emit('update:contractSearchQuery', '')
    emit('update:formatSearchQuery', '')
  }
)

const onFilterBarItemClick = (key: string, event: Event) => {
  if (key === 'contract') {
    contractPopover.value?.toggle(event)
    return
  }
  if (key === 'format') {
    formatPopover.value?.toggle(event)
  }
}
</script>
