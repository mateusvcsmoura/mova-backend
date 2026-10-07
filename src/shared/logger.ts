type LogLevel = "info" | "warn" | "error";

export type LogMeta = Record<string, unknown>;

const isTestEnv = (): boolean => process.env.NODE_ENV === "test";

function write(level: LogLevel, message: string, meta: LogMeta = {}): void {
  if (isTestEnv()) return;

  const entry = {
    level,
    message,
    timestamp: new Date().toISOString(),
    ...meta,
  };

  const line = JSON.stringify(entry);

  if (level === "error") {
    console.error(line);
  } else if (level === "warn") {
    console.warn(line);
  } else {
    console.info(line);
  }
}

export const logger = {
  info: (message: string, meta?: LogMeta) => write("info", message, meta),
  warn: (message: string, meta?: LogMeta) => write("warn", message, meta),
  error: (message: string, meta?: LogMeta) => write("error", message, meta),
};
