import { StatusNotificacao, TipoAlertaVeiculo } from "@prisma/client";

// Linha retornada pela consulta de veículos inativos: veículo + modelo +
// locador (com a conta p/ destino do e-mail) resolvidos em uma única query.
export interface VeiculoInativoRow {
  idVeiculo: string;
  idLocador: string;
  placa: string;
  marca: string;
  modelo: string;
  ano: number;
  // Desde quando o veículo está INATIVO (última transição de status; fallback
  // para a criação do veículo quando não há histórico).
  inativoDesde: Date;
  locadorNome: string;
  locadorEmail: string;
  locadorEmpresa: string;
}

// Linha retornada pela agregação de avaliações por veículo (janela recente).
export interface VeiculoBaixaAvaliacaoRow {
  idVeiculo: string;
  idLocador: string;
  placa: string;
  marca: string;
  modelo: string;
  ano: number;
  media: number;
  quantidade: number;
  quantidadeNotasBaixas: number;
  locadorNome: string;
  locadorEmail: string;
  locadorEmpresa: string;
}

// Critério da regra de baixa avaliação. Um veículo é candidato quando, dentro
// da janela (desde):
//   (quantidade >= minAvaliacoes E media < mediaMinima)  OU
//   (quantidadeNotasBaixas >= minNotasBaixas)
// minAvaliacoes evita alertas baseados em uma única avaliação isolada.
export interface CriterioBaixaAvaliacao {
  desde: Date;
  mediaMinima: number;
  minAvaliacoes: number;
  notaBaixa: number;
  minNotasBaixas: number;
}

export interface RegistrarAlertaRequest {
  tipo: TipoAlertaVeiculo;
  idVeiculo: string;
  idLocador: string;
  descricao: string;
  destinatario: string;
  assunto: string;
  canal?: string;
}

export interface AlertaVeiculoResponse {
  id: string;
  tipo: TipoAlertaVeiculo;
  idVeiculo: string;
  idLocador: string;
  descricao: string;
  destinatario: string;
  assunto: string;
  canal: string;
  status: StatusNotificacao;
  mensagemErro: string | null;
  criadoEm: Date;
  enviadoEm: Date | null;
  resolvidoEm: Date | null;
  atualizadoEm: Date;
}
