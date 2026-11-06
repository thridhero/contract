import type { InvoiceParseResult } from './invoice.types';

export type ImportTaskStage =
  | 'copying'
  | 'converting'
  | 'indexing'
  | 'completed'
  | 'completed-with-errors'
  | 'failed'
  | 'cancelled';

export interface ImportTaskErrorItem {
  stage: ImportTaskStage;
  filePath?: string;
  message: string;
}

export interface ImportTaskProgressPayload {
  taskId: string;
  contextKey: string;
  stage: ImportTaskStage;
  totalFiles: number;
  completedFiles: number;
  currentFile?: string;
  percent: number;
  errors?: ImportTaskErrorItem[];
  speed?: string;
}

export interface ImportTaskFileResult {
  srcPath: string;
  destPath?: string;
  markdownPath?: string;
  outcome: 'ok' | 'failed' | 'skipped';
  error?: string;
}

export interface ImportTaskInvoiceCandidate {
  contractId: string;
  contractCode: string;
  contractName: string;
  currency: string;
  fileId: string;
  sourceSha256: string;
  sourcePath: string;
  markdownPath?: string;
  parseResult: InvoiceParseResult;
  parseConfidence?: number;
  parseError?: string;
  parseErrors: string;
  parseEngine: string;
  rawTextExcerpt: string;
  parseStartedAt: string;
  parseFinishedAt: string;
}

export interface ImportTaskStartRequest {
  contextKey: string;
  destDir: string;
  srcPaths?: string[];
  files?: Array<{ src: string; name: string; relativePath?: string }>;
  libraryPath?: string;
  contractId?: string;
  contractNo?: string;
}

export interface ImportTaskStartResponse {
  taskId: string;
}

export interface ImportTaskGetStatusRequest {
  contextKey: string;
}

export interface ImportTaskGetStatusResponse {
  taskId?: string;
  progress?: ImportTaskProgressPayload;
  results?: ImportTaskFileResult[];
  invoiceCandidates?: ImportTaskInvoiceCandidate[];
}

export interface ImportTaskCancelRequest {
  taskId: string;
}

export interface ImportTaskCancelResponse {
  success: boolean;
}
