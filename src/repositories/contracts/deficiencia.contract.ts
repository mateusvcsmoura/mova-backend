export interface CreateDeficienciaRequest {
  descricao: string;
}

export interface UpdateDeficienciaRequest {
  descricao?: string;
}

export interface DeficienciaResponse {
  id: string;
  descricao: string;
}
