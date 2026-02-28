export interface LocatarioResponse {
  id: string;
  cpf: string;
  cnh: string;
  deficiencia_id?: string;
}

export interface CreateLocatarioRequest {
  cpf: string;
  cnh: string;
  deficiencia_id?: string;
  id: string;
}

export interface UpdateLocatarioRequest {
  cpf?: string;
  cnh?: string;
  deficiencia_id?: string;
}
