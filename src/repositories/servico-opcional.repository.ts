import {
  CreateServicoOpcionalRequest,
  ServicoOpcionalFilters,
  ServicoOpcionalResponse,
  UpdateServicoOpcionalRequest,
} from "./contracts/servico-opcional.contract.js";
import {
  PaginatedResult,
  PaginationParams,
} from "../shared/pagination.js";

export interface IServicoOpcionalRepository {
  findAll(
    filters: ServicoOpcionalFilters,
    pagination: PaginationParams,
  ): Promise<PaginatedResult<ServicoOpcionalResponse>>;
  findById(id: string): Promise<ServicoOpcionalResponse | null>;
  // Busca serviços por uma lista de IDs. Por padrão, apenas os ativos
  // (disponíveis para contratação) são retornados.
  findByIds(
    ids: string[],
    apenasAtivos?: boolean,
  ): Promise<ServicoOpcionalResponse[]>;
  create(
    data: CreateServicoOpcionalRequest,
  ): Promise<ServicoOpcionalResponse>;
  update(
    id: string,
    data: UpdateServicoOpcionalRequest,
  ): Promise<ServicoOpcionalResponse | null>;
  delete(id: string): Promise<void>;
}
