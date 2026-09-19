import { StatusReserva } from "@prisma/client";

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

// Campos lidos da Reserva pela transação que protege RN02. A reserva já está
// bloqueada por SELECT ... FOR UPDATE quando este valor chega ao service.
export interface ReservaBloqueadaParaCondutor {
  id: string;
  idLocatario: string;
  idVeiculo: string;
  status: StatusReserva;
  dataHoraInicio: Date;
}
