import { Cargo, StatusVeiculo } from "@prisma/client";

export interface ModeloVeiculoData {
  idLocador: string;
  marca: string;
  modelo: string;
  ano: number;
  cambio: string;
  capacidade: number;
  eletrico: boolean;
  adaptado: boolean;
}

export interface CreateVeiculoRequest extends ModeloVeiculoData {
  placa: string;
  garagemId?: string;
  status?: StatusVeiculo;
}

export interface CreateVeiculoLoteRequest extends ModeloVeiculoData {
  placas: string[];
  garagemId?: string;
}

export interface UpdateVeiculoRequest {
  placa?: string;
  status?: StatusVeiculo;
  garagemId?: string | null;
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
  garagemId?: string;
}

// Usado pelo service.list(), montado pelo controller
export interface ListVeiculosRequest {
  id: string;
  cargo: Cargo;
  filters?: VeiculoFilters;
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
  criadoEm: Date;
}

export interface VeiculoResponse {
  id: string;
  idLocador: string;
  idModeloVeiculo: string;
  modeloVeiculo: ModeloVeiculoResponse;
  garagemId: string | null;
  placa: string;
  status: StatusVeiculo;
  criadoEm: Date;
}
