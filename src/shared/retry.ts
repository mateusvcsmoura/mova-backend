export interface RetryOpts {
  // Nº máximo de tentativas (inclui a primeira). Padrão 3.
  tentativas?: number;
  // Atraso base entre tentativas (ms). Padrão 200.
  baseMs?: number;
  // Fator de crescimento exponencial do atraso. Padrão 2 (200, 400, 800...).
  fator?: number;
}

const esperar = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

export async function retryComBackoff<T>(
  fn: (tentativa: number) => Promise<T>,
  opts: RetryOpts = {},
): Promise<T> {
  const tentativas = Math.max(1, opts.tentativas ?? 3);
  const baseMs = opts.baseMs ?? 200;
  const fator = opts.fator ?? 2;

  let ultimoErro: unknown;
  for (let n = 1; n <= tentativas; n++) {
    try {
      return await fn(n);
    } catch (erro) {
      ultimoErro = erro;
      if (n < tentativas) {
        await esperar(baseMs * fator ** (n - 1));
      }
    }
  }
  throw ultimoErro;
}
