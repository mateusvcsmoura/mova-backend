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

/**
 * Início do pagamento de uma reserva.
 *
 * Desenho: este service NÃO confirma pagamento. Ele registra a cobrança, deixa
 * a reserva em PROCESSANDO e entrega o desfecho ao SIMULADOR DE GATEWAY, que
 * assina um webhook e o devolve pelo mesmo caminho de um gateway real
 * (PagamentoWebhookService → verificação de assinatura → ReservaService).
 *
 * Ou seja: a única porta que muda statusPagamento continua sendo o webhook
 * assinado. Não existe atalho, nem em sandbox.
 */
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

    if (reserva.status === StatusReserva.CANCELADA) {
      throw new HttpError(409, "Reserva cancelada.");
    }

    // Decide o desfecho ANTES de tocar no estado: erro de forma (cartão
    // ausente/inválido) não deve deixar a reserva em PROCESSANDO.
    const desfecho = decidirDesfechoSandbox(dados);

    // Registra a cobrança e coloca a reserva em PROCESSANDO. O valor vem da
    // reserva (calculado na criação), nunca do cliente.
    const valorCobrado = Number(reserva.valorTotal);
    const emProcessamento =
      await this.reservaRepository.registrarPagamentoIniciado(
        idReserva,
        valorCobrado,
        dados.metodoPagamento,
      );

    const provider = env.PAGAMENTO_SANDBOX_PROVIDER;

    // PROCESSANDO fica pendente: nenhum webhook é disparado. É o cenário de
    // análise antifraude — o pagamento só resolve quando o gateway decidir.
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

    // Com atraso: o cliente recebe PROCESSANDO e faz polling, como num gateway
    // real. Falha na entrega não derruba a requisição do usuário.
    const timer = setTimeout(() => {
      void entregar().catch((erro) => {
        console.error("[pagamento-sandbox] falha ao entregar webhook:", erro);
      });
    }, env.PAGAMENTO_SIMULADOR_DELAY_MS);
    timer.unref?.();

    return { reserva: emProcessamento, valorCobrado, provider };
  };

  /**
   * O simulador de gateway. Assina o payload canônico com o MESMO segredo e o
   * MESMO esquema HMAC que a verificação usa, e entrega pelo webhook service —
   * passando inclusive pela checagem de assinatura.
   */
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

    const corpo = montarEventoWebhook(idReserva, status, dados.metodoPagamento);
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
