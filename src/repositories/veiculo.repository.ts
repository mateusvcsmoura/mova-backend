import {
  CreateVeiculoRequest,
  UpdateVeiculoRequest,
  VeiculoFilters,
  VeiculoResponse,
} from "./contracts/veiculo.contract.js";

export interface IVeiculoRepository {
  findAll(): Promise<VeiculoResponse[]>;
  findByLocadorId(idLocador: string): Promise<VeiculoResponse[]>;
  findById(id: string): Promise<VeiculoResponse | null>;
  findByPlaca(placa: string): Promise<VeiculoResponse | null>;
  search(filters: VeiculoFilters): Promise<VeiculoResponse[]>;
  create(data: CreateVeiculoRequest): Promise<VeiculoResponse>;
  update(id: string, data: UpdateVeiculoRequest): Promise<VeiculoResponse>;
  delete(id: string): Promise<void>;
}
