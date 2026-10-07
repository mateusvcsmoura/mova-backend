import crypto from "node:crypto";
import type { IncomingHttpHeaders } from "node:http";
import { MetodoPagamento, StatusPagamento } from "@prisma/client";

import { env } from "../../config/env.js";
import { HttpError } from "../../errors/HttpError.js";

export interface PagamentoEvento {
  idReserva: string;
  providerEventId: string;
  status: StatusPagamento;
  metodo?: MetodoPagamento;
}

export interface PaymentGateway {
  readonly nome: string;
  verificarAssinatura(rawBody: Buffer, headers: IncomingHttpHeaders): boolean;
  // Traduz o payload bruto do gateway para o evento de domínio.
  parseEvento(rawBody: Buffer): PagamentoEvento;
}

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
      providerEventId?: string;
      evento?: string;
      metodo?: MetodoPagamento;
    };
    const status = p.evento ? EVENTO_STATUS[p.evento] : undefined;
    if (
      !p.idReserva ||
      typeof p.providerEventId !== "string" ||
      p.providerEventId.length === 0 ||
      !status
    ) {
      throw new HttpError(400, "Payload de webhook inválido.");
    }
    return {
      idReserva: p.idReserva,
      providerEventId: p.providerEventId,
      status,
      metodo: p.metodo,
    };
  }
}

export const HEADER_ASSINATURA: Record<string, string> = {
  mercadopago: "x-mp-signature",
  stripe: "stripe-signature",
  asaas: "asaas-signature",
};

export function construirGatewaysPagamento(): Map<string, PaymentGateway> {
  const gateways: PaymentGateway[] = [
    new PaymentGatewayHmac(
      "mercadopago",
      env.MERCADOPAGO_WEBHOOK_SECRET,
      HEADER_ASSINATURA.mercadopago,
    ),
    new PaymentGatewayHmac(
      "stripe",
      env.STRIPE_WEBHOOK_SECRET,
      HEADER_ASSINATURA.stripe,
    ),
    new PaymentGatewayHmac("asaas", env.ASAAS_WEBHOOK_SECRET, HEADER_ASSINATURA.asaas),
  ];
  return new Map(gateways.map((g) => [g.nome, g]));
}
