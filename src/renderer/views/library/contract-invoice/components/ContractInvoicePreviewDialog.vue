<template>
  <Dialog
    v-model:visible="visible"
    header="发票预览"
    modal
    :style="{ width: '80rem', maxWidth: '95vw' }"
    :dismissableMask="true"
  >
    <div class="invoice-container p-6 bg-[#f2f6ee] font-sans text-[#a54c37] mx-auto select-text relative shadow-sm rounded">
      <!-- Title Area -->
      <div class="flex justify-between items-start mb-6">
        <div class="flex-1 flex flex-col justify-start">
          <!-- QR Code Placeholder -->
          <div class="w-20 h-20 border border-[#a54c37] flex flex-col items-center justify-center text-[10px] opacity-60 mb-1">
            <i class="pi pi-qrcode text-3xl mb-1"></i>
            发票查验
          </div>
        </div>
        <div class="flex-1 text-center relative z-10">
          <h1 class="text-3xl font-bold tracking-widest border-b-[3px] border-[#a54c37] pb-2 inline-block">
            {{ invoice.invoice_type || '电子发票（普通发票）' }}
          </h1>
          <div class="absolute inset-0 flex items-center justify-center opacity-30 pointer-events-none -z-10 mt-6">
            <!-- Simulated Stamp -->
            <div class="w-28 h-28 rounded-full border-[3px] border-[#a54c37] flex flex-col items-center justify-center rotate-[-15deg]">
              <span class="text-xs font-bold tracking-widest mt-2">全国统一发票监制章</span>
              <span class="text-[10px] mt-1">国家税务总局</span>
            </div>
          </div>
        </div>
        <div class="flex-1 text-right text-sm leading-relaxed space-y-1">
          <div><span class="inline-block text-left text-[#a54c37]">发票号码：</span><span class="text-black ml-1">{{ invoice.invoice_no || '' }}</span></div>
          <div><span class="inline-block text-left text-[#a54c37]">开票日期：</span><span class="text-black ml-1">{{ formatIssueDate(invoice.issue_date) || '' }}</span></div>
        </div>
      </div>

      <!-- Main Content Table -->
      <div class="border-[2px] border-[#a54c37] text-sm flex flex-col bg-transparent relative z-20">
        <!-- Buyer / Seller Row -->
        <div class="flex border-b border-[#a54c37]">
          <!-- Buyer -->
          <div class="flex-1 flex border-r border-[#a54c37]">
            <div class="w-8 flex items-center justify-center border-r border-[#a54c37] p-2 writing-vertical text-center tracking-widest text-[#a54c37]">
              购买方信息
            </div>
            <div class="flex-1 p-2 space-y-3">
              <div class="flex items-start"><span class="w-auto text-[#a54c37] mr-2">名称：</span><span class="font-bold flex-1 text-black leading-tight">{{ invoice.buyer_name || '' }}</span></div>
              <div class="flex items-start"><span class="w-auto text-[#a54c37] mr-2">统一社会信用代码/纳税人识别号：</span><span class="flex-1 text-black font-mono tracking-wider">{{ invoice.buyer_tax_no || '' }}</span></div>
            </div>
          </div>
          <!-- Seller -->
          <div class="flex-1 flex">
            <div class="w-8 flex items-center justify-center border-r border-[#a54c37] p-2 writing-vertical text-center tracking-widest text-[#a54c37]">
              销售方信息
            </div>
            <div class="flex-1 p-2 space-y-3">
              <div class="flex items-start"><span class="w-auto text-[#a54c37] mr-2">名称：</span><span class="font-bold flex-1 text-black leading-tight">{{ invoice.seller_name || '' }}</span></div>
              <div class="flex items-start"><span class="w-auto text-[#a54c37] mr-2">统一社会信用代码/纳税人识别号：</span><span class="flex-1 text-black font-mono tracking-wider">{{ invoice.seller_tax_no || '' }}</span></div>
            </div>
          </div>
        </div>

        <!-- Items Table -->
        <div class="flex flex-col border-b border-[#a54c37] min-h-[14rem]">
          <div class="flex border-b border-[#a54c37] text-center text-[#a54c37]">
            <div class="flex-[3] p-1.5 border-r border-[#a54c37]">项目名称</div>
            <div class="flex-1 p-1.5 border-r border-[#a54c37]">单价</div>
            <div class="flex-1 p-1.5 border-r border-[#a54c37]">数量</div>
            <div class="flex-1 p-1.5 border-r border-[#a54c37]">金额</div>
            <div class="flex-1 p-1.5 border-r border-[#a54c37]">税率/征收率</div>
            <div class="flex-1 p-1.5">税额</div>
          </div>
          <div class="flex-1 flex flex-col text-black">
            <template v-if="parsedItems.length > 0">
              <div v-for="(item, idx) in parsedItems" :key="idx" class="flex text-center mt-1 mb-1">
                <div class="flex-[3] px-2 py-0.5 border-r border-transparent text-left">{{ item.project_name || item.name || '' }}</div>
                <div class="flex-1 px-2 py-0.5 border-r border-transparent text-right">{{ formatNumber(item.unit_price) }}</div>
                <div class="flex-1 px-2 py-0.5 border-r border-transparent text-right">{{ item.quantity || '' }}</div>
                <div class="flex-1 px-2 py-0.5 border-r border-transparent text-right">{{ formatNumber(item.amount) }}</div>
                <div class="flex-1 px-2 py-0.5 border-r border-transparent text-right">{{ item.tax_rate || '' }}</div>
                <div class="flex-1 px-2 py-0.5 text-right">{{ formatNumber(item.tax_amount) }}</div>
              </div>
            </template>
            <template v-else>
              <div class="flex-1 flex items-center justify-center opacity-40 text-[#a54c37]">
                暂无明细数据
              </div>
            </template>
          </div>
        </div>

        <!-- Totals Row -->
        <div class="flex border-b border-[#a54c37] text-center text-[#a54c37]">
          <div class="flex-[3] p-1.5 border-r border-[#a54c37]">合 计</div>
          <div class="flex-1 p-1.5 border-r border-transparent text-black"></div>
          <div class="flex-1 p-1.5 border-r border-transparent text-black"></div>
          <div class="flex-1 p-1.5 border-r border-transparent text-right text-black">￥{{ formatNumber(invoice.amount_without_tax) }}</div>
          <div class="flex-1 p-1.5 border-r border-transparent text-black"></div>
          <div class="flex-1 p-1.5 text-right text-black">￥{{ formatNumber(invoice.tax_amount) }}</div>
        </div>

        <!-- Grand Total Row -->
        <div class="flex border-b border-[#a54c37]">
          <div class="w-32 flex items-center justify-center border-r border-[#a54c37] p-2 text-center text-[#a54c37]">
            价税合计(大写)
          </div>
          <div class="flex-1 p-2 flex items-center text-black">
            <span class="mr-2 text-xl font-serif">⊗</span> <span>{{ numberToChinese(invoice.total_amount) }}</span>
          </div>
          <div class="w-64 p-2 flex items-center border-l border-[#a54c37] text-[#a54c37]">
            (小写) <span class="ml-2 text-black">￥{{ formatNumber(invoice.total_amount) }}</span>
          </div>
        </div>

        <!-- Remarks -->
        <div class="flex">
          <div class="w-8 flex items-center justify-center border-r border-[#a54c37] p-2 writing-vertical text-center tracking-widest text-[#a54c37]">
            备 注
          </div>
          <div class="flex-1 p-2 min-h-[5rem] whitespace-pre-wrap text-black text-xs">
            {{ invoice.remark || '' }}
          </div>
        </div>
      </div>

      <!-- Footer Info -->
      <div class="flex mt-3 text-sm text-[#a54c37]">
        <div class="mr-8">开票人：<span class="text-black">{{ invoice.issuer_name || '' }}</span></div>
      </div>
    </div>
    <template #footer>
      <div class="flex w-full items-center justify-between">
        <div class="flex gap-2">
          <Button label="上一张" icon="pi pi-chevron-left" @click="goPrev" :disabled="!hasPrev" text />
          <Button label="下一张" icon="pi pi-chevron-right" iconPos="right" @click="goNext" :disabled="!hasNext" text />
        </div>
        <Button label="关闭" @click="visible = false" />
      </div>
    </template>
  </Dialog>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from 'vue';
import Dialog from 'primevue/dialog';
import Button from 'primevue/button';
import type { ContractInvoice } from '../../../../../shared/types/contractInvoice.types';

const visible = ref(false);
const invoice = ref<Partial<ContractInvoice>>({});
const invoiceList = ref<ContractInvoice[]>([]);
const currentIndex = ref(-1);

const hasPrev = computed(() => currentIndex.value > 0);
const hasNext = computed(() => currentIndex.value >= 0 && currentIndex.value < invoiceList.value.length - 1);

const goPrev = () => {
  if (hasPrev.value) {
    currentIndex.value--;
    invoice.value = { ...invoiceList.value[currentIndex.value] };
  }
};

const goNext = () => {
  if (hasNext.value) {
    currentIndex.value++;
    invoice.value = { ...invoiceList.value[currentIndex.value] };
  }
};

const handleKeyDown = (e: KeyboardEvent) => {
  if (!visible.value) return;
  if (e.key === 'ArrowLeft') {
    goPrev();
  } else if (e.key === 'ArrowRight') {
    goNext();
  }
};

onMounted(() => {
  window.addEventListener('keydown', handleKeyDown);
});

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown);
});

const parsedItems = computed(() => {
  try {
    if (!invoice.value.invoice_items_json) return [];
    const items = JSON.parse(invoice.value.invoice_items_json);
    return Array.isArray(items) ? items : [];
  } catch (e) {
    return [];
  }
});

const formatNumber = (num: any) => {
  if (num === null || num === undefined || num === '') return '';
  const n = Number(num);
  return isNaN(n) ? '' : n.toFixed(2);
};

const formatIssueDate = (dateStr: string | undefined | null) => {
  if (!dateStr) return '';
  // Support yyyy-MM-dd
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return `${d.getFullYear()}年${String(d.getMonth() + 1).padStart(2, '0')}月${String(d.getDate()).padStart(2, '0')}日`;
};

const numberToChinese = (n: number | string | null | undefined) => {
  if (n === undefined || n === null || n === '') return '';
  let num = Number(n);
  if (isNaN(num)) return '';
  const fraction = ['角', '分'];
  const digit = ['零', '壹', '贰', '叁', '肆', '伍', '陆', '柒', '捌', '玖'];
  const unit = [
    ['元', '万', '亿'],
    ['', '拾', '佰', '仟']
  ];
  let head = num < 0 ? '欠' : '';
  num = Math.abs(num);
  let s = '';
  let dec = Math.round(num * 100) % 100;
  for (let i = 0; i < fraction.length; i++) {
    const val = Math.floor(dec / Math.pow(10, 1 - i)) % 10;
    if (val !== 0) {
      s += digit[val] + fraction[i];
    }
  }
  if (s === '') s = '整';
  let intPart = Math.floor(num);
  if (intPart === 0 && s === '整') return '零元整';
  if (intPart === 0) return head + s;
  
  let p = '';
  for (let i = 0; i < unit[0].length && intPart > 0; i++) {
    let q = '';
    for (let j = 0; j < unit[1].length && intPart > 0; j++) {
      q = digit[intPart % 10] + unit[1][j] + q;
      intPart = Math.floor(intPart / 10);
    }
    p = q.replace(/(零.)*零$/, '').replace(/^$/, '零') + unit[0][i] + p;
  }
  return head + p.replace(/(零.)*零元/, '元').replace(/(零.)+/g, '零').replace(/^整$/, '零元整') + (s === '整' ? '整' : s);
};

const show = (data: ContractInvoice, list: ContractInvoice[] = [], index: number = -1) => {
  invoice.value = { ...data };
  invoiceList.value = list;
  currentIndex.value = index;
  visible.value = true;
};

defineExpose({
  show
});
</script>

<style scoped>
.writing-vertical {
  writing-mode: vertical-lr;
  letter-spacing: 0.2em;
}
</style>
