export interface LocadorResponse {
  id: string;
  empresa: string;
  cnpj: string;
}

export interface CreateLocadorRequest {
  empresa: string;
  cnpj: string;
  id: string;
}

export interface UpdateLocadorRequest {
  empresa?: string;
  cnpj?: string;
}
