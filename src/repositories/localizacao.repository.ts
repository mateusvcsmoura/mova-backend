import {
  CreateLocalizacaoRequest,
  LocalizacaoResponse,
} from "./contracts/localizacao.contract.js";

export interface ILocalizacaoRepository {
  // Registra um novo ponto. Nunca sobrescreve registros anteriores.
  create(data: CreateLocalizacaoRequest): Promise<LocalizacaoResponse>;
  // Histórico completo do veículo, ordenado cronologicamente (mais recente primeiro).
  findByVeiculoId(idVeiculo: string): Promise<LocalizacaoResponse[]>;
  // Apenas a última localização conhecida (ordenação + limite no banco).
  findLatestByVeiculoId(
    idVeiculo: string,
  ): Promise<LocalizacaoResponse | null>;
}
