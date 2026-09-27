import { TipoEventoFinanceiroSandbox } from "@prisma/client";

import { prisma } from "../../database/prisma.js";

export interface SandboxRefundGateway {
  solicitarEstorno(input: {
    idReserva: string;
    provider: string;
    tentativa: number;
    chaveIdempotencia: string;
  }): Promise<void>;
}

// Exclusivamente simulado: nÃ£o recebe credenciais nem inicia transferÃªncia.
class SandboxRefundGatewayDeterministico implements SandboxRefundGateway {
  async solicitarEstorno({ tentativa }: {
    idReserva: string;
    provider: string;
    tentativa: number;
    chaveIdempotencia: string;
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

  async jaRegistrouPagamentoBloqueado(
    provider: string,
    providerEventId: string,
  ): Promise<boolean> {
    const identidade = `${provider.toLowerCase()}:${providerEventId}`;
    const recebido = await prisma.eventoFinanceiroSandbox.findUnique({
      where: { chaveIdempotencia: `${identidade}:received` },
    });
    return recebido !== null;
  }

  async registrarPagamentoBloqueado(
    idReserva: string,
    provider: string,
    providerEventId: string,
  ): Promise<void> {
    const providerNormalizado = provider.toLowerCase();
    // A identidade vem do provedor (não dos bytes): reserializações assinadas
    // do mesmo evento continuam sendo a mesma entrega lógica.
    const identidade = `${providerNormalizado}:${providerEventId}`;
    const chaveEstorno = `${identidade}:refund`;

    const reservaEstorno = await prisma.$transaction(async (tx) => {
      const recebido = await tx.eventoFinanceiroSandbox.createMany({
        data: {
          idReserva,
          provider: providerNormalizado,
          tipo: TipoEventoFinanceiroSandbox.PAGAMENTO_RECEBIDO,
          chaveIdempotencia: `${identidade}:received`,
        },
        skipDuplicates: true,
      });
      if (recebido.count === 0) return { owner: false };

      // Reserva a tentativa de forma durável antes de tocar o gateway. Só a
      // transação que criou o recebimento pode se tornar dona do estorno.
      await tx.eventoFinanceiroSandbox.create({
        data: {
          idReserva,
          provider: providerNormalizado,
          tipo: TipoEventoFinanceiroSandbox.ESTORNO_SOLICITADO,
          chaveIdempotencia: `${identidade}:refund-requested`,
        },
      });
      return { owner: true };
    });

    if (!reservaEstorno.owner) return;

    await this.executarEstorno(idReserva, providerNormalizado, identidade, chaveEstorno, 1);
    await this.executarEstorno(idReserva, providerNormalizado, identidade, chaveEstorno, 2);
  }

  private async executarEstorno(
    idReserva: string,
    provider: string,
    identidade: string,
    chaveEstorno: string,
    tentativa: number,
  ): Promise<void> {
    const concluido = await prisma.eventoFinanceiroSandbox.findUnique({
      where: { chaveIdempotencia: `${identidade}:refund-completed` },
    });
    if (concluido) return;

    try {
      await this.refundGateway.solicitarEstorno({
        idReserva,
        provider,
        tentativa,
        chaveIdempotencia: chaveEstorno,
      });
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
