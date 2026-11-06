/**
 * 文件转换请求
 */
export interface FileConversionRequest {
  filePath: string;
}

export interface FileConversionMetadata {
  pageCount?: number;
  processingTime?: number;
  sourceSize?: number;
  sourceMtime?: number;
  sourceType?: 'text' | 'ocr';
  cacheStatus?: 'hit' | 'miss' | 'stale';
  ocrEngine?: string;
  ocrVersion?: string;
  [key: string]: unknown;
}

export interface FileConversionResult {
  markdown: string;
  usedOcr?: boolean;
  markdownPath?: string;
  metadata?: FileConversionMetadata;
}

export interface PdfTextSearchRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface PdfTextSearchMatch {
  rects: PdfTextSearchRect[];
  text?: string;
  source: 'text' | 'ocr';
}

export interface PdfTextSearchPageMatch {
  pageNumber: number;
  matches: PdfTextSearchMatch[];
}

export interface PdfTextSearchHighlightRequest {
  filePath: string;
  query: string;
  pageNumbers?: number[];
}

export interface PdfTextSearchHighlightResult {
  items: PdfTextSearchPageMatch[];
}
