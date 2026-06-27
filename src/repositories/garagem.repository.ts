import {
  CreateGaragemRequest,
  GaragemBaseResponse,
  GaragemDetalhadaResponse,
  GaragemFilters,
  GaragemVeiculosFilters,
  UpdateGaragemRequest,
} from "./contracts/garagem.contract.js";
import { VeiculoResponse } from "./contracts/veiculo.contract.js";
import {
  PaginatedResult,
  PaginationParams,
} from "../shared/pagination.js";

export interface IGaragemRepository {
  findAll(
    filters: GaragemFilters,
    pagination: PaginationParams,
  ): Promise<PaginatedResult<GaragemBaseResponse>>;
  findById(id: string): Promise<GaragemDetalhadaResponse | null>;
  findVeiculosByGaragem(
    garagemId: string,
    pagination: PaginationParams,
    filters?: GaragemVeiculosFilters,
  ): Promise<PaginatedResult<VeiculoResponse>>;
  create(data: CreateGaragemRequest): Promise<GaragemBaseResponse>;
  update(
    id: string,
    data: UpdateGaragemRequest,
  ): Promise<GaragemBaseResponse | null>;
  delete(id: string): Promise<void>;
  alocarVeiculo(garagemId: string, veiculoId: string): Promise<void>;
  desalocarVeiculo(garagemId: string, veiculoId: string): Promise<void>;
}
