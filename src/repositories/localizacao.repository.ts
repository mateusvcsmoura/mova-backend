import {
  CreateLocalizacaoRequest,
  LocalizacaoResponse,
} from "./contracts/localizacao.contract.js";
import {
  PaginatedResult,
  PaginationParams,
} from "../shared/pagination.js";

export interface ILocalizacaoRepository {
  // Registra um novo ponto. Nunca sobrescreve registros anteriores.
  create(data: CreateLocalizacaoRequest): Promise<LocalizacaoResponse>;
  // Histórico completo do veículo, ordenado cronologicamente (mais recente primeiro).
  findByVeiculoId(
    idVeiculo: string,
    pagination: PaginationParams,
  ): Promise<PaginatedResult<LocalizacaoResponse>>;
  // Apenas a última localização conhecida (ordenação + limite no banco).
  findLatestByVeiculoId(
    idVeiculo: string,
  ): Promise<LocalizacaoResponse | null>;
}
