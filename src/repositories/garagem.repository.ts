import {
  CreateGaragemRequest,
  GaragemBaseResponse,
  GaragemDetalhadaResponse,
  GaragemFilters,
  GaragemListResponse,
  GaragemVeiculosFilters,
  UpdateGaragemRequest,
} from "./contracts/garagem.contract.js";
import { VeiculoResponse } from "./contracts/veiculo.contract.js";

export interface IGaragemRepository {
  findAll(filters: GaragemFilters): Promise<GaragemListResponse>;
  findById(id: string): Promise<GaragemDetalhadaResponse | null>;
  findVeiculosByGaragem(
    garagemId: string,
    filters?: GaragemVeiculosFilters,
  ): Promise<VeiculoResponse[]>;
  create(data: CreateGaragemRequest): Promise<GaragemBaseResponse>;
  update(
    id: string,
    data: UpdateGaragemRequest,
  ): Promise<GaragemBaseResponse | null>;
  delete(id: string): Promise<void>;
  alocarVeiculo(garagemId: string, veiculoId: string): Promise<void>;
  desalocarVeiculo(garagemId: string, veiculoId: string): Promise<void>;
}
