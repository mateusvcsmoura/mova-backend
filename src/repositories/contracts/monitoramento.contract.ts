import { StatusNotificacao, TipoAlertaVeiculo } from "@prisma/client";

export interface VeiculoInativoRow {
  idVeiculo: string;
  idLocador: string;
  placa: string;
  marca: string;
  modelo: string;
  ano: number;
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
  tentativas: number;
  criadoEm: Date;
  enviadoEm: Date | null;
  resolvidoEm: Date | null;
  atualizadoEm: Date;
}
