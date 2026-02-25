export interface LocadorResponse {
  id: string;
  empresa: string;
  cnpj: string;
  email: string;
  criada_em: string;
  nome: string;
  telefone: string;
}

export interface CreateLocadorRequest {
  empresa: string;
  cnpj: string;
  id: string;
}
