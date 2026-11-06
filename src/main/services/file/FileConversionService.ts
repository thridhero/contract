import * as fs from 'fs-extra';
import * as path from 'path';
import * as iconv from 'iconv-lite';
import jschardet from 'jschardet';
import { createLogger } from '../../utils/logger';
import { FileConversionMetadata, FileConversionResult } from '../../../shared/types/fileConversion.types';
import { PdfOcrService } from './PdfOcrService';

const logger = createLogger('FileConversionService');

export class FileConversionService {
  private static instance: FileConversionService;

  private constructor() {}

  public static getInstance(): FileConversionService {
    if (!FileConversionService.instance) {
      FileConversionService.instance = new FileConversionService();
    }
    return FileConversionService.instance;
  }

  /**
   * 将文件转换为 Markdown
   * 支持 .docx, .doc, .pdf, .txt, .md
   */
  public async convertToMarkdown(filePath: string, options?: { allowOcr?: boolean }): Promise<FileConversionResult> {
    if (!fs.existsSync(filePath)) {
      throw new Error(`文件不存在: ${filePath}`);
    }

    const ext = path.extname(filePath).toLowerCase();
    const startTime = Date.now();
    const allowOcr = options?.allowOcr !== false;
    
    try {
      switch (ext) {
        case '.docx':
          return await this.withProcessingTime(this.convertDocxToMarkdown(filePath), startTime);
        
        case '.pdf':
          return await this.convertPdfToMarkdown(filePath, startTime, allowOcr);
        
        case '.doc':
          return await this.withProcessingTime(this.convertDocUsingWordExtractor(filePath), startTime);

        case '.xlsx':
        case '.xls':
          return await this.withProcessingTime(this.convertExcelToMarkdown(filePath), startTime);

        case '.png':
        case '.jpg':
        case '.jpeg':
        case '.webp':
        case '.bmp':
        case '.tif':
        case '.tiff':
          return await this.withProcessingTime(this.convertImageToMarkdown(filePath, allowOcr), startTime);

        case '.txt':
        case '.md':
          const content = await this.readTextFileAutoEncoding(filePath);
          return {
            markdown: content,
            usedOcr: false,
            metadata: {
              processingTime: Date.now() - startTime,
              sourceType: 'text',
              encoding: this.detectTextEncoding(filePath),
            },
          };

        default:
          throw new Error(`不支持的文件格式: ${ext}`);
      }
    } catch (error) {
      logger.error(`转换文件失败 [${filePath}]:`, error);
      throw error;
    }
  }

  /**
   * 使用 mammoth + turndown 转换 .docx
   */
  private async convertDocxToMarkdown(filePath: string): Promise<FileConversionResult> {
    const mammoth = require('mammoth');
    const TurndownService = require('turndown');
    
    const { value: html } = await mammoth.convertToHtml({ path: filePath });
    const turndownService = new TurndownService();
    const markdown = turndownService.turndown(html);
    
    return {
      markdown,
      usedOcr: false,
      metadata: {
        sourceType: 'text',
      },
    };
  }

  private async convertPdfToMarkdown(filePath: string, startTime: number, allowOcr: boolean): Promise<FileConversionResult> {
    const sourceStats = fs.statSync(filePath);
    const sourceMetadata: FileConversionMetadata = {
      sourceSize: sourceStats.size,
      sourceMtime: Number(sourceStats.mtimeMs),
    };
    const pdfOcrService = PdfOcrService.getInstance();
    const cachedOcr = await pdfOcrService.getCachedMarkdownForPdf(filePath);

    if (cachedOcr) {
      return this.mergeMetadata(cachedOcr, {
        ...sourceMetadata,
        processingTime: Date.now() - startTime,
      });
    }

    const textMarkdown = await this.extractPdfTextMarkdown(filePath, allowOcr);
    if (this.hasUsableText(textMarkdown)) {
      return {
        markdown: textMarkdown.trim(),
        usedOcr: false,
        metadata: {
          ...sourceMetadata,
          processingTime: Date.now() - startTime,
          sourceType: 'text',
        },
      };
    }

    if (!allowOcr) {
      return {
        markdown: '',
        usedOcr: false,
        metadata: {
          ...sourceMetadata,
          processingTime: Date.now() - startTime,
          sourceType: 'text',
          ocrSkipped: true,
        } as any,
      };
    }

    try {
      const ocrResult = await pdfOcrService.getMarkdownForPdf(filePath);
      return this.mergeMetadata(ocrResult, {
        ...sourceMetadata,
        processingTime: Date.now() - startTime,
      });
    } catch (error) {
      logger.warn(`PDF OCR 失败，返回空文本并保留原文件: ${filePath}`, error);
      return {
        markdown: '',
        usedOcr: true,
        metadata: {
          ...sourceMetadata,
          processingTime: Date.now() - startTime,
          sourceType: 'ocr',
          ocrEngine: 'paddleocr-json',
          ocrFailed: true,
          ocrError: error instanceof Error ? error.message : String(error),
        },
      };
    }
  }

  private async extractPdfTextMarkdown(filePath: string, allowOcr: boolean): Promise<string> {
    const converterResult = await this.tryPdfToMarkdownConverter(filePath);
    if (this.hasUsableText(converterResult)) {
      return converterResult;
    }

    return await this.tryPdfJsTextExtraction(filePath, allowOcr);
  }

  private async tryPdfToMarkdownConverter(filePath: string): Promise<string> {
    try {
      // 使用 eval('import(...)') 绕过 TS 对无类型 ESM 模块的检查
      const PDFToMarkdownModule = await (eval('import("pdf-to-markdown-converter")') as Promise<any>);
      let PDFToMarkdownClass = PDFToMarkdownModule?.default || PDFToMarkdownModule;
      
      // 处理 CJS/ESM 互操作中的双重 default 包装问题
      // pdf-to-markdown-converter 导出了 exports.default = PDFToMarkdown
      // 在 Node.js 的 import() 中会被包装为 { default: { default: PDFToMarkdown } }
      if (typeof PDFToMarkdownClass !== 'function' && PDFToMarkdownClass?.default) {
        PDFToMarkdownClass = PDFToMarkdownClass.default;
      }
      
      const converter = new PDFToMarkdownClass({
        preserveFormatting: true,
        preserveLinks: true,
      });

      return await converter.convertFile(filePath);
    } catch (error) {
      logger.warn(`pdf-to-markdown-converter 提取 PDF 失败，将尝试其他方式: ${filePath}`, error);
      return '';
    }
  }

  private async tryPdfJsTextExtraction(filePath: string, allowOcr: boolean): Promise<string> {
    try {
      const text = await PdfOcrService.getInstance().extractTextLayerFromPdf(filePath);
      return String(text || '').trim();
    } catch (error) {
      if (allowOcr) {
        logger.warn(`PDF 文本层提取失败，将回退 OCR: ${filePath}`);
      } else {
        logger.warn(`PDF 文本层提取失败（OCR 已禁用）: ${filePath}`);
      }
      return '';
    }
  }

  private async convertDocUsingWordExtractor(filePath: string): Promise<FileConversionResult> {
    const WordExtractor = require('word-extractor');
    const extractor = new WordExtractor();
    const extracted = await extractor.extract(filePath);
    
    const body = extracted.getBody();
    const markdown = body
      .split('\n')
      .map((line: string) => line.trim())
      .filter(Boolean)
      .join('\n\n');

    return {
      markdown,
      usedOcr: false,
      metadata: {
        sourceType: 'text',
        title: extracted.getTitle(),
        author: extracted.getAuthor(),
      },
    };
  }

  private async convertExcelToMarkdown(filePath: string): Promise<FileConversionResult> {
    const XLSX = require('xlsx');
    const workbook = XLSX.readFile(filePath, { cellDates: true });
    const sections: string[] = [];

    const escapeCell = (val: unknown) => {
      const s = String(val ?? '').replace(/\r?\n/g, ' ').trim();
      return s.replace(/\|/g, '\\|');
    };

    for (const sheetName of workbook.SheetNames || []) {
      const sheet = workbook.Sheets[sheetName];
      if (!sheet) continue;
      const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, blankrows: false, raw: false }) as any[][];
      const normalizedRows = Array.isArray(rows) ? rows.filter((r) => Array.isArray(r) && r.some((c) => String(c ?? '').trim() !== '')) : [];
      if (normalizedRows.length === 0) continue;

      const maxCols = normalizedRows.reduce((m, r) => Math.max(m, r.length), 0);
      const headerRow = (normalizedRows[0] || []).slice(0, maxCols);
      const header = headerRow.map((c: any, idx: number) => {
        const v = String(c ?? '').trim();
        return v ? escapeCell(v) : `列${idx + 1}`;
      });
      const sep = header.map(() => '---');

      const body = normalizedRows.slice(1).map((r) => {
        const row = new Array(maxCols).fill('');
        for (let i = 0; i < maxCols; i += 1) {
          row[i] = escapeCell(r?.[i]);
        }
        return row;
      });

      const lines: string[] = [];
      lines.push(`## ${escapeCell(sheetName)}`);
      lines.push(`| ${header.join(' | ')} |`);
      lines.push(`| ${sep.join(' | ')} |`);
      for (const row of body) {
        lines.push(`| ${row.join(' | ')} |`);
      }

      sections.push(lines.join('\n'));
    }

    return {
      markdown: sections.join('\n\n').trim(),
      usedOcr: false,
      metadata: {
        sourceType: 'text',
        sheetCount: (workbook.SheetNames || []).length,
      },
    };
  }

  private async convertImageToMarkdown(filePath: string, allowOcr: boolean): Promise<FileConversionResult> {
    if (!allowOcr) {
      return {
        markdown: '',
        usedOcr: false,
        metadata: {
          sourceType: 'text',
          ocrSkipped: true,
        } as any,
      };
    }
    try {
      const pdfOcrService = PdfOcrService.getInstance();
      const { text } = await pdfOcrService.testOcr(filePath);
      const markdown = String(text || '').trim();
      if (!markdown) {
        return {
          markdown: '',
          usedOcr: true,
          metadata: {
            sourceType: 'ocr',
            ocrEngine: 'paddleocr-json',
          },
        };
      }
      return {
        markdown,
        usedOcr: true,
        metadata: {
          sourceType: 'ocr',
          ocrEngine: 'paddleocr-json',
        },
      };
    } catch (error) {
      logger.warn(`图片 OCR 失败，返回空文本并保留原文件: ${filePath}`, error);
      return {
        markdown: '',
        usedOcr: true,
        metadata: {
          sourceType: 'ocr',
          ocrEngine: 'paddleocr-json',
          ocrFailed: true,
          ocrError: error instanceof Error ? error.message : String(error),
        },
      };
    }
  }

  private async withProcessingTime(resultPromise: Promise<FileConversionResult>, startTime: number): Promise<FileConversionResult> {
    const result = await resultPromise;
    return this.mergeMetadata(result, {
      processingTime: Date.now() - startTime,
    });
  }

  private mergeMetadata(result: FileConversionResult, metadata: FileConversionMetadata): FileConversionResult {
    return {
      ...result,
      metadata: {
        ...(result.metadata || {}),
        ...metadata,
      },
    };
  }

  private hasUsableText(markdown: string): boolean {
    const normalized = String(markdown || '').replace(/\s+/g, ' ').trim();
    if (!normalized) {
      return false;
    }

    const meaningfulCharacters = normalized.match(/[A-Za-z0-9\u4e00-\u9fa5]/g) || [];
    return meaningfulCharacters.length >= 20;
  }

  private async readTextFileAutoEncoding(filePath: string): Promise<string> {
    const buf = await fs.readFile(filePath);
    const sample = buf.subarray(0, Math.min(buf.length, 65536));
    const { encoding, bomBytes } = guessTextEncoding(sample);
    const body = buf.subarray(Math.min(buf.length, Math.max(0, bomBytes)));
    return iconv.decode(body, encoding);
  }

  private detectTextEncoding(filePath: string): string {
    try {
      const buf = fs.readFileSync(filePath);
      const sample = buf.subarray(0, Math.min(buf.length, 65536));
      return guessTextEncoding(sample).encoding;
    } catch {
      return 'utf8';
    }
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
  const value = String(input || '').trim().toLowerCase();
  if (!value) return '';
  if (value.includes('utf-8') || value === 'utf8' || value === 'unicode-1-1-utf-8') return 'utf8';
  if (value.includes('utf-16le') || value === 'utf16le') return 'utf16-le';
  if (value.includes('utf-16be') || value === 'utf16be') return 'utf16-be';
  if (value.includes('ascii')) return 'utf8';
  if (value.includes('gb')) return 'gb18030';
  if (value.includes('big5')) return 'big5';
  return value;
}

function guessTextEncoding(sample: Buffer): { encoding: string; bomBytes: number } {
  const bom = detectBom(sample);
  if (bom) return bom;

  const utf8Text = sample.toString('utf8');
  const gbkText = iconv.decode(sample, 'gbk');
  const utf8Score = scoreDecodedText(utf8Text);
  const gbkScore = scoreDecodedText(gbkText);
  if (utf8Score !== gbkScore) {
    return { encoding: utf8Score > gbkScore ? 'utf8' : 'gb18030', bomBytes: 0 };
  }

  const detection = jschardet.detect(sample);
  const encoding = normalizeEncodingName(String(detection?.encoding || ''));
  if (encoding && iconv.encodingExists(encoding)) {
    return { encoding, bomBytes: 0 };
  }

  return { encoding: 'utf8', bomBytes: 0 };
}
