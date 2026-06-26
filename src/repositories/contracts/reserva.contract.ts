import { Cargo, StatusPagamento, StatusReserva } from "@prisma/client";

export interface CreateReservaRequest {
  idVeiculo: string;
  idLocatario: string;
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
