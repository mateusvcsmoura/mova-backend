import {
  Cargo,
  StatusPagamento,
  StatusReserva,
  TipoCobranca,
  TipoEventoFinanceiroSandbox,
} from "@prisma/client";

import { env } from "../config/env.js";
import { HttpError } from "../errors/HttpError.js";
import { SandboxPaymentAudit } from "../infra/payment/sandbox-audit.js";
import { prisma } from "../database/prisma.js";
import {
  PagamentoReservaResponse,
  StatusEstorno,
} from "../repositories/contracts/pagamento.contract.js";

export interface PagamentoRequester {
  id: string;
  cargo: Cargo;
}

const arredondar2 = (valor: number): number => Math.round(valor * 100) / 100;

export class PagamentoEstornoService {
  constructor(
    private readonly sandboxAudit: SandboxPaymentAudit = new SandboxPaymentAudit(),
  ) {}

  async registrarEstornoDeCancelamento(idReserva: string): Promise<void> {
    await this.sandboxAudit.registrarEstornoPorCancelamento(
      idReserva,
      env.PAGAMENTO_SANDBOX_PROVIDER,
    );
  }

  async reconciliarEstornoDeCancelamento(idReserva: string): Promise<void> {
    const reserva = await prisma.reserva.findUnique({
      where: { id: idReserva },
      select: { status: true, statusPagamento: true },
    });
    if (reserva?.status === StatusReserva.CANCELADA && reserva.statusPagamento === StatusPagamento.SUCESSO) {
      await this.registrarEstornoDeCancelamento(idReserva);
    }
  }

  async consultar(
    idReserva: string,
    requester: PagamentoRequester,
  ): Promise<PagamentoReservaResponse> {
    const reserva = await prisma.reserva.findUnique({
      where: { id: idReserva },
      include: {
        cobrancas: true,
        eventosFinanceirosSandbox: { orderBy: { criadoEm: "asc" } },
      },
    });
    if (!reserva) throw new HttpError(404, "Reserva não encontrada");

    if (
      requester.cargo !== Cargo.ADMIN &&
      (requester.cargo !== Cargo.LOCATARIO || requester.id !== reserva.idLocatario)
    ) {
      throw new HttpError(403, "Acesso negado");
    }

    const eventos = reserva.eventosFinanceirosSandbox;
    const recebeuPagamento = eventos.some(
      (evento) => evento.tipo === TipoEventoFinanceiroSandbox.PAGAMENTO_RECEBIDO,
    );
    const cobrancaPagamento = reserva.cobrancas.find(
      (cobranca) => cobranca.tipo === TipoCobranca.PAGAMENTO_RESERVA,
    );
    const valorPago = recebeuPagamento || cobrancaPagamento?.statusPagamento === StatusPagamento.SUCESSO
      ? arredondar2(Number(cobrancaPagamento?.valor ?? reserva.valorTotal))
      : 0;
    const multaCancelamento = arredondar2(
      reserva.cobrancas
        .filter((cobranca) => cobranca.tipo === TipoCobranca.CANCELAMENTO)
        .reduce((total, cobranca) => total + Number(cobranca.valor), 0),
    );
    const valorElegivelEstorno = arredondar2(Math.max(0, valorPago - multaCancelamento));

    const estornoConcluido = eventos.find(
      (evento) => evento.tipo === TipoEventoFinanceiroSandbox.ESTORNO_CONCLUIDO,
    );
    const estornoFalhou = eventos.find(
      (evento) => evento.tipo === TipoEventoFinanceiroSandbox.ESTORNO_FALHOU,
    );
    const estornoSolicitado = eventos.find(
      (evento) => evento.tipo === TipoEventoFinanceiroSandbox.ESTORNO_SOLICITADO,
    );
    const statusEstorno: StatusEstorno = estornoConcluido
      ? "CONCLUIDO"
      : estornoFalhou
        ? "FALHOU"
        : estornoSolicitado
          ? "SOLICITADO"
          : "NAO_SOLICITADO";

    const atualizadoEm = eventos.at(-1)?.criadoEm ?? reserva.atualizadoEm;
    return {
      idReserva: reserva.id,
      statusReserva: reserva.status,
      statusPagamento: reserva.statusPagamento,
      metodoPagamento: reserva.metodoPagamento,
      valorReserva: arredondar2(Number(reserva.valorTotal)),
      valorPago,
      multaCancelamento,
      valorElegivelEstorno,
      statusEstorno,
      estornoSolicitadoEm: estornoSolicitado?.criadoEm ?? null,
      estornoConcluidoEm: estornoConcluido?.criadoEm ?? null,
      historico: eventos.map((evento) => ({ tipo: evento.tipo, criadoEm: evento.criadoEm })),
      simulado: true,
      aviso: "Pagamento e estorno simulados — nenhum dinheiro real movimentado",
      atualizadoEm,
    };
  }
}
