import type { LogLevel } from '../../shared/types/log.types'

function normalizeContext(args: unknown[]): unknown {
  if (args.length === 0) {
    return undefined
  }
  if (args.length === 1) {
    return args[0]
  }
  return args
}

export function createRendererLogger(module: string) {
  const write = async (level: LogLevel, message: string, ...args: unknown[]) => {
    const payload = {
      level,
      module,
      message,
      context: normalizeContext(args),
      process: 'renderer' as const,
    }

    try {
      if (window?.electronAPI?.log?.write) {
        await window.electronAPI.log.write(payload)
        return
      }
    } catch {}

    const fallback = level === 'error'
      ? console.error
      : level === 'warn'
        ? console.warn
        : level === 'debug'
          ? console.debug
          : console.info
    fallback(`[${module}] ${message}`, ...args)
  }

  return {
    debug: (message: string, ...args: unknown[]) => write('debug', message, ...args),
    info: (message: string, ...args: unknown[]) => write('info', message, ...args),
    warn: (message: string, ...args: unknown[]) => write('warn', message, ...args),
    error: (message: string, ...args: unknown[]) => write('error', message, ...args),
  }
}
