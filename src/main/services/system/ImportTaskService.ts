import { webContents } from 'electron';
import Database from 'better-sqlite3';
import * as fs from 'fs-extra';
import * as path from 'path';
import { createLogger } from '../../utils/logger';
import { getFileCopyService } from '../file/FileCopyService';
import { FileConversionService } from '../file/FileConversionService';
import { FileIndexerService } from '../file/FileIndexerService';
import { buildWritableMarkdownSidecarPath } from '../file/markdownSidecar';
import { DatabaseService, openLibraryDatabase } from './DatabaseService';
import { parseInvoiceFromMarkdown } from '../invoice/InvoiceMarkdownParser';
import { parseInvoiceFromFileWithLayoutFallback } from '../invoice/InvoiceLayoutAwareParser';
import type {
  ImportTaskErrorItem,
  ImportTaskFileResult,
  ImportTaskGetStatusResponse,
  ImportTaskInvoiceCandidate,
  ImportTaskProgressPayload,
  ImportTaskStage,
  ImportTaskStartRequest,
} from '../../../shared/types/importTask.types';
import type { IpcResponse } from '../../../shared/types/ipc.types';
import type { ContractInvoiceCreateDTO, ContractInvoiceUpdateDTO } from '../../../shared/types/contractInvoice.types';
import { contractFileHandlers } from '../../ipc/handlers/contract/contractFileHandlers';
import { otherFileHandlers } from '../../ipc/handlers/file/otherFileHandlers';
import { getTaskMonitor } from '../../ipc/handlers/system/taskMonitorHandlers';
import * as channels from '../../ipc/channels';
import { DATABASE_FILE } from '../../config/app.config';

const logger = createLogger('ImportTaskService');

type InternalTask = {
  taskId: string;
  contextKey: string;
  senderId: number;
  cancelled: boolean;
  finished: boolean;
  progress: ImportTaskProgressPayload;
  results: ImportTaskFileResult[];
  invoiceCandidates: ImportTaskInvoiceCandidate[];
};

type ImportContractContext = {
  contractName: string;
  contractCode: string;
  currency: string;
  fileMetaByPath: Map<string, { fileId: string; sha256: string }>;
};

const supportedExts = new Set([
  '.doc',
  '.docx',
  '.xls',
  '.xlsx',
  '.pdf',
  '.png',
  '.jpg',
  '.jpeg',
  '.webp',
  '.bmp',
  '.tif',
  '.tiff',
]);

const toPercent = (n: number) => {
  const v = Number.isFinite(n) ? n : 0;
  if (v < 0) return 0;
  if (v > 100) return 100;
  return Math.round(v);
};

const buildDbPathsFromFiles = (baseDir: string, filePaths: string[]) => {
  const set = new Set<string>();
  const base = path.resolve(baseDir);
  for (const abs of filePaths) {
    const p = path.resolve(String(abs || '').trim());
    if (!p) continue;
    set.add(p);
    const rel = path.relative(base, p);
    const parts = rel.split(path.sep).filter(Boolean);
    if (parts.length <= 1) continue;
    let current = base;
    for (let i = 0; i < parts.length - 1; i += 1) {
      current = path.join(current, parts[i]);
      set.add(current);
    }
  }
  return Array.from(set);
};

const normalizeTextExcerpt = (markdown: string, maxLen = 500): string => {
  const text = String(markdown || '').replace(/\s+/g, ' ').trim();
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen);
};

export class ImportTaskService {
  private static instance: ImportTaskService;
  private tasks = new Map<string, InternalTask>();
  private taskIdByContextKey = new Map<string, string>();

  private constructor() {}

  static getInstance(): ImportTaskService {
    if (!ImportTaskService.instance) {
      ImportTaskService.instance = new ImportTaskService();
    }
    return ImportTaskService.instance;
  }

  start(payload: ImportTaskStartRequest, senderId: number): string {
    const contextKey = String(payload?.contextKey || '').trim();
    const destDir = String(payload?.destDir || '').trim();
    const srcPaths = Array.isArray(payload?.srcPaths) ? payload.srcPaths.map((p) => String(p || '').trim()).filter(Boolean) : [];
    const files = Array.isArray(payload?.files) ? payload.files.filter((f) => !!f?.src) : [];
    if (!contextKey) {
      throw new Error('contextKey 不能为空');
    }
    if (!destDir) {
      throw new Error('destDir 不能为空');
    }
    if (srcPaths.length === 0 && files.length === 0) {
      throw new Error('待导入内容不能为空');
    }

    const existingTaskId = this.taskIdByContextKey.get(contextKey);
    if (existingTaskId) {
      const existing = this.tasks.get(existingTaskId);
      if (existing && !existing.finished) {
        return existing.taskId;
      }
    }

    const taskId = `import-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const totalFiles = files.length > 0 ? files.length : srcPaths.length;
    const progress: ImportTaskProgressPayload = {
      taskId,
      contextKey,
      stage: 'copying',
      totalFiles,
      completedFiles: 0,
      percent: 0,
      currentFile: undefined,
      errors: [],
    };

    const task: InternalTask = {
      taskId,
      contextKey,
      senderId,
      cancelled: false,
      finished: false,
      progress,
      results: [],
      invoiceCandidates: [],
    };

    this.tasks.set(taskId, task);
    this.taskIdByContextKey.set(contextKey, taskId);
    getTaskMonitor().register({
      id: taskId,
      name: `导入文件（${totalFiles}个）`,
      type: 'import',
      total: totalFiles,
    });
    this.emitProgress(task);

    this.runTask(task, { ...payload, destDir, contextKey, srcPaths, files }).catch((error) => {
      this.finishWithError(task, error);
    });

    return taskId;
  }

  getStatus(contextKey: string): ImportTaskGetStatusResponse {
    const key = String(contextKey || '').trim();
    if (!key) return {};
    const taskId = this.taskIdByContextKey.get(key);
    if (!taskId) return {};
    const task = this.tasks.get(taskId);
    if (!task) return {};
    return {
      taskId: task.taskId,
      progress: task.progress,
      results: task.results,
      invoiceCandidates: task.invoiceCandidates,
    };
  }

  cancel(taskId: string): boolean {
    const id = String(taskId || '').trim();
    if (!id) return false;
    const task = this.tasks.get(id);
    if (!task || task.finished) return false;
    task.cancelled = true;
    try {
      getFileCopyService().cancel(task.taskId);
    } catch {
    }
    getTaskMonitor().cancel(task.taskId);
    this.updateStage(task, 'cancelled');
    task.finished = true;
    this.emitProgress(task);
    return true;
  }

  private emitProgress(task: InternalTask) {
    const wc = webContents.fromId(task.senderId);
    if (!wc || wc.isDestroyed()) return;
    wc.send(channels.IMPORT_TASK_PROGRESS, task.progress);
  }

  private pushError(task: InternalTask, err: ImportTaskErrorItem) {
    const list = Array.isArray(task.progress.errors) ? task.progress.errors : [];
    list.push(err);
    task.progress.errors = list.slice(-200);
  }

  private updateStage(task: InternalTask, stage: ImportTaskStage) {
    task.progress.stage = stage;
  }

  private loadImportContractContext(libraryPath: string, contractId: string, fallbackContractCode: string): ImportContractContext {
    const dbPath = path.join(path.resolve(libraryPath), DATABASE_FILE);
    const sqlite = openLibraryDatabase(dbPath, { readonly: true }).db;
    try {
      const contract = sqlite
        .prepare('SELECT contract_name, contract_code, currency FROM contract_info WHERE id = ? LIMIT 1')
        .get(contractId) as { contract_name?: string; contract_code?: string; currency?: string } | undefined;
      const contractCode = String(contract?.contract_code || fallbackContractCode || '').trim();
      const contractName = String(contract?.contract_name || contractCode || '').trim();
      const currency = String(contract?.currency || 'CNY').trim() || 'CNY';

      const rows = sqlite
        .prepare('SELECT file_id, path, sha256 FROM contract_files WHERE contract_id = ?')
        .all(contractId) as Array<{ file_id?: string; path?: string; sha256?: string }>;

      const fileMetaByPath = new Map<string, { fileId: string; sha256: string }>();
      for (const row of rows) {
        const p = String(row?.path || '').trim();
        if (!p) continue;
        const key = path.resolve(p);
        const fileId = String(row?.file_id || '').trim();
        const sha256 = String(row?.sha256 || '').trim();
        fileMetaByPath.set(key, { fileId, sha256 });
      }
      return { contractName, contractCode, currency, fileMetaByPath };
    } finally {
      sqlite.close();
    }
  }

  private async upsertParsedInvoice(params: {
    contractId: string;
    contractCode: string;
    contractName: string;
    currency: string;
    fileId: string;
    sourceSha256: string;
    sourcePath: string;
    markdown: string;
  }): Promise<void> {
    const { contractId, contractCode, contractName, currency, fileId, sourceSha256, sourcePath, markdown } = params;
    const startedAt = new Date().toISOString();
    const parsed = parseInvoiceFromMarkdown(markdown);
    if (!parsed.isInvoice) return;
    const finishedAt = new Date().toISOString();

    const dto: ContractInvoiceCreateDTO = {
      contract_id: contractId,
      contract_code: contractCode,
      contract_name: contractName,
      file_id: fileId || '',
      source_sha256: sourceSha256 || '',
      source_path: sourcePath || '',
      invoice_type: parsed.data.invoiceType,
      invoice_code: parsed.data.invoiceCode,
      invoice_no: parsed.data.invoiceNo,
      invoice_date: parsed.data.issueDate,
      issue_date: parsed.data.issueDate,
      seller_name: parsed.data.sellerName,
      seller_tax_no: parsed.data.sellerTaxNo,
      buyer_name: parsed.data.buyerName,
      buyer_tax_no: parsed.data.buyerTaxNo,
      amount_without_tax: parsed.data.amountWithoutTax,
      tax_amount: parsed.data.taxAmount,
      amount_with_tax: parsed.data.totalAmount,
      total_amount: parsed.data.totalAmount,
      invoice_items_json: Array.isArray((parsed.data as any).invoiceItems) ? JSON.stringify((parsed.data as any).invoiceItems) : '[]',
      remark: (parsed.data as any).remark,
      issuer_name: (parsed.data as any).issuerName,
      currency,
      parse_status: 'parsed',
      parse_confidence: Number.isFinite(parsed.confidence) ? parsed.confidence : undefined,
      parse_error: parsed.errors.length ? parsed.errors[0].message : undefined,
      parse_errors: JSON.stringify(parsed.errors || []),
      parse_engine: 'invoice-markdown-parser-v1',
      parse_result_json: JSON.stringify(parsed),
      raw_text_excerpt: normalizeTextExcerpt(markdown),
      parse_started_at: startedAt,
      parse_finished_at: finishedAt,
    };

    const db = DatabaseService.getInstance();
    let existingId = '';
    if (sourceSha256) {
      const bySha = db.getContractInvoices({
        contractId,
        sourceSha256,
        includeDeleted: true,
        page: 1,
        pageSize: 1,
      });
      existingId = String(bySha.data?.[0]?.id || '').trim();
    }
    if (!existingId && fileId) {
      const byFile = db.getContractInvoices({
        contractId,
        fileId,
        includeDeleted: true,
        page: 1,
        pageSize: 1,
      });
      existingId = String(byFile.data?.[0]?.id || '').trim();
    }

    if (existingId) {
      const updateDto: ContractInvoiceUpdateDTO = {
        id: existingId,
        ...dto,
      };
      db.updateContractInvoice(updateDto);
      return;
    }
    db.createContractInvoice(dto);
  }

  private async buildInvoiceCandidate(params: {
    contractId: string;
    contractCode: string;
    contractName: string;
    currency: string;
    fileId: string;
    sourceSha256: string;
    sourcePath: string;
    markdownPath?: string;
    markdown: string;
  }): Promise<ImportTaskInvoiceCandidate | null> {
    const {
      contractId,
      contractCode,
      contractName,
      currency,
      fileId,
      sourceSha256,
      sourcePath,
      markdownPath,
      markdown,
    } = params;
    const startedAt = new Date().toISOString();
    const parsedOutcome = await parseInvoiceFromFileWithLayoutFallback(sourcePath, markdown);
    const parsed = parsedOutcome.parseResult;
    if (!parsed.isInvoice) return null;
    const finishedAt = new Date().toISOString();

    return {
      contractId,
      contractCode,
      contractName,
      currency,
      fileId: fileId || '',
      sourceSha256: sourceSha256 || '',
      sourcePath: sourcePath || '',
      markdownPath: markdownPath || undefined,
      parseResult: parsed,
      parseConfidence: Number.isFinite(parsed.confidence) ? parsed.confidence : undefined,
      parseError: parsed.errors.length ? parsed.errors[0].message : undefined,
      parseErrors: JSON.stringify(parsed.errors || []),
      parseEngine: parsedOutcome.parseEngine,
      rawTextExcerpt: normalizeTextExcerpt(parsedOutcome.rawText || markdown),
      parseStartedAt: startedAt,
      parseFinishedAt: finishedAt,
    };
  }

  private upsertInvoiceCandidate(task: InternalTask, candidate: ImportTaskInvoiceCandidate) {
    const bySha = candidate.sourceSha256
      ? task.invoiceCandidates.findIndex((item) => item.sourceSha256 === candidate.sourceSha256)
      : -1;
    const byFile = bySha < 0 && candidate.fileId
      ? task.invoiceCandidates.findIndex((item) => item.contractId === candidate.contractId && item.fileId === candidate.fileId)
      : -1;
    const byPath = bySha < 0 && byFile < 0
      ? task.invoiceCandidates.findIndex((item) => item.sourcePath === candidate.sourcePath)
      : -1;
    const idx = bySha >= 0 ? bySha : byFile >= 0 ? byFile : byPath;
    if (idx >= 0) {
      task.invoiceCandidates[idx] = candidate;
      return;
    }
    task.invoiceCandidates.push(candidate);
  }

  private currentFileSpeed: Map<string, string> = new Map();

  private setProgress(task: InternalTask, payload: Partial<ImportTaskProgressPayload>) {
    task.progress = {
      ...task.progress,
      ...payload,
    };
    // 如果有当前文件速度，使用它
    if (payload.speed) {
      this.currentFileSpeed.set(task.taskId, payload.speed);
    }
    // 使用最近记录的速度
    const speedToUse = payload.speed || this.currentFileSpeed.get(task.taskId);
    if (speedToUse) {
      task.progress.speed = speedToUse;
    }
    getTaskMonitor().update(task.taskId, {
      progress: Number(task.progress.percent || 0),
      current: Number(task.progress.completedFiles || 0),
      total: Number(task.progress.totalFiles || 0),
      message: task.progress.currentFile
        ? `${task.progress.stage}:${task.progress.currentFile}`
        : task.progress.stage,
    });
    this.emitProgress(task);
  }

  private speedStartTime: Map<string, number> = new Map();
  private speedStartBytes: Map<string, number> = new Map();

  private calculateSpeed(taskId: string, currentBytes: number): string {
    const startTime = this.speedStartTime.get(taskId);
    const startBytes = this.speedStartBytes.get(taskId);
    
    if (!startTime || !startBytes) {
      this.speedStartTime.set(taskId, Date.now());
      this.speedStartBytes.set(taskId, currentBytes);
      return '';
    }

    const elapsed = (Date.now() - startTime) / 1000;
    if (elapsed < 0.5) return '';

    const bytesCopied = currentBytes - startBytes;
    const speed = bytesCopied / elapsed;

    if (speed < 1024) {
      return `${speed.toFixed(0)} B/s`;
    } else if (speed < 1024 * 1024) {
      return `${(speed / 1024).toFixed(1)} KB/s`;
    } else {
      return `${(speed / (1024 * 1024)).toFixed(1)} MB/s`;
    }
  }

  private resetSpeed(taskId: string) {
    this.speedStartTime.delete(taskId);
    this.speedStartBytes.delete(taskId);
    this.currentFileSpeed.delete(taskId);
  }

  private async runTask(task: InternalTask, payload: Required<Pick<ImportTaskStartRequest, 'contextKey' | 'destDir'>> & ImportTaskStartRequest) {
    const destDir = path.resolve(payload.destDir);
    await fs.ensureDir(destDir);

    const srcPaths = Array.isArray(payload.srcPaths) ? payload.srcPaths : [];
    const files = Array.isArray(payload.files) && payload.files.length > 0
      ? payload.files
      : srcPaths.map((src) => ({
          src,
          name: path.basename(src),
        }));

    const copySvc = getFileCopyService();
    const copyResult = await copySvc.copy(files as any, destDir, {
      taskId: task.taskId,
      conflict: { mode: 'keep-both', detectDuplicates: true },
      hash: { compute: true, algorithms: ['md5', 'sha256'], verify: 'after-copy', verifyExisting: true, failOnMismatch: true },
      onProgress: (p: any) => {
        if (task.cancelled) return;
        const current = Number(p?.current ?? 0);
        const total = Number(p?.total ?? files.length);
        const percent = total > 0 ? (current / total) * 60 : 0;
        // 使用 FileCopyService 提供的当前文件速度
        const speed = p?.speed || '';
        this.setProgress(task, {
          stage: 'copying',
          totalFiles: total,
          completedFiles: current,
          currentFile: p?.currentFile ? String(p.currentFile) : undefined,
          percent: toPercent(percent),
          speed,
        });
      },
    } as any);

    // 拷贝完成后，确保显示100%进度，并立即进入转换阶段
    if (!task.cancelled) {
      this.setProgress(task, {
        stage: 'converting',
        totalFiles: 0,
        completedFiles: 0,
        currentFile: undefined,
        percent: toPercent(60),
        speed: '',
      });
    }

    const fileResults = Array.isArray((copyResult as any)?.fileResults) ? (copyResult as any).fileResults : [];
    const okFileResults = fileResults.filter((r: any) => String(r?.outcome || '') !== 'failed');
    const destFilePaths = okFileResults.map((r: any) => String(r?.finalDestPath || r?.destPath || '')).filter(Boolean);

    task.results = files.map((f) => {
      const srcPath = f.src;
      const fr = okFileResults.find((r: any) => String(r?.srcPath || r?.file?.src || '') === srcPath);
      const destPath = fr ? String(fr?.finalDestPath || fr?.destPath || '') : undefined;
      const outcome = fr ? 'ok' : 'failed';
      const err = (fileResults.find((r: any) => String(r?.srcPath || r?.file?.src || '') === srcPath && String(r?.outcome || '') === 'failed') as any)?.error;
      return {
        srcPath,
        destPath,
        outcome: outcome as any,
        error: outcome === 'failed' ? String(err || '拷贝失败') : undefined,
      };
    });

    if (task.cancelled) {
      this.updateStage(task, 'cancelled');
      task.finished = true;
      this.emitProgress(task);
      return;
    }

    if (payload.libraryPath && payload.contractId && payload.contractNo && destFilePaths.length > 0) {
      try {
        const pathsForDb = buildDbPathsFromFiles(destDir, destFilePaths);
        const res = (await (contractFileHandlers as any)[channels.CONTRACT_FILES_UPSERT_FROM_PATHS](
          {} as any,
          { libraryPath: payload.libraryPath, contractId: payload.contractId, contractNo: payload.contractNo, paths: pathsForDb }
        )) as IpcResponse<any>;
        if (!res?.success) {
          throw new Error(res?.error || '写入文件记录失败');
        }
      } catch (error: any) {
        this.pushError(task, { stage: 'copying', message: error?.message || '写入文件记录失败' });
      }
    }

    if (payload.libraryPath && destFilePaths.length > 0) {
      try {
        const libraryRoot = path.resolve(String(payload.libraryPath || ''));
        const otherFilesRoots = [
          path.join(libraryRoot, '其他'),
          path.join(libraryRoot, 'other-files'),
        ];
        const resolvedDestDir = path.resolve(destDir);
        const isInOtherFiles = otherFilesRoots.some((rootDir) => {
          const rel = path.relative(rootDir, resolvedDestDir);
          return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
        });
        if (isInOtherFiles) {
          const pathsForDb = buildDbPathsFromFiles(destDir, destFilePaths);
          const res = (await (otherFileHandlers as any)[channels.OTHER_FILES_UPSERT_FROM_PATHS](
            {} as any,
            { libraryPath: payload.libraryPath, paths: pathsForDb },
          )) as IpcResponse<any>;
          if (!res?.success) {
            throw new Error(res?.error || '写入其他文件记录失败');
          }
        }
      } catch (error: any) {
        this.pushError(task, { stage: 'copying', message: error?.message || '写入其他文件记录失败' });
      }
    }

    const convertible = destFilePaths.filter((p: string) => supportedExts.has(path.extname(p).toLowerCase()));
    let importContractContext: ImportContractContext | null = null;
    const shouldParseInvoice = Boolean(payload.libraryPath && payload.contractId && payload.contractNo);
    if (shouldParseInvoice) {
      try {
        importContractContext = this.loadImportContractContext(
          String(payload.libraryPath || ''),
          String(payload.contractId || ''),
          String(payload.contractNo || ''),
        );
      } catch (error: any) {
        this.pushError(task, { stage: 'converting', message: `加载发票导入上下文失败: ${error?.message || '未知错误'}` });
      }
    }
    this.setProgress(task, {
      stage: 'converting',
      totalFiles: convertible.length,
      completedFiles: 0,
      currentFile: undefined,
      percent: toPercent(convertible.length > 0 ? 60 : 90),
    });
    this.resetSpeed(task.taskId);

    const conversionSvc = FileConversionService.getInstance();
    let converted = 0;
    let convertStartTime = Date.now();
    for (const destPath of convertible) {
      if (task.cancelled) {
        this.updateStage(task, 'cancelled');
        task.finished = true;
        this.emitProgress(task);
        return;
      }
      // 计算转换速度（文件数/秒）
      const convertElapsed = (Date.now() - convertStartTime) / 1000;
      const convertSpeed = convertElapsed > 0.5 ? `${(converted / convertElapsed).toFixed(1)} 个/秒` : '';
      
      this.setProgress(task, {
        currentFile: path.basename(destPath),
        completedFiles: converted,
        percent: toPercent(60 + (convertible.length > 0 ? (converted / convertible.length) * 30 : 0)),
        speed: convertSpeed,
      });
      try {
        const conversion = await conversionSvc.convertToMarkdown(destPath);
        const markdown = String(conversion?.markdown || '').trim();
        if (markdown) {
          const mdPath = await buildWritableMarkdownSidecarPath(destPath);
          await fs.ensureDir(path.dirname(mdPath));
          await fs.writeFile(mdPath, markdown, 'utf-8');
          const r = task.results.find((it) => it.destPath === destPath);
          if (r) r.markdownPath = mdPath;

          if (shouldParseInvoice && importContractContext) {
            try {
              const fileMeta = importContractContext.fileMetaByPath.get(path.resolve(destPath));
              const fr = okFileResults.find((it: any) => String(it?.finalDestPath || it?.destPath || '') === destPath);
              const sourceSha256 = String(
                fr?.srcHashes?.sha256 ||
                fr?.destHashes?.sha256 ||
                fileMeta?.sha256 ||
                '',
              ).trim();
              const fileId = String(fileMeta?.fileId || '').trim();
              const candidate = await this.buildInvoiceCandidate({
                contractId: String(payload.contractId || ''),
                contractCode: importContractContext.contractCode,
                contractName: importContractContext.contractName,
                currency: importContractContext.currency,
                fileId,
                sourceSha256,
                sourcePath: destPath,
                markdownPath: mdPath,
                markdown,
              });
              if (candidate) {
                this.upsertInvoiceCandidate(task, candidate);
              }
            } catch (error: any) {
              this.pushError(task, {
                stage: 'converting',
                filePath: destPath,
                message: `发票识别入库失败: ${error?.message || '未知错误'}`,
              });
            }
          }
        }
      } catch (error: any) {
        this.pushError(task, { stage: 'converting', filePath: destPath, message: error?.message || '转换失败' });
        const r = task.results.find((it) => it.destPath === destPath);
        if (r) {
          r.outcome = 'failed';
          r.error = r.error || (error?.message ? String(error.message) : '转换失败');
        }
      } finally {
        converted += 1;
        this.setProgress(task, {
          completedFiles: converted,
          percent: toPercent(60 + (convertible.length > 0 ? (converted / convertible.length) * 30 : 0)),
        });
      }
    }

    if (task.cancelled) {
      this.updateStage(task, 'cancelled');
      task.finished = true;
      this.emitProgress(task);
      return;
    }

    const indexTargets = destFilePaths;
    this.setProgress(task, {
      stage: 'indexing',
      totalFiles: indexTargets.length,
      completedFiles: 0,
      currentFile: undefined,
      percent: toPercent(indexTargets.length > 0 ? 90 : 100),
    });
    this.resetSpeed(task.taskId);

    try {
      if (indexTargets.length > 0) {
        let indexStartTime = Date.now();
        await FileIndexerService.getInstance().indexFiles(indexTargets, (done, total, currentFile) => {
          if (task.cancelled) return;
          const ratio = total > 0 ? done / total : 1;
          // 计算索引速度（文件数/秒）
          const indexElapsed = (Date.now() - indexStartTime) / 1000;
          const indexSpeed = indexElapsed > 0.5 ? `${(done / indexElapsed).toFixed(1)} 个/秒` : '';
          
          this.setProgress(task, {
            stage: 'indexing',
            totalFiles: total,
            completedFiles: done,
            currentFile,
            percent: toPercent(90 + ratio * 10),
            speed: indexSpeed,
          });
        });
      }
    } catch (error: any) {
      this.pushError(task, { stage: 'indexing', message: error?.message || '索引失败' });
    }

    const hasErrors = Array.isArray(task.progress.errors) && task.progress.errors.length > 0;
    this.updateStage(task, hasErrors ? 'completed-with-errors' : 'completed');
    this.setProgress(task, { percent: 100, currentFile: undefined });
    task.finished = true;
    getTaskMonitor().complete(task.taskId, { hasErrors, results: task.results });
  }

  private finishWithError(task: InternalTask, error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error(`导入任务失败: ${task.taskId}`, error);
    this.pushError(task, { stage: 'failed', message });
    this.updateStage(task, 'failed');
    this.setProgress(task, { percent: task.progress.percent || 0, currentFile: undefined });
    task.finished = true;
    getTaskMonitor().fail(task.taskId, message);
  }
}
