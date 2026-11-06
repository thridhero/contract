import * as crypto from 'crypto';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { spawn } from 'child_process';
import type { AISettings } from '../../../../../shared/types/ai.types';
import { parseJsonArgString } from '../../../../../shared/utils/ai';

function parseEmbeddingOutput(text: string): number[] {
  const source = String(text || '').trim();
  if (!source) return [];

  try {
    const parsed = JSON.parse(source);
    if (Array.isArray(parsed)) {
      return parsed.map(item => Number(item)).filter(item => Number.isFinite(item));
    }
    if (parsed && Array.isArray((parsed as { embedding?: unknown[] }).embedding)) {
      return (parsed as { embedding: unknown[] }).embedding.map(item => Number(item)).filter(item => Number.isFinite(item));
    }
    if (parsed && Array.isArray((parsed as { data?: Array<{ embedding?: unknown[] }> }).data?.[0]?.embedding)) {
      return ((parsed as { data: Array<{ embedding: unknown[] }> }).data[0].embedding || []).map(item => Number(item)).filter(item => Number.isFinite(item));
    }
  } catch {}

  const numbers = source.match(/-?\d+(?:\.\d+)?(?:e[+-]?\d+)?/ig) || [];
  return numbers.map(item => Number(item)).filter(item => Number.isFinite(item));
}

async function spawnEmbeddingProcess(command: string, args: string[], timeoutMs: number): Promise<string> {
  return await new Promise((resolve, reject) => {
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    let timedOut = false;
    const child = spawn(command, args, { windowsHide: true });
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill();
    }, timeoutMs);

    child.stdout?.on('data', (chunk: Buffer | string) => {
      stdout.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
    });
    child.stderr?.on('data', (chunk: Buffer | string) => {
      stderr.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
    });
    child.on('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      const output = Buffer.concat([...stdout, ...stderr]).toString('utf-8').trim();
      if (timedOut) {
        reject(new Error('Embedding 模型执行超时'));
        return;
      }
      if (code !== 0 && !output) {
        reject(new Error(`Embedding 模型执行失败，退出码 ${String(code)}`));
        return;
      }
      resolve(output);
    });
  });
}

export class EmbeddingService {
  private static instance: EmbeddingService;

  static getInstance(): EmbeddingService {
    if (!EmbeddingService.instance) {
      EmbeddingService.instance = new EmbeddingService();
    }
    return EmbeddingService.instance;
  }

  validateConfig(config: AISettings): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    if (!String(config.embeddingModelPath || '').trim()) {
      errors.push('Embedding 模型路径未配置');
    }
    if (!String(config.embeddingExecutablePath || '').trim()) {
      errors.push('Embedding 执行器路径未配置');
    }
    if (!config.embeddingDimension || config.embeddingDimension <= 0) {
      errors.push('Embedding 维度未配置');
    }
    return { valid: errors.length === 0, errors };
  }

  async generateEmbedding(text: string, config: AISettings): Promise<number[]> {
    const dimension = Math.max(8, Number(config.embeddingDimension || 256));
    const vector = new Array<number>(dimension).fill(0);
    const normalized = String(text || '').replace(/\s+/g, ' ').trim().toLowerCase();
    if (!normalized) return vector;

    const execPath = String(config.embeddingExecutablePath || '').trim();
    const modelPath = String(config.embeddingModelPath || '').trim();
    if (execPath && modelPath && fs.existsSync(execPath) && fs.existsSync(modelPath)) {
      const promptFile = path.join(os.tmpdir(), `embedding-${Date.now()}-${Math.random().toString(16).slice(2)}.txt`);
      try {
        fs.writeFileSync(promptFile, normalized, 'utf-8');
        const args = [
          '-m',
          modelPath,
          '-f',
          promptFile,
          '--embedding',
          '--pooling',
          'mean',
          '--simple-io',
          ...parseJsonArgString(''),
        ];
        const output = await spawnEmbeddingProcess(execPath, args, 120000);
        const parsed = parseEmbeddingOutput(output);
        if (parsed.length > 0) {
          const resized = parsed.length === dimension
            ? parsed
            : parsed.slice(0, dimension).concat(new Array(Math.max(0, dimension - parsed.length)).fill(0));
          const magnitude = Math.sqrt(resized.reduce((sum, item) => sum + item * item, 0));
          if (Number.isFinite(magnitude) && magnitude > 0) {
            return resized.map(item => item / magnitude);
          }
          return resized;
        }
      } catch {
      } finally {
        try {
          if (fs.existsSync(promptFile)) fs.unlinkSync(promptFile);
        } catch {}
      }
    }

    const tokens = normalized.match(/[\u4e00-\u9fa5]{1,2}|[a-z0-9_]+/g) || [];
    const source = tokens.length > 0 ? tokens : normalized.split('');
    source.forEach((token, index) => {
      const digest = crypto.createHash('sha256').update(token).digest();
      const bucket = digest.readUInt16BE(0) % dimension;
      const sign = digest[2] % 2 === 0 ? 1 : -1;
      vector[bucket] += sign * (1 + (index % 3) * 0.15);
    });

    const magnitude = Math.sqrt(vector.reduce((sum, item) => sum + item * item, 0));
    if (!Number.isFinite(magnitude) || magnitude <= 0) return vector;
    return vector.map(item => item / magnitude);
  }
}
