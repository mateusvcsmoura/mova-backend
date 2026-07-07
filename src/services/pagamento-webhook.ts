import type { IncomingHttpHeaders } from "node:http";

import { HttpError } from "../errors/HttpError.js";
import type { PagamentoEvento, PaymentGateway } from "../infra/payment/gateway.js";
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

    await this.reservaService.confirmarPagamento(evento.idReserva, {
      status: evento.status,
      metodo: evento.metodo,
    });

    return evento;
  };
}
