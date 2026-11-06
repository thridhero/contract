import {
  AILocalModelConfig,
  AIExecutionMode,
  AIProvider,
  AISettings,
  AIStructuredGenerateRequest,
} from '../../../../../shared/types/ai.types';
import { getSelectedLocalModel } from '../config';
import { logger } from '../shared';

export function createTestLog(payload: {
  mode: AIExecutionMode;
  prompt: string;
  provider?: AIProvider;
  localModel?: AILocalModelConfig;
  timeoutMs: number;
}): string | null {
  const logId = `ai-test-connection-${Date.now()}`;
  logger.info('AI 测试连接开始', {
    logId,
    scene: 'ai-test-connection',
    mode: payload.mode,
    timeoutMs: payload.timeoutMs,
    provider: payload.provider,
    localModel: payload.localModel
      ? {
          id: payload.localModel.id,
          displayName: payload.localModel.displayName,
          runtime: payload.localModel.runtime,
          modelPath: payload.localModel.modelPath,
          executablePath: payload.localModel.executablePath,
        }
      : undefined,
    prompt: payload.prompt,
  });
  return logId;
}

export function appendTestLogResult(logPath: string | null, payload: {
  success: boolean;
  elapsedMs: number;
  exitCode?: number | null;
  timedOut?: boolean;
  resultText?: string;
  errorText?: string;
}): void {
  if (!logPath) {
    return;
  }
  const resultText = typeof payload.resultText === 'string'
    ? payload.resultText.slice(0, 20000)
    : undefined;
  const errorText = typeof payload.errorText === 'string'
    ? payload.errorText.slice(0, 5000)
    : undefined;

  const record: Record<string, unknown> = {
    logId: logPath,
    scene: 'ai-test-connection',
    success: payload.success,
    elapsedMs: payload.elapsedMs,
    exitCode: payload.exitCode,
    timedOut: payload.timedOut,
    errorText,
    resultPreview: resultText
      ? resultText.replace(/\s+/g, ' ').trim().slice(0, 300)
      : undefined,
  };

  if (payload.success) {
    logger.info('AI 测试连接结果', record);
  } else {
    logger.warn('AI 测试连接结果', record);
  }

  if (resultText) {
    const formatted = formatAiTestResultText(resultText);
    logger.info([
      'AI 测试输出',
      `logId: ${logPath}`,
      '',
      formatted,
    ].join('\n'));
  }

  if (errorText && !payload.success) {
    logger.warn([
      'AI 测试错误输出',
      `logId: ${logPath}`,
      '',
      errorText,
    ].join('\n'));
  }
}

export function normalizeLocalLogOutput(output: string, prompt: string): string {
  const normalized = String(output || '')
    .replace(/\u001b\[[0-9;]*m/g, '')
    .replace(/\r/g, '')
    .replace(/^>\s.*$/m, `> ${prompt}`);

  const filteredLines: string[] = [];
  let blankCount = 0;

  for (const rawLine of normalized.split('\n')) {
    const trimmed = rawLine.trim();

    if (!trimmed) {
      blankCount += 1;
      if (blankCount <= 1) {
        filteredLines.push('');
      }
      continue;
    }

    blankCount = 0;

    if (!shouldKeepLocalOutputLine(trimmed, false)) {
      continue;
    }

    filteredLines.push(rawLine.trimEnd());
  }

  return filteredLines.join('\n').trim();
}

export function formatAiTestResultText(text: string): string {
  const raw = String(text || '').replace(/\r/g, '').trim();
  if (!raw) {
    return '';
  }

  const lines = raw.split('\n');
  const promptIndex = lines.findIndex(line => line.trimStart().startsWith('> '));
  if (promptIndex < 0) {
    return raw;
  }

  const promptLine = lines[promptIndex].trimStart().slice(2).trim();
  const response = lines.slice(promptIndex + 1).join('\n').trim();

  const formattedLines: string[] = [
    `prompt: ${promptLine}`,
    '',
    'result:',
  ];

  if (response) {
    formattedLines.push(response);
  }

  return formattedLines.join('\n');
}

export function truncateLogText(text: unknown, maxLength = 4000): string {
  const normalized = String(text ?? '').replace(/\r/g, '').trim();
  if (!normalized) {
    return '';
  }
  if (normalized.length <= maxLength) {
    return normalized;
  }
  return `${normalized.slice(0, maxLength)}\n...[截断 ${normalized.length - maxLength} 字符]`;
}

export function logStructuredGenerationStart(
  request: AIStructuredGenerateRequest,
  config: AISettings,
  finalPrompt: string,
): void {
  const provider = config.mode === 'cloud' ? config.provider : undefined;
  const localModel = config.mode === 'local' ? getSelectedLocalModel(config) : undefined;
  const promptPreview = truncateLogText(finalPrompt, 6000);

  logger.info('AI 结构化生成开始', {
    scene: request.scene,
    fileId: request.fileId || undefined,
    mode: config.mode,
    provider,
    modelId: localModel?.id,
    modelName: localModel?.displayName,
    schemaKeys: request.schema.map(field => field.key),
    promptChars: finalPrompt.length,
    promptLines: finalPrompt.replace(/\r/g, '').split('\n').length,
  });

  const lines: string[] = [
    'AI 结构化生成提示词',
    `scene: ${request.scene}`,
    `fileId: ${request.fileId || ''}`,
    `mode: ${config.mode}`,
  ];

  if (provider) {
    lines.push(`provider: ${provider}`);
  }
  if (localModel?.id) {
    lines.push(`modelId: ${localModel.id}`);
  }
  if (localModel?.displayName) {
    lines.push(`modelName: ${localModel.displayName}`);
  }

  lines.push('', '----- PROMPT BEGIN -----', promptPreview, '----- PROMPT END -----');

  logger.info(lines.join('\n'));
}

export function logStructuredGenerationResult(payload: {
  request: AIStructuredGenerateRequest;
  config: AISettings;
  elapsedMs: number;
  ok: boolean;
  rawText?: string;
  parsedData?: unknown;
  error?: string;
  validationErrors?: string[];
}): void {
  const provider = payload.config.mode === 'cloud' ? payload.config.provider : undefined;
  const localModel = payload.config.mode === 'local' ? getSelectedLocalModel(payload.config) : undefined;

  const rawText = typeof payload.rawText === 'string' ? payload.rawText : '';
  const normalizedRawText = rawText.replace(/\r/g, '').trim();
  const rawTextPreview = normalizedRawText ? truncateLogText(normalizedRawText, 6000) : '';

  const parsedDataText = typeof payload.parsedData === 'undefined'
    ? ''
    : typeof payload.parsedData === 'string'
      ? payload.parsedData
      : JSON.stringify(payload.parsedData, null, 2);

  const normalizedParsedDataText = String(parsedDataText || '').replace(/\r/g, '').trim();
  const parsedDataPreview = normalizedParsedDataText
    ? truncateLogText(normalizedParsedDataText, 6000)
    : '';

  const record = {
    scene: payload.request.scene,
    fileId: payload.request.fileId || undefined,
    mode: payload.config.mode,
    provider,
    modelId: localModel?.id,
    modelName: localModel?.displayName,
    elapsedMs: payload.elapsedMs,
    ok: payload.ok,
    error: payload.error,
    validationErrors: payload.validationErrors,
    rawTextChars: normalizedRawText.length,
    rawTextLines: normalizedRawText ? normalizedRawText.split('\n').length : 0,
    parsedDataChars: normalizedParsedDataText.length,
    parsedDataLines: normalizedParsedDataText ? normalizedParsedDataText.split('\n').length : 0,
  };



  const lines: string[] = [
    'AI 结构化生成输出',
    `scene: ${payload.request.scene}`,
    `fileId: ${payload.request.fileId || ''}`,
    `mode: ${payload.config.mode}`,
    `elapsedMs: ${payload.elapsedMs}`,
    `ok: ${payload.ok}`,
  ];

  if (provider) {
    lines.push(`provider: ${provider}`);
  }
  if (localModel?.id) {
    lines.push(`modelId: ${localModel.id}`);
  }
  if (localModel?.displayName) {
    lines.push(`modelName: ${localModel.displayName}`);
  }
  if (payload.error) {
    lines.push(`error: ${payload.error}`);
  }
  if (payload.validationErrors?.length) {
    lines.push('validationErrors:', ...payload.validationErrors.map(e => `- ${e}`));
  }

  if (rawTextPreview) {
    lines.push('', '----- RAW BEGIN -----', rawTextPreview, '----- RAW END -----');
  }
  if (parsedDataPreview) {
    lines.push('', '----- PARSED BEGIN -----', parsedDataPreview, '----- PARSED END -----');
  }

  if (rawTextPreview || parsedDataPreview || payload.error || payload.validationErrors?.length) {
    if (payload.ok) {
      logger.info(lines.join('\n'));
    } else {
      logger.warn(lines.join('\n'));
    }
  }
}

export function shouldKeepLocalOutputLine(line: string, allowPromptLine: boolean): boolean {
  if (!line) return false;
  if (line.startsWith('load_backend:')) return false;
  if (line.startsWith('llama_memory_breakdown_print:')) return false;
  if (line === 'Loading model...') return false;
  if (line === 'available commands:') return false;
  if (line.startsWith('/exit')) return false;
  if (line.startsWith('/regen')) return false;
  if (line.startsWith('/clear')) return false;
  if (line.startsWith('/read ')) return false;
  if (line.startsWith('/glob ')) return false;
  if (line.startsWith('build')) return false;
  if (line.startsWith('model')) return false;
  if (line.startsWith('modalities')) return false;
  if (line.startsWith('[Start thinking]')) return false;
  if (line.startsWith('[ Prompt:')) return false;
  if (line.startsWith('[ [ Prompt:')) return false;
  if (line === 'Exiting...') return false;
  if (line.includes('/exit or Ctrl+C')) return false;
  if (line.includes('stop or exit')) return false;
  if (/^[▄█▀\s]+$/.test(line)) return false;
  if (!allowPromptLine && line.startsWith('>')) return false;
  return true;
}
