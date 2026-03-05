export interface CreateVeiculoRequest {
  id_locador: string;
  placa: string;
  marca: string;
  modelo: string;
  ano: number;
  cambio: string;
  capacidade: number;
  status: string;
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
  status?: string;
  eletrico?: boolean;
  adaptado?: boolean;
}

export interface VeiculoResponse {
  id: string;
  id_locador: string;
  placa: string;
  marca: string;
  modelo: string;
  ano: number;
  cambio: string;
  capacidade: number;
  status: string;
  eletrico: boolean;
  adaptado: boolean;
  criado_em: string;
}
