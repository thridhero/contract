import { app } from 'electron';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as util from 'util';
import * as winston from 'winston';
import { IS_DEV } from '../config/app.config';
import { ConfigService } from '../services/system/ConfigService';
import type { LogLevel, LogProcess, LoggingSettings, LogWritePayload } from '../../shared/types/log.types';
import { normalizeLoggingSettings } from '../../shared/utils/log';

const DailyRotateFile = require('winston-daily-rotate-file');

type MainLogPayload = LogWritePayload & { process: LogProcess };

let runtimeLogger: winston.Logger | null = null;
let activeSettings: LoggingSettings | null = null;
let cleanupTimer: NodeJS.Timeout | null = null;

function getLogDirectory(): string {
  const userDataDir = (app && typeof (app as any).getPath === 'function')
    ? app.getPath('userData')
    : path.join(os.homedir(), '.software-registration-manager');
  return path.join(userDataDir, 'logs');
}

function getStoredLoggingSettings(): LoggingSettings {
  const saved = ConfigService.getInstance().getConfigItem('loggingSettings') as Partial<LoggingSettings> | undefined;
  return normalizeLoggingSettings({
    level: saved?.level ?? (IS_DEV ? 'debug' : 'info'),
    retentionDays: saved?.retentionDays,
    maxSizeMb: saved?.maxSizeMb,
    consoleEnabled: saved?.consoleEnabled ?? IS_DEV,
    pattern: saved?.pattern,
  });
}

function ensureLogDirectory(): string {
  const directory = getLogDirectory();
  fs.mkdirSync(directory, { recursive: true });
  return directory;
}

function serializeValue(value: unknown): string {
  if (value instanceof Error) {
    return value.stack || `${value.name}: ${value.message}`;
  }
  if (typeof value === 'string') {
    return value;
  }
  return util.inspect(value, {
    depth: 6,
    breakLength: 120,
    compact: true,
    maxArrayLength: 50,
  });
}

function applyPattern(pattern: string, payload: Record<string, string>): string {
  return pattern.replace(/\{(timestamp|level|process|module|message)\}/g, (_, key: string) => payload[key] || '');
}

function formatMessage(message: unknown, context: unknown): string {
  const base = typeof message === 'string' ? message : serializeValue(message);
  if (typeof context === 'undefined') {
    return base;
  }
  const detail = serializeValue(context);
  return detail ? `${base} ${detail}` : base;
}

function getCurrentDateString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getCurrentTimestampString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  const milliseconds = String(now.getMilliseconds()).padStart(3, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}.${milliseconds}`;
}

function extractStack(context: unknown): string | undefined {
  if (context instanceof Error) {
    return context.stack || `${context.name}: ${context.message}`;
  }
  if (Array.isArray(context)) {
    const matched = context.find(item => item instanceof Error);
    if (matched instanceof Error) {
      return matched.stack || `${matched.name}: ${matched.message}`;
    }
  }
  return undefined;
}

function purgeExpiredLogs(settings: LoggingSettings): void {
  const directory = ensureLogDirectory();
  const expiresAt = Date.now() - settings.retentionDays * 24 * 60 * 60 * 1000;
  for (const name of fs.readdirSync(directory)) {
    if (!/\.(log|json)$/.test(name)) continue;
    const filePath = path.join(directory, name);
    try {
      const stat = fs.statSync(filePath);
      if (!stat.isFile()) continue;
      if (stat.mtimeMs < expiresAt) {
        fs.rmSync(filePath, { force: true });
      }
    } catch {}
  }
}

function ensureCleanupTimer(): void {
  if (cleanupTimer) {
    return;
  }
  cleanupTimer = setInterval(() => {
    try {
      purgeExpiredLogs(getActiveLoggingSettings());
    } catch {}
  }, 6 * 60 * 60 * 1000);
  cleanupTimer.unref();
}

function buildFormat(settings: LoggingSettings): winston.Logform.Format {
  return winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
    winston.format.errors({ stack: true }),
    winston.format.printf(info => {
      const level = String(info.level || 'info').toUpperCase();
      const processName = String(info.process || 'main');
      const moduleName = String(info.module || 'app');
      const message = formatMessage(info.message, info.context);
      const line = applyPattern(settings.pattern, {
        timestamp: String(info.timestamp || ''),
        level,
        process: processName,
        module: moduleName,
        message,
      });
      const stack = typeof info.stack === 'string' && info.stack
        ? `\n${info.stack}`
        : '';
      return `${line}${stack}`;
    })
  );
}

function isAiModule(moduleName: string): boolean {
  return /^ai/i.test(String(moduleName || ''));
}

function appendAiLogFallback(payload: MainLogPayload, settings: LoggingSettings): void {
  if (!isAiModule(payload.module)) {
    return;
  }

  const line = applyPattern(settings.pattern, {
    timestamp: getCurrentTimestampString(),
    level: String(payload.level || 'info').toUpperCase(),
    process: String(payload.process || 'main'),
    module: String(payload.module || 'app'),
    message: formatMessage(payload.message, payload.context),
  });
  const stack = extractStack(payload.context);
  const finalText = `${line}${stack ? `\n${stack}` : ''}\n`;
  const filePath = path.join(ensureLogDirectory(), `ai-${getCurrentDateString()}.log`);

  try {
    fs.appendFileSync(filePath, finalText, 'utf-8');
  } catch {}
}

function filterByModule(predicate: (moduleName: string) => boolean): winston.Logform.Format {
  return winston.format((info) => {
    const moduleName = String(info.module || '');
    if (predicate(moduleName)) {
      return info;
    }
    return false as unknown as winston.Logform.TransformableInfo;
  })();
}

function configureRuntimeLogger(settings: LoggingSettings): winston.Logger {
  ensureLogDirectory();
  purgeExpiredLogs(settings);
  ensureCleanupTimer();

  const sharedOptions = {
    dirname: getLogDirectory(),
    datePattern: 'YYYY-MM-DD',
    maxSize: `${settings.maxSizeMb}m`,
    maxFiles: `${settings.retentionDays}d`,
    zippedArchive: false,
  };

  const transports: winston.transport[] = [
    new DailyRotateFile({
      ...sharedOptions,
      filename: 'application-%DATE%.log',
      level: settings.level,
      format: winston.format.combine(
        filterByModule(moduleName => !isAiModule(moduleName)),
        buildFormat(settings),
      ),
    }),
    new DailyRotateFile({
      ...sharedOptions,
      filename: 'ai-%DATE%.log',
      level: settings.level,
      format: winston.format.combine(
        filterByModule(moduleName => isAiModule(moduleName)),
        buildFormat(settings),
      ),
    }),
    new DailyRotateFile({
      ...sharedOptions,
      filename: 'error-%DATE%.log',
      level: 'error',
    }),
  ];

  if (settings.consoleEnabled) {
    transports.push(new winston.transports.Console({ level: settings.level }));
  }

  const nextLogger = winston.createLogger({
    level: settings.level,
    format: buildFormat(settings),
    transports,
  });

  activeSettings = settings;
  runtimeLogger = nextLogger;
  return nextLogger;
}

function getRuntimeLogger(): winston.Logger {
  const settings = getStoredLoggingSettings();
  if (!runtimeLogger || !activeSettings || JSON.stringify(activeSettings) !== JSON.stringify(settings)) {
    return configureRuntimeLogger(settings);
  }
  return runtimeLogger;
}

function getActiveLoggingSettings(): LoggingSettings {
  if (!activeSettings) {
    activeSettings = getStoredLoggingSettings();
  }
  return activeSettings;
}

function normalizeContext(args: unknown[]): unknown {
  if (args.length === 0) {
    return undefined;
  }
  if (args.length === 1) {
    return args[0];
  }
  return args;
}

function writeLog(payload: MainLogPayload): void {
  const settings = getActiveLoggingSettings();
  const logger = getRuntimeLogger();
  logger.log({
    level: payload.level,
    message: payload.message,
    module: payload.module,
    process: payload.process,
    context: payload.context,
    stack: extractStack(payload.context),
  });
  appendAiLogFallback(payload, settings);
}

export function getLoggingSettings(): LoggingSettings {
  return getStoredLoggingSettings();
}

export function saveLoggingSettings(settings: LoggingSettings): LoggingSettings {
  const normalized = normalizeLoggingSettings(settings);
  ConfigService.getInstance().updateConfigItem('loggingSettings', normalized);
  configureRuntimeLogger(normalized);
  return normalized;
}

export function writeRendererLog(payload: LogWritePayload): void {
  const settings = getActiveLoggingSettings();
  if (payload.level === 'debug' && settings.level !== 'debug') {
    return;
  }
  writeLog({
    ...payload,
    process: 'renderer',
  });
}

export function createLogger(tag: string) {
  return {
    debug: (msg: string, ...args: unknown[]) => {
      writeLog({
        level: 'debug',
        module: tag,
        message: msg,
        process: 'main',
        context: normalizeContext(args),
      });
    },
    info: (msg: string, ...args: unknown[]) => {
      writeLog({
        level: 'info',
        module: tag,
        message: msg,
        process: 'main',
        context: normalizeContext(args),
      });
    },
    warn: (msg: string, ...args: unknown[]) => {
      writeLog({
        level: 'warn',
        module: tag,
        message: msg,
        process: 'main',
        context: normalizeContext(args),
      });
    },
    error: (msg: string, ...args: unknown[]) => {
      writeLog({
        level: 'error',
        module: tag,
        message: msg,
        process: 'main',
        context: normalizeContext(args),
      });
    },
  };
}
