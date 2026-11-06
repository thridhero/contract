import * as fs from 'fs';
import * as path from 'path';
import { spawn } from 'child_process';
import {
  AILocalModelConfig,
  AILocalModelValidationRequest,
  AILocalModelValidationResult,
} from '../../../../../shared/types/ai.types';
import {
  extractJsonText,
  normalizeLocalModel,
  parseJsonArgString,
} from '../../../../../shared/utils/ai';
import { logger } from '../shared';
import { shouldKeepLocalOutputLine } from '../logging/serviceLogging';

function decodeProcessOutput(chunks: Buffer[]): string {
  if (!Array.isArray(chunks) || chunks.length === 0) return '';
  const combined = Buffer.concat(chunks);
  if (combined.length === 0) return '';

  const utf8Text = combined.toString('utf-8');
  const gbkText = decodeBufferWithEncoding(combined, 'gbk');
  if (!gbkText) return utf8Text;
  return pickBetterDecodedText(utf8Text, gbkText);
}

function decodeBufferWithEncoding(buffer: Buffer, encoding: string): string {
  try {
    return new TextDecoder(encoding as never).decode(buffer);
  } catch {
    return '';
  }
}

function pickBetterDecodedText(utf8Text: string, gbkText: string): string {
  const utf8ReplacementCount = (utf8Text.match(/\uFFFD/g) || []).length;
  const gbkReplacementCount = (gbkText.match(/\uFFFD/g) || []).length;
  if (utf8ReplacementCount !== gbkReplacementCount) {
    return gbkReplacementCount < utf8ReplacementCount ? gbkText : utf8Text;
  }

  const utf8MojibakeCount = (utf8Text.match(/[鈥鍟鍙鍚鍛鍜鎴鎵鍦鐨涓浠鍑缁绔]/g) || []).length;
  const gbkMojibakeCount = (gbkText.match(/[鈥鍟鍙鍚鍛鍜鎴鎵鍦鐨涓浠鍑缁绔]/g) || []).length;
  if (utf8MojibakeCount !== gbkMojibakeCount) {
    return gbkMojibakeCount < utf8MojibakeCount ? gbkText : utf8Text;
  }

  return utf8Text;
}

function buildLocalExecutionArgs(
  localModel: AILocalModelConfig,
  prompt: string,
  overrides?: Partial<Pick<AILocalModelConfig, 'maxTokens' | 'contextSize' | 'temperature'>>,
  extraArgs: string[] = [],
): string[] {
  const maxTokens = Math.max(1, Number(overrides?.maxTokens ?? localModel.maxTokens) || 1);
  const contextSize = Math.max(128, Number(overrides?.contextSize ?? localModel.contextSize) || 128);
  const temperature = Math.max(0, Number(overrides?.temperature ?? localModel.temperature) || 0);

  return [
    '-m',
    localModel.modelPath,
    '-p',
    prompt,
    '-n',
    String(maxTokens),
    '-c',
    String(contextSize),
    '--temp',
    String(temperature),
    '--simple-io',
    '--single-turn',
    ...extraArgs,
    ...parseJsonArgString(localModel.extraArgs),
  ];
}

function buildLocalExecutionArgsWithFile(
  localModel: AILocalModelConfig,
  promptFile: string,
  overrides?: Partial<Pick<AILocalModelConfig, 'maxTokens' | 'contextSize' | 'temperature'>>,
  extraArgs: string[] = [],
): string[] {
  const maxTokens = Math.max(1, Number(overrides?.maxTokens ?? localModel.maxTokens) || 1);
  const contextSize = Math.max(128, Number(overrides?.contextSize ?? localModel.contextSize) || 128);
  const temperature = Math.max(0, Number(overrides?.temperature ?? localModel.temperature) || 0);

  return [
    '-m',
    localModel.modelPath,
    '-f',
    promptFile,
    '-n',
    String(maxTokens),
    '-c',
    String(contextSize),
    '--temp',
    String(temperature),
    '--simple-io',
    '--single-turn',
    '--no-display-prompt',
    ...extraArgs,
    ...parseJsonArgString(localModel.extraArgs),
  ];
}

function extractLocalLines(output: string, allowPromptLine: boolean): string[] {
  return String(output || '')
    .replace(/\u001b\[[0-9;]*m/g, '')
    .replace(/\r/g, '')
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .filter(line => shouldKeepLocalOutputLine(line, allowPromptLine))
    .filter(line => /[\u4e00-\u9fa5A-Za-z0-9{}[\]"]/u.test(line));
}

function isClearlyIncompatibleLocalExecutable(executablePath: string): boolean {
  const normalized = String(executablePath || '').trim().toLowerCase();
  if (!normalized) return false;
  return normalized.includes('potplayer')
    || normalized.includes('whisper')
    || normalized.includes('const-me');
}

function detectIncompatibleLocalRuntimeOutput(output: string): string | null {
  const normalized = String(output || '').toLowerCase();
  if (!normalized) return null;

  if (normalized.includes('unknown argument: -n') && normalized.includes('file0.wav')) {
    return '当前执行器不是 llama.cpp 文本推理程序，而是 Whisper/音频转写程序。请在 AI 设置里把“本地模型执行器路径”改成 llama.cpp 的 `llama-cli.exe`、`main.exe` 或兼容推理程序。';
  }
  if (normalized.includes('usage:') && normalized.includes('file0.wav file1.wav')) {
    return '当前执行器看起来是音频转写程序，不支持合同文本推理。请改用 llama.cpp 文本模型执行器。';
  }

  return null;
}

export function extractLocalResponseText(output: string): string {
  return extractLocalLines(output, false).join('\n');
}

export function extractLocalPreviewText(output: string): string {
  const normalized = String(output || '')
    .replace(/\u001b\[[0-9;]*m/g, '')
    .replace(/\r/g, '');
  const jsonText = extractJsonText(normalized);
  if (jsonText && jsonText !== normalized.trim()) {
    return jsonText.slice(0, 500);
  }

  const preview = extractLocalLines(output, false).slice(-3).join('\n').trim();
  return preview.slice(0, 500);
}

async function spawnProcess(
  command: string,
  args: string[],
  timeoutMs: number,
  cwd?: string,
): Promise<{ code: number | null; stdout: string; stderr: string; timedOut: boolean }> {
  return new Promise((resolve, reject) => {
    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];
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
      child.stdout.on('data', (chunk: Buffer | string) => {
        stdoutChunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk), 'utf-8'));
      });
    }

    if (child.stderr) {
      child.stderr.on('data', (chunk: Buffer | string) => {
        stderrChunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk), 'utf-8'));
      });
    }

    child.on('error', error => {
      clearTimeout(timer);
      const baseMessage = error instanceof Error ? error.message : String(error);
      const hint = String(command || '').includes('"') || String(command || '').includes("'")
        ? '检测到执行器路径包含引号，请在设置里去掉首尾引号后重试。'
        : '请确认执行器路径与模型路径真实存在且可执行；如果路径包含引号请去掉引号。';
      const message = [
        `本地模型启动失败: ${baseMessage}`,
        `command: ${command}`,
        `args: ${args.slice(0, 12).join(' ')}`,
        hint,
      ].join('\n');
      reject(new Error(message));
    });

    child.on('close', code => {
      clearTimeout(timer);
      const stdout = decodeProcessOutput(stdoutChunks);
      const stderr = decodeProcessOutput(stderrChunks);
      resolve({ code, stdout, stderr, timedOut });
    });
  });
}

export async function validateLocalModel(
  payload: AILocalModelValidationRequest,
): Promise<AILocalModelValidationResult> {
  const localModel = normalizeLocalModel(payload.localModel);
  const errors: string[] = [];
  const executablePath = String(localModel.executablePath || '').trim();
  const modelPath = String(localModel.modelPath || '').trim();
  const executableExists = Boolean(executablePath) && fs.existsSync(executablePath);
  const modelExists = Boolean(modelPath) && fs.existsSync(modelPath);

  if (!executablePath) {
    errors.push('请填写 llama.cpp 执行器路径');
  } else if (!executableExists) {
    errors.push('llama.cpp 执行器路径不存在');
  } else if (isClearlyIncompatibleLocalExecutable(executablePath)) {
    errors.push('当前执行器路径疑似指向 Whisper/音频转写程序，请改为 llama.cpp 文本推理执行器');
  }

  if (!modelPath) {
    errors.push('请填写模型文件路径');
  } else if (!modelExists) {
    errors.push('模型文件路径不存在');
  }

  if (modelExists && !modelPath.toLowerCase().endsWith('.gguf')) {
    errors.push('当前仅支持 GGUF 模型文件');
  }

  return {
    valid: errors.length === 0,
    errors,
    executableExists,
    modelExists,
    executablePath,
    modelPath,
  };
}

async function runLocalModel(
  localModel: AILocalModelConfig,
  prompt: string,
  overrides?: Partial<Pick<AILocalModelConfig, 'maxTokens' | 'contextSize' | 'temperature'>>,
  extraArgs: string[] = [],
): Promise<{ code: number | null; output: string; timedOut: boolean }> {
  const validation = await validateLocalModel({ localModel });
  if (!validation.valid) {
    throw new Error(validation.errors.join('；'));
  }

  const promptFile = path.join(process.env.TEMP || '/tmp', `llama-prompt-${Date.now()}.txt`);
  try {
    fs.writeFileSync(promptFile, prompt, 'utf-8');

    const args = buildLocalExecutionArgsWithFile(localModel, promptFile, overrides, extraArgs);
    const result = await spawnProcess(
      localModel.executablePath,
      args,
      localModel.timeoutMs,
      fs.existsSync(localModel.executablePath) ? undefined : undefined,
    );

    return {
      code: result.code,
      output: `${result.stdout}\n${result.stderr}`.trim(),
      timedOut: result.timedOut,
    };
  } finally {
    try {
      if (fs.existsSync(promptFile)) {
        fs.unlinkSync(promptFile);
      }
    } catch {}
  }
}

export async function executeLocalStructured(localModel: AILocalModelConfig, prompt: string): Promise<string> {
  return await executeLocalStructuredWithOptions(localModel, prompt);
}

export async function executeLocalStructuredWithOptions(
  localModel: AILocalModelConfig,
  prompt: string,
  overrides?: Partial<Pick<AILocalModelConfig, 'maxTokens' | 'contextSize' | 'temperature'>>,
): Promise<string> {
  const result = await runLocalModel(localModel, prompt, overrides);
  logger.info('本地模型结构化执行结果', {
    scene: 'local-structured',
    modelId: localModel.id,
    modelName: localModel.displayName,
    outputPreview: extractLocalPreviewText(result.output),
    exitCode: result.code,
    timedOut: result.timedOut,
  });
  if (result.timedOut) {
    throw new Error('本地模型执行超时');
  }

  const output = result.output;
  if (!output) {
    throw new Error('本地模型未返回任何内容');
  }

  if (result.code !== 0 && !extractJsonText(output)) {
    const incompatibleHint = detectIncompatibleLocalRuntimeOutput(output);
    if (incompatibleHint) {
      throw new Error(incompatibleHint);
    }
    throw new Error(`本地模型执行失败: ${output}`);
  }

  const normalizedText = extractLocalResponseText(output).trim();
  return normalizedText || output;
}

export async function probeLocalModel(
  localModel: AILocalModelConfig,
): Promise<{ code: number | null; output: string; timedOut: boolean }> {
  const inlineArgs = buildLocalExecutionArgs(
    localModel,
    '你是谁，有多少模型和参数，能做什么？只输出最简短的答案。',
    {
      maxTokens: Math.min(localModel.maxTokens, 64),
      contextSize: Math.min(localModel.contextSize, 512),
      temperature: 0,
    },
    ['--reasoning', 'off', '--reasoning-budget', '0', '--no-display-prompt'],
  );
  logger.debug('本地模型探测参数已构建', {
    modelId: localModel.id,
    argCount: inlineArgs.length,
  });

  return await runLocalModel(
    localModel,
    '你是谁，有多少模型和参数，能做什么？只输出最简短的答案。',
    {
      maxTokens: Math.min(localModel.maxTokens, 64),
      contextSize: Math.min(localModel.contextSize, 512),
      temperature: 0,
    },
    ['--reasoning', 'off', '--reasoning-budget', '0', '--no-display-prompt'],
  );
}
