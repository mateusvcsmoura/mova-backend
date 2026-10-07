import type { IncomingHttpHeaders } from "node:http";
import { StatusPagamento, StatusReserva } from "@prisma/client";

import { HttpError } from "../errors/HttpError.js";
import { ErrorCode } from "../i18n/index.js";
import type { PagamentoEvento, PaymentGateway } from "../infra/payment/gateway.js";
import { SandboxPaymentAudit } from "../infra/payment/sandbox-audit.js";
import type { ReservaService } from "./reserva.js";

const RECUSAS_OPERACIONAIS: string[] = [
  ErrorCode.VEICULO_INDISPONIVEL_PARA_CONFIRMAR_RESERVA,
  ErrorCode.GARAGEM_INDISPONIVEL_PARA_CONFIRMAR_RESERVA,
];

export class PagamentoWebhookService {
  constructor(
    private readonly gateways: Map<string, PaymentGateway>,
    private readonly reservaService: ReservaService,
    private readonly sandboxAudit: SandboxPaymentAudit = new SandboxPaymentAudit(),
  ) {}

  processar = async (
    provider: string,
    rawBody: Buffer,
    headers: IncomingHttpHeaders,
  ): Promise<PagamentoEvento> => {
    const gateway = this.gateways.get(provider.toLowerCase());
    if (!gateway) {
      throw new HttpError(404, `Gateway de pagamento desconhecido: ${provider}`);
    }

    if (!gateway.verificarAssinatura(rawBody, headers)) {
      throw new HttpError(401, "Assinatura do webhook inválida.");
    }

    const evento = gateway.parseEvento(rawBody);

    if (
      evento.status === "SUCESSO" &&
      await this.sandboxAudit.jaRegistrouPagamentoBloqueado(provider, evento.providerEventId, evento.idReserva)
    ) {
      await this.sandboxAudit.registrarPagamentoBloqueado(
        evento.idReserva,
        provider,
        evento.providerEventId,
      );
      return evento;
    }

    try {
      const confirmada = await this.reservaService.confirmarPagamento(evento.idReserva, {
        status: evento.status,
        metodo: evento.metodo,
      });
      if (evento.status === "SUCESSO") {
        if (confirmada.status === StatusReserva.CANCELADA) {
          if (confirmada.statusPagamento === StatusPagamento.SUCESSO) {
            await this.sandboxAudit.registrarPagamentoRecebido(
              evento.idReserva,
              provider,
              evento.providerEventId,
            );
            await this.sandboxAudit.registrarEstornoPorCancelamento(
              evento.idReserva,
              provider,
            );
          } else {
            await this.sandboxAudit.registrarPagamentoCancelado(
              evento.idReserva,
              provider,
              evento.providerEventId,
            );
          }
        } else {
          await this.sandboxAudit.registrarPagamentoRecebido(
            evento.idReserva,
            provider,
            evento.providerEventId,
          );
        }
      }
    } catch (error) {
      if (
        error instanceof HttpError &&
        evento.status === "SUCESSO" &&
        (error.status === 403 || RECUSAS_OPERACIONAIS.includes(error.code ?? ""))
      ) {
        await this.sandboxAudit.registrarPagamentoBloqueado(
          evento.idReserva,
          provider,
          evento.providerEventId,
        );
      } else {
        throw error;
      }
    }

    return evento;
  };
}
