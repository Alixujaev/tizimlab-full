import winston from 'winston';
import type Transport from 'winston-transport';

const SENSITIVE_KEY = /pass(word)?|token|secret|cookie|authorization/i;
export const REDACTED = '[REDACTED]';

/** Sezgir kalitlarning qiymatini rekursiv ravishda yashiradi (asl ob'ekt o'zgarmaydi). */
export function redact(value: unknown, depth = 0): unknown {
  if (depth > 8 || value === null || typeof value !== 'object') return value;
  if (value instanceof Error)
    return { name: value.name, message: value.message, stack: value.stack };
  if (Array.isArray(value)) return value.map((v) => redact(v, depth + 1));
  const out: Record<string, unknown> = {};
  for (const [key, v] of Object.entries(value)) {
    out[key] = SENSITIVE_KEY.test(key) ? REDACTED : redact(v, depth + 1);
  }
  return out;
}

// winston info ob'ektidagi Symbol kalitlar (LEVEL, SPLAT) saqlanishi uchun joyida o'zgartiriladi
const redactFormat = winston.format((info) => {
  for (const key of Object.keys(info)) {
    if (key === 'level' || key === 'message') continue;
    info[key] = SENSITIVE_KEY.test(key) ? REDACTED : redact(info[key]);
  }
  return info;
});

export interface LoggerOptions {
  nodeEnv?: string;
  level?: string;
  transports?: Transport[];
}

export function createLogger({
  nodeEnv = process.env.NODE_ENV,
  level,
  transports,
}: LoggerOptions = {}): winston.Logger {
  const isProd = nodeEnv === 'production';
  const format = isProd
    ? winston.format.combine(redactFormat(), winston.format.timestamp(), winston.format.json())
    : winston.format.combine(
        redactFormat(),
        winston.format.colorize(),
        winston.format.timestamp({ format: 'HH:mm:ss' }),
        winston.format.printf(({ level: lvl, message, timestamp, ...meta }) => {
          const rest = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
          return `${String(timestamp)} ${lvl} ${String(message)}${rest}`;
        }),
      );
  return winston.createLogger({
    level: level ?? (nodeEnv === 'test' ? 'warn' : isProd ? 'info' : 'debug'),
    format,
    transports: transports ?? [new winston.transports.Console()],
  });
}

export const logger = createLogger();
