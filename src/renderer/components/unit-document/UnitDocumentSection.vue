<template>
  <section class="space-y-4 p-6 rounded-xl bg-[var(--content-card-bg)] border border-[var(--content-border)] shadow-sm">
    <div class="flex items-center justify-between gap-3">
      <div class="flex items-center gap-2">
        <i class="pi pi-images text-[var(--btn-primary-bg)] text-lg"></i>
        <h3 class="font-bold text-[var(--content-text)] tracking-wide uppercase">证件信息</h3>
      </div>
      <div class="flex items-center gap-2">
        <Button size="small" label="营业执照" icon="pi pi-plus" text @click="pickAndUploadDocument('business_license')" />
        <Button size="small" label="其他证件" icon="pi pi-plus" text @click="pickAndUploadDocument('other')" />
      </div>
    </div>
    <div v-if="documents.length" class="overflow-x-auto whitespace-nowrap custom-scrollbar py-1">
      <div class="inline-flex gap-3">
        <div
          v-for="(doc, docIndex) in documents"
          :key="doc.id"
          class="w-56 shrink-0 rounded-lg border border-[var(--content-border)] bg-[var(--content-bg)] p-3"
        >
          <div class="text-sm font-semibold truncate">{{ doc.doc_name || '-' }}</div>
          <div class="mt-1 text-xs text-[var(--content-text-secondary)] truncate">
            {{ formatDocumentType(doc.doc_type) }} · {{ doc.doc_number || '无证件号' }}
          </div>
          <div
            class="mt-2 h-28 rounded-md bg-[var(--sidebar-bg)] border border-[var(--content-border)] flex items-center justify-center overflow-hidden cursor-pointer p-1"
            @click="openDocumentViewer(docIndex, 0)"
          >
            <img
              v-if="getDocumentPreviewUrl(doc)"
              :src="getDocumentPreviewUrl(doc)"
              class="w-full h-full object-contain"
            />
            <span v-else class="text-xs text-[var(--content-text-secondary)]">无预览</span>
          </div>
          <div class="mt-2 flex flex-wrap gap-1">
            <Tag v-if="doc.is_primary" severity="info" value="主证件" />
          </div>
          <div class="mt-2 flex items-center gap-1">
            <Button size="small" text icon="pi pi-folder-open" @click="openDocumentFile(doc.file_paths?.[0])" />
            <Button size="small" text icon="pi pi-clipboard" @click="copyDocumentFileToClipboard(doc)" v-tooltip.top="'复制到微信'" />
            <Button size="small" text icon="pi pi-star" @click="setPrimaryDocument(doc)" v-tooltip.top="'设为主证件'" />
            <Button size="small" text icon="pi pi-trash" severity="danger" @click="removeDocument(doc)" />
          </div>
        </div>
      </div>
    </div>
    <div v-else class="text-sm text-[var(--content-text-secondary)]">暂无证件</div>
  </section>

  <Dialog v-model:visible="documentViewerVisible" modal header="证件预览" :style="{ width: '72vw' }">
    <div class="flex items-center justify-between gap-2 mb-3">
      <Button size="small" text icon="pi pi-angle-left" @click="prevDocumentImage" />
      <div class="text-sm text-[var(--content-text-secondary)]">{{ activeDocumentTitle }}</div>
      <Button size="small" text icon="pi pi-angle-right" @click="nextDocumentImage" />
    </div>
    <div class="h-[62vh] rounded-lg border border-[var(--content-border)] bg-[var(--sidebar-bg)] overflow-hidden">
      <ContractFilesPreviewPane
        v-if="activeDocumentFilePath"
        :filePath="activeDocumentFilePath"
        :displayName="activeDocumentDisplayName"
        class="h-full"
      />
      <div v-else class="h-full flex items-center justify-center text-sm text-[var(--content-text-secondary)]">
        当前文件暂不支持预览
      </div>
    </div>
  </Dialog>

  <Dialog 
    v-model:visible="draftReviewVisible" 
    :modal="false"
    header="确认回填内容" 
    :draggable="true"
    :blockScroll="false"
    :dismissableMask="false"
    :closeOnEscape="true"
    :baseZIndex="1100"
    :position="isSideBySideMode ? 'right' : undefined"
    :style="{ width: isSideBySideMode ? '680px' : '680px', maxWidth: '92vw' }"
  >
    <div class="space-y-4">
      <div class="text-sm text-[var(--content-text-secondary)]">请先确认本次将写入单位档案的内容，确认后才会执行回填。</div>
      <div v-if="selectedDraftDocument" class="rounded-lg border border-[var(--content-border)] bg-[var(--sidebar-bg)] p-3">
        <div class="flex items-center justify-between gap-2">
          <div class="text-xs text-[var(--content-text-secondary)]">
            来源证件：{{ selectedDraftDocument.doc_name || formatDocumentType(selectedDraftDocument.doc_type) }}
          </div>
          <Button
            size="small"
            text
            icon="pi pi-external-link"
            label="查看大图"
            :disabled="!selectedDraftPreviewUrl"
            @click="openDraftImageViewer"
          />
        </div>
        <div class="mt-2 h-28 rounded-md border border-[var(--content-border)] bg-[var(--content-bg)] flex items-center justify-center overflow-hidden">
          <img
            v-if="selectedDraftPreviewUrl"
            :src="selectedDraftPreviewUrl"
            class="max-w-full max-h-full object-contain cursor-zoom-in"
            @click="openDraftImageViewer"
          />
          <span v-else class="text-xs text-[var(--content-text-secondary)]">当前证件暂无图片预览</span>
        </div>
      </div>
      <div class="rounded-lg border border-[var(--content-border)] overflow-hidden">
        <div class="grid grid-cols-[140px_1fr_1fr] bg-[var(--sidebar-bg)] text-xs font-bold uppercase tracking-wider text-[var(--content-text-secondary)]">
          <div class="px-4 py-3 border-r border-[var(--content-border)]">字段</div>
          <div class="px-4 py-3 border-r border-[var(--content-border)]">当前值</div>
          <div class="px-4 py-3">即将回填</div>
        </div>
        <div v-if="draftReviewItems.length">
          <div v-for="item in draftReviewItems" :key="item.key" class="grid grid-cols-[140px_1fr_1fr] border-t border-[var(--content-border)] text-sm">
            <div class="px-4 py-3 border-r border-[var(--content-border)] font-medium text-[var(--content-text)]">{{ item.label }}</div>
            <div class="px-4 py-3 border-r border-[var(--content-border)] text-[var(--content-text-secondary)] break-all">{{ item.currentValue || '-' }}</div>
            <div class="px-4 py-3 text-[var(--content-text)] break-all">{{ item.nextValue || '-' }}</div>
          </div>
        </div>
        <div v-else class="px-4 py-6 text-sm text-[var(--content-text-secondary)]">当前证件没有可回填的有效字段。</div>
      </div>
      <div class="flex items-center justify-end gap-2 pt-2">
        <Button size="small" text label="取消" @click="draftReviewVisible = false" />
        <Button size="small" severity="secondary" text label="忽略本次回填" @click="handleRejectDraftFromReview" />
        <Button size="small" label="确认回填" :disabled="!draftReviewItems.length" @click="confirmApplyDocumentDraft" />
      </div>
    </div>
  </Dialog>

  <Dialog 
    v-model:visible="draftImageViewerVisible" 
    :modal="false"
    header="证件原图查看" 
    :draggable="true"
    :blockScroll="false"
    :dismissableMask="false"
    :closeOnEscape="true"
    :baseZIndex="1000"
    :position="isSideBySideMode ? 'left' : undefined"
    :style="{ width: isSideBySideMode ? '88vw' : '88vw', maxWidth: '1200px' }"
  >
    <div class="space-y-3">
      <div class="flex items-center justify-between gap-2">
        <div class="text-xs text-[var(--content-text-secondary)]">
          缩放 {{ Math.round(draftImageScale * 100) }}% · 可滚轮缩放、按住拖动
        </div>
        <div class="flex items-center gap-1">
          <Button size="small" text icon="pi pi-search-minus" @click="zoomDraftImage(-0.1)" />
          <Button size="small" text icon="pi pi-search-plus" @click="zoomDraftImage(0.1)" />
          <Button size="small" text label="重置" @click="resetDraftImageTransform" />
        </div>
      </div>
      <div
        class="h-[68vh] rounded-lg border border-[var(--content-border)] bg-[#0f172a] overflow-hidden relative select-none"
        @wheel.prevent="onDraftImageWheel"
        @mousemove="onDraftImagePointerMove"
        @mouseup="onDraftImagePointerUp"
        @mouseleave="onDraftImagePointerUp"
      >
        <img
          v-if="selectedDraftPreviewUrl"
          :src="selectedDraftPreviewUrl"
          class="absolute left-1/2 top-1/2 max-w-none"
          :style="draftImageStyle"
          @mousedown.prevent="onDraftImagePointerDown"
          @dragstart.prevent
        />
        <div v-else class="h-full flex items-center justify-center text-sm text-white/70">
          当前证件暂无图片预览
        </div>
      </div>
      <div class="flex items-center justify-end gap-2 pt-2">
        <Button size="small" label="关闭" @click="draftImageViewerVisible = false" />
      </div>
    </div>
  </Dialog>

  <Dialog
    v-model:visible="documentProcessingVisible"
    modal
    header="正在处理证件"
    :closable="false"
    :closeOnEscape="false"
    :draggable="false"
    :style="{ width: '420px', maxWidth: '92vw' }"
  >
    <div class="flex flex-col items-center justify-center py-6 text-center">
      <ProgressSpinner style="width: 56px; height: 56px" strokeWidth="4" />
      <div class="mt-4 text-base font-semibold text-[var(--content-text)]">{{ documentProcessingTitle }}</div>
      <div class="mt-2 text-sm text-[var(--content-text-secondary)] leading-6">{{ documentProcessingMessage }}</div>
    </div>
  </Dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import Button from 'primevue/button';
import Dialog from 'primevue/dialog';
import ProgressSpinner from 'primevue/progressspinner';
import Tag from 'primevue/tag';
import { useConfirm } from 'primevue/useconfirm';
import { useToast } from 'primevue/usetoast';
import ContractFilesPreviewPane from '@/views/library/contract-files/components/ContractFilesPreviewPane.vue';
import type { Customer } from '../../../shared/types/customer.types';
import type { Supplier } from '../../../shared/types/supplier.types';
import type { UnitDocument, UnitDocumentOwnerType, UnitDocumentPatchDraft, UnitDocumentType } from '../../../shared/types/unitDocument.types';

type OwnerData = Customer | Supplier | null;
type DraftReviewItem = { key: keyof UnitDocumentPatchDraft; label: string; currentValue: string; nextValue: string };

const props = defineProps<{
  ownerType: UnitDocumentOwnerType;
  ownerData: OwnerData;
}>();

const emit = defineEmits<{
  (e: 'owner-updated', value: Customer | Supplier | null): void;
}>();

const toast = useToast();
const confirm = useConfirm();
const documents = ref<UnitDocument[]>([]);
const libraryPath = ref('');
const documentViewerVisible = ref(false);
const activeDocIndex = ref(0);
const activeDocFileIndex = ref(0);
const draftReviewVisible = ref(false);
const selectedDraftDocument = ref<UnitDocument | null>(null);
const draftImageViewerVisible = ref(false);
const draftImageScale = ref(1);
const draftImageOffsetX = ref(0);
const draftImageOffsetY = ref(0);
const draftImageDragging = ref(false);
const draftImageStartX = ref(0);
const draftImageStartY = ref(0);
const isSideBySideMode = ref(false); // 是否为并排显示模式
const documentProcessingVisible = ref(false);
const documentProcessingTitle = ref('正在处理证件');
const documentProcessingMessage = ref('正在准备上传文件，请稍候。');
const lastPromptedPendingDocumentId = ref('');

const formatDocumentType = (docType: UnitDocumentType) => docType === 'business_license' ? '营业执照' : '其他证件';
const normalizeUscc = (value: unknown) => {
  const text = String(value || '').toUpperCase().replace(/[^0-9A-Z]/g, '').trim();
  return text.length === 18 ? text : '';
};
const normalizePath = (value: string) => value.replace(/\\/g, '/');
const resolveDocumentFilePath = (relativePath?: string) => {
  const rel = String(relativePath || '').trim();
  if (!rel) return '';
  if (/^[a-zA-Z]:[\\/]/.test(rel) || rel.startsWith('/')) return rel;
  const base = String(libraryPath.value || '').trim();
  if (!base) return '';
  return `${normalizePath(base)}/${normalizePath(rel)}`;
};
const toFileUrl = (filePath?: string) => {
  const resolved = String(filePath || '').trim();
  if (!resolved) return '';
  const normalized = resolved.replace(/\\/g, '/');
  return normalized.startsWith('file://') ? normalized : `file:///${normalized.replace(/^\/+/, '')}`;
};
const isImageFile = (filePath?: string) => /\.(png|jpe?g|webp|bmp|gif)$/i.test(String(filePath || ''));
const getFileStem = (filePath: string) => {
  const normalized = String(filePath || '').trim();
  if (!normalized) return '';
  const fileName = normalized.split(/[\\/]/).pop() || normalized;
  return fileName.replace(/\.[^.]+$/, '').trim();
};

const activeDocument = computed(() => documents.value[activeDocIndex.value] || null);
const activeDocumentTitle = computed(() => activeDocument.value?.doc_name || '证件预览');
const activeDocumentFilePath = computed(() => {
  const doc = activeDocument.value;
  return doc ? resolveDocumentFilePath(doc.file_paths?.[activeDocFileIndex.value]) : '';
});
const activeDocumentDisplayName = computed(() => {
  const doc = activeDocument.value;
  if (!doc) return '证件预览';
  const rawPath = String(doc.file_paths?.[activeDocFileIndex.value] || '').trim();
  return rawPath.split(/[\\/]/).pop() || doc.doc_name || '证件预览';
});
const getDocumentPreviewUrl = (doc: UnitDocument) => {
  const previewPath = resolveDocumentFilePath(doc.preview_image_path || doc.file_paths?.[0]);
  if (!previewPath || !isImageFile(previewPath)) return '';
  return toFileUrl(previewPath);
};
const selectedDraftPreviewUrl = computed(() => selectedDraftDocument.value ? getDocumentPreviewUrl(selectedDraftDocument.value) : '');
const draftImageStyle = computed(() => ({
  transform: `translate(calc(-50% + ${draftImageOffsetX.value}px), calc(-50% + ${draftImageOffsetY.value}px)) scale(${draftImageScale.value})`,
  transformOrigin: 'center center',
  cursor: draftImageDragging.value ? 'grabbing' : 'grab',
}));

const clampDraftImageScale = (value: number) => Math.min(6, Math.max(0.2, Number(value || 1)));
const resetDraftImageTransform = () => {
  draftImageScale.value = 1;
  draftImageOffsetX.value = 0;
  draftImageOffsetY.value = 0;
};
const zoomDraftImage = (delta: number) => {
  draftImageScale.value = clampDraftImageScale(draftImageScale.value + delta);
};
const openDraftImageViewer = () => {
  if (!selectedDraftPreviewUrl.value) return;
  isSideBySideMode.value = true; // 设置为并排显示模式
  draftImageViewerVisible.value = true;
  resetDraftImageTransform();
};
const onDraftImageWheel = (event: WheelEvent) => {
  const next = draftImageScale.value + (event.deltaY < 0 ? 0.08 : -0.08);
  draftImageScale.value = clampDraftImageScale(next);
};
const onDraftImagePointerDown = (event: MouseEvent) => {
  draftImageDragging.value = true;
  draftImageStartX.value = event.clientX - draftImageOffsetX.value;
  draftImageStartY.value = event.clientY - draftImageOffsetY.value;
};
const onDraftImagePointerMove = (event: MouseEvent) => {
  if (!draftImageDragging.value) return;
  draftImageOffsetX.value = event.clientX - draftImageStartX.value;
  draftImageOffsetY.value = event.clientY - draftImageStartY.value;
};
const onDraftImagePointerUp = () => {
  draftImageDragging.value = false;
};

const parseDocumentDraft = (doc: UnitDocument | null | undefined): UnitDocumentPatchDraft => {
  let patch: Record<string, unknown> = {};
  try {
    patch = JSON.parse(String(doc?.ai_extract_json || '{}'));
  } catch {
    patch = {};
  }
  const taxNumber = normalizeUscc(patch.unified_social_credit_code) || normalizeUscc(patch.doc_number);
  return {
    name: String(patch.company_name || '').trim() || '',
    tax_number: taxNumber || '',
    legal_rep_name: String(patch.legal_representative || '').trim() || '',
    address: String(patch.address || '').trim() || '',
    reg_date: String(patch.reg_date || '').trim() || '',
    company_type: String(patch.company_type || '').trim() || '',
  };
};

const draftReviewItems = computed<DraftReviewItem[]>(() => {
  const owner = props.ownerData;
  if (!owner) return [];
  const patch = parseDocumentDraft(selectedDraftDocument.value);
  const candidates: DraftReviewItem[] = [
    { key: 'name', label: '单位名称', currentValue: String(owner.name || '').trim(), nextValue: String(patch.name || '').trim() },
    { key: 'tax_number', label: '统一社会信用代码', currentValue: String(owner.tax_number || '').trim(), nextValue: String(patch.tax_number || '').trim() },
    { key: 'legal_rep_name', label: '法人姓名', currentValue: String((owner as any).legal_rep_name || '').trim(), nextValue: String(patch.legal_rep_name || '').trim() },
    { key: 'address', label: '地址', currentValue: String(owner.address || '').trim(), nextValue: String(patch.address || '').trim() },
    { key: 'reg_date', label: '注册日期', currentValue: String(owner.reg_date || '').trim(), nextValue: String(patch.reg_date || '').trim() },
  ];
  if (props.ownerType === 'customer') {
    candidates.push({
      key: 'company_type',
      label: '公司类型',
      currentValue: String((owner as Customer).company_type || '').trim(),
      nextValue: String(patch.company_type || '').trim(),
    });
  }
  return candidates.filter(item => item.nextValue);
});

const hasDocumentDraftContent = (doc: UnitDocument | null | undefined) => {
  const patch = parseDocumentDraft(doc);
  return Boolean(patch.name || patch.tax_number || patch.legal_rep_name || patch.address || patch.reg_date || patch.company_type);
};

const openPendingDraftIfNeeded = () => {
  // 不再在加载时自动打开确认回填窗口
  // 只在添加证件后由 uploadDocument 函数主动调用
};

const loadLibraryPath = async () => {
  const res = await window.electronAPI.bootstrap.getInitStatus();
  libraryPath.value = String((res as any)?.data?.projectPath || (res as any)?.data?.libraryPath || '').trim();
};

const loadDocuments = async () => {
  const ownerId = String(props.ownerData?.id || '').trim();
  if (!ownerId) {
    documents.value = [];
    return;
  }
  const res = await window.electronAPI.unitDocument.list(props.ownerType, ownerId);
  documents.value = res.success && Array.isArray(res.data) ? res.data : [];
  // 不再自动打开待回填窗口
  // openPendingDraftIfNeeded();
};

const pickAndUploadDocument = async (docType: UnitDocumentType) => {
  if (!props.ownerData) return;
  const selected = await window.electronAPI.fs.selectFile({
    title: `选择${formatDocumentType(docType)}文件`,
    properties: ['openFile', 'multiSelections'],
  });
  const filePaths = Array.isArray((selected as any)?.data?.filePaths) ? (selected as any).data.filePaths as string[] : [];
  if (!filePaths.length) return;
  const manualDocName = docType === 'other' ? (getFileStem(filePaths[0]) || '其他证件') : '';
  documentProcessingTitle.value = `正在处理${formatDocumentType(docType)}`;
  documentProcessingMessage.value = '正在复制文件、生成预览并解析证件内容，请稍候。';
  documentProcessingVisible.value = true;
  try {
    const res = await window.electronAPI.unitDocument.add({
      ownerType: props.ownerType,
      ownerId: props.ownerData.id,
      docType,
      localFilePaths: filePaths,
      manualDocName,
    });
    if (!res.success) {
      toast.add({ severity: 'error', summary: '上传失败', detail: res.error || '证件上传失败', life: 3000 });
      return;
    }
    documentProcessingMessage.value = '证件处理完成，正在刷新列表。';
    await loadDocuments();
    toast.add({ severity: 'success', summary: '上传成功', detail: '证件已入库并完成AI解析', life: 2500 });
    
    // 添加证件后，如果有待回填的证件，自动打开确认回填窗口
    const pendingDoc = documents.value.find(item => item.ai_fill_status === 'pending' && hasDocumentDraftContent(item)) || null;
    if (pendingDoc) {
      selectedDraftDocument.value = pendingDoc;
      draftReviewVisible.value = true;
      lastPromptedPendingDocumentId.value = pendingDoc.id;
    }
  } finally {
    documentProcessingVisible.value = false;
  }
};

const removeDocument = async (doc: UnitDocument) => {
  confirm.require({
    header: '确认删除',
    message: `确定删除证件“${doc.doc_name || formatDocumentType(doc.doc_type)}”吗？`,
    icon: 'pi pi-exclamation-triangle',
    rejectLabel: '取消',
    acceptLabel: '删除',
    acceptClass: 'p-button-danger',
    accept: async () => {
      const res = await window.electronAPI.unitDocument.delete(doc.id);
      if (!res.success) {
        toast.add({ severity: 'error', summary: '删除失败', detail: res.error || '删除证件失败', life: 2500 });
        return;
      }
      await loadDocuments();
      toast.add({ severity: 'success', summary: '删除成功', detail: '证件已删除', life: 2000 });
    },
  });
};

const setPrimaryDocument = async (doc: UnitDocument) => {
  const res = await window.electronAPI.unitDocument.update({ id: doc.id, is_primary: 1 });
  if (!res.success) return;
  await loadDocuments();
};

const openDocumentFile = async (relativePath?: string) => {
  const filePath = resolveDocumentFilePath(relativePath);
  if (!filePath) return;
  await window.electronAPI.fs.openFile(filePath);
};

const copyDocumentFileToClipboard = async (doc: UnitDocument) => {
  const relativePath = doc.preview_image_path || doc.file_paths?.[0];
  const filePath = resolveDocumentFilePath(relativePath);
  if (!filePath) return;
  const res = await window.electronAPI.fs.clipboardWriteFile(filePath);
  toast.add({
    severity: res.success ? 'success' : 'warn',
    summary: res.success ? '已复制' : '复制失败',
    detail: res.success ? '文件已放入剪贴板，可到微信中粘贴发送' : (res.error || '无法复制到剪贴板'),
    life: 3000,
  });
};

const confirmApplyDocumentDraft = async () => {
  const doc = selectedDraftDocument.value;
  if (!doc) return;
  const patch = parseDocumentDraft(doc);
  const res = await window.electronAPI.unitDocument.applyDraft({
    documentId: doc.id,
    approvedPatch: {
      name: patch.name || undefined,
      tax_number: patch.tax_number || undefined,
      legal_rep_name: patch.legal_rep_name || undefined,
      address: patch.address || undefined,
      reg_date: patch.reg_date || undefined,
      company_type: patch.company_type || undefined,
    },
  });
  if (res.success) {
    emit('owner-updated', (res.data as Customer | Supplier | null) || null);
    draftReviewVisible.value = false;
    selectedDraftDocument.value = null;
    lastPromptedPendingDocumentId.value = '';
    await loadDocuments();
    toast.add({ severity: 'success', summary: '回填成功', detail: '证件字段已回填单位档案', life: 2500 });
    return;
  }
  toast.add({ severity: 'error', summary: '回填失败', detail: res.error || '证件字段回填失败', life: 2500 });
};

const rejectDocumentDraft = async (documentId: string) => {
  const res = await window.electronAPI.unitDocument.rejectDraft(documentId);
  if (!res.success) return;
  await loadDocuments();
};

const handleRejectDraftFromReview = async () => {
  const doc = selectedDraftDocument.value;
  if (!doc) return;
  const res = await window.electronAPI.unitDocument.rejectDraft(doc.id);
  if (!res.success) {
    toast.add({ severity: 'error', summary: '操作失败', detail: res.error || '忽略回填失败', life: 2500 });
    return;
  }
  draftReviewVisible.value = false;
  selectedDraftDocument.value = null;
  lastPromptedPendingDocumentId.value = '';
  await loadDocuments();
  toast.add({ severity: 'success', summary: '已忽略', detail: '本次回填已忽略', life: 2000 });
};

const openDocumentViewer = (docIndex: number, fileIndex: number) => {
  activeDocIndex.value = docIndex;
  activeDocFileIndex.value = fileIndex;
  documentViewerVisible.value = true;
};

const prevDocumentImage = () => {
  if (!documents.value.length) return;
  activeDocIndex.value = (activeDocIndex.value - 1 + documents.value.length) % documents.value.length;
  activeDocFileIndex.value = 0;
};

const nextDocumentImage = () => {
  if (!documents.value.length) return;
  activeDocIndex.value = (activeDocIndex.value + 1) % documents.value.length;
  activeDocFileIndex.value = 0;
};

watch(
  () => props.ownerData?.id,
  () => {
    void loadDocuments();
  },
  { immediate: true },
);

watch(draftImageViewerVisible, (value) => {
  if (!value) {
    // 关闭证件原图查看时，重置为居中模式
    isSideBySideMode.value = false;
  }
});

watch(draftReviewVisible, (value) => {
  if (!value) {
    selectedDraftDocument.value = null;
    draftImageViewerVisible.value = false;
  }
});

void loadLibraryPath();
</script>

<style scoped>
.custom-scrollbar::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background-color: var(--content-border);
  border-radius: 10px;
}

/* 确保确认回填弹窗始终在证件原图查看弹窗之上 */
:deep(.p-dialog) {
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
}

/* 确保证件原图查看弹窗的层级 */
:deep(.p-dialog[aria-label="证件原图查看"]) {
  z-index: 1000 !important;
}

/* 确保确认回填内容弹窗的层级更高 */
:deep(.p-dialog[aria-label="确认回填内容"]) {
  z-index: 1100 !important;
}
</style>
