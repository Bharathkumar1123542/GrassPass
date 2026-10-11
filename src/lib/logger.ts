type LogLevel = 'info' | 'warn' | 'error';

const formatArgs = (level: LogLevel, message: string, metadata: unknown[]): string => {
  const prefix = `[GrassPass:${level.toUpperCase()}]`;
  const tail = metadata.length > 0 ? ` ${metadata.map((entry) => String(entry)).join(' ')}` : '';
  return `${prefix} ${message}${tail}`;
};

export const logger = {
  info: (message: string, ...metadata: unknown[]): void => {
    console.info(formatArgs('info', message, metadata));
  },
  warn: (message: string, ...metadata: unknown[]): void => {
    console.warn(formatArgs('warn', message, metadata));
  },
  error: (message: string, ...metadata: unknown[]): void => {
    console.error(formatArgs('error', message, metadata));
  },
};
