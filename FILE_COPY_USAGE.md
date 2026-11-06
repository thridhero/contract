# 智能文件拷贝功能使用指南

## 概述

本项目实现了智能文件拷贝系统，根据文件特征自动选择最佳拷贝策略：

| 文件类型 | 策略 | 特点 |
|---------|------|------|
| 大文件 (>100MB) | 分块拷贝 | 支持断点续传，内存友好 |
| 小文件 (≤100MB) | 并发拷贝 | 多文件并行处理 |
| 大量文件 (>100个) | 批量优化 | 智能调度避免资源争用 |

## 核心文件

```
src/
├── main/
│   ├── services/
│   │   └── FileCopyService.ts      # 主进程文件拷贝服务
│   └── ipc/handlers/
│       └── fileCopyHandlers.ts     # IPC 处理器
├── renderer/
│   ├── composables/
│   │   └── useFileCopy.ts          # Vue 组合式函数
│   └── components/
│       └── FileCopyDialog.vue      # 进度对话框组件
```

## 使用方式

### 方式一：使用 FileCopyDialog 组件（推荐）

```vue
<template>
  <div>
    <button @click="showCopyDialog = true">开始拷贝</button>
    
    <FileCopyDialog
      v-model="showCopyDialog"
      :files="filesToCopy"
      :dest-dir="destinationPath"
      @completed="onCopyCompleted"
      @cancelled="onCopyCancelled"
      @failed="onCopyFailed"
    />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import FileCopyDialog from '../components/FileCopyDialog.vue';

const showCopyDialog = ref(false);
const destinationPath = '/path/to/dest';

const filesToCopy = [
  { src: '/path/to/file1.zip', name: 'file1.zip' },
  { src: '/path/to/file2.pdf', name: 'file2.pdf' },
  { src: '/path/to/large-file.iso', name: 'large-file.iso' }, // 大文件自动分块
];

function onCopyCompleted(result: { success: any[]; failed: any[] }) {
  console.log('拷贝完成', result);
  if (result.failed.length > 0) {
    console.warn('有文件失败:', result.failed);
  }
}

function onCopyCancelled() {
  console.log('用户取消了拷贝');
}

function onCopyFailed(error: string) {
  console.error('拷贝失败:', error);
}
</script>
```

### 方式二：使用 useFileCopy Composable

```vue
<template>
  <div>
    <div v-if="isCopying">
      <progress :value="percentNumber" max="100"></progress>
      <span>{{ progress.percent }}%</span>
      <span v-if="progress.speed">{{ progress.speed }}</span>
      <button @click="cancel">取消</button>
    </div>
    <button v-else @click="startCopy">开始拷贝</button>
  </div>
</template>

<script setup lang="ts">
import { useFileCopy } from '../composables/useFileCopy';

const {
  copy,
  cancel,
  status,
  progress,
  isCopying,
  isCompleted,
  isFailed,
  percentNumber,
  error
} = useFileCopy();

async function startCopy() {
  const files = [
    { src: '/path/to/source1.zip', name: 'source1.zip' },
    { src: '/path/to/source2.pdf', name: 'source2.pdf' },
  ];
  
  try {
    const result = await copy(files, '/path/to/dest', {
      chunkSize: 10 * 1024 * 1024,        // 10MB 分块
      concurrency: 3,                      // 3个并发
      largeFileThreshold: 100 * 1024 * 1024  // 100MB 视为大文件
    });
    
    console.log('拷贝成功:', result);
  } catch (err) {
    console.error('拷贝失败:', err);
  }
}
</script>
```

### 方式三：直接使用 Electron API

```typescript
// 开始拷贝
const result = await window.electronAPI.fileCopy.start(
  [
    { src: '/path/to/file1.zip', name: 'file1.zip' },
    { src: '/path/to/file2.pdf', name: 'file2.pdf' }
  ],
  '/path/to/dest',
  { 
    taskId: 'my-task-001',  // 可选，用于断点续传
    chunkSize: 10485760,     // 10MB
    concurrency: 3 
  }
);

// 监听进度
const unlisten = window.electronAPI.fileCopy.onProgress((data) => {
  console.log(`${data.percent}% - ${data.currentFile}`);
});

// 取消拷贝
await window.electronAPI.fileCopy.cancel('my-task-001');

// 获取进行中的任务
const activeTasks = await window.electronAPI.fileCopy.getActiveTasks();
```

## 高级特性

### 1. 断点续传

大文件拷贝支持断点续传。如果拷贝过程中断（如应用关闭、系统重启），再次拷贝同一文件时会自动从断点继续：

```typescript
// 使用相同的 taskId 可以恢复拷贝
const result = await window.electronAPI.fileCopy.start(
  [{ src: '/path/to/large-file.iso', name: 'large-file.iso' }],
  '/dest',
  { taskId: 'unique-task-id' }  // 相同的 taskId 会触发断点续传
);
```

### 2. 保持目录结构

使用 `relativePath` 可以保持原始目录结构：

```typescript
const files = [
  { 
    src: '/source/docs/readme.md', 
    name: 'readme.md',
    relativePath: 'docs/readme.md'  // 保持目录结构
  },
  { 
    src: '/source/src/main.ts', 
    name: 'main.ts',
    relativePath: 'src/main.ts'
  }
];

// 结果：/dest/docs/readme.md, /dest/src/main.ts
```

### 3. 配置选项

```typescript
interface FileCopyOptions {
  taskId?: string;              // 任务ID，用于断点续传
  chunkSize?: number;           // 分块大小（默认 10MB）
  concurrency?: number;         // 并发数（默认 3）
  largeFileThreshold?: number;  // 大文件阈值（默认 100MB）
}
```

## 注意事项

1. **进度文件**：大文件拷贝会生成 `.partial` 和 `.progress` 临时文件，完成后自动清理
2. **取消任务**：取消拷贝后，临时文件会保留以便断点续传
3. **并发控制**：并发数过高可能导致磁盘 IO 争用，建议保持默认值 3
4. **错误处理**：失败的文件会在结果中列出，可以单独重试

## 在项目中集成

以拖拽上传为例：

```vue
<template>
  <div 
    class="drop-zone"
    @dragover.prevent
    @drop="onDrop"
  >
    拖拽文件到此处
  </div>
  
  <FileCopyDialog
    v-model="showDialog"
    :files="files"
    :dest-dir="projectPath"
    @completed="onCompleted"
  />
</template>

<script setup lang="ts">
import { ref } from 'vue';
import FileCopyDialog from '../components/FileCopyDialog.vue';

const showDialog = ref(false);
const files = ref([]);
const projectPath = ref('');

async function onDrop(e: DragEvent) {
  e.preventDefault();
  
  const droppedFiles = Array.from(e.dataTransfer?.files || []);
  
  files.value = droppedFiles.map(file => ({
    src: file.path,
    name: file.name
  }));
  
  showDialog.value = true;
}

function onCompleted(result) {
  // 刷新文件列表
  refreshFileList();
}
</script>
```
