import type { AtorAuditoria } from "./prisma/auditoria.js";
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
  update(id: string, data: UpdateReservaRequest, ator?: AtorAuditoria): Promise<ReservaResponse>;
  atualizarStatusPagamento(
    id: string,
    statusPagamento: StatusPagamento,
    metodoPagamento?: MetodoPagamento,
  ): Promise<ReservaResponse>;
  // Persiste o código de desbloqueio gerado na confirmação do pagamento.
  gerarCodigoDesbloqueio(
    id: string,
    codigo: string,
    geradoEm: Date,
    // Status a aplicar junto com o código (pagamento aprovado → CONFIRMADA).
    status?: StatusReserva,
  ): Promise<ReservaResponse>;
  marcarCodigoComoUsado(
    id: string,
    usadoEm: Date,
    status?: StatusReserva,
  ): Promise<ReservaResponse>;
  cancelar(id: string, multa: number, provider?: string, ator?: AtorAuditoria): Promise<ReservaResponse>;
  devolver(
    id: string,
    devolvidoEm: Date,
    valorCobranca: number,
    ator?: AtorAuditoria,
  ): Promise<ReservaResponse>;
  // Existe reserva ativa do veículo que colide com o período informado?
  hasOverlapForVeiculo(
    idVeiculo: string,
    dataHoraInicio: Date,
    dataHoraFim: Date,
    excludeReservaId?: string,
  ): Promise<boolean>;
}
