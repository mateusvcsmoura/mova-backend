import crypto from "node:crypto";

import { TipoEventoFinanceiroSandbox } from "@prisma/client";

import { prisma } from "../../database/prisma.js";

/**
 * Auditoria append-only do sandbox. O estorno é apenas uma simulação de fluxo:
 * nenhuma chamada de transferência, credencial financeira ou saldo é usada.
 */
export class SandboxPaymentAudit {
  async registrarPagamentoBloqueado(
    idReserva: string,
    provider: string,
    rawBody: Buffer,
  ): Promise<void> {
    const identidade = crypto
      .createHash("sha256")
      .update(provider.toLowerCase())
      .update(":")
      .update(rawBody)
      .digest("hex");

    await prisma.$transaction(async (tx) => {
      const recebido = await tx.eventoFinanceiroSandbox.createMany({
        data: {
          idReserva,
          provider: provider.toLowerCase(),
          tipo: TipoEventoFinanceiroSandbox.PAGAMENTO_RECEBIDO,
          chaveIdempotencia: `${identidade}:received`,
        },
        skipDuplicates: true,
      });
      if (recebido.count === 0) return;

      await tx.eventoFinanceiroSandbox.createMany({
        data: [
          {
            idReserva,
            provider: provider.toLowerCase(),
            tipo: TipoEventoFinanceiroSandbox.ESTORNO_SOLICITADO,
            chaveIdempotencia: `${identidade}:refund-requested`,
          },
          {
            idReserva,
            provider: provider.toLowerCase(),
            tipo: TipoEventoFinanceiroSandbox.ESTORNO_CONCLUIDO,
            chaveIdempotencia: `${identidade}:refund-completed`,
          },
        ],
        skipDuplicates: true,
      });
    });
  }
}
