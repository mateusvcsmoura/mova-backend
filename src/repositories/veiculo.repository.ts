import {
  CreateVeiculoLoteRequest,
  CreateVeiculoRequest,
  ModeloVeiculoResponse,
  UpdateModeloVeiculoRequest,
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
  createLote(data: CreateVeiculoLoteRequest): Promise<VeiculoResponse[]>;
  update(id: string, data: UpdateVeiculoRequest): Promise<VeiculoResponse>;
  delete(id: string): Promise<void>;
  updateModelo(id: string, data: UpdateModeloVeiculoRequest): Promise<ModeloVeiculoResponse>;
  updateModeloDoVeiculo(id: string, data: UpdateModeloVeiculoRequest): Promise<VeiculoResponse>;
}