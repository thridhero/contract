import * as path from 'path';
import { getDefaultStrategy, parseInvoiceFromMarkdown } from './InvoiceMarkdownParser';
import { PdfOcrService } from '../file/PdfOcrService';
import type { OcrTextBlock } from '../file/pdfOcr/paddleOcr';
import type {
  InvoiceFieldResult,
  InvoiceParseError,
  InvoiceParseResult,
  InvoiceParsedData,
  InvoiceParsedFields,
} from '../../../shared/types/invoice.types';

type OcrPageBlocks = {
  pageNumber: number;
  blocks: OcrTextBlock[];
};

type LayoutFieldCandidate<T> = {
  value?: T;
  confidence: number;
  evidence?: string;
};

type PositionedBlock = OcrTextBlock & {
  pageNumber: number;
  centerX: number;
  centerY: number;
  right: number;
  bottom: number;
  normalizedText: string;
};

const SUPPORTED_LAYOUT_EXTS = new Set(['.pdf']);

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

const normalizeInlineText = (value: string): string => String(value || '').replace(/\s+/g, ' ').trim();

const toHalfWidth = (input: string): string => {
  let out = '';
  for (let i = 0; i < input.length; i += 1) {
    const code = input.charCodeAt(i);
    if (code === 12288) {
      out += ' ';
      continue;
    }
    if (code >= 65281 && code <= 65374) {
      out += String.fromCharCode(code - 65248);
      continue;
    }
    out += input[i];
  }
  return out;
};

const normalizeTextForMatch = (value: string): string => toHalfWidth(String(value || ''))
  .replace(/[：:]/g, '')
  .replace(/\s+/g, '')
  .trim();

const parseMoneyExact = (raw: string): number | null => {
  const normalized = String(raw ?? '').replace(/[，,]/g, '').replace(/[^\d.\-]/g, '');
  if (!normalized) return null;
  if (!/^-?\d+(?:\.\d+)?$/.test(normalized)) return null;
  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
};

const parseIssueDate = (raw: string): { iso?: string; confidence: number } => {
  const s = String(raw ?? '').trim();
  if (!s) return { confidence: 0 };
  const normalized = s
    .replace(/[\.\/]/g, '-')
    .replace(/年/g, '-')
    .replace(/月/g, '-')
    .replace(/日/g, '')
    .replace(/\s+/g, '');
  const match = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(normalized);
  if (!match) return { confidence: 0 };
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (year < 1990 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) {
    return { confidence: 0.2 };
  }
  return {
    iso: `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
    confidence: 0.96,
  };
};

const makeField = <T>(candidate?: LayoutFieldCandidate<T>): InvoiceFieldResult<T> => ({
  value: candidate?.value,
  confidence: clamp01(Number(candidate?.confidence || 0)),
  evidence: candidate?.evidence ? String(candidate.evidence).slice(0, 160) : undefined,
});

const buildEmptyFields = (): InvoiceParsedFields => ({
  invoiceType: makeField<string>(),
  invoiceCode: makeField<string>(),
  invoiceNo: makeField<string>(),
  issueDate: makeField<string>(),
  checkCode: makeField<string>(),
  machineNo: makeField<string>(),
  buyerName: makeField<string>(),
  buyerTaxNo: makeField<string>(),
  sellerName: makeField<string>(),
  sellerTaxNo: makeField<string>(),
  amountWithoutTax: makeField<number>(),
  taxAmount: makeField<number>(),
  totalAmount: makeField<number>(),
  invoiceItems: makeField<any[]>(),
  remark: makeField<string>(),
  issuerName: makeField<string>(),
});

const scoreParseResult = (result: InvoiceParseResult): number => {
  if (!result) return 0;
  const fieldConfidence =
    (Number(result.fields.invoiceNo.confidence || 0) * 0.22) +
    (Number(result.fields.invoiceCode.confidence || 0) * 0.16) +
    (Number(result.fields.issueDate.confidence || 0) * 0.14) +
    (Number(result.fields.totalAmount.confidence || 0) * 0.20) +
    (Number(result.fields.buyerName.confidence || 0) * 0.08) +
    (Number(result.fields.sellerName.confidence || 0) * 0.08) +
    (Number(result.fields.buyerTaxNo.confidence || 0) * 0.06) +
    (Number(result.fields.sellerTaxNo.confidence || 0) * 0.06);
  const invoiceBonus = result.isInvoice ? 0.12 : 0;
  const errorPenalty = Math.min(0.12, (result.errors?.length || 0) * 0.02);
  return clamp01(fieldConfidence + Number(result.confidence || 0) * 0.28 + invoiceBonus - errorPenalty);
};

export const chooseBetterInvoiceParseResult = (
  primary: InvoiceParseResult,
  alternative?: InvoiceParseResult | null,
): InvoiceParseResult => {
  if (!alternative) return primary;
  return scoreParseResult(alternative) > scoreParseResult(primary) ? alternative : primary;
};

const hasStrongLayoutHit = (result?: InvoiceParseResult | null): boolean => {
  if (!result?.isInvoice) return false;
  const hasInvoiceNo = Number(result.fields.invoiceNo.confidence || 0) >= 0.8;
  const hasIssueDate = Number(result.fields.issueDate.confidence || 0) >= 0.8;
  const hasTotalAmount = Number(result.fields.totalAmount.confidence || 0) >= 0.85;
  return hasInvoiceNo && hasIssueDate && hasTotalAmount;
};

const mergeField = <T>(
  primary: InvoiceFieldResult<T>,
  fallback: InvoiceFieldResult<T>,
): InvoiceFieldResult<T> => {
  const primaryConfidence = Number(primary?.confidence || 0);
  const fallbackConfidence = Number(fallback?.confidence || 0);
  const primaryHasValue = primary?.value !== undefined && primary?.value !== null && String(primary.value).trim() !== '';
  const fallbackHasValue = fallback?.value !== undefined && fallback?.value !== null && String(fallback.value).trim() !== '';
  if (!fallbackHasValue) return primary;
  if (!primaryHasValue) return fallback;
  return fallbackConfidence > primaryConfidence ? fallback : primary;
};

const mergeParseResults = (
  primary: InvoiceParseResult,
  fallback: InvoiceParseResult,
): InvoiceParseResult => {
  const fields: InvoiceParsedFields = {
    invoiceType: mergeField(primary.fields.invoiceType, fallback.fields.invoiceType),
    invoiceCode: mergeField(primary.fields.invoiceCode, fallback.fields.invoiceCode),
    invoiceNo: mergeField(primary.fields.invoiceNo, fallback.fields.invoiceNo),
    issueDate: mergeField(primary.fields.issueDate, fallback.fields.issueDate),
    checkCode: mergeField(primary.fields.checkCode, fallback.fields.checkCode),
    machineNo: mergeField(primary.fields.machineNo, fallback.fields.machineNo),
    buyerName: mergeField(primary.fields.buyerName, fallback.fields.buyerName),
    buyerTaxNo: mergeField(primary.fields.buyerTaxNo, fallback.fields.buyerTaxNo),
    sellerName: mergeField(primary.fields.sellerName, fallback.fields.sellerName),
    sellerTaxNo: mergeField(primary.fields.sellerTaxNo, fallback.fields.sellerTaxNo),
    amountWithoutTax: mergeField(primary.fields.amountWithoutTax, fallback.fields.amountWithoutTax),
    taxAmount: mergeField(primary.fields.taxAmount, fallback.fields.taxAmount),
    totalAmount: mergeField(primary.fields.totalAmount, fallback.fields.totalAmount),
    invoiceItems: mergeField(primary.fields.invoiceItems, fallback.fields.invoiceItems),
    remark: mergeField(primary.fields.remark, fallback.fields.remark),
    issuerName: mergeField(primary.fields.issuerName, fallback.fields.issuerName),
  };

  return {
    ...primary,
    confidence: Math.max(Number(primary.confidence || 0), Number(fallback.confidence || 0)),
    data: {
      invoiceType: fields.invoiceType.value,
      invoiceCode: fields.invoiceCode.value,
      invoiceNo: fields.invoiceNo.value,
      issueDate: fields.issueDate.value,
      checkCode: fields.checkCode.value,
      machineNo: fields.machineNo.value,
      buyerName: fields.buyerName.value,
      buyerTaxNo: fields.buyerTaxNo.value,
      sellerName: fields.sellerName.value,
      sellerTaxNo: fields.sellerTaxNo.value,
      amountWithoutTax: fields.amountWithoutTax.value,
      taxAmount: fields.taxAmount.value,
      totalAmount: fields.totalAmount.value,
      invoiceItems: fields.invoiceItems.value,
      remark: fields.remark.value,
      issuerName: fields.issuerName.value,
    },
    fields,
    errors: primary.errors,
  };
};

const parseFromPositionedBlocks = (
  blocks: PositionedBlock[],
  engine: string,
): {
  parseResult: InvoiceParseResult;
  parseEngine: string;
  rawText: string;
} | null => {
  if (!blocks.length) return null;
  const layoutMarkdown = buildLayoutAwareMarkdownFromBlocks(blocks);
  const layoutOnlyResult = buildLayoutParseResult(blocks, layoutMarkdown);
  const markdownEnrichedResult = parseInvoiceFromMarkdown(layoutMarkdown);
  const parseResult = mergeParseResults(layoutOnlyResult, markdownEnrichedResult);
  return {
    parseResult,
    parseEngine: engine,
    rawText: layoutMarkdown,
  };
};

const toPositionedBlocks = (pages: OcrPageBlocks[]): PositionedBlock[] => {
  const positioned: PositionedBlock[] = [];
  for (const page of pages || []) {
    for (const block of page.blocks || []) {
      const left = Number(block?.rect?.left || 0);
      const top = Number(block?.rect?.top || 0);
      const width = Number(block?.rect?.width || 0);
      const height = Number(block?.rect?.height || 0);
      const text = normalizeInlineText(block?.text || '');
      if (!text) continue;
      positioned.push({
        ...block,
        pageNumber: page.pageNumber,
        centerX: left + width / 2,
        centerY: top + height / 2,
        right: left + width,
        bottom: top + height,
        normalizedText: normalizeTextForMatch(text),
      });
    }
  }
  return positioned;
};

const buildLineThreshold = (blocks: PositionedBlock[]): number => {
  const heights = blocks.map(block => Number(block.rect.height || 0)).filter(v => v > 0).sort((a, b) => a - b);
  if (!heights.length) return 0.018;
  const median = heights[Math.floor(heights.length / 2)] || 0.018;
  return Math.max(0.012, Math.min(0.04, median * 0.75));
};

const buildLayoutAwareMarkdownFromBlocks = (blocks: PositionedBlock[]): string => {
  const sorted = [...blocks].sort((a, b) => {
    if (a.pageNumber !== b.pageNumber) return a.pageNumber - b.pageNumber;
    const topDelta = a.rect.top - b.rect.top;
    if (Math.abs(topDelta) > 0.0025) return topDelta;
    return a.rect.left - b.rect.left;
  });
  const lineThreshold = buildLineThreshold(sorted);
  const pageLines = new Map<number, Array<{ top: number; blocks: PositionedBlock[] }>>();
  for (const block of sorted) {
    const lines = pageLines.get(block.pageNumber) || [];
    const lastLine = lines[lines.length - 1];
    if (!lastLine || Math.abs(block.rect.top - lastLine.top) > lineThreshold) {
      lines.push({ top: block.rect.top, blocks: [block] });
    } else {
      lastLine.blocks.push(block);
      lastLine.top = Math.min(lastLine.top, block.rect.top);
    }
    pageLines.set(block.pageNumber, lines);
  }
  return Array.from(pageLines.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([, lines]) => lines
      .map(line => line.blocks.sort((a, b) => a.rect.left - b.rect.left).map(block => block.text).join(' '))
      .join('\n'))
    .join('\n\n')
    .trim();
};

const findLabelBlock = (blocks: PositionedBlock[], labels: string[]): PositionedBlock | null => {
  const normalizedLabels = labels.map(normalizeTextForMatch);
  for (const block of blocks) {
    if (normalizedLabels.some(label => block.normalizedText.includes(label))) {
      return block;
    }
  }
  return null;
};

const findLabelBlocks = (blocks: PositionedBlock[], labels: string[]): PositionedBlock[] => {
  const normalizedLabels = labels.map(normalizeTextForMatch);
  return blocks.filter(block => normalizedLabels.some(label => block.normalizedText.includes(label)));
};

const findNeighborBlocks = (
  blocks: PositionedBlock[],
  labelBlock: PositionedBlock,
  options?: {
    xMin?: number;
    xMax?: number;
    yMin?: number;
    yMax?: number;
    samePageOnly?: boolean;
  },
): PositionedBlock[] => {
  const samePageOnly = options?.samePageOnly !== false;
  return blocks.filter(block => {
    if (block === labelBlock) return false;
    if (samePageOnly && block.pageNumber !== labelBlock.pageNumber) return false;
    const dx = block.rect.left - labelBlock.rect.left;
    const dy = block.centerY - labelBlock.centerY;
    if (options?.xMin !== undefined && dx < options.xMin) return false;
    if (options?.xMax !== undefined && dx > options.xMax) return false;
    if (options?.yMin !== undefined && dy < options.yMin) return false;
    if (options?.yMax !== undefined && dy > options.yMax) return false;
    return true;
  }).sort((a, b) => {
    const ay = Math.abs(a.centerY - labelBlock.centerY);
    const by = Math.abs(b.centerY - labelBlock.centerY);
    if (Math.abs(ay - by) > 0.002) return ay - by;
    return a.rect.left - b.rect.left;
  });
};

const joinEvidence = (labelBlock: PositionedBlock, valueBlocks: PositionedBlock[]): string => {
  return [labelBlock.text, ...valueBlocks.map(block => block.text)].join(' ').trim();
};

const extractDigitsFromBlocks = (
  blocks: PositionedBlock[],
  labelNames: string[],
  minLength: number,
  maxLength: number,
): LayoutFieldCandidate<string> => {
  const labelBlock = findLabelBlock(blocks, labelNames);
  if (!labelBlock) return { confidence: 0 };
  const neighbors = findNeighborBlocks(blocks, labelBlock, {
    xMin: -0.01,
    xMax: 0.42,
    yMin: -0.03,
    yMax: 0.05,
  });
  for (const block of neighbors) {
    const digits = String(block.text || '').replace(/\D+/g, '');
    if (digits.length >= minLength && digits.length <= maxLength) {
      return {
        value: digits,
        confidence: digits.length === maxLength || digits.length === minLength ? 0.96 : 0.84,
        evidence: joinEvidence(labelBlock, [block]),
      };
    }
  }
  return { confidence: 0 };
};

const extractDateFromBlocks = (blocks: PositionedBlock[]): LayoutFieldCandidate<string> => {
  const labelBlock = findLabelBlock(blocks, ['开票日期']);
  if (!labelBlock) return { confidence: 0 };
  const neighbors = findNeighborBlocks(blocks, labelBlock, {
    xMin: -0.01,
    xMax: 0.36,
    yMin: -0.03,
    yMax: 0.05,
  });
  for (const block of neighbors) {
    const parsed = parseIssueDate(block.text);
    if (parsed.iso) {
      return {
        value: parsed.iso,
        confidence: parsed.confidence,
        evidence: joinEvidence(labelBlock, [block]),
      };
    }
  }
  return { confidence: 0 };
};

const extractMoneyFromBlocks = (
  blocks: PositionedBlock[],
  labelNames: string[],
): LayoutFieldCandidate<number> => {
  const labelBlocks = findLabelBlocks(blocks, labelNames);
  if (!labelBlocks.length) return { confidence: 0 };

  const extractMoneyMatches = (text: string): string[] => {
    return [...String(text || '').matchAll(/[￥¥]?\s*([0-9]+(?:,[0-9]{3})*(?:\.\d+)?)/g)]
      .map(match => String(match[1] || '').trim())
      .filter(Boolean);
  };

  for (const labelBlock of labelBlocks) {
    const sameLineBlocks = blocks
      .filter(block => {
        if (block === labelBlock || block.pageNumber !== labelBlock.pageNumber) return false;
        const yTolerance = Math.max(0.018, Math.max(block.rect.height, labelBlock.rect.height) * 1.2);
        const isSameLine = Math.abs(block.centerY - labelBlock.centerY) <= yTolerance;
        const isRightSide = block.rect.left >= labelBlock.rect.left - 0.02 && block.rect.left <= labelBlock.rect.left + 0.62;
        return isSameLine && isRightSide;
      })
      .sort((a, b) => a.rect.left - b.rect.left);

    const joinedNoSpace = sameLineBlocks.map(block => block.text).join('');
    const joinedWithSpace = sameLineBlocks.map(block => block.text).join(' ');
    const candidates = [
      ...extractMoneyMatches(joinedNoSpace),
      ...extractMoneyMatches(joinedWithSpace),
      ...sameLineBlocks.flatMap(block => extractMoneyMatches(block.text)),
    ];

    for (const raw of candidates) {
      const value = parseMoneyExact(raw);
      if (value === null) continue;
      return {
        value,
        confidence: /[￥¥]/.test(joinedNoSpace) || /[￥¥]/.test(joinedWithSpace) ? 0.98 : 0.9,
        evidence: joinEvidence(labelBlock, sameLineBlocks),
      };
    }
  }
  return { confidence: 0 };
};

const cleanPartyName = (value: string): string => String(value || '')
  .replace(/^名称\s*[:：]?\s*/i, '')
  .replace(/[;；,，]+$/, '')
  .trim();

const isLikelyInvalidPartyName = (value: string): boolean => {
  const s = cleanPartyName(value);
  if (!s) return true;
  if (/^(开户行|开户银行|地址|地址电话|电话|账号|纳税人识别号|税号|统一社会信用代码)/i.test(s)) return true;
  if (/^[0-9A-Z]{12,}$/.test(s.replace(/\s+/g, ''))) return true;
  return false;
};

const extractPartyNameFromSection = (
  blocks: PositionedBlock[],
  labelNames: string[],
): LayoutFieldCandidate<string> => {
  const labelBlock = findLabelBlock(blocks, labelNames);
  if (!labelBlock) return { confidence: 0 };
  const neighbors = findNeighborBlocks(blocks, labelBlock, {
    xMin: -0.01,
    xMax: 0.36,
    yMin: 0,
    yMax: 0.18,
  });

  const candidateBlocks = neighbors.filter(block => {
    const text = cleanPartyName(block.text);
    if (!text || isLikelyInvalidPartyName(text)) return false;
    if (/^(名称|纳税人识别号|税号|地址|开户行|账号)/.test(text)) return false;
    return /[\u4e00-\u9fa5A-Za-z（）()]/.test(text);
  }).sort((a, b) => a.rect.top - b.rect.top || a.rect.left - b.rect.left);

  if (!candidateBlocks.length) return { confidence: 0 };
  const picked = candidateBlocks[0];
  return {
    value: cleanPartyName(picked.text),
    confidence: 0.92,
    evidence: joinEvidence(labelBlock, [picked]),
  };
};

const extractPartyTaxNoFromSection = (
  blocks: PositionedBlock[],
  labelNames: string[],
): LayoutFieldCandidate<string> => {
  const labelBlock = findLabelBlock(blocks, labelNames);
  if (!labelBlock) return { confidence: 0 };
  const neighbors = findNeighborBlocks(blocks, labelBlock, {
    xMin: -0.01,
    xMax: 0.45,
    yMin: 0,
    yMax: 0.22,
  });
  for (const block of neighbors) {
    const digits = String(block.text || '').toUpperCase().replace(/[^0-9A-Z]/g, '');
    if (digits.length >= 15 && digits.length <= 20) {
      return {
        value: digits,
        confidence: digits.length === 18 ? 0.94 : 0.82,
        evidence: joinEvidence(labelBlock, [block]),
      };
    }
  }
  return { confidence: 0 };
};

const buildLayoutParseResult = (blocks: PositionedBlock[], layoutMarkdown: string): InvoiceParseResult => {
  const errors: InvoiceParseError[] = [];
  const fields = buildEmptyFields();
  const defaultStrategy = getDefaultStrategy();

  fields.invoiceType = makeField({
    value: defaultStrategy.displayName,
    confidence: 0.9,
    evidence: defaultStrategy.displayName,
  });

  fields.invoiceNo = makeField(extractDigitsFromBlocks(blocks, ['发票号码', '号码'], 8, 20));
  fields.invoiceCode = makeField(extractDigitsFromBlocks(blocks, ['发票代码', '代码'], 10, 12));
  fields.issueDate = makeField(extractDateFromBlocks(blocks));
  fields.totalAmount = makeField(extractMoneyFromBlocks(blocks, ['价税合计小写', '价税合计(小写)', '价税合计', '小写']));
  fields.buyerName = makeField(extractPartyNameFromSection(blocks, ['购买方信息', '购买方', '购方', '买方']));
  fields.sellerName = makeField(extractPartyNameFromSection(blocks, ['销售方信息', '销售方', '销方', '卖方']));
  fields.buyerTaxNo = makeField(extractPartyTaxNoFromSection(blocks, ['购买方信息', '购买方', '购方', '买方']));
  fields.sellerTaxNo = makeField(extractPartyTaxNoFromSection(blocks, ['销售方信息', '销售方', '销方', '卖方']));

  const weightedScore =
    (fields.invoiceNo.confidence * 0.22) +
    (fields.invoiceCode.confidence * 0.14) +
    (fields.issueDate.confidence * 0.14) +
    (fields.totalAmount.confidence * 0.2) +
    (fields.buyerName.confidence * 0.1) +
    (fields.sellerName.confidence * 0.1) +
    (fields.buyerTaxNo.confidence * 0.05) +
    (fields.sellerTaxNo.confidence * 0.05);

  const confidence = clamp01(weightedScore);
  const isInvoice =
    confidence >= 0.45 &&
    (fields.invoiceNo.confidence >= 0.7 || fields.invoiceCode.confidence >= 0.7) &&
    fields.totalAmount.confidence >= 0.6;

  if (isInvoice) {
    if (!fields.invoiceNo.value) errors.push({ code: 'MISSING_FIELD', message: '缺少关键字段: invoiceNo', field: 'invoiceNo' });
    if (!fields.issueDate.value) errors.push({ code: 'MISSING_FIELD', message: '缺少关键字段: issueDate', field: 'issueDate' });
    if (typeof fields.totalAmount.value !== 'number') errors.push({ code: 'MISSING_FIELD', message: '缺少关键字段: totalAmount', field: 'totalAmount' });
  }

  const data: InvoiceParsedData = {
    invoiceType: fields.invoiceType.value,
    invoiceCode: fields.invoiceCode.value,
    invoiceNo: fields.invoiceNo.value,
    issueDate: fields.issueDate.value,
    buyerName: fields.buyerName.value,
    sellerName: fields.sellerName.value,
    buyerTaxNo: fields.buyerTaxNo.value,
    sellerTaxNo: fields.sellerTaxNo.value,
    totalAmount: fields.totalAmount.value,
  };

  return {
    isInvoice,
    confidence,
    data,
    fields,
    errors,
  };
};

export const buildLayoutAwareMarkdownFromOcrPages = (pages: OcrPageBlocks[]): string => {
  return buildLayoutAwareMarkdownFromBlocks(toPositionedBlocks(pages));
};

export const parseInvoiceFromFileWithLayoutFallback = async (
  filePath: string,
  markdown: string,
): Promise<{
  parseResult: InvoiceParseResult;
  parseEngine: string;
  rawText: string;
}> => {
  const primary = parseInvoiceFromMarkdown(markdown);
  const ext = path.extname(String(filePath || '')).toLowerCase();
  if (!SUPPORTED_LAYOUT_EXTS.has(ext)) {
    return {
      parseResult: primary,
      parseEngine: 'invoice-markdown-parser-v1',
      rawText: markdown,
    };
  }

  try {
    const pdfOcrService = PdfOcrService.getInstance();

    const textLayerPages = await pdfOcrService.extractTextBlocksFromPdf(filePath);
    const textLayerResult = parseFromPositionedBlocks(
      toPositionedBlocks(textLayerPages),
      'invoice-pdf-text-layer-label-parser-v1',
    );
    if (hasStrongLayoutHit(textLayerResult?.parseResult)) {
      return textLayerResult as { parseResult: InvoiceParseResult; parseEngine: string; rawText: string };
    }

    const ocrPages = await pdfOcrService.getOcrBlocksForPdf(filePath, [1]);
    const ocrResult = parseFromPositionedBlocks(
      toPositionedBlocks(ocrPages),
      'invoice-ocr-label-parser-v1',
    );

    const alternatives = [textLayerResult, ocrResult].filter(Boolean) as Array<{
      parseResult: InvoiceParseResult;
      parseEngine: string;
      rawText: string;
    }>;
    const strongAlternative = alternatives.find(item => hasStrongLayoutHit(item.parseResult));
    if (strongAlternative) {
      return strongAlternative;
    }

    let bestResult = primary;
    let bestEngine = 'invoice-markdown-parser-v1';
    let bestRawText = markdown;
    for (const alternative of alternatives) {
      const selected = chooseBetterInvoiceParseResult(bestResult, alternative.parseResult);
      if (selected === alternative.parseResult) {
        bestResult = alternative.parseResult;
        bestEngine = alternative.parseEngine;
        bestRawText = alternative.rawText;
      }
    }
    return {
      parseResult: bestResult,
      parseEngine: bestEngine,
      rawText: bestRawText,
    };
  } catch {
    return {
      parseResult: primary,
      parseEngine: 'invoice-markdown-parser-v1',
      rawText: markdown,
    };
  }
};
