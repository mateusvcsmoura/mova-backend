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

export interface ReservaBloqueadaParaCondutor {
  id: string;
  idLocatario: string;
  idVeiculo: string;
  status: StatusReserva;
  dataHoraInicio: Date;
}
