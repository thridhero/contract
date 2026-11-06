<template>
  <Teleport to="body">
    <Transition name="fade">
      <div v-if="visible" class="file-copy-overlay" @click.self="handleOverlayClick">
        <div class="file-copy-dialog" :class="{ 'mini': miniMode }">
          <!-- 头部 -->
          <div class="dialog-header">
            <div class="header-title">
              <i class="pi pi-copy" v-if="isCopying"></i>
              <i class="pi pi-check-circle" v-else-if="isCompleted" style="color: var(--green-500)"></i>
              <i class="pi pi-times-circle" v-else-if="isFailed" style="color: var(--red-500)"></i>
              <i class="pi pi-info-circle" v-else></i>
              <span>{{ titleText }}</span>
            </div>
            <button v-if="!isCopying" class="close-btn" @click="close">
              <i class="pi pi-times"></i>
            </button>
          </div>

          <!-- 进度区域 -->
          <div class="dialog-body">
            <!-- 大文件显示字节进度 -->
            <div v-if="progress.totalBytes && progress.totalBytes > 0" class="byte-progress">
              <div class="progress-info">
                <span class="bytes">{{ formatBytes(progress.bytesCopied || 0) }} / {{ formatBytes(progress.totalBytes) }}</span>
                <span v-if="progress.speed" class="speed">{{ progress.speed }}</span>
              </div>
            </div>

            <!-- 进度条 -->
            <div class="progress-bar-container">
              <div class="progress-bar" :class="{ 'indeterminate': isCopying && percentNumber === 0 }">
                <div 
                  class="progress-fill" 
                  :style="{ width: percentNumber + '%' }"
                  :class="{ 'completed': isCompleted, 'error': isFailed }"
                ></div>
              </div>
              <span class="progress-text">{{ progress.percent }}%</span>
            </div>

            <!-- 文件计数 -->
            <div class="file-count">
              <span>{{ progress.current }} / {{ progress.total }} 个文件</span>
            </div>

            <!-- 当前文件名 -->
            <div v-if="progress.currentFile" class="current-file">
              <i class="pi pi-file"></i>
              <span class="filename" :title="progress.currentFile">{{ progress.currentFile }}</span>
            </div>

            <!-- 错误信息 -->
            <div v-if="error" class="error-message">
              <i class="pi pi-exclamation-triangle"></i>
              <span>{{ error }}</span>
            </div>

            <!-- 失败文件列表 -->
            <div v-if="failedFiles.length > 0" class="failed-files">
              <div class="failed-header" @click="showFailedList = !showFailedList">
                <i class="pi" :class="showFailedList ? 'pi-chevron-down' : 'pi-chevron-right'"></i>
                <span>{{ failedFiles.length }} 个文件失败</span>
              </div>
              <Transition name="slide">
                <div v-if="showFailedList" class="failed-list">
                  <div v-for="(item, index) in failedFiles" :key="index" class="failed-item">
                    <span class="failed-name">{{ item.file.name }}</span>
                    <span class="failed-error">{{ item.error }}</span>
                  </div>
                </div>
              </Transition>
            </div>
          </div>

          <!-- 底部按钮 -->
          <div class="dialog-footer">
            <template v-if="isCopying">
              <button class="btn btn-secondary" @click="miniMode = true" v-if="!miniMode">
                <i class="pi pi-minus"></i>
                最小化
              </button>
              <button class="btn btn-secondary" @click="miniMode = false" v-else>
                <i class="pi pi-window-maximize"></i>
                展开
              </button>
              <button class="btn btn-danger" @click="handleCancel">
                <i class="pi pi-times"></i>
                取消
              </button>
            </template>
            <template v-else>
              <button v-if="isFailed && !isCancelled" class="btn btn-primary" @click="handleRetry">
                <i class="pi pi-refresh"></i>
                重试
              </button>
              <button class="btn btn-secondary" @click="close">
                {{ closeButtonText }}
              </button>
            </template>
          </div>
        </div>

        <!-- 迷你模式悬浮窗 -->
        <div v-if="miniMode && isCopying" class="mini-float" @click="miniMode = false">
          <div class="mini-progress">
            <div class="mini-fill" :style="{ width: percentNumber + '%' }"></div>
          </div>
          <span class="mini-text">{{ progress.percent }}%</span>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useFileCopy, FileCopyItem } from '../composables/useFileCopy';

interface Props {
  modelValue: boolean;
  files?: FileCopyItem[];
  destDir?: string;
  options?: {
    chunkSize?: number;
    concurrency?: number;
    largeFileThreshold?: number;
  };
}

const props = defineProps<Props>();

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
  'completed': [result: { success: FileCopyItem[]; failed: Array<{ file: FileCopyItem; error: string }> }];
  'cancelled': [];
  'failed': [error: string];
}>();

// 使用 fileCopy composable
const fileCopy = useFileCopy();
const { 
  status, 
  progress, 
  error, 
  isCopying, 
  isCompleted, 
  isFailed, 
  isCancelled,
  percentNumber,
  copy, 
  cancel, 
  reset 
} = fileCopy;

// 本地状态
const miniMode = ref(false);
const showFailedList = ref(false);
const failedFiles = ref<Array<{ file: FileCopyItem; error: string }>>([]);

// 计算属性
const visible = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value)
});

const titleText = computed(() => {
  if (isCopying.value) return '文件拷贝中...';
  if (isCompleted.value) return '拷贝完成';
  if (isCancelled.value) return '已取消';
  if (isFailed.value) return '拷贝失败';
  return '准备拷贝';
});

const closeButtonText = computed(() => {
  if (isFailed.value) return '关闭';
  return '完成';
});

// 方法
function close() {
  visible.value = false;
  reset();
  miniMode.value = false;
  showFailedList.value = false;
  failedFiles.value = [];
}

function handleOverlayClick() {
  // 点击遮罩不关闭，防止误操作
  if (isCopying.value) {
    miniMode.value = true;
  }
}

async function handleCancel() {
  await cancel();
  emit('cancelled');
}

async function handleRetry() {
  if (props.files && props.destDir) {
    failedFiles.value = [];
    await startCopy();
  }
}

async function startCopy() {
  if (!props.files || !props.destDir) return;

  try {
    const result = await copy(props.files, props.destDir, props.options);
    failedFiles.value = result.failed;
    
    emit('completed', {
      success: result.success,
      failed: result.failed
    });
  } catch (err: any) {
    emit('failed', err.message);
  }
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// 监听显示状态，开始拷贝
watch(() => props.modelValue, (newVal) => {
  if (newVal && props.files && props.destDir) {
    reset();
    failedFiles.value = [];
    startCopy();
  }
});
</script>

