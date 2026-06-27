import {
  LocadorResponse,
  CreateLocadorRequest,
  UpdateLocadorRequest,
} from "./contracts/locador.contract";
import {
  PaginatedResult,
  PaginationParams,
} from "../shared/pagination.js";

export interface ILocadorRepository {
  findAll(pagination: PaginationParams): Promise<PaginatedResult<LocadorResponse>>;
  findById(id: string): Promise<LocadorResponse | null>;
  findByCnpj(cnpj: string): Promise<LocadorResponse | null>;
  findByEmpresa(
    empresa: string,
    pagination: PaginationParams,
  ): Promise<PaginatedResult<LocadorResponse>>;
  create(data: CreateLocadorRequest): Promise<LocadorResponse>;
  update(
    id: string,
    data: UpdateLocadorRequest,
  ): Promise<LocadorResponse | null>;
  delete(id: string): Promise<void>;
}
