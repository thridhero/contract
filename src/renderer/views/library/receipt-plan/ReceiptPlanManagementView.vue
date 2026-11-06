<template>
  <main class="flex h-full flex-col overflow-hidden bg-[var(--content-bg)] text-[var(--content-text)]">
    <header
      class="flex h-16 shrink-0 items-center justify-between border-b border-[var(--content-border)] bg-[var(--content-bg)]/80 px-6 backdrop-blur-md"
      style="-webkit-app-region: drag;"
      @dblclick="handleTitleBarDblClick"
    >
      <div class="flex min-w-0 flex-1 items-center gap-4">
        <div class="flex items-center gap-3">
          <button
            @click="$router.back()"
            class="rounded-lg p-2 text-[var(--content-text-secondary)] transition-colors hover:bg-[var(--sidebar-hover-bg)]"
            style="-webkit-app-region: no-drag;"
          >
            <i class="pi pi-arrow-left"></i>
          </button>
          <div class="h-5 w-px bg-[var(--content-border)]"></div>
          <h2 class="whitespace-nowrap text-lg font-bold tracking-tight text-[var(--content-text)]" style="-webkit-app-region: no-drag;">收款计划</h2>
        </div>

        <div class="flex items-center gap-3" style="-webkit-app-region: no-drag;">
          <div class="relative w-[420px] max-w-[45vw] rounded-lg focus-within:ring-2 focus-within:ring-blue-500/20">
            <i class="pi pi-search absolute left-3 top-1/2 -translate-y-1/2 text-[var(--content-text-secondary)]" @click="handleSearch"></i>
            <input
              v-model="searchQuery"
              @keyup.enter="handleSearch"
              class="w-full rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] py-2 pl-9 pr-4 text-[var(--content-text)] transition-colors placeholder-[var(--content-text-secondary)] focus:border-blue-500 focus:outline-none"
              placeholder="搜索合同编号、合同名称、收付款名称、备注..."
              type="text"
            />
          </div>
        </div>

        <div class="h-full flex-1"></div>
      </div>

      <div class="flex items-center gap-2" style="-webkit-app-region: no-drag;">
        <div ref="columnPopoverTrigger" class="relative flex" style="-webkit-app-region: no-drag;">
          <button
            class="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--content-text-secondary)] transition-colors hover:bg-[var(--sidebar-hover-bg)]"
            @click="toggleColumnPopover"
          >
            <i class="pi pi-sliders-h"></i>
          </button>
          <div
            v-if="isColumnPopoverOpen"
            ref="columnPopoverPanel"
            class="absolute right-0 top-full z-[70] mt-2 w-72 rounded-xl border border-[var(--content-border)] bg-[var(--content-bg)] p-3 shadow-xl"
            style="-webkit-app-region: no-drag;"
          >
            <div class="mb-3 flex items-center justify-between gap-3">
              <div class="flex items-center gap-2">
                <Checkbox :modelValue="isAllSelected" binary @update:modelValue="toggleSelectAll" />
                <span class="text-sm font-medium text-[var(--content-text)]">全选</span>
              </div>
              <span class="text-xs text-[var(--content-text-secondary)]">
                {{ visibleColumns.length }}/{{ availableColumns.length }}
              </span>
            </div>
            <MultiSelect
              v-model="visibleColumns"
              :options="availableColumns"
              optionLabel="header"
              optionValue="field"
              placeholder="选择显示的列"
              selectedItemsLabel="已选择 {0} 项"
              :showToggleAll="false"
              appendTo="self"
              :maxSelectedLabels="2"
              class="w-full"
            />
          </div>
        </div>

        <button
          class="flex h-8 w-8 items-center justify-center rounded-lg transition-colors"
          :class="hasActiveFilters ? 'bg-[var(--sidebar-active-bg)] text-[var(--btn-primary-bg)]' : 'text-[var(--content-text-secondary)] hover:bg-[var(--sidebar-hover-bg)]'"
          @click="filterBarVisible = !filterBarVisible"
          title="筛选"
        >
          <i class="pi pi-filter"></i>
        </button>

        <button
          class="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--content-text-secondary)] transition-colors hover:bg-[var(--sidebar-hover-bg)]"
          @click="openAddDialog"
          title="新增"
        >
          <i class="pi pi-plus"></i>
        </button>
        <button
          class="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--content-text-secondary)] transition-colors hover:bg-[var(--sidebar-hover-bg)]"
          @click="editSelected"
          title="修改"
        >
          <i class="pi pi-pencil"></i>
        </button>
        <button
          class="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--content-text-secondary)] transition-colors hover:bg-[var(--sidebar-hover-bg)]"
          @click="deleteSelected"
          title="删除"
        >
          <i class="pi pi-trash"></i>
        </button>
        <button
          class="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--content-text-secondary)] transition-colors hover:bg-[var(--sidebar-hover-bg)]"
          @click="exportCsv"
          title="导出"
        >
          <i class="pi pi-download"></i>
        </button>

        <div class="flex items-center gap-2 pl-2">
          <Checkbox v-model="showSummary" binary />
          <span class="text-sm text-[var(--content-text-secondary)] select-none">显示汇总</span>
        </div>

        <button
          class="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--content-text-secondary)] transition-colors hover:bg-[var(--sidebar-hover-bg)]"
          @click="refresh"
          title="刷新"
        >
          <i class="pi pi-refresh"></i>
        </button>
        <WindowControls />
      </div>
    </header>

    <section class="flex-1 overflow-hidden p-6 flex flex-col gap-4">
      <div
        v-if="filterBarVisible"
        class="shrink-0 border-b border-[var(--content-border)] bg-[var(--content-bg)]/80 backdrop-blur-md px-1 py-2"
        style="-webkit-app-region: no-drag;"
      >
        <div class="flex items-center gap-1.5 flex-wrap">
          <button
            type="button"
            class="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-sm text-[var(--content-text-secondary)] hover:bg-[var(--sidebar-hover-bg)] hover:text-[var(--content-text)] transition-colors"
            @click="togglePartyAPopover"
          >
            <i class="pi pi-building text-sm"></i>
            <span class="flex items-center gap-1.5 min-w-0">
              <span>甲方</span>
              <span v-if="filters.party_a_name?.length" class="text-xs text-[var(--content-text-secondary)] truncate max-w-40">
                {{ filters.party_a_name.join(', ') }}
              </span>
              <span
                v-if="filters.party_a_name?.length"
                class="inline-flex items-center justify-center w-5 h-5 rounded-md text-[var(--content-text-secondary)] hover:bg-[var(--sidebar-hover-bg)] hover:text-[var(--content-text)] transition-colors"
                @click.stop="clearFilter('party_a_name')"
              >
                <i class="pi pi-times text-xs"></i>
              </span>
            </span>
          </button>

          <Popover ref="partyAPopover" style="background: transparent; border: none; box-shadow: none;">
            <div class="w-72 rounded-xl border border-[var(--content-border)] bg-[var(--content-bg)] p-2 shadow-xl">
              <div class="p-1">
                <div class="mb-2 flex items-center justify-between gap-2">
                  <div class="text-sm font-medium text-[var(--content-text)]">甲方单位</div>
                  <button
                    v-if="filters.party_a_name?.length"
                    type="button"
                    class="text-xs text-[var(--content-text-secondary)] hover:text-[var(--content-text)] transition-colors px-2 py-1 rounded-md hover:bg-[var(--sidebar-hover-bg)]"
                    @click="clearFilter('party_a_name')"
                  >
                    清空
                  </button>
                </div>
                <div class="mb-2">
                  <InputText
                    v-model="filterSearchInputs.party_a_name"
                    class="w-full !bg-[var(--input-bg)] !border-[var(--input-border)] !text-[var(--content-text)] placeholder:!text-[var(--content-text-secondary)] focus:!border-[var(--btn-primary-bg)]"
                    placeholder="搜索甲方..."
                  />
                </div>
                <div class="max-h-72 overflow-auto">
                  <button
                    v-for="opt in filteredPartyAOptions"
                    :key="opt.value"
                    type="button"
                    class="w-full flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors text-[var(--content-text)] hover:bg-[var(--sidebar-hover-bg)]"
                    @click="toggleFilterOption('party_a_name', opt.value)"
                  >
                    <span class="flex items-center gap-2 min-w-0">
                      <Checkbox
                        :modelValue="isFilterOptionSelected('party_a_name', opt.value)"
                        binary
                        @click.stop
                        @update:modelValue="toggleFilterOption('party_a_name', opt.value)"
                      />
                      <span class="truncate" :title="opt.label">{{ opt.label }}</span>
                    </span>
                  </button>
                  <div v-if="filteredPartyAOptions.length === 0" class="px-3 py-2 text-sm text-[var(--content-text-secondary)]">
                    无匹配甲方
                  </div>
                </div>
              </div>
            </div>
          </Popover>

          <button
            type="button"
            class="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-sm text-[var(--content-text-secondary)] hover:bg-[var(--sidebar-hover-bg)] hover:text-[var(--content-text)] transition-colors"
            @click="togglePartyBPopover"
          >
            <i class="pi pi-users text-sm"></i>
            <span class="flex items-center gap-1.5 min-w-0">
              <span>乙方</span>
              <span v-if="filters.party_b_name?.length" class="text-xs text-[var(--content-text-secondary)] truncate max-w-40">
                {{ filters.party_b_name.join(', ') }}
              </span>
              <span
                v-if="filters.party_b_name?.length"
                class="inline-flex items-center justify-center w-5 h-5 rounded-md text-[var(--content-text-secondary)] hover:bg-[var(--sidebar-hover-bg)] hover:text-[var(--content-text)] transition-colors"
                @click.stop="clearFilter('party_b_name')"
              >
                <i class="pi pi-times text-xs"></i>
              </span>
            </span>
          </button>

          <Popover ref="partyBPopover" style="background: transparent; border: none; box-shadow: none;">
            <div class="w-72 rounded-xl border border-[var(--content-border)] bg-[var(--content-bg)] p-2 shadow-xl">
              <div class="p-1">
                <div class="mb-2 flex items-center justify-between gap-2">
                  <div class="text-sm font-medium text-[var(--content-text)]">乙方单位</div>
                  <button
                    v-if="filters.party_b_name?.length"
                    type="button"
                    class="text-xs text-[var(--content-text-secondary)] hover:text-[var(--content-text)] transition-colors px-2 py-1 rounded-md hover:bg-[var(--sidebar-hover-bg)]"
                    @click="clearFilter('party_b_name')"
                  >
                    清空
                  </button>
                </div>
                <div class="mb-2">
                  <InputText
                    v-model="filterSearchInputs.party_b_name"
                    class="w-full !bg-[var(--input-bg)] !border-[var(--input-border)] !text-[var(--content-text)] placeholder:!text-[var(--content-text-secondary)] focus:!border-[var(--btn-primary-bg)]"
                    placeholder="搜索乙方..."
                  />
                </div>
                <div class="max-h-72 overflow-auto">
                  <button
                    v-for="opt in filteredPartyBOptions"
                    :key="opt.value"
                    type="button"
                    class="w-full flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors text-[var(--content-text)] hover:bg-[var(--sidebar-hover-bg)]"
                    @click="toggleFilterOption('party_b_name', opt.value)"
                  >
                    <span class="flex items-center gap-2 min-w-0">
                      <Checkbox
                        :modelValue="isFilterOptionSelected('party_b_name', opt.value)"
                        binary
                        @click.stop
                        @update:modelValue="toggleFilterOption('party_b_name', opt.value)"
                      />
                      <span class="truncate" :title="opt.label">{{ opt.label }}</span>
                    </span>
                  </button>
                  <div v-if="filteredPartyBOptions.length === 0" class="px-3 py-2 text-sm text-[var(--content-text-secondary)]">
                    无匹配乙方
                  </div>
                </div>
              </div>
            </div>
          </Popover>

          <button
            type="button"
            class="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-sm text-[var(--content-text-secondary)] hover:bg-[var(--sidebar-hover-bg)] hover:text-[var(--content-text)] transition-colors"
            @click="toggleProjectPopover"
          >
            <i class="pi pi-briefcase text-sm"></i>
            <span class="flex items-center gap-1.5 min-w-0">
              <span>项目</span>
              <span v-if="filters.project_name?.length" class="text-xs text-[var(--content-text-secondary)] truncate max-w-40">
                {{ filters.project_name.join(', ') }}
              </span>
              <span
                v-if="filters.project_name?.length"
                class="inline-flex items-center justify-center w-5 h-5 rounded-md text-[var(--content-text-secondary)] hover:bg-[var(--sidebar-hover-bg)] hover:text-[var(--content-text)] transition-colors"
                @click.stop="clearFilter('project_name')"
              >
                <i class="pi pi-times text-xs"></i>
              </span>
            </span>
          </button>

          <Popover ref="projectPopover" style="background: transparent; border: none; box-shadow: none;">
            <div class="w-72 rounded-xl border border-[var(--content-border)] bg-[var(--content-bg)] p-2 shadow-xl">
              <div class="p-1">
                <div class="mb-2 flex items-center justify-between gap-2">
                  <div class="text-sm font-medium text-[var(--content-text)]">项目名称</div>
                  <button
                    v-if="filters.project_name?.length"
                    type="button"
                    class="text-xs text-[var(--content-text-secondary)] hover:text-[var(--content-text)] transition-colors px-2 py-1 rounded-md hover:bg-[var(--sidebar-hover-bg)]"
                    @click="clearFilter('project_name')"
                  >
                    清空
                  </button>
                </div>
                <div class="mb-2">
                  <InputText
                    v-model="filterSearchInputs.project_name"
                    class="w-full !bg-[var(--input-bg)] !border-[var(--input-border)] !text-[var(--content-text)] placeholder:!text-[var(--content-text-secondary)] focus:!border-[var(--btn-primary-bg)]"
                    placeholder="搜索项目名称..."
                  />
                </div>
                <div class="max-h-72 overflow-auto">
                  <button
                    v-for="opt in filteredProjectOptions"
                    :key="opt.value"
                    type="button"
                    class="w-full flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors text-[var(--content-text)] hover:bg-[var(--sidebar-hover-bg)]"
                    @click="toggleFilterOption('project_name', opt.value)"
                  >
                    <span class="flex items-center gap-2 min-w-0">
                      <Checkbox
                        :modelValue="isFilterOptionSelected('project_name', opt.value)"
                        binary
                        @click.stop
                        @update:modelValue="toggleFilterOption('project_name', opt.value)"
                      />
                      <span class="truncate" :title="opt.label">{{ opt.label }}</span>
                    </span>
                  </button>
                  <div v-if="filteredProjectOptions.length === 0" class="px-3 py-2 text-sm text-[var(--content-text-secondary)]">
                    无匹配项目
                  </div>
                </div>
              </div>
            </div>
          </Popover>
        </div>
      </div>

      <div v-if="showSummary" class="mb-4">
        <div class="flex items-center justify-between gap-3 px-1 pb-2">
          <div class="text-sm font-medium text-[var(--content-text)]">统计</div>
          <div class="text-xs text-[var(--content-text-secondary)]">
            {{ isFiltering ? '按当前筛选结果统计' : '无筛选统计全部' }}
          </div>
        </div>
        <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div class="rounded-xl p-3 border" :style="{ borderColor: 'var(--content-border)' }">
            <div class="text-xs text-[var(--content-text-secondary)]">记录数</div>
            <div class="text-2xl font-bold mt-1 tabular-nums text-[var(--content-text)]">{{ filteredRows.length }}</div>
          </div>
          <div class="rounded-xl p-3 border" :style="{ borderColor: 'var(--content-border)' }">
            <div class="text-xs text-[var(--content-text-secondary)]">应收(付)款合计</div>
            <div class="text-2xl font-bold mt-1 tabular-nums text-[var(--content-text)]">{{ formatMoney(summary.expectedTotal) }}</div>
          </div>
          <div class="rounded-xl p-3 border" :style="{ borderColor: 'var(--content-border)' }">
            <div class="text-xs text-[var(--content-text-secondary)]">已收(付)款合计</div>
            <div class="text-2xl font-bold mt-1 tabular-nums text-[var(--content-text)]">{{ formatMoney(summary.receivedTotal) }}</div>
          </div>
          <div class="rounded-xl p-3 border" :style="{ borderColor: 'var(--content-border)' }">
            <div class="text-xs text-[var(--content-text-secondary)]">未收付金额合计</div>
            <div class="text-2xl font-bold mt-1 tabular-nums text-[var(--content-text)]">{{ formatMoney(summary.outstandingTotal) }}</div>
          </div>
        </div>
      </div>
<DataTable
          :value="tableData"
          dataKey="id"
          v-model:selection="selectedRow"
          selectionMode="single"
          :loading="loading"
          stripedRows
          class="flex-1 custom-datatable p-datatable-sm"
          :scrollable="true"
          scrollHeight="flex"
          @row-click="(e) => (selectedRow = e.data)"
          @row-dblclick="(e) => viewRow(e.data)"
        >
          

          <template #empty>
            <div class="flex flex-col items-center justify-center py-12 text-[var(--content-text-secondary)]">
              <i class="pi pi-inbox text-3xl mb-3 opacity-50"></i>
              <p>暂无收款计划数据</p>
            </div>
          </template>

          <Column
            v-if="visibleColumns.includes('contract_code')"
            field="contract_code"
            header="合同编号"
            style="width: 140px; min-width: 140px; max-width: 140px"
          >
            <template #body="slotProps">
              <span class="truncate block" :title="String(slotProps.data.contract_code || '')">{{ formatCell('contract_code', slotProps.data) }}</span>
            </template>
          </Column>
          <Column
            v-if="visibleColumns.includes('contract_name')"
            field="contract_name"
            header="合同名称"
            style="width: 260px; min-width: 260px; max-width: 260px"
          >
            <template #body="slotProps">
              <span class="truncate block" :title="String(slotProps.data.contract_name || '')">{{ formatCell('contract_name', slotProps.data) }}</span>
            </template>
          </Column>
          <Column
            v-if="visibleColumns.includes('plan_name')"
            field="plan_name"
            header="收付款名称"
            style="width: 220px; min-width: 220px; max-width: 220px"
          >
            <template #body="slotProps">
              <span class="truncate block" :title="String(formatPlanName(slotProps.data) || '')">{{ formatPlanName(slotProps.data) }}</span>
            </template>
          </Column>
          <Column
            v-if="visibleColumns.includes('receipt_frequency')"
            field="receipt_frequency"
            header="收付频率"
            style="width: 120px; min-width: 120px; max-width: 120px"
          >
            <template #body="slotProps">
              <span class="truncate block" :title="String(slotProps.data.receipt_frequency || '')">{{ formatCell('receipt_frequency', slotProps.data) }}</span>
            </template>
          </Column>
          <Column
            v-if="visibleColumns.includes('direction')"
            field="direction"
            header="合同收付方向"
            style="width: 120px; min-width: 120px; max-width: 120px"
          >
            <template #body="slotProps">
              <Tag :value="formatCell('direction', slotProps.data)" :severity="getDirectionSeverity(slotProps.data.direction)" />
            </template>
          </Column>
          <Column
            v-if="visibleColumns.includes('expected_amount')"
            field="expected_amount"
            header="应收(付)款"
            style="width: 140px; min-width: 140px; max-width: 140px"
          >
            <template #body="slotProps">
              <div class="w-full text-right tabular-nums">{{ formatMoney(slotProps.data.expected_amount) }}</div>
            </template>
          </Column>
          <Column
            v-if="visibleColumns.includes('expected_date')"
            field="expected_date"
            header="应收(付)日期"
            style="width: 140px; min-width: 140px; max-width: 140px"
          >
            <template #body="slotProps">
              <span>{{ formatCell('expected_date', slotProps.data) }}</span>
            </template>
          </Column>
          <Column
            v-if="visibleColumns.includes('received_amount')"
            field="received_amount"
            header="已收(付)款"
            style="width: 140px; min-width: 140px; max-width: 140px"
          >
            <template #body="slotProps">
              <div class="w-full text-right tabular-nums">{{ formatMoney(slotProps.data.received_amount) }}</div>
            </template>
          </Column>
          <Column
            v-if="visibleColumns.includes('outstanding_amount')"
            field="outstanding_amount"
            header="未收付金额"
            style="width: 140px; min-width: 140px; max-width: 140px"
          >
            <template #body="slotProps">
              <div class="w-full text-right tabular-nums">{{ formatMoney(getOutstanding(slotProps.data)) }}</div>
            </template>
          </Column>
          <Column
            v-if="visibleColumns.includes('unreceived_ratio')"
            field="unreceived_ratio"
            header="未收比例"
            style="width: 200px; min-width: 200px; max-width: 200px"
          >
            <template #body="slotProps">
              <div class="flex min-w-[160px] flex-col gap-1">
                <div class="h-2 w-full rounded-full bg-slate-200">
                  <div
                    class="h-2 rounded-full transition-all bg-orange-500"
                    :style="{ width: getUnreceivedRatioValue(slotProps.data) + '%' }"
                  ></div>
                </div>
                <div class="w-full text-right tabular-nums text-xs text-[var(--content-text-secondary)]">
                  {{ getUnreceivedRatioText(slotProps.data) }}
                </div>
              </div>
            </template>
          </Column>
          <Column
            v-if="visibleColumns.includes('remark')"
            field="remark"
            header="备注"
            style="width: 260px; min-width: 260px; max-width: 260px"
          >
            <template #body="slotProps">
              <span class="truncate block" :title="String(slotProps.data.remark || '')">{{ formatCell('remark', slotProps.data) }}</span>
            </template>
          </Column>

          <Column header="操作" :exportable="false" style="width: 140px; min-width: 140px; max-width: 140px">
            <template #body="slotProps">
              <div class="flex gap-2">
                <Button icon="pi pi-pencil" class="p-button-text p-button-sm p-button-rounded" @click="editRow(slotProps.data)" />
                <Button icon="pi pi-trash" class="p-button-text p-button-sm p-button-rounded p-button-danger" @click="deleteRow(slotProps.data)" />
              </div>
            </template>
          </Column>
        </DataTable>
        <div class="shrink-0 border-t border-[var(--content-border)] bg-transparent">
          <div class="flex items-center justify-between px-4 py-2">
            <span class="text-xs font-semibold text-[var(--content-text-secondary)] uppercase tracking-widest">
              显示
              {{ total ? Math.min((page - 1) * pageSize + 1, total) : 0 }}
              到
              {{ total ? Math.min(page * pageSize, total) : 0 }}
              共 {{ total }} 条
            </span>
          <Paginator
            :rows="pageSize"
            :totalRecords="total"
            :first="(page - 1) * pageSize"
            class="bg-transparent border-none custom-paginator !p-0"
            @page="onPageChange"
          />
          </div>
        </div>
    </section>
  </main>

  <ReceiptPlanDialog
    v-model:visible="dialogVisible"
    :initialData="editingRow"
    :readonly="dialogReadonly"
    @saved="onSaved"
  />
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Button from 'primevue/button'
import MultiSelect from 'primevue/multiselect'
import Checkbox from 'primevue/checkbox'
import Popover from 'primevue/popover'
import InputText from 'primevue/inputtext'
import Paginator from 'primevue/paginator'
import Tag from 'primevue/tag'
import { useToast } from 'primevue/usetoast'
import { useConfirm } from 'primevue/useconfirm'
import WindowControls from '../../../components/WindowControls.vue'
import ReceiptPlanDialog from './components/ReceiptPlanDialog.vue'
import { useReceiptPlanStore } from '../../../stores/contract/receiptPlanStore'
import { useLibraryStore } from '../../../stores/library/libraryStore'
import type { ContractInfoEntity } from '../../../../shared/types/contractInfo.types'

type ReceiptPlan = {
  id: string
  contract_id: string
  contract_code: string
  contract_name: string
  direction: string
  plan_name: string
  receipt_frequency: string
  expected_amount: number
  expected_date: string
  received_amount: number
  remark: string
  custom1: string
}

const toast = useToast()
const confirm = useConfirm()
const receiptPlanStore = useReceiptPlanStore()
const libraryStore = useLibraryStore()

const loading = ref(false)
const searchQuery = ref('')
const selectedRow = ref<ReceiptPlan | null>(null)
const dialogVisible = ref(false)
const editingRow = ref<ReceiptPlan | null>(null)
const dialogReadonly = ref(false)

type ReceiptPlanFilters = {
  party_a_name?: string[]
  party_b_name?: string[]
  project_name?: string[]
}

type FilterOption = { label: string; value: string }
type MultiSelectFilterKey = keyof ReceiptPlanFilters

const filterBarVisible = ref(false)
const filters = ref<ReceiptPlanFilters>({})

const partyAPopover = ref<InstanceType<typeof Popover> | null>(null)
const partyBPopover = ref<InstanceType<typeof Popover> | null>(null)
const projectPopover = ref<InstanceType<typeof Popover> | null>(null)

const filterSearchInputs = ref({
  party_a_name: '',
  party_b_name: '',
  project_name: '',
})

const currentLibraryPath = computed(() => {
  const p = String(libraryStore.currentLibrary?.path || '').trim()
  if (p) return p
  return String(localStorage.getItem('currentLibraryPath') || '').trim()
})

const contractInfos = ref<ContractInfoEntity[]>([])

const contractInfoById = computed(() => {
  const map = new Map<string, ContractInfoEntity>()
  for (const c of contractInfos.value || []) {
    const id = String((c as any)?.id || '').trim()
    if (!id) continue
    map.set(id, c)
  }
  return map
})

const getPartyAName = (plan: ReceiptPlan) => {
  const info = contractInfoById.value.get(String(plan.contract_id || '').trim())
  return String((info as any)?.client_name || '').trim()
}

const getPartyBName = (plan: ReceiptPlan) => {
  const info = contractInfoById.value.get(String(plan.contract_id || '').trim())
  return String((info as any)?.party_b_name || '').trim()
}

const getProjectName = (plan: ReceiptPlan) => {
  const fromCustom = String(plan.custom1 || '').trim()
  if (fromCustom) return fromCustom
  const info = contractInfoById.value.get(String(plan.contract_id || '').trim())
  const groupName = String((info as any)?.group_name || '').trim()
  if (groupName) return groupName
  return String((info as any)?.folder_name || '').trim()
}

const buildFilterOptionsFromPlans = (key: MultiSelectFilterKey) => {
  const rows = Array.isArray(allRows.value) ? allRows.value : []
  const seen = new Set<string>()
  const options: FilterOption[] = []

  for (const r of rows) {
    const value =
      key === 'party_a_name'
        ? getPartyAName(r)
        : key === 'party_b_name'
          ? getPartyBName(r)
          : getProjectName(r)
    const v = String(value || '').trim()
    if (!v || seen.has(v)) continue
    seen.add(v)
    options.push({ label: v, value: v })
  }

  return options
}

const partyAOptions = computed(() => buildFilterOptionsFromPlans('party_a_name'))
const partyBOptions = computed(() => buildFilterOptionsFromPlans('party_b_name'))
const projectOptions = computed(() => buildFilterOptionsFromPlans('project_name'))

const filteredPartyAOptions = computed(() => {
  const q = String(filterSearchInputs.value.party_a_name || '').toLowerCase()
  return partyAOptions.value.filter(opt => opt.label.toLowerCase().includes(q))
})

const filteredPartyBOptions = computed(() => {
  const q = String(filterSearchInputs.value.party_b_name || '').toLowerCase()
  return partyBOptions.value.filter(opt => opt.label.toLowerCase().includes(q))
})

const filteredProjectOptions = computed(() => {
  const q = String(filterSearchInputs.value.project_name || '').toLowerCase()
  return projectOptions.value.filter(opt => opt.label.toLowerCase().includes(q))
})

const isFilterOptionSelected = (key: MultiSelectFilterKey, value: string) => {
  const current = filters.value[key] || []
  return current.includes(value)
}

const toggleFilterOption = (key: MultiSelectFilterKey, value: string) => {
  const newFilters: ReceiptPlanFilters = { ...filters.value }
  const current = Array.isArray(newFilters[key]) ? (newFilters[key] as string[]) : []
  if (current.includes(value)) {
    newFilters[key] = current.filter(v => v !== value)
  } else {
    newFilters[key] = [...current, value]
  }
  if (!newFilters[key]?.length) delete newFilters[key]
  filters.value = newFilters
  page.value = 1
}

const clearFilter = (key: MultiSelectFilterKey) => {
  const newFilters: ReceiptPlanFilters = { ...filters.value }
  delete newFilters[key]
  filters.value = newFilters
  page.value = 1
}

const togglePartyAPopover = (event: Event) => partyAPopover.value?.toggle(event)
const togglePartyBPopover = (event: Event) => partyBPopover.value?.toggle(event)
const toggleProjectPopover = (event: Event) => projectPopover.value?.toggle(event)

const hasActiveFilters = computed(() => {
  const f = filters.value
  return Boolean(f.party_a_name?.length || f.party_b_name?.length || f.project_name?.length)
})

const isFiltering = computed(() => Boolean(searchQuery.value.trim() || hasActiveFilters.value))

const RECEIPT_PLAN_COLUMNS_SETTING_KEY = 'contract_receipt_plan_table_columns'

const columnPopoverTrigger = ref<HTMLElement | null>(null)
const columnPopoverPanel = ref<HTMLElement | null>(null)
const isColumnPopoverOpen = ref(false)

const closeColumnPopover = () => {
  isColumnPopoverOpen.value = false
}

const toggleColumnPopover = () => {
  isColumnPopoverOpen.value = !isColumnPopoverOpen.value
}

const isPopoverTarget = (event: Event) => {
  const path = typeof event.composedPath === 'function' ? event.composedPath() : []
  return path.includes(columnPopoverTrigger.value as EventTarget) || path.includes(columnPopoverPanel.value as EventTarget)
}

const handleDocumentPointerDown = (event: Event) => {
  if (!isColumnPopoverOpen.value) return
  if (isPopoverTarget(event)) return
  closeColumnPopover()
}

const handleDocumentKeydown = (event: KeyboardEvent) => {
  if (event.key !== 'Escape') return
  closeColumnPopover()
}

const availableColumns: Array<{
  field:
    | 'contract_code'
    | 'contract_name'
    | 'plan_name'
    | 'receipt_frequency'
    | 'expected_amount'
    | 'direction'
    | 'expected_date'
    | 'received_amount'
    | 'outstanding_amount'
    | 'unreceived_ratio'
    | 'remark'
  header: string
}> = [
  { field: 'contract_code', header: '合同编号' },
  { field: 'contract_name', header: '合同名称' },
  { field: 'plan_name', header: '收付款名称' },
  { field: 'receipt_frequency', header: '收付频率' },
  { field: 'expected_amount', header: '应收(付)款' },
  { field: 'direction', header: '合同收付方向' },
  { field: 'expected_date', header: '应收(付)日期' },
  { field: 'received_amount', header: '已收(付)款' },
  { field: 'outstanding_amount', header: '未收付金额' },
  { field: 'unreceived_ratio', header: '未收比例' },
  { field: 'remark', header: '备注' },
]

const defaultColumns = [
  'contract_code',
  'contract_name',
  'plan_name',
  'receipt_frequency',
  'expected_amount',
  'direction',
  'expected_date',
  'received_amount',
  'outstanding_amount',
  'unreceived_ratio',
  'remark',
] as Array<(typeof availableColumns)[number]['field']>

const visibleColumns = ref<Array<(typeof availableColumns)[number]['field']>>([...defaultColumns])

const isAllSelected = computed(() => visibleColumns.value.length > 0 && visibleColumns.value.length === availableColumns.length)

const toggleSelectAll = (checked: boolean) => {
  if (checked) {
    visibleColumns.value = availableColumns.map(c => c.field)
  } else {
    visibleColumns.value = []
  }
}

const showSummary = ref(true)

const page = ref(1)
const pageSize = ref(10)
const total = ref(0)
const maxPage = computed(() => Math.max(1, Math.ceil(total.value / pageSize.value)))

const { plans: allRows } = storeToRefs(receiptPlanStore)
const tableData = ref<ReceiptPlan[]>([])

const sanitizeMoney = (value: unknown) => {
  const n = Number(value ?? 0)
  return Number.isFinite(n) ? n : 0
}

const formatMoney = (value: unknown) => {
  const n = sanitizeMoney(value)
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function formatCell(field: keyof ReceiptPlan, row: ReceiptPlan) {
  const v = (row as any)[field]
  if (v === undefined || v === null || v === '') return '-'
  return v
}

const formatPlanName = (row: ReceiptPlan) => {
  if (visibleColumns.value.includes('contract_code')) return String(row.plan_name || '-')
  const prefix = row.contract_code ? `[${row.contract_code}] ` : ''
  return `${prefix}${row.plan_name || '-'}`.trim()
}

const getOutstanding = (row: ReceiptPlan) => {
  return sanitizeMoney(row.expected_amount) - sanitizeMoney(row.received_amount)
}

const getUnreceivedRatioValue = (row: ReceiptPlan) => {
  const expected = sanitizeMoney(row.expected_amount)
  if (expected <= 0) return 0
  const ratio = (getOutstanding(row) / expected) * 100
  if (!Number.isFinite(ratio)) return 0
  return Math.max(0, Math.min(100, ratio))
}

const getUnreceivedRatioText = (row: ReceiptPlan) => {
  const expected = sanitizeMoney(row.expected_amount)
  if (expected <= 0) return '-'
  return `${getUnreceivedRatioValue(row).toFixed(0)}%`
}

const getDirectionSeverity = (direction: unknown) => {
  const d = String(direction ?? '').trim()
  if (d === '收款') return 'success'
  if (d === '付款') return 'danger'
  return 'secondary'
}

const filteredRows = computed<ReceiptPlan[]>(() => {
  const rows = Array.isArray(allRows.value) ? allRows.value : []
  const q = searchQuery.value.trim().toLowerCase()
  const f = filters.value
  const filteredByBar = hasActiveFilters.value
    ? rows.filter((r) => {
        if (f.party_a_name?.length) {
          const v = getPartyAName(r)
          if (!v || !f.party_a_name.includes(v)) return false
        }
        if (f.party_b_name?.length) {
          const v = getPartyBName(r)
          if (!v || !f.party_b_name.includes(v)) return false
        }
        if (f.project_name?.length) {
          const v = getProjectName(r)
          if (!v || !f.project_name.includes(v)) return false
        }
        return true
      })
    : rows

  if (!q) return filteredByBar
  return filteredByBar.filter((r) => {
    const hay = [
      r.contract_code,
      r.contract_name,
      r.plan_name,
      r.receipt_frequency,
      r.direction,
      r.expected_date,
      r.remark,
      r.custom1,
    ]
      .map(v => String(v ?? ''))
      .join(' ')
      .toLowerCase()
    return hay.includes(q)
  })
})

const summary = computed(() => {
  const rows = filteredRows.value
  const expectedTotal = rows.reduce((acc, r) => acc + sanitizeMoney(r.expected_amount), 0)
  const receivedTotal = rows.reduce((acc, r) => acc + sanitizeMoney(r.received_amount), 0)
  const outstandingTotal = rows.reduce((acc, r) => acc + getOutstanding(r), 0)
  return { expectedTotal, receivedTotal, outstandingTotal }
})

const applyPagination = () => {
  const rows = filteredRows.value
  total.value = rows.length
  const max = Math.max(1, Math.ceil(total.value / pageSize.value))
  if (page.value > max) page.value = max
  const start = (page.value - 1) * pageSize.value
  tableData.value = rows.slice(start, start + pageSize.value)
}

const loadVisibleColumns = () => {
  const raw = localStorage.getItem(RECEIPT_PLAN_COLUMNS_SETTING_KEY)
  if (!raw) return
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return
    const allowed = new Set(availableColumns.map(c => c.field))
    const next = parsed.map(String).filter((f) => allowed.has(f as any)) as Array<(typeof availableColumns)[number]['field']>
    if (next.length) {
      if (!next.includes('contract_code')) next.unshift('contract_code')
      if (!next.includes('contract_name')) {
        const idx = next.indexOf('contract_code')
        if (idx >= 0) next.splice(idx + 1, 0, 'contract_name')
        else next.unshift('contract_name')
      }
      if (!next.includes('unreceived_ratio')) {
        const idx = next.indexOf('outstanding_amount')
        if (idx >= 0) next.splice(idx + 1, 0, 'unreceived_ratio')
        else next.push('unreceived_ratio')
      }
      visibleColumns.value = next
    } else {
      visibleColumns.value = [...defaultColumns]
    }
  } catch {
  }
}

const saveVisibleColumns = () => {
  localStorage.setItem(RECEIPT_PLAN_COLUMNS_SETTING_KEY, JSON.stringify(visibleColumns.value))
}

const handleTitleBarDblClick = async () => {
  try {
    await window.electronAPI?.window?.toggleMaximize?.()
  } catch {
  }
}

function onPageChange(e: any) {
  page.value = Math.floor(e.first / e.rows) + 1
  pageSize.value = e.rows
  applyPagination()
}

function handleSearch() {
  page.value = 1
  applyPagination()
}

function refresh() {
  applyPagination()
}

function openAddDialog() {
  editingRow.value = null
  dialogReadonly.value = false
  dialogVisible.value = true
}

function editRow(row: ReceiptPlan) {
  editingRow.value = row
  dialogReadonly.value = false
  dialogVisible.value = true
}

function viewRow(row: ReceiptPlan) {
  editingRow.value = row
  dialogReadonly.value = true
  dialogVisible.value = true
}

function editSelected() {
  if (!selectedRow.value) {
    toast.add({ severity: 'warn', summary: '请选择一条记录', detail: '先在列表中选中需要修改的记录', life: 2500 })
    return
  }
  editRow(selectedRow.value)
}

async function deleteRow(row: ReceiptPlan) {
  if (!row?.id) return
  confirm.require({
    message: '确认删除该收款计划记录？',
    header: '删除确认',
    icon: 'pi pi-exclamation-triangle',
    acceptClass: 'p-button-danger',
    acceptLabel: '删除',
    rejectClass: 'p-button-text p-button-secondary',
    rejectLabel: '取消',
    accept: async () => {
      allRows.value = allRows.value.filter(r => r.id !== row.id)
      selectedRow.value = null
      applyPagination()
      toast.add({ severity: 'success', summary: '已删除', detail: '收款计划记录已删除', life: 2000 })
    },
  })
}

function deleteSelected() {
  if (!selectedRow.value) {
    toast.add({ severity: 'warn', summary: '请选择一条记录', detail: '先在列表中选中需要删除的记录', life: 2500 })
    return
  }
  deleteRow(selectedRow.value)
}

function onSaved(payload: { mode: 'create' | 'update'; row: ReceiptPlan }) {
  if (payload.mode === 'create') {
    allRows.value = [payload.row, ...allRows.value]
  } else {
    allRows.value = allRows.value.map(r => (r.id === payload.row.id ? payload.row : r))
  }
  dialogVisible.value = false
  selectedRow.value = payload.row
  applyPagination()
}

const exportCsv = () => {
  const rows = filteredRows.value
  if (rows.length === 0) {
    toast.add({ severity: 'info', summary: '无可导出数据', detail: '当前筛选结果为空', life: 2000 })
    return
  }

  const columns = availableColumns.filter(c => visibleColumns.value.includes(c.field))
  const header = columns.map(c => c.header)
  const escapeCsv = (v: unknown) => {
    const s = String(v ?? '')
    const escaped = s.replace(/"/g, '""')
    return `"${escaped}"`
  }

  const lines = [header.map(escapeCsv).join(',')]
  for (const r of rows) {
    const line = columns.map((c) => {
      if (c.field === 'outstanding_amount') return escapeCsv(formatMoney(getOutstanding(r)))
      if (c.field === 'expected_amount') return escapeCsv(formatMoney(r.expected_amount))
      if (c.field === 'received_amount') return escapeCsv(formatMoney(r.received_amount))
      if (c.field === 'unreceived_ratio') return escapeCsv(getUnreceivedRatioText(r))
      if (c.field === 'plan_name') return escapeCsv(formatPlanName(r))
      return escapeCsv((r as any)[c.field] ?? '')
    })
    lines.push(line.join(','))
  }

  const bom = '\uFEFF'
  const csv = bom + lines.join('\r\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `收款计划_${new Date().toISOString().slice(0, 10)}.csv`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

onMounted(() => {
  loading.value = true
  try {
    loadVisibleColumns()
    receiptPlanStore.ensureSeeded()
    applyPagination()
  } finally {
    loading.value = false
  }
  document.addEventListener('pointerdown', handleDocumentPointerDown, true)
  document.addEventListener('keydown', handleDocumentKeydown, true)
})

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', handleDocumentPointerDown, true)
  document.removeEventListener('keydown', handleDocumentKeydown, true)
})

const loadContractInfos = async () => {
  const p = String(currentLibraryPath.value || '').trim()
  if (!p) {
    contractInfos.value = []
    return
  }
  try {
    const res = await window.electronAPI.library.getContractInfos(p)
    if (res.success && Array.isArray(res.data)) {
      contractInfos.value = res.data
    } else {
      contractInfos.value = []
    }
  } catch {
    contractInfos.value = []
  }
}

watch(currentLibraryPath, () => {
  loadContractInfos()
}, { immediate: true })

watch([filteredRows, page, pageSize], () => {
  applyPagination()
})

watch(visibleColumns, () => {
  saveVisibleColumns()
}, { deep: true })
</script>
