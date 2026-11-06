<template>
  <DataTable
    :key="tableKey"
    :value="nodes"
    :rowClass="rowClass"
    dataKey="key"
    :scrollable="true"
    :virtualScrollerOptions="{ itemSize: 32 }"
    scrollHeight="flex"
    class="h-full custom-datatable p-datatable-sm"
    stripedRows
    hoverHover
    @row-click="(e) => emit('row-click', e)"
    @row-dblclick="(e) => emit('row-dblclick', e)"
    @rowContextmenu="(e) => emit('row-contextmenu', e)"
  >
    <template #empty>
      <div class="flex flex-col items-center justify-center py-10 text-[var(--content-text-secondary)]">
        <i class="pi pi-inbox text-3xl mb-3 opacity-50"></i>
        <p>没有找到文件</p>
      </div>
    </template>

    <Column field="name" header="名称" style="min-width: 18rem">
      <template #body="slotProps">
        <div
          class="flex items-center gap-2 min-w-0 h-full w-full cursor-pointer"
          :style="{ paddingLeft: `${slotProps.data.level * 1.5}rem` }"
          :draggable="!!slotProps.data.data?.record?.fileId"
          :data-contract-file-id="slotProps.data.data?.record?.fileId"
          @dragstart.stop="emit('dragstart', $event, slotProps.data.data?.record)"
          @contextmenu.prevent.stop="emit('open-context-menu', $event, slotProps.data)"
          @dblclick.stop="emit('node-dblclick', slotProps.data)"
          @click.stop="emit('node-click', $event, slotProps.data)"
        >
          <button
            v-if="slotProps.data.hasChildren"
            class="w-5 h-5 shrink-0 flex items-center justify-center rounded hover:bg-[var(--sidebar-hover-bg)] text-[var(--content-text-secondary)] transition-colors"
            @click.stop="emit('toggle', slotProps.data)"
            @dblclick.stop
          >
            <i :class="['pi text-xs', slotProps.data.expanded ? 'pi-chevron-down' : 'pi-chevron-right']"></i>
          </button>
          <div v-else class="w-5 h-5 shrink-0"></div>

          <img
            :src="getContractFileIconUrl(slotProps.data.data)"
            class="w-4 h-4 shrink-0 object-contain"
            alt=""
            decoding="async"
            loading="lazy"
          />
          <span class="truncate text-[var(--content-text)] cursor-pointer" :title="slotProps.data.data?.name">
            {{ slotProps.data.data?.name }}
          </span>
        </div>
      </template>
    </Column>
    <Column header="类型" style="width: 7rem">
      <template #body="slotProps">
        <div
          class="h-full w-full flex items-center cursor-pointer"
          :draggable="!!slotProps.data.data?.record?.fileId"
          :data-contract-file-id="slotProps.data.data?.record?.fileId"
          @dragstart.stop="emit('dragstart', $event, slotProps.data.data?.record)"
        >
          <span class="text-xs text-[var(--content-text-secondary)]" :class="{ 'font-semibold text-[var(--content-text)]': isSelectedKey(slotProps.data.key) }">
            {{ getTypeText(slotProps.data.data) }}
          </span>
        </div>
      </template>
    </Column>
    <Column header="大小" style="width: 7rem">
      <template #body="slotProps">
        <div
          class="h-full w-full flex items-center cursor-pointer"
          :draggable="!!slotProps.data.data?.record?.fileId"
          :data-contract-file-id="slotProps.data.data?.record?.fileId"
          @dragstart.stop="emit('dragstart', $event, slotProps.data.data?.record)"
        >
          <span class="text-xs text-[var(--content-text-secondary)]" :class="{ 'font-semibold text-[var(--content-text)]': isSelectedKey(slotProps.data.key) }">
            {{ getSizeText(slotProps.data.data) }}
          </span>
        </div>
      </template>
    </Column>
    <Column header="添加日期" style="width: 12rem">
      <template #body="slotProps">
        <div
          class="h-full w-full flex items-center cursor-pointer"
          :draggable="!!slotProps.data.data?.record?.fileId"
          :data-contract-file-id="slotProps.data.data?.record?.fileId"
          @dragstart.stop="emit('dragstart', $event, slotProps.data.data?.record)"
        >
          <span class="text-xs text-[var(--content-text-secondary)]" :class="{ 'font-semibold text-[var(--content-text)]': isSelectedKey(slotProps.data.key) }">
            {{ formatDbTime(slotProps.data.data?.createdAt) }}
          </span>
        </div>
      </template>
    </Column>
  </DataTable>
</template>

<script setup lang="ts">
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import { getContractFileIconUrl } from '../../../../utils/contractFileIcons'

defineProps<{
  tableKey: string
  nodes: any[]
  rowClass: any
  isSelectedKey: (key: string) => boolean
  getTypeText: (nodeData: any) => string
  getSizeText: (nodeData: any) => string
  formatDbTime: (v: string | null | undefined) => string
}>()

const emit = defineEmits<{
  (e: 'row-click', event: any): void
  (e: 'row-dblclick', event: any): void
  (e: 'row-contextmenu', event: any): void
  (e: 'dragstart', event: DragEvent, record: any): void
  (e: 'toggle', node: any): void
  (e: 'open-context-menu', event: MouseEvent, node: any): void
  (e: 'node-click', event: MouseEvent, node: any): void
  (e: 'node-dblclick', node: any): void
}>()
</script>
