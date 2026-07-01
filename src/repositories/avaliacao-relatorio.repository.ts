import {
  AgregadoVeiculoRow,
  AvaliacaoRelatorioFilters,
  ComentarioRecente,
  DistribuicaoNota,
  EvolucaoPeriodo,
  Granularidade,
  ResumoGeral,
} from "./contracts/avaliacao-relatorio.contract.js";

// Consultas analíticas de avaliações, sempre agregadas no banco. Todas recebem
// o mesmo conjunto de filtros (com idLocador obrigatório) para garantir o
// isolamento por locador em qualquer consulta.
export interface IAvaliacaoRelatorioRepository {
  resumoGeral(filters: AvaliacaoRelatorioFilters): Promise<ResumoGeral>;
  distribuicaoNotas(
    filters: AvaliacaoRelatorioFilters,
  ): Promise<DistribuicaoNota[]>;
  // Agregado por veículo (count/avg/min/max), ordenado pela maior média. O
  // ranking de mais avaliados é derivado destas mesmas linhas no service.
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
