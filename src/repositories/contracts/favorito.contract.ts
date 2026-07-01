import { VeiculoResponse } from "./veiculo.contract.js";

export interface CreateFavoritoRequest {
  idLocatario: string;
  idVeiculo: string;
}

// Dados do locador exibidos junto ao veículo favoritado.
export interface FavoritoLocadorResponse {
  id: string;
  empresa: string;
  cnpj: string;
}

// Dados da garagem atual do veículo favoritado (null se desvinculado).
export interface FavoritoGaragemResponse {
  id: string;
  nome: string;
  endereco: string;
  acessibilidade: boolean;
}

// Veículo como retornado na listagem de favoritos: mesmo shape das demais
// listagens (VeiculoResponse, com modeloVeiculo) + locador e garagem atual.
export interface FavoritoVeiculoResponse extends VeiculoResponse {
  locador: FavoritoLocadorResponse;
  garagem: FavoritoGaragemResponse | null;
}

export interface FavoritoResponse {
  id: string;
  idLocatario: string;
  idVeiculo: string;
  veiculo: FavoritoVeiculoResponse;
  criadoEm: Date;
  atualizadoEm: Date;
}
