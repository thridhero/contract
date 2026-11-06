<template>
  <DataTable
    :value="items"
    :key="tableKey"
    :contextMenuSelection="contextMenuSelection"
    @update:contextMenuSelection="(v) => emit('update:contextMenuSelection', v)"
    @rowContextmenu="(e) => emit('row-contextmenu', e)"
    @row-click="(e) => emit('row-click', e)"
    @row-dblclick="(e) => emit('row-dblclick', e)"
    :rowClass="rowClass"
    sortMode="single"
    :sortField="sortField"
    :sortOrder="sortOrder"
    :customSort="true"
    @sort="(e) => emit('sort', e)"
    dataKey="fileId"
    selectionMode="single"
    :metaKeySelection="false"
    :scrollable="true"
    :virtualScrollerOptions="{ itemSize: 32 }"
    scrollHeight="flex"
    class="h-full custom-datatable p-datatable-sm"
    stripedRows
    hoverHover
  >
    <template #empty>
      <div class="flex flex-col items-center justify-center py-10 text-[var(--content-text-secondary)]">
        <i class="pi pi-inbox text-3xl mb-3 opacity-50"></i>
        <p>没有找到文件</p>
      </div>
    </template>

    <Column header="名称" field="name" sortable style="min-width: 18rem">
      <template #body="{ data }">
        <div class="flex items-center gap-2 min-w-0 cursor-pointer" draggable="true" :data-contract-file-id="data.fileId">
          <img :src="getContractFileIconUrl(data)" class="w-4 h-4 shrink-0 object-contain" alt="" decoding="async" loading="lazy" />
          <span class="truncate text-[var(--content-text)]" :title="data.name">{{ data.name }}</span>
        </div>
      </template>
    </Column>
    <Column header="类型" sortField="type" sortable style="width: 7rem">
      <template #body="{ data }">
        <div class="cursor-pointer" draggable="true" :data-contract-file-id="data.fileId">
          <span class="text-xs text-[var(--content-text-secondary)]">{{ data.type === 'folder' ? '文件夹' : (getExt(data.name) || '文件') }}</span>
        </div>
      </template>
    </Column>
    <Column header="大小" sortField="size" sortable style="width: 7rem">
      <template #body="{ data }">
        <div class="cursor-pointer" draggable="true" :data-contract-file-id="data.fileId">
          <span class="text-xs text-[var(--content-text-secondary)]">{{ data.type === 'folder' ? '-' : formatSize(data.size) }}</span>
        </div>
      </template>
    </Column>
    <Column header="修改时间" sortField="mtime" sortable style="width: 12rem">
      <template #body="{ data }">
        <div class="cursor-pointer" draggable="true" :data-contract-file-id="data.fileId">
          <span class="text-xs text-[var(--content-text-secondary)]">{{ formatTime(data.mtime) }}</span>
        </div>
      </template>
    </Column>
  </DataTable>
</template>

<script setup lang="ts">
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import { getContractFileIconUrl } from '../../../../utils/contractFileIcons'
import type { ContractFileRecord } from '../../../../../shared/types/contractFile.types'

defineProps<{
  tableKey: string
  items: ContractFileRecord[]
  contextMenuSelection: ContractFileRecord | null
  sortField: string
  sortOrder: 1 | -1
  rowClass: (data: ContractFileRecord) => string
  getExt: (name: string) => string
  formatSize: (size: number | null) => string
  formatTime: (mtime: number | null) => string
}>()

const emit = defineEmits<{
  (e: 'update:contextMenuSelection', v: ContractFileRecord | null): void
  (e: 'row-contextmenu', event: any): void
  (e: 'row-click', event: any): void
  (e: 'row-dblclick', event: any): void
  (e: 'sort', event: any): void
}>()
</script>
