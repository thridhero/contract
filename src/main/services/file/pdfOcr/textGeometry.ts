import type { PdfTextSearchRect } from '../../../../shared/types/fileConversion.types';

export type OcrPolygonPoint = {
  x: number;
  y: number;
};

export function normalizeSearchText(value: unknown): string {
  return String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function extractNormalizedRect(
  record: Record<string, unknown>,
  pageWidth: number,
  pageHeight: number,
): PdfTextSearchRect | null {
  const candidates = [
    record.box,
    record.points,
    record.text_box_position,
    record.position,
    record.polygon,
    record.bounds,
    record.rect,
    ...Object.values(record),
  ];

  for (const candidate of candidates) {
    const polygon = toPolygon(candidate);
    if (polygon) {
      return toNormalizedRect(polygon, pageWidth, pageHeight);
    }
    const rect = toRect(candidate);
    if (rect) {
      return normalizeRect(rect.left, rect.top, rect.width, rect.height, pageWidth, pageHeight);
    }
  }

  return null;
}

function toPolygon(value: unknown): OcrPolygonPoint[] | null {
  if (typeof value === 'string') {
    const parsed = parseCoordinateString(value);
    if (parsed.length >= 8) {
      return toPolygon(parsed);
    }
  }

  if (!Array.isArray(value)) {
    return null;
  }

  if (value.length >= 4 && value.every(item => Array.isArray(item) && item.length >= 2)) {
    const points = value
      .map(item => ({
        x: Number((item as unknown[])[0]),
        y: Number((item as unknown[])[1]),
      }))
      .filter(point => Number.isFinite(point.x) && Number.isFinite(point.y));
    return points.length >= 4 ? points : null;
  }

  if (value.length >= 4 && value.every(item => item && typeof item === 'object' && !Array.isArray(item))) {
    const points = value
      .map(item => {
        const itemRecord = item as Record<string, unknown>;
        return {
          x: Number(itemRecord.x ?? itemRecord.left ?? itemRecord.X),
          y: Number(itemRecord.y ?? itemRecord.top ?? itemRecord.Y),
        };
      })
      .filter(point => Number.isFinite(point.x) && Number.isFinite(point.y));
    return points.length >= 4 ? points : null;
  }

  if (value.length >= 8 && value.every(item => typeof item === 'number')) {
    const points: OcrPolygonPoint[] = [];
    for (let index = 0; index + 1 < value.length; index += 2) {
      const x = Number(value[index]);
      const y = Number(value[index + 1]);
      if (!Number.isFinite(x) || !Number.isFinite(y)) {
        return null;
      }
      points.push({ x, y });
    }
    return points.length >= 4 ? points : null;
  }

  return null;
}

function toRect(value: unknown): { left: number; top: number; width: number; height: number } | null {
  if (typeof value === 'string') {
    const parsed = parseCoordinateString(value);
    if (parsed.length >= 4) {
      return toRect(parsed);
    }
  }

  if (Array.isArray(value) && value.length >= 4 && value.every(item => Number.isFinite(Number(item)))) {
    const values = value.map(item => Number(item));
    if (values.length >= 8) {
      const polygon = toPolygon(values);
      if (polygon) {
        const xs = polygon.map(point => point.x);
        const ys = polygon.map(point => point.y);
        return {
          left: Math.min(...xs),
          top: Math.min(...ys),
          width: Math.max(...xs) - Math.min(...xs),
          height: Math.max(...ys) - Math.min(...ys),
        };
      }
    }
    return {
      left: values[0],
      top: values[1],
      width: values[2] - values[0],
      height: values[3] - values[1],
    };
  }

  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;
  const left = Number(record.left ?? record.x ?? record.minX);
  const top = Number(record.top ?? record.y ?? record.minY);
  const width = Number(record.width);
  const height = Number(record.height);
  if ([left, top, width, height].every(Number.isFinite)) {
    return { left, top, width, height };
  }

  const right = Number(record.right ?? record.maxX);
  const bottom = Number(record.bottom ?? record.maxY);
  if ([left, top, right, bottom].every(Number.isFinite)) {
    return {
      left,
      top,
      width: right - left,
      height: bottom - top,
    };
  }

  return null;
}

function parseCoordinateString(value: string): number[] {
  return String(value || '')
    .split(/[^0-9.+-]+/)
    .map(part => part.trim())
    .filter(Boolean)
    .map(part => Number(part))
    .filter(number => Number.isFinite(number));
}

function toNormalizedRect(
  points: OcrPolygonPoint[],
  pageWidth: number,
  pageHeight: number,
): PdfTextSearchRect | null {
  if (!Number.isFinite(pageWidth) || !Number.isFinite(pageHeight) || pageWidth <= 0 || pageHeight <= 0) {
    return null;
  }

  const xs = points.map(point => point.x).filter(Number.isFinite);
  const ys = points.map(point => point.y).filter(Number.isFinite);
  if (xs.length === 0 || ys.length === 0) {
    return null;
  }

  const left = Math.min(...xs);
  const top = Math.min(...ys);
  const right = Math.max(...xs);
  const bottom = Math.max(...ys);
  return normalizeRect(left, top, right - left, bottom - top, pageWidth, pageHeight);
}

function normalizeRect(
  left: number,
  top: number,
  width: number,
  height: number,
  pageWidth: number,
  pageHeight: number,
): PdfTextSearchRect | null {
  if (![left, top, width, height, pageWidth, pageHeight].every(Number.isFinite)) {
    return null;
  }

  const safeLeft = Math.max(0, Math.min(pageWidth, left));
  const safeTop = Math.max(0, Math.min(pageHeight, top));
  const safeRight = Math.max(safeLeft, Math.min(pageWidth, left + width));
  const safeBottom = Math.max(safeTop, Math.min(pageHeight, top + height));
  const safeWidth = safeRight - safeLeft;
  const safeHeight = safeBottom - safeTop;
  if (safeWidth <= 0 || safeHeight <= 0) {
    return null;
  }

  return {
    left: safeLeft / pageWidth,
    top: safeTop / pageHeight,
    width: safeWidth / pageWidth,
    height: safeHeight / pageHeight,
  };
}
