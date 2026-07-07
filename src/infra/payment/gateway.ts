import crypto from "node:crypto";
import type { IncomingHttpHeaders } from "node:http";
import { MetodoPagamento, StatusPagamento } from "@prisma/client";

import { env } from "../../config/env.js";
import { HttpError } from "../../errors/HttpError.js";

// Evento de pagamento já traduzido para o domínio — o resto da aplicação nunca
// vê o formato bruto do gateway. É aqui que o "fluxo interno" começa.
export interface PagamentoEvento {
  idReserva: string;
  status: StatusPagamento;
  metodo?: MetodoPagamento;
}

// Abstração de gateway de pagamento. Novos provedores (Mercado Pago, Stripe,
// Asaas, ...) implementam esta interface — o webhook service só depende dela.
export interface PaymentGateway {
  readonly nome: string;
  // Valida a assinatura sobre o CORPO CRU (bytes exatos recebidos). Não lança:
  // retorna false quando inválida ou quando o segredo não está configurado.
  verificarAssinatura(rawBody: Buffer, headers: IncomingHttpHeaders): boolean;
  // Traduz o payload bruto do gateway para o evento de domínio.
  parseEvento(rawBody: Buffer): PagamentoEvento;
}

// HMAC-SHA256 do corpo cru em hex. Exportado para os testes assinarem payloads
// com o mesmo esquema que a verificação usa.
export function assinarPayload(secret: string, rawBody: Buffer): string {
  return crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
}

function assinaturaConfere(
  secret: string | undefined,
  rawBody: Buffer,
  recebida: string | undefined,
): boolean {
  if (!secret || !recebida) return false;
  const esperada = assinarPayload(secret, rawBody);
  const a = Buffer.from(esperada);
  const b = Buffer.from(recebida);
  // timingSafeEqual exige buffers do mesmo tamanho.
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// Mapeia o tipo de evento (string do gateway) para o status de domínio.
const EVENTO_STATUS: Record<string, StatusPagamento> = {
  "pagamento.sucesso": StatusPagamento.SUCESSO,
  "pagamento.falha": StatusPagamento.FALHA,
  "pagamento.processando": StatusPagamento.PROCESSANDO,
};

/**
 * Gateway baseado em HMAC. Provedores reais diferem só no header de assinatura
 * e no segredo — o esquema HMAC-SHA256 sobre o corpo cru é o denominador comum.
 *
 * `não integrar gateway real`: parseEvento espera um payload canônico
 * `{ idReserva, evento, metodo? }`. Para um provedor real, é AQUI que se mapeia
 * o formato específico dele (ex.: Stripe `type`/`data.object`) — o resto da
 * aplicação não muda.
 */
class PaymentGatewayHmac implements PaymentGateway {
  constructor(
    readonly nome: string,
    private readonly secret: string | undefined,
    private readonly signatureHeader: string,
  ) {}

  verificarAssinatura(rawBody: Buffer, headers: IncomingHttpHeaders): boolean {
    const bruto = headers[this.signatureHeader];
    const recebida = Array.isArray(bruto) ? bruto[0] : bruto;
    return assinaturaConfere(this.secret, rawBody, recebida);
  }

  parseEvento(rawBody: Buffer): PagamentoEvento {
    let payload: unknown;
    try {
      payload = JSON.parse(rawBody.toString("utf8"));
    } catch {
      throw new HttpError(400, "Payload de webhook inválido (JSON malformado).");
    }
    const p = payload as {
      idReserva?: string;
      evento?: string;
      metodo?: MetodoPagamento;
    };
    const status = p.evento ? EVENTO_STATUS[p.evento] : undefined;
    if (!p.idReserva || !status) {
      throw new HttpError(400, "Payload de webhook inválido.");
    }
    return { idReserva: p.idReserva, status, metodo: p.metodo };
  }
}

// Registro dos gateways suportados. Header de assinatura segue a convenção de
// cada provedor; o segredo vem do env (gateway sem segredo rejeita tudo).
export function construirGatewaysPagamento(): Map<string, PaymentGateway> {
  const gateways: PaymentGateway[] = [
    new PaymentGatewayHmac(
      "mercadopago",
      env.MERCADOPAGO_WEBHOOK_SECRET,
      "x-mp-signature",
    ),
    new PaymentGatewayHmac(
      "stripe",
      env.STRIPE_WEBHOOK_SECRET,
      "stripe-signature",
    ),
    new PaymentGatewayHmac("asaas", env.ASAAS_WEBHOOK_SECRET, "asaas-signature"),
  ];
  return new Map(gateways.map((g) => [g.nome, g]));
}
