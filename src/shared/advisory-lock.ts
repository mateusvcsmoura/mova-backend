import { prisma } from "../database/prisma.js";

export const LOCK_MONITORAMENTO = 4101;
export const LOCK_LOCALIZACAO_SIMULADOR = 4102;

const LOCK_TX_TIMEOUT_MS = 120_000;

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
