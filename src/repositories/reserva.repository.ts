import {
  CreateReservaRequest,
  ReservaFilters,
  ReservaResponse,
  UpdateReservaRequest,
} from "./contracts/reserva.contract.js";

export interface IReservaRepository {
  findAll(): Promise<ReservaResponse[]>;
  findById(id: string): Promise<ReservaResponse | null>;
  findByLocatarioId(idLocatario: string): Promise<ReservaResponse[]>;
  findByVeiculoId(idVeiculo: string): Promise<ReservaResponse[]>;
  search(filters: ReservaFilters): Promise<ReservaResponse[]>;
  create(data: CreateReservaRequest): Promise<ReservaResponse>;
  update(id: string, data: UpdateReservaRequest): Promise<ReservaResponse>;
  delete(id: string): Promise<void>;
  // Existe reserva ativa do veículo que colide com o período informado?
  hasOverlapForVeiculo(
    idVeiculo: string,
    dataHoraInicio: Date,
    dataHoraFim: Date,
    excludeReservaId?: string,
  ): Promise<boolean>;
}
