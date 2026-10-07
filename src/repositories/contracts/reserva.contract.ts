import {
  Cargo,
  MetodoPagamento,
  StatusPagamento,
  StatusReserva,
} from "@prisma/client";
import { PaginationParams } from "../../shared/pagination.js";
import { VeiculoResponse } from "./veiculo.contract.js";

export interface ReservaServicoInput {
  idServico: string;
  valor: number;
  nome?: string;
  descricao?: string;
  detalhesCobertura?: string | null;
}

export interface CreateReservaRequest {
  idVeiculo: string;
  idLocatario: string;
  deficienciaId?: string;
  idGaragemRetirada?: string;
  idGaragemDevolucao?: string;
  dataHoraInicio: Date;
  dataHoraFim: Date;
  valorTotal: number;
  // Forma de pagamento escolhida (RF11).
  metodoPagamento?: MetodoPagamento;
  // IDs dos serviços opcionais selecionados pelo locatário (entrada do cliente).
  servicosIds?: string[];
  servicos?: ReservaServicoInput[];
  deficienciaIdParaAssociar?: string;
}

export type CreateReservaInput = Omit<
  CreateReservaRequest,
  "valorTotal" | "servicos" | "deficienciaIdParaAssociar"
>;

/** Public, read-only quote request. It contains no tenant identity or PII. */
export interface QuoteReservaInput {
  idVeiculo: string;
  idGaragemRetirada?: string;
  idGaragemDevolucao?: string;
  dataHoraInicio: Date;
  dataHoraFim: Date;
  servicosIds?: string[];
}

export interface UpdateReservaRequest {
  idGaragemDevolucao?: string;
  dataHoraInicio?: Date;
  dataHoraFim?: Date;
  metodoPagamento?: MetodoPagamento;
  // Interno: preenchido pelo service depois do recálculo; nunca vem do HTTP.
  valorTotalCalculado?: number;
}

export interface ReservaFilters {
  idVeiculo?: string;
  idLocatario?: string;
  idLocador?: string; // filtra pelas reservas dos veículos de um locador
  status?: StatusReserva;
  statusPagamento?: StatusPagamento;
}

// Usado pelo service.list(), montado pelo controller
export interface ListReservasRequest {
  id: string;
  cargo: Cargo;
  filters?: ReservaFilters;
  pagination: PaginationParams;
}

// Serviço opcional contratado, como retornado nas consultas de reserva.
export interface ReservaServicoResponse {
  idServico: string;
  nome: string;
  descricao: string;
  detalhesCobertura?: string | null;
  valor: number;
}

export interface ReservaGaragemResponse {
  id: string;
  nome: string;
  endereco: string;
  status: string;
}

export interface ReservaResponse {
  id: string;
  idVeiculo: string;
  idLocatario: string;
  idGaragemRetirada: string | null;
  idGaragemDevolucao: string | null;
  garagemRetirada: ReservaGaragemResponse | null;
  garagemDevolucao: ReservaGaragemResponse | null;
  dataHoraInicio: Date;
  dataHoraFim: Date;
  criadaEm: Date;
  valorTotal: number;
  status: StatusReserva;
  statusPagamento: StatusPagamento;
  metodoPagamento: MetodoPagamento | null;
  codigoDesbloqueio: string | null;
  codigoGeradoEm: Date | null;
  codigoUsadoEm: Date | null;
  // RN06: instante da devolução real (nulo até devolver).
  devolvidoEm: Date | null;
  // Task 10: preenchido quando a reserva expirou sem pagamento (15 min).
  expiradaEm?: Date | null;
  cobrancaAtraso?: number;
  multaCancelamento?: number;
  // Serviços opcionais vinculados a esta reserva.
  servicos: ReservaServicoResponse[];
  veiculo: VeiculoResponse;
  atualizadoEm: Date;
}

export type ReservaVeiculoResponse = Omit<ReservaResponse, "codigoDesbloqueio">;
