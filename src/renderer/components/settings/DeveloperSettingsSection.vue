<template>
  <div class="developer-settings">
    <!-- 业务缓存重置 -->
    <div class="mb-6">
      <h3 class="text-xs text-content-text-muted mb-2 px-1">业务缓存重置</h3>
      <div class="border border-content-border rounded-xl bg-content-card overflow-hidden p-4 flex flex-col gap-4">
        <p class="text-[13px] text-content-text-secondary leading-relaxed">
          清除渲染进程中用于业务数据回退读取的本地缓存（如字典分组与项目管理缓存），然后重新加载当前窗口。
        </p>
        <div class="flex gap-2">
          <Button
            label="清除缓存并重新加载"
            icon="pi pi-refresh"
            size="small"
            severity="warning"
            :loading="isResettingBusinessCache"
            :disabled="isResettingBusinessCache"
            @click="handleResetBusinessCache"
          />
        </div>
      </div>
    </div>

    <!-- OCR 状态检查 -->
    <div class="mb-6">
      <h3 class="text-xs text-content-text-muted mb-2 px-1">OCR 引擎状态</h3>
      <div class="border border-content-border rounded-xl bg-content-card overflow-hidden p-4 flex flex-col gap-4">
        <p class="text-[13px] text-content-text-secondary leading-relaxed">
          验证内置 PaddleOCR-json 运行时是否已正确安装并可在当前环境中运行。
        </p>

        <div class="flex flex-col gap-3">
          <div class="flex gap-2">
            <Button 
              label="检查 OCR 状态" 
              icon="pi pi-shield" 
              size="small" 
              :loading="isCheckingOcr" 
              @click="handleCheckOcrStatus" 
            />
          </div>
        </div>

        <div v-if="ocrStatus" class="mt-2 text-sm p-3 rounded border" :class="ocrStatus.usable ? 'border-green-500/30 bg-green-500/10 text-green-600' : 'border-red-500/30 bg-red-500/10 text-red-500'">
          <div class="flex items-center gap-2 mb-2">
            <i :class="ocrStatus.usable ? 'pi pi-check-circle' : 'pi pi-exclamation-circle'"></i>
            <span class="font-medium">{{ ocrStatus.usable ? 'OCR 引擎就绪' : 'OCR 引擎不可用' }}</span>
          </div>
          <div class="grid grid-cols-[80px_1fr] gap-y-1 text-[12px] opacity-90">
            <span class="text-content-text-muted">引擎:</span>
            <span class="font-mono">{{ ocrStatus.engine }}</span>
            <span class="text-content-text-muted">版本:</span>
            <span class="font-mono">{{ ocrStatus.version }}</span>
            <template v-if="ocrStatus.usable">
              <span class="text-content-text-muted">执行路径:</span>
              <span class="font-mono break-all">{{ ocrStatus.executablePath }}</span>
              <span class="text-content-text-muted">模型路径:</span>
              <span class="font-mono break-all">{{ ocrStatus.modelsPath }}</span>
            </template>
            <template v-else-if="ocrStatus.error">
              <span class="text-content-text-muted">错误详情:</span>
              <span class="break-all">{{ ocrStatus.error }}</span>
            </template>
          </div>
        </div>
      </div>
    </div>

    <!-- OCR 识别测试 -->
    <div class="mb-6">
      <h3 class="text-xs text-content-text-muted mb-2 px-1">OCR 识别测试</h3>
      <div class="border border-content-border rounded-xl bg-content-card overflow-hidden p-4 flex flex-col gap-4">
        <p class="text-[13px] text-content-text-secondary leading-relaxed">
          选择一个图片文件（PNG/JPG/BMP），直接调用内置 PaddleOCR-json 引擎进行识别。
        </p>

        <div class="flex flex-col gap-3">
          <div class="flex items-center gap-2">
            <Button 
              label="选择测试图片" 
              icon="pi pi-image" 
              size="small" 
              outlined 
              @click="handleSelectOcrImage" 
            />
            <span v-if="selectedOcrImagePath" class="text-xs text-content-text-muted truncate flex-1" :title="selectedOcrImagePath">
              {{ selectedOcrImagePath }}
            </span>
            <span v-else class="text-xs text-content-text-muted italic flex-1">
              未选择图片
            </span>
          </div>

          <div class="flex gap-2">
            <Button 
              label="开始 OCR 测试" 
              icon="pi pi-play" 
              size="small" 
              :disabled="!selectedOcrImagePath" 
              :loading="isOcrTesting" 
              @click="handleOcrTest" 
            />
            <Button 
              v-if="ocrTestResult" 
              label="清除结果" 
              icon="pi pi-trash" 
              size="small" 
              severity="secondary" 
              text 
              @click="clearOcrTestResult" 
            />
          </div>
        </div>

        <div v-if="ocrTestError" class="text-sm p-3 rounded border border-red-500/30 bg-red-500/10 text-red-500 flex items-start gap-2">
          <i class="pi pi-exclamation-circle mt-0.5"></i>
          <span class="break-all">{{ ocrTestError }}</span>
        </div>

        <div v-if="ocrTestResult" class="mt-2">
          <div class="flex items-center justify-between mb-2 px-1">
            <span class="text-xs font-medium text-content-text-secondary">识别结果:</span>
            <span v-if="ocrTestElapsedMs" class="text-[10px] text-content-text-muted">耗时: {{ ocrTestElapsedMs }}ms</span>
          </div>
          <div class="relative group">
            <pre class="bg-input-bg text-input-text p-4 rounded-lg text-[13px] font-mono overflow-x-auto max-h-[200px] border border-content-border custom-scrollbar whitespace-pre-wrap break-all">{{ ocrTestResult }}</pre>
            <Button 
              icon="pi pi-copy" 
              class="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity" 
              size="small" 
              text 
              rounded 
              title="复制内容"
              @click="copyOcrTestToClipboard" 
            />
          </div>
        </div>
      </div>
    </div>

    <!-- 文档转换测试 -->
    <div class="mb-6">
      <h3 class="text-xs text-content-text-muted mb-2 px-1">文档转换测试</h3>
      <div class="border border-content-border rounded-xl bg-content-card overflow-hidden p-4 flex flex-col gap-4">
        <p class="text-[13px] text-content-text-secondary leading-relaxed">
          手动选择一个文档文件，验证后端文档转换服务（PDF/DOC/DOCX）是否能够正确将其解析为 Markdown 格式。
          <span class="text-primary-500 font-medium">对于扫描版 PDF，系统将自动调用 PaddleOCR 进行识别。</span>
        </p>

        <div class="flex flex-col gap-3">
          <div class="flex items-center gap-2">
            <Button 
              label="选择测试文件" 
              icon="pi pi-file" 
              size="small" 
              outlined 
              @click="handleSelectFile" 
            />
            <span v-if="selectedPath" class="text-xs text-content-text-muted truncate flex-1" :title="selectedPath">
              {{ selectedPath }}
            </span>
            <span v-else class="text-xs text-content-text-muted italic flex-1">
              未选择文件
            </span>
          </div>

          <div class="flex gap-2">
            <Button 
              label="开始转换测试" 
              icon="pi pi-play" 
              size="small" 
              :disabled="!selectedPath" 
              :loading="isConverting" 
              @click="handleConvert" 
            />
            <Button 
              v-if="convertResult" 
              label="保存为 Markdown" 
              icon="pi pi-download" 
              size="small" 
              severity="success"
              outlined
              @click="handleSaveResult" 
            />
            <Button 
              v-if="convertResult" 
              label="清除结果" 
              icon="pi pi-trash" 
              size="small" 
              severity="secondary" 
              text 
              @click="clearResult" 
            />
          </div>
        </div>

        <div v-if="error" class="text-sm p-3 rounded border border-red-500/30 bg-red-500/10 text-red-500 flex items-start gap-2">
          <i class="pi pi-exclamation-circle mt-0.5"></i>
          <span class="break-all">{{ error }}</span>
        </div>

        <div v-if="convertResult" class="mt-2">
          <div class="flex items-center justify-between mb-2 px-1">
            <div class="flex items-center gap-2">
              <span class="text-xs font-medium text-content-text-secondary">转换结果 (Markdown):</span>
              <span v-if="conversionMetadata?.usedOcr" class="px-1.5 py-0.5 rounded bg-primary-500/10 text-primary-600 text-[10px] font-bold">OCR</span>
              <span v-else-if="conversionMetadata?.sourceType === 'text'" class="px-1.5 py-0.5 rounded bg-green-500/10 text-green-600 text-[10px] font-bold">TEXT</span>
            </div>
            <div class="flex items-center gap-3">
              <span v-if="conversionMetadata?.ocrEngine" class="text-[10px] text-content-text-muted">引擎: {{ conversionMetadata.ocrEngine }} ({{ conversionMetadata.ocrVersion }})</span>
              <span v-if="processingTime" class="text-[10px] text-content-text-muted">耗时: {{ processingTime }}ms</span>
            </div>
          </div>
          
          <div v-if="conversionMetadata" class="mb-3 p-2 rounded bg-content-bg/50 border border-content-border/50 text-[11px] grid grid-cols-2 gap-x-4 gap-y-1">
            <div class="flex justify-between"><span class="text-content-text-muted">来源类型:</span> <span class="font-mono">{{ conversionMetadata.sourceType }}</span></div>
            <div class="flex justify-between"><span class="text-content-text-muted">缓存状态:</span> <span class="font-mono" :class="conversionMetadata.cacheStatus === 'hit' ? 'text-green-600' : ''">{{ conversionMetadata.cacheStatus }}</span></div>
            <div class="flex justify-between" v-if="conversionMetadata.pageCount"><span class="text-content-text-muted">页数:</span> <span class="font-mono">{{ conversionMetadata.pageCount }}</span></div>
            <div class="flex justify-between" v-if="conversionMetadata.markdownPath"><span class="text-content-text-muted">缓存路径:</span> <span class="font-mono truncate ml-2" :title="conversionMetadata.markdownPath">{{ conversionMetadata.markdownPath }}</span></div>
          </div>

          <div class="relative group">
            <pre class="bg-input-bg text-input-text p-4 rounded-lg text-[13px] font-mono overflow-x-auto max-h-[300px] border border-content-border custom-scrollbar whitespace-pre-wrap break-all">{{ convertResult }}</pre>
            <Button 
              icon="pi pi-copy" 
              class="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity" 
              size="small" 
              text 
              rounded 
              title="复制内容"
              @click="copyToClipboard" 
            />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import Button from 'primevue/button';
import { useToast } from 'primevue/usetoast';
import { createRendererLogger } from '../../utils/logger';
import type { FileConversionMetadata } from '../../../shared/types/fileConversion.types';
import { clearBusinessBrowserCache } from '../../utils/businessCacheReset';

const logger = createRendererLogger('DeveloperSettingsSection');
const toast = useToast();
const isResettingBusinessCache = ref(false);

const selectedPath = ref('');
const isConverting = ref(false);
const convertResult = ref('');
const error = ref('');
const processingTime = ref<number | null>(null);
const conversionMetadata = ref<FileConversionMetadata | null>(null);

const isCheckingOcr = ref(false);
const ocrStatus = ref<{
  usable: boolean;
  engine: string;
  version: string;
  executablePath: string;
  modelsPath: string;
  error?: string;
} | null>(null);

const selectedOcrImagePath = ref('');
const isOcrTesting = ref(false);
const ocrTestResult = ref('');
const ocrTestError = ref('');
const ocrTestElapsedMs = ref<number | null>(null);

async function handleResetBusinessCache() {
  if (isResettingBusinessCache.value) return;
  const confirmed = window.confirm('该操作将清除业务缓存并立即重新加载窗口，是否继续？');
  if (!confirmed) return;

  isResettingBusinessCache.value = true;
  try {
    clearBusinessBrowserCache();
    toast.add({
      severity: 'success',
      summary: '业务缓存已清理',
      detail: '窗口将立即重新加载',
      life: 1200,
    });
    setTimeout(() => {
      window.location.reload();
    }, 200);
  } catch (err) {
    logger.error('清理业务缓存失败:', err);
    toast.add({
      severity: 'error',
      summary: '清理失败',
      detail: err instanceof Error ? err.message : String(err),
      life: 4000,
    });
    isResettingBusinessCache.value = false;
  }
}

async function handleCheckOcrStatus() {
  isCheckingOcr.value = true;
  ocrStatus.value = null;
  try {
    const result = await window.electronAPI.fileConversion.checkOcrStatus();
    if (result.success && result.data) {
      ocrStatus.value = result.data as any;
    } else {
      ocrStatus.value = {
        usable: false,
        engine: 'paddleocr-json',
        version: 'unknown',
        executablePath: '',
        modelsPath: '',
        error: result.error || '检查失败'
      };
    }
  } catch (err) {
    logger.error('检查 OCR 状态失败:', err);
    ocrStatus.value = {
      usable: false,
      engine: 'paddleocr-json',
      version: 'unknown',
      executablePath: '',
      modelsPath: '',
      error: err instanceof Error ? err.message : String(err)
    };
  } finally {
    isCheckingOcr.value = false;
  }
}

async function handleSelectOcrImage() {
  try {
    const result = await window.electronAPI.fs.selectFile({
      properties: ['openFile'],
      filters: [
        { name: '图片文件', extensions: ['png', 'jpg', 'jpeg', 'bmp', 'webp'] }
      ]
    });

    if (!result.success || !result.data || (result.data as any).canceled) {
      return;
    }

    const path = String((result.data as any).filePaths?.[0] || '');
    if (path) {
      selectedOcrImagePath.value = path;
      ocrTestError.value = '';
    }
  } catch (err) {
    logger.error('选择图片失败:', err);
    ocrTestError.value = '选择图片过程中发生错误';
  }
}

async function handleOcrTest() {
  if (!selectedOcrImagePath.value) return;

  isOcrTesting.value = true;
  ocrTestResult.value = '';
  ocrTestError.value = '';
  ocrTestElapsedMs.value = null;

  try {
    const result = await window.electronAPI.fileConversion.ocrTest(selectedOcrImagePath.value);
    if (result.success && result.data) {
      ocrTestResult.value = result.data.text;
      ocrTestElapsedMs.value = result.data.elapsedMs;
    } else {
      ocrTestError.value = result.error || 'OCR 测试失败';
    }
  } catch (err) {
    logger.error('OCR 测试请求失败:', err);
    ocrTestError.value = err instanceof Error ? err.message : String(err);
  } finally {
    isOcrTesting.value = false;
  }
}

function clearOcrTestResult() {
  ocrTestResult.value = '';
  ocrTestError.value = '';
  ocrTestElapsedMs.value = null;
}

function copyOcrTestToClipboard() {
  if (!ocrTestResult.value) return;
  navigator.clipboard.writeText(ocrTestResult.value)
    .then(() => {
      toast.add({
        severity: 'success',
        summary: '复制成功',
        detail: '识别结果已复制到剪贴板',
        life: 2000
      });
    })
    .catch(err => {
      logger.error('复制失败:', err);
    });
}

async function handleSelectFile() {
  try {
    const result = await window.electronAPI.fs.selectFile({
      properties: ['openFile'],
      filters: [
        { name: '文档文件', extensions: ['docx', 'doc', 'pdf', 'txt', 'md'] }
      ]
    });

    if (!result.success || !result.data || (result.data as any).canceled) {
      return;
    }

    const path = String((result.data as any).filePaths?.[0] || '');
    if (path) {
      selectedPath.value = path;
      error.value = '';
    }
  } catch (err) {
    logger.error('选择文件失败:', err);
    error.value = '选择文件过程中发生错误';
  }
}

async function handleConvert() {
  if (!selectedPath.value) return;

  isConverting.value = true;
  convertResult.value = '';
  error.value = '';
  processingTime.value = null;
  conversionMetadata.value = null;

  const startTime = Date.now();
  try {
    const result = await window.electronAPI.fileConversion.convertToMarkdown(selectedPath.value);
    
    processingTime.value = Date.now() - startTime;

    if (result.success && result.data) {
      convertResult.value = result.data.markdown;
      conversionMetadata.value = result.data.metadata || null;
      if (result.data.metadata?.processingTime) {
        processingTime.value = result.data.metadata.processingTime;
      }
    } else {
      error.value = result.error || '转换失败，未知错误';
    }
  } catch (err) {
    logger.error('转换请求失败:', err);
    error.value = err instanceof Error ? err.message : String(err);
  } finally {
    isConverting.value = false;
  }
}

async function handleSaveResult() {
  if (!convertResult.value) return;

  try {
    const defaultName = selectedPath.value 
      ? selectedPath.value.split(/[\\/]/).pop()?.replace(/\.[^/.]+$/, '') + '.md'
      : 'conversion_result.md';

    const saveResult = await window.electronAPI.fs.saveFile({
      title: '保存 Markdown 结果',
      defaultPath: defaultName,
      filters: [{ name: 'Markdown 文件', extensions: ['md'] }]
    });

    if (saveResult.success && saveResult.data && !saveResult.data.canceled && saveResult.data.filePath) {
      const writeResult = await window.electronAPI.fs.writeFile(saveResult.data.filePath, convertResult.value);
      if (writeResult.success) {
        toast.add({
          severity: 'success',
          summary: '保存成功',
          detail: `文件已保存至: ${saveResult.data.filePath}`,
          life: 3000
        });
      } else {
        throw new Error(writeResult.error || '写入文件失败');
      }
    }
  } catch (err) {
    logger.error('保存文件失败:', err);
    toast.add({
      severity: 'error',
      summary: '保存失败',
      detail: err instanceof Error ? err.message : String(err),
      life: 5000
    });
  }
}

function clearResult() {
  convertResult.value = '';
  error.value = '';
  processingTime.value = null;
  conversionMetadata.value = null;
}

function copyToClipboard() {
  if (!convertResult.value) return;
  navigator.clipboard.writeText(convertResult.value)
    .catch(err => {
      logger.error('复制失败:', err);
    });
}
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
  background-color: rgba(0, 0, 0, 0.1);
  border-radius: 10px;
}
.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background-color: rgba(0, 0, 0, 0.2);
}
</style>
