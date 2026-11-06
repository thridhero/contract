import * as fs from 'fs-extra';
import * as os from 'os';
import * as path from 'path';
import { pathToFileURL } from 'url';
import { createLogger } from '../../utils/logger';
import { getCacheDir, readValidCache, writeCache } from './pdfOcr/cache';
import type { CacheManifest, OcrPipelineResult, SourceSnapshot } from './pdfOcr/cache';
import {
  dataUrlToBuffer,
  extractSearchBlocksFromResponse,
  extractTextFromResponse,
  invokePaddleOcrWithSafeImagePath,
  normalizeOcrText,
} from './pdfOcr/paddleOcr';
import type { OcrTextBlock } from './pdfOcr/paddleOcr';
import { buildPdfPageCountScript, buildPdfRenderScript, buildPdfTextBlocksExtractionScript, buildPdfTextExtractionScript } from './pdfOcr/pdfRenderScripts';
import { resolvePaddleOcrRuntime } from './pdfOcr/runtime';
import type { OcrRuntimeInfo } from './pdfOcr/runtime';
import { findMatchesFromOcrBlocks } from './pdfOcr/search';
import { normalizeSearchText } from './pdfOcr/textGeometry';
import type {
  FileConversionResult,
  PdfTextSearchHighlightRequest,
  PdfTextSearchHighlightResult,
  PdfTextSearchPageMatch,
} from '../../../shared/types/fileConversion.types';

const logger = createLogger('PdfOcrService');

const OCR_ENGINE = 'paddleocr-json';
const OCR_RENDER_BATCH_SIZE = 5;
const OCR_RENDER_SCALE = 2;
const OCR_TIMEOUT_MS = 120000;

type ElectronMainModule = {
  app?: {
    isPackaged?: boolean;
    getAppPath?: () => string;
    getPath?: (name: string) => string;
  };
  BrowserWindow?: new (options?: Record<string, unknown>) => {
    loadURL: (url: string) => Promise<void>;
    webContents: {
      executeJavaScript: <T>(code: string, userGesture?: boolean) => Promise<T>;
    };
    destroy: () => void;
  };
};

type PageImage = {
  pageNumber: number;
  dataUrl: string;
  width: number;
  height: number;
};

type OcrPageHighlightCache = {
  snapshot: SourceSnapshot;
  pages: Map<number, OcrTextBlock[]>;
};

export class PdfOcrService {
  private static instance: PdfOcrService;
  private readonly searchCache = new Map<string, OcrPageHighlightCache>();

  private constructor() {}

  public static getInstance(): PdfOcrService {
    if (!PdfOcrService.instance) {
      PdfOcrService.instance = new PdfOcrService();
    }
    return PdfOcrService.instance;
  }

  public async checkStatus(): Promise<{
    usable: boolean;
    engine: string;
    version: string;
    executablePath: string;
    modelsPath: string;
    error?: string;
  }> {
    try {
      const runtime = await resolvePaddleOcrRuntime(this.getProjectRootPath());
      return {
        usable: true,
        engine: OCR_ENGINE,
        version: runtime.version,
        executablePath: runtime.executablePath,
        modelsPath: runtime.modelsPath,
      };
    } catch (error) {
      return {
        usable: false,
        engine: OCR_ENGINE,
        version: 'unknown',
        executablePath: '',
        modelsPath: '',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * 测试 OCR 引擎：对指定图片进行识别
   * @param imagePath 图片绝对路径
   */
  public async testOcr(imagePath: string): Promise<{
    text: string;
    elapsedMs: number;
  }> {
    const startedAt = Date.now();
    const runtime = await resolvePaddleOcrRuntime(this.getProjectRootPath());
    const response = await invokePaddleOcrWithSafeImagePath(runtime, imagePath, this.getOcrTimeoutMs());
    const text = normalizeOcrText(extractTextFromResponse(response));

    return {
      text,
      elapsedMs: Date.now() - startedAt,
    };
  }

  public async findTextHighlightsInPdf(
    payload: PdfTextSearchHighlightRequest,
  ): Promise<PdfTextSearchHighlightResult> {
    const filePath = String(payload?.filePath || '').trim();
    const query = normalizeSearchText(payload?.query);
    if (!filePath || !query) {
      return { items: [] };
    }

    const snapshot = await this.getSourceSnapshot(filePath);
    const requestedPages = Array.isArray(payload?.pageNumbers)
      ? Array.from(
          new Set(
            payload.pageNumbers
              .map(pageNumber => Math.max(0, Math.floor(Number(pageNumber || 0))))
              .filter(pageNumber => pageNumber > 0),
          ),
        ).sort((a, b) => a - b)
      : [];

    const pageNumbers = requestedPages.length > 0
      ? requestedPages
      : Array.from({ length: await this.getPdfPageCount(filePath) }, (_, index) => index + 1);

    if (pageNumbers.length === 0) {
      return { items: [] };
    }

    const pageMap = await this.getOcrBlocksForPages(filePath, snapshot, pageNumbers);
    const normalizedQuery = query.toLocaleLowerCase();
    const compactQuery = normalizedQuery.replace(/\s+/g, '');
    const items: PdfTextSearchPageMatch[] = [];

    for (const pageNumber of pageNumbers) {
      const blocks = pageMap.get(pageNumber) || [];
      const matches = findMatchesFromOcrBlocks(blocks as any, normalizedQuery, compactQuery);

      if (matches.length > 0) {
        items.push({
          pageNumber,
          matches,
        });
      }
    }

    return { items };
  }

  public async getOcrBlocksForPdf(
    filePath: string,
    pageNumbers?: number[],
  ): Promise<Array<{ pageNumber: number; blocks: OcrTextBlock[] }>> {
    const normalizedFilePath = String(filePath || '').trim();
    if (!normalizedFilePath) {
      return [];
    }

    const snapshot = await this.getSourceSnapshot(normalizedFilePath);
    const requestedPages = Array.isArray(pageNumbers)
      ? Array.from(
          new Set(
            pageNumbers
              .map(pageNumber => Math.max(0, Math.floor(Number(pageNumber || 0))))
              .filter(pageNumber => pageNumber > 0),
          ),
        ).sort((a, b) => a - b)
      : [];
    const resolvedPageNumbers = requestedPages.length > 0
      ? requestedPages
      : Array.from({ length: await this.getPdfPageCount(normalizedFilePath) }, (_, index) => index + 1);

    if (resolvedPageNumbers.length === 0) {
      return [];
    }

    const pageMap = await this.getOcrBlocksForPages(normalizedFilePath, snapshot, resolvedPageNumbers);
    return resolvedPageNumbers.map(pageNumber => ({
      pageNumber,
      blocks: pageMap.get(pageNumber) || [],
    }));
  }

  public async getCachedMarkdownForPdf(filePath: string): Promise<FileConversionResult | null> {
    const snapshot = await this.getSourceSnapshot(filePath);
    const cache = await readValidCache({
      filePath,
      snapshot,
      ocrRootDir: this.getOcrRootDir(),
      onWarn: (message, error) => logger.warn(message, error),
    });
    if (!cache || !(await this.isCacheCompatible(cache.manifest))) {
      return null;
    }

    return this.buildCachedResult(cache, 'hit');
  }

  public async getMarkdownForPdf(filePath: string): Promise<FileConversionResult> {
    const snapshot = await this.getSourceSnapshot(filePath);
    const existingCache = await readValidCache({
      filePath,
      snapshot,
      ocrRootDir: this.getOcrRootDir(),
      onWarn: (message, error) => logger.warn(message, error),
    });
    if (existingCache && await this.isCacheCompatible(existingCache.manifest)) {
      return this.buildCachedResult(existingCache, 'hit');
    }

    const cacheDir = getCacheDir(this.getOcrRootDir(), filePath);
    const hadCacheBefore = await fs.pathExists(path.join(cacheDir, 'manifest.json'));
    const runtime = await resolvePaddleOcrRuntime(this.getProjectRootPath());
    const pipelineResult = await this.runOcrPipeline(filePath, runtime);
    const manifest = await writeCache({
      filePath,
      snapshot,
      result: pipelineResult,
      ocrRootDir: this.getOcrRootDir(),
      engine: OCR_ENGINE,
    });

    return {
      markdown: pipelineResult.markdown,
      usedOcr: true,
      markdownPath: manifest.markdownPath,
      metadata: {
        pageCount: manifest.pageCount,
        sourceSize: manifest.sourceSize,
        sourceMtime: manifest.sourceMtime,
        sourceType: 'ocr',
        cacheStatus: hadCacheBefore ? 'stale' : 'miss',
        ocrEngine: manifest.engine,
        ocrVersion: manifest.engineVersion,
      },
    };
  }

  public async renderPdfPagePreviewAsPng(filePath: string, pageNumber = 1): Promise<Buffer> {
    const safePageNumber = Math.max(1, Math.floor(Number(pageNumber || 1)));
    const pageImages = await this.renderPdfPageRange(filePath, safePageNumber, safePageNumber);
    const pageImage = pageImages[0];
    if (!pageImage?.dataUrl) {
      throw new Error(`PDF 页面渲染失败: ${path.basename(filePath)}#${safePageNumber}`);
    }
    return dataUrlToBuffer(pageImage.dataUrl);
  }

  private buildCachedResult(
    cache: { manifest: CacheManifest; markdown: string },
    cacheStatus: 'hit' | 'miss' | 'stale',
  ): FileConversionResult {
    return {
      markdown: cache.markdown,
      usedOcr: true,
      markdownPath: cache.manifest.markdownPath,
      metadata: {
        pageCount: cache.manifest.pageCount,
        sourceSize: cache.manifest.sourceSize,
        sourceMtime: cache.manifest.sourceMtime,
        sourceType: 'ocr',
        cacheStatus,
        ocrEngine: cache.manifest.engine,
        ocrVersion: cache.manifest.engineVersion,
      },
    };
  }

  private async runOcrPipeline(filePath: string, runtime: OcrRuntimeInfo): Promise<OcrPipelineResult> {
    const totalPages = await this.getPdfPageCount(filePath);
    if (totalPages < 1) {
      throw new Error(`PDF 未包含可识别页面: ${filePath}`);
    }

    const sections: string[] = [];
    let pageFailures = 0;
    await fs.ensureDir(this.getTempRuntimeDir());
    const workDir = await fs.mkdtemp(path.join(this.getTempRuntimeDir(), 'paddleocr-json-'));

    try {
      for (let startPage = 1; startPage <= totalPages; startPage += OCR_RENDER_BATCH_SIZE) {
        const endPage = Math.min(totalPages, startPage + OCR_RENDER_BATCH_SIZE - 1);
        const pageImages = await this.renderPdfPageRange(filePath, startPage, endPage);

        for (const pageImage of pageImages) {
          try {
            const text = await this.recognizePageImage(filePath, pageImage, runtime, workDir);
            if (text) {
              sections.push(`## 第 ${pageImage.pageNumber} 页\n\n${text}`);
            }
          } catch (error) {
            pageFailures += 1;
            logger.warn(`PDF OCR 页识别失败 [${path.basename(filePath)}#${pageImage.pageNumber}]`, error);
          }
        }
      }
    } finally {
      await fs.remove(workDir);
    }

    if (sections.length === 0) {
      throw new Error(pageFailures > 0 ? 'PDF OCR 全部页面识别失败' : 'PDF OCR 未提取到有效文本');
    }

    return {
      markdown: sections.join('\n\n').trim(),
      pageCount: totalPages,
      engineVersion: runtime.version,
    };
  }

  private async getPdfPageCount(filePath: string): Promise<number> {
    const pdfModulePath = this.getPdfJsModulePath();
    return await this.executePdfRender<number>(buildPdfPageCountScript(filePath, pdfModulePath));
  }

  private async renderPdfPageRange(filePath: string, startPage: number, endPage: number): Promise<PageImage[]> {
    const pdfModulePath = this.getPdfJsModulePath();
    return await this.executePdfRender<PageImage[]>(
      buildPdfRenderScript(filePath, startPage, endPage, pdfModulePath, OCR_RENDER_SCALE),
    );
  }

  private async getOcrBlocksForPages(
    filePath: string,
    snapshot: SourceSnapshot,
    pageNumbers: number[],
  ): Promise<Map<number, OcrTextBlock[]>> {
    const normalizedPages = Array.from(
      new Set(
        pageNumbers
          .map(pageNumber => Math.max(0, Math.floor(Number(pageNumber || 0))))
          .filter(pageNumber => pageNumber > 0),
      ),
    ).sort((a, b) => a - b);

    if (normalizedPages.length === 0) {
      return new Map();
    }

    const cacheKey = this.buildSearchCacheKey(filePath);
    let cache = this.searchCache.get(cacheKey);
    if (!cache || cache.snapshot.size !== snapshot.size || cache.snapshot.mtimeMs !== snapshot.mtimeMs) {
      cache = {
        snapshot,
        pages: new Map<number, OcrTextBlock[]>(),
      };
      this.searchCache.set(cacheKey, cache);
    }

    const missingPages = normalizedPages.filter(pageNumber => !cache?.pages.has(pageNumber));
    if (missingPages.length > 0) {
      const runtime = await resolvePaddleOcrRuntime(this.getProjectRootPath());
      await fs.ensureDir(this.getTempRuntimeDir());
      const workDir = await fs.mkdtemp(path.join(this.getTempRuntimeDir(), 'paddleocr-json-search-'));

      try {
        const groups = this.buildPageGroups(missingPages, OCR_RENDER_BATCH_SIZE);
        for (const group of groups) {
          const startPage = group[0];
          const endPage = group[group.length - 1];
          const pageImages = await this.renderPdfPageRange(filePath, startPage, endPage);
          const groupSet = new Set(group);

          for (const pageImage of pageImages) {
            if (!groupSet.has(pageImage.pageNumber)) {
              continue;
            }
            try {
              const blocks = await this.recognizePageImageBlocks(filePath, pageImage, runtime, workDir);
              cache.pages.set(pageImage.pageNumber, blocks);
            } catch (error) {
              cache.pages.set(pageImage.pageNumber, []);
              logger.warn(`PDF OCR 搜索定位失败 [${path.basename(filePath)}#${pageImage.pageNumber}]`, error);
            }
          }
        }
      } finally {
        await fs.remove(workDir);
      }
    }

    return new Map(
      normalizedPages.map(pageNumber => [pageNumber, cache.pages.get(pageNumber) || []]),
    );
  }

  private async executePdfRender<T>(script: string): Promise<T> {
    const electronModule = this.getElectronMainModule();
    if (!electronModule?.BrowserWindow) {
      throw new Error('当前运行环境不支持 PDF OCR 页面渲染');
    }

    const BrowserWindow = electronModule.BrowserWindow;
    const window = new BrowserWindow({
      show: false,
      width: 1400,
      height: 1800,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false,
        sandbox: false,
        webSecurity: false,
      },
    });

    try {
      const blankHtmlPath = this.resolveBlankHtmlPath();
      const blankHtmlUrl = pathToFileURL(blankHtmlPath).href;
      await window.loadURL(blankHtmlUrl);
      return await window.webContents.executeJavaScript<T>(script, true);
    } finally {
      window.destroy();
    }
  }

  private async recognizePageImage(
    filePath: string,
    pageImage: PageImage,
    runtime: OcrRuntimeInfo,
    workDir: string,
  ): Promise<string> {
    const imagePath = path.join(workDir, `ocr-page-${pageImage.pageNumber}.png`);
    await fs.writeFile(imagePath, dataUrlToBuffer(pageImage.dataUrl));
    try {
      const response = await invokePaddleOcrWithSafeImagePath(runtime, imagePath, this.getOcrTimeoutMs());
      return normalizeOcrText(extractTextFromResponse(response));
    } finally {
      await fs.remove(imagePath);
    }
  }

  private async recognizePageImageBlocks(
    filePath: string,
    pageImage: PageImage,
    runtime: OcrRuntimeInfo,
    workDir: string,
  ): Promise<OcrTextBlock[]> {
    const imagePath = path.join(workDir, `ocr-blocks-${pageImage.pageNumber}.png`);
    await fs.writeFile(imagePath, dataUrlToBuffer(pageImage.dataUrl));
    try {
      const response = await invokePaddleOcrWithSafeImagePath(runtime, imagePath, this.getOcrTimeoutMs());
      return extractSearchBlocksFromResponse(response, pageImage.width, pageImage.height);
    } finally {
      await fs.remove(imagePath);
    }
  }

  public async extractTextLayerFromPdf(filePath: string): Promise<string> {
    const pdfModulePath = this.getPdfJsModulePath();
    return await this.executePdfRender<string>(buildPdfTextExtractionScript(filePath, pdfModulePath));
  }

  public async extractTextBlocksFromPdf(filePath: string): Promise<Array<{ pageNumber: number; blocks: OcrTextBlock[] }>> {
    const pdfModulePath = this.getPdfJsModulePath();
    const payload = await this.executePdfRender<Array<{ pageNumber: number; blocks: OcrTextBlock[] }>>(
      buildPdfTextBlocksExtractionScript(filePath, pdfModulePath),
    );
    return Array.isArray(payload) ? payload : [];
  }

  private buildPageGroups(pageNumbers: number[], maxGroupSize: number): number[][] {
    const groups: number[][] = [];
    let current: number[] = [];

    for (const pageNumber of pageNumbers) {
      const previous = current[current.length - 1];
      const isContinuous = current.length > 0 && pageNumber === previous + 1;
      if (current.length >= maxGroupSize || (current.length > 0 && !isContinuous)) {
        groups.push(current);
        current = [];
      }
      current.push(pageNumber);
    }

    if (current.length > 0) {
      groups.push(current);
    }

    return groups;
  }

  private buildSearchCacheKey(filePath: string): string {
    return path.resolve(filePath).toLowerCase();
  }

  private async isCacheCompatible(manifest: CacheManifest): Promise<boolean> {
    if (manifest.engine !== OCR_ENGINE || !manifest.engineVersion) {
      return false;
    }

    const runtimeVersion = await this.getCurrentRuntimeVersionSafe();
    return !runtimeVersion || runtimeVersion === manifest.engineVersion;
  }

  private async getCurrentRuntimeVersionSafe(): Promise<string | null> {
    try {
      const runtime = await resolvePaddleOcrRuntime(this.getProjectRootPath());
      return runtime.version;
    } catch {
      return null;
    }
  }

  private async getSourceSnapshot(filePath: string): Promise<SourceSnapshot> {
    const stats = await fs.stat(filePath);
    return {
      size: stats.size,
      mtimeMs: Number(stats.mtimeMs),
    };
  }

  private getOcrRootDir(): string {
    return path.join(this.getUserDataPath(), 'pdf-ocr-cache');
  }

  private getTempRuntimeDir(): string {
    return path.join(this.getUserDataPath(), 'ocr', 'runtime-temp');
  }

  private getUserDataPath(): string {
    const electronModule = this.getElectronMainModule();
    const userDataPath = electronModule?.app?.getPath?.('userData');
    if (userDataPath) {
      return userDataPath;
    }

    return path.join(os.tmpdir(), 'software-registration-manager');
  }

  private getPdfJsModulePath(): string {
    return path.join(this.getNodeModulesRootPath(), 'pdfjs-dist', 'legacy', 'build', 'pdf.mjs');
  }

  private getNodeModulesRootPath(): string {
    return path.join(this.getProjectRootPath(), 'node_modules');
  }

  private getProjectRootPath(): string {
    const electronModule = this.getElectronMainModule();
    const appPath = electronModule?.app?.getAppPath?.();
    if (appPath && electronModule?.app?.isPackaged) {
      return appPath.replace(/app\.asar([\\/]|$)/, 'app.asar.unpacked$1');
    }
    return path.resolve(process.cwd());
  }

  private resolveBlankHtmlPath(): string {
    const candidates = [
      process.resourcesPath ? path.join(process.resourcesPath, 'ocr', 'blank.html') : '',
      path.join(process.cwd(), 'resources', 'ocr', 'blank.html'),
      path.join(this.getProjectRootPath(), 'resources', 'ocr', 'blank.html'),
    ]
      .map(item => String(item || '').trim())
      .filter(Boolean);

    for (const candidate of candidates) {
      if (fs.existsSync(candidate)) {
        return candidate;
      }
    }

    throw new Error(`未找到 OCR 渲染页 blank.html，已尝试：${candidates.join(' | ')}`);
  }

  private getElectronMainModule(): ElectronMainModule | null {
    try {
      const electronModule = require('electron') as ElectronMainModule | string;
      if (typeof electronModule === 'string') {
        return null;
      }
      return electronModule;
    } catch {
      return null;
    }
  }

  private async readRuntimeVersion(runtimeDir: string, executablePath: string): Promise<string> {
    const versionFile = path.join(runtimeDir, 'version.txt');
    if (await fs.pathExists(versionFile)) {
      const version = (await fs.readFile(versionFile, 'utf-8')).trim();
      if (version) {
        return version;
      }
    }
    return await this.buildRuntimeVersion(executablePath);
  }

  private async buildRuntimeVersion(executablePath: string): Promise<string> {
    const stats = await fs.stat(executablePath);
    return `${path.basename(executablePath)}:${stats.size}:${Number(stats.mtimeMs)}`;
  }

  private getEnvCommandArgsPrefix(): string[] {
    const raw = String(process.env.PADDLEOCR_JSON_EXECUTABLE_ARGS || '').trim();
    if (!raw) {
      return [];
    }
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) {
        throw new Error('参数必须为数组');
      }
      return parsed.map(item => String(item));
    } catch (error) {
      throw new Error(`解析 PADDLEOCR_JSON_EXECUTABLE_ARGS 失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private getOcrTimeoutMs(): number {
    const envValue = Number(process.env.PADDLEOCR_JSON_TIMEOUT_MS || 0);
    if (Number.isFinite(envValue) && envValue > 0) {
      return envValue;
    }
    return OCR_TIMEOUT_MS;
  }

  private stringifyJson(value: unknown): string {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }

  private dataUrlToBuffer(dataUrl: string): Buffer {
    const separatorIndex = dataUrl.indexOf(',');
    const base64 = separatorIndex >= 0 ? dataUrl.slice(separatorIndex + 1) : dataUrl;
    return Buffer.from(base64, 'base64');
  }
}
