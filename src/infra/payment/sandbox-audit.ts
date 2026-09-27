import crypto from "node:crypto";

import { TipoEventoFinanceiroSandbox } from "@prisma/client";

import { prisma } from "../../database/prisma.js";

interface SandboxRefundGateway {
  solicitarEstorno(input: {
    idReserva: string;
    provider: string;
    tentativa: number;
  }): Promise<void>;
}

// Exclusivamente simulado: nÃ£o recebe credenciais nem inicia transferÃªncia.
class SandboxRefundGatewayDeterministico implements SandboxRefundGateway {
  async solicitarEstorno({ tentativa }: {
    idReserva: string;
    provider: string;
    tentativa: number;
  }): Promise<void> {
    if (
      process.env.PAGAMENTO_SANDBOX_ESTORNO_FALHA_UNICA === "true" &&
      tentativa === 1
    ) {
      throw new Error("Falha simulada no estorno sandbox.");
    }
  }
}

/**
 * Auditoria append-only do sandbox. O estorno é apenas uma simulação de fluxo:
 * nenhuma chamada de transferência, credencial financeira ou saldo é usada.
 */
export class SandboxPaymentAudit {
  constructor(
    private readonly refundGateway: SandboxRefundGateway = new SandboxRefundGatewayDeterministico(),
  ) {}

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

      await tx.eventoFinanceiroSandbox.create({
        data: {
          idReserva,
          provider: provider.toLowerCase(),
          tipo: TipoEventoFinanceiroSandbox.ESTORNO_SOLICITADO,
          chaveIdempotencia: `${identidade}:refund-requested`,
        },
      });
    });

    await this.executarEstorno(idReserva, provider.toLowerCase(), identidade, 1);
    await this.executarEstorno(idReserva, provider.toLowerCase(), identidade, 2);
  }

  private async executarEstorno(
    idReserva: string,
    provider: string,
    identidade: string,
    tentativa: number,
  ): Promise<void> {
    const concluido = await prisma.eventoFinanceiroSandbox.findUnique({
      where: { chaveIdempotencia: `${identidade}:refund-completed` },
    });
    if (concluido) return;

    try {
      await this.refundGateway.solicitarEstorno({ idReserva, provider, tentativa });
      await prisma.eventoFinanceiroSandbox.createMany({
        data: {
          idReserva,
          provider,
          tipo: TipoEventoFinanceiroSandbox.ESTORNO_CONCLUIDO,
          chaveIdempotencia: `${identidade}:refund-completed`,
        },
        skipDuplicates: true,
      });
    } catch {
      await prisma.eventoFinanceiroSandbox.createMany({
        data: {
          idReserva,
          provider,
          tipo: TipoEventoFinanceiroSandbox.ESTORNO_FALHOU,
          chaveIdempotencia: `${identidade}:refund-failed`,
        },
        skipDuplicates: true,
      });
    }
  }
}
