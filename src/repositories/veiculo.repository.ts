import type { AtorAuditoria } from "./prisma/auditoria.js";
import {
  CreateVeiculoLoteRequest,
  CreateVeiculoRequest,
  ModeloVeiculoData,
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
  findForInteresse(
    pagination: PaginationParams,
  ): Promise<PaginatedResult<VeiculoResponse>>;
  create(data: CreateVeiculoRequest, ator?: AtorAuditoria): Promise<VeiculoResponse>;
  createLote(data: CreateVeiculoLoteRequest, ator?: AtorAuditoria): Promise<VeiculoResponse[]>;
  update(id: string, data: UpdateVeiculoRequest, ator?: AtorAuditoria): Promise<VeiculoResponse>;
  delete(id: string, ator?: AtorAuditoria): Promise<void>;
  updateModelo(id: string, data: UpdateModeloVeiculoRequest, ator?: AtorAuditoria): Promise<ModeloVeiculoResponse>;
  updateModeloDoVeiculo(id: string, data: ModeloVeiculoData, ator?: AtorAuditoria): Promise<VeiculoResponse>;
}
