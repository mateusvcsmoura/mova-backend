import { Cargo, StatusPagamento, StatusReserva } from "@prisma/client";
import { PaginationParams } from "../../shared/pagination.js";

export interface CreateReservaRequest {
  idVeiculo: string;
  idLocatario: string;
  // Deficiência informada durante a reserva (para veículos adaptados, quando o
  // locatário ainda não possui uma cadastrada). Não é persistida na Reserva.
  deficienciaId?: string;
  idGaragemRetirada?: string;
  idGaragemDevolucao?: string;
  dataHoraInicio: Date;
  dataHoraFim: Date;
  valorTotal: number;
  status?: StatusReserva;
  statusPagamento?: StatusPagamento;
}

export interface UpdateReservaRequest {
  idGaragemDevolucao?: string;
  dataHoraInicio?: Date;
  dataHoraFim?: Date;
  valorTotal?: number;
  status?: StatusReserva;
  statusPagamento?: StatusPagamento;
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

export interface ReservaResponse {
  id: string;
  idVeiculo: string;
  idLocatario: string;
  idGaragemRetirada: string | null;
  idGaragemDevolucao: string | null;
  dataHoraInicio: Date;
  dataHoraFim: Date;
  criadaEm: Date;
  valorTotal: number;
  status: StatusReserva;
  statusPagamento: StatusPagamento;
  codigoDesbloqueio: string | null;
  codigoGeradoEm: Date | null;
  codigoUsadoEm: Date | null;
  atualizadoEm: Date;
}
