import { MetodoPagamento, StatusPagamento } from "@prisma/client";

import { HttpError } from "../../errors/HttpError.js";

/**
 * Sandbox de pagamento.
 *
 * Nenhum dinheiro é movimentado. O desfecho é decidido pelo BACKEND a partir
 * dos dados de teste enviados — como fazem os sandboxes reais (Stripe, Mercado
 * Pago), em que números de cartão específicos forçam aprovação ou recusa.
 *
 * Isso é deliberado: o cliente informa os dados, nunca o resultado. Não existe
 * nenhum campo em que o frontend diga "aprovado".
 */

/** Sufixos de cartão que forçam um desfecho, no estilo dos sandboxes reais. */
export const CARTAO_SANDBOX = {
  /** Termina em 0000 → recusado pelo emissor. */
  FALHA: "0000",
  /** Termina em 0001 → fica pendente (análise antifraude). */
  PROCESSANDO: "0001",
} as const;

export interface DadosCartaoSandbox {
  numero: string;
  nome: string;
  validade: string;
  cvv: string;
}

export interface DadosPagamentoSandbox {
  metodoPagamento: MetodoPagamento;
  cartao?: DadosCartaoSandbox;
}

const METODOS_COM_CARTAO: MetodoPagamento[] = [
  MetodoPagamento.CARTAO_CREDITO,
  MetodoPagamento.CARTAO_DEBITO,
];

export function exigeCartao(metodo: MetodoPagamento): boolean {
  return METODOS_COM_CARTAO.includes(metodo);
}

/**
 * Decide o desfecho do pagamento de teste.
 *
 * - Cartão terminado em 0000 → FALHA
 * - Cartão terminado em 0001 → PROCESSANDO (fica pendente, sem confirmar)
 * - Qualquer outro cartão     → SUCESSO
 * - PIX / carteira digital    → SUCESSO (caminho feliz do sandbox)
 *
 * Lança 400 quando o método exige cartão e ele não veio — validação de forma,
 * não de resultado.
 */
export function decidirDesfechoSandbox(
  dados: DadosPagamentoSandbox,
): StatusPagamento {
  if (!exigeCartao(dados.metodoPagamento)) {
    return StatusPagamento.SUCESSO;
  }

  if (!dados.cartao) {
    throw new HttpError(
      400,
      "Dados do cartão são obrigatórios para este método de pagamento.",
    );
  }

  const digitos = dados.cartao.numero.replace(/\D/g, "");
  if (digitos.length < 13 || digitos.length > 19) {
    throw new HttpError(400, "Número de cartão inválido.");
  }

  const sufixo = digitos.slice(-4);
  if (sufixo === CARTAO_SANDBOX.FALHA) return StatusPagamento.FALHA;
  if (sufixo === CARTAO_SANDBOX.PROCESSANDO) return StatusPagamento.PROCESSANDO;
  return StatusPagamento.SUCESSO;
}

/** Evento canônico que o gateway (real ou simulado) entrega ao webhook. */
export function montarEventoWebhook(
  idReserva: string,
  status: StatusPagamento,
  metodo: MetodoPagamento,
): string {
  const EVENTO_POR_STATUS: Record<string, string> = {
    [StatusPagamento.SUCESSO]: "pagamento.sucesso",
    [StatusPagamento.FALHA]: "pagamento.falha",
    [StatusPagamento.PROCESSANDO]: "pagamento.processando",
  };

  return JSON.stringify({
    idReserva,
    evento: EVENTO_POR_STATUS[status],
    metodo,
  });
}
