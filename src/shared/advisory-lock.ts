import { prisma } from "../database/prisma.js";

// Chaves de advisory lock do PostgreSQL. Cada job periódico tem uma chave fixa
// e distinta — instâncias diferentes competem pela mesma chave, garantindo que
// só uma execute o tick por vez (sem Redis, sem dependência externa).
export const LOCK_MONITORAMENTO = 4101;
export const LOCK_LOCALIZACAO_SIMULADOR = 4102;

// Timeout da transação que segura o lock enquanto `fn` roda. Precisa cobrir a
// duração do tick mais pesado; se estourar, a transação aborta e o lock é
// liberado antes da hora.
// ponytail: timeout global fixo; se um tick passar disso, subir o valor aqui.
const LOCK_TX_TIMEOUT_MS = 120_000;

/**
 * Executa `fn` sob um advisory lock de transação do PostgreSQL, garantindo que
 * apenas uma instância rode o bloco por vez (`pg_try_advisory_xact_lock` é
 * não-bloqueante: quem não pega o lock simplesmente pula).
 *
 * A transação interativa fixa uma única conexão do pool — assim o lock é
 * adquirido e liberado na mesma sessão — e o lock cai automaticamente ao fim da
 * transação, mesmo em erro/crash. `fn` faz seu próprio trabalho de escrita pela
 * conexão global normal; a transação aqui existe só para segurar o mutex.
 *
 * @returns `true` se pegou o lock e executou; `false` se outra instância já
 * estava executando (tick pulado).
 */
export async function runExclusive(
  lockKey: number,
  fn: () => Promise<void>,
): Promise<boolean> {
  return prisma.$transaction(
    async (tx) => {
      const rows = await tx.$queryRaw<
        { locked: boolean }[]
      >`SELECT pg_try_advisory_xact_lock(${lockKey}) AS locked`;

      if (!rows[0]?.locked) {
        return false; // outra instância detém o lock — pula este tick
      }

      await fn();
      return true;
    },
    { timeout: LOCK_TX_TIMEOUT_MS },
  );
}
