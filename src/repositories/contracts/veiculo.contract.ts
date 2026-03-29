import { StatusVeiculo } from "@prisma/client";

export interface VeiculoFilters {
  placa?: string;
  idLocador?: string;
  marca?: string;
  modelo?: string;
  ano?: number;
  cambio?: string;
  capacidade?: number;
  status?: StatusVeiculo;
  eletrico?: boolean;
  adaptado?: boolean;
}

export interface CreateVeiculoRequest {
  idLocador: string;
  placa: string;
  marca: string;
  modelo: string;
  ano: number;
  cambio: string;
  capacidade: number;
  status?: StatusVeiculo;
  eletrico: boolean;
  adaptado: boolean;
}

export interface UpdateVeiculoRequest {
  placa?: string;
  marca?: string;
  modelo?: string;
  ano?: number;
  cambio?: string;
  capacidade?: number;
  status?: StatusVeiculo;
  eletrico?: boolean;
  adaptado?: boolean;
}

export interface VeiculoResponse {
  id: string;
  idLocador: string;
  placa: string;
  marca: string;
  modelo: string;
  ano: number;
  cambio: string;
  capacidade: number;
  status: StatusVeiculo;
  eletrico: boolean;
  adaptado: boolean;
  criadoEm: Date;
}
