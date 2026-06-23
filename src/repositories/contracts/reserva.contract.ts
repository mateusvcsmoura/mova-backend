import { Cargo, StatusPagamento, StatusReserva } from "@prisma/client";

export interface CreateReservaRequest {
  idVeiculo: string;
  idLocatario: string;
  dataHoraInicio: Date;
  dataHoraFim: Date;
  valorTotal: number;
  status?: StatusReserva;
  statusPagamento?: StatusPagamento;
}

export interface UpdateReservaRequest {
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
  dataHoraInicio: Date;
  dataHoraFim: Date;
  criadaEm: Date;
  valorTotal: number;
  status: StatusReserva;
  statusPagamento: StatusPagamento;
  atualizadoEm: Date;
}
