<template>
  <main class="flex h-full flex-col overflow-hidden bg-[var(--content-bg)] text-[var(--content-text)]">
    <header
      class="flex h-14 items-center justify-between border-b border-[var(--content-border)] px-4"
      style="-webkit-app-region: drag;"
    >
      <div class="flex min-w-0 items-center gap-3" style="-webkit-app-region: no-drag;">
        <Button
          size="small"
          icon="pi pi-arrow-left"
          class="invoice-icon-btn"
          text
          rounded
          aria-label="返回"
          v-tooltip.bottom="'返回'"
          @click="router.back()"
        />
        <h2 class="text-base font-semibold">发票管理</h2>
        <InputText
          v-model.trim="search"
          class="w-72"
          placeholder="搜索发票号/购销方/合同编号"
          @keyup.enter="refresh"
        />
      </div>
      <div class="flex items-center gap-2" style="-webkit-app-region: no-drag;">
        <Button
          size="small"
          icon="pi pi-filter"
          class="invoice-icon-btn transition-colors"
          text
          rounded
          aria-label="筛选"
          v-tooltip.bottom="'筛选'"
          :class="{ '!bg-[var(--sidebar-active-bg)] !text-[var(--btn-primary-bg)]': filterBarVisible }"
          @click="filterBarVisible = !filterBarVisible"
        />
        <Button
          size="small"
          icon="pi pi-plus"
          class="invoice-icon-btn"
          text
          rounded
          aria-label="新增"
          v-tooltip.bottom="'新增'"
          @click="openCreateDialog"
        />
        <Button
          size="small"
          icon="pi pi-trash"
          class="invoice-icon-btn"
          text
          rounded
          aria-label="批量删除"
          v-tooltip.bottom="'批量删除'"
          :disabled="!hasSelection"
          @click="deleteSelected"
        />
        <Button
          size="small"
          icon="pi pi-replay"
          class="invoice-icon-btn"
          text
          rounded
          aria-label="恢复"
          v-tooltip.bottom="'恢复'"
          :disabled="!canRestore"
          @click="restoreSelected"
        />
        <Button
          size="small"
          icon="pi pi-times"
          class="invoice-icon-btn"
          text
          rounded
          aria-label="彻底删除"
          v-tooltip.bottom="'彻底删除'"
          :disabled="!canRestore"
          @click="purgeSelected"
        />
        <Button
          size="small"
          icon="pi pi-link"
          class="invoice-icon-btn"
          text
          rounded
          aria-label="定位来源文件"
          v-tooltip.bottom="'定位来源文件'"
          :disabled="!hasSelection"
          @click="locateSourceFile"
        />
        <Button
          size="small"
          icon="pi pi-download"
          class="invoice-icon-btn"
          text
          rounded
          aria-label="导出"
          v-tooltip.bottom="'导出'"
          :loading="exporting"
          @click="exportData"
        />
        <Button
          size="small"
          icon="pi pi-refresh"
          class="invoice-icon-btn"
          text
          rounded
          aria-label="刷新"
          v-tooltip.bottom="'刷新'"
          @click="refresh"
        />
        <WindowControls />
      </div>
    </header>

    <section class="flex-1 overflow-hidden p-4">
      <div
        v-if="filterBarVisible"
        class="mb-2 flex items-center gap-3 rounded-lg border border-[var(--content-border)] bg-[var(--content-card-bg)] px-3 py-2"
      >
        <button
          type="button"
          class="text-sm text-[var(--content-text-secondary)] transition-colors hover:text-[var(--content-text)]"
          @click.stop="(event) => toggleFieldPopover('invoiceNo', event)"
        >
          发票号码
          <span v-if="filterInputs.invoiceNo" class="ml-1 text-xs text-[var(--content-text)]">
            {{ filterInputs.invoiceNo }}
          </span>
        </button>
        <button
          type="button"
          class="text-sm text-[var(--content-text-secondary)] transition-colors hover:text-[var(--content-text)]"
          @click.stop="(event) => toggleFieldPopover('sellerName', event)"
        >
          销售方
          <span v-if="filterInputs.sellerName" class="ml-1 text-xs text-[var(--content-text)]">
            {{ filterInputs.sellerName }}
          </span>
        </button>
        <button
          type="button"
          class="text-sm text-[var(--content-text-secondary)] transition-colors hover:text-[var(--content-text)]"
          @click.stop="(event) => toggleFieldPopover('buyerName', event)"
        >
          购买方
          <span v-if="filterInputs.buyerName" class="ml-1 text-xs text-[var(--content-text)]">
            {{ filterInputs.buyerName }}
          </span>
        </button>
        <Button
          v-if="hasActiveFieldFilters"
          size="small"
          label="清空筛选"
          text
          @click="clearFieldFilters"
        />
      </div>
      <Popover ref="invoiceNoPopover" style="background: transparent; border: none; box-shadow: none;">
        <div class="w-72 rounded-xl border border-[var(--content-border)] bg-[var(--content-bg)] p-2 shadow-xl">
          <div class="mb-2 text-sm font-medium text-[var(--content-text)]">发票号码</div>
          <InputText
            v-model.trim="filterInputs.invoiceNo"
            class="w-full"
            placeholder="输入发票号码"
            @keyup.enter="refresh"
          />
        </div>
      </Popover>
      <Popover ref="sellerNamePopover" style="background: transparent; border: none; box-shadow: none;">
        <div class="w-72 rounded-xl border border-[var(--content-border)] bg-[var(--content-bg)] p-2 shadow-xl">
          <div class="mb-2 text-sm font-medium text-[var(--content-text)]">销售方</div>
          <InputText
            v-model.trim="filterInputs.sellerName"
            class="w-full"
            placeholder="输入销售方"
            @keyup.enter="refresh"
          />
        </div>
      </Popover>
      <Popover ref="buyerNamePopover" style="background: transparent; border: none; box-shadow: none;">
        <div class="w-72 rounded-xl border border-[var(--content-border)] bg-[var(--content-bg)] p-2 shadow-xl">
          <div class="mb-2 text-sm font-medium text-[var(--content-text)]">购买方</div>
          <InputText
            v-model.trim="filterInputs.buyerName"
            class="w-full"
            placeholder="输入购买方"
            @keyup.enter="refresh"
          />
        </div>
      </Popover>
      <ContextMenu ref="rowContextMenu" :model="rowContextMenuItems" />
      <DataTable
        v-model:selection="selectedRow"
        v-model:contextMenuSelection="contextMenuRow"
        :value="rows"
        dataKey="id"
        selectionMode="multiple"
        :loading="loading"
        stripedRows
        rowHover
        class="h-full"
        scrollable
        scrollHeight="flex"
        :tableStyle="{ minWidth: '130rem' }"
        :sortField="sortField"
        :sortOrder="sortOrder"
        @sort="onSort"
        @row-contextmenu="onRowContextMenu"
      >
        <template #empty>
          <div class="py-8 text-center text-[var(--content-text-secondary)]">暂无发票数据</div>
        </template>
        <Column field="contract_code" header="合同编号" sortable style="min-width: 9rem;">
          <template #body="{ data }">
            <span class="invoice-cell-text" :title="String(data.contract_code || '-')">{{ data.contract_code || '-' }}</span>
          </template>
        </Column>
        <Column field="contract_name" header="合同名称" sortable style="min-width: 10rem;">
          <template #body="{ data }">
            <span class="invoice-cell-text" :title="String(data.contract_name || '-')">{{ data.contract_name || '-' }}</span>
          </template>
        </Column>
        <Column field="invoice_type" header="发票类型" style="min-width: 10rem;">
          <template #body="{ data }">
            <span class="invoice-cell-text" :title="String(data.invoice_type || '-')">{{ data.invoice_type || '-' }}</span>
          </template>
        </Column>
        <Column field="invoice_no" header="发票号" sortable style="min-width: 11rem;">
          <template #body="{ data }">
            <div class="flex min-w-0 items-center gap-1">
              <span class="invoice-cell-text min-w-0 flex-1" :title="String(data.invoice_no || '-')">{{ data.invoice_no || '-' }}</span>
              <Button
                v-if="data.invoice_no"
                size="small"
                icon="pi pi-copy"
                class="invoice-icon-btn"
                text
                rounded
                aria-label="复制发票号"
                v-tooltip.bottom="'复制发票号'"
                @click.stop="copyInvoiceNo(data.invoice_no)"
              />
            </div>
          </template>
        </Column>
        <Column field="issue_date" header="开票日期" sortable style="min-width: 8rem;" />
        <Column field="seller_name" header="销售方" style="min-width: 12rem;">
          <template #body="{ data }">
            <span class="invoice-cell-text" :title="String(data.seller_name || '-')">{{ data.seller_name || '-' }}</span>
          </template>
        </Column>
        <Column field="seller_tax_no" header="销售方税号" style="min-width: 11rem;">
          <template #body="{ data }">
            <span class="invoice-cell-text" :title="String(data.seller_tax_no || '-')">{{ data.seller_tax_no || '-' }}</span>
          </template>
        </Column>
        <Column field="buyer_name" header="购买方" style="min-width: 10rem;">
          <template #body="{ data }">
            <span class="invoice-cell-text" :title="String(data.buyer_name || '-')">{{ data.buyer_name || '-' }}</span>
          </template>
        </Column>
        <Column field="buyer_tax_no" header="购买方税号" style="min-width: 11rem;">
          <template #body="{ data }">
            <span class="invoice-cell-text" :title="String(data.buyer_tax_no || '-')">{{ data.buyer_tax_no || '-' }}</span>
          </template>
        </Column>
        <Column field="amount_without_tax" header="合计金额" sortable style="min-width: 8rem;" headerStyle="text-align: right;">
          <template #body="{ data }">
            <div class="w-full text-right tabular-nums">{{ formatMoney(data.amount_without_tax) }}</div>
          </template>
        </Column>
        <Column field="tax_amount" header="合计税额" sortable style="min-width: 8rem;" headerStyle="text-align: right;">
          <template #body="{ data }">
            <div class="w-full text-right tabular-nums">{{ formatMoney(data.tax_amount) }}</div>
          </template>
        </Column>
        <Column field="total_amount" header="价税合计" sortable style="min-width: 8rem;" headerStyle="text-align: right;">
          <template #body="{ data }">
            <div class="w-full text-right tabular-nums">{{ formatMoney(data.total_amount) }}</div>
          </template>
        </Column>
        <Column field="issuer_name" header="开票人信息" style="min-width: 8rem;">
          <template #body="{ data }">
            <span class="invoice-cell-text" :title="String(data.issuer_name || '-')">{{ data.issuer_name || '-' }}</span>
          </template>
        </Column>
        <Column field="currency" header="币种" style="min-width: 5rem;" />
        <Column header="操作" :exportable="false" style="min-width: 7rem;">
          <template #body="{ data }">
            <div class="flex items-center gap-1">
              <Button
                size="small"
                icon="pi pi-pencil"
                class="invoice-icon-btn"
                text
                rounded
                aria-label="编辑"
                v-tooltip.bottom="'编辑'"
                @click.stop="editRow(data)"
              />
              <Button
                size="small"
                icon="pi pi-trash"
                class="invoice-icon-btn"
                text
                rounded
                aria-label="删除"
                v-tooltip.bottom="'删除'"
                @click.stop="deleteRow(data)"
              />
            </div>
          </template>
        </Column>
        <Column field="parse_confidence" header="置信度" style="min-width: 6rem;">
          <template #body="{ data }">
            <Tag :value="formatConfidence(data.parse_confidence)" />
          </template>
        </Column>
      </DataTable>
      <div class="mt-2 flex flex-col border-t border-[var(--content-border)] px-2 py-2">
        <div class="flex items-center justify-between">
          <span class="text-xs text-[var(--content-text-secondary)]">
            <span v-if="hasSelection" class="mr-2 text-[var(--btn-primary-bg)]">已选择 {{ selectedCount }} 条</span>
            共 {{ total }} 条
          </span>
          <Paginator
            :rows="pageSize"
            :totalRecords="total"
            :first="(page - 1) * pageSize"
            @page="onPage"
          />
        </div>
        <div v-if="exporting" class="mt-2 px-2 w-full">
          <div class="flex justify-between text-xs text-[var(--content-text-secondary)] mb-1">
            <span>正在导出发票数据...</span>
            <span>{{ exportProgress }}%</span>
          </div>
          <ProgressBar :value="exportProgress" :showValue="false" style="height: 4px" />
        </div>
      </div>
    </section>

    <Dialog v-model:visible="dialogVisible" :header="editingId ? '编辑发票' : '新增发票'" modal :style="{ width: '60rem' }">
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="mb-1 block text-xs text-[var(--content-text-secondary)]">合同ID</label>
          <InputText v-model.trim="form.contract_id" class="w-full" />
        </div>
        <div>
          <label class="mb-1 block text-xs text-[var(--content-text-secondary)]">合同编号</label>
          <InputText v-model.trim="form.contract_code" class="w-full" />
        </div>
        <div>
          <label class="mb-1 block text-xs text-[var(--content-text-secondary)]">合同名称</label>
          <InputText v-model.trim="form.contract_name" class="w-full" />
        </div>
        <div>
          <label class="mb-1 block text-xs text-[var(--content-text-secondary)]">来源文件ID</label>
          <InputText v-model.trim="form.file_id" class="w-full" />
        </div>
        <div>
          <label class="mb-1 block text-xs text-[var(--content-text-secondary)]">发票类型</label>
          <InputText v-model.trim="form.invoice_type" class="w-full" />
        </div>
        <div>
          <label class="mb-1 block text-xs text-[var(--content-text-secondary)]">发票号</label>
          <InputText v-model.trim="form.invoice_no" class="w-full" />
        </div>
        <div>
          <label class="mb-1 block text-xs text-[var(--content-text-secondary)]">销售方</label>
          <InputText v-model.trim="form.seller_name" class="w-full" />
        </div>
        <div>
          <label class="mb-1 block text-xs text-[var(--content-text-secondary)]">销售方统一社会信用代码/纳税人识别号</label>
          <InputText v-model.trim="form.seller_tax_no" class="w-full" />
        </div>
        <div>
          <label class="mb-1 block text-xs text-[var(--content-text-secondary)]">购买方</label>
          <InputText v-model.trim="form.buyer_name" class="w-full" />
        </div>
        <div>
          <label class="mb-1 block text-xs text-[var(--content-text-secondary)]">购买方统一社会信用代码/纳税人识别号</label>
          <InputText v-model.trim="form.buyer_tax_no" class="w-full" />
        </div>
        <div>
          <label class="mb-1 block text-xs text-[var(--content-text-secondary)]">开票日期</label>
          <input v-model="form.issue_date" class="w-full rounded border border-[var(--input-border)] bg-[var(--input-bg)] px-3 py-2" type="date" />
        </div>
        <div>
          <label class="mb-1 block text-xs text-[var(--content-text-secondary)]">开票人信息</label>
          <InputText v-model.trim="form.issuer_name" class="w-full" />
        </div>
        <div>
          <label class="mb-1 block text-xs text-[var(--content-text-secondary)]">合计金额</label>
          <InputNumber v-model="form.amount_without_tax" class="w-full" :minFractionDigits="2" :maxFractionDigits="2" />
        </div>
        <div>
          <label class="mb-1 block text-xs text-[var(--content-text-secondary)]">合计税额</label>
          <InputNumber v-model="form.tax_amount" class="w-full" :minFractionDigits="2" :maxFractionDigits="2" />
        </div>
        <div>
          <label class="mb-1 block text-xs text-[var(--content-text-secondary)]">价税合计</label>
          <InputNumber v-model="form.total_amount" class="w-full" :minFractionDigits="2" :maxFractionDigits="2" />
        </div>
        <div class="col-span-2">
          <label class="mb-1 block text-xs text-[var(--content-text-secondary)]">发票明细（JSON）</label>
          <Textarea
            v-model="form.invoice_items_json"
            rows="6"
            autoResize
            class="w-full"
            placeholder='示例：[{"project_name":"服务费","unit_price":100.00,"quantity":2,"amount":200.00,"tax_rate":"13%","tax_amount":26.00}]'
          />
        </div>
        <div class="col-span-2">
          <label class="mb-1 block text-xs text-[var(--content-text-secondary)]">备注信息</label>
          <Textarea v-model="form.remark" rows="3" autoResize class="w-full" />
        </div>
      </div>
      <template #footer>
        <Button label="取消" text @click="dialogVisible = false" />
        <Button label="保存" @click="saveForm" />
      </template>
    </Dialog>
    <ContractInvoicePreviewDialog ref="previewDialogRef" />
  </main>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue';
import Button from 'primevue/button';
import Checkbox from 'primevue/checkbox';
import Column from 'primevue/column';
import ContextMenu from 'primevue/contextmenu';
import DataTable from 'primevue/datatable';
import Dialog from 'primevue/dialog';
import InputNumber from 'primevue/inputnumber';
import InputText from 'primevue/inputtext';
import Popover from 'primevue/popover';
import Paginator from 'primevue/paginator';
import ProgressBar from 'primevue/progressbar';
import Tag from 'primevue/tag';
import Textarea from 'primevue/textarea';
import { useConfirm } from 'primevue/useconfirm';
import { useToast } from 'primevue/usetoast';
import { useRouter } from 'vue-router';
import { useContractInvoiceStore } from '../../../stores/contract/contractInvoiceStore';
import type { ContractInvoice, ContractInvoiceCreateDTO, ContractInvoiceUpdateDTO } from '../../../../shared/types/contractInvoice.types';
import WindowControls from '../../../components/WindowControls.vue';
import ContractInvoicePreviewDialog from './components/ContractInvoicePreviewDialog.vue';
import { exportToExcel } from '../../../utils/excelExport';
import { createRendererLogger } from '../../../utils/logger';

const toast = useToast();
const confirm = useConfirm();
const store = useContractInvoiceStore();
const router = useRouter();
const logger = createRendererLogger('ContractInvoiceManagement');
const loading = computed(() => store.loading);
const rows = computed(() => store.rows);
const total = computed(() => store.total);

const page = ref(1);
const pageSize = ref(20);
const search = ref('');
const includeDeleted = ref(false);
const selectedRow = ref<ContractInvoice[]>([]);
const contextMenuRow = ref<ContractInvoice | null>(null);
const sortField = ref('created_at');
const sortOrder = ref(-1);
const filterBarVisible = ref(false);
const exporting = ref(false);
const exportProgress = ref(0);
const rowContextMenu = ref<InstanceType<typeof ContextMenu> | null>(null);
const invoiceNoPopover = ref<InstanceType<typeof Popover> | null>(null);
const sellerNamePopover = ref<InstanceType<typeof Popover> | null>(null);
const buyerNamePopover = ref<InstanceType<typeof Popover> | null>(null);
const previewDialogRef = ref<InstanceType<typeof ContractInvoicePreviewDialog> | null>(null);
const filterInputs = reactive({
  invoiceNo: '',
  sellerName: '',
  buyerName: '',
});

const dialogVisible = ref(false);
const editingId = ref('');
const form = reactive<ContractInvoiceCreateDTO>({
  contract_id: '',
  contract_code: '',
  contract_name: '',
  file_id: '',
  source_sha256: '',
  source_path: '',
  invoice_type: '',
  invoice_code: '',
  invoice_no: '',
  issue_date: '',
  seller_name: '',
  seller_tax_no: '',
  buyer_name: '',
  buyer_tax_no: '',
  amount_without_tax: undefined,
  tax_amount: undefined,
  total_amount: undefined,
  invoice_items_json: '[]',
  remark: '',
  issuer_name: '',
  currency: 'CNY',
});

const canRestore = computed(() => selectedRow.value.some(row => row.deleted_at));
const hasSelection = computed(() => selectedRow.value.length > 0);
const selectedCount = computed(() => selectedRow.value.length);
const hasActiveFieldFilters = computed(() => Boolean(filterInputs.invoiceNo || filterInputs.sellerName || filterInputs.buyerName));
const rowContextMenuItems = computed(() => {
  const hasSelection = selectedRow.value.length > 0;
  const hasDeletedItems = selectedRow.value.some(row => row.deleted_at);
  const hasActiveItems = selectedRow.value.some(row => !row.deleted_at);
  
  const items: any[] = [];
  
  if (hasSelection) {
    items.push({
      label: '预览发票',
      icon: 'pi pi-eye',
      command: () => {
        if (!selectedRow.value.length) return;
        const target = selectedRow.value[0];
        const index = rows.value.findIndex(r => r.id === target.id);
        previewDialogRef.value?.show(target, rows.value, index);
      },
    });

    items.push({
      label: selectedRow.value.length > 1 ? `修改(首项)` : '修改',
      icon: 'pi pi-pencil',
      command: () => {
        if (!selectedRow.value.length) return;
        openEditDialog();
      },
    });
    
    if (hasActiveItems) {
      items.push({
        label: selectedRow.value.length > 1 ? `批量删除 (${selectedRow.value.length})` : '删除',
        icon: 'pi pi-trash',
        command: () => {
          if (!selectedRow.value.length) return;
          void deleteSelected();
        },
      });
    }
    
    if (hasDeletedItems) {
      items.push({
        label: selectedRow.value.length > 1 ? `批量恢复 (${selectedRow.value.length})` : '恢复',
        icon: 'pi pi-replay',
        command: () => {
          if (!selectedRow.value.length) return;
          void restoreSelected();
        },
      });
      items.push({
        label: selectedRow.value.length > 1 ? `彻底删除 (${selectedRow.value.length})` : '彻底删除',
        icon: 'pi pi-times',
        command: () => {
          if (!selectedRow.value.length) return;
          void purgeSelected();
        },
      });
    }
    
    items.push({
      separator: true,
    });
    items.push({
      label: '查看源文件',
      icon: 'pi pi-file',
      command: () => {
        if (!selectedRow.value.length) return;
        void locateSourceFile();
      },
    });
  }
  
  return items;
});

const toggleFieldPopover = (
  field: 'invoiceNo' | 'sellerName' | 'buyerName',
  event: Event,
) => {
  if (field === 'invoiceNo') {
    invoiceNoPopover.value?.toggle(event);
    return;
  }
  if (field === 'sellerName') {
    sellerNamePopover.value?.toggle(event);
    return;
  }
  buyerNamePopover.value?.toggle(event);
};

const clearFieldFilters = () => {
  filterInputs.invoiceNo = '';
  filterInputs.sellerName = '';
  filterInputs.buyerName = '';
};

const resetForm = () => {
  editingId.value = '';
  form.contract_id = '';
  form.contract_code = '';
  form.contract_name = '';
  form.file_id = '';
  form.source_sha256 = '';
  form.source_path = '';
  form.invoice_type = '';
  form.invoice_code = '';
  form.invoice_no = '';
  form.issue_date = '';
  form.seller_name = '';
  form.seller_tax_no = '';
  form.buyer_name = '';
  form.buyer_tax_no = '';
  form.amount_without_tax = undefined;
  form.tax_amount = undefined;
  form.total_amount = undefined;
  form.invoice_items_json = '[]';
  form.remark = '';
  form.issuer_name = '';
  form.currency = 'CNY';
};

const exportData = async () => {
  if (exporting.value) return;
  
  exporting.value = true;
  exportProgress.value = 0;

  try {
    const fields: Array<
      'contract_code' | 'contract_name' | 'invoice_no' | 'seller_name' | 'seller_tax_no' | 'buyer_name' | 'buyer_tax_no'
    > = [
      'contract_code',
      'contract_name',
      'invoice_no',
      'seller_name',
      'seller_tax_no',
      'buyer_name',
      'buyer_tax_no',
    ];

    // Build the query exactly as in refresh, but no pagination limits (we will fetch all needed pages)
    const baseQuery = {
      includeDeleted: includeDeleted.value,
      invoiceNo: filterInputs.invoiceNo || undefined,
      sellerName: filterInputs.sellerName || undefined,
      buyerName: filterInputs.buyerName || undefined,
      search: search.value || undefined,
      searchFields: search.value ? fields : undefined,
      sortBy: sortField.value as any,
      sortOrder: sortOrder.value === 1 ? 'asc' : 'desc' as any,
    };

    // First fetch to get total
    const firstPage = await window.electronAPI.contractInvoice.getList({ ...baseQuery, page: 1, pageSize: 1 });
    if (!firstPage.success || !firstPage.data) {
      throw new Error(firstPage.error || 'Failed to fetch invoice total');
    }
    const totalRecords = Number(firstPage.data.total) || 0;
    
    if (totalRecords === 0) {
      toast.add({ severity: 'info', summary: '导出', detail: '没有数据可导出', life: 3000 });
      return;
    }

    // Fetch all pages (1000 per page to not overwhelm IPC, and update progress)
    const exportPageSize = 1000;
    const totalPages = Math.ceil(totalRecords / exportPageSize);
    let allData: ContractInvoice[] = [];

    for (let p = 1; p <= totalPages; p++) {
      const res = await window.electronAPI.contractInvoice.getList({
        ...baseQuery,
        page: p,
        pageSize: exportPageSize,
      });
      if (res.success && res.data && Array.isArray(res.data.data)) {
        allData = allData.concat(res.data.data);
      }
      exportProgress.value = Math.floor((p / totalPages) * 50); // Fetching is 50%
    }

    // Columns configuration for excel
    const columns = [
      { field: 'contract_code', header: '合同编号' },
      { field: 'contract_name', header: '合同名称' },
      { field: 'invoice_type', header: '发票类型' },
      { field: 'invoice_no', header: '发票号' },
      { field: 'issue_date', header: '开票日期' },
      { field: 'seller_name', header: '销售方' },
      { field: 'buyer_name', header: '购买方' },
      { field: 'amount_without_tax', header: '不含税金额' },
      { field: 'tax_amount', header: '合计税额' },
      { field: 'total_amount', header: '价税合计' },
      { field: 'issuer_name', header: '开票人信息' },
      { field: 'currency', header: '币种' },
      { field: 'parse_confidence', header: '置信度', format: (val: any) => formatConfidence(val) }
    ];

    exportProgress.value = 75; // Generating excel starts

    const result = await exportToExcel(allData, columns, '发票数据导出.xlsx');
    
    exportProgress.value = 100;
    
    if (result.success && result.filePath) {
      confirm.require({
        header: '导出成功',
        message: '发票数据已成功导出到 Excel，是否立即打开该文件？',
        icon: 'pi pi-check-circle',
        acceptClass: 'p-button-success',
        rejectClass: 'p-button-text',
        acceptLabel: '打开文件',
        rejectLabel: '关闭',
        accept: async () => {
          const openRes = await window.electronAPI.fs.openFile(result.filePath!);
          if (!openRes.success) {
            toast.add({ severity: 'error', summary: '打开失败', detail: openRes.error || '无法打开文件', life: 3000 });
          }
        },
        reject: () => {
          toast.add({ severity: 'success', summary: '导出成功', detail: '发票数据已保存', life: 3000 });
        }
      });
    }
  } catch (error) {
    console.error('Failed to export invoices:', error);
    toast.add({ severity: 'error', summary: '导出失败', detail: '导出过程发生异常', life: 3000 });
  } finally {
    exporting.value = false;
    exportProgress.value = 0;
  }
};

const refresh = async () => {
  const fields: Array<
    'contract_code' | 'contract_name' | 'invoice_no' | 'seller_name' | 'seller_tax_no' | 'buyer_name' | 'buyer_tax_no'
  > = [
    'contract_code',
    'contract_name',
    'invoice_no',
    'seller_name',
    'seller_tax_no',
    'buyer_name',
    'buyer_tax_no',
  ];
  await store.loadData({
    includeDeleted: includeDeleted.value,
    invoiceNo: filterInputs.invoiceNo || undefined,
    sellerName: filterInputs.sellerName || undefined,
    buyerName: filterInputs.buyerName || undefined,
    search: search.value || undefined,
    searchFields: search.value ? fields : undefined,
    page: page.value,
    pageSize: pageSize.value,
    sortBy: sortField.value as
      | 'contract_code'
      | 'contract_name'
      | 'invoice_no'
      | 'issue_date'
      | 'amount_without_tax'
      | 'tax_amount'
      | 'total_amount'
      | 'created_at'
      | 'updated_at',
    sortOrder: sortOrder.value === 1 ? 'asc' : 'desc',
  });
};

const onPage = (event: { page: number; rows: number }) => {
  page.value = event.page + 1;
  pageSize.value = event.rows;
  refresh();
};

const onSort = (event: { sortField?: string; sortOrder?: number }) => {
  sortField.value = event.sortField || 'created_at';
  sortOrder.value = event.sortOrder === 1 ? 1 : -1;
  page.value = 1;
  refresh();
};

const copyInvoiceNo = async (invoiceNo: unknown) => {
  const textToCopy = String(invoiceNo ?? '').trim();
  if (!textToCopy) return;

  try {
    await navigator.clipboard.writeText(textToCopy);
    toast.add({ severity: 'success', summary: '复制成功',  detail: '发票号已复制到剪贴板', life: 1800 });
  } catch (error) {
    logger.error('Failed to copy invoice no', error);
    toast.add({ severity: 'error', summary: '复制失败', detail: '请手动复制', life: 2600 });
  }
};

const openCreateDialog = () => {
  resetForm();
  dialogVisible.value = true;
};

const openEditDialog = () => {
  if (!selectedRow.value.length) return;
  resetForm();
  const row = selectedRow.value[0];
  editingId.value = row.id;
  form.contract_id = row.contract_id || '';
  form.contract_code = row.contract_code || '';
  form.contract_name = row.contract_name || '';
  form.file_id = row.file_id || '';
  form.source_sha256 = row.source_sha256 || '';
  form.source_path = row.source_path || '';
  form.invoice_type = row.invoice_type || '';
  form.invoice_code = row.invoice_code || '';
  form.invoice_no = row.invoice_no || '';
  form.issue_date = row.issue_date || '';
  form.seller_name = row.seller_name || '';
  form.seller_tax_no = row.seller_tax_no || '';
  form.buyer_name = row.buyer_name || '';
  form.buyer_tax_no = row.buyer_tax_no || '';
  form.amount_without_tax = typeof row.amount_without_tax === 'number' ? row.amount_without_tax : undefined;
  form.tax_amount = typeof row.tax_amount === 'number' ? row.tax_amount : undefined;
  form.total_amount = typeof row.total_amount === 'number' ? row.total_amount : undefined;
  form.invoice_items_json = row.invoice_items_json || '[]';
  form.remark = row.remark || '';
  form.issuer_name = row.issuer_name || '';
  form.currency = row.currency || 'CNY';
  dialogVisible.value = true;
};

const editRow = (row: ContractInvoice) => {
  selectedRow.value = [row];
  openEditDialog();
};

const deleteRow = (row: ContractInvoice) => {
  confirm.require({
    header: '删除确认',
    message: `确定软删除该发票记录吗？`,
    icon: 'pi pi-exclamation-triangle',
    acceptClass: 'p-button-danger',
    rejectClass: 'p-button-text',
    acceptLabel: '确定',
    rejectLabel: '取消',
    accept: async () => {
      const success = await store.remove(row.id);
      if (!success) {
        toast.add({ severity: 'error', summary: '删除失败', detail: '请稍后重试', life: 2000 });
        return;
      }
      await refresh();
      toast.add({ severity: 'success', summary: '已删除', life: 1800 });
    },
  });
};

const onRowContextMenu = (event: { originalEvent: MouseEvent; data: ContractInvoice }) => {
  contextMenuRow.value = event.data;
  const isAlreadySelected = selectedRow.value.some(row => row.id === event.data.id);
  if (!isAlreadySelected) {
    selectedRow.value = [...selectedRow.value, event.data];
  }
  rowContextMenu.value?.show(event.originalEvent);
};

const saveForm = async () => {
  if (!form.contract_id || !form.contract_code || !form.contract_name) {
    toast.add({ severity: 'warn', summary: '校验失败', detail: '合同ID/编号/名称为必填项', life: 2500 });
    return;
  }
  if (!form.file_id && !form.source_sha256) {
    toast.add({ severity: 'warn', summary: '校验失败', detail: '来源文件ID 或 source_sha256 至少填写一个', life: 2500 });
    return;
  }

  let ok = false;
  if (editingId.value) {
    const payload: ContractInvoiceUpdateDTO = { id: editingId.value, ...form };
    ok = Boolean(await store.updateItem(payload));
  } else {
    ok = Boolean(await store.createItem(form));
  }
  if (!ok) {
    toast.add({ severity: 'error', summary: '保存失败', detail: '请稍后重试', life: 2500 });
    return;
  }
  dialogVisible.value = false;
  await refresh();
  toast.add({ severity: 'success', summary: '保存成功', life: 1800 });
};

const deleteSelected = async () => {
  if (!selectedRow.value.length) return;
  const rows = selectedRow.value;
  const count = rows.length;
  confirm.require({
    header: '删除确认',
    message: `确定软删除选中的 ${count} 条发票记录吗？`,
    icon: 'pi pi-exclamation-triangle',
    acceptClass: 'p-button-danger',
    rejectClass: 'p-button-text',
    acceptLabel: '确定',
    rejectLabel: '取消',
    accept: async () => {
      const ids = rows.map(r => r.id);
      const deletedCount = await store.batchDelete(ids);
      if (deletedCount === 0) {
        toast.add({ severity: 'error', summary: '删除失败', life: 2000 });
        return;
      }
      selectedRow.value = [];
      await refresh();
      toast.add({ severity: 'success', summary: `已删除 ${deletedCount} 条记录`, life: 1800 });
    },
  });
};

const restoreSelected = async () => {
  if (!selectedRow.value.length) return;
  const ids = selectedRow.value.map(r => r.id);
  const restoredCount = await store.batchRestore(ids);
  if (restoredCount === 0) {
    toast.add({ severity: 'error', summary: '恢复失败', life: 2000 });
    return;
  }
  await refresh();
  toast.add({ severity: 'success', summary: `已恢复 ${restoredCount} 条记录`, life: 1800 });
};

const purgeSelected = async () => {
  if (!selectedRow.value.length) return;
  const rows = selectedRow.value;
  const count = rows.length;
  confirm.require({
    header: '彻底删除确认',
    message: `确定彻底删除选中的 ${count} 条发票记录吗？此操作不可恢复。`,
    icon: 'pi pi-exclamation-triangle',
    acceptClass: 'p-button-danger',
    rejectClass: 'p-button-text',
    acceptLabel: '确定',
    rejectLabel: '取消',
    accept: async () => {
      const ids = rows.map(r => r.id);
      const purgedCount = await store.batchPurge(ids);
      if (purgedCount === 0) {
        toast.add({ severity: 'error', summary: '彻底删除失败', life: 2000 });
        return;
      }
      selectedRow.value = [];
      await refresh();
      toast.add({ severity: 'success', summary: `已彻底删除 ${purgedCount} 条记录`, life: 1800 });
    },
  });
};

const locateSourceFile = async () => {
  const row = selectedRow.value[0];
  if (!row) return;
  if (!row.file_id) {
    toast.add({ severity: 'warn', summary: '无法定位', detail: '该记录缺少 file_id', life: 2400 });
    return;
  }
  const libraryPath = String(localStorage.getItem('currentLibraryPath') || '').trim();
  if (!libraryPath) {
    toast.add({ severity: 'warn', summary: '无法定位', detail: '未找到当前资源库路径', life: 2400 });
    return;
  }
  const listRes = await window.electronAPI.contractFiles.getList({
    libraryPath,
    contractId: row.contract_id,
    includeDeleted: true,
  });
  if (!listRes.success || !listRes.data) {
    toast.add({ severity: 'warn', summary: '无法定位', detail: listRes.error || '读取合同文件失败', life: 2400 });
    return;
  }
  const target = listRes.data.items.find((item) => item.fileId === row.file_id);
  if (!target?.path) {
    toast.add({ severity: 'warn', summary: '无法定位', detail: '来源文件不可定位', life: 2400 });
    return;
  }
  const openRes = await window.electronAPI.fs.openFile(target.path);
  if (!openRes.success) {
    toast.add({ severity: 'warn', summary: '无法定位', detail: openRes.error || '打开来源文件失败', life: 2400 });
    return;
  }
  toast.add({ severity: 'success', summary: '已打开来源文件', life: 1600 });
};

const formatMoney = (value: unknown) => {
  const num = Number(value);
  if (!Number.isFinite(num)) return '-';
  return num.toFixed(2);
};

const formatConfidence = (value: unknown) => {
  const num = Number(value);
  if (!Number.isFinite(num)) return '-';
  return `${Math.round(num * 100)}%`;
};

watch([search, includeDeleted], () => {
  page.value = 1;
  refresh();
});

watch(
  () => [filterInputs.invoiceNo, filterInputs.sellerName, filterInputs.buyerName],
  () => {
    page.value = 1;
    refresh();
  },
);

onMounted(() => {
  refresh();
});
</script>

<style scoped>
:deep(.invoice-icon-btn.p-button .p-button-icon) {
  color: var(--content-text);
}

:deep(.invoice-icon-btn.p-button:hover) {
  background: var(--sidebar-hover-bg);
}

:deep(.p-datatable .p-datatable-tbody > tr:hover) {
  background: var(--sidebar-hover-bg);
}

.invoice-cell-text {
  display: inline-block;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  vertical-align: middle;
}
</style>
