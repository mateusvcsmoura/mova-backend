import { StatusGaragem, StatusVeiculo } from "@prisma/client";

import { LocadorResponse } from "./locador.contract.js";
import { VeiculoResponse } from "./veiculo.contract.js";

export interface GaragemBaseResponse {
  id: string;
  idLocador: string;
  nome: string;
  endereco: string;
  capacidade: number;
  veiculosAlocados: number;
  acessibilidade: boolean;
  status: StatusGaragem;
  criadaEm: Date;
  atualizadoEm: Date;
}

export interface GaragemDetalhadaResponse extends GaragemBaseResponse {
  locador: LocadorResponse;
  veiculos: VeiculoResponse[];
}

export interface CreateGaragemRequest {
  idLocador: string;
  nome: string;
  endereco: string;
  capacidade: number;
  acessibilidade?: boolean;
  status?: StatusGaragem;
}

export interface UpdateGaragemRequest {
  nome?: string;
  endereco?: string;
  capacidade?: number;
  acessibilidade?: boolean;
  status?: StatusGaragem;
}

export interface GaragemFilters {
  acessibilidade?: boolean;
  idLocador?: string;
  capacidadeMin?: number;
  capacidadeMax?: number;
  nome?: string;
  comVagasDisponiveis?: boolean;
  status?: StatusGaragem;
}

export interface GaragemVeiculosFilters {
  status?: StatusVeiculo;
}
