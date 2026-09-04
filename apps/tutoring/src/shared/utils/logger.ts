export type LogLevel = "info" | "warn" | "error" | "debug";

export interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  context?: Record<string, unknown>;
  stack?: string;
}

export const logger = {
  info(message: string, context?: Record<string, unknown>): void {
    console.log(
      JSON.stringify({
        level: "info",
        message,
        timestamp: new Date().toISOString(),
        context,
      })
    );
  },

  warn(message: string, context?: Record<string, unknown>): void {
    console.warn(
      JSON.stringify({
        level: "warn",
        message,
        timestamp: new Date().toISOString(),
        context,
      })
    );
  },

  error(message: string, err?: unknown, context?: Record<string, unknown>): void {
    const entry: LogEntry = {
      level: "error",
      message,
      timestamp: new Date().toISOString(),
      context,
    };

    if (err instanceof Error) {
      entry.stack = err.stack;
      if (!entry.message) entry.message = err.message;
    } else if (err) {
      entry.context = { ...entry.context, rawError: err };
    }

    console.error(JSON.stringify(entry));
  },
};
