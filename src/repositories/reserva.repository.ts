import {
  CreateReservaRequest,
  ReservaFilters,
  ReservaResponse,
  UpdateReservaRequest,
} from "./contracts/reserva.contract.js";
import {
  PaginatedResult,
  PaginationParams,
} from "../shared/pagination.js";

export interface IReservaRepository {
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
  ): Promise<PaginatedResult<ReservaResponse>>;
  search(
    filters: ReservaFilters,
    pagination: PaginationParams,
  ): Promise<PaginatedResult<ReservaResponse>>;
  findByCodigoDesbloqueio(codigo: string): Promise<ReservaResponse | null>;
  create(data: CreateReservaRequest): Promise<ReservaResponse>;
  update(id: string, data: UpdateReservaRequest): Promise<ReservaResponse>;
  delete(id: string): Promise<void>;
  // Persiste o código de desbloqueio gerado na confirmação do pagamento.
  gerarCodigoDesbloqueio(
    id: string,
    codigo: string,
    geradoEm: Date,
  ): Promise<ReservaResponse>;
  // Marca o código como usado (desbloqueio efetivado).
  marcarCodigoComoUsado(id: string, usadoEm: Date): Promise<ReservaResponse>;
  // Existe reserva ativa do veículo que colide com o período informado?
  hasOverlapForVeiculo(
    idVeiculo: string,
    dataHoraInicio: Date,
    dataHoraFim: Date,
    excludeReservaId?: string,
  ): Promise<boolean>;
}
