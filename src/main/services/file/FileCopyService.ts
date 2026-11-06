/**
 * 文件拷贝服务 - 智能混合策略
 * 根据文件大小自动选择最佳拷贝策略
 */

import * as fs from 'fs-extra';
import * as path from 'path';
import { createReadStream, createWriteStream } from 'fs';
import { EventEmitter } from 'events';
import * as crypto from 'crypto';

// 轻量并发限制器（替代 p-limit，避免 ESM 兼容问题）
type TaskFn<T> = () => Promise<T>;
function createLimit(concurrency: number) {
  let active = 0;
  const queue: Array<{
    fn: TaskFn<any>;
    resolve: (value: any) => void;
    reject: (reason?: any) => void;
  }> = [];

  const next = () => {
    if (active >= concurrency) return;
    const item = queue.shift();
    if (!item) return;
    active++;
    Promise.resolve()
      .then(item.fn)
      .then(
        (val) => {
          active--;
          item.resolve(val);
          next();
        },
        (err) => {
          active--;
          item.reject(err);
          next();
        }
      );
  };

  return function limit<T>(fn: TaskFn<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      queue.push({ fn, resolve, reject });
      next();
    });
  };
}

export interface FileCopyItem {
  src: string;
  name: string;
  relativePath?: string;
}

export interface CopyProgress {
  current: number;
  total: number;
  percent: string;
  currentFile?: string;
  bytesCopied?: number;
  totalBytes?: number;
  speed?: string;
}

export interface CopyResult {
  strategy: string;
  success: FileCopyItem[];
  failed: Array<{ file: FileCopyItem; error: string }>;
  total: number;
  completed: number;
  fileResults?: FileCopyFileResult[];
  retry?: CopyRetryModel;
}

export interface FileCopyOptions {
  chunkSize?: number;
  concurrency?: number;
  largeFileThreshold?: number;
  onProgress?: (progress: CopyProgress) => void;
  conflict?: FileCopyConflictOptions;
  hash?: FileCopyHashOptions;
  resolveConflict?: ResolveConflictFn;
}

export type FileCopyHashAlgorithm = 'md5' | 'sha256';

export interface FileCopyHashOptions {
  algorithms?: FileCopyHashAlgorithm[];
  compute?: boolean;
  verify?: 'none' | 'after-copy';
  verifyExisting?: boolean;
  failOnMismatch?: boolean;
}

export type FileCopyConflictReason = 'dest-exists' | 'duplicate';
export type FileCopyConflictAction = 'replace' | 'skip' | 'rename' | 'keep-both';

export interface FileCopyConflictOptions {
  mode?: 'replace' | 'skip' | 'keep-both' | 'ask';
  detectDuplicates?: boolean;
}

export interface FileCopyHashes {
  md5?: string;
  sha256?: string;
}

export interface FileCopyConflictDecision {
  action: FileCopyConflictAction;
  newName?: string;
}

export interface FileCopyConflictContext {
  taskId: string;
  file: FileCopyItem;
  srcPath: string;
  destPath: string;
  srcSize?: number;
  destSize?: number;
  reason: FileCopyConflictReason;
  srcHashes?: FileCopyHashes;
  destHashes?: FileCopyHashes;
  defaultDecision: FileCopyConflictDecision;
}

export type ResolveConflictFn = (ctx: FileCopyConflictContext) => Promise<FileCopyConflictDecision>;

export type FileCopyFileOutcome = 'copied' | 'skipped' | 'failed';

export interface FileCopyFileResult {
  file: FileCopyItem;
  srcPath: string;
  destPath: string;
  finalDestPath: string;
  size: number;
  outcome: FileCopyFileOutcome;
  resumedFromBytes?: number;
  srcHashes?: FileCopyHashes;
  destHashes?: FileCopyHashes;
  conflict?: {
    reason: FileCopyConflictReason;
    decision: FileCopyConflictDecision;
  };
  error?: string;
}

export interface CopyRetryInput {
  files: FileCopyItem[];
  destDir: string;
  options: FileCopyOptions & { taskId?: string };
}

export interface CopyRetryModel {
  all: CopyRetryInput;
  failed: CopyRetryInput;
  failedIndexes: number[];
}

export class FileCopyService extends EventEmitter {
  private chunkSize: number;
  private concurrency: number;
  private largeFileThreshold: number;
  private activeCopies: Map<string, AbortController> = new Map();
  private copyingTempFiles: Map<string, string> = new Map(); // taskId -> tempFilePath

  private _sanitizeOptionsForRetry(options: FileCopyOptions, taskId: string) {
    const {
      onProgress: _onProgress,
      resolveConflict: _resolveConflict,
      ...rest
    } = options as FileCopyOptions & {
      onProgress?: unknown;
      resolveConflict?: unknown;
    };
    return { ...rest, taskId } as FileCopyOptions & { taskId: string };
  }

  constructor(options: FileCopyOptions = {}) {
    super();
    this.chunkSize = options.chunkSize || 10 * 1024 * 1024; // 默认 10MB
    this.concurrency = options.concurrency || 3;
    this.largeFileThreshold = options.largeFileThreshold || 100 * 1024 * 1024; // 默认 100MB
  }

  /**
   * 智能拷贝入口 - 自动选择最佳策略
   */
  async copy(
    files: FileCopyItem[],
    destDir: string,
    options: FileCopyOptions & { taskId?: string } = {}
  ): Promise<CopyResult> {
    const taskId = options.taskId || `copy-${Date.now()}`;
    const abortController = new AbortController();
    this.activeCopies.set(taskId, abortController);
    this.emit('started', { taskId, total: files.length, destDir });

    try {
      // 分析文件特征
      const analysis = await this._analyzeFiles(files);
      
      // 选择策略
      let result: CopyResult;
      
      if (analysis.hasLargeFiles && !analysis.hasSmallFiles) {
        // 全是大文件 -> 分块拷贝
        result = await this._copyWithChunked(taskId, files, destDir, options, abortController);
      } else if (analysis.fileCount > 100 && process.platform === 'win32') {
        // Windows 大量文件 -> 批量并发
        result = await this._copyWithBatch(taskId, files, destDir, options, abortController);
      } else {
        // 默认 -> 批量拷贝（自动识别大文件单独处理）
        result = await this._copyWithBatch(taskId, files, destDir, options, abortController);
      }

      this.emit('completed', { taskId, result });
      return result;
    } finally {
      this.activeCopies.delete(taskId);
    }
  }

  /**
   * 取消拷贝任务
   */
  cancel(taskId: string): boolean {
    const controller = this.activeCopies.get(taskId);
    if (controller) {
      controller.abort();
      this.activeCopies.delete(taskId);
      
      // 删除正在拷贝的临时文件
      const tempFile = this.copyingTempFiles.get(taskId);
      if (tempFile) {
        fs.remove(tempFile).catch(() => {});
        const progressFile = tempFile + '.progress';
        fs.remove(progressFile).catch(() => {});
        this.copyingTempFiles.delete(taskId);
      }
      
      this.emit('cancelled', { taskId });
      return true;
    }
    return false;
  }

  /**
   * 分块拷贝 - 大文件支持断点续传
   */
  private async _copyWithChunked(
    taskId: string,
    files: FileCopyItem[],
    destDir: string,
    options: FileCopyOptions,
    abortController: AbortController
  ): Promise<CopyResult> {
    const retryOptions = this._sanitizeOptionsForRetry(options, taskId);
    const results: CopyResult = {
      strategy: 'chunked',
      success: [],
      failed: [],
      total: files.length,
      completed: 0,
      fileResults: [],
      retry: { all: { files, destDir, options: retryOptions }, failed: { files: [], destDir, options: retryOptions }, failedIndexes: [] }
    };

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (abortController.signal.aborted) {
        throw new Error('拷贝已取消');
      }

      let fileResult: FileCopyFileResult;
      try {
        fileResult = await this._copyOne(taskId, file, i, files.length, destDir, options, abortController);
        results.fileResults?.push(fileResult);
        if (fileResult.outcome === 'copied') {
          results.success.push(file);
        }
      } catch (err: any) {
        results.failed.push({ file, error: err.message });
        fileResult = {
          file,
          srcPath: file.src,
          destPath: path.join(destDir, file.relativePath || file.name),
          finalDestPath: path.join(destDir, file.relativePath || file.name),
          size: 0,
          outcome: 'failed',
          error: err.message,
        };
        results.fileResults?.push(fileResult);
        results.retry?.failed.files.push(file);
        results.retry?.failedIndexes.push(i);
      }
      const completed = ++results.completed;
      if (fileResult.outcome === 'failed') {
        this.emit('file-failed', { taskId, fileIndex: i, totalFiles: files.length, completed, total: results.total, fileResult });
      } else {
        this.emit('file-completed', { taskId, fileIndex: i, totalFiles: files.length, completed, total: results.total, fileResult });
      }
      this._reportProgress(results, options.onProgress);
    }

    return results;
  }

  /**
   * 分块拷贝单个文件
   */
  private async _chunkedCopy(
    src: string,
    dest: string,
    onProgress?: (progress: CopyProgress) => void,
    abortController?: AbortController,
    taskId?: string,
    fileIndex?: number,
    totalFiles?: number
  ): Promise<{ resumedFromBytes: number }> {
    const stat = await fs.stat(src);
    const totalSize = stat.size;
    const tempDest = dest + '.partial';
    const progressFile = dest + '.progress';

    // 记录临时文件路径，用于取消时清理
    if (taskId) {
      this.copyingTempFiles.set(taskId, tempDest);
    }

    // 确保目标目录存在
    await fs.ensureDir(path.dirname(dest));

    // 检查断点续传
    let startOffset = 0;
    
    try {
      const hasTemp = await fs.pathExists(tempDest);
      const hasProgress = await fs.pathExists(progressFile);
      if (hasTemp) {
        const tempStat = await fs.stat(tempDest);
        if (tempStat.size <= totalSize && tempStat.size > 0) {
          startOffset = tempStat.size;
        }
      }
      if (hasProgress) {
        const progress = await fs.readJson(progressFile);
        if (typeof progress?.copied === 'number' && progress.copied > startOffset) {
          startOffset = Math.min(progress.copied, totalSize);
        }
      }
    } catch {
      // 进度文件损坏，从头开始
      startOffset = 0;
    }

    return new Promise((resolve, reject) => {
      if (abortController?.signal.aborted) {
        reject(new Error('拷贝已取消'));
        return;
      }

      const readStream = createReadStream(src, {
        start: startOffset,
        highWaterMark: this.chunkSize
      });

      const writeStream = createWriteStream(tempDest, {
        flags: startOffset > 0 ? 'a' : 'w',
        start: startOffset
      });

      let copied = startOffset;
      let lastProgressUpdate = Date.now();
      let lastCopied = startOffset;

      readStream.on('data', async (chunk: Buffer) => {
        copied += chunk.length;

        // 节流进度更新（每 200ms）
        const now = Date.now();
        if (now - lastProgressUpdate > 200) {
          const speed = this._calculateSpeed(copied - lastCopied, now - lastProgressUpdate);
          
          onProgress?.({
            current: typeof fileIndex === 'number' ? fileIndex + 1 : 0,
            total: typeof totalFiles === 'number' ? totalFiles : 1,
            percent: ((copied / totalSize) * 100).toFixed(2),
            currentFile: path.basename(src),
            bytesCopied: copied,
            totalBytes: totalSize,
            speed
          });

          // 保存进度
          await this._saveProgress(progressFile, { taskId: taskId || '', copied, totalSize });
          
          lastProgressUpdate = now;
          lastCopied = copied;
        }
      });

      writeStream.on('finish', async () => {
        try {
          // 清除临时文件记录
          if (taskId) {
            this.copyingTempFiles.delete(taskId);
          }
          // 删除进度文件
          await fs.remove(progressFile).catch(() => {});
          // 原子重命名
          await fs.move(tempDest, dest, { overwrite: true });
          
          // 发送100%完成进度
          onProgress?.({
            current: typeof fileIndex === 'number' ? fileIndex + 1 : 0,
            total: typeof totalFiles === 'number' ? totalFiles : 1,
            percent: '100.00',
            currentFile: path.basename(src),
            bytesCopied: totalSize,
            totalBytes: totalSize,
            speed: '0 B/s'
          });
          
          resolve({ resumedFromBytes: startOffset });
        } catch (err) {
          reject(err);
        }
      });

      writeStream.on('error', (err) => {
        reject(err);
      });

      readStream.on('error', (err) => {
        reject(err);
      });

      // 监听取消信号
      abortController?.signal.addEventListener('abort', () => {
        readStream.destroy();
        writeStream.destroy();
        // 清除临时文件记录
        if (taskId) {
          this.copyingTempFiles.delete(taskId);
        }
        reject(new Error('拷贝已取消'));
      });

      readStream.pipe(writeStream);
    });
  }

  /**
   * 批量拷贝 - 并发处理，大文件单独处理
   */
  private async _copyWithBatch(
    taskId: string,
    files: FileCopyItem[],
    destDir: string,
    options: FileCopyOptions,
    abortController: AbortController
  ): Promise<CopyResult> {
    const limit = createLimit(this.concurrency);
    const retryOptions = this._sanitizeOptionsForRetry(options, taskId);
    const results: CopyResult = {
      strategy: 'batch',
      success: [],
      failed: [],
      total: files.length,
      completed: 0,
      fileResults: [],
      retry: { all: { files, destDir, options: retryOptions }, failed: { files: [], destDir, options: retryOptions }, failedIndexes: [] }
    };

    // 分离大文件和小文件
    const { largeFiles, smallFiles } = await this._categorizeFiles(files);

    // 大文件单线程分块处理
    for (const entry of largeFiles) {
      const file = entry.file;
      if (abortController.signal.aborted) {
        throw new Error('拷贝已取消');
      }

      let fileResult: FileCopyFileResult;
      try {
        fileResult = await this._copyOne(taskId, file, entry.index, files.length, destDir, options, abortController);
        results.fileResults?.push(fileResult);
        if (fileResult.outcome === 'copied') {
          results.success.push(file);
        }
      } catch (err: any) {
        results.failed.push({ file, error: err.message });
        fileResult = {
          file,
          srcPath: file.src,
          destPath: path.join(destDir, file.relativePath || file.name),
          finalDestPath: path.join(destDir, file.relativePath || file.name),
          size: 0,
          outcome: 'failed',
          error: err.message,
        };
        results.fileResults?.push(fileResult);
        results.retry?.failed.files.push(file);
        results.retry?.failedIndexes.push(entry.index);
      }
      const completed = ++results.completed;
      if (fileResult.outcome === 'failed') {
        this.emit('file-failed', { taskId, fileIndex: entry.index, totalFiles: files.length, completed, total: results.total, fileResult });
      } else {
        this.emit('file-completed', { taskId, fileIndex: entry.index, totalFiles: files.length, completed, total: results.total, fileResult });
      }
      this._reportProgress(results, options.onProgress);
    }

    // 小文件并发处理
    const tasks = smallFiles.map((entry) =>
      limit(async () => {
        const file = entry.file;
        if (abortController.signal.aborted) {
          return;
        }

        let fileResult: FileCopyFileResult | null = null;
        try {
          fileResult = await this._copyOne(taskId, file, entry.index, files.length, destDir, options, abortController);
          results.fileResults?.push(fileResult);
          if (fileResult.outcome === 'copied') {
            results.success.push(file);
          }
        } catch (err: any) {
          results.failed.push({ file, error: err.message });
          fileResult = {
            file,
            srcPath: file.src,
            destPath: path.join(destDir, file.relativePath || file.name),
            finalDestPath: path.join(destDir, file.relativePath || file.name),
            size: 0,
            outcome: 'failed',
            error: err.message,
          };
          results.fileResults?.push(fileResult);
          results.retry?.failed.files.push(file);
          results.retry?.failedIndexes.push(entry.index);
        }
        if (!fileResult) {
          return;
        }
        const completed = ++results.completed;
        if (fileResult.outcome === 'failed') {
          this.emit('file-failed', { taskId, fileIndex: entry.index, totalFiles: files.length, completed, total: results.total, fileResult });
        } else {
          this.emit('file-completed', { taskId, fileIndex: entry.index, totalFiles: files.length, completed, total: results.total, fileResult });
        }
        this._reportProgress(results, options.onProgress);
      })
    );

    await Promise.all(tasks);
    return results;
  }

  private async _copyOne(
    taskId: string,
    file: FileCopyItem,
    fileIndex: number,
    totalFiles: number,
    destDir: string,
    options: FileCopyOptions,
    abortController: AbortController
  ): Promise<FileCopyFileResult> {
    if (abortController.signal.aborted) {
      throw new Error('拷贝已取消');
    }

    const srcPath = file.src;
    const intendedDestPath = path.join(destDir, file.relativePath || file.name);
    const srcStat = await fs.stat(srcPath);
    const size = srcStat.size;

    const { decision, reason, finalDestPath, srcHashes, destHashes, skip } = await this._resolveDestination(
      taskId,
      file,
      srcPath,
      intendedDestPath,
      size,
      options,
      abortController
    );

    if (skip) {
      return {
        file,
        srcPath,
        destPath: intendedDestPath,
        finalDestPath,
        size,
        outcome: 'skipped',
        srcHashes,
        destHashes,
        conflict: decision && reason ? { reason, decision } : undefined,
      };
    }

    await fs.ensureDir(path.dirname(finalDestPath));

    let resumedFromBytes: number | undefined;
    if (size > this.largeFileThreshold) {
      const r = await this._chunkedCopy(srcPath, finalDestPath, options.onProgress, abortController, taskId, fileIndex, totalFiles);
      resumedFromBytes = r.resumedFromBytes;
    } else {
      if (abortController.signal.aborted) {
        throw new Error('拷贝已取消');
      }
      // 发送开始进度
      options.onProgress?.({
        current: typeof fileIndex === 'number' ? fileIndex + 1 : 0,
        total: typeof totalFiles === 'number' ? totalFiles : 1,
        percent: '0.00',
        currentFile: path.basename(srcPath),
        bytesCopied: 0,
        totalBytes: size,
        speed: ''
      });
      
      await fs.copy(srcPath, finalDestPath, { overwrite: true });
      
      // 发送完成进度
      options.onProgress?.({
        current: typeof fileIndex === 'number' ? fileIndex + 1 : 0,
        total: typeof totalFiles === 'number' ? totalFiles : 1,
        percent: '100.00',
        currentFile: path.basename(srcPath),
        bytesCopied: size,
        totalBytes: size,
        speed: '0 B/s'
      });
    }

    const hashCfg = this._normalizeHashOptions(options.hash);
    const shouldComputeHashes = hashCfg.compute || hashCfg.verify !== 'none' || Boolean(hashCfg.verifyExisting);
    let finalSrcHashes: FileCopyHashes | undefined = srcHashes;
    let finalDestHashes: FileCopyHashes | undefined;

    if (shouldComputeHashes) {
      finalSrcHashes = finalSrcHashes || (await this._computeHashes(srcPath, hashCfg.algorithms, abortController));
      finalDestHashes = await this._computeHashes(finalDestPath, hashCfg.algorithms, abortController);
      if (hashCfg.verify === 'after-copy') {
        const mismatch = this._hashMismatch(finalSrcHashes, finalDestHashes, hashCfg.algorithms);
        if (mismatch && hashCfg.failOnMismatch) {
          throw new Error('校验失败：源/目标哈希不一致');
        }
      }
    }

    return {
      file,
      srcPath,
      destPath: intendedDestPath,
      finalDestPath,
      size,
      outcome: 'copied',
      resumedFromBytes,
      srcHashes: finalSrcHashes,
      destHashes: finalDestHashes,
      conflict: decision && reason ? { reason, decision } : undefined,
    };
  }

  private _normalizeHashOptions(input?: FileCopyHashOptions): Required<FileCopyHashOptions> {
    return {
      algorithms: input?.algorithms && input.algorithms.length > 0 ? input.algorithms : ['md5', 'sha256'],
      compute: Boolean(input?.compute),
      verify: input?.verify || 'none',
      verifyExisting: Boolean(input?.verifyExisting),
      failOnMismatch: input?.failOnMismatch !== false,
    };
  }

  private async _computeHashes(
    filePath: string,
    algorithms: FileCopyHashAlgorithm[],
    abortController?: AbortController
  ): Promise<FileCopyHashes> {
    const wantMd5 = algorithms.includes('md5');
    const wantSha256 = algorithms.includes('sha256');
    const md5 = wantMd5 ? crypto.createHash('md5') : null;
    const sha256 = wantSha256 ? crypto.createHash('sha256') : null;

    return new Promise<FileCopyHashes>((resolve, reject) => {
      if (abortController?.signal.aborted) {
        reject(new Error('拷贝已取消'));
        return;
      }

      const stream = createReadStream(filePath);
      stream.on('data', (chunk: Buffer) => {
        md5?.update(chunk);
        sha256?.update(chunk);
      });
      stream.on('end', () => {
        resolve({
          md5: md5?.digest('hex'),
          sha256: sha256?.digest('hex'),
        });
      });
      stream.on('error', (err) => reject(err));
      abortController?.signal.addEventListener('abort', () => {
        stream.destroy();
        reject(new Error('拷贝已取消'));
      });
    });
  }

  private _hashMismatch(a: FileCopyHashes | undefined, b: FileCopyHashes | undefined, algos: FileCopyHashAlgorithm[]): boolean {
    if (!a || !b) return false;
    for (const algo of algos) {
      if (algo === 'md5' && a.md5 && b.md5 && a.md5 !== b.md5) return true;
      if (algo === 'sha256' && a.sha256 && b.sha256 && a.sha256 !== b.sha256) return true;
    }
    return false;
  }

  private async _resolveDestination(
    taskId: string,
    file: FileCopyItem,
    srcPath: string,
    destPath: string,
    srcSize: number,
    options: FileCopyOptions,
    abortController: AbortController
  ): Promise<{
    finalDestPath: string;
    decision?: FileCopyConflictDecision;
    reason?: FileCopyConflictReason;
    srcHashes?: FileCopyHashes;
    destHashes?: FileCopyHashes;
    skip: boolean;
  }> {
    const conflictCfg: Required<FileCopyConflictOptions> = {
      mode: options.conflict?.mode || 'replace',
      detectDuplicates: Boolean(options.conflict?.detectDuplicates),
    };
    const hashCfg = this._normalizeHashOptions(options.hash);

    const exists = await fs.pathExists(destPath);
    if (!exists) {
      return { finalDestPath: destPath, skip: false };
    }

    let reason: FileCopyConflictReason = 'dest-exists';
    let srcHashes: FileCopyHashes | undefined;
    let destHashes: FileCopyHashes | undefined;
    let destSize: number | undefined;

    try {
      const st = await fs.stat(destPath);
      destSize = st.size;
    } catch {
      destSize = undefined;
    }

    if (conflictCfg.detectDuplicates && typeof destSize === 'number' && destSize === srcSize) {
      srcHashes = await this._computeHashes(srcPath, hashCfg.algorithms, abortController);
      destHashes = await this._computeHashes(destPath, hashCfg.algorithms, abortController);
      const same = !this._hashMismatch(srcHashes, destHashes, hashCfg.algorithms);
      if (same) {
        reason = 'duplicate';
      }
    }

    const defaultDecision: FileCopyConflictDecision =
      reason === 'duplicate'
        ? { action: 'skip' }
        : conflictCfg.mode === 'keep-both'
          ? { action: 'keep-both' }
          : conflictCfg.mode === 'skip'
            ? { action: 'skip' }
            : conflictCfg.mode === 'ask'
              ? { action: 'replace' }
              : { action: 'replace' };

    let decision = defaultDecision;
    if (conflictCfg.mode === 'ask' && options.resolveConflict) {
      decision = await options.resolveConflict({
        taskId,
        file,
        srcPath,
        destPath,
        srcSize,
        destSize,
        reason,
        srcHashes,
        destHashes,
        defaultDecision,
      });
    }

    if (!decision || !decision.action) {
      decision = defaultDecision;
    }

    if (decision.action === 'skip') {
      return { finalDestPath: destPath, decision, reason, srcHashes, destHashes, skip: true };
    }

    if (decision.action === 'replace') {
      return { finalDestPath: destPath, decision, reason, srcHashes, destHashes, skip: false };
    }

    if (decision.action === 'rename') {
      const newName = String(decision.newName || '').trim();
      if (!newName) {
        return { finalDestPath: destPath, decision: { action: 'replace' }, reason, srcHashes, destHashes, skip: false };
      }
      return { finalDestPath: path.join(path.dirname(destPath), newName), decision, reason, srcHashes, destHashes, skip: false };
    }

    const requestedName = String(decision.newName || '').trim();
    const candidate = requestedName ? path.join(path.dirname(destPath), requestedName) : destPath;
    const finalDestPath = (await fs.pathExists(candidate)) ? await this._findAvailablePath(candidate) : candidate;
    const keepBothDecision: FileCopyConflictDecision = requestedName
      ? { action: 'keep-both', newName: requestedName }
      : { action: 'keep-both' };
    return { finalDestPath, decision: keepBothDecision, reason, srcHashes, destHashes, skip: false };
  }

  private async _findAvailablePath(destPath: string): Promise<string> {
    const dir = path.dirname(destPath);
    const ext = path.extname(destPath);
    const base = path.basename(destPath, ext);

    let candidate = path.join(dir, `${base} - 副本${ext}`);
    let index = 2;
    while (await fs.pathExists(candidate)) {
      candidate = path.join(dir, `${base} - 副本 (${index})${ext}`);
      index += 1;
    }
    return candidate;
  }

  /**
   * 分析文件特征
   */
  private async _analyzeFiles(files: FileCopyItem[]) {
    let hasLargeFiles = false;
    let hasSmallFiles = false;
    let totalSize = 0;

    for (const file of files) {
      try {
        const stat = await fs.stat(file.src);
        totalSize += stat.size;
        if (stat.size > this.largeFileThreshold) {
          hasLargeFiles = true;
        } else {
          hasSmallFiles = true;
        }
      } catch {
        // 文件不存在或无法访问，视为小文件
        hasSmallFiles = true;
      }
    }

    return {
      fileCount: files.length,
      totalSize,
      hasLargeFiles,
      hasSmallFiles
    };
  }

  /**
   * 分类文件为大文件和小文件
   */
  private async _categorizeFiles(files: FileCopyItem[]) {
    const largeFiles: Array<{ file: FileCopyItem; size: number; index: number }> = [];
    const smallFiles: Array<{ file: FileCopyItem; size: number; index: number }> = [];

    for (let index = 0; index < files.length; index++) {
      const file = files[index];
      try {
        const stat = await fs.stat(file.src);
        if (stat.size > this.largeFileThreshold) {
          largeFiles.push({ file, size: stat.size, index });
        } else {
          smallFiles.push({ file, size: stat.size, index });
        }
      } catch {
        // 文件不存在或无法访问，视为小文件
        smallFiles.push({ file, size: 0, index });
      }
    }

    return { largeFiles, smallFiles };
  }

  /**
   * 保存进度
   */
  private async _saveProgress(progressFile: string, data: any): Promise<void> {
    try {
      await fs.writeJson(progressFile, data);
    } catch {
      // 忽略写入错误
    }
  }

  /**
   * 计算速度
   */
  private _calculateSpeed(bytes: number, ms: number): string {
    if (ms === 0) return '0 B/s';
    const seconds = ms / 1000;
    const speed = bytes / seconds;
    return this._formatBytes(speed) + '/s';
  }

  /**
   * 格式化字节大小
   */
  private _formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * 报告进度
   */
  private _reportProgress(
    results: CopyResult,
    onProgress?: (progress: CopyProgress) => void
  ): void {
    onProgress?.({
      current: results.completed,
      total: results.total,
      percent: ((results.completed / results.total) * 100).toFixed(2),
      currentFile: results.success[results.success.length - 1]?.name
    });
  }
}

// 单例实例
let fileCopyService: FileCopyService | null = null;

export function getFileCopyService(options?: FileCopyOptions): FileCopyService {
  if (!fileCopyService) {
    fileCopyService = new FileCopyService(options);
  }
  return fileCopyService;
}

export default FileCopyService;
