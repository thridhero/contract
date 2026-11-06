import type { PdfTextSearchMatch } from '../../../../shared/types/fileConversion.types';
import { normalizeSearchText } from './textGeometry';

export type OcrTextBlock = {
  text: string;
  rect: { left: number; top: number; width: number; height: number };
};

type OcrTextRange = {
  start: number;
  end: number;
  block: OcrTextBlock;
};

export function findMatchesFromOcrBlocks(
  blocks: OcrTextBlock[],
  normalizedQuery: string,
  compactQuery: string,
): PdfTextSearchMatch[] {
  if (blocks.length === 0) {
    return [];
  }

  const matches: PdfTextSearchMatch[] = [];
  const signatures = new Set<string>();
  const lines = groupOcrBlocksByLine(blocks);

  for (const line of lines) {
    matches.push(
      ...findMatchesFromOcrLine(line, normalizedQuery, compactQuery, signatures),
    );
  }

  return matches;
}

function groupOcrBlocksByLine(blocks: OcrTextBlock[]): OcrTextBlock[][] {
  const sorted = [...blocks].sort((a, b) => {
    const aCenter = a.rect.top + a.rect.height / 2;
    const bCenter = b.rect.top + b.rect.height / 2;
    const tolerance = Math.max(a.rect.height, b.rect.height) * 0.8;
    if (Math.abs(aCenter - bCenter) <= tolerance) {
      return a.rect.left - b.rect.left;
    }
    return aCenter - bCenter;
  });

  const lines: OcrTextBlock[][] = [];
  for (const block of sorted) {
    const lastLine = lines[lines.length - 1];
    const firstBlock = lastLine?.[0];
    if (!lastLine || !firstBlock) {
      lines.push([block]);
      continue;
    }

    const firstCenter = firstBlock.rect.top + firstBlock.rect.height / 2;
    const blockCenter = block.rect.top + block.rect.height / 2;
    const tolerance = Math.max(firstBlock.rect.height, block.rect.height) * 0.8;
    if (Math.abs(firstCenter - blockCenter) <= tolerance) {
      lastLine.push(block);
      continue;
    }

    lines.push([block]);
  }

  return lines;
}

function findMatchesFromOcrLine(
  blocks: OcrTextBlock[],
  normalizedQuery: string,
  compactQuery: string,
  signatures: Set<string>,
): PdfTextSearchMatch[] {
  const lineMatches: PdfTextSearchMatch[] = [];
  const normalizedRanges: OcrTextRange[] = [];
  const compactRanges: OcrTextRange[] = [];
  let normalizedText = '';
  let compactText = '';

  for (const block of blocks) {
    const blockText = normalizeSearchText(block.text);
    if (!blockText) {
      continue;
    }

    if (normalizedText) {
      normalizedText += ' ';
    }
    const normalizedStart = normalizedText.length;
    normalizedText += blockText;
    normalizedRanges.push({
      start: normalizedStart,
      end: normalizedText.length,
      block,
    });

    const compactBlockText = blockText.replace(/\s+/g, '');
    if (!compactBlockText) {
      continue;
    }
    const compactStart = compactText.length;
    compactText += compactBlockText;
    compactRanges.push({
      start: compactStart,
      end: compactText.length,
      block,
    });
  }

  collectOcrMatchesFromRanges(
    lineMatches,
    signatures,
    normalizedRanges,
    normalizedText.toLocaleLowerCase(),
    normalizedQuery,
  );
  if (compactQuery) {
    collectOcrMatchesFromRanges(
      lineMatches,
      signatures,
      compactRanges,
      compactText.toLocaleLowerCase(),
      compactQuery,
    );
  }

  return lineMatches;
}

function collectOcrMatchesFromRanges(
  collector: PdfTextSearchMatch[],
  signatures: Set<string>,
  ranges: OcrTextRange[],
  content: string,
  query: string,
): void {
  if (!content || !query || ranges.length === 0) {
    return;
  }

  let fromIndex = 0;
  while (fromIndex <= content.length - query.length) {
    const matchIndex = content.indexOf(query, fromIndex);
    if (matchIndex < 0) {
      break;
    }
    const matchEnd = matchIndex + query.length;
    const matchedBlocks: OcrTextBlock[] = [];
    const seenBlocks = new Set<OcrTextBlock>();

    for (const range of ranges) {
      if (range.end <= matchIndex || range.start >= matchEnd) {
        continue;
      }
      if (seenBlocks.has(range.block)) {
        continue;
      }
      seenBlocks.add(range.block);
      matchedBlocks.push(range.block);
    }

    if (matchedBlocks.length > 0) {
      const rects = matchedBlocks.map(block => block.rect);
      const signature = rects
        .map(rect => `${rect.left}:${rect.top}:${rect.width}:${rect.height}`)
        .join('|');
      if (!signatures.has(signature)) {
        signatures.add(signature);
        collector.push({
          rects,
          text: matchedBlocks.map(block => block.text).join(' '),
          source: 'ocr',
        });
      }
    }

    fromIndex = matchIndex + Math.max(1, query.length);
  }
}

