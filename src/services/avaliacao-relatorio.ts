import {
  AgregadoVeiculoRow,
  AvaliacaoRelatorioFilters,
  ComentarioRecente,
  DistribuicaoNota,
  EvolucaoPeriodo,
  Granularidade,
  RelatorioVeiculo,
  ResumoGeral,
} from "../repositories/contracts/avaliacao-relatorio.contract.js";
import { IAvaliacaoRelatorioRepository } from "../repositories/avaliacao-relatorio.repository.js";

// Média das avaliações de um veículo (ordenada pela maior média no dashboard).
export interface MediaPorVeiculo {
  veiculo: RelatorioVeiculo;
  quantidade: number;
  media: number;
  maior: number;
  menor: number;
}

// Ranking dos veículos mais avaliados (ordenado pela quantidade).
export interface RankingVeiculo {
  veiculo: RelatorioVeiculo;
  quantidade: number;
}

// Parâmetros já validados/normalizados pelo controller (schema Zod).
export interface DashboardOptions {
  dataInicio?: Date;
  dataFim?: Date;
  idVeiculo?: string;
  idModeloVeiculo?: string;
  notaMin?: number;
  notaMax?: number;
  granularidade: Granularidade;
  limiteComentarios: number;
}

export interface AvaliacaoDashboard {
  resumo: ResumoGeral;
  distribuicao: DistribuicaoNota[];
  mediaPorVeiculo: MediaPorVeiculo[];
  ranking: RankingVeiculo[];
  evolucao: EvolucaoPeriodo[];
  comentariosRecentes: ComentarioRecente[];
}

export class AvaliacaoRelatorioService {
  constructor(
    private readonly relatorioRepository: IAvaliacaoRelatorioRepository,
  ) {}

  private toRelatorioVeiculo(row: AgregadoVeiculoRow): RelatorioVeiculo {
    return {
      id: row.idVeiculo,
      placa: row.placa,
      marca: row.marca,
      modelo: row.modelo,
      ano: row.ano,
    };
  }

  // Gera o dashboard completo do locador autenticado. O idLocador vem sempre do
  // token (parâmetro), nunca do cliente — isolamento garantido em todas as
  // consultas. Sem avaliações, retorna zeros/listas vazias (não é erro).
  gerarDashboard = async (
    idLocador: string,
    options: DashboardOptions,
  ): Promise<AvaliacaoDashboard> => {
    const filters: AvaliacaoRelatorioFilters = {
      idLocador,
      dataInicio: options.dataInicio,
      dataFim: options.dataFim,
      idVeiculo: options.idVeiculo,
      idModeloVeiculo: options.idModeloVeiculo,
      notaMin: options.notaMin,
      notaMax: options.notaMax,
    };

    // Consultas independentes rodam em paralelo (mesma pool). Cada uma agrega no
    // banco; nenhuma carrega o conjunto bruto de avaliações em memória.
    const [resumo, distribuicao, agregadoVeiculo, evolucao, comentariosRecentes] =
      await Promise.all([
        this.relatorioRepository.resumoGeral(filters),
        this.relatorioRepository.distribuicaoNotas(filters),
        this.relatorioRepository.aggregatePorVeiculo(filters),
        this.relatorioRepository.evolucao(filters, options.granularidade),
        this.relatorioRepository.comentariosRecentes(
          filters,
          options.limiteComentarios,
        ),
      ]);

    // agregadoVeiculo já vem ordenado pela maior média (repo).
    const mediaPorVeiculo: MediaPorVeiculo[] = agregadoVeiculo.map((row) => ({
      veiculo: this.toRelatorioVeiculo(row),
      quantidade: row.quantidade,
      media: row.media,
      maior: row.maior,
      menor: row.menor,
    }));

    // Ranking = mesmas linhas reordenadas por quantidade (sem nova consulta).
    const ranking: RankingVeiculo[] = [...agregadoVeiculo]
      .sort((a, b) => b.quantidade - a.quantidade)
      .map((row) => ({
        veiculo: this.toRelatorioVeiculo(row),
        quantidade: row.quantidade,
      }));

    return {
      resumo,
      distribuicao,
      mediaPorVeiculo,
      ranking,
      evolucao,
      comentariosRecentes,
    };
  };
}
