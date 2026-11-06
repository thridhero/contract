<template>
  <div class="h-full flex flex-col gap-3">
    <div v-if="receiptPlans.length === 0" class="py-10 text-center text-[var(--content-text-secondary)]">暂无收付计划</div>
    <template v-else>
      <!-- 搜索栏 -->
      <div class="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_10rem_10rem_auto] gap-2 items-center">
        <InputText
          v-model="receiptPlanTableQuery.plan_name"
          class="w-full"
          placeholder="按名称查询"
        />
        <InputText
          v-model="receiptPlanTableQuery.direction"
          class="w-full"
          placeholder="按方向查询"
        />
        <InputText
          v-model="receiptPlanTableQuery.expected_date"
          type="date"
          class="w-full"
          placeholder="日期查询"
        />
        <Button
          label="清空查询"
          icon="pi pi-filter-slash"
          text
          size="small"
          :disabled="!hasReceiptPlanTableQuery"
          @click="clearReceiptPlanTableQuery"
        />
      </div>

      <DataTable
        v-if="receiptPlanViewMode === 'table'"
        :value="filteredReceiptPlans"
        dataKey="id"
        :class="tableClass"
        stripedRows
        rowHover
        :scrollable="true"
        :scrollHeight="tableScrollHeight"
        @row-dblclick="emit('view', $event.data)"
      >
        <template #empty>
          <div class="py-3 text-center text-[var(--content-text-secondary)]">暂无匹配计划</div>
        </template>

        <Column v-if="showSelection" header="" style="min-width: 3rem">
          <template #header>
            <input
              type="checkbox"
              :checked="isAllSelected"
              @change="emit('toggle-select-all', ($event.target as HTMLInputElement).checked)"
            />
          </template>
          <template #body="{ data }">
            <input
              type="checkbox"
              :checked="selectedReceiptPlanIds.includes(data.id)"
              @change="emit('toggle-select', { id: data.id, checked: ($event.target as HTMLInputElement).checked })"
            />
          </template>
        </Column>

        <Column field="direction" header="方向" style="min-width: 6rem" sortable>
          <template #body="{ data }">
            <Tag :value="data.direction || '-'" :severity="getDirectionSeverity(data.direction)" />
          </template>
        </Column>
        <Column field="receipt_frequency" header="收付频率" style="min-width: 9rem" sortable>
          <template #body="{ data }">
            <span class="table-cell-ellipsis" :title="String(data.receipt_frequency || '-')">{{ data.receipt_frequency || '-' }}</span>
          </template>
        </Column>
        <Column field="plan_name" header="名称" style="min-width: 12rem" sortable>
          <template #body="{ data }">
            <span class="table-cell-ellipsis" :title="String(data.plan_name || '-')">{{ data.plan_name || '-' }}</span>
          </template>
        </Column>
        <Column header="应收(付)款" style="min-width: 9rem" sortable field="expected_amount">
          <template #body="{ data }">
            <span class="table-cell-ellipsis tabular-nums text-right">{{ formatMoney(data.expected_amount) }}</span>
          </template>
        </Column>
        <Column field="expected_date" header="应收(付)日期" style="min-width: 9rem" sortable />
        <Column header="已收(付)款" style="min-width: 9rem" sortable field="received_amount">
          <template #body="{ data }">
            <span class="table-cell-ellipsis tabular-nums text-right">{{ formatMoney(data.received_amount) }}</span>
          </template>
        </Column>
        <Column header="未收(付)金额" style="min-width: 9rem">
          <template #body="{ data }">
            <span class="table-cell-ellipsis tabular-nums text-right">{{ formatMoney(getOutstanding(data)) }}</span>
          </template>
        </Column>
        <Column field="remark" header="备注" style="min-width: 10rem" sortable>
          <template #body="{ data }">
            <span class="table-cell-ellipsis" :title="String(data.remark || '-')">{{ data.remark || '-' }}</span>
          </template>
        </Column>

        <Column v-if="showActions" header="操作" style="min-width: 6rem" frozen alignFrozen="right">
          <template #body="{ data }">
            <div class="flex items-center gap-1">
              <Button
                icon="pi pi-pencil"
                text
                rounded
                size="small"
                class="!p-1 !w-7 !h-7"
                @click="emit('edit', data)"
                title="修改"
              />
              <Button
                icon="pi pi-trash"
                text
                rounded
                severity="danger"
                size="small"
                class="!p-1 !w-7 !h-7"
                @click="emit('delete', data)"
                title="删除"
              />
            </div>
          </template>
        </Column>
      </DataTable>

      <div
        v-else-if="filteredReceiptPlans.length > 0"
        class="grid grid-cols-2 gap-4"
        :class="cardScrollable ? 'overflow-auto pr-1' : ''"
      >
        <div
          v-for="item in filteredReceiptPlans"
          :key="item.id"
          class="group p-5 rounded-xl bg-[var(--content-bg)] border border-[var(--content-border)] hover:border-[var(--btn-primary-bg)] hover:shadow-md transition-all duration-200 flex flex-col"
          @dblclick="emit('view', item)"
        >
          <div class="flex items-start justify-between gap-3 mb-4 flex-1">
            <div class="min-w-0 flex-1">
              <div class="flex flex-wrap items-center gap-1.5 mb-1.5">
                <input
                  v-if="showSelection"
                  type="checkbox"
                  :checked="selectedReceiptPlanIds.includes(item.id)"
                  @change="emit('toggle-select', { id: item.id, checked: ($event.target as HTMLInputElement).checked })"
                  title="勾选用于批量删除"
                />
                <Tag :value="item.direction || '-'" :severity="getDirectionSeverity(item.direction)" />
                <div v-if="showActions" class="flex items-center gap-0.5 ml-auto">
                  <Button
                    icon="pi pi-pencil"
                    text
                    rounded
                    size="small"
                    class="!p-0.5 !w-6 !h-6"
                    @click="emit('edit', item)"
                    title="修改"
                  />
                  <Button
                    icon="pi pi-trash"
                    text
                    rounded
                    severity="danger"
                    size="small"
                    class="!p-0.5 !w-6 !h-6"
                    @click="emit('delete', item)"
                    title="删除"
                  />
                </div>
              </div>
              <h3 class="font-black text-[var(--content-text)] tracking-tight truncate mb-1" :title="item.plan_name">
                {{ item.plan_name }}
              </h3>
              <p class="text-[var(--content-text-secondary)] flex items-center gap-1 line-clamp-1">
                <i class="pi pi-calendar text-[10px]"></i>
                应收(付)日期：{{ item.expected_date }}
              </p>
              <p v-if="item.receipt_frequency" class="text-[var(--content-text-secondary)] flex items-center gap-1 line-clamp-1">
                <i class="pi pi-clock text-[10px]"></i>
                收付频率：{{ item.receipt_frequency }}
              </p>
            </div>
            <div class="text-right shrink-0">
              <div class="text-[10px] font-bold text-[var(--content-text-secondary)] uppercase tracking-widest mb-0.5">应收(付)款</div>
              <div class="text-lg font-black text-[var(--btn-primary-bg)] tabular-nums leading-tight">{{ formatMoney(item.expected_amount) }}</div>
            </div>
          </div>

          <div class="flex items-center justify-between pt-3 border-t border-[var(--content-border)] border-dashed mt-auto">
            <div class="flex items-center gap-4 text-[var(--content-text-secondary)] font-medium">
              <div class="flex items-center gap-1.5">
                <span class="text-[10px] uppercase opacity-70">已收(付)</span>
                <span class="text-[var(--content-text)] font-bold tabular-nums">{{ formatMoney(item.received_amount) }}</span>
              </div>
              <div class="w-1.5 h-1.5 rounded-full bg-[var(--content-border)]"></div>
              <div class="flex items-center gap-1.5">
                <span class="text-[10px] uppercase opacity-70">未收(付)</span>
                <span class="tabular-nums font-bold text-red-500">{{ formatMoney(getOutstanding(item)) }}</span>
              </div>
            </div>
          </div>
          <div v-if="item.remark" class="mt-2 text-[var(--content-text-secondary)] truncate italic opacity-70" :title="item.remark">
            备注：{{ item.remark }}
          </div>
        </div>
      </div>
      <div v-else class="py-10 text-center text-[var(--content-text-secondary)]">暂无匹配计划</div>
    </template>
  </div>
</template>

<script setup lang="ts">
import InputText from 'primevue/inputtext'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Button from 'primevue/button'
import Tag from 'primevue/tag'
import type { ReceiptPlan } from '../../../../stores/contract/receiptPlanStore'

type ReceiptPlanTableQuery = {
  plan_name: string
  direction: string
  expected_date: string
}

const props = withDefaults(
  defineProps<{
    receiptPlans: ReceiptPlan[]
    filteredReceiptPlans: ReceiptPlan[]
    receiptPlanViewMode: 'card' | 'table'
    receiptPlanTableQuery: ReceiptPlanTableQuery
    hasReceiptPlanTableQuery: boolean
    clearReceiptPlanTableQuery: () => void
    formatMoney: (value: unknown) => string
    getOutstanding: (plan: ReceiptPlan) => number
    getDirectionSeverity: (direction?: string) => 'success' | 'info' | 'warn' | 'danger' | 'secondary' | undefined
    showSelection?: boolean
    showActions?: boolean
    selectedReceiptPlanIds?: string[]
    isAllSelected?: boolean
    tableClass?: string
    tableScrollHeight?: string
    cardScrollable?: boolean
  }>(),
  {
    showSelection: false,
    showActions: false,
    selectedReceiptPlanIds: () => [],
    isAllSelected: false,
    tableClass: 'custom-datatable p-datatable-sm',
    tableScrollHeight: '360px',
    cardScrollable: false,
  }
)

const emit = defineEmits<{
  (e: 'toggle-select', payload: { id: string; checked: boolean }): void
  (e: 'toggle-select-all', checked: boolean): void
  (e: 'view', row: ReceiptPlan): void
  (e: 'edit', row: ReceiptPlan): void
  (e: 'delete', row: ReceiptPlan): void
}>()
</script>

<style scoped>
.table-cell-ellipsis {
  display: block;
  width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
