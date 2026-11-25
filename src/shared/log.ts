type Level = 'debug' | 'info' | 'warn' | 'error';

export interface LogEvent {
  level: Level;
  category: 'page' | 'action' | 'render' | 'request' | 'session';
  outcome: 'open' | 'close' | 'intent' | 'success' | 'failure';
  operation: string;
  correlationId?: string;
}

export class LogManager {
  constructor(private readonly sink?: (event: Readonly<LogEvent>) => Promise<void>) {}

  write(event: LogEvent) {
    const safeEvent = {
      level: event.level, category: event.category, outcome: event.outcome,
      operation: /^[a-zA-Z0-9_.-]{1,96}$/.test(event.operation) ? event.operation : 'unknown',
      correlationId: event.correlationId && /^[a-zA-Z0-9_.-]{1,96}$/.test(event.correlationId)
        ? event.correlationId : undefined,
    };
    if (import.meta.env.DEV || safeEvent.level === 'error') console[safeEvent.level]('[DCP]', safeEvent);
    if (this.sink) void this.sink(safeEvent).catch(() => undefined);
  }
}

export const logManager = new LogManager();
