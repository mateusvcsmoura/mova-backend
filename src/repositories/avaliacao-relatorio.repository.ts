import {
  AgregadoVeiculoRow,
  AvaliacaoRelatorioFilters,
  ComentarioRecente,
  DistribuicaoNota,
  EvolucaoPeriodo,
  Granularidade,
  ResumoGeral,
} from "./contracts/avaliacao-relatorio.contract.js";

export interface IAvaliacaoRelatorioRepository {
  resumoGeral(filters: AvaliacaoRelatorioFilters): Promise<ResumoGeral>;
  distribuicaoNotas(
    filters: AvaliacaoRelatorioFilters,
  ): Promise<DistribuicaoNota[]>;
  aggregatePorVeiculo(
    filters: AvaliacaoRelatorioFilters,
  ): Promise<AgregadoVeiculoRow[]>;
  evolucao(
    filters: AvaliacaoRelatorioFilters,
    granularidade: Granularidade,
  ): Promise<EvolucaoPeriodo[]>;
  comentariosRecentes(
    filters: AvaliacaoRelatorioFilters,
    limite: number,
  ): Promise<ComentarioRecente[]>;
}
