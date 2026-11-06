<template>
  <div class="h-full flex flex-col gap-3">
    <div v-if="products.length === 0" class="py-10 text-center text-[var(--content-text-secondary)]">暂无合同产品</div>
    <template v-else>
      <div class="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_10rem_10rem_auto] gap-2 items-center">
        <InputText
          v-model="productTableQuery.code"
          class="w-full"
          placeholder="按编码查询"
        />
        <InputText
          v-model="productTableQuery.name"
          class="w-full"
          placeholder="按名称查询"
        />
        <InputText
          v-model="productTableQuery.purchaseDate"
          type="date"
          class="w-full"
          placeholder="采购日期"
        />
        <InputText
          v-model="productTableQuery.warrantyDate"
          type="date"
          class="w-full"
          placeholder="维保日期"
        />
        <div class="flex items-center justify-end gap-2">
          <Button
            :label="`过保：${getWarrantyFilterLabel(productTableQuery.warrantyStatus)}`"
            icon="pi pi-exclamation-triangle"
            text
            size="small"
            :class="productTableQuery.warrantyStatus === 'expired' ? '!text-red-500' : ''"
            @click="productTableQuery.warrantyStatus = nextWarrantyFilter(productTableQuery.warrantyStatus)"
          />
          <Button
            label="清空查询"
            icon="pi pi-filter-slash"
            text
            size="small"
            :disabled="!hasProductTableQuery"
            @click="clearProductTableQuery"
          />
        </div>
      </div>

      <DataTable
        v-if="productViewMode === 'table'"
        :value="filteredProducts"
        dataKey="id"
        :class="tableClass"
        stripedRows
        rowHover
        :scrollable="true"
        :scrollHeight="tableScrollHeight"
      >
        <template #empty>
          <div class="py-3 text-center text-[var(--content-text-secondary)]">暂无匹配产品</div>
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
              :checked="selectedProductIds.includes(data.id)"
              @change="emit('toggle-select', { id: data.id, checked: ($event.target as HTMLInputElement).checked })"
            />
          </template>
        </Column>

        <Column field="code" header="编码" style="min-width: 8rem" sortable>
          <template #body="{ data }">
            <span class="table-cell-ellipsis" :title="String(data.code || '-')">{{ data.code || '-' }}</span>
          </template>
        </Column>
        <Column field="name" header="名称" style="min-width: 12rem" sortable>
          <template #body="{ data }">
            <span class="table-cell-ellipsis" :title="String(data.name || '-')">{{ data.name || '-' }}</span>
          </template>
        </Column>
        <Column field="specification" header="型号规格" style="min-width: 10rem" sortable>
          <template #body="{ data }">
            <span class="table-cell-ellipsis" :title="String(data.specification || '-')">{{ data.specification || '-' }}</span>
          </template>
        </Column>
        <Column field="quantity" header="数量" style="min-width: 7rem" sortable>
          <template #body="{ data }">
            <span class="table-cell-ellipsis tabular-nums text-right" :title="String(formatNumber(data.quantity))">{{ formatNumber(data.quantity) }}</span>
          </template>
        </Column>
        <Column field="unit" header="单位" style="min-width: 6rem" sortable>
          <template #body="{ data }">
            <span class="table-cell-ellipsis" :title="String(data.unit || '-')">{{ data.unit || '-' }}</span>
          </template>
        </Column>
        <Column field="unit_price" header="单价" style="min-width: 8rem" sortable>
          <template #body="{ data }">
            <span class="table-cell-ellipsis tabular-nums text-right" :title="String(formatMoney(data.unit_price))">{{ formatMoney(data.unit_price) }}</span>
          </template>
        </Column>
        <Column field="total_price" header="总价" style="min-width: 8rem" sortable>
          <template #body="{ data }">
            <span class="table-cell-ellipsis tabular-nums text-right" :title="String(formatMoney(data.total_price))">{{ formatMoney(data.total_price) }}</span>
          </template>
        </Column>
        <Column field="purchase_date" header="采购日期" style="min-width: 9rem" sortable>
          <template #body="{ data }">
            <span class="table-cell-ellipsis" :title="String(data.purchase_date || '-')">{{ data.purchase_date || '-' }}</span>
          </template>
        </Column>
        <Column field="warranty_date" header="维保日期" style="min-width: 9rem" sortable>
          <template #body="{ data }">
            <span class="table-cell-ellipsis" :title="String(data.warranty_date || '-')">{{ data.warranty_date || '-' }}</span>
          </template>
        </Column>
        <Column header="是否过保" style="min-width: 7rem">
          <template #body="{ data }">
            <span
              class="table-cell-ellipsis"
              :class="isWarrantyExpired(data.warranty_date) ? 'text-red-500 font-semibold' : ''"
              :title="String(getWarrantyStatusText(data.warranty_date))"
            >
              {{ getWarrantyStatusText(data.warranty_date) }}
            </span>
          </template>
        </Column>
        <Column field="remark" header="备注" style="min-width: 12rem" sortable>
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
        v-else-if="filteredProducts.length > 0"
        class="grid grid-cols-2 gap-4"
        :class="cardScrollable ? 'overflow-auto pr-1' : ''"
      >
        <div
          v-for="item in filteredProducts"
          :key="item.id"
          class="group p-5 rounded-xl bg-[var(--content-bg)] border border-[var(--content-border)] hover:border-[var(--btn-primary-bg)] hover:shadow-md transition-all duration-200 flex flex-col"
        >
          <div class="flex items-start justify-between gap-3 mb-4 flex-1">
            <div class="min-w-0 flex-1">
              <div class="flex flex-wrap items-center gap-1.5 mb-1.5">
                <input
                  v-if="showSelection"
                  type="checkbox"
                  :checked="selectedProductIds.includes(item.id)"
                  @change="emit('toggle-select', { id: item.id, checked: ($event.target as HTMLInputElement).checked })"
                  title="勾选用于批量删除"
                />
                <span class="px-1.5 py-0.5 rounded bg-[var(--sidebar-active-bg)] text-[10px] font-bold text-[var(--btn-primary-bg)] border border-[var(--btn-primary-bg)]/10 shrink-0">
                  {{ item.code || '无编码' }}
                </span>
                <span
                  v-if="item.category"
                  class="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[10px] font-bold text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 truncate max-w-[100px]"
                >
                  {{ item.category }}
                </span>
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
              <h3 class="font-black text-[var(--content-text)] tracking-tight truncate mb-1" :title="item.name">
                {{ item.name }}
              </h3>
              <p v-if="item.specification" class="text-[var(--content-text-secondary)] flex items-center gap-1 line-clamp-1">
                <i class="pi pi-info-circle text-[10px]"></i>
                规格：{{ item.specification }}
              </p>
            </div>
            <div class="text-right shrink-0">
              <div class="text-[10px] font-bold text-[var(--content-text-secondary)] uppercase tracking-widest mb-0.5">总价</div>
              <div class="text-lg font-black text-[var(--btn-primary-bg)] tabular-nums leading-tight">{{ formatMoney(item.total_price) }}</div>
            </div>
          </div>

          <div class="flex items-center justify-between pt-3 border-t border-[var(--content-border)] border-dashed mt-auto">
            <div class="flex items-center gap-4 text-[var(--content-text-secondary)] font-medium">
              <div class="flex items-center gap-1.5">
                <span class="text-[var(--content-text)] font-bold tabular-nums">{{ formatNumber(item.quantity) }}</span>
                <span>{{ item.unit || '个' }}</span>
              </div>
              <div class="w-1.5 h-1.5 rounded-full bg-[var(--content-border)]"></div>
              <div class="flex items-center gap-1.5">
                <span class="text-[10px] uppercase opacity-70">单价</span>
                <span class="tabular-nums font-bold text-[var(--content-text)]">¥{{ formatMoney(item.unit_price) }}</span>
              </div>
            </div>
          </div>
          <div class="mt-2 flex items-center gap-4 text-[var(--content-text-secondary)]">
            <div class="flex items-center gap-1.5">
              <span class="text-[10px] uppercase opacity-70">采购</span>
              <span>{{ item.purchase_date || '-' }}</span>
            </div>
            <div class="flex items-center gap-1.5">
              <span class="text-[10px] uppercase opacity-70">维保</span>
              <span>{{ item.warranty_date || '-' }}</span>
            </div>
          </div>
          <div v-if="item.remark" class="mt-2 text-[var(--content-text-secondary)] truncate italic opacity-70" :title="item.remark">
            备注：{{ item.remark }}
          </div>
        </div>
      </div>
      <div v-else class="py-10 text-center text-[var(--content-text-secondary)]">暂无匹配产品</div>
    </template>
  </div>
</template>

<script setup lang="ts">
import type { PropType } from 'vue'
import InputText from 'primevue/inputtext'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Button from 'primevue/button'
import type { ContractProduct } from '../../../../../shared/types/contractProduct.types'

type ProductTableQuery = {
  code: string
  name: string
  purchaseDate: string
  warrantyDate: string
  warrantyStatus: 'all' | 'expired' | 'notExpired'
}

const props = withDefaults(
  defineProps<{
    products: ContractProduct[]
    filteredProducts: ContractProduct[]
    productViewMode: 'card' | 'table'
    productTableQuery: ProductTableQuery
    hasProductTableQuery: boolean
    clearProductTableQuery: () => void
    formatMoney: (value: unknown) => string
    formatNumber: (value: unknown) => string
    showSelection?: boolean
    showActions?: boolean
    selectedProductIds?: string[]
    isAllSelected?: boolean
    tableClass?: string
    tableScrollHeight?: string
    cardScrollable?: boolean
  }>(),
  {
    showSelection: false,
    showActions: false,
    selectedProductIds: () => [],
    isAllSelected: false,
    tableClass: 'custom-datatable p-datatable-sm',
    tableScrollHeight: '360px',
    cardScrollable: false,
  }
)

const emit = defineEmits<{
  (e: 'toggle-select', payload: { id: string; checked: boolean }): void
  (e: 'toggle-select-all', checked: boolean): void
  (e: 'edit', row: ContractProduct): void
  (e: 'delete', row: ContractProduct): void
}>()

const parseDateOnly = (value: string) => {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!match) return null
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
  if (Number.isNaN(date.getTime())) return null
  return date
}

const isWarrantyExpired = (warrantyDate: unknown) => {
  const dateText = typeof warrantyDate === 'string' ? warrantyDate : String(warrantyDate ?? '')
  const warranty = parseDateOnly(dateText)
  if (!warranty) return false
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  return warranty < today
}

const getWarrantyStatusText = (warrantyDate: unknown) => {
  const dateText = typeof warrantyDate === 'string' ? warrantyDate : String(warrantyDate ?? '')
  const warranty = parseDateOnly(dateText)
  if (!warranty) return '-'
  return isWarrantyExpired(dateText) ? '过保' : '未过保'
}

const nextWarrantyFilter = (value: ProductTableQuery['warrantyStatus']): ProductTableQuery['warrantyStatus'] => {
  if (value === 'all') return 'expired'
  if (value === 'expired') return 'notExpired'
  return 'all'
}

const getWarrantyFilterLabel = (value: ProductTableQuery['warrantyStatus']) => {
  if (value === 'expired') return '过保'
  if (value === 'notExpired') return '未过保'
  return '全部'
}
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
