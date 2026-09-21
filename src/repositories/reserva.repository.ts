import { MetodoPagamento, StatusPagamento, StatusReserva } from "@prisma/client";
import {
  CreateReservaRequest,
  ReservaFilters,
  ReservaResponse,
  ReservaVeiculoResponse,
  UpdateReservaRequest,
} from "./contracts/reserva.contract.js";
import {
  PaginatedResult,
  PaginationParams,
} from "../shared/pagination.js";

export interface IReservaRepository {
  hasCobrancaFinanceiraPendente(idLocatario: string): Promise<boolean>;
  /**
   * Registra a cobrança da reserva e marca o pagamento como PROCESSANDO.
   * O valor vem da própria reserva — nunca do cliente.
   */
  registrarPagamentoIniciado(
    idReserva: string,
    metodoPagamento: MetodoPagamento,
  ): Promise<ReservaResponse>;

  findAll(
    pagination: PaginationParams,
  ): Promise<PaginatedResult<ReservaResponse>>;
  findById(id: string): Promise<ReservaResponse | null>;
  findByLocatarioId(
    idLocatario: string,
    pagination: PaginationParams,
  ): Promise<PaginatedResult<ReservaResponse>>;
  findByVeiculoId(
    idVeiculo: string,
    pagination: PaginationParams,
  ): Promise<PaginatedResult<ReservaVeiculoResponse>>;
  search(
    filters: ReservaFilters,
    pagination: PaginationParams,
  ): Promise<PaginatedResult<ReservaResponse>>;
  findByCodigoDesbloqueio(codigo: string): Promise<ReservaResponse | null>;
  create(data: CreateReservaRequest): Promise<ReservaResponse>;
  update(id: string, data: UpdateReservaRequest): Promise<ReservaResponse>;
  atualizarStatusPagamento(
    id: string,
    statusPagamento: StatusPagamento,
    metodoPagamento?: MetodoPagamento,
  ): Promise<ReservaResponse>;
  delete(id: string): Promise<void>;
  // Persiste o código de desbloqueio gerado na confirmação do pagamento.
  gerarCodigoDesbloqueio(
    id: string,
    codigo: string,
    geradoEm: Date,
    // Status a aplicar junto com o código (pagamento aprovado → CONFIRMADA).
    status?: StatusReserva,
  ): Promise<ReservaResponse>;
  // Marca o código como usado (desbloqueio efetivado) e aplica o status da
  // transição (desbloqueio → EM_ANDAMENTO), na mesma escrita.
  marcarCodigoComoUsado(
    id: string,
    usadoEm: Date,
    status?: StatusReserva,
  ): Promise<ReservaResponse>;
  // RN04: cancela a reserva de forma atômica — registra a cobrança de multa
  // (valor 0 quando dentro do prazo) e transiciona status para CANCELADA.
  cancelar(id: string, multa: number): Promise<ReservaResponse>;
  // RN06: registra a devolução — grava devolvidoEm, transiciona para REALIZADA
  // e, quando valorCobranca > 0, lança a cobrança de atraso (transacional).
  devolver(
    id: string,
    devolvidoEm: Date,
    valorCobranca: number,
  ): Promise<ReservaResponse>;
  // Existe reserva ativa do veículo que colide com o período informado?
  hasOverlapForVeiculo(
    idVeiculo: string,
    dataHoraInicio: Date,
    dataHoraFim: Date,
    excludeReservaId?: string,
  ): Promise<boolean>;
}
