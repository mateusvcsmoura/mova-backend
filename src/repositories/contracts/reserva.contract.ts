import {
  Cargo,
  MetodoPagamento,
  StatusPagamento,
  StatusReserva,
} from "@prisma/client";
import { PaginationParams } from "../../shared/pagination.js";
import { VeiculoResponse } from "./veiculo.contract.js";

// Serviço opcional já resolvido (id + valor snapshot), pronto para persistir.
// Preenchido pelo ReservaService após validar os IDs contra o catálogo.
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
  // Deficiência informada durante a reserva (para veículos adaptados, quando o
  // locatário ainda não possui uma cadastrada). Não é persistida na Reserva.
  deficienciaId?: string;
  idGaragemRetirada?: string;
  idGaragemDevolucao?: string;
  dataHoraInicio: Date;
  dataHoraFim: Date;
  // valorTotal é CALCULADO pelo ReservaService (diária × diárias + serviços).
  // Nunca chega do cliente.
  valorTotal: number;
  // Forma de pagamento escolhida (RF11).
  metodoPagamento?: MetodoPagamento;
  // IDs dos serviços opcionais selecionados pelo locatário (entrada do cliente).
  servicosIds?: string[];
  // Serviços resolvidos (id + valor snapshot) — preenchido pelo service e
  // consumido pelo repositório para criar as associações.
  servicos?: ReservaServicoInput[];
  // RN01: deficiência a associar ao locatário na MESMA transação da criação
  // (veículo PCD sem deficiência já cadastrada). undefined = nada a associar.
  deficienciaIdParaAssociar?: string;
}

/**
 * O que o CLIENTE pode enviar ao criar uma reserva. Não inclui valorTotal
 * (calculado pelo ReservaService a partir da diária do modelo) nem os campos
 * internos preenchidos pelo próprio service antes de chegar ao repositório.
 */
export type CreateReservaInput = Omit<
  CreateReservaRequest,
  "valorTotal" | "servicos" | "deficienciaIdParaAssociar"
>;

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
  detalhesCobertura?: string | null;
  valor: number;
}

// Dados necessários para identificar os locais da jornada sem exigir uma
// consulta por reserva no frontend.
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
  cobrancaAtraso?: number;
  multaCancelamento?: number;
  // Serviços opcionais vinculados a esta reserva.
  servicos: ReservaServicoResponse[];
  // Veículo da reserva, já com o modelo aninhado. Mesmo formato de
  // GET /api/veiculo/:id — o cliente reaproveita a normalização.
  veiculo: VeiculoResponse;
  atualizadoEm: Date;
}
