export interface CreateServicoOpcionalRequest {
  nome: string;
  descricao: string;
  detalhesCobertura?: string | null;
  valor: number;
  ativo?: boolean;
}

export interface UpdateServicoOpcionalRequest {
  nome?: string;
  descricao?: string;
  detalhesCobertura?: string | null;
  valor?: number;
  ativo?: boolean;
}

export interface ServicoOpcionalFilters {
  ativo?: boolean;
}

export interface ServicoOpcionalResponse {
  id: string;
  nome: string;
  descricao: string;
  detalhesCobertura: string | null;
  valor: number;
  ativo: boolean;
  criadoEm: Date;
  atualizadoEm: Date;
}
