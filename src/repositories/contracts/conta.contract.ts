export interface CreateContaRequest {
  nome: string;
  email: string;
  telefone?: string;
  senha: string;
}

export interface UpdateContaRequest {
  nome?: string;
  email?: string;
  telefone?: string;
  senha?: string;
}

export interface ContaResponse {
  id: string;
  nome: string;
  email: string;
  telefone?: string;
  criada_em: Date;
}