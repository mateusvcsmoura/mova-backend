export interface CreateContaRequest {
  nome: string;
  email: string;
  telefone?: string;
  senha: string;
  cep: string;
  endereco: string;
}

export interface UpdateContaRequest {
  nome?: string;
  email?: string;
  telefone?: string;
  cep?: string;
  endereco?: string;
}

export interface ContaResponse {
  id: string;
  nome: string;
  email: string;
  telefone: string | null;
  criadaEm: Date;
  cep: string;
  endereco: string;
}
