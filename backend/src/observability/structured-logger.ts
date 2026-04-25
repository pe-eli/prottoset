import { logger } from '../utils/logger';

export interface LogContext {
  correlationId?: string;
  tenantId?: string;
  userId?: string;
  [key: string]: unknown;
}

function normalizeContext(context?: LogContext): Record<string, unknown> | undefined {
  if (!context) return undefined;
  const entries = Object.entries(context).filter(([, value]) => value !== undefined);
  if (entries.length === 0) return undefined;
  return Object.fromEntries(entries);
}

export const structuredLogger = {
  info(message: string, context?: LogContext): void {
    logger.info(message, normalizeContext(context));
  },

  warn(message: string, context?: LogContext): void {
    logger.warn(message, normalizeContext(context));
  },

  error(message: string, context?: LogContext): void {
    logger.error(message, normalizeContext(context));
  },

  event(eventName: string, context?: LogContext): void {
    logger.info(`event:${eventName}`, normalizeContext(context));
  },
};
