import { Injectable, Scope, LoggerService, ConsoleLogger } from '@nestjs/common';

export interface LogContext {
  requestId?: string;
  userId?: string;
  orderId?: number;
  marketId?: number | string;
  eventId?: number | string;
  polymarketEventId?: string;
  polymarketId?: string;
  idempotencyKey?: string;
  jobId?: string | number;
  attempt?: number;
  [key: string]: unknown;
}

@Injectable({ scope: Scope.TRANSIENT })
export class AppLogger extends ConsoleLogger implements LoggerService {
  private prefix: string = '';
  private contextData: LogContext = {};

  setPrefix(prefix: string): this {
    this.prefix = prefix;
    return this;
  }

  setContext(context: string): this {
    super.setContext(context);
    return this;
  }

  setContextData(data: LogContext): this {
    this.contextData = { ...this.contextData, ...data };
    return this;
  }

  clearContextData(): this {
    this.contextData = {};
    return this;
  }

  private buildFormattedMessage(message: string): string {
    const parts: string[] = [];

    if (this.prefix) {
      parts.push(`[${this.prefix}]`);
    }

    const contextPairs = Object.entries(this.contextData)
      .filter(([, value]) => value !== undefined && value !== null)
      .map(([key, value]) => `${key}=${String(value)}`);

    if (contextPairs.length > 0) {
      parts.push(`{${contextPairs.join(', ')}}`);
    }

    parts.push(message);

    return parts.join(' ');
  }

  log(message: string, ...optionalParams: unknown[]): void {
    super.log(this.buildFormattedMessage(message), ...optionalParams);
  }

  error(message: string, trace?: string, ...optionalParams: unknown[]): void {
    super.error(this.buildFormattedMessage(message), trace, ...optionalParams);
  }

  warn(message: string, ...optionalParams: unknown[]): void {
    super.warn(this.buildFormattedMessage(message), ...optionalParams);
  }

  debug(message: string, ...optionalParams: unknown[]): void {
    super.debug(this.buildFormattedMessage(message), ...optionalParams);
  }

  verbose(message: string, ...optionalParams: unknown[]): void {
    super.verbose(this.buildFormattedMessage(message), ...optionalParams);
  }

  child(additionalContext: LogContext): AppLogger {
    const childLogger = new AppLogger();
    childLogger.setPrefix(this.prefix);
    childLogger.setContext(this.context || '');
    childLogger.setContextData({ ...this.contextData, ...additionalContext });
    return childLogger;
  }
}

export const LogPrefix = {
  API: 'API',
  SYNC: 'SYNC',
  ORDER: 'ORDER',
  QUEUE: 'QUEUE',
  PROVIDER: 'PROVIDER',
  DATABASE: 'DB',
  AUTH: 'AUTH',
  SCHEDULER: 'SCHEDULER',
} as const;

export type LogPrefix = (typeof LogPrefix)[keyof typeof LogPrefix];
