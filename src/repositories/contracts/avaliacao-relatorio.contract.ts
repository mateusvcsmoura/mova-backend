// Nível de agregação da evolução temporal. Mapeado para o unit do date_trunc
// do Postgres no repositório (dia -> day, mes -> month, ano -> year).
export type Granularidade = "dia" | "mes" | "ano";

// Filtros aplicados a TODAS as consultas do relatório. idLocador é sempre
// derivado do usuário autenticado (nunca do cliente) — garante o isolamento.
export interface AvaliacaoRelatorioFilters {
  idLocador: string;
  dataInicio?: Date;
  dataFim?: Date;
  idVeiculo?: string;
  idModeloVeiculo?: string;
  notaMin?: number;
  notaMax?: number;
}

// Resumo geral (Prisma aggregate). media/maior/menor são null quando não há
// avaliações no recorte.
export interface ResumoGeral {
  total: number;
  media: number | null;
  maior: number | null;
  menor: number | null;
}

// Uma faixa de nota e quantas avaliações a receberam. Como a nota é
// Decimal(2,1), a distribuição é por valor distinto de nota (ex.: 4, 4.5, 5).
export interface DistribuicaoNota {
  nota: number;
  quantidade: number;
}

// Linha agregada por veículo (retornada pelo groupBy via SQL, já com os campos
// de exibição resolvidos no mesmo JOIN — sem N+1). O service reusa estas linhas
// tanto para "média por veículo" quanto para o "ranking mais avaliados".
export interface AgregadoVeiculoRow {
  idVeiculo: string;
  placa: string;
  marca: string;
  modelo: string;
  ano: number;
  quantidade: number;
  media: number;
  maior: number;
  menor: number;
}

// Bucket temporal (início do período em ISO) com quantidade e média.
export interface EvolucaoPeriodo {
  periodo: string;
  quantidade: number;
  media: number;
}

// Dados do veículo expostos nos relatórios (subconjunto de VeiculoResponse,
// suficiente para rótulos/gráficos no frontend).
export interface RelatorioVeiculo {
  id: string;
  placa: string;
  marca: string;
  modelo: string;
  ano: number;
}

// Comentário recente com o veículo associado.
export interface ComentarioRecente {
  id: string;
  nota: number;
  comentario: string;
  data: Date;
  veiculo: RelatorioVeiculo;
}
