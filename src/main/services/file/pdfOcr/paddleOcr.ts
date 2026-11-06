import * as crypto from 'crypto';
import * as fs from 'fs-extra';
import * as os from 'os';
import * as path from 'path';
import { spawn } from 'child_process';
import type { PdfTextSearchRect } from '../../../../shared/types/fileConversion.types';
import { extractNormalizedRect, normalizeSearchText } from './textGeometry';
import type { OcrRuntimeInfo } from './runtime';

export type PaddleOcrJsonResponse = {
  code?: number;
  data?: unknown;
};

export type OcrTextBlock = {
  text: string;
  rect: PdfTextSearchRect;
};

export async function invokePaddleOcrWithSafeImagePath(
  runtime: OcrRuntimeInfo,
  imagePath: string,
  timeoutMs: number,
): Promise<PaddleOcrJsonResponse> {
  const normalizedPath = path.resolve(String(imagePath || '').trim());
  const ext = path.extname(normalizedPath).toLowerCase() || '.png';
  const safeDir = path.join(os.tmpdir(), 'soft-registration-ocr');
  await fs.ensureDir(safeDir);
  const safeImagePath = path.join(
    safeDir,
    `ocr-${crypto.createHash('sha1').update(normalizedPath).digest('hex').slice(0, 16)}${ext}`,
  );

  if (safeImagePath.toLowerCase() === normalizedPath.toLowerCase()) {
    return await invokePaddleOcr(runtime, normalizedPath, timeoutMs);
  }

  await fs.copy(normalizedPath, safeImagePath, { overwrite: true });
  try {
    return await invokePaddleOcr(runtime, safeImagePath, timeoutMs);
  } finally {
    await fs.remove(safeImagePath);
  }
}

export async function invokePaddleOcr(
  runtime: OcrRuntimeInfo,
  imagePath: string,
  timeoutMs: number,
): Promise<PaddleOcrJsonResponse> {
  const args = [
    ...runtime.commandArgsPrefix,
    `-image_path=${imagePath}`,
    `-models_path=${runtime.modelsPath}`,
    '-cls=true',
    '-use_gpu=false',
  ];
  const result = await spawnProcess(
    runtime.executablePath,
    args,
    timeoutMs,
    runtime.workingDirectory,
  );

  if (result.timedOut) {
    throw new Error(`PaddleOCR-json 执行超时: ${path.basename(imagePath)}`);
  }

  if (result.code !== 0 && !result.stdout.trim()) {
    throw new Error(`PaddleOCR-json 进程退出异常(code=${result.code}): ${result.stderr.trim() || '无输出'}`);
  }

  return parsePaddleOcrResponse(result.stdout, result.stderr);
}

export function extractTextFromResponse(response: PaddleOcrJsonResponse): string {
  if (Array.isArray(response.data)) {
    return response.data
      .map(item => {
        if (!item || typeof item !== 'object') {
          return '';
        }
        const record = item as Record<string, unknown>;
        return typeof record.text === 'string' ? record.text : '';
      })
      .filter(Boolean)
      .join('\n');
  }

  if (typeof response.data === 'string' && response.code === 100) {
    return response.data;
  }

  if (
    response.code !== 100
    && (
      response.data == null
      || response.data === ''
      || (Array.isArray(response.data) && response.data.length === 0)
    )
  ) {
    return '';
  }

  throw new Error(`PaddleOCR-json 返回异常: ${stringifyJson(response)}`);
}

export function extractSearchBlocksFromResponse(
  response: PaddleOcrJsonResponse,
  pageWidth: number,
  pageHeight: number,
): OcrTextBlock[] {
  if (!Array.isArray(response.data)) {
    return [];
  }

  const blocks: OcrTextBlock[] = [];
  for (const item of response.data) {
    if (!item || typeof item !== 'object') {
      continue;
    }
    const record = item as Record<string, unknown>;
    const text = normalizeSearchText(record.text);
    if (!text) {
      continue;
    }
    const rect = extractNormalizedRect(record, pageWidth, pageHeight);
    if (!rect) {
      continue;
    }
    blocks.push({ text, rect });
  }
  return blocks;
}

export function normalizeOcrText(text: string): string {
  return String(text || '')
    .split(/\r?\n/)
    .map(line => line.replace(/[ \t]+/g, ' ').trim())
    .filter(Boolean)
    .join('\n\n');
}

export function dataUrlToBuffer(dataUrl: string): Buffer {
  const separatorIndex = dataUrl.indexOf(',');
  const base64 = separatorIndex >= 0 ? dataUrl.slice(separatorIndex + 1) : dataUrl;
  return Buffer.from(base64, 'base64');
}

function parsePaddleOcrResponse(stdout: string, stderr: string): PaddleOcrJsonResponse {
  const candidates = [
    stdout.trim(),
    ...stdout
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(Boolean)
      .reverse(),
    ...stderr
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(Boolean)
      .reverse(),
  ];

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate) as PaddleOcrJsonResponse;
      if (parsed && typeof parsed === 'object') {
        return parsed;
      }
    } catch {
      continue;
    }
  }

  throw new Error(`无法解析 PaddleOCR-json 输出: ${stdout.trim() || stderr.trim() || '无输出'}`);
}

function spawnProcess(
  command: string,
  args: string[],
  timeoutMs: number,
  cwd: string,
): Promise<{ code: number | null; stdout: string; stderr: string; timedOut: boolean }> {
  return new Promise((resolve, reject) => {
    let stdout = '';
    let stderr = '';
    let timedOut = false;

    const child = spawn(command, args, {
      cwd,
      windowsHide: true,
    });

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill();
    }, timeoutMs);

    if (child.stdout) {
      child.stdout.on('data', chunk => {
        stdout += Buffer.isBuffer(chunk) ? chunk.toString('utf-8') : String(chunk);
      });
    }

    if (child.stderr) {
      child.stderr.on('data', chunk => {
        stderr += Buffer.isBuffer(chunk) ? chunk.toString('utf-8') : String(chunk);
      });
    }

    child.on('error', error => {
      clearTimeout(timer);
      reject(new Error(`启动 PaddleOCR-json 失败: ${error instanceof Error ? error.message : String(error)}`));
    });

    child.on('close', code => {
      clearTimeout(timer);
      resolve({ code, stdout, stderr, timedOut });
    });
  });
}

function stringifyJson(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

