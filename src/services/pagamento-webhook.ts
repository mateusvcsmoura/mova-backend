import type { IncomingHttpHeaders } from "node:http";

import { HttpError } from "../errors/HttpError.js";
import type { PagamentoEvento, PaymentGateway } from "../infra/payment/gateway.js";
import { SandboxPaymentAudit } from "../infra/payment/sandbox-audit.js";
import type { ReservaService } from "./reserva.js";

/**
 * Recebe webhooks de gateways de pagamento. Responsabilidade: resolver o
 * gateway, validar a assinatura e traduzir o evento — depois delega a mudança
 * de estado ao domínio (ReservaService.confirmarPagamento).
 *
 * Separação: nada do formato do gateway vaza para o domínio; nenhuma regra de
 * negócio de reserva vive aqui.
 */
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

    // A trilha sandbox e imutável. Depois que este evento foi estornado por
    // bloqueio, qualquer replay assinado precisa continuar reconhecido sem
    // alcançar a confirmação da reserva, mesmo se o bloqueio já foi revogado.
    if (
      evento.status === "SUCESSO" &&
      await this.sandboxAudit.jaRegistrouPagamentoBloqueado(provider, evento.providerEventId)
    ) {
      return evento;
    }

    try {
      await this.reservaService.confirmarPagamento(evento.idReserva, {
        status: evento.status,
        metodo: evento.metodo,
      });
    } catch (error) {
      // Um recebimento assinado para conta bloqueada é reconhecido e estornado
      // apenas no sandbox. Não propagamos 403 ao gateway, evitando reentregas
      // infinitas; a reserva continua sem confirmação, código ou início.
      if (error instanceof HttpError && error.status === 403 && evento.status === "SUCESSO") {
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
