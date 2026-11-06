declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}

declare module '*.mjs' {
  const src: string;
  export default src;
}

declare module '@vue-office/docx';
declare module '@vue-office/excel';
declare module '@vue-office/pptx';
declare module 'pdfjs-dist/build/pdf.worker.mjs';

// 配置设置接口
interface Setting {
  id: number;
  key: string;
  value: string;
  description: string;
  created_at: string;
  updated_at: string;
}

// 首次启动初始化相关类型
interface InitStatus {
  initialized: boolean;
  projectPath?: string;
  projectName?: string;
}

interface SelectFolderResult {
  canceled: boolean;
  filePaths: string[];
}

interface InitializeProjectResult {
  success: boolean;
  error?: string;
  projectPath?: string;
}

interface LoadExistingLibraryResult {
  success: boolean;
  error?: string;
}

// 文件拷贝相关类型
interface FileCopyItem {
  src: string;
  name: string;
  relativePath?: string;
}

interface CopyProgress {
  current: number;
  total: number;
  percent: string;
  currentFile?: string;
  bytesCopied?: number;
  totalBytes?: number;
  speed?: string;
}

interface CopyResult {
  taskId: string;
  strategy: string;
  success: FileCopyItem[];
  failed: Array<{ file: FileCopyItem; error: string }>;
  total: number;
  completed: number;
}

// 说明：
// ElectronAPI 的完整类型定义已在 src/renderer/types/electron-api.d.ts 中提供，
// 这里不再重复声明，以避免与真实类型冲突造成 unknown 推断。
