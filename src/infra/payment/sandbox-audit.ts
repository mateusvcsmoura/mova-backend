import { Prisma, TipoEventoFinanceiroSandbox } from "@prisma/client";

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

export class SandboxPaymentAudit {
  constructor(
    private readonly refundGateway: SandboxRefundGateway = new SandboxRefundGatewayDeterministico(),
  ) {}

  async registrarPagamentoRecebido(
    idReserva: string,
    provider: string,
    providerEventId: string,
  ): Promise<void> {
    const identidade = `${provider.toLowerCase()}:${providerEventId}`;
    await prisma.eventoFinanceiroSandbox.createMany({
      data: {
        idReserva,
        provider: provider.toLowerCase(),
        tipo: TipoEventoFinanceiroSandbox.PAGAMENTO_RECEBIDO,
        chaveIdempotencia: `${identidade}:received`,
      },
      skipDuplicates: true,
    });
  }

  async registrarEstornoPorCancelamento(
    idReserva: string,
    provider: string,
  ): Promise<void> {
    const providerNormalizado = provider.toLowerCase();
    const identidade = `cancelamento:${idReserva}`;
    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${identidade}, 0))`;
      const concluido = await tx.eventoFinanceiroSandbox.findUnique({
        where: { chaveIdempotencia: `${identidade}:refund-completed` },
      });
      if (concluido) return;

      await tx.eventoFinanceiroSandbox.createMany({
        data: {
          idReserva,
          provider: providerNormalizado,
          tipo: TipoEventoFinanceiroSandbox.ESTORNO_SOLICITADO,
          chaveIdempotencia: `${identidade}:refund-requested`,
        },
        skipDuplicates: true,
      });
      await this.executarEstorno(tx, idReserva, providerNormalizado, identidade, `${identidade}:refund`, 1);
      await this.executarEstorno(tx, idReserva, providerNormalizado, identidade, `${identidade}:refund`, 2);
    });
  }

  async jaRegistrouPagamentoBloqueado(
    provider: string,
    providerEventId: string,
    idReserva?: string,
  ): Promise<boolean> {
    const identidade = `${provider.toLowerCase()}:${providerEventId}`;
    const recebido = await prisma.eventoFinanceiroSandbox.findUnique({
      where: { chaveIdempotencia: `${identidade}:received` },
    });
    if (!recebido) return false;
    const concluido = await prisma.eventoFinanceiroSandbox.findUnique({
      where: { chaveIdempotencia: `${identidade}:refund-completed` },
    });
    if (concluido) return true;
    if (!idReserva) return true;
    const reserva = await prisma.reserva.findUnique({
      where: { id: idReserva },
      select: { statusPagamento: true },
    });
    return reserva?.statusPagamento !== "SUCESSO";
  }

  async registrarPagamentoCancelado(
    idReserva: string,
    provider: string,
    providerEventId: string,
  ): Promise<void> {
    await this.registrarPagamentoBloqueado(idReserva, provider, providerEventId);
  }

  async registrarPagamentoBloqueado(
    idReserva: string,
    provider: string,
    providerEventId: string,
  ): Promise<void> {
    const providerNormalizado = provider.toLowerCase();
    const identidade = `${providerNormalizado}:${providerEventId}`;
    const chaveEstorno = `${identidade}:refund`;

    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${identidade}, 0))`;
      await tx.eventoFinanceiroSandbox.createMany({
        data: {
          idReserva,
          provider: providerNormalizado,
          tipo: TipoEventoFinanceiroSandbox.PAGAMENTO_RECEBIDO,
          chaveIdempotencia: `${identidade}:received`,
        },
        skipDuplicates: true,
      });
      const concluido = await tx.eventoFinanceiroSandbox.findUnique({
        where: { chaveIdempotencia: `${identidade}:refund-completed` },
      });
      if (concluido) return;

      await tx.eventoFinanceiroSandbox.createMany({
        data: {
          idReserva,
          provider: providerNormalizado,
          tipo: TipoEventoFinanceiroSandbox.ESTORNO_SOLICITADO,
          chaveIdempotencia: `${identidade}:refund-requested`,
        },
        skipDuplicates: true,
      });
      await this.executarEstorno(tx, idReserva, providerNormalizado, identidade, chaveEstorno, 1);
      await this.executarEstorno(tx, idReserva, providerNormalizado, identidade, chaveEstorno, 2);
    });
  }

  private async executarEstorno(
    tx: Prisma.TransactionClient,
    idReserva: string,
    provider: string,
    identidade: string,
    chaveEstorno: string,
    tentativa: number,
  ): Promise<void> {
    const concluido = await tx.eventoFinanceiroSandbox.findUnique({
      where: { chaveIdempotencia: `${identidade}:refund-completed` },
    });
    if (concluido) return;

    const falhasAnteriores = await tx.eventoFinanceiroSandbox.count({
      where: { chaveIdempotencia: { startsWith: `${identidade}:refund-failed:` } },
    });
    const tentativaAtual = Math.max(tentativa, falhasAnteriores + 1);

    try {
      await this.refundGateway.solicitarEstorno({
        idReserva,
        provider,
        tentativa,
        chaveIdempotencia: chaveEstorno,
      });
      await tx.eventoFinanceiroSandbox.createMany({
        data: {
          idReserva,
          provider,
          tipo: TipoEventoFinanceiroSandbox.ESTORNO_CONCLUIDO,
          chaveIdempotencia: `${identidade}:refund-completed`,
        },
        skipDuplicates: true,
      });
    } catch {
      await tx.eventoFinanceiroSandbox.createMany({
        data: {
          idReserva,
          provider,
          tipo: TipoEventoFinanceiroSandbox.ESTORNO_FALHOU,
          chaveIdempotencia: `${identidade}:refund-failed:${tentativaAtual}`,
        },
        skipDuplicates: true,
      });
    }
  }
}
