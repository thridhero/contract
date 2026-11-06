<template>
  <Dialog
    v-model:visible="visibleProxy"
    modal
    header="拷贝失败清单"
    :style="{ width: '860px' }"
    :draggable="false"
    class="theme-dialog"
  >
    <div class="flex flex-col gap-3 pt-1">
      <div class="text-sm text-[var(--content-text-secondary)]">
        失败数量：<span class="text-[var(--content-text)] font-medium">{{ failures.length }}</span>
      </div>

      <DataTable
        :value="failures"
        v-model:selection="selectedRows"
        dataKey="id"
        class="custom-datatable p-datatable-sm"
        :scrollable="true"
        scrollHeight="360px"
        stripedRows
      >
        <template #empty>
          <div class="flex flex-col items-center justify-center py-8 text-[var(--content-text-secondary)]">
            <i class="pi pi-check-circle text-3xl mb-3 opacity-50"></i>
            <p>没有失败项</p>
          </div>
        </template>

        <Column selectionMode="multiple" headerStyle="width: 3rem"></Column>
        <Column header="文件" style="min-width: 18rem">
          <template #body="{ data }">
            <div class="min-w-0">
              <div class="text-sm text-[var(--content-text)] truncate" :title="data.displayName">
                {{ data.displayName }}
              </div>
              <div class="text-xs text-[var(--content-text-secondary)] truncate" :title="data.destPath || ''">
                {{ data.destPath || '-' }}
              </div>
            </div>
          </template>
        </Column>
        <Column header="原因" style="min-width: 20rem">
          <template #body="{ data }">
            <div class="text-sm text-[var(--content-text-secondary)] break-all">{{ data.error }}</div>
          </template>
        </Column>
      </DataTable>
    </div>

    <template #footer>
      <div class="flex items-center justify-between w-full">
        <div class="text-xs text-[var(--content-text-secondary)]">
          已选中 {{ selectedRows.length }} 项
        </div>
        <div class="flex items-center gap-2">
          <Button
            label="重试全部"
            :disabled="failures.length === 0 || loading"
            :loading="loading"
            @click="$emit('retry-all')"
          />
          <Button
            label="重试选中"
            severity="secondary"
            :disabled="selectedRows.length === 0 || loading"
            :loading="loading"
            @click="$emit('retry-selected', selectedRows)"
          />
          <Button
            label="关闭"
            severity="secondary"
            :disabled="loading"
            @click="close"
          />
        </div>
      </div>
    </template>
  </Dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import Dialog from 'primevue/dialog'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Button from 'primevue/button'

export type FileCopyFailureRow = {
  id: string
  displayName: string
  srcPath: string
  destPath: string
  error: string
  file: { src: string; name: string; relativePath?: string }
}

const props = defineProps<{
  modelValue: boolean
  failures: FileCopyFailureRow[]
  loading?: boolean
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', v: boolean): void
  (e: 'retry-all'): void
  (e: 'retry-selected', rows: FileCopyFailureRow[]): void
}>()

const selectedRows = ref<FileCopyFailureRow[]>([])

watch(
  () => props.modelValue,
  (v) => {
    if (!v) {
      selectedRows.value = []
    }
  }
)

const visibleProxy = computed({
  get: () => props.modelValue,
  set: (v: boolean) => emit('update:modelValue', v),
})

const close = () => emit('update:modelValue', false)
</script>

