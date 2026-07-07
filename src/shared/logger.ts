// Logger estruturado mínimo (sem dependências externas). Emite uma linha JSON
// por evento — formato amigável para coletores de log (Datadog, Loki, CloudWatch).
// O projeto não possuía logger; este centraliza a saída em vez de console.* solto.
//
// Silenciado em NODE_ENV=test para não poluir a saída da suíte (a suíte roda
// centenas de requisições). A instrumentação — request id, tempo, status —
// continua ativa; apenas a escrita no console é suprimida nos testes.

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
