import type {
  InvoiceFieldResult,
  InvoiceParseError,
  InvoiceParseResult,
  InvoiceParsedFields,
  InvoiceParsedData,
  InvoiceFieldKey,
  InvoiceItem,
} from '../../../shared/types/invoice.types';

export type InvoiceTypeCode =
  | 'special_vat'
  | 'normal_vat'
  | 'electronic'
  | 'electronic_normal'
  | 'toll'
  | 'motor_vehicle'
  | 'used_car'
  | 'fixed_amount'
  | 'receipt'
  | 'train_ticket'
  | 'air_ticket'
  | 'unknown';

export interface InvoiceTypeStrategy {
  code: InvoiceTypeCode;
  displayName: string;
  keywords: string[];
  minConfidence: number;
  requiredFields: InvoiceFieldKey[];
  fieldPatterns: {
    invoiceCode?: RegExp[];
    invoiceNo?: RegExp[];
    issueDate?: RegExp[];
    checkCode?: RegExp[];
    machineNo?: RegExp[];
    buyerName?: RegExp[];
    sellerName?: RegExp[];
    totalAmount?: RegExp[];
    amountWithoutTax?: RegExp[];
    taxAmount?: RegExp[];
  };
  invoiceNoLength?: number[];
}

export const INVOICE_TYPE_REGISTRY: InvoiceTypeStrategy[] = [
  {
    code: 'special_vat',
    displayName: '增值税专用发票',
    keywords: ['增值税专用发票', '专用发票'],
    minConfidence: 0.55,
    requiredFields: ['invoiceNo', 'issueDate', 'buyerName', 'sellerName', 'totalAmount'],
    fieldPatterns: {
      invoiceNo: [
        /([0-9]{20})\s*\n\s*发票号码/i,
        /发票号码\s*[:：]?\s*([0-9][0-9\s]{7})/i,
        /号码\s*[:：]?\s*([0-9][0-9\s]{7})/i,
      ],
      invoiceCode: [
        /发票代码\s*[:：]?\s*([0-9][0-9\s]{9,11})/i,
        /代码\s*[:：]?\s*([0-9][0-9\s]{9,11})/i,
      ],
    },
    invoiceNoLength: [8, 20],
  },
  {
    code: 'normal_vat',
    displayName: '增值税普通发票',
    keywords: ['增值税普通发票', '普通发票'],
    minConfidence: 0.50,
    requiredFields: ['invoiceNo', 'issueDate', 'totalAmount'],
    fieldPatterns: {
      invoiceNo: [
        /发票号码\s*[:：]?\s*([0-9][0-9\s]{7})/i,
        /号码\s*[:：]?\s*([0-9][0-9\s]{7})/i,
      ],
      invoiceCode: [
        /发票代码\s*[:：]?\s*([0-9][0-9\s]{9,11})/i,
        /代码\s*[:：]?\s*([0-9][0-9\s]{9,11})/i,
      ],
    },
    invoiceNoLength: [8],
  },
  {
    code: 'electronic',
    displayName: '电子发票',
    keywords: ['电子发票（增值税专用发票）', '电子发票'],
    minConfidence: 0.45,
    requiredFields: ['invoiceNo', 'issueDate', 'totalAmount'],
    fieldPatterns: {
      invoiceNo: [
        /([0-9]{20})\s*发票号码/i,
        /发票号码\s*[:：]?\s*([0-9]{20})/i,
        /号码\s*[:：]?\s*([0-9]{20})/i,
      ],
    },
    invoiceNoLength: [20],
  },
  {
    code: 'electronic_normal',
    displayName: '电子普通发票',
    keywords: ['电子发票（普通发票）', '电子发票(普通发票)', '电子普通发票', '通行费电子普通发票'],
    minConfidence: 0.45,
    requiredFields: ['invoiceNo', 'issueDate', 'totalAmount'],
    fieldPatterns: {
      invoiceNo: [
        /([0-9]{20})\s*发票号码/i,
        /发票号码\s*[:：]?\s*([0-9]{20})/i,
        /号码\s*[:：]?\s*([0-9]{20})/i,
      ],
    },
    invoiceNoLength: [20],
  },
  {
    code: 'toll',
    displayName: '通行费电子普通发票',
    keywords: ['通行费电子普通发票', '通行费发票'],
    minConfidence: 0.45,
    requiredFields: ['invoiceNo', 'issueDate', 'totalAmount'],
    fieldPatterns: {
      invoiceNo: [
        /([0-9]{20})\s*发票号码/i,
        /发票号码\s*[:：]?\s*([0-9][0-9\s]{19})/i,
      ],
    },
    invoiceNoLength: [20],
  },
  {
    code: 'motor_vehicle',
    displayName: '机动车销售统一发票',
    keywords: ['机动车销售统一发票', '机动车发票'],
    minConfidence: 0.55,
    requiredFields: ['invoiceNo', 'issueDate', 'buyerName', 'sellerName', 'totalAmount', 'machineNo'],
    fieldPatterns: {
      invoiceNo: [
        /发票号码\s*[:：]?\s*([0-9][0-9\s]{7})/i,
        /号码\s*[:：]?\s*([0-9][0-9\s]{7})/i,
      ],
      machineNo: [
        /机器编号\s*[:：]?\s*([0-9]{10,12})/i,
        /机器号\s*[:：]?\s*([0-9]{10,12})/i,
      ],
    },
    invoiceNoLength: [8],
  },
  {
    code: 'used_car',
    displayName: '二手车销售统一发票',
    keywords: ['二手车销售统一发票', '二手车发票'],
    minConfidence: 0.50,
    requiredFields: ['invoiceNo', 'issueDate', 'buyerName', 'sellerName', 'totalAmount'],
    fieldPatterns: {
      invoiceNo: [
        /发票号码\s*[:：]?\s*([0-9][0-9\s]{7})/i,
        /号码\s*[:：]?\s*([0-9][0-9\s]{7})/i,
      ],
    },
    invoiceNoLength: [8],
  },
  {
    code: 'fixed_amount',
    displayName: '定额发票',
    keywords: ['定额发票'],
    minConfidence: 0.35,
    requiredFields: ['invoiceNo', 'totalAmount'],
    fieldPatterns: {
      invoiceNo: [
        /发票号码\s*[:：]?\s*([0-9]+)/i,
        /号码\s*[:：]?\s*([0-9]+)/i,
      ],
    },
  },
];

export const detectInvoiceType = (text: string): InvoiceTypeCode => {
  let bestMatch: { code: InvoiceTypeCode; keywordLength: number } | null = null;

  for (const strategy of INVOICE_TYPE_REGISTRY) {
    for (const keyword of strategy.keywords) {
      if (text.includes(keyword)) {
        if (!bestMatch || keyword.length > bestMatch.keywordLength) {
          bestMatch = { code: strategy.code, keywordLength: keyword.length };
        }
      }
    }
  }

  return bestMatch?.code || 'unknown';
};

export const getStrategyByType = (code: InvoiceTypeCode): InvoiceTypeStrategy | undefined => {
  return INVOICE_TYPE_REGISTRY.find(s => s.code === code);
};

export const getDefaultStrategy = (): InvoiceTypeStrategy => ({
  code: 'unknown',
  displayName: '发票',
  keywords: [],
  minConfidence: 0.45,
  requiredFields: ['invoiceNo', 'totalAmount'],
  fieldPatterns: {
    invoiceNo: [
      /发票号码\s*[:：]?\s*([0-9][0-9\s]{7,23})/i,
      /号码\s*[:：]?\s*([0-9][0-9\s]{7,23})/i,
      /([0-9]{8,20})\s*发票号码/i,
    ],
  },
  invoiceNoLength: [8, 20],
});

export interface InvoiceDetectResult {
  isInvoice: boolean;
  confidence: number;
  signals: string[];
  invoiceType?: InvoiceTypeCode;
  strategy?: InvoiceTypeStrategy;
}

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

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

const normalizeMarkdownToText = (markdown: string): { text: string; lines: string[] } => {
  const source = toHalfWidth(String(markdown ?? ''))
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\u00A0/g, ' ');

  const withoutCodeFences = source.replace(/```[\s\S]*?```/g, '\n');
  const withoutImages = withoutCodeFences.replace(/!\[[^\]]*?\]\([^\)]*?\)/g, ' ');
  const withoutLinks = withoutImages.replace(/\[([^\]]+?)\]\([^\)]*?\)/g, '$1');

  const cleaned = withoutLinks
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^>\s*/gm, '')
    .replace(/^[\-\*\+]\s+/gm, '')
    .replace(/^\d+\.\s+/gm, '')
    .replace(/[|]/g, ' ')
    .replace(/[：]/g, ':')
    .replace(/[（）]/g, match => (match === '（' ? '(' : ')'))
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'");

  const lines = cleaned
    .split('\n')
    .map(line => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean);

  return { text: lines.join('\n').trim(), lines };
};

const takeEvidence = (text: string, maxLen = 160): string => {
  const s = String(text || '').trim().replace(/\s+/g, ' ');
  if (s.length <= maxLen) return s;
  return `${s.slice(0, maxLen)}…`;
};

const makeField = <T>(value?: T, confidence = 0, evidence?: string): InvoiceFieldResult<T> => ({
  value,
  confidence: clamp01(confidence),
  evidence: evidence ? takeEvidence(evidence) : undefined,
});

const extractFirstMatch = (text: string, patterns: RegExp[], group = 1): { raw: string; evidence: string } | null => {
  for (const pattern of patterns) {
    const match = pattern.exec(text);
    if (match && match[group]) {
      return { raw: String(match[group]), evidence: match[0] };
    }
  }
  return null;
};

const normalizeDigits = (input: string): string => String(input ?? '').replace(/\D+/g, '');

const parseMoney = (raw: string): number | null => {
  const normalized = String(raw ?? '').replace(/[，,]/g, '').replace(/[^\d.\-]/g, '');
  if (!normalized) return null;
  const value = Number(normalized);
  if (Number.isFinite(value)) return value;
  return null;
};

const extractMaxCurrencyMoney = (text: string): number | null => {
  const matches = [
    ...String(text || '').matchAll(/[￥¥]\s*([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{1,2})?|[0-9]+(?:\.[0-9]{1,2})?)/g),
  ];
  if (!matches.length) return null;
  let max: number | null = null;
  for (const m of matches) {
    const value = parseMoney(m[1]);
    if (value === null) continue;
    if (max === null || value > max) max = value;
  }
  return max;
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

  const m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(normalized);
  if (!m) return { confidence: 0 };

  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);

  if (year < 1990 || year > 2100) return { confidence: 0.2 };
  if (month < 1 || month > 12) return { confidence: 0.2 };
  if (day < 1 || day > 31) return { confidence: 0.2 };

  const iso = `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  return { iso, confidence: 0.95 };
};

const stripTrailingLabels = (value: string): string => {
  const s = String(value ?? '').trim();
  if (!s) return s;
  return s
    .replace(/(纳税人识别号|税号|地址电话|开户行及账号|开户行|账号|电话)\s*[:：]?.*$/g, '')
    .trim();
};

const cleanPartyName = (value: string): string => String(value || '')
  .replace(/^名称\s*[:：]?\s*/i, '')
  .replace(/[;；,，]+$/, '')
  .trim();

const trimCompanyNameTail = (value: string): string => {
  const s = cleanPartyName(value);
  const match = /^(.+?(?:有限责任公司|股份有限公司|有限公司|集团有限公司|集团|公司|企业))(?:\s+.*)?$/.exec(s);
  return match?.[1] ? match[1].trim() : s;
};

const isLikelyInvalidPartyName = (value: string): boolean => {
  const s = cleanPartyName(value);
  if (!s) return true;
  if (/^(开户行|开户银行|地址|地址电话|电话|账号|纳税人识别号|税号)/i.test(s)) return true;
  if (/^[0-9A-Z]{12,}$/.test(s.replace(/\s+/g, ''))) return true;
  return false;
};

const isLikelySectionTitle = (value: string): boolean => (
  /^(购买方信息|购买方|购方|买方|销售方信息|销售方|销方|卖方|备注信息|备注|开票人信息|开票人|项目名称|货物或应税劳务、服务名称|价税合计|合计金额|合计税额|发票代码|发票号码|开票日期)\s*[:：]?$/.test(String(value || '').trim())
);

const extractPartyName = (lines: string[], partyPatterns: RegExp[]): { value?: string; evidence?: string; confidence: number } => {
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const match = extractFirstMatch(line, partyPatterns, 1);
    if (match) {
      const value = cleanPartyName(stripTrailingLabels(match.raw));
      if (/^(信息|信息栏)$/i.test(value)) {
        continue;
      }
      if (value && !isLikelyInvalidPartyName(value)) {
        const confidence = value.length >= 2 ? 0.85 : 0.6;
        return { value, evidence: match.evidence, confidence };
      }
    }
    if (partyPatterns.some(re => re.test(line))) {
      for (let j = i + 1; j <= Math.min(lines.length - 1, i + 3); j += 1) {
        const candidate = String(lines[j] || '').trim();
        if (!candidate || /(纳税人识别号|税号|统一社会信用代码|地址|开户行|账号|电话)/i.test(candidate)) continue;
        if (isLikelySectionTitle(candidate)) break;
        const value = cleanPartyName(stripTrailingLabels(candidate));
        if (!value || isLikelyInvalidPartyName(value)) continue;
        return { value, evidence: `${line} ${candidate}`, confidence: 0.72 };
      }
    }
  }
  return { confidence: 0 };
};

const extractPartyNameFromNameLabel = (lines: string[], isBuyer: boolean): { value?: string; evidence?: string; confidence: number } => {
  const namePattern = isBuyer
    ? /^(?:购|买|购买)(?:方|销)?\s*名称\s*[:：]\s*(.+)$/i
    : /^(?:销|售|销售)(?:方|买)?\s*名称\s*[:：]\s*(.+)$/i;
  const altPattern = /名称\s*[:：]\s*(.+)$/i;

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const match = namePattern.exec(line);
    if (match?.[1]) {
      const value = cleanPartyName(stripTrailingLabels(match[1]));
      if (value && !isLikelyInvalidPartyName(value)) {
        return { value, evidence: line, confidence: 0.9 };
      }
    }
  }

  let foundFirstName = false;
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (/名称\s*[:：]/.test(line)) {
      const match = altPattern.exec(line);
      if (match?.[1]) {
        const rawValue = stripTrailingLabels(match[1]).trim();
        // Skip if the value is empty or only contains the word "名称" again
        if (!rawValue || /^名称\s*[:：]?$/.test(rawValue)) {
          foundFirstName = true;
          continue;
        }
        const value = cleanPartyName(rawValue);
        if (value && !isLikelyInvalidPartyName(value)) {
          if (isBuyer && !foundFirstName) {
            return { value, evidence: line, confidence: 0.88 };
          }
          if (!isBuyer && foundFirstName) {
            return { value, evidence: line, confidence: 0.88 };
          }
          foundFirstName = true;
        }
      }
    }
  }

  return { confidence: 0 };
};

const extractTaxNoNearParty = (
  lines: string[],
  partyKeywords: RegExp[],
): { value?: string; evidence?: string; confidence: number } => {
  const taxNoPattern = /(?:统一社会信用代码(?:\/纳税人识别号)?|纳税人识别号|税号)\s*[:：]?\s*([0-9A-Z][0-9A-Z\s]{14,23})/i;
  const compactTaxNo = (input: string) => String(input || '').toUpperCase().replace(/[^0-9A-Z]/g, '');

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const isPartyLine = partyKeywords.some(re => re.test(line));
    if (!isPartyLine) continue;

    for (let j = i; j <= Math.min(lines.length - 1, i + 2); j += 1) {
      const candidate = lines[j];
      const match = taxNoPattern.exec(candidate);
      if (!match) continue;
      const value = compactTaxNo(match[1]);
      if (value.length < 15 || value.length > 20) continue;
      const confidence = value.length >= 18 ? 0.9 : 0.8;
      return { value, evidence: candidate, confidence };
    }

    for (let j = i; j <= Math.min(lines.length - 1, i + 2); j += 1) {
      const candidate = lines[j];
      const alnumMatches = [...String(candidate || '').toUpperCase().matchAll(/\b([0-9A-Z]{15,20})\b/g)];
      if (!alnumMatches.length) continue;
      const value = compactTaxNo(alnumMatches[0][1]);
      if (value.length < 15 || value.length > 20) continue;
      return { value, evidence: candidate, confidence: 0.72 };
    }
  }

  const fallback = /([0-9A-Z]{18})/g;
  const matches = [...lines.join('\n').matchAll(fallback)];
  if (matches.length === 1) {
    return { value: matches[0][1].toUpperCase(), evidence: matches[0][0], confidence: 0.5 };
  }
  return { confidence: 0 };
};

const isLikelyBankAccount = (value: number, context: string): boolean => {
  // Bank accounts are typically large numbers (10+ digits)
  // and appear in contexts with bank-related keywords
  if (value < 1000000000) return false; // Less than 10 digits
  const bankKeywords = /银行|账号|开户|Bank|Account/i;
  return bankKeywords.test(context);
};

const extractMoneyNearLabel = (
  lines: string[],
  labelPatterns: RegExp[],
  lookaheadLines = 1,
): { value?: number; evidence?: string; confidence: number } => {
  const moneyWithCurrency = /[￥¥]\s*([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{1,2})?|[0-9]+(?:\.[0-9]{1,2})?)/g;
  const moneyPlain = /([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{1,2})?|[0-9]+(?:\.[0-9]{1,2})?)/g;

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const isLabel = labelPatterns.some(re => re.test(line));
    if (!isLabel) continue;

    const lineCurrencyMatches = [...line.matchAll(moneyWithCurrency)];
    if (lineCurrencyMatches.length > 0) {
      const current = lineCurrencyMatches[lineCurrencyMatches.length - 1];
      const value = parseMoney(current[1]);
      if (value !== null && !isLikelyBankAccount(value, line)) {
        return { value, evidence: line, confidence: 0.92 };
      }
    }

    const linePlainMatches = [...line.matchAll(moneyPlain)];
    if (linePlainMatches.length > 0) {
      const current = linePlainMatches[linePlainMatches.length - 1];
      const value = parseMoney(current[1]);
      if (value !== null && !isLikelyBankAccount(value, line)) {
        return { value, evidence: line, confidence: 0.75 };
      }
    }

    for (let j = i + 1; j <= Math.min(lines.length - 1, i + lookaheadLines); j += 1) {
      const nextLine = lines[j];
      // Skip lines that contain bank account information
      if (/银行账号|开户银行|Bank\s*Account/i.test(nextLine)) {
        continue;
      }
      const nextCurrencyMatches = [...nextLine.matchAll(moneyWithCurrency)];
      if (nextCurrencyMatches.length > 0) {
        const current = nextCurrencyMatches[0];
        const value = parseMoney(current[1]);
        if (value !== null && !isLikelyBankAccount(value, nextLine)) {
          return { value, evidence: `${line} ${nextLine}`, confidence: 0.82 };
        }
      }
      const nextPlainMatches = [...nextLine.matchAll(moneyPlain)];
      if (nextPlainMatches.length > 0) {
        const current = nextPlainMatches[0];
        const value = parseMoney(current[1]);
        if (value !== null && !isLikelyBankAccount(value, nextLine)) {
          return { value, evidence: `${line} ${nextLine}`, confidence: 0.65 };
        }
      }
    }
  }

  return { confidence: 0 };
};

const extractAmountAndTaxFromTotalLine = (
  lines: string[],
): { amount?: number; tax?: number; evidence?: string; confidence: number } => {
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (!/合\s*计/.test(line)) continue;

    const moneyPattern = /[￥¥]?\s*([0-9]+(?:\.[0-9]{1,2})?)/g;
    const matches = [...line.matchAll(moneyPattern)];

    if (matches.length >= 2) {
      const amount = parseMoney(matches[0][1]);
      const tax = parseMoney(matches[1][1]);
      if (amount !== null && tax !== null) {
        return { amount, tax, evidence: line, confidence: 0.9 };
      }
    }

    for (let j = i + 1; j <= Math.min(lines.length - 1, i + 2); j += 1) {
      const nextLine = lines[j];
      const nextMatches = [...nextLine.matchAll(moneyPattern)];
      if (nextMatches.length >= 2) {
        const amount = parseMoney(nextMatches[0][1]);
        const tax = parseMoney(nextMatches[1][1]);
        if (amount !== null && tax !== null) {
          return { amount, tax, evidence: `${line} ${nextLine}`, confidence: 0.88 };
        }
      }
    }
  }

  return { confidence: 0 };
};

const extractNamedPartyBlock = (
  lines: string[],
  titlePattern: RegExp,
): { name?: string; taxNo?: string; evidence?: string; confidence: number } => {
  for (let i = 0; i < lines.length; i += 1) {
    const titleLine = String(lines[i] || '').trim();
    if (!titlePattern.test(titleLine)) continue;
    let name = '';
    let taxNo = '';
    const evidenceLines: string[] = [titleLine];
    for (let j = i + 1; j <= Math.min(lines.length - 1, i + 6); j += 1) {
      const line = String(lines[j] || '').trim();
      if (!line) continue;
      if (isLikelySectionTitle(line) && !/^名称\s*[:：]?/i.test(line)) break;
      evidenceLines.push(line);
      if (!name) {
        const nameMatch = /^(?:名称)\s*[:：]?\s*(.+)$/i.exec(line);
        if (nameMatch?.[1]) {
          const cleaned = cleanPartyName(stripTrailingLabels(nameMatch[1]));
          if (!isLikelyInvalidPartyName(cleaned)) {
            name = cleaned;
          }
          continue;
        }
      }
      if (!taxNo) {
        const taxMatch = /(?:统一社会信用代码(?:\/纳税人识别号)?|纳税人识别号|税号)\s*[:：]?\s*([0-9A-Z][0-9A-Z\s]{14,23})/i.exec(line);
        if (taxMatch?.[1]) {
          taxNo = String(taxMatch[1]).toUpperCase().replace(/[^0-9A-Z]/g, '');
          continue;
        }
      }
    }
    if (name || taxNo) {
      return {
        name: name || undefined,
        taxNo: taxNo || undefined,
        evidence: evidenceLines.join(' '),
        confidence: name && taxNo ? 0.95 : 0.82,
      };
    }
  }
  return { confidence: 0 };
};

const extractParallelPartyFields = (
  lines: string[],
): {
  buyerName?: string;
  sellerName?: string;
  buyerTaxNo?: string;
  sellerTaxNo?: string;
  evidence?: string;
  confidence: number;
} => {
  let buyerName = '';
  let sellerName = '';
  let buyerTaxNo = '';
  let sellerTaxNo = '';
  let evidence = '';

  for (const line of lines) {
    if ((!buyerName || !sellerName) && /名称/.test(line)) {
      const namePair = /名称\s*[:：]?\s*([^:：;；]+?)\s+(?:名称)\s*[:：]?\s*([^:：;；]+)$/.exec(line);
      if (namePair) {
        const left = cleanPartyName(namePair[1]);
        const right = cleanPartyName(namePair[2]);
        if (!isLikelyInvalidPartyName(left) && !isLikelyInvalidPartyName(right)) {
          buyerName = left;
          sellerName = right;
          evidence = evidence ? `${evidence} | ${line}` : line;
        }
      }
    }
    if ((!buyerTaxNo || !sellerTaxNo) && /(统一社会信用代码|纳税人识别号|税号)/.test(line)) {
      const compact = String(line || '').toUpperCase().replace(/\s+/g, '');
      const taxPair = /(?:统一社会信用代码(?:\/纳税人识别号)?|纳税人识别号|税号)[:：]?([0-9A-Z]{15,20}).*?(?:统一社会信用代码(?:\/纳税人识别号)?|纳税人识别号|税号)[:：]?([0-9A-Z]{15,20})/.exec(compact);
      if (taxPair) {
        buyerTaxNo = taxPair[1];
        sellerTaxNo = taxPair[2];
        evidence = evidence ? `${evidence} | ${line}` : line;
      }
    }
    if (buyerName && sellerName && buyerTaxNo && sellerTaxNo) break;
  }

  if (!buyerName && !sellerName && !buyerTaxNo && !sellerTaxNo) {
    return { confidence: 0 };
  }
  const complete = buyerName && sellerName && buyerTaxNo && sellerTaxNo;
  return {
    buyerName: buyerName || undefined,
    sellerName: sellerName || undefined,
    buyerTaxNo: buyerTaxNo || undefined,
    sellerTaxNo: sellerTaxNo || undefined,
    evidence: evidence || undefined,
    confidence: complete ? 0.93 : 0.78,
  };
};

const extractPartyFieldsFromCompactFormat = (
  lines: string[],
): {
  buyerName?: string;
  sellerName?: string;
  buyerTaxNo?: string;
  sellerTaxNo?: string;
  evidence?: string;
  confidence: number;
} => {
  let buyerName = '';
  let sellerName = '';
  let buyerTaxNo = '';
  let sellerTaxNo = '';
  let evidence = '';

  const compactTaxNo = (input: string) => String(input || '').toUpperCase().replace(/[^0-9A-Z]/g, '');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    const buyerInlineMatch = /购(?:买)?(?:方)?\s*名称\s*[:：]?\s*([\u4e00-\u9fa5A-Za-z0-9（）()·\s]+?)(?=\s+销(?:售)?(?:方)?\s*名称|$)/.exec(line);
    const sellerInlineMatch = /销(?:售)?(?:方)?\s*名称\s*[:：]?\s*([\u4e00-\u9fa5A-Za-z0-9（）()·\s]+?)(?=\s+(?:统一社会信用代码|纳税人识别号|税号)|$)/.exec(line);
    if (buyerInlineMatch?.[1] && !buyerName) {
      const value = trimCompanyNameTail(buyerInlineMatch[1]);
      if (!isLikelyInvalidPartyName(value)) {
        buyerName = value;
        evidence = evidence ? `${evidence} | ${line}` : line;
      }
    }
    if (sellerInlineMatch?.[1] && !sellerName) {
      const value = trimCompanyNameTail(sellerInlineMatch[1]);
      if (!isLikelyInvalidPartyName(value)) {
        sellerName = value;
        evidence = evidence ? `${evidence} | ${line}` : line;
      }
    }

    const companyMatch = line.match(/([\u4e00-\u9fa5]+(?:科技|信息|技术|有限|公司|集团|企业)[\u4e00-\u9fa5]*)\s+([\u4e00-\u9fa5]+(?:科技|信息|技术|有限|公司|集团|企业)[\u4e00-\u9fa5]*)/);
    if (companyMatch && !buyerName && !sellerName) {
      const left = cleanPartyName(companyMatch[1]);
      const right = cleanPartyName(companyMatch[2]);
      if (!isLikelyInvalidPartyName(left) && !isLikelyInvalidPartyName(right)) {
        buyerName = left;
        sellerName = right;
        evidence = line;
      }
    }

    const compactLine = line.toUpperCase().replace(/\s+/g, '');
    const taxNoMatches = [...compactLine.matchAll(/(?:统一社会信用代码(?:\/纳税人识别号)?|纳税人识别号|税号)[:：]?([0-9A-Z]{15,20})/g)];
    if (taxNoMatches.length >= 2 && !buyerTaxNo && !sellerTaxNo) {
      const first = compactTaxNo(taxNoMatches[0][1]);
      const second = compactTaxNo(taxNoMatches[1][1]);
      if (first.length === 18 && second.length === 18) {
        buyerTaxNo = first;
        sellerTaxNo = second;
        evidence = evidence ? `${evidence} | ${line}` : line;
      }
    }

    if (buyerName && sellerName && buyerTaxNo && sellerTaxNo) break;
  }

  if (!buyerName && !sellerName && !buyerTaxNo && !sellerTaxNo) {
    return { confidence: 0 };
  }
  const complete = buyerName && sellerName && buyerTaxNo && sellerTaxNo;
  const hasBothNames = buyerName && sellerName;
  return {
    buyerName: buyerName || undefined,
    sellerName: sellerName || undefined,
    buyerTaxNo: buyerTaxNo || undefined,
    sellerTaxNo: sellerTaxNo || undefined,
    evidence: evidence || undefined,
    confidence: complete ? 0.95 : hasBothNames ? 0.9 : 0.75,
  };
};

const extractTextNearLabel = (
  lines: string[],
  labelPatterns: RegExp[],
  options?: {
    lookaheadLines?: number;
    stopPatterns?: RegExp[];
  },
): { value?: string; evidence?: string; confidence: number } => {
  const lookaheadLines = Math.max(1, Number(options?.lookaheadLines || 2));
  const stopPatterns = options?.stopPatterns || [];
  for (let i = 0; i < lines.length; i += 1) {
    const line = String(lines[i] || '').trim();
    if (!line) continue;
    const matchedLabel = labelPatterns.find(re => re.test(line));
    if (!matchedLabel) continue;
    const inline = line.replace(matchedLabel, '').replace(/^[\s:：-]+/, '').trim();
    if (inline) {
      return { value: inline, evidence: line, confidence: 0.88 };
    }
    const picked: string[] = [];
    for (let j = i + 1; j <= Math.min(lines.length - 1, i + lookaheadLines); j += 1) {
      const candidate = String(lines[j] || '').trim();
      if (!candidate) continue;
      if (stopPatterns.some(re => re.test(candidate))) break;
      if (isLikelySectionTitle(candidate)) break;
      picked.push(candidate);
    }
    if (picked.length) {
      return { value: picked.join(' '), evidence: [line, ...picked].join(' '), confidence: 0.72 };
    }
  }
  return { confidence: 0 };
};

const parsePipeRow = (line: string): string[] => {
  const raw = String(line || '').trim();
  if (!raw.includes('|')) return [];
  return raw
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map(s => String(s || '').trim());
};

const extractInvoiceItems = (markdown: string, lines: string[]): { value?: InvoiceItem[]; evidence?: string; confidence: number } => {
  const sourceLines = toHalfWidth(String(markdown || '')).replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  for (let i = 0; i < sourceLines.length; i += 1) {
    const headerCells = parsePipeRow(sourceLines[i]).map(s => s.replace(/\s+/g, ''));
    if (!headerCells.length) continue;
    const idxProject = headerCells.findIndex(cell => /(项目名称|货物或应税劳务、服务名称|服务名称|项目)/.test(cell));
    const idxUnitPrice = headerCells.findIndex(cell => /单价/.test(cell));
    const idxQuantity = headerCells.findIndex(cell => /数量/.test(cell));
    const idxAmount = headerCells.findIndex(cell => /金额/.test(cell) && !/价税合计|合计金额|税额/.test(cell));
    const idxTaxRate = headerCells.findIndex(cell => /(税率|征收率)/.test(cell));
    const idxTaxAmount = headerCells.findIndex(cell => /税额/.test(cell));
    if (idxProject < 0 || idxAmount < 0) continue;
    const items: InvoiceItem[] = [];
    for (let j = i + 1; j < sourceLines.length; j += 1) {
      const rowLine = String(sourceLines[j] || '').trim();
      if (!rowLine.includes('|')) break;
      if (/^[:\-\s|]+$/.test(rowLine)) continue;
      const cells = parsePipeRow(rowLine);
      if (!cells.length) continue;
      const projectName = String(cells[idxProject] || '').trim();
      if (!projectName || /(合计|价税合计|小写|大写)/.test(projectName)) continue;
      const unitPrice = idxUnitPrice >= 0 ? parseMoney(cells[idxUnitPrice]) : null;
      const quantity = idxQuantity >= 0 ? parseMoney(cells[idxQuantity]) : null;
      const amount = idxAmount >= 0 ? parseMoney(cells[idxAmount]) : null;
      const taxRate = idxTaxRate >= 0 ? String(cells[idxTaxRate] || '').trim() : '';
      const taxAmount = idxTaxAmount >= 0 ? parseMoney(cells[idxTaxAmount]) : null;
      if (!projectName && amount === null) continue;
      items.push({
        projectName: projectName || undefined,
        unitPrice: typeof unitPrice === 'number' ? unitPrice : undefined,
        quantity: typeof quantity === 'number' ? quantity : undefined,
        amount: typeof amount === 'number' ? amount : undefined,
        taxRate: taxRate || undefined,
        taxAmount: typeof taxAmount === 'number' ? taxAmount : undefined,
      });
    }
    if (items.length) {
      return { value: items, evidence: sourceLines[i], confidence: 0.9 };
    }
  }

  const fallbackItems: InvoiceItem[] = [];
  for (const line of lines) {
    if (!/(税率|征收率)/.test(line) || !/(金额|单价|数量)/.test(line)) continue;
    const m = /(.*?)([0-9]+(?:\.[0-9]+)?)\s+([0-9]+(?:\.[0-9]+)?)\s+([0-9]+(?:\.[0-9]+)?)\s+([0-9]+(?:\.[0-9]+)?%?)\s+([0-9]+(?:\.[0-9]+)?)/.exec(line);
    if (!m) continue;
    const projectName = String(m[1] || '').replace(/(项目名称|货物或应税劳务、服务名称|服务名称|项目)\s*[:：]?/g, '').trim();
    fallbackItems.push({
      projectName: projectName || undefined,
      unitPrice: parseMoney(m[2]) ?? undefined,
      quantity: parseMoney(m[3]) ?? undefined,
      amount: parseMoney(m[4]) ?? undefined,
      taxRate: String(m[5] || '').trim() || undefined,
      taxAmount: parseMoney(m[6]) ?? undefined,
    });
  }
  if (fallbackItems.length) {
    return { value: fallbackItems, evidence: 'line-fallback', confidence: 0.62 };
  }
  return { confidence: 0 };
};

export const detectInvoiceFromMarkdown = (markdown: string): InvoiceDetectResult => {
  const { text } = normalizeMarkdownToText(markdown);
  if (!text) return { isInvoice: false, confidence: 0, signals: ['empty'] };

  const invoiceType = detectInvoiceType(text);
  const strategy = getStrategyByType(invoiceType) || getDefaultStrategy();

  const signals: string[] = [];
  const hasInvoiceWord = /发票/.test(text);
  const hasCode = /发票代码/.test(text) || /代码\s*[:：]?\s*\d{10,12}/.test(text);
  const hasNo = /发票号码/.test(text) || /号码\s*[:：]?\s*\d{8}/.test(text);
  const hasCheck = /校验码/.test(text);
  const hasDate = /开票日期/.test(text) || /(\d{4}[年\-\/\.]\d{1,2}[月\-\/\.]\d{1,2}日?)/.test(text);
  const hasTotal = /价税合计/.test(text) || /合计金额/.test(text);
  const hasBuyerSeller = /(购买方|购方|销售方|销方)/.test(text);

  if (hasInvoiceWord) signals.push('发票');
  if (hasCode) signals.push('发票代码');
  if (hasNo) signals.push('发票号码');
  if (hasCheck) signals.push('校验码');
  if (hasDate) signals.push('开票日期');
  if (hasTotal) signals.push('金额字段');
  if (hasBuyerSeller) signals.push('购销双方');

  let score =
    (hasInvoiceWord ? 0.2 : 0) +
    (hasCode ? 0.25 : 0) +
    (hasNo ? 0.25 : 0) +
    (hasCheck ? 0.1 : 0) +
    (hasDate ? 0.1 : 0) +
    (hasTotal ? 0.07 : 0) +
    (hasBuyerSeller ? 0.03 : 0);

  if (invoiceType !== 'unknown') {
    score = Math.min(1, score + 0.1);
  }

  const confidence = clamp01(score);
  const isInvoice = (hasCode || hasNo) && confidence >= strategy.minConfidence;
  return { isInvoice, confidence, signals, invoiceType, strategy };
};

const buildEmptyFields = (): InvoiceParsedFields => ({
  invoiceType: makeField<string>(undefined, 0),
  invoiceCode: makeField<string>(undefined, 0),
  invoiceNo: makeField<string>(undefined, 0),
  issueDate: makeField<string>(undefined, 0),
  checkCode: makeField<string>(undefined, 0),
  machineNo: makeField<string>(undefined, 0),
  buyerName: makeField<string>(undefined, 0),
  buyerTaxNo: makeField<string>(undefined, 0),
  sellerName: makeField<string>(undefined, 0),
  sellerTaxNo: makeField<string>(undefined, 0),
  amountWithoutTax: makeField<number>(undefined, 0),
  taxAmount: makeField<number>(undefined, 0),
  totalAmount: makeField<number>(undefined, 0),
  invoiceItems: makeField<InvoiceItem[]>(undefined, 0),
  remark: makeField<string>(undefined, 0),
  issuerName: makeField<string>(undefined, 0),
});

const addMissingFieldError = (errors: InvoiceParseError[], field: InvoiceFieldKey, hint?: string) => {
  errors.push({
    code: 'MISSING_FIELD',
    message: `缺少关键字段: ${field}${hint ? `（${hint}）` : ''}`,
    field,
  });
};

export const parseInvoiceFromMarkdown = (markdown: string): InvoiceParseResult => {
  const errors: InvoiceParseError[] = [];
  const normalized = normalizeMarkdownToText(markdown);
  const { text, lines } = normalized;

  const fields = buildEmptyFields();

  if (!text) {
    errors.push({ code: 'EMPTY_INPUT', message: '输入为空，无法解析发票' });
    return {
      isInvoice: false,
      confidence: 0,
      data: {},
      fields,
      errors,
    };
  }

  const detect = detectInvoiceFromMarkdown(text);
  if (!detect.isInvoice && detect.confidence < 0.35) {
    errors.push({
      code: 'NOT_INVOICE',
      message: `文本特征不足，判定非发票（confidence=${detect.confidence.toFixed(2)}）`,
      evidence: takeEvidence(text),
    });
  }

  const strategy = detect.strategy || getDefaultStrategy();
  fields.invoiceType = makeField(strategy.displayName, 0.95, strategy.displayName);

  const codePatterns = strategy.fieldPatterns.invoiceCode || [
    /发票代码\s*[:：]?\s*([0-9][0-9\s]{9,17})/i,
    /代码\s*[:：]?\s*([0-9][0-9\s]{9,17})/i,
    /([0-9][0-9\s]{9,17})\s*发票代码/i,
  ];
  const codeMatch = extractFirstMatch(text, codePatterns);
  if (codeMatch) {
    const digits = normalizeDigits(codeMatch.raw);
    const confidence = digits.length === 12 ? 1 : digits.length === 10 ? 0.95 : 0.85;
    fields.invoiceCode = makeField(digits, confidence, codeMatch.evidence);
  }

  const noPatterns = strategy.fieldPatterns.invoiceNo || [
    /发票号码\s*[:：]?\s*([0-9][0-9\s]{7,23})/i,
    /号码\s*[:：]?\s*([0-9][0-9\s]{7,23})/i,
    /([0-9]{8,20})\s*发票号码/i,
  ];
  const noMatch = extractFirstMatch(text, noPatterns);
  if (noMatch) {
    const digits = normalizeDigits(noMatch.raw);
    const validLengths = strategy.invoiceNoLength || [8, 20];
    const isValidLength = validLengths.includes(digits.length);
    const confidence = isValidLength
      ? (digits.length === 8
        ? (/\s/.test(noMatch.raw) ? 0.85 : 1)
        : digits.length === 20
          ? (/\s/.test(noMatch.raw) ? 0.9 : 0.95)
          : 0.9)
      : 0.35;
    if (isValidLength) {
      fields.invoiceNo = makeField(digits, confidence, noMatch.evidence);
    } else if (digits) {
      fields.invoiceNo = makeField(digits, 0.35, noMatch.evidence);
      errors.push({
        code: 'INVALID_FIELD_FORMAT',
        message: `发票号码格式疑似异常: ${digits}`,
        field: 'invoiceNo',
        evidence: noMatch.evidence,
      });
    }
  }

  const dateMatch = extractFirstMatch(text, [
    /开票日期\s*[:：]?\s*([0-9]{4}\s*[年\-\/\.]\s*[0-9]{1,2}\s*[月\-\/\.]\s*[0-9]{1,2}\s*日?)/im,
    /开票日期\s*[:：]?\s*([0-9]{4}\s*-\s*[0-9]{1,2}\s*-\s*[0-9]{1,2})/im,
  ]);
  if (dateMatch) {
    const parsed = parseIssueDate(dateMatch.raw);
    if (parsed.iso) {
      fields.issueDate = makeField(parsed.iso, parsed.confidence, dateMatch.evidence);
    } else {
      fields.issueDate = makeField<string>(undefined, 0.2, dateMatch.evidence);
      errors.push({
        code: 'INVALID_FIELD_FORMAT',
        message: `开票日期格式无法识别: ${dateMatch.raw}`,
        field: 'issueDate',
        evidence: dateMatch.evidence,
      });
    }
  }

  const checkMatch = extractFirstMatch(text, [
    /校验码\s*[:：]?\s*([0-9][0-9\s]{10,30})/i,
    /校验码\s*[:：]?\s*([0-9]{20})/i,
  ]);
  if (checkMatch) {
    const digits = normalizeDigits(checkMatch.raw);
    const value = digits.length >= 20 ? digits.slice(0, 20) : digits;
    const confidence = value.length === 20 ? (/\s/.test(checkMatch.raw) ? 0.85 : 1) : 0.6;
    fields.checkCode = makeField(value, confidence, checkMatch.evidence);
  }

  const machineMatch = extractFirstMatch(text, [
    /机器编号\s*[:：]?\s*([0-9]{10,12})/i,
    /机器号\s*[:：]?\s*([0-9]{10,12})/i,
  ]);
  if (machineMatch) {
    const digits = normalizeDigits(machineMatch.raw);
    fields.machineNo = makeField(digits, digits.length === 12 ? 0.95 : 0.85, machineMatch.evidence);
  }

  const buyerBlock = extractNamedPartyBlock(lines, /^(?:购买方信息|购买方|购方|买方)\s*[:：]?$/i);
  const buyerNameFromLabel = extractPartyNameFromNameLabel(lines, true);
  const buyerName = buyerBlock.name
    ? { value: buyerBlock.name, evidence: buyerBlock.evidence, confidence: buyerBlock.confidence }
    : buyerNameFromLabel.value
      ? buyerNameFromLabel
      : extractPartyName(lines, [
        /^(?:购买方|购方|买方)\s*[:：]?\s*(.+)$/i,
        /^(?:购买方信息|购买方|购方|买方)\s*[:：]?\s*$/i,
      ]);
  if (buyerName.value) fields.buyerName = makeField(buyerName.value, buyerName.confidence, buyerName.evidence);

  const sellerBlock = extractNamedPartyBlock(lines, /^(?:销售方信息|销售方|销方|卖方)\s*[:：]?$/i);
  const sellerNameFromLabel = extractPartyNameFromNameLabel(lines, false);
  const sellerName = sellerBlock.name
    ? { value: sellerBlock.name, evidence: sellerBlock.evidence, confidence: sellerBlock.confidence }
    : sellerNameFromLabel.value
      ? sellerNameFromLabel
      : extractPartyName(lines, [
        /^(?:销售方|销方|卖方)\s*[:：]?\s*(.+)$/i,
        /^(?:销售方信息|销售方|销方|卖方)\s*[:：]?\s*$/i,
        /^(?:销售方信息)\s*[:：]?\s*(.+)$/i,
      ]);
  if (sellerName.value) fields.sellerName = makeField(sellerName.value, sellerName.confidence, sellerName.evidence);

  const buyerTax = buyerBlock.taxNo
    ? { value: buyerBlock.taxNo, evidence: buyerBlock.evidence, confidence: buyerBlock.confidence }
    : extractTaxNoNearParty(lines, [/^(购买方信息|购买方|购方|买方)/i]);
  if (buyerTax.value) fields.buyerTaxNo = makeField(buyerTax.value, buyerTax.confidence, buyerTax.evidence);

  const sellerTax = sellerBlock.taxNo
    ? { value: sellerBlock.taxNo, evidence: sellerBlock.evidence, confidence: sellerBlock.confidence }
    : extractTaxNoNearParty(lines, [/^(销售方信息|销售方|销方|卖方)/i]);
  if (sellerTax.value) fields.sellerTaxNo = makeField(sellerTax.value, sellerTax.confidence, sellerTax.evidence);

  const parallelParty = extractParallelPartyFields(lines);
  if (parallelParty.buyerName && (isLikelyInvalidPartyName(String(fields.buyerName.value || '')) || !fields.buyerName.value)) {
    fields.buyerName = makeField(parallelParty.buyerName, parallelParty.confidence, parallelParty.evidence);
  }
  if (parallelParty.sellerName && (isLikelyInvalidPartyName(String(fields.sellerName.value || '')) || !fields.sellerName.value)) {
    fields.sellerName = makeField(parallelParty.sellerName, parallelParty.confidence, parallelParty.evidence);
  }
  if (parallelParty.buyerTaxNo && !fields.buyerTaxNo.value) {
    fields.buyerTaxNo = makeField(parallelParty.buyerTaxNo, parallelParty.confidence, parallelParty.evidence);
  }
  if (parallelParty.sellerTaxNo && !fields.sellerTaxNo.value) {
    fields.sellerTaxNo = makeField(parallelParty.sellerTaxNo, parallelParty.confidence, parallelParty.evidence);
  }

  const compactParty = extractPartyFieldsFromCompactFormat(lines);
  // If compactParty has high confidence results, use them to override potentially incorrect extractions
  if (compactParty.buyerName && compactParty.confidence >= 0.9) {
    fields.buyerName = makeField(compactParty.buyerName, compactParty.confidence, compactParty.evidence);
  } else if (compactParty.buyerName && (isLikelyInvalidPartyName(String(fields.buyerName.value || '')) || !fields.buyerName.value)) {
    fields.buyerName = makeField(compactParty.buyerName, compactParty.confidence, compactParty.evidence);
  }
  if (compactParty.sellerName && compactParty.confidence >= 0.9) {
    fields.sellerName = makeField(compactParty.sellerName, compactParty.confidence, compactParty.evidence);
  } else if (compactParty.sellerName && (isLikelyInvalidPartyName(String(fields.sellerName.value || '')) || !fields.sellerName.value)) {
    fields.sellerName = makeField(compactParty.sellerName, compactParty.confidence, compactParty.evidence);
  }
  if (compactParty.buyerTaxNo && compactParty.confidence >= 0.9) {
    fields.buyerTaxNo = makeField(compactParty.buyerTaxNo, compactParty.confidence, compactParty.evidence);
  } else if (compactParty.buyerTaxNo && !fields.buyerTaxNo.value) {
    fields.buyerTaxNo = makeField(compactParty.buyerTaxNo, compactParty.confidence, compactParty.evidence);
  }
  if (compactParty.sellerTaxNo && compactParty.confidence >= 0.9) {
    fields.sellerTaxNo = makeField(compactParty.sellerTaxNo, compactParty.confidence, compactParty.evidence);
  } else if (compactParty.sellerTaxNo && !fields.sellerTaxNo.value) {
    fields.sellerTaxNo = makeField(compactParty.sellerTaxNo, compactParty.confidence, compactParty.evidence);
  }

  const amountAndTax = extractAmountAndTaxFromTotalLine(lines);
  if (amountAndTax.amount !== undefined && amountAndTax.tax !== undefined) {
    fields.amountWithoutTax = makeField(amountAndTax.amount, amountAndTax.confidence, amountAndTax.evidence);
    fields.taxAmount = makeField(amountAndTax.tax, amountAndTax.confidence, amountAndTax.evidence);
  }

  const amountWithoutTax = extractMoneyNearLabel(lines, [/合计金额/i, /(金额)\s*合计/i, /金额合计/i], 1);
  if (typeof amountWithoutTax.value === 'number' && !fields.amountWithoutTax.value) {
    fields.amountWithoutTax = makeField(amountWithoutTax.value, amountWithoutTax.confidence, amountWithoutTax.evidence);
  }

  const taxAmount = extractMoneyNearLabel(lines, [/合计税额/i, /税额合计/i], 1);
  if (typeof taxAmount.value === 'number' && !fields.taxAmount.value) {
    fields.taxAmount = makeField(taxAmount.value, taxAmount.confidence, taxAmount.evidence);
  }

  const totalAmount = extractMoneyNearLabel(lines, [/价税合计/i, /价税合计\(小写\)/i, /小写\s*[:：]?\s*[￥¥]?\s*\d/i], 2);
  if (typeof totalAmount.value === 'number') {
    fields.totalAmount = makeField(totalAmount.value, totalAmount.confidence, totalAmount.evidence);
  }

  if (typeof fields.totalAmount.value !== 'number' || fields.totalAmount.value <= 1.5) {
    const totalAmountAlt = extractMoneyNearLabel(lines, [/价税合计.*小写/i, /小写/i], 3);
    if (typeof totalAmountAlt.value === 'number' && totalAmountAlt.value > 1.5 && totalAmountAlt.value < 100000) {
      fields.totalAmount = makeField(totalAmountAlt.value, totalAmountAlt.confidence, totalAmountAlt.evidence);
    }
  }

  if (typeof fields.totalAmount.value !== 'number' || fields.totalAmount.value <= 1.5) {
    const fallbackTotal = extractMaxCurrencyMoney(text);
    if (typeof fallbackTotal === 'number' && fallbackTotal > 0 && fallbackTotal < 1000) {
      fields.totalAmount = makeField(fallbackTotal, 0.72, 'currency-fallback');
    }
  }

  const remark = extractTextNearLabel(lines, [/^备注(?:信息)?\s*[:：]?/i], {
    lookaheadLines: 3,
    stopPatterns: [/^(开票人|收款人|复核|项目名称|价税合计|合计金额|合计税额|购买方|销售方)/i],
  });
  if (remark.value) {
    fields.remark = makeField(remark.value, remark.confidence, remark.evidence);
  }

  const issuerName = extractTextNearLabel(lines, [/^开票人(?:信息)?\s*[:：]?/i], {
    lookaheadLines: 2,
    stopPatterns: [/^(收款人|复核|备注|项目名称|价税合计|合计金额|合计税额|购买方|销售方)/i],
  });
  if (issuerName.value) {
    fields.issuerName = makeField(issuerName.value, issuerName.confidence, issuerName.evidence);
  }

  if (!fields.issuerName.value) {
    const issuerMatch = /开票人\s*[:：]\s*(\S+)/i.exec(text);
    if (issuerMatch?.[1]) {
      fields.issuerName = makeField(issuerMatch[1], 0.9, issuerMatch[0]);
    }
  }

  const invoiceItems = extractInvoiceItems(markdown, lines);
  if (invoiceItems.value && invoiceItems.value.length) {
    fields.invoiceItems = makeField(invoiceItems.value, invoiceItems.confidence, invoiceItems.evidence);
  }

  const weights: Array<[keyof InvoiceParsedFields, number]> = [
    ['invoiceCode', 0.16],
    ['invoiceNo', 0.16],
    ['issueDate', 0.12],
    ['totalAmount', 0.18],
    ['amountWithoutTax', 0.08],
    ['taxAmount', 0.06],
    ['buyerTaxNo', 0.08],
    ['sellerTaxNo', 0.08],
    ['checkCode', 0.05],
    ['invoiceType', 0.03],
  ];

  const fieldScore = clamp01(
    weights.reduce((sum, [k, w]) => sum + (fields[k]?.confidence || 0) * w, 0) / weights.reduce((sum, [, w]) => sum + w, 0),
  );
  const overall = clamp01(detect.confidence * 0.4 + fieldScore * 0.6);
  const strongElectronicInvoiceSignal =
    detect.confidence >= 0.6 &&
    fields.invoiceNo.confidence >= 0.85 &&
    fields.issueDate.confidence >= 0.8 &&
    (fields.totalAmount.confidence >= 0.6 || /价税合计|小写/.test(text));
  const isInvoice = (overall >= strategy.minConfidence && (fields.invoiceNo.confidence >= 0.6 || fields.invoiceCode.confidence >= 0.6)) || strongElectronicInvoiceSignal;

  if (isInvoice) {
    for (const requiredField of strategy.requiredFields) {
      if (requiredField === 'invoiceNo' && !fields.invoiceNo.value) {
        addMissingFieldError(errors, 'invoiceNo', '发票号码');
      } else if (requiredField === 'invoiceCode' && !fields.invoiceCode.value) {
        addMissingFieldError(errors, 'invoiceCode', '发票代码');
      } else if (requiredField === 'issueDate' && !fields.issueDate.value) {
        addMissingFieldError(errors, 'issueDate', '开票日期');
      } else if (requiredField === 'totalAmount' && typeof fields.totalAmount.value !== 'number') {
        addMissingFieldError(errors, 'totalAmount', '价税合计/小写金额');
      } else if (requiredField === 'buyerName' && !fields.buyerName.value) {
        addMissingFieldError(errors, 'buyerName', '购买方名称');
      } else if (requiredField === 'sellerName' && !fields.sellerName.value) {
        addMissingFieldError(errors, 'sellerName', '销售方名称');
      } else if (requiredField === 'machineNo' && !fields.machineNo.value) {
        addMissingFieldError(errors, 'machineNo', '机器编号');
      }
    }
  }

  const data: InvoiceParsedData = {
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
  };

  return {
    isInvoice,
    confidence: overall,
    data,
    fields,
    errors,
  };
};
