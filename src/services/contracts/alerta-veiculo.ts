export interface AlertaVeiculoInfo {
  marca: string;
  modelo: string;
  ano: number;
  placa: string;
}

export interface AlertaLocadorInfo {
  nome: string;
  empresa: string;
}

export interface AlertaInatividadePayload {
  veiculo: AlertaVeiculoInfo;
  locador: AlertaLocadorInfo;
  diasInativos: number;
}

export interface AlertaBaixaAvaliacaoPayload {
  veiculo: AlertaVeiculoInfo;
  locador: AlertaLocadorInfo;
  media: number;
  quantidade: number;
  quantidadeNotasBaixas: number;
  notaBaixa: number;
  janelaDias: number;
}

// Conteúdo pronto para envio, gerado a partir do payload.
export interface AlertaVeiculoContent {
  subject: string;
  html: string;
  text: string;
}
