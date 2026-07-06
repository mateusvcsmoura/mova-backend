import {
  CreateVeiculoLoteRequest,
  CreateVeiculoRequest,
  ModeloVeiculoResponse,
  UpdateModeloVeiculoRequest,
  UpdateVeiculoRequest,
  VeiculoFilters,
  VeiculoResponse,
} from "./contracts/veiculo.contract.js";
import {
  PaginatedResult,
  PaginationParams,
} from "../shared/pagination.js";

export interface IVeiculoRepository {
  findAll(
    pagination: PaginationParams,
  ): Promise<PaginatedResult<VeiculoResponse>>;
  findByLocadorId(
    idLocador: string,
    pagination: PaginationParams,
  ): Promise<PaginatedResult<VeiculoResponse>>;
  findById(id: string): Promise<VeiculoResponse | null>;
  findByPlaca(placa: string): Promise<VeiculoResponse | null>;
  // Modelo por id — usado para validar ownership antes de alterar o modelo.
  findModeloById(id: string): Promise<ModeloVeiculoResponse | null>;
  search(
    filters: VeiculoFilters,
    pagination: PaginationParams,
  ): Promise<PaginatedResult<VeiculoResponse>>;
  create(data: CreateVeiculoRequest): Promise<VeiculoResponse>;
  createLote(data: CreateVeiculoLoteRequest): Promise<VeiculoResponse[]>;
  update(id: string, data: UpdateVeiculoRequest): Promise<VeiculoResponse>;
  delete(id: string): Promise<void>;
  updateModelo(id: string, data: UpdateModeloVeiculoRequest): Promise<ModeloVeiculoResponse>;
  updateModeloDoVeiculo(id: string, data: UpdateModeloVeiculoRequest): Promise<VeiculoResponse>;
}