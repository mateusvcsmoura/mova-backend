export interface LocatarioResponse {
  id: string;
  cpf: string;
  cnh: string;
  deficiencia_id?: string;
  // Campo real persistido pelo Prisma (Locatario.deficienciaId).
  deficienciaId?: string | null;
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
