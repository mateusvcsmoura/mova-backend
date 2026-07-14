import {
  CondutorResponse,
  CreateCondutorRequest,
} from "./contracts/condutor.contract.js";

export interface ICondutorRepository {
  findByReservaId(idReserva: string): Promise<CondutorResponse[]>;
  countByReservaId(idReserva: string): Promise<number>;
  findByReservaAndCnh(
    idReserva: string,
    cnh: string,
  ): Promise<CondutorResponse | null>;
  findById(id: string): Promise<CondutorResponse | null>;
  create(data: CreateCondutorRequest): Promise<CondutorResponse>;
  delete(id: string): Promise<void>;
}
