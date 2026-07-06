// Condutor adicional de uma reserva (RF12).
export interface CondutorResponse {
  id: string;
  idReserva: string;
  nome: string;
  cpf: string | null;
  cnh: string;
  criadoEm: Date;
}

export interface CreateCondutorRequest {
  idReserva: string;
  nome: string;
  cpf?: string;
  cnh: string;
}
