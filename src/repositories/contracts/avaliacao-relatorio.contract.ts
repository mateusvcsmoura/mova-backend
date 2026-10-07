export type Granularidade = "dia" | "mes" | "ano";

export interface AvaliacaoRelatorioFilters {
  idLocador: string;
  dataInicio?: Date;
  dataFim?: Date;
  idVeiculo?: string;
  idModeloVeiculo?: string;
  notaMin?: number;
  notaMax?: number;
}

export interface ResumoGeral {
  total: number;
  media: number | null;
  maior: number | null;
  menor: number | null;
}

export interface DistribuicaoNota {
  nota: number;
  quantidade: number;
}

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
