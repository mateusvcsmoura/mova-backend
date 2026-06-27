import {
  DeficienciaResponse,
  CreateDeficienciaRequest,
  UpdateDeficienciaRequest,
} from "./contracts/deficiencia.contract.js";
import {
  PaginatedResult,
  PaginationParams,
} from "../shared/pagination.js";

export interface IDeficienciaRepository {
  findAll(
    pagination: PaginationParams,
  ): Promise<PaginatedResult<DeficienciaResponse>>;
  findById(id: string): Promise<DeficienciaResponse | null>;
  findByDescription(descricao: string): Promise<DeficienciaResponse | null>;
  create(data: CreateDeficienciaRequest): Promise<DeficienciaResponse>;
  update(
    id: string,
    data: UpdateDeficienciaRequest,
  ): Promise<DeficienciaResponse | null>;
  delete(id: string): Promise<void>;
}
