import {
  Cargo,
  MetodoPagamento,
  StatusPagamento,
  StatusReserva,
} from "@prisma/client";
import { PaginationParams } from "../../shared/pagination.js";

// Serviço opcional já resolvido (id + valor snapshot), pronto para persistir.
// Preenchido pelo ReservaService após validar os IDs contra o catálogo.
export interface ReservaServicoInput {
  idServico: string;
  valor: number;
}

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
  // valorTotal recebido é o valor base; o ReservaService soma os serviços
  // opcionais selecionados antes de persistir.
  valorTotal: number;
  status?: StatusReserva;
  statusPagamento?: StatusPagamento;
  // Forma de pagamento escolhida (RF11).
  metodoPagamento?: MetodoPagamento;
  // IDs dos serviços opcionais selecionados pelo locatário (entrada do cliente).
  servicosIds?: string[];
  // Serviços resolvidos (id + valor snapshot) — preenchido pelo service e
  // consumido pelo repositório para criar as associações.
  servicos?: ReservaServicoInput[];
}

export interface UpdateReservaRequest {
  idGaragemDevolucao?: string;
  dataHoraInicio?: Date;
  dataHoraFim?: Date;
  valorTotal?: number;
  status?: StatusReserva;
  statusPagamento?: StatusPagamento;
  metodoPagamento?: MetodoPagamento;
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
  valor: number;
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
  metodoPagamento: MetodoPagamento | null;
  codigoDesbloqueio: string | null;
  codigoGeradoEm: Date | null;
  codigoUsadoEm: Date | null;
  // RN06: instante da devolução real (nulo até devolver).
  devolvidoEm: Date | null;
  // Serviços opcionais vinculados a esta reserva.
  servicos: ReservaServicoResponse[];
  atualizadoEm: Date;
}
