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
}

export interface ContaResponse {
  id: string;
  nome: string;
  email: string;
  telefone: string | null;
  criadaEm: Date;
}
