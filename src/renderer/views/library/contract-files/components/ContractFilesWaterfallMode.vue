<template>
  <VirtualMasonryView :key="masonryKey" :items="items" itemKey="fileId" :gap="16" :overscanScreens="2.5" :imageAspectRatioHeight="0.75" :metaBarHeightRem="3.5" :debug="debug">
    <template #item="{ item }">
      <FileCard
        :item="item"
        :icon-url="getContractFileIconUrl(item)"
        :selected="isSelected(item)"
        :fill="true"
        :lock-aspect-ratio="true"
        @open="(r) => emit('open', r)"
        @click="(e, r) => emit('click', e, r)"
        @contextmenu="(e, r) => emit('contextmenu', e, r)"
        @retry="(r) => emit('retry', r)"
      />
    </template>
    <template #empty>
      <div class="flex flex-col items-center justify-center py-10 text-[var(--content-text-secondary)]">
        <i class="pi pi-inbox text-3xl mb-3 opacity-50"></i>
        <p>没有找到文件</p>
      </div>
    </template>
  </VirtualMasonryView>
</template>

<script setup lang="ts">
import VirtualMasonryView from '../../../../components/masonry/VirtualMasonryView.vue'
import FileCard from '../../../../components/masonry/FileCard.vue'
import { getContractFileIconUrl } from '../../../../utils/contractFileIcons'
import type { ContractFileRecord } from '../../../../../shared/types/contractFile.types'

const props = defineProps<{
  masonryKey: string
  items: ContractFileRecord[]
  isSelected: (record: ContractFileRecord) => boolean
  debug: boolean
}>()

const emit = defineEmits<{
  (e: 'open', record: ContractFileRecord): void
  (e: 'click', event: MouseEvent, record: ContractFileRecord): void
  (e: 'contextmenu', event: MouseEvent, record: ContractFileRecord): void
  (e: 'retry', record: ContractFileRecord): void
}>()

const isSelected = (record: ContractFileRecord) => props.isSelected(record)
</script>
