import {
  CondutorResponse,
  CreateCondutorRequest,
  ReservaBloqueadaParaCondutor,
} from "./contracts/condutor.contract.js";

export interface ICondutorRepository {
  findByReservaId(idReserva: string): Promise<CondutorResponse[]>;
  findById(id: string): Promise<CondutorResponse | null>;
  createWithinLimit(
    data: CreateCondutorRequest,
    validarReserva: (reserva: ReservaBloqueadaParaCondutor) => Promise<void>,
  ): Promise<CondutorResponse>;
  delete(id: string): Promise<void>;
}
