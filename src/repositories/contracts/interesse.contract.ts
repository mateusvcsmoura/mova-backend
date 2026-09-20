import { StatusGaragem, StatusInteresse, StatusVeiculo } from "@prisma/client";
import { VeiculoResponse } from "./veiculo.contract.js";

export interface CreateInteresseRequest {
  idLocatario: string;
  idVeiculo: string;
}

// Dados do locador exibidos junto ao veículo de interesse.
export interface InteresseLocadorResponse {
  id: string;
  empresa: string;
  cnpj: string;
}

// Dados da garagem atual do veículo de interesse (null se desvinculado).
export interface InteresseGaragemResponse {
  id: string;
  nome: string;
  endereco: string;
  acessibilidade: boolean;
  status: StatusGaragem;
}

// Veículo como retornado na listagem de interesses: mesmo shape das demais
// listagens (VeiculoResponse, com modeloVeiculo) + locador e garagem atual.
export interface InteresseVeiculoDetalheResponse extends VeiculoResponse {
  locador: InteresseLocadorResponse;
  garagem: InteresseGaragemResponse | null;
}

export interface InteresseResponse {
  id: string;
  idLocatario: string;
  idVeiculo: string;
  status: StatusInteresse;
  // Consentimento explícito (opt-in) para receber notificações.
  optInEm: Date;
  canceladoEm: Date | null;
  notificadoEm: Date | null;
  veiculo: InteresseVeiculoDetalheResponse;
  criadoEm: Date;
  atualizadoEm: Date;
}

// Shape público mínimo para descoberta de veículos que podem voltar a ficar
// disponíveis. Não expõe placa, idLocador ou outros dados administrativos.
export interface InteresseVeiculoDescobertaResponse {
  id: string;
  status: StatusVeiculo;
  modeloVeiculo: {
    id: string;
    marca: string;
    modelo: string;
    ano: number;
    cambio: string;
    capacidade: number;
    eletrico: boolean;
    adaptado: boolean;
    categoria: VeiculoResponse["modeloVeiculo"]["categoria"];
    valorDiaria: number;
  };
  garagem: {
    id: string;
    nome: string;
    status: StatusGaragem;
  } | null;
}

// Inscrição ativa + destinatário resolvido em uma única consulta (JOIN com
// Locatario -> Conta), usada pelo disparo automático. Evita N+1 ao notificar.
export interface InteressadoResponse {
  id: string;
  idLocatario: string;
  idVeiculo: string;
  locatario: {
    nome: string;
    email: string;
  };
}
