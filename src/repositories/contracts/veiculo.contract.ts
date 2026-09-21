import {
  Cargo,
  CategoriaVeiculo,
  StatusGaragem,
  StatusVeiculo,
} from "@prisma/client";
import { PaginationParams } from "../../shared/pagination.js";

export interface ModeloVeiculoData {
  idLocador: string;
  marca: string;
  modelo: string;
  ano: number;
  cambio: string;
  capacidade: number;
  eletrico: boolean;
  adaptado: boolean;
  categoria?: CategoriaVeiculo;
  // Preço da diária — fonte de verdade do valor da reserva.
  valorDiaria: number;
}

export interface CreateVeiculoRequest extends ModeloVeiculoData {
  placa: string;
  garagemId?: string | null;
  status?: StatusVeiculo;
}

export interface CreateVeiculoLoteRequest extends ModeloVeiculoData {
  placas: string[];
  garagemId?: string | null;
}

export interface UpdateVeiculoRequest {
  placa?: string;
  status?: StatusVeiculo;
  garagemId?: string | null;
  // Atualização coordenada do catálogo associada ao veículo. O bloco é
  // explícito para não confundir campos da instância com os do modelo.
  modelo?: UpdateModeloVeiculoRequest;
}

export interface VeiculoFilters {
  idLocador?: string;
  marca?: string;
  modelo?: string;
  ano?: number;
  cambio?: string;
  capacidade?: number;
  eletrico?: boolean;
  adaptado?: boolean;
  categoria?: CategoriaVeiculo;
  garagemId?: string;
}

// Usado pelo service.list(), montado pelo controller
export interface ListVeiculosRequest {
  id: string;
  cargo: Cargo;
  filters?: VeiculoFilters;
  pagination: PaginationParams;
}

export interface ModeloVeiculoResponse {
  id: string;
  idLocador: string;
  marca: string;
  modelo: string;
  ano: number;
  cambio: string;
  capacidade: number;
  eletrico: boolean;
  adaptado: boolean;
  categoria: CategoriaVeiculo | null;
  // Decimal(10,2) no banco -> number na API.
  valorDiaria: number;
  criadoEm: Date;
}

export interface VeiculoResponse {
  id: string;
  idLocador: string;
  idModeloVeiculo: string;
  modeloVeiculo: ModeloVeiculoResponse;
  garagemId: string | null;
  garagem?: GaragemVeiculoResponse | null;
  placa: string;
  status: StatusVeiculo;
  criadoEm: Date;
}

export interface UpdateModeloVeiculoRequest {
  marca?: string;
  modelo?: string;
  ano?: number;
  cambio?: string;
  capacidade?: number;
  eletrico?: boolean;
  adaptado?: boolean;
  categoria?: CategoriaVeiculo | null;
  valorDiaria?: number;
}

/** Dados mínimos da garagem necessários para localizar o veículo no catálogo. */
export interface GaragemVeiculoResponse {
  id: string;
  nome: string;
  status: StatusGaragem;
}
