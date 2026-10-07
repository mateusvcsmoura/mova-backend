import { randomUUID } from "node:crypto";
import { Cargo, StatusPagamento, StatusReserva } from "@prisma/client";

import { env } from "../config/env.js";
import { HttpError } from "../errors/HttpError.js";
import { assinarPayload, HEADER_ASSINATURA } from "../infra/payment/gateway.js";
import {
  DadosPagamentoSandbox,
  decidirDesfechoSandbox,
  montarEventoWebhook,
} from "../infra/payment/sandbox.js";
import { IReservaRepository } from "../repositories/reserva.repository.js";
import { ReservaResponse } from "../repositories/contracts/reserva.contract.js";
import type { PagamentoWebhookService } from "./pagamento-webhook.js";

export interface PagamentoAccessContext {
  id: string;
  cargo: Cargo;
}

export interface IniciarPagamentoResultado {
  /** Estado da reserva após o registro da cobrança (e do webhook, se síncrono). */
  reserva: ReservaResponse;
  /** Valor cobrado — calculado pelo backend, nunca informado pelo cliente. */
  valorCobrado: number;
  /** Provedor de sandbox que entrega o webhook. */
  provider: string;
}

export class PagamentoService {
  constructor(
    private readonly reservaRepository: IReservaRepository,
    private readonly webhookService: PagamentoWebhookService,
  ) {}

  private assertAcesso(
    requester: PagamentoAccessContext,
    idLocatario: string,
  ): void {
    if (requester.cargo === Cargo.ADMIN) return;
    if (requester.id !== idLocatario) {
      throw new HttpError(403, "Acesso negado");
    }
  }

  iniciar = async (
    idReserva: string,
    dados: DadosPagamentoSandbox,
    requester: PagamentoAccessContext,
  ): Promise<IniciarPagamentoResultado> => {
    const reserva = await this.reservaRepository.findById(idReserva);
    if (!reserva) {
      throw new HttpError(404, "Reserva não encontrada");
    }

    this.assertAcesso(requester, reserva.idLocatario);

    // Idempotência de entrada: pagamento já aprovado não é reprocessado.
    if (reserva.statusPagamento === StatusPagamento.SUCESSO) {
      throw new HttpError(409, "O pagamento desta reserva já foi aprovado.");
    }

    // findById já expirou a reserva se o prazo de 15 min venceu (D10-03).
    if (reserva.status === StatusReserva.CANCELADA && reserva.expiradaEm) {
      throw new HttpError(409, "O prazo de pagamento desta reserva expirou. Faça uma nova reserva.");
    }
    if (reserva.status === StatusReserva.CANCELADA) {
      throw new HttpError(409, "Reserva cancelada.");
    }

    const desfecho = decidirDesfechoSandbox(dados);

    const emProcessamento =
      await this.reservaRepository.registrarPagamentoIniciado(
        idReserva,
        dados.metodoPagamento,
      );
    const valorCobrado = Number(emProcessamento.valorTotal);

    const provider = env.PAGAMENTO_SANDBOX_PROVIDER;

    if (desfecho === StatusPagamento.PROCESSANDO) {
      return { reserva: emProcessamento, valorCobrado, provider };
    }

    const entregar = () =>
      this.entregarWebhookAssinado(idReserva, desfecho, dados);

    if (env.PAGAMENTO_SIMULADOR_DELAY_MS <= 0) {
      // Sem atraso (testes): resolve na mesma requisição, deterministicamente.
      await entregar();
      const atualizada = await this.reservaRepository.findById(idReserva);
      return {
        reserva: atualizada ?? emProcessamento,
        valorCobrado,
        provider,
      };
    }

    const timer = setTimeout(() => {
      void entregar().catch((erro) => {
        console.error("[pagamento-sandbox] falha ao entregar webhook:", erro);
      });
    }, env.PAGAMENTO_SIMULADOR_DELAY_MS);
    timer.unref?.();

    return { reserva: emProcessamento, valorCobrado, provider };
  };

  private entregarWebhookAssinado = async (
    idReserva: string,
    status: StatusPagamento,
    dados: DadosPagamentoSandbox,
  ): Promise<void> => {
    const provider = env.PAGAMENTO_SANDBOX_PROVIDER;
    const segredo = this.segredoDoProvider(provider);
    if (!segredo) {
      throw new HttpError(
        500,
        `Sandbox de pagamento indisponível: segredo do gateway "${provider}" não configurado.`,
      );
    }

    const corpo = montarEventoWebhook(
      idReserva,
      status,
      dados.metodoPagamento,
      `sandbox:${provider}:${idReserva}:${status}:${randomUUID()}`,
    );
    const bytes = Buffer.from(corpo, "utf8");
    const assinatura = assinarPayload(segredo, bytes);
    const header = HEADER_ASSINATURA[provider] ?? HEADER_ASSINATURA.mercadopago;

    await this.webhookService.processar(provider, bytes, {
      [header]: assinatura,
    });
  };

  private segredoDoProvider(provider: string): string | undefined {
    const segredos: Record<string, string | undefined> = {
      mercadopago: env.MERCADOPAGO_WEBHOOK_SECRET,
      stripe: env.STRIPE_WEBHOOK_SECRET,
      asaas: env.ASAAS_WEBHOOK_SECRET,
    };
    return segredos[provider];
  }
}
