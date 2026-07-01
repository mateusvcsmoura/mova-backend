import {
  CreateFavoritoRequest,
  FavoritoResponse,
} from "./contracts/favorito.contract.js";
import {
  PaginatedResult,
  PaginationParams,
} from "../shared/pagination.js";

export interface IFavoritoRepository {
  create(data: CreateFavoritoRequest): Promise<FavoritoResponse>;
  // Remoção pelo par (locatário, veículo) — o par é @@unique no schema.
  delete(idLocatario: string, idVeiculo: string): Promise<void>;
  exists(idLocatario: string, idVeiculo: string): Promise<boolean>;
  findByLocatarioAndVeiculo(
    idLocatario: string,
    idVeiculo: string,
  ): Promise<FavoritoResponse | null>;
  findByLocatarioId(
    idLocatario: string,
    pagination: PaginationParams,
  ): Promise<PaginatedResult<FavoritoResponse>>;
}
