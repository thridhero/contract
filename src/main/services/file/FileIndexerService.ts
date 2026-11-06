import * as fs from 'fs-extra';
import * as path from 'path';
import * as iconv from 'iconv-lite';
import jschardet from 'jschardet';
import { DatabaseService } from '../system/DatabaseService';
import { createLogger } from '../../utils/logger';
import { FileConversionService } from './FileConversionService';
import { findExistingMarkdownSidecarPath } from './markdownSidecar';

const logger = createLogger('FileIndexerService');

// 轻量并发限制器
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

export class FileIndexerService {
  private static instance: FileIndexerService;
  private limit = createLimit(5);
  private directoryIndexInFlight = new Map<string, Promise<void>>();
  private directoryIndexStatus = new Map<string, { lastDoneAt?: number; lastError?: string }>();

  private constructor() {}

  static getInstance(): FileIndexerService {
    if (!FileIndexerService.instance) {
      FileIndexerService.instance = new FileIndexerService();
    }
    return FileIndexerService.instance;
  }

  /**
   * 递归扫描目录并进行全文本索引
   */
  async indexDirectory(dirPath: string, options?: { allowOcr?: boolean; force?: boolean }): Promise<void> {
    if (!fs.existsSync(dirPath)) {
      logger.warn(`目录不存在，取消索引: ${dirPath}`);
      return;
    }

    const allowOcr = options?.allowOcr !== false;
    const force = options?.force === true;
    logger.info(`开始对目录进行全文本索引: ${dirPath}`);
    const files = await this.getAllFiles(dirPath);
    const db = DatabaseService.getInstance();

    const tasks = files.map(filePath => this.limit(async () => {
      try {
        const stats = await fs.stat(filePath);
        const mtime = stats.mtime.getTime();
        const size = stats.size;

        // 检查增量更新
        if (!force) {
          const existing = db.getFileMetadata(filePath);
          if (existing && existing.mtime === mtime && existing.file_size === size) {
            return;
          }
        }

        // 提取文本
        const extracted = await this.extractText(filePath, allowOcr);
        if (extracted.text && extracted.text.trim()) {
          db.updateFileIndex(filePath, extracted.text, stats, extracted.metadata);
          logger.info(`已索引文件: ${path.basename(filePath)}`);
        }
      } catch (error) {
        logger.error(`索引文件失败 ${filePath}:`, error);
      }
    }));

    await Promise.all(tasks);
    logger.info(`目录索引完成: ${dirPath}`);
  }

  ensureIndexDirectory(dirPath: string, options?: { allowOcr?: boolean; force?: boolean }): { indexing: boolean; lastIndexedAt?: number; lastError?: string } {
    const normalized = this.normalizeKey(dirPath);
    if (!normalized) return { indexing: false };

    if (this.directoryIndexInFlight.has(normalized)) {
      const s = this.directoryIndexStatus.get(normalized);
      return { indexing: true, lastIndexedAt: s?.lastDoneAt, lastError: s?.lastError };
    }

    const promise = this.indexDirectory(dirPath, options)
      .then(() => {
        this.directoryIndexStatus.set(normalized, { lastDoneAt: Date.now() });
      })
      .catch((err) => {
        const message = err instanceof Error ? err.message : String(err);
        const prev = this.directoryIndexStatus.get(normalized);
        this.directoryIndexStatus.set(normalized, { lastDoneAt: prev?.lastDoneAt, lastError: message });
        logger.error(`目录索引失败: ${dirPath}`, err);
      })
      .finally(() => {
        this.directoryIndexInFlight.delete(normalized);
      });

    this.directoryIndexInFlight.set(normalized, promise);
    const s = this.directoryIndexStatus.get(normalized);
    return { indexing: true, lastIndexedAt: s?.lastDoneAt, lastError: s?.lastError };
  }

  getIndexStatus(dirPath: string): { indexing: boolean; lastIndexedAt?: number; lastError?: string } {
    const normalized = this.normalizeKey(dirPath);
    if (!normalized) return { indexing: false };
    const s = this.directoryIndexStatus.get(normalized);
    return {
      indexing: this.directoryIndexInFlight.has(normalized),
      lastIndexedAt: s?.lastDoneAt,
      lastError: s?.lastError,
    };
  }

  private normalizeKey(p: string): string {
    const raw = String(p || '').trim();
    if (!raw) return '';
    try {
      return path.resolve(raw).replace(/\\/g, '/').toLowerCase();
    } catch {
      return raw.replace(/\\/g, '/').toLowerCase();
    }
  }

  async indexFiles(
    filePaths: string[],
    onProgress?: (done: number, total: number, currentFile?: string) => void,
    options?: { allowOcr?: boolean; force?: boolean },
  ): Promise<void> {
    const unique = Array.from(new Set((Array.isArray(filePaths) ? filePaths : []).map((p) => String(p || '').trim()).filter(Boolean)));
    if (unique.length === 0) return;

    const db = DatabaseService.getInstance();
    const total = unique.length;
    let done = 0;
    const allowOcr = options?.allowOcr !== false;
    const force = options?.force === true;

    const tasks = unique.map((filePath) =>
      this.limit(async () => {
        try {
          if (!fs.existsSync(filePath)) return;
          const stats = await fs.stat(filePath);
          const mtime = stats.mtime.getTime();
          const size = stats.size;
          if (!force) {
            const existing = db.getFileMetadata(filePath);
            if (existing && existing.mtime === mtime && existing.file_size === size) {
              return;
            }
          }

          const extracted = await this.extractText(filePath, allowOcr);
          if (extracted.text && extracted.text.trim()) {
            db.updateFileIndex(filePath, extracted.text, stats, extracted.metadata);
          }
        } catch (error) {
          logger.error(`索引文件失败 ${filePath}:`, error);
        } finally {
          done += 1;
          onProgress?.(done, total, path.basename(filePath));
        }
      })
    );

    await Promise.all(tasks);
  }

  private async getAllFiles(dirPath: string): Promise<string[]> {
    let results: string[] = [];
    const list = await fs.readdir(dirPath);
    for (const file of list) {
      const baseName = String(file || '');
      const lowerName = baseName.toLowerCase();
      if (lowerName === '.thumbs' || lowerName === '.git' || lowerName === 'node_modules') {
        continue;
      }
      const filePath = path.join(dirPath, file);
      const stat = await fs.stat(filePath);
      if (stat && stat.isDirectory()) {
        results = results.concat(await this.getAllFiles(filePath));
      } else {
        const ext = path.extname(file).toLowerCase();
        if (['.txt', '.json', '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.png', '.jpg', '.jpeg', '.webp', '.bmp', '.tif', '.tiff'].includes(ext)) {
          results.push(filePath);
        }
      }
    }
    return results;
  }

  private async extractText(filePath: string, allowOcr: boolean): Promise<{ text: string | null; metadata?: Record<string, unknown> }> {
    const ext = path.extname(filePath).toLowerCase();
    try {
      if (ext !== '.md') {
        const sidecar = await findExistingMarkdownSidecarPath(filePath);
        if (sidecar && await fs.pathExists(sidecar)) {
          const content = await fs.readFile(sidecar, 'utf-8');
          const text = String(content || '').trim();
          if (text) {
            return { text, metadata: { source: 'sidecar', sidecarPath: sidecar } };
          }
        }
      }
      switch (ext) {
        case '.txt':
          return this.readTextFileAutoEncoding(filePath);
        case '.json':
          return this.readTextFileAutoEncoding(filePath);
        case '.pdf': {
          const conversionResult = await FileConversionService.getInstance().convertToMarkdown(filePath, { allowOcr });
          return {
            text: conversionResult.markdown,
            metadata: {
              ...(conversionResult.metadata || {}),
              usedOcr: conversionResult.usedOcr === true,
              markdownPath: conversionResult.markdownPath || null,
            },
          };
        }
        case '.docx':
          const mammoth = require('mammoth');
          const result = await mammoth.extractRawText({ path: filePath });
          return { text: result.value };
        case '.doc':
          const WordExtractor = require('word-extractor');
          const extractor = new WordExtractor();
          const doc = await extractor.extract(filePath);
          return { text: doc.getBody() };
        case '.xlsx':
        case '.xls':
          return { text: this.extractTextFromExcel(filePath) };
        case '.png':
        case '.jpg':
        case '.jpeg':
        case '.webp':
        case '.bmp':
        case '.tif':
        case '.tiff':
          {
            const conversionResult = await FileConversionService.getInstance().convertToMarkdown(filePath, { allowOcr });
            return {
              text: conversionResult.markdown,
              metadata: {
                ...(conversionResult.metadata || {}),
                usedOcr: conversionResult.usedOcr === true,
                markdownPath: conversionResult.markdownPath || null,
              },
            };
          }
        default:
          return { text: null };
      }
    } catch (error) {
      logger.error(`提取文本失败 ${filePath}:`, error);
      return { text: null };
    }
  }

  private readTextFileAutoEncoding = async (filePath: string): Promise<{ text: string | null; metadata?: Record<string, unknown> }> => {
    const buf = await fs.readFile(filePath);
    const sample = buf.subarray(0, Math.min(buf.length, 65536));
    const { encoding, bomBytes } = guessTextEncoding(sample);
    const body = buf.subarray(Math.min(buf.length, Math.max(0, bomBytes)));
    const text = iconv.decode(body, encoding);
    return { text, metadata: { encoding } };
  }

  private extractTextFromExcel(filePath: string): string {
    const XLSX = require('xlsx');
    const workbook = XLSX.readFile(filePath);
    let fullText = '';
    workbook.SheetNames.forEach((sheetName: string) => {
      const sheet = workbook.Sheets[sheetName];
      // 转换为文本
      fullText += XLSX.utils.sheet_to_txt(sheet) + '\n';
    });
    return fullText;
  }
}

function detectBom(sample: Buffer): { encoding: string; bomBytes: number } | null {
  if (sample.length >= 3 && sample[0] === 0xef && sample[1] === 0xbb && sample[2] === 0xbf) return { encoding: 'utf8', bomBytes: 3 };
  if (sample.length >= 2 && sample[0] === 0xff && sample[1] === 0xfe) return { encoding: 'utf16-le', bomBytes: 2 };
  if (sample.length >= 2 && sample[0] === 0xfe && sample[1] === 0xff) return { encoding: 'utf16-be', bomBytes: 2 };
  return null;
}

function scoreDecodedText(text: string): number {
  let score = 0;
  const replacementCount = (text.match(/\uFFFD/g) || []).length;
  score -= replacementCount * 8;
  const mojibakePenaltyTokens = ['锟', '鍚', '缂', '搴', '鏁', '澶', '鑳'];
  for (const token of mojibakePenaltyTokens) {
    const count = (text.match(new RegExp(token, 'g')) || []).length;
    score -= Math.min(count, 30);
  }
  const controlChars = (text.match(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g) || []).length;
  score -= Math.min(controlChars, 50);
  return score;
}

function normalizeEncodingName(input: string): string {
  const v = String(input || '').trim().toLowerCase();
  if (!v) return '';
  if (v.includes('utf-8') || v === 'utf8' || v === 'unicode-1-1-utf-8') return 'utf8';
  if (v.includes('utf-16le') || v === 'utf16le') return 'utf16-le';
  if (v.includes('utf-16be') || v === 'utf16be') return 'utf16-be';
  if (v.includes('ascii')) return 'utf8';
  if (v.includes('gb')) return 'gb18030';
  if (v.includes('big5')) return 'big5';
  return v;
}

function guessTextEncoding(sample: Buffer): { encoding: string; bomBytes: number } {
  const bom = detectBom(sample);
  if (bom) return bom;

  const utf8Text = sample.toString('utf8');
  const gbkText = iconv.decode(sample, 'gbk');
  const utf8Score = scoreDecodedText(utf8Text);
  const gbkScore = scoreDecodedText(gbkText);
  if (utf8Score !== gbkScore) return { encoding: utf8Score > gbkScore ? 'utf8' : 'gb18030', bomBytes: 0 };

  const detection = jschardet.detect(sample);
  const enc = normalizeEncodingName(String(detection?.encoding || ''));
  if (enc && iconv.encodingExists(enc)) return { encoding: enc, bomBytes: 0 };

  return { encoding: 'utf8', bomBytes: 0 };
}
