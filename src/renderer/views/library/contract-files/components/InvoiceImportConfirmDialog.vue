<template>
  <Dialog
    :visible="visible"
    modal
    header="发票导入确认"
    :style="{ width: '1200px' }"
    :breakpoints="{ '1400px': '96vw' }"
    :closable="!submitting"
    maximizable
    @update:visible="onVisibleChange"
  >
    <div v-if="currentCandidate" class="flex h-[70vh] min-h-[560px] gap-4">
      <section class="w-[58%] min-w-0 rounded-lg border border-[var(--content-border)] bg-[var(--content-bg)] p-2">
        <div class="mb-2 flex items-center justify-between text-xs text-[var(--content-text-secondary)]">
          <span>{{ fileName }}</span>
          <div class="flex items-center gap-2">
            <Button size="small" icon="pi pi-search-minus" text @click="zoomOut" />
            <Button size="small" icon="pi pi-search-plus" text @click="zoomIn" />
            <Tag v-if="isPdf" value="PDF" />
            <Tag v-else-if="isImage" value="图片" />
          </div>
        </div>
        <div class="h-[calc(100%-2rem)] overflow-auto rounded border border-[var(--content-border)] bg-black/5 p-2">
          <div v-if="isPdf" class="flex min-h-full items-start justify-center">
            <canvas ref="pdfCanvasRef" class="max-w-full rounded border border-[var(--content-border)] bg-white shadow-sm" />
          </div>
          <img
            v-else-if="isImage"
            :src="previewUrl"
            class="h-full w-full object-contain"
            alt="invoice-preview"
          />
          <div v-else class="flex h-full items-center justify-center">
            <Button label="打开源文件" icon="pi pi-external-link" text @click="openSourceFile" />
          </div>
          <div v-if="previewError" class="mt-2 text-xs text-[var(--red-500)]">{{ previewError }}</div>
        </div>
      </section>

      <section class="flex-1 min-w-0 rounded-lg border border-[var(--content-border)] bg-[var(--content-bg)] p-3">
        <div class="mb-3 flex items-center justify-between">
          <div class="text-sm font-medium">识别结果（可编辑）</div>
          <div class="flex items-center gap-2">
            <Button size="small" text icon="pi pi-angle-left" :disabled="activeIndex <= 0" @click="activeIndex -= 1" />
            <span class="text-xs text-[var(--content-text-secondary)]">{{ activeIndex + 1 }} / {{ editableCandidates.length }}</span>
            <Button size="small" text icon="pi pi-angle-right" :disabled="activeIndex >= editableCandidates.length - 1" @click="activeIndex += 1" />
          </div>
        </div>

        <div class="mb-4 rounded border border-[var(--content-border)] bg-[var(--sidebar-bg)] p-3">
          <div class="mb-2 text-xs font-medium text-[var(--content-text)]">发票信息</div>
          <div class="grid grid-cols-[96px_1fr] gap-x-2 gap-y-2 text-sm">
            <span class="self-center text-[var(--content-text-secondary)]">合同编号</span>
            <InputText :modelValue="currentCandidate.contractCode || ''" disabled size="small" />

            <span class="self-center text-[var(--content-text-secondary)]">合同名称</span>
            <InputText :modelValue="currentCandidate.contractName || ''" disabled size="small" />

            <span class="self-center text-[var(--content-text-secondary)]">发票类型</span>
            <InputText v-model.trim="currentCandidate.parseResult.data.invoiceType" size="small" />

            <span class="self-center text-[var(--content-text-secondary)]">发票代码</span>
            <InputText v-model.trim="currentCandidate.parseResult.data.invoiceCode" size="small" />

            <span class="self-center text-[var(--content-text-secondary)]">发票号码</span>
            <InputText v-model.trim="currentCandidate.parseResult.data.invoiceNo" size="small" />

            <span class="self-center text-[var(--content-text-secondary)]">开票日期</span>
            <input v-model="currentCandidate.parseResult.data.issueDate" class="h-[32px] w-full rounded border border-[var(--input-border)] bg-[var(--input-bg)] px-3 text-sm text-[var(--content-text)]" type="date" />

            <span class="self-center text-[var(--content-text-secondary)]">金额</span>
            <InputNumber v-model="currentCandidate.parseResult.data.totalAmount" size="small" :minFractionDigits="2" :maxFractionDigits="2" />

            <span class="self-center text-[var(--content-text-secondary)]">置信度</span>
            <span>{{ formatConfidence(currentCandidate.parseConfidence) }}</span>
          </div>
        </div>

        <div class="mb-3 rounded border border-[var(--content-border)] bg-[var(--sidebar-bg)] p-3">
          <div class="mb-2 text-xs font-medium text-[var(--content-text)]">甲方/乙方单位</div>
          <div class="grid grid-cols-[96px_1fr] gap-x-2 gap-y-2 text-sm">
            <span class="self-center text-[var(--content-text-secondary)]">购买方</span>
            <InputText v-model.trim="currentCandidate.parseResult.data.buyerName" size="small" />

            <span class="self-center text-[var(--content-text-secondary)]">购买方税号</span>
            <InputText v-model.trim="currentCandidate.parseResult.data.buyerTaxNo" size="small" />

            <span class="self-center text-[var(--content-text-secondary)]">销售方</span>
            <InputText v-model.trim="currentCandidate.parseResult.data.sellerName" size="small" />

            <span class="self-center text-[var(--content-text-secondary)]">销售方税号</span>
            <InputText v-model.trim="currentCandidate.parseResult.data.sellerTaxNo" size="small" />
          </div>
        </div>
      </section>
    </div>
    <div v-else class="py-8 text-center text-[var(--content-text-secondary)]">没有可确认的发票数据</div>

    <template #footer>
      <div class="flex w-full items-center justify-between">
        <span class="text-xs text-[var(--content-text-secondary)]">本次识别到 {{ editableCandidates.length }} 条发票记录</span>
        <div class="flex items-center gap-2">
          <Button label="取消导入" text :disabled="submitting" @click="onCancel" />
          <Button
            label="确认并导入"
            icon="pi pi-check"
            :loading="submitting"
            :disabled="!editableCandidates.length"
            @click="onConfirm"
          />
        </div>
      </div>
    </template>
  </Dialog>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue';
import Button from 'primevue/button';
import Checkbox from 'primevue/checkbox';
import Dialog from 'primevue/dialog';
import InputNumber from 'primevue/inputnumber';
import InputText from 'primevue/inputtext';
import Tag from 'primevue/tag';
import pdfWorkerSrc from 'pdfjs-dist/legacy/build/pdf.worker.mjs';
import type { ImportTaskInvoiceCandidate } from '../../../../../shared/types/importTask.types';
import type { Customer } from '../../../../../shared/types/customer.types';
import type { Supplier } from '../../../../../shared/types/supplier.types';

const props = defineProps<{
  visible: boolean;
  candidates: ImportTaskInvoiceCandidate[];
  submitting?: boolean;
}>();

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void;
  (e: 'confirm', payload: { candidates: ImportTaskInvoiceCandidate[]; partyActions: InvoicePartyAction[] }): void;
  (e: 'cancel'): void;
}>();

type PartyRole = 'customer' | 'supplier';

interface InvoicePartyAction {
  candidateKey: string;
  createCustomer: boolean;
  createSupplier: boolean;
}

interface PartyReviewItem {
  role: PartyRole;
  roleLabel: string;
  dbLabel: string;
  name: string;
  taxNo: string;
  matched: boolean;
  matchedBy: string;
  allowCreate: boolean;
}

const activeIndex = ref(0);
const editableCandidates = ref<ImportTaskInvoiceCandidate[]>([]);
const pdfCanvasRef = ref<HTMLCanvasElement | null>(null);
const previewError = ref('');
const pdfDocRef = ref<any>(null);
const customerRows = ref<Customer[]>([]);
const supplierRows = ref<Supplier[]>([]);
const optionsLoading = ref(false);
const optionsError = ref('');
const partySelectionMap = ref<Record<string, { customer?: boolean; supplier?: boolean }>>({});
const zoom = ref(1);
let renderToken = 0;
const currentCandidate = computed(() => editableCandidates.value[activeIndex.value]);

const cloneCandidates = (list: ImportTaskInvoiceCandidate[]) => JSON.parse(JSON.stringify(Array.isArray(list) ? list : [])) as ImportTaskInvoiceCandidate[];

watch(
  () => props.candidates,
  (list) => {
    editableCandidates.value = cloneCandidates(list);
    if (activeIndex.value >= editableCandidates.value.length) {
      activeIndex.value = Math.max(0, editableCandidates.value.length - 1);
    }
  },
  { deep: true, immediate: true },
);

watch(
  () => props.visible,
  (visible) => {
    if (visible) activeIndex.value = 0;
    if (visible) {
      void loadPartyOptions();
      void nextTick().then(() => renderCurrentPreview());
      return;
    }
    void renderCurrentPreview();
  },
);

watch(
  () => activeIndex.value,
  () => {
    void renderCurrentPreview();
  },
);

watch(
  () => currentCandidate.value?.sourcePath,
  () => {
    void renderCurrentPreview();
  },
);

watch(
  () => pdfCanvasRef.value,
  (canvas) => {
    if (!canvas) return;
    void renderCurrentPreview();
  },
);

const toFileUrl = (input: string) => {
  const value = String(input || '').trim();
  if (!value) return '';
  if (value.startsWith('file://') || value.startsWith('http://') || value.startsWith('https://')) {
    return value;
  }
  return `file:///${encodeURI(value.replace(/\\/g, '/'))}`;
};

const fileExt = computed(() => {
  const sourcePath = String(currentCandidate.value?.sourcePath || '');
  const name = sourcePath.split(/[\\/]/).pop() || '';
  const dot = name.lastIndexOf('.');
  return dot > 0 ? name.slice(dot + 1).toLowerCase() : '';
});

const previewUrl = computed(() => toFileUrl(String(currentCandidate.value?.sourcePath || '')));
const isPdf = computed(() => fileExt.value === 'pdf');
const isImage = computed(() => ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp'].includes(fileExt.value));
const fileName = computed(() => String(currentCandidate.value?.sourcePath || '').split(/[\\/]/).pop() || '');

const formatConfidence = (value: unknown) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return '-';
  return `${Math.round(n * 100)}%`;
};

const normalizeName = (value: unknown) => String(value || '').trim().replace(/\s+/g, '').toLowerCase();
const normalizeTaxNo = (value: unknown) => String(value || '').trim().toUpperCase().replace(/[^0-9A-Z]/g, '');
const normalizeDisplay = (value: unknown) => String(value || '').trim();

const buildCandidateKey = (candidate?: ImportTaskInvoiceCandidate) => {
  if (!candidate) return '';
  const data = candidate.parseResult?.data || {};
  return [
    String(candidate.contractId || ''),
    String(candidate.fileId || ''),
    String(candidate.sourcePath || ''),
    String(data.invoiceCode || ''),
    String(data.invoiceNo || ''),
  ].join('||');
};

const findCustomerMatch = (name: string, taxNo: string) => {
  const normalizedName = normalizeName(name);
  const normalizedTaxNo = normalizeTaxNo(taxNo);
  if (!normalizedName && !normalizedTaxNo) return { matched: false, matchedBy: '' };
  for (const row of customerRows.value) {
    const rowName = normalizeName(row.name);
    const rowTaxNo = normalizeTaxNo((row as any).tax_number);
    if (normalizedName && rowName && normalizedName === rowName) {
      return { matched: true, matchedBy: '名称匹配' };
    }
    if (normalizedTaxNo && rowTaxNo && normalizedTaxNo === rowTaxNo) {
      return { matched: true, matchedBy: '统一社会信用代码/纳税人识别号匹配' };
    }
  }
  return { matched: false, matchedBy: '' };
};

const findSupplierMatch = (name: string, taxNo: string) => {
  const normalizedName = normalizeName(name);
  const normalizedTaxNo = normalizeTaxNo(taxNo);
  if (!normalizedName && !normalizedTaxNo) return { matched: false, matchedBy: '' };
  for (const row of supplierRows.value) {
    const rowName = normalizeName(row.name);
    const rowTaxNo = normalizeTaxNo((row as any).tax_number);
    if (normalizedName && rowName && normalizedName === rowName) {
      return { matched: true, matchedBy: '名称匹配' };
    }
    if (normalizedTaxNo && rowTaxNo && normalizedTaxNo === rowTaxNo) {
      return { matched: true, matchedBy: '统一社会信用代码/纳税人识别号匹配' };
    }
  }
  return { matched: false, matchedBy: '' };
};

const buildPartyReviewItems = (candidate?: ImportTaskInvoiceCandidate): PartyReviewItem[] => {
  if (!candidate) return [];
  const data = candidate.parseResult?.data || {};
  const buyerName = normalizeDisplay(data.buyerName);
  const buyerTaxNo = normalizeDisplay(data.buyerTaxNo);
  const sellerName = normalizeDisplay(data.sellerName);
  const sellerTaxNo = normalizeDisplay(data.sellerTaxNo);
  const customerMatch = findCustomerMatch(buyerName, buyerTaxNo);
  const supplierMatch = findSupplierMatch(sellerName, sellerTaxNo);
  return [
    {
      role: 'customer',
      roleLabel: '识别甲方单位（购买方）',
      dbLabel: '甲方单位',
      name: buyerName,
      taxNo: buyerTaxNo,
      matched: customerMatch.matched,
      matchedBy: customerMatch.matchedBy,
      allowCreate: Boolean(buyerName || buyerTaxNo),
    },
    {
      role: 'supplier',
      roleLabel: '识别乙方单位（销售方）',
      dbLabel: '乙方单位',
      name: sellerName,
      taxNo: sellerTaxNo,
      matched: supplierMatch.matched,
      matchedBy: supplierMatch.matchedBy,
      allowCreate: Boolean(sellerName || sellerTaxNo),
    },
  ];
};

const currentPartyReviewItems = computed(() => buildPartyReviewItems(currentCandidate.value));
const currentMissingPartyItems = computed(() => currentPartyReviewItems.value.filter(item => item.allowCreate && !item.matched));

const isPartyChecked = (candidate: ImportTaskInvoiceCandidate | undefined, role: PartyRole, defaultValue: boolean) => {
  const key = buildCandidateKey(candidate);
  if (!key) return defaultValue;
  const bucket = partySelectionMap.value[key];
  if (!bucket) return defaultValue;
  const value = role === 'customer' ? bucket.customer : bucket.supplier;
  return typeof value === 'boolean' ? value : defaultValue;
};

const setPartyChecked = (candidate: ImportTaskInvoiceCandidate | undefined, role: PartyRole, checked: boolean) => {
  const key = buildCandidateKey(candidate);
  if (!key) return;
  const prev = partySelectionMap.value[key] || {};
  partySelectionMap.value[key] = role === 'customer'
    ? { ...prev, customer: checked }
    : { ...prev, supplier: checked };
};

const loadPartyOptions = async () => {
  optionsLoading.value = true;
  optionsError.value = '';
  try {
    const [customerRes, supplierRes] = await Promise.all([
      window.electronAPI.customer.getList({ page: 1, pageSize: 10000 }),
      window.electronAPI.supplier.getList({ page: 1, pageSize: 10000 }),
    ]);
    if (customerRes.success && customerRes.data) {
      customerRows.value = (customerRes.data.data || customerRes.data.items || []) as Customer[];
    } else {
      customerRows.value = [];
    }
    if (supplierRes.success && supplierRes.data) {
      supplierRows.value = (supplierRes.data.data || supplierRes.data.items || []) as Supplier[];
    } else {
      supplierRows.value = [];
    }
    if (!customerRes.success || !supplierRes.success) {
      optionsError.value = customerRes.error || supplierRes.error || '甲方/乙方单位数据加载失败';
    }
  } catch (error: any) {
    customerRows.value = [];
    supplierRows.value = [];
    optionsError.value = error?.message || '甲方/乙方单位数据加载失败';
  } finally {
    optionsLoading.value = false;
  }
};

const getPdfjs = async () => {
  const mod = await import('pdfjs-dist/legacy/build/pdf.mjs');
  if (!mod.GlobalWorkerOptions?.workerSrc) {
    const workerSrc = String(pdfWorkerSrc || '');
    mod.GlobalWorkerOptions.workerSrc = workerSrc.startsWith('file://') || workerSrc.startsWith('http')
      ? workerSrc
      : new URL(workerSrc, window.location.href).toString();
  }
  return mod;
};

const destroyPdfDoc = async () => {
  const doc = pdfDocRef.value;
  pdfDocRef.value = null;
  if (doc) {
    await doc.destroy().catch(() => void 0);
  }
};

const renderPdfToCanvas = async (sourcePath: string) => {
  const token = ++renderToken;
  previewError.value = '';
  let canvas = pdfCanvasRef.value;
  if (!canvas) {
    await nextTick();
    canvas = pdfCanvasRef.value;
  }
  if (!canvas) return;
  const readRes = await window.electronAPI.fs.readFileBytes(sourcePath);
  if (!readRes.success || !readRes.data) {
    throw new Error(readRes.error || '读取 PDF 失败');
  }
  const bytes = readRes.data instanceof Uint8Array ? readRes.data : new Uint8Array(readRes.data as any);
  const pdfjs = await getPdfjs();
  const loadingTask = pdfjs.getDocument({ data: bytes, disableWorker: true });
  const doc = await loadingTask.promise;
  if (token !== renderToken) {
    await doc.destroy().catch(() => void 0);
    return;
  }
  await destroyPdfDoc();
  pdfDocRef.value = doc;
  const page = await doc.getPage(1);
  const baseViewport = page.getViewport({ scale: 1 });
  const maxWidth = 620;
  const baseScale = baseViewport.width > 0 ? Math.min(1.8, maxWidth / baseViewport.width) : 1;
  const scale = Math.max(0.8, baseScale) * zoom.value;
  const viewport = page.getViewport({ scale });
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('无法创建 PDF 渲染上下文');
  canvas.width = Math.max(1, Math.floor(viewport.width));
  canvas.height = Math.max(1, Math.floor(viewport.height));
  await page.render({ canvasContext: ctx, viewport }).promise;
};

const renderCurrentPreview = async () => {
  const sourcePath = String(currentCandidate.value?.sourcePath || '').trim();
  await destroyPdfDoc();
  previewError.value = '';
  if (!props.visible || !sourcePath) return;
  if (!isPdf.value) return;
  try {
    await renderPdfToCanvas(sourcePath);
  } catch (error: any) {
    previewError.value = error?.message || 'PDF 预览失败，请点击“打开源文件”查看';
  }
};

const onVisibleChange = (nextVisible: boolean) => {
  if (props.submitting) return;
  emit('update:visible', nextVisible);
};

const onCancel = () => {
  emit('cancel');
  emit('update:visible', false);
};

const onConfirm = () => {
  const candidates = cloneCandidates(editableCandidates.value);
  const partyActions: InvoicePartyAction[] = candidates.map((candidate) => {
    const items = buildPartyReviewItems(candidate);
    const customerItem = items.find(item => item.role === 'customer');
    const supplierItem = items.find(item => item.role === 'supplier');
    return {
      candidateKey: buildCandidateKey(candidate),
      createCustomer: Boolean(customerItem && customerItem.allowCreate && !customerItem.matched && isPartyChecked(candidate, 'customer', true)),
      createSupplier: Boolean(supplierItem && supplierItem.allowCreate && !supplierItem.matched && isPartyChecked(candidate, 'supplier', true)),
    };
  });
  emit('confirm', { candidates, partyActions });
};

const openSourceFile = async () => {
  const sourcePath = String(currentCandidate.value?.sourcePath || '').trim();
  if (!sourcePath) return;
  await window.electronAPI.fs.openFile(sourcePath);
};

const zoomIn = async () => {
  if (!isPdf.value) return;
  zoom.value = Math.min(3, zoom.value + 0.2);
  await renderCurrentPreview();
};

const zoomOut = async () => {
  if (!isPdf.value) return;
  zoom.value = Math.max(0.5, zoom.value - 0.2);
  await renderCurrentPreview();
};

onBeforeUnmount(() => {
  void destroyPdfDoc();
});
</script>
